/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - ROOT CONTAINMENT BOUNDARY (PHASE 1)
 * Eliminates raw white-screen fatal crashes across the entire SPA lifecycle.
 * Captures render exceptions, isolates DOM failures, provides cryptographic
 * incident tracking IDs, and dispatches structured telemetry diagnostics.
 * ============================================================================
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  ShieldAlert,
  RefreshCw,
  Home,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  LifeBuoy,
  Terminal,
} from 'lucide-react';

export interface RootErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((props: { error: Error; incidentId: string; reset: () => void }) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo, incidentId: string) => void;
}

export interface RootErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  incidentId: string | null;
  copied: boolean;
  showDetails: boolean;
}

export interface CrashTelemetryPayload {
  incidentId: string;
  name: string;
  message: string;
  stack?: string;
  componentStack?: string | null;
  url: string;
  pathname: string;
  search: string;
  userAgent: string;
  timestamp: string;
}

/**
 * Generates a cryptographically secure, user-facing Incident ID.
 * Follows UUIDv4 format or standardized high-entropy fallback.
 */
export function generateIncidentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback if randomUUID is restricted
    }
  }

  // 128-bit CSPRNG fallback
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  }

  // Final deterministic fallback
  return `EE-INC-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`.toUpperCase();
}

/**
 * Sanitizes potentially sensitive tokens, passwords, or keys from error messages.
 */
export function sanitizeCrashContext(text: string): string {
  if (!text) return '';
  return text
    .replace(/(Bearer\s+)[A-Za-z0-9-_.]+/gi, '$1[REDACTED]')
    .replace(/(token["']?\s*[:=]\s*["']?)[A-Za-z0-9-_.]+/gi, '$1[REDACTED]')
    .replace(/(password["']?\s*[:=]\s*["']?)[^\s,"']+/gi, '$1[REDACTED]');
}

export class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  constructor(props: RootErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      incidentId: null,
      copied: false,
      showDetails: false,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<RootErrorBoundaryState> {
    // 1. Dynamic bundle chunk mismatch auto-recovery (new deployment asset missing on CDN)
    const isChunkMismatch =
      error &&
      error.message &&
      (error.message.includes('dynamically imported module') ||
        error.message.includes('Importing a module script failed') ||
        error.message.includes('Loading chunk') ||
        error.message.includes('Failed to fetch dynamically imported module'));

    if (isChunkMismatch && typeof window !== 'undefined') {
      const storageKey = 'elite_last_chunk_reload';
      const now = Date.now();
      const lastReload = Number(sessionStorage.getItem(storageKey) || 0);

      // Only auto-reload if not reloaded within the last 10 seconds (prevents reload loop)
      if (now - lastReload > 10000) {
        sessionStorage.setItem(storageKey, String(now));
        window.location.reload();
        return { hasError: false };
      }
    }

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

    // 1. Structured location and browser environment metadata
    const telemetryPayload: CrashTelemetryPayload = {
      incidentId,
      name: error?.name || 'Error',
      message: sanitizeCrashContext(error?.message || 'Unknown render exception'),
      stack: error?.stack ? sanitizeCrashContext(error.stack) : undefined,
      componentStack: errorInfo?.componentStack ? sanitizeCrashContext(errorInfo.componentStack) : null,
      url: typeof window !== 'undefined' ? window.location.href : '',
      pathname: typeof window !== 'undefined' ? window.location.pathname : '',
      search: typeof window !== 'undefined' ? window.location.search : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timestamp: new Date().toISOString(),
    };

    // 2. Dispatch sanitized console diagnostic report
    console.group(`🚨 [RootErrorBoundary Crash Incident ${incidentId}]`);
    console.error('Exception Name:', telemetryPayload.name);
    console.error('Exception Message:', telemetryPayload.message);
    console.error('Location:', telemetryPayload.url);
    if (error?.stack) console.error('Stack Trace:', telemetryPayload.stack);
    if (errorInfo?.componentStack) console.error('Component Hierarchy:', telemetryPayload.componentStack);
    console.groupEnd();

    // 3. Queue event dispatch to client telemetry bridge
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('elite-telemetry-crash', {
          detail: telemetryPayload,
        })
      );
    }

    // 4. Invoke optional parent listener
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo, incidentId);
      } catch (cbErr) {
        console.warn('Error in RootErrorBoundary onError callback:', cbErr);
      }
    }
  }

  /**
   * Resets error boundary state to attempt in-place component recovery.
   */
  public handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      incidentId: null,
      copied: false,
      showDetails: false,
    });
  };

  /**
   * Performs an immediate hard refresh with a cache-busting query parameter.
   */
  public handleHardRefresh = (): void => {
    if (typeof window !== 'undefined') {
      try {
        if ('caches' in window) {
          caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
        }
      } catch {
        // Ignore cache API failures
      }
      const cacheBuster = `retry=${Date.now()}`;
      const search = window.location.search
        ? `${window.location.search}&${cacheBuster}`
        : `?${cacheBuster}`;
      window.location.href = `${window.location.pathname}${search}${window.location.hash}`;
    }
  };

  /**
   * Copies structured diagnostic report and Incident ID to clipboard.
   */
  public handleCopyIncident = (): void => {
    const { incidentId, error, errorInfo } = this.state;
    const report = [
      `Elite ERP Crash Report`,
      `=========================`,
      `Incident ID: ${incidentId}`,
      `Timestamp: ${new Date().toISOString()}`,
      `URL: ${typeof window !== 'undefined' ? window.location.href : 'N/A'}`,
      `Error: ${error?.message || 'Unknown'}`,
      `Stack:\n${error?.stack || 'N/A'}`,
      `Component Tree:\n${errorInfo?.componentStack || 'N/A'}`,
    ].join('\n');

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(report)
        .then(() => {
          this.setState({ copied: true });
          setTimeout(() => this.setState({ copied: false }), 3000);
        })
        .catch(() => this.fallbackCopy(report));
    } else {
      this.fallbackCopy(report);
    }
  };

  private fallbackCopy(text: string): void {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 3000);
    } catch (e) {
      console.warn('Fallback copy failed:', e);
    }
  }

  /**
   * Pre-fills and opens support escalation with the Incident ID.
   */
  public handleContactSupport = (): void => {
    const { incidentId, error } = this.state;
    const subject = encodeURIComponent(`[CRASH INCIDENT] Support Escalation (${incidentId})`);
    const body = encodeURIComponent(
      `Hello Elite Support Team,\n\nI encountered an unexpected application crash.\n\nIncident ID: ${incidentId}\nError: ${error?.message || 'N/A'}\nURL: ${typeof window !== 'undefined' ? window.location.href : ''}\n\nPlease assist.\n`
    );
    window.open(`mailto:support@eliteedition.in?subject=${subject}&body=${body}`, '_blank');
  };

  public render(): ReactNode {
    const { hasError, error, errorInfo, incidentId, copied, showDetails } = this.state;
    const { children, fallback } = this.props;

    if (!hasError) {
      return children;
    }

    // Custom fallback render prop support
    if (typeof fallback === 'function' && error && incidentId) {
      return fallback({ error, incidentId, reset: this.handleReset });
    }
    if (fallback) {
      return fallback;
    }

    return (
      <div
        role="alert"
        aria-live="assertive"
        data-testid="root-error-boundary-screen"
        style={{
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #090d16 0%, #0f172a 100%)',
          color: '#f8fafc',
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            maxWidth: '640px',
            width: '100%',
            background: 'rgba(30, 41, 59, 0.75)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 35px rgba(239, 68, 68, 0.1)',
            padding: '2.25rem',
            boxSizing: 'border-box',
          }}
        >
          {/* Header Icon & Brand Tag */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                }}
              >
                <ShieldAlert size={28} />
              </div>
              <div>
                <h1
                  style={{
                    fontSize: '1.35rem',
                    fontWeight: 800,
                    margin: 0,
                    color: '#ffffff',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Application Shield Activated
                </h1>
                <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 500 }}>
                  Fatal client-side rendering exception safely isolated
                </span>
              </div>
            </div>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '4px 10px',
                borderRadius: '20px',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                letterSpacing: '0.04em',
              }}
            >
              System Safeguard
            </span>
          </div>

          <p
            style={{
              fontSize: '0.92rem',
              lineHeight: 1.55,
              color: '#cbd5e1',
              margin: '0 0 1.5rem 0',
            }}
          >
            An unexpected error occurred while rendering the current view. The application isolated
            the fault to prevent raw data corruption and avoid a complete browser freeze.
          </p>

          {/* Incident ID Chip */}
          <div
            data-testid="incident-id-chip"
            style={{
              background: '#090d16',
              border: '1px solid #334155',
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: '#64748b',
                  letterSpacing: '0.05em',
                  marginBottom: '2px',
                }}
              >
                Support Incident Reference ID
              </div>
              <div
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#38bdf8',
                  wordBreak: 'break-all',
                }}
              >
                {incidentId}
              </div>
            </div>

            <button
              type="button"
              onClick={this.handleCopyIncident}
              aria-label="Copy incident report"
              style={{
                background: copied ? '#10b981' : 'rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '0.45rem 0.85rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy ID'}</span>
            </button>
          </div>

          {/* Primary Action Buttons */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem',
              marginBottom: '1.25rem',
            }}
          >
            <button
              type="button"
              onClick={this.handleHardRefresh}
              data-testid="hard-refresh-btn"
              style={{
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                fontSize: '0.86rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
              }}
            >
              <RefreshCw size={16} />
              <span>Hard Refresh & Clear Cache</span>
            </button>

            <button
              type="button"
              onClick={this.handleReset}
              data-testid="recover-view-btn"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                color: '#e2e8f0',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                fontSize: '0.86rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
              }}
            >
              <Home size={16} />
              <span>Try Again / Recover</span>
            </button>

            <button
              type="button"
              onClick={this.handleContactSupport}
              data-testid="contact-support-btn"
              style={{
                background: 'transparent',
                color: '#94a3b8',
                border: '1px dashed #475569',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                fontSize: '0.86rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
              }}
            >
              <LifeBuoy size={16} />
              <span>Contact Support</span>
            </button>
          </div>

          {/* Technical Diagnostics Accordion */}
          <div
            style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingTop: '0.85rem',
            }}
          >
            <button
              type="button"
              onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: '0.78rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <Terminal size={14} />
              <span>{showDetails ? 'Hide Technical Diagnostics' : 'Show Technical Diagnostics'}</span>
              {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showDetails && (
              <div
                data-testid="crash-technical-details"
                style={{
                  marginTop: '0.75rem',
                  padding: '0.85rem',
                  borderRadius: '8px',
                  background: '#090d16',
                  border: '1px solid #1e293b',
                  fontSize: '0.75rem',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  color: '#f87171',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: '4px' }}>
                  {error?.name || 'Error'}: {error?.message}
                </div>
                {error?.stack && <div style={{ color: '#64748b' }}>{error.stack}</div>}
                {errorInfo?.componentStack && (
                  <div style={{ color: '#38bdf8', marginTop: '6px' }}>
                    {errorInfo.componentStack}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}
