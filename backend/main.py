import os
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.chat import router as chat_router
from routes.auth import router as auth_router
from routes.screen import router as screen_router
from routes.upload import router as upload_router
from routes.hr import router as hr_router
from routes.jobs import router as jobs_router
from routes.apply import router as apply_router
from routes.bulk import router as bulk_router
from routes.forgot_password import router as forgot_password_router
from routes.policy_docs_route import router as policy_docs_router
from routes.scan import router as scan_router
from routes.cv_builder import router as cv_builder_router
from routes.organization import router as org_router
from routes.interview import router as interview_router
from routes.interview_public import router as interview_public_router
from routes.practice import router as practice_router
from models.interview import InterviewPosting, InterviewSession
from models.practice import PracticeSession
from models.user import User  
from models.chat import Chat
from models.job import Job
from models.application import Application
from models.database import Base, engine

# Error monitoring — only activates if SENTRY_DSN is set in .env, so local
# dev without a Sentry project configured just runs normally (no crash,
# no noise). Get a free DSN at https://sentry.io (Python/FastAPI project).
SENTRY_DSN = os.getenv("SENTRY_DSN", "")
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        traces_sample_rate=0.2,       # 20% of requests get performance tracing (keeps quota usage sane)
        environment=os.getenv("ENVIRONMENT", "development"),
        send_default_pii=False,       # don't auto-attach request bodies/headers (CVs, tokens) to error events
    )
    print("[Sentry] Error monitoring active")
else:
    print("[Sentry] SENTRY_DSN not set — error monitoring disabled")

app = FastAPI(title="TalentIQ Backend", version="2.0.0")


@app.on_event("startup")
def create_tables():
    # Schema is fully managed by Alembic now (see alembic/ directory).
    # create_all() used to run here as a "safety net", but it actively
    # caused a migration conflict: it silently created new tables (like
    # `organizations`) outside Alembic's tracking before a real migration
    # could, leaving columns on existing tables missing and Alembic
    # confused about what state the DB was actually in. Run
    # `alembic upgrade head` to apply schema changes instead.
    print("[DB] Startup — schema is managed by Alembic. Run 'alembic upgrade head' to apply migrations.")


from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # production mein change krna ise
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(screen_router)
app.include_router(upload_router)
app.include_router(hr_router)
app.include_router(scan_router)
app.include_router(jobs_router)
app.include_router(apply_router)
app.include_router(bulk_router)
app.include_router(forgot_password_router)
app.include_router(policy_docs_router)
app.include_router(cv_builder_router)
app.include_router(org_router)
app.include_router(interview_router)
app.include_router(interview_public_router)
app.include_router(practice_router)

@app.get("/")
def root():
    return {"message": "TalentIQ API v2.0 — Backend is running!"}