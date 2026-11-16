import React, { useState, useEffect } from 'react';
import { api, fetchCsrfToken } from '../services/api';

export default function Login({ onLoginSuccess, onSwitchToClient }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCsrfToken().catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.login(email, password);
      onLoginSuccess();
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoCapsule} className="glass-logo-badge">
            <img
              src="/Logo.png"
              alt="Elite Edition"
              style={styles.logo}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h1 style={styles.title}>Elite Edition</h1>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              style={styles.input}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <div style={styles.labelRow}>
              <label style={styles.label}>Password</label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.toggleBtn}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={styles.input}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={styles.submitBtn}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={styles.footer}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onSwitchToClient || (() => { window.location.hash = '#client-login'; })}
            style={styles.switchBtn}
          >
            Client Login
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '16px',
    background: 'radial-gradient(circle at 20% 20%, rgba(37, 99, 235, 0.22) 0%, rgba(9, 15, 29, 0.98) 48%), linear-gradient(135deg, #090f1d 0%, #0d1527 100%)',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    padding: '32px 26px',
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(56, 189, 248, 0.28)',
    borderRadius: '16px',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.16)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  logoCapsule: {
    height: '54px',
    padding: '8px 20px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(11, 17, 32, 0.96) 100%)',
    border: '1px solid rgba(56, 189, 248, 0.45)',
    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.4), 0 0 18px rgba(56, 189, 248, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.28)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    height: '34px',
    width: 'auto',
    display: 'block',
    filter: 'drop-shadow(0 2px 8px rgba(251, 191, 36, 0.38)) brightness(1.12)',
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: '800',
    color: '#ffffff',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  toggleBtn: {
    background: 'none',
    border: 'none',
    color: '#38bdf8',
    fontSize: '0.75rem',
    fontWeight: '700',
    cursor: 'pointer',
    padding: '0 4px',
    minHeight: 'auto',
  },
  input: {
    width: '100%',
    minHeight: '44px',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.16)',
    fontSize: '0.88rem',
    color: '#ffffff',
    backgroundColor: 'rgba(11, 17, 32, 0.85)',
    boxSizing: 'border-box',
  },
  submitBtn: {
    width: '100%',
    minHeight: '44px',
    marginTop: '8px',
    fontSize: '0.9rem',
    fontWeight: '700',
    borderRadius: '10px',
  },
  error: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    border: '1px solid rgba(239, 68, 68, 0.42)',
    borderRadius: '10px',
    padding: '8px 12px',
    color: '#fca5a5',
    fontSize: '0.78rem',
    fontWeight: '600',
    marginBottom: '16px',
  },
  footer: {
    marginTop: '24px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.12)',
    textAlign: 'center',
  },
  switchBtn: {
    width: '100%',
    minHeight: '44px',
    fontSize: '0.875rem',
    borderRadius: '10px',
  },
};
