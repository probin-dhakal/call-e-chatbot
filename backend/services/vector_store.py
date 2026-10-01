"""Per-agent LangChain FAISS stores."""
import os
import shutil

from langchain_community.vectorstores import FAISS
from langchain_community.vectorstores.utils import DistanceStrategy

from services.embeddings import get_embedding_model

INDEX_FILENAME = "index.faiss"


def get_agent_vector_dir(vector_folder, company_id, agent_id):
    return os.path.join(vector_folder, f"company_{company_id}", f"agent_{agent_id}")


def _load_store(vector_folder, company_id, agent_id, model_name):
    directory = get_agent_vector_dir(vector_folder, company_id, agent_id)
    if not os.path.exists(os.path.join(directory, INDEX_FILENAME)):
        return None
    # Store files are generated only by this server, never supplied by users.
    return FAISS.load_local(
        directory, get_embedding_model(model_name),
        allow_dangerous_deserialization=True,
        distance_strategy=DistanceStrategy.MAX_INNER_PRODUCT,
    )


def add_document_to_index(vector_folder, company_id, agent_id, document_id, documents, model_name):
    """Add split LangChain Documents to an isolated agent store."""
    if not documents:
        raise ValueError("No content chunks could be created from this PDF")

    directory = get_agent_vector_dir(vector_folder, company_id, agent_id)
    os.makedirs(directory, exist_ok=True)
    for document in documents:
        document.metadata.update({
            "company_id": company_id,
            "agent_id": agent_id,
            "document_id": document_id,
        })

    store = _load_store(vector_folder, company_id, agent_id, model_name)
    if store is None:
        store = FAISS.from_documents(
            documents, get_embedding_model(model_name),
            distance_strategy=DistanceStrategy.MAX_INNER_PRODUCT,
        )
    else:
        store.add_documents(documents)
    store.save_local(directory)
    return len(documents), directory


def remove_document_from_index(vector_folder, company_id, agent_id, document_id, model_name):
    """Rebuild a store without one document's chunks."""
    directory = get_agent_vector_dir(vector_folder, company_id, agent_id)
    store = _load_store(vector_folder, company_id, agent_id, model_name)
    if store is None:
        return

    remaining = []
    for docstore_id in store.index_to_docstore_id.values():
        document = store.docstore.search(docstore_id)
        if document.metadata.get("document_id") != document_id:
            remaining.append(document)
    if not remaining:
        shutil.rmtree(directory)
        return

    FAISS.from_documents(
        remaining, get_embedding_model(model_name),
        distance_strategy=DistanceStrategy.MAX_INNER_PRODUCT,
    ).save_local(directory)
