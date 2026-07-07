import os
import shutil
import uuid
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from models.database import get_db
from sqlalchemy.orm import Session
from middleware.auth import get_current_user
from models.user import User
from core.loader import CvLoader
from core.chunker import TextChunker
from core.faiss import VectorStore

router = APIRouter(prefix="/Candidate", tags=["CV Management"])

MAX_FILE_SIZE_MB = 8
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
PDF_MAGIC_BYTES = b"%PDF-"


def _user_upload_dir(user_id: int) -> str:
    # Per-user upload directory — prevents filename collisions between
    # different users uploading e.g. "resume.pdf" at the same time.
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path = os.path.join(base_dir, "data", "pdf", f"user_{user_id}")
    os.makedirs(path, exist_ok=True)
    return path


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_cv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed."
        )

    # Read into memory once — lets us check real size and real file-type
    # (magic bytes) before trusting the extension or writing anything to disk.
    contents = await file.read()

    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE_MB}MB."
        )

    if len(contents) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file.")

    if not contents.startswith(PDF_MAGIC_BYTES):
        # Extension can be faked (e.g. a renamed .exe) — this checks the
        # actual file signature, not just the ".pdf" suffix in the filename.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is not a valid PDF."
        )

    upload_dir = _user_upload_dir(current_user.id)
    # Wipe any previous CV for this user — one active CV per candidate at a time,
    # keeps the per-user folder from growing unbounded across re-uploads.
    for old_file in os.listdir(upload_dir):
        try:
            os.remove(os.path.join(upload_dir, old_file))
        except OSError:
            pass

    safe_filename = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    file_path = os.path.join(upload_dir, safe_filename)

    try:
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
        print(f"[API] File saved for {current_user.email}: {file_path}")

        # Load & parse PDF with PyPDF — scoped to this user's directory only
        loader = CvLoader(data_path=upload_dir)
        documents = loader.load()

        if not documents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not extract text from PDF."
            )

        full_cv_text = "\n\n".join([doc.page_content for doc in documents])

        chunker = TextChunker()
        chunks = chunker.split_documents(documents)

        # User-scoped FAISS index — this is what fixes cross-user data leakage.
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        persist_dir = os.path.join(base_dir, "data", "faiss_index", f"user_{current_user.id}")
        vector_store = VectorStore(persist_directory=persist_dir)
        vector_store.create_and_save_store(chunks)

        print(f"[API] CV vectorized: {len(chunks)} chunks, {len(full_cv_text)} chars")

        return {
            "status": "success",
            "message": f"File '{file.filename}' processed and vectorized successfully.",
            "chunk_created": len(chunks),
            "uploaded_by": current_user.name,
            "cv_text": full_cv_text,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[API ERROR] Upload failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload pipeline error: {str(e)}"
        )