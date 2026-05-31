/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:      "#070710",
        surface: "#0D0D1A",
        card:    "#12121F",
        panel:   "#181828",
        border:  "#222236",
        muted:   "#2E2E4A",
        g: {
          400: "#FBBF24",
          500: "#F59E0B",
          600: "#D97706",
          700: "#B45309",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'Fira Code'", "'JetBrains Mono'", "monospace"],
      },
      animation: {
        "fade-up":      "fadeUp 0.55s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in":      "fadeIn 0.4s ease both",
        "scale-in":     "scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
        "slide-right":  "slideRight 0.4s cubic-bezier(0.16,1,0.3,1) both",
        "shimmer":      "shimmer 2s linear infinite",
        "glow":         "glow 2.5s ease-in-out infinite",
        "float":        "float 5s ease-in-out infinite",
        "float-delay":  "float 7s ease-in-out 1s infinite",
        "spin-slow":    "spin 15s linear infinite",
        "pulse-ring":   "pulseRing 2s ease-out infinite",
        "marquee":      "marquee 20s linear infinite",
        "bar-fill":     "barFill 1.1s cubic-bezier(0.34,1.56,0.64,1) 0.3s both",
        "gauge-draw":   "gaugeDraw 1.4s cubic-bezier(0.34,1.56,0.64,1) 0.2s both",
        "bounce-dot":   "bounceDot 1.2s ease-in-out infinite",
        "slide-up-soft":"slideUpSoft 0.35s ease both",
      },
      keyframes: {
        fadeUp: {
          from: { opacity:"0", transform:"translateY(24px)" },
          to:   { opacity:"1", transform:"translateY(0)" },
        },
        fadeIn: {
          from: { opacity:"0" },
          to:   { opacity:"1" },
        },
        scaleIn: {
          from: { opacity:"0", transform:"scale(0.9)" },
          to:   { opacity:"1", transform:"scale(1)" },
        },
        slideRight: {
          from: { opacity:"0", transform:"translateX(-20px)" },
          to:   { opacity:"1", transform:"translateX(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition:"-600px 0" },
          "100%": { backgroundPosition:"600px 0" },
        },
        glow: {
          "0%,100%": { boxShadow:"0 0 12px rgba(245,158,11,0.3)" },
          "50%":     { boxShadow:"0 0 35px rgba(245,158,11,0.6), 0 0 70px rgba(245,158,11,0.2)" },
        },
        float: {
          "0%,100%": { transform:"translateY(0)" },
          "50%":     { transform:"translateY(-16px)" },
        },
        pulseRing: {
          "0%":   { transform:"scale(0.95)", opacity:"0.8" },
          "70%":  { transform:"scale(1.4)",  opacity:"0" },
          "100%": { transform:"scale(1.4)",  opacity:"0" },
        },
        marquee: {
          "0%":   { transform:"translateX(0)" },
          "100%": { transform:"translateX(-50%)" },
        },
        barFill: {
          from: { width:"0%" },
          to:   { width:"var(--target-w)" },
        },
        gaugeDraw: {
          from: { strokeDashoffset:"var(--dash-full)" },
          to:   { strokeDashoffset:"var(--dash-target)" },
        },
        bounceDot: {
          "0%,80%,100%": { transform:"scale(0)", opacity:"0.3" },
          "40%":          { transform:"scale(1)",   opacity:"1" },
        },
        slideUpSoft: {
          from: { opacity:"0", transform:"translateY(8px)" },
          to:   { opacity:"1", transform:"translateY(0)" },
        },
      },
      boxShadow: {
        "gold":    "0 0 20px rgba(245,158,11,0.25), 0 0 60px rgba(245,158,11,0.1)",
        "gold-lg": "0 0 40px rgba(245,158,11,0.4), 0 0 100px rgba(245,158,11,0.15)",
        "card":    "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)",
        "inner":   "inset 0 1px 0 rgba(255,255,255,0.05)",
      },
    },
  },
  plugins: [],
};
