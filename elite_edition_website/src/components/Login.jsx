import React, { useState } from 'react';
import { api } from '../services/api';

export default function Login({ onLoginSuccess, onSwitchToClient }) {
  const [email, setEmail] = useState('harshitsidapara2468@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
          <img
            src="/Logo.png"
            alt="Elite Edition"
            style={styles.logo}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
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
    backgroundColor: 'var(--bg-main, #f8fafc)',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    padding: '32px 24px',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border-color, #e2e8f0)',
    borderRadius: '8px',
    boxShadow: 'none',
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  logo: {
    height: '40px',
    width: 'auto',
    marginBottom: '12px',
    display: 'inline-block',
  },
  title: {
    fontSize: 'var(--font-size-title, 1.125rem)',
    fontWeight: '600',
    color: 'var(--text-primary, #0f172a)',
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
    fontSize: 'var(--font-size-meta, 0.75rem)',
    fontWeight: '500',
    color: 'var(--text-primary, #0f172a)',
    marginBottom: '4px',
  },
  toggleBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted, #64748b)',
    fontSize: 'var(--font-size-meta, 0.75rem)',
    cursor: 'pointer',
    padding: '0 4px',
    minHeight: 'auto',
  },
  input: {
    width: '100%',
    minHeight: '44px',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border-color, #e2e8f0)',
    fontSize: 'var(--font-size-body, 0.875rem)',
    color: 'var(--text-primary, #0f172a)',
    backgroundColor: '#ffffff',
  },
  submitBtn: {
    width: '100%',
    minHeight: '44px',
    marginTop: '8px',
    fontSize: 'var(--font-size-body, 0.875rem)',
    fontWeight: '500',
  },
  error: {
    backgroundColor: 'var(--danger-bg, #fef2f2)',
    border: '1px solid var(--danger-border, #fecaca)',
    borderRadius: '8px',
    padding: '8px 12px',
    color: 'var(--danger-text, #991b1b)',
    fontSize: 'var(--font-size-meta, 0.75rem)',
    marginBottom: '16px',
  },
  footer: {
    marginTop: '24px',
    paddingTop: '16px',
    borderTop: '1px solid var(--border-color, #e2e8f0)',
    textAlign: 'center',
  },
  switchBtn: {
    width: '100%',
    minHeight: '44px',
    fontSize: 'var(--font-size-body, 0.875rem)',
  },
};
