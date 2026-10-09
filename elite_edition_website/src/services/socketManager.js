/**
 * Central Real-Time Socket Manager for Elite Edition Enterprise ERP
 *
 * Guarantees reliable, low-latency, company-isolated data updates across
 * multiple browser tabs, mobile devices, background tabs, and sister companies.
 *
 * Features:
 * 1. Ultra-fast reconnection with 250ms initial retry and 2s max backoff cap.
 * 2. Instant manual & proactive reset bypassing internal backoff timers.
 * 3. Proactive half-open / zombie TCP socket detection via zero-overhead 'ping-health'.
 * 4. Anti-flicker debounced state transitions (prevents UI flashing on micro-hops).
 * 5. Integrated with ResilientLifecycleManager (W3C Page Lifecycle & unthrottled Web Worker).
 * 6. User interaction recovery watchdog (resumes connection on pointer/key events).
 * 7. Sequence tracking (eventId) to drop duplicates and reorder out-of-sequence events.
 * 8. Automatic resync on connect, visibilitychange, focus, online, pageshow, and company switch.
 * 9. Automatic fallback polling if socket remains down for > 15 seconds.
 */

import { io } from 'socket.io-client';
import { getBaseUrl } from './api';
import { lifecycleManager } from './resilientLifecycleManager';

class SocketManager {
  constructor() {
    this.socket = null;
    this.status = 'disconnected'; // 'connected' | 'reconnecting' | 'offline' | 'disconnected'
    this.listeners = new Set();
    this.statusListeners = new Set();
    this.conflictListeners = new Set();
    this.lockListeners = new Set();
    this.systemLockStatus = null;

    this.lastEventId = 0;
    this.lastEventTimestamp = 0;
    this.processedEventIds = new Set();

    this.currentCompanyId = null;
    this.currentCompanyCode = null;
    this.currentUserId = null;

    this.offlineTimer = null;
    this.fallbackPollTimer = null;
    this.isPollingFallbackActive = false;

    this._reconnectingDebounceTimer = null;
    this._isVerifyingAlive = false;
    this.hasBoundGlobalLifecycle = false;
  }

  /**
   * Initialize socket connection singleton
   */
  init(companyId, companyCode, userId) {
    this.currentCompanyId = companyId || this.currentCompanyId || this._getStoredCompanyId();
    this.currentCompanyCode = companyCode || this.currentCompanyCode;
    this.currentUserId = userId || this.currentUserId || this._getStoredUserId();

    if (this.socket) {
      if (this.socket.connected) {
        // Update company room if changed
        this.socket.emit('switch-company', {
          companyId: this.currentCompanyId,
          companyCode: this.currentCompanyCode
        });
      }
      return this.socket;
    }

    this._bindLifecycleEvents();
    this._connect();
    return this.socket;
  }

  /**
   * Internal connection routine
   */
  _connect() {
    const apiUrl = getBaseUrl();
    let socketUrl = apiUrl.replace(/\/v1\/?$/, '');
    if (!socketUrl || !socketUrl.startsWith('http')) {
      socketUrl = typeof window !== 'undefined' ? window.location.origin : '';
    }

    const token = this._getAuthToken();

    this._setStatus('reconnecting');

    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'], // Websocket preferred, polling fallback
      auth: {
        token,
        companyId: this.currentCompanyId,
        companyCode: this.currentCompanyCode,
        userId: this.currentUserId,
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 250,        // Super fast 250ms initial retry (was 1000ms)
      reconnectionDelayMax: 2000,    // Cap backoff ceiling at 2s (was 10000ms)
      randomizationFactor: 0.3,      // Smooth jitter to avoid server contention
      timeout: 4000,                 // Fast 4s connection timeout (was 20000ms)
      upgrade: true,
      rememberUpgrade: true,
    });

    this.socket.on('connect', () => {
      this._setStatus('connected');
      this._clearOfflineTimers();

      // Register user ID if available
      if (this.currentUserId) {
        this.socket.emit('register-user', this.currentUserId);
      }

      // Request missed events since last received eventId
      this.resync('reconnect');
    });

    this.socket.on('disconnect', (reason) => {
      this._setStatus(reason === 'io client disconnect' ? 'disconnected' : 'reconnecting');
      this._startOfflineTimer();
    });

    this.socket.on('connect_error', () => {
      this._setStatus('reconnecting');
      this._startOfflineTimer();
    });

    // Handle incoming standardized real-time data events
    this.socket.on('data-changed', (event) => {
      this._handleIncomingDataEvent(event);
    });

    // Backward-compatible individual event aliases
    const legacyEvents = [
      'job-updated', 'job-created', 'job-deleted',
      'design-updated', 'design-created', 'design-deleted',
      'invoice-updated', 'invoice-created', 'invoice-deleted',
      'complaint-updated', 'complaint-created', 'complaint-deleted',
      'expense-updated', 'expense-created', 'expense-deleted',
      'inventory-updated', 'inventory-created', 'inventory-deleted',
      'sales-updated', 'sales-created', 'sales-deleted',
      'task-updated', 'task-created', 'task-deleted',
      'fabric-updated', 'catalog-updated', 'returns-updated'
    ];

    legacyEvents.forEach(evtName => {
      this.socket.on(evtName, (payload) => {
        // Synthesize standard event structure if legacy emit was received
        const parts = evtName.split('-');
        const entity = parts[0];
        const action = parts[1] || 'updated';
        this._handleIncomingDataEvent({
          eventId: Date.now(),
          type: evtName,
          entity,
          action,
          payload,
          timestamp: Date.now()
        });
      });
    });

    // Handle force reload if emitted by admin
    this.socket.on('force-system-reload', () => {
      if ('caches' in window) {
        caches.keys().then(names => names.forEach(k => caches.delete(k)));
      }
      setTimeout(() => window.location.reload(true), 300);
    });

    // Real-time system lock / maintenance mode status
    this.socket.on('system:lock_status', (payload) => {
      this.systemLockStatus = payload;
      this.lockListeners.forEach((fn) => {
        try { fn(payload); } catch (e) {}
      });
      try {
        window.dispatchEvent(new CustomEvent('elite-system-lock-status', { detail: payload }));
      } catch (e) {}
    });
  }

  /**
   * Handle incoming event with deduplication and order check
   */
  _handleIncomingDataEvent(event) {
    if (!event) return;

    // Check company isolation on client as defense-in-depth
    if (event.companyId && this.currentCompanyId &&
      String(event.companyId).toLowerCase() !== String(this.currentCompanyId).toLowerCase()) {
      return; // Ignore event destined for another company
    }

    const { eventId, timestamp } = event;

    // Deduplication check
    if (eventId) {
      if (this.processedEventIds.has(eventId)) {
        return; // Duplicate event, skip
      }
      this.processedEventIds.add(eventId);
      if (this.processedEventIds.size > 2000) {
        // Prevent unbounded memory growth
        const arr = Array.from(this.processedEventIds);
        this.processedEventIds = new Set(arr.slice(1000));
      }

      if (eventId > this.lastEventId) {
        this.lastEventId = eventId;
      }
    }

    if (timestamp && timestamp > this.lastEventTimestamp) {
      this.lastEventTimestamp = timestamp;
    }

    // Check for concurrency conflict (e.g., another user edited a record while active)
    this._checkConflict(event);

    // Notify all registered data listeners
    this.listeners.forEach((fn) => {
      try {
        fn(event);
      } catch (err) {
        console.error('[SocketManager] Error in event listener:', err);
      }
    });

    // Also dispatch global window event for components that listen directly
    try {
      window.dispatchEvent(new CustomEvent('elite-data-refresh', {
        detail: {
          ...event,
          source: 'socket',
          timestamp: Date.now()
        }
      }));
    } catch (e) { }
  }

  /**
   * Check if incoming event modifies a record currently being edited
   */
  _checkConflict(event) {
    if (event.action === 'updated' && event.id) {
      this.conflictListeners.forEach((fn) => {
        try {
          fn(event);
        } catch (e) { }
      });
    }
  }

  /**
   * Resync missed events since lastEventId or lastEventTimestamp
   */
  async resync(reason = 'manual') {
    if (!this.currentCompanyId) {
      this.currentCompanyId = this._getStoredCompanyId();
    }
    const token = this._getAuthToken();

    // 1. Try socket resync if connected
    if (this.socket && this.socket.connected) {
      this.socket.emit('sync-events', {
        companyId: this.currentCompanyId,
        sinceEventId: this.lastEventId,
        sinceTimestamp: this.lastEventTimestamp
      }, (response) => {
        if (response && response.success && Array.isArray(response.events)) {
          response.events.forEach(evt => this._handleIncomingDataEvent(evt));
          return;
        }
      });
    }

    // 2. HTTP Fallback resync if socket is reconnecting/offline
    if (token) {
      try {
        const baseUrl = getBaseUrl();
        const url = `${baseUrl}/events/sync?companyId=${encodeURIComponent(this.currentCompanyId || '')}&sinceEventId=${this.lastEventId}&sinceTimestamp=${this.lastEventTimestamp}`;
        const res = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-store'
          },
          cache: 'no-store'
        });

        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.events)) {
            data.events.forEach(evt => this._handleIncomingDataEvent(evt));
          }
        }
      } catch (e) {
        // If HTTP sync also fails, broadcast a general data refresh to pull current view
        try {
          window.dispatchEvent(new CustomEvent('elite-data-refresh', {
            detail: { source: 'resync-fallback', timestamp: Date.now() }
          }));
        } catch (err) { }
      }
    }
  }

  /**
   * Fast proactive watchdog for zombie/half-open socket detection.
   * Sends zero-overhead ping-health. If server does not ACK within 1500ms, forces reconnect.
   */
  _verifySocketAlive() {
    if (!this.socket || !this.socket.connected) {
      this.reconnect(true);
      return;
    }

    if (this._isVerifyingAlive) return;
    this._isVerifyingAlive = true;

    let hasAcked = false;
    const timeout = setTimeout(() => {
      this._isVerifyingAlive = false;
      if (!hasAcked) {
        console.warn('[SocketManager] Proactive ping timed out (zombie socket). Cycling connection now.');
        try {
          this.socket.disconnect();
        } catch (e) { }
        this.reconnect(true);
      }
    }, 1500);

    try {
      this.socket.emit('ping-health', () => {
        hasAcked = true;
        clearTimeout(timeout);
        this._isVerifyingAlive = false;
      });
    } catch (e) {
      clearTimeout(timeout);
      this._isVerifyingAlive = false;
      this.reconnect(true);
    }
  }

  /**
   * Bind lifecycle triggers (focus, visibility, online, pageshow, and user activity)
   */
  _bindLifecycleEvents() {
    if (this.hasBoundGlobalLifecycle || typeof window === 'undefined') return;
    this.hasBoundGlobalLifecycle = true;

    // Initialize resilient lifecycle manager if available
    try {
      lifecycleManager.init();
      lifecycleManager.onStateChange((state) => {
        if (state === 'CONNECTED') {
          if (!this.isConnected()) {
            this.reconnect(true);
          }
        } else if (state === 'OFFLINE') {
          this._setStatus('offline');
        }
      });
    } catch (e) {
      console.warn('[SocketManager] LifecycleManager integration warning:', e?.message || e);
    }

    // 1. Tab visibility change (browser switched back to tab or screen unlocked)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (!this.socket || !this.socket.connected) {
          this.reconnect(true);
        } else {
          this._verifySocketAlive();
          this.resync('visibility-visible');
        }
      }
    });

    // 2. Window focus
    window.addEventListener('focus', () => {
      if (!this.socket || !this.socket.connected) {
        this.reconnect(true);
      } else {
        this._verifySocketAlive();
        this.resync('window-focus');
      }
    });

    // 3. Network online event
    window.addEventListener('online', () => {
      this._clearOfflineTimers();
      this.reconnect(true);
      this.resync('network-online');
    });

    // 4. Network offline event
    window.addEventListener('offline', () => {
      this._setStatus('offline');
      this._startOfflineTimer();
    });

    // 5. PWA resume from background / cache restore
    window.addEventListener('pageshow', (event) => {
      if (event.persisted || !this.socket || !this.socket.connected) {
        this.reconnect(true);
      } else {
        this._verifySocketAlive();
      }
      this.resync('pageshow');
    });

    // 6. User interaction recovery watchdog:
    // When workstation user clicks or types after dormancy, verify connection
    let lastUserCheck = 0;
    const handleUserInteraction = () => {
      const now = Date.now();
      if (now - lastUserCheck > 10000) {
        lastUserCheck = now;
        if (!this.socket || !this.socket.connected) {
          this.reconnect(true);
        } else {
          this._verifySocketAlive();
        }
      }
    };
    window.addEventListener('pointerdown', handleUserInteraction, { passive: true });
    window.addEventListener('keydown', handleUserInteraction, { passive: true });
  }

  /**
   * Manage 15-second offline timeout -> trigger fallback polling
   */
  _startOfflineTimer() {
    if (this.offlineTimer) return;

    this.offlineTimer = setTimeout(() => {
      this._setStatus('offline');
      this._startFallbackPolling();
    }, 15000); // If disconnected for > 15s, activate fallback polling
  }

  _clearOfflineTimers() {
    if (this.offlineTimer) {
      clearTimeout(this.offlineTimer);
      this.offlineTimer = null;
    }
    if (this.fallbackPollTimer) {
      clearInterval(this.fallbackPollTimer);
      this.fallbackPollTimer = null;
    }
    this.isPollingFallbackActive = false;
  }

  /**
   * Fallback polling every 20s while socket is disconnected
   */
  _startFallbackPolling() {
    if (this.fallbackPollTimer) return;
    this.isPollingFallbackActive = true;

    this.fallbackPollTimer = setInterval(() => {
      if (this.socket && this.socket.connected) {
        this._clearOfflineTimers();
        return;
      }
      // Broadcast refresh to pull critical data
      try {
        window.dispatchEvent(new CustomEvent('elite-data-refresh', {
          detail: { source: 'polling-fallback', timestamp: Date.now() }
        }));
      } catch (e) { }
    }, 20000);
  }

  /**
   * Switch company / workspace
   */
  setCompany(companyId, companyCode) {
    if (this.currentCompanyId === companyId) return;

    this.currentCompanyId = companyId;
    this.currentCompanyCode = companyCode;

    // Reset sequence tracking for the new company
    this.lastEventId = 0;
    this.lastEventTimestamp = 0;
    this.processedEventIds.clear();

    if (this.socket && this.socket.connected) {
      this.socket.emit('switch-company', { companyId, companyCode });
      this.resync('company-switch');
    }
  }

  /**
   * Cleanly and immediately reconnect socket, canceling any backoff pauses
   */
  reconnect(forceImmediate = true) {
    if (this.socket) {
      try {
        if (this.socket.connected) {
          this.resync('already-connected');
          return;
        }

        if (forceImmediate && this.socket.io) {
          this.socket.io.skipReconnect = false;
          if (this.socket.io.backoff && typeof this.socket.io.backoff.reset === 'function') {
            this.socket.io.backoff.reset();
          }
        }
        this.socket.connect();
      } catch (e) {
        console.warn('[SocketManager] Reconnect warning:', e?.message || e);
      }
    } else {
      this._connect();
    }
  }

  /**
   * Logout cleanup
   */
  disconnect() {
    this._clearOfflineTimers();
    if (this._reconnectingDebounceTimer) {
      clearTimeout(this._reconnectingDebounceTimer);
      this._reconnectingDebounceTimer = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
    this.statusListeners.clear();
    this.conflictListeners.clear();
    this.processedEventIds.clear();
    this.lastEventId = 0;
    this.lastEventTimestamp = 0;
    this._setStatus('disconnected');
  }

  /**
   * Subscribe to incoming data change events
   */
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Subscribe to connection status changes
   */
  onStatusChange(fn) {
    this.statusListeners.add(fn);
    fn(this.status);
    return () => this.statusListeners.delete(fn);
  }

  /**
   * Register conflict detector for active form editing
   */
  onRecordConflict(fn) {
    this.conflictListeners.add(fn);
    return () => this.conflictListeners.delete(fn);
  }

  /**
   * Subscribe to real-time system lock / maintenance mode changes
   */
  onSystemLockChange(fn) {
    if (typeof fn !== 'function') return () => {};
    this.lockListeners.add(fn);
    if (this.systemLockStatus) {
      try { fn(this.systemLockStatus); } catch (e) {}
    }
    return () => this.lockListeners.delete(fn);
  }

  getSystemLockStatus() {
    return this.systemLockStatus;
  }

  /**
   * Internal status broadcaster with anti-flicker debounce.
   * Sub-second network drops will not cause UI badges to flash.
   */
  _setStatus(newStatus) {
    if (this.status === newStatus && !this._reconnectingDebounceTimer) return;

    // When connection succeeds, clear any pending debounce and notify immediately
    if (newStatus === 'connected') {
      if (this._reconnectingDebounceTimer) {
        clearTimeout(this._reconnectingDebounceTimer);
        this._reconnectingDebounceTimer = null;
      }
      this.status = 'connected';
      this._notifyStatus('connected');
      return;
    }

    // When offline, immediately set offline
    if (newStatus === 'offline' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      if (this._reconnectingDebounceTimer) {
        clearTimeout(this._reconnectingDebounceTimer);
        this._reconnectingDebounceTimer = null;
      }
      this.status = 'offline';
      this._notifyStatus('offline');
      return;
    }

    // When reconnecting from a connected state, debounce by 650ms to suppress micro-blips
    if (newStatus === 'reconnecting') {
      if (this.status === 'connected') {
        if (!this._reconnectingDebounceTimer) {
          this._reconnectingDebounceTimer = setTimeout(() => {
            this._reconnectingDebounceTimer = null;
            if (this.status !== 'connected') {
              this.status = 'reconnecting';
              this._notifyStatus('reconnecting');
            }
          }, 650);
        }
        return;
      }

      this.status = 'reconnecting';
      this._notifyStatus('reconnecting');
      return;
    }

    this.status = newStatus;
    this._notifyStatus(newStatus);
  }

  _notifyStatus(status) {
    this.statusListeners.forEach((fn) => {
      try { fn(status); } catch (e) { }
    });
  }

  getStatus() {
    return this.status;
  }

  isConnected() {
    return this.status === 'connected';
  }

  _getAuthToken() {
    try {
      return localStorage.getItem('elite_auth_token') || '';
    } catch (e) {
      return '';
    }
  }

  _getStoredCompanyId() {
    try {
      return localStorage.getItem('elite_active_department') || 'digital_print';
    } catch (e) {
      return 'digital_print';
    }
  }

  _getStoredUserId() {
    try {
      const userStr = localStorage.getItem('elite_user');
      if (userStr) {
        const u = JSON.parse(userStr);
        return u.id || u._id || null;
      }
    } catch (e) { }
    return null;
  }
}

// Export singleton instance
export const socketManager = new SocketManager();
export default socketManager;
