import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    // Allow Render.com hosts and any other hosts (for production preview)
    allowedHosts: [
      'feedback-analyzer-frontend.onrender.com',
      '.onrender.com', // Allow all Render subdomains
      'localhost',
      '127.0.0.1'
    ],
    proxy: {
      '/api': {
        // Use BACKEND_URL env var if set (useful when running vite locally).
        // In Docker Compose the hostname `http://backend:8000` remains valid.
        target: process.env.BACKEND_URL || 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      // Also proxy auth routes to the backend so login works in dev/compose
      '/auth': {
        target: process.env.BACKEND_URL || 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
