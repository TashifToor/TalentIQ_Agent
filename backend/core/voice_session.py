"""
Shared real-time voice orchestrator — one VoiceSession instance per live
WebSocket connection. Domain-agnostic: identical code path for a
candidate PracticeSession or a recruiter InterviewSession. The route
supplies interview parameters plus two persistence callbacks so this
module never touches either domain's DB models directly:

    on_turn(transcript, turn_count) -> None
        called after every candidate+AI exchange (mid-interview save)
    on_conclude(transcript) -> dict | None
        called once, when the interview concludes — return value is
        whatever the domain wants to report back (or None)

Reuses core.interviewer.stream_next_turn exactly as the SSE endpoints do,
so the transcript produced here is the same shape generate_report()
already consumes — recruiter and practice report generation are
untouched by this file.
"""
import asyncio
import json
import threading
from typing import Awaitable, Callable, Optional

from fastapi import WebSocket, WebSocketDisconnect

from core.interviewer import stream_next_turn
from core.voice_providers import AssemblyAIStreamingSttProvider, CartesiaStreamingTtsProvider

SAMPLE_RATE = 16000


async def _stream_sync_generator(gen_factory: Callable[[], object]):
    """
    Runs a *synchronous* generator (stream_next_turn does blocking Groq
    HTTP calls under the hood) in a worker thread, forwarding its items
    into this coroutine via a queue — so one session's LLM call can't
    stall the event loop for every other concurrent WS session.
    """
    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_event_loop()
    sentinel = object()

    def _run():
        try:
            for item in gen_factory():
                loop.call_soon_threadsafe(queue.put_nowait, item)
        except Exception as e:
            loop.call_soon_threadsafe(queue.put_nowait, {"type": "error", "detail": str(e)})
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, sentinel)

    threading.Thread(target=_run, daemon=True).start()

    while True:
        item = await queue.get()
        if item is sentinel:
            return
        yield item


class VoiceSession:
    def __init__(
        self, ws: WebSocket, *,
        interviewer_name: str, job_description: str, extra_questions: list[str],
        transcript: list[dict], turn_count: int, min_turns: int, max_turns: int,
        on_turn: Callable[[list, int], Awaitable[None]],
        on_conclude: Callable[[list], Awaitable[Optional[dict]]],
    ):
        self.ws = ws
        self.interviewer_name = interviewer_name
        self.job_description = job_description
        self.extra_questions = extra_questions
        self.transcript = transcript
        self.turn_count = turn_count
        self.min_turns = min_turns
        self.max_turns = max_turns
        self.on_turn = on_turn
        self.on_conclude = on_conclude

        self._stt: Optional[AssemblyAIStreamingSttProvider] = None
        self._current_tts: Optional[CartesiaStreamingTtsProvider] = None
        self._turn_task: Optional[asyncio.Task] = None
        self._closed = False

    async def _send(self, payload: dict) -> None:
        try:
            await self.ws.send_text(json.dumps(payload))
        except Exception:
            pass

    async def _send_state(self, state: str) -> None:
        await self._send({"type": "state", "state": state})

    # ── main loop ────────────────────────────────────────────────

    async def run(self) -> None:
        await self._send({"type": "authenticated"})
        try:
            self._stt = await AssemblyAIStreamingSttProvider(SAMPLE_RATE).connect()
        except Exception as e:
            await self._send({"type": "error", "detail": f"Streaming STT unavailable: {e}"})
            return

        stt_reader_task = asyncio.create_task(self._read_stt_events())

        if not self.transcript:
            self._turn_task = asyncio.create_task(self._speak_next_turn())
        else:
            last = self.transcript[-1]
            if last["role"] == "assistant":
                self._turn_task = asyncio.create_task(self._speak_text(last["content"], is_question=True))

        try:
            while not self._closed:
                message = await self.ws.receive()
                if message["type"] == "websocket.disconnect":
                    break
                data_bytes = message.get("bytes")
                data_text = message.get("text")
                if data_bytes is not None:
                    if self._stt:
                        await self._stt.send_audio(data_bytes)
                elif data_text is not None:
                    try:
                        control = json.loads(data_text)
                    except json.JSONDecodeError:
                        continue
                    await self._handle_control(control)
        except WebSocketDisconnect:
            pass
        finally:
            self._closed = True
            stt_reader_task.cancel()
            if self._turn_task and not self._turn_task.done():
                self._turn_task.cancel()
            if self._stt:
                await self._stt.close()
            if self._current_tts:
                await self._current_tts.close()

    async def _handle_control(self, msg: dict) -> None:
        mtype = msg.get("type")
        if mtype == "barge_in":
            await self._barge_in()
        elif mtype == "stop":
            self._closed = True
        elif mtype == "ping":
            await self._send({"type": "pong"})
        # "auth" is handled by the route before VoiceSession.run() is ever called

    async def _barge_in(self) -> None:
        """Real barge-in: cancel in-flight TTS synthesis and the streaming LLM task, switch state immediately."""
        if self._current_tts:
            await self._current_tts.cancel()
        if self._turn_task and not self._turn_task.done():
            self._turn_task.cancel()
        await self._send_state("candidate_speaking")

    # ── STT ──────────────────────────────────────────────────────

    async def _read_stt_events(self) -> None:
        if not self._stt:
            return
        try:
            async for event in self._stt.events():
                if event["type"] == "partial":
                    await self._send({"type": "transcript_partial", "text": event["text"]})
                    await self._send_state("candidate_speaking")
                elif event["type"] == "final":
                    await self._send({"type": "transcript_final", "text": event["text"]})
                    if not self._turn_task or self._turn_task.done():
                        self._turn_task = asyncio.create_task(self._on_candidate_final(event["text"]))
        except asyncio.CancelledError:
            pass
        except Exception as e:
            await self._send({"type": "error", "detail": f"STT stream error: {e}"})

    async def _on_candidate_final(self, text: str) -> None:
        await self._send_state("thinking")
        self.transcript.append({"role": "candidate", "content": text})
        self.turn_count += 1
        await self._speak_next_turn()

    # ── LLM + TTS ────────────────────────────────────────────────

    async def _speak_next_turn(self) -> None:
        full_text = ""
        action = "continue"
        tts: Optional[CartesiaStreamingTtsProvider] = None
        try:
            tts = await CartesiaStreamingTtsProvider(SAMPLE_RATE).connect()
            self._current_tts = tts
            audio_forward_task = asyncio.create_task(self._forward_audio(tts))

            gen_factory = lambda: stream_next_turn(
                self.interviewer_name, self.job_description, self.extra_questions,
                self.transcript, self.turn_count, min_turns=self.min_turns, max_turns=self.max_turns,
            )
            async for event in _stream_sync_generator(gen_factory):
                if event["type"] == "delta":
                    full_text += event["text"]
                    await self._send({"type": "ai_text_delta", "text": event["text"]})
                    await tts.speak(event["text"], is_final_chunk=False)
                elif event["type"] == "done":
                    full_text = event["message"]
                    action = event["action"]
                elif event["type"] == "error":
                    raise RuntimeError(event.get("detail", "LLM stream error"))

            await tts.speak(".", is_final_chunk=True)  # closes the Cartesia context so audio_chunks() ends cleanly
            await self._send({"type": "ai_question", "text": full_text})
            await self._send_state("ai_speaking")
            await audio_forward_task
        except asyncio.CancelledError:
            raise
        except Exception as e:
            await self._send({"type": "error", "detail": f"LLM/TTS error: {e}"})
        finally:
            self._current_tts = None

        if not full_text:
            await self._send_state("listening")
            return

        self.transcript.append({"role": "assistant", "content": full_text})
        await self.on_turn(self.transcript, self.turn_count)

        if action == "conclude":
            report = await self.on_conclude(self.transcript)
            await self._send({"type": "completed", "report_ready": report is not None})
            await self._send_state("completed")
            self._closed = True
        else:
            await self._send_state("listening")

    async def _speak_text(self, text: str, is_question: bool = False) -> None:
        tts: Optional[CartesiaStreamingTtsProvider] = None
        try:
            tts = await CartesiaStreamingTtsProvider(SAMPLE_RATE).connect()
            self._current_tts = tts
            if is_question:
                await self._send({"type": "ai_question", "text": text})
            await tts.speak(text, is_final_chunk=True)
            audio_forward_task = asyncio.create_task(self._forward_audio(tts))
            await self._send_state("ai_speaking")
            await audio_forward_task
        except asyncio.CancelledError:
            raise
        except Exception as e:
            await self._send({"type": "error", "detail": f"TTS error: {e}"})
        finally:
            self._current_tts = None
            await self._send_state("listening")

    async def _forward_audio(self, tts: CartesiaStreamingTtsProvider) -> None:
        """audio_chunk is transported as raw binary WS frames (not JSON) —
        avoids ~33% base64 bloat on every chunk in this latency-sensitive path."""
        try:
            async for chunk in tts.audio_chunks():
                await self.ws.send_bytes(chunk)
        except asyncio.CancelledError:
            pass
        except Exception:
            pass