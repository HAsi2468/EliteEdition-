import React, { useState } from 'react';
import { api } from '../services/api';

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
      setError('Please enter both mobile number and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.clientLogin({
        mobile: mobile.trim(),
        password: password.trim(),
      });
      if (onLoginSuccess) {
        onLoginSuccess(res);
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/#client-login`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <img
            src="/Logo.png"
            alt="Client Portal"
            style={styles.logo}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <h1 style={styles.title}>Client Portal</h1>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Mobile Number</label>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="Enter 10-digit mobile"
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
            onClick={onSwitchToStaff || (() => { window.location.hash = ''; })}
            style={styles.secondaryBtn}
          >
            Staff Login
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            style={styles.textBtn}
          >
            {copiedLink ? 'Link copied' : 'Copy portal link'}
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
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'center',
  },
  secondaryBtn: {
    width: '100%',
    minHeight: '44px',
    fontSize: 'var(--font-size-body, 0.875rem)',
  },
  textBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted, #64748b)',
    fontSize: 'var(--font-size-meta, 0.75rem)',
    cursor: 'pointer',
    padding: '6px',
    minHeight: 'auto',
  },
};
