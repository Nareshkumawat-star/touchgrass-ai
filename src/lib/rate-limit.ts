/**
 * Tiny in-memory rate limiter.
 *
 * Protects the AI endpoints (especially paid remote providers and slow local
 * inference) from accidental hammering — for example a stuck retry loop on a
 * flaky phone connection. Per-process only: good enough here, and a real
 * deployment would move this to Redis.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

declare global {
  var __touchgrassRateLimit: Map<string, Bucket> | undefined;
}

const buckets: Map<string, Bucket> =
  globalThis.__touchgrassRateLimit ?? (globalThis.__touchgrassRateLimit = new Map());

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: options.limit - 1, retryAfterSeconds: 0 };
  }

  if (bucket.count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: options.limit - bucket.count,
    retryAfterSeconds: 0,
  };
}

/** Housekeeping so the map cannot grow forever in a long-running process. */
export function pruneRateLimit(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}
