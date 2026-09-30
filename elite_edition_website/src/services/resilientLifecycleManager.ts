/**
 * ============================================================================
 * ELITE EDITION ENTERPRISE - RESILIENT LIFECYCLE & HEARTBEAT MANAGER
 * Prevents false "offline" states in industrial/enterprise workstation tabs.
 * ============================================================================
 * 
 * Key Capabilities:
 * 1. Web Worker Heartbeat: Bypasses Chrome background tab setInterval throttling (1-5 min clamping).
 * 2. W3C Page Lifecycle API: Listens to visibilitychange, freeze, resume, pageshow, and focus.
 * 3. Active Connectivity Probing: Solves the `navigator.onLine` fallacy using lightweight /ping probing.
 * 4. Exponential Backoff with Randomized Jitter: Eliminates thundering herd on factory network recovery.
 * 5. Singleton Event Bus: Broadcasts live connectivity transitions across the application.
 */

export type ConnectionState = 'CONNECTED' | 'RECONNECTING' | 'OFFLINE' | 'FROZEN';

export interface HeartbeatConfig {
  /**
   * Health ping endpoint URL (defaults to /v1/auth/ping)
   */
  pingEndpoint?: string;
  /**
   * Active heartbeat interval in milliseconds when tab is focused (default: 15000ms = 15s)
   */
  activeIntervalMs?: number;
  /**
   * Background heartbeat interval in milliseconds when tab is blurred (default: 30000ms = 30s)
   */
  backgroundIntervalMs?: number;
  /**
   * Ping request timeout before considering probe failed (default: 4000ms = 4s)
   */
  probeTimeoutMs?: number;
  /**
   * Base reconnection delay for exponential backoff (default: 1000ms = 1s)
   */
  baseReconnectDelayMs?: number;
  /**
   * Maximum reconnection delay cap (default: 15000ms = 15s)
   */
  maxReconnectDelayMs?: number;
  /**
   * Random jitter factor (default: 0.3 -> ±30% variance)
   */
  jitterFactor?: number;
}

export type StateChangeListener = (state: ConnectionState, meta?: { latencyMs?: number; attempt?: number }) => void;

class ResilientLifecycleManager {
  private state: ConnectionState = 'CONNECTED';
  private config: Required<HeartbeatConfig>;
  private listeners: Set<StateChangeListener> = new Set();
  
  private worker: Worker | null = null;
  private intervalTimerId: number | null = null;
  private reconnectTimerId: number | null = null;
  
  private consecutiveFailures = 0;
  private isProbing = false;
  private lastSuccessfulPingTime = Date.now();
  private hasInitialized = false;

  constructor(customConfig: HeartbeatConfig = {}) {
    this.config = {
      pingEndpoint: customConfig.pingEndpoint || '/v1/auth/ping',
      activeIntervalMs: customConfig.activeIntervalMs || 15000,
      backgroundIntervalMs: customConfig.backgroundIntervalMs || 30000,
      probeTimeoutMs: customConfig.probeTimeoutMs || 4000,
      baseReconnectDelayMs: customConfig.baseReconnectDelayMs || 1000,
      maxReconnectDelayMs: customConfig.maxReconnectDelayMs || 15000,
      jitterFactor: customConfig.jitterFactor || 0.3,
    };
  }

  /**
   * Initializes browser lifecycle listeners and heartbeat engine
   */
  public init(): void {
    if (this.hasInitialized || typeof window === 'undefined') return;
    this.hasInitialized = true;

    this.bindBrowserLifecycleEvents();
    this.initWorkerOrFallbackHeartbeat();

    // Perform an initial immediate active probe
    this.checkRealConnectivity();
  }

  /**
   * Subscribes a listener to connectivity state changes
   */
  public onStateChange(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    // Immediately emit current state
    listener(this.state, { latencyMs: 0, attempt: this.consecutiveFailures });
    return () => this.listeners.delete(listener);
  }

  /**
   * Returns the current connection state
   */
  public getState(): ConnectionState {
    return this.state;
  }

  /**
   * Force an immediate health probe and reconnect attempt
   */
  public async probeNow(reason = 'manual'): Promise<boolean> {
    return this.checkRealConnectivity(reason);
  }

  /**
   * Calculate exponential backoff with randomized jitter
   * Formula: delay = min(maxDelay, baseDelay * 2^attempt) * (1 ± jitter)
   */
  public calculateBackoffDelay(attempt: number): number {
    const { baseReconnectDelayMs, maxReconnectDelayMs, jitterFactor } = this.config;
    const exponential = Math.min(maxReconnectDelayMs, baseReconnectDelayMs * Math.pow(2, attempt));
    const randomJitter = (Math.random() * 2 - 1) * jitterFactor; // e.g. -0.3 to +0.3
    const finalDelay = Math.round(exponential * (1 + randomJitter));
    return Math.max(baseReconnectDelayMs, finalDelay);
  }

  /**
   * W3C Page Lifecycle & Visibility Event Integration
   */
  private bindBrowserLifecycleEvents(): void {
    // 1. Tab Visibility Change (User switches back to tab)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.updateHeartbeatInterval(this.config.activeIntervalMs);
        // Immediately probe real connectivity without waiting for next scheduled tick
        this.checkRealConnectivity('tab-became-visible');
      } else {
        // Tab backgrounded: reduce tick frequency to save battery/bandwidth while keeping alive
        this.updateHeartbeatInterval(this.config.backgroundIntervalMs);
      }
    });

    // 2. Window Focus (Workstation user clicks into browser)
    window.addEventListener('focus', () => {
      this.checkRealConnectivity('window-focus');
    });

    // 3. W3C Page Lifecycle: 'freeze' (Browser hibernates background tab to reclaim CPU/RAM)
    window.addEventListener('freeze', () => {
      this.setState('FROZEN');
    });

    // 4. W3C Page Lifecycle: 'resume' (Browser wakes frozen tab when user returns)
    window.addEventListener('resume', () => {
      this.setState('RECONNECTING');
      this.checkRealConnectivity('tab-resumed-from-freeze');
    });

    // 5. Back-Forward Cache (bfcache) restore
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        this.setState('RECONNECTING');
        this.checkRealConnectivity('pageshow-persisted');
      }
    });

    // 6. Network online / offline events
    window.addEventListener('online', () => {
      // Don't blindly trust navigator.onLine; immediately verify with ping probe
      this.setState('RECONNECTING');
      this.checkRealConnectivity('network-online-event');
    });

    window.addEventListener('offline', () => {
      this.setState('OFFLINE');
      this.scheduleReconnect();
    });
  }

  /**
   * Initializes Web Worker for un-throttled background heartbeat ticking.
   * Browsers clamp background tab `setInterval` to 1 min or 5 min.
   * Dedicated Web Workers run in a distinct thread and are NOT clamped by standard DOM throttling.
   */
  private initWorkerOrFallbackHeartbeat(): void {
    try {
      const workerCode = `
        let timer = null;
        self.onmessage = function(e) {
          if (e.data.action === 'start') {
            clearInterval(timer);
            timer = setInterval(() => self.postMessage('tick'), e.data.intervalMs);
          } else if (e.data.action === 'stop') {
            clearInterval(timer);
          } else if (e.data.action === 'setInterval') {
            clearInterval(timer);
            timer = setInterval(() => self.postMessage('tick'), e.data.intervalMs);
          }
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(workerUrl);

      this.worker.onmessage = () => {
        this.checkRealConnectivity('worker-tick');
      };

      this.worker.postMessage({
        action: 'start',
        intervalMs: this.config.activeIntervalMs,
      });
    } catch {
      // Fallback for sandboxed iframes or environments blocking Blob Workers
      this.startDomInterval(this.config.activeIntervalMs);
    }
  }

  private updateHeartbeatInterval(intervalMs: number): void {
    if (this.worker) {
      this.worker.postMessage({ action: 'setInterval', intervalMs });
    } else {
      this.startDomInterval(intervalMs);
    }
  }

  private startDomInterval(intervalMs: number): void {
    if (this.intervalTimerId) clearInterval(this.intervalTimerId);
    this.intervalTimerId = window.setInterval(() => {
      this.checkRealConnectivity('dom-timer-tick');
    }, intervalMs);
  }

  /**
   * Active Connectivity Probing Routine:
   * Solves the navigator.onLine fallacy by performing a lightweight fetch against /ping.
   * Includes cache busting, credentials, and an strict AbortController timeout.
   */
  private async checkRealConnectivity(_triggerReason = 'periodic'): Promise<boolean> {
    if (this.isProbing) return this.state === 'CONNECTED';
    this.isProbing = true;

    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.probeTimeoutMs);

    try {
      // Cache-busting parameter prevents stale browser HTTP cache responses
      const url = `${this.config.pingEndpoint}${this.config.pingEndpoint.includes('?') ? '&' : '?'}t=${Date.now()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - startTime);

      if (response.ok || response.status === 304 || response.status === 401) {
        // 401 Unauthorized still proves valid IP connectivity to our backend!
        this.consecutiveFailures = 0;
        this.lastSuccessfulPingTime = Date.now();
        this.setState('CONNECTED', { latencyMs, attempt: 0 });
        this.isProbing = false;
        return true;
      } else {
        throw new Error(`Probe returned HTTP ${response.status}`);
      }
    } catch {
      clearTimeout(timeoutId);
      this.consecutiveFailures++;

      // If disconnected for > 1 consecutive probe, declare reconnecting/offline
      if (this.consecutiveFailures >= 2) {
        this.setState('OFFLINE', { attempt: this.consecutiveFailures });
      } else {
        this.setState('RECONNECTING', { attempt: this.consecutiveFailures });
      }

      this.scheduleReconnect();
      this.isProbing = false;
      return false;
    }
  }

  /**
   * Schedules a jittered exponential backoff reconnect probe
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimerId) return;

    const delay = this.calculateBackoffDelay(this.consecutiveFailures);
    this.reconnectTimerId = window.setTimeout(() => {
      this.reconnectTimerId = null;
      this.checkRealConnectivity('reconnect-timer');
    }, delay);
  }

  /**
   * Internal state transition and notification broadcaster
   */
  private setState(newState: ConnectionState, meta?: { latencyMs?: number; attempt?: number }): void {
    if (this.state === newState && newState !== 'CONNECTED') return;
    this.state = newState;

    for (const listener of this.listeners) {
      try {
        listener(this.state, meta);
      } catch (err) {
        console.error('[ResilientLifecycleManager] Listener threw error:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('elite-connectivity-status', {
          detail: { state: this.state, ...meta, timestamp: Date.now() },
        })
      );
    }
  }

  /**
   * Destroy and clean up resources
   */
  public destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.intervalTimerId) clearInterval(this.intervalTimerId);
    if (this.reconnectTimerId) clearTimeout(this.reconnectTimerId);
    this.listeners.clear();
    this.hasInitialized = false;
  }
}

// Export singleton instance configured for Elite Edition ERP
export const lifecycleManager = new ResilientLifecycleManager();
export { ResilientLifecycleManager };
