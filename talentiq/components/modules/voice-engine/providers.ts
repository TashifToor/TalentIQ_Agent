/**
 * Provider interfaces for the voice engine's batch tier — real, working
 * push-to-talk fallback (browser TTS + batch STT). The real-time streaming
 * path (AssemblyAI + Cartesia) is implemented directly in realtimeClient.ts
 * (browser) and core/voice_session.py + core/voice_providers.py (backend) —
 * it doesn't go through a separate interface here, since the WS protocol
 * itself is the contract between them.
 */

export interface TtsPlayback {
  stop(): void
  onDone(cb: () => void): void
}

export interface TtsProvider {
  speak(text: string): TtsPlayback
}

export interface SttResult { text: string }

export interface SttProvider {
  transcribe(blob: Blob): Promise<SttResult>
}

/** Real, working default — browser-native SpeechSynthesis. Used by the push-to-talk fallback UI. */
export class BrowserTtsProvider implements TtsProvider {
  speak(text: string): TtsPlayback {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return { stop: () => {}, onDone: cb => cb() }
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    let doneCb: (() => void) | null = null
    utterance.onend = () => doneCb?.()
    utterance.onerror = () => doneCb?.()
    window.speechSynthesis.speak(utterance)
    return {
      stop: () => window.speechSynthesis.cancel(),
      onDone: cb => { doneCb = cb },
    }
  }
}

/** Real, working default — wraps whichever batch transcribe endpoint the caller passes in (practice or recruiter). */
export class BatchSttProvider implements SttProvider {
  constructor(private transcribeFn: (blob: Blob) => Promise<{ text: string }>) {}
  async transcribe(blob: Blob): Promise<SttResult> {
    return this.transcribeFn(blob)
  }
}