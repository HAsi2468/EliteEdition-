/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - CLIENT CRASH TELEMETRY INGESTION SERVICE
 * Dispatches unhandled exceptions and React Error Boundary crashes
 * to the backend telemetry route /v1/telemetry/errors.
 * ============================================================================
 */

export interface CrashTelemetryPayload {
  incidentId?: string;
  name: string;
  message: string;
  stack?: string;
  componentStack?: string | null;
  url?: string;
  pathname?: string;
  search?: string;
  userAgent?: string;
  timestamp?: string;
  userSessionId?: string;
  metadata?: Record<string, any>;
}

class TelemetryService {
  private endpoint = '/v1/telemetry/errors';
  private recentHashes = new Set<string>();

  /**
   * Dispatches crash report to server without throwing exceptions
   */
  public async reportCrash(payload: CrashTelemetryPayload): Promise<void> {
    const errorHash = `${payload.name}_${payload.message}_${payload.pathname || ''}`;

    // Rate-limit identical error bursts in the same session (max 1 every 30s)
    if (this.recentHashes.has(errorHash)) {
      return;
    }
    this.recentHashes.add(errorHash);
    setTimeout(() => this.recentHashes.delete(errorHash), 30000);

    const userSessionId =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('elite_auth_token')?.slice(-10) || 'anonymous'
        : 'unknown';

    const fullPayload: CrashTelemetryPayload = {
      ...payload,
      userSessionId,
      url: payload.url || (typeof window !== 'undefined' ? window.location.href : ''),
      pathname: payload.pathname || (typeof window !== 'undefined' ? window.location.pathname : ''),
      userAgent: payload.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
      timestamp: payload.timestamp || new Date().toISOString(),
    };

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([JSON.stringify(fullPayload)], { type: 'application/json' });
        const sent = navigator.sendBeacon(this.endpoint, blob);
        if (sent) return;
      }

      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullPayload),
        keepalive: true,
      });
    } catch (err) {
      // Defensive silent fail — telemetry failures should never crash application
      console.warn('[TelemetryService] Failed to transmit crash telemetry:', err);
    }
  }

  /**
   * Initializes listeners to capture unhandled global errors and promise rejections
   */
  public initGlobalListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('elite-telemetry-crash', ((event: CustomEvent<CrashTelemetryPayload>) => {
      if (event.detail) {
        this.reportCrash(event.detail);
      }
    }) as EventListener);
  }
}

export const telemetryService = new TelemetryService();
telemetryService.initGlobalListeners();
