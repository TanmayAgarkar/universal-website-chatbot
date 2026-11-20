
import { Bot } from "lucide-react";

// Module 13: Clickable Citations
import CitationText from "./CitationText";


// ==========================================
// WebMind AI - ChatMessage
// Modules 3 through 13
// ==========================================

function ChatMessage({
  message,
  onCitationClick
}) {

  // ----------------------------------------
  // Identify Message Role
  // ----------------------------------------

  const isUser = message.role === "user";

  // ----------------------------------------
  // Format Message Timestamp
  // ----------------------------------------

  const time = new Date(
    message.createdAt
  ).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  // ----------------------------------------
  // Module 13: Citation Sources
  // ----------------------------------------

  const sources = Array.isArray(
    message.sources
  )
    ? message.sources
    : [];

  // ----------------------------------------
  // Render Message
  // ----------------------------------------

  return (
    <div
      className={
        `webmind-message ${
          isUser ? "user" : "assistant"
        }`
      }
    >

      {/* Bot Avatar */}

      {!isUser && (
        <div className="webmind-avatar">
          <Bot size={16} />
        </div>
      )}

      {/* Message Bubble */}

      <div className="webmind-message-bubble">

        {/* Message Content */}

        <div className="webmind-message-content">

          {isUser ? (

            // User messages remain plain text.
            message.content

          ) : (

            // Assistant messages support
            // clickable source citations.

            <CitationText
              text={message.content}
              sources={sources}
              onCitationClick={
                onCitationClick
              }
            />

          )}

        </div>

        {/* Message Timestamp */}

        <div className="webmind-message-time">
          {time}
        </div>

      </div>

    </div>
  );
}

export default ChatMessage;
