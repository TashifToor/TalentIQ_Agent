import { InterviewMode } from './modeData'

export interface AssessmentCounts {
  dsa: number
  job_desc: number
  problem_solving: number
  teamwork: number
  hr: number
}

export interface BuilderFormData {
  title: string
  company: string
  jd: string
  extraQuestions: string
  interviewerName: string
  mode: InterviewMode
  assessmentSource: 'ai' | 'bank'
  assessmentCounts: AssessmentCounts
  secondsPerQuestion: number
  notifyOnCompletion: boolean
  assessmentBankText: string
}

export const DEFAULT_FORM_DATA: BuilderFormData = {
  title: '', company: '', jd: '', extraQuestions: '', interviewerName: '',
  mode: 'chatbot',
  assessmentSource: 'ai',
  assessmentCounts: { dsa: 5, job_desc: 5, problem_solving: 4, teamwork: 3, hr: 3 },
  secondsPerQuestion: 60,
  notifyOnCompletion: true,
  assessmentBankText: '',
}

export function parseBankText(text: string): { question: string; options: string[]; correct_index: number; topic?: string }[] {
  // One question per block, blank line between blocks:
  //   Question text?
  //   A) option
  //   B) option
  //   C) option
  //   D) option
  //   Correct: B
  const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)
  const parsed: { question: string; options: string[]; correct_index: number; topic?: string }[] = []
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 6) continue
    const question = lines[0]
    const options = lines.slice(1, 5).map(l => l.replace(/^[A-Da-d][).\-:]\s*/, ''))
    const correctLine = lines.find(l => /^correct/i.test(l))
    const letter = correctLine?.match(/[A-Da-d]/)?.[0]?.toUpperCase()
    const correct_index = letter ? letter.charCodeAt(0) - 65 : -1
    if (options.length === 4 && correct_index >= 0 && correct_index <= 3) {
      parsed.push({ question, options, correct_index })
    }
  }
  return parsed
}