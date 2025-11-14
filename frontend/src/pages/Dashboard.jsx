import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { fetchWithAuth } from '../utils/fetchWithAuth'

export default function Dashboard({ token, setBulkMsg, setBulkError }){
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [products, setProducts] = useState([])
  const [languages, setLanguages] = useState([])
  const [sentiments, setSentiments] = useState([])
  const [sampleFeedback, setSampleFeedback] = useState([])
  const [feedbackPage, setFeedbackPage] = useState([])
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(5)
  const [totalFeedback, setTotalFeedback] = useState(0)
  const [selectedProduct, setSelectedProduct] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('')
  const [selectedSentiment, setSelectedSentiment] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [showTranslated, setShowTranslated] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // { type: 'selected'|'all', count: number, filter: string, onConfirm: fn }

  async function loadFilters(){
    try{
      const res = await fetchWithAuth('/api/feedback?limit=1000')
      if (!res.ok) return
  const data = await res.json()
  // support multiple shapes: plain array (backend returns list),
  // or wrapped shapes: { items: [...] } or { value: [...] }
  const feedbackList = Array.isArray(data) ? data : data.items || data.value || data.results || []
      // Map empty/null -> explicit "(unspecified)" so the UI
      // shows a selectable option instead of hiding these values.
      const productsRaw = feedbackList.map((f) => {
        const v = (f.product || "").toString().trim();
        return v === "" ? "(unspecified)" : v;
      });
      const languagesRaw = feedbackList.map((f) => {
        const v = (f.language || "").toString().trim();
        return v === "" ? "(unspecified)" : v;
      });
      const sentimentsRaw = feedbackList.map((f) => {
        const v = (f.sentiment || "").toString().trim().toLowerCase();
        return v === "" ? "(unspecified)" : v;
      });

      const uniqueProducts = [...new Set(productsRaw)];
      const uniqueLanguages = [...new Set(languagesRaw)];
      const uniqueSentiments = [...new Set(sentimentsRaw)];

      // Sort alphabetically but ensure "(unspecified)" appears last.
      const sortWithUnspecifiedLast = (a, b) => {
        if (a === b) return 0;
        if (a === "(unspecified)") return 1;
        if (b === "(unspecified)") return -1;
        return a.localeCompare(b);
      };

      setProducts(uniqueProducts.sort(sortWithUnspecifiedLast));
      setLanguages(uniqueLanguages.sort(sortWithUnspecifiedLast));
      setSentiments(uniqueSentiments.sort(sortWithUnspecifiedLast));
      setSampleFeedback(feedbackList.slice(0,6))
    }catch(err){
      console.error('Error loading filters:', err)
    }
  }

  async function loadFeedbackPage(p = 0){
    try{
      const params = new URLSearchParams()
      if (selectedProduct) params.append('product', selectedProduct)
      if (selectedLanguage) params.append('language', selectedLanguage)
      if (selectedSentiment) params.append('sentiment', selectedSentiment)
      params.append('skip', (p * pageSize).toString())
      params.append('limit', pageSize.toString())
      const res = await fetchWithAuth('/api/feedback?' + params.toString())
      if (!res.ok) return
      const data = await res.json()
      // data: { total, items }
      setFeedbackPage(Array.isArray(data.items) ? data.items : [])
      setTotalFeedback(data.total || 0)
      setPage(p)
    }catch(err){
      console.error('Error loading feedback page:', err)
    }
  }

  async function load(){
    setLoading(true)
    setError(null)
    try{
      let url = '/api/stats'
      const params = new URLSearchParams()
      if (selectedProduct) params.append('product', selectedProduct)
      if (selectedLanguage) params.append('language', selectedLanguage)
      if (selectedSentiment) params.append('sentiment', selectedSentiment)
      if (params.toString()) url += '?' + params.toString()
      
      const res = await fetchWithAuth(url)
      if (!res.ok) throw new Error('Failed to fetch stats')
      const data = await res.json()
      setStats(data)
    }catch(err){
      setError(err.message)
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{ loadFilters() }, [])
  useEffect(()=>{ load() }, [selectedProduct, selectedLanguage, selectedSentiment])
  useEffect(()=>{ loadFeedbackPage(0) }, [selectedProduct, selectedLanguage, selectedSentiment, pageSize])

  // Initialize page size from localStorage (if previously set)
  useEffect(() => {
    const saved = parseInt(localStorage.getItem('pageSize') || '', 10)
    if ([5, 10, 20, 50].includes(saved)) {
      setPageSize(saved)
    }
  }, [])

  // Persist page size choice
  useEffect(() => {
    localStorage.setItem('pageSize', String(pageSize))
  }, [pageSize])

  // Unified refresh helper: refresh filters, stats, and the current page
  async function refreshAll(resetToFirstPage = true){
    // Kick off in parallel for snappier UI; load() manages its own loading state
    const pageToLoad = resetToFirstPage ? 0 : page
    await Promise.allSettled([
      (async ()=>{ await loadFilters() })(),
      (async ()=>{ await load() })(),
      (async ()=>{ await loadFeedbackPage(pageToLoad) })(),
    ])
  }

  // Listen for feedback creation events (from Submit form) to auto-refresh dashboard
  useEffect(() => {
    function onCreated(){
      // After a new feedback arrives, reset to first page so the newest item is visible
      refreshAll(true)
    }
    window.addEventListener('feedback:created', onCreated)
    return () => window.removeEventListener('feedback:created', onCreated)
  }, [page, pageSize, selectedProduct, selectedLanguage, selectedSentiment])

  // Prevent body scroll when confirm modal is open
  useEffect(() => {
    if (confirmDelete) {
      document.body.style.overflow = 'hidden'
      
      // Handle Escape key to close modal
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          if (confirmDelete.onCancel) {
            confirmDelete.onCancel();
          } else {
            setConfirmDelete(null);
          }
        }
      }
      document.addEventListener('keydown', handleEscape)
      
      return () => {
        document.body.style.overflow = ''
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [confirmDelete])

  const sentimentTypes = ['positive', 'neutral', 'negative']
  const colors = ['positive', 'neutral', 'negative']
  const emojis = { positive: '😊', neutral: '😐', negative: '😞' }
  const totalPages = Math.ceil(totalFeedback / pageSize) || 0

  function toggleId(id){
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id])
  }

  function toggleAll(){
    if (selectedIds.length === feedbackPage.length){
      setSelectedIds([])
    } else {
      setSelectedIds(feedbackPage.map(f=>f.id))
    }
  }

  async function deleteSelected(){
    if (selectedIds.length === 0) return
    setBulkError(null); setBulkMsg(null)
    
    // Create a promise that resolves when user confirms or rejects when cancelled
    return new Promise((resolve, reject) => {
      setConfirmDelete({
        type: 'selected',
        count: selectedIds.length,
        filter: `Product: ${selectedProduct || 'All'}, Language: ${selectedLanguage || 'All'}, Sentiment: ${selectedSentiment || 'All'}`,
        onConfirm: async () => {
          try {
            if (selectedIds.length === 1){
              const id = selectedIds[0]
              const res = await fetchWithAuth(`/api/feedback/${id}`, { method: 'DELETE' })
              if (!res.ok) throw new Error('Failed to delete feedback')
              setBulkMsg('✅ Deleted 1 feedback entry.')
            } else {
              const res = await fetchWithAuth('/api/feedback', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds })
              })
              if (!res.ok) {
                let detail = 'Bulk delete failed'
                try {
                  const errorData = await res.json()
                  if (typeof errorData.detail === 'string') {
                    detail = errorData.detail
                  } else if (typeof errorData.detail === 'object') {
                    detail = JSON.stringify(errorData.detail)
                  }
                } catch {}
                throw new Error(detail)
              }
              const data = await res.json()
              const deletedCount = typeof data.deleted === 'number' ? data.deleted : 0
              setBulkMsg(`✅ Deleted ${deletedCount} feedback entries.`)
            }
            setSelectedIds([])
            await refreshAll(false)
            resolve() // Resolve the promise on success
          } catch(e){
            setBulkError(`⚠️ ${e.message}`)
            reject(e) // Reject on error
          } finally {
            setConfirmDelete(null)
          }
        },
        onCancel: () => {
          setConfirmDelete(null)
          reject(new Error('Cancelled by user')) // Reject when cancelled
        }
      })
    })
  }

  async function deleteAllFiltered(){
    setBulkError(null); setBulkMsg(null)
    
    // Create a promise that resolves when user confirms or rejects when cancelled
    return new Promise((resolve, reject) => {
      setConfirmDelete({
        type: 'all',
        count: totalFeedback,
        filter: `Product: ${selectedProduct || 'All'}, Language: ${selectedLanguage || 'All'}, Sentiment: ${selectedSentiment || 'All'}`,
        onConfirm: async () => {
          try {
            const params = new URLSearchParams()
            if (selectedProduct) params.append('product', selectedProduct)
            if (selectedLanguage) params.append('language', selectedLanguage)
            if (selectedSentiment) params.append('sentiment', selectedSentiment)
            const res = await fetchWithAuth('/api/feedback/all?' + params.toString(), {
              method: 'DELETE'
            })
            if (!res.ok) {
              let detail = 'Delete all filtered failed'
              try {
                const errorData = await res.json()
                // Handle both string and object detail formats
                if (typeof errorData.detail === 'string') {
                  detail = errorData.detail
                } else if (typeof errorData.detail === 'object') {
                  detail = JSON.stringify(errorData.detail)
                }
              } catch {}
              throw new Error(detail)
            }
            const data = await res.json()
            const deletedCount = typeof data.deleted === 'number' ? data.deleted : 0
            setBulkMsg(`✅ Deleted ${deletedCount} feedback entries.`)
            setSelectedIds([])
            // Clear filters since the filtered items no longer exist
            setSelectedProduct('')
            setSelectedLanguage('')
            // Reset to first page
            setPage(0)
            
            // Manually reload with cleared filters (state updates are async)
            // Load filters first, then stats and feedback page with no filters
            await loadFilters()
            
            // Load stats with cleared filters
            try {
              const statsRes = await fetchWithAuth('/api/stats')
              if (statsRes.ok) {
                const statsData = await statsRes.json()
                setStats(statsData)
              }
            } catch(err) {
              console.error('Error loading stats:', err)
            }
            
            // Load feedback page with cleared filters
            try {
              const feedbackRes = await fetchWithAuth('/api/feedback?skip=0&limit=' + pageSize)
              if (feedbackRes.ok) {
                const feedbackData = await feedbackRes.json()
                setFeedbackPage(Array.isArray(feedbackData.items) ? feedbackData.items : [])
                setTotalFeedback(feedbackData.total || 0)
              }
            } catch(err) {
              console.error('Error loading feedback:', err)
            }
            
            resolve() // Resolve the promise on success
          } catch(e){
            setBulkError(`⚠️ ${e.message}`)
            reject(e) // Reject on error
          } finally {
            setConfirmDelete(null)
          }
        },
        onCancel: () => {
          setConfirmDelete(null)
          reject(new Error('Cancelled by user')) // Reject when cancelled
        }
      })
    })
  }

  return (
    <div>
      {/* Screen reader announcements */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      >
        {loading && "Loading dashboard data"}
        {error && `Error: ${error}`}
        {stats && !loading && `Dashboard loaded. Total feedback: ${stats.total}`}
      </div>

      {loading && <div className="loading">📊 Loading stats...</div>}
      
      {error && (
        <div className="error-message" role="alert">Error: {error}</div>
      )}

      {stats && stats.total === 0 && (

          <div>
            <div className="filter-section">
              <div className="filter-group">
                <label htmlFor="product-filter">Product:</label>
                <select 
                  id="product-filter"
                  value={selectedProduct} 
                  onChange={(e) => {
                    setSelectedProduct(e.target.value);
                    setBulkMsg(null);
                    setBulkError(null);
                  }}
                  className="filter-select"
                >
                  <option value="">All Products</option>
                  {products.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            
              <div className="filter-group">
                <label htmlFor="language-filter">Language:</label>
                <select 
                  id="language-filter"
                  value={selectedLanguage} 
                  onChange={(e) => {
                    setSelectedLanguage(e.target.value);
                    setBulkMsg(null);
                    setBulkError(null);
                  }}
                  className="filter-select"
                >
                  <option value="">All Languages</option>
                  {languages.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="sentiment-filter">Sentiment:</label>
                <select 
                  id="sentiment-filter"
                  value={selectedSentiment} 
                  onChange={(e) => {
                    setSelectedSentiment(e.target.value);
                    setBulkMsg(null);
                    setBulkError(null);
                  }}
                  className="filter-select"
                >
                  <option value="">All Sentiments</option>
                  {sentiments.map(s => (
                    <option key={s} value={s}>
                      {s === 'positive' ? '😊 Positive' : s === 'negative' ? '😞 Negative' : '😐 Neutral'}
                    </option>
                  ))}
                </select>
              </div>

              <button 
                className="filter-btn refresh-btn" 
                onClick={()=>{
                  setBulkMsg(null);
                  setBulkError(null);
                  refreshAll(true);
                }} 
                disabled={loading}
                title="Refresh data"
              >
                🔄
              </button>

              <button 
                className="filter-btn clear-btn" 
                onClick={()=>{
                  setSelectedProduct('');
                  setSelectedLanguage('');
                  setSelectedSentiment('');
                  setBulkMsg(null);
                  setBulkError(null);
                }}
                disabled={!selectedProduct && !selectedLanguage && !selectedSentiment}
                title="Clear all filters"
              >
                ✖
              </button>
            </div>

            {stats && stats.total === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                {selectedProduct || selectedLanguage || selectedSentiment ? (
                  <div>
                    <p>No feedback matches the current filters.</p>
                    <p style={{fontSize: '14px', color: '#666', marginTop: '8px'}}>
                      Try clearing the filters or adjusting your selection.
                    </p>
                  </div>
                ) : (
                  <p>No feedback yet. Submit some feedback to see statistics!</p>
                )}
              </div>
            )}
            {/* Debug info removed for production UI */}
          </div>
        )}

        {stats && stats.total > 0 && (
          <div>
            <div className="filter-section">
              <div className="filter-group">
                <label htmlFor="product-filter">Product:</label>
                <select 
                  id="product-filter"
                  value={selectedProduct} 
                  onChange={(e) => {
                    setSelectedProduct(e.target.value);
                    setBulkMsg(null);
                    setBulkError(null);
                  }}
                  className="filter-select"
                >
                  <option value="">All Products</option>
                  {products.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            
              <div className="filter-group">
                <label htmlFor="language-filter">Language:</label>
                <select 
                  id="language-filter"
                  value={selectedLanguage} 
                  onChange={(e) => {
                    setSelectedLanguage(e.target.value);
                    setBulkMsg(null);
                    setBulkError(null);
                  }}
                  className="filter-select"
                >
                  <option value="">All Languages</option>
                  {languages.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="sentiment-filter">Sentiment:</label>
                <select 
                  id="sentiment-filter"
                  value={selectedSentiment} 
                  onChange={(e) => {
                    setSelectedSentiment(e.target.value);
                    setBulkMsg(null);
                    setBulkError(null);
                  }}
                  className="filter-select"
                >
                  <option value="">All Sentiments</option>
                  {sentiments.map(s => (
                    <option key={s} value={s}>
                      {s === 'positive' ? '😊 Positive' : s === 'negative' ? '😞 Negative' : '😐 Neutral'}
                    </option>
                  ))}
                </select>
              </div>

              <button 
                className="filter-btn refresh-btn" 
                onClick={()=>{
                  setBulkMsg(null);
                  setBulkError(null);
                  refreshAll(true);
                }} 
                disabled={loading}
                title="Refresh data"
              >
                🔄
              </button>

              <button 
                className="filter-btn clear-btn" 
                onClick={()=>{
                  setSelectedProduct('');
                  setSelectedLanguage('');
                  setSelectedSentiment('');
                  setBulkMsg(null);
                  setBulkError(null);
                }}
                disabled={!selectedProduct && !selectedLanguage && !selectedSentiment}
                title="Clear all filters"
              >
                ✖
              </button>
            </div>

          {/* Sentiment Overview Section */}
          <div className="dashboard-section">
            <div className="section-header">
              <h3 className="section-title">
                <span className="section-icon">📈</span>
                Sentiment Overview
              </h3>
              <p className="section-subtitle">Quick snapshot of feedback sentiment distribution</p>
            </div>
            
            <div className="stats-grid">
              <div className="stat-card stat-card-total">
                <div className="stat-icon">📊</div>
                <div className="stat-value">{stats.total}</div>
                <div className="stat-label">Total</div>
              </div>
              {sentimentTypes.map(sentiment => (
                <div key={sentiment} className={`stat-card stat-card-${sentiment}`}>
                  <div className="stat-icon">{emojis[sentiment]}</div>
                  <div className="stat-value">{stats.counts[sentiment] || 0}</div>
                  <div className="stat-label">{sentiment}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Distribution Chart Section */}
          <div className="dashboard-section">
            <div className="section-header">
              <h3 className="section-title">
                <span className="section-icon">🥧</span>
                Distribution Analysis
              </h3>
              <p className="section-subtitle">Visual breakdown of sentiment proportions</p>
            </div>
            
            <div className="sentiment-chart">
            <div className="pie-chart-container">
              <svg viewBox="0 0 200 200" className="pie-chart">
                {(() => {
                  let cumulativePercent = 0
                  const colors = {
                    positive: '#10b981',
                    neutral: '#f59e0b',
                    negative: '#ef4444'
                  }
                  
                  return sentimentTypes.map(sentiment => {
                    const percentage = stats.percentages[sentiment] || 0
                    if (percentage === 0) return null
                    
                    // Special case: if 100%, draw a full circle instead of an arc
                    if (percentage >= 99.9) {
                      return (
                        <g key={sentiment}>
                          <circle
                            cx="100"
                            cy="100"
                            r="90"
                            fill={colors[sentiment]}
                            stroke="white"
                            strokeWidth="2"
                            className="pie-slice"
                          />
                        </g>
                      )
                    }
                    
                    const startAngle = (cumulativePercent / 100) * 360
                    const endAngle = ((cumulativePercent + percentage) / 100) * 360
                    cumulativePercent += percentage
                    
                    // Convert angles to radians
                    const startRad = (startAngle - 90) * Math.PI / 180
                    const endRad = (endAngle - 90) * Math.PI / 180
                    
                    // Calculate arc path
                    const x1 = 100 + 90 * Math.cos(startRad)
                    const y1 = 100 + 90 * Math.sin(startRad)
                    const x2 = 100 + 90 * Math.cos(endRad)
                    const y2 = 100 + 90 * Math.sin(endRad)
                    
                    const largeArcFlag = percentage > 50 ? 1 : 0
                    
                    return (
                      <g key={sentiment}>
                        <path
                          d={`M 100 100 L ${x1} ${y1} A 90 90 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                          fill={colors[sentiment]}
                          stroke="white"
                          strokeWidth="2"
                          className="pie-slice"
                        />
                      </g>
                    )
                  })
                })()}
              </svg>
              <div className="pie-legend">
                {sentimentTypes.map(sentiment => {
                  const count = stats.counts[sentiment] || 0
                  const percentage = stats.percentages[sentiment] || 0
                  if (count === 0) return null
                  return (
                    <div key={sentiment} className="legend-item">
                      <div className={`legend-color legend-color-${sentiment}`}></div>
                      <div className="legend-text">
                        <span className="legend-emoji">{emojis[sentiment]}</span>
                        <span className="legend-label">{sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}</span>
                        <span className="legend-value">{Math.round(percentage)}% ({count})</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Recent Feedback Section */}
          <div className="dashboard-section">
            <div className="section-header">
              <h3 className="section-title">
                <span className="section-icon">💬</span>
                Recent Feedback
              </h3>
              <p className="section-subtitle">Latest customer feedback entries</p>
            </div>
            
            <div className="recent-feedback">
            {feedbackPage.length === 0 && <div className="empty-feedback-message">No feedback on this page.</div>}
            <ul style={{width:'100%'}}>
              {feedbackPage.map(f => (
                <li key={f.id} className={`feedback-item feedback-item-${f.sentiment || 'neutral'}`}>
                  <div className="feedback-item-header">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(f.id)}
                      onChange={()=>toggleId(f.id)}
                      className="feedback-checkbox"
                    />
                    <span className={`sentiment-badge sentiment-badge-${f.sentiment || 'neutral'}`}>
                      {emojis[f.sentiment] || '😐'}
                    </span>
                    <span className="language-tag">{f.language || 'unknown'}</span>
                    <span className="product-tag">{f.product || '(unspecified)'}</span>
                    <span className="timestamp-tag" title={new Date(f.created_at).toLocaleString()}>
                      🕒 {new Date(f.created_at).toLocaleDateString()} {new Date(f.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                    </span>
                    <button
                      className="icon-btn delete-btn"
                      onClick={(e)=>{ 
                        e.stopPropagation(); // Prevent checkbox selection
                        setBulkError(null); 
                        setBulkMsg(null);
                        // Direct confirmation without selecting
                        setConfirmDelete({
                          type: 'single',
                          count: 1,
                          filter: `Feedback ID: ${f.id}`,
                          onConfirm: async () => {
                            try {
                              const res = await fetchWithAuth(`/api/feedback/${f.id}`, { method: 'DELETE' });
                              if (!res.ok) throw new Error('Failed to delete feedback');
                              setBulkMsg('✅ Deleted 1 feedback entry.');
                              await refreshAll(false);
                              setConfirmDelete(null);
                            } catch(e) {
                              setBulkError(`⚠️ ${e.message}`);
                              setConfirmDelete(null);
                            }
                          },
                          onCancel: () => { 
                            setConfirmDelete(null);
                          }
                        });
                      }}
                      title="Delete this feedback"
                      aria-label={`Delete feedback: ${f.original_text?.substring(0, 50)}...`}
                    >
                      🗑️
                    </button>
                  </div>
                  <div className="feedback-item-body">
                    {f.original_text ? (
                      <>
                        <p className="feedback-text">
                          {showTranslated && f.translated_text ? f.translated_text : f.original_text}
                        </p>
                        {showTranslated && f.translated_text && (
                          <p className="feedback-original">
                            <span className="original-label">Original:</span> {f.original_text}
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="feedback-error">
                        ⚠️ Feedback data missing <code>original_text</code>. Raw object:<br/>
                        <pre>{JSON.stringify(f, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div style={{display:'flex', flexWrap:'wrap', gap:12, marginTop:12, alignItems:'center'}}>
              <button className="btn-tertiary" style={{width:'auto'}} onClick={toggleAll} disabled={feedbackPage.length===0}>
                {selectedIds.length === feedbackPage.length && feedbackPage.length>0 ? 'Unselect All' : 'Select All'}
              </button>
              <button
                className="btn-danger"
                style={{width:'auto'}}
                onClick={deleteSelected}
                disabled={selectedIds.length===0}
              >Delete Selected ({selectedIds.length})</button>
              <button
                className="btn-danger"
                style={{width:'auto'}}
                onClick={deleteAllFiltered}
                disabled={totalFeedback===0}
              >{selectedProduct || selectedLanguage || selectedSentiment ? `Delete All Filtered (${totalFeedback})` : `Delete All (${totalFeedback})`}</button>
              <button
                className="btn-secondary"
                style={{width:'auto'}}
                onClick={()=>setShowTranslated(s=>!s)}
                disabled={feedbackPage.length===0}
              >{showTranslated ? 'Hide Translated' : 'Show Translated'}</button>
            </div>

            {confirmDelete && createPortal(
              <div 
                className="confirm-modal-overlay"
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    if (confirmDelete.onCancel) {
                      confirmDelete.onCancel();
                    } else {
                      setConfirmDelete(null);
                    }
                  }
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-delete-title"
              >
                <div className="confirm-modal">
                  <h3 id="confirm-delete-title">Confirm Delete</h3>
                  <div className="confirm-modal-message">
                    {confirmDelete.type === 'selected'
                      ? `Are you sure you want to delete ${confirmDelete.count} selected review(s)?`
                      : `Are you sure you want to delete ALL (${confirmDelete.count}) reviews matching the current filter?`}
                  </div>
                  <div className="confirm-modal-filter">Current filter: {confirmDelete.filter}</div>
                  <div className="confirm-modal-actions">
                    <button className="btn-danger" onClick={confirmDelete.onConfirm}>Confirm</button>
                    <button 
                      className="btn-secondary" 
                      onClick={() => {
                        if (confirmDelete.onCancel) {
                          confirmDelete.onCancel();
                        } else {
                          setConfirmDelete(null);
                        }
                      }}
                    >Cancel</button>
                  </div>
                </div>
              </div>,
              document.body
            )}

            <div className="pagination-controls" role="navigation" aria-label="Feedback pagination" style={{display:'flex', alignItems:'center', gap:16, flexWrap:'wrap'}}>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <label htmlFor="page-size" style={{whiteSpace:'nowrap', fontSize: '14px', margin: 0}}>Per page:</label>
                <select
                  id="page-size"
                  className="page-size-select"
                  value={pageSize}
                  onChange={(e)=> {
                    const v = parseInt(e.target.value, 10)
                    if (!Number.isNaN(v)) setPageSize(v)
                  }}
                  aria-label="Items per page"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <span aria-live="polite" aria-atomic="true">Page {totalPages === 0 ? 0 : (page + 1)} of {totalPages}</span>
              <button 
                onClick={()=> loadFeedbackPage(Math.max(0, page-1))} 
                disabled={page<=0}
                aria-label="Go to previous page"
                className="btn-secondary"
                style={{width: 'auto'}}
              >Prev</button>
              <button 
                onClick={()=> loadFeedbackPage(page+1)} 
                disabled={(page+1)*pageSize >= totalFeedback}
                aria-label="Go to next page"
                className="btn-secondary"
                style={{width: 'auto'}}
              >Next</button>
            </div>
          </div>
          </div>
          </div>
        </div>
      )}
    </div>
  )
}
