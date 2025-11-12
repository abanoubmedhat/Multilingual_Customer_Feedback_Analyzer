/**
 * Enhanced fetch wrapper that handles:
 * 1. Automatic token refresh when server sends X-New-Token header
 * 2. Automatic logout on 401 errors (token expired)
 * 3. Token management in localStorage
 */

export async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('jwt');
  
  // Add Authorization header if token exists
  const headers = {
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  // Check for refreshed token in response headers
  const newToken = response.headers.get('X-New-Token');
  if (newToken) {
    console.log('🔄 Token refreshed automatically');
    localStorage.setItem('jwt', newToken);
    // Dispatch custom event so components can update their token state
    window.dispatchEvent(new CustomEvent('token:refreshed', { detail: { token: newToken } }));
  }

  // Handle 401 Unauthorized - token expired or invalid
  if (response.status === 401) {
    console.log('🚪 Token expired - triggering auto logout');
    // Clear token and dispatch logout event
    localStorage.removeItem('jwt');
    window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: 'Token expired' } }));
  }

  return response;
}

// Helper to check if user is authenticated
export function isAuthenticated() {
  return !!localStorage.getItem('jwt');
}

// Helper to get current token
export function getToken() {
  return localStorage.getItem('jwt');
}

// Helper to clear authentication
export function clearAuth() {
  localStorage.removeItem('jwt');
}
