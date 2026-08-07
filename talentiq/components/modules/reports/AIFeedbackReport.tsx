'use client'
import { GlassCard, ProgressRing, EmptyState, GradientBadge } from '@/components/shared/primitives'

/**
 * Shaped after the REAL backend InterviewSessionReport schema
 * (backend/schemas/interview.py) — every field here can come straight
 * off that response. Nothing in this component invents a score or
 * suggestion; sections with no backing field render an EmptyState.
 */
export interface AIFeedbackData {
  ai_score?: number | null                          // real — chatbot/voice interview score
  assessment_score?: number | null                  // real — MCQ overall %
  assessment_breakdown?: Record<string, { correct: number; total: number }> | null  // real — per-category MCQ (dsa/job_desc/problem_solving/teamwork/hr)
  final_verdict?: string | null                      // real
  experience_assessment?: string | null              // real — AI's written take on experience level
  deep_analysis?: string | null                       // real — AI's full written analysis
  // Optional resume-match data, shaped like screenCandidate()'s response — pass only if you actually ran it
  resumeMatch?: { score: number; matched: string[]; missing: string[] } | null
}

const CATEGORY_LABEL: Record<string, string> = {
  dsa: 'DSA', job_desc: 'Job-Specific', problem_solving: 'Problem Solving', teamwork: 'Teamwork', hr: 'HR / Behavioral',
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <GlassCard style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{title}</span>
      </div>
      {children}
    </GlassCard>
  )
}

export default function AIFeedbackReport({ data }: { data: AIFeedbackData }) {
  const overallScore = data.ai_score ?? data.assessment_score ?? null
  const breakdown = data.assessment_breakdown || null
  const hasBreakdown = breakdown && Object.keys(breakdown).length > 0

  return (
    <div>
      {/* Overall Performance — real, when either score exists */}
      <SectionCard title="Overall Performance" icon="🎯">
        {overallScore != null ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <ProgressRing value={overallScore} label="Score" accent={overallScore >= 70 ? '#13c28e' : overallScore >= 45 ? '#e2b04a' : '#ef4444'} />
            <div>
              {data.final_verdict && <GradientBadge label={data.final_verdict} tone={overallScore >= 70 ? 'teal' : 'gold'} />}
              {data.experience_assessment && <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)', lineHeight: 1.6, marginTop: 8 }}>{data.experience_assessment}</div>}
            </div>
          </div>
        ) : (
          <EmptyState icon="📊" title="No score yet" description="Complete an interview or assessment to see performance here." />
        )}
      </SectionCard>

      {/* Technical / Problem Solving / Behavioral — real, only for MCQ mode with a breakdown */}
      <SectionCard title="Skill Breakdown" icon="🧩">
        {hasBreakdown ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {Object.entries(breakdown!).map(([cat, stat]) => {
              const pct = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0
              return (
                <div key={cat} style={{ background: '#161614', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.4)', marginBottom: 4 }}>{CATEGORY_LABEL[cat] || cat}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: pct >= 70 ? '#13c28e' : pct >= 45 ? '#e2b04a' : '#ef4444' }}>{pct}%</div>
                  <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.3)' }}>{stat.correct}/{stat.total} correct</div>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState icon="🧩" title="Category breakdown unavailable" description="Only MCQ Assessment mode reports a per-category skill breakdown right now." />
        )}
      </SectionCard>

      {/* Communication — no backend field exists yet for this at all */}
      <SectionCard title="Communication" icon="💬">
        <EmptyState icon="🎙" title="Coming with Voice/Chat analysis" description="Tone, clarity, and articulation scoring will appear here once the interview engine adds communication analysis." />
      </SectionCard>

      {/* Resume Match — real, only if the caller actually ran screenCandidate() and passed it */}
      <SectionCard title="Resume Match" icon="📄">
        {data.resumeMatch ? (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{data.resumeMatch.score}% match</div>
            {data.resumeMatch.missing.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {data.resumeMatch.missing.map(s => (
                  <span key={s} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 100, background: 'rgba(239,68,68,.1)', color: '#f87171' }}>{s}</span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <EmptyState icon="📄" title="No resume comparison run" description="Run CV Optimizer against this JD to see a real resume-match score here." />
        )}
      </SectionCard>

      {/* AI's actual written analysis, verbatim — real when present */}
      {data.deep_analysis ? (
        <SectionCard title="Strengths & Areas to Improve" icon="✦">
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.65)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{data.deep_analysis}</div>
        </SectionCard>
      ) : (
        <SectionCard title="Strengths & Areas to Improve" icon="✦">
          <EmptyState icon="✦" title="Analysis pending" description="A written strengths/improvement breakdown appears here once an interview is scored." />
        </SectionCard>
      )}

      {/* Suggested Learning Path — no backend source exists at all (this is Copilot territory) */}
      <SectionCard title="Suggested Learning Path" icon="🧭">
        <EmptyState icon="🧭" title="Coming with the Hiring Copilot" description="Personalized learning recommendations based on skill gaps will appear here once the Copilot ships." />
      </SectionCard>
    </div>
  )
}