import React, { useEffect, useState } from 'react'
import Submit from './pages/Submit'
import Dashboard from './pages/Dashboard'

export default function App(){
  const [token, setToken] = useState(null)
  const [loginError, setLoginError] = useState(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  // Products state lifted to App so new items appear instantly in all views
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState(null)
  const [productMsg, setProductMsg] = useState(null)
  const [productErr, setProductErr] = useState(null)

  useEffect(() => {
    const t = localStorage.getItem('jwt')
    if (t) setToken(t)
  }, [])

  // Load products (used by Submit and Products manager)
  async function loadProducts(){
    setProductsLoading(true)
    setProductsError(null)
    try{
      const res = await fetch('/api/products', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      if (!res.ok) throw new Error('Failed to load products')
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : [])
    }catch(e){
      setProductsError(e.message)
      setProducts([])
    }finally{
      setProductsLoading(false)
    }
  }

  useEffect(() => { loadProducts() }, [token])

  async function handleLogin(e){
    e.preventDefault()
    setLoginError(null)
    try{
      const params = new URLSearchParams()
      params.append('grant_type', 'password')
      params.append('username', username)
      params.append('password', password)
      params.append('scope', '')
      const res = await fetch('/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      })
      if (!res.ok) throw new Error('Invalid credentials')
      const data = await res.json()
      if (!data.access_token) throw new Error('No token returned')
      localStorage.setItem('jwt', data.access_token)
      setToken(data.access_token)
      setUsername('')
      setPassword('')
    }catch(err){
      setLoginError(err.message)
    }
  }

  function handleLogout(){
    localStorage.removeItem('jwt')
    setToken(null)
  }

  async function handleAddProduct(e){
    e.preventDefault()
    const form = e.target
    const name = new FormData(form).get('name')
    if (!name) return
    try{
      setProductMsg(null); setProductErr(null)
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ name })
      })
      if (!res.ok){
        // try to parse backend error
        let detail = 'Failed to add product'
        try {
          const j = await res.json();
          if (typeof j.detail === 'string') detail = j.detail
          else if (Array.isArray(j.detail)) detail = j.detail[0]?.msg || detail
        } catch {}
        throw new Error(detail)
      }
      form.reset()
      await loadProducts() // refresh list everywhere
      setProductMsg('✅ Product added successfully')
    }catch(err){
      setProductErr(err.message)
    }
  }

  function ProductsManager(){
    const [pendingDeleteId, setPendingDeleteId] = React.useState(null)

    async function remove(id){
      try{
        setProductMsg(null); setProductErr(null)
        const res = await fetch(`/api/products/${id}`, {
          method: 'DELETE',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        })
        if (!res.ok){
          let detail = 'Delete failed'
          try { const j = await res.json(); detail = j.detail || detail } catch {}
          throw new Error(detail)
        }
        await loadProducts()
        setProductMsg('✅ Product deleted successfully')
        setPendingDeleteId(null)
      }catch(err){
        setProductErr(err.message)
      }
    }

    return (
      <div>
        {productsLoading && <div className="loading">Loading products...</div>}
        {productsError && <div className="error-message">{productsError}</div>}
        <ul>
          {products.map(p => (
            <li key={p.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0'}}>
              <span>{p.name}</span>
              {pendingDeleteId === p.id ? (
                <div style={{display:'flex', gap:8}}>
                  <button onClick={()=>setPendingDeleteId(null)} style={{width:'auto', padding:'6px 10px'}}>Cancel</button>
                  <button onClick={()=>remove(p.id)} style={{width:'auto', padding:'6px 10px', background:'#dc2626'}}>Confirm</button>
                </div>
              ) : (
                <button onClick={()=>setPendingDeleteId(p.id)} style={{width:'auto', padding:'6px 10px', background:'#dc2626'}}>Delete</button>
              )}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  function ChangePassword(){
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [msg, setMsg] = useState(null)
    const [err, setErr] = useState(null)

    async function submit(e){
      e.preventDefault()
      setMsg(null); setErr(null)
      // Client-side validation aligned with backend (min length 6)
      if (newPassword.length < 6){
        setErr('New password must be at least 6 characters long')
        return
      }
      try{
        const res = await fetch('/auth/change-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
        })
        if (!res.ok){
          let detail = 'Failed to change password'
          try {
            const j = await res.json();
            if (typeof j.detail === 'string') detail = j.detail
            else if (Array.isArray(j.detail)) detail = j.detail[0]?.msg || detail
          } catch {}
          throw new Error(detail)
        }
        setMsg('Password changed successfully')
        setCurrentPassword(''); setNewPassword('')
      }catch(error){
        setErr(error.message)
      }
    }

    return (
      <form onSubmit={submit}>
        <div className="form-group">
          <label htmlFor="cur">Current password</label>
          <input id="cur" type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required />
        </div>
        <div className="form-group">
          <label htmlFor="new">New password</label>
          <input id="new" type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required />
          <div className="hint">Minimum 6 characters</div>
        </div>
        <button type="submit">Change Password</button>
        {msg && <div className="success-message" style={{marginTop:8}}>{msg}</div>}
        {err && <div className="error-message" style={{marginTop:8}}>{err}</div>}
      </form>
    )
  }

  return (
    <div className="container">
      <h1>📊 Feedback Analyzer</h1>
      <div className="main">
        <div className="card">
          <h2>Submit Feedback</h2>
          <Submit products={products} productsLoading={productsLoading} />
        </div>
        {!token && (
          <div className="card">
            <h2>Login as Admin</h2>
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input id="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="admin" />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input id="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="admin" />
              </div>
              <button type="submit">Login</button>
              {loginError && <div className="error-message">{loginError}</div>}
            </form>
            <p className="hint">Admin can view stats, previous reviews, and add products.</p>
          </div>
        )}

        {token && (
          <>
            <div className="card">
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h2>Dashboard</h2>
                <button onClick={handleLogout}>Logout</button>
              </div>
              <Dashboard token={token} />
            </div>
            <div className="card">
              <h2>Admin Tools</h2>
              <div className="form-group">
                <form onSubmit={handleAddProduct}>
                  <label htmlFor="new-product">Add Product</label>
                  <div style={{display:'flex', gap:8}}>
                    <input id="new-product" name="name" placeholder="Product name" />
                    <button type="submit" style={{width:'auto'}}>Add</button>
                  </div>
                </form>
                {productMsg && <div className="success-message" style={{marginTop:8}}>{productMsg}</div>}
                {productErr && <div className="error-message" style={{marginTop:8}}>{productErr}</div>}
              </div>
              <h3 style={{marginTop:12}}>Products</h3>
              <ProductsManager />
            </div>
            <div className="card">
              <h2>Change Password</h2>
              <ChangePassword />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
