'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'talentiq-theme'

type ThemeContextValue = {
    theme: Theme
    setTheme: (t: Theme) => void
    toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyThemeToDocument(theme: Theme) {
    document.documentElement.setAttribute('data-theme', theme)
}

/**
 * Single shared theme source of truth for BOTH the HR dashboard and the
 * Candidate dashboard. Do not create a second instance of this provider —
 * mount it once near the root layout so header toggle and Settings pages
 * on both sides always read/write the same state.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
    // Inline script in layout.tsx already set document.documentElement's
    // data-theme attribute before hydration (see NoFlashThemeScript below),
    // so we just read it back here to stay in sync without causing a
    // hydration mismatch or a flash.
    const [theme, setThemeState] = useState<Theme>('light')

    useEffect(() => {
        const initial = (document.documentElement.getAttribute('data-theme') as Theme) || 'light'
        setThemeState(initial)
    }, [])

    const setTheme = useCallback((t: Theme) => {
        setThemeState(t)
        applyThemeToDocument(t)
        try {
            window.localStorage.setItem(STORAGE_KEY, t)
        } catch {
            // localStorage unavailable — theme just won't persist across sessions
        }
    }, [])

    const toggleTheme = useCallback(() => {
        setTheme(theme === 'dark' ? 'light' : 'dark')
    }, [theme, setTheme])

    // Keep in sync if theme is changed in another tab
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
                setThemeState(e.newValue)
                applyThemeToDocument(e.newValue)
            }
        }
        window.addEventListener('storage', onStorage)
        return () => window.removeEventListener('storage', onStorage)
    }, [])

    const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme])

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
    const ctx = useContext(ThemeContext)
    if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
    return ctx
}

/**
 * Inline, synchronous script — must run in <head> BEFORE hydration so the
 * correct theme is applied on first paint (no white-flash-then-dark-swap,
 * no hydration mismatch). Reads localStorage directly; falls back to
 * 'light' (the required default) if nothing is stored yet.
 */
export const NO_FLASH_THEME_SCRIPT = `
(function() {
try {
    var t = localStorage.getItem('${STORAGE_KEY}');
    if (t !== 'dark' && t !== 'light') t = 'light';
    document.documentElement.setAttribute('data-theme', t);
} catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
}
})();
`