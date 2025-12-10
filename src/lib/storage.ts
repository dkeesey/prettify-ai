/**
 * localStorage keys used by the application
 */
export const STORAGE_KEYS = {
  // Editor
  EDITOR_CONTENT: 'prettify_editor_content',
  THEME: 'prettify_theme',
  RESUME_STYLE: 'prettify_resume_style',
  // Chat
  CHAT_MESSAGES: 'prettify_chat_messages',
  GENERATED_RESUME: 'prettify_generated_resume',
} as const

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS]

/**
 * Safely get a value from localStorage (SSR-safe)
 * Returns defaultValue if:
 * - Running on server (no window)
 * - Key doesn't exist
 * - JSON parsing fails
 */
export function getStoredValue<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : defaultValue
  } catch {
    return defaultValue
  }
}

/**
 * Safely set a value in localStorage (SSR-safe)
 * Silently fails if:
 * - Running on server
 * - localStorage is full
 * - JSON serialization fails
 */
export function setStoredValue(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('Failed to save to localStorage:', e)
  }
}

/**
 * Remove a value from localStorage (SSR-safe)
 */
export function removeStoredValue(key: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(key)
  } catch (e) {
    console.warn('Failed to remove from localStorage:', e)
  }
}

/**
 * Clear all prettify-related data from localStorage
 */
export function clearAllStoredData(): void {
  if (typeof window === 'undefined') return
  Object.values(STORAGE_KEYS).forEach(key => {
    try {
      localStorage.removeItem(key)
    } catch (e) {
      console.warn('Failed to clear localStorage:', e)
    }
  })
}
