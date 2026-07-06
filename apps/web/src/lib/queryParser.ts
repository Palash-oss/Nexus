import Anthropic from "@anthropic-ai/sdk";

export type ParsedQuery = {
  cleanQuery: string;
  intent: "find_email" | "find_file" | "find_page" | "find_any";
  sources: ("gmail" | "drive" | "web")[] | null;
  dateRange: { start: string | null; end: string | null } | null;
  author: string | null;
  keywords: string[];
  isQuestion: boolean;
};

// In-memory cache for query parsing (60 seconds)
const queryCache = new Map<string, { result: ParsedQuery; expiry: number }>();
const CACHE_TTL_MS = 60 * 1000;

export function isAnthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

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

export async function parseQuery(rawQuery: string): Promise<ParsedQuery> {
  const normalized = rawQuery.trim().toLowerCase();
  if (!normalized) {
    return createDefaultFallback(rawQuery);
  }

  // Check cache
  const cached = queryCache.get(normalized);
  if (cached && cached.expiry > Date.now()) {
    return cached.result;
  }

  if (!isAnthropicConfigured()) {
    console.warn("Anthropic API key missing. Using fallback parser.");
    return createDefaultFallback(rawQuery);
  }

  try {
    const client = getAnthropicClient();
    const today = new Date().toISOString();

    const systemPrompt = `You are a search query parser. Extract structured information from the user's search query.
Return ONLY a raw JSON object matching the JSON schema below. Do not include markdown code block syntax (like \`\`\`json), no explanation, and no extra text.

JSON Schema:
{
  "cleanQuery": "the core search terms stripped of metadata",
  "intent": "find_email" | "find_file" | "find_page" | "find_any",
  "sources": ["gmail", "drive", "web"] or null (null means search all),
  "dateRange": { "start": "ISO date string or null", "end": "ISO date string or null" } or null,
  "author": "name or email to filter by, or null",
  "keywords": ["array", "of", "key", "terms"],
  "isQuestion": boolean
}

Today's date is: ${today}`;

    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 300,
      temperature: 0,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: rawQuery,
        },
      ],
    });

    const contentText = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as any).text)
      .join("")
      .trim();

    // Parse output JSON, stripping any potential markdown formatting
    const cleanedJson = contentText
      .replace(/^```json/i, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();

    const parsed = JSON.parse(cleanedJson) as ParsedQuery;

    // Cache the result
    queryCache.set(normalized, {
      result: parsed,
      expiry: Date.now() + CACHE_TTL_MS,
    });

    return parsed;
  } catch (error) {
    console.error("Claude query parsing failed:", error);
    return createDefaultFallback(rawQuery);
  }
}

function createDefaultFallback(rawQuery: string): ParsedQuery {
  return {
    cleanQuery: rawQuery,
    intent: "find_any",
    sources: null,
    dateRange: null,
    author: null,
    keywords: rawQuery ? rawQuery.split(/\s+/).filter(Boolean) : [],
    isQuestion: rawQuery.includes("?"),
  };
}
