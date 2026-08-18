import React from 'react';
import { ShieldAlert, RefreshCw, Home, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showStack: false
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("⚡ [Elite Edition Error Shield] Captured React Error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleCopyError = () => {
    const errText = `Elite Edition Error Report:\nTime: ${new Date().toISOString()}\nMessage: ${this.state.error?.message || 'Unknown'}\nStack: ${this.state.errorInfo?.componentStack || 'N/A'}`;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(errText).catch(() => {});
    } else {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = errText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch (e) {
        console.warn('Clipboard fallback failed:', e);
      }
    }
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2500);
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'An unexpected application error occurred.';

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: 'radial-gradient(circle at top, #1e293b 0%, #0f172a 100%)',
          color: '#f8fafc',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <div style={{
            maxWidth: '620px',
            width: '100%',
            background: 'rgba(30, 41, 59, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(225,29,72,0.3))',
                border: '1px solid rgba(239,68,68,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <ShieldAlert size={24} color="#fca5a5" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                  Elite Edition — System Safety Shield
                </h2>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '3px 0 0 0' }}>
                  An isolated rendering error occurred in this module. Your database state remains completely secure.
                </p>
              </div>
            </div>

            {/* Error Message Card */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              padding: '1rem 1.25rem',
              color: '#fca5a5',
              fontSize: '0.88rem',
              fontFamily: 'monospace',
              lineHeight: '1.5',
              wordBreak: 'break-word'
            }}>
              <strong>Error:</strong> {errorMsg}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={this.handleReset}
                style={{
                  flex: 1,
                  minWidth: '140px',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)'
                }}
              >
                <RefreshCw size={15} /> Try Again
              </button>

              <button
                onClick={this.handleReload}
                style={{
                  flex: 1,
                  minWidth: '140px',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#f8fafc',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem'
                }}
              >
                <Home size={15} /> Reload Page
              </button>

              <button
                onClick={this.handleCopyError}
                style={{
                  padding: '0.65rem 1rem',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: this.state.copied ? '#34d399' : '#94a3b8',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem'
                }}
                title="Copy Diagnostic Log"
              >
                {this.state.copied ? <Check size={14} /> : <Copy size={14} />}
                {this.state.copied ? 'Copied Log' : 'Copy Log'}
              </button>
            </div>

            {/* Expandable Diagnostic Stack Trace */}
            <div>
              <button
                onClick={() => this.setState(prev => ({ showStack: !prev.showStack }))}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: 0,
                  fontWeight: 600
                }}
              >
                {this.state.showStack ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {this.state.showStack ? 'Hide Component Trace' : 'View Diagnostic Technical Trace'}
              </button>

              {this.state.showStack && (
                <pre style={{
                  marginTop: '0.5rem',
                  background: '#090d16',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  fontSize: '0.72rem',
                  color: '#94a3b8',
                  maxHeight: '180px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}>
                  {this.state.errorInfo?.componentStack || 'No component stack trace available.'}
                </pre>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
