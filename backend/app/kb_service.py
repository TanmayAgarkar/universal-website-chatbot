
"""
==========================================
WebMind AI - Module 11
Cross-Webpage Retrieval and Answer Generation
==========================================

Features:
- Multi-page knowledge-base retrieval
- Collection-specific conversational memory
- Context-aware follow-up rewriting
- Query-rewriting fallback
- ChromaDB semantic retrieval
- Round-robin evidence selection
- Multi-webpage Gemini answer generation
- Source citation validation
- Webpage source metadata
- SQLite conversation persistence
- Partial retrieval failure handling
"""

import logging
import re

from .kb_storage import (
    get_kb,
    list_kb_pages,
    get_kb_history,
    save_kb_exchange
)

from .generation.gemini_client import (
    GEMINI_MODEL,
    rewrite_followup_question,
    generate_knowledge_base_answer
)

from .rag.retriever import search_page


# ==========================================
# 1. Logging
# ==========================================

logger = logging.getLogger("webmind.kb")


# ==========================================
# 2. Configuration
# ==========================================

MAX_HISTORY_MESSAGES = 8

MAX_HISTORY_MESSAGE_CHARS = 1000

MAX_EVIDENCE_SOURCES = 10

MAX_EVIDENCE_CHARS = 14000

MAX_CHARS_PER_SOURCE = 1100


# ==========================================
# 3. Format Knowledge Base Memory
# ==========================================

def format_kb_memory(messages):
    """
    Format recent conversation messages
    belonging to a particular knowledge base.

    This ensures that conversations from
    different knowledge bases remain separate.

    Example:

    User: What is Test cricket?

    Assistant: Test cricket is a format
    of international cricket.

    User: How is it different from ODI?
    """

    if not messages:
        return "No previous conversation."

    parts = []

    recent_messages = messages[
        -MAX_HISTORY_MESSAGES:
    ]

    for message in recent_messages:

        role = (
            "User"
            if message.get("role") == "user"
            else "Assistant"
        )

        content = str(
            message.get("content") or ""
        ).strip()

        if not content:
            continue

        # Prevent excessively long messages
        # from increasing the Gemini prompt size.
        content = content[
            :MAX_HISTORY_MESSAGE_CHARS
        ]

        parts.append(
            f"{role}: {content}"
        )

    if not parts:
        return "No previous conversation."

    return "\n\n".join(parts)


# ==========================================
# 4. Validate Source Citations
# ==========================================

def validate_citations(
    answer: str,
    source_count: int
):
    """
    Validate numeric citations in the
    generated answer.

    Only citations corresponding to actual
    retrieved sources are retained.

    Example:

    Available sources: [1], [2], [3]

    Answer:
        Test cricket lasts up to five days [1].
        ODI cricket has 50 overs [2].
        Additional information [7].

    After validation:
        Test cricket lasts up to five days [1].
        ODI cricket has 50 overs [2].
        Additional information.

    Important:
    This validates citation numbers only.
    It does not prove that a source supports
    the associated factual statement.
    """

    if not isinstance(answer, str):
        raise ValueError(
            "Answer must be a string."
        )

    def replace_citation(match):

        citation_number = int(
            match.group(1)
        )

        if (
            1 <= citation_number <= source_count
        ):
            return match.group(0)

        return ""

    return re.sub(
        r"\[(\d+)\]",
        replace_citation,
        answer
    ).strip()


# ==========================================
# 5. Collect Cross-Webpage Evidence
# ==========================================

def collect_kb_evidence(
    pages,
    question,
    top_k_per_page=3
):
    """
    Search every webpage in the knowledge base.

    Each webpage is searched independently
    using its page_id.

    A round-robin selection strategy is used
    so multiple webpages can contribute
    evidence to the final answer.

    Returns:
        retrieved_context
        sources
        warnings
    """

    grouped_results = []

    warnings = []

    # --------------------------------------
    # Step 1: Retrieve from Each Webpage
    # --------------------------------------

    for page in pages:

        page_id = page["page_id"]

        try:

            result = search_page(
                page_id=page_id,
                question=question,
                top_k=top_k_per_page
            )

            matches = result.get(
                "results",
                []
            )

            grouped_results.append(
                (page, matches)
            )

            logger.info(
                "Retrieved %d passages from page %s",
                len(matches),
                page_id
            )

            if not matches:

                warnings.append({
                    "page_id": page_id,
                    "reason": (
                        "No indexed passages found "
                        "for this webpage."
                    )
                })

        except Exception:

            logger.exception(
                "Cross-page retrieval failed "
                "for page %s",
                page_id
            )

            warnings.append({
                "page_id": page_id,
                "reason": (
                    "Retrieval failed or "
                    "page is not indexed."
                )
            })

    # --------------------------------------
    # Step 2: Initialize Evidence Containers
    # --------------------------------------

    context_parts = []

    sources = []

    total_chars = 0

    # Determine the maximum number of
    # retrieved passages from any webpage.
    max_depth = max(
        (
            len(matches)
            for _, matches in grouped_results
        ),
        default=0
    )

    # --------------------------------------
    # Step 3: Round-Robin Evidence Selection
    # --------------------------------------

    for depth in range(max_depth):

        for page, matches in grouped_results:

            # Stop when the maximum number
            # of evidence sources is reached.
            if (
                len(sources)
                >= MAX_EVIDENCE_SOURCES
            ):
                break

            if depth >= len(matches):
                continue

            match = matches[depth]

            # --------------------------------
            # Extract Passage Text
            # --------------------------------

            excerpt = str(
                match.get("text") or ""
            ).strip()

            if not excerpt:
                continue

            excerpt = excerpt[
                :MAX_CHARS_PER_SOURCE
            ]

            # --------------------------------
            # Generate Citation Number
            # --------------------------------

            citation = len(sources) + 1

            # --------------------------------
            # Extract Source Metadata
            # --------------------------------

            heading = str(
                match.get("heading")
                or "Untitled Section"
            )

            page_title = str(
                page.get("title")
                or "Untitled Webpage"
            )

            page_url = str(
                page.get("url")
                or ""
            )

            # --------------------------------
            # Build Numbered Evidence Passage
            # --------------------------------

            passage = (
                f"[{citation}]\n"
                f"Webpage title: {page_title}\n"
                f"Webpage URL: {page_url}\n"
                f"Section: {heading}\n"
                f"Evidence:\n{excerpt}"
            )

            # --------------------------------
            # Enforce Prompt Context Limit
            # --------------------------------

            if (
                total_chars + len(passage)
                > MAX_EVIDENCE_CHARS
            ):
                continue

            context_parts.append(
                passage
            )

            total_chars += len(passage)

            # --------------------------------
            # Build Source Metadata
            # --------------------------------

            sources.append({
                "citation": citation,

                "page_id": page["page_id"],

                "page_title": page_title,

                "url": page_url,

                "chunk_id": (
                    match.get("chunk_id")
                    or ""
                ),

                "section_id": (
                    match.get("section_id")
                    or ""
                ),

                "heading": heading,

                "selector": (
                    match.get("selector")
                    or ""
                ),

                "similarity": float(
                    match.get("similarity")
                    or 0
                ),

                "excerpt": excerpt[:400]
            })

        if (
            len(sources)
            >= MAX_EVIDENCE_SOURCES
        ):
            break

    # --------------------------------------
    # Step 4: Combine Retrieved Passages
    # --------------------------------------

    retrieved_context = "\n\n".join(
        context_parts
    )

    logger.info(
        "Prepared %d evidence sources "
        "from %d knowledge-base webpages.",
        len(sources),
        len(pages)
    )

    return (
        retrieved_context,
        sources,
        warnings
    )


# ==========================================
# 6. Main Knowledge Base RAG Pipeline
# ==========================================

def answer_knowledge_base_question(
    kb_id,
    question,
    top_k_per_page=3
):
    """
    Main Module 11 question-answering workflow.

    Steps:

    1. Validate user question.
    2. Verify knowledge base exists.
    3. Load associated webpages.
    4. Load collection-specific history.
    5. Rewrite contextual follow-up.
    6. Search each webpage in ChromaDB.
    7. Combine retrieved webpage passages.
    8. Generate multi-webpage Gemini answer.
    9. Validate source citation numbers.
    10. Save conversation to SQLite.
    11. Return structured answer and sources.
    """

    # ======================================
    # Step 1: Validate Input
    # ======================================

    if not isinstance(question, str):
        raise ValueError(
            "Question must be a string."
        )

    question = question.strip()

    if not 1 <= len(question) <= 2000:
        raise ValueError(
            "Question must contain "
            "1 to 2000 characters."
        )

    if not 1 <= top_k_per_page <= 5:
        raise ValueError(
            "top_k_per_page must be "
            "between 1 and 5."
        )

    # ======================================
    # Step 2: Verify Knowledge Base
    # ======================================

    knowledge_base = get_kb(
        kb_id
    )

    if knowledge_base is None:
        raise ValueError(
            "Knowledge base not found."
        )

    logger.info(
        "Processing knowledge base query: %s",
        kb_id
    )

    # ======================================
    # Step 3: Load Knowledge Base Webpages
    # ======================================

    pages = list_kb_pages(
        kb_id
    )

    if not pages:
        raise ValueError(
            "Knowledge base contains no webpages. "
            "Add an indexed webpage first."
        )

    logger.info(
        "Knowledge base %s contains %d webpages.",
        kb_id,
        len(pages)
    )

    # ======================================
    # Step 4: Load Collection Conversation
    # ======================================

    # Only messages belonging to this
    # knowledge base are retrieved.
    previous_messages = get_kb_history(
        kb_id,
        limit=MAX_HISTORY_MESSAGES
    )

    memory = format_kb_memory(
        previous_messages
    )

    logger.info(
        "Loaded %d conversation messages "
        "for knowledge base %s.",
        len(previous_messages),
        kb_id
    )

    # ======================================
    # Step 5: Rewrite Follow-Up Question
    # ======================================

    try:

        retrieval_question = (
            rewrite_followup_question(
                question=question,
                conversation_history=memory
            )
        )

        if not retrieval_question.strip():
            retrieval_question = question

    except Exception:

        logger.warning(
            "Knowledge base query rewriting "
            "failed. Using original question.",
            exc_info=True
        )

        retrieval_question = question

    # ======================================
    # Step 6: Retrieve Cross-Webpage Evidence
    # ======================================

    context, sources, warnings = (
        collect_kb_evidence(
            pages=pages,
            question=retrieval_question,
            top_k_per_page=top_k_per_page
        )
    )

    # ======================================
    # Step 7: Handle Missing Evidence
    # ======================================

    if not sources:

        return {
            "success": True,

            "kb_id": kb_id,

            "question": question,

            "answer": (
                "I couldn't find usable indexed "
                "evidence in this knowledge base. "
                "Please make sure its webpages "
                "have been indexed before asking "
                "questions."
            ),

            "sources": [],

            "warnings": warnings,

            "model": GEMINI_MODEL,

            "grounded": False
        }

    # ======================================
    # Step 8: Generate Multi-Webpage Answer
    # ======================================

    # Module 11 uses the dedicated
    # multi-webpage Gemini function.
    #
    # The original Module 10 single-page
    # function remains unchanged.

    answer = generate_knowledge_base_answer(
        question=question,
        standalone_question=retrieval_question,
        conversation_history=memory,
        retrieved_context=context
    )

    # ======================================
    # Step 9: Validate Source Citations
    # ======================================

    answer = validate_citations(
        answer=answer,
        source_count=len(sources)
    )

    if not answer:
        raise RuntimeError(
            "Gemini returned an empty answer "
            "after citation validation."
        )

    # ======================================
    # Step 10: Save Collection Conversation
    # ======================================

    # The new conversation is saved only
    # AFTER answer generation.
    #
    # Therefore, the current question does
    # not appear in its own memory context.

    save_kb_exchange(
        kb_id=kb_id,
        question=question,
        answer=answer,
        sources=sources
    )

    logger.info(
        "Knowledge base conversation saved "
        "for collection %s.",
        kb_id
    )

    # ======================================
    # Step 11: Return Structured Result
    # ======================================

    return {
        "success": True,

        "kb_id": kb_id,

        "question": question,

        "answer": answer,

        "sources": sources,

        "warnings": warnings,

        "model": GEMINI_MODEL,

        "grounded": True
    }
