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

// Strict Host Verification: Ensure users are never stranded on raw IP address
if (window.location.hostname === '3.7.174.180' || /^(\d{1,3}\.){3}\d{1,3}$/.test(window.location.hostname)) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((r) => r.unregister());
    });
  }
  if ('caches' in window) {
    caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
  }
  window.location.replace('https://erp.eliteedition.in' + window.location.pathname + window.location.search + window.location.hash);
}

// Register service worker for PWA support only on official domain
if ('serviceWorker' in navigator && window.location.hostname.includes('eliteedition.in')) {
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

