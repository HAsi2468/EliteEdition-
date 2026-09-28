import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Global trigger functions that replace browser alert(...) & window.confirm(...)
 * with a minimal, responsive modal dialog.
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
    if (dialogState) {
      document.body.classList.add('body-scroll-lock');
    } else {
      document.body.classList.remove('body-scroll-lock');
    }
    return () => {
      document.body.classList.remove('body-scroll-lock');
    };
  }, [dialogState]);

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

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div 
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '460px',
        }}
      >
        {/* Sticky Header */}
        <div className="modal-header-sticky">
          <h3 style={{
            fontSize: 'var(--font-size-title)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0
          }}>
            {title}
          </h3>
          <button
            onClick={handleCancel}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '44px',
              minHeight: '44px',
              padding: 0
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="modal-body-scrollable">
          {message && (
            <p style={{
              fontSize: 'var(--font-size-body)',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {message}
            </p>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="modal-footer-sticky" style={{ display: 'flex', gap: '8px' }}>
          {mode === 'confirm' && (
            <button
              onClick={handleCancel}
              className="btn btn-secondary"
              style={{
                flex: 1,
                minHeight: '44px',
                padding: '10px 16px',
                fontSize: 'var(--font-size-body)'
              }}
            >
              {cancelText}
            </button>
          )}

          <button
            onClick={handleConfirm}
            className={`btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            style={{
              flex: 1,
              minHeight: '44px',
              padding: '10px 16px',
              fontSize: 'var(--font-size-body)'
            }}
          >
            {mode === 'confirm' ? confirmText : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
