import React, { useState } from 'react';
import { useHotkeysContext } from '../HotkeyContext';

export const KeyboardNavOnboardingBanner: React.FC = () => {
  const { openCheatSheet } = useHotkeysContext();
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('erp_kb_banner_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem('erp_kb_banner_dismissed', 'true');
    } catch {}
  };

  if (isDismissed) return null;

  return (
    <div className="erp-kb-onboarding-banner" role="region" aria-label="Keyboard Navigation Quickstart Guide">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        <span className="erp-kb-onboarding-tag">⚡ ZERO-MOUSE ERP MODE</span>
        <span>
          <strong>Enter</strong> = Next Field &nbsp;|&nbsp;{' '}
          <strong>Shift+Enter</strong> = Previous &nbsp;|&nbsp;{' '}
          <strong>F2</strong> = Period/Date &nbsp;|&nbsp;{' '}
          <strong>Ctrl+S</strong> = Save &nbsp;|&nbsp;{' '}
          <strong>Alt</strong> = Mnemonic Badges &nbsp;|&nbsp;{' '}
          <strong>120*5</strong> = Inline Math
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
        <button
          type="button"
          onClick={openCheatSheet}
          style={{
            all: 'unset',
            cursor: 'pointer',
            textDecoration: 'underline',
            fontWeight: 600,
            color: '#60a5fa',
          }}
        >
          View All Hotkeys (?)
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          style={{
            all: 'unset',
            cursor: 'pointer',
            padding: '1px 5px',
            borderRadius: '3px',
            color: '#94a3b8',
            fontSize: '0.8rem',
            background: 'rgba(255,255,255,0.08)',
          }}
          title="Dismiss banner"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
