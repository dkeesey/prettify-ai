/**
 * AI Provider Configuration
 *
 * Supports multiple LLM providers with environment-based switching
 * and automatic fallback when free tiers are exhausted.
 *
 * Providers:
 * - cloudflare: Cloudflare Workers AI (10K neurons/day free) - default first choice
 * - groq: Groq API with Llama models (cheapest for volume)
 * - gemini: Google Gemini API (generous free tier)
 * - openai: OpenAI API (most capable, most expensive)
 * - anthropic: Anthropic Claude API (great quality, moderate cost)
 *
 * Strategies:
 * - "single": Use one provider (set via AI_PROVIDER)
 * - "free-first": Use Cloudflare free tier, fall back to Groq/Gemini
 * - "cheapest": Always use cheapest available provider
 */

import { isCloudflareFreeTierExhausted } from './token-tracker'

export type AIProvider = 'groq' | 'cloudflare' | 'gemini' | 'openai' | 'anthropic'
export type AIStrategy = 'single' | 'free-first' | 'cheapest'

export interface AIProviderConfig {
  provider: AIProvider
  model: string
  endpoint: string
  isCloudflareBinding?: boolean
}

interface ProviderDefaults {
  model: string
  endpoint: string
  envKey: string
  isCloudflareBinding?: boolean
}

const PROVIDER_DEFAULTS: Record<AIProvider, ProviderDefaults> = {
  cloudflare: {
    model: '@cf/meta/llama-3.1-70b-instruct',
    endpoint: '', // Uses binding, not HTTP endpoint
    envKey: '', // Uses AI binding
    isCloudflareBinding: true,
  },
  groq: {
    model: 'llama-3.3-70b-versatile',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    envKey: 'GROQ_API_KEY',
  },
  gemini: {
    model: 'gemini-1.5-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    envKey: 'GEMINI_API_KEY',
  },
  openai: {
    model: 'gpt-4o-mini',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    envKey: 'OPENAI_API_KEY',
  },
  anthropic: {
    model: 'claude-3-haiku-20240307',
    endpoint: 'https://api.anthropic.com/v1/messages',
    envKey: 'ANTHROPIC_API_KEY',
  },
}

// Fallback order when free tier is exhausted
const FALLBACK_ORDER: AIProvider[] = ['groq', 'gemini']

/**
 * Get AI strategy from environment
 */
export function getAIStrategy(): AIStrategy {
  const strategy = process.env.AI_STRATEGY || import.meta.env.AI_STRATEGY || 'free-first'
  if (strategy === 'single' || strategy === 'free-first' || strategy === 'cheapest') {
    return strategy
  }
  return 'free-first'
}

/**
 * Get primary AI provider from environment
 */
export function getPrimaryProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER || import.meta.env.AI_PROVIDER
  if (provider && provider in PROVIDER_DEFAULTS) {
    return provider as AIProvider
  }
  // Default based on strategy
  const strategy = getAIStrategy()
  return strategy === 'free-first' ? 'cloudflare' : 'groq'
}

/**
 * Get model override from environment
 */
export function getModelOverride(): string | undefined {
  return process.env.AI_MODEL || import.meta.env.AI_MODEL || undefined
}

/**
 * Check if a provider's API key is configured
 */
export function isProviderConfigured(provider: AIProvider, runtime?: any): boolean {
  if (provider === 'cloudflare') {
    return !!runtime?.env?.AI
  }
  const envKey = PROVIDER_DEFAULTS[provider].envKey
  return !!(
    runtime?.env?.[envKey] ||
    process.env[envKey] ||
    import.meta.env[envKey]
  )
}

/**
 * Get the best available provider based on strategy and availability
 */
export function selectProvider(runtime?: any): AIProvider {
  const strategy = getAIStrategy()
  const primary = getPrimaryProvider()

  if (strategy === 'single') {
    return primary
  }

  if (strategy === 'free-first') {
    // Try Cloudflare first if free tier not exhausted
    if (
      isProviderConfigured('cloudflare', runtime) &&
      !isCloudflareFreeTierExhausted()
    ) {
      return 'cloudflare'
    }

    // Fall back to other providers
    for (const fallback of FALLBACK_ORDER) {
      if (isProviderConfigured(fallback, runtime)) {
        return fallback
      }
    }

    // Last resort - try primary even if it might fail
    return primary
  }

  if (strategy === 'cheapest') {
    // Order: Groq, Gemini, Cloudflare, OpenAI, Anthropic
    const cheapestOrder: AIProvider[] = ['groq', 'gemini', 'cloudflare', 'openai', 'anthropic']
    for (const provider of cheapestOrder) {
      if (isProviderConfigured(provider, runtime)) {
        return provider
      }
    }
  }

  return primary
}

/**
 * Get full provider configuration with automatic fallback
 */
export function getAIConfig(runtime?: any): AIProviderConfig {
  const provider = selectProvider(runtime)
  const defaults = PROVIDER_DEFAULTS[provider]
  const modelOverride = getModelOverride()

  return {
    provider,
    model: modelOverride || defaults.model,
    endpoint: defaults.endpoint,
    isCloudflareBinding: defaults.isCloudflareBinding,
  }
}

/**
 * Get API key for a specific provider
 */
export function getAPIKey(runtime: any, provider?: AIProvider): string | undefined {
  const targetProvider = provider || selectProvider(runtime)
  const envKey = PROVIDER_DEFAULTS[targetProvider].envKey

  if (!envKey) return undefined // Cloudflare uses binding

  return runtime?.env?.[envKey] ||
         process.env[envKey] ||
         import.meta.env[envKey]
}

/**
 * Provider-specific pricing info (per million tokens)
 */
export const PROVIDER_PRICING: Record<AIProvider, { input: number; output: number }> = {
  cloudflare: { input: 0.29, output: 2.25 },
  groq: { input: 0.59, output: 0.79 },
  gemini: { input: 0.075, output: 0.30 }, // Gemini 1.5 Flash
  openai: { input: 0.15, output: 0.60 }, // gpt-4o-mini
  anthropic: { input: 0.25, output: 1.25 }, // claude-3-haiku
}

/**
 * Get provider info for logging
 */
export function getProviderInfo(runtime?: any): {
  strategy: AIStrategy
  primary: AIProvider
  selected: AIProvider
  configured: AIProvider[]
  cloudflareExhausted: boolean
} {
  const allProviders: AIProvider[] = ['cloudflare', 'groq', 'gemini', 'openai', 'anthropic']
  return {
    strategy: getAIStrategy(),
    primary: getPrimaryProvider(),
    selected: selectProvider(runtime),
    configured: allProviders.filter(p => isProviderConfigured(p, runtime)),
    cloudflareExhausted: isCloudflareFreeTierExhausted(),
  }
}
