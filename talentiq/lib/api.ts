const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiFetch(path: string, options?: RequestInit) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || "API error");
  }
  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  // Single unified signup route — role passed inside body, not in URL
  signupCandidate: (data: object) =>
    apiFetch("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ ...data, role: "candidate" }),
    }),

  signupHR: (data: object) =>
    apiFetch("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ ...data, role: "hr" }),
    }),

  me: () => apiFetch("/auth/me"),

  // CV Management — candidate uploads CV
  uploadCV: (formData: FormData) =>
    fetch(`${API_BASE_URL}/Candidate/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("token") || "" : ""}`,
      },
      body: formData,
    }).then((r) => {
      if (!r.ok) throw new Error("Upload failed");
      return r.json();
    }),

  // CV Screening — HR scores/ranks a candidate against a job description
  screenCandidate: (data: object) =>
    apiFetch("/Rating/screen", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Candidate-side chatbot (CV Chat)
  chat: (message: string) =>
    apiFetch("/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  getChatHistory: () => apiFetch("/chat/history"),

  // HR Policy RAG chatbot
  hrChat: (message: string) =>
    apiFetch("/hr/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};