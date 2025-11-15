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

})
