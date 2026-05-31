from pydantic import BaseModel

class ScreeningRequest(BaseModel):
    job_description:str
    cv_text: str
    