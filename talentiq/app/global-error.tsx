'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body style={{ background: '#0a0a08', color: '#f5f2eb', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 10 }}>Something went wrong</h2>
          <p style={{ color: 'rgba(245,242,235,.5)', marginBottom: 20, fontSize: 14 }}>
            We've been notified and are looking into it.
          </p>
          <button
            onClick={() => reset()}
            style={{ background: '#d4af6d', color: '#0a0a08', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}