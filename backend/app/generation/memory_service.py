
"""
WebMind AI - Module 10
Conversation Memory Service

Retrieves and formats recent page-specific
conversation history from SQLite.
"""

from app.history_storage import get_chat_history


# ==========================================
# Memory Configuration
# ==========================================

MAX_HISTORY_MESSAGES = 8

MAX_MESSAGE_CHARACTERS = 1200

MAX_HISTORY_CHARACTERS = 7000


# ==========================================
# Retrieve Recent Conversation
# ==========================================

def load_conversation_memory(
    page_id: str,
    max_messages: int = MAX_HISTORY_MESSAGES
):

    messages = get_chat_history(page_id)

    if not messages:
        return []

    # Keep only actual dialogue messages.
    # Do not include analysis/indexing notices.
    conversation = [
        message
        for message in messages
        if message.get("role") in (
            "user",
            "assistant"
        )
    ]

    # Fetch only the most recent messages.
    recent_messages = conversation[-max_messages:]

    cleaned_messages = []

    for message in recent_messages:

        content = str(
            message.get("content", "")
        ).strip()

        if not content:
            continue

        # Limit individual message length.
        content = content[
            :MAX_MESSAGE_CHARACTERS
        ]

        cleaned_messages.append({
            "role": message["role"],
            "content": content
        })

    return cleaned_messages


# ==========================================
# Format Memory for Gemini
# ==========================================

def format_conversation_memory(messages):

    if not messages:
        return "No previous conversation."

    formatted = []

    for message in messages:

        role = (
            "User"
            if message["role"] == "user"
            else "Assistant"
        )

        formatted.append(
            f"{role}: {message['content']}"
        )

    history_text = "\n\n".join(formatted)

    return history_text[-MAX_HISTORY_CHARACTERS:]
