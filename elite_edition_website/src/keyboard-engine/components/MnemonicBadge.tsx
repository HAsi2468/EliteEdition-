import React from 'react';
import { useHotkeysContext } from '../HotkeyContext';

export interface MnemonicBadgeProps {
  accessKeyChar: string; // e.g. 'S', 'C', 'N', 'D', 'P'
  children?: React.ReactNode;
  alwaysVisible?: boolean;
}

export const MnemonicBadge: React.FC<MnemonicBadgeProps> = ({
  accessKeyChar,
  children,
  alwaysVisible = false,
}) => {
  const { isAltModeActive } = useHotkeysContext();
  const visible = alwaysVisible || isAltModeActive;

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {children}
      {visible && (
        <span
          className="erp-mnemonic-badge"
          style={{ display: 'inline-block' }}
          aria-hidden="true"
        >
          {accessKeyChar.toUpperCase()}
        </span>
      )}
    </span>
  );
};
