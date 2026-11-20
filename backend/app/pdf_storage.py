
"""
WebMind AI - Module 12
PDF Metadata and Conversation Storage
"""

import json
import sqlite3
import uuid
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]

DATA_DIR = BASE_DIR / "data"

PDF_DIR = DATA_DIR / "pdf_documents"

DATABASE_PATH = DATA_DIR / "pdf_documents.sqlite3"


def get_connection():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PDF_DIR.mkdir(parents=True, exist_ok=True)

    db = sqlite3.connect(
        str(DATABASE_PATH),
        timeout=30
    )

    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    db.execute("PRAGMA busy_timeout = 30000")

    return db


def initialize_pdf_database():

    with get_connection() as db:

        db.execute("""
            CREATE TABLE IF NOT EXISTS pdf_documents (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                page_count INTEGER NOT NULL,
                chunk_count INTEGER NOT NULL,
                created_at TEXT NOT NULL
                    DEFAULT CURRENT_TIMESTAMP
            )
        """)

        db.execute("""
            CREATE TABLE IF NOT EXISTS pdf_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id TEXT NOT NULL,
                role TEXT NOT NULL
                    CHECK(role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                sources_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL
                    DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY(document_id)
                    REFERENCES pdf_documents(id)
                    ON DELETE CASCADE
            )
        """)

        db.execute("""
            CREATE INDEX IF NOT EXISTS
            idx_pdf_messages_document
            ON pdf_messages(document_id, id)
        """)


def create_document(
    filename,
    page_count,
    chunk_count,
    document_id=None
):

    document_id = (
        document_id or uuid.uuid4().hex
    )

    with get_connection() as db:

        db.execute("""
            INSERT INTO pdf_documents(
                id, filename, page_count, chunk_count
            )
            VALUES (?, ?, ?, ?)
        """, (
            document_id,
            filename,
            page_count,
            chunk_count
        ))

    return get_document(document_id)


def get_document(document_id):

    with get_connection() as db:

        row = db.execute("""
            SELECT *
            FROM pdf_documents
            WHERE id = ?
        """, (document_id,)).fetchone()

    return dict(row) if row else None


def list_documents():

    with get_connection() as db:

        rows = db.execute("""
            SELECT *
            FROM pdf_documents
            ORDER BY created_at DESC, id DESC
        """).fetchall()

    return [dict(row) for row in rows]


def delete_document_record(document_id):

    with get_connection() as db:

        cursor = db.execute("""
            DELETE FROM pdf_documents
            WHERE id = ?
        """, (document_id,))

    return cursor.rowcount > 0


def get_pdf_history(document_id, limit=None):

    with get_connection() as db:

        if limit is None:

            rows = db.execute("""
                SELECT *
                FROM pdf_messages
                WHERE document_id = ?
                ORDER BY id ASC
            """, (document_id,)).fetchall()

        else:

            limit = max(1, min(int(limit), 100))

            rows = db.execute("""
                SELECT *
                FROM (
                    SELECT *
                    FROM pdf_messages
                    WHERE document_id = ?
                    ORDER BY id DESC
                    LIMIT ?
                )
                ORDER BY id ASC
            """, (
                document_id,
                limit
            )).fetchall()

    messages = []

    for row in rows:

        try:
            sources = json.loads(
                row["sources_json"]
            )
        except (ValueError, TypeError):
            sources = []

        messages.append({
            "id": str(row["id"]),
            "role": row["role"],
            "content": row["content"],
            "sources": sources,
            "createdAt": row["created_at"]
        })

    return messages


def save_pdf_exchange(
    document_id,
    question,
    answer,
    sources
):

    with get_connection() as db:

        db.execute("""
            INSERT INTO pdf_messages(
                document_id, role, content
            )
            VALUES (?, 'user', ?)
        """, (
            document_id,
            question
        ))

        db.execute("""
            INSERT INTO pdf_messages(
                document_id,
                role,
                content,
                sources_json
            )
            VALUES (?, 'assistant', ?, ?)
        """, (
            document_id,
            answer,
            json.dumps(
                sources,
                ensure_ascii=False
            )
        ))


def clear_pdf_history(document_id):

    with get_connection() as db:

        cursor = db.execute("""
            DELETE FROM pdf_messages
            WHERE document_id = ?
        """, (document_id,))

    return {
        "success": True,
        "deleted_messages": cursor.rowcount
    }
