
"""
==========================================
WebMind AI - FastAPI Backend
Modules 5 through 13
==========================================

Features:
- Webpage ingestion
- SQLite webpage storage
- ChromaDB indexing and semantic retrieval
- Gemini-powered question answering
- Page-specific conversation history
- Context-aware follow-up questions
- Multi-turn conversational memory
- History-aware RAG
- Multi-page knowledge bases
- Cross-webpage question answering
- Knowledge-base conversation history
- PDF upload and text extraction
- PDF embedding and indexing
- PDF-specific Gemini question answering
- PDF page citations
- Persistent PDF conversation history
- PDF document management
- Clickable PDF citation file viewing (Module 13)
"""

from contextlib import asynccontextmanager

import logging
import re

from fastapi import (
    FastAPI,
    HTTPException,
    Query,
    File,
    UploadFile
)

from pydantic import (
    BaseModel,
    Field,
    ValidationError
)

from starlette.concurrency import run_in_threadpool
from fastapi.responses import FileResponse


# ==========================================
# Module 5: Schemas and SQLite Storage
# ==========================================

from .schemas import (
    PageIngestRequest,
    PageIngestResponse,
    RAGSearchRequest,
    ChatRequest,
    ChatResponse
)

from .storage import (
    initialize_database,
    save_page,
    get_page,
    get_page_content
)


# ==========================================
# Module 6: ChromaDB RAG
# ==========================================

from .rag.indexer import index_webpage

from .rag.retriever import search_page

from .rag.vector_store import get_collection


# ==========================================
# Modules 7 and 10: Gemini + Memory
# ==========================================

from .generation.qa_service import (
    answer_webpage_question
)


# ==========================================
# Module 9: Conversation History
# ==========================================

from .history_storage import (
    initialize_history_database,
    get_chat_history,
    delete_chat_history,
    save_chat_exchange,
    page_id_from_url
)


# ==========================================
# Module 11: Knowledge Base Storage
# ==========================================

from .kb_storage import (
    initialize_kb_database,
    create_kb,
    list_kbs,
    get_kb,
    list_kb_pages,
    add_page_to_kb,
    remove_page_from_kb,
    delete_kb,
    get_kb_history,
    clear_kb_history
)


# ==========================================
# Module 11: Cross-Webpage RAG
# ==========================================

from .kb_service import (
    answer_knowledge_base_question
)


# ==========================================
# Module 12: PDF Storage
# ==========================================

from .pdf_storage import (
    PDF_DIR,
    initialize_pdf_database,
    list_documents,
    get_document,
    get_pdf_history,
    clear_pdf_history
)


# ==========================================
# Module 12: PDF RAG Service
# ==========================================

from .pdf_service import (
    MAX_PDF_BYTES,
    upload_pdf_document,
    answer_pdf_question,
    delete_pdf_document
)


# ==========================================
# 1. Logging Configuration
# ==========================================

logger = logging.getLogger("webmind")


# ==========================================
# 2. Application Constants
# ==========================================

APP_VERSION = "0.7.0"

PAGE_ID_PATTERN = re.compile(
    r"^[a-f0-9]{24}$"
)

PDF_ID_PATTERN = re.compile(
    r"^[a-f0-9]{32}$"
)


# ==========================================
# 3. Validate Webpage / Knowledge Base ID
# ==========================================

def validate_page_id(page_id: str):
    """
    Validate a 24-character hexadecimal ID.

    Applies to:
    - Webpage IDs
    - Knowledge base IDs
    """

    if (
        not isinstance(page_id, str)
        or not PAGE_ID_PATTERN.fullmatch(page_id)
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid ID format."
        )


# ==========================================
# 4. Validate PDF Document ID
# ==========================================

def validate_pdf_id(document_id: str):
    """
    Validate a 32-character hexadecimal
    PDF document ID.
    """

    if (
        not isinstance(document_id, str)
        or not PDF_ID_PATTERN.fullmatch(document_id)
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid PDF document ID."
        )


# ==========================================
# 5. Check ChromaDB Indexing Status
# ==========================================

def is_page_indexed(page_id: str) -> bool:
    """
    Check whether the webpage has at least
    one indexed passage in ChromaDB.
    """

    collection = get_collection()

    result = collection.get(
        where={
            "page_id": page_id
        },
        limit=1,
        include=[]
    )

    return len(
        result.get("ids", [])
    ) > 0


# ==========================================
# 6. Application Lifespan
# ==========================================

@asynccontextmanager
async def lifespan(app: FastAPI):

    # Module 5: Webpage storage
    initialize_database()

    # Module 9: Page-specific conversations
    initialize_history_database()

    # Module 11: Multi-page knowledge bases
    initialize_kb_database()

    # Module 12: PDF metadata and conversations
    initialize_pdf_database()

    logger.info(
        "WebMind AI storage initialized."
    )

    yield

    logger.info(
        "WebMind AI backend shutting down."
    )


# ==========================================
# 7. Initialize FastAPI
# ==========================================

app = FastAPI(
    title="WebMind AI API",

    description=(
        "Universal AI browser assistant with "
        "webpage extraction, SQLite storage, "
        "ChromaDB semantic retrieval, "
        "Gemini-powered question answering, "
        "persistent conversational memory, "
        "multi-page knowledge bases, "
        "cross-webpage question answering, "
        "and PDF document question answering."
    ),

    version=APP_VERSION,

    lifespan=lifespan
)


# ==========================================
# Module 5: Health Check
# ==========================================

@app.get("/health")
def health_check():

    return {
        "status": "ok",
        "service": "WebMind AI Backend",
        "version": APP_VERSION,

        "features": {
            "webpage_ingestion": True,
            "sqlite_storage": True,
            "rag_indexing": True,
            "semantic_search": True,
            "gemini_chat": True,
            "conversation_history": True,
            "conversation_restoration": True,
            "multi_turn_memory": True,
            "context_aware_followups": True,
            "history_aware_rag": True,

            # Module 11
            "multi_page_knowledge_base": True,
            "cross_webpage_qa": True,
            "knowledge_base_history": True,

            # Module 12
            "pdf_upload": True,
            "pdf_text_extraction": True,
            "pdf_vector_indexing": True,
            "pdf_question_answering": True,
            "pdf_page_citations": True,
            "pdf_conversation_history": True,
            "pdf_document_management": True,
            "clickable_pdf_citations": True
        }
    }


# ==========================================
# Module 5: Webpage Ingestion
# ==========================================

@app.post(
    "/api/pages/ingest",
    response_model=PageIngestResponse
)
def ingest_page(page: PageIngestRequest):
    """
    Store extracted webpage content
    in SQLite.
    """

    result = save_page(page)

    return PageIngestResponse(
        success=True,
        message="Webpage processed successfully.",
        page_id=result["page_id"],
        content_hash=result["content_hash"],
        title=page.title,
        total_sections=len(page.sections),
        total_words=page.statistics.total_words,
        status=result["status"]
    )


# ==========================================
# Module 5: Retrieve Stored Webpage
# ==========================================

@app.get("/api/pages/{page_id}")
def retrieve_page(page_id: str):

    validate_page_id(page_id)

    page = get_page(page_id)

    if page is None:
        raise HTTPException(
            status_code=404,
            detail="Page not found."
        )

    return page


# ==========================================
# Module 5: Retrieve Webpage Content
# ==========================================

@app.get("/api/pages/{page_id}/content")
def retrieve_page_content(page_id: str):

    validate_page_id(page_id)

    page = get_page_content(page_id)

    if page is None:
        raise HTTPException(
            status_code=404,
            detail="Page not found."
        )

    return page


# ==========================================
# Module 6: Index Webpage in ChromaDB
# ==========================================

@app.post("/api/rag/index/{page_id}")
def index_page(page_id: str):

    validate_page_id(page_id)

    if get_page_content(page_id) is None:
        raise HTTPException(
            status_code=404,
            detail="Page not found in SQLite."
        )

    try:

        result = index_webpage(page_id)

        return result

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except Exception:

        logger.exception(
            "Failed to index page %s",
            page_id
        )

        raise HTTPException(
            status_code=500,
            detail="Webpage indexing failed."
        )


# ==========================================
# Module 6: Semantic Retrieval
# ==========================================

@app.post("/api/rag/search")
def semantic_search(
    request: RAGSearchRequest
):
    """
    Retrieve relevant passages from
    an indexed webpage.
    """

    validate_page_id(request.page_id)

    if get_page(request.page_id) is None:
        raise HTTPException(
            status_code=404,
            detail="Page not found in SQLite."
        )

    try:

        result = search_page(
            page_id=request.page_id,
            question=request.question,
            top_k=request.top_k
        )

        if not result.get("results"):

            raise HTTPException(
                status_code=404,
                detail=(
                    "No indexed passages found. "
                    "Index this webpage first."
                )
            )

        return result

    except HTTPException:
        raise

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except Exception:

        logger.exception(
            "Semantic retrieval failed for page %s",
            request.page_id
        )

        raise HTTPException(
            status_code=500,
            detail="Semantic retrieval failed."
        )


# ==========================================
# Modules 7, 9 and 10:
# Gemini + History-Aware RAG Chat
# ==========================================

@app.post(
    "/api/chat",
    response_model=ChatResponse
)
def chat_with_webpage(request: ChatRequest):
    """
    Single-webpage chat workflow:

    1. Validate webpage.
    2. Load page-specific conversation.
    3. Rewrite contextual follow-up.
    4. Retrieve ChromaDB evidence.
    5. Generate grounded Gemini answer.
    6. Validate response.
    7. Save successful exchange.
    8. Return answer and sources.
    """

    validate_page_id(request.page_id)

    if get_page(request.page_id) is None:

        raise HTTPException(
            status_code=404,
            detail=(
                "Webpage not found. "
                "Analyze and upload it first."
            )
        )

    try:

        result = answer_webpage_question(
            page_id=request.page_id,
            question=request.question,
            top_k=request.top_k
        )

        # Validate before persistence.
        response = ChatResponse(**result)

        # Persist only evidence-backed results.
        if result.get("grounded") is True:

            save_chat_exchange(
                page_id=request.page_id,
                question=request.question,
                answer=result["answer"],
                sources=result.get("sources", [])
            )

            logger.info(
                "Conversation saved for page %s",
                request.page_id
            )

        else:

            logger.info(
                "Ungrounded response not saved "
                "for page %s",
                request.page_id
            )

        return response

    except ValidationError:

        logger.exception(
            "Invalid chat response for page %s",
            request.page_id
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "AI service returned "
                "an invalid response."
            )
        )

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except RuntimeError:

        logger.exception(
            "Gemini runtime error for page %s",
            request.page_id
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "AI answer generation is "
                "temporarily unavailable."
            )
        )

    except Exception:

        logger.exception(
            "History-aware chat failed "
            "for page %s",
            request.page_id
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "Could not complete the chat request. "
                "Check backend logs."
            )
        )


# ==========================================
# Module 9: Restore History by URL
# ==========================================

# IMPORTANT:
# Keep this route before
# /api/history/{page_id}.

@app.get("/api/history/by-url")
def restore_history_by_url(
    url: str = Query(
        min_length=1,
        max_length=4096
    )
):
    """
    Restore conversation history using
    the webpage URL.
    """

    page_id = page_id_from_url(url)

    page = get_page(page_id)

    if page is None:

        return {
            "success": True,
            "found": False,
            "page_id": None,
            "title": None,
            "indexed": False,
            "messages": []
        }

    messages = get_chat_history(page_id)

    try:

        indexed = is_page_indexed(page_id)

    except Exception:

        logger.exception(
            "Could not check indexing status "
            "for page %s",
            page_id
        )

        indexed = False

    return {
        "success": True,
        "found": True,
        "page_id": page_id,
        "title": page["title"],
        "indexed": indexed,
        "messages": messages
    }


# ==========================================
# Module 9: Retrieve Page History
# ==========================================

@app.get("/api/history/{page_id}")
def retrieve_page_history(page_id: str):

    validate_page_id(page_id)

    page = get_page(page_id)

    if page is None:
        raise HTTPException(
            status_code=404,
            detail="Webpage not found."
        )

    messages = get_chat_history(page_id)

    try:

        indexed = is_page_indexed(page_id)

    except Exception:

        logger.exception(
            "Could not check indexing status "
            "for page %s",
            page_id
        )

        indexed = False

    return {
        "success": True,
        "page_id": page_id,
        "title": page["title"],
        "indexed": indexed,
        "messages": messages
    }


# ==========================================
# Modules 9 and 10:
# Delete Page Conversation and Memory
# ==========================================

@app.delete("/api/history/{page_id}")
def clear_page_history(page_id: str):
    """
    Delete stored conversation history.

    Webpage content and ChromaDB vectors
    are preserved.
    """

    validate_page_id(page_id)

    page = get_page(page_id)

    if page is None:

        raise HTTPException(
            status_code=404,
            detail="Webpage not found."
        )

    try:

        result = delete_chat_history(page_id)

        logger.info(
            "Deleted %s messages for page %s",
            result["deleted_messages"],
            page_id
        )

        return result

    except Exception:

        logger.exception(
            "Failed to clear conversation "
            "for page %s",
            page_id
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not clear "
                "conversation history."
            )
        )


# ==========================================
# Module 11: Pydantic Request Models
# ==========================================

class CreateKBRequest(BaseModel):
    """
    Create a named knowledge base.
    """

    name: str = Field(
        min_length=1,
        max_length=100
    )


class AddKBPageRequest(BaseModel):
    """
    Add an existing webpage to a collection.
    """

    page_id: str = Field(
        min_length=24,
        max_length=24
    )


class KBChatRequest(BaseModel):
    """
    Ask a question across the webpages
    in a knowledge base.
    """

    kb_id: str = Field(
        min_length=24,
        max_length=24
    )

    question: str = Field(
        min_length=1,
        max_length=2000
    )

    top_k_per_page: int = Field(
        default=3,
        ge=1,
        le=5
    )


# ==========================================
# Module 11: Create Knowledge Base
# ==========================================

@app.post("/api/kb/collections")
def create_knowledge_base(
    request: CreateKBRequest
):
    """
    Create a named collection.
    """

    try:

        result = create_kb(
            request.name
        )

        logger.info(
            "Knowledge base created: %s",
            result["id"]
        )

        return result

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


# ==========================================
# Module 11: List Knowledge Bases
# ==========================================

@app.get("/api/kb/collections")
def list_knowledge_bases():

    collections = list_kbs()

    return {
        "success": True,
        "collections": collections
    }


# ==========================================
# Module 11: Retrieve Knowledge Base
# ==========================================

@app.get("/api/kb/collections/{kb_id}")
def retrieve_knowledge_base(kb_id: str):

    validate_page_id(kb_id)

    kb = get_kb(kb_id)

    if kb is None:

        raise HTTPException(
            status_code=404,
            detail="Knowledge base not found."
        )

    pages = list_kb_pages(kb_id)

    return {
        "success": True,
        "collection": kb,
        "pages": pages
    }


# ==========================================
# Module 11: Add Webpage to Knowledge Base
# ==========================================

@app.post(
    "/api/kb/collections/{kb_id}/pages"
)
def add_knowledge_base_page(
    kb_id: str,
    request: AddKBPageRequest
):
    """
    Add a previously stored webpage
    to an existing collection.
    """

    validate_page_id(kb_id)
    validate_page_id(request.page_id)

    if get_kb(kb_id) is None:

        raise HTTPException(
            status_code=404,
            detail="Knowledge base not found."
        )

    if get_page(request.page_id) is None:

        raise HTTPException(
            status_code=404,
            detail=(
                "Webpage not found. "
                "Upload it before adding it."
            )
        )

    try:

        result = add_page_to_kb(
            kb_id,
            request.page_id
        )

        logger.info(
            "Page %s added to knowledge base %s",
            request.page_id,
            kb_id
        )

        return result

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


# ==========================================
# Module 11: Remove Webpage from KB
# ==========================================

@app.delete(
    "/api/kb/collections/{kb_id}/pages/{page_id}"
)
def remove_knowledge_base_page(
    kb_id: str,
    page_id: str
):
    """
    Remove a webpage from a collection.

    Its original SQLite and ChromaDB
    records remain available.
    """

    validate_page_id(kb_id)
    validate_page_id(page_id)

    if get_kb(kb_id) is None:

        raise HTTPException(
            status_code=404,
            detail="Knowledge base not found."
        )

    try:

        result = remove_page_from_kb(
            kb_id,
            page_id
        )

        logger.info(
            "Page %s removal requested from KB %s",
            page_id,
            kb_id
        )

        return result

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


# ==========================================
# Module 11: Delete Knowledge Base
# ==========================================

@app.delete("/api/kb/collections/{kb_id}")
def delete_knowledge_base(kb_id: str):
    """
    Delete a knowledge base, its memberships,
    and its collection conversation history.

    Original webpages remain stored.
    """

    validate_page_id(kb_id)

    if get_kb(kb_id) is None:

        raise HTTPException(
            status_code=404,
            detail="Knowledge base not found."
        )

    try:

        result = delete_kb(kb_id)

        logger.info(
            "Knowledge base deleted: %s",
            kb_id
        )

        return result

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


# ==========================================
# Module 11: Cross-Webpage Chat
# ==========================================

@app.post("/api/kb/chat")
def chat_with_knowledge_base(
    request: KBChatRequest
):
    """
    Search multiple saved webpages,
    use collection-specific memory,
    and generate a Gemini answer.
    """

    validate_page_id(request.kb_id)

    if get_kb(request.kb_id) is None:

        raise HTTPException(
            status_code=404,
            detail="Knowledge base not found."
        )

    try:

        result = answer_knowledge_base_question(
            kb_id=request.kb_id,
            question=request.question,
            top_k_per_page=request.top_k_per_page
        )

        logger.info(
            "Knowledge base chat completed for %s",
            request.kb_id
        )

        return result

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except RuntimeError:

        logger.exception(
            "Knowledge base Gemini generation failed."
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "AI generation is "
                "temporarily unavailable."
            )
        )

    except Exception:

        logger.exception(
            "Cross-webpage chat failed for KB %s",
            request.kb_id
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "Knowledge base chat failed. "
                "Check backend logs."
            )
        )


# ==========================================
# Module 11: Restore KB Conversation
# ==========================================

@app.get(
    "/api/kb/collections/{kb_id}/history"
)
def retrieve_kb_history(kb_id: str):

    validate_page_id(kb_id)

    if get_kb(kb_id) is None:

        raise HTTPException(
            status_code=404,
            detail="Knowledge base not found."
        )

    messages = get_kb_history(kb_id)

    return {
        "success": True,
        "kb_id": kb_id,
        "messages": messages
    }


# ==========================================
# Module 11: Clear KB Conversation Memory
# ==========================================

@app.delete(
    "/api/kb/collections/{kb_id}/history"
)
def delete_kb_conversation(kb_id: str):
    """
    Clear collection history without
    deleting its stored webpages.
    """

    validate_page_id(kb_id)

    if get_kb(kb_id) is None:

        raise HTTPException(
            status_code=404,
            detail="Knowledge base not found."
        )

    try:

        result = clear_kb_history(kb_id)

        logger.info(
            "Knowledge base conversation cleared: %s",
            kb_id
        )

        return result

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except Exception:

        logger.exception(
            "Failed to clear KB history for %s",
            kb_id
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not clear "
                "knowledge base history."
            )
        )


# ==========================================
# Module 12: PDF Chat Request Model
# ==========================================

class PDFChatRequest(BaseModel):
    """
    Ask a question about one uploaded PDF.

    PDF IDs are 32-character hexadecimal
    identifiers generated from file contents.
    """

    document_id: str = Field(
        min_length=32,
        max_length=32
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


# ==========================================
# Module 12: Upload and Index PDF
# ==========================================

@app.post("/api/pdf/upload")
async def upload_pdf(
    file: UploadFile = File(...)
):
    """
    Upload a text-based PDF.

    Steps:
    1. Validate filename and content type.
    2. Enforce 10 MB upload limit.
    3. Extract PDF text using PyMuPDF.
    4. Create page-aware chunks.
    5. Generate embeddings.
    6. Index chunks in ChromaDB.
    7. Store PDF metadata in SQLite.
    """

    filename = file.filename or ""

    if not filename.lower().endswith(".pdf"):

        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported."
        )

    if (
        file.content_type
        not in (
            "application/pdf",
            "application/octet-stream"
        )
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid PDF content type."
        )

    try:

        # Read at most 10 MB plus one byte
        # to detect an oversized upload.
        contents = await file.read(
            MAX_PDF_BYTES + 1
        )

        if len(contents) > MAX_PDF_BYTES:

            raise HTTPException(
                status_code=413,
                detail="PDF exceeds the 10 MB limit."
            )

        if not contents.startswith(b"%PDF-"):

            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid PDF file signature."
                )
            )

        # PDF extraction, embedding, and
        # ChromaDB indexing are synchronous.
        #
        # Run them in a worker thread rather
        # than blocking the FastAPI event loop.
        result = await run_in_threadpool(
            upload_pdf_document,
            filename,
            contents
        )

        logger.info(
            "PDF upload processed successfully: %s",
            result["document"]["id"]
        )

        return result

    except HTTPException:
        raise

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except Exception:

        logger.exception(
            "PDF upload or indexing failed."
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to process or index PDF."
            )
        )

    finally:

        await file.close()


# ==========================================
# Module 12: List Uploaded PDFs
# ==========================================

@app.get("/api/pdf/documents")
def get_pdf_documents():
    """
    Return all saved PDF metadata.

    This endpoint does not return
    the original PDF file bytes.
    """

    documents = list_documents()

    return {
        "success": True,
        "documents": documents
    }


# ==========================================
# Module 12: Retrieve PDF Metadata
# ==========================================

@app.get("/api/pdf/documents/{document_id}")
def get_pdf_details(document_id: str):
    """
    Return information about one PDF.
    """

    validate_pdf_id(document_id)

    document = get_document(document_id)

    if document is None:

        raise HTTPException(
            status_code=404,
            detail="PDF document not found."
        )

    return {
        "success": True,
        "document": document
    }


# ==========================================
# Module 12: Ask Questions About PDF
# ==========================================

@app.post("/api/pdf/chat")
def chat_with_pdf(
    request: PDFChatRequest
):
    """
    PDF-specific RAG workflow:

    1. Validate document.
    2. Load previous PDF conversation.
    3. Rewrite contextual follow-up.
    4. Retrieve relevant PDF passages.
    5. Generate Gemini answer.
    6. Validate citation references.
    7. Save successful exchange.
    8. Return answer and page citations.
    """

    validate_pdf_id(request.document_id)

    document = get_document(
        request.document_id
    )

    if document is None:

        raise HTTPException(
            status_code=404,
            detail=(
                "PDF document not found. "
                "Upload it first."
            )
        )

    try:

        result = answer_pdf_question(
            document_id=request.document_id,
            question=request.question,
            top_k=request.top_k
        )

        logger.info(
            "PDF question answering completed "
            "for document %s",
            request.document_id
        )

        return result

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except RuntimeError:

        logger.exception(
            "PDF question answering runtime error."
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "PDF AI service is "
                "temporarily unavailable."
            )
        )

    except Exception:

        logger.exception(
            "Unexpected PDF chat error "
            "for document %s",
            request.document_id
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "PDF chat request failed. "
                "Check backend logs."
            )
        )


# ==========================================
# Module 12: Restore PDF Conversation
# ==========================================

@app.get(
    "/api/pdf/documents/{document_id}/history"
)
def restore_pdf_history(document_id: str):
    """
    Restore the saved conversation
    associated with one PDF.
    """

    validate_pdf_id(document_id)

    if get_document(document_id) is None:

        raise HTTPException(
            status_code=404,
            detail="PDF document not found."
        )

    messages = get_pdf_history(
        document_id
    )

    return {
        "success": True,
        "document_id": document_id,
        "messages": messages
    }


# ==========================================
# Module 12: Clear PDF Conversation
# ==========================================

@app.delete(
    "/api/pdf/documents/{document_id}/history"
)
def delete_pdf_history(document_id: str):
    """
    Delete PDF conversation history.

    Preserve PDF metadata, original file,
    and ChromaDB embeddings.
    """

    validate_pdf_id(document_id)

    if get_document(document_id) is None:

        raise HTTPException(
            status_code=404,
            detail="PDF document not found."
        )

    try:

        result = clear_pdf_history(
            document_id
        )

        logger.info(
            "PDF conversation cleared "
            "for document %s",
            document_id
        )

        return result

    except Exception:

        logger.exception(
            "Failed to clear PDF history "
            "for document %s",
            document_id
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not clear "
                "PDF conversation history."
            )
        )


# ==========================================
# Module 12: Delete PDF Document
# ==========================================

@app.delete(
    "/api/pdf/documents/{document_id}"
)
def remove_pdf_document(document_id: str):
    """
    Delete PDF document, metadata,
    associated history, stored file,
    and indexed vectors.

    Page Chat and Knowledge Base data
    are not affected.
    """

    validate_pdf_id(document_id)

    if get_document(document_id) is None:

        raise HTTPException(
            status_code=404,
            detail="PDF document not found."
        )

    try:

        result = delete_pdf_document(
            document_id
        )

        logger.info(
            "PDF document deleted: %s",
            document_id
        )

        return result

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except Exception:

        logger.exception(
            "Failed to delete PDF document %s",
            document_id
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not delete PDF document."
            )
        )


# ==========================================
# Module 13: Open Uploaded PDF for Citations
# ==========================================

@app.get(
    "/api/pdf/documents/{document_id}/file"
)
def view_pdf_document(document_id: str):
    """
    Serve a stored PDF inline in the browser.

    Append #page=N (where N is 1-based) on the
    client to request a specific PDF viewer page.
    The hash fragment is handled by the browser,
    not passed to this FastAPI endpoint.
    """

    validate_pdf_id(document_id)

    document = get_document(document_id)

    if document is None:
        raise HTTPException(
            status_code=404,
            detail="PDF document not found."
        )

    file_path = PDF_DIR / f"{document_id}.pdf"

    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="PDF file is missing."
        )

    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename="webmind-document.pdf",
        content_disposition_type="inline",
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff"
        }
    )
