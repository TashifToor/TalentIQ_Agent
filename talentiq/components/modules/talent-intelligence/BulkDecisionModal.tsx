'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { GlassCard, LoadingSkeleton } from '@/components/shared/primitives'
import { useTheme } from '@/lib/theme-provider'

interface BulkPreview {
    application_id: string
    candidate_name: string | null
    candidate_email: string | null
    job_title: string | null
    subject: string
    body: string
    missing_data: string[]
    ready: boolean
}

type Step = 'confirm' | 'loading' | 'review' | 'sending' | 'done'

export default function BulkDecisionModal({ applicationIds, decision, onClose, onDecided }: {
    applicationIds: string[]
    decision: 'accepted' | 'rejected'
    onClose: () => void
    onDecided: () => void
}) {
    const { theme } = useTheme()
    const light = theme === 'light'
    const inputSt = getInputSt(light)
    const primaryBtnSt = getPrimaryBtnSt(light)
    const secondaryBtnSt = getSecondaryBtnSt(light)
    const panelBg = light ? 'var(--dash-surface)' : '#161614'
    const [step, setStep] = useState<Step>('confirm')
    const [notify, setNotify] = useState(true)
    const [previews, setPreviews] = useState<BulkPreview[]>([])
    const [expanded, setExpanded] = useState<string | null>(null)
    const [drafts, setDrafts] = useState<Record<string, { subject: string; body: string }>>({})
    const [results, setResults] = useState<{ application_id: string; ok: boolean; notification_status?: string; error?: string }[]>([])
    const [error, setError] = useState('')

    const loadPreviews = async () => {
        setStep('loading')
        setError('')
        try {
            const res: any = await api.getBulkDecisionPreview(applicationIds, decision)
            const list: BulkPreview[] = res.previews || []
            setPreviews(list)
            const d: Record<string, { subject: string; body: string }> = {}
            list.forEach(p => { d[p.application_id] = { subject: p.subject, body: p.body } })
            setDrafts(d)
            setStep('review')
        } catch (e: any) {
            setError(e?.message || 'Could not load previews.')
            setStep('confirm')
        }
    }

    const send = async () => {
        setStep('sending')
        try {
            const items = previews.map(p => ({
                application_id: p.application_id, decision, notify,
                subject: drafts[p.application_id]?.subject, body: drafts[p.application_id]?.body,
            }))
            const res: any = await api.submitBulkDecisions(items)
            setResults(res.results || [])
            setStep('done')
            onDecided()
        } catch (e: any) {
            setError(e?.message || 'Bulk send failed.')
            setStep('review')
        }
    }

    const readyCount = previews.filter(p => p.ready).length
    const label = decision === 'accepted' ? 'Accept' : 'Reject'

    return (
        <div role="dialog" aria-modal="true" aria-label="Bulk Decision" style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center', zIndex: 200, padding: 20,
        }} onClick={e => e.target === e.currentTarget && onClose()}>
            <GlassCard className="modal-sheet" style={{ width: 620, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 0 }}>
                <div style={{ padding: '18px 22px', borderBottom: `1px solid ${light ? 'var(--dash-border-soft)' : 'rgba(255,255,255,.06)'}`, display: 'flex', alignItems: 'center' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: (light ? 'var(--dash-text)' : '#fff'), flex: 1 }}>{label} {applicationIds.length} Candidate{applicationIds.length === 1 ? '' : 's'}</div>
                    <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: (light ? 'var(--dash-text-muted)' : 'rgba(255,255,255,.4)'), fontSize: 18, cursor: 'pointer' }}>✕</button>
                </div>

                <div style={{ padding: 22 }}>
                    {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{error}</div>}

                    {step === 'confirm' && (
                        <div>
                            <div style={{ fontSize: 13, color: (light ? 'var(--dash-text-muted)' : 'rgba(255,255,255,.6)'), marginBottom: 16 }}>{label} {applicationIds.length} candidates?</div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: (light ? 'var(--dash-text-muted)' : 'rgba(255,255,255,.6)'), marginBottom: 16, cursor: 'pointer' }}>
                                <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} /> Send personalized feedback to each candidate
                            </label>
                            <button onClick={loadPreviews} style={primaryBtnSt}>Review &amp; Send</button>
                        </div>
                    )}

                    {step === 'loading' && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <LoadingSkeleton key={i} height={50} />)}</div>}

                    {step === 'review' && (
                        <div>
                            <div style={{ fontSize: 11.5, color: (light ? 'var(--dash-text-muted)' : 'rgba(255,255,255,.4)'), marginBottom: 12 }}>{applicationIds.length} candidates selected — {readyCount} ready to send</div>
                            {previews.map(p => {
                                const isOpen = expanded === p.application_id
                                return (
                                    <div key={p.application_id} style={{ background: panelBg, border: `1px solid ${light ? 'var(--dash-border-soft)' : 'rgba(255,255,255,.08)'}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
                                        <div onClick={() => setExpanded(isOpen ? null : p.application_id)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: (light ? 'var(--dash-text)' : '#fff'), flex: 1 }}>{p.candidate_name || 'Unnamed candidate'}</span>
                                            {p.ready ? (
                                                <span style={{ fontSize: 10.5, color: '#13c28e' }}>✓ Personalized email ready</span>
                                            ) : (
                                                <span style={{ fontSize: 10.5, color: '#e2b04a' }}>⚠ {p.missing_data[0] || 'Missing data'}</span>
                                            )}
                                        </div>
                                        {isOpen && (
                                            <div style={{ marginTop: 10 }}>
                                                <input value={drafts[p.application_id]?.subject || ''} onChange={e => setDrafts(d => ({ ...d, [p.application_id]: { ...d[p.application_id], subject: e.target.value } }))} style={inputSt} />
                                                <textarea value={drafts[p.application_id]?.body || ''} onChange={e => setDrafts(d => ({ ...d, [p.application_id]: { ...d[p.application_id], body: e.target.value } }))} rows={6} style={{ ...inputSt, marginTop: 6, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                            <button onClick={send} disabled={previews.length === 0} style={{ ...primaryBtnSt, width: '100%', marginTop: 6 }}>Send {applicationIds.length} Email{applicationIds.length === 1 ? '' : 's'}</button>
                        </div>
                    )}

                    {step === 'sending' && <div style={{ textAlign: 'center', padding: 20, fontSize: 13, color: (light ? 'var(--dash-text-muted)' : 'rgba(255,255,255,.5)') }}>Sending…</div>}

                    {step === 'done' && (
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: (light ? 'var(--dash-text)' : '#fff'), marginBottom: 12 }}>
                                {results.filter(r => r.ok).length} of {results.length} candidates {decision} and processed.
                            </div>
                            {results.map(r => {
                                const p = previews.find(x => x.application_id === r.application_id)
                                return (
                                    <div key={r.application_id} style={{ fontSize: 11.5, color: r.ok ? (r.notification_status === 'sent' ? '#13c28e' : r.notification_status === 'failed' ? '#e2b04a' : (light ? 'var(--dash-text-muted)' : 'rgba(255,255,255,.5)')) : '#ef4444', marginBottom: 4 }}>
                                        {p?.candidate_name || r.application_id}: {r.ok ? (r.notification_status === 'sent' ? '✓ Notified' : r.notification_status === 'failed' ? '⚠ Notification failed' : 'Recorded') : `✗ ${r.error}`}
                                    </div>
                                )
                            })}
                            <button onClick={onClose} style={{ ...secondaryBtnSt, marginTop: 12 }}>Close</button>
                        </div>
                    )}
                </div>
            </GlassCard>
        </div>
    )
}

const getInputSt = (light: boolean): React.CSSProperties => ({ width: '100%', background: light ? 'var(--dash-surface-2)' : '#0f0f0d', border: `1px solid ${light ? 'var(--dash-border-soft)' : 'rgba(255,255,255,.1)'}`, borderRadius: 6, padding: '7px 9px', fontSize: 11.5, color: light ? 'var(--dash-text)' : '#fff', outline: 'none', boxSizing: 'border-box' })
const getPrimaryBtnSt = (light: boolean): React.CSSProperties => ({ fontSize: 12.5, fontWeight: 700, padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#7c3aed', color: light ? 'var(--dash-text)' : '#fff', fontFamily: 'Inter,sans-serif' })
const getSecondaryBtnSt = (light: boolean): React.CSSProperties => ({ fontSize: 12, fontWeight: 600, padding: '9px 14px', borderRadius: 8, border: `1px solid ${light ? 'var(--dash-border-soft)' : 'rgba(255,255,255,.1)'}`, cursor: 'pointer', background: light ? 'var(--dash-overlay-035)' : 'rgba(255,255,255,.04)', color: light ? 'var(--dash-text)' : 'rgba(255,255,255,.7)', fontFamily: 'Inter,sans-serif' })