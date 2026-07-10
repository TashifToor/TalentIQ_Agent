from sqlalchemy.orm import relationship
from sqlalchemy import Integer,String,Column,Boolean,DateTime,ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from models.database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    normalized_email = Column(String, unique=True, index=True, nullable=True)
    password_hash = Column(String, nullable=False, unique=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Role — "candidate" | "hr"
    role=       Column(String,default="candidate")

    # Subscription
    # Keep the mapped DB column name singular to match the schema.
    subscription_status = Column("subscription_status", String, default="free")

    # Backward-compatible alias for old code paths.
    @property
    def subscriptions_status(self):
        return self.subscription_status

    @subscriptions_status.setter
    def subscriptions_status(self, value):
        self.subscription_status = value
    
    # Candidate — free scan tracking
    scans_used    = Column(Integer, default=0)
    
    # HR — trial tracking
    trial_started_at = Column(DateTime(timezone=True), nullable=True)

    # Forgot-password OTP flow
    reset_otp_hash = Column(String, nullable=True)
    reset_otp_expires_at = Column(DateTime, nullable=True)

    # CV Builder — separate free-tier counter from scans_used (scanning vs building are different features)
    cv_builds_used = Column(Integer, default=0)

    # Team Workspace (HR only) — nullable so solo HR users are unaffected.
    # is_org_owner distinguishes the billing-holder/inviter from invited teammates.
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    is_org_owner = Column(Boolean, default=False)

    chats = relationship("Chat", back_populates="user") 