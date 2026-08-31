"""
Run this ONCE on a brand-new/empty Postgres database to create every table
from the current models (this is what 0001_baseline assumed already existed).

Usage:
    python create_db.py

After this succeeds, run `alembic stamp head` (NOT `alembic upgrade head`) so
Alembic knows the DB is already at the latest schema — otherwise it will try
to re-apply ALTER TABLE statements for columns that already exist.
"""
from models.database import Base, engine

# Import every model module so its table registers on Base.metadata before
# create_all() runs — importing the package alone isn't enough.
from models.user import User
from models.chat import Chat
from models.job import Job
from models.application import Application
from models.organization import Organization
from models.scan_history import ScanHistory
from models.interview import InterviewPosting, InterviewSession
from models.practice import PracticeSession
from models.notification import Notification
from models.activity_event import ActivityEvent

if __name__ == "__main__":
    print("Creating all tables on:", engine.url)
    Base.metadata.create_all(bind=engine)
    print("Done. Now run: alembic stamp head")