import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "talentiq",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["tasks.screening_task"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    result_expires=3600,       # results 1 hour mein expire
    task_track_started=True,   # STARTED state bhi track ho
    worker_prefetch_multiplier=1,
)