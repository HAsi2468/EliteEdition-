import React, { useState, useEffect, useRef } from 'react';
import { Keyboard, X, Search, Command } from 'lucide-react';
import './KeyboardShortcutModal.css';

/**
 * KeyboardShortcutModal
 * 
 * Accessible modal dialog triggered by pressing `?` (Shift + /).
 * Renders a structured grid of keyboard shortcuts with styled `<kbd>` keycap tokens.
 */
export function KeyboardShortcutModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dialogRef = useRef(null);
  const searchInputRef = useRef(null);

  // Global listener for `?` key
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is currently typing in an input, textarea, or contentEditable
      const target = e.target;
      const isInput = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );

      if (e.key === '?' && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Global custom event for opening modal from UI buttons
  useEffect(() => {
    const handleOpenModal = () => setIsOpen(true);
    window.addEventListener('elite:open-shortcuts-modal', handleOpenModal);
    return () => window.removeEventListener('elite:open-shortcuts-modal', handleOpenModal);
  }, []);

  // Auto-focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const categories = [
    {
      name: 'Navigation & Layout',
      items: [
        { desc: 'Toggle Zen / Focus Mode (100% Viewport)', keys: ['Alt', 'Z'] },
        { desc: 'Quick Switch Company Workspace', keys: ['Alt', 'E'] },
        { desc: 'Universal Omnibar / Global Search', keys: ['Ctrl', 'K'] },
        { desc: 'Open Keyboard Shortcuts Reference', keys: ['?'] },
        { desc: 'Close Dialog / Dismiss Focus / Exit', keys: ['Esc'] },
      ]
    },
    {
      name: 'Data Tables & Records',
      items: [
        { desc: 'Open Row Context Menu', keys: ['Right Click'] },
        { desc: 'Duplicate Selected Row / Line', keys: ['Alt', 'D'] },
        { desc: 'Copy Record / Challan ID', keys: ['Ctrl', 'C'] },
        { desc: 'Print Active Document / Label', keys: ['Ctrl', 'P'] },
      ]
    },
    {
      name: 'Forms & Data Entry',
      items: [
        { desc: 'Save & Submit Active Form', keys: ['Ctrl', 'S'] },
        { desc: 'Next / Previous Input Field', keys: ['Tab'], secondary: ['Shift', 'Tab'] },
        { desc: 'Evaluate Math Expressions (e.g. 50*2+10)', keys: ['Enter'] },
      ]
    }
  ];

  if (!isOpen) return null;

  const normalizedQuery = searchQuery.toLowerCase().trim();

  const filteredCategories = categories.map(cat => {
    const matchingItems = cat.items.filter(item => {
      if (!normalizedQuery) return true;
      const descMatch = item.desc.toLowerCase().includes(normalizedQuery);
      const keyMatch = item.keys.some(k => k.toLowerCase().includes(normalizedQuery));
      return descMatch || keyMatch;
    });
    return { ...cat, items: matchingItems };
  }).filter(cat => cat.items.length > 0);

  return (
    <div 
      className="shortcut-modal-overlay"
      onClick={() => setIsOpen(false)}
      role="presentation"
    >
      <div 
        ref={dialogRef}
        className="shortcut-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
      >
        {/* Header */}
        <div className="shortcut-modal-header">
          <div className="shortcut-modal-title-wrap">
            <Keyboard size={20} color="var(--entity-accent, #2563eb)" />
            <h3 id="shortcuts-title" className="shortcut-modal-title">
              Keyboard Shortcuts Reference
            </h3>
          </div>
          <button
            type="button"
            className="shortcut-modal-close-btn"
            onClick={() => setIsOpen(false)}
            aria-label="Close shortcuts modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="shortcut-search-bar" style={{ position: 'relative' }}>
          <Search 
            size={16} 
            color="#94a3b8" 
            style={{ position: 'absolute', left: 32, top: 22, pointerEvents: 'none' }} 
          />
          <input
            ref={searchInputRef}
            type="text"
            className="shortcut-search-input"
            placeholder="Search shortcuts (e.g. Zen, Company, Duplicate)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Body */}
        <div className="shortcut-modal-body">
          {filteredCategories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: '0.88rem' }}>
              No shortcuts found matching "{searchQuery}"
            </div>
          ) : (
            filteredCategories.map(cat => (
              <div key={cat.name} className="shortcut-category-section">
                <div className="shortcut-category-title">{cat.name}</div>
                <div className="shortcut-grid">
                  {cat.items.map((item, idx) => (
                    <div key={idx} className="shortcut-row">
                      <span className="shortcut-desc">{item.desc}</span>
                      <div className="shortcut-keys">
                        {item.keys.map((k, kIdx) => (
                          <React.Fragment key={kIdx}>
                            <kbd className="keycap">{k}</kbd>
                            {kIdx < item.keys.length - 1 && <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>+</span>}
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
        <div className="shortcut-modal-footer">
          <span>Press <kbd className="keycap">?</kbd> anywhere to toggle this guide</span>
          <span>Tip: Press <kbd className="keycap">Alt</kbd> + <kbd className="keycap">Z</kbd> for 100% viewport Zen focus</span>
        </div>
      </div>
    </div>
  );
}

export default KeyboardShortcutModal;
