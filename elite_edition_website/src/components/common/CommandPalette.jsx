import React from 'react';
import { GlobalSearchModal } from './GlobalSearchModal';

/**
 * CommandPalette
 * 
 * Shortcut-driven (Cmd+K / Ctrl+K) Enterprise Command Palette Modal
 * Re-exports and wraps the high-performance fuzzy search and instant action dispatcher.
 */
export function CommandPalette({ isOpen, onClose, onSelectAction, activeCompanyId = 'digital_print' }) {
  return (
    <GlobalSearchModal
      isOpen={isOpen}
      onClose={onClose}
      onSelectResult={onSelectAction}
      activeCompanyId={activeCompanyId}
    />
  );
}

export default CommandPalette;
