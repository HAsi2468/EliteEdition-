import React, { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft, ShieldAlert, KeyRound, ArrowRight, Loader2, Lock, Unlock, ServerOff } from 'lucide-react';
import { api } from '../services/api';

export default function SystemMaintenanceLockScreen({ lockData, onAdminAuthSuccess }) {
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date().toUTCString());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toUTCString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard shortcut: Ctrl+Shift+U or Cmd+Shift+U to open admin unlock modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
        setShowAdminLogin(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Secret click trigger: clicking 3 times on the 404 code opens admin login
  const handleSecretClick = () => {
    const nextCount = clickCount + 1;
    setClickCount(nextCount);
    if (nextCount >= 3) {
      setShowAdminLogin(true);
      setClickCount(0);
    }
  };

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
        user?.role === 'super_admin' ||
        user?.role === 'main_admin' ||
        user?.isMainAdmin ||
        user?.isAdmin === true ||
        (user?.username || '').toLowerCase() === 'admin';

      if (!isAdmin) {
        setAuthError('Access Denied: This account does not have Administrator privileges.');
        setIsSubmitting(false);
        return;
      }

      // Automatically unlock system on successful admin login
      try {
        await api.setSystemLockStatus(false);
      } catch (unlockErr) {
        console.warn('System auto-unlock warning:', unlockErr);
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

  const currentPath = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
  const currentHost = typeof window !== 'undefined' ? window.location.host : 'eliteedition.in';

  return (
    <div style={styles.container}>
      {/* Background Subtle Gradient Spheres */}
      <div style={styles.bgGlow1} />
      <div style={styles.bgGlow2} />

      {/* Main 404 Card */}
      <div style={styles.card}>
        {/* Error Code with secret trigger */}
        <div
          onClick={handleSecretClick}
          style={styles.errorCodeWrapper}
          title="HTTP 404"
        >
          <span style={styles.errorCode}>404</span>
          <div style={styles.errorPill}>
            <span style={styles.errorDot} />
            <span>NOT_FOUND</span>
          </div>
        </div>

        {/* Visual Badge Icon */}
        <div style={styles.iconBox}>
          <ServerOff size={32} color="#f87171" strokeWidth={2} />
        </div>

        {/* Headline */}
        <h1 style={styles.title}>404 - Page Not Found</h1>

        {/* Descriptive message */}
        <p style={styles.description}>
          The requested page or route could not be found on this server. The link you followed might be broken, or the resource is temporarily unavailable.
        </p>

        {/* Technical Server Diagnostic Details */}
        <div style={styles.techDetailsBox}>
          <div style={styles.techRow}>
            <span style={styles.techLabel}>Target Route:</span>
            <span style={{ ...styles.techValue, wordBreak: 'break-all' }}>{currentPath || '/'}</span>
          </div>
          <div style={styles.techRow}>
            <span style={styles.techLabel}>Host:</span>
            <span style={styles.techValue}>{currentHost}</span>
          </div>
          <div style={styles.techRow}>
            <span style={styles.techLabel}>Status Code:</span>
            <span style={styles.techBadge}>404 (Not Found)</span>
          </div>
          <div style={styles.techRow}>
            <span style={styles.techLabel}>Server Time:</span>
            <span style={styles.techValue}>{currentTime}</span>
          </div>
          <div style={styles.techRow}>
            <span style={styles.techLabel}>Diagnosis:</span>
            <span style={styles.techValue}>ERR_ROUTE_NOT_RESOLVED_ON_EDGE</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={styles.buttonGroup}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={styles.btnPrimary}
          >
            <RefreshCw size={16} />
            <span>Reload Page</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                window.location.href = '/';
              }
            }}
            style={styles.btnSecondary}
          >
            <ArrowLeft size={16} />
            <span>Go Back</span>
          </button>
        </div>

        {/* Subtle Footer with discreet Diagnostics / Admin access */}
        <div style={styles.footer}>
          <span>Server Cluster: Node / Edge Proxy</span>
          <span style={styles.separator}>•</span>
          <button
            type="button"
            onClick={() => setShowAdminLogin(true)}
            style={styles.subtleAdminTrigger}
            title="Administrator Diagnostics"
          >
            System Diagnostics
          </button>
        </div>
      </div>

      {/* Admin Unlock Modal */}
      {showAdminLogin && (
        <div style={styles.modalOverlay} onClick={() => setShowAdminLogin(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={styles.adminIconBox}>
                  <ShieldAlert size={18} color="#60a5fa" />
                </div>
                <div>
                  <h3 style={styles.modalTitle}>Admin Override & Unlock</h3>
                  <p style={styles.modalSubtitle}>Sign in with administrator credentials to restore the ERP</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAdminLogin(false);
                  setAuthError('');
                }}
                style={styles.closeBtn}
              >
                ✕
              </button>
            </div>

            {authError && (
              <div style={styles.errorAlert}>
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAdminLogin} style={styles.adminForm}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Admin Username / Email</label>
                <input
                  type="text"
                  placeholder="Enter administrator username"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  disabled={isSubmitting}
                  style={styles.input}
                  autoFocus
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Password</label>
                <input
                  type="password"
                  placeholder="Enter administrator password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  disabled={isSubmitting}
                  style={styles.input}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAdminLogin(false)}
                  style={styles.cancelBtn}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={styles.submitBtn}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="spin-loader" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Unlock size={16} />
                      <span>Authenticate & Unlock</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes floatGlow {
          0%, 100% { transform: translateY(0px) scale(1); opacity: 0.35; }
          50% { transform: translateY(-20px) scale(1.08); opacity: 0.65; }
        }
        @keyframes pulseDot {
          0%, 100% { transform: scale(0.9); opacity: 0.7; }
          50% { transform: scale(1.2); opacity: 1; }
        }
        .spin-loader {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: '#0a0e17',
    color: '#e2e8f0',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.25rem',
    boxSizing: 'border-box',
    overflow: 'auto',
    zIndex: 9999999,
  },
  bgGlow1: {
    position: 'absolute',
    top: '10%',
    left: '15%',
    width: '45vw',
    height: '45vw',
    maxWidth: '500px',
    maxHeight: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(239, 68, 68, 0.12) 0%, rgba(239, 68, 68, 0) 70%)',
    pointerEvents: 'none',
    animation: 'floatGlow 8s ease-in-out infinite',
  },
  bgGlow2: {
    position: 'absolute',
    bottom: '10%',
    right: '15%',
    width: '50vw',
    height: '50vw',
    maxWidth: '550px',
    maxHeight: '550px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0) 70%)',
    pointerEvents: 'none',
    animation: 'floatGlow 10s ease-in-out infinite 1s',
  },
  card: {
    position: 'relative',
    zIndex: 10,
    maxWidth: '560px',
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '24px',
    padding: '2.5rem 2rem',
    boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.04)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    boxSizing: 'border-box',
  },
  errorCodeWrapper: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    userSelect: 'none',
    marginBottom: '0.25rem',
  },
  errorCode: {
    fontSize: 'clamp(4.5rem, 12vw, 6.5rem)',
    fontWeight: '900',
    letterSpacing: '-0.04em',
    lineHeight: '1',
    background: 'linear-gradient(135deg, #f87171 0%, #ef4444 50%, #dc2626 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    textShadow: '0 10px 30px rgba(239, 68, 68, 0.25)',
  },
  errorPill: {
    position: 'absolute',
    bottom: '4px',
    right: '-16px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    borderRadius: '999px',
    padding: '0.25rem 0.65rem',
    fontSize: '0.72rem',
    fontWeight: '700',
    color: '#fca5a5',
    letterSpacing: '0.06em',
  },
  errorDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#ef4444',
    animation: 'pulseDot 2s ease-in-out infinite',
  },
  iconBox: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '0.5rem',
    marginBottom: '1rem',
  },
  title: {
    fontSize: 'clamp(1.4rem, 4vw, 1.85rem)',
    fontWeight: '800',
    color: '#f8fafc',
    margin: '0 0 0.5rem 0',
    letterSpacing: '-0.02em',
  },
  description: {
    fontSize: '0.95rem',
    lineHeight: '1.55',
    color: '#94a3b8',
    margin: '0 0 1.5rem 0',
    maxWidth: '460px',
  },
  techDetailsBox: {
    width: '100%',
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '14px',
    padding: '1rem 1.15rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.55rem',
    textAlign: 'left',
    boxSizing: 'border-box',
    marginBottom: '1.75rem',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '0.8rem',
  },
  techRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.75rem',
  },
  techLabel: {
    color: '#64748b',
    fontWeight: '500',
    flexShrink: 0,
  },
  techValue: {
    color: '#cbd5e1',
    fontWeight: '600',
    textAlign: 'right',
  },
  techBadge: {
    color: '#f87171',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    padding: '0.15rem 0.5rem',
    borderRadius: '6px',
    fontWeight: '700',
  },
  buttonGroup: {
    display: 'flex',
    gap: '0.85rem',
    width: '100%',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  btnPrimary: {
    flex: '1 1 180px',
    maxWidth: '220px',
    height: '44px',
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    fontWeight: '600',
    fontSize: '0.9rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
    transition: 'all 0.15s ease',
  },
  btnSecondary: {
    flex: '1 1 140px',
    maxWidth: '180px',
    height: '44px',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    color: '#cbd5e1',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '12px',
    fontWeight: '600',
    fontSize: '0.9rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    transition: 'all 0.15s ease',
  },
  footer: {
    marginTop: '1.75rem',
    fontSize: '0.74rem',
    color: '#475569',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  separator: {
    color: '#334155',
  },
  subtleAdminTrigger: {
    background: 'none',
    border: 'none',
    color: '#475569',
    cursor: 'pointer',
    fontSize: '0.74rem',
    padding: 0,
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
    transition: 'color 0.15s',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000000,
    padding: '1.25rem',
    boxSizing: 'border-box',
  },
  modalCard: {
    maxWidth: '440px',
    width: '100%',
    backgroundColor: '#0f172a',
    border: '1px solid rgba(59, 130, 246, 0.25)',
    borderRadius: '20px',
    padding: '1.75rem',
    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9)',
    boxSizing: 'border-box',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '1.25rem',
  },
  adminIconBox: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    border: '1px solid rgba(59, 130, 246, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: '700',
    color: '#f8fafc',
  },
  modalSubtitle: {
    margin: '0.2rem 0 0 0',
    fontSize: '0.8rem',
    color: '#94a3b8',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '1.1rem',
    padding: '0.2rem',
  },
  errorAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
    padding: '0.65rem 0.85rem',
    borderRadius: '10px',
    fontSize: '0.82rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  adminForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    textAlign: 'left',
  },
  label: {
    fontSize: '0.78rem',
    fontWeight: '600',
    color: '#94a3b8',
  },
  input: {
    width: '100%',
    backgroundColor: '#1e293b',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    padding: '0.65rem 0.85rem',
    color: '#f8fafc',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  cancelBtn: {
    flex: 1,
    height: '42px',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  submitBtn: {
    flex: 1.5,
    height: '42px',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    border: 'none',
    borderRadius: '10px',
    color: '#ffffff',
    fontWeight: '600',
    fontSize: '0.85rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  },
};
