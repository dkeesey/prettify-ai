import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/dom'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}

vi.stubGlobal('localStorage', localStorageMock)

// Mock fetch
vi.stubGlobal('fetch', vi.fn())

// Reset mocks between tests
afterEach(() => {
  vi.clearAllMocks()
  localStorageMock.getItem.mockReset()
  localStorageMock.setItem.mockReset()
  localStorageMock.removeItem.mockReset()
})
