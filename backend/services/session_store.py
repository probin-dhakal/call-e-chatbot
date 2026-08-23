import json
import logging

from upstash_redis import Redis

logger = logging.getLogger(__name__)

_client = None
_client_key = None  # (url, token) the cached client was built with

SESSION_KEY_PREFIX = "conversation:"


class SessionStoreError(Exception):
    """Raised when Redis is unreachable or misconfigured — callers must
    surface a clean error rather than silently falling back to Postgres.
    """


def _get_client(url, token):
    global _client, _client_key
    if not url or not token:
        raise SessionStoreError("UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN are not set.")
    if _client is None or _client_key != (url, token):
        _client = Redis(url=url, token=token)
        _client_key = (url, token)
    return _client


def _session_key(conversation_id):
    return f"{SESSION_KEY_PREFIX}{conversation_id}"


def serialize_agent(agent):
    return {
        "id": agent.id,
        "name": agent.name,
        "role": agent.role,
        "objective": agent.objective,
        "organization_values": agent.organization_values,
        "conversation_purpose": agent.conversation_purpose,
    }


def serialize_company(company):
    return {
        "id": company.id,
        "name": company.name,
    }


def build_session(conversation, agent, company, history=None):
    """Build the complete session object stored in Redis under
    conversation:<id>. `history` is a list of {"role", "content"} dicts,
    already in the shape the existing Gemini prompt expects.
    """
    return {
        "conversation_id": conversation.id,
        "agent_id": agent.id,
        "company_id": company.id,
        "agent": serialize_agent(agent),
        "company": serialize_company(company),
        "history": history or [],
        "metadata": {"stage": conversation.stage},
    }


def get_session(conversation_id, cfg):
    """Returns the session dict, or None if no session exists for this
    conversation. Raises SessionStoreError if Redis itself is unreachable —
    that is a distinct failure from "session not found" and callers must
    not treat it as one (no silent fallback to Postgres per-turn queries).
    """
    client = _get_client(cfg["UPSTASH_REDIS_REST_URL"], cfg["UPSTASH_REDIS_REST_TOKEN"])
    try:
        raw = client.get(_session_key(conversation_id))
    except Exception as exc:
        logger.exception("Redis GET failed for conversation %s", conversation_id)
        raise SessionStoreError(str(exc)) from exc

    if raw is None:
        return None
    return json.loads(raw)


def save_session(conversation_id, session, cfg):
    """Writes the session and (re)sets its TTL in one call — every write
    (initial /start, and every /message turn) refreshes the 24h expiry so
    an active conversation never gets silently evicted mid-chat.
    """
    client = _get_client(cfg["UPSTASH_REDIS_REST_URL"], cfg["UPSTASH_REDIS_REST_TOKEN"])
    try:
        client.set(
            _session_key(conversation_id),
            json.dumps(session),
            ex=cfg["CONVERSATION_SESSION_TTL_SECONDS"],
        )
    except Exception as exc:
        logger.exception("Redis SET failed for conversation %s", conversation_id)
        raise SessionStoreError(str(exc)) from exc


def delete_session(conversation_id, cfg):
    client = _get_client(cfg["UPSTASH_REDIS_REST_URL"], cfg["UPSTASH_REDIS_REST_TOKEN"])
    try:
        client.delete(_session_key(conversation_id))
    except Exception:
        # Best-effort — the session will simply expire via its TTL if this
        # fails, and Postgres persistence (the source of truth) already
        # succeeded by the time this is called.
        logger.exception("Redis DELETE failed for conversation %s", conversation_id)
