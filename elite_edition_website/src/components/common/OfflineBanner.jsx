import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

/**
 * Enterprise Non-Intrusive Offline Connection Badge
 * Detects network state via navigator.onLine and window online/offline events.
 * Displays a sleek floating badge: "Offline - Changes queued" without shifting layout.
 */
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 2800);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(12px + env(safe-area-inset-top, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99998,
        pointerEvents: 'none',
        animation: 'fadeInSlideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {!isOnline ? (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 16px',
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            color: '#f8fafc',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.28), 0 2px 6px rgba(0,0,0,0.15)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            pointerEvents: 'auto'
          }}
        >
          {/* Pulsing Amber Dot */}
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#f59e0b',
              boxShadow: '0 0 8px #f59e0b',
              animation: 'pulse 1.8s infinite'
            }}
          />
          <WifiOff size={14} color="#f59e0b" />
          <span>Offline - Changes queued</span>
        </div>
      ) : (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 16px',
            backgroundColor: 'rgba(16, 185, 129, 0.95)',
            color: '#ffffff',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            pointerEvents: 'auto'
          }}
        >
          <Wifi size={14} color="#ffffff" />
          <span>Back Online - Changes synced</span>
        </div>
      )}
    </div>
  );
}

export default OfflineBanner;
