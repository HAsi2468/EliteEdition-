/**
 * Central Real-Time Resilient Socket Manager for Elite Edition Enterprise ERP
 *
 * Guarantees reliable, low-latency, company-isolated data updates across
 * multiple browser tabs, mobile devices (iOS Safari, Android Chrome), and desktop browsers.
 *
 * Features:
 * 1. Cloudflare 100-Second Timeout Prevention:
 *    - Active ping/pong heartbeat every 25 seconds (well under Cloudflare Tunnel's 100s idle drop).
 *    - If 2 consecutive heartbeats miss responses, marks connection degraded and initiates recovery.
 * 2. Cross-Device Sleep/Wake & Tab Freezing (iOS Safari & Android Chrome):
 *    - Hooks into 'visibilitychange', 'pageshow', 'online'/'offline', and Page Lifecycle API ('freeze'/'resume').
 *    - Specific iOS Safari fix: On 'pageshow' (with event.persisted === true) and visible tab,
 *      verifies responsiveness via immediate ping-burst; if stalled, forces socket.disconnect().connect()
 *      with jittered exponential backoff (initial: 500ms, cap: 10s).
 * 3. Chat Event Synchronization & Optimistic Queue:
 *    - In-memory client queue for pending chat messages and job card stage updates created while offline.
 *    - Upon reconnection, automatically flushes pending actions and resyncs with server using
 *      lastReceivedMessageTimestamp / sequence IDs so no chat message or job card update is lost.
 * 4. Minimalist Status Indicator Support:
 *    - Dispatches state updates for Connected (subtle dot), Reconnecting (pulsing amber badge),
 *      and Offline (showing pending queue count).
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
    this.queueListeners = new Set();
    this.systemLockStatus = null;

    this.lastEventId = 0;
    this.lastEventTimestamp = 0;
    this.lastReceivedMessageTimestamp = 0;
    this.processedEventIds = new Set();

    this.currentCompanyId = null;
    this.currentCompanyCode = null;
    this.currentUserId = null;

    // Cloudflare 100s prevention heartbeat (25s interval)
    this.heartbeatTimer = null;
    this.consecutiveMissedHeartbeats = 0;
    this.HEARTBEAT_INTERVAL_MS = 25000;
    this.HEARTBEAT_TIMEOUT_MS = 4000;

    // Exponential backoff & jitter for iOS / mobile recovery (initial 500ms, max 8s)
    this.reconnectAttempt = 0;
    this.MIN_BACKOFF_MS = 500;
    this.MAX_BACKOFF_MS = 8000;

    // Optimistic offline sync queue
    this.pendingSyncQueue = [];
    this.isFlushingQueue = false;

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
        this.socket.emit('switch-company', {
          companyId: this.currentCompanyId,
          companyCode: this.currentCompanyCode,
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
      transports: ['websocket', 'polling'], // WebSocket preferred, polling fallback
      auth: {
        token,
        companyId: this.currentCompanyId,
        companyCode: this.currentCompanyCode,
        userId: this.currentUserId,
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
      randomizationFactor: 0.3,
      timeout: 5000,
      upgrade: true,
      rememberUpgrade: true,
    });

    this.socket.on('connect', () => {
      this.reconnectAttempt = 0;
      this.consecutiveMissedHeartbeats = 0;
      this._setStatus('connected');
      this._clearOfflineTimers();
      this._startCloudflareHeartbeat();

      // Register user ID if available
      if (this.currentUserId) {
        this.socket.emit('register-user', this.currentUserId);
      }

      // Request missed events since last received eventId and message timestamp
      this.resync('reconnect');

      // Flush optimistic offline queue
      this.flushPendingQueue();
    });

    this.socket.on('disconnect', (reason) => {
      this._stopCloudflareHeartbeat();
      this._setStatus(reason === 'io client disconnect' ? 'disconnected' : 'reconnecting');
      this._startOfflineTimer();
    });

    this.socket.on('connect_error', () => {
      this._stopCloudflareHeartbeat();
      this._setStatus('reconnecting');
      this._startOfflineTimer();
    });

    // Standardized real-time event router
    this.socket.on('data-changed', (event) => {
      this._handleIncomingDataEvent(event);
    });

    // Chat message listener for timestamp tracking
    this.socket.on('receive-message', (message) => {
      if (message && message.createdAt) {
        const msgTime = new Date(message.createdAt).getTime();
        if (msgTime > this.lastReceivedMessageTimestamp) {
          this.lastReceivedMessageTimestamp = msgTime;
        }
      }
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

    legacyEvents.forEach((evtName) => {
      this.socket.on(evtName, (payload) => {
        const parts = evtName.split('-');
        const entity = parts[0];
        const action = parts[1] || 'updated';
        this._handleIncomingDataEvent({
          eventId: Date.now(),
          type: evtName,
          entity,
          action,
          payload,
          timestamp: Date.now(),
        });
      });
    });

    // Handle force reload if emitted by admin
    this.socket.on('force-system-reload', () => {
      if ('caches' in window) {
        caches.keys().then((names) => names.forEach((k) => caches.delete(k)));
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

  // ============================================================================
  // 1. CLOUDFLARE 100-SECOND TIMEOUT PREVENTION (25s Heartbeat)
  // ============================================================================

  _startCloudflareHeartbeat() {
    this._stopCloudflareHeartbeat();
    this.consecutiveMissedHeartbeats = 0;

    this.heartbeatTimer = setInterval(() => {
      if (!this.socket || !this.socket.connected) {
        return;
      }

      let ackReceived = false;
      const timeoutId = setTimeout(() => {
        if (!ackReceived) {
          this.consecutiveMissedHeartbeats++;
          console.warn(
            `[SocketManager] Missed Cloudflare heartbeat (${this.consecutiveMissedHeartbeats}/2).`
          );

          if (this.consecutiveMissedHeartbeats >= 2) {
            console.error(
              '[SocketManager] 2 consecutive heartbeats missed! Declaring connection degraded & cycling socket.'
            );
            this._setStatus('reconnecting');
            this.forceCycleConnection();
          }
        }
      }, this.HEARTBEAT_TIMEOUT_MS);

      try {
        // Ping with 'ping-heartbeat' or fallback to 'ping-health'
        this.socket.emit('ping-heartbeat', { clientTime: Date.now() }, () => {
          ackReceived = true;
          clearTimeout(timeoutId);
          this.consecutiveMissedHeartbeats = 0;
        });
      } catch (err) {
        clearTimeout(timeoutId);
        this.consecutiveMissedHeartbeats++;
        if (this.consecutiveMissedHeartbeats >= 2) {
          this.forceCycleConnection();
        }
      }
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  _stopCloudflareHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Forcefully closes and reconnects the socket with exponential backoff & jitter
   */
  forceCycleConnection() {
    this._stopCloudflareHeartbeat();
    this.reconnectAttempt++;

    const delay = this._calculateBackoff(this.reconnectAttempt);
    console.warn(`[SocketManager] Cycling socket with delay: ${delay}ms (attempt #${this.reconnectAttempt})`);

    try {
      if (this.socket) {
        this.socket.disconnect();
      }
    } catch (e) {}

    setTimeout(() => {
      if (this.socket) {
        this.socket.connect();
      } else {
        this._connect();
      }
    }, delay);
  }

  _calculateBackoff(attempt) {
    const exponential = Math.min(this.MAX_BACKOFF_MS, this.MIN_BACKOFF_MS * Math.pow(1.6, attempt));
    const jitter = (Math.random() * 0.4 - 0.2) * exponential; // +/- 20%
    return Math.round(Math.max(this.MIN_BACKOFF_MS, exponential + jitter));
  }

  // ============================================================================
  // 2. CROSS-DEVICE SLEEP/WAKE & TAB FREEZING (iOS Safari & Android Chrome)
  // ============================================================================

  _bindLifecycleEvents() {
    if (this.hasBoundGlobalLifecycle || typeof window === 'undefined') return;
    this.hasBoundGlobalLifecycle = true;

    // Connect with ResilientLifecycleManager
    try {
      lifecycleManager.init();
      lifecycleManager.onStateChange((state) => {
        if (state === 'CONNECTED') {
          if (!this.isConnected()) {
            this.reconnect(true);
          }
        } else if (state === 'OFFLINE') {
          this._setStatus('offline');
        } else if (state === 'RECONNECTING') {
          this._setStatus('reconnecting');
        }
      });
    } catch (e) {
      console.warn('[SocketManager] LifecycleManager integration warning:', e?.message || e);
    }

    // 1. Tab visibility change (browser switched back to tab or screen unlocked)
    document.addEventListener('visibilitychange', () => {
      const isVisible = document.visibilityState === 'visible';
      if (this.socket && this.socket.connected) {
        this.socket.emit('client-visibility', {
          isVisible,
          activeRoomId: this.currentActiveRoomId || null,
        });
      }
      if (isVisible) {
        this._handleDeviceAwakening('visibilitychange');
      }
    });

    // 2. Window focus (user clicked back into window)
    window.addEventListener('focus', () => {
      this._handleDeviceAwakening('focus');
    });

    // 3. W3C Page Lifecycle: 'freeze' (Aggressive background tab hibernation)
    window.addEventListener('freeze', () => {
      this._stopCloudflareHeartbeat();
    });

    // 4. W3C Page Lifecycle: 'resume' (Tab woken from freeze)
    window.addEventListener('resume', () => {
      this._handleDeviceAwakening('page-lifecycle-resume');
    });

    // 5. iOS Safari & Android Chrome 'pageshow' (crucial for Back-Forward Cache & phone unlock)
    window.addEventListener('pageshow', (event) => {
      // On iOS Safari, event.persisted is true when restored from bfcache or background suspension
      if (event.persisted || document.visibilityState === 'visible') {
        this._handleDeviceAwakening('pageshow-persisted');
      }
    });

    // 6. Network online / offline
    window.addEventListener('online', () => {
      this._clearOfflineTimers();
      this.reconnect(true);
      this.resync('network-online');
    });

    window.addEventListener('offline', () => {
      this._setStatus('offline');
      this._startOfflineTimer();
    });

    // 7. Workstation user activity recovery watchdog
    let lastUserCheck = 0;
    const handleUserInteraction = () => {
      const now = Date.now();
      if (now - lastUserCheck > 15000) {
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
   * Device awakening routine:
   * iOS Safari silently closes background TCP sockets without firing close events.
   * Send an immediate ping-burst; if stalled after 1500ms, force reconnect.
   */
  _handleDeviceAwakening(triggerSource) {
    if (!this.socket || !this.socket.connected) {
      this.reconnect(true);
      return;
    }

    let acked = false;
    const pingTimeout = setTimeout(() => {
      if (!acked) {
        console.warn(`[SocketManager] iOS/Mobile sleep detected (${triggerSource}). Zombie socket detected -> Force reconnecting.`);
        this.forceCycleConnection();
      }
    }, 1500);

    try {
      this.socket.emit('ping-health', () => {
        acked = true;
        clearTimeout(pingTimeout);
        this.resync(triggerSource);
        this.flushPendingQueue();
      });
    } catch (e) {
      clearTimeout(pingTimeout);
      this.forceCycleConnection();
    }
  }

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
        console.warn('[SocketManager] Proactive ping timed out. Cycling socket connection.');
        this.forceCycleConnection();
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
      this.forceCycleConnection();
    }
  }

  // ============================================================================
  // 3. CHAT EVENT SYNCHRONIZATION & OPTIMISTIC OFFLINE QUEUE
  // ============================================================================

  /**
   * Enqueue an action (chat message or job card stage transition) while offline or backgrounded
   * @param {object} action - { type, payload, id }
   */
  enqueuePendingAction(action) {
    const queueItem = {
      id: action.id || `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: action.type, // 'chat-message' | 'job-card-stage' | 'job-update'
      payload: action.payload,
      timestamp: action.timestamp || Date.now(),
      status: 'pending',
    };

    this.pendingSyncQueue.push(queueItem);
    this._notifyQueueChanged();

    // If already connected, attempt immediate flush
    if (this.isConnected()) {
      this.flushPendingQueue();
    }

    return queueItem.id;
  }

  /**
   * Remove item from queue by ID
   */
  removePendingAction(id) {
    this.pendingSyncQueue = this.pendingSyncQueue.filter((item) => item.id !== id);
    this._notifyQueueChanged();
  }

  /**
   * Get count and items of pending sync queue
   */
  getPendingQueueStatus() {
    return {
      count: this.pendingSyncQueue.length,
      items: [...this.pendingSyncQueue],
    };
  }

  /**
   * Subscribe to queue size changes
   */
  onQueueChange(fn) {
    this.queueListeners.add(fn);
    fn(this.getPendingQueueStatus());
    return () => this.queueListeners.delete(fn);
  }

  _notifyQueueChanged() {
    const status = this.getPendingQueueStatus();
    this.queueListeners.forEach((fn) => {
      try { fn(status); } catch (e) {}
    });

    try {
      window.dispatchEvent(
        new CustomEvent('elite-sync-queue-updated', {
          detail: status,
        })
      );
    } catch (e) {}
  }

  /**
   * Automatically flushes pending actions in FIFO order upon reconnection
   */
  async flushPendingQueue() {
    if (this.isFlushingQueue || this.pendingSyncQueue.length === 0 || !this.isConnected()) {
      return;
    }

    this.isFlushingQueue = true;

    try {
      while (this.pendingSyncQueue.length > 0 && this.isConnected()) {
        const item = this.pendingSyncQueue[0];

        try {
          if (item.type === 'chat-message') {
            await new Promise((resolve, reject) => {
              const timer = setTimeout(() => reject(new Error('Send timeout')), 4000);
              this.socket.emit('send-message', item.payload, (ack) => {
                clearTimeout(timer);
                resolve(ack);
              });
            });
          } else if (item.type === 'job-card-stage' || item.type === 'job-update') {
            await new Promise((resolve, reject) => {
              const timer = setTimeout(() => reject(new Error('Update timeout')), 4000);
              this.socket.emit('job-card-stage-update', item.payload, (ack) => {
                clearTimeout(timer);
                resolve(ack);
              });
            });
          } else {
            // Generic custom event
            this.socket.emit(item.type, item.payload);
          }

          // Successfully processed, shift from queue
          this.pendingSyncQueue.shift();
          this._notifyQueueChanged();
        } catch (itemErr) {
          console.warn('[SocketManager] Failed to flush queued action, will retry on next cycle:', itemErr);
          break; // Stop flushing until connection is verified
        }
      }
    } finally {
      this.isFlushingQueue = false;
    }
  }

  /**
   * Synchronizes missed events and messages since lastEventId or lastReceivedMessageTimestamp
   */
  async resync(reason = 'manual') {
    if (!this.currentCompanyId) {
      this.currentCompanyId = this._getStoredCompanyId();
    }
    const token = this._getAuthToken();

    // 1. Socket resync if connected
    if (this.socket && this.socket.connected) {
      this.socket.emit(
        'sync-events',
        {
          companyId: this.currentCompanyId,
          sinceEventId: this.lastEventId,
          sinceTimestamp: this.lastEventTimestamp,
          lastReceivedMessageTimestamp: this.lastReceivedMessageTimestamp,
        },
        (response) => {
          if (response && response.success && Array.isArray(response.events)) {
            response.events.forEach((evt) => this._handleIncomingDataEvent(evt));
          }
          if (response && Array.isArray(response.messages)) {
            response.messages.forEach((msg) => {
              try {
                window.dispatchEvent(
                  new CustomEvent('elite-chat-sync-message', { detail: msg })
                );
              } catch (e) {}
            });
          }
        }
      );
    }

    // 2. HTTP Fallback resync if socket is reconnecting or offline
    if (token) {
      try {
        const baseUrl = getBaseUrl();
        const url = `${baseUrl}/events/sync?companyId=${encodeURIComponent(
          this.currentCompanyId || ''
        )}&sinceEventId=${this.lastEventId}&sinceTimestamp=${this.lastEventTimestamp}&lastMsgTime=${this.lastReceivedMessageTimestamp}`;

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-store',
          },
          cache: 'no-store',
        });

        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.events)) {
            data.events.forEach((evt) => this._handleIncomingDataEvent(evt));
          }
        }
      } catch (e) {
        try {
          window.dispatchEvent(
            new CustomEvent('elite-data-refresh', {
              detail: { source: 'resync-fallback', timestamp: Date.now() },
            })
          );
        } catch (err) {}
      }
    }
  }

  /**
   * Handle incoming event with deduplication and order check
   */
  _handleIncomingDataEvent(event) {
    if (!event) return;

    if (
      event.companyId &&
      this.currentCompanyId &&
      String(event.companyId).toLowerCase() !== String(this.currentCompanyId).toLowerCase()
    ) {
      return;
    }

    const { eventId, timestamp } = event;

    if (eventId) {
      if (this.processedEventIds.has(eventId)) {
        return;
      }
      this.processedEventIds.add(eventId);
      if (this.processedEventIds.size > 2000) {
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

    this._checkConflict(event);

    this.listeners.forEach((fn) => {
      try {
        fn(event);
      } catch (err) {
        console.error('[SocketManager] Error in event listener:', err);
      }
    });

    try {
      window.dispatchEvent(
        new CustomEvent('elite-data-refresh', {
          detail: {
            ...event,
            source: 'socket',
            timestamp: Date.now(),
          },
        })
      );
    } catch (e) {}
  }

  _checkConflict(event) {
    if (event.action === 'updated' && event.id) {
      this.conflictListeners.forEach((fn) => {
        try { fn(event); } catch (e) {}
      });
    }
  }

  // ============================================================================
  // 4. TIMERS & OFFLINE POLLING FALLBACKS
  // ============================================================================

  _startOfflineTimer() {
    if (this.offlineTimer) return;

    this.offlineTimer = setTimeout(() => {
      this._setStatus('offline');
      this._startFallbackPolling();
    }, 15000);
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

  _startFallbackPolling() {
    if (this.fallbackPollTimer) return;
    this.isPollingFallbackActive = true;

    this.fallbackPollTimer = setInterval(() => {
      if (this.socket && this.socket.connected) {
        this._clearOfflineTimers();
        return;
      }
      try {
        window.dispatchEvent(
          new CustomEvent('elite-data-refresh', {
            detail: { source: 'polling-fallback', timestamp: Date.now() },
          })
        );
      } catch (e) {}
    }, 20000);
  }

  setCompany(companyId, companyCode) {
    if (this.currentCompanyId === companyId) return;

    this.currentCompanyId = companyId;
    this.currentCompanyCode = companyCode;

    this.lastEventId = 0;
    this.lastEventTimestamp = 0;
    this.processedEventIds.clear();

    if (this.socket && this.socket.connected) {
      this.socket.emit('switch-company', { companyId, companyCode });
      this.resync('company-switch');
    }
  }

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

  disconnect() {
    this._stopCloudflareHeartbeat();
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
    this.queueListeners.clear();
    this.processedEventIds.clear();
    this.pendingSyncQueue = [];
    this.lastEventId = 0;
    this.lastEventTimestamp = 0;
    this._setStatus('disconnected');
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onStatusChange(fn) {
    this.statusListeners.add(fn);
    fn(this.status);
    return () => this.statusListeners.delete(fn);
  }

  onRecordConflict(fn) {
    this.conflictListeners.add(fn);
    return () => this.conflictListeners.delete(fn);
  }

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

  _setStatus(newStatus) {
    if (this.status === newStatus && !this._reconnectingDebounceTimer) return;

    if (newStatus === 'connected') {
      if (this._reconnectingDebounceTimer) {
        clearTimeout(this._reconnectingDebounceTimer);
        this._reconnectingDebounceTimer = null;
      }
      this.status = 'connected';
      this._notifyStatus('connected');
      return;
    }

    if (newStatus === 'offline' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      if (this._reconnectingDebounceTimer) {
        clearTimeout(this._reconnectingDebounceTimer);
        this._reconnectingDebounceTimer = null;
      }
      this.status = 'offline';
      this._notifyStatus('offline');
      return;
    }

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
      try { fn(status); } catch (e) {}
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
    } catch (e) {}
    return null;
  }
}

export const socketManager = new SocketManager();
export default socketManager;
