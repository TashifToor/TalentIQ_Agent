/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        serif: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Selective display font for hero/section headings and major titles only —
        // available as `font-display` for Tailwind-class usage; most of the codebase
        // sets fontFamily inline, where the literal "'Space Grotesk', Inter, sans-serif"
        // string is used directly instead of this utility.
        display: ['Space Grotesk', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        gold: { DEFAULT: '#c5931f', 2: '#e2b04a', 3: '#f5d87a', light: '#fdf3db' },
        ink: { DEFAULT: '#0a0a09', 2: '#2a2a26', 3: '#6a6860' },
        paper: { DEFAULT: '#f7f5f0', 2: '#edeae2', 3: '#e0ddd4' },
        dark: { DEFAULT: '#0c0c0a', 2: '#161614', 3: '#1e1e1b' },
        teal: { DEFAULT: '#0b7c5e', 2: '#13c28e' },
      },
      animation: {
        'fade-up': 'fadeUp 0.7s ease forwards',
        'float': 'float 6s ease-in-out infinite',
        'marquee': 'marquee 30s linear infinite',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'bar-fill': 'barFill 1s ease forwards',
        'ring-fill': 'ringFill 1.5s ease forwards',
      },
      keyframes: {
        fadeUp: { from: { opacity: '0', transform: 'translateY(20px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        pulseDot: { '0%,100%': { opacity: '1', transform: 'scale(1)' }, '50%': { opacity: '.4', transform: 'scale(1.5)' } },
        barFill: { from: { width: '0%' }, to: { width: 'var(--bar-w, 70%)' } },
        ringFill: { from: { strokeDashoffset: '339' }, to: { strokeDashoffset: 'var(--ring-offset, 51)' } },
      },
    },
  },
  plugins: [],
}