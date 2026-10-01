"""LangChain Gemini client with the existing resilient key rotation."""
import logging
import threading
import time

from langchain_google_genai import ChatGoogleGenerativeAI

logger = logging.getLogger(__name__)

_key_index = 0
_key_index_lock = threading.Lock()
MAX_ATTEMPTS_PER_KEY = 3
RETRY_BACKOFF_SECONDS = 1.5


def _model(api_key, model_name, temperature, max_tokens):
    return ChatGoogleGenerativeAI(
        model=model_name,
        google_api_key=api_key,
        temperature=temperature,
        max_output_tokens=max_tokens,
    )


def _message_text(message):
    content = message.content
    if isinstance(content, str):
        return content.strip()
    return "".join(part.get("text", "") if isinstance(part, dict) else str(part) for part in content).strip()


def generate_response(prompt, api_keys, model_name, temperature=0.7, max_tokens=1024):
    """Invoke LangChain's Gemini chat model, retaining multi-key retries."""
    global _key_index
    api_keys = [api_keys] if isinstance(api_keys, str) else list(api_keys or [])
    api_keys = [key for key in api_keys if key]
    if not api_keys:
        raise ValueError("No Gemini API key is set in the environment.")

    with _key_index_lock:
        start_index = _key_index % len(api_keys)
    last_error = None
    for offset in range(len(api_keys)):
        index = (start_index + offset) % len(api_keys)
        for attempt in range(MAX_ATTEMPTS_PER_KEY):
            try:
                response = _model(api_keys[index], model_name, temperature, max_tokens).invoke(prompt)
                with _key_index_lock:
                    _key_index = index
                return _message_text(response)
            except Exception as exc:
                last_error = exc
                if attempt < MAX_ATTEMPTS_PER_KEY - 1:
                    logger.warning("Gemini key %s failed; retrying (%s/%s)", index, attempt + 2, MAX_ATTEMPTS_PER_KEY)
                    time.sleep(RETRY_BACKOFF_SECONDS * (attempt + 1))
                else:
                    logger.warning("Gemini key %s exhausted; trying next key", index)
    raise last_error


def generate_structured_response(prompt, schema, api_keys, model_name, temperature=0.2):
    """Return schema-validated output through LangChain structured output."""
    global _key_index
    api_keys = [api_keys] if isinstance(api_keys, str) else list(api_keys or [])
    api_keys = [key for key in api_keys if key]
    if not api_keys:
        raise ValueError("No Gemini API key is set in the environment.")
    with _key_index_lock:
        start_index = _key_index % len(api_keys)
    last_error = None
    for offset in range(len(api_keys)):
        index = (start_index + offset) % len(api_keys)
        for attempt in range(MAX_ATTEMPTS_PER_KEY):
            try:
                chain = _model(api_keys[index], model_name, temperature, 1024).with_structured_output(schema)
                response = chain.invoke(prompt)
                with _key_index_lock:
                    _key_index = index
                return response
            except Exception as exc:
                last_error = exc
                if attempt < MAX_ATTEMPTS_PER_KEY - 1:
                    time.sleep(RETRY_BACKOFF_SECONDS * (attempt + 1))
    raise last_error
