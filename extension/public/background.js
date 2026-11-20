
/*
 * ==========================================
 * WebMind AI - Background Service Worker
 * Modules 2 through 12
 * ==========================================
 *
 * Features:
 * - Chrome toolbar injection and toggling
 * - Automatic restoration after navigation
 * - Independent widget state per tab
 * - FastAPI webpage ingestion
 * - ChromaDB indexing
 * - Semantic retrieval
 * - Gemini-powered webpage chat
 * - Persistent page-specific history
 * - History restoration and deletion
 * - Multi-turn conversational memory
 * - Knowledge base management
 * - Cross-webpage question answering
 * - Knowledge base conversation history
 *
 * Module 12:
 * - PDF upload and validation
 * - Multipart upload to FastAPI
 * - PDF document listing
 * - PDF question answering
 * - PDF conversation restoration
 * - PDF history clearing
 * - PDF document deletion
 *
 * - Sender authorization
 * - Request validation
 * - HTTP error and timeout handling
 */


// ==========================================
// 1. Configuration
// ==========================================

const BACKEND_URL = "http://127.0.0.1:8000";

const OPEN_TAB_PREFIX = "webmind_open_tab_";

const REQUEST_TIMEOUT = 120000;

// Module 12: PDF upload may require more time.
const PDF_UPLOAD_TIMEOUT = 180000;

// Module 12: 10 MB upload limit.
const MAX_PDF_BYTES = 10 * 1024 * 1024;

// Base64 requires approximately 4/3 as
// many characters as the original file.
const MAX_PDF_BASE64_LENGTH =
  4 * Math.ceil(MAX_PDF_BYTES / 3);


// ==========================================
// 2. Backend Endpoints
// ==========================================

const ENDPOINTS = {

  // Module 5
  WEBMIND_INGEST_PAGE: "/api/pages/ingest",

  // Modules 6 and 7
  WEBMIND_SEARCH_PAGE: "/api/rag/search",
  WEBMIND_CHAT: "/api/chat",

  // Module 9
  WEBMIND_HISTORY_BY_URL:
    "/api/history/by-url",

  WEBMIND_PAGE_HISTORY:
    "/api/history",

  // Module 11
  WEBMIND_KB_COLLECTIONS:
    "/api/kb/collections",

  WEBMIND_KB_CHAT:
    "/api/kb/chat",

  // Module 12
  WEBMIND_PDF_UPLOAD:
    "/api/pdf/upload",

  WEBMIND_PDF_DOCUMENTS:
    "/api/pdf/documents",

  WEBMIND_PDF_CHAT:
    "/api/pdf/chat"

};


// ==========================================
// 3. Supported Messages
// ==========================================

const supportedMessages = [

  // Module 5
  "WEBMIND_INGEST_PAGE",

  // Module 6
  "WEBMIND_INDEX_PAGE",
  "WEBMIND_SEARCH_PAGE",

  // Module 7
  "WEBMIND_CHAT",

  // Module 9
  "WEBMIND_GET_PAGE_HISTORY",
  "WEBMIND_GET_HISTORY_BY_URL",
  "WEBMIND_DELETE_PAGE_HISTORY",

  // Module 11
  "WEBMIND_KB_LIST",
  "WEBMIND_KB_CREATE",
  "WEBMIND_KB_GET",
  "WEBMIND_KB_ADD_PAGE",
  "WEBMIND_KB_REMOVE_PAGE",
  "WEBMIND_KB_DELETE",
  "WEBMIND_KB_CHAT",
  "WEBMIND_KB_HISTORY",
  "WEBMIND_KB_CLEAR_HISTORY",

  // Module 12
  "WEBMIND_PDF_UPLOAD",
  "WEBMIND_PDF_LIST",
  "WEBMIND_PDF_CHAT",
  "WEBMIND_PDF_HISTORY",
  "WEBMIND_PDF_CLEAR_HISTORY",
  "WEBMIND_PDF_DELETE"

];


// ==========================================
// 4. URL Utilities
// ==========================================

function isSupportedUrl(url) {

  return (
    typeof url === "string" &&
    /^https?:\/\//i.test(url)
  );
}


function normalizeUrl(url) {

  try {

    const parsed = new URL(url);

    // Ignore fragment-only changes.
    parsed.hash = "";

    return parsed.href;

  } catch {

    return "";
  }
}


// ==========================================
// 5. ID Validation
// ==========================================

function isValidPageId(pageId) {

  return (
    typeof pageId === "string" &&
    /^[a-f0-9]{24}$/.test(pageId)
  );
}


function isValidKnowledgeBaseId(kbId) {

  return (
    typeof kbId === "string" &&
    /^[a-f0-9]{24}$/.test(kbId)
  );
}


// Module 12: PDF IDs use 32 hex characters.

function isValidPDFId(documentId) {

  return (
    typeof documentId === "string" &&
    /^[a-f0-9]{32}$/.test(documentId)
  );
}


// ==========================================
// 6. Question Validation
// ==========================================

function validateQuestion(question) {

  if (
    typeof question !== "string" ||
    !question.trim() ||
    question.trim().length > 2000
  ) {

    throw new Error(
      "Question must contain between " +
      "1 and 2000 characters."
    );
  }

  return question.trim();
}


// ==========================================
// 7. Per-Tab Session State
// ==========================================

function getTabKey(tabId) {

  return `${OPEN_TAB_PREFIX}${tabId}`;
}


async function setTabOpen(tabId, isOpen) {

  const key = getTabKey(tabId);

  if (isOpen) {

    await chrome.storage.session.set({
      [key]: true
    });

  } else {

    await chrome.storage.session.remove(key);
  }
}


async function isTabOpen(tabId) {

  const key = getTabKey(tabId);

  const result =
    await chrome.storage.session.get(key);

  return result[key] === true;
}


// ==========================================
// 8. Chatbot Injection
// ==========================================

const injectionLocks = new Set();


async function isWidgetMounted(tabId) {

  const results =
    await chrome.scripting.executeScript({

      target: {
        tabId,
        allFrames: false
      },

      func: () => {

        return Boolean(
          document.getElementById(
            "webmind-ai-root"
          )
        );
      }

    });

  return results[0]?.result === true;
}


// ==========================================
// 9. Inject or Restore Chatbot
// ==========================================

async function injectChatbot(
  tabId,
  mode = "toggle"
) {

  if (injectionLocks.has(tabId)) {
    return;
  }

  injectionLocks.add(tabId);

  try {

    // --------------------------------------
    // Restore mode:
    // Only inject if chatbot is not mounted.
    // --------------------------------------

    if (mode === "restore") {

      const mounted =
        await isWidgetMounted(tabId);

      if (mounted) {
        return;
      }

      // Recheck state after async operation.
      if (!(await isTabOpen(tabId))) {
        return;
      }
    }

    // --------------------------------------
    // Execute content script.
    // --------------------------------------

    await chrome.scripting.executeScript({

      target: {
        tabId,
        allFrames: false
      },

      files: ["content.js"]

    });

  } finally {

    injectionLocks.delete(tabId);
  }
}


// ==========================================
// 10. Chrome Toolbar Button
// ==========================================

chrome.action.onClicked.addListener(
  async (tab) => {

    if (
      !Number.isInteger(tab.id) ||
      !isSupportedUrl(tab.url)
    ) {

      console.warn(
        "WebMind AI cannot run on this page."
      );

      return;
    }

    try {

      await injectChatbot(
        tab.id,
        "toggle"
      );

    } catch (error) {

      console.error(
        "WebMind toolbar injection failed:",
        error
      );
    }
  }
);


// ==========================================
// 11. Restore After Full Navigation
// ==========================================

chrome.webNavigation.onCompleted.addListener(
  async (details) => {

    // Ignore iframe navigation.
    if (details.frameId !== 0) {
      return;
    }

    if (!isSupportedUrl(details.url)) {
      return;
    }

    try {

      const shouldRestore =
        await isTabOpen(details.tabId);

      if (!shouldRestore) {
        return;
      }

      const currentTab =
        await chrome.tabs.get(details.tabId);

      if (
        !isSupportedUrl(currentTab.url) ||
        normalizeUrl(currentTab.url) !==
          normalizeUrl(details.url)
      ) {
        return;
      }

      await injectChatbot(
        details.tabId,
        "restore"
      );

    } catch (error) {

      console.warn(
        "WebMind navigation restoration failed:",
        error
      );
    }
  }
);


// ==========================================
// 12. Cleanup Closed Tabs
// ==========================================

chrome.tabs.onRemoved.addListener(
  (tabId) => {

    setTabOpen(
      tabId,
      false
    ).catch((error) => {

      console.warn(
        "Unable to clear tab session:",
        error
      );
    });

    injectionLocks.delete(tabId);
  }
);


// ==========================================
// 13. Backend HTTP Request Helper
// ==========================================

async function backendRequest(
  endpoint,
  body = null,
  method = "POST"
) {

  // Prevent calls to arbitrary remote URLs.
  if (
    typeof endpoint !== "string" ||
    !endpoint.startsWith("/") ||
    endpoint.startsWith("//")
  ) {

    throw new Error(
      "Invalid backend endpoint."
    );
  }

  const controller = new AbortController();

  const timeoutId = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT
  );

  try {

    const options = {
      method,
      signal: controller.signal
    };

    if (body !== null) {

      options.headers = {
        "Content-Type": "application/json"
      };

      options.body = JSON.stringify(body);
    }

    const response = await fetch(
      `${BACKEND_URL}${endpoint}`,
      options
    );

    let data;

    try {

      data = await response.json();

    } catch {

      throw new Error(
        "Backend returned invalid JSON " +
        `(HTTP ${response.status}).`
      );
    }

    if (!response.ok) {

      const detail =
        typeof data?.detail === "string"
          ? data.detail
          : JSON.stringify(
              data?.detail || data
            );

      throw new Error(
        `HTTP ${response.status}: ` +
        String(detail).slice(0, 500)
      );
    }

    return data;

  } catch (error) {

    if (error.name === "AbortError") {

      throw new Error(
        "Backend request timed out."
      );
    }

    throw error;

  } finally {

    clearTimeout(timeoutId);
  }
}


// ==========================================
// 14. Validate Extension Sender
// ==========================================

function isAuthorizedSender(sender) {

  return (
    sender.id === chrome.runtime.id &&
    Number.isInteger(sender.tab?.id) &&
    sender.frameId === 0 &&
    isSupportedUrl(
      sender.tab?.url || sender.url
    )
  );
}


// ==========================================
// 15. Module 11: KB Request Handler
// ==========================================

async function handleKnowledgeBaseRequest(
  message
) {

  const kbId = message.kbId;
  const pageId = message.pageId;

  // ----------------------------------------
  // Knowledge Base ID Validation
  // ----------------------------------------

  const requireKB = () => {

    if (!isValidKnowledgeBaseId(kbId)) {

      throw new Error(
        "Invalid knowledge base ID."
      );
    }
  };

  // ----------------------------------------
  // Page ID Validation
  // ----------------------------------------

  const requirePage = () => {

    if (!isValidPageId(pageId)) {

      throw new Error(
        "Invalid webpage ID."
      );
    }
  };

  // ----------------------------------------
  // Knowledge Base API Path
  // ----------------------------------------

  const kbPath = () => {

    return (
      `${ENDPOINTS.WEBMIND_KB_COLLECTIONS}/` +
      kbId
    );
  };

  // ========================================
  // Handle Module 11 Operations
  // ========================================

  switch (message.type) {

    // --------------------------------------
    // List Knowledge Bases
    // --------------------------------------

    case "WEBMIND_KB_LIST": {

      return await backendRequest(
        ENDPOINTS.WEBMIND_KB_COLLECTIONS,
        null,
        "GET"
      );
    }

    // --------------------------------------
    // Create Knowledge Base
    // --------------------------------------

    case "WEBMIND_KB_CREATE": {

      const name = message.name;

      if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 100
      ) {

        throw new Error(
          "Knowledge base name must contain " +
          "1 to 100 characters."
        );
      }

      return await backendRequest(
        ENDPOINTS.WEBMIND_KB_COLLECTIONS,
        {
          name: name.trim()
        },
        "POST"
      );
    }

    // --------------------------------------
    // Get Knowledge Base
    // --------------------------------------

    case "WEBMIND_KB_GET": {

      requireKB();

      return await backendRequest(
        kbPath(),
        null,
        "GET"
      );
    }

    // --------------------------------------
    // Add Webpage to Knowledge Base
    // --------------------------------------

    case "WEBMIND_KB_ADD_PAGE": {

      requireKB();
      requirePage();

      return await backendRequest(
        `${kbPath()}/pages`,
        {
          page_id: pageId
        },
        "POST"
      );
    }

    // --------------------------------------
    // Remove Webpage from Knowledge Base
    // --------------------------------------

    case "WEBMIND_KB_REMOVE_PAGE": {

      requireKB();
      requirePage();

      return await backendRequest(
        `${kbPath()}/pages/${pageId}`,
        null,
        "DELETE"
      );
    }

    // --------------------------------------
    // Delete Knowledge Base
    // --------------------------------------

    case "WEBMIND_KB_DELETE": {

      requireKB();

      return await backendRequest(
        kbPath(),
        null,
        "DELETE"
      );
    }

    // --------------------------------------
    // Cross-Webpage Question Answering
    // --------------------------------------

    case "WEBMIND_KB_CHAT": {

      requireKB();

      const question = validateQuestion(
        message.question
      );

      const topK = 3;

      return await backendRequest(
        ENDPOINTS.WEBMIND_KB_CHAT,
        {
          kb_id: kbId,
          question,
          top_k_per_page: topK
        },
        "POST"
      );
    }

    // --------------------------------------
    // Get Knowledge Base Conversation
    // --------------------------------------

    case "WEBMIND_KB_HISTORY": {

      requireKB();

      return await backendRequest(
        `${kbPath()}/history`,
        null,
        "GET"
      );
    }

    // --------------------------------------
    // Clear Knowledge Base Conversation
    // --------------------------------------

    case "WEBMIND_KB_CLEAR_HISTORY": {

      requireKB();

      return await backendRequest(
        `${kbPath()}/history`,
        null,
        "DELETE"
      );
    }

    // --------------------------------------
    // Unsupported Operation
    // --------------------------------------

    default: {

      throw new Error(
        "Unsupported knowledge base operation."
      );
    }
  }
}


// ==========================================
// 16. Module 12: PDF Request Handler
// ==========================================

async function handlePDFRequest(message) {

  const documentId = message.documentId;

  // ----------------------------------------
  // PDF Document ID Validation
  // ----------------------------------------

  const requireDocument = () => {

    if (!isValidPDFId(documentId)) {

      throw new Error(
        "Invalid PDF document ID."
      );
    }
  };

  // ----------------------------------------
  // PDF API Path
  // ----------------------------------------

  const pdfPath = () => {

    return (
      `${ENDPOINTS.WEBMIND_PDF_DOCUMENTS}/` +
      documentId
    );
  };

  // ========================================
  // Handle Module 12 Operations
  // ========================================

  switch (message.type) {

    // --------------------------------------
    // Upload PDF Document
    // --------------------------------------

    case "WEBMIND_PDF_UPLOAD": {

      const filename = message.filename;

      const base64 = message.base64;

      // ------------------------------------
      // Validate Filename
      // ------------------------------------

      if (
        typeof filename !== "string" ||
        !filename.toLowerCase().endsWith(".pdf") ||
        filename.length > 255 ||
        filename.trim().length === 0
      ) {

        throw new Error(
          "Invalid PDF filename."
        );
      }

      // ------------------------------------
      // Validate Base64 Payload
      // ------------------------------------

      if (
        typeof base64 !== "string" ||
        base64.length === 0 ||
        base64.length > MAX_PDF_BASE64_LENGTH
      ) {

        throw new Error(
          "Invalid PDF upload or file exceeds " +
          "the 10 MB limit."
        );
      }

      // Validate base64 before decoding.
      if (
        base64.length % 4 !== 0 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
      ) {

        throw new Error(
          "Invalid base64 PDF data."
        );
      }

      // ------------------------------------
      // Decode Base64 into Bytes
      // ------------------------------------

      let binary;

      try {

        binary = atob(base64);

      } catch {

        throw new Error(
          "Unable to decode PDF file."
        );
      }

      // ------------------------------------
      // Enforce PDF Size Limit
      // ------------------------------------

      if (
        binary.length === 0 ||
        binary.length > MAX_PDF_BYTES
      ) {

        throw new Error(
          "PDF must be 10 MB or smaller."
        );
      }

      const bytes = Uint8Array.from(
        binary,
        (char) => char.charCodeAt(0)
      );

      // Check the PDF file signature.
      if (
        bytes.length < 5 ||
        bytes[0] !== 0x25 ||
        bytes[1] !== 0x50 ||
        bytes[2] !== 0x44 ||
        bytes[3] !== 0x46 ||
        bytes[4] !== 0x2d
      ) {

        throw new Error(
          "Invalid PDF file format."
        );
      }

      // ------------------------------------
      // Create Multipart Form Data
      // ------------------------------------

      const form = new FormData();

      form.append(
        "file",
        new Blob(
          [bytes],
          {
            type: "application/pdf"
          }
        ),
        filename
      );

      // ------------------------------------
      // Longer Timeout for PDF Indexing
      // ------------------------------------

      const controller =
        new AbortController();

      const timeoutId = setTimeout(
        () => controller.abort(),
        PDF_UPLOAD_TIMEOUT
      );

      try {

        // ----------------------------------
        // Send PDF to FastAPI
        // ----------------------------------

        const response = await fetch(
          `${BACKEND_URL}${ENDPOINTS.WEBMIND_PDF_UPLOAD}`,
          {
            method: "POST",
            body: form,
            signal: controller.signal
          }
        );

        // Do not manually set Content-Type.
        // The browser supplies the multipart
        // boundary automatically.

        let data;

        try {

          data = await response.json();

        } catch {

          throw new Error(
            "Backend returned invalid JSON " +
            `(HTTP ${response.status}).`
          );
        }

        if (!response.ok) {

          const detail =
            typeof data?.detail === "string"
              ? data.detail
              : JSON.stringify(
                  data?.detail || data
                );

          throw new Error(
            `HTTP ${response.status}: ` +
            String(detail).slice(0, 500)
          );
        }

        return data;

      } catch (error) {

        if (error.name === "AbortError") {

          throw new Error(
            "PDF upload or indexing timed out."
          );
        }

        throw error;

      } finally {

        clearTimeout(timeoutId);
      }
    }

    // --------------------------------------
    // List Uploaded PDF Documents
    // --------------------------------------

    case "WEBMIND_PDF_LIST": {

      return await backendRequest(
        ENDPOINTS.WEBMIND_PDF_DOCUMENTS,
        null,
        "GET"
      );
    }

    // --------------------------------------
    // Ask Question About PDF
    // --------------------------------------

    case "WEBMIND_PDF_CHAT": {

      requireDocument();

      const question = validateQuestion(
        message.question
      );

      return await backendRequest(
        ENDPOINTS.WEBMIND_PDF_CHAT,
        {
          document_id: documentId,
          question,
          top_k: 5
        },
        "POST"
      );
    }

    // --------------------------------------
    // Restore PDF Conversation History
    // --------------------------------------

    case "WEBMIND_PDF_HISTORY": {

      requireDocument();

      return await backendRequest(
        `${pdfPath()}/history`,
        null,
        "GET"
      );
    }

    // --------------------------------------
    // Clear PDF Conversation History
    // --------------------------------------

    case "WEBMIND_PDF_CLEAR_HISTORY": {

      requireDocument();

      return await backendRequest(
        `${pdfPath()}/history`,
        null,
        "DELETE"
      );
    }

    // --------------------------------------
    // Delete PDF Document
    // --------------------------------------

    case "WEBMIND_PDF_DELETE": {

      requireDocument();

      return await backendRequest(
        pdfPath(),
        null,
        "DELETE"
      );
    }

    // --------------------------------------
    // Unsupported PDF Operation
    // --------------------------------------

    default: {

      throw new Error(
        "Unsupported PDF operation."
      );
    }
  }
}


// ==========================================
// 17. Modules 5–10: Existing API Handler
// ==========================================

async function handleExistingBackendRequest(
  message,
  sender
) {

  // ========================================
  // Module 9: Restore History by URL
  // ========================================

  if (
    message.type ===
    "WEBMIND_GET_HISTORY_BY_URL"
  ) {

    const requestedUrl = message.url;

    if (
      typeof requestedUrl !== "string" ||
      requestedUrl.length > 4096 ||
      !isSupportedUrl(requestedUrl)
    ) {

      throw new Error(
        "Invalid webpage URL."
      );
    }

    const activeUrl =
      sender.tab?.url ||
      sender.url ||
      "";

    // Verify the URL belongs to the
    // sender's active browser tab.
    if (
      normalizeUrl(requestedUrl) !==
      normalizeUrl(activeUrl)
    ) {

      throw new Error(
        "Page changed during history restoration."
      );
    }

    // Preserve exact URL for existing
    // backend URL hashing logic.
    return await backendRequest(
      `${ENDPOINTS.WEBMIND_HISTORY_BY_URL}` +
      `?url=${encodeURIComponent(requestedUrl)}`,
      null,
      "GET"
    );
  }

  // ========================================
  // Module 5: Webpage Ingestion
  // ========================================

  if (
    message.type ===
    "WEBMIND_INGEST_PAGE"
  ) {

    const payload = message.payload;

    if (
      !payload ||
      typeof payload !== "object" ||
      typeof payload.url !== "string" ||
      !isSupportedUrl(payload.url)
    ) {

      throw new Error(
        "Invalid webpage payload."
      );
    }

    const currentUrl =
      sender.tab?.url ||
      sender.url ||
      "";

    if (
      normalizeUrl(payload.url) !==
      normalizeUrl(currentUrl)
    ) {

      throw new Error(
        "The extracted webpage URL " +
        "does not match the current tab. " +
        "Analyze the page again."
      );
    }

    return await backendRequest(
      ENDPOINTS.WEBMIND_INGEST_PAGE,
      payload,
      "POST"
    );
  }

  // ========================================
  // Other Operations Require Page ID
  // ========================================

  const pageId = message.pageId;

  if (!isValidPageId(pageId)) {

    throw new Error(
      "Invalid page ID."
    );
  }

  // ========================================
  // Module 9: Get Page History
  // ========================================

  if (
    message.type ===
    "WEBMIND_GET_PAGE_HISTORY"
  ) {

    return await backendRequest(
      `${ENDPOINTS.WEBMIND_PAGE_HISTORY}/${pageId}`,
      null,
      "GET"
    );
  }

  // ========================================
  // Module 9: Delete Page History
  // ========================================

  if (
    message.type ===
    "WEBMIND_DELETE_PAGE_HISTORY"
  ) {

    return await backendRequest(
      `${ENDPOINTS.WEBMIND_PAGE_HISTORY}/${pageId}`,
      null,
      "DELETE"
    );
  }

  // ========================================
  // Module 6: Index Webpage
  // ========================================

  if (
    message.type ===
    "WEBMIND_INDEX_PAGE"
  ) {

    return await backendRequest(
      `/api/rag/index/${pageId}`,
      null,
      "POST"
    );
  }

  // ========================================
  // Modules 6 and 7: Search / Chat
  // ========================================

  if (
    message.type === "WEBMIND_SEARCH_PAGE" ||
    message.type === "WEBMIND_CHAT"
  ) {

    const question = validateQuestion(
      message.question
    );

    const endpoint =
      message.type === "WEBMIND_CHAT"
        ? ENDPOINTS.WEBMIND_CHAT
        : ENDPOINTS.WEBMIND_SEARCH_PAGE;

    return await backendRequest(
      endpoint,
      {
        page_id: pageId,
        question,
        top_k: 5
      },
      "POST"
    );
  }

  throw new Error(
    "Unsupported backend operation."
  );
}


// ==========================================
// 18. Runtime Message Handling
// ==========================================

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {

    // --------------------------------------
    // Validate Message Shape
    // --------------------------------------

    if (
      !message ||
      typeof message.type !== "string"
    ) {

      return false;
    }

    // ======================================
    // Module 8: Widget State Tracking
    // ======================================

    if (
      message.type ===
      "WEBMIND_WIDGET_STATE"
    ) {

      if (!isAuthorizedSender(sender)) {

        sendResponse({
          success: false,
          error: "Unauthorized widget state request."
        });

        return false;
      }

      (async () => {

        try {

          await setTabOpen(
            sender.tab.id,
            message.open === true
          );

          sendResponse({
            success: true
          });

        } catch (error) {

          console.error(
            "Widget state update failed:",
            error
          );

          sendResponse({
            success: false,
            error: "Unable to save widget state."
          });
        }

      })();

      // Keep asynchronous message channel open.
      return true;
    }

    // ======================================
    // Check Supported Backend Messages
    // ======================================

    if (
      !supportedMessages.includes(
        message.type
      )
    ) {

      return false;
    }

    // ======================================
    // Sender Authorization
    // ======================================

    if (!isAuthorizedSender(sender)) {

      sendResponse({
        success: false,
        error: "Unauthorized extension request."
      });

      return false;
    }

    // ======================================
    // Process Backend Requests
    // ======================================

    (async () => {

      try {

        let result;

        // ----------------------------------
        // Module 12: PDF Operations
        // ----------------------------------

        if (
          message.type.startsWith(
            "WEBMIND_PDF_"
          )
        ) {

          result = await handlePDFRequest(
            message
          );

        // ----------------------------------
        // Module 11: Knowledge Base
        // ----------------------------------

        } else if (
          message.type.startsWith(
            "WEBMIND_KB_"
          )
        ) {

          result =
            await handleKnowledgeBaseRequest(
              message
            );

        // ----------------------------------
        // Modules 5–10: Existing Features
        // ----------------------------------

        } else {

          result =
            await handleExistingBackendRequest(
              message,
              sender
            );
        }

        // ==================================
        // Successful Response
        // ==================================

        sendResponse({
          success: true,
          data: result
        });

      } catch (error) {

        console.error(
          "WebMind backend request failed:",
          error
        );

        sendResponse({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Unexpected backend error."
        });
      }

    })();

    // Required for asynchronous responses.
    return true;
  }
);
