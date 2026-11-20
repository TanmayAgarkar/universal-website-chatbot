
/*
 * WebMind AI
 * Module 4: Webpage Content Extraction
 */

const MAX_SECTIONS = 350;
const MAX_TEXT_LENGTH = 2000;

const CONTENT_SELECTOR = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "ul", "ol", "table",
  "blockquote", "pre"
].join(", ");

const EXCLUDED_SELECTOR = [
  "script", "style", "noscript", "template",
  "nav", "footer", "aside",
  "form", "button", "input", "textarea",
  "select", "option",
  "[hidden]", "[aria-hidden='true']",
  "[contenteditable='true']",
  "[role='navigation']",
  "[role='search']",
  ".mw-editsection",
  ".navbox", ".vertical-navbox",
  ".toc", ".vector-toc",
  ".sidebar"
].join(", ");

function cleanText(text) {
  return (text || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function isVisible(element) {
  if (element.closest(EXCLUDED_SELECTOR)) {
    return false;
  }

  let current = element;

  while (current && current.nodeType === 1) {
    const style = window.getComputedStyle(current);

    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse"
    ) {
      return false;
    }

    current = current.parentElement;
  }

  return true;
}

function getMainContent() {
  const candidates = [
    "main article",
    "article",
    "#mw-content-text .mw-parser-output",
    "#mw-content-text",
    "main",
    "[role='main']",
    "#content",
    ".main-content",
    "body"
  ];

  for (const selector of candidates) {
    const element = document.querySelector(selector);

    if (
      element &&
      cleanText(element.innerText).length > 100
    ) {
      return element;
    }
  }

  return document.body;
}

function getElementSelector(element) {
  if (element.id) {
    return "#" + CSS.escape(element.id);
  }

  const path = [];
  let current = element;

  while (
    current &&
    current.nodeType === 1 &&
    current !== document.body
  ) {
    if (current.id) {
      path.unshift("#" + CSS.escape(current.id));
      break;
    }

    const tag = current.tagName.toLowerCase();

    let index = 1;
    let sibling = current.previousElementSibling;

    while (sibling) {
      if (sibling.tagName === current.tagName) {
        index++;
      }

      sibling = sibling.previousElementSibling;
    }

    path.unshift(`${tag}:nth-of-type(${index})`);

    current = current.parentElement;
  }

  return path.join(" > ");
}

function extractTable(element) {
  const rows = Array.from(
    element.querySelectorAll("tr")
  ).slice(0, 100);

  const data = rows.map((row) => {
    return Array.from(
      row.querySelectorAll(":scope > th, :scope > td")
    ).map((cell) => cleanText(cell.innerText));
  });

  return {
    rows: data,
    text: data.map((row) => row.join(" | ")).join("\n")
  };
}

function extractList(element) {
  const items = Array.from(element.children)
    .filter((child) => child.tagName === "LI")
    .slice(0, 100)
    .map((item) => cleanText(item.innerText));

  return {
    items,
    text: items.join("\n")
  };
}

function determineType(element) {
  const tag = element.tagName.toLowerCase();

  if (/^h[1-6]$/.test(tag)) {
    return "heading";
  }

  if (tag === "p") {
    return "paragraph";
  }

  if (tag === "ul" || tag === "ol") {
    return "list";
  }

  if (tag === "table") {
    return "table";
  }

  if (tag === "blockquote") {
    return "quote";
  }

  if (tag === "pre") {
    return "code";
  }

  return "text";
}

export function extractPageContent() {
  const mainContent = getMainContent();

  if (!mainContent) {
    throw new Error("No readable webpage content found.");
  }

  const elements = mainContent.querySelectorAll(
    CONTENT_SELECTOR
  );

  const sections = [];
  let currentHeading = document.title || "Introduction";

  for (const element of elements) {
    if (sections.length >= MAX_SECTIONS) {
      break;
    }

    if (!isVisible(element)) {
      continue;
    }

    // Avoid extracting text already contained in
    // a list or table as another section.
    if (
      element.closest("table") !== null &&
      element.tagName !== "TABLE"
    ) {
      continue;
    }

    if (
      element.closest("li") !== null ||
      (
        element.tagName !== "UL" &&
        element.tagName !== "OL" &&
        element.closest("ul, ol") !== null
      )
    ) {
      continue;
    }

    // Avoid duplicating nested list and table content.
    if (
      element.matches("ul, ol") &&
      element.parentElement?.closest("ul, ol")
    ) {
      continue;
    }

    const type = determineType(element);

    let text = cleanText(element.innerText);
    let structuredData = null;

    if (type === "table") {
      structuredData = extractTable(element);
      text = structuredData.text;
    }

    if (type === "list") {
      structuredData = extractList(element);
      text = structuredData.text;
    }

    if (!text || text.length < 3) {
      continue;
    }

    text = text.slice(0, MAX_TEXT_LENGTH);

    const sectionId = `section_${sections.length + 1}`;

    if (type === "heading") {
      currentHeading = text;
    }

    const section = {
      section_id: sectionId,
      type,
      heading: currentHeading,
      text,
      selector: getElementSelector(element),
      tag: element.tagName.toLowerCase()
    };

    if (structuredData) {
      section.data =
        type === "table"
          ? structuredData.rows
          : structuredData.items;
    }

    sections.push(section);
  }

  if (sections.length === 0) {
    throw new Error(
      "No readable text was found on this webpage."
    );
  }

  const allText = sections
    .map((section) => section.text)
    .join("\n\n");

  const words = allText
    .split(/\s+/)
    .filter(Boolean);

  const counts = {
    headings: sections.filter(
      (section) => section.type === "heading"
    ).length,

    paragraphs: sections.filter(
      (section) => section.type === "paragraph"
    ).length,

    lists: sections.filter(
      (section) => section.type === "list"
    ).length,

    tables: sections.filter(
      (section) => section.type === "table"
    ).length
  };

  return {
    url: window.location.href,
    domain: window.location.hostname,
    title: document.title || "Untitled Page",

    description:
      document.querySelector(
        'meta[name="description"]'
      )?.content || "",

    extracted_at: new Date().toISOString(),

    sections,

    full_text: allText,

    statistics: {
      total_sections: sections.length,
      total_words: words.length,
      total_characters: allText.length,
      ...counts,
      truncated: sections.length >= MAX_SECTIONS
    }
  };
}
