
import { Bot } from "lucide-react";

function TypingIndicator() {
  return (
    <div
      className="webmind-message assistant"
      role="status"
      aria-label="Assistant is preparing a response"
    >
      <div className="webmind-avatar">
        <Bot size={16} />
      </div>

      <div className="webmind-typing-container">
        <span className="webmind-typing-label">
          Preparing response
        </span>

        <div className="webmind-typing-dots">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

export default TypingIndicator;
