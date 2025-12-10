/**
 * Simple in-memory rate limiter
 * For production, consider Cloudflare KV or Durable Objects
 */

interface RateLimitRecord {
  count: number
  resetTime: number
}

// In-memory store (resets on worker restart)
const store = new Map<string, RateLimitRecord>()

export interface RateLimitConfig {
  limit: number      // Max requests per window
  windowMs: number   // Window size in milliseconds
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
}

/**
 * Check rate limit for a given key (usually IP address)
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = { limit: 20, windowMs: 60 * 60 * 1000 }
): RateLimitResult {
  const now = Date.now()
  const record = store.get(key)

  // New or expired record
  if (!record || now > record.resetTime) {
    const resetTime = now + config.windowMs
    store.set(key, { count: 1, resetTime })
    return { allowed: true, remaining: config.limit - 1, resetTime }
  }

  // Rate limit exceeded
  if (record.count >= config.limit) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime }
  }

  // Increment and allow
  record.count++
  return { allowed: true, remaining: config.limit - record.count, resetTime: record.resetTime }
}

/**
 * Get IP address from request headers
 * Prefers Cloudflare headers, falls back to x-forwarded-for
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

/**
 * Reset rate limit for a key (useful for testing)
 */
export function resetRateLimit(key: string): void {
  store.delete(key)
}

/**
 * Clear all rate limits (useful for testing)
 */
export function clearAllRateLimits(): void {
  store.clear()
}
