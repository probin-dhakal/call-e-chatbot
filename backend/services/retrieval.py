"""PostgreSQL pgvector retrieval for agent knowledge."""

from models import DocumentChunk
from services.embeddings import get_embedding_model


def search_agent_knowledge(
    company_id,
    agent_id,
    query,
    model_name,
    top_k,
):
    """
    Search the agent's knowledge base using pgvector cosine similarity.
    """

    embedding_model = get_embedding_model(model_name)

    query_embedding = embedding_model.embed_query(query)

    query_result = (
        DocumentChunk.query
        .filter(
            DocumentChunk.company_id == company_id,
            DocumentChunk.agent_id == agent_id,
        )
        .order_by(
            DocumentChunk.embedding.cosine_distance(
                query_embedding
            )
        )
        .limit(top_k)
        .all()
    )

    if not query_result:
        return [], None, False

    chunks = []

    for chunk in query_result:
        distance = float(
            chunk.embedding.cosine_distance(
                query_embedding
            )
        )

        similarity = 1.0 - distance

        chunks.append({
            "chunk_text": chunk.chunk_text,
            "document_id": chunk.document_id,
            "score": similarity,
        })

    best_score = chunks[0]["score"]

    return chunks, best_score, True


def is_query_relevant(
    best_score,
    index_exists,
    threshold,
):
    if not index_exists or best_score is None:
        return True

    return best_score >= threshold