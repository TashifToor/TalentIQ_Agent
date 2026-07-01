const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function parseError(err: any): string {
  if (!err) return "API error";
  if (typeof err.detail === "string") return err.detail;
  if (Array.isArray(err.detail)) {
    return err.detail
      .map((d: any) => `${(d.loc || []).slice(-1)[0]}: ${d.msg}`)
      .join(" · ");
  }
  return "API error";
}

export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

function buildApiError(err: any): ApiError {
  const raw = parseError(err);
  if (raw.includes("|")) {
    const [code, msg] = raw.split("|");
    return new ApiError(msg.trim(), code.trim());
  }
  return new ApiError(raw);
}

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
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      const role = localStorage.getItem("role");
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      document.cookie = "token=; path=/; max-age=0";
      document.cookie = "role=; path=/; max-age=0";
      if (!window.location.pathname.includes("/auth/login")) {
        window.location.href = role === "hr" ? "/auth/login/hr" : "/auth/login/candidate";
      }
    }
    throw new ApiError("Session expired. Please log in again.", "SESSION_EXPIRED");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw buildApiError(err);
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

  updateProfile: (name: string) =>
    apiFetch("/auth/me", { method: "PATCH", body: JSON.stringify({ name }) }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),

  deleteAccount: () => apiFetch("/auth/me", { method: "DELETE" }),

  getScanHistory: () => apiFetch("/scans/history"),

  // CV Management — returns extracted CV text as a string
  uploadCV: async (formData: FormData): Promise<string> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
    const res = await fetch(`${API_BASE_URL}/Candidate/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (res.status === 401) {
      if (typeof window !== "undefined") {
        const role = localStorage.getItem("role");
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        document.cookie = "token=; path=/; max-age=0";
        document.cookie = "role=; path=/; max-age=0";
        if (!window.location.pathname.includes("/auth/login")) {
          window.location.href = role === "hr" ? "/auth/login/hr" : "/auth/login/candidate";
        }
      }
      throw new ApiError("Session expired. Please log in again.", "SESSION_EXPIRED");
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw buildApiError(err);
    }
    return res.json();
  },

  // CV Screening — needs both job_description AND cv_text
  screenCandidate: (jobDescription: string, cvText: string) =>
    apiFetch("/Rating/screen", {
      method: "POST",
      body: JSON.stringify({ job_description: jobDescription, cv_text: cvText }),
    }),

  // Candidate chatbot
  chat: (message: string) =>
    apiFetch("/chat", { method: "POST", body: JSON.stringify({ message }) }),

  getChatHistory: () => apiFetch("/chat/history"),

  // HR Policy RAG chatbot
  hrChat: (message: string) =>
    apiFetch("/hr/chat", { method: "POST", body: JSON.stringify({ message }) }),

  // HR Bulk Screening — ZIP of CVs + job description + top_n
  bulkScreen: async (jobDescription: string, topN: number, zipFile: File) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
    const formData = new FormData();
    formData.append("job_description", jobDescription);
    formData.append("top_n", String(topN));
    formData.append("zip_file", zipFile);
    const res = await fetch(`${API_BASE_URL}/bulk/screen`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (res.status === 401) {
      if (typeof window !== "undefined") {
        const role = localStorage.getItem("role");
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        document.cookie = "token=; path=/; max-age=0";
        document.cookie = "role=; path=/; max-age=0";
        if (!window.location.pathname.includes("/auth/login")) {
          window.location.href = role === "hr" ? "/auth/login/hr" : "/auth/login/candidate";
        }
      }
      throw new ApiError("Session expired. Please log in again.", "SESSION_EXPIRED");
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Bulk screening failed" }));
      throw buildApiError(err);
    }
    return res.json();
  },
};