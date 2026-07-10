import os
import sys
from celery import Celery
from dotenv import load_dotenv

# Guarantee the project root is importable no matter how/where `celery` was
# launched from. When Celery is started via the plain `celery` command
# (rather than `python -m celery`), Python does NOT automatically add the
# current working directory to sys.path — only the celery script's own
# install location gets added. That's harmless for `-A core.celery_app`
# itself (Celery's own app-loader inserts cwd for that specific lookup),
# but it silently breaks any LATER deferred `from models... import` /
# `from routes... import` inside task functions with "No module named
# 'models'" / "No module named 'routes'" — exactly the errors seen in
# production logs. Inserting the root explicitly here removes the
# ambiguity for good.
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

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