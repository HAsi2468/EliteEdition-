import React, { useState, useEffect, useRef } from 'react';
import { X, QrCode, ClipboardList, Info, AlertTriangle } from 'lucide-react';

export default function StockOutForm({ items, parties, prefilledItem, onSubmit, onClose }) {
  const [skuCode, setSkuCode] = useState('');
  const [selectedParty, setSelectedParty] = useState('');
  const [customParty, setCustomParty] = useState('');
  const [useCustomParty, setUseCustomParty] = useState(false);
  const [qtyOut, setQtyOut] = useState(1);
  const [error, setError] = useState('');

  // Auto-filled info based on SKU Code
  const [matchedItem, setMatchedItem] = useState(null);

  const skuInputRef = useRef(null);

  // Auto-focus the SKU input field on mount for barcode scanners
  useEffect(() => {
    if (skuInputRef.current) {
      skuInputRef.current.focus();
    }
  }, []);

  // Prefill SKU if modal is opened from a row-level quick action
  useEffect(() => {
    if (prefilledItem) {
      setSkuCode(prefilledItem.skuCode || '');
      // Auto-set matching item details
      setMatchedItem(prefilledItem);
    }
  }, [prefilledItem]);

  // Look up item dynamically as the SKU is typed/scanned
  useEffect(() => {
    if (!skuCode.trim()) {
      setMatchedItem(null);
      return;
    }

    const found = items.find(
      (item) => (item.skuCode || '').toLowerCase().trim() === skuCode.toLowerCase().trim()
    );

    if (found) {
      setMatchedItem(found);
    } else {
      setMatchedItem(null);
    }
  }, [skuCode, items]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!skuCode.trim()) {
      setError('Please scan or enter a SKU Code.');
      return;
    }

    const partyValue = useCustomParty ? customParty.trim() : selectedParty.trim();
    if (!partyValue) {
      setError('Please select or specify a recipient party.');
      return;
    }

    const qtyVal = Number(qtyOut);
    if (isNaN(qtyVal) || qtyVal <= 0) {
      setError('Quantity out must be a positive number.');
      return;
    }

    // Validate available stock if item is found
    if (matchedItem) {
      const available = matchedItem.currentlyAvailableStock || 0;
      if (qtyVal > available) {
        setError(`Cannot outward ${qtyVal} units. Only ${available} units are available in stock.`);
        return;
      }
    } else {
      setError('Warning: The SKU code entered does not match any current inventory items. Outward cannot be processed.');
      return;
    }

    onSubmit({
      skuCode: skuCode.trim(),
      party: partyValue,
      qtyOut: qtyVal,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={styles.content}>
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ClipboardList size={20} color="var(--primary)" />
            <h3 style={styles.title}>Outward</h3>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={styles.errorBox}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.colFull}>
            <label style={styles.label}>Scan / Type SKU Code *</label>
            <div style={styles.scanInputWrapper}>
              <input
                ref={skuInputRef}
                type="text"
                value={skuCode}
                onChange={(e) => setSkuCode(e.target.value)}
                placeholder="Scan code or type SKU..."
                required
                disabled={!!prefilledItem}
                style={styles.skuInput}
              />
              <QrCode size={18} color="var(--primary)" style={styles.scanIcon} />
            </div>
          </div>

          {/* Dynamic Matched Item Card */}
          {matchedItem ? (
            <div style={styles.matchedCard}>
              <div style={styles.matchedDetails}>
                <div style={styles.matchedImgWrapper}>
                  {matchedItem.imageUrl ? (
                    <img src={matchedItem.imageUrl} alt={matchedItem.itemName} style={styles.matchedImg} />
                  ) : (
                    <div style={styles.matchedPlaceholder}>
                      {matchedItem.itemName ? matchedItem.itemName[0].toUpperCase() : 'E'}
                    </div>
                  )}
                </div>
                <div>
                  <div style={styles.matchedName}>{matchedItem.itemName}</div>
                  <div style={styles.matchedMeta}>
                    <span>Size: <strong>{matchedItem.size}</strong></span>
                    <span style={{ margin: '0 0.5rem' }}>|</span>
                    <span>Party: <strong>{matchedItem.party}</strong></span>
                  </div>
                </div>
              </div>
              <div style={styles.stockLevelBadge(matchedItem.currentlyAvailableStock)}>
                {matchedItem.currentlyAvailableStock} Available
              </div>
            </div>
          ) : skuCode.trim() ? (
            <div style={styles.noMatchCard}>
              <Info size={16} />
              <span>No matching item found in active stock.</span>
            </div>
          ) : null}

          {/* Party Recipient Selection */}
          <div style={styles.colFull}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
              <label style={styles.label}>Recipient Party *</label>
              <button
                type="button"
                onClick={() => setUseCustomParty(!useCustomParty)}
                style={styles.toggleBtn}
              >
                {useCustomParty ? 'Select Existing Party' : 'Enter Custom Party'}
              </button>
            </div>

            {useCustomParty ? (
              <input
                type="text"
                value={customParty}
                onChange={(e) => setCustomParty(e.target.value)}
                placeholder="Enter custom party name..."
                required
                style={{ width: '100%' }}
              />
            ) : (
              <select
                value={selectedParty}
                onChange={(e) => setSelectedParty(e.target.value)}
                required
                style={styles.selectInput}
              >
                <option value="">-- Select Recipient Party --</option>
                {parties.map((p, idx) => (
                  <option key={p.id || idx} value={p.name}>
                    {p.name} {p.phone ? `(${p.phone})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Quantity Outward */}
          <div style={styles.colFull}>
            <label style={styles.label}>Quantity to Outward *</label>
            <input
              type="number"
              value={qtyOut}
              onChange={(e) => setQtyOut(Math.max(1, parseInt(e.target.value) || ''))}
              min="1"
              required
              style={{ width: '100%' }}
            />
          </div>

          <div style={styles.footer}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              className="btn-success"
              style={styles.submitBtn}
              disabled={matchedItem && (matchedItem.currentlyAvailableStock || 0) < Number(qtyOut)}
            >
              Outward
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  content: {
    padding: '1.5rem',
    maxWidth: '460px',
    width: '95%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem',
  },
  title: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '0.25rem',
    display: 'flex',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.1rem',
  },
  colFull: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: '500',
    color: '#d1d5db',
    marginLeft: '2px',
  },
  scanInputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  skuInput: {
    width: '100%',
    paddingRight: '2.5rem',
  },
  scanIcon: {
    position: 'absolute',
    right: '0.75rem',
    opacity: 0.8,
  },
  selectInput: {
    width: '100%',
    padding: '0.65rem 0.75rem',
    background: 'rgba(17, 24, 39, 0.7)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    outline: 'none',
  },
  toggleBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--primary)',
    fontSize: '0.75rem',
    cursor: 'pointer',
    padding: 0,
    fontWeight: '600',
    textDecoration: 'underline',
  },
  matchedCard: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-light)',
    borderRadius: '8px',
    padding: '0.75rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
  },
  matchedDetails: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    overflow: 'hidden',
  },
  matchedImgWrapper: {
    width: '40px',
    height: '40px',
    borderRadius: '6px',
    overflow: 'hidden',
    flexShrink: 0,
    background: 'rgba(255,255,255,0.05)',
  },
  matchedImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  matchedPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--primary)',
    fontWeight: 'bold',
    background: 'rgba(6, 182, 212, 0.1)',
  },
  matchedName: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  matchedMeta: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  stockLevelBadge: (stock) => {
    const isLow = stock <= 5;
    const isOut = stock === 0;
    return {
      fontSize: '0.75rem',
      fontWeight: '700',
      padding: '0.2rem 0.5rem',
      borderRadius: '20px',
      whiteSpace: 'nowrap',
      color: isOut ? '#fca5a5' : isLow ? '#fcd34d' : '#86efac',
      background: isOut ? 'rgba(239,68,68,0.1)' : isLow ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
      border: `1px solid ${isOut ? 'rgba(239,68,68,0.2)' : isLow ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`,
    };
  },
  noMatchCard: {
    background: 'rgba(245, 158, 11, 0.05)',
    border: '1px solid rgba(245, 158, 11, 0.1)',
    borderRadius: '8px',
    padding: '0.65rem 0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#fcd34d',
    fontSize: '0.75rem',
  },
  errorBox: {
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    borderRadius: '6px',
    padding: '0.65rem 0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#fca5a5',
    fontSize: '0.8rem',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '0.75rem',
    paddingTop: '1rem',
    borderTop: '1px solid var(--border-light)',
  },
  submitBtn: {
    padding: '0.6rem 1.3rem',
  },
};
