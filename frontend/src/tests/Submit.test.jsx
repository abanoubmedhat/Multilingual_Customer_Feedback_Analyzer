import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Submit from '../pages/Submit'

describe('Submit Component', () => {
  const mockProducts = [
    { id: 1, name: 'Product A' },
    { id: 2, name: 'Product B' },
  ]

  beforeEach(() => {
    // Reset fetch mock
    global.fetch.mockReset()
    global.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({}),
        headers: new Headers(),
      })
    )
  })

  it('renders the submit form correctly', () => {
    render(<Submit products={mockProducts} productsLoading={false} />)
    
    expect(screen.getByLabelText(/Product/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Feedback text/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Submit & Analyze/i })).toBeInTheDocument()
  })

  it('displays products in dropdown', () => {
    render(<Submit products={mockProducts} productsLoading={false} />)
    
    const select = screen.getByLabelText(/Product/i)
    expect(select).toBeInTheDocument()
    
    // Check if products are in the dropdown
    expect(screen.getByText('Product A')).toBeInTheDocument()
    expect(screen.getByText('Product B')).toBeInTheDocument()
  })

  it('shows loading state while products are loading', () => {
    render(<Submit products={[]} productsLoading={true} />)
    
    expect(screen.getByText(/Loading products/i)).toBeInTheDocument()
  })

  it('shows error when submitting without text', async () => {
    const user = userEvent.setup()
    render(<Submit products={mockProducts} productsLoading={false} />)
    
    const submitBtn = screen.getByRole('button', { name: /Submit & Analyze/i })
    await user.click(submitBtn)
    
    await waitFor(() => {
      expect(screen.getByText(/Please enter feedback text/i)).toBeInTheDocument()
    })
  })

  it('shows error when submitting without product selection', async () => {
    const user = userEvent.setup()
    render(<Submit products={mockProducts} productsLoading={false} />)
    
    const textarea = screen.getByLabelText(/Feedback text/i)
    await user.type(textarea, 'This is my feedback')
    
    const submitBtn = screen.getByRole('button', { name: /Submit & Analyze/i })
    await user.click(submitBtn)
    
    await waitFor(() => {
      expect(screen.getByText(/Please select a product/i)).toBeInTheDocument()
    })
  })

  it('shows elapsed time during analysis', async () => {
    const user = userEvent.setup()
    
    // Mock a delayed response
    global.fetch.mockImplementation((url) => {
      if (url.includes('/api/translate')) {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({
                translated_text: 'Test',
                sentiment: 'positive',
                language: 'en',
              }),
            })
          }, 1000)
        })
      }
      if (url.includes('/api/feedback')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 1, sentiment: 'positive' }),
        })
      }
      return Promise.resolve({ ok: false })
    })

    render(<Submit products={mockProducts} productsLoading={false} />)
    
    const productSelect = screen.getByLabelText(/Product/i)
    await user.selectOptions(productSelect, 'Product A')
    
    const textarea = screen.getByLabelText(/Feedback text/i)
    await user.type(textarea, 'Test feedback')
    
    const submitBtn = screen.getByRole('button', { name: /Submit & Analyze/i })
    await user.click(submitBtn)
    
    // Check progress tracker appears (which shows the analysis is in progress)
    await waitFor(() => {
      expect(screen.getByText(/Analyzing Feedback/i)).toBeInTheDocument()
    })
  })

  it('allows cancellation of analysis', async () => {
    const user = userEvent.setup()
    
    global.fetch.mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            json: async () => ({
              translated_text: 'Test',
              sentiment: 'positive',
              language: 'en',
            }),
          })
        }, 5000)
      })
    })

    render(<Submit products={mockProducts} productsLoading={false} />)
    
    const productSelect = screen.getByLabelText(/Product/i)
    await user.selectOptions(productSelect, 'Product A')
    
    const textarea = screen.getByLabelText(/Feedback text/i)
    await user.type(textarea, 'Test feedback')
    
    const submitBtn = screen.getByRole('button', { name: /Submit & Analyze/i })
    await user.click(submitBtn)
    
    // Wait for cancel button to appear
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    })
    
    // Click cancel
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i })
    await user.click(cancelBtn)
    
    // Check cancellation message
    await waitFor(() => {
      expect(screen.getByText(/cancelled/i)).toBeInTheDocument()
    })
  })

  it('displays character count', async () => {
    const user = userEvent.setup()
    render(<Submit products={mockProducts} productsLoading={false} />)
    
    const textarea = screen.getByLabelText(/Feedback text/i)
    
    // Initial count
    expect(screen.getByText('0/2000')).toBeInTheDocument()
    
    // After typing
    await user.type(textarea, 'Hello')
    expect(screen.getByText('5/2000')).toBeInTheDocument()
  })

  it('enforces max character limit', async () => {
    const user = userEvent.setup()
    render(<Submit products={mockProducts} productsLoading={false} />)
    
    const textarea = screen.getByLabelText(/Feedback text/i)
    
    // Textarea should have maxLength attribute
    expect(textarea).toHaveAttribute('maxLength', '2000')
  })

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup()
    
    global.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: async () => ({}), // Empty response, will trigger default error message
      })
    )

    render(<Submit products={mockProducts} productsLoading={false} />)
    
    const productSelect = screen.getByLabelText(/Product/i)
    await user.selectOptions(productSelect, 'Product A')
    
    const textarea = screen.getByLabelText(/Feedback text/i)
    await user.type(textarea, 'Test feedback')
    
    const submitBtn = screen.getByRole('button', { name: /Submit & Analyze/i })
    await user.click(submitBtn)
    
    await waitFor(() => {
      expect(screen.getByText(/API error: 500/i)).toBeInTheDocument()
    })
  })

  it('displays saved result after successful submit', async () => {
    const user = userEvent.setup()
    // Translate response
    let call = 0
    global.fetch.mockImplementation((url) => {
      call += 1
      if (url.includes('/api/translate')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            translated_text: 'Hola',
            sentiment: 'neutral',
            language: 'es',
          }),
        })
      }
      if (url.includes('/api/feedback')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 42,
            translated_text: 'Hola',
            sentiment: 'neutral',
            language: 'es',
            product: 'Product A'
          }),
        })
      }
      return Promise.resolve({ ok: false })
    })

    render(<Submit products={mockProducts} productsLoading={false} />)
    const productSelect = screen.getByLabelText(/Product/i)
    await user.selectOptions(productSelect, 'Product A')
    const textarea = screen.getByLabelText(/Feedback text/i)
    await user.type(textarea, 'Hola')
    const submitBtn = screen.getByRole('button', { name: /Submit & Analyze/i })
    await user.click(submitBtn)

    // Wait for result to appear
    await waitFor(() => {
      // Narrow the search to the result box to avoid matching the select option
      const resultBox = screen.getByText(/Translated:/i).closest('.result-box')
      expect(resultBox).toBeTruthy()
      const withinResult = within(resultBox)
      expect(withinResult.getByText('Hola')).toBeInTheDocument()
      expect(withinResult.getByText(/neutral/i)).toBeInTheDocument()
      expect(withinResult.getByText('es')).toBeInTheDocument()
      expect(withinResult.getByText('Product A')).toBeInTheDocument()
    })
  })

  it('shows save error detail when save fails', async () => {
    const user = userEvent.setup()
    global.fetch.mockImplementation((url) => {
      if (url.includes('/api/translate')) {
        return Promise.resolve({ ok: true, json: async () => ({ translated_text: 'X', sentiment: 'positive', language: 'en' }) })
      }
      if (url.includes('/api/feedback')) {
        return Promise.resolve({ ok: false, status: 400, json: async () => ({ detail: 'DB Insert failed' }) })
      }
      return Promise.resolve({ ok: false })
    })

    render(<Submit products={mockProducts} productsLoading={false} />)
    const productSelect = screen.getByLabelText(/Product/i)
    await user.selectOptions(productSelect, 'Product A')
    const textarea = screen.getByLabelText(/Feedback text/i)
    await user.type(textarea, 'Test')
    const submitBtn = screen.getByRole('button', { name: /Submit & Analyze/i })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/DB Insert failed/i)).toBeInTheDocument()
    })
  })
})
