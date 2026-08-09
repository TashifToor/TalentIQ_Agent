"""
Provider interfaces for the voice engine — backend side, mirrors
frontend/components/modules/voice-engine/providers.ts.

Two tiers, deliberately kept separate:
  - Batch tier: what actually works today (wraps core.voice.transcribe_audio).
  - Streaming tier: the shape AssemblyAI/Cartesia will implement once wired
    up. Defined now so routes can be written against a stable interface,
    but NOT implemented — the stub classes raise clearly instead of
    pretending to stream.
"""
from typing import Protocol, AsyncIterator

from core.voice import transcribe_audio


# ── Batch tier — real, working today ────────────────────────────

class SttProvider(Protocol):
    def transcribe(self, audio_bytes: bytes, filename: str) -> str: ...


class BatchWhisperSttProvider:
    """Real, working default — wraps the existing Groq Whisper batch call. Used by both recruiter and practice /transcribe endpoints today."""
    def transcribe(self, audio_bytes: bytes, filename: str) -> str:
        return transcribe_audio(audio_bytes, filename=filename)


# ── Streaming tier — interfaces only, NOT implemented ───────────

class StreamingSttProvider(Protocol):
    """A real implementation streams partial + final transcripts as audio arrives, over a persistent connection (WebSocket)."""
    async def stream(self, audio_chunks: AsyncIterator[bytes]) -> AsyncIterator[dict]:
        """Yields {"type": "partial"|"final", "text": str} events."""
        ...


class StreamingTtsProvider(Protocol):
    """A real implementation streams synthesized audio chunks as text arrives, and supports mid-stream cancellation for barge-in."""
    async def synthesize(self, text_chunks: AsyncIterator[str]) -> AsyncIterator[bytes]:
        """Yields raw audio chunks (format TBD per provider, e.g. PCM/Opus)."""
        ...

    async def cancel(self) -> None:
        """Must actually stop in-flight synthesis — this is what makes barge-in possible."""
        ...


class AssemblyAiStreamingSttProvider:
    """
    NOT IMPLEMENTED. Requires ASSEMBLYAI_API_KEY and a WebSocket endpoint
    that relays browser mic audio to AssemblyAI's streaming API and relays
    partial/final events back. See voice architecture notes.
    """
    async def stream(self, audio_chunks):
        raise NotImplementedError(
            "AssemblyAI streaming STT is not wired up yet — needs a WebSocket relay endpoint + ASSEMBLYAI_API_KEY. "
            "Use BatchWhisperSttProvider until this is built."
        )
        yield  # pragma: no cover — keeps this a valid async generator signature


class CartesiaStreamingTtsProvider:
    """
    NOT IMPLEMENTED. Requires CARTESIA_API_KEY and a WebSocket endpoint
    that streams synthesized audio back to the client as text arrives from
    the LLM. See voice architecture notes.
    """
    async def synthesize(self, text_chunks):
        raise NotImplementedError(
            "Cartesia streaming TTS is not wired up yet — needs a WebSocket relay endpoint + CARTESIA_API_KEY. "
            "The client falls back to browser SpeechSynthesis until this is built."
        )
        yield  # pragma: no cover

    async def cancel(self) -> None:
        raise NotImplementedError("Cartesia streaming TTS is not wired up yet.")