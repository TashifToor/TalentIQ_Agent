from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
from sqlalchemy.orm import Session
from models.database import get_db
from middleware.auth import get_current_user
from models.user import User
from pipeline import ask_question
from schemas.hr import HRChatRequest, HRChatResponse

router=APIRouter(prefix="/hr",tags=["HR Policy"])

@router.post("/chat",response_model=HRChatResponse)
async def hr_chat(
    body: HRChatRequest,
    db: Session=Depends(get_db),
    current_user:User=Depends(get_current_user)
):
    
    """Hr policy ke baare mein sawaal karne ke liye endpoint"""
    if not body.message.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Message cannot be empty.")
    try:
        result=ask_question(body.message)
        answer=result.get("answer","Sorry, I could not find an answer.")
        
        return HRChatResponse(
            answer=answer,
            query=body.message,
            created_at=datetime.utcnow().isoformat()
        )
    except Exception as e:
        print(f"[HR Chat ERROR] {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,detail=f"HR Agent error: {str(e)}")
