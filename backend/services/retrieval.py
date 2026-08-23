import json
import logging
import os

import faiss

from services.embeddings import embed_chunks
from services.vector_store import get_agent_vector_dir, INDEX_FILENAME, METADATA_FILENAME

logger = logging.getLogger(__name__)


def search_agent_knowledge(vector_folder, company_id, agent_id, query, model_name, top_k):
    """Search the given agent's FAISS index for the top-k chunks most
    similar to `query`. Returns (chunks, best_score, index_exists).

    `chunks` is a list of {chunk_text, document_id, score}, best-score-first.
    `index_exists` distinguishes "no knowledge base uploaded yet" (nothing
    to judge relevance against) from "we have a KB but this query doesn't
    match it well" — callers use this to decide whether to refuse the
    question outright or just answer without retrieved context.
    """
    agent_dir = get_agent_vector_dir(vector_folder, company_id, agent_id)
    index_path = os.path.join(agent_dir, INDEX_FILENAME)
    metadata_path = os.path.join(agent_dir, METADATA_FILENAME)

    if not os.path.exists(index_path) or not os.path.exists(metadata_path):
        return [], None, False

    index = faiss.read_index(index_path)
    with open(metadata_path, "r", encoding="utf-8") as f:
        metadata = json.load(f)

    if index.ntotal == 0 or not metadata:
        return [], None, True

    query_vector = embed_chunks([query], model_name)
    k = min(top_k, index.ntotal)
    scores, indices = index.search(query_vector, k)

    chunks = []
    for score, vector_index in zip(scores[0], indices[0]):
        if vector_index < 0:
            continue
        match = next((m for m in metadata if m["vector_index"] == int(vector_index)), None)
        if not match:
            continue
        chunks.append({
            "chunk_text": match["chunk_text"],
            "document_id": match["document_id"],
            "score": float(score),
        })

    best_score = chunks[0]["score"] if chunks else None
    return chunks, best_score, True


def is_query_relevant(best_score, index_exists, threshold):
    """No knowledge base yet -> let the agent answer from its own
    configured persona rather than refusing everything. A knowledge base
    that exists but scores below threshold -> likely off-topic.
    """
    if not index_exists:
        return True
    if best_score is None:
        return True
    return best_score >= threshold
