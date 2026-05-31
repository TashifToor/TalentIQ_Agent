from fastapi import APIRouter,Depends,HTTPException,status
from passlib.context import CryptContext
from models.database import get_db
from  schemas.auth import LoginRequest,RegisterRequest,UserResponse,TokenResponse
from middleware.auth import create_access_token,get_current_user
from models.user import User
from sqlalchemy.orm import Session

router=APIRouter(prefix="/auth",tags=["Authentication"])
bcrypt=CryptContext(schemes=['argon2'],deprecated="auto")
@router.post("/signup",response_model=UserResponse,status_code=status.HTTP_201_CREATED)
async def signup(body:RegisterRequest,db:Session=Depends(get_db)):
    
    existing_email=db.query(User).filter(User.email==body.email).first()
    if existing_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Email already registered")
    
    user=User(
        name=body.name,
        email=body.email,
        password_hash=bcrypt.hash(body.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/login",response_model=TokenResponse)
async def login(body:LoginRequest,db:Session=Depends(get_db)):
    """existing user login karne ke liye endpoint"""
    
    user=db.query(User).filter(User.email==body.email).first()
    if not user or not bcrypt.verify(body.password,user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,detail="Invalid email and password")
    token = await create_access_token(user.id)
    return TokenResponse(access_token=token, token_type="bearer")

@router.get("/me",response_model=UserResponse)
async def me(current_user:User=Depends(get_current_user)):
    return current_user
    