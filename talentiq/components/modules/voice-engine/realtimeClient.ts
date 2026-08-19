'use client'
import { ClientControlMsg, ServerControlMsg } from './wsProtocol'
import { VoiceState } from './stateMachine'

const SAMPLE_RATE = 16000
const MAX_RECONNECT_ATTEMPTS = 3
const BARGE_IN_AMPLITUDE_THRESHOLD = 0.045   // tune against real mics/rooms — deliberately conservative to avoid false triggers
const BARGE_IN_SUSTAIN_MS = 220              // amplitude must stay above threshold this long before we call it real speech, not a cough/click

export interface RealtimeVoiceCallbacks {
  onState: (state: VoiceState) => void
  onTranscriptPartial: (text: string) => void
  onTranscriptFinal: (text: string) => void
  onAiTextDelta: (text: string) => void
  onAiQuestion: (text: string) => void
  onCompleted: (reportReady: boolean) => void
  onError: (detail: string) => void
  /** Fired when the connection can't be established/maintained after retries — caller should fall back to push-to-talk. */
  onFallback: () => void
}

/**
 * NOT using browser speechSynthesis on this path — audio comes from the
 * server (Cartesia) as raw PCM16 frames and is played via Web Audio API,
 * which is what makes instant playback cancellation (barge-in) possible.
 */
export class RealtimeVoiceClient {
  private ws: WebSocket | null = null
  private micStream: MediaStream | null = null
  private audioCtx: AudioContext | null = null
  private micProcessor: ScriptProcessorNode | null = null
  private micSource: MediaStreamAudioSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private analyserData: Uint8Array | null = null
  private bargeInRafId: number | null = null
  private bargeInAboveSince: number | null = null

  private playCtx: AudioContext | null = null
  private playQueue: AudioBufferSourceNode[] = []
  private nextPlayTime = 0

  private reconnectAttempts = 0
  private closedByCaller = false
  private currentState: VoiceState = 'listening'
  private muted = false

  constructor(private wsUrl: string, private token: string | null, private cb: RealtimeVoiceCallbacks) {}

  async connect(): Promise<void> {
    this.closedByCaller = false
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: SAMPLE_RATE } })
    } catch {
      this.cb.onError('Microphone permission denied.')
      this.cb.onFallback()
      return
    }
    this._openSocket()
  }

  private _openSocket() {
    this.ws = new WebSocket(this.wsUrl)
    this.ws.binaryType = 'arraybuffer'

    this.ws.onopen = () => {
      this._send({ type: 'auth', token: this.token })
    }

    this.ws.onmessage = (evt) => {
      if (evt.data instanceof ArrayBuffer) {
        this._playAudioChunk(evt.data)
        return
      }
      let msg: ServerControlMsg
      try { msg = JSON.parse(evt.data) } catch { return }
      this._handleServerMessage(msg)
    }

    this.ws.onclose = () => {
      if (this.closedByCaller) return
      this._attemptReconnect()
    }

    this.ws.onerror = () => {
      // onclose fires right after — reconnect handled there
    }
  }

  private _attemptReconnect() {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.cb.onError('Lost connection to the voice engine.')
      this._cleanupResources() // release mic/audio before the caller opens its own fallback stream
      this.cb.onFallback()
      return
    }
    this.reconnectAttempts++
    this._setState('reconnecting')
    const delay = 600 * this.reconnectAttempts
    setTimeout(() => { if (!this.closedByCaller) this._openSocket() }, delay)
  }

  private _handleServerMessage(msg: ServerControlMsg) {
    switch (msg.type) {
      case 'authenticated':
        this.reconnectAttempts = 0
        this._startMicStreaming()
        break
      case 'state':
        this._setState(msg.state)
        break
      case 'transcript_partial':
        this.cb.onTranscriptPartial(msg.text)
        break
      case 'transcript_final':
        this.cb.onTranscriptFinal(msg.text)
        break
      case 'ai_text_delta':
        this.cb.onAiTextDelta(msg.text)
        break
      case 'ai_question':
        this.cb.onAiQuestion(msg.text)
        break
      case 'completed':
        this.cb.onCompleted(msg.report_ready)
        this.disconnect()
        break
      case 'error':
        this.cb.onError(msg.detail)
        break
    }
  }

  private _setState(state: VoiceState) {
    this.currentState = state
    this.cb.onState(state)
    if (state === 'ai_speaking') this._armBargeInDetection()
    else this._disarmBargeInDetection()
  }

  // ── mic capture → binary WS frames ──────────────────────────

  private _startMicStreaming() {
    if (!this.micStream) return
    this.audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE })
    this.micSource = this.audioCtx.createMediaStreamSource(this.micStream)

    // ScriptProcessorNode is deprecated but universally supported and needs
    // no separately-served worklet file — pragmatic choice here; migrating
    // to AudioWorkletNode is the natural next step for main-thread perf.
    this.micProcessor = this.audioCtx.createScriptProcessor(4096, 1, 1)
    this.micProcessor.onaudioprocess = (e) => {
      const float32 = e.inputBuffer.getChannelData(0)
      const pcm16 = new Int16Array(float32.length)
      for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]))
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
      }
      if (this.ws?.readyState === WebSocket.OPEN && !this.muted) {
        this.ws.send(pcm16.buffer)
      }
    }
    this.micSource.connect(this.micProcessor)
    this.micProcessor.connect(this.audioCtx.destination) // required by some browsers to keep the node alive; output is not audible (mic passthrough would be, but we don't route to speakers)

    // Separate analyser tap for barge-in amplitude detection
    this.analyser = this.audioCtx.createAnalyser()
    this.analyser.fftSize = 512
    this.analyserData = new Uint8Array(this.analyser.frequencyBinCount)
    this.micSource.connect(this.analyser)
  }

  // ── barge-in: watch mic amplitude while AI is speaking ──────

  private _armBargeInDetection() {
    if (this.bargeInRafId != null || !this.analyser || !this.analyserData) return
    this.bargeInAboveSince = null
    const tick = () => {
      if (this.currentState !== 'ai_speaking' || !this.analyser || !this.analyserData) {
        this.bargeInRafId = null
        return
      }
      if (this.muted) {
        // Keep the loop alive (so unmuting mid-AI-speech resumes detection
        // instantly) but don't evaluate amplitude while muted — a muted
        // candidate's mic noise shouldn't be able to interrupt the AI.
        this.bargeInAboveSince = null
        this.bargeInRafId = requestAnimationFrame(tick)
        return
      }
      this.analyser.getByteTimeDomainData(this.analyserData as Uint8Array<ArrayBuffer>)
      let sumSquares = 0
      for (let i = 0; i < this.analyserData.length; i++) {
        const v = (this.analyserData[i] - 128) / 128
        sumSquares += v * v
      }
      const rms = Math.sqrt(sumSquares / this.analyserData.length)

      if (rms > BARGE_IN_AMPLITUDE_THRESHOLD) {
        if (this.bargeInAboveSince == null) this.bargeInAboveSince = performance.now()
        else if (performance.now() - this.bargeInAboveSince > BARGE_IN_SUSTAIN_MS) {
          this._triggerBargeIn()
          return
        }
      } else {
        this.bargeInAboveSince = null
      }
      this.bargeInRafId = requestAnimationFrame(tick)
    }
    this.bargeInRafId = requestAnimationFrame(tick)
  }

  private _disarmBargeInDetection() {
    if (this.bargeInRafId != null) {
      cancelAnimationFrame(this.bargeInRafId)
      this.bargeInRafId = null
    }
    this.bargeInAboveSince = null
  }

  private _triggerBargeIn() {
    this._stopPlaybackImmediately()
    this._send({ type: 'barge_in' })
    this._disarmBargeInDetection()
  }

  // ── playback (Web Audio API, not speechSynthesis) ───────────

  private _playAudioChunk(buf: ArrayBuffer) {
    if (!this.playCtx) {
      this.playCtx = new AudioContext({ sampleRate: SAMPLE_RATE })
      this.nextPlayTime = this.playCtx.currentTime
    }
    const pcm16 = new Int16Array(buf)
    const float32 = new Float32Array(pcm16.length)
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7fff)

    const audioBuffer = this.playCtx.createBuffer(1, float32.length, SAMPLE_RATE)
    audioBuffer.copyToChannel(float32, 0)

    const source = this.playCtx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(this.playCtx.destination)

    const startAt = Math.max(this.nextPlayTime, this.playCtx.currentTime)
    source.start(startAt)
    this.nextPlayTime = startAt + audioBuffer.duration
    this.playQueue.push(source)
    source.onended = () => { this.playQueue = this.playQueue.filter(s => s !== source) }
  }

  private _stopPlaybackImmediately() {
    for (const source of this.playQueue) {
      try { source.stop() } catch { /* already stopped */ }
    }
    this.playQueue = []
    if (this.playCtx) this.nextPlayTime = this.playCtx.currentTime
  }

  // ── lifecycle ────────────────────────────────────────────────

  setMuted(muted: boolean) {
    this.muted = muted
  }

  isMuted(): boolean {
    return this.muted
  }

  private _send(msg: ClientControlMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg))
  }

  disconnect() {
    this.closedByCaller = true
    try { this._send({ type: 'stop' }) } catch { /* noop */ }
    this.ws?.close()
    this.ws = null
    this._cleanupResources()
  }

  private _cleanupResources() {
    this._disarmBargeInDetection()
    this._stopPlaybackImmediately()
    this.micProcessor?.disconnect()
    this.micSource?.disconnect()
    this.analyser?.disconnect()
    this.micProcessor = null
    this.micSource = null
    this.analyser = null
    this.audioCtx?.close().catch(() => {})
    this.playCtx?.close().catch(() => {})
    this.audioCtx = null
    this.playCtx = null
    this.micStream?.getTracks().forEach(t => t.stop())
    this.micStream = null
  }
}