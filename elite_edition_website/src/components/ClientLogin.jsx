import React, { useState } from 'react';
import { api } from '../services/api';
import { 
  Building2, 
  Phone, 
  Lock, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
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

      <div className="glass-panel" style={styles.card}>
        {/* Top Header Badge */}
        <div style={styles.badgeRow}>
          <div style={styles.badge}>
            <Sparkles size={12} color="#10b981" />
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
                <Check size={13} color="#10b981" />
                <span style={{ color: '#10b981' }}>Link Copied</span>
              </>
            ) : (
              <>
                <Copy size={13} color="#94a3b8" />
                <span>Copy Client Link</span>
              </>
            )}
          </button>
        </div>

        {/* Brand Header */}
        <div style={styles.header}>
          <div style={styles.logoBadge}>
            <Building2 size={28} color="#10b981" />
          </div>
          <h2 style={styles.title}>Elite Edition</h2>
          <p style={styles.subtitle}>Welcome to your dedicated Client Order & Design Tracking Portal</p>
        </div>

        {/* Error message */}
        {error && (
          <div style={styles.errorContainer}>
            <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Registered Mobile Number</label>
            <div style={styles.inputWrapper}>
              <Phone size={16} style={styles.inputIcon} />
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
              <Lock size={16} style={styles.inputIcon} />
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
                {showPassword ? <EyeOff size={16} color="#94a3b8" /> : <Eye size={16} color="#94a3b8" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.submitBtn,
              opacity: loading ? 0.7 : 1,
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
            <ShieldCheck size={14} color="#10b981" />
            <span>End-to-End Encrypted Session</span>
          </div>

          {onSwitchToStaff && (
            <button
              type="button"
              onClick={onSwitchToStaff}
              style={styles.switchBtn}
            >
              Are you staff or admin? <strong>Go to Staff Login →</strong>
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
    background: 'radial-gradient(ellipse at top, #0f172a 0%, #030712 100%)',
    position: 'relative',
    overflow: 'hidden',
    padding: '1.5rem',
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  },
  bgGlowTop: {
    position: 'absolute',
    top: '-15%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '600px',
    height: '400px',
    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, rgba(0,0,0,0) 70%)',
    pointerEvents: 'none',
    zIndex: 0
  },
  bgGlowBottom: {
    position: 'absolute',
    bottom: '-10%',
    right: '10%',
    width: '500px',
    height: '350px',
    background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, rgba(0,0,0,0) 70%)',
    pointerEvents: 'none',
    zIndex: 0
  },
  card: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: '440px',
    padding: '2.5rem 2rem',
    borderRadius: '20px',
    background: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(16, 185, 129, 0.15)',
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
    gap: '0.4rem',
    padding: '0.3rem 0.65rem',
    borderRadius: '20px',
    background: 'rgba(16, 185, 129, 0.12)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    color: '#34d399',
    fontSize: '0.68rem',
    fontWeight: 800,
    letterSpacing: '0.05em'
  },
  copyLinkBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    padding: '0.3rem 0.6rem',
    color: '#94a3b8',
    fontSize: '0.72rem',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem'
  },
  logoBadge: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.3) 100%)',
    border: '1px solid rgba(16, 185, 129, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1rem auto',
    boxShadow: '0 8px 20px rgba(16, 185, 129, 0.2)'
  },
  title: {
    fontSize: '1.65rem',
    fontWeight: 800,
    color: '#ffffff',
    margin: '0 0 0.4rem 0',
    letterSpacing: '-0.02em'
  },
  subtitle: {
    fontSize: '0.85rem',
    color: '#94a3b8',
    margin: 0,
    lineHeight: 1.4
  },
  errorContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    fontSize: '0.82rem',
    marginBottom: '1.25rem',
    lineHeight: 1.3
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem'
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#cbd5e1',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(30, 41, 59, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    transition: 'border-color 0.15s ease',
    overflow: 'hidden'
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
    color: '#64748b',
    pointerEvents: 'none'
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem 0.75rem 2.5rem',
    background: 'transparent',
    border: 'none',
    color: '#ffffff',
    fontSize: '0.92rem',
    outline: 'none',
    boxSizing: 'border-box'
  },
  inputPassword: {
    width: '100%',
    padding: '0.75rem 2.8rem 0.75rem 2.5rem',
    background: 'transparent',
    border: 'none',
    color: '#ffffff',
    fontSize: '0.92rem',
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
    padding: '4px'
  },
  submitBtn: {
    marginTop: '0.5rem',
    padding: '0.85rem 1.25rem',
    borderRadius: '10px',
    border: 'none',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#ffffff',
    fontSize: '0.95rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)',
    transition: 'all 0.15s ease'
  },
  spinner: {
    width: '18px',
    height: '18px',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderTopColor: '#ffffff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  },
  footer: {
    marginTop: '2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.07)',
    paddingTop: '1.25rem'
  },
  securityNote: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.75rem',
    color: '#64748b'
  },
  switchBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '0.8rem',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '6px',
    transition: 'color 0.15s ease'
  }
};
