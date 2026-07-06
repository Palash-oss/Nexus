import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth/config";
import { getServerSession } from "next-auth";
import { isBlockedUrl } from "@/lib/blocklist";
import { truncateForSnippet } from "@/lib/utils";
import { generateEmbedding } from "@/lib/embeddings";
import { rateLimitRequest } from "@/lib/ratelimit";

const ingestSchema = z.object({
  pages: z.array(
    z.object({
      url: z.string().url(),
      title: z.string().min(1).max(500),
      content: z.string().max(5000),
      timestamp: z.number(),
      domain: z.string(),
    })
  ).max(50),
});

// Helper to set CORS headers
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    let userId: string | null = null;

    // Check NextAuth session first
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      userId = session.user.id;
    } else {
      // Check Bearer Token
      const authHeader = request.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7).trim();
        const extToken = await db.extensionToken.findUnique({
          where: { token },
          include: { user: true },
        });

        if (extToken) {
          userId = extToken.userId;
          // Update lastUsed timestamp
          await db.extensionToken.update({
            where: { id: extToken.id },
            data: { lastUsed: new Date() },
          });
        }
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders() }
      );
    }

    // Rate limiting: 30 requests per minute per user/token
    const limitCheck = await rateLimitRequest(userId, "extension_ingest");
    if (!limitCheck.success) {
      const retryAfter = Math.ceil((limitCheck.reset - Date.now()) / 1000).toString();
      return new NextResponse(
        JSON.stringify({ error: "Too Many Requests" }),
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter,
            "Content-Type": "application/json",
            ...corsHeaders(),
          },
        }
      );
    }

    // 2. Body Validation
    const body = await request.json();
    const result = ingestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request schema", details: result.error.format() },
        { status: 400, headers: corsHeaders() }
      );
    }

    const { pages } = result.data;
    let indexed = 0;

    for (const page of pages) {
      if (isBlockedUrl(page.url)) {
        continue;
      }

      const snippet = truncateForSnippet(page.content);
      const doc = await db.document.upsert({
        where: {
          userId_source_sourceDocumentId: {
            userId,
            source: "WEB",
            sourceDocumentId: page.url,
          },
        },
        create: {
          userId,
          source: "WEB",
          sourceDocumentId: page.url,
          title: page.title,
          content: page.content,
          snippet,
          author: page.domain,
          url: page.url,
          metadata: { domain: page.domain },
          externalCreatedAt: new Date(page.timestamp),
          externalUpdatedAt: new Date(page.timestamp),
        },
        update: {
          title: page.title,
          content: page.content,
          snippet,
          author: page.domain,
          metadata: { domain: page.domain },
          externalUpdatedAt: new Date(page.timestamp),
        },
      });

      // Generate embedding in background or handle gracefully
      try {
        const textToEmbed = doc.title + " " + doc.content.slice(0, 500);
        const vector = await generateEmbedding(textToEmbed);
        await db.$executeRaw`
          UPDATE "Document" 
          SET "embeddingVector" = ${vector}::double precision[]
          WHERE id = ${doc.id}
        `;
      } catch (err) {
        console.error(`Embedding generation failed for document ${doc.id}:`, err);
      }

      indexed++;
    }

    // Log this ingestion event to IngestLog
    if (indexed > 0) {
      await db.ingestLog.create({
        data: {
          userId,
          source: "WEB",
          count: indexed,
        },
      });
    }

    return NextResponse.json(
      { success: true, indexed },
      { status: 200, headers: corsHeaders() }
    );
  } catch (error) {
    console.error("Extension ingest failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders() }
    );
  }
}
