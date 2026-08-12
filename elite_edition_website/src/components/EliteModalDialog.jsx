import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, XCircle, Info, HelpCircle, X, ShieldAlert, Trash2, Check } from 'lucide-react';

/**
 * Global trigger functions that replace browser alert(...) & window.confirm(...)
 * with a high-end, glassmorphic modal dialog.
 */
export const triggerEliteAlert = (title, message = '', type = 'info') => {
  return new Promise((resolve) => {
    const event = new CustomEvent('elite-modal-dialog', {
      detail: {
        mode: 'alert',
        title: typeof title === 'object' ? JSON.stringify(title) : String(title),
        message: typeof message === 'object' ? JSON.stringify(message) : String(message),
        type,
        resolve
      }
    });
    window.dispatchEvent(event);
  });
};

export const triggerEliteConfirm = ({ title, message = '', confirmText = 'Confirm', cancelText = 'Cancel', type = 'danger' }) => {
  return new Promise((resolve) => {
    const event = new CustomEvent('elite-modal-dialog', {
      detail: {
        mode: 'confirm',
        title: typeof title === 'object' ? JSON.stringify(title) : String(title),
        message: typeof message === 'object' ? JSON.stringify(message) : String(message),
        confirmText,
        cancelText,
        type,
        resolve
      }
    });
    window.dispatchEvent(event);
  });
};

export default function EliteModalDialog() {
  const [dialogState, setDialogState] = useState(null);

  useEffect(() => {
    const handleDialogEvent = (e) => {
      setDialogState(e.detail);
    };

    window.addEventListener('elite-modal-dialog', handleDialogEvent);
    return () => window.removeEventListener('elite-modal-dialog', handleDialogEvent);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!dialogState) return;
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter') {
        handleConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogState]);

  if (!dialogState) return null;

  const { mode, title, message, type = 'info', confirmText = 'Confirm', cancelText = 'Cancel', resolve } = dialogState;

  const handleConfirm = () => {
    setDialogState(null);
    if (resolve) resolve(true);
  };

  const handleCancel = () => {
    setDialogState(null);
    if (resolve) resolve(false);
  };

  const getThemeDetails = () => {
    switch (type) {
      case 'danger':
        return {
          icon: <Trash2 size={24} color="#fca5a5" />,
          badgeBg: 'rgba(239, 68, 68, 0.18)',
          badgeBorder: 'rgba(239, 68, 68, 0.4)',
          btnBg: 'linear-gradient(135deg, #ef4444, #dc2626)',
          btnColor: '#fff',
          btnShadow: '0 4px 14px rgba(239, 68, 68, 0.35)'
        };
      case 'warning':
        return {
          icon: <AlertTriangle size={24} color="#fde047" />,
          badgeBg: 'rgba(245, 158, 11, 0.18)',
          badgeBorder: 'rgba(245, 158, 11, 0.4)',
          btnBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
          btnColor: '#fff',
          btnShadow: '0 4px 14px rgba(245, 158, 11, 0.35)'
        };
      case 'success':
        return {
          icon: <CheckCircle2 size={24} color="#6ee7b7" />,
          badgeBg: 'rgba(16, 185, 129, 0.18)',
          badgeBorder: 'rgba(16, 185, 129, 0.4)',
          btnBg: 'linear-gradient(135deg, #10b981, #059669)',
          btnColor: '#fff',
          btnShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
        };
      default:
        return {
          icon: mode === 'confirm' ? <HelpCircle size={24} color="#38bdf8" /> : <Info size={24} color="#38bdf8" />,
          badgeBg: 'rgba(56, 189, 248, 0.18)',
          badgeBorder: 'rgba(56, 189, 248, 0.4)',
          btnBg: 'linear-gradient(135deg, #0284c7, #0369a1)',
          btnColor: '#fff',
          btnShadow: '0 4px 14px rgba(2, 132, 199, 0.35)'
        };
    }
  };

  const theme = getThemeDetails();

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 20000,
      background: 'rgba(5, 8, 15, 0.75)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.25rem',
      animation: 'fadeIn 0.15s ease-out'
    }}>
      <div style={{
        background: 'var(--bg-modal, #161b26)',
        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
        borderRadius: '16px',
        maxWidth: '460px',
        width: '100%',
        padding: '1.5rem',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        position: 'relative'
      }}>
        {/* Close Button */}
        <button
          onClick={handleCancel}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted, #94a3b8)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px'
          }}
        >
          <X size={18} />
        </button>

        {/* Content */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <div style={{
            width: 46,
            height: 46,
            borderRadius: '12px',
            background: theme.badgeBg,
            border: `1px solid ${theme.badgeBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {theme.icon}
          </div>

          <div style={{ flex: 1, minWidth: 0, paddingTop: '2px' }}>
            <h3 style={{
              fontSize: '1.05rem',
              fontWeight: 800,
              color: 'var(--text-primary, #f8fafc)',
              margin: 0,
              lineHeight: 1.3
            }}>
              {title}
            </h3>
            {message && (
              <p style={{
                fontSize: '0.82rem',
                color: 'var(--text-muted, #94a3b8)',
                marginTop: '0.4rem',
                marginBottom: 0,
                lineHeight: 1.45,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {message}
              </p>
            )}
          </div>
        </div>

        {/* Actions Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', paddingTop: '0.5rem' }}>
          {mode === 'confirm' && (
            <button
              onClick={handleCancel}
              className="btn-secondary"
              style={{
                padding: '0.55rem 1.1rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '8px'
              }}
            >
              {cancelText}
            </button>
          )}

          <button
            onClick={handleConfirm}
            style={{
              background: theme.btnBg,
              border: 'none',
              color: theme.btnColor,
              padding: '0.55rem 1.35rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: theme.btnShadow,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            {mode === 'confirm' ? <Check size={15} /> : null}
            {mode === 'confirm' ? confirmText : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
