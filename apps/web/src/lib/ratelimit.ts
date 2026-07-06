import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Check if Upstash Redis credentials are set
const hasRedisConfig = !!(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

let redis: Redis | null = null;
if (hasRedisConfig) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

// In-memory fallback rate limiting map for local development/fallback
const memoryCache = new Map<string, { count: number; resetAt: number }>();

function inMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; limit: number; remaining: number; reset: number } {
  const now = Date.now();
  const cached = memoryCache.get(key);

  if (!cached || now > cached.resetAt) {
    const resetAt = now + windowMs;
    memoryCache.set(key, { count: 1, resetAt });
    return { success: true, limit, remaining: limit - 1, reset: resetAt };
  }

  if (cached.count >= limit) {
    return { success: false, limit, remaining: 0, reset: cached.resetAt };
  }

  cached.count += 1;
  return {
    success: true,
    limit,
    remaining: limit - cached.count,
    reset: cached.resetAt,
  };
}

export type RateLimitType = "search" | "ingest" | "extension_ingest";

export async function rateLimitRequest(
  key: string,
  type: RateLimitType
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  // Define limits:
  // search: 60 requests per minute
  // ingest: 5 requests per minute
  // extension_ingest: 30 requests per minute
  let limit = 60;
  let duration: any = "60 s";
  let windowMs = 60 * 1000;

  if (type === "ingest") {
    limit = 5;
    duration = "60 s";
    windowMs = 60 * 1000;
  } else if (type === "extension_ingest") {
    limit = 30;
    duration = "60 s";
    windowMs = 60 * 1000;
  }

  const rateLimitKey = `nexus_limit_${type}_${key}`;

  if (redis) {
    try {
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, duration),
        analytics: true,
      });
      const result = await ratelimit.limit(rateLimitKey);
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
      };
    } catch (err) {
      console.error("Upstash Rate Limiting failed, using memory fallback:", err);
    }
  }

  // Fallback to memory rate limiting
  return inMemoryRateLimit(rateLimitKey, limit, windowMs);
}
