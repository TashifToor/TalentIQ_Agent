'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { GlassCard, LoadingSkeleton } from '@/components/shared/primitives'
import { PoolCandidate } from './types'

type Step = 'choose' | 'loading' | 'review' | 'editing' | 'sending' | 'done' | 'error'

export default function DecisionCenter({ candidate, onClose, onDecided }: {
    candidate: PoolCandidate
    onClose: () => void
    onDecided: () => void
}) {
    const alreadyDecided = candidate.decision !== 'pending'
    const [step, setStep] = useState<Step>(alreadyDecided ? 'error' : 'choose')
    const [decision, setDecision] = useState<'accepted' | 'rejected' | null>(null)
    const [preview, setPreview] = useState<{ subject: string; body: string; missing_data: string[]; ready: boolean } | null>(null)
    const [subject, setSubject] = useState('')
    const [body, setBody] = useState('')
    const [notify, setNotify] = useState(true)
    const [error, setError] = useState('')
    const [result, setResult] = useState<{ decision: string; notification_status: string } | null>(null)

    const choose = async (d: 'accepted' | 'rejected') => {
        setDecision(d)
        setStep('loading')
        setError('')
        try {
            const p = await api.getDecisionPreview(candidate.id, d)
            setPreview(p)
            setSubject(p.subject)
            setBody(p.body)
            setStep('review')
        } catch (e: any) {
            setError(e?.message || 'Could not load the email preview.')
            setStep('error')
        }
    }

    const restoreGenerated = () => {
        if (preview) { setSubject(preview.subject); setBody(preview.body) }
    }

    const send = async () => {
        if (!decision || step === 'sending') return
        setStep('sending')
        setError('')
        try {
            const res: any = await api.submitDecision(candidate.id, { decision, notify, subject, body })
            setResult(res)
            setStep('done')
            onDecided()
        } catch (e: any) {
            setError(e?.message || 'Could not record this decision.')
            setStep('error')
        }
    }

    const retryNotification = async () => {
        setStep('sending')
        try {
            const res: any = await api.retryDecisionNotification(candidate.id)
            setResult(r => ({ decision: r?.decision || decision || '', notification_status: res.notification_status }))
            setStep('done')
            onDecided()
        } catch (e: any) {
            setError(e?.message || 'Retry failed.')
            setStep('error')
        }
    }

    return (
        <div role="dialog" aria-modal="true" aria-label="Decision Center" style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center', zIndex: 200, padding: 20,
        }} onClick={e => e.target === e.currentTarget && onClose()}>
            <GlassCard className="modal-sheet" style={{ width: 520, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 0 }}>
                <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', flex: 1 }}>Decision Center</div>
                    <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', fontSize: 18, cursor: 'pointer' }}>✕</button>
                </div>

                <div style={{ padding: 22 }}>
                    {alreadyDecided && step === 'error' && !decision && (
                        <div>
                            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginBottom: 14 }}>
                                Candidate already {candidate.decision}.{candidate.decision_at ? ` (${new Date(candidate.decision_at).toLocaleDateString()})` : ''}
                            </div>
                            {candidate.notification_status === 'failed' && (
                                <button onClick={retryNotification} style={primaryBtnSt}>Retry Notification</button>
                            )}
                            {candidate.notification_status === 'sent' && (
                                <div style={{ fontSize: 12, color: '#13c28e' }}>✓ Candidate notified</div>
                            )}
                        </div>
                    )}

                    {step === 'choose' && (
                        <div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 16 }}>
                                {candidate.candidate_name || 'This candidate'} — {candidate.job_title || 'this role'}
                            </div>
                            <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <button onClick={() => choose('accepted')} style={decisionCardSt('#13c28e')}>
                                    <div style={{ fontSize: 18, marginBottom: 6 }}>✓</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 3 }}>Accept Candidate</div>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>Move this candidate forward</div>
                                </button>
                                <button onClick={() => choose('rejected')} style={decisionCardSt('#ef4444')}>
                                    <div style={{ fontSize: 18, marginBottom: 6 }}>✕</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 3 }}>Reject Candidate</div>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>Close this application</div>
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'loading' && <LoadingSkeleton height={180} />}

                    {(step === 'review' || step === 'editing' || step === 'sending') && preview && (
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: decision === 'accepted' ? '#13c28e' : '#ef4444', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                                {decision === 'accepted' ? 'Accept Candidate' : 'Reject Candidate'}
                            </div>
                            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginBottom: 14 }}>
                                {candidate.candidate_name || 'Candidate'} · {candidate.job_title || 'Role'}
                            </div>

                            {preview.missing_data.length > 0 && (
                                <div style={{ fontSize: 11, color: '#e2b04a', marginBottom: 12, background: 'rgba(226,176,74,.08)', borderRadius: 8, padding: '8px 10px' }}>
                                    {preview.missing_data.map((m, i) => <div key={i}>⚠ {m}</div>)}
                                </div>
                            )}

                            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Review &amp; Send</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginBottom: 2 }}>To: {candidate.candidate_email || 'No email on file'}</div>

                            {step === 'editing' ? (
                                <>
                                    <label htmlFor="dc-subject" style={labelSt}>Subject</label>
                                    <input id="dc-subject" value={subject} onChange={e => setSubject(e.target.value)} style={inputSt} />
                                    <label htmlFor="dc-body" style={labelSt}>Message</label>
                                    <textarea id="dc-body" value={body} onChange={e => setBody(e.target.value)} rows={10} style={{ ...inputSt, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
                                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                        <button onClick={restoreGenerated} style={secondaryBtnSt}>Restore Generated Version</button>
                                        <button onClick={() => setStep('review')} style={secondaryBtnSt}>Done Editing</button>
                                    </div>
                                </>
                            ) : (
                                <div style={{ background: '#161614', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: 14, marginTop: 8 }}>
                                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{subject}</div>
                                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{body}</div>
                                </div>
                            )}

                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 12, color: 'rgba(255,255,255,.6)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} /> Notify candidate by email
                            </label>

                            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                                {step !== 'editing' && <button onClick={() => setStep('editing')} disabled={step === 'sending'} style={secondaryBtnSt}>Edit Message</button>}
                                <button onClick={send} disabled={step === 'sending' || (!candidate.candidate_email && notify)} style={{ ...primaryBtnSt, flex: 1, opacity: step === 'sending' ? .7 : 1 }}>
                                    {step === 'sending' ? 'Sending…' : 'Send Email'}
                                </button>
                            </div>
                            {!candidate.candidate_email && notify && (
                                <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>This candidate has no email on file — uncheck notify, or add an email first.</div>
                            )}
                        </div>
                    )}

                    {step === 'done' && result && (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <div style={{ fontSize: 28, marginBottom: 10 }}>{result.notification_status === 'sent' || !notify ? '✓' : '⚠'}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                                Candidate {result.decision}{notify ? (result.notification_status === 'sent' ? ' and notified successfully.' : '.') : '.'}
                            </div>
                            {notify && result.notification_status === 'failed' && (
                                <>
                                    <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10 }}>Decision was recorded, but the notification could not be sent.</div>
                                    <button onClick={retryNotification} style={primaryBtnSt}>Retry Notification</button>
                                </>
                            )}
                            <div style={{ marginTop: 14 }}><button onClick={onClose} style={secondaryBtnSt}>Close</button></div>
                        </div>
                    )}

                    {step === 'error' && decision && (
                        <div>
                            <div style={{ fontSize: 12.5, color: '#ef4444', marginBottom: 12 }}>{error}</div>
                            <button onClick={() => choose(decision)} style={primaryBtnSt}>Try Again</button>
                        </div>
                    )}
                </div>
            </GlassCard>
        </div>
    )
}

const labelSt: React.CSSProperties = { display: 'block', fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,.4)', margin: '10px 0 4px' }
const inputSt: React.CSSProperties = { width: '100%', background: '#161614', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '9px 11px', fontSize: 12.5, color: '#fff', outline: 'none', boxSizing: 'border-box' }
const primaryBtnSt: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#13c28e', color: '#0a0a08', fontFamily: 'Inter,sans-serif' }
const secondaryBtnSt: React.CSSProperties = { fontSize: 12, fontWeight: 600, padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', cursor: 'pointer', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.7)', fontFamily: 'Inter,sans-serif' }
function decisionCardSt(accent: string): React.CSSProperties {
    return {
        textAlign: 'left', padding: 16, borderRadius: 12, borderLeft: `3px solid ${accent}`,
        border: '1px solid rgba(255,255,255,.08)', borderLeftWidth: 3, borderLeftColor: accent,
        background: '#161614', cursor: 'pointer', transition: 'border-color .15s, background .15s',
    }
}