import Groq from "groq-sdk";
import { isGroqConfigured } from "./queryParser";

type SummaryDocInput = {
  id: string;
  title: string;
  content: string;
};

// In-memory cache for match summaries (5 minutes)
// Key: query_hash + "_" + sorted_result_ids_hash
const summaryCache = new Map<string, { summaries: string[]; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

let groqClient: Groq | null = null;
function getGroqClient() {
  if (!groqClient) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("Groq API key is not configured.");
    }
    groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }
  return groqClient;
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

  if (!isGroqConfigured()) {
    return emptyOutput;
  }

  try {
    const client = getGroqClient();
    const systemPrompt = `For each search result below, write a single sentence (max 15 words) explaining why it is relevant to the query "${query}".
Return ONLY a JSON object with a single field "summaries" containing an array of strings, one per result, in the same order. Do not include markdown code block syntax, no explanation, and no extra text.`;

    const formattedDocs = results
      .map((r, i) => `[${i}] Title: ${r.title}\nContent Preview: ${r.content.substring(0, 250)}`)
      .join("\n\n");

    const response = await client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Results:\n${formattedDocs}` },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      max_tokens: 600,
      response_format: { type: "json_object" },
    });

    const contentText = response.choices[0]?.message?.content?.trim() || "";
    const parsedObj = JSON.parse(contentText) as { summaries: string[] };
    const summaries = parsedObj.summaries || [];

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
    console.error("Groq match summarization failed:", error);
    return emptyOutput;
  }
}
