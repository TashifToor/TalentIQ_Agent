from fastapi import Depends,HTTPException
from fastapi.security import HTTPAuthorizationCredentials,HTTPBearer
from jose import JWTError,jwt
from models.database import get_db
from models.user import User
from sqlalchemy.orm import Session
from datetime import datetime,timedelta,timezone
import os
from dotenv import load_dotenv
load_dotenv()

SECRET_KEY=os.getenv("SECRET_KEY")
ALGORITHM="HS256"
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is missing in environment variables!")

Security=HTTPBearer()

async def create_access_token(user_id:int)->str:
    payload={
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24)
    }
    return jwt.encode(payload,SECRET_KEY,algorithm=ALGORITHM)

async def get_current_user(
    credentials:HTTPAuthorizationCredentials=Depends(Security),
    db:Session=Depends(get_db),
                     )->User:
    token=credentials.credentials
    try:
        payload=jwt.decode(token,SECRET_KEY,algorithms=[ALGORITHM])
        user_id=payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401,detail="invalid Token")
    except JWTError:
        raise HTTPException(status_code=401,detail="Token expired or invalid")
    user=db.query(User).filter(User.id==user_id).first()
    if not user:
        raise HTTPException(status_code=401,detail="User not found")
    return user
    