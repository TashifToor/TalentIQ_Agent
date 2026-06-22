import type { Metadata } from 'next'
import './globals.css'

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
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
