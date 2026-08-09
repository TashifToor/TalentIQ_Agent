"""
Provider interfaces + REAL implementations for the real-time voice engine.
Mirrors frontend/components/modules/voice-engine/providers.ts.

Two tiers:
  - Batch (BatchWhisperSttProvider): existing, working, used by the REST
    /transcribe fallback endpoints — unchanged.
  - Streaming (AssemblyAIStreamingSttProvider, CartesiaStreamingTtsProvider):
    real WebSocket connections to AssemblyAI Universal-Streaming v3 and
    Cartesia Sonic, implemented directly against their documented wire
    protocols (raw `websockets` client, not the vendor SDKs) so this stays
    a small, auditable, swappable surface. Field names follow each
    vendor's current public docs as of this writing — verify against
    live docs if either vendor changes their protocol.
"""
import asyncio
import base64
import json
import os
import uuid
from typing import AsyncIterator, Callable, Optional
from urllib.parse import urlencode

import websockets

from core.voice import transcribe_audio

ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")
CARTESIA_API_KEY = os.getenv("CARTESIA_API_KEY")
CARTESIA_VOICE_ID = os.getenv("CARTESIA_VOICE_ID", "e07c00bc-4134-4eae-9ea4-1a55fb45746b")  # swap for your chosen Cartesia voice
CARTESIA_MODEL_ID = os.getenv("CARTESIA_MODEL_ID", "sonic-2")

ASSEMBLYAI_WS_URL = "wss://streaming.assemblyai.com/v3/ws"
CARTESIA_WS_URL = "wss://api.cartesia.ai/tts/websocket"
CARTESIA_VERSION = "2024-06-10"


# ── Batch tier — unchanged, real, used by REST fallback ─────────

class BatchWhisperSttProvider:
    def transcribe(self, audio_bytes: bytes, filename: str) -> str:
        return transcribe_audio(audio_bytes, filename=filename)


# ── Streaming tier — real WebSocket connections ─────────────────

class AssemblyAIStreamingSttProvider:
    """
    One AssemblyAI Universal-Streaming v3 session. Feed raw PCM16 mono
    16kHz audio via `send_audio()`; consume `events()` for partial/final
    transcripts. Wire protocol: wss://streaming.assemblyai.com/v3/ws,
    binary audio frames in, JSON Begin/Turn/Termination messages out.
    """
    def __init__(self, sample_rate: int = 16000):
        if not ASSEMBLYAI_API_KEY:
            raise RuntimeError("ASSEMBLYAI_API_KEY is not set — streaming STT unavailable.")
        self.sample_rate = sample_rate
        self._ws: Optional[websockets.WebSocketClientProtocol] = None

    async def connect(self) -> "AssemblyAIStreamingSttProvider":
        params = urlencode({"sample_rate": self.sample_rate, "format_turns": "true"})
        self._ws = await websockets.connect(
            f"{ASSEMBLYAI_WS_URL}?{params}",
            additional_headers={"Authorization": ASSEMBLYAI_API_KEY},
            ping_interval=15,
        )
        return self

    async def send_audio(self, pcm16_bytes: bytes) -> None:
        if self._ws is not None and pcm16_bytes:
            await self._ws.send(pcm16_bytes)

    async def events(self) -> AsyncIterator[dict]:
        """Yields {"type": "begin"|"partial"|"final"|"terminated", ...}."""
        if self._ws is None:
            return
        async for raw in self._ws:
            if isinstance(raw, (bytes, bytearray)):
                continue  # AssemblyAI doesn't send binary frames back — ignore defensively
            try:
                msg = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                continue
            mtype = msg.get("type")
            if mtype == "Begin":
                yield {"type": "begin", "id": msg.get("id")}
            elif mtype == "Turn":
                text = msg.get("transcript", "")
                if text:
                    yield {"type": "final" if msg.get("end_of_turn") else "partial", "text": text}
            elif mtype == "Termination":
                yield {"type": "terminated"}
                return

    async def close(self) -> None:
        if self._ws is not None:
            try:
                await self._ws.send(json.dumps({"type": "Terminate"}))
            except Exception:
                pass
            try:
                await self._ws.close()
            except Exception:
                pass
            self._ws = None


class CartesiaStreamingTtsProvider:
    """
    One Cartesia Sonic streaming synthesis context. `speak()` sends a text
    chunk (call repeatedly as LLM tokens/sentences arrive; pass
    is_final_chunk=True on the last one); `audio_chunks()` yields raw
    PCM16 bytes as they're synthesized; `cancel()` stops synthesis
    immediately — the barge-in primitive.
    """
    def __init__(self, sample_rate: int = 16000):
        if not CARTESIA_API_KEY:
            raise RuntimeError("CARTESIA_API_KEY is not set — streaming TTS unavailable.")
        self.sample_rate = sample_rate
        self.context_id = str(uuid.uuid4())
        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._cancelled = False

    async def connect(self) -> "CartesiaStreamingTtsProvider":
        params = urlencode({"api_key": CARTESIA_API_KEY, "cartesia_version": CARTESIA_VERSION})
        self._ws = await websockets.connect(f"{CARTESIA_WS_URL}?{params}", ping_interval=15)
        return self

    async def speak(self, text: str, is_final_chunk: bool = True) -> None:
        if self._ws is None or self._cancelled or not text:
            return
        await self._ws.send(json.dumps({
            "context_id": self.context_id,
            "model_id": CARTESIA_MODEL_ID,
            "transcript": text,
            "voice": {"mode": "id", "id": CARTESIA_VOICE_ID},
            "output_format": {"container": "raw", "encoding": "pcm_s16le", "sample_rate": self.sample_rate},
            "continue": not is_final_chunk,
        }))

    async def audio_chunks(self) -> AsyncIterator[bytes]:
        if self._ws is None:
            return
        async for raw in self._ws:
            if self._cancelled:
                return
            if isinstance(raw, (bytes, bytearray)):
                continue
            try:
                msg = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                continue
            if msg.get("context_id") and msg["context_id"] != self.context_id:
                continue  # defensive — shouldn't happen, one context per connection here
            if msg.get("type") == "chunk" and msg.get("data"):
                yield base64.b64decode(msg["data"])
            elif msg.get("type") == "done":
                return
            elif msg.get("type") == "error":
                raise RuntimeError(f"Cartesia error: {msg.get('error')}")

    async def cancel(self) -> None:
        """Barge-in: stop this context's synthesis immediately. Caller should also stop forwarding
        already-buffered chunks to the client — this only stops the vendor from generating more."""
        self._cancelled = True
        if self._ws is not None:
            try:
                await self._ws.send(json.dumps({"context_id": self.context_id, "cancel": True}))
            except Exception:
                pass

    async def close(self) -> None:
        if self._ws is not None:
            try:
                await self._ws.close()
            except Exception:
                pass
            self._ws = None