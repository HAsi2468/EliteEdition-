import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import socketManager from '../services/socketManager';
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

  const isActuallyConnected = isBrowserOnline && status === 'connected';
  const isOffline = !isBrowserOnline || status === 'offline';
  const isReconnecting = !isOffline && status !== 'connected';

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
    socketManager.reconnect(true);
    try {
      lifecycleManager.probeNow('manual-retry');
    } catch (e) {}
    setTimeout(() => setIsRetrying(false), 1200);
  };

  const pendingCount = queueStatus?.count || 0;

  // 1. Recovered State (Brief subtle green confirmation)
  if (showRecoveredBadge) {
    return (
      <aside
        role="status"
        aria-live="polite"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[99999] pointer-events-auto"
      >
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold shadow-lg shadow-emerald-500/10 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Real-time connected</span>
        </div>
      </aside>
    );
  }

  // 2. Connected State: Silent (Green micro-indicator in corner dock)
  if (isActuallyConnected) {
    return (
      <aside
        role="status"
        aria-live="off"
        className="fixed bottom-3 right-3 z-40 pointer-events-none opacity-40 hover:opacity-100 transition-opacity"
        title="Real-time WebSocket Live"
      >
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
      </aside>
    );
  }

  // 3. Reconnecting State: Gentle floating amber pill ("Reconnecting...")
  if (isReconnecting) {
    return (
      <aside
        role="status"
        aria-live="polite"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[99999] pointer-events-auto"
      >
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-xs font-semibold shadow-xl shadow-amber-500/10 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          <RefreshCw size={13} className="animate-spin text-amber-500" />
          <span>Reconnecting...</span>
          <button
            type="button"
            onClick={handleManualRetry}
            disabled={isRetrying}
            className="ml-1 px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-[10px] text-amber-700 dark:text-amber-200 font-bold uppercase tracking-wider cursor-pointer transition-colors"
          >
            {isRetrying ? 'Syncing...' : 'Retry'}
          </button>
        </div>
      </aside>
    );
  }

  // 4. Offline State: Amber pill with queued message counter ("Offline - X messages pending sync")
  if (isOffline) {
    return (
      <aside
        role="status"
        aria-live="assertive"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[99999] pointer-events-auto"
      >
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-amber-600/20 border border-amber-500/50 text-amber-800 dark:text-amber-200 text-xs font-semibold shadow-2xl shadow-amber-600/20 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          <WifiOff size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            {pendingCount > 0
              ? `Offline - ${pendingCount} ${pendingCount === 1 ? 'message' : 'messages'} pending sync`
              : 'Offline - Reconnecting automatically'}
          </span>
          <button
            type="button"
            onClick={handleManualRetry}
            disabled={isRetrying}
            className="ml-1 px-2.5 py-0.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm cursor-pointer transition-all"
          >
            {isRetrying ? 'Checking...' : 'Retry'}
          </button>
        </div>
      </aside>
    );
  }

  return null;
}

export default ConnectionBanner;
