
"""
WebMind AI - Question Answering Service
Module 10: History-Aware RAG

Features:
- Page-specific conversational memory
- Context-aware follow-up rewriting
- ChromaDB semantic retrieval
- Grounded Gemini answer generation
- Consistent source citation mapping
- Query rewriting fallback
"""

import logging
import re

from .gemini_client import (
    GEMINI_MODEL,
    rewrite_followup_question,
    generate_grounded_answer
)

from .memory_service import (
    load_conversation_memory,
    format_conversation_memory
)

from ..rag.retriever import search_page
from ..storage import get_page


# ==========================================
# Configuration
# ==========================================

MAX_SOURCE_CHARACTERS = 1800
MAX_CONTEXT_CHARACTERS = 12000

logger = logging.getLogger("webmind.qa")


# ==========================================
# Prepare Evidence and Source Metadata
# ==========================================

def prepare_evidence(results):
    """
    Build the numbered Gemini context and
    corresponding source metadata together.

    Only sources actually included in the
    context are returned.
    """

    passages = []
    sources = []

    total_characters = 0

    for match in results:

        heading = str(
            match.get("heading")
            or "Untitled Section"
        )

        text = str(
            match.get("text")
            or ""
        ).strip()

        if not text:
            continue

        text = text[:MAX_SOURCE_CHARACTERS]

        citation_number = len(sources) + 1

        passage = (
            f"[{citation_number}]\n"
            f"Heading: {heading}\n"
            f"Webpage passage:\n{text}"
        )

        if (
            total_characters + len(passage)
            > MAX_CONTEXT_CHARACTERS
        ):
            break

        passages.append(passage)
        total_characters += len(passage)

        sources.append({
            "citation": citation_number,
            "chunk_id": match.get("chunk_id") or "",
            "section_id": match.get("section_id") or "",
            "heading": heading,
            "selector": match.get("selector") or "",
            "url": match.get("url") or "",
            "similarity": float(
                match.get("similarity") or 0
            ),
            "excerpt": text[:400]
        })

    retrieved_context = "\n\n".join(
        passages
    )

    return retrieved_context, sources


# ==========================================
# Validate Citation Numbers
# ==========================================

def validate_citations(
    answer: str,
    source_count: int
):
    """
    Remove numeric citations referring to
    sources that were not provided to Gemini.

    This validates citation numbering, not
    whether a source supports a factual claim.
    """

    def replace_citation(match):

        citation_number = int(
            match.group(1)
        )

        if 1 <= citation_number <= source_count:
            return match.group(0)

        return ""

    return re.sub(
        r"\[(\d+)\]",
        replace_citation,
        answer
    ).strip()


# ==========================================
# Main History-Aware RAG Pipeline
# ==========================================

def answer_webpage_question(
    page_id: str,
    question: str,
    top_k: int = 5
):

    # --------------------------------------
    # Step 1: Validate Inputs
    # --------------------------------------

    if not isinstance(question, str):
        raise ValueError(
            "Question must be a string."
        )

    question = question.strip()

    if not question:
        raise ValueError(
            "Question cannot be empty."
        )

    if not 1 <= top_k <= 10:
        raise ValueError(
            "top_k must be between 1 and 10."
        )

    # --------------------------------------
    # Step 2: Verify Webpage Exists
    # --------------------------------------

    page = get_page(page_id)

    if page is None:
        raise ValueError(
            "Webpage not found in SQLite."
        )

    # --------------------------------------
    # Step 3: Load Page-Specific History
    # --------------------------------------

    recent_messages = load_conversation_memory(
        page_id
    )

    conversation_history = (
        format_conversation_memory(
            recent_messages
        )
    )

    logger.info(
        "Loaded %d history messages for page %s",
        len(recent_messages),
        page_id
    )

    # --------------------------------------
    # Step 4: Rewrite Follow-Up Question
    # --------------------------------------

    try:

        standalone_question = (
            rewrite_followup_question(
                question=question,
                conversation_history=(
                    conversation_history
                )
            )
        )

    except Exception:

        logger.warning(
            "Query rewriting failed; "
            "falling back to original question.",
            exc_info=True
        )

        standalone_question = question

    # --------------------------------------
    # Step 5: Retrieve Current-Page Evidence
    # --------------------------------------

    retrieval = search_page(
        page_id=page_id,
        question=standalone_question,
        top_k=top_k
    )

    matches = retrieval.get(
        "results",
        []
    )

    if not matches:

        return {
            "success": True,
            "page_id": page_id,
            "question": question,
            "answer": (
                "I couldn't find any indexed "
                "passages for this webpage. "
                "Please analyze and index "
                "the webpage first."
            ),
            "sources": [],
            "model": GEMINI_MODEL,
            "grounded": False
        }

    # --------------------------------------
    # Step 6: Prepare Context and Sources
    # --------------------------------------

    retrieved_context, sources = (
        prepare_evidence(matches)
    )

    if not retrieved_context:
        return {
            "success": True,
            "page_id": page_id,
            "question": question,
            "answer": (
                "I couldn't find usable webpage "
                "evidence for this question."
            ),
            "sources": [],
            "model": GEMINI_MODEL,
            "grounded": False
        }

    # --------------------------------------
    # Step 7: Generate History-Aware Answer
    # --------------------------------------

    answer = generate_grounded_answer(
        question=question,
        standalone_question=(
            standalone_question
        ),
        conversation_history=(
            conversation_history
        ),
        retrieved_context=(
            retrieved_context
        )
    )

    # --------------------------------------
    # Step 8: Validate Citation References
    # --------------------------------------

    answer = validate_citations(
        answer=answer,
        source_count=len(sources)
    )

    # --------------------------------------
    # Step 9: Return Result
    # --------------------------------------

    logger.info(
        "Generated answer for page %s "
        "using %d retrieved sources.",
        page_id,
        len(sources)
    )

    return {
        "success": True,
        "page_id": page_id,
        "question": question,
        "answer": answer,
        "sources": sources,
        "model": GEMINI_MODEL,
        "grounded": True
    }
