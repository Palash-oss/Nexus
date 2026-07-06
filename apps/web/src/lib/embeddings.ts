import { OpenAI } from "openai";
import { db } from "@/lib/db";

// Helper to check if OpenAI is configured
export function isOpenAiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

// Instantiate OpenAI client dynamically to avoid throwing on import if key is missing
let openaiClient: OpenAI | null = null;
function getOpenAIClient() {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured.");
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

/**
 * Generates an embedding for a single text string using text-embedding-3-small.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!isOpenAiConfigured()) {
    // Return dummy vector of 1536 dimensions if not configured (development fallback)
    console.warn("OpenAI API key missing. Generating mock embedding vector.");
    return Array.from({ length: 1536 }, () => 0.0);
  }

  const client = getOpenAIClient();
  const normalizedText = text.replace(/\n/g, " ");

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: normalizedText,
    encoding_format: "float",
  });

  return response.data[0].embedding;
}

/**
 * Generates embeddings for a batch of text strings (max 100 at a time).
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (!isOpenAiConfigured()) {
    return texts.map(() => Array.from({ length: 1536 }, () => 0.0));
  }

  const client = getOpenAIClient();
  const results: number[][] = [];
  
  // Process in batches of 100
  const batchSize = 100;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize).map(t => t.replace(/\n/g, " "));
    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
      encoding_format: "float",
    });

    results.push(...response.data.map(item => item.embedding));

    // Rate limit sleep of 1 second between batches
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Scans all documents where embeddingVector is empty and generates/stores embeddings in batches.
 */
export async function backfillEmbeddings(userId: string): Promise<{ updated: number }> {
  // Find documents for user where embeddingVector is null or empty array
  // Since embeddingVector is Float[], we check where it is empty or null
  const docs = await db.document.findMany({
    where: {
      userId,
      OR: [
        { embeddingVector: { equals: [] } }
      ]
    },
    select: {
      id: true,
      title: true,
      content: true,
    },
    take: 500, // Limit per backfill run
  });

  if (docs.length === 0) {
    return { updated: 0 };
  }

  let updatedCount = 0;
  const batchSize = 100;

  for (let i = 0; i < docs.length; i += batchSize) {
    const batchDocs = docs.slice(i, i + batchSize);
    const texts = batchDocs.map(d => `${d.title} ${d.content.slice(0, 500)}`);
    
    try {
      const embeddings = await generateEmbeddingsBatch(texts);

      for (let j = 0; j < batchDocs.length; j++) {
        const docId = batchDocs[j].id;
        const embedding = embeddings[j];

        // Store using raw update
        await db.$executeRaw`
          UPDATE "Document"
          SET "embeddingVector" = ${embedding}::double precision[]
          WHERE id = ${docId}
        `;
        updatedCount++;
      }
    } catch (error) {
      console.error(`Backfill failed for batch starting at index ${i}:`, error);
      // Continue next batches if one fails
    }

    if (i + batchSize < docs.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return { updated: updatedCount };
}
