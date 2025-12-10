import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  checkRateLimit,
  getClientIp,
  resetRateLimit,
  clearAllRateLimits,
} from './rate-limit'

describe('rate-limit', () => {
  beforeEach(() => {
    clearAllRateLimits()
  })

  describe('checkRateLimit', () => {
    it('allows first request', () => {
      const result = checkRateLimit('test-ip', { limit: 5, windowMs: 60000 })

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
    })

    it('decrements remaining on each request', () => {
      const config = { limit: 5, windowMs: 60000 }

      const r1 = checkRateLimit('test-ip', config)
      expect(r1.remaining).toBe(4)

      const r2 = checkRateLimit('test-ip', config)
      expect(r2.remaining).toBe(3)

      const r3 = checkRateLimit('test-ip', config)
      expect(r3.remaining).toBe(2)
    })

    it('blocks after limit exceeded', () => {
      const config = { limit: 3, windowMs: 60000 }

      checkRateLimit('test-ip', config) // 1
      checkRateLimit('test-ip', config) // 2
      checkRateLimit('test-ip', config) // 3

      const blocked = checkRateLimit('test-ip', config) // 4 - should block

      expect(blocked.allowed).toBe(false)
      expect(blocked.remaining).toBe(0)
    })

    it('tracks different IPs separately', () => {
      const config = { limit: 2, windowMs: 60000 }

      checkRateLimit('ip-1', config)
      checkRateLimit('ip-1', config)
      const ip1Result = checkRateLimit('ip-1', config) // blocked

      const ip2Result = checkRateLimit('ip-2', config) // should be allowed

      expect(ip1Result.allowed).toBe(false)
      expect(ip2Result.allowed).toBe(true)
    })

    it('resets after window expires', async () => {
      const config = { limit: 2, windowMs: 50 } // 50ms window

      checkRateLimit('test-ip', config)
      checkRateLimit('test-ip', config)
      const blocked = checkRateLimit('test-ip', config)
      expect(blocked.allowed).toBe(false)

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 60))

      const afterReset = checkRateLimit('test-ip', config)
      expect(afterReset.allowed).toBe(true)
      expect(afterReset.remaining).toBe(1)
    })

    it('returns resetTime', () => {
      const now = Date.now()
      const config = { limit: 5, windowMs: 60000 }

      const result = checkRateLimit('test-ip', config)

      expect(result.resetTime).toBeGreaterThan(now)
      expect(result.resetTime).toBeLessThanOrEqual(now + config.windowMs + 100)
    })

    it('uses default config when not provided', () => {
      const result = checkRateLimit('test-ip')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(19) // default limit is 20
    })
  })

  describe('getClientIp', () => {
    it('prefers cf-connecting-ip header', () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'x-forwarded-for': '5.6.7.8',
        },
      })

      expect(getClientIp(request)).toBe('1.2.3.4')
    })

    it('falls back to x-forwarded-for', () => {
      const request = new Request('https://example.com', {
        headers: {
          'x-forwarded-for': '5.6.7.8, 9.10.11.12',
        },
      })

      expect(getClientIp(request)).toBe('5.6.7.8')
    })

    it('returns unknown when no IP headers', () => {
      const request = new Request('https://example.com')

      expect(getClientIp(request)).toBe('unknown')
    })

    it('trims whitespace from forwarded IP', () => {
      const request = new Request('https://example.com', {
        headers: {
          'x-forwarded-for': '  1.2.3.4  , 5.6.7.8',
        },
      })

      expect(getClientIp(request)).toBe('1.2.3.4')
    })
  })

  describe('resetRateLimit', () => {
    it('resets limit for specific key', () => {
      const config = { limit: 2, windowMs: 60000 }

      checkRateLimit('test-ip', config)
      checkRateLimit('test-ip', config)
      const blocked = checkRateLimit('test-ip', config)
      expect(blocked.allowed).toBe(false)

      resetRateLimit('test-ip')

      const afterReset = checkRateLimit('test-ip', config)
      expect(afterReset.allowed).toBe(true)
      expect(afterReset.remaining).toBe(1)
    })

    it('does not affect other keys', () => {
      const config = { limit: 2, windowMs: 60000 }

      checkRateLimit('ip-1', config)
      checkRateLimit('ip-2', config)

      resetRateLimit('ip-1')

      const ip1 = checkRateLimit('ip-1', config)
      const ip2 = checkRateLimit('ip-2', config)

      expect(ip1.remaining).toBe(1) // reset
      expect(ip2.remaining).toBe(0) // not reset
    })
  })

  describe('clearAllRateLimits', () => {
    it('clears all rate limits', () => {
      const config = { limit: 2, windowMs: 60000 }

      checkRateLimit('ip-1', config)
      checkRateLimit('ip-1', config)
      checkRateLimit('ip-2', config)
      checkRateLimit('ip-2', config)

      clearAllRateLimits()

      expect(checkRateLimit('ip-1', config).remaining).toBe(1)
      expect(checkRateLimit('ip-2', config).remaining).toBe(1)
    })
  })
})
