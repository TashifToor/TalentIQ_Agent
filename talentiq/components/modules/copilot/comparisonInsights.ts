import { api } from '@/lib/api'
import { CATEGORY_LABEL } from './candidateInsights'

/**
 * Lazy, on-demand deep comparison — only fetched when the HR user actually
 * expands "Compare with other candidates" in the Copilot. Uses the existing
 * getInterviewSessionReport endpoint (real, already used for the report view)
 * once per peer. No new backend endpoint required.
 */
export interface PeerBreakdown {
  id: string
  name: string
  score: number | null
  verdict: string | null
  breakdown: Record<string, { correct: number; total: number }> | null
  topStrength: { label: string; pct: number } | null
  topConcern: { label: string; pct: number } | null
}

function topFrom(breakdown: Record<string, { correct: number; total: number }> | null | undefined, want: 'high' | 'low') {
  if (!breakdown) return null
  const entries = Object.entries(breakdown)
    .filter(([, s]) => s.total > 0)
    .map(([cat, s]) => ({ label: CATEGORY_LABEL[cat] || cat, pct: Math.round((s.correct / s.total) * 100) }))
    .sort((a, b) => want === 'high' ? b.pct - a.pct : a.pct - b.pct)
  return entries[0] || null
}

export async function fetchPeerBreakdowns(peers: { id: string; name: string; score: number | null }[]): Promise<PeerBreakdown[]> {
  const results = await Promise.all(peers.map(async (p) => {
    try {
      const report: any = await api.getInterviewSessionReport(p.id)
      return {
        id: p.id, name: p.name, score: p.score,
        verdict: report?.final_verdict || null,
        breakdown: report?.assessment_breakdown || null,
        topStrength: topFrom(report?.assessment_breakdown, 'high'),
        topConcern: topFrom(report?.assessment_breakdown, 'low'),
      } as PeerBreakdown
    } catch {
      return { id: p.id, name: p.name, score: p.score, verdict: null, breakdown: null, topStrength: null, topConcern: null } as PeerBreakdown
    }
  }))
  return results
}