// talentiq/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("talentiq_token")?.value;
  const role = request.cookies.get("talentiq_role")?.value;
  const { pathname } = request.nextUrl;

  // 1. Strict Protection for HR Routes
  if (pathname.startsWith("/hr")) {
    if (!token || role !== "hr") {
      return NextResponse.redirect(new URL("/auth/login/hr", request.url));
    }
  }

  // 2. Strict Protection for Candidate Routes
  if (pathname.startsWith("/candidate")) {
    if (!token || role !== "candidate") {
      return NextResponse.redirect(new URL("/auth/login/candidate", request.url));
    }
  }

  // 3. Prevent logged-in users from accessing wrong auth gates
  if (token && pathname.startsWith("/auth/login/")) {
    if (role === "hr" && pathname.includes("/candidate")) {
      return NextResponse.redirect(new URL("/hr/dashboard", request.url));
    }
    if (role === "candidate" && pathname.includes("/hr")) {
      return NextResponse.redirect(new URL("/candidate/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

// Global configuration matcher rules
export const config = {
  matcher: ["/hr/:path*", "/candidate/:path*", "/auth/login/:path*"],
};