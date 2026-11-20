
import {
  useEffect,
  useRef,
  useState
} from "react";

import {
  Bot,
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileText,
  Layers,
  Plus,
  Send,
  Trash2,
  X,
  ExternalLink,
  LoaderCircle
} from "lucide-react";

import {
  listKnowledgeBases,
  createKnowledgeBase,
  getKnowledgeBase,
  addPageToKnowledgeBase,
  removePageFromKnowledgeBase,
  deleteKnowledgeBase,
  askKnowledgeBase,
  getKnowledgeBaseHistory,
  clearKnowledgeBaseHistory
} from "../services/api";

// Module 13: Clickable source citations
import CitationText from "./CitationText";

import {
  openWebpageSource
} from "../utils/sourceNavigator";


function KnowledgeBasePanel({ currentPageId }) {

  const [collections, setCollections] =
    useState([]);

  const [selectedId, setSelectedId] =
    useState("");

  const [pages, setPages] =
    useState([]);

  const [messages, setMessages] =
    useState([]);

  const [sources, setSources] =
    useState([]);

  const [question, setQuestion] =
    useState("");

  const [newName, setNewName] =
    useState("");

  const [showCreate, setShowCreate] =
    useState(false);

  const [showPages, setShowPages] =
    useState(false);

  const [showSources, setShowSources] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const [notice, setNotice] =
    useState("");

  const mountedRef = useRef(false);
  const generationRef = useRef(0);
  const busyRef = useRef(false);
  const selectedRef = useRef("");

  const messageEndRef = useRef(null);


  // ========================================
  // Module 13: Navigate to a KB citation
  // ========================================

  const handleKnowledgeBaseCitation = (source) => {

    // Knowledge base answers may cite webpages
    // other than the currently open browser tab.
    // Require a source URL; never silently use
    // the current page as the destination.
    const url = source?.url || source?.page_url;

    if (typeof url !== "string" || !url.trim()) {
      setError(
        "This citation does not include its source webpage URL."
      );
      return;
    }

    const result = openWebpageSource({
      ...source,
      url
    });

    if (!result.success) {
      setError(
        result.message || "Unable to open cited webpage."
      );
    } else {
      setError("");
    }
  };


  // ========================================
  // Load Collections
  // ========================================

  const refreshCollections = async () => {
    const result = await listKnowledgeBases();

    if (mountedRef.current) {
      setCollections(
        Array.isArray(result.collections)
          ? result.collections
          : []
      );
    }
  };


  // ========================================
  // Load Selected Collection
  // ========================================

  const refreshCollection = async (
    kbId,
    generation = generationRef.current
  ) => {

    if (!kbId) {
      return;
    }

    const [details, history] = await Promise.all([
      getKnowledgeBase(kbId),
      getKnowledgeBaseHistory(kbId)
    ]);

    if (
      !mountedRef.current ||
      generation !== generationRef.current ||
      selectedRef.current !== kbId
    ) {
      return;
    }

    setPages(details.pages || []);

    const restored = history.messages || [];

    setMessages(restored);

    const latestAnswer = [...restored]
      .reverse()
      .find(
        (item) =>
          item.role === "assistant"
      );

    setSources(
      latestAnswer?.sources || []
    );
  };


  // ========================================
  // Component Lifecycle
  // ========================================

  useEffect(() => {

    mountedRef.current = true;

    refreshCollections().catch((err) => {
      if (mountedRef.current) {
        setError(err.message);
      }
    });

    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
    };

  }, []);


  // ========================================
  // Scroll Conversation
  // ========================================

  useEffect(() => {

    messageEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });

  }, [messages]);


  // ========================================
  // Execute Collection Action
  // ========================================

  const runAction = async (action) => {

    if (busyRef.current) {
      return;
    }

    busyRef.current = true;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await action();
    } catch (err) {
      if (mountedRef.current) {
        setError(
          err instanceof Error
            ? err.message
            : "Operation failed."
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
  // Select Collection
  // ========================================

  const handleSelect = (kbId) => {

    if (busyRef.current) {
      return;
    }

    selectedRef.current = kbId;

    const generation =
      ++generationRef.current;

    setSelectedId(kbId);
    setPages([]);
    setMessages([]);
    setSources([]);
    setShowSources(false);
    setError("");
    setNotice("");

    if (!kbId) {
      return;
    }

    runAction(async () => {
      await refreshCollection(
        kbId,
        generation
      );
    });
  };


  // ========================================
  // Create Collection
  // ========================================

  const handleCreate = () => runAction(
    async () => {

      const name = newName.trim();

      if (!name) {
        throw new Error(
          "Enter a collection name."
        );
      }

      const created = await createKnowledgeBase(
        name
      );

      setNewName("");
      setShowCreate(false);

      selectedRef.current = created.id;
      setSelectedId(created.id);

      const generation =
        ++generationRef.current;

      await refreshCollections();

      await refreshCollection(
        created.id,
        generation
      );

      setNotice("Collection created.");
    }
  );


  // ========================================
  // Add Current Webpage
  // ========================================

  const handleAddPage = () => runAction(
    async () => {

      if (!selectedId || !currentPageId) {
        throw new Error(
          "Upload the current webpage first."
        );
      }

      const result = await addPageToKnowledgeBase(
        selectedId,
        currentPageId
      );

      const generation =
        ++generationRef.current;

      await Promise.all([
        refreshCollections(),
        refreshCollection(
          selectedId,
          generation
        )
      ]);

      setNotice(
        result.added === false
          ? "This webpage is already saved."
          : "Webpage added to collection."
      );
    }
  );


  // ========================================
  // Remove Webpage
  // ========================================

  const handleRemovePage = (pageId) =>
    runAction(async () => {

      await removePageFromKnowledgeBase(
        selectedId,
        pageId
      );

      const generation =
        ++generationRef.current;

      await Promise.all([
        refreshCollections(),
        refreshCollection(
          selectedId,
          generation
        )
      ]);

      setNotice("Webpage removed.");
    });


  // ========================================
  // Delete Collection
  // ========================================

  const handleDelete = () => {

    if (!selectedId) {
      return;
    }

    if (
      !window.confirm(
        "Delete this knowledge base and its conversation history?"
      )
    ) {
      return;
    }

    runAction(async () => {

      await deleteKnowledgeBase(
        selectedId
      );

      generationRef.current += 1;
      selectedRef.current = "";

      setSelectedId("");
      setPages([]);
      setMessages([]);
      setSources([]);

      await refreshCollections();

      setNotice("Collection deleted.");
    });
  };


  // ========================================
  // Clear Conversation
  // ========================================

  const handleClear = () => {

    if (!selectedId) {
      return;
    }

    runAction(async () => {

      await clearKnowledgeBaseHistory(
        selectedId
      );

      setMessages([]);
      setSources([]);
      setShowSources(false);

      setNotice("Conversation cleared.");
    });
  };


  // ========================================
  // Ask Across Webpages
  // ========================================

  const handleAsk = () => runAction(
    async () => {

      const userQuestion = question.trim();

      if (!userQuestion) {
        throw new Error(
          "Enter a question."
        );
      }

      if (!selectedId || pages.length === 0) {
        throw new Error(
          "Select a collection with saved webpages."
        );
      }

      const activeId = selectedId;
      const generation = generationRef.current;

      const tempId = crypto.randomUUID();

      setQuestion("");
      setSources([]);
      setShowSources(false);

      setMessages((previous) => [
        ...previous,
        {
          id: tempId,
          role: "user",
          content: userQuestion
        }
      ]);

      try {

        const result = await askKnowledgeBase(
          activeId,
          userQuestion
        );

        if (
          !mountedRef.current ||
          generation !== generationRef.current ||
          selectedRef.current !== activeId
        ) {
          return;
        }

        setMessages((previous) => [
          ...previous,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: result.answer,
            sources: result.sources || []
          }
        ]);

        setSources(result.sources || []);

        if (result.warnings?.length) {
          setNotice(
            "Some webpages could not be searched."
          );
        }

      } catch (err) {

        if (
          mountedRef.current &&
          generation === generationRef.current
        ) {

          setQuestion(userQuestion);

          setMessages((previous) =>
            previous.filter(
              (item) => item.id !== tempId
            )
          );
        }

        throw err;
      }
    }
  );


  // ========================================
  // Current Collection
  // ========================================

  const selectedCollection =
    collections.find(
      (kb) => kb.id === selectedId
    );


  // ========================================
  // Render
  // ========================================

  return (
    <section className="webmind-kb-panel">

      {/* Compact top toolbar */}

      <div className="webmind-kb-top">

        <div className="webmind-kb-top-title">
          <Layers size={16} />
          <strong>Knowledge Base</strong>
        </div>

        <span className="webmind-kb-count">
          {pages.length} pages
        </span>

      </div>


      {/* Collection selector */}

      <div className="webmind-kb-selector">

        <select
          value={selectedId}
          onChange={(event) =>
            handleSelect(event.target.value)
          }
          disabled={busy}
          aria-label="Select knowledge base"
        >

          <option value="">
            Select a collection
          </option>

          {collections.map((kb) => (
            <option
              key={kb.id}
              value={kb.id}
            >
              {kb.name} ({kb.page_count})
            </option>
          ))}

        </select>

        <button
          type="button"
          className="webmind-kb-icon-btn"
          onClick={() =>
            setShowCreate(!showCreate)
          }
          title="Create knowledge base"
          disabled={busy}
        >
          <Plus size={17} />
        </button>

      </div>


      {/* Create collection */}

      {showCreate && (
        <div className="webmind-kb-create">

          <input
            autoFocus
            type="text"
            maxLength={100}
            placeholder="Collection name"
            value={newName}
            onChange={(event) =>
              setNewName(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleCreate();
              }
            }}
          />

          <button
            type="button"
            onClick={handleCreate}
            disabled={busy || !newName.trim()}
          >
            Create
          </button>

        </div>
      )}


      {selectedId && (
        <>

          {/* Saved pages toolbar */}

          <div className="webmind-kb-page-toolbar">

            <button
              className="webmind-kb-page-expand"
              type="button"
              onClick={() =>
                setShowPages(!showPages)
              }
            >
              <FileText size={14} />

              <span>
                Saved webpages ({pages.length})
              </span>

              {showPages
                ? <ChevronUp size={14} />
                : <ChevronDown size={14} />}
            </button>

            <button
              className="webmind-kb-icon-btn"
              type="button"
              title="Add current webpage"
              onClick={handleAddPage}
              disabled={!currentPageId || busy}
            >
              <Plus size={16} />
            </button>

            <button
              className="webmind-kb-icon-btn"
              type="button"
              title="Clear conversation"
              onClick={handleClear}
              disabled={busy}
            >
              <BookOpen size={15} />
            </button>

            <button
              className="webmind-kb-icon-btn danger"
              type="button"
              title="Delete knowledge base"
              onClick={handleDelete}
              disabled={busy}
            >
              <Trash2 size={15} />
            </button>

          </div>


          {/* Collapsible saved pages */}

          {showPages && (
            <div className="webmind-kb-page-list">

              {pages.length === 0 && (
                <p>
                  No webpages yet. Add the current
                  indexed webpage using +.
                </p>
              )}

              {pages.map((page) => (
                <div
                  className="webmind-kb-page"
                  key={page.page_id}
                >

                  <FileText size={14} />

                  <span title={page.url}>
                    {page.title}
                  </span>

                  <button
                    type="button"
                    title="Remove webpage"
                    onClick={() =>
                      handleRemovePage(page.page_id)
                    }
                    disabled={busy}
                  >
                    <X size={14} />
                  </button>

                </div>
              ))}

            </div>
          )}


          {/* Conversation messages */}

          <div className="webmind-kb-messages">

            {messages.length === 0 && (
              <div className="webmind-kb-empty">
                <Bot size={26} />

                <strong>
                  Ask across your saved webpages
                </strong>

                <p>
                  Compare information, explore
                  connections, or ask follow-up
                  questions across this collection.
                </p>
              </div>
            )}

            {messages.map((message) => (

              <div
                key={message.id}
                className={
                  "webmind-kb-message " +
                  `webmind-kb-${message.role}`
                }
              >

                {message.role === "assistant" && (
                  <div className="webmind-kb-avatar">
                    <Bot size={14} />
                  </div>
                )}

                <div className="webmind-kb-bubble">

                  {message.role === "assistant" && (
                    <strong>WebMind AI</strong>
                  )}

                  <div className="webmind-kb-content">
                    {message.role === "assistant" ? (
                      <CitationText
                        text={message.content}
                        sources={Array.isArray(message.sources)
                          ? message.sources
                          : []}
                        onCitationClick={handleKnowledgeBaseCitation}
                      />
                    ) : (
                      message.content
                    )}
                  </div>

                  {message.role === "assistant" &&
                    message.sources?.length > 0 && (

                    <span className="webmind-kb-inline-sources">
                      <BookOpen size={12} />
                      {message.sources.length} sources
                    </span>
                  )}

                </div>

              </div>
            ))}

            {busy && (
              <div className="webmind-kb-thinking">
                <LoaderCircle size={15} />
                Processing...
              </div>
            )}

            <div ref={messageEndRef} />

          </div>


          {/* Collapsible answer sources */}

          {sources.length > 0 && (
            <div className="webmind-kb-sources-wrap">

              <button
                type="button"
                className="webmind-kb-sources-toggle"
                onClick={() =>
                  setShowSources(!showSources)
                }
              >

                <BookOpen size={14} />

                <span>
                  Answer sources
                </span>

                <span className="webmind-kb-source-count">
                  {sources.length}
                </span>

                {showSources
                  ? <ChevronUp size={14} />
                  : <ChevronDown size={14} />}

              </button>

              {showSources && (
                <div className="webmind-kb-sources">

                  {sources.map((source, index) => (

                    <div
                      className="webmind-kb-source"
                      key={
                        source.chunk_id ||
                        `source-${index}`
                      }
                    >

                      <strong>
                        [{source.citation}]{" "}
                        {source.page_title}
                      </strong>

                      <span>
                        {source.heading}
                      </span>

                      {source.url && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open webpage
                          <ExternalLink size={12} />
                        </a>
                      )}

                    </div>
                  ))}

                </div>
              )}

            </div>
          )}


          {/* Compact question composer */}

          <form
            className="webmind-kb-composer"
            onSubmit={(event) => {
              event.preventDefault();
              handleAsk();
            }}
          >

            <textarea
              rows={2}
              value={question}
              onChange={(event) =>
                setQuestion(event.target.value)
              }
              placeholder="Ask across saved webpages..."
              disabled={busy}
              maxLength={2000}
              onKeyDown={(event) => {

                if (
                  event.key === "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();

                  if (
                    question.trim() &&
                    !busy
                  ) {
                    handleAsk();
                  }
                }
              }}
            />

            <button
              type="submit"
              title="Send question"
              disabled={
                busy ||
                !question.trim() ||
                pages.length === 0
              }
            >
              <Send size={17} />
            </button>

          </form>

        </>
      )}


      {/* Status messages */}

      {notice && (
        <div className="webmind-kb-notice">
          {notice}
        </div>
      )}

      {error && (
        <div
          className="webmind-kb-error"
          role="alert"
        >
          {error}
        </div>
      )}

    </section>
  );
}

export default KnowledgeBasePanel;
