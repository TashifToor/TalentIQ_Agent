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

from models.user import User  
from models.chat import Chat
from models.job import Job
from models.application import Application
from models.database import Base, engine

app = FastAPI(title="TalentIQ Backend", version="2.0.0")


@app.on_event("startup")
def create_tables():
    Base.metadata.create_all(bind=engine)
    print("[DB] All tables created/verified ✓")


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


@app.get("/")
def root():
    return {"message": "TalentIQ API v2.0 — Backend is running!"}