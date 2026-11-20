
import hashlib

from langchain_text_splitters import (
    RecursiveCharacterTextSplitter
)

CHUNK_SIZE = 700
CHUNK_OVERLAP = 100


splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    separators=[
        "\n\n",
        "\n",
        ". ",
        " ",
        ""
    ],
    length_function=len
)


def make_chunk_id(
    page_id: str,
    section_id: str,
    chunk_index: int
) -> str:

    raw = (
        f"{page_id}|{section_id}|"
        f"{chunk_index}"
    )

    return hashlib.sha256(
        raw.encode("utf-8")
    ).hexdigest()


def create_page_chunks(page: dict) -> list[dict]:
    chunks = []

    page_id = page["page_id"]

    for section in page["sections"]:

        text = section.get("text", "").strip()

        if not text:
            continue

        section_id = section["section_id"]
        heading = section.get("heading", "")
        section_type = section.get("type", "text")
        selector = section.get("selector", "")

        # Preserve short headings as metadata.
        # Avoid indexing a heading by itself when
        # it can be attached to following content.
        if section_type == "heading":
            continue

        pieces = splitter.split_text(text)

        for index, piece in enumerate(pieces):

            content = piece.strip()

            if not content:
                continue

            # Include heading context in the text
            # used for embedding.
            if heading:
                embedding_text = (
                    f"Section: {heading}\n\n"
                    f"{content}"
                )
            else:
                embedding_text = content

            chunk_id = make_chunk_id(
                page_id,
                section_id,
                index
            )

            chunks.append({
                "chunk_id": chunk_id,

                "text": embedding_text,

                "metadata": {
                    "page_id": page_id,
                    "url": page["url"],
                    "title": page["title"],
                    "section_id": section_id,
                    "heading": heading,
                    "selector": selector,
                    "type": section_type,
                    "chunk_index": index
                }
            })

    return chunks
