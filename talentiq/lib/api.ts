const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Helper tools to set dynamic access levels
export const setAuthSession = (token: string, role: 'hr' | 'candidate') => {
  if (typeof window !== "undefined") {
    localStorage.setItem("talentiq_token", token);
    localStorage.setItem("talentiq_role", role);
    
    // Server-side middleware ke liye cookies set karna responsive hai
    document.cookie = `talentiq_token=${token}; path=/; max-age=86400; SameSite=Strict`;
    document.cookie = `talentiq_role=${role}; path=/; max-age=86400; SameSite=Strict`;
  }
};

export const clearAuthSession = () => {
  if (typeof window !== "undefined") {
    localStorage.clear();
    document.cookie = "talentiq_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "talentiq_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }
};

//  Yeh function missing tha! Isko add karo:
export const getToken = (): string | null => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("talentiq_token");
  }
  return null;
};

//  Future use ke liye role nikalne ka helper bhi rakh lo:
export const getRole = (): string | null => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("talentiq_role");
  }
  return null;
};