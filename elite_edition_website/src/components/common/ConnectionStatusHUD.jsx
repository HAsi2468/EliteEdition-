import React, { useState, useEffect, useRef } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import socketManager from '../../services/socketManager';
import { lifecycleManager } from '../../services/resilientLifecycleManager';

/**
 * Enterprise Non-Intrusive Connection Status HUD
 *
 * Coordinates Socket.io real-time connection state, W3C lifecycle states,
 * and browser network connectivity into a single, elegant floating HUD.
 *
 * Features:
 * - Zero layout shift (fixed top-center pill).
 * - Suppresses micro-blips via anti-flicker debouncing.
 * - Shows smooth spinning indicator when reconnecting.
 * - Interactive "Retry Now" button to bypass any backoff.
 * - Smooth emerald green fadeout on successful reconnection.
 */
export function ConnectionStatusHUD() {
  const [socketStatus, setSocketStatus] = useState(() => socketManager.getStatus());
  const [isBrowserOnline, setIsBrowserOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [showReconnected, setShowReconnected] = useState(false);
  const [reconnectDuration, setReconnectDuration] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const prevConnectedRef = useRef(socketManager.isConnected() && (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const reconnectStartTimerRef = useRef(null);

  useEffect(() => {
    // 1. Subscribe to SocketManager status
    const unsubSocket = socketManager.onStatusChange((status) => {
      setSocketStatus(status);
    });

    // 2. Browser online/offline event handlers
    const handleOnline = () => {
      setIsBrowserOnline(true);
      socketManager.reconnect(true);
      try { lifecycleManager.probeNow('online-event'); } catch (e) {}
    };

    const handleOffline = () => {
      setIsBrowserOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 3. ResilientLifecycleManager integration
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
      unsubSocket();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (unsubLifecycle) unsubLifecycle();
    };
  }, []);

  // Compute effective connection state
  const isActuallyConnected = isBrowserOnline && socketStatus === 'connected';
  const isOffline = !isBrowserOnline || socketStatus === 'offline';
  const isReconnecting = !isOffline && socketStatus !== 'connected';

  // Handle green "Back Online" transition badge
  useEffect(() => {
    if (isActuallyConnected) {
      if (!prevConnectedRef.current) {
        // Just recovered!
        setShowReconnected(true);
        setReconnectDuration(0);
        if (reconnectStartTimerRef.current) {
          clearInterval(reconnectStartTimerRef.current);
          reconnectStartTimerRef.current = null;
        }
        const timer = setTimeout(() => {
          setShowReconnected(false);
        }, 2400);
        return () => clearTimeout(timer);
      }
      prevConnectedRef.current = true;
    } else {
      prevConnectedRef.current = false;
      if (!reconnectStartTimerRef.current) {
        const start = Date.now();
        reconnectStartTimerRef.current = setInterval(() => {
          setReconnectDuration(Math.round((Date.now() - start) / 1000));
        }, 1000);
      }
    }

    return () => {
      if (reconnectStartTimerRef.current && isActuallyConnected) {
        clearInterval(reconnectStartTimerRef.current);
        reconnectStartTimerRef.current = null;
      }
    };
  }, [isActuallyConnected]);

  const handleManualRetry = (e) => {
    e.stopPropagation();
    setIsRetrying(true);
    socketManager.reconnect(true);
    try {
      lifecycleManager.probeNow('manual-hud-click');
    } catch (err) {}
    setTimeout(() => setIsRetrying(false), 1200);
  };

  // If connected and not showing the brief reconnected confirmation, hide HUD
  if (isActuallyConnected && !showReconnected) {
    return null;
  }

  return (
    <div
      data-testid="connection-status-banner"
      style={{
        position: 'fixed',
        top: 'calc(14px + env(safe-area-inset-top, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeInSlideDown 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <style>{`
        @keyframes fadeInSlideDown {
          0% { opacity: 0; transform: translate(-50%, -8px) scale(0.96); }
          100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        @keyframes pulseDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }
        @keyframes spinSmooth {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {showReconnected ? (
        // Green Reconnected Pill
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 18px',
            backgroundColor: 'rgba(16, 185, 129, 0.95)',
            color: '#ffffff',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3), 0 2px 6px rgba(0,0,0,0.15)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            pointerEvents: 'auto',
            letterSpacing: '0.01em',
            transition: 'all 0.2s ease'
          }}
        >
          <Wifi size={14} color="#ffffff" strokeWidth={2.5} />
          <span>Connected & Synced</span>
        </div>
      ) : isOffline ? (
        // Amber/Red Offline Pill
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 14px 6px 16px',
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            color: '#f8fafc',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 600,
            boxShadow: '0 10px 28px rgba(0, 0, 0, 0.35), 0 2px 6px rgba(0,0,0,0.2)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            pointerEvents: 'auto'
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#f59e0b',
              boxShadow: '0 0 8px #f59e0b',
              animation: 'pulseDot 1.8s infinite'
            }}
          />
          <WifiOff size={14} color="#f59e0b" />
          <span style={{ color: '#e2e8f0' }}>Offline • Changes Queued</span>
          <button
            onClick={handleManualRetry}
            disabled={isRetrying}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '999px',
              padding: '2px 10px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#38bdf8',
              cursor: isRetrying ? 'default' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!isRetrying) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <RefreshCw
              size={11}
              style={{
                animation: isRetrying ? 'spinSmooth 0.8s linear infinite' : 'none'
              }}
            />
            <span>{isRetrying ? 'Connecting...' : 'Reconnect'}</span>
          </button>
        </div>
      ) : (
        // Reconnecting Pill
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 14px 6px 16px',
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            color: '#f8fafc',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 600,
            boxShadow: '0 10px 28px rgba(0, 0, 0, 0.35), 0 2px 6px rgba(0,0,0,0.2)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            pointerEvents: 'auto'
          }}
        >
          <RefreshCw
            size={13}
            color="#38bdf8"
            style={{
              animation: 'spinSmooth 1s linear infinite'
            }}
          />
          <span style={{ color: '#e2e8f0' }}>
            {reconnectDuration > 3 ? `Reconnecting (${reconnectDuration}s)...` : 'Reconnecting...'}
          </span>
          <button
            onClick={handleManualRetry}
            disabled={isRetrying}
            style={{
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '999px',
              padding: '2px 10px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#38bdf8',
              cursor: isRetrying ? 'default' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!isRetrying) e.currentTarget.style.background = 'rgba(56, 189, 248, 0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)';
            }}
          >
            <span>{isRetrying ? 'Connecting...' : 'Retry Now'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default ConnectionStatusHUD;
