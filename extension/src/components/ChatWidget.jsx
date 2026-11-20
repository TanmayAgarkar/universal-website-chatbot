
import {
  useState,
  useEffect,
  useRef
} from "react";

import {
  Bot,
  Globe,
  Sparkles,
  BookOpen,
  FileSearch,
  Server,
  DatabaseZap,
  Search,
  Layers,
  FileText
} from "lucide-react";

import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";

// Module 13: Clickable webpage citations
import {
  openWebpageSource
} from "../utils/sourceNavigator";

// Module 11: Multi-Page Knowledge Base
import KnowledgeBasePanel from "./KnowledgeBasePanel";

// Module 12: PDF Question Answering
import PDFChatPanel from "./PDFChatPanel";

// Module 4: Webpage Extraction
import {
  extractPageContent
} from "../utils/pageExtractor";

// Modules 5-10: Backend APIs
import {
  ingestPage,
  indexPage,
  searchPage,
  askWebMind,
  getHistoryByUrl,
  clearPageHistory
} from "../services/api";

// Module 8: Navigation Detection
import {
  usePageNavigation
} from "../hooks/usePageNavigation";


// ==========================================
// 1. Constants
// ==========================================

const INITIAL_MESSAGE =
  "Hello! I'm WebMind AI. " +
  "Ask me anything about the current webpage.";

const CHAT_MODES = {
  PAGE: "page",
  KNOWLEDGE_BASE: "kb",
  PDF: "pdf"
};


// ==========================================
// 2. Message Utilities
// ==========================================

function createMessage(role, content, sources = []) {

  return {
    id: crypto.randomUUID(),
    role,
    content,
    sources,
    createdAt: new Date().toISOString()
  };
}


function initialMessages() {

  return [
    createMessage(
      "assistant",
      INITIAL_MESSAGE
    )
  ];
}


// ==========================================
// 3. URL Utilities
// ==========================================

function currentPageKey() {

  const url = new URL(
    window.location.href
  );

  url.hash = "";

  return url.href;
}


function pageKeyFromUrl(value) {

  const url = new URL(value);

  url.hash = "";

  return url.href;
}


function getErrorMessage(
  error,
  fallback
) {

  return error instanceof Error
    ? error.message
    : fallback;
}


// ==========================================
// 4. Restore Conversation Messages
// ==========================================

function restoreMessages(savedMessages) {

  const initial = initialMessages();

  if (!Array.isArray(savedMessages)) {
    return initial;
  }

  const restored = savedMessages
    .filter(
      (message) =>
        message.role === "user" ||
        message.role === "assistant"
    )
    .map((message) => ({
      id: String(
        message.id ?? crypto.randomUUID()
      ),

      role: message.role,

      content: String(
        message.content || ""
      ),

      sources: Array.isArray(message.sources)
        ? message.sources
        : [],

      createdAt:
        message.createdAt ||
        new Date().toISOString()
    }));

  return [
    ...initial,
    ...restored
  ];
}


// ==========================================
// 5. Restore Latest Answer Sources
// ==========================================

function latestAnswerSources(savedMessages) {

  if (!Array.isArray(savedMessages)) {
    return [];
  }

  for (
    let i = savedMessages.length - 1;
    i >= 0;
    i--
  ) {

    const message = savedMessages[i];

    if (
      message.role === "assistant" &&
      Array.isArray(message.sources)
    ) {

      return message.sources;
    }
  }

  return [];
}


// ==========================================
// 6. Main ChatWidget Component
// ==========================================

function ChatWidget({ onClose }) {

  // ----------------------------------------
  // Module 3: Basic Chatbot State
  // ----------------------------------------

  const [minimized, setMinimized] =
    useState(false);

  const [input, setInput] =
    useState("");

  const [messages, setMessages] =
    useState(initialMessages);

  const [isLoading, setIsLoading] =
    useState(false);

  const [error, setError] =
    useState("");


  // ----------------------------------------
  // Module 4: Webpage Extraction
  // ----------------------------------------

  const [pageData, setPageData] =
    useState(null);

  const [isExtracting, setIsExtracting] =
    useState(false);


  // ----------------------------------------
  // Module 5: Backend State
  // ----------------------------------------

  const [isUploading, setIsUploading] =
    useState(false);

  const [backendResult, setBackendResult] =
    useState(null);


  // ----------------------------------------
  // Module 6: RAG State
  // ----------------------------------------

  const [isIndexing, setIsIndexing] =
    useState(false);

  const [isSearching, setIsSearching] =
    useState(false);

  const [ragIndexed, setRagIndexed] =
    useState(false);

  const [ragResult, setRagResult] =
    useState(null);


  // ----------------------------------------
  // Module 7: Gemini Sources
  // ----------------------------------------

  const [chatSources, setChatSources] =
    useState([]);


  // ----------------------------------------
  // Module 8: Navigation Detection
  // ----------------------------------------

  const navigation = usePageNavigation();

  const [
    navigationNotice,
    setNavigationNotice
  ] = useState(null);


  // ----------------------------------------
  // Module 9: Persistent Conversation
  // ----------------------------------------

  const [isRestoring, setIsRestoring] =
    useState(true);

  const [
    isClearingHistory,
    setIsClearingHistory
  ] = useState(false);

  const [historyNotice, setHistoryNotice] =
    useState("");


  // ========================================
  // Modules 11 and 12:
  // Three Chat Modes
  // ========================================

  const [activeMode, setActiveMode] =
    useState(CHAT_MODES.PAGE);

  // Once opened, preserve the additional
  // panels while switching between modes.

  const [hasOpenedKB, setHasOpenedKB] =
    useState(false);

  const [hasOpenedPDF, setHasOpenedPDF] =
    useState(false);


  // ----------------------------------------
  // References
  // ----------------------------------------

  const generationRef = useRef(0);

  const uploadGenerationRef = useRef(0);

  const ragGenerationRef = useRef(0);

  const historyGenerationRef = useRef(0);

  const operationRef = useRef(null);

  const operationIdRef = useRef(0);

  const mountedRef = useRef(false);

  const previousPageKeyRef = useRef(
    navigation.key
  );


  // ========================================
  // 7. Current Webpage Information
  // ========================================

  const pageTitle =
    navigation.title || "Untitled Page";

  const website =
    navigation.domain ||
    window.location.hostname;


  // ========================================
  // 8. Busy State
  // ========================================

  const isBusy =
    isLoading ||
    isExtracting ||
    isUploading ||
    isIndexing ||
    isSearching ||
    isRestoring ||
    isClearingHistory;


  // ========================================
  // 9. Mode Utilities
  // ========================================

  const isPageMode =
    activeMode === CHAT_MODES.PAGE;

  const isKnowledgeBaseMode =
    activeMode === CHAT_MODES.KNOWLEDGE_BASE;

  const isPDFMode =
    activeMode === CHAT_MODES.PDF;


  const handleModeChange = (mode) => {

    if (
      !Object.values(CHAT_MODES).includes(mode)
    ) {
      return;
    }

    if (mode === CHAT_MODES.KNOWLEDGE_BASE) {
      setHasOpenedKB(true);
    }

    if (mode === CHAT_MODES.PDF) {
      setHasOpenedPDF(true);
    }

    setActiveMode(mode);
  };


  // ========================================
  // Module 13: Navigate to cited webpage text
  // ========================================

  const handlePageCitation = (source) => {

    const result = openWebpageSource(
      source,
      navigation.url
    );

    if (!result.success) {
      setError(
        result.message || "Unable to open cited source."
      );
    }
  };


  // ========================================
  // 10. Operation Utilities
  // ========================================

  const beginOperation = (type) => {

    if (operationRef.current !== null) {
      return null;
    }

    const operation = {
      id: ++operationIdRef.current,
      type,
      pageKey: currentPageKey()
    };

    operationRef.current = operation;

    return operation;
  };


  const isOperationCurrent = (operation) => {

    return (
      mountedRef.current &&
      operationRef.current === operation &&
      currentPageKey() === operation.pageKey
    );
  };


  const finishOperation = (operation) => {

    if (
      operationRef.current === operation
    ) {

      operationRef.current = null;

      return true;
    }

    return false;
  };


  const invalidateOperations = () => {

    generationRef.current += 1;

    uploadGenerationRef.current += 1;

    ragGenerationRef.current += 1;

    operationRef.current = null;
  };


  // ========================================
  // 11. Component Lifecycle
  // ========================================

  useEffect(() => {

    mountedRef.current = true;

    return () => {

      mountedRef.current = false;

      invalidateOperations();

      historyGenerationRef.current += 1;
    };

  }, []);


  // ========================================
  // 12. Navigation and History Restoration
  // Modules 8 and 9
  // ========================================

  useEffect(() => {

    const pageKey = navigation.key;

    const previousKey =
      previousPageKeyRef.current;

    const isNewPage =
      previousKey !== pageKey;

    previousPageKeyRef.current = pageKey;

    const generation =
      ++historyGenerationRef.current;

    let cancelled = false;


    // --------------------------------------
    // Reset Page-Specific State
    // --------------------------------------

    if (isNewPage) {

      console.log(
        "WebMind navigation detected:",
        {
          previous: previousKey,
          current: pageKey,
          title: navigation.title
        }
      );

      invalidateOperations();

      setInput("");
      setError("");

      setIsLoading(false);
      setIsExtracting(false);
      setIsUploading(false);

      setIsIndexing(false);
      setIsSearching(false);
      setIsClearingHistory(false);

      setPageData(null);
      setBackendResult(null);

      setRagIndexed(false);
      setRagResult(null);

      setChatSources([]);

      setMessages(
        initialMessages()
      );

      setNavigationNotice({
        title: navigation.title,
        url: navigation.url
      });

      // IMPORTANT:
      // Do not reset activeMode here.
      //
      // Knowledge Base and PDF Chat are
      // independent of the active webpage.
    }


    setIsRestoring(true);
    setHistoryNotice("");


    // --------------------------------------
    // Verify Current Restoration
    // --------------------------------------

    const isCurrentRestore = () => {

      return (
        !cancelled &&
        mountedRef.current &&
        generation ===
          historyGenerationRef.current &&
        currentPageKey() === pageKey
      );
    };


    // --------------------------------------
    // Restore Saved Conversation
    // --------------------------------------

    const restoreHistory = async () => {

      try {

        const result =
          await getHistoryByUrl(
            navigation.url
          );

        if (!isCurrentRestore()) {
          return;
        }


        // ----------------------------------
        // New Webpage
        // ----------------------------------

        if (!result.found) {

          setBackendResult(null);

          setRagIndexed(false);

          if (isNewPage) {

            setMessages([
              ...initialMessages(),

              createMessage(
                "assistant",

                `New webpage detected!\n\n` +
                `Title: ${navigation.title}\n` +
                `URL: ${navigation.url}\n\n` +
                `Click Analyze Page to begin.`
              )
            ]);
          }

          setHistoryNotice("");

          return;
        }


        // ----------------------------------
        // Existing SQLite Webpage
        // ----------------------------------

        setBackendResult({
          page_id: result.page_id,
          title: result.title,
          status: "restored"
        });

        setRagIndexed(
          result.indexed === true
        );

        const savedMessages =
          Array.isArray(result.messages)
            ? result.messages
            : [];

        setMessages(
          restoreMessages(savedMessages)
        );

        setChatSources(
          latestAnswerSources(savedMessages)
        );

        setNavigationNotice(null);


        if (savedMessages.length > 0) {

          setHistoryNotice(
            `${savedMessages.length} messages restored.`
          );

        } else {

          setHistoryNotice(
            result.indexed === true
              ? "Previously indexed webpage restored."
              : "Stored webpage restored."
          );
        }

        console.log(
          "WebMind history restored:",
          result
        );

      } catch (err) {

        if (!isCurrentRestore()) {
          return;
        }

        console.error(
          "WebMind history restoration error:",
          err
        );

        setHistoryNotice(
          "Could not restore saved conversation."
        );

      } finally {

        if (isCurrentRestore()) {

          setIsRestoring(false);
        }
      }
    };


    restoreHistory();


    return () => {

      cancelled = true;

      if (
        generation ===
        historyGenerationRef.current
      ) {

        historyGenerationRef.current += 1;
      }
    };

  }, [navigation.key]);


  // ========================================
  // 13. Gemini + History-Aware RAG Chat
  // Modules 7 and 10
  // ========================================

  const handleSend = async () => {

    const question = input.trim();

    if (
      !question ||
      isBusy
    ) {
      return;
    }

    if (
      navigation.key !== currentPageKey()
    ) {

      setError(
        "Webpage navigation detected. " +
        "Please use the new page context."
      );

      return;
    }

    if (
      !backendResult?.page_id ||
      !ragIndexed
    ) {

      setError(
        "Please Analyze Page, Send to Backend, " +
        "and Index Page before asking questions."
      );

      return;
    }

    const operation =
      beginOperation("chat");

    if (!operation) {
      return;
    }

    const pageId =
      backendResult.page_id;

    const generation =
      ++generationRef.current;

    setIsLoading(true);
    setError("");
    setInput("");
    setChatSources([]);


    setMessages((previous) => [
      ...previous,

      createMessage(
        "user",
        question
      )
    ]);


    try {

      // Module 10:
      // Backend loads history, rewrites the
      // question, retrieves evidence, and
      // generates a grounded answer.

      const result =
        await askWebMind(
          pageId,
          question
        );

      if (
        generation !== generationRef.current ||
        !isOperationCurrent(operation)
      ) {
        return;
      }

      const answer =
        result.answer?.trim() ||
        "No answer was returned.";

      setChatSources(
        Array.isArray(result.sources)
          ? result.sources
          : []
      );

      setMessages((previous) => [
        ...previous,

        createMessage(
          "assistant",
          answer,
          Array.isArray(result.sources)
            ? result.sources
            : []
        )
      ]);


      // Module 10:
      // Only grounded answers are saved
      // by the backend.

      if (result.grounded === true) {

        setHistoryNotice(
          "Conversation saved · Context-aware RAG enabled."
        );

      } else {

        setHistoryNotice(
          "Answer generated, but not saved to history."
        );
      }

      console.log(
        "WebMind Gemini answer:",
        result
      );

    } catch (err) {

      if (
        generation !== generationRef.current ||
        !isOperationCurrent(operation)
      ) {
        return;
      }

      setError(
        getErrorMessage(
          err,
          "Unable to generate an AI answer."
        )
      );

      setInput(question);

      console.error(
        "WebMind Gemini error:",
        err
      );

    } finally {

      if (
        generation === generationRef.current &&
        isOperationCurrent(operation)
      ) {

        setIsLoading(false);
      }

      finishOperation(operation);
    }
  };


  // ========================================
  // 14. Analyze Current Webpage
  // Module 4
  // ========================================

  const handleAnalyzePage = () => {

    if (
      isBusy ||
      navigation.key !== currentPageKey()
    ) {
      return;
    }

    const operation =
      beginOperation("extract");

    if (!operation) {
      return;
    }

    setIsExtracting(true);
    setError("");

    setPageData(null);
    setBackendResult(null);

    setRagIndexed(false);
    setRagResult(null);
    setChatSources([]);

    uploadGenerationRef.current += 1;
    ragGenerationRef.current += 1;


    try {

      const extractedData =
        extractPageContent();

      if (!isOperationCurrent(operation)) {
        return;
      }

      if (
        pageKeyFromUrl(extractedData.url) !==
        currentPageKey()
      ) {

        throw new Error(
          "The webpage changed during extraction."
        );
      }

      setPageData(extractedData);
      setNavigationNotice(null);

      console.log(
        "WebMind extracted page:",
        extractedData
      );

      console.table(
        extractedData.sections
          .slice(0, 15)
          .map((section) => ({
            id: section.section_id,
            type: section.type,
            heading: section.heading,
            text: section.text.slice(0, 90)
          }))
      );

      const stats =
        extractedData.statistics;

      const analysisMessage =
        `Page analyzed successfully!\n\n` +
        `Title: ${extractedData.title}\n` +
        `Domain: ${extractedData.domain}\n\n` +
        `Total Sections: ${stats.total_sections}\n` +
        `Total Words: ${stats.total_words}\n` +
        `Total Characters: ${stats.total_characters}\n\n` +
        `Headings: ${stats.headings}\n` +
        `Paragraphs: ${stats.paragraphs}\n` +
        `Lists: ${stats.lists}\n` +
        `Tables: ${stats.tables}\n\n` +
        `Next: Click Send to Backend.`;

      setMessages((previous) => [
        ...previous,

        createMessage(
          "assistant",
          analysisMessage
        )
      ]);

    } catch (err) {

      if (isOperationCurrent(operation)) {

        setError(
          getErrorMessage(
            err,
            "Failed to analyze the webpage."
          )
        );
      }

      console.error(
        "WebMind extraction error:",
        err
      );

    } finally {

      if (isOperationCurrent(operation)) {
        setIsExtracting(false);
      }

      finishOperation(operation);
    }
  };


  // ========================================
  // 15. Upload Page to FastAPI
  // Module 5
  // ========================================

  const handleSendToBackend = async () => {

    if (
      !pageData ||
      isBusy
    ) {
      return;
    }

    if (
      navigation.key !== currentPageKey() ||
      pageKeyFromUrl(pageData.url) !==
        currentPageKey()
    ) {

      setError(
        "The webpage has changed. " +
        "Please Analyze Page again."
      );

      return;
    }

    const operation =
      beginOperation("upload");

    if (!operation) {
      return;
    }

    const generation =
      ++uploadGenerationRef.current;

    setIsUploading(true);
    setError("");

    setBackendResult(null);
    setRagIndexed(false);

    setRagResult(null);
    setChatSources([]);

    ragGenerationRef.current += 1;


    try {

      const result =
        await ingestPage(pageData);

      if (
        generation !==
          uploadGenerationRef.current ||
        !isOperationCurrent(operation)
      ) {
        return;
      }

      setBackendResult(result);

      const successMessage =
        `Webpage uploaded successfully!\n\n` +
        `Title: ${result.title}\n` +
        `Page ID: ${result.page_id}\n` +
        `Sections: ${result.total_sections}\n` +
        `Words: ${result.total_words}\n` +
        `Storage Status: ${result.status}\n\n` +
        `Next: Click Index Page.`;

      setMessages((previous) => [
        ...previous,

        createMessage(
          "assistant",
          successMessage
        )
      ]);

      console.log(
        "WebMind backend response:",
        result
      );

    } catch (err) {

      if (
        generation !==
          uploadGenerationRef.current ||
        !isOperationCurrent(operation)
      ) {
        return;
      }

      setError(
        getErrorMessage(
          err,
          "Failed to upload webpage."
        )
      );

      console.error(
        "WebMind upload error:",
        err
      );

    } finally {

      if (
        generation ===
          uploadGenerationRef.current &&
        isOperationCurrent(operation)
      ) {

        setIsUploading(false);
      }

      finishOperation(operation);
    }
  };


  // ========================================
  // 16. Index Webpage
  // Module 6
  // ========================================

  const handleIndexPage = async () => {

    if (
      !backendResult?.page_id ||
      isBusy ||
      navigation.key !== currentPageKey()
    ) {
      return;
    }

    const operation =
      beginOperation("index");

    if (!operation) {
      return;
    }

    const pageId =
      backendResult.page_id;

    const generation =
      ++ragGenerationRef.current;

    setIsIndexing(true);
    setError("");

    setRagIndexed(false);
    setRagResult(null);
    setChatSources([]);


    try {

      const result =
        await indexPage(pageId);

      if (
        generation !== ragGenerationRef.current ||
        !isOperationCurrent(operation)
      ) {
        return;
      }

      setRagIndexed(true);

      const indexMessage =
        `RAG indexing completed successfully!\n\n` +
        `Page: ${result.title}\n` +
        `Original Sections: ` +
        `${result.original_sections}\n` +
        `Vector Chunks: ${result.total_chunks}\n` +
        `Embedding Dimension: ` +
        `${result.embedding_dimension}\n` +
        `Status: ${result.status}\n\n` +
        `The webpage is now searchable.\n\n` +
        `You can ask questions using the ` +
        `normal Send button.`;

      setMessages((previous) => [
        ...previous,

        createMessage(
          "assistant",
          indexMessage
        )
      ]);

      console.log(
        "WebMind indexing result:",
        result
      );

    } catch (err) {

      if (
        generation !== ragGenerationRef.current ||
        !isOperationCurrent(operation)
      ) {
        return;
      }

      setError(
        getErrorMessage(
          err,
          "Page indexing failed."
        )
      );

      console.error(
        "WebMind indexing error:",
        err
      );

    } finally {

      if (
        generation === ragGenerationRef.current &&
        isOperationCurrent(operation)
      ) {

        setIsIndexing(false);
      }

      finishOperation(operation);
    }
  };


  // ========================================
  // 17. Semantic Search
  // Module 6
  // ========================================

  const handleSemanticSearch = async () => {

    const question = input.trim();

    if (
      !question ||
      !backendResult?.page_id ||
      !ragIndexed ||
      isBusy ||
      navigation.key !== currentPageKey()
    ) {
      return;
    }

    const operation =
      beginOperation("search");

    if (!operation) {
      return;
    }

    const pageId =
      backendResult.page_id;

    const generation =
      ++ragGenerationRef.current;

    setIsSearching(true);
    setError("");
    setInput("");
    setChatSources([]);

    setMessages((previous) => [
      ...previous,

      createMessage(
        "user",
        question
      )
    ]);


    try {

      const result =
        await searchPage(
          pageId,
          question
        );

      if (
        generation !== ragGenerationRef.current ||
        !isOperationCurrent(operation)
      ) {
        return;
      }

      setRagResult(result);

      const matches =
        Array.isArray(result.results)
          ? result.results
          : [];

      const passages = matches.map(
        (match) => {

          const similarity =
            Number(
              match.similarity ?? 0
            ).toFixed(3);

          return (
            `[${match.rank}] ` +
            `${match.heading || "Untitled Section"}\n` +
            `Similarity: ${similarity}\n` +
            `Section: ${match.section_id}\n\n` +
            `${String(match.text || "").slice(0, 450)}`
          );
        }
      );

      const response =
        `Semantic Search Results\n\n` +
        `Question: ${question}\n` +
        `Relevant Passages: ${result.total_results}\n\n` +
        passages.join(
          "\n\n----------------\n\n"
        ) +
        `\n\nThese are retrieved webpage passages, ` +
        `not AI-generated answers.\n\n` +
        `Use the normal Send button to ask Gemini.`;

      setMessages((previous) => [
        ...previous,

        createMessage(
          "assistant",
          response
        )
      ]);

      console.log(
        "WebMind semantic search:",
        result
      );

    } catch (err) {

      if (
        generation !== ragGenerationRef.current ||
        !isOperationCurrent(operation)
      ) {
        return;
      }

      setError(
        getErrorMessage(
          err,
          "Semantic search failed."
        )
      );

      setInput(question);

      console.error(
        "WebMind search error:",
        err
      );

    } finally {

      if (
        generation === ragGenerationRef.current &&
        isOperationCurrent(operation)
      ) {

        setIsSearching(false);
      }

      finishOperation(operation);
    }
  };


  // ========================================
  // 18. Clear Page Conversation
  // Module 9
  // ========================================

  const handleClear = async () => {

    if (
      isBusy ||
      operationRef.current !== null
    ) {
      return;
    }

    const pageId =
      backendResult?.page_id;

    // --------------------------------------
    // Unstored Page
    // --------------------------------------

    if (!pageId) {

      invalidateOperations();

      setMessages(
        initialMessages()
      );

      setChatSources([]);
      setInput("");
      setError("");
      setHistoryNotice("");

      return;
    }

    const operation =
      beginOperation("clear");

    if (!operation) {
      return;
    }

    setIsClearingHistory(true);
    setError("");


    try {

      const result =
        await clearPageHistory(
          pageId
        );

      if (!isOperationCurrent(operation)) {
        return;
      }

      generationRef.current += 1;

      setMessages([
        ...initialMessages(),

        createMessage(
          "assistant",
          "Conversation cleared successfully.\n\n" +
          "The webpage remains available for " +
          "semantic search and Gemini questions."
        )
      ]);

      setChatSources([]);
      setInput("");
      setHistoryNotice("");

      console.log(
        "WebMind conversation cleared:",
        result
      );

    } catch (err) {

      if (!isOperationCurrent(operation)) {
        return;
      }

      setError(
        getErrorMessage(
          err,
          "Failed to clear conversation history."
        )
      );

      console.error(
        "WebMind clear history error:",
        err
      );

    } finally {

      if (isOperationCurrent(operation)) {
        setIsClearingHistory(false);
      }

      finishOperation(operation);
    }
  };


  // ========================================
  // 19. Header Clear Handler
  // ========================================

  const handleHeaderClear = () => {

    // The header clear action is reserved
    // for the current webpage chat.
    //
    // KB and PDF have independent clear
    // actions inside their own panels.

    if (!isPageMode) {
      return;
    }

    handleClear();
  };


  // ========================================
  // 20. Close Chatbot
  // Module 3
  // ========================================

  const handleClose = () => {

    invalidateOperations();

    historyGenerationRef.current += 1;

    onClose();
  };


  // ========================================
  // 21. Minimized Chatbot
  // ========================================

  if (minimized) {

    return (
      <button
        type="button"
        className="webmind-floating-button"
        onClick={() =>
          setMinimized(false)
        }
        title="Open WebMind AI"
        aria-label="Open WebMind AI"
      >
        <Bot size={27} />
      </button>
    );
  }


  // ========================================
  // 22. Main Chatbot Interface
  // ========================================

  return (
    <div className="webmind-chatbot">

      {/* ====================================
          Chat Header
          ==================================== */}

      <ChatHeader
        onMinimize={() =>
          setMinimized(true)
        }
        onClose={handleClose}
        onClear={
          isPageMode
            ? handleHeaderClear
            : undefined
        }
      />


      {/* ====================================
          Current Website Information
          ==================================== */}

      <div className="webmind-website-info">

        <Globe size={18} />

        <div>

          <strong title={pageTitle}>
            {pageTitle}
          </strong>

          <span>
            {website}
          </span>

        </div>

      </div>


      {/* ====================================
          Modules 11 and 12:
          Three-Mode Navigation Tabs
          ==================================== */}

      <div
        className="webmind-mode-tabs"
        role="group"
        aria-label="WebMind AI chat mode"
      >

        {/* Page Chat */}

        <button
          type="button"
          className={
            isPageMode
              ? "active"
              : ""
          }
          onClick={() =>
            handleModeChange(
              CHAT_MODES.PAGE
            )
          }
          aria-pressed={isPageMode}
          title="Chat with current webpage"
        >

          <Globe size={14} />

          <span>
            Page Chat
          </span>

        </button>


        {/* Knowledge Base */}

        <button
          type="button"
          className={
            isKnowledgeBaseMode
              ? "active"
              : ""
          }
          onClick={() =>
            handleModeChange(
              CHAT_MODES.KNOWLEDGE_BASE
            )
          }
          aria-pressed={isKnowledgeBaseMode}
          title="Ask across multiple saved webpages"
        >

          <Layers size={14} />

          <span>
            Knowledge Base
          </span>

        </button>


        {/* PDF Chat */}

        <button
          type="button"
          className={
            isPDFMode
              ? "active"
              : ""
          }
          onClick={() =>
            handleModeChange(
              CHAT_MODES.PDF
            )
          }
          aria-pressed={isPDFMode}
          title="Upload and chat with PDF documents"
        >

          <FileText size={14} />

          <span>
            PDF Chat
          </span>

        </button>

      </div>


      {/* ====================================
          Module 11:
          Multi-Page Knowledge Base
          ==================================== */}

      {hasOpenedKB && (

        <div
          style={{
            display: isKnowledgeBaseMode
              ? "contents"
              : "none"
          }}
        >

          <KnowledgeBasePanel
            currentPageId={
              backendResult?.page_id || null
            }
          />

        </div>
      )}


      {/* ====================================
          Module 12:
          PDF Question Answering
          ==================================== */}

      {hasOpenedPDF && (

        <div
          style={{
            display: isPDFMode
              ? "contents"
              : "none"
          }}
        >

          <PDFChatPanel />

        </div>
      )}


      {/* ====================================
          Modules 3-10:
          Single-Page Chat Mode
          ==================================== */}

      {isPageMode && (
        <>

          {/* ------------------------------
              Module 8:
              Navigation Notification
              ------------------------------ */}

          {navigationNotice && !pageData && (

            <div className="webmind-navigation-notice">

              <Globe size={15} />

              <div>

                <strong>
                  New Webpage Detected
                </strong>

                <span
                  title={navigationNotice.url}
                >
                  {navigationNotice.title}
                </span>

                <small>
                  Analyze this page to enable RAG.
                </small>

              </div>

            </div>
          )}


          {/* ------------------------------
              Module 9:
              History Restoration
              ------------------------------ */}

          {isRestoring && (

            <div className="webmind-history-status">

              <BookOpen size={14} />

              <span>
                Restoring page conversation...
              </span>

            </div>
          )}


          {/* ------------------------------
              Module 9:
              Conversation History Notice
              ------------------------------ */}

          {!isRestoring && historyNotice && (

            <div className="webmind-history-status">

              <BookOpen size={14} />

              <span>
                {historyNotice}
              </span>

            </div>
          )}


          {/* ------------------------------
              Main Chat Messages
              ------------------------------ */}

          <MessageList
            messages={messages}
            isLoading={
              isLoading ||
              isSearching
            }
            onCitationClick={handlePageCitation}
          />


          {/* ------------------------------
              Module 7:
              Gemini Answer Sources
              ------------------------------ */}

          {chatSources.length > 0 && (

            <div className="webmind-sources">

              <div className="webmind-sources-title">

                <BookOpen size={14} />

                Answer Sources

              </div>

              <div className="webmind-sources-list">

                {chatSources.map(
                  (source, index) => (

                    <div
                      className="webmind-source-item"
                      key={
                        source.chunk_id ||
                        `source-${index}`
                      }
                    >

                      <strong>
                        [{source.citation}]{" "}
                        {source.heading ||
                          "Webpage Section"}
                      </strong>

                      <span>
                        Section: {source.section_id}
                      </span>

                      <span>
                        Similarity:{" "}
                        {Number(
                          source.similarity ?? 0
                        ).toFixed(3)}
                      </span>

                      {source.excerpt && (

                        <span
                          title={source.excerpt}
                          className="webmind-source-excerpt"
                        >

                          {source.excerpt.slice(
                            0,
                            130
                          )}

                          {source.excerpt.length > 130
                            ? "..."
                            : ""}

                        </span>
                      )}

                    </div>

                  )
                )}

              </div>

            </div>
          )}


          {/* ------------------------------
              Module 4:
              Extraction Statistics
              ------------------------------ */}

          {pageData && (

            <div className="webmind-analysis-status">

              <div className="webmind-analysis-title">
                Page Content Extracted
              </div>

              <div className="webmind-analysis-stats">

                <span>
                  {pageData.statistics.total_words} words
                </span>

                <span>
                  {pageData.statistics.total_sections} sections
                </span>

                <span>
                  {pageData.statistics.headings} headings
                </span>

              </div>

            </div>
          )}


          {/* ------------------------------
              Module 5:
              Backend Status
              ------------------------------ */}

          {backendResult && (

            <div className="webmind-backend-status">

              <strong>
                Backend Connected
              </strong>

              <span>
                Status: {backendResult.status}
              </span>

              <span
                title={backendResult.page_id}
              >
                ID: {backendResult.page_id.slice(0, 8)}...
              </span>

            </div>
          )}


          {/* ------------------------------
              Module 6:
              RAG Status
              ------------------------------ */}

          {ragIndexed && (

            <div className="webmind-rag-status">

              <DatabaseZap size={14} />

              <span>
                RAG Indexed — Gemini Ready
              </span>

            </div>
          )}


          {/* ------------------------------
              Error Display
              ------------------------------ */}

          {error && (

            <div
              className="webmind-error"
              role="alert"
            >
              {error}
            </div>
          )}


          {/* ==================================
              Page Chat Action Buttons
              ================================== */}

          <div className="webmind-suggestions">

            {/* Summarize */}

            <button
              type="button"
              onClick={() =>
                setInput(
                  "Summarize this webpage"
                )
              }
              disabled={isBusy}
            >

              <Sparkles size={14} />

              Summarize

            </button>


            {/* Key Concepts */}

            <button
              type="button"
              onClick={() =>
                setInput(
                  "Explain the key concepts on this page"
                )
              }
              disabled={isBusy}
            >

              <BookOpen size={14} />

              Key Concepts

            </button>


            {/* Module 4: Analyze Page */}

            <button
              type="button"
              onClick={handleAnalyzePage}
              disabled={isBusy}
            >

              <FileSearch size={14} />

              {isExtracting
                ? "Analyzing..."
                : "Analyze Page"}

            </button>


            {/* Module 5: Send to Backend */}

            <button
              type="button"
              onClick={handleSendToBackend}
              disabled={
                !pageData ||
                isBusy
              }
              title="Upload extracted content to FastAPI"
            >

              <Server size={14} />

              {isUploading
                ? "Uploading..."
                : "Send to Backend"}

            </button>


            {/* Module 6: Index Page */}

            <button
              type="button"
              onClick={handleIndexPage}
              disabled={
                !backendResult ||
                isBusy
              }
            >

              <DatabaseZap size={14} />

              {isIndexing
                ? "Indexing..."
                : "Index Page"}

            </button>


            {/* Module 6: Semantic Search */}

            <button
              type="button"
              onClick={handleSemanticSearch}
              disabled={
                !ragIndexed ||
                !backendResult ||
                !input.trim() ||
                isBusy
              }
            >

              <Search size={14} />

              {isSearching
                ? "Searching..."
                : "Search Page"}

            </button>

          </div>


          {/* ------------------------------
              Module 7:
              Gemini Chat Input
              ------------------------------ */}

          <ChatInput
            input={input}
            setInput={setInput}
            onSend={handleSend}
            isLoading={isBusy}
          />

        </>
      )}


      {/* ====================================
          Footer
          ==================================== */}

      <div className="webmind-footer">

        {isPageMode
          ? "WebMind AI · Gemini + RAG + Memory"
          : isKnowledgeBaseMode
          ? "WebMind AI · Multi-Page Knowledge Base"
          : "WebMind AI · PDF Question Answering"}

      </div>

    </div>
  );
}

export default ChatWidget;
