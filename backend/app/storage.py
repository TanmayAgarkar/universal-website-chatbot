
import sqlite3
import json
import hashlib

from pathlib import Path
from datetime import datetime, timezone

from .schemas import PageIngestRequest


BASE_DIR = Path(__file__).resolve().parent.parent

STORAGE_DIR = BASE_DIR / "storage"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = STORAGE_DIR / "webmind.db"


def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row

    return connection


def initialize_database():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS pages (
                page_id TEXT PRIMARY KEY,
                url TEXT NOT NULL,
                domain TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                content_hash TEXT NOT NULL,
                sections_json TEXT NOT NULL,
                full_text TEXT NOT NULL,
                statistics_json TEXT NOT NULL,
                extracted_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        connection.commit()


def generate_page_id(url: str) -> str:
    return hashlib.sha256(
        url.encode("utf-8")
    ).hexdigest()[:24]


def generate_content_hash(text: str) -> str:
    return hashlib.sha256(
        text.encode("utf-8")
    ).hexdigest()


def save_page(page: PageIngestRequest):
    url = str(page.url)

    page_id = generate_page_id(url)

    content_hash = generate_content_hash(
        page.full_text
    )

    now = datetime.now(
        timezone.utc
    ).isoformat()

    with get_connection() as connection:
        existing = connection.execute(
            """
            SELECT content_hash
            FROM pages
            WHERE page_id = ?
            """,
            (page_id,)
        ).fetchone()

        if (
            existing
            and existing["content_hash"] == content_hash
        ):
            return {
                "page_id": page_id,
                "content_hash": content_hash,
                "status": "unchanged"
            }

        connection.execute(
            """
            INSERT INTO pages (
                page_id,
                url,
                domain,
                title,
                description,
                content_hash,
                sections_json,
                full_text,
                statistics_json,
                extracted_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

            ON CONFLICT(page_id)
            DO UPDATE SET
                domain = excluded.domain,
                title = excluded.title,
                description = excluded.description,
                content_hash = excluded.content_hash,
                sections_json = excluded.sections_json,
                full_text = excluded.full_text,
                statistics_json = excluded.statistics_json,
                extracted_at = excluded.extracted_at,
                updated_at = excluded.updated_at
            """,
            (
                page_id,
                url,
                page.domain,
                page.title,
                page.description,
                content_hash,
                json.dumps([
                    section.model_dump()
                    for section in page.sections
                ]),
                page.full_text,
                page.statistics.model_dump_json(),
                page.extracted_at,
                now
            )
        )

        connection.commit()

    return {
        "page_id": page_id,
        "content_hash": content_hash,
        "status": "stored" if not existing else "updated"
    }


def get_page(page_id: str):
    with get_connection() as connection:
        result = connection.execute(
            """
            SELECT
                page_id,
                url,
                domain,
                title,
                content_hash,
                statistics_json,
                updated_at
            FROM pages
            WHERE page_id = ?
            """,
            (page_id,)
        ).fetchone()

    if not result:
        return None

    return {
        "page_id": result["page_id"],
        "url": result["url"],
        "domain": result["domain"],
        "title": result["title"],
        "content_hash": result["content_hash"],
        "statistics": json.loads(
            result["statistics_json"]
        ),
        "updated_at": result["updated_at"]
    }


def get_page_content(page_id: str):
    with get_connection() as connection:
        result = connection.execute(
            """
            SELECT *
            FROM pages
            WHERE page_id = ?
            """,
            (page_id,)
        ).fetchone()

    if not result:
        return None

    return {
        "page_id": result["page_id"],
        "url": result["url"],
        "title": result["title"],
        "sections": json.loads(
            result["sections_json"]
        ),
        "full_text": result["full_text"],
        "statistics": json.loads(
            result["statistics_json"]
        )
    }
