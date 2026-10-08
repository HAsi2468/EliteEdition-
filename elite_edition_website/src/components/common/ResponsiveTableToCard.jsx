import React, { useState, useMemo } from 'react';
import { Search, Eye, ChevronRight, SlidersHorizontal, ArrowUpDown, FileSpreadsheet, CheckSquare, Square } from 'lucide-react';
import { useDeviceContext } from '../../hooks/useDeviceContext';
import { useTableDensity, TableDensityToggle } from '../../hooks/useTableDensity';
import { RowPeekDrawer } from './RowPeekDrawer';
import { SelectionAggregateDock } from './SelectionAggregateDock';
import { ClipboardGridIngestionModal } from './ClipboardGridIngestionModal';
import './ResponsiveTableToCard.css';

/**
 * ResponsiveTableToCard
 * 
 * Enterprise Table-to-Card Responsive Component
 * 
 * Strict Typography Contract:
 * - NO dynamic vw/vh text clamps.
 * - Primary Body & Data Grid Text: exactly 14px (line-height: 20px).
 * - Column Headers, Labels & Badges: exactly 12px (line-height: 16px, font-weight: 500).
 * - Section Titles & Card Headers: exactly 16px–18px (font-weight: 600).
 * - Tabular Numerals: font-variant-numeric: tabular-nums for all numbers, prices, meterages, and dates.
 * 
 * Enterprise Operator Capabilities:
 * - Multi-row selection with persistent floating SelectionAggregateDock
 * - Excel / Sheets clipboard grid ingestion modal (Ctrl+V / Cmd+V)
 * - Row peek flyout drawer for zero-page-reload inspection
 */
export function ResponsiveTableToCard({
  columns = [],
  data = [],
  idField = 'id',
  titleField,
  badgeField = 'status',
  selectedId,
  onRowClick,
  onInspectRow,
  title = 'Data Records',
  subtitle,
  actions = [],
  enableDensityToggle = true,
  enableFilter = true,
  defaultDensity = 'compact',
  emptyMessage = 'No matching records found',
  selectable = true,
  selectedRows: externalSelectedRows,
  onSelectionChange,
  enableClipboardImport = true,
  onBatchImport = null,
  unitField = 'meterage',
  valueField = 'amount',
  onPrintBatch = null,
  onExportBatch = null
}) {
  const { isMobile, isTablet, isDesktop } = useDeviceContext();
  const { density, setDensity, isCompact } = useTableDensity(defaultDensity);

  const [filterQuery, setFilterQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Internal multi-selection state if not managed externally
  const [internalSelectedIds, setInternalSelectedIds] = useState([]);
  const selectedIds = useMemo(() => {
    if (externalSelectedRows) {
      return externalSelectedRows.map((r) => r[idField]);
    }
    return internalSelectedIds;
  }, [externalSelectedRows, internalSelectedIds, idField]);

  // Peek Drawer State
  const [inspectRecord, setInspectRecord] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Clipboard Ingestion Modal State
  const [isClipboardModalOpen, setIsClipboardModalOpen] = useState(false);

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

  // Selected Row Objects for Aggregate Dock
  const activeSelectedRows = useMemo(() => {
    return sortedData.filter((r) => selectedIds.includes(r[idField]));
  }, [sortedData, selectedIds, idField]);

  const handleSort = (colKey) => {
    setSortConfig((prev) => {
      if (prev.key === colKey) {
        return { key: colKey, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key: colKey, direction: 'asc' };
    });
  };

  const handleInspect = (row) => {
    if (onInspectRow) {
      onInspectRow(row);
    } else {
      setInspectRecord(row);
      setIsDrawerOpen(true);
    }
  };

  // Selection handlers
  const handleToggleSelectRow = (row, e) => {
    e?.stopPropagation();
    const rowId = row[idField];
    const newIds = selectedIds.includes(rowId)
      ? selectedIds.filter((id) => id !== rowId)
      : [...selectedIds, rowId];

    if (onSelectionChange) {
      const newRows = sortedData.filter((r) => newIds.includes(r[idField]));
      onSelectionChange(newRows);
    } else {
      setInternalSelectedIds(newIds);
    }
  };

  const handleSelectAll = (e) => {
    e?.stopPropagation();
    if (selectedIds.length === sortedData.length) {
      if (onSelectionChange) onSelectionChange([]);
      else setInternalSelectedIds([]);
    } else {
      const allIds = sortedData.map((r) => r[idField]);
      if (onSelectionChange) onSelectionChange(sortedData);
      else setInternalSelectedIds(allIds);
    }
  };

  const handleClearSelection = () => {
    if (onSelectionChange) onSelectionChange([]);
    else setInternalSelectedIds([]);
  };

  // Build drawer fields from columns
  const drawerFields = useMemo(() => {
    if (!inspectRecord) return [];
    return columns.map((col) => ({
      label: col.header,
      value: inspectRecord[col.key],
      isNumeric: col.isNumeric || col.align === 'right'
    }));
  }, [columns, inspectRecord]);

  const currentIndex = sortedData.findIndex((r) => r[idField] === inspectRecord?.[idField]);

  return (
    <div className="table-to-card-container">
      {/* ── Top Toolbar Ribbon ── */}
      <div className="table-to-card-toolbar">
        <div>
          <h3 className="table-to-card-title">{title}</h3>
          {subtitle && <p className="table-to-card-subtitle">{subtitle}</p>}
        </div>

        <div className="table-to-card-toolbar-right">
          {/* Quick Search */}
          {enableFilter && (
            <div className="table-to-card-search-wrap">
              <Search size={14} className="table-to-card-search-icon" />
              <input
                type="text"
                placeholder="Filter records..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="table-to-card-search-input"
              />
            </div>
          )}

          {/* Density Switcher (Desktop & Tablet) */}
          {!isMobile && enableDensityToggle && (
            <TableDensityToggle density={density} onChange={setDensity} />
          )}

          {/* Clipboard Ingestion Trigger */}
          {enableClipboardImport && (
            <button
              type="button"
              className="table-to-card-action-btn"
              onClick={() => setIsClipboardModalOpen(true)}
              title="Batch import from Excel or Google Sheets (Ctrl+V)"
            >
              <FileSpreadsheet size={14} color="#16a34a" />
              <span>Paste Excel</span>
            </button>
          )}

          {/* Custom Action Buttons */}
          {actions.map((act, idx) => (
            <button
              key={idx}
              type="button"
              onClick={act.onClick}
              className={`table-to-card-action-btn ${act.variant === 'primary' ? 'primary' : ''}`}
            >
              {act.icon && <act.icon size={14} />}
              <span>{act.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 1. MOBILE VERTICAL CARD STACK (<768px) ── */}
      {isMobile ? (
        <div className="table-to-card-mobile-stack">
          {sortedData.length === 0 ? (
            <div className="table-to-card-empty">{emptyMessage}</div>
          ) : (
            sortedData.map((row) => {
              const rowId = row[idField];
              const isSelected = selectedIds.includes(rowId) || rowId === selectedId;
              const titleVal = titleField ? row[titleField] : (columns[1] ? row[columns[1].key] : rowId);
              const badgeVal = row[badgeField];

              return (
                <div
                  key={rowId}
                  className={`table-to-card-summary-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    if (selectable) {
                      handleToggleSelectRow(row);
                    } else {
                      onRowClick?.(row);
                      handleInspect(row);
                    }
                  }}
                >
                  {/* Card Header: Selection Checkbox + Primary ID + Status Badge */}
                  <div className="table-to-card-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {selectable && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(rowId)}
                          onChange={(e) => handleToggleSelectRow(row, e)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                      )}
                      <span className="table-to-card-card-id tabular-nums">#{rowId}</span>
                    </div>

                    {badgeVal && (
                      <span className="table-to-card-card-badge">{badgeVal}</span>
                    )}
                  </div>

                  {/* Card Title */}
                  {titleVal && (
                    <div className="table-to-card-card-title">{titleVal}</div>
                  )}

                  {/* Card Key-Value Metadata Grid (14px values, 12px labels) */}
                  <div className="table-to-card-card-grid">
                    {columns
                      .filter((col) => col.key !== idField && col.key !== titleField && col.key !== badgeField)
                      .slice(0, 4)
                      .map((col) => {
                        const cellVal = row[col.key];
                        const isNumeric = col.isNumeric || col.align === 'right';

                        return (
                          <div key={col.key} className="table-to-card-card-cell">
                            <span className="table-to-card-cell-label">{col.header}</span>
                            <span className={`table-to-card-cell-value ${isNumeric ? 'tabular-nums' : ''}`}>
                              {col.render ? col.render(row, cellVal) : (cellVal ?? '—')}
                            </span>
                          </div>
                        );
                      })}
                  </div>

                  {/* Card Footer Tap Indicator */}
                  <div
                    className="table-to-card-card-footer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInspect(row);
                    }}
                  >
                    <span>Tap to inspect row details</span>
                    <ChevronRight size={14} color="#94a3b8" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ── 2. DESKTOP & TABLET HIGH-DENSITY DATA GRID (>=768px) ── */
        <div className="table-to-card-table-wrap">
          <table className={`erp-dense-table sticky-header ${isCompact ? 'erp-density-compact' : 'erp-density-comfortable'}`}>
            <thead>
              <tr>
                {/* Select All Checkbox Column */}
                {selectable && (
                  <th style={{ width: '36px', minWidth: '36px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={sortedData.length > 0 && selectedIds.length === sortedData.length}
                      onChange={handleSelectAll}
                      style={{ cursor: 'pointer' }}
                      title="Select all rows"
                    />
                  </th>
                )}

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

                {/* Inspect Action Column */}
                <th className="freeze-col-right" style={{ width: '80px', minWidth: '80px', textAlign: 'right' }}>
                  Inspect
                </th>
              </tr>
            </thead>

            <tbody>
              {sortedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (selectable ? 2 : 1)} className="table-to-card-empty-cell">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                sortedData.map((row) => {
                  const rowId = row[idField];
                  const isSelected = selectedIds.includes(rowId) || rowId === selectedId;

                  return (
                    <tr
                      key={rowId}
                      className={isSelected ? 'selected' : ''}
                      onClick={() => onRowClick?.(row)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Row Checkbox */}
                      {selectable && (
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(rowId)}
                            onChange={(e) => handleToggleSelectRow(row, e)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                      )}

                      {columns.map((col) => {
                        const isLeftFrozen = col.frozen === 'left';
                        const isRightFrozen = col.frozen === 'right';
                        const isNumeric = col.isNumeric || col.align === 'right';
                        const cellVal = row[col.key];

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
                            {col.render ? col.render(row, cellVal) : (cellVal ?? '—')}
                          </td>
                        );
                      })}

                      {/* Inspect Action */}
                      <td className="freeze-col-right" style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="table-to-card-inspect-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspect(row);
                          }}
                          title="Inspect record in right flyout drawer"
                        >
                          <Eye size={13} color="#2563eb" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Table Footer ── */}
      <div className="table-to-card-footer">
        <span className="tabular-nums">
          Showing {sortedData.length} of {data.length} records
          {selectedIds.length > 0 && ` (${selectedIds.length} selected)`}
        </span>
        <span>
          Locked Typography: 14px Body • 12px Headers • Tabular Num
        </span>
      </div>

      {/* ── Sticky Selection Aggregate Dock (Appears when >=2 rows selected) ── */}
      <SelectionAggregateDock
        selectedRows={activeSelectedRows}
        unitField={unitField}
        valueField={valueField}
        onClear={handleClearSelection}
        onPrint={onPrintBatch}
        onExport={onExportBatch}
      />

      {/* ── Detail Flyout Peek Drawer (Right-side slide-over) ── */}
      <RowPeekDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={inspectRecord ? String(inspectRecord[idField]) : 'Record Inspection'}
        subtitle={inspectRecord && titleField ? inspectRecord[titleField] : ''}
        badgeText={inspectRecord && badgeField ? inspectRecord[badgeField] : ''}
        record={inspectRecord}
        fields={drawerFields}
        currentIndex={currentIndex >= 0 ? currentIndex : undefined}
        totalCount={sortedData.length}
        onNavigatePrevious={currentIndex > 0 ? () => setInspectRecord(sortedData[currentIndex - 1]) : null}
        onNavigateNext={currentIndex < sortedData.length - 1 ? () => setInspectRecord(sortedData[currentIndex + 1]) : null}
      />

      {/* ── Clipboard Grid Ingestion Modal ── */}
      <ClipboardGridIngestionModal
        isOpen={isClipboardModalOpen}
        onClose={() => setIsClipboardModalOpen(false)}
        columns={columns}
        onImport={(importResult) => {
          onBatchImport?.(importResult);
        }}
      />
    </div>
  );
}

export default ResponsiveTableToCard;
