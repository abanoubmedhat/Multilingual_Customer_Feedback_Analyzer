import React, { useEffect, useState, useRef } from 'react'

export default function Submit({ products = [], productsLoading = false }){
  const [text, setText] = useState('')
  const [product, setProduct] = useState('') // empty string keeps placeholder option selected
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false) // retained for backward compatibility
  const [error, setError] = useState(null)
  const [phase, setPhase] = useState(null) // null | 'calling-llm' | 'parsing-response' | 'saving'
  const [elapsedMs, setElapsedMs] = useState(0)
  const startRef = useRef(0)
  const abortRef = useRef(null)
  const cancelReasonRef = useRef(null) // 'user' | 'timeout' | null
  const TIMEOUT_MS = 20000 // 20s timeout

  // Removed auto-select of first product to force explicit user choice.

  // Elapsed timer while a phase is active
  useEffect(() => {
    if (phase) {
      startRef.current = Date.now()
      setElapsedMs(0)
      const id = setInterval(() => {
        setElapsedMs(Date.now() - startRef.current)
      }, 500)
      return () => clearInterval(id)
    }
  }, [phase])

  async function handleSubmit(e){
    e.preventDefault()
    setError(null)
    setResult(null)
    cancelReasonRef.current = null

    if (!text.trim()) { setError('Please enter feedback text'); return }
    if (!product) { setError('Please select a product'); return }

    setLoading(true)
    setPhase('calling-llm')
    const controller = new AbortController()
    abortRef.current = controller
    let timeoutTriggered = false
    const timeoutId = setTimeout(() => {
      timeoutTriggered = true
      cancelReasonRef.current = 'timeout'
      controller.abort()
    }, TIMEOUT_MS)
    try{
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, product }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      if (controller.signal.aborted) {
        // Fetch aborted either by user or timeout; let catch block handle messaging
        throw new DOMException('Aborted', 'AbortError')
      }

      setPhase('parsing-response')
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data = await res.json()

      setPhase('saving')
      setResult(data)
      setText('')
  // Reset to placeholder so user must choose again explicitly.
  setProduct('')
      try { window.dispatchEvent(new CustomEvent('feedback:created', { detail: data })) } catch {}
      setPhase(null)
    }catch(err){
      clearTimeout(timeoutId)
      // Distinguish abort causes
      if (err.name === 'AbortError' || err.message === 'Aborted' || err.message === 'Request cancelled') {
        if (cancelReasonRef.current === 'timeout') {
          setError(`Analysis timed out (${(TIMEOUT_MS/1000)}s). Please retry.`)
        } else if (cancelReasonRef.current === 'user') {
          setError('Analysis cancelled by user.')
        } else {
          setError('Analysis aborted unexpectedly.')
        }
      } else {
        setError(err.message || 'Failed to submit feedback')
      }
      setPhase(null)
    }finally{
      setLoading(false)
      abortRef.current = null
    }
  }

  function cancelRequest(){
    if (abortRef.current && !abortRef.current.signal.aborted){
      cancelReasonRef.current = 'user'
      abortRef.current.abort()
      setPhase(null)
      setLoading(false)
      setError('Analysis cancelled by user.')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="form-subtitle">Share your experience in any language - we'll analyze it for you</p>
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

      <div style={{display:'flex', gap:8}}>
        <button type="submit" disabled={loading || !text.trim()}>
          {phase === 'calling-llm' && '🔍 Calling LLM...'}
          {phase === 'parsing-response' && '🧪 Parsing response...'}
          {phase === 'saving' && '💾 Saving...'}
          {!phase && !loading && '🚀 Submit & Analyze'}
          {loading && !phase && '⏳ Working...'}
        </button>
        {phase && (
          <button type="button" onClick={cancelRequest} style={{width:'auto', background:'#ef4444'}}>
            ✖ Cancel
          </button>
        )}
      </div>

      {error && (<div className="error-message">{error}</div>)}

      {phase && (
        <div className="loading">
          {phase === 'calling-llm' && 'Contacting Gemini model...'}
          {phase === 'parsing-response' && 'Parsing model output...'}
          {phase === 'saving' && 'Storing results...'}
          <div style={{fontSize:12, marginTop:4}}>Elapsed {(elapsedMs/1000).toFixed(1)}s</div>
        </div>
      )}

      {result && (
        <>
          <div className="success-message">✅ Feedback stored successfully!</div>
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
        </>
      )}
    </form>
  )
}
