import os
import posthog
from dotenv import load_dotenv

load_dotenv()

POSTHOG_KEY = os.getenv("POSTHOG_API_KEY", "")
POSTHOG_HOST = os.getenv("POSTHOG_HOST", "https://us.i.posthog.com")

_enabled = bool(POSTHOG_KEY)
if _enabled:
    posthog.project_api_key = POSTHOG_KEY
    posthog.host = POSTHOG_HOST
else:
    print("[Analytics] POSTHOG_API_KEY not set — server-side analytics disabled")


def track(user_id, event: str, properties: dict = None):
    """
    Fire-and-forget server-side event. Never raises — a broken analytics
    call should never break a real user-facing request.
    Business-critical events (signup, scan completed, upgrade) are tracked
    server-side rather than client-side because it can't be blocked by
    ad-blockers/privacy extensions the way frontend posthog-js can.
    """
    if not _enabled:
        return
    try:
        posthog.capture(distinct_id=str(user_id), event=event, properties=properties or {})
    except Exception as e:
        print(f"[Analytics] Failed to track '{event}': {e}")


def identify(user_id, properties: dict = None):
    if not _enabled:
        return
    try:
        posthog.identify(distinct_id=str(user_id), properties=properties or {})
    except Exception as e:
        print(f"[Analytics] Failed to identify user: {e}")