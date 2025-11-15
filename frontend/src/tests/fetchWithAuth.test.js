import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchWithAuth } from '../utils/fetchWithAuth'

describe('fetchWithAuth Utility', () => {
  beforeEach(() => {
    // Reset fetch mock
    global.fetch.mockReset()
    global.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ data: 'test' }),
        headers: new Headers(),
      })
    )
    
    // Reset window.dispatchEvent spy
    global.dispatchEvent.mockClear()
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

  it('includes Authorization header when token exists', async () => {
    localStorage.setItem('jwt', 'test-token')
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: 'test' }),
      headers: new Headers(),
    })
    
    await fetchWithAuth('/api/test')
    
    // Check that fetch was called
    expect(global.fetch).toHaveBeenCalled()
    
    // Get the headers from the actual call
    const callArgs = global.fetch.mock.calls[0]
    const headers = callArgs[1]?.headers
    const auth = readHeader(headers, 'Authorization')
    
    // Assert the Authorization header exists and starts with Bearer
    expect(auth).toBeTruthy()
    expect(auth).toMatch(/^Bearer\s.+/)
  })

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
    expect(localStorage.removeItem).toHaveBeenCalledWith('jwt')
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'auth:logout',
      })
    )
  })

  it('works without token (unauthenticated requests)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: 'test' }),
      headers: new Headers(),
    })
    
    await fetchWithAuth('/api/public')
    
    expect(global.fetch).toHaveBeenCalled()
    
    // Get the headers from the actual call
    const callArgs = global.fetch.mock.calls[0]
    const headers = callArgs[1]?.headers
    
    // Should not include Authorization header
    const auth = readHeader(headers, 'Authorization')
    expect(auth).toBeNull()
  })
})
