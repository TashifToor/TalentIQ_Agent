'use client'
import { useState, useRef, useEffect } from 'react'
import { GlassCard, AnimatedButton, GradientBadge } from '@/components/shared/primitives'
import { api } from '@/lib/api'

interface Question { id: string; question: string; options: string[]; topic: string }
interface PendingAnswer { questionId: string; selectedIndex: number }

export default function PracticeAssessmentInterface({
    sessionId, initialQuestions, initialIndex, onComplete,
}: { sessionId: string; initialQuestions: Question[]; initialIndex: number; onComplete: () => void }) {
    const [questions] = useState(initialQuestions)
    const [index, setIndex] = useState(initialIndex)
    const [selected, setSelected] = useState<number | null>(null)
    const [finishing, setFinishing] = useState(false)
    const [syncError, setSyncError] = useState('')
    const [pendingCount, setPendingCount] = useState(0)

    const queueRef = useRef<PendingAnswer[]>([])
    const syncingRef = useRef(false)
    const completedRef = useRef(false)

    const total = questions.length
    const current = questions[index]

    // Correct answers never reach the client — `questions` only ever carries
    // {id, question, options, topic} from the backend, nothing else.

    const processQueue = async () => {
        if (syncingRef.current) return
        syncingRef.current = true
        while (queueRef.current.length > 0) {
            const item = queueRef.current[0]
            let ok = false
            let result: any = null
            for (let attempt = 0; attempt < 3 && !ok; attempt++) {
                try {
                    result = await api.answerPracticeQuestion(sessionId, item.questionId, item.selectedIndex)
                    ok = true
                } catch {
                    if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
                }
            }
            if (ok) {
                queueRef.current.shift()
                setPendingCount(queueRef.current.length)
                setSyncError('')
                if (result?.stage === 'done' && !completedRef.current) {
                    completedRef.current = true
                    onComplete()
                }
            } else {
                setSyncError('Could not save your last answer — retrying automatically.')
                break // stop this pass; the retry effect below will try again shortly
            }
        }
        syncingRef.current = false
    }

    // Background retry — fires periodically while anything is still unsaved,
    // so a transient network blip resolves itself without the candidate
    // needing to do anything (answers are queued in order, never lost).
    useEffect(() => {
        if (queueRef.current.length === 0) return
        const t = setInterval(() => processQueue(), 4000)
        return () => clearInterval(t)
    }, [pendingCount])

    const submit = () => {
        if (selected == null || !current) return
        queueRef.current.push({ questionId: current.id, selectedIndex: selected })
        setPendingCount(queueRef.current.length)
        setSelected(null)
        if (index < total - 1) {
            setIndex(index + 1) // instant optimistic advance — the save happens in the background, in order
        } else {
            setFinishing(true) // last question — wait for the queue to actually drain before completing
        }
        processQueue()
    }

    if (finishing) {
        return (
            <div style={{ maxWidth: 480, margin: '60px auto 0', textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 10 }}>
                    {syncError ? 'Saving your last answer...' : 'Finishing up...'}
                </div>
                {syncError && (
                    <div>
                        <div style={{ fontSize: 11.5, color: '#f87171', marginBottom: 10 }}>{syncError}</div>
                        <button onClick={() => processQueue()} style={{ background: 'none', border: '1px solid rgba(255,255,255,.15)', color: 'rgba(255,255,255,.6)', borderRadius: 8, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>Retry now</button>
                    </div>
                )}
            </div>
        )
    }

    if (!current) return null

    return (
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{current.topic.replace('_', ' ')}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {pendingCount > 0 && <GradientBadge label={syncError ? 'Retrying save' : 'Saving...'} tone={syncError ? 'neutral' : 'teal'} />}
                    <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,.35)' }}>Question {index + 1} of {total}</span>
                </div>
            </div>

            <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 100, marginBottom: 20, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(index / total) * 100}%`, background: 'linear-gradient(90deg,#0b7c5e,#13c28e)', transition: 'width .4s var(--ease)' }} />
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

            <div style={{ marginTop: 16 }}>
                <AnimatedButton onClick={submit} disabled={selected == null} fullWidth>
                    {index === total - 1 ? 'Submit & Finish →' : 'Next Question →'}
                </AnimatedButton>
            </div>
        </div>
    )
}