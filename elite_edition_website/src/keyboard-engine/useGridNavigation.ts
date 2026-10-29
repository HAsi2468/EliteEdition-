import { useState, useRef, useEffect, useCallback } from 'react';
import { GridNavigationOptions, GridCellCoord } from './types';
import { useHotkeysContext } from './HotkeyContext';
import { evaluateMathExpression } from './mathEvaluator';

export function useGridNavigation<T = any>(
  options: GridNavigationOptions<T>
) {
  const {
    columns,
    rowCount,
    onAddRow,
    onDeleteRow,
    onCommitCell,
    onToggleSelectRow,
    initialRow = 0,
    initialCol = 0,
    enableAutoRowInjection = true,
  } = options;

  const [activeCell, setActiveCell] = useState<GridCellCoord>({
    row: Math.min(initialRow, Math.max(0, rowCount - 1)),
    col: Math.min(initialCol, Math.max(0, columns.length - 1)),
  });

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>('');
  const [initialValueBeforeEdit, setInitialValueBeforeEdit] = useState<string>('');

  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  const { registerEscHandler } = useHotkeysContext();

  const totalCols = columns.length;

  // Sync activeCell if rowCount shrinks
  useEffect(() => {
    setActiveCell((prev) => {
      const validRow = Math.min(prev.row, Math.max(0, rowCount - 1));
      const validCol = Math.min(prev.col, Math.max(0, totalCols - 1));
      if (validRow !== prev.row || validCol !== prev.col) {
        return { row: validRow, col: validCol };
      }
      return prev;
    });
  }, [rowCount, totalCols]);

  // Focus active cell DOM element whenever activeCell changes and not editing
  useEffect(() => {
    if (isEditing) {
      if (editInputRef.current) {
        editInputRef.current.focus();
        editInputRef.current.select();
      }
      return;
    }

    if (!gridContainerRef.current) return;
    const targetCell = gridContainerRef.current.querySelector<HTMLElement>(
      `[data-grid-row="${activeCell.row}"][data-grid-col="${activeCell.col}"]`
    );
    if (targetCell) {
      targetCell.focus();
    }
  }, [activeCell, isEditing]);

  // Enter edit mode
  const startEditing = useCallback((initialChar?: string) => {
    const colDef = columns[activeCell.col];
    if (colDef && colDef.isEditable === false) return;

    // Read current value from cell if available
    let currentVal = '';
    const cellEl = gridContainerRef.current?.querySelector<HTMLElement>(
      `[data-grid-row="${activeCell.row}"][data-grid-col="${activeCell.col}"]`
    );
    if (cellEl) {
      currentVal = cellEl.getAttribute('data-cell-value') ?? cellEl.innerText.trim();
    }

    setInitialValueBeforeEdit(currentVal);
    setEditValue(initialChar !== undefined ? initialChar : currentVal);
    setIsEditing(true);
  }, [activeCell, columns]);

  // Commit edit and move to next cell
  const commitEdit = useCallback((andMoveRight = true) => {
    if (!isEditing) return;

    let finalValue: any = editValue;
    const colDef = columns[activeCell.col];

    // If numeric, evaluate math expressions automatically
    if (colDef?.type === 'number' || /amount|rate|qty|price/i.test(colDef?.key || '')) {
      const computed = evaluateMathExpression(editValue);
      if (computed !== null) {
        finalValue = computed;
      }
    }

    if (onCommitCell) {
      onCommitCell(activeCell.row, colDef.key, finalValue);
    }

    setIsEditing(false);

    if (andMoveRight) {
      // Check if on final column of last row -> Auto-row injection
      if (activeCell.col >= totalCols - 1) {
        if (activeCell.row >= rowCount - 1 && enableAutoRowInjection) {
          if (onAddRow) {
            onAddRow();
            setActiveCell({ row: activeCell.row + 1, col: 0 });
          }
        } else {
          setActiveCell({ row: Math.min(activeCell.row + 1, rowCount - 1), col: 0 });
        }
      } else {
        setActiveCell((prev) => ({ ...prev, col: prev.col + 1 }));
      }
    }
  }, [isEditing, editValue, columns, activeCell, onCommitCell, totalCols, rowCount, enableAutoRowInjection, onAddRow]);

  // Cancel edit
  const cancelEdit = useCallback(() => {
    if (!isEditing) return;
    setIsEditing(false);
    setEditValue(initialValueBeforeEdit);
  }, [isEditing, initialValueBeforeEdit]);

  // Register hierarchical ESC for edit mode (Priority 80)
  useEffect(() => {
    if (!isEditing) return;
    const unregister = registerEscHandler(() => {
      cancelEdit();
      return true; // handled
    }, 80);
    return unregister;
  }, [isEditing, cancelEdit, registerEscHandler]);

  // Main Keydown Traversal Handler for Grid
  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    // If currently editing inside cell, handle editor keys
    if (isEditing) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        commitEdit(!e.shiftKey);
      }
      return;
    }

    // Grid Navigation Keys (when NOT in inline edit mode)
    switch (e.key) {
      case 'ArrowUp': {
        e.preventDefault();
        setActiveCell((prev) => ({
          ...prev,
          row: Math.max(0, prev.row - 1),
        }));
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        setActiveCell((prev) => ({
          ...prev,
          row: Math.min(rowCount - 1, prev.row + 1),
        }));
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        setActiveCell((prev) => ({
          ...prev,
          col: Math.max(0, prev.col - 1),
        }));
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        setActiveCell((prev) => ({
          ...prev,
          col: Math.min(totalCols - 1, prev.col + 1),
        }));
        break;
      }
      case 'Home': {
        e.preventDefault();
        setActiveCell((prev) => ({ ...prev, col: 0 }));
        break;
      }
      case 'End': {
        e.preventDefault();
        setActiveCell((prev) => ({ ...prev, col: totalCols - 1 }));
        break;
      }
      case 'PageUp': {
        e.preventDefault();
        setActiveCell((prev) => ({
          ...prev,
          row: Math.max(0, prev.row - 20),
        }));
        break;
      }
      case 'PageDown': {
        e.preventDefault();
        setActiveCell((prev) => ({
          ...prev,
          row: Math.min(rowCount - 1, prev.row + 20),
        }));
        break;
      }
      case 'Enter':
      case 'F2': {
        e.preventDefault();
        startEditing();
        break;
      }
      case ' ': {
        // Space toggles row selection
        e.preventDefault();
        if (onToggleSelectRow) {
          onToggleSelectRow(activeCell.row);
        }
        break;
      }
      case 'Delete': {
        if (e.altKey) {
          // Alt + Delete: remove active row
          e.preventDefault();
          if (onDeleteRow) {
            onDeleteRow(activeCell.row);
          }
        }
        break;
      }
      default: {
        // Quick inline edit on typing alphanumeric character or minus
        if (
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          e.key.length === 1 &&
          /^[a-zA-Z0-9.\-+\/*%]$/.test(e.key)
        ) {
          e.preventDefault();
          startEditing(e.key);
        }
        break;
      }
    }
  };

  // Helper for cell props
  const getCellProps = (row: number, col: number) => {
    const isActive = activeCell.row === row && activeCell.col === col;
    return {
      'data-grid-row': row,
      'data-grid-col': col,
      tabIndex: isActive ? 0 : -1,
      role: 'gridcell',
      'aria-selected': isActive,
      onFocus: () => setActiveCell({ row, col }),
      onDoubleClick: () => {
        setActiveCell({ row, col });
        startEditing();
      },
      style: {
        outline: isActive ? '2px solid #2563eb' : 'none',
        outlineOffset: '-2px',
        backgroundColor: isActive ? 'rgba(37, 99, 235, 0.08)' : undefined,
      },
    };
  };

  return {
    gridContainerRef,
    editInputRef,
    activeCell,
    setActiveCell,
    isEditing,
    editValue,
    setEditValue,
    startEditing,
    commitEdit,
    cancelEdit,
    handleGridKeyDown,
    getCellProps,
  };
}
