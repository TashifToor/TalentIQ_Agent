import { CopilotResult } from './types'
import { AIFeedbackData } from '../reports/AIFeedbackReport'

const CATEGORY_LABEL: Record<string, string> = {
  dsa: 'DSA', job_desc: 'Job-Specific', problem_solving: 'Problem Solving', teamwork: 'Teamwork', hr: 'HR / Behavioral',
}

export interface PeerCandidate { name: string; score: number | null }

export function getCandidateInsights(
  report: AIFeedbackData | null,
  candidateName?: string,
  peers?: PeerCandidate[],
): CopilotResult {
  if (!report) return { state: 'empty', items: [] }

  const items: CopilotResult['items'] = []

  // Summary — real, verbatim from the model's own written output
  const summaryText = report.experience_assessment || report.deep_analysis
  items.push(summaryText
    ? { id: 'summary', label: 'Interview Summary', icon: '📝', status: 'available', content: summaryText }
    : { id: 'summary', label: 'Interview Summary', icon: '📝', status: 'coming_soon' })

  // Strengths / Concerns — derived from real assessment_breakdown percentages
  const breakdown = report.assessment_breakdown
  if (breakdown && Object.keys(breakdown).length > 0) {
    const scored = Object.entries(breakdown)
      .filter(([, s]) => s.total > 0)
      .map(([cat, s]) => ({ cat, pct: Math.round((s.correct / s.total) * 100) }))
      .sort((a, b) => b.pct - a.pct)

    if (scored.length > 0) {
      const strong = scored[0]
      items.push({ id: 'strengths', label: 'Strengths', icon: '✅', status: 'available', content: `${CATEGORY_LABEL[strong.cat] || strong.cat} — ${strong.pct}% correct` })
      const weak = scored[scored.length - 1]
      items.push(weak.pct < 60
        ? { id: 'concerns', label: 'Concerns', icon: '⚠️', status: 'available', content: `${CATEGORY_LABEL[weak.cat] || weak.cat} — ${weak.pct}% correct` }
        : { id: 'concerns', label: 'Concerns', icon: '⚠️', status: 'available', content: 'No weak category detected — all above 60%.' })
    } else {
      items.push({ id: 'strengths', label: 'Strengths', icon: '✅', status: 'coming_soon' })
      items.push({ id: 'concerns', label: 'Concerns', icon: '⚠️', status: 'coming_soon' })
    }
  } else {
    items.push({ id: 'strengths', label: 'Strengths', icon: '✅', status: 'coming_soon' })
    items.push({ id: 'concerns', label: 'Concerns', icon: '⚠️', status: 'coming_soon' })
  }

  // Evidence — real proctoring flags, if any were actually recorded
  const flagCount = (report as any).assessment_flags?.length || 0
  items.push(flagCount > 0
    ? { id: 'evidence', label: 'Evidence for conclusions', icon: '🔗', status: 'available', content: `${flagCount} proctoring flag${flagCount > 1 ? 's' : ''} recorded during the session.` }
    : { id: 'evidence', label: 'Evidence for conclusions', icon: '🔗', status: 'available', content: 'No proctoring flags recorded.' })

  // Hiring recommendation — real, straight from the backend's final_verdict
  items.push(report.final_verdict
    ? { id: 'recommendation', label: 'Hiring Recommendation', icon: '🏁', status: 'available', content: report.final_verdict }
    : { id: 'recommendation', label: 'Hiring Recommendation', icon: '🏁', status: 'coming_soon' })

  // Compare with other candidates — real ranking by score, only if peer scores were actually passed in
  if (peers && peers.filter(p => p.score != null).length > 1 && candidateName) {
    const ranked = peers.filter(p => p.score != null).sort((a, b) => (b.score as number) - (a.score as number))
    const rank = ranked.findIndex(p => p.name === candidateName)
    items.push(rank >= 0
      ? { id: 'compare', label: 'Compare with other candidates', icon: '⚖️', status: 'available', content: `Ranked #${rank + 1} of ${ranked.length} candidates by score.` }
      : { id: 'compare', label: 'Compare with other candidates', icon: '⚖️', status: 'coming_soon' })
  } else {
    items.push({ id: 'compare', label: 'Compare with other candidates', icon: '⚖️', status: 'coming_soon' })
  }

  return { state: 'ready', items }
}