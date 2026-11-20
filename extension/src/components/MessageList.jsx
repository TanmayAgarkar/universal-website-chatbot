
import {
  useEffect,
  useRef
} from "react";

import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";

// ==========================================
// WebMind AI - MessageList
// Modules 3 through 13
// ==========================================

function MessageList({
  messages = [],
  isLoading = false,
  onCitationClick
}) {

  // ----------------------------------------
  // Chat Messages Container
  // ----------------------------------------

  const messagesContainerRef = useRef(null);

  // ----------------------------------------
  // Automatic Chat Scrolling
  // ----------------------------------------

  useEffect(() => {

    const container =
      messagesContainerRef.current;

    if (!container) {
      return;
    }

    // Scroll only the chatbot conversation.
    // This avoids scrolling the host webpage.

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth"
    });

  }, [messages, isLoading]);

  // ----------------------------------------
  // Render Conversation
  // ----------------------------------------

  return (
    <div
      ref={messagesContainerRef}
      className="webmind-messages"
      aria-label="Chat conversation"
      aria-live="polite"
      role="log"
    >

      {/* ====================================
          Conversation Messages
          ==================================== */}

      {messages.map((message) => (

        <ChatMessage
          key={message.id}
          message={message}

          // Module 13:
          // Pass citation navigation
          // to the individual message.

          onCitationClick={
            onCitationClick
          }
        />

      ))}

      {/* ====================================
          Typing Indicator
          ==================================== */}

      {isLoading && (
        <TypingIndicator />
      )}

    </div>
  );
}

export default MessageList;
