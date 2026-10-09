import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useGridKeyboardNav
 * 
 * Enterprise 2D Spatial Keyboard Navigation Hook.
 * Implements Excel-grade navigation and data entry patterns for high-throughput ERP grids.
 * 
 * Supported Interactions:
 * - Arrow Keys (↑, ↓, ←, →): Spatial cell-to-cell traversal with boundary clamping.
 * - Shift + Arrow Keys: Multi-cell rectangular range selection.
 * - Tab / Shift + Tab: Horizontal cell traversal with automatic row wrapping.
 * - Enter: Commits the cell edit and advances active focus vertically to the cell directly below.
 * - Escape: Cancels in-cell edit or collapses active selection range.
 * - Space: Toggles row checkbox selection for bulk batch actions.
 * - '/' (Slash): Instant jump to search/filter input without touching the mouse.
 * - Alt Key Mnemonic Detection: Tracks `isAltHeld` to trigger high-contrast mnemonic badges ([S], [P], [1-9]).
 * 
 * @param {Object} options
 * @param {number} options.rowCount - Total number of rendered rows.
 * @param {number} options.colCount - Total number of interactive columns.
 * @param {Array<string|number>} [options.rowIds] - Array of row entity IDs for selection tracking.
 * @param {Function} [options.onCellCommit] - Callback when Enter is pressed on an active cell.
 * @param {Function} [options.onRowSelect] - Callback when row selection changes.
 * @param {Function} [options.onSearchFocus] - Callback when '/' is pressed to focus search.
 * @param {boolean} [options.wrapHorizontal=true] - Wrap across row boundaries when tabbing.
 * @param {boolean} [options.enabled=true] - Whether keyboard listener is actively bound.
 */
export function useGridKeyboardNav({
  rowCount = 0,
  colCount = 0,
  rowIds = [],
  onCellCommit = null,
  onRowSelect = null,
  onSearchFocus = null,
  wrapHorizontal = true,
  enabled = true
} = {}) {
  // Active cursor position
  const [activeCell, setActiveCell] = useState({ rowIndex: 0, colIndex: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRows, setSelectedRows] = useState(() => new Set());
  const [selectionRange, setSelectionRange] = useState(null);
  const [isAltHeld, setIsAltHeld] = useState(false);

  // Grid container reference to manage DOM focus
  const gridContainerRef = useRef(null);

  // Clamp helper to ensure cursor stays within valid bounds
  const clampRow = useCallback((r) => Math.max(0, Math.min(rowCount - 1, r)), [rowCount]);
  const clampCol = useCallback((c) => Math.max(0, Math.min(colCount - 1, c)), [colCount]);

  // Track Alt key globally for Mnemonic Key Overlays
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Alt') {
        setIsAltHeld(true);
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'Alt') {
        setIsAltHeld(false);
      }
    };

    const handleWindowBlur = () => {
      setIsAltHeld(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [enabled]);

  // Set explicit cell focus
  const setFocusCell = useCallback((rowIndex, colIndex) => {
    if (rowCount === 0 || colCount === 0) return;
    const nextRow = clampRow(rowIndex);
    const nextCol = clampCol(colIndex);
    setActiveCell({ rowIndex: nextRow, colIndex: nextCol });
    setSelectionRange(null);
  }, [rowCount, colCount, clampRow, clampCol]);

  // Move helpers
  const moveUp = useCallback((extendSelection = false) => {
    setActiveCell((prev) => {
      const nextRow = Math.max(0, prev.rowIndex - 1);
      if (extendSelection) {
        setSelectionRange((range) => ({
          startRow: range?.startRow ?? prev.rowIndex,
          startCol: range?.startCol ?? prev.colIndex,
          endRow: nextRow,
          endCol: prev.colIndex
        }));
      } else {
        setSelectionRange(null);
      }
      return { rowIndex: nextRow, colIndex: prev.colIndex };
    });
  }, []);

  const moveDown = useCallback((extendSelection = false) => {
    setActiveCell((prev) => {
      const nextRow = Math.min(rowCount - 1, prev.rowIndex + 1);
      if (extendSelection) {
        setSelectionRange((range) => ({
          startRow: range?.startRow ?? prev.rowIndex,
          startCol: range?.startCol ?? prev.colIndex,
          endRow: nextRow,
          endCol: prev.colIndex
        }));
      } else {
        setSelectionRange(null);
      }
      return { rowIndex: nextRow, colIndex: prev.colIndex };
    });
  }, [rowCount]);

  const moveLeft = useCallback((extendSelection = false) => {
    setActiveCell((prev) => {
      const nextCol = Math.max(0, prev.colIndex - 1);
      if (extendSelection) {
        setSelectionRange((range) => ({
          startRow: range?.startRow ?? prev.rowIndex,
          startCol: range?.startCol ?? prev.colIndex,
          endRow: prev.rowIndex,
          endCol: nextCol
        }));
      } else {
        setSelectionRange(null);
      }
      return { rowIndex: prev.rowIndex, colIndex: nextCol };
    });
  }, []);

  const moveRight = useCallback((extendSelection = false) => {
    setActiveCell((prev) => {
      const nextCol = Math.min(colCount - 1, prev.colIndex + 1);
      if (extendSelection) {
        setSelectionRange((range) => ({
          startRow: range?.startRow ?? prev.rowIndex,
          startCol: range?.startCol ?? prev.colIndex,
          endRow: prev.rowIndex,
          endCol: nextCol
        }));
      } else {
        setSelectionRange(null);
      }
      return { rowIndex: prev.rowIndex, colIndex: nextCol };
    });
  }, [colCount]);

  // Tab navigation with horizontal wrapping
  const stepTab = useCallback((isShift = false) => {
    setActiveCell((prev) => {
      setSelectionRange(null);
      if (!isShift) {
        // Forward Tab
        if (prev.colIndex < colCount - 1) {
          return { rowIndex: prev.rowIndex, colIndex: prev.colIndex + 1 };
        } else if (wrapHorizontal && prev.rowIndex < rowCount - 1) {
          return { rowIndex: prev.rowIndex + 1, colIndex: 0 };
        }
      } else {
        // Backward Shift + Tab
        if (prev.colIndex > 0) {
          return { rowIndex: prev.rowIndex, colIndex: prev.colIndex - 1 };
        } else if (wrapHorizontal && prev.rowIndex > 0) {
          return { rowIndex: prev.rowIndex - 1, colIndex: colCount - 1 };
        }
      }
      return prev;
    });
  }, [colCount, rowCount, wrapHorizontal]);

  // Row selection toggling
  const toggleRowSelection = useCallback((rowIdOrIndex) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      const id = typeof rowIdOrIndex === 'number' && rowIds[rowIdOrIndex] !== undefined
        ? rowIds[rowIdOrIndex]
        : rowIdOrIndex;
      
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      onRowSelect?.(Array.from(next));
      return next;
    });
  }, [rowIds, onRowSelect]);

  const selectAllRows = useCallback(() => {
    const all = new Set(rowIds.length > 0 ? rowIds : Array.from({ length: rowCount }, (_, i) => i));
    setSelectedRows(all);
    onRowSelect?.(Array.from(all));
  }, [rowIds, rowCount, onRowSelect]);

  const clearRowSelection = useCallback(() => {
    const empty = new Set();
    setSelectedRows(empty);
    onRowSelect?.([]);
  }, [onRowSelect]);

  // Master Keyboard Event Handler for grid container or cell elements
  const handleKeyDown = useCallback((e) => {
    if (!enabled || rowCount === 0 || colCount === 0) return;

    // Check if target is an active input/textarea where typing should take precedence
    const target = e.target;
    const isTargetInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

    // 1. Slash key ('/') jumps to Search
    if (e.key === '/' && !isTargetInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      onSearchFocus?.();
      return;
    }

    // If currently editing inside an active input, handle Enter/Escape specially
    if (isEditing || isTargetInput) {
      if (e.key === 'Enter') {
        e.preventDefault();
        setIsEditing(false);
        onCellCommit?.({ rowIndex: activeCell.rowIndex, colIndex: activeCell.colIndex });
        // Vertical step down (Excel entry loop)
        moveDown(false);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsEditing(false);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        setIsEditing(false);
        onCellCommit?.({ rowIndex: activeCell.rowIndex, colIndex: activeCell.colIndex });
        stepTab(e.shiftKey);
        return;
      }
      // Let other keystrokes flow to the input
      return;
    }

    // 2. 2D Spatial Arrow Keys
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        moveUp(e.shiftKey);
        break;

      case 'ArrowDown':
        e.preventDefault();
        moveDown(e.shiftKey);
        break;

      case 'ArrowLeft':
        e.preventDefault();
        moveLeft(e.shiftKey);
        break;

      case 'ArrowRight':
        e.preventDefault();
        moveRight(e.shiftKey);
        break;

      case 'Tab':
        e.preventDefault();
        stepTab(e.shiftKey);
        break;

      case 'Enter':
        e.preventDefault();
        setIsEditing(true);
        // If not editing, Enter triggers cell edit mode or commits & steps down
        onCellCommit?.({ rowIndex: activeCell.rowIndex, colIndex: activeCell.colIndex });
        moveDown(false);
        break;

      case 'Escape':
        e.preventDefault();
        setIsEditing(false);
        setSelectionRange(null);
        break;

      case ' ': // Space key toggles row selection
        if (!isTargetInput) {
          e.preventDefault();
          const targetRowId = rowIds[activeCell.rowIndex] ?? activeCell.rowIndex;
          toggleRowSelection(targetRowId);
        }
        break;

      default:
        break;
    }
  }, [
    enabled,
    rowCount,
    colCount,
    isEditing,
    activeCell,
    moveUp,
    moveDown,
    moveLeft,
    moveRight,
    stepTab,
    toggleRowSelection,
    rowIds,
    onCellCommit,
    onSearchFocus
  ]);

  // Helper to query if a cell is focused
  const isCellFocused = useCallback((rowIndex, colIndex) => {
    return activeCell.rowIndex === rowIndex && activeCell.colIndex === colIndex;
  }, [activeCell]);

  // Helper to query if a cell is in selection range
  const isCellInRange = useCallback((rowIndex, colIndex) => {
    if (!selectionRange) return false;
    const minRow = Math.min(selectionRange.startRow, selectionRange.endRow);
    const maxRow = Math.max(selectionRange.startRow, selectionRange.endRow);
    const minCol = Math.min(selectionRange.startCol, selectionRange.endCol);
    const maxCol = Math.max(selectionRange.startCol, selectionRange.endCol);
    return rowIndex >= minRow && rowIndex <= maxRow && colIndex >= minCol && colIndex <= maxCol;
  }, [selectionRange]);

  // Helper to check if a row is selected
  const isRowSelected = useCallback((rowIdOrIndex) => {
    const id = typeof rowIdOrIndex === 'number' && rowIds[rowIdOrIndex] !== undefined
      ? rowIds[rowIdOrIndex]
      : rowIdOrIndex;
    return selectedRows.has(id);
  }, [selectedRows, rowIds]);

  // Generate accessible cell props
  const getCellProps = useCallback((rowIndex, colIndex, rowId = null) => {
    const focused = isCellFocused(rowIndex, colIndex);
    const inRange = isCellInRange(rowIndex, colIndex);

    return {
      role: 'gridcell',
      tabIndex: focused ? 0 : -1,
      'aria-selected': inRange || focused,
      'data-row-index': rowIndex,
      'data-col-index': colIndex,
      className: `erp-grid-cell ${focused ? 'is-active-cell' : ''} ${inRange ? 'is-range-selected' : ''}`,
      onClick: () => setFocusCell(rowIndex, colIndex),
      onKeyDown: handleKeyDown
    };
  }, [isCellFocused, isCellInRange, setFocusCell, handleKeyDown]);

  return {
    activeCell,
    isEditing,
    selectedRows,
    selectionRange,
    isAltHeld,
    gridContainerRef,
    setFocusCell,
    moveUp,
    moveDown,
    moveLeft,
    moveRight,
    stepTab,
    toggleRowSelection,
    selectAllRows,
    clearRowSelection,
    isCellFocused,
    isCellInRange,
    isRowSelected,
    getCellProps,
    handleKeyDown
  };
}

export default useGridKeyboardNav;
