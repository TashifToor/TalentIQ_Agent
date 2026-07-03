import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_CANDIDATE = ['/candidate']
const PROTECTED_HR = ['/hr']
const AUTH_PAGES = ['/auth/login', '/auth/signup']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('token')?.value
  const role  = request.cookies.get('role')?.value

  const isCandidateRoute = PROTECTED_CANDIDATE.some(p => pathname.startsWith(p))
  const isHRRoute        = PROTECTED_HR.some(p => pathname.startsWith(p))
  const isAuthPage       = AUTH_PAGES.some(p => pathname.startsWith(p))

  // No token → send to appropriate login
  if ((isCandidateRoute || isHRRoute) && !token) {
    const dest = isHRRoute ? '/auth/login/hr' : '/auth/login/candidate'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // URL hack protection — wrong role blocked
  if (isCandidateRoute && token && role !== 'candidate') {
    return NextResponse.redirect(new URL('/auth/login/candidate', request.url))
  }
  if (isHRRoute && token && role !== 'hr') {
    return NextResponse.redirect(new URL('/auth/login/hr', request.url))
  }

  // Already logged in → skip auth pages
  if (isAuthPage && token) {
    const dest = role === 'hr' ? '/hr/dashboard' : '/candidate/dashboard'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/candidate/:path*', '/hr/:path*', '/auth/:path*', '/dashboard/:path*'],
}