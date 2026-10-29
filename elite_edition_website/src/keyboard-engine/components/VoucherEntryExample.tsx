import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useEnterAsTab } from '../useEnterAsTab';
import { useGridNavigation } from '../useGridNavigation';
import { useHotkeys, useHudHints } from '../useHotkeys';
import { HOTKEY_PRIORITIES, GridColumnDef, ShortcutHint } from '../types';
import { MnemonicBadge } from './MnemonicBadge';
import { evaluateMathExpression } from '../mathEvaluator';

export interface LineItem {
  id: string;
  itemCode: string;
  description: string;
  qty: number;
  rate: number;
  amount: number;
  selected?: boolean;
}

export const VoucherEntryExample: React.FC = () => {
  // Voucher Header State
  const [voucherNo, setVoucherNo] = useState('INV-2026-0042');
  const [voucherDate, setVoucherDate] = useState('2026-10-29');
  const [customer, setCustomer] = useState('Adani Enterprises Ltd');
  const [paymentTerms, setPaymentTerms] = useState('Net 30 Days');
  const [remarks, setRemarks] = useState('');
  const [showAddMasterModal, setShowAddMasterModal] = useState(false);
  const [newMasterName, setNewMasterName] = useState('');

  // Voucher Line Items Grid State
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', itemCode: 'FAB-CTN-01', description: 'Premium Cotton Roll 100% 60x60', qty: 250, rate: 120, amount: 30000 },
    { id: '2', itemCode: 'DYE-BLU-04', description: 'Direct Reactive Cyan Dye Grade A', qty: 50, rate: 450, amount: 22500 },
    { id: '3', itemCode: 'STC-THD-09', description: 'Polyester Core Stitching Thread 40/2', qty: 100, rate: 85, amount: 8500 },
  ]);

  const [activeTabSection, setActiveTabSection] = useState<'HEADER' | 'GRID'>('HEADER');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  // 1. Enter-As-Tab Container Hook for Header Form
  const { containerRef: formRef } = useEnterAsTab<HTMLDivElement>({
    onSubmit: () => handleSaveVoucher(false),
    onCancel: () => handleReset(),
    enableMathEvaluation: true,
  });

  // Calculate Subtotals & Totals
  const subtotal = useMemo(
    () => lineItems.reduce((acc, item) => acc + (Number(item.amount) || 0), 0),
    [lineItems]
  );
  const taxAmount = useMemo(() => Math.round(subtotal * 0.18 * 100) / 100, [subtotal]);
  const grandTotal = useMemo(() => subtotal + taxAmount, [subtotal, taxAmount]);

  // 2. Line Items Grid Navigation Setup
  const columns: GridColumnDef<LineItem>[] = [
    { key: 'itemCode', header: 'Item Code', width: '130px', isEditable: true },
    { key: 'description', header: 'Description / Particulars', width: '300px', isEditable: true },
    { key: 'qty', header: 'Quantity', width: '100px', isEditable: true, type: 'number', align: 'right' },
    { key: 'rate', header: 'Rate (₹)', width: '110px', isEditable: true, type: 'number', align: 'right' },
    { key: 'amount', header: 'Amount (₹)', width: '120px', isEditable: false, align: 'right' },
  ];

  const handleAddRow = () => {
    const newId = String(Date.now());
    setLineItems((prev) => [
      ...prev,
      { id: newId, itemCode: '', description: '', qty: 0, rate: 0, amount: 0 },
    ]);
  };

  const handleDeleteRow = (rowIndex: number) => {
    setLineItems((prev) => {
      if (prev.length <= 1) return prev; // keep at least 1 row
      return prev.filter((_, idx) => idx !== rowIndex);
    });
  };

  const handleCommitCell = (rowIndex: number, colKey: string, value: any) => {
    setLineItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[rowIndex] };

      if (colKey === 'qty') {
        const q = parseFloat(value) || 0;
        target.qty = q;
        target.amount = Math.round(q * target.rate * 100) / 100;
      } else if (colKey === 'rate') {
        const r = parseFloat(value) || 0;
        target.rate = r;
        target.amount = Math.round(target.qty * r * 100) / 100;
      } else if (colKey === 'itemCode') {
        target.itemCode = String(value);
      } else if (colKey === 'description') {
        target.description = String(value);
      }

      copy[rowIndex] = target;
      return copy;
    });
  };

  const handleToggleSelectRow = (rowIndex: number) => {
    setLineItems((prev) => {
      const copy = [...prev];
      copy[rowIndex] = { ...copy[rowIndex], selected: !copy[rowIndex].selected };
      return copy;
    });
  };

  const {
    gridContainerRef,
    editInputRef,
    activeCell,
    isEditing,
    editValue,
    setEditValue,
    handleGridKeyDown,
    getCellProps,
  } = useGridNavigation<LineItem>({
    columns,
    rowCount: lineItems.length,
    onAddRow: handleAddRow,
    onDeleteRow: handleDeleteRow,
    onCommitCell: handleCommitCell,
    onToggleSelectRow: handleToggleSelectRow,
    enableAutoRowInjection: true,
  });

  // 3. Actions: Save & Save/Print
  const handleSaveVoucher = (andPrint = false) => {
    setSaveSuccessNotice(
      `✓ Voucher ${voucherNo} Saved Successfully! ${andPrint ? '(Sent to Print Spooler)' : ''}`
    );
    setTimeout(() => setSaveSuccessNotice(null), 4000);
  };

  const handleReset = () => {
    if (window.confirm('Reset this voucher form?')) {
      setRemarks('');
      setLineItems([
        { id: '1', itemCode: 'FAB-CTN-01', description: 'Premium Cotton Roll 100% 60x60', qty: 100, rate: 120, amount: 12000 },
      ]);
    }
  };

  // 4. Hotkeys Registration for Header & Grid Actions
  useHotkeys([
    {
      combo: 'ctrl+s',
      handler: () => {
        handleSaveVoucher(false);
        return true;
      },
      priority: HOTKEY_PRIORITIES.INPUT,
      description: 'Save Voucher',
    },
    {
      combo: 'ctrl+enter',
      handler: () => {
        handleSaveVoucher(true);
        return true;
      },
      priority: HOTKEY_PRIORITIES.INPUT,
      description: 'Save & Print Voucher',
    },
    {
      combo: 'f2',
      handler: () => {
        const dateInput = document.getElementById('voucher-date-input');
        if (dateInput) {
          dateInput.focus();
          (dateInput as HTMLInputElement).select?.();
        }
        return true;
      },
      priority: HOTKEY_PRIORITIES.INPUT,
      description: 'Focus Date Field',
    },
    {
      combo: 'alt+c',
      handler: () => {
        setShowAddMasterModal(true);
        return true;
      },
      priority: HOTKEY_PRIORITIES.INPUT,
      description: 'Add New Customer/Party',
    },
  ]);

  // 5. Publish Dynamic Context-Aware Hints to the Bottom HotkeyHUD
  const currentHudHints: ShortcutHint[] = useMemo(() => {
    if (isEditing) {
      return [
        { key: 'Enter', label: 'Commit & Next' },
        { key: 'Esc', label: 'Cancel Edit' },
        { key: 'Tab', label: 'Commit' },
      ];
    }

    if (activeTabSection === 'GRID') {
      return [
        { key: 'Arrows', label: 'Navigate Grid' },
        { key: 'Enter / F2', label: 'Edit Cell' },
        { key: 'Space', label: 'Select Row' },
        { key: 'Alt+Del', label: 'Delete Row' },
        { key: 'Ctrl+S', label: 'Save', action: () => handleSaveVoucher(false) },
        { key: 'Ctrl+Enter', label: 'Save & Print', action: () => handleSaveVoucher(true) },
      ];
    }

    return [
      { key: 'Enter', label: 'Next Field' },
      { key: 'Shift+Enter', label: 'Previous Field' },
      { key: 'F2', label: 'Date' },
      { key: 'Alt+C', label: 'Add Master', action: () => setShowAddMasterModal(true) },
      { key: 'Ctrl+S', label: 'Save', action: () => handleSaveVoucher(false) },
      { key: 'Ctrl+Enter', label: 'Save & Print', action: () => handleSaveVoucher(true) },
    ];
  }, [isEditing, activeTabSection]);

  useHudHints(currentHudHints, 'voucher_form_screen');

  return (
    <div style={{ maxWidth: 1100, margin: '1rem auto', padding: '0 1rem 3rem 1rem' }}>
      {/* Success Notification Banner */}
      {saveSuccessNotice && (
        <div
          style={{
            background: '#10b981',
            color: '#ffffff',
            padding: '0.65rem 1rem',
            borderRadius: '6px',
            marginBottom: '1rem',
            fontWeight: 700,
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 10px rgba(16, 185, 129, 0.25)',
          }}
        >
          <span>{saveSuccessNotice}</span>
          <button
            type="button"
            onClick={() => setSaveSuccessNotice(null)}
            style={{ all: 'unset', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Voucher Card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
        }}
      >
        {/* Voucher Header Bar */}
        <div
          style={{
            background: '#0f172a',
            color: '#ffffff',
            padding: '0.85rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                color: '#60a5fa',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Enterprise Sales Voucher (F8)
            </span>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              Sales Invoice #{voucherNo}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => handleSaveVoucher(false)}
              className="btn-primary"
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                padding: '0.45rem 0.95rem',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <MnemonicBadge accessKeyChar="S">
                <span>Save (Ctrl+S)</span>
              </MnemonicBadge>
            </button>

            <button
              type="button"
              onClick={() => handleSaveVoucher(true)}
              style={{
                background: '#059669',
                color: '#ffffff',
                border: 'none',
                padding: '0.45rem 0.95rem',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <MnemonicBadge accessKeyChar="P">
                <span>Save & Print (Ctrl+↵)</span>
              </MnemonicBadge>
            </button>
          </div>
        </div>

        {/* 1. HEADER FORM FIELDS (Enter-As-Tab Container) */}
        <div
          ref={formRef}
          onFocus={() => setActiveTabSection('HEADER')}
          style={{
            padding: '1.25rem',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* Voucher No */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
              Voucher No
            </label>
            <input
              id="voucher-no-input"
              type="text"
              value={voucherNo}
              onChange={(e) => setVoucherNo(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Date (F2 Shortcut) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                Date (F2)
              </label>
              <span style={{ fontSize: '0.65rem', color: '#2563eb', fontWeight: 700 }}>[F2]</span>
            </div>
            <input
              id="voucher-date-input"
              type="date"
              value={voucherDate}
              onChange={(e) => setVoucherDate(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Customer / Party (Alt+C Combobox) */}
          <div style={{ gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                Customer / Party (Alt+C to Add New)
              </label>
              <button
                type="button"
                onClick={() => setShowAddMasterModal(true)}
                tabIndex={-1}
                style={{ all: 'unset', cursor: 'pointer', fontSize: '0.68rem', color: '#2563eb', fontWeight: 700 }}
              >
                + Add Master [Alt+C]
              </button>
            </div>
            <select
              id="customer-select"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                boxSizing: 'border-box',
                background: '#ffffff',
              }}
            >
              <option value="Adani Enterprises Ltd">Adani Enterprises Ltd</option>
              <option value="Reliance Retail Fabrics">Reliance Retail Fabrics</option>
              <option value="Raymond Textiles Division">Raymond Textiles Division</option>
              <option value="Bombay Dyeing & Mfg">Bombay Dyeing & Mfg</option>
              {newMasterName && <option value={newMasterName}>{newMasterName}</option>}
            </select>
          </div>

          {/* Payment Terms */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
              Payment Terms
            </label>
            <input
              type="text"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Remarks (Textarea: Enter inserts newline; Ctrl+Enter or Tab navigates) */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
              Remarks (Enter inserts newline; Ctrl+Enter advances)
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter voucher notes or dispatch instructions..."
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* 2. SPREADSHEET LINE ITEMS GRID (Roving TabIndex Navigation) */}
        <div
          style={{ padding: '1rem 1.25rem' }}
          onFocus={() => setActiveTabSection('GRID')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
              Voucher Line Items (Grid Navigation Mode)
            </h4>
            <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.72rem', color: '#64748b' }}>
              <span>Arrows = Move</span>
              <span>•</span>
              <span>Enter = Edit</span>
              <span>•</span>
              <span>Alt+Del = Delete Row</span>
              <span>•</span>
              <button
                type="button"
                onClick={handleAddRow}
                style={{ all: 'unset', cursor: 'pointer', color: '#2563eb', fontWeight: 700 }}
              >
                + Add Line
              </button>
            </div>
          </div>

          {/* Grid Table Container */}
          <div
            ref={gridContainerRef}
            tabIndex={0}
            onKeyDown={handleGridKeyDown}
            role="grid"
            aria-label="Voucher Line Items"
            style={{
              overflowX: 'auto',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              outline: 'none',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ width: 40, padding: '0.45rem', textAlign: 'center' }}>✓</th>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      style={{
                        padding: '0.45rem 0.65rem',
                        textAlign: col.align || 'left',
                        width: col.width,
                        fontWeight: 700,
                        color: '#475569',
                      }}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, rowIndex) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: item.selected ? 'rgba(59, 130, 246, 0.08)' : rowIndex % 2 === 0 ? '#ffffff' : '#fafafa',
                    }}
                  >
                    {/* Multi-Select Checkbox Column */}
                    <td style={{ textAlign: 'center', padding: '0.45rem' }}>
                      <input
                        type="checkbox"
                        checked={!!item.selected}
                        onChange={() => handleToggleSelectRow(rowIndex)}
                        tabIndex={-1}
                      />
                    </td>

                    {/* Dynamic Columns */}
                    {columns.map((col, colIndex) => {
                      const isCurrentCellActive =
                        activeCell.row === rowIndex && activeCell.col === colIndex;

                      const val = (item as any)[col.key];

                      return (
                        <td
                          key={col.key}
                          {...getCellProps(rowIndex, colIndex)}
                          data-cell-value={val}
                          style={{
                            padding: '0.45rem 0.65rem',
                            textAlign: col.align || 'left',
                            position: 'relative',
                            ...getCellProps(rowIndex, colIndex).style,
                          }}
                        >
                          {isCurrentCellActive && isEditing ? (
                            <input
                              ref={editInputRef}
                              type={col.type === 'number' ? 'text' : 'text'}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '2px 4px',
                                fontSize: '0.78rem',
                                border: '2px solid #2563eb',
                                borderRadius: '3px',
                                outline: 'none',
                                boxSizing: 'border-box',
                                textAlign: col.align || 'left',
                                background: '#ffffff',
                              }}
                            />
                          ) : (
                            <span>
                              {col.type === 'number' && typeof val === 'number'
                                ? val.toLocaleString('en-IN')
                                : val || '-'}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. VOUCHER SUMMARY & TOTALS */}
        <div
          style={{
            padding: '1rem 1.25rem',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div style={{ minWidth: 260 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.8rem' }}>
              <span style={{ color: '#64748b' }}>Sub Total:</span>
              <span style={{ fontWeight: 600 }}>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.8rem' }}>
              <span style={{ color: '#64748b' }}>GST @ 18%:</span>
              <span style={{ fontWeight: 600 }}>₹{taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 0',
                fontSize: '1rem',
                fontWeight: 800,
                color: '#0f172a',
                borderTop: '2px solid #cbd5e1',
                marginTop: '4px',
              }}
            >
              <span>Grand Total:</span>
              <span>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* On-The-Fly Add Master Dialog (Alt+C) */}
      {showAddMasterModal && (
        <div
          className="erp-cheat-sheet-backdrop"
          onClick={() => setShowAddMasterModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '8px',
              width: 380,
              padding: '1.25rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 800 }}>
              Quick Add Customer Master (Alt+C)
            </h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.75rem', color: '#64748b' }}>
              Add a new account directly without leaving the voucher.
            </p>
            <input
              type="text"
              autoFocus
              placeholder="Enter Account / Company Name..."
              value={newMasterName}
              onChange={(e) => setNewMasterName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (newMasterName.trim()) {
                    setCustomer(newMasterName.trim());
                    setShowAddMasterModal(false);
                  }
                } else if (e.key === 'Escape') {
                  setShowAddMasterModal(false);
                }
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                marginBottom: '1rem',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowAddMasterModal(false)}
                style={{ padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', fontSize: '0.78rem' }}
              >
                Cancel (Esc)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newMasterName.trim()) {
                    setCustomer(newMasterName.trim());
                    setShowAddMasterModal(false);
                  }
                }}
                style={{ padding: '0.4rem 0.8rem', borderRadius: '4px', border: 'none', background: '#2563eb', color: '#ffffff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}
              >
                Save & Select (Enter)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
