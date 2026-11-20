
import {
  useEffect,
  useState
} from "react";

// ==========================================
// Navigation Utilities
// ==========================================

function getPageKey() {
  const url = new URL(window.location.href);

  // Ignore fragment identifiers.
  url.hash = "";

  return url.href;
}

function getPageSnapshot() {
  return {
    url: window.location.href,
    key: getPageKey(),
    title: document.title || "Untitled Page",
    domain: window.location.hostname
  };
}

// ==========================================
// usePageNavigation Hook
// ==========================================

export function usePageNavigation() {

  const [page, setPage] = useState(
    getPageSnapshot
  );

  useEffect(() => {

    let lastKey = getPageKey();
    let lastTitle = document.title;

    const checkNavigation = () => {

      const currentKey = getPageKey();
      const currentTitle = document.title;

      const urlChanged =
        currentKey !== lastKey;

      const titleChanged =
        currentTitle !== lastTitle;

      if (!urlChanged && !titleChanged) {
        return;
      }

      lastKey = currentKey;
      lastTitle = currentTitle;

      setPage(getPageSnapshot());
    };

    // SPA navigation detection.
    // This also detects History API changes.
    const interval = window.setInterval(
      checkNavigation,
      400
    );

    // Browser navigation events.
    window.addEventListener(
      "popstate",
      checkNavigation
    );

    window.addEventListener(
      "hashchange",
      checkNavigation
    );

    window.addEventListener(
      "pageshow",
      checkNavigation
    );

    return () => {

      window.clearInterval(interval);

      window.removeEventListener(
        "popstate",
        checkNavigation
      );

      window.removeEventListener(
        "hashchange",
        checkNavigation
      );

      window.removeEventListener(
        "pageshow",
        checkNavigation
      );

    };

  }, []);

  return page;
}
