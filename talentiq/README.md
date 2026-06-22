# TalentIQ Frontend — Next.js 14

AI-powered recruitment screening platform. Built with Next.js 14 App Router, TypeScript, Tailwind CSS, and Framer Motion.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local
cp .env.example .env.local
# Edit NEXT_PUBLIC_API_URL to point to your FastAPI backend

# 3. Run dev server
npm run dev
# Opens at http://localhost:3000
```

---

## 📁 Project Structure

```
app/
├── page.tsx                        # Landing page (public)
├── layout.tsx                      # Root layout
├── globals.css                     # Global styles + CSS variables
│
├── auth/
│   ├── login/
│   │   ├── candidate/page.tsx      # Candidate login (dark, particle canvas)
│   │   └── hr/page.tsx             # HR login (dark editorial + chart mock)
│   └── signup/
│       ├── candidate/page.tsx      # → redirects to login/candidate
│       └── hr/page.tsx             # → redirects to login/hr
│
├── candidate/
│   └── dashboard/
│       ├── page.tsx                # Candidate dashboard (CV scan, score ring)
│       ├── layout.tsx
│       └── optimizer/page.tsx      # CV Optimizer tool
│
├── hr/
│   └── dashboard/
│       ├── page.tsx                # HR dashboard (3-panel: stats, candidates, chatbot)
│       ├── layout.tsx
│       └── optimizer/page.tsx      # JD Optimizer tool
│
├── dashboard/page.tsx              # Smart redirect (candidate vs HR)
└── chat/page.tsx                   # → redirects to hr/dashboard

components/
└── UpgradeModal.tsx                # Paywall modal (triggered after 3 free scans)

lib/
└── api.ts                          # All API calls to FastAPI backend

middleware.ts                       # Route protection (JWT check)
```

---

## 🔑 Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
```

---

## 🎨 Design System

### Color Tokens (in globals.css)
| Token | Value | Usage |
|-------|-------|-------|
| `--gold` | `#c5931f` | Accent, candidate theme |
| `--gold2` | `#e2b04a` | Buttons, highlights |
| `--gold3` | `#f5d87a` | Hover states |
| `--teal` | `#0b7c5e` | HR theme, matched skills |
| `--teal2` | `#13c28e` | HR accent, live indicators |
| `--ink` | `#0a0a09` | Body text |
| `--paper` | `#f7f5f0` | Landing page background |
| `--dark` | `#0c0c0a` | Dashboard background |

### Typography
- **Headings**: `Cormorant Garamond` (serif, italic for accents)
- **Body/UI**: `Syne` (geometric sans)
- Both loaded from Google Fonts

---

## 🔐 Auth Flow

1. User lands on `/` (landing) — can run **3 free CV scans without login**
2. After 3 scans → `UpgradeModal` shown with Candidate ($9/mo) or HR ($49/mo) options
3. Login routes: `/auth/login/candidate` or `/auth/login/hr`
4. After login → JWT stored in `localStorage` + cookie
5. Middleware protects `/candidate/*` and `/hr/*` routes
6. `/dashboard` auto-redirects based on stored `role`

---

## 💳 Lemon Squeezy Integration

Payment buttons currently point to `/pricing`. To wire up:

1. Get your Lemon Squeezy checkout URL from dashboard
2. In `UpgradeModal.tsx`, replace `window.location.href = '/pricing'` with your checkout URL:
   ```ts
   window.location.href = 'https://your-store.lemonsqueezy.com/checkout/buy/YOUR_PRODUCT_ID'
   ```
3. Add webhook endpoint in `app/api/webhook/route.ts` to handle payment confirmations

### Pricing
| Plan | Price | Target |
|------|-------|--------|
| Candidate Pro | $9/mo | Job seekers |
| HR Team | $49/mo | HR departments |

---

## 🔌 Backend API Endpoints Expected

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Login, returns `{ access_token }` |
| POST | `/auth/signup/candidate` | Candidate signup |
| POST | `/auth/signup/hr` | HR signup |
| POST | `/scan` | Upload CV + JD, returns score + analysis |
| POST | `/bulk-scan` | Upload multiple CVs |
| POST | `/chat` | HR policy chatbot message |
| GET | `/scans/history` | User's scan history |
| GET | `/hr/candidates` | HR's screened candidates |

---

## 📦 Deploy

```bash
# Build
npm run build

# Deploy to Vercel
vercel --prod

# Or export static
npm run build && npm run start
```

---

## 🧩 Key Features

- ✅ **Landing page** — Light, clean, Google-indexed, no tech stack mentions
- ✅ **3 free scans** — No login required
- ✅ **Candidate login** — Particle canvas animation, dark gold theme
- ✅ **HR login** — Dark editorial, chart mock, candidate list animation
- ✅ **Candidate dashboard** — CV upload, score ring, skill bars, gap analysis, suggestions
- ✅ **HR dashboard** — 3-panel: stats+upload | ranked candidates | policy chatbot
- ✅ **Upgrade modal** — Role-aware paywall after free scan limit
- ✅ **CV Optimizer** — Actionable CV improvement suggestions
- ✅ **JD Optimizer** — Job description quality analysis for HR
- ✅ **JWT auth** — Middleware-protected routes
- ✅ **Role-based routing** — Candidate vs HR separate experiences

---

Built by [Tashif Software](https://github.com/TashifToor) · TalentIQ © 2025
