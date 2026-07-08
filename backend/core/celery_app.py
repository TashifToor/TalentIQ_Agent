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

    # Production hardening:
    task_acks_late=True,          # agar worker crash ho jaye mid-task, task requeue hoga (khoyega nahi)
    task_reject_on_worker_lost=True,
    task_time_limit=600,          # 10 min hard kill — ek stuck bulk-screening task poore worker ko block nahi karega
    task_soft_time_limit=540,     # 9 min pe graceful warning, cleanup ka mauka milta hai
    worker_max_tasks_per_child=50,  # memory leak se bachne ke liye worker process periodically restart hota hai
)
celery_app.conf.broker_connection_retry_on_startup = True
