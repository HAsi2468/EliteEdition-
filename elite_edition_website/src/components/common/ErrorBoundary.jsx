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

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '32px 16px',
            textAlign: 'center',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            margin: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
            Something went wrong loading this screen
          </div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </div>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              backgroundColor: '#0f172a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 16px',
              fontSize: '13px',
              cursor: 'pointer',
              marginTop: '4px'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
