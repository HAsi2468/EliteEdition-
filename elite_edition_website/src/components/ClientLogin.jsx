import React, { useState } from 'react';
import { api } from '../services/api';
import { 
  Building2, 
  Phone, 
  Lock, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Sparkles, 
  ShieldCheck, 
  Copy, 
  Check 
} from 'lucide-react';

export default function ClientLogin({ onLoginSuccess, onSwitchToStaff }) {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mobile.trim() || !password.trim()) {
      setError('Please enter both your registered mobile number and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.clientLogin({
        mobile: mobile.trim(),
        password: password.trim()
      });
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please verify your mobile number and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/#client-login`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  return (
    <div className="client-login-container" style={styles.container}>
      <style>{`
        .client-login-container {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at 50% 0%, #dbeafe 0%, #eff6ff 45%, #ffffff 100%);
          position: relative;
          overflow: hidden;
          padding: 1.5rem;
          box-sizing: border-box;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .client-login-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 440px;
          padding: 2.5rem 2rem;
          border-radius: 24px;
          background: #ffffff;
          border: 1px solid #bfdbfe;
          box-shadow: 0 25px 50px -12px rgba(30, 64, 175, 0.16), 0 0 0 1px rgba(59, 130, 246, 0.08);
          box-sizing: border-box;
          transition: transform 0.2s ease;
        }
        .client-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          background: #f8fafc;
          border: 1.5px solid #cbd5e1;
          border-radius: 12px;
          transition: all 0.2s ease;
          overflow: hidden;
        }
        .client-input-wrapper:focus-within {
          border-color: #2563eb !important;
          background: #ffffff !important;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15) !important;
        }
        .client-input-field {
          width: 100%;
          padding: 0.85rem 1rem 0.85rem 2.6rem;
          background: transparent;
          border: none;
          color: #0f172a;
          font-size: 16px; /* Prevents auto-zoom on iOS Safari */
          font-weight: 500;
          outline: none;
          box-sizing: border-box;
        }
        .client-input-field::placeholder {
          color: #94a3b8;
          font-weight: 400;
        }
        .client-btn-primary {
          margin-top: 0.5rem;
          padding: 0.9rem 1.25rem;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          font-size: 0.96rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          box-shadow: 0 6px 20px rgba(37, 99, 235, 0.35);
          cursor: pointer;
          transition: all 0.18s ease;
          width: 100%;
          box-sizing: border-box;
        }
        .client-btn-primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
          box-shadow: 0 8px 25px rgba(37, 99, 235, 0.45);
          transform: translateY(-1px);
        }
        .client-btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }
        .client-copy-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          padding: 0.35rem 0.65rem;
          color: #1d4ed8;
          font-size: 0.72rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .client-copy-btn:hover {
          background: #dbeafe;
          border-color: #93c5fd;
        }
        @media (max-width: 480px) {
          .client-login-container {
            padding: 1rem 0.75rem !important;
          }
          .client-login-card {
            padding: 1.75rem 1.15rem !important;
            border-radius: 20px !important;
          }
          .client-title {
            font-size: 1.5rem !important;
          }
          .client-subtitle {
            font-size: 0.82rem !important;
          }
          .client-logo-badge {
            width: 52px !important;
            height: 52px !important;
            border-radius: 15px !important;
            margin-bottom: 0.85rem !important;
          }
        }
      `}</style>

      {/* Ambient background glows */}
      <div style={styles.bgGlowTop} />
      <div style={styles.bgGlowBottom} />

      <div className="client-login-card">
        {/* Top Header Badge & Copy Link */}
        <div style={styles.badgeRow}>
          <div style={styles.badge}>
            <Sparkles size={13} color="#2563eb" />
            <span>CLIENT & PARTNER PORTAL</span>
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            className="client-copy-btn"
            title="Copy direct link for clients"
          >
            {copiedLink ? (
              <>
                <Check size={13} color="#2563eb" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <Copy size={13} color="#2563eb" />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>

        {/* Brand Header */}
        <div style={styles.header}>
          <div className="client-logo-badge" style={styles.logoBadge}>
            <Building2 size={30} color="#ffffff" />
          </div>
          <h2 className="client-title" style={styles.title}>Elite Edition</h2>
          <p className="client-subtitle" style={styles.subtitle}>
            Client Order & Design Tracking Portal
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div style={styles.errorContainer}>
            <AlertCircle size={16} color="#dc2626" style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Registered Mobile Number</label>
            <div className="client-input-wrapper">
              <Phone size={17} style={styles.inputIcon} />
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="e.g. 9876543210"
                className="client-input-field"
                autoFocus
                required
                autoComplete="tel"
              />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <div className="client-input-wrapper">
              <Lock size={17} style={styles.inputIcon} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="client-input-field"
                style={{ paddingRight: '2.8rem' }}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={17} color="#64748b" /> : <Eye size={17} color="#64748b" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="client-btn-primary"
            style={{
              opacity: loading ? 0.75 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? (
              <span style={styles.spinner} />
            ) : (
              <>
                <span>Access Client Portal</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Footer info & Switch */}
        <div style={styles.footer}>
          <div style={styles.securityNote}>
            <ShieldCheck size={15} color="#2563eb" />
            <span>End-to-End Encrypted Secure Portal</span>
          </div>

          {onSwitchToStaff && (
            <button
              type="button"
              onClick={onSwitchToStaff}
              style={styles.switchBtn}
            >
              Are you staff or admin? <strong style={{ color: '#2563eb' }}>Go to Staff Login →</strong>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {},
  bgGlowTop: {
    position: 'absolute',
    top: '-20%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '700px',
    height: '450px',
    background: 'radial-gradient(circle, rgba(37, 99, 235, 0.12) 0%, rgba(255, 255, 255, 0) 70%)',
    pointerEvents: 'none',
    zIndex: 0
  },
  bgGlowBottom: {
    position: 'absolute',
    bottom: '-15%',
    right: '10%',
    width: '600px',
    height: '400px',
    background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, rgba(255, 255, 255, 0) 70%)',
    pointerEvents: 'none',
    zIndex: 0
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    marginBottom: '1.5rem',
    flexWrap: 'wrap'
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.35rem 0.75rem',
    borderRadius: '20px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    color: '#1d4ed8',
    fontSize: '0.7rem',
    fontWeight: 800,
    letterSpacing: '0.04em'
  },
  header: {
    textAlign: 'center',
    marginBottom: '1.75rem'
  },
  logoBadge: {
    width: '60px',
    height: '60px',
    borderRadius: '18px',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1rem auto',
    boxShadow: '0 10px 22px rgba(37, 99, 235, 0.3)'
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 800,
    color: '#0f172a',
    margin: '0 0 0.4rem 0',
    letterSpacing: '-0.02em'
  },
  subtitle: {
    fontSize: '0.88rem',
    color: '#64748b',
    margin: 0,
    lineHeight: 1.45
  },
  errorContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    padding: '0.8rem 1rem',
    borderRadius: '12px',
    fontSize: '0.83rem',
    marginBottom: '1.35rem',
    lineHeight: 1.35
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.15rem'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem'
  },
  label: {
    fontSize: '0.74rem',
    fontWeight: 700,
    color: '#1e293b',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
    color: '#2563eb',
    pointerEvents: 'none'
  },
  eyeBtn: {
    position: 'absolute',
    right: '10px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5px'
  },
  spinner: {
    width: '18px',
    height: '18px',
    border: '2px solid rgba(255, 255, 255, 0.35)',
    borderTopColor: '#ffffff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  },
  footer: {
    marginTop: '1.75rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.85rem',
    borderTop: '1px solid #e2e8f0',
    paddingTop: '1.25rem'
  },
  securityNote: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    fontSize: '0.78rem',
    color: '#64748b'
  },
  switchBtn: {
    background: 'none',
    border: 'none',
    color: '#475569',
    fontSize: '0.82rem',
    cursor: 'pointer',
    padding: '5px 10px',
    borderRadius: '6px',
    transition: 'color 0.15s ease'
  }
};
