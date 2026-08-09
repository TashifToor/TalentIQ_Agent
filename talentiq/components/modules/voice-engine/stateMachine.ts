/**
 * Voice interview state machine — deliberately transport-agnostic.
 * Today's push-to-talk UI and tomorrow's real-time (streaming STT/TTS,
 * barge-in) UI both drive the same six states through the same events,
 * so upgrading the transport later doesn't mean rewriting the UI logic.
 */

export type VoiceState =
    | 'ai_speaking'        // TTS is playing the interviewer's message
    | 'listening'          // mic is open / ready, waiting for the candidate to start
    | 'candidate_speaking' // candidate is actively talking (recording, in push-to-talk)
    | 'thinking'           // candidate's turn is finalized, waiting on STT+LLM
    | 'reconnecting'       // connection/mic issue, attempting recovery
    | 'completed'          // interview concluded

export type VoiceEvent =
    | { type: 'AI_MESSAGE_READY' }        // -> ai_speaking (TTS about to play)
    | { type: 'AI_FINISHED_SPEAKING' }    // -> listening
    | { type: 'CANDIDATE_STARTED' }       // -> candidate_speaking (tap-to-record, or VAD trigger later)
    | { type: 'CANDIDATE_FINISHED' }      // -> thinking (tap-to-stop, or silence-detected later)
    | { type: 'REPLY_READY' }             // -> ai_speaking (loop back)
    | { type: 'INTERVIEW_CONCLUDED' }     // -> completed
    | { type: 'CONNECTION_LOST' }         // -> reconnecting (from any non-terminal state)
    | { type: 'RECONNECTED', resumeTo: VoiceState } // -> resumeTo (back to where it left off)
    | { type: 'ERROR' }                   // -> listening (safe fallback — never strands the UI)

const TERMINAL_STATES: VoiceState[] = ['completed']

export function voiceReducer(state: VoiceState, event: VoiceEvent): VoiceState {
    if (TERMINAL_STATES.includes(state)) return state // completed is a true dead end

    // CONNECTION_LOST can interrupt any in-progress state
    if (event.type === 'CONNECTION_LOST') return 'reconnecting'

    switch (state) {
        case 'ai_speaking':
            if (event.type === 'AI_FINISHED_SPEAKING') return 'listening'
            return state

        case 'listening':
            if (event.type === 'CANDIDATE_STARTED') return 'candidate_speaking'
            if (event.type === 'AI_MESSAGE_READY') return 'ai_speaking' // opening message case
            return state

        case 'candidate_speaking':
            if (event.type === 'CANDIDATE_FINISHED') return 'thinking'
            if (event.type === 'ERROR') return 'listening'
            return state

        case 'thinking':
            if (event.type === 'REPLY_READY' || event.type === 'AI_MESSAGE_READY') return 'ai_speaking'
            if (event.type === 'INTERVIEW_CONCLUDED') return 'completed'
            if (event.type === 'ERROR') return 'listening'
            return state

        case 'reconnecting':
            if (event.type === 'RECONNECTED') return event.resumeTo
            return state

        default:
            return state
    }
}

export const VOICE_STATE_LABEL: Record<VoiceState, string> = {
    ai_speaking: 'Speaking',
    listening: 'Ready — tap to answer',
    candidate_speaking: 'Recording',
    thinking: 'Thinking...',
    reconnecting: 'Reconnecting...',
    completed: 'Complete',
}