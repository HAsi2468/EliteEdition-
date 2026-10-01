import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { SocketProvider } from './contexts/SocketContext.jsx'
import { RootErrorBoundary } from './components/RootErrorBoundary'
import { installGlobalDialogInterceptors } from './services/dialogService.js'
import { setupGlobalCrashListeners } from './utils/globalCrashListeners'

// Initialize enterprise dialog & global error and unhandled rejection interceptors
installGlobalDialogInterceptors()
setupGlobalCrashListeners()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary>
      <SocketProvider>
        <App />
      </SocketProvider>
    </RootErrorBoundary>
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

// Register service worker for PWA support on official domain and localhost
const isAllowedPwaHost = window.location.hostname.includes('eliteedition.in') || 
                         window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1';

if ('serviceWorker' in navigator && isAllowedPwaHost) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('PWA Service Worker registered successfully:', reg.scope);

        // Check if an update is already waiting
        if (reg.waiting) {
          window.dispatchEvent(new CustomEvent('pwa-update-available', { detail: { registration: reg } }));
        }

        // Listen for new service worker being installed
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                window.dispatchEvent(new CustomEvent('pwa-update-available', { detail: { registration: reg } }));
              }
            });
          }
        });
      })
      .catch((err) => {
        console.error('PWA Service Worker registration failed:', err);
      });
  });

  // Reload page when new service worker takes control
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
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

