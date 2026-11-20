
import {
  Bot,
  Minus,
  X,
  Trash2
} from "lucide-react";

function ChatHeader({
  onMinimize,
  onClose,
  onClear
}) {
  return (
    <div className="webmind-header">
      <div className="webmind-header-left">
        <div className="webmind-logo">
          <Bot size={23} />
        </div>

        <div className="webmind-header-details">
          <h3>WebMind AI</h3>

          <div className="webmind-status">
            <span className="webmind-status-dot" />
            <span>Assistant ready</span>
          </div>
        </div>
      </div>

      <div className="webmind-header-actions">
        <button
          onClick={onClear}
          title="Clear conversation"
          aria-label="Clear conversation"
        >
          <Trash2 size={17} />
        </button>

        <button
          onClick={onMinimize}
          title="Minimize chatbot"
          aria-label="Minimize chatbot"
        >
          <Minus size={18} />
        </button>

        <button
          onClick={onClose}
          title="Close chatbot"
          aria-label="Close chatbot"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

export default ChatHeader;
