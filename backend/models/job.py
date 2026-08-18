import uuid
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from models.database import Base

class Job(Base):
    __tablename__ = "jobs"

    id =          Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    hr_user_id =  Column(Integer, ForeignKey("users.id"), nullable=False)
    title =       Column(String, nullable=False)
    company =     Column(String, nullable=True)
    location =    Column(String, nullable=True)
    description = Column(Text, nullable=False)
    is_active =   Column(Boolean, default=True)
    created_at =  Column(DateTime(timezone=True), server_default=func.now())
    # Set to the originating Celery task_id when created by run_bulk_screening.
    # Lets that task detect its own redelivery (task_acks_late=True means a
    # worker crash mid-task requeues the SAME message) and skip re-creating
    # this Job + its Applications a second time. Null for jobs created any
    # other way (there are none today, but this stays optional on purpose).
    source_task_id = Column(String, nullable=True, index=True)