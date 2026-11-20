
/*
 * ==========================================
 * WebMind AI - Module 13
 * PDF Citation Navigator
 * ==========================================
 */

const BACKEND_URL =
  "http://127.0.0.1:8000";


export function openPDFSource(
  source,
  selectedDocumentId
) {

  const documentId =
    source?.document_id ||
    selectedDocumentId;

  if (
    typeof documentId !== "string" ||
    !/^[a-f0-9]{32}$/.test(documentId)
  ) {

    return {
      success: false,
      message: "Invalid PDF document ID."
    };
  }

  const pageNumber = Number(
    source?.page_number
  );

  if (
    !Number.isInteger(pageNumber) ||
    pageNumber < 1
  ) {

    return {
      success: false,
      message: "Invalid PDF page number."
    };
  }

  const url =
    `${BACKEND_URL}/api/pdf/documents/` +
    `${documentId}/file#page=${pageNumber}`;

  window.open(
    url,
    "_blank",
    "noopener,noreferrer"
  );

  return {
    success: true,
    documentId,
    pageNumber
  };
}
