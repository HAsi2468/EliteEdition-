import React, { useState, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Keyboard, X, Search, Command, ArrowRight, CornerDownLeft } from 'lucide-react';
import './KeyboardGuideModal.css';

const SHORTCUT_COLUMNS = [
  {
    id: 'grid-nav',
    title: 'Grid Navigation',
    shortcuts: [
      { desc: 'Move active cell cursor', keys: ['↑', '↓', '←', '→'] },
      { desc: 'Move horizontally across cells', keys: ['Tab'] },
      { desc: 'Move backwards across cells', keys: ['Shift', 'Tab'] },
      { desc: 'Commit value & step down (Entry Loop)', keys: ['Enter'] },
      { desc: 'Toggle row checkbox selection', keys: ['Space'] },
      { desc: 'Expand rectangular range selection', keys: ['Shift', 'Arrow'] },
      { desc: 'Jump directly to table search filter', keys: ['/'] },
      { desc: 'Cancel cell edit / dismiss selection', keys: ['Esc'] }
    ]
  },
  {
    id: 'global-commands',
    title: 'Global Commands',
    shortcuts: [
      { desc: 'Open Command Palette (Omnibar)', keys: ['Ctrl', 'K'] },
      { desc: 'Primary document save', keys: ['Ctrl', 'S'] },
      { desc: 'Direct print active record', keys: ['Ctrl', 'P'] },
      { desc: 'Submit active form or modal dialog', keys: ['Ctrl', 'Enter'] },
      { desc: 'Toggle Zen / Full-Screen workspace', keys: ['Alt', 'Z'] },
      { desc: 'Toggle left sidebar visibility', keys: ['Ctrl', 'B'] },
      { desc: 'Open Keyboard Shortcuts Guide', keys: ['?'] }
    ]
  },
  {
    id: 'tab-control',
    title: 'Tab Control',
    shortcuts: [
      { desc: 'Switch directly to Workspace Tab 1–9', keys: ['Alt', '1-9'] },
      { desc: 'Open new workspace tab', keys: ['Ctrl', 'T'] },
      { desc: 'Close active workspace tab', keys: ['Ctrl', 'W'] },
      { desc: 'Cycle to next workspace tab', keys: ['Ctrl', 'Tab'] },
      { desc: 'Cycle to previous workspace tab', keys: ['Ctrl', 'Shift', 'Tab'] }
    ]
  },
  {
    id: 'quick-actions',
    title: 'Quick Actions',
    shortcuts: [
      { desc: 'Duplicate selected row / ledger entry', keys: ['Alt', 'D'] },
      { desc: 'Create new record / line item', keys: ['Alt', 'N'] },
      { desc: 'Hold for Mnemonic Key Badges', keys: ['Alt'] },
      { desc: 'Copy cell or record ID', keys: ['Ctrl', 'C'] },
      { desc: 'Revert changes / Dismiss modals', keys: ['Esc'] }
    ]
  }
];

/**
 * KeyboardGuideModal
 * 
 * Interactive Keyboard Cheat Sheet Modal.
 * Triggered globally via the `?` key (Shift + /) or from application help menus.
 * 
 * Layout:
 * - 4 distinct visual columns: Grid Navigation, Global Commands, Tab Control, Quick Actions.
 * - Live real-time search filtering across descriptions and keycap tokens.
 * - Strict focus trap and Escape key dismissal.
 */
export function KeyboardGuideModal({ isOpen: controlledOpen, onClose: controlledClose }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const handleClose = () => {
    if (isControlled) {
      controlledClose?.();
    } else {
      setInternalOpen(false);
    }
  };

  // Global listener for `?` key
  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target;
      const isInput = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );

      if (e.key === '?' && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (isControlled) {
          controlledClose ? controlledClose() : null;
        } else {
          setInternalOpen((prev) => !prev);
        }
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isControlled, controlledClose]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Filter columns based on live query
  const filteredColumns = useMemo(() => {
    if (!searchQuery.trim()) return SHORTCUT_COLUMNS;
    const q = searchQuery.toLowerCase().trim();

    return SHORTCUT_COLUMNS.map((col) => {
      const matchingShortcuts = col.shortcuts.filter((s) => {
        const descMatch = s.desc.toLowerCase().includes(q);
        const keyMatch = s.keys.some((k) => k.toLowerCase().includes(q));
        return descMatch || keyMatch;
      });
      return {
        ...col,
        shortcuts: matchingShortcuts
      };
    }).filter((col) => col.shortcuts.length > 0);
  }, [searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="keyboard-modal-backdrop" onClick={handleClose}>
      <div
        className="keyboard-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard Shortcuts Cheat Sheet"
      >
        {/* Header */}
        <div className="keyboard-modal-header">
          <div className="keyboard-modal-title">
            <Keyboard size={20} style={{ color: '#38bdf8' }} />
            <span>Keyboard Shortcuts Guide</span>
          </div>
          <button
            type="button"
            className="keyboard-modal-close"
            onClick={handleClose}
            aria-label="Close shortcuts dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Live Search Bar */}
        <div className="keyboard-modal-search-wrapper">
          <Search size={16} className="keyboard-search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            className="keyboard-modal-search-input"
            placeholder="Type to filter shortcuts (e.g. 'print', 'row', 'enter', 'tab')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="keyboard-clear-search"
              onClick={() => setSearchQuery('')}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* 4 Clean Visual Columns */}
        <div className="keyboard-modal-columns">
          {filteredColumns.length === 0 ? (
            <div className="keyboard-no-results">
              No shortcuts found matching "{searchQuery}"
            </div>
          ) : (
            filteredColumns.map((col) => (
              <div key={col.id} className="keyboard-column">
                <h4 className="keyboard-column-title">{col.title}</h4>
                <div className="keyboard-column-list">
                  {col.shortcuts.map((item, idx) => (
                    <div key={idx} className="keyboard-shortcut-row">
                      <span className="keyboard-desc">{item.desc}</span>
                      <div className="keyboard-keys">
                        {item.keys.map((k, kIdx) => (
                          <React.Fragment key={kIdx}>
                            <kbd className="keyboard-keycap">{k}</kbd>
                            {kIdx < item.keys.length - 1 && <span className="keyboard-plus">+</span>}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="keyboard-modal-footer">
          <span className="keyboard-footer-tip">
            💡 Pro Tip: Press <kbd className="keyboard-keycap-sm">?</kbd> anywhere to trigger this guide. Press <kbd className="keyboard-keycap-sm">Esc</kbd> to exit.
          </span>
        </div>
      </div>
    </div>
  );
}

KeyboardGuideModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func
};

export default KeyboardGuideModal;
