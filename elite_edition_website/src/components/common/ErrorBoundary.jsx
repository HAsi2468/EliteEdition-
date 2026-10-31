import React, { Component } from 'react';

/**
 * Global & Component-Level Error Boundary
 * Catches unhandled JavaScript exceptions, rendering a clean one-line recovery interface.
 */

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  componentDidMount() {
    this._resetOnNav = () => {
      if (this.state.hasError) {
        this.setState({ hasError: false, error: null });
      }
    };
    window.addEventListener('hashchange', this._resetOnNav);
    window.addEventListener('popstate', this._resetOnNav);
    window.addEventListener('elite-route-change', this._resetOnNav);
  }

  componentWillUnmount() {
    if (this._resetOnNav) {
      window.removeEventListener('hashchange', this._resetOnNav);
      window.removeEventListener('popstate', this._resetOnNav);
      window.removeEventListener('elite-route-change', this._resetOnNav);
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        for (const reg of regs) {
          try { reg.update(); } catch (e) {}
        }
      }).catch(() => {});
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      const msg = this.state.error?.message || '';
      const isChunkOrInitError = msg.includes('initialization') ||
                                 msg.includes('dynamically imported module') ||
                                 msg.includes('Loading chunk') ||
                                 msg.includes('Failed to fetch') ||
                                 isOffline;

      return (
        <div
          style={{
            padding: '36px 24px',
            textAlign: 'center',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            margin: '24px auto',
            maxWidth: '520px',
            boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.06)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb',
              marginBottom: '2px'
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
            {isOffline ? 'You Are Currently Offline' : 'Something went wrong loading this screen'}
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, maxWidth: '440px' }}>
            {isOffline
              ? 'This screen requires an active internet connection to load live analytics. Check your Wi-Fi/mobile data and tap Reload.'
              : isChunkOrInitError
              ? 'A recent update was deployed or network connection was interrupted. Please reload the page to load the updated module.'
              : msg || 'An unexpected error occurred.'}
          </div>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '9px 22px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: '6px',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.28)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#1d4ed8';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.38)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#2563eb';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(37, 99, 235, 0.28)';
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
              <path d="M16 21h5v-5"/>
            </svg>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
