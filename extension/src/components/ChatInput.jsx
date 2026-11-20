
import { Send } from "lucide-react";

function ChatInput({
  input,
  setInput,
  onSend,
  isLoading
}) {
  const handleKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();

      if (!isLoading && input.trim()) {
        onSend();
      }
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!isLoading && input.trim()) {
      onSend();
    }
  };

  return (
    <form
      className="webmind-input-area"
      onSubmit={handleSubmit}
    >
      <textarea
        value={input}
        onChange={(event) =>
          setInput(event.target.value)
        }
        onKeyDown={handleKeyDown}
        placeholder="Ask about this webpage..."
        rows={2}
        maxLength={3000}
        disabled={isLoading}
        aria-label="Ask a question"
      />

      <button
        type="submit"
        disabled={
          isLoading || !input.trim()
        }
        title="Send message"
        aria-label="Send message"
      >
        <Send size={19} />
      </button>
    </form>
  );
}

export default ChatInput;
