import { describe, it, expect, beforeEach } from 'vitest'
import {
  recordUsage,
  getDailyUsage,
  isCloudflareFreeTierExhausted,
  getRemainingFreeNeurons,
  getUsageSummary,
  estimateNeurons,
  resetUsage,
} from './token-tracker'

describe('token-tracker', () => {
  beforeEach(() => {
    resetUsage()
  })

  describe('recordUsage', () => {
    it('accumulates tokens across multiple calls', () => {
      recordUsage('groq', 100, 50)
      recordUsage('groq', 200, 100)

      const usage = getDailyUsage()
      expect(usage.inputTokens).toBe(300)
      expect(usage.outputTokens).toBe(150)
      expect(usage.requests).toBe(2)
    })

    it('tracks usage by provider', () => {
      recordUsage('groq', 100, 50)
      recordUsage('gemini', 200, 100)

      const usage = getDailyUsage()
      expect(usage.byProvider.groq).toEqual({ input: 100, output: 50, requests: 1 })
      expect(usage.byProvider.gemini).toEqual({ input: 200, output: 100, requests: 1 })
    })

    it('tracks neurons when provided', () => {
      recordUsage('cloudflare', 100, 50, 500)

      const usage = getDailyUsage()
      expect(usage.neurons).toBe(500)
    })
  })

  describe('isCloudflareFreeTierExhausted', () => {
    it('returns false when under 75% threshold', () => {
      // 7499 neurons = under 75% of 10,000
      recordUsage('cloudflare', 0, 0, 7499)
      expect(isCloudflareFreeTierExhausted()).toBe(false)
    })

    it('returns true at exactly 75% threshold', () => {
      // 7500 neurons = exactly 75% of 10,000
      recordUsage('cloudflare', 0, 0, 7500)
      expect(isCloudflareFreeTierExhausted()).toBe(true)
    })

    it('returns true when over 75% threshold', () => {
      recordUsage('cloudflare', 0, 0, 8000)
      expect(isCloudflareFreeTierExhausted()).toBe(true)
    })
  })

  describe('getRemainingFreeNeurons', () => {
    it('returns 10000 when no usage', () => {
      expect(getRemainingFreeNeurons()).toBe(10000)
    })

    it('returns correct remaining after usage', () => {
      recordUsage('cloudflare', 0, 0, 3000)
      expect(getRemainingFreeNeurons()).toBe(7000)
    })

    it('returns 0 when fully exhausted', () => {
      recordUsage('cloudflare', 0, 0, 12000)
      expect(getRemainingFreeNeurons()).toBe(0)
    })
  })

  describe('estimateNeurons', () => {
    it('weights output tokens higher than input', () => {
      // 100 input / 10 = 10, 100 output / 5 = 20, total = 30
      expect(estimateNeurons(100, 100)).toBe(30)
    })

    it('rounds up partial neurons', () => {
      // 5 input / 10 = 0.5, 3 output / 5 = 0.6, total = 1.1 -> ceil = 2
      expect(estimateNeurons(5, 3)).toBe(2)
    })
  })

  describe('getUsageSummary', () => {
    it('returns complete summary with exhausted status', () => {
      recordUsage('groq', 500, 200)
      recordUsage('cloudflare', 100, 50, 7600)

      const summary = getUsageSummary()

      expect(summary.totalRequests).toBe(2)
      expect(summary.totalTokens).toEqual({ input: 600, output: 250 })
      expect(summary.cloudflareNeurons.used).toBe(7600)
      expect(summary.cloudflareNeurons.remaining).toBe(2400)
      expect(summary.cloudflareNeurons.exhausted).toBe(true) // over 75%
    })
  })
})
