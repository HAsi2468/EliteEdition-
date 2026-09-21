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
    <div style={styles.container}>
      {/* Background glow effects */}
      <div style={styles.bgGlowTop} />
      <div style={styles.bgGlowBottom} />

      <div style={styles.card}>
        {/* Top Header Badge & Copy Link */}
        <div style={styles.badgeRow}>
          <div style={styles.badge}>
            <Sparkles size={13} color="#2563eb" />
            <span>CLIENT & PARTNER PORTAL</span>
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            style={styles.copyLinkBtn}
            title="Copy direct link for clients"
          >
            {copiedLink ? (
              <>
                <Check size={13} color="#2563eb" />
                <span style={{ color: '#2563eb', fontWeight: 600 }}>Link Copied</span>
              </>
            ) : (
              <>
                <Copy size={13} color="#3b82f6" />
                <span>Copy Client Link</span>
              </>
            )}
          </button>
        </div>

        {/* Brand Header */}
        <div style={styles.header}>
          <div style={styles.logoBadge}>
            <Building2 size={30} color="#ffffff" />
          </div>
          <h2 style={styles.title}>Elite Edition</h2>
          <p style={styles.subtitle}>Welcome to your dedicated Client Order & Design Tracking Portal</p>
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
            <div style={styles.inputWrapper}>
              <Phone size={17} style={styles.inputIcon} />
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="e.g. 9876543210"
                style={styles.input}
                autoFocus
                required
              />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <div style={styles.inputWrapper}>
              <Lock size={17} style={styles.inputIcon} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={styles.inputPassword}
                required
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
            style={{
              ...styles.submitBtn,
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
            <span>End-to-End Encrypted Session</span>
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
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(ellipse at 50% 0%, #e0f2fe 0%, #eff6ff 45%, #ffffff 100%)',
    position: 'relative',
    overflow: 'hidden',
    padding: '1.5rem',
    boxSizing: 'border-box',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  bgGlowTop: {
    position: 'absolute',
    top: '-20%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '700px',
    height: '450px',
    background: 'radial-gradient(circle, rgba(37, 99, 235, 0.14) 0%, rgba(255, 255, 255, 0) 70%)',
    pointerEvents: 'none',
    zIndex: 0
  },
  bgGlowBottom: {
    position: 'absolute',
    bottom: '-15%',
    right: '10%',
    width: '600px',
    height: '400px',
    background: 'radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, rgba(255, 255, 255, 0) 70%)',
    pointerEvents: 'none',
    zIndex: 0
  },
  card: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: '440px',
    padding: '2.5rem 2rem',
    borderRadius: '24px',
    background: '#ffffff',
    border: '1px solid #dbeafe',
    boxShadow: '0 25px 50px -12px rgba(30, 64, 175, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.06)',
    boxSizing: 'border-box'
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1.5rem'
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
  copyLinkBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '0.35rem 0.65rem',
    color: '#475569',
    fontSize: '0.72rem',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem'
  },
  logoBadge: {
    width: '60px',
    height: '60px',
    borderRadius: '18px',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1.1rem auto',
    boxShadow: '0 10px 22px rgba(37, 99, 235, 0.35)'
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 800,
    color: '#0f172a',
    margin: '0 0 0.45rem 0',
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
    gap: '1.25rem'
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
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    background: '#f8fafc',
    border: '1.5px solid #cbd5e1',
    borderRadius: '12px',
    transition: 'all 0.15s ease',
    overflow: 'hidden'
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
    color: '#2563eb',
    pointerEvents: 'none'
  },
  input: {
    width: '100%',
    padding: '0.82rem 1rem 0.82rem 2.6rem',
    background: 'transparent',
    border: 'none',
    color: '#0f172a',
    fontSize: '0.94rem',
    fontWeight: 500,
    outline: 'none',
    boxSizing: 'border-box'
  },
  inputPassword: {
    width: '100%',
    padding: '0.82rem 2.8rem 0.82rem 2.6rem',
    background: 'transparent',
    border: 'none',
    color: '#0f172a',
    fontSize: '0.94rem',
    fontWeight: 500,
    outline: 'none',
    boxSizing: 'border-box'
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
  submitBtn: {
    marginTop: '0.5rem',
    padding: '0.9rem 1.25rem',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: '#ffffff',
    fontSize: '0.95rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.6rem',
    boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)',
    transition: 'all 0.15s ease'
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
    marginTop: '2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.9rem',
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
