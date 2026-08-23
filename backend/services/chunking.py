def chunk_text(text, chunk_size=500, chunk_overlap=50):
    """Split text into overlapping character-length chunks.

    Splits on whitespace boundaries where possible so chunks don't cut
    words in half, while keeping chunk length close to chunk_size.
    """
    words = text.split()
    if not words:
        return []

    chunks = []
    current = []
    current_len = 0

    for word in words:
        word_len = len(word) + 1  # + separating space
        if current and current_len + word_len > chunk_size:
            chunks.append(" ".join(current))

            # Carry the trailing chunk_overlap characters' worth of words
            # into the next chunk so context isn't lost at the boundary.
            overlap_words = []
            overlap_len = 0
            for w in reversed(current):
                overlap_len += len(w) + 1
                if overlap_len > chunk_overlap:
                    break
                overlap_words.insert(0, w)

            current = overlap_words
            current_len = sum(len(w) + 1 for w in current)

        current.append(word)
        current_len += word_len

    if current:
        chunks.append(" ".join(current))

    return chunks
