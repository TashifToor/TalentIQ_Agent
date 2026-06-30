import os
import shutil
import zipfile
import tempfile
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from sqlalchemy.orm import Session
from langchain_community.document_loaders import PyPDFLoader

from models.database import get_db
from middleware.auth import get_current_user
from models.user import User
from core.chunker import TextChunker
from core.faiss import VectorStore
from core.graph import TalentIQGraph

router = APIRouter(prefix="/bulk", tags=["Bulk Screening"])

MAX_CVS_PER_ZIP = 25  # safety limit — sequential LLM calls, prevent abuse/timeouts


def require_hr(current_user: User):
    if current_user.role != "hr":
        raise HTTPException(status_code=403, detail="Only HR users can do this.")
    return current_user


@router.post("/screen")
async def bulk_screen(
    job_description: str = Form(...),
    top_n: int = Form(3),
    zip_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    HR uploads a ZIP of candidate CVs (PDFs) + a job description + how many
    top candidates they want. Each CV is screened individually through the
    existing AI pipeline, then ranked by score — top_n returned first.
    """
    require_hr(current_user)

    if not job_description or not job_description.strip():
        raise HTTPException(status_code=400, detail="job_description is required.")

    if top_n < 1:
        top_n = 1
    if top_n > MAX_CVS_PER_ZIP:
        top_n = MAX_CVS_PER_ZIP

    if not zip_file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Please upload a .zip file containing CVs.")

    with tempfile.TemporaryDirectory() as tmp_dir:
        zip_path = os.path.join(tmp_dir, zip_file.filename)
        with open(zip_path, "wb") as f:
            shutil.copyfileobj(zip_file.file, f)

        extract_dir = os.path.join(tmp_dir, "extracted")
        os.makedirs(extract_dir, exist_ok=True)
        try:
            with zipfile.ZipFile(zip_path, "r") as z:
                z.extractall(extract_dir)
        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="Invalid zip file.")

        pdf_files = []
        for root, _, files in os.walk(extract_dir):
            for fn in files:
                if fn.lower().endswith(".pdf"):
                    pdf_files.append(os.path.join(root, fn))

        if not pdf_files:
            raise HTTPException(status_code=400, detail="No PDF CVs found inside the zip.")

        if len(pdf_files) > MAX_CVS_PER_ZIP:
            raise HTTPException(
                status_code=400,
                detail=f"Too many CVs in zip ({len(pdf_files)}). Max {MAX_CVS_PER_ZIP} per upload.",
            )

        results = []
        for pdf_path in pdf_files:
            candidate_name = os.path.splitext(os.path.basename(pdf_path))[0]
            try:
                loader = PyPDFLoader(pdf_path)
                documents = loader.load()
                if not documents:
                    results.append({
                        "filename": candidate_name,
                        "ai_score": 0,
                        "error": "Could not extract text from this PDF.",
                    })
                    continue

                chunker = TextChunker()
                chunks = chunker.split_documents(documents)

                # Overwrites the shared FAISS index — fine since we screen
                # one CV at a time, sequentially, before moving to the next.
                vector_store = VectorStore()
                vector_store.create_and_save_store(chunks)

                agent = TalentIQGraph()
                report = agent.run_screening(job_description=job_description)

                results.append({
                    "filename": candidate_name,
                    "ai_score": report.get("candidate_score", 0),
                    "matched_skills": report.get("matched_skills", []),
                    "missing_skills": report.get("missing_skills", []),
                    "final_verdict": report.get("final_verdict", "Reviewed"),
                    "deep_analysis": report.get("screening_analysis", ""),
                    "is_shortlisted": report.get("is_shortlisted", False),
                    "trigger_interview": report.get("trigger_interview", False),
                })
            except Exception as e:
                print(f"[Bulk Screen] Error processing {candidate_name}: {e}")
                results.append({
                    "filename": candidate_name,
                    "ai_score": 0,
                    "error": str(e),
                })

        ranked = sorted(results, key=lambda r: r.get("ai_score", 0), reverse=True)
        top_results = ranked[:top_n]

        return {
            "status": "success",
            "total_cvs_processed": len(pdf_files),
            "requested_top_n": top_n,
            "top_candidates": top_results,
            "all_results": ranked,
        }