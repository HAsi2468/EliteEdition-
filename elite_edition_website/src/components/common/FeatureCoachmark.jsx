import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Lightbulb, X, Check, HelpCircle, ExternalLink, Zap } from 'lucide-react';
import './FeatureCoachmark.css';

/**
 * FeatureCoachmark
 * 
 * Deep-Detail Feature Discovery & In-App Guidance Coachmark.
 * Persists dismissal state in `localStorage` under `coachmark_dismissed_${id}`.
 * 
 * Structured Metadata Specification:
 * 1. Title & Tag (e.g., "Consolidated Actions" with "NEW" or "UPDATED" badge).
 * 2. Contextual Description: Clear operational explanation.
 * 3. Actionable Keyboard Shortcut: `<kbd>` key token display.
 * 4. Pro Tip Callout Box: Highlighted container showing high-productivity workflow advice.
 * 5. Action Buttons: "Got it" (permanently dismisses beacon) & optional "Learn More" callback.
 */
export function FeatureCoachmark({
  id,
  title,
  tag = 'NEW',
  description = '',
  content = '', // Backwards compatibility fallback
  shortcut = null, // string (e.g. 'Ctrl + S') or array (e.g. ['Ctrl', 'S'])
  proTip = '',
  onLearnMore = null,
  children,
  placement = 'bottom', // 'top' | 'bottom' | 'left' | 'right'
  className = ''
}) {
  const [isDismissed, setIsDismissed] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef(null);

  // Check localStorage for persisted dismissal
  useEffect(() => {
    if (!id) return;
    const dismissed = localStorage.getItem(`coachmark_dismissed_${id}`);
    if (!dismissed) {
      setIsDismissed(false);
    }
  }, [id]);

  const updatePosition = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const popoverWidth = 320;
    const popoverHeight = 220;

    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    let top = rect.bottom + 8;

    // Viewport boundary collision flipping
    if (top + popoverHeight > window.innerHeight) {
      top = Math.max(16, rect.top - popoverHeight - 8);
    }
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }
    left = Math.max(16, left);

    setCoords({ top, left });
  }, []);

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen((prev) => !prev);
  };

  const handleGotIt = (e) => {
    e?.stopPropagation();
    if (id) {
      localStorage.setItem(`coachmark_dismissed_${id}`, 'true');
    }
    setIsDismissed(true);
    setIsOpen(false);
  };

  const handleDismissTemporary = (e) => {
    e?.stopPropagation();
    setIsOpen(false);
  };

  const textDescription = description || content;

  // Format shortcut tokens for <kbd> rendering
  const renderShortcutTokens = () => {
    if (!shortcut) return null;
    if (Array.isArray(shortcut)) {
      return (
        <span className="coachmark-shortcut-tokens">
          {shortcut.map((k, i) => (
            <React.Fragment key={i}>
              <kbd className="coachmark-kbd">{k}</kbd>
              {i < shortcut.length - 1 && <span className="coachmark-kbd-sep">+</span>}
            </React.Fragment>
          ))}
        </span>
      );
    }
    // String shortcut: split on "+"
    const tokens = String(shortcut).split('+').map((s) => s.trim());
    return (
      <span className="coachmark-shortcut-tokens">
        {tokens.map((k, i) => (
          <React.Fragment key={i}>
            <kbd className="coachmark-kbd">{k}</kbd>
            {i < tokens.length - 1 && <span className="coachmark-kbd-sep">+</span>}
          </React.Fragment>
        ))}
      </span>
    );
  };

  return (
    <div ref={wrapperRef} className={`coachmark-wrapper ${className}`}>
      {children}

      {!isDismissed && (
        <button
          type="button"
          className="coachmark-beacon"
          onClick={handleToggle}
          onMouseEnter={updatePosition}
          title={`Discover: ${title}`}
          aria-label={`Feature Discovery Beacon: ${title}`}
          aria-expanded={isOpen}
        >
          <span className="coachmark-beacon-dot" />
        </button>
      )}

      {isOpen && (
        <>
          <div className="coachmark-backdrop" onClick={handleDismissTemporary} />
          <div
            className="coachmark-popover"
            style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="false"
            aria-label={title}
          >
            {/* Header: Title & Semantic Tag */}
            <div className="coachmark-header">
              <div className="coachmark-title-group">
                <span className="coachmark-title">{title}</span>
                {tag && <span className="coachmark-tag">{tag}</span>}
              </div>
              <button
                type="button"
                className="coachmark-close-btn"
                onClick={handleDismissTemporary}
                aria-label="Close feature tip"
              >
                <X size={14} />
              </button>
            </div>

            {/* Contextual Description */}
            {textDescription && (
              <p className="coachmark-description">{textDescription}</p>
            )}

            {/* Actionable Keyboard Shortcut */}
            {shortcut && (
              <div className="coachmark-shortcut-row">
                <span className="coachmark-shortcut-label">Shortcut:</span>
                {renderShortcutTokens()}
              </div>
            )}

            {/* Pro Tip Callout Box */}
            {proTip && (
              <div className="coachmark-protip-box">
                <Zap size={14} className="coachmark-protip-icon" />
                <span className="coachmark-protip-text">{proTip}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="coachmark-actions">
              {onLearnMore && (
                <button
                  type="button"
                  className="coachmark-btn coachmark-btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLearnMore();
                  }}
                >
                  Learn More
                  <ExternalLink size={12} style={{ marginLeft: 4 }} />
                </button>
              )}
              <button
                type="button"
                className="coachmark-btn coachmark-btn-primary"
                onClick={handleGotIt}
              >
                <Check size={12} style={{ marginRight: 4 }} />
                Got it
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

FeatureCoachmark.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  tag: PropTypes.string,
  description: PropTypes.string,
  content: PropTypes.string,
  shortcut: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
  proTip: PropTypes.string,
  onLearnMore: PropTypes.func,
  children: PropTypes.node.isRequired,
  placement: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
  className: PropTypes.string
};

export default FeatureCoachmark;
