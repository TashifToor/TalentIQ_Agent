# TalentIQ Frontend v2.0

World-class Next.js frontend for your TalentIQ FastAPI backend.

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Pages & Routes

| Page | URL | Backend Endpoint |
|------|-----|-----------------|
| Login | `/login` | `POST /auth/login` |
| Signup | `/signup` | `POST /auth/signup` |
| Dashboard | `/dashboard` | `POST /Candidate/upload` + `POST /Rating/screen` |
| CV Chat | `/chat` | `POST /chat` + `GET /chat/history` |

## Flow

1. `/login` or `/signup` → JWT stored in localStorage
2. `/dashboard` → Upload CV (PDF) → Run screening → See AI results
3. `/chat` → Ask questions about the uploaded CV

## Backend Setup

Make sure your FastAPI backend is running on `http://localhost:8000`.

If on a different port, edit `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Auth

JWT Bearer token is automatically attached to all authenticated requests.
Token expires in 24 hours (as configured in your backend middleware).
