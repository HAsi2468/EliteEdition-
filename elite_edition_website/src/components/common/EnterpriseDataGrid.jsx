import React, { useState, useMemo } from 'react';
import { Search, Eye, ChevronLeft, ChevronRight, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { useTableDensity, TableDensityToggle } from '../../hooks/useTableDensity';
import './EnterpriseDataGrid.css';

/**
 * EnterpriseDataGrid
 * 
 * Production-ready High-Density Data Grid Skeleton
 * 
 * Features:
 * 1. Sticky headers with box-shadow boundary on vertical scroll.
 * 2. Column freezing (freeze key identifier on left, freeze action buttons on right).
 * 3. Density switcher: Compact (28px row height) vs Comfortable (44px row height).
 * 4. Tabular numeric formatting (tnum) for quantities, rates, and amounts.
 * 5. Row inspection trigger for right-side flyout peek drawer.
 */
export function EnterpriseDataGrid({
  columns = [],
  data = [],
  idField = 'id',
  selectedId,
  onRowClick,
  onInspectRow,
  title = 'Data Records',
  subtitle,
  actions = [],
  enableDensityToggle = true,
  enableFilter = true,
  defaultDensity = 'compact',
  emptyMessage = 'No matching records found'
}) {
  const { density, setDensity, isCompact } = useTableDensity(defaultDensity);
  const [filterQuery, setFilterQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Filter records
  const filteredData = useMemo(() => {
    if (!filterQuery.trim()) return data;
    const q = filterQuery.toLowerCase();
    return data.filter((row) =>
      Object.values(row).some((val) =>
        String(val ?? '').toLowerCase().includes(q)
      )
    );
  }, [data, filterQuery]);

  // Sort records
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key] ?? '';
      const bVal = b[sortConfig.key] ?? '';
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  const handleSort = (colKey) => {
    setSortConfig((prev) => {
      if (prev.key === colKey) {
        return { key: colKey, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key: colKey, direction: 'asc' };
    });
  };

  return (
    <div className="erp-grid-container">
      {/* ── Toolbar Ribbon ── */}
      <div className="erp-grid-toolbar">
        <div>
          <h3 className="erp-grid-title">{title}</h3>
          {subtitle && <p className="erp-grid-subtitle">{subtitle}</p>}
        </div>

        <div className="erp-grid-toolbar-right">
          {/* Quick Filter */}
          {enableFilter && (
            <div className="erp-grid-search-wrap">
              <Search size={14} className="erp-grid-search-icon" />
              <input
                type="text"
                placeholder="Search table..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="erp-grid-search-input"
              />
            </div>
          )}

          {/* Density Toggle */}
          {enableDensityToggle && (
            <TableDensityToggle density={density} onChange={setDensity} />
          )}

          {/* Custom Action Buttons */}
          {actions.map((act, idx) => (
            <button
              key={idx}
              type="button"
              onClick={act.onClick}
              className={`erp-grid-action-btn ${act.variant === 'primary' ? 'primary' : ''}`}
            >
              {act.icon && <act.icon size={13} />}
              <span>{act.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── High-Density Table Card ── */}
      <div className="erp-grid-table-card">
        <div className="erp-grid-scroll-wrapper">
          <table className={`erp-dense-table sticky-header ${isCompact ? 'erp-density-compact' : 'erp-density-comfortable'}`}>
            <thead>
              <tr>
                {columns.map((col) => {
                  const isLeftFrozen = col.frozen === 'left';
                  const isRightFrozen = col.frozen === 'right';
                  const isNumeric = col.isNumeric || col.align === 'right';

                  return (
                    <th
                      key={col.key}
                      onClick={() => col.sortable !== false && handleSort(col.key)}
                      className={`
                        ${isLeftFrozen ? 'freeze-col-left' : ''}
                        ${isRightFrozen ? 'freeze-col-right' : ''}
                        ${isNumeric ? 'tabular-nums' : ''}
                      `}
                      style={{
                        width: col.width,
                        minWidth: col.width,
                        textAlign: col.align || (isNumeric ? 'right' : 'left'),
                        cursor: col.sortable !== false ? 'pointer' : 'default'
                      }}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span>{col.header}</span>
                        {col.sortable !== false && sortConfig.key === col.key && (
                          <span style={{ fontSize: '10px', color: '#2563eb' }}>
                            {sortConfig.direction === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}

                {/* Optional Inspect Row Header */}
                {onInspectRow && (
                  <th className="freeze-col-right" style={{ width: '80px', minWidth: '80px', textAlign: 'right' }}>
                    Inspect
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {sortedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (onInspectRow ? 1 : 0)}
                    style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b' }}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                sortedData.map((row) => {
                  const rowId = row[idField];
                  const isSelected = rowId === selectedId;

                  return (
                    <tr
                      key={rowId}
                      className={isSelected ? 'selected' : ''}
                      onClick={() => onRowClick?.(row)}
                      style={{ cursor: onRowClick || onInspectRow ? 'pointer' : 'default' }}
                    >
                      {columns.map((col) => {
                        const isLeftFrozen = col.frozen === 'left';
                        const isRightFrozen = col.frozen === 'right';
                        const isNumeric = col.isNumeric || col.align === 'right';
                        const cellValue = row[col.key];

                        return (
                          <td
                            key={col.key}
                            className={`
                              ${isLeftFrozen ? 'freeze-col-left' : ''}
                              ${isRightFrozen ? 'freeze-col-right' : ''}
                              ${isNumeric ? 'tabular-nums' : ''}
                            `}
                            style={{
                              textAlign: col.align || (isNumeric ? 'right' : 'left'),
                              fontWeight: isLeftFrozen ? 700 : 'normal',
                              color: isLeftFrozen ? 'var(--erp-primary, #2563eb)' : 'inherit'
                            }}
                          >
                            {col.render ? col.render(row, cellValue) : (cellValue ?? '—')}
                          </td>
                        );
                      })}

                      {/* Inspect Drawer Action Button */}
                      {onInspectRow && (
                        <td className="freeze-col-right" style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="erp-grid-inspect-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onInspectRow(row);
                            }}
                            title="Inspect in right flyout drawer"
                          >
                            <Eye size={13} color="#2563eb" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Grid Footer Bar */}
        <div className="erp-grid-footer">
          <span className="tabular-nums" style={{ fontSize: '11px', color: '#64748b' }}>
            Showing {sortedData.length} of {data.length} records
          </span>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            Density: {density.toUpperCase()} • Sticky Header Active
          </span>
        </div>
      </div>
    </div>
  );
}

export default EnterpriseDataGrid;
