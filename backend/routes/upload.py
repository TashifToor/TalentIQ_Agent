import os
import shutil
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from models.database import get_db
from sqlalchemy.orm import Session
from middleware.auth import get_current_user
from models.user import User
from core.loader import CvLoader
from core.chunker import TextChunker
from core.faiss import VectorStore

router = APIRouter(prefix="/Candidate", tags=["CV Management"])

UPLOAD_DIR = "../data/pdf"
os.makedirs(UPLOAD_DIR, exist_ok=True)


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

    file_path = os.path.join(UPLOAD_DIR, file.filename)

    try:
        # 1. Save PDF to disk
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"[API] File saved for {current_user.email}: {file_path}")

        # 2. Load & parse PDF with PyPDF
        loader = CvLoader(data_path=UPLOAD_DIR)
        documents = loader.load()

        if not documents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not extract text from PDF."
            )

        # 3. Full CV text for /Rating/screen payload
        full_cv_text = "\n\n".join([doc.page_content for doc in documents])

        # 4. Chunk documents
        chunker = TextChunker()
        chunks = chunker.split_documents(documents)

        # ✅ NO path argument — uses default backend/data/faiss_index
        # Same path agent uses in VectorStore()
        vector_store = VectorStore()
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
