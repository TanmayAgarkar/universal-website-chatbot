
from threading import Lock

from ..storage import get_page_content

from .chunker import create_page_chunks

from .embeddings import generate_embeddings

from .vector_store import get_collection


BATCH_SIZE = 64

# Serialize index modifications in this
# single-process development backend.
index_lock = Lock()


def index_webpage(page_id: str) -> dict:

    page = get_page_content(page_id)

    if page is None:
        raise ValueError(
            "Page not found in SQLite. "
            "Upload it before indexing."
        )

    chunks = create_page_chunks(page)

    if not chunks:
        raise ValueError(
            "No indexable content found."
        )

    # Generate all embeddings before changing
    # the stored ChromaDB index.
    texts = [
        chunk["text"]
        for chunk in chunks
    ]

    vectors = generate_embeddings(texts)

    collection = get_collection()

    with index_lock:

        # Remove this page's previous vectors.
        # Other webpages are not affected.
        collection.delete(
            where={
                "page_id": page_id
            }
        )

        # Insert vectors in bounded batches.
        for start in range(
            0,
            len(chunks),
            BATCH_SIZE
        ):

            end = start + BATCH_SIZE

            batch_chunks = chunks[start:end]
            batch_vectors = vectors[start:end]

            collection.upsert(
                ids=[
                    chunk["chunk_id"]
                    for chunk in batch_chunks
                ],

                documents=[
                    chunk["text"]
                    for chunk in batch_chunks
                ],

                embeddings=batch_vectors,

                metadatas=[
                    chunk["metadata"]
                    for chunk in batch_chunks
                ]
            )

    return {
        "success": True,
        "page_id": page_id,
        "title": page["title"],
        "original_sections": len(
            page["sections"]
        ),
        "total_chunks": len(chunks),
        "embedding_dimension": len(vectors[0]),
        "status": "indexed"
    }
