# Nexus

Find anything. Everywhere. Instantly.

Nexus is a universal search layer for personal knowledge across apps. Week 1 ships the foundation: Google OAuth, Gmail and Drive ingestion, and a fast blended search experience.

## Problem

Knowledge is fragmented across inboxes and files. Finding one piece of information means opening multiple products and searching each independently.

## Solution

Nexus creates one search surface over your Gmail and Google Drive content. It indexes recent data and returns a ranked result set with source-aware metadata and deep links back to the original app.

## Week 1 Scope

- Google sign-in with scoped permissions
- Gmail ingestion (200 most recent inbox emails)
- Drive metadata ingestion (200 files)
- Full-text search with relevance + recency ranking
- Unified search UI with loading, empty, and error states

## Architecture

```txt
+------------------+       +--------------------------+
|  Next.js App UI  | ----> |  API Routes (App Router) |
+------------------+       +--------------------------+
          |                              |
          |                              v
          |                 +--------------------------+
          |                 |  Ingestion/Search Logic  |
          |                 |  src/lib/*               |
          |                 +--------------------------+
          |                              |
          v                              v
+------------------+       +--------------------------+
| NextAuth + Google|       | PostgreSQL + Prisma      |
| OAuth (JWT sess) |       | User/Document/Ingestion  |
+------------------+       +--------------------------+
```

## Monorepo Layout

```txt
NEXUS/
  apps/
    web/
      prisma/
      src/
        app/
        components/
        lib/
        types/
  packages/
    types/
  DECISIONS.md
  README.md
```

## Setup (under 15 minutes)

1. Install dependencies:

   ```bash
   npm install
   npm install --workspace web
   ```

2. Configure environment:

   - Copy `apps/web/.env.example` to `apps/web/.env`
   - Fill:
     - `DATABASE_URL`
     - `NEXTAUTH_SECRET`
     - `GOOGLE_CLIENT_ID`
     - `GOOGLE_CLIENT_SECRET`

3. Configure Google OAuth app:

   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Required scopes are requested by Nexus at sign-in:
     - `gmail.readonly`
     - `drive.metadata.readonly`

4. Run database migration and Prisma client generation:

   ```bash
   npm run db:migrate -w web
   npm run db:generate -w web
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000`

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_URL`: base URL, usually `http://localhost:3000`
- `NEXTAUTH_SECRET`: random secret for session signing
- `GOOGLE_CLIENT_ID`: OAuth client id
- `GOOGLE_CLIENT_SECRET`: OAuth client secret

## API Endpoints

- `POST /api/ingest`: pulls Gmail + Drive and writes ingestion runs
- `GET /api/search?q=<query>`: full-text search scoped to authenticated user
- `GET|POST /api/auth/[...nextauth]`: authentication routes

## Reliability Notes

- Token refresh is automatic when Google access tokens expire
- Gmail/Drive API calls use exponential backoff for 429 and 5xx responses
- Partial ingestion failures are recorded without dropping successful items
- All reads and writes are scoped by authenticated `userId`

## What is intentionally not in Week 1

- Vector similarity search
- Full Drive document content extraction
- Slack/Notion/browser connectors
