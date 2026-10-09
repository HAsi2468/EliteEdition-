import React, { useState, useEffect } from 'react';
import { Lightbulb, ChevronLeft, ChevronRight, X, Clock } from 'lucide-react';
import './QuickTipBar.css';

const DEFAULT_TIPS = [
  'Tip: Press Tab to move across grid cells and Enter to commit and step down.',
  'Tip: Hold Alt to view hotkey mnemonic overlays over actionable buttons.',
  'Tip: Press Ctrl + K anywhere to open the Global Omnibar Command Palette.',
  'Tip: Press / while viewing any data grid to jump immediately to table search.',
  'Tip: Press ? to open the full interactive Keyboard Shortcuts Cheat Sheet.',
  'Tip: Hover over any thumbnail for 150ms to preview a 300px high-res popover.',
  'Tip: Standard numeric inputs format on blur—type raw digits without manual decimal commas.',
  'Tip: Press Alt + Z to toggle Zen Full-Screen Focus Mode during long ledger reviews.'
];

/**
 * QuickTipBar
 * 
 * Minimal, ambient bottom ticker cycling through operational micro-tips.
 * Features:
 * - Forward / Backward navigation buttons.
 * - Auto-rotation ticker timer.
 * - "Don't show tips today" option persisted with today's date in localStorage.
 * - Immediate close / dismiss button.
 */
export function QuickTipBar({ tips = DEFAULT_TIPS, autoRotateInterval = 10000 }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if dismissed for today
    const todayStr = new Date().toISOString().slice(0, 10);
    const dismissedDate = localStorage.getItem('quick_tip_dismissed_date');
    if (dismissedDate !== todayStr) {
      setIsVisible(true);
    }
  }, []);

  // Auto rotation
  useEffect(() => {
    if (!isVisible || tips.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % tips.length);
    }, autoRotateInterval);
    return () => clearInterval(interval);
  }, [isVisible, tips.length, autoRotateInterval]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % tips.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + tips.length) % tips.length);
  };

  const handleDismissToday = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    localStorage.setItem('quick_tip_dismissed_date', todayStr);
    setIsVisible(false);
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible || tips.length === 0) return null;

  return (
    <aside className="quick-tip-bar" role="complementary" aria-label="Operational Tips Ticker">
      <div className="quick-tip-inner">
        <div className="quick-tip-left">
          <span className="quick-tip-badge">
            <Lightbulb size={12} className="quick-tip-icon" />
            <span>TIP {currentIndex + 1}/{tips.length}</span>
          </span>
          <p className="quick-tip-text">{tips[currentIndex]}</p>
        </div>

        <div className="quick-tip-controls">
          <button
            type="button"
            className="quick-tip-nav-btn"
            onClick={handlePrev}
            title="Previous tip"
            aria-label="Previous tip"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            className="quick-tip-nav-btn"
            onClick={handleNext}
            title="Next tip"
            aria-label="Next tip"
          >
            <ChevronRight size={14} />
          </button>

          <button
            type="button"
            className="quick-tip-today-btn"
            onClick={handleDismissToday}
            title="Mute tips for the remainder of today"
          >
            <Clock size={11} style={{ marginRight: 3 }} />
            Don't show tips today
          </button>

          <button
            type="button"
            className="quick-tip-close-btn"
            onClick={handleClose}
            title="Dismiss"
            aria-label="Dismiss tip"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default QuickTipBar;
