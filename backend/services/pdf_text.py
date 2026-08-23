from pypdf import PdfReader


def extract_text_from_pdf(file_or_stream):
    """Extract all text from a PDF — accepts a file path or a file-like
    object (e.g. io.BytesIO), pypdf handles both. Returns "" if no page
    yields text (e.g. a scanned/image-only PDF) rather than raising, so the
    caller can surface a clear "no extractable text" error instead of
    embedding nothing.
    """
    reader = PdfReader(file_or_stream)

    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""

    return text.strip()
