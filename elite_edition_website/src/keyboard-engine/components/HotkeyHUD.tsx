import React, { useState, useEffect } from 'react';
import { useHotkeysContext } from '../HotkeyContext';
import { ShortcutHint } from '../types';

export interface HotkeyHUDProps {
  defaultHints?: ShortcutHint[];
}

export const HotkeyHUD: React.FC<HotkeyHUDProps> = ({ defaultHints = [] }) => {
  const {
    activeHudHints,
    openCheatSheet,
    isKeyboardLockSupported,
    isKeyboardLockActive,
    toggleKeyboardLock,
  } = useHotkeysContext();

  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches;
  });

  const [isHudHidden, setIsHudHidden] = useState<boolean>(() => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem('elite_erp_hotkey_hud_hidden') === '1';
    } catch {
      return false;
    }
  });

  const toggleHudVisibility = (hidden: boolean) => {
    setIsHudHidden(hidden);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('elite_erp_hotkey_hud_hidden', hidden ? '1' : '0');
      }
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches);
    };
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile) return null;

  if (isHudHidden) {
    return (
      <button
        type="button"
        className="erp-hud-pill"
        onClick={() => toggleHudVisibility(false)}
        title="Show Keyboard Shortcuts Bar"
        aria-label="Show Keyboard Shortcuts Bar"
        style={{
          position: 'fixed',
          bottom: '10px',
          right: '14px',
          zIndex: 900,
          boxShadow: '0 6px 20px rgba(15, 23, 42, 0.22)',
          padding: '5px 11px',
          borderRadius: '999px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.72rem',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        <span className="erp-hud-indicator-dot" />
        <span>Shortcuts</span>
      </button>
    );
  }

  // Combine default fallback hints with dynamically registered context hints
  const displayHints = activeHudHints.length > 0 ? activeHudHints : defaultHints;

  // Global base hints always accessible
  const fallbackHints: ShortcutHint[] = [
    { key: 'Alt+S', label: 'Sidebar Menu' },
    { key: 'Alt+→/←', label: 'Sub-Tabs' },
    { key: 'Alt+↑/↓', label: 'Inside Buttons' },
    { key: 'Shift+←/→', label: 'Table Scroll' },
    { key: 'Enter', label: 'Next / Math Calc' },
    { key: 'Alt+N', label: 'New / Create' },
    { key: 'Alt+E', label: 'Export' },
    { key: 'Ctrl+K', label: 'Search' },
    { key: 'Ctrl+S', label: 'Save / Accept' },
    { key: 'Esc', label: 'Cancel / Back' },
    { key: '?', label: 'Cheat Sheet', action: openCheatSheet },
  ];

  const finalHints = displayHints.length > 0 ? displayHints : fallbackHints;

  return (
    <footer className="erp-hotkey-hud" aria-label="Keyboard Shortcuts HUD">
      <div className="erp-hotkey-hud-items">
        {finalHints.map((hint, idx) => (
          <button
            key={`${hint.key}_${idx}`}
            type="button"
            className="erp-hud-pill"
            disabled={hint.disabled}
            onClick={hint.action}
            title={`${hint.label} (${hint.key})`}
            aria-label={`${hint.label} shortcut ${hint.key}`}
          >
            <span className="erp-hud-key">{hint.key}</span>
            <span>{hint.label}</span>
          </button>
        ))}
      </div>

      <div className="erp-hud-right">
        {isKeyboardLockSupported && (
          <button
            type="button"
            className="erp-hud-pill"
            onClick={toggleKeyboardLock}
            style={{
              borderColor: isKeyboardLockActive ? '#10b981' : '#334155',
              color: isKeyboardLockActive ? '#10b981' : '#94a3b8',
            }}
            title={
              isKeyboardLockActive
                ? 'Desktop Keyboard Lock Active (Browser hotkeys suppressed)'
                : 'Enable Desktop Keyboard Lock (Suppresses browser conflicts)'
            }
          >
            <span className="erp-hud-key">LOCK</span>
            <span>{isKeyboardLockActive ? 'Locked' : 'Standard'}</span>
          </button>
        )}

        <button
          type="button"
          className="erp-hud-pill"
          onClick={openCheatSheet}
          title="Open Complete Shortcut Cheat Sheet (?)"
        >
          <span className="erp-hud-key">?</span>
          <span>Help</span>
        </button>

        <div className="erp-hud-indicator" title="Keyboard-First Enterprise Engine Active">
          <span className="erp-hud-indicator-dot" />
          <span>ZERO-MOUSE</span>
        </div>

        <button
          type="button"
          className="erp-hud-pill"
          onClick={() => toggleHudVisibility(true)}
          title="Close Shortcuts Bar"
          aria-label="Close Shortcuts Bar"
          style={{ padding: '3px 8px', fontWeight: 700 }}
        >
          ✕
        </button>
      </div>
    </footer>
  );
};
