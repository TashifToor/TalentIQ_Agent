import type { Metadata } from 'next'
// Next.js processes this stylesheet import at build time; TypeScript has no
// declaration for CSS side-effect imports in some editor configurations.
// @ts-expect-error CSS is handled by Next.js.
import './globals.css'
import PostHogProvider from '@/lib/posthog-provider'
import { ThemeProvider, NO_FLASH_THEME_SCRIPT } from '@/lib/theme-provider'

export const metadata: Metadata = {
  title: 'TalentIQ — Smarter Hiring Starts Here',
  description: 'AI-powered recruitment screening. Upload a CV, get a comprehensive match score with skill analysis in seconds.',
  keywords: 'recruitment, hiring, CV screening, ATS, job matching',
  openGraph: {
    title: 'TalentIQ — Smarter Hiring Starts Here',
    description: 'AI-powered recruitment screening for candidates and HR teams.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Sets data-theme on <html> before hydration — prevents white flash / hydration mismatch when the saved theme is dark */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <PostHogProvider>{children}</PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}