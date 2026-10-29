import React from 'react';
import { useHotkeysContext } from '../HotkeyContext';

export interface MnemonicBadgeProps {
  accessKeyChar?: string;
  keyChar?: string;
  children?: React.ReactNode;
  alwaysVisible?: boolean;
}

export const MnemonicBadge: React.FC<MnemonicBadgeProps> = ({
  accessKeyChar,
  keyChar,
  children,
  alwaysVisible = false,
}) => {
  const context = useHotkeysContext();
  const isAltModeActive = Boolean(context?.isAltModeActive);
  const visible = alwaysVisible || isAltModeActive;

  const rawKey = accessKeyChar ?? keyChar ?? '';
  const text = String(rawKey || '').trim().toUpperCase();

  if (!visible || !text) {
    return children ? <>{children}</> : null;
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {children}
      <span
        className="erp-mnemonic-badge"
        style={alwaysVisible ? { display: 'inline-block' } : undefined}
        aria-hidden="true"
      >
        {text}
      </span>
    </span>
  );
};
