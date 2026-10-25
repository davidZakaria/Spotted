import { getRedis } from "./redis";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

export async function consumeRateLimit(input: {
  key: string;
  limit: number;
  windowSec: number;
  failClosed?: boolean;
}): Promise<RateLimitResult> {
  try {
    const redis = getRedis();
    const redisKey = `rl:${input.key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, input.windowSec);
    }
    const ttl = await redis.ttl(redisKey);
    const retryAfterSec = ttl > 0 ? ttl : input.windowSec;
    if (count > input.limit) {
      return { allowed: false, remaining: 0, retryAfterSec };
    }
    return { allowed: true, remaining: Math.max(0, input.limit - count), retryAfterSec };
  } catch {
    if (input.failClosed) {
      return { allowed: false, remaining: 0, retryAfterSec: input.windowSec };
    }
    return { allowed: true, remaining: input.limit, retryAfterSec: 0 };
  }
}

export function clientIp(headers: Headers | { get(name: string): string | null }): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export function rateLimitResponse(result: RateLimitResult, message = "Too many attempts. Try again shortly.") {
  return new Response(message, {
    status: 429,
    headers: {
      "Retry-After": String(result.retryAfterSec),
      "X-RateLimit-Remaining": String(result.remaining),
    },
  });
}
