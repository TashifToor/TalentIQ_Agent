"""
Provider selection for the CV Optimizer / Candidate Screening structured
analysis feature specifically. Deliberately NOT a rewrite of core/llm.py's
`llm` singleton — that object is already imported and relied on across many
existing working features (cv_generator.py, core/graph.py, screening_crew,
etc.) and rewriting it is out of scope ("do not rebuild working backend
systems unnecessarily").

Instead: one small function, `get_analysis_llm()`, that this feature's own
endpoints call instead of importing `core.llm.llm` directly. By default it
reuses the exact same configured Groq client (zero behavior change). If an
operator sets AI_PROVIDER=openai (and OPENAI_API_KEY), it switches to
OpenAI instead — without any provider-specific branching inside the
endpoint or frontend code, satisfying "keep provider selection inside the
backend/service layer" and "don't hardcode to one provider" for this
feature going forward.

langchain-openai is an optional dependency: if AI_PROVIDER=openai is set
but the package isn't installed, this raises a clear AIProviderError
instead of crashing at import time or leaking a raw ImportError to the
client.
"""
import os


class AIProviderError(Exception):
    """Raised for any provider-level failure — callers catch this and
    return the generic "Analysis couldn't be completed" message; the real
    detail is logged server-side only, never sent to the client."""


def get_analysis_llm():
    provider = os.getenv("AI_PROVIDER", "groq").strip().lower()

    if provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise AIProviderError("AI_PROVIDER=openai is set but OPENAI_API_KEY is missing.")
        try:
            from langchain_groq import ChatGroq
        except ImportError as e:
            raise AIProviderError(
                "AI_PROVIDER=openai is set but the 'langchain-groq' package isn't installed "
                "(pip install langchain-groq)."
            ) from e
        return ChatGroq(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            api_key=api_key,
            temperature=0.1,
            timeout=40,
            max_retries=1,
        )

    # Default: reuse the existing, already-configured Groq client as-is —
    # same model, same timeout/retry budget, zero duplicate connections.
    from core.llm import llm
    return llm