import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { RefreshCw, ArrowRight, X, Sparkles } from 'lucide-react';

export default function AutoUpdateNotification() {
  const socket = useSocket();
  const [hasUpdate, setHasUpdate] = useState(false);
  const [newVersionInfo, setNewVersionInfo] = useState(null);
  const [countdown, setCountdown] = useState(10);
  const [isDismissed, setIsDismissed] = useState(false);
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
        // Record version on first load
        const stored = sessionStorage.getItem('elite_app_version');
        if (stored && Number(stored) !== data.version) {
          // A reload just completed to this new version
          sessionStorage.setItem('elite_app_version', String(data.version));
        } else if (!stored) {
          sessionStorage.setItem('elite_app_version', String(data.version));
        }
        initialVersionRef.current = data.version;
        return;
      }

      // If version changed since initial load
      if (data.version !== initialVersionRef.current && !isDismissed) {
        setNewVersionInfo(data);
        setHasUpdate(true);
      }
    } catch (e) {
      // Offline or server reload in progress
    }
  };

  useEffect(() => {
    // Initial check
    checkVersion();

    // Check periodically every 60 seconds
    const interval = setInterval(checkVersion, 60000);

    // Check on tab focus / visibility change
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

  // Countdown timer when update is detected
  useEffect(() => {
    if (!hasUpdate || isDismissed) return;

    // Check if user is typing or interacting with form inputs
    const isUserActive = () => {
      const active = document.activeElement;
      if (!active) return false;
      const tag = active.tagName?.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || active.isContentEditable;
    };

    const timer = setInterval(() => {
      // If user is actively typing, do not count down (wait until they pause)
      if (isUserActive()) {
        setCountdown(10);
        return;
      }

      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          performUpdate();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [hasUpdate, isDismissed]);

  const performUpdate = () => {
    if (newVersionInfo?.version) {
      sessionStorage.setItem('elite_app_version', String(newVersionInfo.version));
    }
    // Bypass browser cache on reload
    window.location.reload();
  };

  if (!hasUpdate || isDismissed) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '18px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 999999,
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%)',
        color: '#ffffff',
        padding: '0.65rem 1.15rem',
        borderRadius: '50px',
        boxShadow: '0 10px 25px -5px rgba(30, 58, 138, 0.5), 0 0 0 2px rgba(255, 255, 255, 0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.85rem',
        fontSize: '0.86rem',
        fontWeight: 600,
        animation: 'slideDownFade 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
        <Sparkles size={16} color="#93c5fd" />
        <span>New system update deployed!</span>
      </div>

      <button
        onClick={performUpdate}
        style={{
          background: '#ffffff',
          color: '#1e40af',
          border: 'none',
          padding: '0.35rem 0.85rem',
          borderRadius: '20px',
          fontWeight: 700,
          fontSize: '0.78rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.04)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <RefreshCw size={13} /> Update Now {countdown > 0 ? `(${countdown}s)` : ''}
      </button>

      <button
        onClick={() => setIsDismissed(true)}
        title="Dismiss for 10 minutes"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255, 255, 255, 0.75)',
          cursor: 'pointer',
          padding: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={16} />
      </button>

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
      `}</style>
    </div>
  );
}
