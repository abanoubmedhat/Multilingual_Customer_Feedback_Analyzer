import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchWithAuth } from '../utils/fetchWithAuth'

describe('fetchWithAuth Utility', () => {
  beforeEach(() => {
    // Reset localStorage
    localStorage.getItem.mockReturnValue(null)
    localStorage.setItem.mockClear()
    localStorage.removeItem.mockClear()
    
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
    
    // Headers object has .get() method
    expect(headers).toBeInstanceOf(Headers)
    expect(headers.get('Authorization')).toBe('Bearer test-token')
  })

  it('refreshes token when X-New-Token header is present', async () => {
    localStorage.setItem('jwt', 'old-token')
    
    const headers = new Headers()
    headers.set('X-New-Token', 'new-token')
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: 'test' }),
      headers,
    })
    
    await fetchWithAuth('/api/test')
    
    expect(localStorage.setItem).toHaveBeenCalledWith('jwt', 'new-token')
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

  it('merges custom headers with auth header', async () => {
    localStorage.setItem('jwt', 'test-token')
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: 'test' }),
      headers: new Headers(),
    })
    
    await fetchWithAuth('/api/test', {
      headers: { 'Content-Type': 'application/json' },
    })
    
    // Get the headers from the actual call
    const callArgs = global.fetch.mock.calls[0]
    const headers = callArgs[1]?.headers
    
    // Headers object has .get() method
    expect(headers).toBeInstanceOf(Headers)
    expect(headers.get('Authorization')).toBe('Bearer test-token')
    expect(headers.get('Content-Type')).toBe('application/json')
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
    expect(headers.get('Authorization')).toBeNull()
  })
})
