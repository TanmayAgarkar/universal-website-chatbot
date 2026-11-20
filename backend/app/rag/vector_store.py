
from pathlib import Path
from functools import lru_cache

import chromadb


BASE_DIR = Path(__file__).resolve().parents[2]

CHROMA_PATH = BASE_DIR / "storage" / "chroma"

COLLECTION_NAME = "webmind_pages_minilm_v1"


@lru_cache(maxsize=1)
def get_chroma_client():

    CHROMA_PATH.mkdir(
        parents=True,
        exist_ok=True
    )

    return chromadb.PersistentClient(
        path=str(CHROMA_PATH)
    )


@lru_cache(maxsize=1)
def get_collection():

    client = get_chroma_client()

    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={
            "hnsw:space": "cosine"
        }
    )
