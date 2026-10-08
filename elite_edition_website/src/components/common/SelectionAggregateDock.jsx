import React, { useMemo } from 'react';
import { Layers, X, Download, Printer, ChevronRight } from 'lucide-react';
import { parseNumericCell } from '../../utils/clipboardGridParser';
import './SelectionAggregateDock.css';

/**
 * SelectionAggregateDock
 * 
 * Sticky selection aggregate ribbon that floats when >= 2 rows are selected.
 * Displays real-time statistics:
 * - Selected count
 * - Sum of meterage / units
 * - Sum of monetary amounts (INR formatted)
 * - Average meterage / price
 * - Quick batch actions
 */
export function SelectionAggregateDock({
  selectedRows = [],
  unitField = 'meterage',
  unitLabel = 'Meters',
  valueField = 'amount',
  valueLabel = 'Total Value',
  currencySymbol = '₹',
  onClear = () => {},
  onExport = null,
  onPrint = null,
  customActions = [],
  threshold = 2,
  className = '',
  style = {}
}) {
  if (!Array.isArray(selectedRows) || selectedRows.length < threshold) {
    return null;
  }

  // Compute live aggregates
  const aggregates = useMemo(() => {
    let totalUnits = 0;
    let totalValue = 0;

    selectedRows.forEach((row) => {
      // Look for meterage/units
      const rawUnit = row[unitField] ?? row.meter ?? row.meters ?? row.qty ?? row.quantity ?? 0;
      totalUnits += parseNumericCell(rawUnit, 0);

      // Look for amount/value
      const rawVal = row[valueField] ?? row.total ?? row.price ?? (parseNumericCell(row.rate, 0) * parseNumericCell(rawUnit, 0));
      totalValue += parseNumericCell(rawVal, 0);
    });

    const avgUnit = selectedRows.length > 0 ? totalUnits / selectedRows.length : 0;
    const avgValue = selectedRows.length > 0 ? totalValue / selectedRows.length : 0;

    return {
      count: selectedRows.length,
      totalUnits: Math.round(totalUnits * 100) / 100,
      totalValue: Math.round(totalValue * 100) / 100,
      avgUnit: Math.round(avgUnit * 10) / 10,
      avgValue: Math.round(avgValue * 100) / 100
    };
  }, [selectedRows, unitField, valueField]);

  return (
    <div className={`selection-aggregate-dock ${className}`} style={style}>
      {/* Selected Row Count Badge */}
      <div className="selection-dock-badge">
        <Layers size={14} />
        <span>
          <strong className="tabular-nums">{aggregates.count}</strong> rows selected
        </span>
      </div>

      <div className="selection-dock-divider" />

      {/* Dynamic Real-time Totals */}
      <div className="selection-dock-metrics">
        {/* Total Meterage / Units */}
        <div className="selection-dock-metric-item">
          <span className="selection-dock-metric-label">Total {unitLabel}</span>
          <span className="selection-dock-metric-value tabular-nums">
            {aggregates.totalUnits.toLocaleString('en-IN')} <small style={{ fontSize: '11px', fontWeight: 500, color: '#94a3b8' }}>m</small>
          </span>
        </div>

        {/* Total Valuation */}
        <div className="selection-dock-metric-item">
          <span className="selection-dock-metric-label">{valueLabel}</span>
          <span className="selection-dock-metric-value tabular-nums" style={{ color: '#60a5fa' }}>
            {currencySymbol} {aggregates.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Avg Meterage */}
        <div className="selection-dock-metric-item" style={{ display: aggregates.count > 2 ? 'flex' : 'none' }}>
          <span className="selection-dock-metric-label">Avg / Row</span>
          <span className="selection-dock-metric-value tabular-nums" style={{ color: '#cbd5e1', fontSize: '13px' }}>
            {aggregates.avgUnit.toLocaleString('en-IN')} m
          </span>
        </div>
      </div>

      <div className="selection-dock-divider" />

      {/* Operational Actions */}
      <div className="selection-dock-actions">
        {onPrint && (
          <button type="button" className="selection-dock-btn" onClick={() => onPrint(selectedRows)}>
            <Printer size={13} />
            <span>Print Batch</span>
          </button>
        )}

        {onExport && (
          <button type="button" className="selection-dock-btn" onClick={() => onExport(selectedRows)}>
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        )}

        {customActions.map((act, idx) => (
          <button
            key={idx}
            type="button"
            className={`selection-dock-btn ${act.primary ? 'primary' : ''}`}
            onClick={() => act.onClick(selectedRows)}
          >
            {act.icon}
            <span>{act.label}</span>
          </button>
        ))}

        <button
          type="button"
          className="selection-dock-close"
          onClick={onClear}
          title="Clear row selection"
          aria-label="Clear selection"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
