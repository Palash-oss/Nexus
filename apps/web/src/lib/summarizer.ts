import Anthropic from "@anthropic-ai/sdk";
import { isAnthropicConfigured } from "./queryParser";

type SummaryDocInput = {
  id: string;
  title: string;
  content: string;
};

// In-memory cache for match summaries (5 minutes)
// Key: query_hash + "_" + sorted_result_ids_hash
const summaryCache = new Map<string, { summaries: string[]; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

let anthropicClient: Anthropic | null = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("Anthropic API key is not configured.");
    }
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

export async function generateMatchSummaries(
  query: string,
  results: SummaryDocInput[]
): Promise<Record<string, string>> {
  const emptyOutput: Record<string, string> = {};
  if (results.length === 0 || !query.trim()) {
    return emptyOutput;
  }

  // Create unique cache key
  const sortedIds = results.map((r) => r.id).sort().join(",");
  const cacheKey = `${query.trim().toLowerCase()}_${sortedIds}`;

  const cached = summaryCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    const mapping: Record<string, string> = {};
    results.forEach((r, idx) => {
      if (cached.summaries[idx]) {
        mapping[r.id] = cached.summaries[idx];
      }
    });
    return mapping;
  }

  if (!isAnthropicConfigured()) {
    return emptyOutput;
  }

  try {
    const client = getAnthropicClient();
    const systemPrompt = `For each search result below, write a single sentence (max 15 words) explaining why it is relevant to the query "${query}".
Return ONLY a JSON array of strings, one per result, in the same order. Do not include markdown code block syntax (like \`\`\`json), no explanation, and no extra text.`;

    const formattedDocs = results
      .map((r, i) => `[${i}] Title: ${r.title}\nContent Preview: ${r.content.substring(0, 250)}`)
      .join("\n\n");

    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 600,
      temperature: 0,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Results:\n${formattedDocs}`,
        },
      ],
    });

    const contentText = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as any).text)
      .join("")
      .trim();

    // Strip potential markdown
    const cleanedJson = contentText
      .replace(/^```json/i, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();

    const summaries = JSON.parse(cleanedJson) as string[];

    // Store in cache
    summaryCache.set(cacheKey, {
      summaries,
      expiry: Date.now() + CACHE_TTL_MS,
    });

    const mapping: Record<string, string> = {};
    results.forEach((r, idx) => {
      if (summaries[idx]) {
        mapping[r.id] = summaries[idx];
      }
    });

    return mapping;
  } catch (error) {
    console.error("Claude match summarization failed:", error);
    return emptyOutput;
  }
}
