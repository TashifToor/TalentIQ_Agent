from pydantic import BaseModel

class HRChatRequest(BaseModel):
    message: str


class HRChatResponse(BaseModel):
    answer: str
    query: str
    created_at: str
