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

    # Kept for backward compatibility with old code paths that still read
    # it directly — the application layer now keeps this in sync with
    # `status` (True iff status == "published") rather than treating it as
    # the source of truth. `status` is what the Jobs Marketplace reads.
    is_active =   Column(Boolean, default=True)

    # -- Marketplace lifecycle -- draft | published | closed --------------
    status =      Column(String, nullable=False, default="published")

    # -- Structured posting fields (all optional -- bulk-screening-created
    # Jobs never fill these in, and that's fine, they just don't show up
    # in the candidate marketplace search/filter facets) ------------------
    responsibilities =    Column(Text, nullable=True)
    required_skills =     Column(Text, nullable=True)   # JSON list
    preferred_skills =    Column(Text, nullable=True)   # JSON list
    experience_required = Column(String, nullable=True)
    work_arrangement =    Column(String, nullable=True)  # remote | hybrid | onsite
    employment_type =     Column(String, nullable=True)  # full_time | part_time | contract | internship
    salary_min =            Column(Integer, nullable=True)
    salary_max =            Column(Integer, nullable=True)
    salary_currency =       Column(String, nullable=True)
    application_deadline =  Column(DateTime(timezone=True), nullable=True)
    openings =               Column(Integer, nullable=True)

    views_count =  Column(Integer, default=0)

    created_at =   Column(DateTime(timezone=True), server_default=func.now())
    updated_at =   Column(DateTime(timezone=True), nullable=True, onupdate=func.now())
    published_at = Column(DateTime(timezone=True), nullable=True)
    closed_at =    Column(DateTime(timezone=True), nullable=True)

    # Set to the originating Celery task_id when created by run_bulk_screening.
    # Lets that task detect its own redelivery (task_acks_late=True means a
    # worker crash mid-task requeues the SAME message) and skip re-creating
    # this Job + its Applications a second time. Null for jobs created any
    # other way. Also null for every Jobs-Marketplace posting (HR-authored,
    # never created by the bulk screening pipeline).
    source_task_id = Column(String, nullable=True, index=True)