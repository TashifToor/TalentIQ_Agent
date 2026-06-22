import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_CANDIDATE = ['/candidate']
const PROTECTED_HR = ['/hr']
const AUTH_PAGES = ['/auth/login', '/auth/signup']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('token')?.value

  const isCandidateRoute = PROTECTED_CANDIDATE.some(p => pathname.startsWith(p))
  const isHRRoute = PROTECTED_HR.some(p => pathname.startsWith(p))
  const isAuthPage = AUTH_PAGES.some(p => pathname.startsWith(p))

  if ((isCandidateRoute || isHRRoute) && !token) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/candidate/:path*', '/hr/:path*', '/auth/:path*', '/dashboard/:path*'],
}
