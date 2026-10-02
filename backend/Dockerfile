FROM python:3.12-slim

# PyTorch / sentence-transformers can use OpenMP at runtime.
# This prevents OpenMP runtime conflicts in environments where
# multiple OpenMP libraries are loaded.
ENV KMP_DUPLICATE_LIB_OK=TRUE \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Pre-download the BGE embedding model during image build.
# This avoids downloading the model from Hugging Face on
# every container startup.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-base-en-v1.5')"

EXPOSE 5000

CMD ["gunicorn", "-c", "gunicorn.conf.py", "app:app"]