import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getStoredValue,
  setStoredValue,
  removeStoredValue,
  clearAllStoredData,
  STORAGE_KEYS,
} from './storage'

describe('storage helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getStoredValue', () => {
    it('returns parsed value when key exists', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ foo: 'bar' }))

      const result = getStoredValue('test-key', null)

      expect(localStorage.getItem).toHaveBeenCalledWith('test-key')
      expect(result).toEqual({ foo: 'bar' })
    })

    it('returns default value when key does not exist', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null)

      const result = getStoredValue('missing-key', 'default')

      expect(result).toBe('default')
    })

    it('returns default value when JSON parsing fails', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('not valid json {{{')

      const result = getStoredValue('bad-json', 'fallback')

      expect(result).toBe('fallback')
    })

    it('handles string values', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('"stored string"')

      const result = getStoredValue('string-key', '')

      expect(result).toBe('stored string')
    })

    it('handles array values', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('[1, 2, 3]')

      const result = getStoredValue<number[]>('array-key', [])

      expect(result).toEqual([1, 2, 3])
    })

    it('handles boolean values', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('true')

      const result = getStoredValue('bool-key', false)

      expect(result).toBe(true)
    })
  })

  describe('setStoredValue', () => {
    it('stores JSON stringified value', () => {
      setStoredValue('test-key', { foo: 'bar' })

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify({ foo: 'bar' })
      )
    })

    it('stores string values', () => {
      setStoredValue('string-key', 'hello')

      expect(localStorage.setItem).toHaveBeenCalledWith('string-key', '"hello"')
    })

    it('stores array values', () => {
      setStoredValue('array-key', [1, 2, 3])

      expect(localStorage.setItem).toHaveBeenCalledWith('array-key', '[1,2,3]')
    })

    it('handles storage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

      // Should not throw
      expect(() => setStoredValue('key', 'value')).not.toThrow()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('removeStoredValue', () => {
    it('removes the key from localStorage', () => {
      removeStoredValue('test-key')

      expect(localStorage.removeItem).toHaveBeenCalledWith('test-key')
    })

    it('handles errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.mocked(localStorage.removeItem).mockImplementation(() => {
        throw new Error('Storage error')
      })

      expect(() => removeStoredValue('key')).not.toThrow()

      consoleSpy.mockRestore()
    })
  })

  describe('clearAllStoredData', () => {
    it('removes all prettify keys', () => {
      clearAllStoredData()

      const allKeys = Object.values(STORAGE_KEYS)
      expect(localStorage.removeItem).toHaveBeenCalledTimes(allKeys.length)

      allKeys.forEach(key => {
        expect(localStorage.removeItem).toHaveBeenCalledWith(key)
      })
    })
  })

  describe('STORAGE_KEYS', () => {
    it('has all expected keys', () => {
      expect(STORAGE_KEYS.EDITOR_CONTENT).toBe('prettify_editor_content')
      expect(STORAGE_KEYS.THEME).toBe('prettify_theme')
      expect(STORAGE_KEYS.RESUME_STYLE).toBe('prettify_resume_style')
      expect(STORAGE_KEYS.CHAT_MESSAGES).toBe('prettify_chat_messages')
      expect(STORAGE_KEYS.GENERATED_RESUME).toBe('prettify_generated_resume')
    })

    it('all keys have prettify prefix', () => {
      Object.values(STORAGE_KEYS).forEach(key => {
        expect(key).toMatch(/^prettify_/)
      })
    })
  })
})
