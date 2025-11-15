import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchWithAuth, isAuthenticated, getToken, clearAuth } from '../utils/fetchWithAuth'

describe('fetchWithAuth Utility', () => {
  beforeEach(() => {
    // Reset fetch mock
    global.fetch = vi.fn()
    global.fetch.mockReset()
    global.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ data: 'test' }),
        headers: new Headers(),
        status: 200,
      })
    )
    // Mock localStorage
    global.localStorage = {
      store: {},
      getItem(key) { return this.store[key] || null },
      setItem(key, value) { this.store[key] = value },
      removeItem(key) { delete this.store[key] },
      clear() { this.store = {} }
    }
    // Reset window.dispatchEvent spy
    vi.restoreAllMocks()
  })

  // Helper to read a header value from either a Headers instance or plain object
  function readHeader(headers, key) {
    if (!headers) return null
    if (typeof Headers !== 'undefined' && headers instanceof Headers) {
      return headers.get(key)
    }
    // Try common casings when headers is a plain object
    return headers[key] ?? headers[key.toLowerCase()] ?? headers[key.toUpperCase()] ?? null
  }

  it('dispatches logout event on 401 error', async () => {
    localStorage.setItem('jwt', 'test-token')
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers(),
    })
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const response = await fetchWithAuth('/api/test')
    expect(response.status).toBe(401)
    expect(localStorage.getItem('jwt')).toBeNull()
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'auth:logout' })
    )
  })

  it('works without token (unauthenticated requests)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: 'test' }),
      headers: new Headers(),
      status: 200,
    })
    await fetchWithAuth('/api/public')
    expect(global.fetch).toHaveBeenCalled()
    const callArgs = global.fetch.mock.calls[0]
    const headers = callArgs[1]?.headers
    // Should not include Authorization header
    if (headers instanceof Headers) {
      expect(headers.get('Authorization')).toBeNull()
    } else {
      expect(headers['Authorization']).toBeUndefined()
    }
  })

  it('sets Authorization header when token exists', async () => {
    localStorage.setItem('jwt', 'test-token')
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: 'test' }),
      headers: new Headers(),
      status: 200,
    })
    await fetchWithAuth('/api/protected')
    const callArgs = global.fetch.mock.calls[0]
    const headers = callArgs[1]?.headers
    if (headers instanceof Headers) {
      expect(headers.get('Authorization')).toBe('Bearer test-token')
    } else {
      expect(headers['Authorization']).toBe('Bearer test-token')
    }
  })

  it('handles token refresh from X-New-Token header', async () => {
    localStorage.setItem('jwt', 'old-token')
    const newToken = 'new-token-123'
    const headers = new Headers()
    headers.set('X-New-Token', newToken)
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers,
    })
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    await fetchWithAuth('/api/refresh')
    expect(localStorage.getItem('jwt')).toBe(newToken)
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'token:refreshed' })
    )
  })

  it('prepends API_BASE_URL if url does not start with http', async () => {
    localStorage.setItem('jwt', 'test-token')
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
    })
    // Simulate VITE_API_URL and import fresh module so the module-level constant picks it up
    const originalEnv = import.meta.env.VITE_API_URL
    import.meta.env.VITE_API_URL = 'http://localhost:8000'

    // Clear module cache and import a fresh copy so API_BASE_URL is re-evaluated
    vi.resetModules()
    const mod = await import('../utils/fetchWithAuth')
    await mod.fetchWithAuth('/api/test')

    const callArgs = global.fetch.mock.calls[0]
    expect(callArgs[0]).toBe('http://localhost:8000/api/test')

    // Restore environment and module cache
    import.meta.env.VITE_API_URL = originalEnv
    vi.resetModules()
  })

  // Helper function tests
  it('isAuthenticated returns true when token exists', () => {
    localStorage.setItem('jwt', 'token')
    expect(isAuthenticated()).toBe(true)
  })

  it('isAuthenticated returns false when token does not exist', () => {
    localStorage.removeItem('jwt')
    expect(isAuthenticated()).toBe(false)
  })

  it('getToken returns the token value', () => {
    localStorage.setItem('jwt', 'token123')
    expect(getToken()).toBe('token123')
  })

  it('clearAuth removes the token', () => {
    localStorage.setItem('jwt', 'token123')
    clearAuth()
    expect(localStorage.getItem('jwt')).toBeNull()
  })
})
