import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import socketManager from '../services/socketManager';
import { api, isAuthenticated } from '../services/api';
import { getFloorQueueCount } from '../services/offlineFloorQueue';
import { lifecycleManager } from '../services/resilientLifecycleManager';

/**
 * Non-Intrusive Real-Time Connection Banner
 *
 * State display behavior:
 * - Connected: Silent (green micro-indicator).
 * - Reconnecting: Gentle floating amber pill ("Reconnecting...").
 * - Offline: Amber pill with queued message counter ("Offline - X messages pending sync").
 */
export function ConnectionBanner() {
  const [status, setStatus] = useState(() => socketManager.getStatus());
  const [queueStatus, setQueueStatus] = useState(() => socketManager.getPendingQueueStatus());
  const [isBrowserOnline, setIsBrowserOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showRecoveredBadge, setShowRecoveredBadge] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [floorQueueCount, setFloorQueueCount] = useState(0);
  const [syncingFloor, setSyncingFloor] = useState(false);

  useEffect(() => {
    getFloorQueueCount().then(setFloorQueueCount).catch(() => {});
    const onFloorQueue = (e) => {
      if (typeof e?.detail?.count === 'number') setFloorQueueCount(e.detail.count);
      else getFloorQueueCount().then(setFloorQueueCount).catch(() => {});
    };
    window.addEventListener('elite-floor-queue-updated', onFloorQueue);
    return () => window.removeEventListener('elite-floor-queue-updated', onFloorQueue);
  }, []);

  const prevConnectedRef = useRef(
    socketManager.isConnected() && (typeof navigator !== 'undefined' ? navigator.onLine : true)
  );

  useEffect(() => {
    // 1. SocketManager status & queue subscriptions
    const unsubStatus = socketManager.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    const unsubQueue = socketManager.onQueueChange((newQueue) => {
      setQueueStatus(newQueue);
    });

    // 2. Global DOM listeners for sync queue updates
    const handleQueueEvent = (e) => {
      if (e.detail) {
        setQueueStatus(e.detail);
      }
    };
    window.addEventListener('elite-sync-queue-updated', handleQueueEvent);

    // 3. Browser online/offline events
    const handleOnline = () => {
      setIsBrowserOnline(true);
      socketManager.reconnect(true);
      try {
        lifecycleManager.probeNow('online-event');
      } catch (err) {}
    };

    const handleOffline = () => {
      setIsBrowserOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 4. Lifecycle state integration
    let unsubLifecycle = null;
    try {
      unsubLifecycle = lifecycleManager.onStateChange((state) => {
        if (state === 'CONNECTED') {
          setIsBrowserOnline(true);
        } else if (state === 'OFFLINE') {
          setIsBrowserOnline(false);
        }
      });
    } catch (e) {}

    return () => {
      unsubStatus();
      unsubQueue();
      window.removeEventListener('elite-sync-queue-updated', handleQueueEvent);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (unsubLifecycle) unsubLifecycle();
    };
  }, []);

  const hasAuthToken = Boolean(isAuthenticated());

  // If the WebSocket is connected, we are connected! Never display false offline if socket is healthy.
  const isActuallyConnected = status === 'connected' && socketManager.isConnected();
  const isOffline = hasAuthToken && !isActuallyConnected && (!isBrowserOnline || status === 'offline');
  const isReconnecting = hasAuthToken && !isActuallyConnected && !isOffline && status === 'reconnecting';

  // Debounce reconnecting pill: Do not flash intrusive "Reconnecting..." on sub-second transient blips
  const [showReconnectingPill, setShowReconnectingPill] = useState(false);

  useEffect(() => {
    let timer = null;
    if (isReconnecting) {
      timer = setTimeout(() => {
        setShowReconnectingPill(true);
      }, 7000);
    } else {
      setShowReconnectingPill(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isReconnecting]);

  // Handle recovery confirmation badge transition
  useEffect(() => {
    if (isActuallyConnected) {
      if (!prevConnectedRef.current) {
        setShowRecoveredBadge(true);
        const timer = setTimeout(() => {
          setShowRecoveredBadge(false);
        }, 2500);
        return () => clearTimeout(timer);
      }
      prevConnectedRef.current = true;
    } else {
      prevConnectedRef.current = false;
    }
  }, [isActuallyConnected]);

  const handleManualRetry = () => {
    setIsRetrying(true);
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      setIsBrowserOnline(true);
    }
    socketManager.reconnect(true);
    try {
      lifecycleManager.probeNow('manual-retry').then((isAlive) => {
        if (isAlive) {
          setIsBrowserOnline(true);
          setStatus(socketManager.getStatus());
        }
      });
    } catch (e) {}
    setTimeout(() => {
      setIsRetrying(false);
      setStatus(socketManager.getStatus());
      if (typeof navigator !== 'undefined') {
        setIsBrowserOnline(navigator.onLine);
      }
    }, 1000);
  };

  const pendingCount = queueStatus?.count || 0;

  if (floorQueueCount > 0 && hasAuthToken) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '54px',
          right: '16px',
          zIndex: 99990,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.5rem 0.85rem',
          borderRadius: '999px',
          background: 'rgba(11, 17, 32, 0.94)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(251, 191, 36, 0.45)',
          color: '#fde68a',
          fontSize: '0.78rem',
          fontWeight: 700,
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.55)',
        }}
      >
        {isOffline ? <WifiOff size={14} color="#fbbf24" /> : <Wifi size={14} color="#34d399" />}
        <span>
          {floorQueueCount} floor scan/log{floorQueueCount > 1 ? 's' : ''} queued {isOffline ? '(Offline)' : ''}
        </span>
        {!isOffline && (
          <button
            type="button"
            disabled={syncingFloor}
            onClick={async () => {
              setSyncingFloor(true);
              try {
                await api.syncOfflineFloorQueue();
              } finally {
                setSyncingFloor(false);
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '0.24rem 0.6rem',
              borderRadius: '999px',
              border: '1px solid rgba(56, 189, 248, 0.45)',
              background: 'rgba(37, 99, 235, 0.7)',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={11} /> {syncingFloor ? 'Syncing...' : 'Sync Now'}
          </button>
        )}
      </div>
    );
  }

  // Enterprise Silent Reconnection:
  // Reconnection and sync happen 100% automatically in the background without intrusive floating popups or banners.
  return null;
}

export default ConnectionBanner;
