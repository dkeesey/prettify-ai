import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  selectProvider,
  getAIConfig,
  isProviderConfigured,
  getProviderInfo,
} from './ai-config'
import * as tokenTracker from './token-tracker'

// Mock token tracker
vi.mock('./token-tracker', () => ({
  isCloudflareFreeTierExhausted: vi.fn(() => false),
}))

describe('ai-config', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Reset env vars - clear all API keys to ensure clean state
    vi.stubEnv('AI_STRATEGY', '')
    vi.stubEnv('AI_PROVIDER', '')
    vi.stubEnv('AI_MODEL', '')
    vi.stubEnv('GROQ_API_KEY', '')
    vi.stubEnv('GEMINI_API_KEY', '')
    vi.stubEnv('OPENAI_API_KEY', '')
    vi.stubEnv('ANTHROPIC_API_KEY', '')
  })

  describe('isProviderConfigured', () => {
    it('returns true for cloudflare when AI binding exists', () => {
      const runtime = { env: { AI: {} } }
      expect(isProviderConfigured('cloudflare', runtime)).toBe(true)
    })

    it('returns false for cloudflare without AI binding', () => {
      const runtime = { env: {} }
      expect(isProviderConfigured('cloudflare', runtime)).toBe(false)
    })

    it('returns true for groq when API key exists in runtime', () => {
      const runtime = { env: { GROQ_API_KEY: 'test-key' } }
      expect(isProviderConfigured('groq', runtime)).toBe(true)
    })
  })

  describe('selectProvider with free-first strategy', () => {
    beforeEach(() => {
      vi.stubEnv('AI_STRATEGY', 'free-first')
    })

    it('selects cloudflare when available and not exhausted', () => {
      vi.mocked(tokenTracker.isCloudflareFreeTierExhausted).mockReturnValue(false)
      const runtime = { env: { AI: {}, GROQ_API_KEY: 'key' } }

      expect(selectProvider(runtime)).toBe('cloudflare')
    })

    it('falls back to groq when cloudflare exhausted', () => {
      vi.mocked(tokenTracker.isCloudflareFreeTierExhausted).mockReturnValue(true)
      const runtime = { env: { AI: {}, GROQ_API_KEY: 'key' } }

      expect(selectProvider(runtime)).toBe('groq')
    })

    it('falls back to gemini if groq unavailable', () => {
      vi.mocked(tokenTracker.isCloudflareFreeTierExhausted).mockReturnValue(true)
      const runtime = { env: { AI: {}, GEMINI_API_KEY: 'key' } }

      expect(selectProvider(runtime)).toBe('gemini')
    })
  })

  describe('selectProvider with cheapest strategy', () => {
    beforeEach(() => {
      vi.stubEnv('AI_STRATEGY', 'cheapest')
    })

    it('prefers groq over cloudflare', () => {
      const runtime = { env: { AI: {}, GROQ_API_KEY: 'key', GEMINI_API_KEY: 'key' } }

      expect(selectProvider(runtime)).toBe('groq')
    })

    it('uses gemini if groq unavailable', () => {
      const runtime = { env: { AI: {}, GEMINI_API_KEY: 'key' } }

      expect(selectProvider(runtime)).toBe('gemini')
    })
  })

  describe('selectProvider with single strategy', () => {
    beforeEach(() => {
      vi.stubEnv('AI_STRATEGY', 'single')
      vi.stubEnv('AI_PROVIDER', 'anthropic')
    })

    it('uses specified provider regardless of availability', () => {
      const runtime = { env: { GROQ_API_KEY: 'key' } }

      expect(selectProvider(runtime)).toBe('anthropic')
    })
  })

  describe('getAIConfig', () => {
    it('returns provider with default model', () => {
      vi.stubEnv('AI_STRATEGY', 'single')
      vi.stubEnv('AI_PROVIDER', 'groq')
      const runtime = { env: { GROQ_API_KEY: 'key' } }

      const config = getAIConfig(runtime)

      expect(config.provider).toBe('groq')
      expect(config.model).toBe('llama-3.3-70b-versatile')
    })

    it('respects model override', () => {
      vi.stubEnv('AI_STRATEGY', 'single')
      vi.stubEnv('AI_PROVIDER', 'groq')
      vi.stubEnv('AI_MODEL', 'custom-model')
      const runtime = { env: { GROQ_API_KEY: 'key' } }

      const config = getAIConfig(runtime)

      expect(config.model).toBe('custom-model')
    })
  })

  describe('getProviderInfo', () => {
    it('lists all configured providers', () => {
      const runtime = { env: { GROQ_API_KEY: 'key', GEMINI_API_KEY: 'key' } }

      const info = getProviderInfo(runtime)

      expect(info.configured).toContain('groq')
      expect(info.configured).toContain('gemini')
      expect(info.configured).not.toContain('openai')
    })
  })
})
