import os
import shutil
import zipfile
import tempfile
from celery import current_task
from langchain_community.document_loaders import PyPDFLoader

from core.celery_app import celery_app
from core.chunker import TextChunker
from core.faiss import VectorStore
from core.graph import TalentIQGraph


@celery_app.task(bind=True, name="tasks.screening_task.run_bulk_screening")
def run_bulk_screening(self, job_description: str, top_n: int, pdf_paths: list[str], candidate_names: list[str]):
    """
    Background mein sab CVs screen karta hai.
    Progress updates: { current, total, current_name, status }
    """
    total = len(pdf_paths)
    results = []
    agent = TalentIQGraph()  # single agent for all CVs

    for i, (pdf_path, name) in enumerate(zip(pdf_paths, candidate_names)):
        # Progress update — frontend poll karta rahe
        self.update_state(
            state="PROGRESS",
            meta={
                "current": i + 1,
                "total": total,
                "current_name": name,
                "status": f"Screening {name}… ({i+1}/{total})",
                "results": results,  # partial results bhi bhejte hain
            }
        )

        try:
            loader = PyPDFLoader(pdf_path)
            documents = loader.load()
            if not documents:
                results.append({ "filename": name, "ai_score": 0, "error": "Could not extract text." })
                continue

            chunker = TextChunker()
            chunks = chunker.split_documents(documents)

            vs = VectorStore()
            faiss_index = vs.create_in_memory(chunks)
            report = agent.run_screening_with_index(job_description=job_description, faiss_index=faiss_index)

            results.append({
                "filename": name,
                "ai_score": report.get("candidate_score", 0),
                "matched_skills": report.get("matched_skills", []),
                "missing_skills": report.get("missing_skills", []),
                "final_verdict": report.get("final_verdict", "Reviewed"),
                "deep_analysis": report.get("screening_analysis", ""),
                "is_shortlisted": report.get("is_shortlisted", False),
                "trigger_interview": report.get("trigger_interview", False),
            })
        except Exception as e:
            print(f"[Task] Error on {name}: {e}")
            results.append({ "filename": name, "ai_score": 0, "error": str(e) })

    ranked = sorted(results, key=lambda r: r.get("ai_score", 0), reverse=True)
    return {
        "status": "done",
        "total_cvs_processed": total,
        "top_candidates": ranked[:top_n],
        "all_results": ranked,
    }