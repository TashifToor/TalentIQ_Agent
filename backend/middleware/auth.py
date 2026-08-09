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
SecurityOptional=HTTPBearer(auto_error=False)

async def create_access_token(user_id:int)->str:
    payload={
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24)
    }
    return jwt.encode(payload,SECRET_KEY,algorithm=ALGORITHM)

def decode_user_token(token: str, db: Session) -> User:
    """Shared JWT decode + user lookup — used by get_current_user (REST, header-based)
    and by WebSocket endpoints (which auth via a first `{"type":"auth"}` message instead,
    since browsers cannot set Authorization headers on a WS handshake)."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="invalid Token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expired or invalid")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_current_user(
    credentials:HTTPAuthorizationCredentials=Depends(Security),
    db:Session=Depends(get_db),
                     )->User:
    return decode_user_token(credentials.credentials, db)


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(SecurityOptional),
    db: Session = Depends(get_db),
) -> User | None:
    """
    Same as get_current_user, but returns None instead of raising when no
    token is present — used for endpoints that work both logged-out
    (anonymous, IP-limited) and logged-in (e.g. the public CV Builder page).
    An invalid/expired token still raises, so a bad token doesn't silently
    fall back to anonymous access.
    """
    if credentials is None:
        return None
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="invalid Token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expired or invalid")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user