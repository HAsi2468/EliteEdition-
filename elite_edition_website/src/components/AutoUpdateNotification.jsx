import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { RefreshCw, X, Sparkles, Clock } from 'lucide-react';

/**
 * Non-Mandatory, User-Controlled Live App Update Notification for Elite Edition ERP
 *
 * Directives:
 * 1. NEVER automatically force-reload an active user's tab or run a countdown timer.
 * 2. Display a sleek, non-blocking floating pill in the bottom-right corner so it never covers forms or modals.
 * 3. Give the user full control to click "Update Now" when they are free, or click "Later" / dismiss to continue working undisturbed.
 * 4. Optional "Auto-update when idle": if the user has no open modal/form and is completely idle for 5+ minutes with the tab hidden, or when they explicitly click "Update Now".
 */
export default function AutoUpdateNotification() {
  const socket = useSocket();
  const [hasUpdate, setHasUpdate] = useState(false);
  const [newVersionInfo, setNewVersionInfo] = useState(null);
  const [dismissedVersion, setDismissedVersion] = useState(() => {
    try {
      return sessionStorage.getItem('elite_dismissed_update_version') || null;
    } catch (_) {
      return null;
    }
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUserWorking, setIsUserWorking] = useState(false);
  const initialVersionRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  // Detect if user is actively typing, editing a form, or has a modal open
  const checkIfUserIsActivelyWorking = () => {
    if (typeof document === 'undefined') return false;
    const activeEl = document.activeElement;
    const isTypingInField =
      activeEl &&
      (activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.isContentEditable);

    const hasOpenModal = Boolean(
      document.querySelector(
        '.modal-overlay, .modal-backdrop, [role="dialog"], .erp-modal'
      )
    );

    const recentlyActive = Date.now() - lastActivityRef.current < 45000;
    return Boolean(isTypingInField || hasOpenModal || recentlyActive);
  };

  useEffect(() => {
    const markActivity = () => {
      lastActivityRef.current = Date.now();
      setIsUserWorking(checkIfUserIsActivelyWorking());
    };
    const events = ['keydown', 'mousedown', 'input', 'change', 'focusin'];
    events.forEach((ev) => window.addEventListener(ev, markActivity, { passive: true }));
    const activityCheckTimer = setInterval(() => {
      setIsUserWorking(checkIfUserIsActivelyWorking());
    }, 5000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, markActivity));
      clearInterval(activityCheckTimer);
    };
  }, []);

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
        initialVersionRef.current = String(data.version);
        return;
      }

      // If version changed since initial load and user hasn't dismissed this specific version
      if (
        String(data.version) !== String(initialVersionRef.current) &&
        String(data.version) !== String(dismissedVersion)
      ) {
        setNewVersionInfo(data);
        setHasUpdate(true);
      }
    } catch (e) {
      // Offline or network reload in progress
    }
  };

  useEffect(() => {
    checkVersion();
    const interval = setInterval(checkVersion, 90000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Also listen for service worker / admin soft update notifications
    const onPwaUpdate = () => {
      setHasUpdate(true);
    };
    window.addEventListener('pwa-update-available', onPwaUpdate);
    window.addEventListener('elite-optional-update-available', onPwaUpdate);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pwa-update-available', onPwaUpdate);
      window.removeEventListener('elite-optional-update-available', onPwaUpdate);
    };
  }, [dismissedVersion]);

  // Socket listener for instant push update from server (non-mandatory)
  useEffect(() => {
    if (!socket) return;
    const handleSocketUpdate = (payload) => {
      if (
        payload &&
        payload.version &&
        String(payload.version) !== String(initialVersionRef.current) &&
        String(payload.version) !== String(dismissedVersion)
      ) {
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
  }, [socket, dismissedVersion]);

  const handleUpdateNow = () => {
    setIsUpdating(true);
    try {
      sessionStorage.setItem('elite_user_requested_update', '1');
      if (newVersionInfo?.version) {
        sessionStorage.setItem('elite_app_version', String(newVersionInfo.version));
      }
    } catch (_) {}

    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => {
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      }).catch(() => {});
    }

    setTimeout(() => {
      window.location.reload();
    }, 250);
  };

  const handleDismissForLater = () => {
    const ver = newVersionInfo?.version ? String(newVersionInfo.version) : 'dismissed';
    setDismissedVersion(ver);
    setHasUpdate(false);
    try {
      sessionStorage.setItem('elite_dismissed_update_version', ver);
    } catch (_) {}
  };

  if (!hasUpdate) return null;

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 999990,
          background: 'rgba(15, 23, 42, 0.92)',
          border: '1px solid rgba(56, 189, 248, 0.38)',
          color: '#f8fafc',
          padding: '0.65rem 1rem',
          borderRadius: '16px',
          boxShadow: '0 14px 36px rgba(2, 6, 23, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.82rem',
          fontWeight: 600,
          animation: 'optionalUpdateSlideIn 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
          backdropFilter: 'blur(18px) saturate(180%)',
          WebkitBackdropFilter: 'blur(18px) saturate(180%)',
          maxWidth: '430px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flex: 1, minWidth: 0 }}>
          <Sparkles size={16} color="#38bdf8" style={{ flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
            <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.82rem' }}>
              New Update Available {newVersionInfo?.releaseVersion ? `(${newVersionInfo.releaseVersion})` : ''}
            </span>
            <span style={{ color: '#94a3b8', fontSize: '0.73rem', fontWeight: 500 }}>
              {isUserWorking
                ? 'You are working — update whenever you are free'
                : 'Ready to refresh whenever convenient for you'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleUpdateNow}
            disabled={isUpdating}
            style={{
              background: 'linear-gradient(135deg, #2563eb, #0284c7)',
              color: '#ffffff',
              border: 'none',
              padding: '0.38rem 0.78rem',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.76rem',
              cursor: isUpdating ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: '0 2px 10px rgba(37, 99, 235, 0.35)',
            }}
          >
            <RefreshCw size={12} className={isUpdating ? 'spin-loader' : ''} />
            {isUpdating ? 'Updating...' : 'Update Now'}
          </button>

          <button
            type="button"
            onClick={handleDismissForLater}
            title="Remind me later (continue working without interruption)"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#cbd5e1',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              padding: '0.36rem 0.6rem',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '0.74rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <Clock size={11} />
            Later
          </button>

          <button
            type="button"
            onClick={handleDismissForLater}
            aria-label="Dismiss update notification"
            title="Dismiss"
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: 'none',
              padding: '0.25rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes optionalUpdateSlideIn {
          from {
            opacity: 0;
            transform: translate3d(0, 16px, 0) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
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
