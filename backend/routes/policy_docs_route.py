import os
import shutil
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from models.database import get_db
from middleware.auth import get_current_user
from models.user import User
from datetime import datetime

router = APIRouter(prefix="/hr/policy", tags=["HR Policy Docs"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POLICY_DIR = os.path.join(BASE_DIR, "data", "hr_poilices")  # keep original spelling
os.makedirs(POLICY_DIR, exist_ok=True)


def require_hr(user: User):
    if (user.role or "").lower() != "hr":
        raise HTTPException(status_code=403, detail="Only HR users can do this.")
    return user


@router.post("/upload")
async def upload_policy_doc(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed.")

    safe_name = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
    dest = os.path.join(POLICY_DIR, safe_name)

    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Rebuild HR FAISS index with new document
    try:
        from pipeline import _build_retriever
        _build_retriever()
        rebuilt = True
    except Exception as e:
        print(f"[Policy Upload] FAISS rebuild failed: {e}")
        rebuilt = False

    return {
        "message": f"'{file.filename}' uploaded successfully.",
        "filename": safe_name,
        "index_rebuilt": rebuilt,
    }


@router.get("/list")
def list_policy_docs(current_user: User = Depends(get_current_user)):
    require_hr(current_user)
    files = []
    for fn in os.listdir(POLICY_DIR):
        if fn.endswith(".pdf"):
            path = os.path.join(POLICY_DIR, fn)
            files.append({
                "filename": fn,
                "size_kb": round(os.path.getsize(path) / 1024, 1),
            })
    return {"documents": files, "count": len(files)}


@router.delete("/delete/{filename}")
def delete_policy_doc(filename: str, current_user: User = Depends(get_current_user)):
    require_hr(current_user)
    path = os.path.join(POLICY_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found.")
    os.remove(path)
    return {"message": f"'{filename}' deleted."}