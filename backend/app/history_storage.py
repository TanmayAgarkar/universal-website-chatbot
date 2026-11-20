
import json
import sqlite3
import hashlib

from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]

DATABASE_PATH = (
    BASE_DIR / "storage" / "webmind.db"
)


def get_connection():
    connection = sqlite3.connect(
        DATABASE_PATH,
        timeout=30
    )

    connection.row_factory = sqlite3.Row

    connection.execute(
        "PRAGMA busy_timeout = 30000"
    )

    return connection


# ==========================================
# Create History Table
# ==========================================

def initialize_history_database():

    DATABASE_PATH.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    with get_connection() as connection:

        connection.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,

                page_id TEXT NOT NULL,

                role TEXT NOT NULL
                    CHECK(role IN ('user', 'assistant')),

                content TEXT NOT NULL,

                sources_json TEXT NOT NULL
                    DEFAULT '[]',

                created_at TEXT NOT NULL
                    DEFAULT (
                        strftime(
                            '%Y-%m-%dT%H:%M:%fZ',
                            'now'
                        )
                    )
            )
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS
                idx_chat_messages_page
            ON chat_messages(page_id, id)
        """)


# ==========================================
# Store a Complete Question/Answer Exchange
# ==========================================

def save_chat_exchange(
    page_id: str,
    question: str,
    answer: str,
    sources: list
):

    sources_json = json.dumps(
        sources,
        ensure_ascii=False
    )

    with get_connection() as connection:

        # Both messages are saved in one
        # SQLite transaction.

        connection.execute("""
            INSERT INTO chat_messages (
                page_id,
                role,
                content,
                sources_json
            )
            VALUES (?, ?, ?, ?)
        """, (
            page_id,
            "user",
            question,
            "[]"
        ))

        connection.execute("""
            INSERT INTO chat_messages (
                page_id,
                role,
                content,
                sources_json
            )
            VALUES (?, ?, ?, ?)
        """, (
            page_id,
            "assistant",
            answer,
            sources_json
        ))


# ==========================================
# Retrieve Page Conversation
# ==========================================

def get_chat_history(page_id: str):

    with get_connection() as connection:

        rows = connection.execute("""
            SELECT
                id,
                role,
                content,
                sources_json,
                created_at
            FROM chat_messages
            WHERE page_id = ?
            ORDER BY id ASC
        """, (page_id,)).fetchall()

    messages = []

    for row in rows:

        try:
            sources = json.loads(
                row["sources_json"] or "[]"
            )
        except json.JSONDecodeError:
            sources = []

        messages.append({
            "id": str(row["id"]),
            "role": row["role"],
            "content": row["content"],
            "createdAt": row["created_at"],
            "sources": sources
        })

    return messages


# ==========================================
# Delete Current Page Conversation
# ==========================================

def delete_chat_history(page_id: str):

    with get_connection() as connection:

        cursor = connection.execute("""
            DELETE FROM chat_messages
            WHERE page_id = ?
        """, (page_id,))

        deleted_count = cursor.rowcount

    return {
        "success": True,
        "page_id": page_id,
        "deleted_messages": deleted_count
    }


# ==========================================
# Compute Existing Page ID
# ==========================================

def page_id_from_url(url: str):

    return hashlib.sha256(
        url.encode("utf-8")
    ).hexdigest()[:24]
