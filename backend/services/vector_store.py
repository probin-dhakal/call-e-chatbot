import json
import os
import uuid

import faiss
import numpy as np

from services.embeddings import embed_chunks

INDEX_FILENAME = "index.faiss"
METADATA_FILENAME = "metadata.json"


def get_agent_vector_dir(vector_folder, company_id, agent_id):
    return os.path.join(vector_folder, f"company_{company_id}", f"agent_{agent_id}")


def _load_metadata(metadata_path):
    if not os.path.exists(metadata_path):
        return []
    with open(metadata_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_metadata(metadata, metadata_path):
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)


def add_document_to_index(vector_folder, company_id, agent_id, document_id, chunks, model_name):
    """Embed `chunks` and add them to the agent's shared FAISS index,
    creating the index if this is its first document or appending to it
    (never overwriting) if one already exists. Returns (chunk_count, index_path).
    """
    agent_dir = get_agent_vector_dir(vector_folder, company_id, agent_id)
    os.makedirs(agent_dir, exist_ok=True)

    index_path = os.path.join(agent_dir, INDEX_FILENAME)
    metadata_path = os.path.join(agent_dir, METADATA_FILENAME)

    vectors = embed_chunks(chunks, model_name)
    dimension = vectors.shape[1]

    if os.path.exists(index_path):
        index = faiss.read_index(index_path)
    else:
        index = faiss.IndexFlatIP(dimension)

    metadata = _load_metadata(metadata_path)
    next_vector_index = index.ntotal

    index.add(vectors)

    for i, chunk in enumerate(chunks):
        metadata.append({
            "vector_index": next_vector_index + i,
            "chunk_id": uuid.uuid4().hex,
            "company_id": company_id,
            "agent_id": agent_id,
            "document_id": document_id,
            "chunk_text": chunk,
        })

    faiss.write_index(index, index_path)
    _save_metadata(metadata, metadata_path)

    return len(chunks), index_path


def remove_document_from_index(vector_folder, company_id, agent_id, document_id):
    """Remove all vectors/metadata belonging to `document_id`.

    IndexFlatIP has no cheap "delete by id" — instead we reconstruct the
    surviving vectors (Flat indexes store raw vectors, so this needs no
    re-embedding) and rebuild the index from just those, renumbering
    vector_index positions to match. Safe no-op if the document was never
    embedded (e.g. it had failed processing).
    """
    agent_dir = get_agent_vector_dir(vector_folder, company_id, agent_id)
    index_path = os.path.join(agent_dir, INDEX_FILENAME)
    metadata_path = os.path.join(agent_dir, METADATA_FILENAME)

    if not os.path.exists(index_path) or not os.path.exists(metadata_path):
        return

    index = faiss.read_index(index_path)
    metadata = _load_metadata(metadata_path)
    surviving = [m for m in metadata if m["document_id"] != document_id]

    if len(surviving) == len(metadata):
        return

    if not surviving:
        os.remove(index_path)
        os.remove(metadata_path)
        return

    new_index = faiss.IndexFlatIP(index.d)
    new_metadata = []
    for new_pos, entry in enumerate(surviving):
        vector = index.reconstruct(entry["vector_index"])
        new_index.add(np.expand_dims(vector, axis=0))
        entry = dict(entry)
        entry["vector_index"] = new_pos
        new_metadata.append(entry)

    faiss.write_index(new_index, index_path)
    _save_metadata(new_metadata, metadata_path)
