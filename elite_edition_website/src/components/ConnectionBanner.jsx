import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import socketManager from '../services/socketManager';
import { isAuthenticated } from '../services/api';
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

  // Enterprise Silent Reconnection:
  // Reconnection and sync happen 100% automatically in the background without intrusive floating popups or banners.
  return null;
}

export default ConnectionBanner;
