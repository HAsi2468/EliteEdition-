import React, { useState } from 'react';
import { Columns, Rows, X, AlertTriangle, Check, Copy } from 'lucide-react';
import './EntityCompareDock.css';

/**
 * EntityCompareDock
 * 
 * Side-by-Side Compare Overlay:
 * - Floating side-by-side comparison modal that stacks 2–3 records vertically or horizontally.
 * - Visually highlights data discrepancies between columns with high-contrast pills.
 */
export function EntityCompareDock({
  records = [], // [{ id: '1', title: 'Challan #101', data: { meters: 120, fabric: 'Silk', price: 45 } }, ...]
  fieldDefinitions = [ // [{ key: 'meters', label: 'Metres' }, ...]
    { key: 'meters', label: 'Meters' },
    { key: 'fabric', label: 'Fabric' },
    { key: 'price', label: 'Unit Price' },
    { key: 'status', label: 'Status' },
    { key: 'party', label: 'Party / Customer' }
  ],
  isOpen = false,
  onClose,
  title = 'Entity Discrepancy Compare Dock'
}) {
  const [layoutMode, setLayoutMode] = useState('horizontal'); // 'horizontal' or 'vertical'
  const [copied, setCopied] = useState(false);

  if (!isOpen || !records || records.length === 0) return null;

  // Identify mismatched keys
  const mismatchedKeys = new Set();
  fieldDefinitions.forEach(field => {
    const firstVal = records[0]?.data?.[field.key];
    const isDifferent = records.some(r => {
      const v = r.data?.[field.key];
      return String(v || '').trim() !== String(firstVal || '').trim();
    });
    if (isDifferent) mismatchedKeys.add(field.key);
  });

  const handleCopySummary = async () => {
    const lines = [`=== ${title} ===`];
    fieldDefinitions.forEach(f => {
      const isMismatch = mismatchedKeys.has(f.key);
      const vals = records.map(r => `${r.title}: ${r.data?.[f.key] ?? 'N/A'}`).join(' | ');
      lines.push(`${f.label}${isMismatch ? ' [MISMATCH]' : ''}: ${vals}`);
    });

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Copy failed', e);
    }
  };

  return (
    <div className="entity-compare-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="entity-compare-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="entity-compare-header">
          <div className="entity-compare-title">
            <AlertTriangle size={18} style={{ color: mismatchedKeys.size > 0 ? '#f59e0b' : '#10b981' }} />
            <span>{title}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              ({records.length} records • {mismatchedKeys.size} differences)
            </span>
          </div>

          <div className="entity-compare-controls">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setLayoutMode(m => m === 'horizontal' ? 'vertical' : 'horizontal')}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              {layoutMode === 'horizontal' ? <Rows size={13} /> : <Columns size={13} />}
              <span>{layoutMode === 'horizontal' ? 'Stack Vertically' : 'Columns Grid'}</span>
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleCopySummary}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              {copied ? <Check size={13} style={{ color: '#10b981' }} /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy Differences'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Comparison Grid */}
        <div className="entity-compare-body">
          <div
            className="entity-compare-grid"
            style={{
              gridTemplateColumns: layoutMode === 'horizontal'
                ? `repeat(${Math.min(records.length, 3)}, 1fr)`
                : '1fr'
            }}
          >
            {records.map((rec) => (
              <div key={rec.id} className="entity-compare-card">
                <div className="entity-compare-card-title">
                  <span>{rec.title}</span>
                  {rec.badge && (
                    <span style={{ fontSize: '0.65rem', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', padding: '0.15rem 0.4rem', borderRadius: 4 }}>
                      {rec.badge}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {fieldDefinitions.map(f => {
                    const isMismatch = mismatchedKeys.has(f.key);
                    const val = rec.data?.[f.key] ?? '—';

                    return (
                      <div
                        key={f.key}
                        className={`compare-field-row ${isMismatch ? 'is-mismatched' : ''}`}
                      >
                        <span className="compare-field-label">{f.label}:</span>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span className="compare-field-val">{String(val)}</span>
                          {isMismatch && (
                            <span className="compare-discrepancy-pill">Diff</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EntityCompareDock;
