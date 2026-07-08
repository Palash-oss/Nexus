import { DocumentSource, IngestionStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { fetchGoogleJson } from "@/lib/google/client";
import { truncateForSnippet } from "@/lib/utils";
import { generateEmbedding } from "@/lib/embeddings";

type DriveFile = {
  id: string;
  name: string;
  description?: string;
  webViewLink?: string;
  createdTime?: string;
  modifiedTime?: string;
  owners?: Array<{ displayName?: string; emailAddress?: string }>;
  trashed?: boolean;
};

type DriveListResponse = {
  files?: DriveFile[];
  nextPageToken?: string;
};

export async function ingestDriveForUser(userId: string) {
  const run = await db.ingestionRun.create({
    data: {
      userId,
      source: DocumentSource.DRIVE,
      status: IngestionStatus.RUNNING,
    },
  });

  let fetched = 0;
  let indexed = 0;
  let failed = 0;
  const warnings: string[] = [];

  try {
    const files: DriveFile[] = [];
    let pageToken: string | undefined;

    while (files.length < 5000) {
      const params = new URLSearchParams({
        pageSize: "100",
        q: "trashed = false",
        fields:
          "nextPageToken, files(id,name,description,owners(displayName,emailAddress),modifiedTime,createdTime,webViewLink,trashed)",
      });

      if (pageToken) {
        params.set("pageToken", pageToken);
      }

      const response = await fetchGoogleJson<DriveListResponse>(
        userId,
        `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      );

      const nextFiles = (response.files ?? []).filter((file) => !file.trashed);
      files.push(...nextFiles);
      pageToken = response.nextPageToken;

      if (!pageToken || nextFiles.length === 0) {
        break;
      }
    }

    const selectedFiles = files.slice(0, 5000);
    fetched = selectedFiles.length;

    for (const file of selectedFiles) {
      try {
        const owner =
          file.owners?.[0]?.displayName ?? file.owners?.[0]?.emailAddress ?? "Unknown owner";
        const description = file.description?.trim() ?? "";
        const content = `${file.name}${description ? `\n\n${description}` : ""}`;

        const doc = await db.document.upsert({
          where: {
            userId_source_sourceDocumentId: {
              userId,
              source: DocumentSource.DRIVE,
              sourceDocumentId: file.id,
            },
          },
          create: {
            userId,
            source: DocumentSource.DRIVE,
            sourceDocumentId: file.id,
            title: file.name,
            content,
            snippet: truncateForSnippet(content),
            author: owner,
            url: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
            externalCreatedAt: file.createdTime ? new Date(file.createdTime) : undefined,
            externalUpdatedAt: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
            embeddingVector: [],
            metadata: {
              description,
            },
          },
          update: {
            title: file.name,
            content,
            snippet: truncateForSnippet(content),
            author: owner,
            url: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
            externalCreatedAt: file.createdTime ? new Date(file.createdTime) : undefined,
            externalUpdatedAt: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
            metadata: {
              description,
            },
          },
        });

        indexed += 1;
      } catch (error) {
        failed += 1;
        warnings.push(`File ${file.id}: ${(error as Error).message}`);
      }
    }

    const status = failed === 0 ? IngestionStatus.SUCCESS : indexed > 0 ? IngestionStatus.PARTIAL : IngestionStatus.FAILED;

    if (indexed > 0) {
      await db.ingestLog.create({
        data: {
          userId,
          source: DocumentSource.DRIVE,
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
        errorSummary: failed > 0 ? `${failed} file(s) could not be indexed.` : null,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    });

    return {
      source: DocumentSource.DRIVE,
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
