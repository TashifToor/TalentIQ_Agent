from sqlalchemy.orm import relationship
from sqlalchemy import Column, Integer, Text,DateTime,ForeignKey
from models.database import Base
from datetime import datetime

class Chat(Base):
    __tablename__ = "chats"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    query = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 🌟 Yeh bilkul sahi hai: point karega User ki 'chats' par
    user = relationship("User", back_populates="chats")
    
