/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - ROUTE-LEVEL ERROR BOUNDARY (PHASE 1)
 * Isolates component-level render crashes strictly to the active sub-route
 * or page tab. Preserves the global application shell (top navigation,
 * persistent sidebar, and notification drawer).
 * ============================================================================
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, LayoutDashboard, Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import { generateIncidentId, sanitizeCrashContext } from './RootErrorBoundary';

export interface RouteErrorBoundaryProps {
  children?: ReactNode;
  routeName?: string;
  onReset?: () => void;
  onNavigateHome?: () => void;
}

export interface RouteErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  incidentId: string | null;
  showDetails: boolean;
}

export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      incidentId: null,
      showDetails: false,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<RouteErrorBoundaryState> {
    const incidentId = generateIncidentId();
    return {
      hasError: true,
      error,
      incidentId,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const incidentId = this.state.incidentId || generateIncidentId();
    this.setState({ errorInfo, incidentId });

    console.group(`⚠️ [RouteErrorBoundary Isolated Crash (${this.props.routeName || 'SubRoute'})]`);
    console.error('Incident ID:', incidentId);
    console.error('Route:', this.props.routeName || window.location.pathname);
    console.error('Error:', error.message);
    if (error.stack) console.error('Stack:', error.stack);
    console.groupEnd();

    // Dispatch sub-route telemetry event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('elite-telemetry-route-crash', {
          detail: {
            incidentId,
            routeName: this.props.routeName || window.location.pathname,
            message: sanitizeCrashContext(error.message),
            timestamp: new Date().toISOString(),
          },
        })
      );
    }
  }

  public handleReloadRoute = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      incidentId: null,
      showDetails: false,
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public handleReturnToDashboard = (): void => {
    if (this.props.onNavigateHome) {
      this.props.onNavigateHome();
      this.handleReloadRoute();
      return;
    }

    if (typeof window !== 'undefined') {
      // Dispatch tab-switch event for custom SPA tab architecture
      window.dispatchEvent(
        new CustomEvent('elite-navigate-tab', { detail: { tab: 'dashboard' } })
      );
      this.handleReloadRoute();
    }
  };

  public render(): ReactNode {
    const { hasError, error, incidentId, showDetails } = this.state;
    const { children, routeName } = this.props;

    if (!hasError) {
      return children;
    }

    return (
      <div
        data-testid="route-error-boundary-card"
        style={{
          margin: '1.5rem',
          padding: '2rem',
          background: 'rgba(30, 41, 59, 0.6)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '14px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
          color: '#f8fafc',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
              flexShrink: 0,
            }}
          >
            <AlertCircle size={24} />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                Failed to Render {routeName ? `"${routeName}"` : 'This View'}
              </h2>
              <span
                data-testid="route-incident-id"
                style={{
                  fontSize: '0.72rem',
                  fontFamily: 'ui-monospace, monospace',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#fca5a5',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                Ref: {incidentId}
              </span>
            </div>

            <p style={{ margin: '0.5rem 0 1.25rem 0', fontSize: '0.86rem', color: '#94a3b8', lineHeight: 1.5 }}>
              A problem occurred while rendering this sub-module. The rest of the application remains
              fully operational.
            </p>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={this.handleReloadRoute}
                data-testid="reload-route-btn"
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.55rem 1rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                }}
              >
                <RefreshCw size={14} />
                <span>Reload Page View</span>
              </button>

              <button
                type="button"
                onClick={this.handleReturnToDashboard}
                data-testid="return-dashboard-btn"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#cbd5e1',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  padding: '0.55rem 1rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer',
                }}
              >
                <LayoutDashboard size={14} />
                <span>Return to Dashboard</span>
              </button>

              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                style={{
                  background: 'transparent',
                  color: '#64748b',
                  border: 'none',
                  padding: '0.55rem 0.5rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                }}
              >
                <Terminal size={13} />
                <span>{showDetails ? 'Hide Diagnostics' : 'View Diagnostics'}</span>
                {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>

            {/* Diagnostic Details */}
            {showDetails && (
              <div
                style={{
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  background: '#090d16',
                  border: '1px solid #1e293b',
                  fontSize: '0.75rem',
                  fontFamily: 'ui-monospace, monospace',
                  color: '#f87171',
                  maxHeight: '140px',
                  overflowY: 'auto',
                  wordBreak: 'break-word',
                }}
              >
                {error?.message || 'Unknown error'}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}
