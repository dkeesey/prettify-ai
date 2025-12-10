/**
 * Feature Flags Configuration
 *
 * Control which features are enabled in the application.
 * Can be overridden via environment variables (PUBLIC_ prefix for client-side access)
 *
 * Deployment Modes:
 * - "editor-only": Just the paste/format/export functionality (prettify-ai.com MVP)
 * - "coach-only": Just the chat coach (resumecoach.co focused)
 * - "full": Both coach and editor with integrated flow (default)
 */

export type DeploymentMode = 'editor-only' | 'coach-only' | 'full' | 'landing'

export interface FeatureFlags {
  // Core deployment mode
  mode: DeploymentMode

  // Individual feature toggles (for finer control)
  enableCoach: boolean          // Show chat coach interface
  enableEditor: boolean         // Show editor interface
  enableLinkedInImport: boolean // LinkedIn import in editor
  enableAIGenerate: boolean     // AI resume generation in editor
  enableExport: boolean         // PDF/DOCX export

  // Future features
  enableAuth: boolean           // User authentication (Phase 2)
  enablePersistence: boolean    // Cloud persistence (Phase 2)
  enablePro: boolean            // Pro tier features (Phase 3)
}

/**
 * Get deployment mode from environment
 */
function getDeploymentMode(): DeploymentMode {
  const envMode = import.meta.env.PUBLIC_DEPLOYMENT_MODE
  if (envMode === 'editor-only' || envMode === 'coach-only' || envMode === 'full' || envMode === 'landing') {
    return envMode
  }
  return 'landing' // Default for prettify-ai.com - shows landing page with editor only
}

/**
 * Parse boolean env var (handles "true", "1", "yes")
 */
function envBool(key: string, defaultValue: boolean): boolean {
  const val = import.meta.env[key]
  if (val === undefined || val === '') return defaultValue
  return val === 'true' || val === '1' || val === 'yes'
}

/**
 * Build feature flags from environment variables and deployment mode
 */
function buildFeatureFlags(): FeatureFlags {
  const mode = getDeploymentMode()

  // Base configuration from mode
  const modeConfig: Record<DeploymentMode, Partial<FeatureFlags>> = {
    'editor-only': {
      enableCoach: false,
      enableEditor: true,
      enableLinkedInImport: false,
      enableAIGenerate: false,
      enableExport: true,
    },
    'landing': {
      // Shows landing page with editor card only (no coach)
      enableCoach: false,
      enableEditor: true,
      enableLinkedInImport: false,
      enableAIGenerate: false,
      enableExport: true,
    },
    'coach-only': {
      enableCoach: true,
      enableEditor: false,
      enableLinkedInImport: false,
      enableAIGenerate: false,
      enableExport: false,
    },
    'full': {
      enableCoach: true,
      enableEditor: true,
      enableLinkedInImport: true,
      enableAIGenerate: true,
      enableExport: true,
    },
  }

  const baseConfig = modeConfig[mode]

  // Allow individual overrides via env vars
  return {
    mode,
    enableCoach: envBool('PUBLIC_ENABLE_COACH', baseConfig.enableCoach ?? true),
    enableEditor: envBool('PUBLIC_ENABLE_EDITOR', baseConfig.enableEditor ?? true),
    enableLinkedInImport: envBool('PUBLIC_ENABLE_LINKEDIN', baseConfig.enableLinkedInImport ?? true),
    enableAIGenerate: envBool('PUBLIC_ENABLE_AI_GENERATE', baseConfig.enableAIGenerate ?? true),
    enableExport: envBool('PUBLIC_ENABLE_EXPORT', baseConfig.enableExport ?? true),
    enableAuth: envBool('PUBLIC_ENABLE_AUTH', false),
    enablePersistence: envBool('PUBLIC_ENABLE_PERSISTENCE', false),
    enablePro: envBool('PUBLIC_ENABLE_PRO', false),
  }
}

// Singleton instance
let _flags: FeatureFlags | null = null

/**
 * Get current feature flags (cached)
 */
export function getFeatureFlags(): FeatureFlags {
  if (!_flags) {
    _flags = buildFeatureFlags()
  }
  return _flags
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(feature: keyof Omit<FeatureFlags, 'mode'>): boolean {
  return getFeatureFlags()[feature]
}

/**
 * Get current deployment mode
 */
export function getMode(): DeploymentMode {
  return getFeatureFlags().mode
}

// Convenience exports for common checks
export const features = {
  get coach() { return isFeatureEnabled('enableCoach') },
  get editor() { return isFeatureEnabled('enableEditor') },
  get linkedIn() { return isFeatureEnabled('enableLinkedInImport') },
  get aiGenerate() { return isFeatureEnabled('enableAIGenerate') },
  get export() { return isFeatureEnabled('enableExport') },
  get auth() { return isFeatureEnabled('enableAuth') },
  get persistence() { return isFeatureEnabled('enablePersistence') },
  get pro() { return isFeatureEnabled('enablePro') },
  get mode() { return getMode() },
}
