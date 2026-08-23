import logging
import threading
import time

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

_clients = {}  # api_key -> genai.Client, cached across calls/keys
# Index into the current api_keys list of the last key that worked — starting
# each call here (instead of always at index 0) means a key exhausted for the
# day is skipped on every subsequent request rather than retried and failed
# against on every single turn. Guarded by a lock since multiple request
# threads (e.g. gunicorn's gthread workers) can call this concurrently.
_key_index = 0
_key_index_lock = threading.Lock()

MAX_ATTEMPTS_PER_KEY = 3
RETRY_BACKOFF_SECONDS = 1.5


def _get_client(api_key):
    if api_key not in _clients:
        _clients[api_key] = genai.Client(api_key=api_key)
    return _clients[api_key]


def generate_response(prompt, api_keys, model_name, temperature=0.7, max_tokens=1024):
    """Generate a single response from Gemini for a fully-formed prompt string.

    Left uncapped, Gemini's "thinking" models spend a large, highly variable
    amount of hidden reasoning time per call and can leak that reasoning
    into the visible answer — a fixed thinking_budget bounds both. Thinking
    tokens are drawn from the same max_output_tokens budget, so max_tokens
    must comfortably exceed thinking_budget or the visible reply gets cut
    off mid-sentence (observed at max_tokens=512, thinking_budget=512).

    api_keys may be a single key string or a list of keys. Every key gets
    up to MAX_ATTEMPTS_PER_KEY tries (with a short backoff between them) —
    covering rate limits, transient server errors, and network blips alike
    — before moving on to the next key. Only raises once every key and
    every retry has been exhausted.
    """
    global _key_index

    if isinstance(api_keys, str):
        api_keys = [api_keys]
    api_keys = [k for k in (api_keys or []) if k]
    if not api_keys:
        raise ValueError("No Gemini API key is set in the environment.")

    config = types.GenerateContentConfig(
        temperature=temperature,
        max_output_tokens=max_tokens,
        thinking_config=types.ThinkingConfig(thinking_budget=512),
    )

    with _key_index_lock:
        start_index = _key_index % len(api_keys)

    last_error = None

    for offset in range(len(api_keys)):
        index = (start_index + offset) % len(api_keys)
        client = _get_client(api_keys[index])

        for attempt in range(MAX_ATTEMPTS_PER_KEY):
            try:
                response = client.models.generate_content(
                    model=model_name, contents=prompt, config=config,
                )
                with _key_index_lock:
                    _key_index = index
                return (response.text or "").strip()
            except Exception as exc:
                last_error = exc
                if attempt < MAX_ATTEMPTS_PER_KEY - 1:
                    logger.warning(
                        "Gemini key index %s failed (%s), retrying same key (attempt %s/%s)",
                        index, exc, attempt + 2, MAX_ATTEMPTS_PER_KEY,
                    )
                    time.sleep(RETRY_BACKOFF_SECONDS * (attempt + 1))
                else:
                    logger.warning(
                        "Gemini key index %s failed after %s attempt(s) (%s), trying next key",
                        index, MAX_ATTEMPTS_PER_KEY, exc,
                    )

    logger.error("All %s Gemini key(s) exhausted after retries", len(api_keys))
    raise last_error
