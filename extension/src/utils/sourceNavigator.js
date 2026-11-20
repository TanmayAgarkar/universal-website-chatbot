
/*
 * ==========================================
 * WebMind AI - Module 13
 * Webpage Source Navigation
 * ==========================================
 */

const HIGHLIGHT_ID =
  "webmind-ai-source-highlight";

const HIGHLIGHT_STYLE_ID =
  "webmind-ai-source-highlight-style";


function normalizeText(value) {

  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}


function safeWebUrl(value) {

  if (typeof value !== "string") {
    return null;
  }

  try {

    const url = new URL(value);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return null;
    }

    return url;

  } catch {

    return null;
  }
}


// ==========================================
// Create Chrome Text Fragment
// ==========================================

function createTextFragmentUrl(
  rawUrl,
  excerpt
) {

  const url = safeWebUrl(rawUrl);

  if (!url) {
    return null;
  }

  const text = normalizeText(excerpt);

  // A short text fragment generally
  // works better than an entire chunk.

  const fragmentText = text
    .slice(0, 100)
    .trim();

  if (fragmentText) {

    url.hash =
      `:~:text=${encodeURIComponent(fragmentText)}`;

  } else {

    url.hash = "";
  }

  return url.href;
}


// ==========================================
// Install Highlight Style
// ==========================================

function ensureHighlightStyle() {

  if (
    document.getElementById(
      HIGHLIGHT_STYLE_ID
    )
  ) {
    return;
  }

  const style = document.createElement(
    "style"
  );

  style.id = HIGHLIGHT_STYLE_ID;

  style.textContent = `
    ::highlight(${HIGHLIGHT_ID}) {
      background-color: #fde047;
      color: #111827;
      text-decoration: underline;
    }
  `;

  (
    document.head ||
    document.documentElement
  ).appendChild(style);
}


// ==========================================
// Find Matching Text in Current Page
// ==========================================

function findMatchingRange(excerpt) {

  const normalized = normalizeText(excerpt);

  if (!normalized) {
    return null;
  }

  // Use a short part of the excerpt.
  // Each range must match a single text
  // node in this initial implementation.

  const query = normalized
    .slice(0, 80)
    .toLowerCase();

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT
  );

  let node;

  while ((node = walker.nextNode())) {

    const parent = node.parentElement;

    if (!parent) {
      continue;
    }

    // Avoid highlighting chatbot UI,
    // scripts, styles and form fields.

    if (
      parent.closest(
        "script, style, noscript, " +
        "textarea, input, " +
        "#webmind-ai-root, " +
        "[contenteditable='true']"
      )
    ) {
      continue;
    }

    const rawText = node.textContent || "";

    const lowerText =
      rawText.toLowerCase();

    // Exact match first.
    let position =
      lowerText.indexOf(query);

    let length = query.length;

    // Fall back to a shorter phrase.
    if (position === -1) {

      const shorter = query.slice(0, 40);

      if (shorter.length < 12) {
        continue;
      }

      position =
        lowerText.indexOf(shorter);

      length = shorter.length;
    }

    if (position === -1) {
      continue;
    }

    const range = document.createRange();

    range.setStart(node, position);

    range.setEnd(
      node,
      position + length
    );

    return range;
  }

  return null;
}


// ==========================================
// Highlight on Active Webpage
// ==========================================

export function highlightCurrentPage(excerpt) {

  const range = findMatchingRange(
    excerpt
  );

  if (!range) {
    return false;
  }

  const targetElement =
    range.startContainer.parentElement;

  if (targetElement) {

    targetElement.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest"
    });
  }

  // CSS Custom Highlight API avoids
  // modifying the webpage's DOM.

  if (
    typeof Highlight !== "undefined" &&
    typeof CSS !== "undefined" &&
    CSS.highlights
  ) {

    ensureHighlightStyle();

    CSS.highlights.delete(
      HIGHLIGHT_ID
    );

    const highlight = new Highlight(
      range
    );

    CSS.highlights.set(
      HIGHLIGHT_ID,
      highlight
    );

  } else {

    // Fallback for browsers without
    // the Custom Highlight API.

    const selection = window.getSelection();

    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  return true;
}


// ==========================================
// Compare Two Webpage URLs
// ==========================================

function isCurrentDocumentUrl(rawUrl) {

  const sourceUrl = safeWebUrl(rawUrl);

  if (!sourceUrl) {
    return false;
  }

  const currentUrl =
    safeWebUrl(window.location.href);

  if (!currentUrl) {
    return false;
  }

  sourceUrl.hash = "";
  currentUrl.hash = "";

  return sourceUrl.href === currentUrl.href;
}


// ==========================================
// Open or Highlight Webpage Source
// ==========================================

export function openWebpageSource(
  source,
  fallbackUrl = null
) {

  const rawUrl =
    source?.url ||
    source?.page_url ||
    fallbackUrl;

  const excerpt =
    source?.excerpt ||
    source?.text ||
    "";

  const targetUrl = safeWebUrl(rawUrl);

  if (!targetUrl) {

    return {
      success: false,
      message: "Source URL is unavailable."
    };
  }

  // Highlight directly if this is
  // the currently loaded webpage.

  if (isCurrentDocumentUrl(targetUrl.href)) {

    const highlighted =
      highlightCurrentPage(excerpt);

    if (highlighted) {

      return {
        success: true,
        method: "dom-highlight"
      };
    }
  }

  // Otherwise open the source with a
  // text fragment where possible.

  const destination =
    createTextFragmentUrl(
      targetUrl.href,
      excerpt
    );

  const opened = window.open(
    destination,
    "_blank",
    "noopener,noreferrer"
  );

  // With noopener, window.open may return
  // null even if the browser opened the tab.
  // Do not interpret null as definite failure.

  return {
    success: true,
    method: "text-fragment",
    url: destination
  };
}
