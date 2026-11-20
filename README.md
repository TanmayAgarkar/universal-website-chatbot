# WebMind AI – Universal Website Chatbot

**An AI-powered Chrome extension that lets users interact with webpages and PDF documents using natural language.**

WebMind AI is an intelligent browser assistant designed to help users understand website content without manually searching through lengthy pages or documents.

It combines **Retrieval-Augmented Generation (RAG), Google Gemini, semantic search, and webpage content extraction** to provide contextual answers based on the currently opened webpage or uploaded PDF documents.

---

## Features

### 1. AI-Powered Website Chatbot

- Interactive floating chatbot integrated directly into webpages.
- Ask questions about the currently opened website.
- Generate context-aware answers using Google Gemini.
- Navigate websites without leaving the chatbot interface.

### 2. Automatic Webpage Content Extraction

- Extract webpage titles, headings, paragraphs, lists, and tables.
- Organize extracted information into structured content.
- Prepare webpage content for indexing and semantic retrieval.
- Support content refresh when navigating to different webpages.

### 3. Retrieval-Augmented Generation (RAG)

- Index webpage content for efficient information retrieval.
- Retrieve relevant sections using semantic search.
- Supply retrieved context to the language model.
- Reduce irrelevant or unsupported answers by grounding responses in source content.

### 4. PDF Question Answering

- Interact with PDF documents using natural language.
- Retrieve relevant document passages.
- Display source references alongside generated answers.
- Navigate to referenced PDF content through interactive citations.

### 5. Chat History Management

- Maintain conversation history for previously analyzed webpages.
- Retrieve conversations associated with a webpage URL.
- Restore previous messages and available source references.
- Clear conversation history when required.

### 6. Website Navigation Detection

- Detect webpage changes and navigation events.
- Identify when the currently indexed context may be outdated.
- Prompt users to analyze new webpage content.
- Maintain contextual separation between different websites.

### 7. Interactive User Interface

- React-based chatbot interface.
- Floating widget embedded through a Chrome extension.
- Expandable chat panel.
- Interactive source citations.
- Status indicators for webpage analysis, indexing, and searching.

---

## Technology Stack

| Component           | Technology                           |
| ------------------- | ------------------------------------ |
| Frontend            | React.js                             |
| Build Tool          | Vite                                 |
| Browser Integration | Chrome Extension                     |
| Backend             | Python, FastAPI                      |
| AI Model            | Google Gemini                        |
| Retrieval           | Retrieval-Augmented Generation (RAG) |
| Database            | SQLite                               |
| Communication       | REST APIs                            |
| Styling             | CSS                                  |
| UI Icons            | Lucide React                         |

---

## System Architecture

WebMind AI uses a browser-extension frontend connected to a Python backend.

```text
               USER
                 |
                 v
         CHROME BROWSER
                 |
                 v
        WEBMIND AI EXTENSION
                 |
       +---------+---------+
       |                   |
       v                   v
  Floating Chatbot    Page Extraction
       |                   |
       +---------+---------+
                 |
                 v
           FASTAPI BACKEND
                 |
       +---------+---------+
       |                   |
       v                   v
   Data Storage       RAG Pipeline
    (SQLite)               |
                           v
                    Semantic Retrieval
                           |
                           v
                      Gemini API
                           |
                           v
                    Generated Answer
                           |
                           v
                    Chatbot Interface
```

### Working Process

1. **Webpage Analysis:** The Chrome extension extracts content from the active webpage.
2. **Content Upload:** Extracted webpage information is sent to the FastAPI backend.
3. **Indexing:** The RAG pipeline processes and indexes webpage content.
4. **Question Submission:** The user asks a question through the chatbot.
5. **Context Retrieval:** Relevant webpage sections are retrieved.
6. **AI Response Generation:** Gemini generates an answer using the retrieved context.
7. **Answer Display:** The chatbot displays the response along with available source references.

---

## Project Structure

The following represents the main components of the project. Exact filenames and directories may differ.

```text
universal_website_chatbot/
|
|-- extension/
|   |-- public/
|   |-- src/
|   |   |-- components/
|   |   |-- utils/
|   |   |-- App.jsx
|   |   |-- App.css
|   |   |-- main.jsx
|   |
|   |-- package.json
|   |-- package-lock.json
|   |-- vite.config.js
|
|-- backend/
|   |-- [FastAPI application files]
|   |-- [RAG implementation]
|   |-- [Database models and utilities]
|   |-- [Gemini integration]
|
|-- .gitignore
|-- README.md
```

---

## Installation and Setup

### Prerequisites

Ensure that the following are installed:

- Python
- Node.js and npm
- Google Chrome
- Git
- A Google Gemini API key

### 1. Clone the Repository

```bash
git clone https://github.com/TanmayAgarkar/universal-website-chatbot.git

cd universal-website-chatbot
```

### 2. Set Up the Backend

Navigate to the backend directory:

```bash
cd backend
```

Create a Python virtual environment:

```bash
python -m venv venv
```

Activate the environment.

**Windows:**

```bash
venv\Scripts\activate
```

**Linux / macOS:**

```bash
source venv/bin/activate
```

Install Python dependencies, if the project provides a `requirements.txt` file:

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a `.env` file in the appropriate backend configuration directory.

Configure your Gemini API key using the environment variable name expected by your backend.

Example:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

**Security:** Never commit `.env` files or actual API keys to GitHub.

### 4. Start the Backend Server

From the backend directory, start FastAPI using the correct module path for your project.

For example, if the FastAPI instance is named `app` in `main.py`:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

The API will be available at:

```text
http://127.0.0.1:8000
```

FastAPI documentation, when enabled:

```text
http://127.0.0.1:8000/docs
```

### 5. Set Up the Chrome Extension

Open another terminal and navigate to:

```bash
cd extension
```

Install frontend dependencies:

```bash
npm install
```

Build the extension:

```bash
npm run build
```

### 6. Load the Extension in Chrome

1. Open Google Chrome.
2. Navigate to `chrome://extensions/`.
3. Enable **Developer Mode**.
4. Click **Load unpacked**.
5. Select the generated extension directory containing `manifest.json`.
6. Enable the extension.

The actual directory depends on the Vite extension build configuration.

---

## Backend API Endpoints

The project includes endpoints for webpage ingestion, retrieval, AI chat, and conversation management.

| Endpoint            | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `/api/pages/ingest` | Store extracted webpage content          |
| `/api/rag/index`    | Index webpage content                    |
| `/api/rag/search`   | Retrieve relevant webpage passages       |
| `/api/chat`         | Generate context-aware AI responses      |
| History endpoints   | Retrieve and delete stored conversations |

Exact HTTP methods, request schemas, and history paths are defined by the backend implementation.

---

## Example Usage

**Scenario: Understanding a Wikipedia Article**

1. Open an article in Google Chrome.
2. Open the WebMind AI chatbot.
3. Analyze the current webpage.
4. Upload and index the extracted content.
5. Ask a question about the article.

**Example:**

User:

> What are the main topics discussed in this article?

WebMind AI:

> The article discusses several key topics based on the indexed webpage content, including the subject's background, important concepts, and relevant details.

The response is generated using the webpage context retrieved by the RAG system.

---

## Key Advantages

- Reduces the need to manually search lengthy webpages.
- Provides natural-language interaction with website content.
- Combines semantic retrieval with generative AI.
- Supports both webpage and PDF-based question answering.
- Offers a reusable browser-integrated assistant.
- Maintains conversational context and history.
- Separates browser interaction, retrieval, and AI generation into modular components.

---

## Future Improvements

Potential enhancements include:

- Support for additional browsers, including Firefox and Edge.
- Improved automatic indexing of newly opened webpages.
- Streaming AI responses.
- Cross-document question answering.
- Conversation export and summarization.
- Multi-language question answering.
- Improved retrieval relevance and source attribution.
- Performance optimization for large webpages and documents.
- Secure cloud deployment and synchronization.
- Support for additional AI models.

---

## Security and Privacy

WebMind AI processes webpage or document content to generate contextual answers.

When configuring or deploying the project:

- Keep API credentials in environment variables.
- Never commit `.env` files.
- Avoid storing unnecessary personal or sensitive information.
- Protect backend endpoints when exposing them publicly.
- Review webpage and PDF content before sending it to external AI services.

---

## Repository

[Universal Website Chatbot – GitHub](https://github.com/TanmayAgarkar/universal-website-chatbot)

---

**WebMind AI — Making website content interactive, accessible, and easier to understand through artificial intelligence.**
