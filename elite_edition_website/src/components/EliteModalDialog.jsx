import React, { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, CheckCircle2, XCircle, Info } from 'lucide-react';
export { triggerEliteAlert, triggerEliteConfirm, triggerElitePrompt } from '../services/dialogService';

export default function EliteModalDialog() {
  const [dialogState, setDialogState] = useState(null);
  const [promptValue, setPromptValue] = useState('');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartYRef = useRef(0);
  const currentYRef = useRef(0);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleDialogEvent = (e) => {
      setDialogState(e.detail);
      setPromptValue(e.detail.defaultValue || '');
      setDragOffset(0);
    };

    window.addEventListener('elite-modal-dialog', handleDialogEvent);
    return () => window.removeEventListener('elite-modal-dialog', handleDialogEvent);
  }, []);

  useEffect(() => {
    if (dialogState) {
      document.body.classList.add('body-scroll-lock');
      if (dialogState.mode === 'prompt') {
        setTimeout(() => inputRef.current?.focus(), 50);
      }
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
      } else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        handleConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogState, promptValue]);

  // Mobile swipe-to-dismiss handlers
  const handleTouchStart = (e) => {
    if (!isMobile) return;
    touchStartYRef.current = e.touches[0].clientY;
    currentYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || !isMobile) return;
    const clientY = e.touches[0].clientY;
    currentYRef.current = clientY;
    const diff = clientY - touchStartYRef.current;
    if (diff > 0) {
      setDragOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging || !isMobile) return;
    setIsDragging(false);
    const diff = currentYRef.current - touchStartYRef.current;
    if (diff > 90) {
      handleCancel();
    } else {
      setDragOffset(0);
    }
  };

  if (!dialogState) return null;

  const {
    mode = 'alert',
    title,
    message,
    type = 'info',
    confirmText = 'OK',
    cancelText = 'Cancel',
    placeholder = '',
    resolve
  } = dialogState;

  const handleConfirm = () => {
    const res = dialogState.resolve;
    setDialogState(null);
    if (res) {
      if (mode === 'prompt') {
        res(promptValue);
      } else {
        res(true);
      }
    }
  };

  const handleCancel = () => {
    const res = dialogState.resolve;
    setDialogState(null);
    if (res) {
      if (mode === 'prompt') {
        res(null);
      } else {
        res(false);
      }
    }
  };

  // Status Styling Configuration
  const isDanger = type === 'error' || type === 'danger';
  const isWarning = type === 'warning';
  const isSuccess = type === 'success';

  const statusConfig = isDanger
    ? {
        icon: <XCircle size={22} color="#dc2626" />,
        badgeBg: '#fef2f2',
        badgeBorder: '#fecaca',
        titleColor: '#991b1b',
        confirmBtnBg: 'linear-gradient(135deg, #ef4444, #dc2626)',
        confirmBtnColor: '#ffffff'
      }
    : isWarning
    ? {
        icon: <AlertTriangle size={22} color="#d97706" />,
        badgeBg: '#fffbeb',
        badgeBorder: '#fde68a',
        titleColor: '#92400e',
        confirmBtnBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
        confirmBtnColor: '#ffffff'
      }
    : isSuccess
    ? {
        icon: <CheckCircle2 size={22} color="#16a34a" />,
        badgeBg: '#f0fdf4',
        badgeBorder: '#bbf7d0',
        titleColor: '#166534',
        confirmBtnBg: 'linear-gradient(135deg, #10b981, #059669)',
        confirmBtnColor: '#ffffff'
      }
    : {
        icon: <Info size={22} color="#2563eb" />,
        badgeBg: '#eff6ff',
        badgeBorder: '#bfdbfe',
        titleColor: '#1e40af',
        confirmBtnBg: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
        confirmBtnColor: '#ffffff'
      };

  return (
    <div
      className="modal-overlay"
      onClick={handleCancel}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 10005,
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : '1rem'
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: isMobile ? '560px' : '460px',
          background: '#ffffff',
          borderRadius: isMobile ? '20px 20px 0 0' : '14px',
          border: isMobile ? 'none' : '1px solid #e2e8f0',
          boxShadow: isMobile ? '0 -8px 30px rgba(0,0,0,0.22)' : '0 20px 40px -10px rgba(0, 0, 0, 0.2), 0 0 20px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transform: isMobile ? `translateY(${dragOffset}px)` : 'none',
          transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          animation: isMobile ? 'none' : 'fadeInMenu 0.2s ease-out'
        }}
      >
        {/* Mobile Swipe Drag Pill */}
        {isMobile && (
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              padding: '8px 0 4px',
              cursor: 'grab',
              backgroundColor: '#ffffff'
            }}
          >
            <div
              style={{
                width: '40px',
                height: '4px',
                backgroundColor: '#cbd5e1',
                borderRadius: '999px'
              }}
            />
          </div>
        )}

        {/* Header with Status Icon Badge */}
        <div
          onTouchStart={isMobile ? handleTouchStart : undefined}
          onTouchMove={isMobile ? handleTouchMove : undefined}
          onTouchEnd={isMobile ? handleTouchEnd : undefined}
          style={{
            padding: '1.1rem 1.25rem 0.85rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.85rem',
            borderBottom: '1px solid #f1f5f9'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: statusConfig.badgeBg,
              border: `1px solid ${statusConfig.badgeBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {statusConfig.icon}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              style={{
                fontSize: '1.05rem',
                fontWeight: 700,
                color: '#0f172a',
                margin: 0,
                lineHeight: 1.3
              }}
            >
              {title}
            </h3>
          </div>

          <button
            onClick={handleCancel}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              padding: 0,
              flexShrink: 0
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '1rem 1.25rem', overflowY: 'auto', maxHeight: '60vh' }}>
          {message && (
            <p
              style={{
                fontSize: '0.88rem',
                color: '#475569',
                lineHeight: 1.55,
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {message}
            </p>
          )}

          {mode === 'prompt' && (
            <div style={{ marginTop: '0.85rem' }}>
              <input
                ref={inputRef}
                type="text"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                placeholder={placeholder}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  fontSize: '0.88rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}
        </div>

        {/* Sticky Footer Action Buttons */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            paddingBottom: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 1.1rem)' : '1.1rem',
            background: '#f8fafc',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            gap: '0.65rem',
            justifyContent: 'flex-end'
          }}
        >
          {(mode === 'confirm' || mode === 'prompt') && (
            <button
              onClick={handleCancel}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: '38px',
                transition: 'all 0.15s ease'
              }}
            >
              {cancelText}
            </button>
          )}

          <button
            onClick={handleConfirm}
            style={{
              padding: '0.55rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              background: statusConfig.confirmBtnBg,
              color: statusConfig.confirmBtnColor,
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              minHeight: '38px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
              transition: 'all 0.15s ease'
            }}
          >
            {mode === 'confirm' ? confirmText : mode === 'prompt' ? confirmText || 'Submit' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
