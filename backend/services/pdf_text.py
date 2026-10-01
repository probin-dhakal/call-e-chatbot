import os
import tempfile

from langchain_community.document_loaders import PyPDFLoader


def load_pdf_documents(content_bytes, metadata=None):
    """Load in-memory PDF bytes as LangChain Documents.

    PyPDFLoader requires a pathname, so the request bytes are written only
    to a securely-created temporary file and removed immediately afterwards.
    """
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_file:
            temp_file.write(content_bytes)
            temp_path = temp_file.name
        documents = PyPDFLoader(temp_path).load()
        for document in documents:
            document.metadata.update(metadata or {})
        return [document for document in documents if document.page_content.strip()]
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)
