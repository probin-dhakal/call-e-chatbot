from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter


def chunk_documents(documents, chunk_size=500, chunk_overlap=50):
    """Split LangChain Documents while retaining page/document metadata."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_documents(documents)


def chunk_text(text, chunk_size=500, chunk_overlap=50):
    """Compatibility helper for callers that have plain text."""
    documents = chunk_documents([Document(page_content=text)], chunk_size, chunk_overlap)
    return [document.page_content for document in documents]
