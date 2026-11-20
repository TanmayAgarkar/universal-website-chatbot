
from .embeddings import generate_query_embedding

from .vector_store import get_collection


def search_page(
    page_id: str,
    question: str,
    top_k: int = 5
) -> dict:

    if not question.strip():
        raise ValueError(
            "Question cannot be empty."
        )

    collection = get_collection()

    question_vector = generate_query_embedding(
        question
    )

    results = collection.query(
        query_embeddings=[question_vector],

        n_results=top_k,

        where={
            "page_id": page_id
        },

        include=[
            "documents",
            "metadatas",
            "distances"
        ]
    )

    documents = results["documents"][0]
    metadatas = results["metadatas"][0]
    distances = results["distances"][0]
    ids = results["ids"][0]

    matches = []

    for index, document in enumerate(documents):

        metadata = metadatas[index] or {}
        distance = float(distances[index])

        matches.append({
            "rank": index + 1,

            "chunk_id": ids[index],

            "text": document,

            "heading": metadata.get(
                "heading", ""
            ),

            "section_id": metadata.get(
                "section_id", ""
            ),

            "selector": metadata.get(
                "selector", ""
            ),

            "url": metadata.get(
                "url", ""
            ),

            "distance": distance,

            "similarity": max(
                0.0,
                min(1.0, 1.0 - distance)
            )
        })

    return {
        "page_id": page_id,
        "question": question,
        "total_results": len(matches),
        "results": matches
    }
