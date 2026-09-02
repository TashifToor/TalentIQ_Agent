'use client'

import { useState } from 'react'

// Two color sets: 'dark' (original, unchanged) for panels with a dark background
// (Candidate login), 'light' for panels with a light background (HR login). Same
// component, same behavior — only the token values differ, driven by the `theme`
// prop each page passes based on its own actual panel background.
const THEME = {
    dark: {
        textMuted: 'rgba(245,242,235,.32)',
        border: 'rgba(255,255,255,.1)',
        btnBg: 'rgba(255,255,255,.02)',
        textActive: 'rgba(245,242,235,.75)',
        textDisabled: 'rgba(245,242,235,.38)',
    },
    light: {
        textMuted: 'rgba(26,24,20,.4)',
        border: 'rgba(26,24,20,.14)',
        btnBg: '#ffffff',
        textActive: 'rgba(26,24,20,.8)',
        textDisabled: 'rgba(26,24,20,.35)',
    },
}

// Real, recognizable provider marks — simplified inline SVGs (no external
// image requests, no emoji). Google's is the standard 4-color "G" glyph;
// GitHub and Microsoft use their standard monochrome/4-square marks.
function GoogleIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 009 18z" />
            <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 013.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 000 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 00.96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
        </svg>
    )
}
function GitHubIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
            <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
    )
}
function MicrosoftIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
            <rect x="0" y="0" width="10" height="10" fill="#F25022" />
            <rect x="11" y="0" width="10" height="10" fill="#7FBA00" />
            <rect x="0" y="11" width="10" height="10" fill="#00A4EF" />
            <rect x="11" y="11" width="10" height="10" fill="#FFB900" />
        </svg>
    )
}

type Provider = { id: 'google' | 'github' | 'microsoft'; label: string; icon: JSX.Element; configured: boolean }

// Only Google has a documented path to real OAuth in this codebase, and
// even that isn't wired up on the backend yet — see the report for exactly
// which env vars/routes would need to exist before any of these can go live.
const PROVIDERS: Provider[] = [
    { id: 'google', label: 'Google', icon: <GoogleIcon />, configured: false },
    { id: 'github', label: 'GitHub', icon: <GitHubIcon />, configured: false },
    { id: 'microsoft', label: 'Microsoft', icon: <MicrosoftIcon />, configured: false },
]

export default function SocialAuthRow({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
    const [notice, setNotice] = useState<string | null>(null)
    const t = THEME[theme]

    const handleClick = (p: Provider) => {
        if (!p.configured) {
            setNotice(`${p.label} sign-in isn't connected yet — it needs to be configured on the backend first.`)
            return
        }
        // Real providers would redirect to their OAuth flow here once configured.
    }

    return (
        <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 1, background: t.border }} />
                <span style={{ fontSize: 11.5, color: 'black', letterSpacing: '.04em' }}>Continue with</span>
                <div style={{ flex: 1, height: 1, background: t.border }} />
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {PROVIDERS.map(p => (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => handleClick(p)}
                        aria-label={p.configured ? `Continue with ${p.label}` : `Continue with ${p.label} (not yet available)`}
                        aria-disabled={!p.configured}
                        title={p.configured ? `Continue with ${p.label}` : `${p.label} sign-in requires setup`}
                        className="social-auth-btn"
                        style={{
                            flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                            padding: '10px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.btnBg,
                            color: p.configured ? t.textActive : t.textDisabled, fontSize: 12.5, fontWeight: 500,
                            fontFamily: 'inherit', cursor: 'pointer', transition: 'background .15s, border-color .15s', opacity: p.configured ? 1 : 0.72,
                        }}
                    >
                        {p.icon}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</span>
                    </button>
                ))}
            </div>

            {notice && (
                <p role="status" style={{ fontSize: 11.5, color: t.textMuted, marginTop: 10, lineHeight: 1.5 }}>{notice}</p>
            )}
        </div>
    )
}