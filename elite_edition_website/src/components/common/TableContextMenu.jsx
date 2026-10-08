import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Copy, 
  ExternalLink, 
  Printer, 
  ClipboardCopy, 
  Check, 
  FileText,
  Trash2
} from 'lucide-react';
import './TableContextMenu.css';

/**
 * TableContextMenu
 * 
 * Global Enterprise Data Table Context Menu.
 * Intercepts row `contextmenu` events to render an ultra-responsive,
 * keyboard-accessible context menu anchored at cursor (clientX, clientY).
 * 
 * Auto-dismisses on scroll, blur, outside click, or Escape.
 */
export function TableContextMenu() {
  const [menuState, setMenuState] = useState(null); // { x, y, id, code, label, rowData }
  const [copiedId, setCopiedId] = useState(false);
  const menuRef = useRef(null);

  const closeMenu = useCallback(() => {
    setMenuState(null);
    setCopiedId(false);
  }, []);

  // Global delegated contextmenu listener
  useEffect(() => {
    const handleContextMenu = (e) => {
      // Find closest table row or context-enabled element
      const targetRow = e.target.closest('tr, [data-context-menu="true"], .table-row, [data-row-id]');
      if (!targetRow) return;

      // Do not intercept if right-click was on input, textarea, or button specifically
      const isInput = e.target.closest('input, textarea, select, [contenteditable="true"]');
      if (isInput) return;

      e.preventDefault();

      // Extract row data attributes or deduce from content
      const rowId = targetRow.getAttribute('data-row-id') || 
                    targetRow.getAttribute('data-id') || 
                    targetRow.getAttribute('data-key') || '';
      
      const rowCode = targetRow.getAttribute('data-code') || 
                      targetRow.getAttribute('data-challan-no') || 
                      targetRow.getAttribute('data-invoice-no') || 
                      targetRow.getAttribute('data-job-no') || 
                      targetRow.querySelector('td:nth-child(1), td:nth-child(2), td strong, .challan-code, .id-pill')?.textContent?.trim() || 
                      rowId || 'Record';

      const rowLabel = targetRow.getAttribute('data-label') || 
                       targetRow.querySelector('td:nth-child(3), .party-name, .customer-name')?.textContent?.trim() || 
                       rowCode;

      // Clamping within viewport boundaries
      const menuWidth = 230;
      const menuHeight = 220;
      const clampedX = Math.max(10, Math.min(e.clientX, window.innerWidth - menuWidth - 10));
      const clampedY = Math.max(10, Math.min(e.clientY, window.innerHeight - menuHeight - 10));

      setCopiedId(false);
      setMenuState({
        x: clampedX,
        y: clampedY,
        id: rowId,
        code: rowCode,
        label: rowLabel,
        targetRow
      });
    };

    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Auto-dismiss on scroll (all scrollable parents), blur, outside click, and Esc
  useEffect(() => {
    if (!menuState) return;

    const handleScroll = () => closeMenu();
    const handleBlur = () => closeMenu();
    const handleMouseDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        closeMenu();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };

    // Capture phase for scroll catches all table containers
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('blur', handleBlur);
    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuState, closeMenu]);

  // Actions
  const handleCopyId = () => {
    if (!menuState) return;
    const textToCopy = menuState.code || menuState.id || '';
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedId(true);
      setTimeout(() => {
        closeMenu();
      }, 700);
    }
  };

  const handleDuplicateRow = () => {
    if (!menuState) return;
    window.dispatchEvent(new CustomEvent('elite:duplicate-row', {
      detail: {
        id: menuState.id,
        code: menuState.code,
        label: menuState.label
      }
    }));
    closeMenu();
  };

  const handleOpenInNewTab = () => {
    if (!menuState) return;
    window.dispatchEvent(new CustomEvent('elite:open-row-in-new-tab', {
      detail: {
        id: menuState.id,
        code: menuState.code,
        label: menuState.label
      }
    }));
    closeMenu();
  };

  const handlePrintLabel = () => {
    if (!menuState) return;
    window.dispatchEvent(new CustomEvent('elite:print-row-label', {
      detail: {
        id: menuState.id,
        code: menuState.code,
        label: menuState.label
      }
    }));
    closeMenu();
  };

  if (!menuState) return null;

  return (
    <div
      ref={menuRef}
      className="table-context-menu-portal"
      style={{
        left: `${menuState.x}px`,
        top: `${menuState.y}px`
      }}
      role="menu"
      aria-label="Table Row Actions"
    >
      {/* Header with Row Code */}
      <div className="context-menu-header">
        <span className="context-menu-title" title={menuState.label || menuState.code}>
          {menuState.code}
        </span>
        <span className="context-menu-badge">Actions</span>
      </div>

      {/* Action 1: Duplicate Row */}
      <button
        type="button"
        className="context-menu-item"
        onClick={handleDuplicateRow}
        role="menuitem"
      >
        <div className="context-menu-item-left">
          <span className="context-menu-item-icon"><Copy size={14} /></span>
          <span>Duplicate Row</span>
        </div>
        <span className="context-menu-shortcut">Alt+D</span>
      </button>

      {/* Action 2: Open in New Tab */}
      <button
        type="button"
        className="context-menu-item"
        onClick={handleOpenInNewTab}
        role="menuitem"
      >
        <div className="context-menu-item-left">
          <span className="context-menu-item-icon"><ExternalLink size={14} /></span>
          <span>Open in New Tab</span>
        </div>
        <span className="context-menu-shortcut">⌘+Enter</span>
      </button>

      {/* Action 3: Print Label */}
      <button
        type="button"
        className="context-menu-item"
        onClick={handlePrintLabel}
        role="menuitem"
      >
        <div className="context-menu-item-left">
          <span className="context-menu-item-icon"><Printer size={14} /></span>
          <span>Print Label</span>
        </div>
        <span className="context-menu-shortcut">⌘+P</span>
      </button>

      <div className="context-menu-divider" />

      {/* Action 4: Copy ID */}
      <button
        type="button"
        className="context-menu-item"
        onClick={handleCopyId}
        role="menuitem"
      >
        <div className="context-menu-item-left">
          <span className="context-menu-item-icon">
            {copiedId ? <Check size={14} color="#10b981" /> : <ClipboardCopy size={14} />}
          </span>
          <span style={{ color: copiedId ? '#10b981' : 'inherit' }}>
            {copiedId ? 'Copied!' : 'Copy Record ID'}
          </span>
        </div>
        <span className="context-menu-shortcut">⌘+C</span>
      </button>
    </div>
  );
}

export default TableContextMenu;
