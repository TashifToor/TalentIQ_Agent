import { CopilotResult, ScoreBreakdownEntry, EvidenceGroup, RecommendationData, CompareData, ComparePeer } from './types'
import { AIFeedbackData } from '../reports/AIFeedbackReport'

export const CATEGORY_LABEL: Record<string, string> = {
  dsa: 'DSA', job_desc: 'Job-Specific', problem_solving: 'Problem Solving', teamwork: 'Teamwork', hr: 'HR / Behavioral',
}

export interface PeerCandidate { id: string; name: string; score: number | null }

function pctOf(s: { correct: number; total: number }): number {
  return s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0
}

function breakdownEntries(breakdown: Record<string, { correct: number; total: number }>): ScoreBreakdownEntry[] {
  return Object.entries(breakdown)
    .filter(([, s]) => s.total > 0)
    .map(([cat, s]) => ({
      key: cat,
      label: CATEGORY_LABEL[cat] || cat,
      pct: pctOf(s),
      correct: s.correct,
      total: s.total,
    }))
    .sort((a, b) => b.pct - a.pct)
}

function severityOf(pct: number): 'high' | 'medium' | 'low' {
  if (pct < 30) return 'high'
  if (pct < 50) return 'medium'
  return 'low'
}

export function getCandidateInsights(
  report: AIFeedbackData | null,
  candidateName?: string,
  peers?: PeerCandidate[],
): CopilotResult {
  if (!report) return { state: 'empty', items: [] }

  const items: CopilotResult['items'] = []
  const breakdown = report.assessment_breakdown && Object.keys(report.assessment_breakdown).length > 0
    ? breakdownEntries(report.assessment_breakdown)
    : []
  const hasScore = report.ai_score != null || report.assessment_score != null

  // ── Interview Summary — real, verbatim from the model's own written output ──
  const summaryText = report.experience_assessment || report.deep_analysis
  if (summaryText) {
    items.push({ id: 'summary', label: 'Interview Summary', icon: '📝', status: 'available', content: summaryText })
  } else if (report.transcript && report.transcript.length > 0) {
    const candidateTurns = report.transcript.filter(t => t.role !== 'assistant').length
    items.push({
      id: 'summary', label: 'Interview Summary', icon: '📝', status: 'empty',
      emptyReason: 'Written analysis not generated yet',
      content: `Transcript has ${report.transcript.length} exchanges (${candidateTurns} candidate response${candidateTurns === 1 ? '' : 's'}). A written summary will appear once the session is fully scored.`,
    })
  } else {
    items.push({ id: 'summary', label: 'Interview Summary', icon: '📝', status: 'empty', emptyReason: 'No transcript or analysis yet', content: 'Waiting for interview results.' })
  }

  // ── Strengths — real, from assessment_breakdown ──
  if (breakdown.length > 0) {
    const strong = breakdown.filter(e => e.pct >= 70)
    const shown = strong.length > 0 ? strong : [breakdown[0]]
    items.push({
      id: 'strengths', label: 'Strengths', icon: '✅', status: 'available',
      content: shown.map(e => `${e.label} — ${e.pct}% correct`).join(' · '),
      data: shown,
    })
  } else {
    items.push({
      id: 'strengths', label: 'Strengths', icon: '✅', status: 'empty',
      emptyReason: 'Only MCQ Assessment mode reports category scores',
      content: 'No per-category breakdown for this interview mode.',
    })
  }

  // ── Concerns — real, from assessment_breakdown ──
  if (breakdown.length > 0) {
    const weak = breakdown.filter(e => e.pct < 60).map(e => ({ ...e, severity: severityOf(e.pct) }))
    if (weak.length > 0) {
      items.push({
        id: 'concerns', label: 'Concerns', icon: '⚠️', status: 'available',
        content: weak.map(e => `${e.label} — ${e.pct}% correct`).join(' · '),
        data: weak,
      })
    } else {
      items.push({ id: 'concerns', label: 'Concerns', icon: '⚠️', status: 'available', content: 'No weak category detected — every category scored above 60%.' })
    }
  } else {
    items.push({
      id: 'concerns', label: 'Concerns', icon: '⚠️', status: 'empty',
      emptyReason: 'Only MCQ Assessment mode reports category scores',
      content: 'No per-category breakdown for this interview mode.',
    })
  }

  // ── Evidence — categorized, all real ──
  const evidenceGroups: EvidenceGroup[] = []
  if (breakdown.length > 0) {
    evidenceGroups.push({
      label: 'Assessment evidence', icon: '📋',
      items: breakdown.map(e => `${e.label}: ${e.correct}/${e.total} correct (${e.pct}%)`),
    })
    evidenceGroups.push({
      label: 'Skill evidence', icon: '🧩',
      items: breakdown.map(e => `${e.label} — ${e.pct >= 70 ? 'strong' : e.pct >= 50 ? 'adequate' : 'weak'} (${e.pct}%)`),
    })
  }
  if (report.transcript && report.transcript.length > 0) {
    const candidateTurns = report.transcript.filter(t => t.role !== 'assistant').length
    evidenceGroups.push({
      label: 'Interview evidence', icon: '💬',
      items: [`${report.transcript.length} total exchanges`, `${candidateTurns} candidate response${candidateTurns === 1 ? '' : 's'}`],
    })
  }
  const flags = report.assessment_flags || []
  const photos = report.assessment_photos || []
  if (flags.length > 0 || photos.length > 0) {
    const flagCounts: Record<string, number> = {}
    flags.forEach(f => { flagCounts[f.type] = (flagCounts[f.type] || 0) + 1 })
    const flagLines = Object.entries(flagCounts).map(([type, count]) => `${type.replace(/_/g, ' ')} × ${count}`)
    evidenceGroups.push({
      label: 'Proctoring evidence', icon: '🎥',
      items: [
        ...flagLines,
        ...(photos.length > 0 ? [`${photos.length} webcam snapshot${photos.length === 1 ? '' : 's'} recorded`] : []),
      ],
    })
  } else if (breakdown.length > 0) {
    evidenceGroups.push({ label: 'Proctoring evidence', icon: '🎥', items: ['No proctoring flags recorded — clean session.'] })
  }

  if (evidenceGroups.length > 0) {
    items.push({
      id: 'evidence', label: 'Evidence', icon: '🔗', status: 'available',
      content: evidenceGroups.map(g => `${g.label}: ${g.items.length}`).join(' · '),
      data: evidenceGroups,
    })
  } else {
    items.push({ id: 'evidence', label: 'Evidence', icon: '🔗', status: 'empty', emptyReason: 'No proctoring, transcript, or assessment data yet', content: 'No evidence recorded for this session yet.' })
  }

  // ── Hiring Recommendation — real, from final_verdict + deterministic "why" ──
  if (report.final_verdict) {
    const overallScore = report.ai_score ?? report.assessment_score ?? null
    const why: string[] = []
    if (overallScore != null) why.push(`Overall score: ${overallScore}${report.assessment_score != null && report.ai_score == null ? '%' : ''}.`)
    if (breakdown.length > 0) {
      const strongest = breakdown[0]
      why.push(`Strongest category: ${strongest.label} at ${strongest.pct}%.`)
      const weakest = breakdown[breakdown.length - 1]
      if (weakest.pct < 60 && weakest.key !== strongest.key) why.push(`Weakest category: ${weakest.label} at ${weakest.pct}%.`)
    }
    if (flags.length > 0) why.push(`${flags.length} proctoring flag${flags.length === 1 ? '' : 's'} recorded during the session.`)
    if (why.length === 0 && summaryText) why.push('Based on the written interview analysis above.')

    const recData: RecommendationData = {
      verdict: report.final_verdict, score: overallScore,
      scoreLabel: report.ai_score != null ? 'Interview Score' : 'Assessment Score',
      why,
    }
    items.push({
      id: 'recommendation', label: 'Hiring Recommendation', icon: '🏁', status: 'available',
      content: report.final_verdict, data: recData,
    })
  } else {
    items.push({
      id: 'recommendation', label: 'Hiring Recommendation', icon: '🏁', status: hasScore ? 'empty' : 'empty',
      emptyReason: 'Verdict not generated yet',
      content: 'Waiting for the interview to complete and be scored.',
    })
  }

  // ── Compare with other candidates — real ranking, only using real peer scores ──
  const scoredPeers = (peers || []).filter(p => p.score != null)
  const candidateId = report.id || null
  if (scoredPeers.length > 1) {
    const ranked = [...scoredPeers].sort((a, b) => (b.score as number) - (a.score as number))
    const rank = candidateId ? ranked.findIndex(p => p.id === candidateId) : ranked.findIndex(p => p.name === candidateName)
    const compareData: CompareData = {
      candidateId, candidateName,
      rank: rank >= 0 ? rank + 1 : null,
      total: ranked.length,
      peers: ranked as ComparePeer[],
    }
    items.push({
      id: 'compare', label: 'Compare with other candidates', icon: '⚖️', status: 'available',
      content: rank >= 0 ? `Ranked #${rank + 1} of ${ranked.length} candidates by score.` : `${ranked.length} candidates evaluated for this posting.`,
      data: compareData,
    })
  } else {
    items.push({
      id: 'compare', label: 'Compare with other candidates', icon: '⚖️', status: 'empty',
      emptyReason: 'Fewer than 2 scored candidates',
      content: 'More candidates needed — evaluate another candidate to compare hiring signals.',
    })
  }

  return { state: 'ready', items }
}