/**
 * Token Usage Tracker
 *
 * Tracks daily token usage for Cloudflare free tier management.
 * Cloudflare gives 10,000 Neurons/day free.
 *
 * This is an in-memory tracker that resets on worker restart.
 * For production persistence, use Cloudflare KV.
 */

interface DailyUsage {
  date: string           // YYYY-MM-DD
  neurons: number        // Cloudflare neurons consumed
  inputTokens: number    // Total input tokens across all providers
  outputTokens: number   // Total output tokens across all providers
  requests: number       // Total API calls
  byProvider: Record<string, { input: number; output: number; requests: number }>
}

// In-memory store
let dailyUsage: DailyUsage = createEmptyUsage()

function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

function createEmptyUsage(): DailyUsage {
  return {
    date: getTodayString(),
    neurons: 0,
    inputTokens: 0,
    outputTokens: 0,
    requests: 0,
    byProvider: {},
  }
}

/**
 * Get current daily usage, resetting if it's a new day
 */
export function getDailyUsage(): DailyUsage {
  const today = getTodayString()
  if (dailyUsage.date !== today) {
    dailyUsage = createEmptyUsage()
  }
  return dailyUsage
}

/**
 * Record token usage for a request
 */
export function recordUsage(
  provider: string,
  inputTokens: number,
  outputTokens: number,
  neurons?: number
): void {
  const usage = getDailyUsage()

  usage.inputTokens += inputTokens
  usage.outputTokens += outputTokens
  usage.requests += 1

  if (neurons) {
    usage.neurons += neurons
  }

  // Track by provider
  if (!usage.byProvider[provider]) {
    usage.byProvider[provider] = { input: 0, output: 0, requests: 0 }
  }
  usage.byProvider[provider].input += inputTokens
  usage.byProvider[provider].output += outputTokens
  usage.byProvider[provider].requests += 1
}

/**
 * Estimate neurons from tokens for Cloudflare
 * This is approximate - actual neuron cost varies by model
 * Llama 3.1 70B: ~1 neuron per 10 tokens (rough estimate)
 */
export function estimateNeurons(inputTokens: number, outputTokens: number): number {
  // Output tokens cost more than input
  return Math.ceil((inputTokens / 10) + (outputTokens / 5))
}

/**
 * Check if Cloudflare free tier is exhausted
 * Free tier: 10,000 neurons/day
 * Switch at 75% to avoid hitting the wall
 */
export function isCloudflareFreeTierExhausted(): boolean {
  const usage = getDailyUsage()
  const FREE_TIER_LIMIT = 10000
  const SWITCH_THRESHOLD = 0.75 // Switch at 75% usage
  return usage.neurons >= (FREE_TIER_LIMIT * SWITCH_THRESHOLD)
}

/**
 * Get remaining Cloudflare free tier neurons
 */
export function getRemainingFreeNeurons(): number {
  const usage = getDailyUsage()
  const FREE_TIER_LIMIT = 10000
  return Math.max(0, FREE_TIER_LIMIT - usage.neurons)
}

/**
 * Get usage summary for logging/debugging
 */
export function getUsageSummary(): {
  date: string
  totalRequests: number
  totalTokens: { input: number; output: number }
  cloudflareNeurons: { used: number; remaining: number; exhausted: boolean }
  byProvider: Record<string, { input: number; output: number; requests: number }>
} {
  const usage = getDailyUsage()
  return {
    date: usage.date,
    totalRequests: usage.requests,
    totalTokens: { input: usage.inputTokens, output: usage.outputTokens },
    cloudflareNeurons: {
      used: usage.neurons,
      remaining: getRemainingFreeNeurons(),
      exhausted: isCloudflareFreeTierExhausted(),
    },
    byProvider: usage.byProvider,
  }
}

/**
 * Reset usage (for testing)
 */
export function resetUsage(): void {
  dailyUsage = createEmptyUsage()
}
