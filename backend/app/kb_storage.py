
"""
WebMind AI - Module 11
Knowledge Base SQLite Storage
"""

import json
import re
import sqlite3
import uuid

from .history_storage import DATABASE_PATH
from .storage import get_page


MAX_PAGES_PER_KB = 8

ID_PATTERN = re.compile(r"^[a-f0-9]{24}$")


def connection():
    DATABASE_PATH.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    db = sqlite3.connect(
        str(DATABASE_PATH),
        timeout=30
    )

    db.row_factory = sqlite3.Row
    db.execute("PRAGMA busy_timeout = 30000")
    db.execute("PRAGMA foreign_keys = ON")

    return db


def validate_id(value, kind="ID"):
    if (
        not isinstance(value, str)
        or not ID_PATTERN.fullmatch(value)
    ):
        raise ValueError(f"Invalid {kind}.")


def initialize_kb_database():
    with connection() as db:

        db.execute("""
            CREATE TABLE IF NOT EXISTS
            knowledge_bases (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL
                    DEFAULT CURRENT_TIMESTAMP
            )
        """)

        db.execute("""
            CREATE TABLE IF NOT EXISTS
            knowledge_base_pages (
                kb_id TEXT NOT NULL,
                page_id TEXT NOT NULL,
                added_at TEXT NOT NULL
                    DEFAULT CURRENT_TIMESTAMP,

                PRIMARY KEY (kb_id, page_id),

                FOREIGN KEY (kb_id)
                    REFERENCES knowledge_bases(id)
                    ON DELETE CASCADE
            )
        """)

        db.execute("""
            CREATE TABLE IF NOT EXISTS
            knowledge_base_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kb_id TEXT NOT NULL,
                role TEXT NOT NULL
                    CHECK(role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                sources_json TEXT NOT NULL
                    DEFAULT '[]',
                created_at TEXT NOT NULL
                    DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (kb_id)
                    REFERENCES knowledge_bases(id)
                    ON DELETE CASCADE
            )
        """)

        db.execute("""
            CREATE INDEX IF NOT EXISTS
            idx_kb_messages
            ON knowledge_base_messages(kb_id, id)
        """)


def get_kb(kb_id):
    validate_id(kb_id, "knowledge base ID")

    with connection() as db:
        row = db.execute(
            """
            SELECT id, name, created_at
            FROM knowledge_bases
            WHERE id = ?
            """,
            (kb_id,)
        ).fetchone()

    return dict(row) if row else None


def create_kb(name):
    if not isinstance(name, str):
        raise ValueError("Knowledge base name is required.")

    name = name.strip()

    if not 1 <= len(name) <= 100:
        raise ValueError(
            "Name must contain 1 to 100 characters."
        )

    kb_id = uuid.uuid4().hex[:24]

    with connection() as db:
        db.execute(
            """
            INSERT INTO knowledge_bases(id, name)
            VALUES (?, ?)
            """,
            (kb_id, name)
        )

    return get_kb(kb_id)


def list_kbs():
    with connection() as db:
        rows = db.execute("""
            SELECT
                kb.id,
                kb.name,
                kb.created_at,
                COUNT(kp.page_id) AS page_count
            FROM knowledge_bases kb
            LEFT JOIN knowledge_base_pages kp
                ON kp.kb_id = kb.id
            GROUP BY kb.id, kb.name, kb.created_at
            ORDER BY kb.created_at DESC, kb.id DESC
        """).fetchall()

    return [dict(row) for row in rows]


def list_kb_pages(kb_id):
    validate_id(kb_id, "knowledge base ID")

    with connection() as db:
        rows = db.execute("""
            SELECT page_id, added_at
            FROM knowledge_base_pages
            WHERE kb_id = ?
            ORDER BY added_at ASC, rowid ASC
        """, (kb_id,)).fetchall()

    pages = []

    for row in rows:
        page = get_page(row["page_id"])

        pages.append({
            "page_id": row["page_id"],
            "title": (
                page["title"]
                if page is not None
                else "Unavailable webpage"
            ),
            "url": (
                page.get("url", "")
                if isinstance(page, dict)
                else (
                    page["url"]
                    if page is not None
                    else ""
                )
            ),
            "added_at": row["added_at"]
        })

    return pages


def add_page_to_kb(kb_id, page_id):
    validate_id(kb_id, "knowledge base ID")
    validate_id(page_id, "page ID")

    if get_kb(kb_id) is None:
        raise ValueError("Knowledge base not found.")

    if get_page(page_id) is None:
        raise ValueError(
            "Webpage not found. Upload it first."
        )

    with connection() as db:
        existing = db.execute("""
            SELECT 1
            FROM knowledge_base_pages
            WHERE kb_id = ? AND page_id = ?
        """, (kb_id, page_id)).fetchone()

        if existing is not None:
            return {
                "success": True,
                "added": False,
                "message": "Webpage already in collection."
            }

        count = db.execute("""
            SELECT COUNT(*)
            FROM knowledge_base_pages
            WHERE kb_id = ?
        """, (kb_id,)).fetchone()[0]

        if count >= MAX_PAGES_PER_KB:
            raise ValueError(
                f"Maximum {MAX_PAGES_PER_KB} "
                "webpages per knowledge base."
            )

        db.execute("""
            INSERT INTO knowledge_base_pages(
                kb_id, page_id
            )
            VALUES (?, ?)
        """, (kb_id, page_id))

    return {
        "success": True,
        "added": True,
        "page_id": page_id
    }


def remove_page_from_kb(kb_id, page_id):
    validate_id(kb_id, "knowledge base ID")
    validate_id(page_id, "page ID")

    with connection() as db:
        cursor = db.execute("""
            DELETE FROM knowledge_base_pages
            WHERE kb_id = ? AND page_id = ?
        """, (kb_id, page_id))

    return {
        "success": True,
        "removed": cursor.rowcount > 0
    }


def delete_kb(kb_id):
    validate_id(kb_id, "knowledge base ID")

    with connection() as db:
        cursor = db.execute("""
            DELETE FROM knowledge_bases
            WHERE id = ?
        """, (kb_id,))

    return {
        "success": True,
        "deleted": cursor.rowcount > 0
    }


def get_kb_history(kb_id, limit=None):
    validate_id(kb_id, "knowledge base ID")

    with connection() as db:
        if limit is None:
            rows = db.execute("""
                SELECT *
                FROM knowledge_base_messages
                WHERE kb_id = ?
                ORDER BY id ASC
            """, (kb_id,)).fetchall()
        else:
            limit = max(1, min(int(limit), 100))

            rows = db.execute("""
                SELECT *
                FROM (
                    SELECT *
                    FROM knowledge_base_messages
                    WHERE kb_id = ?
                    ORDER BY id DESC
                    LIMIT ?
                )
                ORDER BY id ASC
            """, (kb_id, limit)).fetchall()

    messages = []

    for row in rows:
        try:
            sources = json.loads(
                row["sources_json"] or "[]"
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


def save_kb_exchange(
    kb_id,
    question,
    answer,
    sources
):
    validate_id(kb_id, "knowledge base ID")

    with connection() as db:
        db.execute("""
            INSERT INTO knowledge_base_messages(
                kb_id, role, content, sources_json
            )
            VALUES (?, 'user', ?, '[]')
        """, (kb_id, question))

        db.execute("""
            INSERT INTO knowledge_base_messages(
                kb_id, role, content, sources_json
            )
            VALUES (?, 'assistant', ?, ?)
        """, (
            kb_id,
            answer,
            json.dumps(sources, ensure_ascii=False)
        ))


def clear_kb_history(kb_id):
    validate_id(kb_id, "knowledge base ID")

    with connection() as db:
        cursor = db.execute("""
            DELETE FROM knowledge_base_messages
            WHERE kb_id = ?
        """, (kb_id,))

    return {
        "success": True,
        "deleted_messages": cursor.rowcount
    }
