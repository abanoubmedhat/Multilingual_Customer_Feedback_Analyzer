import React, { useEffect, useState } from 'react'

export default function Submit({ products = [], productsLoading = false }){
  const [text, setText] = useState('')
  const [product, setProduct] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Default to first product if none selected when list is available
  useEffect(() => {
    if (!product && Array.isArray(products) && products.length > 0){
      setProduct(products[0].name)
    }
  }, [products])

  async function handleSubmit(e){
    e.preventDefault()
    setError(null)
    setResult(null)
    
    if (!text.trim()) {
      setError('Please enter feedback text')
      return
    }
    if (!product) {
      setError('Please select a product')
      return
    }

    setLoading(true)
    try{
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, product })
      })
      
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`)
      }
      
  const data = await res.json()
  setResult(data)
  setText('')
  setProduct(products[0]?.name || '')
    }catch(err){
      setError(err.message || 'Failed to submit feedback')
    }finally{
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {productsLoading && <div className="loading">Loading products...</div>}
      <div className="form-group">
        <label htmlFor="product">Product</label>
        <select
          id="product"
          value={product}
          onChange={e=>setProduct(e.target.value)}
          required
        >
          <option value="" disabled>Select a product</option>
          {products.map(p => (
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="feedback">Feedback text <span className="hint">(Max 2000 characters)</span></label>
        <textarea 
          id="feedback"
          value={text} 
          onChange={e=>setText(e.target.value)}
          placeholder="Enter customer feedback in any language..."
          maxLength={2000}
        />
        <div className="char-count">{text.length}/2000</div>
      </div>

      <button type="submit" disabled={loading || !text.trim()}>
        {loading ? '⏳ Analyzing...' : '🚀 Submit & Analyze'}
      </button>

      {error && (
        <div className="error-message">{error}</div>
      )}

      {loading && <div className="loading">Analyzing feedback with Gemini...</div>}

      {result && (
        <div className="success-message">
          ✅ Feedback stored successfully!
        </div>
      )}

      {result && (
        <div className="result-box">
          <div className="result-item">
            <span className="result-label">Translated:</span>
            <div className="result-value">{result.translated_text}</div>
          </div>
          <div className="result-item">
            <span className="result-label">Sentiment:</span>
            <div className="result-value">
              {result.sentiment === 'positive' && '😊 '}
              {result.sentiment === 'negative' && '😞 '}
              {result.sentiment === 'neutral' && '😐 '}
              {result.sentiment}
            </div>
          </div>
          {result.language && (
            <div className="result-item">
              <span className="result-label">Language:</span>
              <div className="result-value">{result.language}</div>
            </div>
          )}
          {result.product && (
            <div className="result-item">
              <span className="result-label">Product:</span>
              <div className="result-value">{result.product}</div>
            </div>
          )}
        </div>
      )}
    </form>
  )
}
