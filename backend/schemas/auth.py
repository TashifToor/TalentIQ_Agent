from pydantic import BaseModel

class RegisterRequest(BaseModel):
    name : str
    email : str
    password : str
    
class LoginRequest(BaseModel):
    email:str
    password:str
    
class TokenResponse(BaseModel):
    access_token:str
    token_type: str="Bearer"
    
class UserResponse(BaseModel):
    id: int
    name :str
    email: str
    is_active:bool
    model_config={"arbitrary_types_allowed":True}