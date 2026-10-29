import React, { useState, useEffect, useRef } from 'react';
import { useHotkeysContext } from '../HotkeyContext';

interface ShortcutCategory {
  title: string;
  items: Array<{ key: string; description: string }>;
}

const SHORTCUT_DATABASE: ShortcutCategory[] = [
  {
    title: 'Universal Navigation & System',
    items: [
      { key: 'Ctrl + K', description: 'Universal Command Bar (Fuzzy Search)' },
      { key: '?', description: 'Open this Shortcut Cheat Sheet' },
      { key: 'Alt (Hold/Tap)', description: 'Toggle visual mnemonic key badges on buttons' },
      { key: 'Esc', description: 'Hierarchical Cancel (Close dropdown -> Exit edit -> Close modal)' },
      { key: 'F2', description: 'Change Voucher / Period Date' },
    ],
  },
  {
    title: 'Voucher Entry & Actions',
    items: [
      { key: 'Ctrl + S / Ctrl + A', description: 'Save and Accept Active Form' },
      { key: 'Ctrl + Enter', description: 'Save & Instantly Print / Export Document' },
      { key: 'F4', description: 'Switch to Contra Voucher' },
      { key: 'F5', description: 'Switch to Payment Voucher' },
      { key: 'F6', description: 'Switch to Receipt Voucher' },
      { key: 'F7', description: 'Switch to Journal Voucher' },
      { key: 'F8', description: 'Switch to Sales Voucher / Invoice' },
      { key: 'F9', description: 'Switch to Purchase Voucher' },
    ],
  },
  {
    title: 'High-Speed Form Traversal (Enter-As-Tab)',
    items: [
      { key: 'Enter', description: 'Validate field and advance focus to next field' },
      { key: 'Shift + Enter', description: 'Navigate focus backward to previous field' },
      { key: 'Double Enter', description: 'Submit form when on final field' },
      { key: 'Alt + C', description: 'In combobox: On-the-fly "Add New Master" modal' },
      { key: 'Alt + Down / F4', description: 'Expand dropdown / combobox options' },
      { key: 'Textarea Enter', description: 'Inserts newline (Use Ctrl+Enter to advance)' },
    ],
  },
  {
    title: 'Inline Arithmetic Calculator',
    items: [
      { key: '120 * 5', description: 'Evaluates to 600 upon pressing Enter' },
      { key: '500 + 250', description: 'Evaluates to 750 upon pressing Enter' },
      { key: '1500 * 1.18', description: 'Evaluates 18% GST (1770) automatically' },
      { key: '1000 - 10%', description: 'Evaluates 10% discount (900) automatically' },
    ],
  },
  {
    title: 'Data Grid Traversal (Roving TabIndex)',
    items: [
      { key: 'Arrow Keys (↑ ↓ ← →)', description: 'Traverse grid cells in all directions' },
      { key: 'Enter / F2', description: 'Activate inline edit mode on cell' },
      { key: 'Alphanumeric Key', description: 'Immediately types into cell and activates edit mode' },
      { key: 'Enter (in edit)', description: 'Commit cell value and shift focus right' },
      { key: 'Enter on Last Cell', description: 'Auto-appends new blank row & focuses Column 1' },
      { key: 'Alt + Delete', description: 'Delete currently active line item row' },
      { key: 'Space', description: 'Toggle row multi-selection checkbox' },
      { key: 'Home / End', description: 'Jump to first / last column in active row' },
      { key: 'PageUp / PageDown', description: 'Jump 20 rows up or down' },
    ],
  },
];

export const ShortcutCheatSheetModal: React.FC = () => {
  const { isCheatSheetOpen, closeCheatSheet, registerEscHandler } = useHotkeysContext();
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Register hierarchical ESC with Priority 100 (Modal Level)
  useEffect(() => {
    if (!isCheatSheetOpen) return;
    const unregister = registerEscHandler(() => {
      closeCheatSheet();
      return true; // handled
    }, 100);
    return unregister;
  }, [isCheatSheetOpen, closeCheatSheet, registerEscHandler]);

  // Focus search input when modal opens
  useEffect(() => {
    if (isCheatSheetOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
    }
  }, [isCheatSheetOpen]);

  if (!isCheatSheetOpen) return null;

  const normalizedQuery = searchTerm.toLowerCase().trim();

  const filteredCategories = SHORTCUT_DATABASE.map((cat) => {
    if (!normalizedQuery) return cat;
    const matchingItems = cat.items.filter(
      (item) =>
        item.key.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery)
    );
    return {
      ...cat,
      items: matchingItems,
    };
  }).filter((cat) => cat.items.length > 0);

  return (
    <div
      className="erp-cheat-sheet-backdrop"
      onClick={closeCheatSheet}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts Cheat Sheet"
    >
      <div
        className="erp-cheat-sheet-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="erp-cheat-sheet-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem' }}>⚡</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>
                Enterprise ERP Keyboard Cheat Sheet
              </h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>
                Zero-mouse high-speed accounting and data entry guide
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeCheatSheet}
            style={{
              all: 'unset',
              cursor: 'pointer',
              color: '#94a3b8',
              fontSize: '1.25rem',
              padding: '2px 8px',
              borderRadius: '4px',
            }}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="erp-cheat-sheet-search">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search shortcut by key or action (e.g. 'F2', 'save', 'grid', 'math')..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.75rem',
              fontSize: '0.82rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Body Categories */}
        <div className="erp-cheat-sheet-body">
          {filteredCategories.map((cat, idx) => (
            <div key={idx} className="erp-cheat-sheet-card">
              <h4>{cat.title}</h4>
              <div>
                {cat.items.map((item, itemIdx) => (
                  <div key={itemIdx} className="erp-cheat-sheet-row">
                    <span style={{ color: '#334155', fontWeight: 500 }}>
                      {item.description}
                    </span>
                    <span className="erp-cheat-sheet-key">{item.key}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filteredCategories.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              No shortcuts found matching "{searchTerm}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.65rem 1.25rem',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
            color: '#64748b',
          }}
        >
          <span>Tip: Press <strong>Esc</strong> to close this modal at any time.</span>
          <span>Press <strong>Alt</strong> to reveal mnemonic badges on buttons.</span>
        </div>
      </div>
    </div>
  );
};
