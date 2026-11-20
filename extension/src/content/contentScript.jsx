
import React from "react";
import { createRoot } from "react-dom/client";

import ChatWidget from "../components/ChatWidget";

import chatbotCSS from "../styles/chatbot.css?inline";

// ==========================================
// WebMind AI - Content Script
// Module 8
// ==========================================

const ROOT_ID = "webmind-ai-root";

// ==========================================
// Report Widget State
// ==========================================

function reportWidgetState(open) {
  try {
    chrome.runtime.sendMessage({
      type: "WEBMIND_WIDGET_STATE",
      open
    }).catch((error) => {
      console.debug(
        "WebMind state notification skipped:",
        error
      );
    });
  } catch (error) {
    console.debug(
      "WebMind runtime unavailable:",
      error
    );
  }
}

// ==========================================
// Toggle Existing Widget
// ==========================================

if (
  typeof window.__webmindCleanup === "function"
) {
  window.__webmindCleanup();

} else {

  // Remove an orphaned container, if present.
  const existingContainer =
    document.getElementById(ROOT_ID);

  if (existingContainer) {
    existingContainer.remove();
  }

  // ========================================
  // Create Root Container
  // ========================================

  const container = document.createElement("div");

  container.id = ROOT_ID;

  container.style.position = "fixed";
  container.style.inset = "0";

  container.style.zIndex = "2147483647";

  // Keep the underlying webpage clickable.
  container.style.pointerEvents = "none";

  document.documentElement.appendChild(container);

  // ========================================
  // Shadow DOM
  // ========================================

  const shadowRoot = container.attachShadow({
    mode: "open"
  });

  const styleElement =
    document.createElement("style");

  styleElement.textContent = chatbotCSS;

  shadowRoot.appendChild(styleElement);

  // ========================================
  // React Mount Point
  // ========================================

  const mountPoint =
    document.createElement("div");

  mountPoint.style.pointerEvents = "none";

  shadowRoot.appendChild(mountPoint);

  const root = createRoot(mountPoint);

  // ========================================
  // Cleanup
  // ========================================

  let destroyed = false;

  const cleanup = () => {
    if (destroyed) {
      return;
    }

    destroyed = true;

    // Remove the global cleanup reference.
    if (window.__webmindCleanup === cleanup) {
      delete window.__webmindCleanup;
    }

    // Inform the background worker.
    reportWidgetState(false);

    // Unmount React after the current event.
    queueMicrotask(() => {
      root.unmount();
      container.remove();
    });
  };

  window.__webmindCleanup = cleanup;

  // ========================================
  // Mount WebMind AI
  // ========================================

  root.render(
    <React.StrictMode>
      <ChatWidget onClose={cleanup} />
    </React.StrictMode>
  );

  // Report successful initialization.
  reportWidgetState(true);

  console.log(
    "WebMind AI chatbot mounted successfully."
  );
}
