import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Submit from './pages/Submit'
import Dashboard from './pages/Dashboard'
import { fetchWithAuth } from './utils/fetchWithAuth'

// Get API base URL from environment variable (set at build time)
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// GeminiModelSelector Component (extracted to prevent re-creation on App re-renders)
function GeminiModelSelector({ setMsg, setErr }){
  const [models, setModels] = useState([])
  const [currentModel, setCurrentModel] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    loadModels()
    loadCurrentModel()
  }, [])

  async function loadModels(){
    try{
      const res = await fetchWithAuth('/api/gemini/models')
      if (res.ok){
        const data = await res.json()
        setModels(data)
        setLoadError(null)
      } else {
        const error = await res.json().catch(() => ({ detail: 'Failed to load models' }))
        setLoadError(error.detail || 'Failed to load models from Google API')
      }
    }catch(error){
      console.error('Error loading models:', error)
      setLoadError('Network error: Could not connect to server')
    }finally{
      setLoading(false)
    }
  }

  async function loadCurrentModel(){
    try{
      const res = await fetchWithAuth('/api/gemini/current-model')
      if (res.ok){
        const data = await res.json()
        setCurrentModel(data.current_model)
      } else {
        console.error('Error loading current model')
      }
    }catch(error){
      console.error('Error loading current model:', error)
    }
  }

  async function handleModelChange(e){
    const newModel = e.target.value
    setMsg(null); setErr(null)
    
    try{
      const res = await fetchWithAuth('/api/gemini/current-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_name: newModel })
      })
      
      if (!res.ok){
        throw new Error('Failed to update model')
      }
      
      setCurrentModel(newModel)
      setMsg('✅ Model updated successfully')
    }catch(error){
      setErr(`⚠️ ${error.message}`)
    }
  }

  if (loading){
    return <div>Loading available models from Google API...</div>
  }

  if (loadError && models.length === 0){
    return (
      <div>
        <div className="error-message" role="alert">
          <strong>⚠️ Error Loading Models</strong>
          <p>{loadError}</p>
          <button onClick={() => { setLoading(true); setLoadError(null); loadModels(); }} style={{marginTop: 8}}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="form-group">
        <label htmlFor="gemini-model">Select AI Model</label>
        <select 
          id="gemini-model" 
          value={currentModel} 
          onChange={handleModelChange}
          style={{width: '100%'}}
          disabled={models.length === 0}
        >
          {models.length === 0 && <option value="">No models available</option>}
          {models.map(model => (
            <option key={model.name} value={model.name}>
              {model.display_name}
            </option>
          ))}
        </select>
        <div className="hint">
          {models.find(m => m.name === currentModel)?.description || 'Select a model'}
        </div>
      </div>
    </div>
  )
}

// ProductsManager Component (extracted to prevent re-creation on App re-renders)
function ProductsManager({ products, productsLoading, productsError, setProductMsg, setProductErr, loadProducts }){
  const [pendingDeleteId, setPendingDeleteId] = React.useState(null)

  async function remove(id){
    try{
      setProductMsg(null); setProductErr(null)
      const res = await fetchWithAuth(`/api/products/${id}`, {
        method: 'DELETE'
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
      setProductErr(`⚠️ ${err.message}`)
    }
  }

  return (
    <div>
      {productsLoading && <div className="loading">Loading products...</div>}
      {productsError && <div className="error-message">{productsError}</div>}
      <div style={{maxHeight: '300px', overflowY: 'scroll', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px'}}>
        <ul style={{margin: 0, padding: 0, listStyle: 'none'}}>
          {[...products].reverse().map(p => (
            <li key={p.id} style={{
              display:'flex', 
              justifyContent:'space-between', 
              alignItems:'center', 
              padding:'12px 16px',
              marginBottom: '8px',
              background: '#f9fafb',
              borderRadius: '6px',
              border: '1px solid #e5e7eb'
            }}>
              <span style={{fontSize: '15px', fontWeight: '500'}}>{p.name}</span>
              {pendingDeleteId === p.id ? (
                <div style={{display:'flex', gap:8, alignItems:'center'}}>
                  <button onClick={()=>setPendingDeleteId(null)} style={{width:'auto', padding:'8px 16px', fontSize: '14px'}}>Cancel</button>
                  <button onClick={()=>remove(p.id)} style={{width:'auto', padding:'8px 16px', background:'#dc2626', fontSize: '14px'}}>Confirm</button>
                </div>
              ) : (
                <button onClick={()=>setPendingDeleteId(p.id)} style={{width:'auto', padding:'8px 16px', background:'#dc2626', fontSize: '14px'}}>Delete</button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ChangePassword Component (extracted to prevent re-creation on App re-renders)
function ChangePassword({ setMsg, setErr }){
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e){
    e.preventDefault()
    setMsg(null); setErr(null)
    // Client-side validation aligned with backend (min length 6)
    if (newPassword.length < 6){
      setErr('⚠️ New password must be at least 6 characters long')
      return
    }
    setLoading(true)
    try{
      const res = await fetchWithAuth('/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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
      setMsg('✅ Password changed successfully')
      setCurrentPassword(''); setNewPassword('')
    }catch(error){
      setErr(`⚠️ ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="form-group">
        <label htmlFor="cur">Current password</label>
        <input id="cur" type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required disabled={loading} />
      </div>
      <div className="form-group">
        <label htmlFor="new">New password</label>
        <input id="new" type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required disabled={loading} />
        <div className="hint">Minimum 6 characters</div>
      </div>
      <button type="submit" disabled={loading}>
        {loading ? 'Changing...' : 'Change Password'}
      </button>
    </form>
  )
}

export default function App(){
  const [token, setToken] = useState(null)
  const [loginError, setLoginError] = useState(null)
  const [loginLoading, setLoginLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  // Products state lifted to App so new items appear instantly in all views
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState(null)
  const [productMsg, setProductMsg] = useState(null)
  const [productMsgFadingOut, setProductMsgFadingOut] = useState(false)
  const [productErr, setProductErr] = useState(null)
  // Dashboard bulk operation messages
  const [bulkMsg, setBulkMsg] = useState(null)
  const [bulkMsgFadingOut, setBulkMsgFadingOut] = useState(false)
  const [bulkError, setBulkError] = useState(null)
  // Gemini model selector messages
  const [geminiMsg, setGeminiMsg] = useState(null)
  const [geminiMsgFadingOut, setGeminiMsgFadingOut] = useState(false)
  const [geminiErr, setGeminiErr] = useState(null)
  // Change password messages
  const [passwordMsg, setPasswordMsg] = useState(null)
  const [passwordMsgFadingOut, setPasswordMsgFadingOut] = useState(false)
  const [passwordErr, setPasswordErr] = useState(null)
  // Feedback submission messages
  const [feedbackMsg, setFeedbackMsg] = useState(null)
  const [feedbackMsgFadingOut, setFeedbackMsgFadingOut] = useState(false)
  const [feedbackErr, setFeedbackErr] = useState(null)
  // Tab navigation state
  const [activeTab, setActiveTab] = useState('dashboard')
  // Login modal state
  const [showLoginModal, setShowLoginModal] = useState(false)
  // Session expiry notification
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState(null)

  useEffect(() => {
    const t = localStorage.getItem('jwt')
    if (t) {
      setToken(t)
      setActiveTab('dashboard') // Default to dashboard for authenticated users
    } else {
      setActiveTab('submit') // Default to submit for unauthenticated users
    }
  }, [])

  // Listen for automatic logout events (token expired)
  useEffect(() => {
    function handleAutoLogout(e) {
      console.log('🔔 Auto logout event received:', e.detail);
      localStorage.removeItem('jwt')
      setToken(null)
      setActiveTab('submit')
      setSessionExpiredMsg('Your session has expired. Please log in again.')
      // Clear message after 5 seconds
      setTimeout(() => setSessionExpiredMsg(null), 5000)
    }

    function handleTokenRefresh(e) {
      console.log('🔔 Token refresh event received');
      // Update local token state when token is refreshed
      setToken(e.detail.token)
    }

    window.addEventListener('auth:logout', handleAutoLogout)
    window.addEventListener('token:refreshed', handleTokenRefresh)

    return () => {
      window.removeEventListener('auth:logout', handleAutoLogout)
      window.removeEventListener('token:refreshed', handleTokenRefresh)
    }
  }, [])

  // Proactive session expiration monitoring
  useEffect(() => {
    if (!token) return;

    // Decode JWT to get expiration time
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expTime = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeUntilExpiry = expTime - now;

      console.log(`⏰ Session will expire in ${Math.round(timeUntilExpiry / 1000)} seconds`);

      if (timeUntilExpiry <= 0) {
        // Token already expired
        console.log('⚠️ Token already expired, logging out immediately');
        localStorage.removeItem('jwt');
        setToken(null);
        setActiveTab('submit');
        setSessionExpiredMsg('Your session has expired. Please log in again.');
        setTimeout(() => setSessionExpiredMsg(null), 5000);
        return;
      }

      // Set timer to logout 1 second before actual expiration
      const logoutTime = Math.max(0, timeUntilExpiry - 1000);
      const timerId = setTimeout(() => {
        console.log('⏰ Session expired - proactive logout');
        localStorage.removeItem('jwt');
        setToken(null);
        setActiveTab('submit');
        setSessionExpiredMsg('Your session has expired. Please log in again.');
        setTimeout(() => setSessionExpiredMsg(null), 5000);
      }, logoutTime);

      return () => clearTimeout(timerId);
    } catch (err) {
      console.error('Failed to decode token:', err);
    }
  }, [token])

  // Auto-dismiss product success messages after 3 seconds with fade-out
  useEffect(() => {
    if (productMsg) {
      setProductMsgFadingOut(false)
      const fadeTimer = setTimeout(() => {
        setProductMsgFadingOut(true)
      }, 2700) // Start fade-out 300ms before removal
      const removeTimer = setTimeout(() => {
        setProductMsg(null)
        setProductMsgFadingOut(false)
      }, 3000)
      return () => {
        clearTimeout(fadeTimer)
        clearTimeout(removeTimer)
      }
    }
  }, [productMsg])

  // Auto-dismiss bulk operation messages after 3 seconds with fade-out
  useEffect(() => {
    if (bulkMsg) {
      setBulkMsgFadingOut(false)
      const fadeTimer = setTimeout(() => {
        setBulkMsgFadingOut(true)
      }, 2700) // Start fade-out 300ms before removal
      const removeTimer = setTimeout(() => {
        setBulkMsg(null)
        setBulkMsgFadingOut(false)
      }, 3000)
      return () => {
        clearTimeout(fadeTimer)
        clearTimeout(removeTimer)
      }
    }
  }, [bulkMsg])

  // Auto-dismiss Gemini model messages after 3 seconds with fade-out
  useEffect(() => {
    if (geminiMsg) {
      setGeminiMsgFadingOut(false)
      const fadeTimer = setTimeout(() => {
        setGeminiMsgFadingOut(true)
      }, 2700) // Start fade-out 300ms before removal
      const removeTimer = setTimeout(() => {
        setGeminiMsg(null)
        setGeminiMsgFadingOut(false)
      }, 3000)
      return () => {
        clearTimeout(fadeTimer)
        clearTimeout(removeTimer)
      }
    }
  }, [geminiMsg])

  // Auto-dismiss password change messages after 3 seconds with fade-out
  useEffect(() => {
    if (passwordMsg) {
      setPasswordMsgFadingOut(false)
      const fadeTimer = setTimeout(() => {
        setPasswordMsgFadingOut(true)
      }, 2700) // Start fade-out 300ms before removal
      const removeTimer = setTimeout(() => {
        setPasswordMsg(null)
        setPasswordMsgFadingOut(false)
      }, 3000)
      return () => {
        clearTimeout(fadeTimer)
        clearTimeout(removeTimer)
      }
    }
  }, [passwordMsg])

  // Auto-dismiss feedback submission messages after 3 seconds with fade-out
  useEffect(() => {
    if (feedbackMsg) {
      setFeedbackMsgFadingOut(false)
      const fadeTimer = setTimeout(() => {
        setFeedbackMsgFadingOut(true)
      }, 2700) // Start fade-out 300ms before removal
      const removeTimer = setTimeout(() => {
        setFeedbackMsg(null)
        setFeedbackMsgFadingOut(false)
      }, 3000)
      return () => {
        clearTimeout(fadeTimer)
        clearTimeout(removeTimer)
      }
    }
  }, [feedbackMsg])

  // Load products (used by Submit and Products manager)
  async function loadProducts(){
    setProductsLoading(true)
    setProductsError(null)
    try{
      const res = await fetchWithAuth('/api/products')
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

  // Close modal on Escape key
  useEffect(() => {
    function handleEscape(e) {
      if (e.key === 'Escape' && showLoginModal) {
        setShowLoginModal(false)
        setLoginError(null)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [showLoginModal])

  async function handleLogin(e){
    e.preventDefault()
    setLoginError(null)
    setLoginLoading(true)
    try{
      const params = new URLSearchParams()
      params.append('grant_type', 'password')
      params.append('username', username)
      params.append('password', password)
      params.append('scope', '')
      const res = await fetch(`${API_BASE_URL}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      })
      if (!res.ok) throw new Error('Invalid credentials')
      const data = await res.json()
      if (!data.access_token) throw new Error('No token returned')
      localStorage.setItem('jwt', data.access_token)
      setToken(data.access_token)
      setActiveTab('dashboard') // Switch to dashboard after successful login
      setUsername('')
      setPassword('')
      setShowLoginModal(false) // Close modal on success
    }catch(err){
      setLoginError(err.message)
    } finally {
      setLoginLoading(false)
    }
  }

  function handleLogout(){
    localStorage.removeItem('jwt')
    setToken(null)
    setActiveTab('submit') // Return to submit tab after logout
  }

  async function handleAddProduct(e){
    e.preventDefault()
    const form = e.target
    const name = new FormData(form).get('name')
    if (!name) return
    try{
      setProductMsg(null); setProductErr(null)
      const res = await fetchWithAuth('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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
      setProductErr(`⚠️ ${err.message}`)
    }
  }

  return (
    <>
      {/* Skip Navigation Link */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Header with Title - Only fixed when logged in (admin mode) */}
      {token && (
        <div className="header header-fixed">
          <h1>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" style={{
              width: '48px', 
              height: '48px', 
              verticalAlign: 'middle', 
              marginRight: '16px',
              marginBottom: '12px',
              display: 'inline-block'
            }}>
              <g transform="translate(30, 30)">
                {/* Bar 1 (shortest - blue) */}
                <rect x="-22" y="6" width="14" height="18" rx="3" fill="#60A5FA"/>
                
                {/* Bar 2 (medium - green) */}
                <rect x="-4" y="-10" width="14" height="34" rx="3" fill="#34D399"/>
                
                {/* Bar 3 (tallest - yellow) */}
                <rect x="14" y="-18" width="14" height="42" rx="3" fill="#FBBF24"/>
              </g>
            </svg>
            Multilingual Feedback Analyzer
          </h1>
        </div>
      )}

      {/* Navigation Tabs - Fixed below header */}
      {token && (
        <nav className="main-nav" role="navigation" aria-label="Main navigation">
          <button 
            className={activeTab === 'dashboard' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActiveTab('dashboard')}
            aria-current={activeTab === 'dashboard' ? 'page' : undefined}
          >
            📊 Dashboard
          </button>
          <button 
            className={activeTab === 'submit' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActiveTab('submit')}
            aria-current={activeTab === 'submit' ? 'page' : undefined}
          >
            ✍️ Submit Feedback
          </button>
          <button 
            className={activeTab === 'settings' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActiveTab('settings')}
            aria-current={activeTab === 'settings' ? 'page' : undefined}
          >
            ⚙️ Settings
          </button>
          <button 
            onClick={handleLogout} 
            className="nav-btn logout-btn"
            aria-label="Logout from admin panel"
          >
            🚪 Logout
          </button>
        </nav>
      )}

      {/* Scrollable Content Container */}
      <div className={token ? "container" : "container container-no-nav"}>
        {/* Non-fixed header for user mode (not logged in) */}
        {!token && (
          <div className="header header-inline">
            <h1>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" style={{
                width: '48px', 
                height: '48px', 
                verticalAlign: 'middle', 
                marginRight: '16px',
                marginBottom: '12px',
                display: 'inline-block'
              }}>
                <g transform="translate(30, 30)">
                  {/* Bar 1 (shortest - blue) */}
                  <rect x="-22" y="6" width="14" height="18" rx="3" fill="#60A5FA"/>
                  
                  {/* Bar 2 (medium - green) */}
                  <rect x="-4" y="-10" width="14" height="34" rx="3" fill="#34D399"/>
                  
                  {/* Bar 3 (tallest - yellow) */}
                  <rect x="14" y="-18" width="14" height="42" rx="3" fill="#FBBF24"/>
                </g>
              </svg>
              Multilingual Feedback Analyzer
            </h1>
          </div>
        )}

        {/* Session Expired Message */}
        {sessionExpiredMsg && (
          <div className="error-message" style={{marginBottom: '20px', textAlign: 'center'}}>
            ⚠️ {sessionExpiredMsg}
          </div>
        )}

        {/* Tab Content */}
      <div id="main-content" className="tab-content" role="main">
        {/* Submit Tab - Always visible for non-authenticated, or when selected */}
        {(!token || activeTab === 'submit') && (
          <div className="card submit-card">
            <h2>✍️ Submit Feedback</h2>
            {/* Key forces remount on auth transitions to clear internal form state */}
            <Submit 
              key={token ? 'auth' : 'guest'} 
              products={products} 
              productsLoading={productsLoading}
              setFeedbackMsg={setFeedbackMsg}
              setFeedbackErr={setFeedbackErr}
            />
            
            {/* Admin Login Link - Subtle placement at bottom */}
            {!token && (
              <div style={{textAlign: 'center', marginTop: '20px'}}>
                <button 
                  className="admin-link"
                  onClick={() => {
                    setShowLoginModal(true)
                    setSessionExpiredMsg(null)
                  }}
                  aria-label="Open admin login"
                >
                  Admin? Sign in here →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Dashboard Tab - Only for authenticated users */}
        {token && activeTab === 'dashboard' && (
          <div className="card full-width">
            <h2>Dashboard</h2>
            <Dashboard 
              token={token} 
              setBulkMsg={setBulkMsg}
              setBulkError={setBulkError}
            />
          </div>
        )}

        {/* Settings Tab - Only for authenticated users */}
        {token && activeTab === 'settings' && (
          <div className="settings-layout">
            <div className="card" style={{minHeight: '450px'}}>
              <h2>Manage Products</h2>
              <div className="form-group">
                <form onSubmit={handleAddProduct}>
                  <label htmlFor="new-product">Add Product</label>
                  <div style={{display:'flex', gap:8}}>
                    <input id="new-product" name="name" placeholder="Product name" />
                    <button type="submit" style={{width:'auto'}}>Add</button>
                  </div>
                </form>
              </div>
              <h3 style={{marginTop:12}}>Products</h3>
              <ProductsManager 
                products={products}
                productsLoading={productsLoading}
                productsError={productsError}
                setProductMsg={setProductMsg}
                setProductErr={setProductErr}
                loadProducts={loadProducts}
              />
            </div>
            <div className="card">
              <h2>Gemini AI Model</h2>
              <GeminiModelSelector setMsg={setGeminiMsg} setErr={setGeminiErr} />
            </div>
            <div className="card">
              <h2>Change Password</h2>
              <ChangePassword setMsg={setPasswordMsg} setErr={setPasswordErr} />
            </div>
          </div>
        )}
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <>
          {/* Modal Overlay */}
          <div 
            className="modal-overlay"
            onClick={() => {
              setShowLoginModal(false)
              setLoginError(null)
            }}
          />
          
          {/* Modal Content */}
          <div className="modal-content" role="dialog" aria-labelledby="login-modal-title" aria-modal="true">
            <div className="modal-header">
              <h2 id="login-modal-title">🔐 Admin Login</h2>
              <button 
                className="modal-close-btn"
                onClick={() => {
                  setShowLoginModal(false)
                  setLoginError(null)
                }}
                aria-label="Close login modal"
              >
                ✖
              </button>
            </div>
            
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input 
                  id="username" 
                  value={username} 
                  onChange={e=>setUsername(e.target.value)} 
                  placeholder="admin"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input 
                  id="password" 
                  type="password" 
                  value={password} 
                  onChange={e=>setPassword(e.target.value)} 
                  placeholder="Enter password"
                  required
                />
              </div>
              <button type="submit" className="btn-primary" disabled={loginLoading}>
                {loginLoading ? 'Logging in...' : 'Login'}
              </button>
              {loginError && <div className="error-message" role="alert">{loginError}</div>}
            </form>
            
            <p className="hint" style={{marginTop: '16px', textAlign: 'center'}}>
              Admin can view stats, manage feedback, and add products.
            </p>
          </div>
        </>
      )}
      
      {/* Toast Notification Container - Rendered via Portal */}
      {createPortal(
        <div className="toast-container">
          {productMsg && (
            <div className={`toast toast-success ${productMsgFadingOut ? 'fade-out' : ''}`}>
              {productMsg}
            </div>
          )}
          {productErr && (
            <div className="toast toast-error">
              {productErr}
            </div>
          )}
          {bulkMsg && (
            <div className={`toast toast-success ${bulkMsgFadingOut ? 'fade-out' : ''}`}>
              {bulkMsg}
            </div>
          )}
          {bulkError && (
            <div className="toast toast-error">
              {bulkError}
            </div>
          )}
          {geminiMsg && (
            <div className={`toast toast-success ${geminiMsgFadingOut ? 'fade-out' : ''}`}>
              {geminiMsg}
            </div>
          )}
          {geminiErr && (
            <div className="toast toast-error">
              {geminiErr}
            </div>
          )}
          {passwordMsg && (
            <div className={`toast toast-success ${passwordMsgFadingOut ? 'fade-out' : ''}`}>
              {passwordMsg}
            </div>
          )}
          {passwordErr && (
            <div className="toast toast-error">
              {passwordErr}
            </div>
          )}
          {feedbackMsg && (
            <div className={`toast toast-success ${feedbackMsgFadingOut ? 'fade-out' : ''}`}>
              {feedbackMsg}
            </div>
          )}
          {feedbackErr && (
            <div className="toast toast-error">
              {feedbackErr}
            </div>
          )}
        </div>,
        document.body
      )}
      </div>
    </>
  )
}
