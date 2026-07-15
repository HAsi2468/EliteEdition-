import React, { useState, useEffect } from 'react';
import { X, Upload, Clipboard, Trash2, CheckCircle, Sparkles, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

export default function BulkInwardModal({ onSubmit, onClose }) {
  const [activeInputTab, setActiveInputTab] = useState('paste'); // 'paste' or 'upload'
  const [pasteText, setPasteText] = useState('');
  const [parsedItems, setParsedItems] = useState([]);
  const [error, setError] = useState('');
  
  // Lists for auto-matching and suggestions
  const [vendorsList, setVendorsList] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [storeInventory, setStoreInventory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Bulk quick-set values
  const [bulkVendor, setBulkVendor] = useState('');
  const [bulkPurchasePrice, setBulkPurchasePrice] = useState('');
  const [bulkSalePrice, setBulkSalePrice] = useState('');

  // Fetch reference lists for auto-matching
  useEffect(() => {
    const loadRefData = async () => {
      try {
        setIsLoading(true);
        const [vData, cData, invData] = await Promise.all([
          api.getVendors().catch(() => []),
          api.getProductsCatalog().catch(() => []),
          api.getInventory().catch(() => []),
        ]);
        setVendorsList(vData || []);
        setCatalogItems(cData || []);
        setStoreInventory(invData || []);
      } catch (err) {
        console.warn('Failed to load auto-complete suggestions:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadRefData();
  }, []);

  // Parse pasted text or file contents
  const processInputLines = (text) => {
    if (!text.trim()) {
      setError('Please enter some data to parse.');
      return;
    }
    
    // Split by newlines
    const lines = text.split(/\r?\n/);
    const tempItems = [];
    let lineErrorCount = 0;

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Split by tab (Excel) or comma (CSV)
      const parts = trimmed.includes('\t') ? trimmed.split('\t') : trimmed.split(',');
      const skuRaw = parts[0] ? parts[0].trim() : '';
      const qtyRaw = parts[1] ? parts[1].trim() : '';

      if (!skuRaw) return;

      const qty = parseInt(qtyRaw, 10);
      if (isNaN(qty) || qty <= 0) {
        lineErrorCount++;
        return; // skip invalid quantities
      }

      // Check if SKU already parsed to aggregate/merge quantities in import preview
      const existingIdx = tempItems.findIndex(i => i.skuCode.toLowerCase() === skuRaw.toLowerCase());
      if (existingIdx !== -1) {
        tempItems[existingIdx].qty += qty;
        return;
      }

      // Match details against existing inventory & catalog
      const matchedInventory = storeInventory.find(item => item.skuCode && item.skuCode.trim().toLowerCase() === skuRaw.toLowerCase());
      const matchedCatalog = catalogItems.find(item => item.skuCode && item.skuCode.trim().toLowerCase() === skuRaw.toLowerCase());

      let status = 'NEW';
      let itemName = skuRaw;
      let size = skuRaw.includes('_') ? skuRaw.split('_')[1] : 'N/A';
      let purchasePrice = parts[2] ? parseFloat(parts[2]) : 0;
      let salePrice = parts[3] ? parseFloat(parts[3]) : 0;
      let party = parts[4] ? parts[4].trim() : '';
      let imageUrl = '';

      if (matchedInventory) {
        status = 'UPDATE';
        itemName = matchedInventory.itemName || itemName;
        size = matchedInventory.size || size;
        purchasePrice = purchasePrice || matchedInventory.purchasePrice || 0;
        salePrice = salePrice || matchedInventory.salePrice || 0;
        party = party || matchedInventory.party || '';
        imageUrl = matchedInventory.imageUrl || '';
      } else if (matchedCatalog) {
        status = 'CATALOG_MATCH';
        itemName = matchedCatalog.description || itemName;
        size = Array.isArray(matchedCatalog.size) ? matchedCatalog.size[0] || 'N/A' : (matchedCatalog.size || size);
        purchasePrice = purchasePrice || matchedCatalog.basePrice || 0;
        salePrice = salePrice || matchedCatalog.price || 0;
        party = party || matchedCatalog.brand || '';
        imageUrl = matchedCatalog.imageUrl || '';
      }

      tempItems.push({
        skuCode: skuRaw,
        qty,
        purchasePrice: purchasePrice || 0,
        salePrice: salePrice || 0,
        party: party || 'Bulk Inward',
        itemName,
        size,
        imageUrl,
        status
      });
    });

    if (tempItems.length === 0) {
      setError('No valid rows could be parsed. Make sure to use: SKU, Quantity format.');
      return;
    }

    if (lineErrorCount > 0) {
      setError(`Parsed ${tempItems.length} rows. Ignored ${lineErrorCount} rows with invalid/missing quantities.`);
    } else {
      setError('');
    }

    setParsedItems(tempItems);
  };

  // CSV File Handler
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvText = event.target.result;
      processInputLines(csvText);
    };
    reader.readAsText(file);
  };

  // Quick set all parsed items
  const applyQuickSettings = () => {
    setParsedItems(prev => prev.map(item => ({
      ...item,
      party: bulkVendor ? bulkVendor.trim() : item.party,
      purchasePrice: bulkPurchasePrice ? parseFloat(bulkPurchasePrice) : item.purchasePrice,
      salePrice: bulkSalePrice ? parseFloat(bulkSalePrice) : item.salePrice
    })));
  };

  // Handle individual preview field edit
  const handleItemEdit = (index, field, value) => {
    const updated = [...parsedItems];
    if (field === 'qty') {
      updated[index][field] = parseInt(value, 10) || 0;
    } else if (field === 'purchasePrice' || field === 'salePrice') {
      updated[index][field] = parseFloat(value) || 0.0;
    } else {
      updated[index][field] = value;
    }
    setParsedItems(updated);
  };

  // Remove individual row from import
  const handleRemoveItem = (index) => {
    setParsedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleBulkSubmit = (e) => {
    e.preventDefault();
    if (parsedItems.length === 0) {
      setError('Please import or paste items to inward first.');
      return;
    }

    // Validation
    const invalidItems = parsedItems.filter(item => !item.skuCode.trim() || item.qty <= 0 || !item.party.trim());
    if (invalidItems.length > 0) {
      setError(`Please resolve invalid rows. SKU code, positive quantity, and Vendor are required.`);
      return;
    }

    onSubmit(parsedItems);
  };

  const totalInwardUnits = parsedItems.reduce((acc, curr) => acc + (curr.qty || 0), 0);

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={styles.modalContent}>
        
        {/* Header */}
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} color="var(--primary)" />
            <h3 style={styles.title}>Bulk Order Inward</h3>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={styles.errorBanner}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Import Area */}
        {parsedItems.length === 0 ? (
          <div style={styles.importContainer}>
            <div style={styles.tabBar}>
              <button
                type="button"
                onClick={() => { setActiveInputTab('paste'); setError(''); }}
                style={{ ...styles.tab, ...(activeInputTab === 'paste' ? styles.tabActive : {}) }}
              >
                <Clipboard size={14} /> Paste CSV / Excel Data
              </button>
              <button
                type="button"
                onClick={() => { setActiveInputTab('upload'); setError(''); }}
                style={{ ...styles.tab, ...(activeInputTab === 'upload' ? styles.tabActive : {}) }}
              >
                <Upload size={14} /> Upload CSV File
              </button>
            </div>

            {activeInputTab === 'paste' ? (
              <div style={styles.tabContent}>
                <p style={styles.instructions}>
                  Copy columns from Excel/Google Sheets (SKU Code, Quantity, Purchase Price, Sale Price, Vendor) and paste them below:
                </p>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Example format:&#10;SKU-A, 10&#10;SKU-B, 25, 250, 499, Royal Brands&#10;SKU-C_M, 5, 120, 299"
                  style={styles.textarea}
                  rows={8}
                />
                <button
                  type="button"
                  onClick={() => processInputLines(pasteText)}
                  className="btn-primary"
                  style={{ marginTop: '0.75rem', alignSelf: 'flex-start' }}
                  disabled={isLoading}
                >
                  Parse & Preview Data
                </button>
              </div>
            ) : (
              <div style={styles.tabContent}>
                <div style={styles.uploadBox}>
                  <Upload size={32} color="var(--primary)" style={{ marginBottom: '0.75rem' }} />
                  <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Select a CSV file containing SKU Code and Quantity</p>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Format: SKU, Quantity, PurchasePrice, SalePrice, Vendor</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    style={styles.fileInput}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Preview and Edit Section */
          <div style={styles.previewContainer}>
            
            {/* Quick Set Row */}
            <div style={styles.quickSetPanel}>
              <h5 style={{ margin: 0, color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600 }}>⚡ Quick Set All Items</h5>
              <div style={styles.quickSetRow}>
                <input
                  type="text"
                  placeholder="Set Vendor..."
                  value={bulkVendor}
                  onChange={(e) => setBulkVendor(e.target.value)}
                  list="bulk-vendors"
                  style={styles.quickInput}
                />
                <datalist id="bulk-vendors">
                  {vendorsList.map((v, i) => (
                    <option key={i} value={v.name} />
                  ))}
                </datalist>

                <input
                  type="number"
                  placeholder="Set Buy Price..."
                  value={bulkPurchasePrice}
                  onChange={(e) => setBulkPurchasePrice(e.target.value)}
                  style={styles.quickInput}
                  min="0"
                  step="0.01"
                />

                <input
                  type="number"
                  placeholder="Set Sell Price..."
                  value={bulkSalePrice}
                  onChange={(e) => setBulkSalePrice(e.target.value)}
                  style={styles.quickInput}
                  min="0"
                  step="0.01"
                />

                <button
                  type="button"
                  onClick={applyQuickSettings}
                  className="btn-secondary"
                  style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                >
                  Apply Settings
                </button>
              </div>
            </div>

            {/* Preview Table */}
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: '15%' }}>SKU Code</th>
                    <th style={{ width: '20%' }}>Item Details</th>
                    <th style={{ width: '10%' }}>Size</th>
                    <th style={{ width: '10%' }}>Qty</th>
                    <th style={{ width: '12%' }}>Buy Price</th>
                    <th style={{ width: '12%' }}>Sell Price</th>
                    <th style={{ width: '15%' }}>Vendor</th>
                    <th style={{ width: '6%' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedItems.map((item, idx) => (
                    <tr key={idx} style={styles.tr}>
                      <td>
                        <span style={styles.skuBadge} title={item.status}>
                          {item.skuCode}
                        </span>
                        <div style={{ fontSize: '0.65rem', marginTop: '2px', color: item.status === 'UPDATE' ? '#34d399' : item.status === 'CATALOG_MATCH' ? '#60a5fa' : '#fbbf24' }}>
                          {item.status === 'UPDATE' ? '● Existing SKU' : item.status === 'CATALOG_MATCH' ? '● Synced Catalog' : '● New SKU'}
                        </div>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={item.itemName}
                          onChange={(e) => handleItemEdit(idx, 'itemName', e.target.value)}
                          style={styles.cellInput}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={item.size}
                          onChange={(e) => handleItemEdit(idx, 'size', e.target.value)}
                          style={{ ...styles.cellInput, textAlign: 'center' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) => handleItemEdit(idx, 'qty', e.target.value)}
                          style={{ ...styles.cellInput, textAlign: 'center' }}
                          min="1"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={item.purchasePrice}
                          onChange={(e) => handleItemEdit(idx, 'purchasePrice', e.target.value)}
                          style={styles.cellInput}
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={item.salePrice}
                          onChange={(e) => handleItemEdit(idx, 'salePrice', e.target.value)}
                          style={styles.cellInput}
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={item.party}
                          onChange={(e) => handleItemEdit(idx, 'party', e.target.value)}
                          list="modal-vendors"
                          style={styles.cellInput}
                        />
                        <datalist id="modal-vendors">
                          {vendorsList.map((v, i) => (
                            <option key={i} value={v.name} />
                          ))}
                        </datalist>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          style={styles.deleteRowBtn}
                          title="Exclude Item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Back Button to Reset Import */}
            <button
              type="button"
              onClick={() => { setParsedItems([]); setError(''); }}
              style={styles.resetBtn}
            >
              ← Back to Paste / Upload
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={styles.footer}>
          <div style={styles.statsSummary}>
            {parsedItems.length > 0 && (
              <>
                <CheckCircle size={15} color="#34d399" />
                <span style={{ fontSize: '0.8rem', color: '#e5e7eb' }}>
                  Ready to Inward: <strong>{parsedItems.length} SKUs</strong> ({totalInwardUnits} total units)
                </span>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            {parsedItems.length > 0 && (
              <button onClick={handleBulkSubmit} className="btn-success" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Sparkles size={14} /> Confirm Inward
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

const styles = {
  modalContent: {
    padding: '1.5rem',
    maxWidth: '960px',
    width: '95vw',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '85vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
    borderBottom: '1px solid var(--border-light)',
    paddingBottom: '0.75rem',
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '0.25rem',
    display: 'flex',
  },
  errorBanner: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#fca5a5',
    borderRadius: 'var(--radius-sm)',
    padding: '0.6rem 0.8rem',
    fontSize: '0.8rem',
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  importContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    flex: 1,
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid var(--border-light)',
    gap: '0.5rem',
  },
  tab: {
    padding: '0.6rem 1.2rem',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  tabActive: {
    borderBottom: '2px solid var(--primary)',
    color: 'var(--primary)',
    background: 'rgba(6, 182, 212, 0.05)',
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column',
    padding: '0.5rem 0',
  },
  instructions: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    marginBottom: '0.5rem',
  },
  textarea: {
    width: '100%',
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    padding: '0.75rem',
    background: 'rgba(17, 24, 39, 0.4)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-sm)',
    color: '#f3f4f6',
    resize: 'vertical',
  },
  uploadBox: {
    border: '2px dashed var(--border-light)',
    borderRadius: 'var(--radius-md)',
    padding: '2.5rem 1.5rem',
    textAlign: 'center',
    background: 'rgba(255, 255, 255, 0.01)',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInput: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer',
  },
  previewContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    flex: 1,
    overflow: 'hidden',
  },
  quickSetPanel: {
    background: 'rgba(6, 182, 212, 0.04)',
    border: '1px solid rgba(6, 182, 212, 0.1)',
    borderRadius: 'var(--radius-md)',
    padding: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  quickSetRow: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  quickInput: {
    padding: '0.4rem 0.6rem',
    fontSize: '0.8rem',
    minWidth: '120px',
    flex: 1,
  },
  tableWrapper: {
    overflowY: 'auto',
    maxHeight: '40vh',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-sm)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.8rem',
  },
  tr: {
    borderBottom: '1px solid var(--border-light)',
  },
  cellInput: {
    width: '100%',
    border: 'none',
    background: 'transparent',
    padding: '0.4rem 0.2rem',
    fontSize: '0.8rem',
    color: '#f3f4f6',
    outline: 'none',
  },
  skuBadge: {
    fontFamily: 'monospace',
    background: 'rgba(6, 182, 212, 0.08)',
    border: '1px solid rgba(6, 182, 212, 0.15)',
    padding: '0.1rem 0.35rem',
    borderRadius: '4px',
    color: 'var(--primary)',
    fontWeight: 'bold',
  },
  deleteRowBtn: {
    background: 'none',
    border: 'none',
    color: '#fca5a5',
    cursor: 'pointer',
    padding: '0.25rem',
    borderRadius: '4px',
    display: 'inline-flex',
  },
  resetBtn: {
    alignSelf: 'flex-start',
    background: 'none',
    border: 'none',
    color: 'var(--primary)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 500,
    padding: '0.25rem 0',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '1.25rem',
    borderTop: '1px solid var(--border-light)',
    paddingTop: '1rem',
  },
  statsSummary: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
};
