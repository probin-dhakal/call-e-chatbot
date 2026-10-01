"""LangChain retrieval with the application's explicit relevance gate."""
import os

from services.vector_store import INDEX_FILENAME, _load_store, get_agent_vector_dir


def search_agent_knowledge(vector_folder, company_id, agent_id, query, model_name, top_k):
    directory = get_agent_vector_dir(vector_folder, company_id, agent_id)
    index_exists = os.path.exists(os.path.join(directory, INDEX_FILENAME))
    if not index_exists:
        return [], None, False

    store = _load_store(vector_folder, company_id, agent_id, model_name)
    if store is None or store.index.ntotal == 0:
        return [], None, True

    matches = store.similarity_search_with_score(query, k=min(top_k, store.index.ntotal))
    chunks = [
        {"chunk_text": document.page_content,
         "document_id": document.metadata.get("document_id"), "score": float(score)}
        for document, score in matches
    ]
    return chunks, (chunks[0]["score"] if chunks else None), True


def is_query_relevant(best_score, index_exists, threshold):
    if not index_exists or best_score is None:
        return True
    return best_score >= threshold
