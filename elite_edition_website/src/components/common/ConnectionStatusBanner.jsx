import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, CloudQueue, CheckCircle2 } from 'lucide-react';
import socketManager from '../../services/socketManager';
import { lifecycleManager } from '../../services/resilientLifecycleManager';

/**
 * Enterprise Resilient Connection Status Banner (Tailwind CSS)
 *
 * Implements non-blocking, cross-device connection state indicator:
 * - Connected: Clean, subtle status dot with optional brief synced pill.
 * - Reconnecting: Floating amber badge with gentle pulse ("Reconnecting...").
 * - Offline: Slate/amber toast showing pending sync queue ("X updates queued for sync").
 * - Zero full-page reloads, non-blocking UI layout.
 */
export function ConnectionStatusBanner() {
  const [status, setStatus] = useState(() => socketManager.getStatus());
  const [queueStatus, setQueueStatus] = useState(() => socketManager.getPendingQueueStatus());
  const [isBrowserOnline, setIsBrowserOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showRecoveredBadge, setShowRecoveredBadge] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [reconnectSeconds, setReconnectSeconds] = useState(0);

  const prevConnectedRef = useRef(socketManager.isConnected() && (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const timerRef = useRef(null);

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
        setReconnectSeconds(0);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        const timer = setTimeout(() => {
          setShowRecoveredBadge(false);
        }, 2500);
        return () => clearTimeout(timer);
      }
      prevConnectedRef.current = true;
    } else {
      prevConnectedRef.current = false;
      if (!timerRef.current) {
        const start = Date.now();
        timerRef.current = setInterval(() => {
          setReconnectSeconds(Math.round((Date.now() - start) / 1000));
        }, 1000);
      }
    }

    return () => {
      if (timerRef.current && isActuallyConnected) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isActuallyConnected]);

  const handleManualRetry = (e) => {
    e.stopPropagation();
    setIsRetrying(true);
    socketManager.reconnect(true);
    try {
      lifecycleManager.probeNow('manual-retry-click');
    } catch (err) {}
    setTimeout(() => setIsRetrying(false), 1200);
  };

  return (
    <>
      {/* 1. Subtle Connected Status Dot (Bottom-Right or Header) */}
      {isActuallyConnected && !showRecoveredBadge && (
        <div
          title="Real-Time Engine: Connected & Synced"
          className="fixed bottom-3 right-3 z-50 pointer-events-auto flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 shadow-lg text-[10px] text-slate-300 transition-opacity hover:opacity-100 opacity-60"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-medium tracking-tight hidden sm:inline">Live</span>
        </div>
      )}

      {/* 2. Top-Center Floating Banners for Transitions, Reconnecting, and Offline */}
      <div
        data-testid="connection-status-banner"
        className="fixed top-3 sm:top-4 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none flex flex-col items-center justify-center transition-all duration-300"
      >
        {/* Recovery Success Pill */}
        {showRecoveredBadge && (
          <div className="pointer-events-auto inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-600/95 text-white font-semibold text-xs shadow-xl shadow-emerald-900/30 backdrop-blur-md border border-emerald-400/40 animate-in fade-in slide-in-from-top-2 duration-200">
            <CheckCircle2 size={14} className="text-white" />
            <span>Connection Restored & Synced</span>
          </div>
        )}

        {/* Offline State Toast (Showing pending queue status) */}
        {!showRecoveredBadge && isOffline && (
          <div className="pointer-events-auto inline-flex items-center gap-3 px-4 py-2 rounded-2xl sm:rounded-full bg-slate-900/95 text-slate-100 font-medium text-xs shadow-2xl shadow-black/50 backdrop-blur-md border border-amber-500/40 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="relative flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-amber-400 opacity-50"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </div>
            <WifiOff size={14} className="text-amber-400 shrink-0" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="font-semibold text-amber-400">Offline</span>
              <span className="text-slate-300">
                {queueStatus.count > 0 ? (
                  <span className="text-amber-200 font-medium">
                    {queueStatus.count} update{queueStatus.count > 1 ? 's' : ''} queued for sync
                  </span>
                ) : (
                  'Changes saved locally'
                )}
              </span>
            </div>
            <button
              onClick={handleManualRetry}
              disabled={isRetrying}
              className="ml-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold border border-amber-500/40 text-[11px] transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                size={11}
                className={isRetrying ? 'animate-spin' : ''}
              />
              <span>{isRetrying ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          </div>
        )}

        {/* Reconnecting State Badge (Floating amber badge with gentle pulse) */}
        {!showRecoveredBadge && isReconnecting && (
          <div className="pointer-events-auto inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-900/95 text-amber-300 font-semibold text-xs shadow-xl shadow-amber-950/40 backdrop-blur-md border border-amber-500/50 animate-pulse animate-in fade-in slide-in-from-top-2 duration-200">
            <RefreshCw
              size={13}
              className="text-amber-400 animate-spin"
            />
            <span>
              {reconnectSeconds > 3
                ? `Reconnecting (${reconnectSeconds}s)...`
                : 'Reconnecting...'}
            </span>
            {queueStatus.count > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-200 text-[10px] font-mono">
                {queueStatus.count} queued
              </span>
            )}
            <button
              onClick={handleManualRetry}
              disabled={isRetrying}
              className="ml-1 px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-slate-700 cursor-pointer disabled:opacity-50"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default ConnectionStatusBanner;
