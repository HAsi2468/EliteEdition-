import React, { useState, useEffect, useRef } from 'react';
import { Lightbulb, X, Check } from 'lucide-react';
import './FeatureCoachmark.css';

/**
 * FeatureCoachmark
 * 
 * Reusable wrapper component:
 * `<FeatureCoachmark id="zen-tip" title="Focus Mode" content="Alt+Z hides sidebars"> <Button /> </FeatureCoachmark>`
 * - Pulsing beacon ring on target elements not yet dismissed.
 * - Clicking opens anchored popover balloon with viewport boundary flipping and "Got it" / "Don't show again".
 */
export function FeatureCoachmark({
  id,
  title,
  content,
  children,
  placement = 'bottom', // 'top' | 'bottom' | 'left' | 'right'
  className = ''
}) {
  const [isDismissed, setIsDismissed] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    const dismissed = localStorage.getItem(`coachmark_dismissed_${id}`);
    if (!dismissed) {
      setIsDismissed(false);
    }
  }, [id]);

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!wrapperRef.current) return;

    const rect = wrapperRef.current.getBoundingClientRect();
    const popoverWidth = 280;
    const popoverHeight = 140;

    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    let top = rect.bottom + 8;

    // Viewport collision flipping
    if (top + popoverHeight > window.innerHeight) {
      top = Math.max(16, rect.top - popoverHeight - 8);
    }
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }
    left = Math.max(16, left);

    setCoords({ top, left });
    setIsOpen(o => !o);
  };

  const handleDismissPermanent = (e) => {
    e.stopPropagation();
    if (id) localStorage.setItem(`coachmark_dismissed_${id}`, 'true');
    setIsDismissed(true);
    setIsOpen(false);
  };

  const handleGotIt = (e) => {
    e.stopPropagation();
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className={`coachmark-wrapper ${className}`}>
      {children}

      {!isDismissed && (
        <div
          className="coachmark-beacon"
          onClick={handleToggle}
          title="Click to discover this feature"
          aria-label={`Feature tip: ${title}`}
        />
      )}

      {isOpen && (
        <div
          className="coachmark-popover"
          style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
          onClick={e => e.stopPropagation()}
        >
          <div className="coachmark-header">
            <div className="coachmark-title">
              <Lightbulb size={14} />
              <span>{title}</span>
            </div>
            <button
              type="button"
              onClick={handleGotIt}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
            >
              <X size={14} />
            </button>
          </div>

          <div className="coachmark-content">
            {content}
          </div>

          <div className="coachmark-actions">
            <button
              type="button"
              className="coachmark-btn dismiss"
              onClick={handleDismissPermanent}
            >
              Don't show again
            </button>
            <button
              type="button"
              className="coachmark-btn confirm"
              onClick={handleGotIt}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FeatureCoachmark;
