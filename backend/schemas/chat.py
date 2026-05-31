from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# Frontend se aata hai: { message: "...", top_k: 4 }
class ChatRequest(BaseModel):
    message: str               # frontend "message" bhejta hai
    top_k: Optional[int] = 4

class ChatResponse(BaseModel):
    answer: str
    query: str
    created_at: datetime
    model_config = {"arbitrary_types_allowed": True}

class ChatHistoryResponse(BaseModel):
    id: int
    query: str
    answer: str
    created_at: datetime
    model_config = {"arbitrary_types_allowed": True}
