import os
import shutil
import zipfile
import tempfile
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from celery.result import AsyncResult

from models.database import get_db
from middleware.auth import get_current_user
from models.user import User
from core.celery_app import celery_app
from tasks.screening_task import run_bulk_screening

router = APIRouter(prefix="/bulk", tags=["Bulk Screening"])
MAX_CVS = 25

# Temp dir for uploaded files — Celery worker bhi same machine pe hai
UPLOAD_TMP = os.path.join(os.path.dirname(__file__), "..", "data", "bulk_tmp")
os.makedirs(UPLOAD_TMP, exist_ok=True)


def require_hr(user: User):
    if (user.role or "").lower() != "hr":
        raise HTTPException(status_code=403, detail="Only HR users can do this.")
    return user


@router.post("/screen")
async def bulk_screen(
    job_description: str = Form(...),
    top_n: int = Form(3),
    zip_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)

    if not job_description.strip():
        raise HTTPException(status_code=400, detail="job_description is required.")
    if not zip_file.filename.lower().endswith((".zip", ".pdf")):
        raise HTTPException(status_code=400, detail="Upload a .zip or .pdf file.")

    # Save upload to a persistent tmp dir (Celery worker needs to read it)
    task_tmp = tempfile.mkdtemp(dir=UPLOAD_TMP)

    try:
        if zip_file.filename.lower().endswith(".pdf"):
            name = os.path.splitext(zip_file.filename)[0]
            pdf_path = os.path.join(task_tmp, zip_file.filename)
            with open(pdf_path, "wb") as f:
                shutil.copyfileobj(zip_file.file, f)
            pdf_paths = [pdf_path]
            candidate_names = [name]
        else:
            zip_path = os.path.join(task_tmp, "upload.zip")
            with open(zip_path, "wb") as f:
                shutil.copyfileobj(zip_file.file, f)
            extract_dir = os.path.join(task_tmp, "extracted")
            os.makedirs(extract_dir, exist_ok=True)
            try:
                with zipfile.ZipFile(zip_path, "r") as z:
                    z.extractall(extract_dir)
            except zipfile.BadZipFile:
                shutil.rmtree(task_tmp)
                raise HTTPException(status_code=400, detail="Invalid zip file.")

            pdf_paths, candidate_names = [], []
            for root, _, files in os.walk(extract_dir):
                for fn in files:
                    if fn.lower().endswith(".pdf"):
                        pdf_paths.append(os.path.join(root, fn))
                        candidate_names.append(os.path.splitext(fn)[0])

            if not pdf_paths:
                shutil.rmtree(task_tmp)
                raise HTTPException(status_code=400, detail="No PDFs found in zip.")
            if len(pdf_paths) > MAX_CVS:
                shutil.rmtree(task_tmp)
                raise HTTPException(status_code=400, detail=f"Max {MAX_CVS} CVs allowed.")

        top_n = max(1, min(top_n, MAX_CVS))
        task = run_bulk_screening.delay(job_description, top_n, pdf_paths, candidate_names)

        return {
            "task_id": task.id,
            "status": "queued",
            "total_cvs": len(pdf_paths),
            "message": f"Screening {len(pdf_paths)} CV(s) started. Poll /bulk/status/{task.id} for progress.",
        }

    except HTTPException:
        raise
    except Exception as e:
        shutil.rmtree(task_tmp, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{task_id}")
def get_task_status(task_id: str, current_user: User = Depends(get_current_user)):
    require_hr(current_user)
    result = AsyncResult(task_id, app=celery_app)

    if result.state == "PENDING":
        return { "task_id": task_id, "state": "pending", "status": "Waiting in queue…" }

    if result.state == "STARTED":
        return { "task_id": task_id, "state": "started", "status": "Starting up…" }

    if result.state == "PROGRESS":
        meta = result.info or {}
        return {
            "task_id": task_id,
            "state": "progress",
            "current": meta.get("current", 0),
            "total": meta.get("total", 0),
            "current_name": meta.get("current_name", ""),
            "status": meta.get("status", "Processing…"),
            "partial_results": meta.get("results", []),
        }

    if result.state == "SUCCESS":
        data = result.result or {}
        return {
            "task_id": task_id,
            "state": "success",
            "status": "done",
            **data,
        }

    if result.state == "FAILURE":
        return {
            "task_id": task_id,
            "state": "failure",
            "status": "Screening failed.",
            "error": str(result.info),
        }

    return { "task_id": task_id, "state": result.state, "status": "Unknown state." }