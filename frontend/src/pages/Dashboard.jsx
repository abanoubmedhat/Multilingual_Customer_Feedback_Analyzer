import React, { useEffect, useState } from 'react'

export default function Dashboard({ token }){
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [products, setProducts] = useState([])
  const [languages, setLanguages] = useState([])
  const [sampleFeedback, setSampleFeedback] = useState([])
  const [feedbackPage, setFeedbackPage] = useState([])
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(5)
  const [totalFeedback, setTotalFeedback] = useState(0)
  const [selectedProduct, setSelectedProduct] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('')

  async function loadFilters(){
    try{
      const res = await fetch('/api/feedback?limit=1000', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
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

      const uniqueProducts = [...new Set(productsRaw)];
      const uniqueLanguages = [...new Set(languagesRaw)];

      // Sort alphabetically but ensure "(unspecified)" appears last.
      const sortWithUnspecifiedLast = (a, b) => {
        if (a === b) return 0;
        if (a === "(unspecified)") return 1;
        if (b === "(unspecified)") return -1;
        return a.localeCompare(b);
      };

      setProducts(uniqueProducts.sort(sortWithUnspecifiedLast));
      setLanguages(uniqueLanguages.sort(sortWithUnspecifiedLast));
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
      params.append('skip', (p * pageSize).toString())
      params.append('limit', pageSize.toString())
      const res = await fetch('/api/feedback?' + params.toString(), {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
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
      if (params.toString()) url += '?' + params.toString()
      
      const res = await fetch(url, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
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
  useEffect(()=>{ load() }, [selectedProduct, selectedLanguage])
  useEffect(()=>{ loadFeedbackPage(0) }, [selectedProduct, selectedLanguage, pageSize])

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
  }, [page, pageSize, selectedProduct, selectedLanguage])

  const sentiments = ['positive', 'neutral', 'negative']
  const colors = ['positive', 'neutral', 'negative']
  const emojis = { positive: '😊', neutral: '😐', negative: '😞' }
  const totalPages = Math.ceil(totalFeedback / pageSize) || 0
  const [selectedIds, setSelectedIds] = useState([])
  const [showTranslated, setShowTranslated] = useState(false)
  const [bulkError, setBulkError] = useState(null)
  const [bulkMsg, setBulkMsg] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null) // { type: 'selected'|'all', count: number, filter: string, onConfirm: fn }

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
    setConfirmDelete({
      type: 'selected',
      count: selectedIds.length,
      filter: `Product: ${selectedProduct || 'All'}, Language: ${selectedLanguage || 'All'}`,
      onConfirm: async () => {
        try {
          if (selectedIds.length === 1){
            const id = selectedIds[0]
            const res = await fetch(`/api/feedback/${id}`, { method: 'DELETE', headers: token ? { 'Authorization': `Bearer ${token}` } : {} })
            if (!res.ok) throw new Error('Failed to delete feedback')
            setBulkMsg('Deleted 1 feedback entry.')
          } else {
            const res = await fetch('/api/feedback', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
              body: JSON.stringify({ ids: selectedIds })
            })
            if (!res.ok) throw new Error('Bulk delete failed')
            const data = await res.json()
            setBulkMsg(`Deleted ${data.deleted} feedback entries.`)
          }
          setSelectedIds([])
          await refreshAll(false)
        } catch(e){
          setBulkError(e.message)
        } finally {
          setConfirmDelete(null)
        }
      }
    })
  }

  async function deleteAllFiltered(){
    setBulkError(null); setBulkMsg(null)
    setConfirmDelete({
      type: 'all',
      count: totalFeedback,
      filter: `Product: ${selectedProduct || 'All'}, Language: ${selectedLanguage || 'All'}`,
      onConfirm: async () => {
        try {
          const params = new URLSearchParams()
          if (selectedProduct) params.append('product', selectedProduct)
          if (selectedLanguage) params.append('language', selectedLanguage)
          const res = await fetch('/api/feedback/all?' + params.toString(), {
            method: 'DELETE',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
          })
          if (!res.ok) throw new Error('Delete all filtered failed')
          const data = await res.json()
          setBulkMsg(`Deleted ${data.deleted} feedback entries.`)
          setSelectedIds([])
          // If current page is now empty, auto-jump to previous page
          if (page > 0) setPage(page-1)
          await refreshAll(false)
        } catch(e){
          setBulkError(e.message)
        } finally {
          setConfirmDelete(null)
        }
      }
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
                  onChange={(e) => setSelectedProduct(e.target.value)}
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
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Languages</option>
                  {languages.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <button 
                className="filter-btn refresh-btn" 
                onClick={()=>refreshAll(true)} 
                disabled={loading}
                title="Refresh data"
              >
                🔄
              </button>

              <button 
                className="filter-btn clear-btn" 
                onClick={()=>{setSelectedProduct(''); setSelectedLanguage('');}}
                disabled={!selectedProduct && !selectedLanguage}
                title="Clear all filters"
              >
                ✖
              </button>
            </div>

            {stats && stats.total === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                <p>No feedback yet. Submit some feedback to see statistics!</p>
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
                  onChange={(e) => setSelectedProduct(e.target.value)}
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
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Languages</option>
                  {languages.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <button 
                className="filter-btn refresh-btn" 
                onClick={()=>refreshAll(true)} 
                disabled={loading}
                title="Refresh data"
              >
                🔄
              </button>

              <button 
                className="filter-btn clear-btn" 
                onClick={()=>{setSelectedProduct(''); setSelectedLanguage('');}}
                disabled={!selectedProduct && !selectedLanguage}
                title="Clear all filters"
              >
                ✖
              </button>
            </div>

          <div className="stats-grid">
            <div className="stat-card stat-card-total">
              <div className="stat-icon">📊</div>
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total</div>
            </div>
            {sentiments.map(sentiment => (
              <div key={sentiment} className={`stat-card stat-card-${sentiment}`}>
                <div className="stat-icon">{emojis[sentiment]}</div>
                <div className="stat-value">{stats.counts[sentiment] || 0}</div>
                <div className="stat-label">{sentiment}</div>
              </div>
            ))}
          </div>

          <div className="sentiment-chart">
            {sentiments.map(sentiment => {
              const count = stats.counts[sentiment] || 0
              const percentage = stats.percentages[sentiment] || 0
              return (
                <div key={sentiment} className="sentiment-bar">
                  <div className="bar-label">
                    {emojis[sentiment]} {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
                  </div>
                  <div className="bar-container">
                    {count > 0 && (
                      <div 
                        className={`bar-fill ${sentiment}`}
                        style={{ width: `${percentage}%` }}
                      >
                        {percentage > 10 ? `${Math.round(percentage)}%` : ''}
                      </div>
                    )}
                  </div>
                  <div className="bar-percentage">
                    {Math.round(percentage)}% ({count})
                  </div>
                </div>
              )
            })}
          </div>

          <div className="recent-feedback">
            <h3>Recent Feedback</h3>
            {feedbackPage.length === 0 && <div>No feedback on this page.</div>}
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
                    <button
                      className="icon-btn delete-btn"
                      onClick={async()=>{ setSelectedIds([f.id]); await deleteSelected(); }}
                      title="Delete feedback"
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
              >Delete All Filtered ({totalFeedback})</button>
              <button
                className="btn-secondary"
                style={{width:'auto'}}
                onClick={()=>setShowTranslated(s=>!s)}
                disabled={feedbackPage.length===0}
              >{showTranslated ? 'Hide Translated' : 'Show Translated'}</button>
              {bulkMsg && <div className="success-message" style={{margin:0}}>{bulkMsg}</div>}
              {bulkError && <div className="error-message" style={{margin:0}}>{bulkError}</div>}
            </div>

            {confirmDelete && (
              <>
                <div 
                  style={{
                    position:'fixed',
                    top:0,
                    left:0,
                    width:'100vw',
                    height:'100vh',
                    background:'rgba(0,0,0,0.5)',
                    zIndex:999
                  }}
                  onClick={()=>setConfirmDelete(null)}
                />
                <div style={{
                  position:'fixed',
                  top:'50%',
                  left:'50%',
                  transform:'translate(-50%, -50%)',
                  zIndex:1000,
                  background:'white',
                  borderRadius:12,
                  boxShadow:'0 4px 24px rgba(0,0,0,0.3)',
                  padding:'32px 24px',
                  minWidth:280,
                  maxWidth:'min(400px, 90vw)',
                  width:'auto',
                  maxHeight:'90vh',
                  overflowY:'auto',
                  display:'flex',
                  flexDirection:'column',
                  alignItems:'center'
                }}>
                  <h3 style={{marginBottom:16, textAlign:'center'}}>Confirm Delete</h3>
                  <div style={{marginBottom:16, fontSize:15, textAlign:'center'}}>
                    {confirmDelete.type === 'selected'
                      ? `Are you sure you want to delete ${confirmDelete.count} selected review(s)?`
                      : `Are you sure you want to delete ALL (${confirmDelete.count}) reviews matching the current filter?`}
                  </div>
                  <div style={{marginBottom:16, fontSize:13, color:'#6b7280', textAlign:'center', wordBreak:'break-word'}}>Current filter: {confirmDelete.filter}</div>
                  <div style={{display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap'}}>
                    <button className="btn-danger" style={{width:'auto', minWidth:80, display:'flex', alignItems:'center', justifyContent:'center'}} onClick={confirmDelete.onConfirm}>Confirm</button>
                    <button className="btn-secondary" style={{width:'auto', minWidth:80, display:'flex', alignItems:'center', justifyContent:'center'}} onClick={()=>setConfirmDelete(null)}>Cancel</button>
                  </div>
                </div>
              </>
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
      )}
    </div>
  )
}
