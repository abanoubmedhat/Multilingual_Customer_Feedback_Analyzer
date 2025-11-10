import React, { useState } from 'react'

export default function Submit(){
  const [text, setText] = useState('')
  const [product, setProduct] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e){
    e.preventDefault()
    setError(null)
    setResult(null)
    
    if (!text.trim()) {
      setError('Please enter feedback text')
      return
    }

    setLoading(true)
    try{
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, product: product || undefined })
      })
      
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`)
      }
      
      const data = await res.json()
      setResult(data)
      setText('')
      setProduct('')
    }catch(err){
      setError(err.message || 'Failed to submit feedback')
    }finally{
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="product">Product (optional)</label>
        <input 
          id="product"
          value={product} 
          onChange={e=>setProduct(e.target.value)}
          placeholder="e.g., Product A, iPhone 15"
        />
      </div>

      <div className="form-group">
        <label htmlFor="feedback">Feedback text</label>
        <textarea 
          id="feedback"
          value={text} 
          onChange={e=>setText(e.target.value)}
          placeholder="Enter customer feedback in any language..."
        />
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
