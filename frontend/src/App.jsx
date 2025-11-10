import React from 'react'
import Submit from './pages/Submit'
import Dashboard from './pages/Dashboard'

export default function App(){
  return (
    <div className="container">
      <h1>📊 Feedback Analyzer</h1>
      <div className="main">
        <div className="card">
          <h2>Submit Feedback</h2>
          <Submit />
        </div>
        <div className="card">
          <h2>Dashboard</h2>
          <Dashboard />
        </div>
      </div>
    </div>
  )
}
