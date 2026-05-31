from fastapi import Depends, APIRouter, HTTPException, status, Request
from models.database import get_db
from schemas.chat import ChatHistoryResponse, ChatRequest, ChatResponse
from sqlalchemy.orm import Session
from datetime import datetime
from models.chat import Chat
from middleware.auth import get_current_user
from models.user import User
from typing import List
from core.agent import TalentIQAgent
from core.llm import llm

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Candidate ki CV ke baare mein sawal karne ke liye endpoint"""
    try:
        agent = TalentIQAgent()

        # FAISS check
        if not agent.retriever:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="FAISS DB is empty. Please upload a candidate CV first via /Candidate/upload"
            )

        # body.message use karo (schema se match)
        docs = agent.retriever.invoke(body.message)
        context = "\n\n".join([doc.page_content for doc in docs])

        prompt = f"""You are an expert AI recruiter analyzing a candidate's CV.
Answer the user's question based strictly on the provided CV context.
Be specific, concise and professional.

CV Context:
{context}

Question: {body.message}

Answer:"""

        response = llm.invoke(prompt)
        ai_answer = response.content

        # DB mein save karo
        chat_history = Chat(
            user_id=current_user.id,
            query=body.message,      # message ko query mein store karo
            answer=ai_answer,
            created_at=datetime.utcnow()
        )
        db.add(chat_history)
        db.commit()
        db.refresh(chat_history)

        return ChatResponse(
            query=body.message,
            answer=ai_answer,
            created_at=chat_history.created_at
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/history", response_model=List[ChatHistoryResponse])
async def chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Apni chat history dekhne ke liye endpoint"""
    chats = (
        db.query(Chat)
        .filter(Chat.user_id == current_user.id)
        .order_by(Chat.created_at.desc())
        .limit(20)
        .all()
    )
    return chats
