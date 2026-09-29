import React, { useState, useEffect, useRef } from 'react';

/**
 * Mobile Bottom Action Sheet Component
 * Slides up from bottom on mobile viewports (<768px).
 * Features:
 * - Native swipe-to-dismiss gesture tracking
 * - Safe area inset support: env(safe-area-inset-bottom)
 * - Backdrop blur & touch-friendly tap targets
 */

export function BottomSheet({ isOpen, onClose, title = 'Filters', children, style = {} }) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartYRef = useRef(0);
  const currentYRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setDragOffset(0);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleTouchStart = (e) => {
    touchStartYRef.current = e.touches[0].clientY;
    currentYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const clientY = e.touches[0].clientY;
    currentYRef.current = clientY;
    const diff = clientY - touchStartYRef.current;
    if (diff > 0) {
      setDragOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const diff = currentYRef.current - touchStartYRef.current;
    if (diff > 90) {
      // Swiped down past threshold - dismiss
      onClose();
    } else {
      // Snap back
      setDragOffset(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        zIndex: 99995,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        animation: 'fadeInOverlay 0.18s ease-out'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: '#ffffff',
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          padding: '12px 18px',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          maxHeight: '88dvh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.18)',
          transform: `translateY(${dragOffset}px)`,
          transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          ...style
        }}
      >
        {/* Swipe drag handle area */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            padding: '4px 0 10px',
            cursor: 'grab'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '4px',
              backgroundColor: '#cbd5e1',
              borderRadius: '999px'
            }}
          />
        </div>

        {/* Header */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: '10px'
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#64748b',
              cursor: 'pointer',
              minHeight: '36px',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            Done
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
