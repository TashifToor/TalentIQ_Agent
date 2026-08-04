import os
import io
from groq import Groq

_client = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _client


def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """
    Transcribes a short spoken answer using Groq's hosted Whisper
    (whisper-large-v3-turbo — fast enough for a live interview turn).
    Returns the transcribed text, stripped. Raises on API failure —
    callers should catch and surface a friendly retry message.
    """
    client = _get_client()
    file_tuple = (filename, io.BytesIO(audio_bytes))
    result = client.audio.transcriptions.create(
        model="whisper-large-v3-turbo",
        file=file_tuple,
        response_format="text",
        temperature=0.0,
    )
    # response_format="text" returns a plain string with some SDK versions,
    # and an object with a .text attribute on others — handle both.
    text = result if isinstance(result, str) else getattr(result, "text", "")
    return text.strip()