import React, { useState, useEffect } from 'react';
import { Lightbulb, ChevronLeft, ChevronRight, X } from 'lucide-react';
import './QuickTipPill.css';

const TIPS = [
  { id: 1, text: <>Press <kbd>Alt</kbd> + <kbd>Z</kbd> to toggle 100% full-screen Zen Focus mode</> },
  { id: 2, text: <>Press <kbd>?</kbd> anytime to open the complete Keyboard Shortcuts drawer</> },
  { id: 3, text: <>Right-click any table row for instant actions & printing</> },
  { id: 4, text: <>Hover over truncated cell text to inspect & 1-click copy values</> },
  { id: 5, text: <>Use <kbd>Alt</kbd> + <kbd>1/2/3</kbd> for instant pane hopping in MultiPane views</> },
  { id: 6, text: <>Scan any barcode hardware input to automatically find job cards</> }
];

/**
 * QuickTipPill
 * 
 * Compact, rotating smart tip bar docked at the bottom corner of the layout.
 * Cycles through helpful shortcuts, with next/prev controls and session dismiss.
 */
export function QuickTipPill() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem('quick_tips_dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  // Auto-advance tip every 12 seconds
  useEffect(() => {
    if (isDismissed) return;
    const interval = setInterval(() => {
      setCurrentIndex(i => (i + 1) % TIPS.length);
    }, 12000);

    return () => clearInterval(interval);
  }, [isDismissed]);

  const handlePrev = (e) => {
    e.stopPropagation();
    setCurrentIndex(i => (i - 1 + TIPS.length) % TIPS.length);
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setCurrentIndex(i => (i + 1) % TIPS.length);
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    setIsDismissed(true);
    sessionStorage.setItem('quick_tips_dismissed', 'true');
  };

  if (isDismissed) return null;

  return (
    <div className="quick-tip-pill-dock" role="status" aria-live="polite">
      <div className="quick-tip-icon-badge">
        <Lightbulb size={13} />
      </div>

      <div className="quick-tip-content">
        {TIPS[currentIndex].text}
      </div>

      <div className="quick-tip-controls">
        <button
          type="button"
          onClick={handlePrev}
          className="quick-tip-nav-btn"
          title="Previous Tip"
          aria-label="Previous Tip"
        >
          <ChevronLeft size={13} />
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="quick-tip-nav-btn"
          title="Next Tip"
          aria-label="Next Tip"
        >
          <ChevronRight size={13} />
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="quick-tip-nav-btn"
          title="Dismiss tips for this session"
          aria-label="Dismiss tips"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

export default QuickTipPill;
