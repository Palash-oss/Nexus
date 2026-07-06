import { db } from "@/lib/db";
import { parseQuery, ParsedQuery } from "@/lib/queryParser";
import { generateEmbedding, isGeminiConfigured } from "@/lib/embeddings";

export type SearchResultItem = {
  id: string;
  source: "GMAIL" | "DRIVE" | "WEB";
  title: string;
  content: string;
  snippet: string;
  author: string | null;
  date: string | null;
  url: string;
  score: number;
  aiSummary?: string;
};

type DbRow = {
  id: string;
  source: "GMAIL" | "DRIVE" | "WEB";
  title: string;
  content: string;
  snippet: string | null;
  author: string | null;
  date: Date | null;
  url: string;
  score?: number;
};

export async function performHybridSearch(
  userId: string,
  rawQuery: string,
  sourceFilters?: string[]
): Promise<{
  results: SearchResultItem[];
  parsedQuery: ParsedQuery;
  searchType: "hybrid" | "keyword";
}> {
  const parsed = await parseQuery(rawQuery);
  const cleanQuery = parsed.cleanQuery || rawQuery;

  // Resolve sources
  // If user passes source filter pills on the UI (sourceFilters), use them.
  // Otherwise, use sources parsed from the search intent.
  let allowedSources: ("GMAIL" | "DRIVE" | "WEB")[] = ["GMAIL", "DRIVE", "WEB"];
  if (sourceFilters && sourceFilters.length > 0) {
    allowedSources = sourceFilters.map((s) => s.toUpperCase()) as any;
  } else if (parsed.sources && parsed.sources.length > 0) {
    allowedSources = parsed.sources.map((s) => s.toUpperCase()) as any;
  }

  // Construct filters
  const sourcesSql = allowedSources;
  
  // Date range filters
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  if (parsed.dateRange) {
    if (parsed.dateRange.start) startDate = new Date(parsed.dateRange.start);
    if (parsed.dateRange.end) endDate = new Date(parsed.dateRange.end);
  }

  // Author filter
  const authorPattern = parsed.author ? `%${parsed.author}%` : null;

  // Let's decide search type
  const searchType: "hybrid" | "keyword" = isGeminiConfigured() ? "hybrid" : "keyword";

  // Step 1: Query A - Full text search
  let keywordResults: DbRow[] = [];
  try {
    keywordResults = await db.$queryRaw<DbRow[]>`
      SELECT
        d.id,
        d.source,
        d.title,
        d.content,
        d.snippet,
        d.author,
        COALESCE(d."externalUpdatedAt", d."externalCreatedAt", d."updatedAt") AS date,
        d.url,
        ts_rank_cd(
          to_tsvector('english', COALESCE(d.title, '') || ' ' || COALESCE(d.content, '')),
          plainto_tsquery('english', ${cleanQuery})
        ) AS score
      FROM "Document" d
      WHERE d."userId" = ${userId}
        AND d.source = ANY(${sourcesSql}::"DocumentSource"[])
        AND (${authorPattern}::text IS NULL OR d.author ILIKE ${authorPattern})
        AND (${startDate}::timestamp IS NULL OR COALESCE(d."externalUpdatedAt", d."externalCreatedAt", d."updatedAt") >= ${startDate})
        AND (${endDate}::timestamp IS NULL OR COALESCE(d."externalUpdatedAt", d."externalCreatedAt", d."updatedAt") <= ${endDate})
        AND to_tsvector('english', COALESCE(d.title, '') || ' ' || COALESCE(d.content, '')) @@ plainto_tsquery('english', ${cleanQuery})
      ORDER BY score DESC
      LIMIT 30
    `;
  } catch (err) {
    console.error("Keyword query failed:", err);
  }

  // Step 2: Query B - Semantic search
  let semanticResults: DbRow[] = [];
  if (searchType === "hybrid") {
    try {
      const queryVector = await generateEmbedding(cleanQuery);
      semanticResults = await db.$queryRaw<DbRow[]>`
        SELECT
          d.id,
          d.source,
          d.title,
          d.content,
          d.snippet,
          d.author,
          COALESCE(d."externalUpdatedAt", d."externalCreatedAt", d."updatedAt") AS date,
          d.url,
          cosine_similarity(d."embeddingVector", ${queryVector}::double precision[]) AS score
        FROM "Document" d
        WHERE d."userId" = ${userId}
          AND d.source = ANY(${sourcesSql}::"DocumentSource"[])
          AND (${authorPattern}::text IS NULL OR d.author ILIKE ${authorPattern})
          AND (${startDate}::timestamp IS NULL OR COALESCE(d."externalUpdatedAt", d."externalCreatedAt", d."updatedAt") >= ${startDate})
          AND (${endDate}::timestamp IS NULL OR COALESCE(d."externalUpdatedAt", d."externalCreatedAt", d."updatedAt") <= ${endDate})
          AND d."embeddingVector" IS NOT NULL
          AND array_length(d."embeddingVector", 1) > 0
        ORDER BY score DESC
        LIMIT 30
      `;
    } catch (err) {
      console.error("Semantic query failed:", err);
    }
  }

  // Step 3: Query C - ILIKE fallback for short queries or exact matches
  let fallbackResults: DbRow[] = [];
  try {
    const searchPattern = `%${cleanQuery}%`;
    fallbackResults = await db.$queryRaw<DbRow[]>`
      SELECT
        d.id,
        d.source,
        d.title,
        d.content,
        d.snippet,
        d.author,
        COALESCE(d."externalUpdatedAt", d."externalCreatedAt", d."updatedAt") AS date,
        d.url
      FROM "Document" d
      WHERE d."userId" = ${userId}
        AND d.source = ANY(${sourcesSql}::"DocumentSource"[])
        AND (${authorPattern}::text IS NULL OR d.author ILIKE ${authorPattern})
        AND (${startDate}::timestamp IS NULL OR COALESCE(d."externalUpdatedAt", d."externalCreatedAt", d."updatedAt") >= ${startDate})
        AND (${endDate}::timestamp IS NULL OR COALESCE(d."externalUpdatedAt", d."externalCreatedAt", d."updatedAt") <= ${endDate})
        AND (d.title ILIKE ${searchPattern} OR d.content ILIKE ${searchPattern})
      LIMIT 20
    `;
  } catch (err) {
    console.error("Fallback query failed:", err);
  }

  // Map to hold reciprocal rank scores
  const rrfScores = new Map<string, { doc: DbRow; rrfScore: number; sourceRanks: { k?: number; s?: number; f?: number } }>();
  const k = 60;

  // Helper to add RRF contribution
  const addScore = (doc: DbRow, rank: number, type: "k" | "s" | "f") => {
    let existing = rrfScores.get(doc.id);
    if (!existing) {
      existing = { doc, rrfScore: 0, sourceRanks: {} };
      rrfScores.set(doc.id, existing);
    }
    existing.rrfScore += 1 / (k + rank);
    if (type === "k") existing.sourceRanks.k = rank;
    if (type === "s") existing.sourceRanks.s = rank;
    if (type === "f") existing.sourceRanks.f = rank;
  };

  // Rank entries
  keywordResults.forEach((doc, idx) => addScore(doc, idx + 1, "k"));
  semanticResults.forEach((doc, idx) => addScore(doc, idx + 1, "s"));
  fallbackResults.forEach((doc, idx) => addScore(doc, idx + 1, "f"));

  // Sort and select top 50 results
  const sortedRrf = Array.from(rrfScores.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, 50);

  const results: SearchResultItem[] = sortedRrf.map(({ doc, rrfScore, sourceRanks }) => {
    // Determine confidence/match highlights:
    // Gold: both keyword and semantic (k and s present)
    // Purple: semantic match only (s present, no k)
    // Blue: keyword match only (k or f present, no s)
    let scoreMeta = 1; // default blue
    if (sourceRanks.k !== undefined && sourceRanks.s !== undefined) {
      scoreMeta = 3; // Gold
    } else if (sourceRanks.s !== undefined) {
      scoreMeta = 2; // Purple
    }

    return {
      id: doc.id,
      source: doc.source,
      title: doc.title,
      content: doc.content,
      snippet: doc.snippet ?? "",
      author: doc.author,
      date: doc.date ? doc.date.toISOString() : null,
      url: doc.url,
      score: scoreMeta, // Re-purpose score field: 1=Blue, 2=Purple, 3=Gold
    };
  });

  return {
    results,
    parsedQuery: parsed,
    searchType,
  };
}
