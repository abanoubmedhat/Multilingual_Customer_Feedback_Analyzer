import React, { useEffect, useState } from 'react'

export default function Dashboard(){
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load(){
    setLoading(true)
    setError(null)
    try{
      const res = await fetch('/api/stats')
      if (!res.ok) throw new Error('Failed to fetch stats')
      const data = await res.json()
      setStats(data)
    }catch(err){
      setError(err.message)
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{ load() }, [])

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
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <p>No feedback yet. Submit some feedback to see statistics!</p>
        </div>
      )}

      {stats && stats.total > 0 && (
        <div>
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
        </div>
      )}
    </div>
  )
}
