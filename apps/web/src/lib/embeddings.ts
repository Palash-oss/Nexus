import { GoogleGenAI } from "@google/genai";
import { db } from "@/lib/db";

// Helper to check if Gemini is configured
export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

// Instantiate GoogleGenAI client dynamically to avoid throwing on import if key is missing
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!geminiClient) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key is not configured.");
    }
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }
  return geminiClient;
}

/**
 * Generates an embedding for a single text string using text-embedding-005.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!isGeminiConfigured()) {
    // Return dummy vector of 768 dimensions if not configured (development fallback)
    console.warn("Gemini API key missing. Generating mock embedding vector.");
    return Array.from({ length: 768 }, () => 0.0);
  }

  const client = getGeminiClient();
  const response = await client.models.embedContent({
    model: "text-embedding-005",
    contents: text,
  });

  const embedding = response.embeddings?.[0]?.values;
  if (!embedding) {
    throw new Error("Failed to extract embedding values from Gemini response.");
  }

  return embedding;
}

/**
 * Generates embeddings for a batch of text strings (max 100 at a time).
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (!isGeminiConfigured()) {
    return texts.map(() => Array.from({ length: 768 }, () => 0.0));
  }

  const client = getGeminiClient();
  const results: number[][] = [];
  
  // Process in batches of 100
  const batchSize = 100;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await client.models.embedContent({
      model: "text-embedding-005",
      contents: batch,
    });

    if (response.embeddings) {
      results.push(...response.embeddings.map(item => item.values || []));
    } else {
      throw new Error("Failed to extract batch embedding values from Gemini response.");
    }

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
    }

    if (i + batchSize < docs.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return { updated: updatedCount };
}
