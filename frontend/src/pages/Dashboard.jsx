import React, { useEffect, useState } from 'react'

export default function Dashboard(){
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)

  async function load(){
    setLoading(true)
    try{
      const res = await fetch('/api/stats')
      const data = await res.json()
      setStats(data)
    }catch(err){
      setStats({ error: err.message })
    }finally{setLoading(false)}
  }

  useEffect(()=>{ load() }, [])

  return (
    <div>
      <button onClick={load} disabled={loading}>Reload</button>
      {loading && <p>Loading...</p>}
      {stats && (
        <div style={{ marginTop: 12 }}>
          <pre>{JSON.stringify(stats, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
