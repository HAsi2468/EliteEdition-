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

  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(15);

  const startUpdating = () => {
    setIsUpdating(true);
    setUpdateProgress(18);

    // Clear browser cache in background before reload
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }

    const steps = [
      { p: 35, delay: 400 },
      { p: 52, delay: 850 },
      { p: 68, delay: 1350 },
      { p: 85, delay: 1850 },
      { p: 95, delay: 2250 },
      { p: 100, delay: 2600 },
    ];

    steps.forEach(({ p, delay }) => {
      setTimeout(() => {
        setUpdateProgress(p);
        if (p === 100) {
          setTimeout(() => {
            if (newVersionInfo?.version) {
              sessionStorage.setItem('elite_app_version', String(newVersionInfo.version));
            }
            window.location.reload(true);
          }, 400);
        }
      }, delay);
    });
  };

  const performUpdate = () => {
    startUpdating();
  };

  if (!hasUpdate && !isUpdating) return null;
  if (isDismissed && !isUpdating) return null;

  return (
    <>
      {/* ── FULLSCREEN HASI UPDATE SPLASH SCREEN ── */}
      {isUpdating && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999999,
            background: 'radial-gradient(ellipse at center, #0b1e38 0%, #020814 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            animation: 'hasiFadeIn 0.35s ease-out'
          }}
        >
          {/* Main Visual Frame matching the user's Taj Mahal & HASI theme */}
          <div
            style={{
              position: 'relative',
              maxWidth: '920px',
              width: '95vw',
              aspectRatio: '1024 / 558',
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 30px 90px rgba(0,0,0,0.85), 0 0 50px rgba(37,99,235,0.4), 0 0 0 1px rgba(255,255,255,0.12)',
              backgroundImage: 'url(/hasi_update_bg.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {/* Ambient Pulse Glow in center behind ring */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '36%',
                height: '62%',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, rgba(37, 99, 235, 0.25) 50%, transparent 70%)',
                filter: 'blur(16px)',
                pointerEvents: 'none',
                animation: 'hasiPulse 2s infinite ease-in-out'
              }}
            />

            {/* Dynamic Center Badge matching the Indian theme ring */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '26%',
                height: '48%',
                borderRadius: '50%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'radial-gradient(circle, #071933 0%, #030d1d 92%)',
                boxShadow: 'inset 0 0 25px rgba(0, 0, 0, 0.95), 0 0 30px rgba(16, 185, 129, 0.4)',
                border: '2px solid rgba(56, 189, 248, 0.4)',
                zIndex: 10
              }}
            >
              <div
                style={{
                  fontSize: 'clamp(0.6rem, 1.4vw, 0.95rem)',
                  fontWeight: 800,
                  color: '#93c5fd',
                  letterSpacing: '2.5px',
                  textTransform: 'uppercase',
                  marginBottom: '2px',
                  textShadow: '0 0 10px rgba(147,197,253,0.6)'
                }}
              >
                LOADING
              </div>
              <div
                style={{
                  fontSize: 'clamp(0.85rem, 1.8vw, 1.3rem)',
                  fontWeight: 900,
                  color: '#ffffff',
                  letterSpacing: '2px',
                  marginBottom: '4px',
                  textShadow: '0 0 15px rgba(255,255,255,0.8)'
                }}
              >
                HASI...
              </div>
              <div
                style={{
                  fontSize: 'clamp(1.15rem, 2.5vw, 1.85rem)',
                  fontWeight: 900,
                  color: updateProgress >= 100 ? '#4ade80' : '#38bdf8',
                  letterSpacing: '1px',
                  textShadow: updateProgress >= 100 ? '0 0 20px rgba(74, 222, 128, 0.9)' : '0 0 18px rgba(56, 189, 248, 0.85)'
                }}
              >
                {updateProgress}%
              </div>
            </div>
          </div>

          {/* Subtitle & Progress Status below visual */}
          <div style={{ marginTop: '1.4rem', textAlign: 'center' }}>
            <div style={{ color: '#ffffff', fontSize: '1.1rem', fontWeight: 800, letterSpacing: '0.6px', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
              {updateProgress < 100 ? 'Applying new system update deployed by HASI...' : '✨ HASI System Updated! Reloading ERP...'}
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '6px 0 0', fontWeight: 500 }}>
              Synchronizing latest software assets & clearing cache smoothly ({updateProgress}%)
            </p>
          </div>
        </div>
      )}

      {/* ── TOP NOTIFICATION BANNER ── */}
      {!isUpdating && hasUpdate && !isDismissed && (
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
            <span>New system update deployed by HASI!</span>
          </div>

          <button
            onClick={startUpdating}
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
        </div>
      )}

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
        @keyframes hasiFadeIn {
          from {
            opacity: 0;
            transform: scale(0.97);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes hasiPulse {
          0%, 100% {
            opacity: 0.55;
            transform: translate(-50%, -50%) scale(0.98);
          }
          50% {
            opacity: 0.95;
            transform: translate(-50%, -50%) scale(1.06);
          }
        }
      `}</style>
    </>
  );
}
