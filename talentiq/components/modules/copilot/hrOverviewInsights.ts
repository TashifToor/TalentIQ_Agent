import { CopilotResult, StatTile, VerdictMixEntry } from './types'

export interface HROverviewInput {
  postings: { id: string; candidateCount: number; isActive: boolean }[]
  completedInterviews: { final_verdict?: string | null; ai_score?: number | null; assessment_score?: number | null }[]
  bulkCandidates: { ai_score: number; final_verdict?: string | null }[]
  orgMembersCount: number | null   // null = no Team Workspace set up at all
  shortlistedCount: number
}

function avg(nums: number[]): number | null {
  const vals = nums.filter(n => n != null)
  return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
}

export function getHROverviewInsights(input: HROverviewInput): CopilotResult {
  const { postings, completedInterviews, bulkCandidates, orgMembersCount, shortlistedCount } = input
  const items: CopilotResult['items'] = []

  const totalPostingCandidates = postings.reduce((s, p) => s + p.candidateCount, 0)
  const pendingReviews = Math.max(0, totalPostingCandidates - completedInterviews.length)
  const candidatesEvaluated = completedInterviews.length + bulkCandidates.length
  const avgAssessment = avg(completedInterviews.map(c => c.assessment_score ?? c.ai_score).filter((n): n is number => n != null))

  // ── Hiring Overview — real, aggregated from postings + interview + bulk data ──
  if (candidatesEvaluated > 0 || postings.length > 0) {
    const tiles: StatTile[] = [
      { label: 'Candidates Evaluated', value: String(candidatesEvaluated) },
      { label: 'Interviews Completed', value: String(completedInterviews.length) },
      { label: 'Pending Reviews', value: String(pendingReviews) },
      { label: 'Avg. Score', value: avgAssessment != null ? String(avgAssessment) : '—' },
    ]
    items.push({
      id: 'hiring_overview', label: 'Hiring Overview', icon: '📊', status: 'available',
      content: tiles.map(t => `${t.label}: ${t.value}`).join(' · '), data: tiles,
    })
  } else {
    items.push({ id: 'hiring_overview', label: 'Hiring Overview', icon: '📊', status: 'empty', emptyReason: 'No activity yet', content: 'Create an interview link or run a bulk screening to see hiring activity here.' })
  }

  // ── Hiring Pipeline — real, from active interview postings ──
  if (postings.length > 0) {
    const activeLinks = postings.filter(p => p.isActive).length
    items.push({
      id: 'pipeline', label: 'Hiring Pipeline', icon: '🧭', status: 'available',
      content: `${activeLinks} active interview link${activeLinks === 1 ? '' : 's'} · ${totalPostingCandidates} candidate${totalPostingCandidates === 1 ? '' : 's'} in the pipeline.`,
    })
  } else {
    items.push({ id: 'pipeline', label: 'Hiring Pipeline', icon: '🧭', status: 'empty', emptyReason: 'No interview links created yet', content: 'Create an AI Interviewer link to start a pipeline.' })
  }

  // ── Candidate Review — real, pending count ──
  if (totalPostingCandidates > 0) {
    items.push({
      id: 'candidate_review_stat', label: 'Candidate Review', icon: '🔍', status: pendingReviews > 0 ? 'available' : 'available',
      content: pendingReviews > 0 ? `${pendingReviews} candidate${pendingReviews === 1 ? '' : 's'} awaiting review.` : 'All evaluated candidates have been reviewed.',
    })
  } else {
    items.push({ id: 'candidate_review_stat', label: 'Candidate Review', icon: '🔍', status: 'empty', emptyReason: 'No candidates yet', content: 'Nothing to review yet.' })
  }

  // ── Interview Activity — real, completed interview count ──
  if (completedInterviews.length > 0) {
    items.push({
      id: 'interview_activity', label: 'Interview Activity', icon: '🎙', status: 'available',
      content: `${completedInterviews.length} interview${completedInterviews.length === 1 ? '' : 's'} completed across all postings.`,
    })
  } else {
    items.push({ id: 'interview_activity', label: 'Interview Activity', icon: '🎙', status: 'empty', emptyReason: 'No completed interviews yet', content: 'Completed interviews will show activity here.' })
  }

  // ── Team Collaboration — real, from Team Workspace org data ──
  if (orgMembersCount != null) {
    items.push({
      id: 'team_collaboration', label: 'Team Collaboration', icon: '👥', status: 'available',
      content: `${orgMembersCount} teammate${orgMembersCount === 1 ? '' : 's'} in your Team Workspace.`,
    })
  } else {
    items.push({ id: 'team_collaboration', label: 'Team Collaboration', icon: '👥', status: 'empty', emptyReason: 'No Team Workspace set up', content: 'Set up a Team Workspace to collaborate with teammates on hiring.' })
  }

  // ── Hiring Decisions — real, verdict breakdown from completed interviews ──
  const verdictCounts: Record<string, number> = {}
  completedInterviews.forEach(c => { if (c.final_verdict) verdictCounts[c.final_verdict] = (verdictCounts[c.final_verdict] || 0) + 1 })
  const verdictMix: VerdictMixEntry[] = Object.entries(verdictCounts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
  if (verdictMix.length > 0) {
    items.push({
      id: 'hiring_decisions', label: 'Hiring Decisions', icon: '🏁', status: 'available',
      content: verdictMix.map(v => `${v.label}: ${v.count}`).join(' · '), data: verdictMix,
    })
  } else {
    items.push({
      id: 'hiring_decisions', label: 'Hiring Decisions', icon: '🏁', status: 'empty',
      emptyReason: 'No verdicts yet', content: shortlistedCount > 0 ? `${shortlistedCount} candidate${shortlistedCount === 1 ? '' : 's'} shortlisted from bulk screening.` : 'Decisions will appear here once interviews are scored.',
    })
  }

  // ── Screen Candidates — real, from bulk screening results ──
  if (bulkCandidates.length > 0) {
    const strong = bulkCandidates.filter(c => c.ai_score >= 70).length
    const needsReview = bulkCandidates.filter(c => c.ai_score >= 45 && c.ai_score < 70).length
    const weak = bulkCandidates.filter(c => c.ai_score < 45).length
    items.push({
      id: 'bulk_screening', label: 'Screen Candidates', icon: '🗂', status: 'available',
      content: `${bulkCandidates.length} screened · ${strong} strong match${strong === 1 ? '' : 'es'} · ${needsReview} need review · ${weak} weak match${weak === 1 ? '' : 'es'}.`,
      data: [
        { label: 'Screened', value: String(bulkCandidates.length) },
        { label: 'Strong Matches', value: String(strong) },
        { label: 'Needs Review', value: String(needsReview) },
        { label: 'Weak Matches', value: String(weak) },
      ] as StatTile[],
    })
  } else {
    items.push({ id: 'bulk_screening', label: 'Screen Candidates', icon: '🗂', status: 'empty', emptyReason: 'No bulk screening run yet', content: 'Run a bulk screening to see match strength across candidates here.' })
  }

  return { state: 'ready', items }
}