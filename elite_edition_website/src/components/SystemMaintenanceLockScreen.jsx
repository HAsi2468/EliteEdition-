import React, { useState } from 'react';
import { Lock, ShieldAlert, KeyRound, ArrowRight, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

export default function SystemMaintenanceLockScreen({ lockData, onAdminAuthSuccess }) {
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const lockedTimeStr = lockData?.systemLockedAt
    ? new Date(lockData.systemLockedAt).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    : '';

  const lockMessage =
    lockData?.systemLockMessage ||
    'System operations are temporarily paused by Administrator for routine maintenance.';

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!adminUsername || !adminPassword) {
      setAuthError('Please enter both administrator username and password');
      return;
    }

    setIsSubmitting(true);
    setAuthError('');

    try {
      const res = await api.login({
        username: adminUsername.trim(),
        password: adminPassword,
      });

      const user = res?.user || api.getCurrentUser();
      const isAdmin =
        user?.role === 'admin' ||
        user?.role === 'main_admin' ||
        user?.isMainAdmin ||
        user?.isAdmin === true ||
        user?.email === 'harshitsidapara2468@gmail.com';

      if (!isAdmin) {
        setAuthError('Access Denied: This account does not have Administrator privileges to unlock.');
        setIsSubmitting(false);
        return;
      }

      if (onAdminAuthSuccess) {
        onAdminAuthSuccess(user);
      }
    } catch (err) {
      setAuthError(err?.message || 'Invalid administrator credentials');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.overlay}>
      {/* Ambient background glows */}
      <div style={styles.glowTopLeft} />
      <div style={styles.glowBottomRight} />

      <div style={styles.card}>
        {/* Animated Security & Lock Icon with Rotating Halo */}
        <div style={styles.iconWrapper}>
          <div style={styles.haloRing} />
          <div style={styles.haloRingOuter} />
          <div style={styles.iconCircle}>
            <Lock size={36} color="#60a5fa" strokeWidth={2.2} />
          </div>
        </div>

        {/* Branding */}
        <div style={styles.brandBadge}>
          <span style={styles.brandDot} />
          ELITE EDITION ENTERPRISE ERP
        </div>

        {/* Main Status Headline */}
        <h1 style={styles.title}>System Operations Paused</h1>
        <p style={styles.message}>{lockMessage}</p>

        {/* Dynamic Loading State Indicator */}
        <div style={styles.statusBox}>
          <div style={styles.statusRow}>
            <span style={styles.pulseDot} />
            <span style={styles.statusText}>Live Connection Active • Standing by for Unlock Signal...</span>
          </div>

          <div style={styles.loaderBarContainer}>
            <div style={styles.loaderBarFill} />
          </div>

          <p style={styles.statusHint}>
            This screen will automatically unlock as soon as the administrator resumes system operations. No need to refresh the page.
          </p>

          {lockedTimeStr && (
            <div style={styles.timeTag}>
              Locked At: <strong>{lockedTimeStr}</strong>
            </div>
          )}
        </div>

        {/* Administrator Override / Emergency Login Drawer */}
        <div style={styles.adminSection}>
          {!showAdminLogin ? (
            <button
              type="button"
              onClick={() => setShowAdminLogin(true)}
              style={styles.adminToggleBtn}
            >
              <KeyRound size={14} />
              <span>Are you an Administrator? Sign in to unlock</span>
            </button>
          ) : (
            <form onSubmit={handleAdminLogin} style={styles.adminForm}>
              <div style={styles.formHeader}>
                <div style={styles.formTitle}>
                  <ShieldAlert size={16} color="#93c5fd" />
                  <span>Admin Authentication</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminLogin(false);
                    setAuthError('');
                  }}
                  style={styles.formCloseBtn}
                >
                  ✕
                </button>
              </div>

              {authError && <div style={styles.errorAlert}>{authError}</div>}

              <div style={styles.inputGroup}>
                <input
                  type="text"
                  placeholder="Admin username or email"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  disabled={isSubmitting}
                  style={styles.inputField}
                  autoFocus
                />
                <input
                  type="password"
                  placeholder="Admin password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  disabled={isSubmitting}
                  style={styles.inputField}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={styles.adminSubmitBtn}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="spin-loader" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Unlock with Admin Privileges</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.08); }
        }
        @keyframes rotateHalo {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes sweepBar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
          100% { transform: translateX(250%); }
        }
        @keyframes livePulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
        .spin-loader {
          animation: rotateHalo 1s linear infinite;
        }
      `}</style>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: '#070b14',
    zIndex: 9999999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    overflow: 'hidden',
    boxSizing: 'border-box',
    userSelect: 'none',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
  glowTopLeft: {
    position: 'absolute',
    top: '-20%',
    left: '-10%',
    width: '55vw',
    height: '55vw',
    background: 'radial-gradient(circle, rgba(37, 99, 235, 0.22) 0%, rgba(37, 99, 235, 0) 70%)',
    pointerEvents: 'none',
    animation: 'pulseGlow 6s ease-in-out infinite',
  },
  glowBottomRight: {
    position: 'absolute',
    bottom: '-25%',
    right: '-15%',
    width: '60vw',
    height: '60vw',
    background: 'radial-gradient(circle, rgba(14, 165, 233, 0.18) 0%, rgba(14, 165, 233, 0) 70%)',
    pointerEvents: 'none',
    animation: 'pulseGlow 8s ease-in-out infinite 1s',
  },
  card: {
    position: 'relative',
    zIndex: 10,
    maxWidth: '540px',
    width: '100%',
    background: 'rgba(15, 23, 42, 0.82)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '24px',
    boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(59, 130, 246, 0.15)',
    padding: '2.5rem 2.2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    color: '#ffffff',
  },
  iconWrapper: {
    position: 'relative',
    width: '96px',
    height: '96px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.25rem',
  },
  haloRing: {
    position: 'absolute',
    inset: '-6px',
    borderRadius: '50%',
    border: '2px dashed rgba(96, 165, 250, 0.45)',
    animation: 'rotateHalo 12s linear infinite',
  },
  haloRingOuter: {
    position: 'absolute',
    inset: '-14px',
    borderRadius: '50%',
    border: '1px solid rgba(59, 130, 246, 0.2)',
  },
  iconCircle: {
    width: '76px',
    height: '76px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
    border: '1px solid rgba(96, 165, 250, 0.4)',
    boxShadow: '0 0 25px rgba(59, 130, 246, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    background: 'rgba(59, 130, 246, 0.12)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '999px',
    padding: '0.35rem 0.9rem',
    fontSize: '0.75rem',
    fontWeight: '700',
    letterSpacing: '0.08em',
    color: '#93c5fd',
    marginBottom: '1rem',
  },
  brandDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#60a5fa',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: '800',
    color: '#f8fafc',
    margin: '0 0 0.6rem 0',
    letterSpacing: '-0.02em',
  },
  message: {
    fontSize: '0.95rem',
    color: '#94a3b8',
    lineHeight: '1.5',
    margin: '0 0 1.5rem 0',
    maxWidth: '440px',
  },
  statusBox: {
    width: '100%',
    background: 'rgba(30, 41, 59, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
    boxSizing: 'border-box',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
  },
  pulseDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#22c55e',
    display: 'inline-block',
    animation: 'livePulse 2s infinite',
  },
  statusText: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#4ade80',
    letterSpacing: '0.01em',
  },
  loaderBarContainer: {
    width: '100%',
    height: '5px',
    background: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '999px',
    overflow: 'hidden',
    position: 'relative',
  },
  loaderBarFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '45%',
    background: 'linear-gradient(90deg, #38bdf8, #3b82f6, #6366f1)',
    borderRadius: '999px',
    animation: 'sweepBar 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
  },
  statusHint: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    margin: 0,
    lineHeight: '1.4',
  },
  timeTag: {
    fontSize: '0.75rem',
    color: '#64748b',
    background: 'rgba(0, 0, 0, 0.25)',
    padding: '0.25rem 0.65rem',
    borderRadius: '6px',
  },
  adminSection: {
    marginTop: '1.4rem',
    width: '100%',
  },
  adminToggleBtn: {
    background: 'transparent',
    border: 'none',
    color: '#64748b',
    fontSize: '0.8rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    cursor: 'pointer',
    padding: '0.5rem 0.8rem',
    borderRadius: '8px',
    transition: 'all 0.2s ease',
  },
  adminForm: {
    width: '100%',
    background: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '14px',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    boxSizing: 'border-box',
    textAlign: 'left',
  },
  formHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.85rem',
    fontWeight: '700',
    color: '#93c5fd',
  },
  formCloseBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '0.9rem',
    padding: '0 0.25rem',
  },
  errorAlert: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
    padding: '0.45rem 0.75rem',
    borderRadius: '8px',
    fontSize: '0.8rem',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  inputField: {
    width: '100%',
    background: 'rgba(30, 41, 59, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '8px',
    padding: '0.55rem 0.75rem',
    color: '#ffffff',
    fontSize: '0.85rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  adminSubmitBtn: {
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    border: 'none',
    borderRadius: '8px',
    padding: '0.6rem 1rem',
    color: '#ffffff',
    fontSize: '0.85rem',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};
