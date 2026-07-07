'use client'

import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || ''
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

let initialized = false

function initPostHog() {
  if (initialized || !POSTHOG_KEY || typeof window === 'undefined') return
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // we send pageviews manually below (App Router doesn't fire a real "page load" per route)
    persistence: 'localStorage+cookie',
  })
  initialized = true
}

function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!POSTHOG_KEY) return
    initPostHog()
    let url = window.origin + pathname
    if (searchParams && searchParams.toString()) url += `?${searchParams.toString()}`
    posthog.capture('$pageview', { $current_url: url })
  }, [pathname, searchParams])

  return null
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHog()
  }, [])

  return (
    <>
      {/* Suspense required — useSearchParams needs it in the App Router */}
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </>
  )
}

// Small helper so the rest of the app doesn't need to import posthog-js
// directly or worry about the "is it configured" check every time.
export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (!POSTHOG_KEY || typeof window === 'undefined') return
  posthog.capture(eventName, properties)
}

export function identifyUser(userId: string | number, properties?: Record<string, any>) {
  if (!POSTHOG_KEY || typeof window === 'undefined') return
  posthog.identify(String(userId), properties)
}

export function resetAnalytics() {
  if (!POSTHOG_KEY || typeof window === 'undefined') return
  posthog.reset()
}