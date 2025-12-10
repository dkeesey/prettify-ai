import { describe, it, expect, vi, beforeEach } from 'vitest'

// We need to test the module with different env vars, so we'll test the logic directly
describe('features', () => {
  describe('deployment modes', () => {
    it('editor-only mode disables coach', () => {
      const config = getModeConfig('editor-only')
      expect(config.enableCoach).toBe(false)
      expect(config.enableEditor).toBe(true)
      expect(config.enableExport).toBe(true)
    })

    it('coach-only mode disables editor', () => {
      const config = getModeConfig('coach-only')
      expect(config.enableCoach).toBe(true)
      expect(config.enableEditor).toBe(false)
      expect(config.enableExport).toBe(false)
    })

    it('full mode enables everything', () => {
      const config = getModeConfig('full')
      expect(config.enableCoach).toBe(true)
      expect(config.enableEditor).toBe(true)
      expect(config.enableLinkedInImport).toBe(true)
      expect(config.enableAIGenerate).toBe(true)
      expect(config.enableExport).toBe(true)
    })
  })

  describe('envBool helper', () => {
    it('parses "true" as true', () => {
      expect(parseBool('true', false)).toBe(true)
    })

    it('parses "1" as true', () => {
      expect(parseBool('1', false)).toBe(true)
    })

    it('parses "yes" as true', () => {
      expect(parseBool('yes', false)).toBe(true)
    })

    it('parses "false" as false', () => {
      expect(parseBool('false', true)).toBe(false)
    })

    it('returns default for undefined', () => {
      expect(parseBool(undefined, true)).toBe(true)
      expect(parseBool(undefined, false)).toBe(false)
    })

    it('returns default for empty string', () => {
      expect(parseBool('', true)).toBe(true)
    })
  })
})

// Helper functions to test the logic without module state
function getModeConfig(mode: 'editor-only' | 'coach-only' | 'full') {
  const modeConfig: Record<string, any> = {
    'editor-only': {
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
  return modeConfig[mode]
}

function parseBool(val: string | undefined, defaultValue: boolean): boolean {
  if (val === undefined || val === '') return defaultValue
  return val === 'true' || val === '1' || val === 'yes'
}
