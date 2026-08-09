/** Shared real-time voice WS protocol — mirrors backend/core/voice_session.py */

// client -> server (JSON text frames; audio is sent as raw binary frames, not JSON)
export type ClientAuthMsg = { type: 'auth'; token: string | null }
export type ClientBargeInMsg = { type: 'barge_in' }
export type ClientStopMsg = { type: 'stop' }
export type ClientPingMsg = { type: 'ping' }
export type ClientControlMsg = ClientAuthMsg | ClientBargeInMsg | ClientStopMsg | ClientPingMsg

// server -> client (JSON text frames; audio_chunk is raw binary frames, handled separately)
export type ServerAuthenticatedMsg = { type: 'authenticated' }
export type ServerAiTextDeltaMsg = { type: 'ai_text_delta'; text: string }
export type ServerAiQuestionMsg = { type: 'ai_question'; text: string }
export type ServerTranscriptPartialMsg = { type: 'transcript_partial'; text: string }
export type ServerTranscriptFinalMsg = { type: 'transcript_final'; text: string }
export type ServerStateMsg = { type: 'state'; state: 'ai_speaking' | 'listening' | 'candidate_speaking' | 'thinking' | 'reconnecting' | 'completed' }
export type ServerErrorMsg = { type: 'error'; detail: string }
export type ServerCompletedMsg = { type: 'completed'; report_ready: boolean }
export type ServerPongMsg = { type: 'pong' }

export type ServerControlMsg =
  | ServerAuthenticatedMsg | ServerAiTextDeltaMsg | ServerAiQuestionMsg
  | ServerTranscriptPartialMsg | ServerTranscriptFinalMsg | ServerStateMsg
  | ServerErrorMsg | ServerCompletedMsg | ServerPongMsg