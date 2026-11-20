
from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl


class PageSection(BaseModel):
    section_id: str = Field(
        min_length=1,
        max_length=100
    )

    type: Literal[
        "heading",
        "paragraph",
        "list",
        "table",
        "quote",
        "code",
        "text"
    ]

    heading: str = Field(
        default="",
        max_length=2000
    )

    text: str = Field(
        min_length=1,
        max_length=2000
    )

    selector: str = Field(
        default="",
        max_length=2000
    )

    tag: str = Field(
        default="",
        max_length=30
    )

    data: Any = None


class PageStatistics(BaseModel):
    total_sections: int = Field(ge=0, le=350)
    total_words: int = Field(ge=0)
    total_characters: int = Field(ge=0)

    headings: int = Field(ge=0)
    paragraphs: int = Field(ge=0)
    lists: int = Field(ge=0)
    tables: int = Field(ge=0)

    truncated: bool = False


class PageIngestRequest(BaseModel):
    url: HttpUrl

    domain: str = Field(
        min_length=1,
        max_length=255
    )

    title: str = Field(
        default="Untitled Page",
        max_length=500
    )

    description: str = Field(
        default="",
        max_length=5000
    )

    extracted_at: str

    sections: list[PageSection] = Field(
        min_length=1,
        max_length=350
    )

    full_text: str = Field(
        min_length=1,
        max_length=750000
    )

    statistics: PageStatistics


class PageIngestResponse(BaseModel):
    success: bool

    message: str

    page_id: str

    content_hash: str

    title: str

    total_sections: int

    total_words: int

    status: str




class RAGSearchRequest(BaseModel):
    page_id: str = Field(
        min_length=1,
        max_length=100
    )

    question: str = Field(
        min_length=1,
        max_length=2000
    )

    top_k: int = Field(
        default=5,
        ge=1,
        le=10
    )



class ChatRequest(BaseModel):
    page_id: str = Field(
        min_length=1,
        max_length=100
    )

    question: str = Field(
        min_length=1,
        max_length=2000
    )

    top_k: int = Field(
        default=5,
        ge=1,
        le=10
    )


class ChatSource(BaseModel):
    citation: int
    chunk_id: str
    section_id: str

    heading: str = ""
    selector: str = ""
    url: str = ""

    similarity: float

    excerpt: str


class ChatResponse(BaseModel):
    success: bool

    page_id: str
    question: str
    answer: str

    sources: list[ChatSource]

    model: str | None = None

    grounded: bool
