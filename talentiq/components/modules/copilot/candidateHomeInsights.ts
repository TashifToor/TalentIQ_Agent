import { CopilotResult, CandidateStatTile } from './types'

export interface ResumeScanResult {
    metrics?: {
        candidate_score?: number
        matched_skills?: string[]
        missing_skills?: string[]
        final_verdict?: string
    }
    flags?: { is_shortlisted?: boolean }
    deep_analysis?: string
}

export interface PracticeHistoryItem {
    id: string
    mode: 'chatbot' | 'mcq' | 'voice_agent'
    target_role: string
    status: string
    ai_score?: number | null
    assessment_score?: number | null
    final_verdict?: string | null
    created_at: string
    completed_at?: string | null
}

const MODE_LABEL: Record<string, string> = { chatbot: 'Chat', mcq: 'MCQ', voice_agent: 'Voice' }

export function getCandidateHomeInsights(input: {
    scanResult: ResumeScanResult | null
    practiceHistory: PracticeHistoryItem[] | null   // null = not fetched yet (loading)
}): CopilotResult {
    const { scanResult, practiceHistory } = input
    const items: CopilotResult['items'] = []

    // ── Resume Screening — real, from the most recent CV Optimizer scan ──
    if (scanResult?.metrics) {
        const m = scanResult.metrics
        const tiles: CandidateStatTile[] = [
            { label: 'ATS Score', value: m.candidate_score != null ? `${m.candidate_score}%` : '—', accent: (m.candidate_score ?? 0) >= 70 ? '#13c28e' : (m.candidate_score ?? 0) >= 45 ? '#e2b04a' : '#ef4444' },
            { label: 'Matched Skills', value: String(m.matched_skills?.length || 0) },
            { label: 'Missing Keywords', value: String(m.missing_skills?.length || 0) },
        ]
        items.push({
            id: 'resume_screening', label: 'Resume Screening', icon: '📄', status: 'available',
            content: `${m.final_verdict || 'Scan complete'} — ${m.candidate_score ?? '—'}% match, ${m.missing_skills?.length || 0} missing keyword${(m.missing_skills?.length || 0) === 1 ? '' : 's'}.`,
            data: tiles,
        })
    } else {
        items.push({ id: 'resume_screening', label: 'Resume Screening', icon: '📄', status: 'empty', emptyReason: 'No scan run yet', content: 'Upload your CV and paste a job description to get an ATS score, detected skills, and missing keywords.' })
    }

    // ── CV Builder — no page-level tracking of build completion; honest empty state ──
    items.push({
        id: 'cv_builder', label: 'CV Builder', icon: '📝', status: 'empty',
        emptyReason: 'Not tracked from this page',
        content: 'Build or upload your CV to unlock resume insights here.',
    })

    // ── Interview Practice — real, from practice session history ──
    if (practiceHistory === null) {
        items.push({ id: 'interview_practice', label: 'Interview Practice', icon: '🎤', status: 'thinking' })
    } else if (practiceHistory.length > 0) {
        const completed = practiceHistory.filter(p => p.status === 'completed')
        const scores = completed.map(p => p.ai_score ?? p.assessment_score).filter((n): n is number => n != null)
        const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
        const byMode: Record<string, number> = {}
        practiceHistory.forEach(p => { byMode[p.mode] = (byMode[p.mode] || 0) + 1 })
        const modeBreakdown = Object.entries(byMode).map(([m, c]) => `${MODE_LABEL[m] || m}: ${c}`).join(' · ')
        items.push({
            id: 'interview_practice', label: 'Interview Practice', icon: '🎤', status: 'available',
            content: `${completed.length} completed session${completed.length === 1 ? '' : 's'}${avgScore != null ? `, avg score ${avgScore}` : ''} · ${modeBreakdown}`,
            data: [
                { label: 'Sessions', value: String(practiceHistory.length) },
                { label: 'Completed', value: String(completed.length) },
                { label: 'Avg. Score', value: avgScore != null ? String(avgScore) : '—' },
            ] as CandidateStatTile[],
        })
    } else {
        items.push({ id: 'interview_practice', label: 'Interview Practice', icon: '🎤', status: 'empty', emptyReason: 'No practice sessions yet', content: 'Start your first practice interview — your performance insights will appear here.' })
    }

    return { state: 'ready', items }
}