const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("talentiq_token");
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

async function handleRes<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const e = await res.json(); msg = e.detail ?? msg; } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

/* ── Auth ───────────────────────────────────────── */
export async function apiSignup(name: string, email: string, password: string) {
  const res = await fetch(`${BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  return handleRes<{ id: number; name: string; email: string; is_active: boolean }>(res);
}

export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await handleRes<{ access_token: string; token_type: string }>(res);
  localStorage.setItem("talentiq_token", data.access_token);
  return data;
}

export async function apiMe() {
  const res = await fetch(`${BASE}/auth/me`, { headers: authHeaders() });
  return handleRes<{ id: number; name: string; email: string; is_active: boolean }>(res);
}

export function apiLogout() {
  localStorage.removeItem("talentiq_token");
}

/* ── CV Upload ──────────────────────────────────── */
// Returns cv_text from backend (PyPDF parsed — real text)
export async function apiUploadCV(file: File): Promise<{
  status: string;
  message: string;
  chunk_created: number;
  uploaded_by: string;
  cv_text: string;       // ✅ Backend returns properly parsed PDF text
}> {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/Candidate/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  return handleRes(res);
}

/* ── Screening ──────────────────────────────────── */
export interface ScreeningResult {
  status: string;
  metrics: {
    candidate_score: number;
    matched_skills: string[];
    missing_skills: string[];
    final_verdict: string;
  };
  flags: {
    is_shortlisted: boolean;
    has_min_experience: boolean;
    trigger_interview: boolean;
  };
  deep_analysis: string;
}

export async function apiScreen(job_description: string, cv_text: string) {
  const res = await fetch(`${BASE}/Rating/screen`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ job_description, cv_text }),
  });
  return handleRes<ScreeningResult>(res);
}

/* ── Chat ───────────────────────────────────────── */
export async function apiChat(message: string, top_k = 4) {
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ message, top_k }),
  });
  return handleRes<{ answer: string; query: string; created_at: string }>(res);
}

export async function apiChatHistory() {
  const res = await fetch(`${BASE}/chat/history`, { headers: authHeaders() });
  return handleRes<{ id: number; query: string; answer: string; created_at: string }[]>(res);
}
