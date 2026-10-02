"""LangChain Gemini client with resilient key rotation and selective retries."""

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

    return "".join(
        part.get("text", "") if isinstance(part, dict) else str(part)
        for part in content
    ).strip()


def _get_status_code(error):
    """
    Try to extract an HTTP status code from Gemini/LangChain exceptions.

    Different versions of LangChain / google-genai may expose the
    status code differently, so check the common locations.
    """
    status_code = getattr(error, "status_code", None)

    if status_code is not None:
        return status_code

    response = getattr(error, "response", None)

    if response is not None:
        status_code = getattr(response, "status_code", None)

        if status_code is not None:
            return status_code

    return None


def _is_retryable_error(error):
    """
    Return True only for errors that are normally transient.

    Retry:
        429 -> rate limit
        500 -> server error
        502 -> bad gateway
        503 -> service unavailable
        504 -> gateway timeout
        TimeoutError / ConnectionError -> network problems

    Do not retry:
        400 -> bad request
        401 -> invalid authentication/key
        403 -> permission/authentication problem
        404 -> model/resource not found
        Other unknown exceptions
    """
    status_code = _get_status_code(error)

    if status_code in {429, 500, 502, 503, 504}:
        return True

    if isinstance(error, (TimeoutError, ConnectionError)):
        return True

    return False


def _is_key_error(error):
    """
    Return True for errors where switching to another API key
    is more appropriate than retrying the same key.
    """
    status_code = _get_status_code(error)

    return status_code in {401, 403}


def generate_response(
    prompt,
    api_keys,
    model_name,
    temperature=0.7,
    max_tokens=1024,
):
    """
    Invoke LangChain's Gemini chat model.

    Retry behaviour:
    - Transient errors: retry the same key up to MAX_ATTEMPTS_PER_KEY.
    - Authentication/key errors: immediately move to the next key.
    - Permanent errors: fail immediately.
    """
    global _key_index

    api_keys = (
        [api_keys]
        if isinstance(api_keys, str)
        else list(api_keys or [])
    )

    api_keys = [key for key in api_keys if key]

    if not api_keys:
        raise ValueError(
            "No Gemini API key is set in the environment."
        )

    with _key_index_lock:
        start_index = _key_index % len(api_keys)

    last_error = None

    for offset in range(len(api_keys)):
        index = (start_index + offset) % len(api_keys)

        for attempt in range(MAX_ATTEMPTS_PER_KEY):
            try:
                response = _model(
                    api_keys[index],
                    model_name,
                    temperature,
                    max_tokens,
                ).invoke(prompt)

                with _key_index_lock:
                    _key_index = index

                return _message_text(response)

            except Exception as exc:
                last_error = exc
                status_code = _get_status_code(exc)

                # Authentication/key problem:
                # don't waste 3 attempts on the same bad key.
                if _is_key_error(exc):
                    logger.warning(
                        "Gemini key %s failed with authentication/"
                        "permission error (status=%s); "
                        "trying next key.",
                        index,
                        status_code,
                    )
                    break

                # Permanent/non-retryable error:
                # fail immediately instead of retrying.
                if not _is_retryable_error(exc):
                    logger.error(
                        "Gemini request failed with a "
                        "non-retryable error (status=%s): %s",
                        status_code,
                        exc,
                    )
                    raise

                # Retryable transient error.
                if attempt < MAX_ATTEMPTS_PER_KEY - 1:
                    delay = RETRY_BACKOFF_SECONDS * (attempt + 1)

                    logger.warning(
                        "Gemini key %s encountered a retryable "
                        "error (status=%s); retrying (%s/%s) "
                        "after %.1fs.",
                        index,
                        status_code,
                        attempt + 2,
                        MAX_ATTEMPTS_PER_KEY,
                        delay,
                    )

                    time.sleep(delay)

                else:
                    logger.warning(
                        "Gemini key %s exhausted after %s attempts "
                        "for a retryable error (status=%s); "
                        "trying next key.",
                        index,
                        MAX_ATTEMPTS_PER_KEY,
                        status_code,
                    )

    raise last_error


def generate_structured_response(
    prompt,
    schema,
    api_keys,
    model_name,
    temperature=0.2,
):
    """
    Return schema-validated output through LangChain structured output.

    Retry behaviour:
    - Transient errors: retry the same key.
    - Authentication/key errors: immediately move to next key.
    - Permanent errors: fail immediately.
    """
    global _key_index

    api_keys = (
        [api_keys]
        if isinstance(api_keys, str)
        else list(api_keys or [])
    )

    api_keys = [key for key in api_keys if key]

    if not api_keys:
        raise ValueError(
            "No Gemini API key is set in the environment."
        )

    with _key_index_lock:
        start_index = _key_index % len(api_keys)

    last_error = None

    for offset in range(len(api_keys)):
        index = (start_index + offset) % len(api_keys)

        for attempt in range(MAX_ATTEMPTS_PER_KEY):
            try:
                chain = (
                    _model(
                        api_keys[index],
                        model_name,
                        temperature,
                        1024,
                    )
                    .with_structured_output(schema)
                )

                response = chain.invoke(prompt)

                with _key_index_lock:
                    _key_index = index

                return response

            except Exception as exc:
                last_error = exc
                status_code = _get_status_code(exc)

                # Authentication/key problem:
                # immediately move to the next key.
                if _is_key_error(exc):
                    logger.warning(
                        "Gemini key %s failed with authentication/"
                        "permission error (status=%s); "
                        "trying next key.",
                        index,
                        status_code,
                    )
                    break

                # Permanent/non-retryable error:
                # don't retry.
                if not _is_retryable_error(exc):
                    logger.error(
                        "Gemini structured request failed with a "
                        "non-retryable error (status=%s): %s",
                        status_code,
                        exc,
                    )
                    raise

                # Retryable transient error.
                if attempt < MAX_ATTEMPTS_PER_KEY - 1:
                    delay = RETRY_BACKOFF_SECONDS * (attempt + 1)

                    logger.warning(
                        "Gemini structured request using key %s "
                        "encountered a retryable error (status=%s); "
                        "retrying (%s/%s) after %.1fs.",
                        index,
                        status_code,
                        attempt + 2,
                        MAX_ATTEMPTS_PER_KEY,
                        delay,
                    )

                    time.sleep(delay)

                else:
                    logger.warning(
                        "Gemini key %s exhausted after %s attempts "
                        "for a retryable structured-output error "
                        "(status=%s); trying next key.",
                        index,
                        MAX_ATTEMPTS_PER_KEY,
                        status_code,
                    )

    raise last_error