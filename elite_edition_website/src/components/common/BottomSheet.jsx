import React, { useEffect } from 'react';

/**
 * Minimal Mobile Bottom Sheet Component
 * Slides up from bottom on mobile viewports for filters and settings.
 * Includes safe area padding and clean dismissal.
 */

export function BottomSheet({ isOpen, onClose, title = 'Filters', children, style = {} }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        zIndex: 99995,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '540px',
          backgroundColor: '#ffffff',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          padding: '16px 20px',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          maxHeight: '85dvh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
          ...style
        }}
      >
        {/* Drag handle pill */}
        <div
          style={{
            width: '36px',
            height: '4px',
            backgroundColor: '#cbd5e1',
            borderRadius: '2px',
            alignSelf: 'center',
            marginBottom: '12px'
          }}
        />

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: '10px'
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '13px',
              fontWeight: 500,
              color: '#64748b',
              cursor: 'pointer',
              minHeight: '44px',
              minWidth: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default BottomSheet;
