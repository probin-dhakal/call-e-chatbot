"""PostgreSQL + pgvector storage for agent knowledge chunks."""

from models import db, DocumentChunk
from services.embeddings import get_embedding_model


def add_document_to_index(
    company_id,
    agent_id,
    document_id,
    documents,
    model_name,
):
    """
    Generate embeddings for document chunks and store them
    directly in PostgreSQL using pgvector.
    """

    if not documents:
        raise ValueError(
            "No content chunks could be created from this PDF"
        )

    embedding_model = get_embedding_model(model_name)

    texts = [
        document.page_content
        for document in documents
    ]

    embeddings = embedding_model.embed_documents(texts)

    chunks = []

    for index, (document, embedding) in enumerate(
        zip(documents, embeddings)
    ):
        chunk = DocumentChunk(
            company_id=company_id,
            agent_id=agent_id,
            document_id=document_id,
            chunk_index=index,
            chunk_text=document.page_content,
            embedding=embedding,
        )

        chunks.append(chunk)

    db.session.add_all(chunks)
    db.session.commit()

    return len(chunks)


def remove_document_from_index(
    document_id,
):
    """
    Delete all vector chunks belonging to a document.

    pgvector does not require rebuilding an index.
    """

    deleted = (
        DocumentChunk.query
        .filter_by(document_id=document_id)
        .delete(
            synchronize_session=False
        )
    )

    db.session.commit()

    return deleted