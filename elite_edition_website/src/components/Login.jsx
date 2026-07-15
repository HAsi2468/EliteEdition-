import React, { useState, useEffect } from 'react';
import { api, getBaseUrl, setBaseUrl } from '../services/api';
import { Shield, Server, Activity, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('admin@elite.com'); // prefill a helper default if appropriate, or leave empty
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [serverMode, setServerMode] = useState('prod'); // 'prod' or 'local' or 'custom'
  const [customServerUrl, setCustomServerUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverUrlDisplay, setServerUrlDisplay] = useState(getBaseUrl());

  useEffect(() => {
    const current = getBaseUrl();
    if (current.includes('localhost') || current.includes('127.0.0.1')) {
      setServerMode('local');
    } else if (current.includes('3.7.174.180')) {
      setServerMode('prod');
    } else {
      setServerMode('custom');
      setCustomServerUrl(current.replace('/v1', ''));
    }
  }, []);

  const handleServerChange = (mode) => {
    setServerMode(mode);
    let targetUrl = '';
    if (mode === 'prod') {
      targetUrl = '/v1';
    } else if (mode === 'local') {
      targetUrl = 'http://localhost:3001/v1';
    } else {
      targetUrl = customServerUrl || 'http://localhost:3001/v1';
    }
    setBaseUrl(targetUrl);
    setServerUrlDisplay(getBaseUrl());
  };

  const handleCustomUrlChange = (e) => {
    const val = e.target.value;
    setCustomServerUrl(val);
    if (serverMode === 'custom') {
      setBaseUrl(val);
      setServerUrlDisplay(getBaseUrl());
    }
  };

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
      setError(err.message || 'Login failed. Please verify credentials and server connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div className="glass-panel" style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoBadge}>
            <Shield size={24} color="#06b6d4" />
          </div>
          <h2 style={styles.title}>Elite Edition</h2>
          <p style={styles.subtitle}>Enter credentials to access the inventory dashboard</p>
        </div>

        {error && <div style={styles.errorContainer}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email Address</label>
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
            <label style={styles.label}>Password</label>
            <div style={styles.passwordWrapper}>
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
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={styles.divider}>
            <span style={styles.dividerText}>Server Config</span>
          </div>

          <div style={styles.serverSelector}>
            <button
              type="button"
              onClick={() => handleServerChange('prod')}
              style={{
                ...styles.serverBtn,
                ...(serverMode === 'prod' ? styles.serverBtnActive : {}),
              }}
            >
              Production
            </button>
            <button
              type="button"
              onClick={() => handleServerChange('local')}
              style={{
                ...styles.serverBtn,
                ...(serverMode === 'local' ? styles.serverBtnActive : {}),
              }}
            >
              Localhost
            </button>
            <button
              type="button"
              onClick={() => handleServerChange('custom')}
              style={{
                ...styles.serverBtn,
                ...(serverMode === 'custom' ? styles.serverBtnActive : {}),
              }}
            >
              Custom
            </button>
          </div>

          {serverMode === 'custom' && (
            <div style={styles.inputGroup}>
              <input
                type="text"
                value={customServerUrl}
                onChange={handleCustomUrlChange}
                placeholder="http://192.168.1.100:3001"
                style={styles.input}
              />
            </div>
          )}

          <div style={styles.urlIndicator}>
            <Server size={12} color="#9ca3af" />
            <span style={styles.urlIndicatorText}>Connecting to: {serverUrlDisplay}</span>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={styles.submitBtn}
          >
            {loading ? (
              <span style={styles.spinner}></span>
            ) : (
              <>
                Sign In <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
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
    padding: '1.5rem',
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    padding: '2.5rem 2rem',
    borderRadius: 'var(--radius-lg)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  logoBadge: {
    display: 'inline-flex',
    padding: '0.8rem',
    borderRadius: '16px',
    background: 'rgba(6, 182, 212, 0.1)',
    border: '1px solid rgba(6, 182, 212, 0.2)',
    marginBottom: '1rem',
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.4rem',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    lineHeight: '1.4',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.2rem',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: '500',
    color: '#d1d5db',
    marginLeft: '2px',
  },
  input: {
    width: '100%',
  },
  passwordWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputPassword: {
    width: '100%',
    paddingRight: '2.5rem',
  },
  eyeBtn: {
    position: 'absolute',
    right: '0.5rem',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '0.4rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: '0.5rem 0',
  },
  dividerText: {
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
    paddingRight: '10px',
    fontWeight: '600',
  },
  serverSelector: {
    display: 'flex',
    background: 'rgba(17, 24, 39, 0.6)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-sm)',
    padding: '3px',
    gap: '4px',
  },
  serverBtn: {
    flex: 1,
    background: 'none',
    border: 'none',
    padding: '0.4rem 0.25rem',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    borderRadius: '4px',
    cursor: 'pointer',
    textAlign: 'center',
    fontWeight: '500',
    display: 'block',
  },
  serverBtnActive: {
    background: 'rgba(255, 255, 255, 0.08)',
    color: 'var(--text-primary)',
    fontWeight: '600',
  },
  urlIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-light)',
    padding: '0.5rem',
    borderRadius: '4px',
  },
  urlIndicatorText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  submitBtn: {
    width: '100%',
    justifyContent: 'center',
    marginTop: '0.5rem',
  },
  errorContainer: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.75rem',
    color: '#fca5a5',
    fontSize: '0.8rem',
    lineHeight: '1.4',
    marginBottom: '1rem',
  },
  spinner: {
    width: '18px',
    height: '18px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
  },
};
