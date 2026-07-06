import Groq from "groq-sdk";

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

export function isGroqConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
}

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

  if (!isGroqConfigured()) {
    console.warn("Groq API key missing. Using fallback parser.");
    return createDefaultFallback(rawQuery);
  }

  try {
    const client = getGroqClient();
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

    const response = await client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: rawQuery },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const contentText = response.choices[0]?.message?.content?.trim() || "";
    const parsed = JSON.parse(contentText) as ParsedQuery;

    // Cache the result
    queryCache.set(normalized, {
      result: parsed,
      expiry: Date.now() + CACHE_TTL_MS,
    });

    return parsed;
  } catch (error) {
    console.error("Groq query parsing failed:", error);
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
