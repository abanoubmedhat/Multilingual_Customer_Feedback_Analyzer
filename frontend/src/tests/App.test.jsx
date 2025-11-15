import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

describe('App Component', () => {
  beforeEach(() => {
    // Reset fetch mock
    global.fetch.mockReset()
    global.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => [],
        headers: new Headers(),
      })
    )
  })

  it('renders submit tab by default for non-authenticated users', () => {
    render(<App />)
    expect(screen.getByText(/Share your experience in any language/i)).toBeInTheDocument()
  })

  it('shows admin login button when not authenticated', () => {
    render(<App />)
    expect(screen.getByText(/Admin Login/i)).toBeInTheDocument()
  })

  it('loads dashboard tab when user has valid JWT token', async () => {
    // Create a proper JWT token with valid base64 encoding
    // Header: {"alg":"HS256","typ":"JWT"}
    // Payload: {"sub":"admin","role":"admin","exp":9999999999}
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.signature'
    localStorage.setItem('jwt', mockToken)

    global.fetch.mockImplementation((url) => {
      if (url.includes('/api/products')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: 1, name: 'Test Product' }],
          headers: new Headers(),
        })
      }
      if (url.includes('/api/stats') || url.includes('/api/feedback')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ total: 0, items: [], counts: {}, percentages: {} }),
          headers: new Headers(),
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
        headers: new Headers(),
      })
    })

    render(<App />)
    
    await waitFor(() => {
      expect(screen.getByText(/Dashboard/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('handles login form submission', async () => {
    const user = userEvent.setup()
    
    // Use a valid JWT token
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.signature'
    
    global.fetch.mockImplementation((url) => {
      if (url.includes('/auth/token')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ access_token: mockToken }),
          headers: new Headers(),
        })
      }
      if (url.includes('/api/products')) {
        return Promise.resolve({
          ok: true,
          json: async () => [],
          headers: new Headers(),
        })
      }
      if (url.includes('/api/stats') || url.includes('/api/feedback')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ total: 0, items: [], counts: {}, percentages: {} }),
          headers: new Headers(),
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
        headers: new Headers(),
      })
    })

    render(<App />)
    
    // Click Admin Login button
    const loginBtn = screen.getByText(/Admin Login/i)
    await user.click(loginBtn)

    // Fill in credentials
    await waitFor(() => {
      expect(screen.getByLabelText(/Username/i)).toBeInTheDocument()
    })
    
    await user.type(screen.getByLabelText(/Username/i), 'admin')
    await user.type(screen.getByLabelText(/Password/i), 'password')
    
    // Submit form
    const submitBtn = screen.getByRole('button', { name: /^Login$/i })
    await user.click(submitBtn)

    // Check that token is stored
    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith('jwt', mockToken)
    })
  })

  it('handles login failure with error message', async () => {
    const user = userEvent.setup()
    
    global.fetch.mockImplementation((url) => {
      if (url.includes('/auth/token')) {
        return Promise.resolve({
          ok: false,
          status: 401,
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      })
    })

    render(<App />)
    
    const loginBtn = screen.getByText(/Admin Login/i)
    await user.click(loginBtn)

    await waitFor(() => {
      expect(screen.getByLabelText(/Username/i)).toBeInTheDocument()
    })
    
    await user.type(screen.getByLabelText(/Username/i), 'admin')
    await user.type(screen.getByLabelText(/Password/i), 'wrongpassword')
    
    const submitBtn = screen.getByRole('button', { name: /^Login$/i })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/Invalid credentials/i)).toBeInTheDocument()
    })
  })

  it('handles logout correctly', async () => {
    const user = userEvent.setup()
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.signature'
    localStorage.setItem('jwt', mockToken)

    global.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => [],
        headers: new Headers(),
      })
    )

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/Logout/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    const logoutBtn = screen.getByText(/Logout/i)
    await user.click(logoutBtn)

    expect(localStorage.removeItem).toHaveBeenCalledWith('jwt')
  })

  it('switches between tabs correctly', async () => {
    const user = userEvent.setup()
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.signature'
    localStorage.setItem('jwt', mockToken)

    global.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => [],
        headers: new Headers(),
      })
    )

    render(<App />)

    // Wait for app to load with token
    await waitFor(() => {
      expect(screen.getByText(/Dashboard/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    // Switch to Submit tab
    const submitTab = screen.getByRole('button', { name: /Submit Feedback/i })
    await user.click(submitTab)

    await waitFor(() => {
      expect(screen.getByText(/Share your experience/i)).toBeInTheDocument()
    })

    // Switch to Settings tab
    const settingsTab = screen.getByRole('button', { name: /Settings/i })
    await user.click(settingsTab)

    await waitFor(() => {
      expect(screen.getByText(/Manage Products/i)).toBeInTheDocument()
    })
  })

  it('displays session expired message on token expiration', async () => {
    render(<App />)

    // Wait for app to render
    await waitFor(() => {
      expect(screen.getByText(/Submit Feedback/i)).toBeInTheDocument()
    })

    // Simulate auto-logout event
    window.dispatchEvent(
      new CustomEvent('auth:logout', { 
        detail: { reason: 'Token expired' } 
      })
    )

    await waitFor(() => {
      expect(screen.getByText(/session has expired/i)).toBeInTheDocument()
    })
  })
})
