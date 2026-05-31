from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.chat import router as chat_router
from routes.auth import router as auth_router
from routes.screen import router as screen_router
from routes.upload import router as upload_router
from routes.hr import router as hr_router

from models import user, chat  # noqa — tables ko Base register karwana zaroori hai
from models.database import Base, engine

app = FastAPI(title="TalentIQ Master Backend", version="2.0.0")

# ── Tables auto-create ──────────────────────────────────────────────
@app.on_event("startup")
def create_tables():
    Base.metadata.create_all(bind=engine)
    print("[DB] Tables created/verified ✓")

# ── CORS ────────────────────────────────────────────────────────────
# allow_origins=["*"] during development — tum baad mein restrict kar sakte ho
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,   # credentials=True ke saath "*" kaam nahi karta
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(screen_router)
app.include_router(upload_router)
app.include_router(hr_router)
@app.get("/")
def read_root():
    return {"message": "TalentIQ Backend is live ✓", "version": "2.0.0"}
