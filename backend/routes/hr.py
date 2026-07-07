import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
from sqlalchemy.orm import Session
from models.database import get_db
from middleware.auth import get_current_user
from models.user import User
from pipeline import ask_question
from schemas.hr import HRChatRequest, HRChatResponse
from core.redis_client import check_rate_limit

router=APIRouter(prefix="/hr",tags=["HR Policy"])

CHAT_TIMEOUT_SECONDS = 30

@router.post("/chat",response_model=HRChatResponse)
async def hr_chat(
    body: HRChatRequest,
    db: Session=Depends(get_db),
    current_user:User=Depends(get_current_user)
):
    
    """Hr policy ke baare mein sawaal karne ke liye endpoint"""
    if not body.message.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Message cannot be empty.")

    allowed, wait_seconds = check_rate_limit(f"hr-chat:{current_user.id}", cooldown_seconds=3)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Please wait {wait_seconds}s before sending another message.")

    try:
        # ask_question is a blocking RAG+LLM call — run off the event loop so
        # one slow chat query can't stall every other request being served,
        # with a hard timeout so a hung Groq call fails fast instead of forever.
        try:
            result = await asyncio.wait_for(
                asyncio.to_thread(ask_question, body.message),
                timeout=CHAT_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="The assistant is taking too long to respond. Please try again."
            )

        answer=result.get("answer","Sorry, I could not find an answer.")
        
        return HRChatResponse(
            answer=answer,
            query=body.message,
            created_at=datetime.utcnow().isoformat()
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[HR Chat ERROR] {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,detail=f"HR Agent error: {str(e)}")