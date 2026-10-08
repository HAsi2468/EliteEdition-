import React from 'react';
import { AlertCircle, AlertTriangle, ArrowRight, X, Locate } from 'lucide-react';
import './ValidationDock.css';

/**
 * ValidationDock
 * 
 * Non-Blocking Validation Pill Tray.
 * Replaces native browser alerts with interactive pills.
 * Clicking a pill smoothly scrolls to and focuses the invalid field.
 */
export function ValidationDock({ errors = [], onDismiss, onNavigate }) {
  if (!errors || errors.length === 0) return null;

  const handlePillClick = (err) => {
    const fieldIdentifier = err.fieldId || err.id;
    const customSelector = err.selector;

    let targetEl = null;
    if (customSelector) {
      targetEl = document.querySelector(customSelector);
    }
    if (!targetEl && fieldIdentifier) {
      targetEl = document.getElementById(fieldIdentifier) ||
        document.querySelector(`[name="${fieldIdentifier}"]`) ||
        document.querySelector(`[data-field="${fieldIdentifier}"]`) ||
        document.querySelector(`.${fieldIdentifier}`);
    }

    if (targetEl) {
      // 1. Smooth scroll to center of viewport
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // 2. Focus and select
      setTimeout(() => {
        if (typeof targetEl.focus === 'function') {
          targetEl.focus();
        }
        if (typeof targetEl.select === 'function') {
          targetEl.select();
        }
        // 3. Apply pulsing halo
        targetEl.classList.remove('dock-field-highlight-pulse');
        void targetEl.offsetWidth; // trigger reflow
        targetEl.classList.add('dock-field-highlight-pulse');
        setTimeout(() => {
          targetEl.classList.remove('dock-field-highlight-pulse');
        }, 2200);
      }, 150);
    }

    if (typeof onNavigate === 'function') {
      onNavigate(err);
    }
  };

  return (
    <div className="validation-dock-container" role="alert" aria-live="assertive">
      <div className="validation-dock-card">
        {/* Header / Counter */}
        <div className="validation-dock-header">
          <div className="validation-dock-count-badge">
            <AlertCircle size={13} />
            <span>{errors.length} {errors.length === 1 ? 'Issue' : 'Issues'}</span>
          </div>
          <span className="validation-dock-title">Validation Dock</span>
        </div>

        {/* Scrollable Tray of Interactive Pills */}
        <div className="validation-pills-tray">
          {errors.map((err, idx) => (
            <button
              key={err.id || err.fieldId || idx}
              type="button"
              className="validation-pill-btn"
              onClick={() => handlePillClick(err)}
              title={`Click to jump to ${err.label || 'field'}`}
            >
              <Locate size={12} color="#fca5a5" />
              {err.label && (
                <span className="validation-pill-label">{err.label}:</span>
              )}
              <span className="validation-pill-msg">{err.message}</span>
              <ArrowRight size={11} color="#fca5a5" style={{ opacity: 0.7 }} />
            </button>
          ))}
        </div>

        {/* Dismiss Button */}
        {onDismiss && (
          <button
            type="button"
            className="validation-dock-dismiss-btn"
            onClick={onDismiss}
            title="Dismiss validation tray"
          >
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

export default ValidationDock;
