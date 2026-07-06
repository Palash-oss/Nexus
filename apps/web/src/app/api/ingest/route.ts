import { NextResponse } from "next/server";

import { getRequiredServerSession } from "@/lib/auth/session";
import { runIngestion } from "@/lib/ingestion";

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
