import React, { useState } from 'react'

export default function Submit(){
  const [text, setText] = useState('')
  const [product, setProduct] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e){
    e.preventDefault()
    setLoading(true)
    try{
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, product: product || undefined })
      })
      const data = await res.json()
      setResult(data)
      setText('')
      setProduct('')
    }catch(err){
      setResult({ error: err.message })
    }finally{
      setLoading(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Product (optional)</label><br />
          <input value={product} onChange={e=>setProduct(e.target.value)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <label>Feedback text</label><br />
          <textarea rows={4} cols={40} value={text} onChange={e=>setText(e.target.value)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <button type="submit" disabled={loading || !text}>Submit</button>
        </div>
      </form>

      {loading && <p>Analyzing...</p>}
      {result && (
        <div style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>
          <h3>Result</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
