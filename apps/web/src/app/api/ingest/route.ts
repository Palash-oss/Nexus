import { NextResponse } from "next/server";

import { getRequiredServerSession } from "@/lib/auth/session";
import { runIngestion } from "@/lib/ingestion";
import { backfillEmbeddings } from "@/lib/embeddings";

import { rateLimitRequest } from "@/lib/ratelimit";

export async function POST() {
  const session = await getRequiredServerSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting: 5 requests per minute per user
  const limitCheck = await rateLimitRequest(session.user.id, "ingest");
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

  try {
    const startedAt = Date.now();
    const result = await runIngestion(session.user.id);

    const gmailFailed = result.gmail.status === "rejected" || (result.gmail.status === "fulfilled" && result.gmail.value.status === "FAILED");
    const driveFailed = result.drive.status === "rejected" || (result.drive.status === "fulfilled" && result.drive.value.status === "FAILED");

    if (gmailFailed && driveFailed) {
      const gmailError = result.gmail.status === "rejected"
        ? (result.gmail.reason?.message || "Gmail ingestion rejected")
        : (result.gmail.value.errorSummary || "Gmail ingestion failed");
      const driveError = result.drive.status === "rejected"
        ? (result.drive.reason?.message || "Drive ingestion rejected")
        : (result.drive.value.errorSummary || "Drive ingestion failed");

      return NextResponse.json(
        {
          ok: false,
          error: `Ingestion failed. Gmail: ${gmailError}. Drive: ${driveError}`,
        },
        { status: 500 }
      );
    }

    // Trigger backfill in background to populate embeddings using batched/rate-throttled API
    backfillEmbeddings(session.user.id).catch((err) => {
      console.error("Failed to backfill embeddings in background:", err);
    });

    return NextResponse.json({
      ok: true,
      tookMs: Date.now() - startedAt,
      gmail: result.gmail,
      drive: result.drive,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: (error as Error).message || "Ingestion failed.",
      },
      { status: 500 },
    );
  }
}
