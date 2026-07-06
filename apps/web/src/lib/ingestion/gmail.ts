import { DocumentSource, IngestionStatus } from "@prisma/client";
import { convert } from "html-to-text";

import { db } from "@/lib/db";
import { fetchGoogleJson } from "@/lib/google/client";
import { truncateForSnippet } from "@/lib/utils";
import { generateEmbedding } from "@/lib/embeddings";

type GmailListResponse = {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
};

type GmailHeader = { name: string; value: string };

type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};

type GmailMessageResponse = {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: {
    mimeType?: string;
    headers?: GmailHeader[];
    body?: { data?: string };
    parts?: GmailPart[];
  };
};

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

function extractTextFromPart(part?: GmailPart): string {
  if (!part) {
    return "";
  }

  if (part.mimeType?.startsWith("text/plain") && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }

  if (part.mimeType?.startsWith("text/html") && part.body?.data) {
    const html = decodeBase64Url(part.body.data);
    return convert(html, {
      wordwrap: false,
      selectors: [{ selector: "a", options: { ignoreHref: true } }],
    });
  }

  return (part.parts ?? []).map((child) => extractTextFromPart(child)).join("\n");
}

function headerValue(headers: GmailHeader[] | undefined, name: string) {
  return headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value;
}

export async function ingestGmailForUser(userId: string) {
  const run = await db.ingestionRun.create({
    data: {
      userId,
      source: DocumentSource.GMAIL,
      status: IngestionStatus.RUNNING,
    },
  });

  let fetched = 0;
  let indexed = 0;
  let failed = 0;
  const warnings: string[] = [];

  try {
    const messageIds: string[] = [];
    let pageToken: string | undefined;

    while (messageIds.length < 200) {
      const params = new URLSearchParams({
        maxResults: "100",
        q: "in:inbox",
      });

      if (pageToken) {
        params.set("pageToken", pageToken);
      }

      const list = await fetchGoogleJson<GmailListResponse>(
        userId,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
      );

      const ids = (list.messages ?? []).map((message) => message.id);
      messageIds.push(...ids);
      pageToken = list.nextPageToken;

      if (!pageToken || ids.length === 0) {
        break;
      }
    }

    const selectedMessageIds = messageIds.slice(0, 200);
    fetched = selectedMessageIds.length;

    for (const messageId of selectedMessageIds) {
      try {
        const message = await fetchGoogleJson<GmailMessageResponse>(
          userId,
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        );

        const headers = message.payload?.headers;
        const subject = headerValue(headers, "Subject") ?? "(No Subject)";
        const from = headerValue(headers, "From") ?? "Unknown sender";
        const sentAtRaw = headerValue(headers, "Date");

        const parsedDate = sentAtRaw ? new Date(sentAtRaw) : undefined;
        const internalDate = message.internalDate ? new Date(Number(message.internalDate)) : undefined;

        const bodyText =
          extractTextFromPart({
            mimeType: message.payload?.mimeType,
            body: message.payload?.body,
            parts: message.payload?.parts,
          }) || message.snippet || "";

        const normalizedBody = bodyText.replace(/\s+/g, " ").trim();

        const doc = await db.document.upsert({
          where: {
            userId_source_sourceDocumentId: {
              userId,
              source: DocumentSource.GMAIL,
              sourceDocumentId: message.id,
            },
          },
          create: {
            userId,
            source: DocumentSource.GMAIL,
            sourceDocumentId: message.id,
            title: subject,
            content: normalizedBody,
            snippet: truncateForSnippet(normalizedBody),
            author: from,
            url: `https://mail.google.com/mail/u/0/#inbox/${message.id}`,
            externalCreatedAt: parsedDate,
            externalUpdatedAt: internalDate,
            metadata: {
              threadId: message.threadId,
            },
          },
          update: {
            title: subject,
            content: normalizedBody,
            snippet: truncateForSnippet(normalizedBody),
            author: from,
            externalCreatedAt: parsedDate,
            externalUpdatedAt: internalDate,
            metadata: {
              threadId: message.threadId,
            },
          },
        });

        try {
          const textToEmbed = subject + " " + normalizedBody.slice(0, 500);
          const vector = await generateEmbedding(textToEmbed);
          await db.$executeRaw`
            UPDATE "Document"
            SET "embeddingVector" = ${vector}::double precision[]
            WHERE id = ${doc.id}
          `;
        } catch (err) {
          console.error(`Failed to generate embedding for Gmail message ${message.id}:`, err);
        }

        indexed += 1;
      } catch (error) {
        failed += 1;
        warnings.push(`Message ${messageId}: ${(error as Error).message}`);
      }
    }

    const status = failed === 0 ? IngestionStatus.SUCCESS : indexed > 0 ? IngestionStatus.PARTIAL : IngestionStatus.FAILED;

    if (indexed > 0) {
      await db.ingestLog.create({
        data: {
          userId,
          source: DocumentSource.GMAIL,
          count: indexed,
        },
      });
    }

    await db.ingestionRun.update({
      where: { id: run.id },
      data: {
        status,
        finishedAt: new Date(),
        totalFetched: fetched,
        totalIndexed: indexed,
        totalFailed: failed,
        errorSummary: failed > 0 ? `${failed} message(s) could not be indexed.` : null,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    });

    return {
      source: DocumentSource.GMAIL,
      status,
      fetched,
      indexed,
      failed,
      warnings,
    };
  } catch (error) {
    const message = (error as Error).message;

    await db.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: IngestionStatus.FAILED,
        finishedAt: new Date(),
        totalFetched: fetched,
        totalIndexed: indexed,
        totalFailed: Math.max(failed, fetched - indexed),
        errorSummary: message,
      },
    });

    throw error;
  }
}
