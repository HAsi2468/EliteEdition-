import React, { useEffect, useRef } from 'react';
import { 
  X, 
  ChevronUp, 
  ChevronDown, 
  Copy, 
  Check, 
  Printer, 
  ExternalLink, 
  Clock, 
  Layers, 
  Tag, 
  CheckCircle2, 
  FileText 
} from 'lucide-react';

/**
 * Enterprise High-Density Row Peek Drawer (Right-side Flyout Panel)
 * 
 * Inspects row records in-depth without triggering page transitions or losing
 * scroll offsets in high-density tables. Supports keyboard-driven record progression.
 */
export function RowPeekDrawer({
  isOpen,
  onClose,
  title = 'Record Details',
  subtitle,
  badgeText,
  badgeColor = '#2563eb',
  badgeBg = '#eff6ff',
  record = {},
  fields = [],
  currentIndex,
  totalCount,
  onNavigatePrevious,
  onNavigateNext,
  actions = [],
  children
}) {
  const [copied, setCopied] = React.useState(false);
  const drawerRef = useRef(null);

  // Keyboard navigation within drawer
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if ((e.key === 'ArrowUp' || e.key === 'k') && onNavigatePrevious) {
        // Prevent default only if not typing in input
        if (!['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
          e.preventDefault();
          onNavigatePrevious();
        }
      } else if ((e.key === 'ArrowDown' || e.key === 'j') && onNavigateNext) {
        if (!['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
          e.preventDefault();
          onNavigateNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onNavigatePrevious, onNavigateNext]);

  const handleCopyId = () => {
    const idToCopy = record?.id || record?.code || title;
    if (idToCopy && navigator.clipboard) {
      navigator.clipboard.writeText(String(idToCopy));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  const hasPagination = typeof currentIndex === 'number' && typeof totalCount === 'number';

  return (
    <div
      className="erp-peek-drawer-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        zIndex: 99990,
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'erpDrawerFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div
        ref={drawerRef}
        className="erp-peek-drawer-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '520px',
          height: '100dvh',
          backgroundColor: '#ffffff',
          boxShadow: '-8px 0 32px rgba(15, 23, 42, 0.18)',
          borderLeft: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          animation: 'erpDrawerSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative'
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#0f172a',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {title}
              </h3>

              {record?.id && (
                <button
                  type="button"
                  onClick={handleCopyId}
                  title="Copy ID to clipboard"
                  style={{
                    background: 'transparent',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    padding: '2px 5px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    color: copied ? '#16a34a' : '#64748b',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              )}

              {badgeText && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '999px',
                    backgroundColor: badgeBg,
                    color: badgeColor,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em'
                  }}
                >
                  {badgeText}
                </span>
              )}
            </div>

            {subtitle && (
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                {subtitle}
              </p>
            )}
          </div>

          {/* Record Stepper (Prev / Next) & Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {hasPagination && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  overflow: 'hidden'
                }}
              >
                <button
                  type="button"
                  title="Previous record (↑ / k)"
                  disabled={!onNavigatePrevious}
                  onClick={onNavigatePrevious}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: '5px 7px',
                    cursor: onNavigatePrevious ? 'pointer' : 'not-allowed',
                    opacity: onNavigatePrevious ? 1 : 0.4,
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <ChevronUp size={14} />
                </button>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#64748b',
                    padding: '0 6px',
                    borderLeft: '1px solid #e2e8f0',
                    borderRight: '1px solid #e2e8f0',
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  {currentIndex + 1} / {totalCount}
                </span>
                <button
                  type="button"
                  title="Next record (↓ / j)"
                  disabled={!onNavigateNext}
                  onClick={onNavigateNext}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: '5px 7px',
                    cursor: onNavigateNext ? 'pointer' : 'not-allowed',
                    opacity: onNavigateNext ? 1 : 0.4,
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              title="Close drawer (Esc)"
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {children}

          {/* Formatted Key-Value Grid */}
          {fields && fields.length > 0 && (
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                Attributes & Specifications
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                {fields.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid #f1f5f9',
                      borderRight: '1px solid #f1f5f9'
                    }}
                  >
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, marginBottom: '2px' }}>
                      {f.label}
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: f.color || '#1e293b',
                        fontVariantNumeric: f.isNumeric ? 'tabular-nums' : 'normal'
                      }}
                    >
                      {f.value ?? '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps & Audit Section */}
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: '#64748b'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={13} color="#94a3b8" />
              <span>Last inspected: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div>
              <span style={{ fontWeight: 600, color: '#334155' }}>Live ERP Synced</span>
            </div>
          </div>
        </div>

        {/* Drawer Action Footer */}
        {actions && actions.length > 0 && (
          <div
            style={{
              padding: '12px 18px',
              borderTop: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '8px'
            }}
          >
            {actions.map((act, i) => {
              const ActionIcon = act.icon;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    act.onClick?.(record);
                  }}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    border: act.variant === 'primary' ? 'none' : '1px solid #cbd5e1',
                    backgroundColor: act.variant === 'primary' ? 'var(--erp-primary, #2563eb)' : '#ffffff',
                    color: act.variant === 'primary' ? '#ffffff' : '#334155',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'opacity 0.15s ease'
                  }}
                >
                  {ActionIcon && <ActionIcon size={14} />}
                  <span>{act.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default RowPeekDrawer;
