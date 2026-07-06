# Nexus — Universal Search Layer
## Building a startup in 4 weeks: full technical case study

### The Problem
Professionals work across multiple browser tabs, email platforms, and cloud drives. Searching for a single file, invoice, or thread requires opening multiple products and searching each independently, leading to lost time and cognitive fatigue.

Knowledge is fragmented. Finding one piece of information means opening multiple products and searching each independently.

### The Solution
Nexus creates one search surface over Gmail, Google Drive, and browser history. It pulls recent data, processes it via NLP and semantic vector math, and returns a unified ranked result set with relevance highlights and deep links back to native apps.

### Architecture

```txt
+------------------------------------+
|            Chrome Popup            | <------------+
|         popup.html / popup.js      |              |
+------------------------------------+              |
                 |                                  |
                 v                                  |
+------------------------------------+              |
|        Content Script (DOM)        |              |
|       content-script.js            |              |
+------------------------------------+              |
                 |                                  |
                 v                                  | (REST API JSON / CORS)
+------------------------------------+              |
|      Background Service Worker     | ------------+
|       service-worker.js            |
+------------------------------------+
                 |
                 v (HTTP POST)
+---------------------------------------------------+
|               Next.js App Ingestion               |
|            /api/extension/ingest/route.ts         |
+---------------------------------------------------+
                 |
                 +-------------------+
                 |                   |
                 v                   v
     +-----------------------+   +----------------------+
     |  Claude Query Parser  |   |    OpenAI Embed      |
     |   /lib/queryParser.ts |   |   /lib/embeddings.ts |
     +-----------------------+   +----------------------+
                 |                   |
                 +---------+---------+
                           |
                           v
     +--------------------------------------------------+
     |                PostgreSQL Database               |
     |         User / Document / SearchLog / IngestLog  |
     +--------------------------------------------------+
```

### Technical Decisions

#### Decision 1: Next.js 14 App Router
* **Options Considered**: Single SPA with Express API; Next.js 14 App Router.
* **Why chosen**: Combines API routes and Server Components in a single unified deploy, reducing operational latency and keeping deployment costs minimal.

#### Decision 2: Native PL/pgSQL Cosine Similarity vs. pgvector extension
* **Options Considered**: pgvector extension; Conda/Docker vector DB; PL/pgSQL math function.
* **Why chosen**: Many default Windows PostgreSQL configurations lack pgvector compiler binaries out-of-the-box. Writing a custom `cosine_similarity` PL/pgSQL function handles vector calculations natively in any standard PostgreSQL instance, avoiding system dependency errors.

#### Decision 3: Hybrid RRF ranking vs. pure semantic
* **Options Considered**: Keyword search; Vector similarity; Reciprocal Rank Fusion (RRF).
* **Why chosen**: Pure semantic search misses exact matches (like serial numbers or identifiers), while keyword search fails on synonyms. Combining FTS with cosine similarity via RRF ranks results on both keyword matches and semantic meaning.

#### Decision 4: Chrome Extension MV3 vs. browser bookmarklet
* **Options Considered**: Bookmarklet; Manifest V3 Chrome Extension.
* **Why chosen**: Chrome Extension MV3 service worker executes background flushes periodically, storing and processing data without manual user clicks.

#### Decision 5: Claude for NLP parsing vs. fine-tuned local model
* **Options Considered**: Local BERT models; Claude Sonnet API.
* **Why chosen**: Claude provides instant natural language translation of search terms to structured parameters (author names, dates, app targets), which is difficult to achieve with local models without large fine-tuning datasets.

### What I Built in 4 Weeks
* **Chrome Extension (Manifest V3)**: Captures web page content, performs domain filtering, and flushes to the ingestion server.
* **Unified Search UI**: Premium interface with loading skeletons, active pills filters, and intent explanation banners.
* **Embeddings Pipeline**: Integrates OpenAI `text-embedding-3-small` to encode texts into 1536-dimensional float arrays.
* **NLP Query Parser & Summarizer**: Extracts intent and generates 15-word relevance summaries using Claude Sonnet.
* **Ratelimiter**: Sliding window rate limits utilizing Upstash Redis.
* **SSE Activity Feed**: Stream updates to UI client-side using Server-Sent Events.

### Performance Metrics
* **P50 Latency**: ~15ms (for standard PostgreSQL index scan queries).
* **P95 Latency**: ~32ms.
* **Hybrid RRF Sorting**: ~3ms (executed in memory post-queries).

### Lessons Learned
* Background extension workers run in sandboxed contexts; ES6 modular imports require precise bundlers or single-file scripts.
* Database connections on Windows services can block unless local trust authentication is configured or fallback methods are set.
* Rate limits prevent API key budget depletion during scraping spikes.

### What's Next
* Notion & Slack connectors for cross-org workspace search.
* PDF & PDF OCR support for files scanned into Google Drive.
* Offline mode using local model execution.

### Tech Stack
* Next.js `14.2.5`
* Prisma `5.19.1`
* Tailwind CSS `3.4.1`
* `@anthropic-ai/sdk` `0.24.3`
* `openai` `4.55.0`
* `resend` `4.0.0`
