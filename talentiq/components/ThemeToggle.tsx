"use client";

import { useTheme } from "@/lib/theme-provider";

/**
 * Compact Sun/Moon icon toggle. Shared by HR + Candidate dashboard
 * headers/topbars (pass a `light` prop when mounting it on a dark-chrome
 * surface if ever needed — currently both shells are token-driven so it
 * isn't required).
 */
export default function ThemeToggle({ size = 34 }: { size?: number }) {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === "dark";

    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            style={{
                width: size,
                height: size,
                borderRadius: "50%",
                border: "1px solid var(--dash-border)",
                background: "var(--dash-surface-2)",
                color: "var(--dash-text)",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                flexShrink: 0,
                transition:
                    "background .15s ease, border-color .15s ease, transform .15s ease",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--dash-accent)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--dash-border)";
            }}
            onFocus={(e) => {
                e.currentTarget.style.outline = "2px solid var(--dash-accent)";
                e.currentTarget.style.outlineOffset = "2px";
            }}
            onBlur={(e) => {
                e.currentTarget.style.outline = "none";
            }}
        >
            {isDark ? (
                <svg
                    width={size * 0.5}
                    height={size * 0.5}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
            ) : (
                <svg
                    width={size * 0.5}
                    height={size * 0.5}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
            )}
        </button>
    );
}

/**
 * Segmented Light/Dark(/System) control for the Settings → Appearance
 * section. Reads/writes the SAME shared theme state as the header toggle
 * — no separate storage, updates immediately.
 */
export function ThemeSettingsControl() {
    const { theme, setTheme } = useTheme();

    const options: { value: "light" | "dark"; label: string }[] = [
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
    ];

    return (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {options.map((opt) => {
                const selected = theme === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTheme(opt.value)}
                        aria-pressed={selected}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "10px 16px",
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 600,
                            fontFamily: "Inter, sans-serif",
                            cursor: "pointer",
                            border: `1px solid ${selected ? "var(--dash-accent)" : "var(--dash-border)"
                                }`,
                            background: selected
                                ? "var(--dash-nav-selected-bg)"
                                : "var(--dash-surface-2)",
                            color: "var(--dash-text)",
                        }}
                    >
                        <span
                            style={{
                                width: 14,
                                height: 14,
                                borderRadius: "50%",
                                border: `2px solid ${selected ? "var(--dash-accent)" : "var(--dash-text-faint)"
                                    }`,
                                display: "grid",
                                placeItems: "center",
                                flexShrink: 0,
                            }}
                        >
                            {selected && (
                                <span
                                    style={{
                                        width: 7,
                                        height: 7,
                                        borderRadius: "50%",
                                        background: "var(--dash-accent)",
                                    }}
                                />
                            )}
                        </span>
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}
