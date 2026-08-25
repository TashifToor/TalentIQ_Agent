'use client'

import { useEffect } from 'react'

const ASKED_KEY = 'talentiq_notif_permission_asked'

/**
 * Requests real browser notification permission at most once per browser,
 * only from wherever this hook is mounted (the HR and candidate dashboards
 * — never the login page). Uses the native Notification.requestPermission()
 * — there is no custom/fake permission UI here.
 *
 * - granted already      -> does nothing (already have it)
 * - denied already       -> does nothing, never re-prompts (browsers also
 *                           refuse to re-prompt once denied, but we still
 *                           track it ourselves so we don't even try)
 * - default (never asked) -> waits a moment so it doesn't fire the instant
 *                           the dashboard mounts, then asks once
 * - unsupported browser   -> silently does nothing; in-app notifications
 *                           (the bell) work regardless
 */
export function useBrowserNotificationPermission() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'default') return
    if (localStorage.getItem(ASKED_KEY) === '1') return

    const timer = setTimeout(() => {
      localStorage.setItem(ASKED_KEY, '1')
      Notification.requestPermission().catch(() => {})
    }, 2500)

    return () => clearTimeout(timer)
  }, [])
}

/** Fires a real browser notification for an important event, only when
 * permission is already granted. No-op (silently) otherwise — the in-app
 * bell is the fallback and always works regardless of this. */
export function maybeShowBrowserNotification(title: string, body: string, onClick?: () => void) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, { body, icon: '/favicon.ico' })
    if (onClick) n.onclick = () => { window.focus(); onClick() }
  } catch {
    // some browsers (e.g. iOS Safari) can throw even when permission looks
    // granted — the in-app bell already covers this, so just drop it
  }
}