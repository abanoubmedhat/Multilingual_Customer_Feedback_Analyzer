import React, { useEffect, useState, useRef } from 'react'

// Get API base URL from environment variable (set at build time)
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export default function Submit({ products = [], productsLoading = false, productsError, setFeedbackMsg, setFeedbackErr, setIsSubmitting }){
  // Persisted state keys
  const STORAGE_KEY = 'pendingFeedbackAnalysis'
  const FEEDBACK_TEXT_KEY = 'feedbackText'
  const FEEDBACK_PRODUCT_KEY = 'feedbackProduct'
  const [text, setText] = useState(() => localStorage.getItem(FEEDBACK_TEXT_KEY) || '')
  const [product, setProduct] = useState(() => localStorage.getItem(FEEDBACK_PRODUCT_KEY) || '')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [phase, setPhase] = useState(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [completedSteps, setCompletedSteps] = useState([])
  // Restore pending analysis state on mount
  useEffect(() => {
    // Always clear all persisted state and reset form on mount (page refresh)
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(FEEDBACK_TEXT_KEY)
    localStorage.removeItem(FEEDBACK_PRODUCT_KEY)
    setPhase(null)
    setText('')
    setProduct('')
    setAnalysisResult(null)
    setCompletedSteps([])
    setError(null)
    // Immediately set loading state to false to avoid spinner delay after refresh
    if (typeof setIsLoadingProducts === 'function') {
      setIsLoadingProducts(false);
    }
  }, [])
    // Ensure productsError is always defined and avoid naming conflict
    const productsLoadError = typeof productsError !== 'undefined' ? productsError : null;
  const startRef = useRef(0)
  const abortRef = useRef(null)
  const cancelReasonRef = useRef(null) // 'user' | 'timeout' | null
  const TIMEOUT_MS = 60000 // 60s timeout (generous for slow API responses)

  // Persist feedback text and product selection on change
  useEffect(() => {
    localStorage.setItem(FEEDBACK_TEXT_KEY, text)
  }, [text])
  useEffect(() => {
    localStorage.setItem(FEEDBACK_PRODUCT_KEY, product)
  }, [product])

  // Removed auto-select of first product to force explicit user choice.

  // Elapsed timer while a phase is active
  useEffect(() => {
    if (phase) {
      startRef.current = Date.now()
      setElapsedMs(0)
      const id = setInterval(() => {
        setElapsedMs(Date.now() - startRef.current)
      }, 100) // More frequent updates for smoother countdown
      return () => clearInterval(id)
    }
  }, [phase])

  async function handleSubmit(e){
    e.preventDefault()
    setError(null)
    setResult(null)
    setAnalysisResult(null)
    setCompletedSteps([])
    cancelReasonRef.current = null
    // Save initial state to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      phase: 'analyzing',
      text,
      product,
      analysisResult: null,
      completedSteps: [],
      error: null
    }))

    if (!text.trim()) {
      setError('Please enter feedback text');
      setTimeout(() => setError(null), 4000);
      return;
    }
    if (!product) { setError('Please select a product'); return }

  setLoading(true)
  if (setIsSubmitting) setIsSubmitting(true)
  setPhase('analyzing')
    const controller = new AbortController()
    abortRef.current = controller
    const timeoutId = setTimeout(() => {
      cancelReasonRef.current = 'timeout'
      controller.abort()
    }, TIMEOUT_MS)
    
    try{
      // Phase 1: Analyze only (no save) using /api/translate
      const res = await fetch(`${API_BASE_URL}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      
      if (controller.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const errorMsg = errorData.detail || `API error: ${res.status}`
        throw new Error(errorMsg)
      }
      const analysisData = await res.json()
      
      // Check if cancelled during analysis
      if (controller.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      // Store analysis result and mark step as completed
      setAnalysisResult(analysisData)
      setCompletedSteps(['analyzing'])
      // Persist analysis result
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        phase: 'saving',
        text,
        product,
        analysisResult: analysisData,
        completedSteps: ['analyzing'],
        error: null
      }))
      
      // Phase 2: Save to database (only if not cancelled)
      setPhase('saving')
      const saveRes = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text, 
          product,
          // Pass the analysis results to avoid re-analyzing
          language: analysisData.language,
          translated_text: analysisData.translated_text,
          sentiment: analysisData.sentiment
        }),
        signal: controller.signal
      })

      if (controller.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      if (!saveRes.ok) {
        const errorData = await saveRes.json().catch(() => ({}))
        const errorMsg = errorData.detail || `Save failed: ${saveRes.status}`
        throw new Error(errorMsg)
      }
      const savedData = await saveRes.json()

      setResult(savedData)
      setCompletedSteps(['analyzing', 'saving'])
  // Do not reset text/product on error; only reset on success or cancel
      // Show success toast notification
      if (setFeedbackMsg) {
        setFeedbackMsg('✅ Feedback stored successfully!')
      }
      try { window.dispatchEvent(new CustomEvent('feedback:created', { detail: savedData })) } catch {}
  setPhase(null)
  // Clear persisted state
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(FEEDBACK_TEXT_KEY)
  localStorage.removeItem(FEEDBACK_PRODUCT_KEY)
    }catch(err){
      clearTimeout(timeoutId)
      // Distinguish abort causes
      let errorMsg = ''
      if (err.name === 'AbortError' || err.message === 'Aborted') {
        if (cancelReasonRef.current === 'timeout') {
          errorMsg = `Analysis timed out (${(TIMEOUT_MS/1000)}s). Please retry.`
        } else if (cancelReasonRef.current === 'user') {
          errorMsg = 'Analysis cancelled - no feedback was saved.'
        } else {
          errorMsg = 'Analysis aborted unexpectedly.'
        }
      } else {
        errorMsg = err.message || 'Failed to submit feedback'
      }
      setError(errorMsg)
      setPhase(null)
      setAnalysisResult(null)
      // Persist error state
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        phase: null,
        text,
        product,
        analysisResult: null,
        completedSteps: [],
        error: errorMsg
      }))
      // Auto-dismiss for timeout and fetch errors
      // Auto-dismiss all error notifications after 4 seconds
      if (errorMsg) {
        setTimeout(() => setError(null), 4000)
      }
    }finally{
      setLoading(false)
      if (setIsSubmitting) setIsSubmitting(false)
      abortRef.current = null
    }
  }

  function cancelRequest(){
    if (abortRef.current && !abortRef.current.signal.aborted){
      cancelReasonRef.current = 'user'
      abortRef.current.abort()
      setPhase(null)
      setLoading(false)
      if (setIsSubmitting) setIsSubmitting(false)
      setAnalysisResult(null)
      setCompletedSteps([])
  setProduct('') // Unselect product
  setText('') // Erase feedback area
  localStorage.removeItem(FEEDBACK_TEXT_KEY)
  localStorage.removeItem(FEEDBACK_PRODUCT_KEY)
      setError('Analysis cancelled - no feedback was saved.')
      // Persist cancel state
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        phase: null,
        text: '',
        product: '',
        analysisResult: null,
        completedSteps: [],
        error: 'Analysis cancelled - no feedback was saved.'
      }))
      // Auto-dismiss cancellation notification after 2 seconds
      setTimeout(() => setError(null), 2000)
    }
  }

  // Show "taking longer" message only in the last 20 seconds before timeout
  const showSlowWarning = elapsedMs > (TIMEOUT_MS - 20000) // Last 20 seconds

  return (
    <form onSubmit={handleSubmit}>
      <p className="form-subtitle">Share your experience in any language - we'll analyze it for you</p>
      {productsLoading && <div className="loading">Loading products...</div>}
      {(productsLoadError && products.length === 0) && (
        <div
          className="error-message"
          role="alert"
          style={{
            marginTop: 20,
            marginBottom: 20,
            color: '#b91c1c',
            background: 'linear-gradient(90deg, #fee2e2 0%, #fca5a5 100%)',
            border: '1.5px solid #f87171',
            boxShadow: '0 2px 8px rgba(249, 115, 115, 0.08)',
            padding: '18px 20px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
            fontSize: '16px',
            fontWeight: 500
          }}
        >
          <span style={{fontSize: '28px', marginRight: '8px', flexShrink: 0}}>🚫</span>
          <div style={{flex: 1}}>
            <div style={{fontWeight: 700, fontSize: '18px', marginBottom: '6px'}}>Unable to load products</div>
            <div style={{fontWeight: 400, fontSize: '15px', marginTop: '8px', color: '#7f1d1d'}}>
              The server may be <b>down</b> or <b>unreachable</b>. Please check your connection or try again later.
            </div>
          </div>
        </div>
      )}
      <div className="form-group">
        <label htmlFor="product">Product</label>
        <select
          id="product"
          value={product}
          onChange={e=>setProduct(e.target.value)}
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
        <button type="submit" disabled={loading}>
          {phase === 'analyzing' && '🔍 Analyzing...'}
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
        <div className="progress-tracker">
          <div className="progress-step-item">
            <div className={`progress-step-indicator ${
              completedSteps.includes('analyzing') ? 'completed' : 
              phase === 'analyzing' ? 'active' : 'pending'
            }`}>
              {completedSteps.includes('analyzing') ? '✓' : '1'}
            </div>
            <div className="progress-step-content">
              <div className="progress-step-title">
                {completedSteps.includes('analyzing') ? 'Analysis Complete' : 'Analyzing Feedback'}
              </div>
              <div className="progress-step-subtitle">
                {completedSteps.includes('analyzing') 
                  ? 'Language detected and sentiment analyzed' 
                  : 'Detecting language and analyzing sentiment...'}
              </div>
            </div>
          </div>
          
          <div className="progress-step-item">
            <div className={`progress-step-indicator ${
              completedSteps.includes('saving') ? 'completed' : 
              phase === 'saving' ? 'active' : 'pending'
            }`}>
              {completedSteps.includes('saving') ? '✓' : '2'}
            </div>
            <div className="progress-step-content">
              <div className="progress-step-title">
                {completedSteps.includes('saving') ? 'Feedback Saved' : 'Saving Feedback'}
              </div>
              <div className="progress-step-subtitle">
                {completedSteps.includes('saving') 
                  ? 'Feedback stored successfully' 
                  : 'Storing feedback in database...'}
              </div>
            </div>
          </div>

          {showSlowWarning && (
            <div className="progress-notice">
              <span className="notice-icon">⏳</span>
              <span className="notice-text">
                This is taking longer than usual. The AI model may be experiencing high traffic or processing complex content. Please wait...
              </span>
            </div>
          )}
        </div>
      )}

      {result && (
        <>
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
