import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | TalentIQ',
  description: 'How TalentIQ collects, uses, and protects your data.',
}

const wrap: React.CSSProperties = { maxWidth: 760, margin: '0 auto', padding: '48px 20px 80px', color: 'rgba(245,242,235,.85)', fontFamily: 'Inter, sans-serif', lineHeight: 1.7 }
const h1: React.CSSProperties = { fontFamily: "Inter, sans-serif", fontSize: 34, fontWeight: 600, color: '#f5f2eb', marginBottom: 8 }
const h2: React.CSSProperties = { fontSize: 17, fontWeight: 700, color: '#d4af6d', marginTop: 32, marginBottom: 10 }
const p: React.CSSProperties = { fontSize: 14, marginBottom: 12, color: 'rgba(245,242,235,.7)' }
const li: React.CSSProperties = { fontSize: 14, marginBottom: 6, color: 'rgba(245,242,235,.7)' }

export default function PrivacyPolicyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a08' }}>
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');` }} />
      <div style={wrap}>
        <Link href="/" style={{ fontSize: 12, color: '#d4af6d', textDecoration: 'none' }}>← TalentIQ</Link>
        <h1 style={h1}>Privacy Policy</h1>
        <p style={{ fontSize: 12.5, color: 'rgba(245,242,235,.4)', marginBottom: 24 }}>Last updated: July 2026</p>

        <p style={p}>
          This Privacy Policy explains what information TalentIQ ("we," "us") collects when you use our
          website and services, why we collect it, and what rights you have over it.
        </p>

        <h2 style={h2}>1. Information We Collect</h2>
        <ul style={{ paddingLeft: 18, marginBottom: 12 }}>
          <li style={li}><strong>Account information:</strong> name, email address, and password (stored as a one-way hash, never in plain text).</li>
          <li style={li}><strong>CV/resume content:</strong> the text and files you upload, including work history, education, and contact details contained within them.</li>
          <li style={li}><strong>Job descriptions:</strong> text you or an HR user submits for screening or CV tailoring.</li>
          <li style={li}><strong>Usage data:</strong> pages visited, features used, and approximate location/device info, collected via analytics (PostHog).</li>
          <li style={li}><strong>Technical data:</strong> IP address (used for basic abuse prevention and free-tier limits on tools that don't require login), browser type, and error logs (via Sentry) if something crashes.</li>
        </ul>

        <h2 style={h2}>2. How We Use Your Information</h2>
        <ul style={{ paddingLeft: 18, marginBottom: 12 }}>
          <li style={li}>To provide the core service: AI-powered CV screening, scoring, and CV building against job descriptions.</li>
          <li style={li}>To send account-related emails: email verification codes, password reset codes, and (for HR users) screening completion notifications.</li>
          <li style={li}>To prevent abuse: rate-limiting, fraud/spam prevention, and enforcing free-tier usage limits.</li>
          <li style={li}>To improve the product: aggregated, non-identifying usage analytics.</li>
        </ul>

        <h2 style={h2}>3. Third-Party Processors</h2>
        <p style={p}>We share data with the following third parties, only as needed to operate the service:</p>
        <ul style={{ paddingLeft: 18, marginBottom: 12 }}>
          <li style={li}><strong>Groq</strong> — processes CV and job description text to generate AI screening results and CV content. Groq processes this data on our behalf and does not use it to train models on our plan.</li>
          <li style={li}><strong>Email delivery</strong> — used to send verification codes and password reset codes to your inbox.</li>
          <li style={li}><strong>PostHog</strong> — product analytics (page views, feature usage).</li>
          <li style={li}><strong>Sentry</strong> — error monitoring, to help us detect and fix bugs. We configure it to avoid capturing sensitive request content where possible.</li>
        </ul>
        <p style={p}>We do not sell your personal data to anyone, ever.</p>

        <h2 style={h2}>4. Data Retention</h2>
        <p style={p}>
          We retain your account data and scan history for as long as your account is active. If you delete
          your account, your CV data, scan history, and associated records are permanently deleted from our
          primary database. Backups (if any) are purged on a rolling schedule.
        </p>

        <h2 style={h2}>5. Your Rights</h2>
        <ul style={{ paddingLeft: 18, marginBottom: 12 }}>
          <li style={li}><strong>Access/Export:</strong> download a copy of everything we store about you from your account Settings page.</li>
          <li style={li}><strong>Deletion:</strong> permanently delete your account and all associated data from Settings at any time.</li>
          <li style={li}><strong>Correction:</strong> update your name, email, and CV content at any time from your dashboard.</li>
        </ul>
        <p style={p}>
          If you're located in the EU/UK or another jurisdiction with data protection laws (GDPR, etc.), these
          rights apply to you regardless of where TalentIQ is based.
        </p>

        <h2 style={h2}>6. Security</h2>
        <p style={p}>
          Passwords are hashed (never stored in plain text). Access to the platform requires authentication.
          We use rate-limiting and account lockout protections against brute-force attacks. No system is 100%
          secure, and we can't guarantee absolute security, but we take reasonable, industry-standard measures
          to protect your data.
        </p>

        <h2 style={h2}>7. Children's Privacy</h2>
        <p style={p}>TalentIQ is not directed at, and should not be used by, anyone under the age of 16.</p>

        <h2 style={h2}>8. Changes to This Policy</h2>
        <p style={p}>We may update this policy as the product evolves. Material changes will be reflected by updating the "Last updated" date above.</p>

        <h2 style={h2}>9. Contact</h2>
        <p style={p}>Questions about this policy or your data? Reach out at <strong>[your contact email here]</strong>.</p>
      </div>
    </div>
  )
}