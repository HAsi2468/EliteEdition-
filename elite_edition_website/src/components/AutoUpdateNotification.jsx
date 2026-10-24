import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { RefreshCw, X, Sparkles } from 'lucide-react';

/**
 * Non-Intrusive Live App Update Notification for Elite Edition ERP
 * 
 * Directives:
 * 1. NEVER automatically force-reload an active user's tab.
 * 2. Display a sleek, non-modal floating notification badge.
 * 3. Give the user full control to click "Update Now" or dismiss to finish their work undisturbed.
 * 4. Retain asset compatibility so open tabs continue operating without errors.
 */
export default function AutoUpdateNotification() {
  const socket = useSocket();
  const [hasUpdate, setHasUpdate] = useState(false);
  const [newVersionInfo, setNewVersionInfo] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const initialVersionRef = useRef(null);

  const checkVersion = async () => {
    try {
      const res = await fetch(`/version.json?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.version) return;

      if (!initialVersionRef.current) {
        sessionStorage.setItem('elite_app_version', String(data.version));
        initialVersionRef.current = data.version;
        return;
      }

      // If version changed since initial load
      if (data.version !== initialVersionRef.current && !isDismissed) {
        setNewVersionInfo(data);
        setHasUpdate(true);
      }
    } catch (e) {
      // Offline or network reload in progress
    }
  };

  useEffect(() => {
    checkVersion();
    const interval = setInterval(checkVersion, 60000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isDismissed]);

  // Socket listener for instant push update from server
  useEffect(() => {
    if (!socket) return;
    const handleSocketUpdate = (payload) => {
      if (payload && payload.version && payload.version !== initialVersionRef.current && !isDismissed) {
        setNewVersionInfo(payload);
        setHasUpdate(true);
      } else {
        checkVersion();
      }
    };

    socket.on('app-version-updated', handleSocketUpdate);
    socket.on('connect', checkVersion);

    return () => {
      socket.off('app-version-updated', handleSocketUpdate);
      socket.off('connect', checkVersion);
    };
  }, [socket, isDismissed]);

  const handleUpdateNow = () => {
    setIsUpdating(true);
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }
    if (newVersionInfo?.version) {
      sessionStorage.setItem('elite_app_version', String(newVersionInfo.version));
    }
    setTimeout(() => {
      window.location.reload(true);
    }, 250);
  };

  if (!hasUpdate || isDismissed) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: '18px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 999999,
          background: 'rgba(15, 23, 42, 0.94)',
          border: '1px solid rgba(59, 130, 246, 0.45)',
          color: '#ffffff',
          padding: '0.55rem 1.15rem',
          borderRadius: '50px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.55), 0 0 15px rgba(59, 130, 246, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          fontSize: '0.86rem',
          fontWeight: 600,
          animation: 'slideDownFade 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={16} color="#60a5fa" />
          <span>New version available</span>
        </div>

        <button
          onClick={handleUpdateNow}
          disabled={isUpdating}
          style={{
            background: '#2563eb',
            color: '#ffffff',
            border: 'none',
            padding: '0.35rem 0.85rem',
            borderRadius: '20px',
            fontWeight: 700,
            fontSize: '0.78rem',
            cursor: isUpdating ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            boxShadow: '0 2px 8px rgba(37,99,235,0.4)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.04)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <RefreshCw size={13} className={isUpdating ? 'spin-loader' : ''} />
          {isUpdating ? 'Updating...' : 'Update Now'}
        </button>

        <button
          onClick={() => setIsDismissed(true)}
          title="Dismiss (keep working)"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.65)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
          }}
        >
          <X size={15} />
        </button>
      </div>

      <style>{`
        @keyframes slideDownFade {
          from {
            opacity: 0;
            transform: translate(-50%, -20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        .spin-loader {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
