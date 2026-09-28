import React from 'react';

/**
 * Minimal Bulk Action Bar
 * Appears floating at the bottom when rows are selected.
 * Provides actions: Change Status, Print, Export, and Clear Selection.
 * No decorative icons, no gradients.
 */

export function BulkActionBar({
  selectedCount = 0,
  onClear = () => {},
  onChangeStatus = () => {},
  onPrint = () => {},
  onExport = () => {},
  statusOptions = ['Pending', 'In Progress', 'Done', 'Delayed'],
  style = {}
}) {
  if (selectedCount === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        borderRadius: '8px',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 99990,
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        fontSize: '13px',
        fontWeight: 500,
        ...style
      }}
    >
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {selectedCount} selected
      </span>

      <div style={{ width: '1px', height: '18px', backgroundColor: '#334155' }} />

      {/* Change Status Dropdown or Button */}
      <select
        onChange={(e) => {
          if (e.target.value) {
            onChangeStatus(e.target.value);
            e.target.value = '';
          }
        }}
        defaultValue=""
        style={{
          backgroundColor: '#1e293b',
          color: '#f8fafc',
          border: '1px solid #475569',
          borderRadius: '4px',
          padding: '4px 8px',
          fontSize: '12px',
          outline: 'none',
          cursor: 'pointer'
        }}
      >
        <option value="" disabled>Change Status...</option>
        {statusOptions.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>

      {/* Print Action */}
      <button
        type="button"
        onClick={onPrint}
        style={{
          backgroundColor: '#1e293b',
          color: '#f8fafc',
          border: '1px solid #475569',
          borderRadius: '4px',
          padding: '4px 10px',
          fontSize: '12px',
          cursor: 'pointer'
        }}
      >
        Print
      </button>

      {/* Export Action */}
      <button
        type="button"
        onClick={onExport}
        style={{
          backgroundColor: '#1e293b',
          color: '#f8fafc',
          border: '1px solid #475569',
          borderRadius: '4px',
          padding: '4px 10px',
          fontSize: '12px',
          cursor: 'pointer'
        }}
      >
        Export
      </button>

      {/* Deselect / Clear */}
      <button
        type="button"
        onClick={onClear}
        style={{
          background: 'none',
          border: 'none',
          color: '#94a3b8',
          fontSize: '12px',
          cursor: 'pointer',
          padding: '4px 6px',
          textDecoration: 'underline'
        }}
      >
        Deselect
      </button>
    </div>
  );
}

export default BulkActionBar;
