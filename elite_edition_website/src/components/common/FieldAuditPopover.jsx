import React, { useState, useRef, useEffect } from 'react';
import { History, ArrowRight, ShieldCheck, X } from 'lucide-react';
import './FieldAuditPopover.css';

/**
 * FieldAuditPopover
 * 
 * Enterprise Audit Trail & Field History Popover.
 * Wraps high-risk financial, meterage, and stock fields (e.g., rate per meter, discount %,
 * inward quantity, credit limit) and renders a timestamped revision history on demand.
 */
export function FieldAuditPopover({
  fieldName = 'Field',
  currentValue,
  history = [],
  children,
  placement = 'bottom-start',
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Compute delta badge
  const renderDelta = (entry) => {
    if (entry.delta !== undefined) {
      const isPos = entry.delta > 0;
      return (
        <span className={`field-audit-delta-tag ${isPos ? 'positive' : 'negative'} tabular-nums`}>
          {isPos ? `+${entry.delta}` : entry.delta}
        </span>
      );
    }
    return null;
  };

  return (
    <div className={`field-audit-container ${className}`} ref={containerRef}>
      {/* Trigger: Render children or fallback to currentValue with history icon */}
      <div
        className="field-audit-trigger"
        onClick={() => setIsOpen(!isOpen)}
        title={`Click to view audit history for ${fieldName}`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setIsOpen(!isOpen)}
      >
        {children ? (
          children
        ) : (
          <span className="tabular-nums" style={{ fontWeight: 600 }}>
            {String(currentValue ?? '—')}
          </span>
        )}
        <History size={12} className="field-audit-icon" />
      </div>

      {/* Popover */}
      {isOpen && (
        <div className="field-audit-popover" role="dialog" aria-modal="true">
          <div className="field-audit-header">
            <span className="field-audit-title">
              <ShieldCheck size={14} color="#2563eb" />
              <span>{fieldName} Audit Trail</span>
            </span>
            <span className="field-audit-badge tabular-nums">
              {history.length} {history.length === 1 ? 'revision' : 'revisions'}
            </span>
          </div>

          <div className="field-audit-timeline">
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px', color: '#64748b', fontSize: '12px' }}>
                No prior revisions recorded for this field.
              </div>
            ) : (
              history.map((entry, idx) => (
                <div key={entry.id || idx} className="field-audit-entry">
                  <div className="field-audit-entry-top">
                    <span className="field-audit-user">{entry.userName || 'System Operator'}</span>
                    <span className="field-audit-time tabular-nums">
                      {entry.timestamp || entry.time || 'Recent'}
                    </span>
                  </div>

                  <div className="field-audit-diff">
                    {entry.oldValue !== undefined && (
                      <>
                        <span className="field-audit-old-val tabular-nums">{String(entry.oldValue)}</span>
                        <ArrowRight size={12} color="#94a3b8" />
                      </>
                    )}
                    <span className="field-audit-new-val tabular-nums">{String(entry.newValue)}</span>
                    {renderDelta(entry)}
                  </div>

                  {entry.reason && (
                    <p className="field-audit-reason">
                      "{entry.reason}"
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
