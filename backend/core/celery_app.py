import os
from dotenv import load_dotenv
from celery import Celery

load_dotenv()  # Load environment variables from .env file

REDIS_URL=os.getenv("REDIS_URL","redis://localhost:6379/0")

celery_app=Celery(
    "talent_iq",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["tasks.screening_task"],
),


celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    result_expires=3600,  # 1 hour
    task_track_started=True, #Started state bi track ho
    worker_prefetch_multiplier=1,  # Task prefetching ko disable karne ke liye
)
