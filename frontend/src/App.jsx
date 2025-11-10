import React from 'react'
import Submit from './pages/Submit'
import Dashboard from './pages/Dashboard'

export default function App(){
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: 20 }}>
      <h1>Feedback Analyzer (Demo)</h1>
      <div style={{ display: 'flex', gap: 40 }}>
        <div style={{ flex: 1 }}>
          <h2>Submit Feedback</h2>
          <Submit />
        </div>
        <div style={{ flex: 1 }}>
          <h2>Dashboard</h2>
          <Dashboard />
        </div>
      </div>
    </div>
  )
}
