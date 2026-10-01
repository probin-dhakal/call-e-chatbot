import threading

from langchain_huggingface import HuggingFaceEmbeddings

_embeddings = None
_model_name = None
_model_lock = threading.Lock()


def get_embedding_model(model_name):
    """Return one thread-safe LangChain embedding adapter per process."""
    global _embeddings, _model_name
    if _embeddings is None or _model_name != model_name:
        with _model_lock:
            if _embeddings is None or _model_name != model_name:
                _embeddings = HuggingFaceEmbeddings(
                    model_name=model_name,
                    encode_kwargs={"normalize_embeddings": True},
                )
                _model_name = model_name
    return _embeddings
