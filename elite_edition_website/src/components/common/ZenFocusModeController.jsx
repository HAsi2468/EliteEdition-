import React, { useState, useEffect, useCallback } from 'react';
import { Minimize2, Maximize2 } from 'lucide-react';
import './ZenFocusMode.css';

/**
 * ZenFocusModeController
 * 
 * Global Enterprise Focus / Zen Mode Controller.
 * Hides all navigation sidebars and top headers on `Alt + Z` to give 100%
 * viewport width and height to high-density data tables and workflows.
 */
export function ZenFocusModeController() {
  const [isZenMode, setIsZenMode] = useState(() => {
    try {
      return localStorage.getItem('elite_zen_focus_mode') === 'true';
    } catch (e) {
      return false;
    }
  });

  const triggerResizeNotification = useCallback(() => {
    // Notify window and canvas components to resize tables cleanly
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 260);
  }, []);

  const toggleZenMode = useCallback((forceState) => {
    setIsZenMode(prev => {
      const next = typeof forceState === 'boolean' ? forceState : !prev;
      try {
        localStorage.setItem('elite_zen_focus_mode', String(next));
      } catch (e) {}

      if (typeof document !== 'undefined') {
        document.body.classList.toggle('zen-focus-active', next);
      }

      window.dispatchEvent(new CustomEvent('elite:zen-mode-changed', { detail: { active: next } }));
      triggerResizeNotification();
      return next;
    });
  }, [triggerResizeNotification]);

  // Initial sync with DOM on mount
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('zen-focus-active', isZenMode);
      if (isZenMode) triggerResizeNotification();
    }
  }, [isZenMode, triggerResizeNotification]);

  // Global Keyboard Shortcuts (Alt + Z to toggle, Esc to exit)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Alt + Z toggles focus mode
      if (e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        toggleZenMode();
      }

      // Escape key exits focus mode if currently active
      if (e.key === 'Escape' && isZenMode) {
        // Do not intercept if a nested dialog or modal is open
        const hasOpenModal = document.querySelector('[role="dialog"], .modal-overlay, .global-search-modal');
        if (!hasOpenModal) {
          e.preventDefault();
          toggleZenMode(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZenMode, toggleZenMode]);

  // Global Custom Event listener for external triggers
  useEffect(() => {
    const handleCustomToggle = (e) => {
      toggleZenMode(e?.detail?.active);
    };
    window.addEventListener('elite:toggle-zen-mode', handleCustomToggle);
    return () => window.removeEventListener('elite:toggle-zen-mode', handleCustomToggle);
  }, [toggleZenMode]);

  if (!isZenMode) return null;

  return (
    <button
      type="button"
      className="zen-exit-pill"
      onClick={() => toggleZenMode(false)}
      title="Exit Zen Focus Mode (Alt+Z or Esc)"
      aria-label="Exit Zen Focus Mode"
    >
      <span className="zen-indicator-dot" />
      <Minimize2 size={14} color="#38bdf8" />
      <span>Exit Zen Mode</span>
      <kbd className="zen-exit-kbd">Alt+Z</kbd>
    </button>
  );
}

export default ZenFocusModeController;
