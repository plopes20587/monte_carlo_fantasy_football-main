import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initGA } from './analytics'

// Initialize Google Analytics with error handling
try {
  initGA();
} catch (error) {
  console.warn('Failed to initialize analytics:', error);
  // App continues to function without analytics
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)


