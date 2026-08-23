FROM python:3.12-slim

# faiss and torch (via sentence-transformers) both bundle their own OpenMP
# runtime; loading both natively in one process can segfault unless this is
# set before either is imported — same guard app.py sets for local runs.
ENV KMP_DUPLICATE_LIB_OK=TRUE \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Bakes the BGE embedding model's weights into the image at build time —
# without this the first request after every container start pays a
# ~7.6s cold-load plus a Hugging Face Hub download.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-base-en-v1.5')"

# vector_embedding/ holds each agent's FAISS index — must be a mounted
# volume in production (see deployment steps) or every redeploy wipes
# every organization's knowledge base.
VOLUME ["/app/vector_embedding"]

EXPOSE 5000

CMD ["gunicorn", "-c", "gunicorn.conf.py", "app:app"]
