import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", "postgresql://localhost/call_e"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Embedding requests hold a connection through a potentially slow model
    # load/encode step — pre_ping avoids handing out a stale pooled
    # connection (e.g. Supabase's pooler closing an idle one) afterwards.
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 280,
    }

    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret-key")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)

    MAX_CONTENT_LENGTH = 25 * 1024 * 1024  # 25 MB per request

    # Organization PDFs live in Supabase Storage, not on the Flask server —
    # these are separate credentials from DATABASE_URL (which is Postgres
    # only). Find them under Project Settings -> API in the Supabase dashboard.
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_KEY")
    SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "documents")

    VECTOR_FOLDER = os.path.join(BASE_DIR, "vector_embedding")
    EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "BAAI/bge-base-en-v1.5")
    CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "500"))
    CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "50"))

    # Google Gemini powers the conversation LLM (knowledge-assistant chat),
    # called directly via the google-genai SDK, not through LangChain.
    #
    # Multiple keys (GEMINI_API_KEY, GEMINI_API_KEY_1, _2, ... _10) can be
    # supplied so the free-tier per-key daily quota doesn't take the whole
    # chat pipeline down — services/llm.py retries and rotates across every
    # key on failure. Both the bare name and _1 are accepted since either
    # convention is easy to reach for when setting these.
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    GEMINI_API_KEYS = list(dict.fromkeys(
        key
        for key in (
            [os.getenv("GEMINI_API_KEY")]
            + [os.getenv(f"GEMINI_API_KEY_{i}") for i in range(1, 11)]
        )
        if key
    ))
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

    # Groq is no longer used for the active conversation LLM, but the
    # config/package is kept in case other dormant code still depends on it.
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    GROQ_MODEL = os.getenv("GROQ_MODEL", "allam-2-7b")

    # Upstash Redis holds the active conversation session (agent/company
    # snapshot + message history) for the lifetime of a chat, so /message
    # doesn't hit Postgres on every turn. Postgres remains the permanent
    # store — the session is persisted there and the Redis key deleted only
    # when the conversation ends (see routes/conversations.py).
    UPSTASH_REDIS_REST_URL = os.getenv("UPSTASH_REDIS_REST_URL")
    UPSTASH_REDIS_REST_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN")
    CONVERSATION_SESSION_TTL_SECONDS = 24 * 60 * 60
    CONVERSATION_INACTIVITY_TIMEOUT_SECONDS = int(
        os.getenv("CONVERSATION_INACTIVITY_TIMEOUT_SECONDS", str(15 * 60))
    )
    CONVERSATION_CLEANUP_INTERVAL_SECONDS = int(
        os.getenv("CONVERSATION_CLEANUP_INTERVAL_SECONDS", "60")
    )

    RAG_TOP_K = int(os.getenv("RAG_TOP_K", "4"))
    # Empirically measured with BAAI/bge-base-en-v1.5 (see backend/README or
    # commit notes): on-topic questions scored 0.53-0.63 cosine similarity
    # against a small sample knowledge base, off-topic questions scored
    # 0.34-0.48. 0.48 sits just above the highest off-topic score.
    RAG_RELEVANCE_THRESHOLD = float(os.getenv("RAG_RELEVANCE_THRESHOLD", "0.48"))

    MAX_HISTORY_MESSAGES = int(os.getenv("MAX_HISTORY_MESSAGES", "12"))

    FRONTEND_ORIGINS = [
        origin.strip()
        for origin in os.getenv(
            "FRONTEND_ORIGINS", "http://localhost:5173,http://localhost:5174"
        ).split(",")
        if origin.strip()
    ]
