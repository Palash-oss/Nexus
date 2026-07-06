# Nexus Engineering Decisions

## 1) Folder structure and naming
- Decision: Monorepo-style root with app in `apps/web`, future shared code in `packages/*`.
- Alternatives: Single-folder Next app; separate repos per service.
- Why: Keeps boundaries explicit today without adding orchestration complexity too early.

## 2) Authentication session strategy
- Decision: NextAuth with JWT session strategy plus Prisma adapter for user/account persistence.
- Alternatives: Database sessions; custom auth stack.
- Why: JWT sessions reduce DB roundtrips while still keeping OAuth account linkage in Prisma.

## 3) OAuth token storage and refresh
- Decision: Store Google access/refresh token fields on `User`, refresh on-demand before Google API calls.
- Alternatives: Read from `Account` on every call; separate credential table.
- Why: Direct user-level fields simplify ingestion path and token refresh logic.

## 4) Partial ingestion failures
- Decision: Continue processing after per-item failures, mark ingestion run as `PARTIAL` when mixed outcomes happen.
- Alternatives: Fail-fast run abort.
- Why: Preserves successful indexing progress and gives user better reliability under flaky APIs.

## 5) Search while ingestion is running
- Decision: Search remains available on already indexed data; UI displays indexing progress text during run.
- Alternatives: Block search until ingestion completes.
- Why: Avoids unnecessary lockout while still setting user expectations.

## 6) Truncating long bodies
- Decision: Store full normalized body in `content` for ranking, but store `snippet` truncated to UI-friendly length.
- Alternatives: Truncate raw content column.
- Why: Maintains search quality while keeping result cards readable.

## 7) Duplicate handling across re-runs
- Decision: Upsert documents by composite unique key (`userId`, `source`, `sourceDocumentId`).
- Alternatives: Delete-and-reinsert each run; timestamp-only dedupe.
- Why: Idempotent ingestion with stable document identity and predictable updates.

## 8) Full-text search implementation
- Decision: PostgreSQL FTS (`to_tsvector`, `plainto_tsquery`) and GIN expression index.
- Alternatives: ILIKE queries; external search service in week 1.
- Why: Reliable, production-proven, low operational overhead, and good enough latency for week 1.

## 9) Vector readiness for week 3
- Decision: Add nullable `embedding` vector column now and enable `vector` extension in migration.
- Alternatives: Postpone schema change; use JSON placeholder.
- Why: Avoids future migration pain while not using vectors yet in application code.

