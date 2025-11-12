import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dashboard from '../pages/Dashboard'

describe('Dashboard Component', () => {
  const mockToken = 'test-token'

  beforeEach(() => {
    // Reset fetch mock
    global.fetch.mockReset()
    global.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ total: 0, items: [], counts: {}, percentages: {} }),
        headers: new Headers(),
      })
    )
  })

  const setupMockFetch = (statsData, feedbackData) => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/api/stats')) {
        return Promise.resolve({
          ok: true,
          json: async () => statsData,
          headers: new Headers(),
        })
      }
      if (url.includes('/api/feedback')) {
        return Promise.resolve({
          ok: true,
          json: async () => feedbackData,
          headers: new Headers(),
        })
      }
      return Promise.resolve({
        ok: false,
      })
    })
  }

  it('renders loading state initially', () => {
    setupMockFetch({}, { total: 0, items: [] })
    render(<Dashboard token={mockToken} />)
    
    expect(screen.getByText(/Loading stats/i)).toBeInTheDocument()
  })

  it('displays sentiment statistics correctly', async () => {
    const mockStats = {
      total: 100,
      counts: { positive: 60, neutral: 30, negative: 10 },
      percentages: { positive: 60, neutral: 30, negative: 10 },
    }
    
    setupMockFetch(mockStats, { total: 100, items: [] })
    render(<Dashboard token={mockToken} />)
    
    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument() // Total count
      expect(screen.getByText('60')).toBeInTheDocument() // Positive count
      expect(screen.getByText('30')).toBeInTheDocument() // Neutral count
      expect(screen.getByText('10')).toBeInTheDocument() // Negative count
    })
  })

  it('displays empty state when no feedback exists', async () => {
    const mockStats = {
      total: 0,
      counts: {},
      percentages: {},
    }
    
    setupMockFetch(mockStats, { total: 0, items: [] })
    render(<Dashboard token={mockToken} />)
    
    await waitFor(() => {
      expect(screen.getByText(/No feedback yet/i)).toBeInTheDocument()
    })
  })

  it('renders feedback list with pagination', async () => {
    const mockStats = {
      total: 20,
      counts: { positive: 20 },
      percentages: { positive: 100 },
    }
    
    const mockFeedback = {
      total: 20,
      items: [
        {
          id: 1,
          original_text: 'Great product!',
          translated_text: 'Great product!',
          sentiment: 'positive',
          language: 'en',
          product: 'Product A',
        },
        {
          id: 2,
          original_text: 'Not bad',
          translated_text: 'Not bad',
          sentiment: 'neutral',
          language: 'en',
          product: 'Product B',
        },
      ],
      skip: 0,
      limit: 5,
    }
    
    setupMockFetch(mockStats, mockFeedback)
    render(<Dashboard token={mockToken} />)
    
    await waitFor(() => {
      expect(screen.getByText('Great product!')).toBeInTheDocument()
      expect(screen.getByText('Not bad')).toBeInTheDocument()
    })
  })

  it('filters feedback by product', async () => {
    const user = userEvent.setup()
    
    const mockStats = {
      total: 5,
      counts: { positive: 5 },
      percentages: { positive: 100 },
    }
    
    const mockFeedback = {
      total: 5,
      items: [
        {
          id: 1,
          original_text: 'Test feedback',
          translated_text: 'Test feedback',
          sentiment: 'positive',
          language: 'en',
          product: 'Product A',
        },
      ],
      skip: 0,
      limit: 5,
    }
    
    setupMockFetch(mockStats, mockFeedback)
    render(<Dashboard token={mockToken} />)
    
    await waitFor(() => {
      expect(screen.getByLabelText(/Product:/i)).toBeInTheDocument()
    })
    
    // Select product filter
    const productFilter = screen.getByLabelText(/Product:/i)
    await user.selectOptions(productFilter, 'Product A')
    
    // Verify fetch was called with product parameter
    await waitFor(() => {
      const calls = global.fetch.mock.calls
      const feedbackCalls = calls.filter(call => call[0].includes('/api/feedback'))
      expect(feedbackCalls.some(call => call[0].includes('product=Product'))).toBe(true)
    })
  })

  it('handles pagination controls', async () => {
    const user = userEvent.setup()
    
    const mockStats = {
      total: 20,
      counts: { positive: 20 },
      percentages: { positive: 100 },
    }
    
    const mockFeedback = {
      total: 20,
      items: Array(5).fill(null).map((_, i) => ({
        id: i + 1,
        original_text: `Feedback ${i + 1}`,
        translated_text: `Feedback ${i + 1}`,
        sentiment: 'positive',
        language: 'en',
        product: 'Product A',
      })),
      skip: 0,
      limit: 5,
    }
    
    setupMockFetch(mockStats, mockFeedback)
    render(<Dashboard token={mockToken} />)
    
    await waitFor(() => {
      expect(screen.getByText(/Page 1 of/i)).toBeInTheDocument()
    })
    
    // Next button should be enabled
    const nextBtn = screen.getByRole('button', { name: /Next/i })
    expect(nextBtn).not.toBeDisabled()
    
    // Prev button should be disabled on first page
    const prevBtn = screen.getByRole('button', { name: /Prev/i })
    expect(prevBtn).toBeDisabled()
  })

  it('changes page size', async () => {
    const user = userEvent.setup()
    
    const mockStats = {
      total: 50,
      counts: { positive: 50 },
      percentages: { positive: 100 },
    }
    
    const mockFeedback = {
      total: 50,
      items: [],
      skip: 0,
      limit: 5,
    }
    
    setupMockFetch(mockStats, mockFeedback)
    render(<Dashboard token={mockToken} />)
    
    await waitFor(() => {
      expect(screen.getByLabelText(/Per page:/i)).toBeInTheDocument()
    })
    
    const pageSizeSelect = screen.getByLabelText(/Per page:/i)
    await user.selectOptions(pageSizeSelect, '10')
    
    // Verify fetch was called with new limit
    await waitFor(() => {
      const calls = global.fetch.mock.calls
      const feedbackCalls = calls.filter(call => call[0].includes('/api/feedback'))
      expect(feedbackCalls.some(call => call[0].includes('limit=10'))).toBe(true)
    })
  })

  it('handles delete single feedback', async () => {
    const user = userEvent.setup()
    
    const mockStats = {
      total: 1,
      counts: { positive: 1 },
      percentages: { positive: 100 },
    }
    
    const mockFeedback = {
      total: 1,
      items: [
        {
          id: 1,
          original_text: 'Test feedback',
          translated_text: 'Test feedback',
          sentiment: 'positive',
          language: 'en',
          product: 'Product A',
        },
      ],
      skip: 0,
      limit: 5,
    }
    
    global.fetch.mockImplementation((url, options) => {
      if (url.includes('/api/feedback/1') && options?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: 'deleted', id: 1 }),
          headers: new Headers(),
        })
      }
      if (url.includes('/api/stats')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockStats,
          headers: new Headers(),
        })
      }
      if (url.includes('/api/feedback')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ...mockFeedback, items: [] }),
          headers: new Headers(),
        })
      }
      return Promise.resolve({ ok: false })
    })
    
    render(<Dashboard token={mockToken} />)
    
    await waitFor(() => {
      expect(screen.getByText('Test feedback')).toBeInTheDocument()
    })
    
    // Find and click delete button
    const deleteBtn = screen.getByTitle('Delete feedback')
    await user.click(deleteBtn)
    
    // Confirm deletion in modal
    await waitFor(() => {
      expect(screen.getByText(/Confirm Delete/i)).toBeInTheDocument()
    })
    
    const confirmBtn = screen.getByRole('button', { name: /Confirm/i })
    await user.click(confirmBtn)
    
    // Verify delete API was called
    await waitFor(() => {
      const calls = global.fetch.mock.calls
      expect(calls.some(call => 
        call[0].includes('/api/feedback/1') && call[1]?.method === 'DELETE'
      )).toBe(true)
    })
  })

  it('shows/hides translated text toggle', async () => {
    const user = userEvent.setup()
    
    const mockStats = {
      total: 1,
      counts: { positive: 1 },
      percentages: { positive: 100 },
    }
    
    const mockFeedback = {
      total: 1,
      items: [
        {
          id: 1,
          original_text: 'Bonjour!',
          translated_text: 'Hello!',
          sentiment: 'positive',
          language: 'fr',
          product: 'Product A',
        },
      ],
      skip: 0,
      limit: 5,
    }
    
    setupMockFetch(mockStats, mockFeedback)
    render(<Dashboard token={mockToken} />)
    
    await waitFor(() => {
      expect(screen.getByText('Bonjour!')).toBeInTheDocument()
    })
    
    // Click show translated button
    const toggleBtn = screen.getByRole('button', { name: /Show Translated/i })
    await user.click(toggleBtn)
    
    // Should now show translated text
    await waitFor(() => {
      expect(screen.getByText('Hello!')).toBeInTheDocument()
      expect(screen.getByText(/Original:/i)).toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    global.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 500,
      })
    )
    
    render(<Dashboard token={mockToken} />)
    
    await waitFor(() => {
      expect(screen.getByText(/Error:/i)).toBeInTheDocument()
    })
  })

  it('refreshes data when refresh button is clicked', async () => {
    const user = userEvent.setup()
    
    const mockStats = {
      total: 1,
      counts: { positive: 1 },
      percentages: { positive: 100 },
    }
    
    setupMockFetch(mockStats, { total: 1, items: [] })
    render(<Dashboard token={mockToken} />)
    
    await waitFor(() => {
      expect(screen.getByTitle('Refresh data')).toBeInTheDocument()
    })
    
    global.fetch.mockClear()
    
    const refreshBtn = screen.getByTitle('Refresh data')
    await user.click(refreshBtn)
    
    // Verify fetch was called again
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
  })
})
