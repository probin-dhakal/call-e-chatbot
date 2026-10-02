"""PostgreSQL + pgvector storage for agent knowledge chunks."""

from models import db, DocumentChunk
from services.embeddings import get_embedding_model


def replace_document_chunks(
    company_id,
    agent_id,
    document_id,
    documents,
    model_name,
):
    """
    Generate new embeddings and replace the document's existing
    chunks inside the caller's database transaction.

    This function does not commit.
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

    # Generate embeddings BEFORE deleting existing chunks.
    embeddings = embedding_model.embed_documents(texts)

    new_chunks = []

    for index, (document, embedding) in enumerate(
        zip(documents, embeddings)
    ):
        new_chunks.append(
            DocumentChunk(
                company_id=company_id,
                agent_id=agent_id,
                document_id=document_id,
                chunk_index=index,
                chunk_text=document.page_content,
                embedding=embedding,
            )
        )

    # Only delete old chunks after all embeddings succeeded.
    DocumentChunk.query.filter_by(
        document_id=document_id
    ).delete(
        synchronize_session=False
    )

    db.session.add_all(new_chunks)

    return len(new_chunks)




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