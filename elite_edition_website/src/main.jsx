import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { SocketProvider } from './contexts/SocketContext.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <SocketProvider>
        <App />
      </SocketProvider>
    </ErrorBoundary>
  </StrictMode>,
)

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('PWA Service Worker registered successfully:', reg.scope);
      })
      .catch((err) => {
        console.error('PWA Service Worker registration failed:', err);
      });
  });
}

// Auto-heal dynamic import chunk errors after new deployments
window.addEventListener('unhandledrejection', (event) => {
  const msg = event?.reason?.message || '';
  if (msg.includes('dynamically imported module') || msg.includes('Importing a module script failed') || msg.includes('Failed to fetch')) {
    const storageKey = 'last_chunk_reload_time';
    const now = Date.now();
    const lastReload = Number(sessionStorage.getItem(storageKey) || 0);
    if (now - lastReload > 8000) {
      sessionStorage.setItem(storageKey, String(now));
      window.location.reload();
    }
  }
});

