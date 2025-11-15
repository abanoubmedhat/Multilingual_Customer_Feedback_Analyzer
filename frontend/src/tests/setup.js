import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock localStorage with actual storage
const storage = {}
const localStorageMock = {
  getItem: vi.fn((key) => storage[key] || null),
  setItem: vi.fn((key, value) => {
    storage[key] = value
  }),
  removeItem: vi.fn((key) => {
    delete storage[key]
  }),
  clear: vi.fn(() => {
    Object.keys(storage).forEach(key => delete storage[key])
  }),
}
global.localStorage = localStorageMock

// Reset storage before each test
beforeEach(() => {
  Object.keys(storage).forEach(key => delete storage[key])
  localStorageMock.getItem.mockClear()
  localStorageMock.setItem.mockClear()
  localStorageMock.removeItem.mockClear()
  localStorageMock.clear.mockClear()
})

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
