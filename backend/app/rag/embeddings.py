
from functools import lru_cache

from sentence_transformers import (
    SentenceTransformer
)


MODEL_NAME = (
    "sentence-transformers/all-MiniLM-L6-v2"
)


@lru_cache(maxsize=1)
def get_embedding_model():
    print(
        f"Loading embedding model: {MODEL_NAME}"
    )

    model = SentenceTransformer(
        MODEL_NAME,
        device="cpu"
    )

    print("Embedding model loaded.")

    return model


def generate_embeddings(
    texts: list[str]
) -> list[list[float]]:

    if not texts:
        return []

    model = get_embedding_model()

    vectors = model.encode(
        texts,
        batch_size=32,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False
    )

    return vectors.tolist()


def generate_query_embedding(
    query: str
) -> list[float]:

    if not query.strip():
        raise ValueError(
            "Search query cannot be empty."
        )

    model = get_embedding_model()

    vector = model.encode(
        query,
        normalize_embeddings=True,
        convert_to_numpy=True
    )

    return vector.tolist()
