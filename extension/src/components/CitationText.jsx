
import React from "react";

/*
 * ==========================================
 * WebMind AI - Module 13
 * Clickable Citation Renderer
 * ==========================================
 */

const CITATION_PATTERN = /\[(\d+)\]/g;


function findCitationSource(sources, number) {

  if (!Array.isArray(sources)) {
    return null;
  }

  // Prefer the citation ID supplied
  // by the backend rather than assuming
  // the array is always ordered.

  return sources.find((source) => {
    return Number(source.citation) === number;
  }) || null;
}


function CitationText({
  text,
  sources = [],
  onCitationClick,
  className = ""
}) {

  const content = String(text ?? "");

  const elements = [];

  let lastIndex = 0;

  let match;

  const pattern = new RegExp(
    CITATION_PATTERN.source,
    "g"
  );

  while ((match = pattern.exec(content)) !== null) {

    const citationNumber = Number(match[1]);

    // Text before the citation.
    if (match.index > lastIndex) {

      elements.push(
        content.slice(
          lastIndex,
          match.index
        )
      );
    }

    const source = findCitationSource(
      sources,
      citationNumber
    );

    if (source && typeof onCitationClick === "function") {

      elements.push(
        <button
          key={`citation-${match.index}`}
          type="button"
          className="webmind-citation-button"
          title={
            source.page_number
              ? `Open PDF page ${source.page_number}`
              : source.page_title ||
                source.heading ||
                "View source"
          }
          aria-label={
            `Open citation ${citationNumber}`
          }
          onClick={(event) => {
            event.stopPropagation();

            onCitationClick(
              source,
              citationNumber
            );
          }}
        >
          [{citationNumber}]
        </button>
      );

    } else {

      // Unknown citation numbers are
      // displayed as normal text.
      elements.push(
        match[0]
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < content.length) {

    elements.push(
      content.slice(lastIndex)
    );
  }

  return (
    <span
      className={
        `webmind-citation-text ${className}`
      }
    >
      {elements}
    </span>
  );
}

export default CitationText;
