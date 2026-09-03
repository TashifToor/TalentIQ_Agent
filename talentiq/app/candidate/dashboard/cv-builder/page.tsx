'use client'

import { useState } from 'react'
import Link from 'next/link'
import CVBuilderWizard from '@/components/CVBuilderWizard'
import JobReadinessPanel from '@/components/JobReadinessPanel'

export default function CandidateCVBuilderPage() {
  const [wizardState, setWizardState] = useState<{ cv: any; template: string; accentColor: string | null } | null>(null)
  const [externalCvUpdate, setExternalCvUpdate] = useState<{ version: number; cv: any } | null>(null)

  const applyOptimizedCv = (cv: any) => {
    setExternalCvUpdate({ version: (externalCvUpdate?.version ?? 0) + 1, cv })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f7f5f0' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      ` }} />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px 16px' }}>
        <Link href="/candidate/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#7a7468', textDecoration: 'none', marginBottom: 12, fontFamily: 'Inter, sans-serif' }}>
          ← Back to Dashboard
        </Link>
      </div>
      <CVBuilderWizard onCvStateChange={setWizardState} externalCvUpdate={externalCvUpdate} light />

      {wizardState && (
        <JobReadinessPanel
          cv={wizardState.cv}
          template={wizardState.template}
          onApplyOptimizedCv={applyOptimizedCv}
        />
      )}
    </div>
  )
}