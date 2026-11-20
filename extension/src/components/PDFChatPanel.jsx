
import {
  useEffect,
  useRef,
  useState
} from "react";

import {
  FileText,
  Upload,
  Send,
  Trash2,
  BookOpen
} from "lucide-react";

import {
  uploadPDF,
  listPDFDocuments,
  askPDF,
  getPDFHistory,
  clearPDFHistory,
  deletePDFDocument
} from "../services/api";

// Module 13: Clickable Citations
import CitationText from "./CitationText";

import {
  openPDFSource
} from "../utils/pdfNavigator";


// ==========================================
// WebMind AI - PDF Chat Panel
// Modules 12 and 13
// ==========================================

function PDFChatPanel() {

  // ========================================
  // 1. Component State
  // ========================================

  const [documents, setDocuments] =
    useState([]);

  const [selectedId, setSelectedId] =
    useState("");

  const [messages, setMessages] =
    useState([]);

  const [sources, setSources] =
    useState([]);

  const [question, setQuestion] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");


  // ========================================
  // 2. References
  // ========================================

  const inputRef = useRef(null);

  const scrollRef = useRef(null);

  const activeRef = useRef("");

  const busyRef = useRef(false);

  const generationRef = useRef(0);

  const mountedRef = useRef(false);


  // ========================================
  // 3. Load Saved PDF Documents
  // ========================================

  const refreshDocuments = async () => {

    const result = await listPDFDocuments();

    if (mountedRef.current) {

      setDocuments(
        Array.isArray(result.documents)
          ? result.documents
          : []
      );
    }
  };


  // ========================================
  // 4. Component Lifecycle
  // ========================================

  useEffect(() => {

    mountedRef.current = true;

    refreshDocuments().catch((err) => {

      if (mountedRef.current) {

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load PDF documents."
        );
      }
    });

    return () => {

      mountedRef.current = false;

      generationRef.current += 1;
    };

  }, []);


  // ========================================
  // 5. Scroll Conversation
  // ========================================

  useEffect(() => {

    const container = scrollRef.current;

    if (container) {

      container.scrollTop =
        container.scrollHeight;
    }

  }, [messages]);


  // ========================================
  // 6. Execute PDF Action
  // ========================================

  const runAction = async (callback) => {

    if (busyRef.current) {
      return;
    }

    busyRef.current = true;

    setBusy(true);
    setError("");

    try {

      await callback();

    } catch (err) {

      if (mountedRef.current) {

        setError(
          err instanceof Error
            ? err.message
            : "PDF operation failed."
        );
      }

    } finally {

      busyRef.current = false;

      if (mountedRef.current) {
        setBusy(false);
      }
    }
  };


  // ========================================
  // 7. Module 13: PDF Citation Handler
  // ========================================

  const handlePDFCitation = (source) => {

    // Use the source's document ID when
    // available, otherwise the selected PDF.

    const result = openPDFSource(
      source,
      selectedId
    );

    if (!result.success) {

      setError(
        result.message ||
        "Unable to open PDF citation."
      );

    } else {

      setError("");
    }
  };


  // ========================================
  // 8. Select a PDF Document
  // ========================================

  const selectDocument = async (documentId) => {

    if (busyRef.current) {
      return;
    }

    activeRef.current = documentId;

    const generation =
      ++generationRef.current;

    setSelectedId(documentId);

    setMessages([]);
    setSources([]);
    setError("");

    if (!documentId) {
      return;
    }

    await runAction(async () => {

      const result =
        await getPDFHistory(documentId);

      if (
        generation !== generationRef.current ||
        activeRef.current !== documentId ||
        !mountedRef.current
      ) {
        return;
      }

      const restored = Array.isArray(
        result.messages
      )
        ? result.messages
        : [];

      setMessages(restored);

      const latest = [...restored]
        .reverse()
        .find(
          (message) =>
            message.role === "assistant"
        );

      setSources(
        Array.isArray(latest?.sources)
          ? latest.sources
          : []
      );
    });
  };


  // ========================================
  // 9. Upload and Index PDF
  // ========================================

  const handleUpload = (event) => {

    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    runAction(async () => {

      if (
        !file.name.toLowerCase().endsWith(".pdf")
      ) {
        throw new Error(
          "Please select a PDF file."
        );
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error(
          "PDF must be 10 MB or smaller."
        );
      }

      // Upload, extract, and index.
      const result = await uploadPDF(file);

      await refreshDocuments();

      const id = result.document?.id;

      if (!id) {
        throw new Error(
          "Backend did not return a PDF document ID."
        );
      }

      activeRef.current = id;

      const generation =
        ++generationRef.current;

      setSelectedId(id);

      const history =
        await getPDFHistory(id);

      if (
        !mountedRef.current ||
        generation !== generationRef.current ||
        activeRef.current !== id
      ) {
        return;
      }

      const restored = Array.isArray(
        history.messages
      )
        ? history.messages
        : [];

      setMessages(restored);

      const latest = [...restored]
        .reverse()
        .find(
          (message) =>
            message.role === "assistant"
        );

      setSources(
        Array.isArray(latest?.sources)
          ? latest.sources
          : []
      );
    });
  };


  // ========================================
  // 10. Ask Questions About PDF
  // ========================================

  const handleAsk = () => runAction(
    async () => {

      const text = question.trim();

      if (!selectedId || !text) {

        throw new Error(
          "Select a PDF and enter a question."
        );
      }

      const id = selectedId;

      const generation =
        generationRef.current;

      const tempId =
        crypto.randomUUID();

      setQuestion("");

      setSources([]);

      // Add the user's question immediately.
      setMessages((previous) => [
        ...previous,
        {
          id: tempId,
          role: "user",
          content: text,
          sources: []
        }
      ]);

      try {

        const result =
          await askPDF(id, text);

        if (
          !mountedRef.current ||
          generation !== generationRef.current ||
          activeRef.current !== id
        ) {
          return;
        }

        const answerSources =
          Array.isArray(result.sources)
            ? result.sources
            : [];

        // Preserve source metadata with
        // the corresponding assistant message.
        setMessages((previous) => [
          ...previous,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              result.answer ||
              "No answer was returned.",
            sources: answerSources
          }
        ]);

        setSources(answerSources);

      } catch (err) {

        if (
          mountedRef.current &&
          generation === generationRef.current &&
          activeRef.current === id
        ) {

          setQuestion(text);

          setMessages((previous) =>
            previous.filter(
              (message) =>
                message.id !== tempId
            )
          );
        }

        throw err;
      }
    }
  );


  // ========================================
  // 11. Clear PDF Conversation
  // ========================================

  const handleClear = () => runAction(
    async () => {

      if (!selectedId) {
        throw new Error(
          "Select a PDF first."
        );
      }

      await clearPDFHistory(
        selectedId
      );

      if (!mountedRef.current) {
        return;
      }

      setMessages([]);
      setSources([]);
    }
  );


  // ========================================
  // 12. Delete PDF Document
  // ========================================

  const handleDelete = () => {

    if (!selectedId) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this PDF, its indexed data, " +
      "and its conversation history?"
    );

    if (!confirmed) {
      return;
    }

    runAction(async () => {

      const id = selectedId;

      await deletePDFDocument(id);

      if (!mountedRef.current) {
        return;
      }

      activeRef.current = "";

      generationRef.current += 1;

      setSelectedId("");
      setMessages([]);
      setSources([]);

      await refreshDocuments();
    });
  };


  // ========================================
  // 13. Selected Document Information
  // ========================================

  const selectedDocument = documents.find(
    (document) =>
      document.id === selectedId
  );


  // ========================================
  // 14. Render PDF Chat Interface
  // ========================================

  return (
    <section className="webmind-pdf-panel">

      {/* ====================================
          PDF Toolbar
          ==================================== */}

      <div className="webmind-pdf-toolbar">

        <strong>
          <FileText size={17} />
          PDF Chat
        </strong>

        <button
          type="button"
          onClick={() =>
            inputRef.current?.click()
          }
          disabled={busy}
          title="Upload PDF"
        >
          <Upload size={15} />
          Upload
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          hidden
          onChange={handleUpload}
        />

      </div>


      {/* ====================================
          PDF Document Controls
          ==================================== */}

      <div className="webmind-pdf-controls">

        <select
          value={selectedId}
          disabled={busy}
          onChange={(event) =>
            selectDocument(
              event.target.value
            )
          }
          aria-label="Select PDF"
        >

          <option value="">
            Select a PDF
          </option>

          {documents.map((document) => (

            <option
              key={document.id}
              value={document.id}
            >
              {document.filename}
            </option>

          ))}

        </select>


        {/* Clear PDF Chat */}

        <button
          type="button"
          disabled={!selectedId || busy}
          onClick={handleClear}
          title="Clear PDF conversation"
        >
          <BookOpen size={15} />
        </button>


        {/* Delete PDF */}

        <button
          type="button"
          disabled={!selectedId || busy}
          onClick={handleDelete}
          title="Delete PDF"
        >
          <Trash2 size={15} />
        </button>

      </div>


      {/* ====================================
          PDF Metadata
          ==================================== */}

      {selectedDocument && (

        <div className="webmind-pdf-meta">

          {selectedDocument.page_count} pages ·{" "}
          {selectedDocument.chunk_count} indexed chunks

        </div>
      )}


      {/* ====================================
          Conversation Messages
          ==================================== */}

      <div
        className="webmind-pdf-messages"
        ref={scrollRef}
        aria-label="PDF conversation"
        aria-live="polite"
      >

        {/* Empty Conversation */}

        {messages.length === 0 && (

          <p className="webmind-pdf-empty">

            {selectedId
              ? "Ask a question about your PDF."
              : "Upload or select a saved PDF to begin."}

          </p>
        )}


        {/* User and Assistant Messages */}

        {messages.map((message) => {

          const isAssistant =
            message.role === "assistant";

          return (

            <div
              key={message.id}
              className={
                "webmind-pdf-message " +
                `webmind-pdf-${message.role}`
              }
            >

              <strong>
                {isAssistant
                  ? "WebMind AI"
                  : "You"}
              </strong>


              {/* =================================
                  Module 13:
                  Clickable PDF Citations
                  ================================= */}

              <div className="webmind-pdf-message-content">

                {isAssistant ? (

                  <CitationText
                    text={message.content}
                    sources={
                      Array.isArray(message.sources)
                        ? message.sources
                        : []
                    }
                    onCitationClick={
                      handlePDFCitation
                    }
                  />

                ) : (

                  message.content

                )}

              </div>


              {/* Source Count */}

              {isAssistant &&
                Array.isArray(message.sources) &&
                message.sources.length > 0 && (

                <div className="webmind-pdf-message-sources">
                  <BookOpen size={12} />
                  <span>
                    {message.sources.length} sources
                  </span>
                </div>

              )}

            </div>
          );
        })}


        {/* Processing Indicator */}

        {busy && (

          <p className="webmind-pdf-empty">
            Processing...
          </p>

        )}

      </div>


      {/* ====================================
          Answer Sources
          ==================================== */}

      {sources.length > 0 && (

        <details className="webmind-pdf-sources">

          <summary>
            Answer sources ({sources.length})
          </summary>

          <div className="webmind-pdf-source-list">

            {sources.map((source, index) => (

              <div
                key={
                  source.chunk_id ||
                  `pdf-source-${index}`
                }
              >

                <strong>
                  [{source.citation}] Page{" "}
                  {source.page_number}
                </strong>


                {/* Retrieved PDF Passage */}

                <p>
                  {source.excerpt}
                </p>


                {/* Module 13: Open PDF Page */}

                <button
                  type="button"
                  className="webmind-pdf-open-source"
                  onClick={() =>
                    handlePDFCitation(source)
                  }
                  title={
                    `Open PDF page ${source.page_number}`
                  }
                >
                  <FileText size={13} />

                  Open page {source.page_number}
                </button>

              </div>

            ))}

          </div>

        </details>
      )}


      {/* ====================================
          PDF Question Composer
          ==================================== */}

      <form
        className="webmind-pdf-composer"
        onSubmit={(event) => {
          event.preventDefault();
          handleAsk();
        }}
      >

        <textarea
          value={question}
          onChange={(event) =>
            setQuestion(
              event.target.value
            )
          }
          placeholder="Ask about this PDF..."
          disabled={busy || !selectedId}
          rows={2}
          maxLength={2000}
          onKeyDown={(event) => {

            if (
              event.key === "Enter" &&
              !event.shiftKey
            ) {

              event.preventDefault();

              if (
                !busy &&
                selectedId &&
                question.trim()
              ) {

                handleAsk();
              }
            }
          }}
        />


        <button
          type="submit"
          disabled={
            busy ||
            !selectedId ||
            !question.trim()
          }
          title="Send question"
        >
          <Send size={17} />
        </button>

      </form>


      {/* ====================================
          Error Display
          ==================================== */}

      {error && (

        <div
          className="webmind-pdf-error"
          role="alert"
        >
          {error}
        </div>

      )}

    </section>
  );
}

export default PDFChatPanel;
