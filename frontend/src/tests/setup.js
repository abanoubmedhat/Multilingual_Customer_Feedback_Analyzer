import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock

// Mock window APIs
global.dispatchEvent = vi.fn()
global.CustomEvent = class CustomEvent extends Event {
  constructor(event, params) {
    super(event, params)
    this.detail = params?.detail
  }
}

// Mock fetch
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: async () => ({}),
    headers: new Headers(),
  })
)

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
  global.fetch.mockClear()
  localStorageMock.getItem.mockReturnValue(null)
  localStorageMock.setItem.mockClear()
  localStorageMock.removeItem.mockClear()
  localStorageMock.clear.mockClear()
})
