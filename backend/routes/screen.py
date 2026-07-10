import os
import re
import json
import sys
from celery import current_task
from langchain_community.document_loaders import PyPDFLoader

# See core/celery_app.py for why this is needed — without it, the deferred
# `from models...` / `from routes...` imports below can fail with
# "No module named 'models'/'routes'" depending on how celery was launched.
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from core.celery_app import celery_app
from core.chunker import TextChunker
from core.faiss import VectorStore
from core.graph import TalentIQGraph


def extract_name_from_text(cv_text: str, filename: str) -> str:
    """Smart name extraction from CV text, fallback to filename."""
    if cv_text:
        lines = [l.strip() for l in cv_text[:400].split('\n') if l.strip()]
        for line in lines[:6]:
            if any(x in line.lower() for x in ['@', 'http', 'linkedin', 'github', 'phone', 'tel:', 'email', 'address', 'objective', 'summary']):
                continue
            words = line.split()
            if 2 <= len(words) <= 4 and all(w[0].isupper() if w.isalpha() else True for w in words):
                if sum(1 for w in words if w.isalpha() and w[0].isupper()) >= 2:
                    return line

    # Fallback: parse filename
    name = os.path.splitext(filename)[0]
    name = re.sub(r'[_\-](cv|resume|application|updated|new|final|2024|2025|2026).*', '', name, flags=re.I)
    name = re.sub(r'[_\-]', ' ', name).strip()
    words = name.split()
    if len(words) >= 2:
        return ' '.join(w.capitalize() for w in words if w.isalpha())
    return name.title() or filename


@celery_app.task(bind=True, name="tasks.screening_task.run_bulk_screening")
def run_bulk_screening(
    self,
    job_description: str,
    top_n: int,
    pdf_paths: list,
    candidate_names: list,
    hr_user_id: int = None,
    hr_email: str = "",
    hr_name: str = "HR Manager",
    job_title: str = "Screening",
    job_description_raw: str = "",
):
    total = len(pdf_paths)
    results = []
    agent = TalentIQGraph()

    for i, (pdf_path, raw_name) in enumerate(zip(pdf_paths, candidate_names)):
        self.update_state(
            state="PROGRESS",
            meta={
                "current": i + 1, "total": total,
                "current_name": raw_name,
                "status": f"Screening {raw_name}... ({i+1}/{total})",
                "results": results,
            }
        )

        try:
            loader = PyPDFLoader(pdf_path)
            documents = loader.load()
            if not documents:
                results.append({"filename": raw_name, "candidate_name": raw_name, "ai_score": 0, "error": "Could not extract text."})
                continue

            cv_text = " ".join([d.page_content for d in documents])
            candidate_name = extract_name_from_text(cv_text, raw_name)

            chunker = TextChunker()
            chunks = chunker.split_documents(documents)

            vs = VectorStore()
            faiss_index = vs.create_in_memory(chunks)
            report = agent.run_screening_with_index(job_description=job_description, faiss_index=faiss_index)

            results.append({
                "filename": raw_name,
                "candidate_name": candidate_name,
                "ai_score": report.get("candidate_score", 0),
                "matched_skills": report.get("matched_skills", []),
                "missing_skills": report.get("missing_skills", []),
                "final_verdict": report.get("final_verdict", "Reviewed"),
                "deep_analysis": report.get("screening_analysis", ""),
                "is_shortlisted": report.get("is_shortlisted", False),
                "trigger_interview": report.get("trigger_interview", False),
            })

        except Exception as e:
            print(f"[Task] Error on {raw_name}: {e}")
            results.append({"filename": raw_name, "candidate_name": raw_name, "ai_score": 0, "error": str(e)})

    ranked = sorted(results, key=lambda r: r.get("ai_score", 0), reverse=True)

    # Save to DB
    job_id = None
    if hr_user_id:
        try:
            from models.database import session_local
            from models.job import Job
            from models.application import Application
            from datetime import datetime

            db = session_local()
            job = Job(
                hr_user_id=hr_user_id,
                title=job_title or "Untitled Role",
                description=job_description_raw or job_description,
            )
            db.add(job)
            db.flush()
            job_id = str(job.id)

            for r in ranked:
                app = Application(
                    job_id=job.id,
                    candidate_id=hr_user_id,
                    cv_filename=r.get("filename", ""),
                    ai_score=r.get("ai_score", 0),
                    matched_skills=json.dumps(r.get("matched_skills", [])),
                    missing_skills=json.dumps(r.get("missing_skills", [])),
                    final_verdict=r.get("final_verdict", ""),
                    deep_analysis=r.get("deep_analysis", ""),
                    is_shortlisted="yes" if r.get("is_shortlisted") else "no",
                    trigger_interview="yes" if r.get("trigger_interview") else "no",
                    screened_at=datetime.utcnow(),
                )
                db.add(app)
            db.commit()
            db.close()
            print(f"[Task] Saved job {job_id} with {len(ranked)} applications")
        except Exception as e:
            print(f"[Task] DB save failed: {e}")

    # Send email notification
    if hr_email:
        try:
            from routes.bulk import send_screening_complete_email
            send_screening_complete_email(hr_email, hr_name, job_title, total, ranked[:5])
        except Exception as e:
            print(f"[Task] Email failed: {e}")

    if hr_user_id:
        try:
            from core.analytics import track
            track(hr_user_id, "bulk_screening_completed", {
                "total_cvs": total,
                "job_id": job_id,
                "shortlisted": sum(1 for r in ranked if r.get("is_shortlisted")),
            })
        except Exception as e:
            print(f"[Task] Analytics tracking failed: {e}")

    return {
        "status": "done",
        "total_cvs_processed": total,
        "job_id": job_id,
        "top_candidates": ranked[:top_n],
        "all_results": ranked,
    }