/**
 * Provider interfaces for the voice engine. Two tiers, deliberately kept
 * separate:
 *   - Batch tier (TtsProvider / SttProvider): what actually works today.
 *   - Streaming tier (StreamingTtsProvider / StreamingSttProvider): the
 *     shape real-time providers (Cartesia, AssemblyAI) will implement —
 *     defined now so the state machine and UI can be built against a
 *     stable contract, but NOT implemented yet. Calling the stub classes
 *     below throws clearly instead of pretending to stream.
 */

// ── Batch tier — real, working today ────────────────────────────

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

/** Real, working default — browser-native SpeechSynthesis. What both voice UIs use today. */
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

// ── Streaming tier — interfaces only, NOT implemented ───────────

export interface StreamingSttHandle {
  onPartial(cb: (text: string) => void): void
  onFinal(cb: (text: string) => void): void
  stop(): void
}

export interface StreamingSttProvider {
  /** Starts streaming mic audio to the provider; resolves once the stream is live. */
  start(stream: MediaStream): Promise<StreamingSttHandle>
}

export interface StreamingTtsHandle {
  onAudioStart(cb: () => void): void
  onDone(cb: () => void): void
  /** Must actually cancel in-flight synthesis/playback — this is what makes barge-in possible. */
  stop(): void
}

export interface StreamingTtsProvider {
  speak(text: string): Promise<StreamingTtsHandle>
}

/**
 * NOT IMPLEMENTED. Requires: a backend WebSocket relay (ASSEMBLYAI_API_KEY
 * server-side, browser never talks to AssemblyAI directly), continuous mic
 * capture, and VAD-based turn detection. See voice architecture notes.
 */
export class AssemblyAiStreamingSttProvider implements StreamingSttProvider {
  async start(): Promise<StreamingSttHandle> {
    throw new Error('AssemblyAI streaming STT is not wired up yet — needs a backend WS relay endpoint + ASSEMBLYAI_API_KEY. Falls back to BatchSttProvider until then.')
  }
}

/**
 * NOT IMPLEMENTED. Requires: a backend WebSocket relay (CARTESIA_API_KEY
 * server-side), and a client-side Web Audio API streaming player that can
 * be stopped instantly for barge-in. See voice architecture notes.
 */
export class CartesiaStreamingTtsProvider implements StreamingTtsProvider {
  async speak(): Promise<StreamingTtsHandle> {
    throw new Error('Cartesia streaming TTS is not wired up yet — needs a backend WS relay endpoint + CARTESIA_API_KEY. Falls back to BrowserTtsProvider until then.')
  }
}