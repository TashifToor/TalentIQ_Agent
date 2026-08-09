'use client'
import { useState } from 'react'
import { GlassCard, AnimatedButton } from '@/components/shared/primitives'
import { api } from '@/lib/api'

interface Question { id: string; question: string; options: string[]; topic: string }

export default function PracticeAssessmentInterface({
    sessionId, initialQuestions, initialIndex, onComplete,
}: { sessionId: string; initialQuestions: Question[]; initialIndex: number; onComplete: () => void }) {
    const [questions] = useState(initialQuestions)
    const [index, setIndex] = useState(initialIndex)
    const [selected, setSelected] = useState<number | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    const current = questions[index]
    const total = questions.length

    const submit = async () => {
        if (selected == null || !current) return
        setSubmitting(true)
        setError('')
        try {
            const res = await api.answerPracticeQuestion(sessionId, current.id, selected)
            setSelected(null)
            if (res.stage === 'done') {
                onComplete()
            } else {
                setIndex(res.assessment_current_index)
            }
        } catch (err: any) {
            setError(err.message || 'Could not submit your answer — try again.')
        } finally {
            setSubmitting(false)
        }
    }

    if (!current) return null

    return (
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{current.topic.replace('_', ' ')}</span>
                <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,.35)' }}>Question {index + 1} of {total}</span>
            </div>

            <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 100, marginBottom: 20, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${((index) / total) * 100}%`, background: 'linear-gradient(90deg,#0b7c5e,#13c28e)', transition: 'width .4s var(--ease)' }} />
            </div>

            <GlassCard>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 18, lineHeight: 1.5 }}>{current.question}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {current.options.map((opt, i) => (
                        <button key={i} onClick={() => setSelected(i)} style={{
                            textAlign: 'left', padding: '12px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                            border: `1.5px solid ${selected === i ? '#13c28e' : 'rgba(255,255,255,.08)'}`,
                            background: selected === i ? 'rgba(19,194,142,.08)' : '#161614',
                            color: selected === i ? '#13c28e' : 'rgba(255,255,255,.75)', transition: 'all .15s',
                        }}>
                            <span style={{ fontWeight: 700, marginRight: 8 }}>{String.fromCharCode(65 + i)}.</span>{opt}
                        </button>
                    ))}
                </div>
            </GlassCard>

            {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 12 }}>{error}</div>}
            <div style={{ marginTop: 16 }}>
                <AnimatedButton onClick={submit} disabled={selected == null} loading={submitting} fullWidth>
                    {index === total - 1 ? 'Submit & Finish →' : 'Next Question →'}
                </AnimatedButton>
            </div>
        </div>
    )
}