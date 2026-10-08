import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FileSpreadsheet, X, CheckCircle2, AlertCircle, ArrowRight, Upload, Trash2 } from 'lucide-react';
import { parseAndValidateClipboardData, parseClipboardTextToGrid, detectColumnMapping } from '../../utils/clipboardGridParser';
import './ClipboardGridIngestionModal.css';

/**
 * ClipboardGridIngestionModal
 * 
 * Enterprise operator utility to paste Excel/Sheets batch data into line-item grids.
 * Features:
 * - Direct Cmd+V / Ctrl+V clipboard ingestion
 * - Dynamic column mapping
 * - Real-time schema type validation
 * - Mode selection: Append to existing records vs. Replace
 */
export function ClipboardGridIngestionModal({
  isOpen = false,
  onClose = () => {},
  onImport = () => {},
  columns = [],
  title = 'Batch Clipboard Ingestion (Excel / Sheets)',
  initialData = ''
}) {
  const [rawText, setRawText] = useState(initialData);
  const [columnMapping, setColumnMapping] = useState({});
  const [importMode, setImportMode] = useState('append'); // 'append' | 'replace'
  const textareaRef = useRef(null);

  // Auto-focus textarea on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    } else {
      setRawText('');
      setColumnMapping({});
    }
  }, [isOpen]);

  // Global paste handler while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handleWindowPaste = (e) => {
      // Don't intercept if typing in another input
      if (e.target && e.target !== textareaRef.current && e.target.tagName === 'INPUT') {
        return;
      }
      const clipboardData = e.clipboardData?.getData('text');
      if (clipboardData) {
        setRawText(clipboardData);
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [isOpen]);

  // Parse and validate grid
  const parseResult = useMemo(() => {
    if (!rawText.trim()) return null;
    return parseAndValidateClipboardData(rawText, columns, {
      hasHeaderRow: true,
      columnMapping: Object.keys(columnMapping).length > 0 ? columnMapping : null
    });
  }, [rawText, columns, columnMapping]);

  // Update initial detected column mapping when parsed first time
  useEffect(() => {
    if (parseResult?.mapping && Object.keys(columnMapping).length === 0) {
      setColumnMapping(parseResult.mapping);
    }
  }, [parseResult, columnMapping]);

  const handleColumnMappingChange = (colIndex, newKey) => {
    setColumnMapping((prev) => ({
      ...prev,
      [colIndex]: newKey
    }));
  };

  const handleConfirmImport = (onlyValid = true) => {
    if (!parseResult) return;
    const targetRows = onlyValid 
      ? parseResult.rows.filter((r) => r.isValid).map((r) => r.data)
      : parseResult.rows.map((r) => r.data);

    onImport({
      rows: targetRows,
      mode: importMode,
      totalCount: parseResult.totalCount,
      validCount: parseResult.validCount
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="clipboard-modal-overlay" onClick={onClose}>
      <div className="clipboard-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="clipboard-modal-header">
          <h2 className="clipboard-modal-title">
            <FileSpreadsheet size={20} color="#2563eb" />
            <span>{title}</span>
          </h2>
          <button className="clipboard-modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="clipboard-modal-body">
          {/* Paste Input Container */}
          <div className="clipboard-paste-box" onClick={() => textareaRef.current?.focus()}>
            <FileSpreadsheet size={28} className="clipboard-paste-icon" />
            <p className="clipboard-paste-hint">Copy data from Excel or Google Sheets, then press Ctrl+V / Cmd+V</p>
            <p className="clipboard-paste-subhint">Supports tab-delimited cells, automatic header detection, and type parsing</p>
          </div>

          <textarea
            ref={textareaRef}
            className="clipboard-textarea"
            placeholder="Or paste clipboard content directly here (tab-separated values)..."
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              setColumnMapping({});
            }}
          />

          {/* Validation & Mapping Area */}
          {parseResult && parseResult.rows.length > 0 && (
            <>
              {/* Summary Stats */}
              <div className="clipboard-summary-ribbon">
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span>Total Rows: <strong className="tabular-nums">{parseResult.totalCount}</strong></span>
                  <span className="clipboard-stat-badge valid">
                    <CheckCircle2 size={13} />
                    <span className="tabular-nums">{parseResult.validCount} Valid</span>
                  </span>
                  {parseResult.errorCount > 0 && (
                    <span className="clipboard-stat-badge error">
                      <AlertCircle size={13} />
                      <span className="tabular-nums">{parseResult.errorCount} Errors</span>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '12px' }}
                  onClick={() => {
                    setRawText('');
                    setColumnMapping({});
                  }}
                >
                  <Trash2 size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  Clear Data
                </button>
              </div>

              {/* Data Preview Table */}
              <div className="clipboard-table-wrap">
                <table className="clipboard-preview-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>Row</th>
                      <th style={{ width: '100px' }}>Status</th>
                      {Object.keys(columnMapping).map((colIdx) => {
                        const activeKey = columnMapping[colIdx];
                        return (
                          <th key={colIdx}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span>Col #{parseInt(colIdx, 10) + 1}</span>
                              <select
                                className="clipboard-col-mapping-select"
                                value={activeKey || ''}
                                onChange={(e) => handleColumnMappingChange(colIdx, e.target.value)}
                              >
                                <option value="">(Ignore Column)</option>
                                {columns.map((col) => (
                                  <option key={col.key} value={col.key}>
                                    {col.header || col.key}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.rows.map((row) => (
                      <tr key={row.rowIndex} className={!row.isValid ? 'has-error' : ''}>
                        <td className="tabular-nums" style={{ color: '#64748b', fontWeight: 600 }}>
                          #{row.rowIndex}
                        </td>
                        <td>
                          {row.isValid ? (
                            <span className="clipboard-row-status" style={{ color: '#16a34a' }}>
                              <CheckCircle2 size={14} /> Valid
                            </span>
                          ) : (
                            <span
                              className="clipboard-row-status"
                              style={{ color: '#dc2626' }}
                              title={Object.values(row.errors).join(', ')}
                            >
                              <AlertCircle size={14} /> Error
                            </span>
                          )}
                        </td>
                        {Object.keys(columnMapping).map((colIdx) => {
                          const schemaKey = columnMapping[colIdx];
                          const cellVal = row.data[schemaKey];
                          const cellError = row.errors[schemaKey];
                          const colDef = columns.find((c) => c.key === schemaKey);
                          const isNum = colDef?.type === 'number' || colDef?.type === 'currency' || colDef?.type === 'meterage';

                          return (
                            <td
                              key={colIdx}
                              className={isNum ? 'tabular-nums' : ''}
                              style={{
                                color: cellError ? '#b91c1c' : '#1e293b',
                                backgroundColor: cellError ? '#fee2e2' : 'inherit'
                              }}
                              title={cellError || undefined}
                            >
                              {cellVal !== undefined && cellVal !== null && cellVal !== '' 
                                ? String(cellVal) 
                                : <span style={{ color: '#94a3b8' }}>—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="clipboard-modal-footer">
          <div className="clipboard-mode-toggle">
            <span>Import Mode:</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="importMode"
                value="append"
                checked={importMode === 'append'}
                onChange={() => setImportMode('append')}
              />
              <span>Append Rows</span>
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="importMode"
                value="replace"
                checked={importMode === 'replace'}
                onChange={() => setImportMode('replace')}
              />
              <span>Replace All</span>
            </label>
          </div>

          <div className="clipboard-footer-btns">
            <button type="button" className="clipboard-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="clipboard-btn primary"
              disabled={!parseResult || parseResult.validCount === 0}
              onClick={() => handleConfirmImport(true)}
            >
              <Upload size={15} />
              <span>Import {parseResult ? parseResult.validCount : 0} Rows</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
