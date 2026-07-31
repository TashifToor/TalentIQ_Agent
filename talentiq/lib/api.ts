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
    const isAuthPage = typeof window !== "undefined" && window.location.pathname.includes("/auth/");
    if (isAuthPage) {
      // Login/signup page pe 401 = wrong credentials, not session expired
      const err = await res.json().catch(() => ({ detail: "Invalid email or password." }));
      throw buildApiError(err);
    }
    if (typeof window !== "undefined") {
      const role = localStorage.getItem("role");
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      document.cookie = "token=; path=/; max-age=0";
      document.cookie = "role=; path=/; max-age=0";
      window.location.href = role === "hr" ? "/auth/login/hr" : "/auth/login/candidate";
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

  verifySignup: (email: string, otp: string) =>
    apiFetch("/auth/verify-signup", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    }),

  resendVerification: (email: string) =>
    apiFetch("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  me: () => apiFetch("/auth/me"),

  updateProfile: (name: string) =>
    apiFetch("/auth/me", { method: "PATCH", body: JSON.stringify({ name }) }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),

  deleteAccount: (password: string) =>
    apiFetch("/auth/me", { method: "DELETE", body: JSON.stringify({ password }) }),

  exportMyData: async (): Promise<void> => {
    const data = await apiFetch("/auth/export-data");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `talentiq_my_data_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  // --- Team Workspace ---
  createOrg: (name: string) => apiFetch("/org/create", { method: "POST", body: JSON.stringify({ name }) }),
  renameOrg: (name: string) => apiFetch("/org/rename", { method: "PATCH", body: JSON.stringify({ name }) }),
  getMyOrg: () => apiFetch("/org/me"),
  inviteTeammate: (email: string) => apiFetch("/org/invite", { method: "POST", body: JSON.stringify({ email }) }),
  removeMember: (memberId: number) => apiFetch(`/org/members/${memberId}`, { method: "DELETE" }),
  checkInvite: (token: string) => apiFetch(`/org/invite/${token}`),

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

  // HR job history from DB
  getHRJobs: () => apiFetch("/bulk/jobs"),

  // HR Bulk Screening — async version (returns task_id)
  bulkScreen: async (jobDescription: string, topN: number, zipFile: File, jobTitle: string = "") => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
    const formData = new FormData();
    formData.append("job_description", jobDescription);
    formData.append("job_title", jobTitle);
    formData.append("top_n", String(topN));
    formData.append("zip_file", zipFile);
    const res = await fetch(`${API_BASE_URL}/bulk/screen`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Bulk screening failed" }));
      throw buildApiError(err);
    }
    return res.json();
  },

  // HR Policy document management
  uploadPolicyDoc: async (file: File) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE_URL}/hr/policy/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw buildApiError(err);
    }
    return res.json();
  },
  listPolicyDocs: () => apiFetch("/hr/policy/list"),
  deletePolicyDoc: (filename: string) => apiFetch(`/hr/policy/delete/${filename}`, { method: "DELETE" }),

  // Poll bulk screening task status
  pollBulkStatus: (taskId: string) => apiFetch(`/bulk/status/${taskId}`),

  // Forgot password
  forgotPassword: (email: string) =>
    apiFetch("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  // Reset password with OTP
  resetPassword: (email: string, otp: string, new_password: string) =>
    apiFetch("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, otp, new_password }),
    }),

  // --- CV Builder — works logged-out (anonymous, IP-limited) or logged-in ---
  parseCVForBuilder: async (file: File): Promise<any> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE_URL}/cv-builder/parse`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Could not parse CV." }));
      throw buildApiError(err);
    }
    return res.json();
  },

  generateCVBuilder: async (payload: {
    cv_data: any;
    template: string;
    accent_color?: string;
    job_description?: string;
  }): Promise<Blob> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`${API_BASE_URL}/cv-builder/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Could not generate CV." }));
      throw buildApiError(err);
    }
    return res.blob();
  },

  // --- AI Chatbot Interviewer — HR side (authenticated) ---
  createInterviewPosting: (payload: { title: string; company?: string; job_description: string; extra_questions: string[]; interviewer_name?: string }) =>
    apiFetch("/interview/postings", { method: "POST", body: JSON.stringify(payload) }),

  getInterviewPostings: () => apiFetch("/interview/postings"),

  toggleInterviewPosting: (postingId: string) =>
    apiFetch(`/interview/postings/${postingId}/toggle`, { method: "PATCH" }),

  deleteInterviewPosting: (postingId: string) =>
    apiFetch(`/interview/postings/${postingId}`, { method: "DELETE" }),

  getInterviewCandidates: (postingId: string) => apiFetch(`/interview/postings/${postingId}/candidates`),

  getAllInterviewCandidates: () => apiFetch(`/interview/candidates`),

  getInterviewSessionReport: (sessionId: string) => apiFetch(`/interview/sessions/${sessionId}`),

  // --- AI Chatbot Interviewer — public candidate side (no login) ---
  getPublicInterviewPosting: (slug: string) => apiFetch(`/interview/public/${slug}`),

  startPublicInterview: (slug: string, candidate_name: string, candidate_email: string) =>
    apiFetch(`/interview/public/${slug}/start`, {
      method: "POST",
      body: JSON.stringify({ candidate_name, candidate_email }),
    }),

  sendPublicInterviewMessage: (slug: string, sessionId: string, message: string) =>
    apiFetch(`/interview/public/${slug}/${sessionId}/message`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  uploadPublicInterviewCV: async (slug: string, sessionId: string, file: File): Promise<any> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE_URL}/interview/public/${slug}/${sessionId}/upload-cv`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Could not upload CV." }));
      throw buildApiError(err);
    }
    return res.json();
  },

  skipPublicInterviewCV: (slug: string, sessionId: string) =>
    apiFetch(`/interview/public/${slug}/${sessionId}/skip-cv`, { method: "POST" }),
};