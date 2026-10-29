import React, { useEffect, useRef } from 'react';

/**
 * ErpTh - Standard ERP Table Header Cell
 * Strictly complies with ERP Data Table Rules:
 * 1. SORTING:
 *    - Every column header must render sort buttons for both Ascending (ASC) and Descending (DESC).
 *    - Never omit sort buttons from any column unless explicitly instructed.
 *    - Maintain sort state using { columnKey: string, order: 'asc' | 'desc' | null }.
 * 3. LAYOUT:
 *    - Use compact ERP-standard cell padding (dense density).
 *    - Ensure sticky table headers (top-0 sticky z-10).
 */
export function ErpTh({
  children,
  columnKey,
  sortState, // { columnKey: string, order: 'asc' | 'desc' | null }
  onSortChange,
  align = 'left',
  width,
  style = {},
  className = '',
  hideSort = false,
  ...rest
}) {
  const isSorted = sortState && sortState.columnKey === columnKey;
  const isAsc = isSorted && sortState.order === 'asc';
  const isDesc = isSorted && sortState.order === 'desc';

  const handleAscClick = (e) => {
    e.stopPropagation();
    if (!onSortChange || !columnKey) return;
    if (isAsc) {
      onSortChange({ columnKey, order: null });
    } else {
      onSortChange({ columnKey, order: 'asc' });
    }
  };

  const handleDescClick = (e) => {
    e.stopPropagation();
    if (!onSortChange || !columnKey) return;
    if (isDesc) {
      onSortChange({ columnKey, order: null });
    } else {
      onSortChange({ columnKey, order: 'desc' });
    }
  };

  const handleHeaderClick = () => {
    if (!onSortChange || !columnKey || hideSort) return;
    if (!isSorted) {
      onSortChange({ columnKey, order: 'asc' });
    } else if (isAsc) {
      onSortChange({ columnKey, order: 'desc' });
    } else {
      onSortChange({ columnKey, order: null });
    }
  };

  const justifyMap = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
  };

  const titleText = typeof children === 'string' ? children : columnKey;

  return (
    <th
      onClick={handleHeaderClick}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        padding: '0.45rem 0.65rem',
        fontSize: '0.73rem',
        fontWeight: 700,
        color: isSorted ? '#1e293b' : '#475569',
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        background: isSorted ? '#f1f5f9' : '#f8fafc',
        borderBottom: isSorted ? '2px solid #3b82f6' : '2px solid #e2e8f0',
        whiteSpace: 'nowrap',
        textAlign: align,
        width,
        cursor: columnKey && !hideSort ? 'pointer' : 'default',
        userSelect: 'none',
        transition: 'background 0.15s ease',
        ...style,
      }}
      className={className}
      {...rest}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          justifyContent: justifyMap[align] || 'flex-start',
          width: '100%',
        }}
      >
        <span>{children}</span>
        {!hideSort && columnKey && (
          <span
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '1px',
              marginLeft: '0.15rem',
              lineHeight: 1,
              userSelect: 'none',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={handleAscClick}
              title={`Sort ${titleText} Ascending`}
              aria-label={`Sort ${titleText} Ascending`}
              style={{
                border: 'none',
                background: isAsc ? 'rgba(37, 99, 235, 0.18)' : 'transparent',
                borderRadius: '2px',
                padding: '1px 2px',
                width: '12px',
                height: '7px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                lineHeight: 0,
                transition: 'all 0.12s ease',
              }}
            >
              <svg width="7" height="4" viewBox="0 0 7 4" fill="none" style={{ display: 'block' }}>
                <path d="M3.5 0.5L6.5 3.5H0.5L3.5 0.5Z" fill={isAsc ? '#2563eb' : '#94a3b8'} />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleDescClick}
              title={`Sort ${titleText} Descending`}
              aria-label={`Sort ${titleText} Descending`}
              style={{
                border: 'none',
                background: isDesc ? 'rgba(37, 99, 235, 0.18)' : 'transparent',
                borderRadius: '2px',
                padding: '1px 2px',
                width: '12px',
                height: '7px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                lineHeight: 0,
                transition: 'all 0.12s ease',
              }}
            >
              <svg width="7" height="4" viewBox="0 0 7 4" fill="none" style={{ display: 'block' }}>
                <path d="M3.5 3.5L0.5 0.5H6.5L3.5 3.5Z" fill={isDesc ? '#2563eb' : '#94a3b8'} />
              </svg>
            </button>
          </span>
        )}
      </div>
    </th>
  );
}

/**
 * MasterCheckboxTh - Column 0 Master Multi-Select Checkbox
 * Strictly complies with ERP Data Table Rules:
 * 2. SELECTION:
 *    - Column 0 must always be a multi-select checkbox column.
 *    - The header must include a Master Checkbox supporting checked, unchecked, and indeterminate states.
 */
export function MasterCheckboxTh({
  allSelected,
  someSelected,
  onToggleAll,
  totalCount = 0,
  style = {},
  title = "Select All Rows",
}) {
  const checkboxRef = useRef(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = Boolean(someSelected && !allSelected);
    }
  }, [someSelected, allSelected]);

  return (
    <th
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        width: '42px',
        padding: '0.45rem 0.5rem',
        textAlign: 'center',
        background: '#f8fafc',
        borderBottom: '2px solid #e2e8f0',
        ...style,
      }}
    >
      <input
        ref={checkboxRef}
        type="checkbox"
        checked={Boolean(allSelected && totalCount > 0)}
        onChange={onToggleAll}
        title={title}
        style={{
          cursor: 'pointer',
          width: '16px',
          height: '16px',
          accentColor: '#2563eb',
        }}
      />
    </th>
  );
}

/**
 * RowCheckboxTd - Column 0 Row Multi-Select Checkbox
 */
export function RowCheckboxTd({
  checked,
  onChange,
  style = {},
  title = "Select Row",
}) {
  return (
    <td
      style={{
        width: '42px',
        padding: '0.45rem 0.5rem',
        textAlign: 'center',
        ...style,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={onChange}
        title={title}
        style={{
          cursor: 'pointer',
          width: '16px',
          height: '16px',
          accentColor: '#2563eb',
        }}
      />
    </td>
  );
}

/**
 * getRowHighlightStyle - Returns background styling conforming to ERP rules
 * Selected rows must visually highlight using bg-blue-50/50 or equivalent theme style.
 */
export function getRowHighlightStyle(isSelected, baseBg = 'transparent') {
  return isSelected ? 'rgba(59, 130, 246, 0.08)' : baseBg;
}
