import threading

import numpy as np
from sentence_transformers import SentenceTransformer

_model = None
_model_name = None
_model_lock = threading.Lock()


def get_embedding_model(model_name):
    """Load the SentenceTransformer model once per process and reuse it —
    loading it fresh on every request would be far too slow.

    Under a multi-threaded server (e.g. gunicorn's gthread workers), the
    first request(s) a worker ever handles can arrive concurrently on
    several threads at once — without a lock they'd all see `_model is
    None` together and each start loading it in parallel, which is not a
    safe operation for the underlying PyTorch model (observed to crash the
    worker under this exact race). The lock only guards the one-time load;
    every later call finds `_model` already set and returns immediately.
    """
    global _model, _model_name
    if _model is None or _model_name != model_name:
        with _model_lock:
            if _model is None or _model_name != model_name:
                _model = SentenceTransformer(model_name)
                _model_name = model_name
    return _model


def embed_chunks(chunks, model_name):
    """Embed a list of text chunks, returning a float32 array of
    L2-normalized vectors ready for an inner-product FAISS index.
    """
    model = get_embedding_model(model_name)
    vectors = model.encode(chunks, normalize_embeddings=True)
    return np.asarray(vectors).astype("float32")
