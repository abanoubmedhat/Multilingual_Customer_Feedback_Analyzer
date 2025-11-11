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

  const sentiments = ['positive', 'neutral', 'negative']
  const colors = ['positive', 'neutral', 'negative']
  const emojis = { positive: '😊', neutral: '😐', negative: '😞' }

  return (
    <div>
      {loading && <div className="loading">📊 Loading stats...</div>}
      
      {error && (
        <div className="error-message">Error: {error}</div>
      )}

      {stats && stats.total === 0 && (

          <div>
            <div className="filter-section">
              <div className="filter-group">
                <label htmlFor="product-filter">Filter by Product:</label>
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
                <label htmlFor="language-filter">Filter by Language:</label>
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
                <label htmlFor="product-filter">Filter by Product:</label>
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
                <label htmlFor="language-filter">Filter by Language:</label>
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
            </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total</div>
              <div className="stat-value">{stats.total}</div>
            </div>
            {sentiments.map(sentiment => (
              <div key={sentiment} className="stat-card">
                <div className="stat-label">{sentiment}</div>
                <div className="stat-value">{stats.counts[sentiment] || 0}</div>
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

          <button className="reload-btn" onClick={load} disabled={loading}>
            🔄 Refresh Stats
          </button>

          <div className="recent-feedback">
            <h3>Recent Feedback</h3>
            {feedbackPage.length === 0 && <div>No feedback on this page.</div>}
            <ul>
              {feedbackPage.map(f => (
                <li key={f.id} className="feedback-item">
                  <div className="fb-text">{f.original_text}</div>
                  <div className="fb-meta">{f.product || '(unspecified)'} • {f.language || 'unknown'} • {f.sentiment}</div>
                </li>
              ))}
            </ul>

            <div className="pagination-controls">
              <button onClick={()=> loadFeedbackPage(Math.max(0, page-1))} disabled={page<=0}>Prev</button>
              <span> Page {page+1} </span>
              <button onClick={()=> loadFeedbackPage(page+1)} disabled={(page+1)*pageSize >= totalFeedback}>Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
