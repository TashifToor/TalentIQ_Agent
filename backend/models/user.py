# This class defines a User model with attributes such as id, name, email, password_hash, is_active,
# created_at, and a relationship with Chat_History.
from sqlalchemy.orm import relationship
from sqlalchemy import Integer,String,Column,Boolean,DateTime
from models.database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False, unique=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 🌟 FIX: Isko plural karo 'chats' aur back_populates ko 'user' par point karo
    chats = relationship("Chat", back_populates="user")
    
    