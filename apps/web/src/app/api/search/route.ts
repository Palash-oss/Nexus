import { NextRequest, NextResponse } from "next/server";

import { getRequiredServerSession } from "@/lib/auth/session";
import { performHybridSearch } from "@/lib/search/query";
import { generateMatchSummaries } from "@/lib/summarizer";
import { db } from "@/lib/db";

import { rateLimitRequest } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  const session = await getRequiredServerSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting: 60 requests per minute per user
  const limitCheck = await rateLimitRequest(session.user.id, "search");
  if (!limitCheck.success) {
    const retryAfter = Math.ceil((limitCheck.reset - Date.now()) / 1000).toString();
    return new NextResponse(
      JSON.stringify({ error: "Too Many Requests" }),
      {
        status: 429,
        headers: {
          "Retry-After": retryAfter,
          "Content-Type": "application/json",
        },
      }
    );
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!query) {
    return NextResponse.json({
      query: "",
      count: 0,
      tookMs: 0,
      results: [],
      searchType: "keyword",
      parsedQuery: null,
    });
  }

  const startedAt = Date.now();

  try {
    // 1. Perform Hybrid Search
    // Check if there are active tab filters from URL
    const sourcesParam = request.nextUrl.searchParams.get("sources");
    const sourceFilters = sourcesParam ? sourcesParam.split(",") : undefined;

    const { results, parsedQuery, searchType } = await performHybridSearch(
      session.user.id,
      query,
      sourceFilters
    );

    // 2. Generate Match Summaries for Top 10
    const topTen = results.slice(0, 10);
    const summaryMapping = await generateMatchSummaries(
      query,
      topTen.map((r) => ({ id: r.id, title: r.title, content: r.content }))
    );

    // Attach summaries to results
    const finalResults = results.map((item) => {
      if (summaryMapping[item.id]) {
        return {
          ...item,
          aiSummary: summaryMapping[item.id],
        };
      }
      return item;
    });

    const durationMs = Date.now() - startedAt;

    // 3. Log query to SearchLog in background
    db.searchLog.create({
      data: {
        userId: session.user.id,
        query,
        resultCount: results.length,
        durationMs,
      },
    }).catch((err) => {
      console.error("Failed to log search query:", err);
    });

    return NextResponse.json({
      query,
      count: finalResults.length,
      tookMs: durationMs,
      results: finalResults,
      parsedQuery,
      searchType,
    });
  } catch (error) {
    console.error("Hybrid search failed:", error);
    return NextResponse.json(
      {
        error: "Search failed.",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
