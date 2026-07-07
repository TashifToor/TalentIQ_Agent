import os
import hashlib
import json
import redis
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Single shared connection pool for the whole app (separate from Celery's
# own Redis connection — this one is for direct caching / rate-limiting,
# not task queueing).
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)


def is_redis_available() -> bool:
    try:
        redis_client.ping()
        return True
    except redis.exceptions.RedisError:
        return False


# ---------------------------------------------------------------------------
# Rate limiting — used for OTP endpoints (forgot-password, resend-verification,
# signup) to stop rapid repeated requests. This is what caused Gmail to
# flag/revoke the App Password earlier when the same email was hit 8-10
# times in a couple minutes during testing.
# ---------------------------------------------------------------------------
def check_rate_limit(key: str, cooldown_seconds: int = 45) -> tuple[bool, int]:
    """
    Returns (allowed, seconds_remaining).
    Uses SET NX EX — atomic, so no race condition between check and set.
    If Redis is down, fails OPEN (allowed=True) so the feature never breaks
    just because caching infra is unavailable — rate-limiting is a nice-to-have,
    not a hard dependency.
    """
    try:
        full_key = f"ratelimit:{key}"
        was_set = redis_client.set(full_key, "1", nx=True, ex=cooldown_seconds)
        if was_set:
            return True, 0
        ttl = redis_client.ttl(full_key)
        return False, max(ttl, 1)
    except redis.exceptions.RedisError:
        return True, 0


# ---------------------------------------------------------------------------
# Login brute-force protection — locks an email out for a short window after
# too many failed password attempts, independent of which IP is attacking.
# ---------------------------------------------------------------------------
def record_failed_login(email: str, max_attempts: int = 5, lockout_seconds: int = 300) -> tuple[int, bool]:
    """Returns (attempt_count, is_now_locked)."""
    try:
        key = f"loginfail:{email}"
        count = redis_client.incr(key)
        if count == 1:
            redis_client.expire(key, lockout_seconds)
        return count, count >= max_attempts
    except redis.exceptions.RedisError:
        return 0, False


def is_login_locked(email: str) -> tuple[bool, int]:
    try:
        key = f"loginfail:{email}"
        ttl = redis_client.ttl(key)
        count = redis_client.get(key)
        if count and int(count) >= 5 and ttl > 0:
            return True, ttl
        return False, 0
    except redis.exceptions.RedisError:
        return False, 0


def clear_failed_logins(email: str):
    try:
        redis_client.delete(f"loginfail:{email}")
    except redis.exceptions.RedisError:
        pass


# ---------------------------------------------------------------------------
# LLM screening result cache — identical (CV text, job description) pairs
# skip the Groq API call entirely. Real cost + latency win: the LLM call is
# by far the slowest and most expensive step in a scan.
# ---------------------------------------------------------------------------
def _screening_cache_key(cv_text: str, job_description: str) -> str:
    combined = f"{cv_text.strip()}|||{job_description.strip()}"
    digest = hashlib.sha256(combined.encode("utf-8")).hexdigest()
    return f"screening:{digest}"


def get_cached_screening(cv_text: str, job_description: str):
    try:
        key = _screening_cache_key(cv_text, job_description)
        cached = redis_client.get(key)
        return json.loads(cached) if cached else None
    except redis.exceptions.RedisError:
        return None


def set_cached_screening(cv_text: str, job_description: str, result: dict, ttl_seconds: int = 21600):
    """Default TTL: 6 hours — long enough to catch retries/refreshes, short
    enough that prompt/model changes don't serve stale analyses for too long."""
    try:
        key = _screening_cache_key(cv_text, job_description)
        redis_client.set(key, json.dumps(result), ex=ttl_seconds)
    except redis.exceptions.RedisError:
        pass