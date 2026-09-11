import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, CheckCircle, Sparkles, AlertCircle, Scan, FileSpreadsheet, Layers } from 'lucide-react';
import { api } from '../services/api';
import { extractSizeFromSku } from '../utils/skuHelper';

export default function BulkInwardModal({ onSubmit, onClose }) {
  const [activeTab, setActiveTab] = useState('form'); // 'form' or 'csv'
  const [error, setError] = useState('');
  
  // Master Reference Lists
  const [vendorsList, setVendorsList] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [storeInventory, setStoreInventory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Quick Set Header Controls
  const [bulkVendor, setBulkVendor] = useState('');
  const [bulkPurchasePrice, setBulkPurchasePrice] = useState('');
  const [bulkSalePrice, setBulkSalePrice] = useState('');

  // Barcode / SKU Scanner Input
  const [scanSkuInput, setScanSkuInput] = useState('');

  // CSV / Paste Tab State
  const [pasteText, setPasteText] = useState('');

  // Multi-Row Form Data State (Default 3 rows)
  const createEmptyRow = (vendorName = '') => ({
    skuCode: '',
    itemName: '',
    size: '',
    qty: 1,
    purchasePrice: 0,
    salePrice: 0,
    party: vendorName || '',
    imageUrl: '',
    status: 'NEW'
  });

  const [formRows, setFormRows] = useState([
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow()
  ]);

  // Fetch reference lists for autocompletion
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

  // Resolve Vendor Name to Business Name
  const resolveVendorName = (val) => {
    if (!val) return '';
    const match = vendorsList.find(v => 
      (v.name && v.name.trim().toLowerCase() === val.trim().toLowerCase()) ||
      (v.businessName && v.businessName.trim().toLowerCase() === val.trim().toLowerCase())
    );
    return match && match.businessName ? match.businessName : val;
  };

  // Add a new empty row
  const handleAddRow = () => {
    const defaultVendor = resolveVendorName(bulkVendor) || (formRows[0]?.party || '');
    const defaultBuy = bulkPurchasePrice ? parseFloat(bulkPurchasePrice) : 0;
    const defaultSell = bulkSalePrice ? parseFloat(bulkSalePrice) : 0;

    setFormRows(prev => [
      ...prev,
      {
        ...createEmptyRow(defaultVendor),
        purchasePrice: defaultBuy,
        salePrice: defaultSell,
      }
    ]);
  };

  // Remove a row
  const handleRemoveRow = (index) => {
    setFormRows(prev => prev.filter((_, i) => i !== index));
  };

  // SKU Autocomplete Handler for a Row
  const handleSkuChange = (index, value) => {
    const skuRaw = value.trim();
    const updated = [...formRows];
    updated[index].skuCode = value;

    if (!skuRaw) {
      setFormRows(updated);
      return;
    }

    const matchedInventory = storeInventory.find(item => item.skuCode && item.skuCode.trim().toLowerCase() === skuRaw.toLowerCase());
    const matchedCatalog = catalogItems.find(item => item.skuCode && item.skuCode.trim().toLowerCase() === skuRaw.toLowerCase());

    if (matchedInventory) {
      updated[index].itemName = matchedInventory.itemName || updated[index].itemName || skuRaw;
      updated[index].size = matchedInventory.size || updated[index].size || extractSizeFromSku(skuRaw) || 'N/A';
      updated[index].purchasePrice = updated[index].purchasePrice || matchedInventory.purchasePrice || 0;
      updated[index].salePrice = updated[index].salePrice || matchedInventory.salePrice || 0;
      updated[index].party = updated[index].party || resolveVendorName(matchedInventory.party) || '';
      updated[index].imageUrl = matchedInventory.imageUrl || '';
      updated[index].status = 'UPDATE';
    } else if (matchedCatalog) {
      updated[index].itemName = matchedCatalog.description || updated[index].itemName || skuRaw;
      updated[index].size = Array.isArray(matchedCatalog.size) ? matchedCatalog.size[0] || 'N/A' : (matchedCatalog.size || extractSizeFromSku(skuRaw) || 'N/A');
      updated[index].purchasePrice = updated[index].purchasePrice || matchedCatalog.basePrice || 0;
      updated[index].salePrice = updated[index].salePrice || matchedCatalog.price || 0;
      updated[index].party = updated[index].party || resolveVendorName(matchedCatalog.brand) || '';
      updated[index].imageUrl = matchedCatalog.imageUrl || '';
      updated[index].status = 'CATALOG_MATCH';
    } else {
      if (!updated[index].size) updated[index].size = extractSizeFromSku(skuRaw) || 'N/A';
      if (!updated[index].itemName) updated[index].itemName = skuRaw;
      updated[index].status = 'NEW';
    }

    setFormRows(updated);
  };

  // Field Edit Handler for a Row
  const handleRowFieldChange = (index, field, value) => {
    const updated = [...formRows];
    if (field === 'qty') {
      updated[index][field] = parseInt(value, 10) || 0;
    } else if (field === 'purchasePrice' || field === 'salePrice') {
      updated[index][field] = parseFloat(value) || 0.0;
    } else if (field === 'party') {
      updated[index][field] = resolveVendorName(value);
    } else {
      updated[index][field] = value;
    }
    setFormRows(updated);
  };

  // Barcode / SKU Scan Handler
  const handleScanSubmit = (e) => {
    e.preventDefault();
    const skuRaw = scanSkuInput.trim();
    if (!skuRaw) return;

    // Check if SKU already exists in form rows -> increment quantity
    const existingIndex = formRows.findIndex(r => r.skuCode.toLowerCase() === skuRaw.toLowerCase());
    if (existingIndex !== -1) {
      const updated = [...formRows];
      updated[existingIndex].qty += 1;
      setFormRows(updated);
    } else {
      // Create new row with scanned SKU
      const matchedInventory = storeInventory.find(item => item.skuCode && item.skuCode.trim().toLowerCase() === skuRaw.toLowerCase());
      const matchedCatalog = catalogItems.find(item => item.skuCode && item.skuCode.trim().toLowerCase() === skuRaw.toLowerCase());

      let itemName = skuRaw;
      let size = extractSizeFromSku(skuRaw) || 'N/A';
      let purchasePrice = bulkPurchasePrice ? parseFloat(bulkPurchasePrice) : 0;
      let salePrice = bulkSalePrice ? parseFloat(bulkSalePrice) : 0;
      let party = resolveVendorName(bulkVendor) || (formRows[0]?.party || '');
      let status = 'NEW';

      if (matchedInventory) {
        itemName = matchedInventory.itemName || itemName;
        size = matchedInventory.size || size;
        purchasePrice = purchasePrice || matchedInventory.purchasePrice || 0;
        salePrice = salePrice || matchedInventory.salePrice || 0;
        party = party || resolveVendorName(matchedInventory.party) || '';
        status = 'UPDATE';
      } else if (matchedCatalog) {
        itemName = matchedCatalog.description || itemName;
        size = Array.isArray(matchedCatalog.size) ? matchedCatalog.size[0] || 'N/A' : (matchedCatalog.size || size);
        purchasePrice = purchasePrice || matchedCatalog.basePrice || 0;
        salePrice = salePrice || matchedCatalog.price || 0;
        party = party || resolveVendorName(matchedCatalog.brand) || '';
        status = 'CATALOG_MATCH';
      }

      setFormRows(prev => [
        ...prev.filter(r => r.skuCode.trim() !== ''),
        {
          skuCode: skuRaw,
          itemName,
          size,
          qty: 1,
          purchasePrice,
          salePrice,
          party,
          imageUrl: '',
          status
        }
      ]);
    }

    setScanSkuInput('');
  };

  // Quick Apply Settings to all rows
  const applyQuickSettings = () => {
    const resolvedVendor = resolveVendorName(bulkVendor);
    setFormRows(prev => prev.map(item => ({
      ...item,
      party: resolvedVendor || item.party,
      purchasePrice: bulkPurchasePrice ? parseFloat(bulkPurchasePrice) : item.purchasePrice,
      salePrice: bulkSalePrice ? parseFloat(bulkSalePrice) : item.salePrice
    })));
  };

  // Parse CSV/Pasted text fallback
  const processCsvText = (text) => {
    if (!text.trim()) return;
    const lines = text.split(/\r?\n/);
    const parsed = [];
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const parts = trimmed.includes('\t') ? trimmed.split('\t') : trimmed.split(',');
      const skuRaw = parts[0] ? parts[0].trim() : '';
      const qty = parts[1] ? parseInt(parts[1].trim(), 10) : 1;
      if (skuRaw && !isNaN(qty) && qty > 0) {
        parsed.push({
          skuCode: skuRaw,
          itemName: skuRaw,
          size: extractSizeFromSku(skuRaw) || 'N/A',
          qty,
          purchasePrice: parts[2] ? parseFloat(parts[2]) : 0,
          salePrice: parts[3] ? parseFloat(parts[3]) : 0,
          party: parts[4] ? resolveVendorName(parts[4].trim()) : resolveVendorName(bulkVendor),
          status: 'NEW'
        });
      }
    });

    if (parsed.length > 0) {
      setFormRows(parsed);
      setActiveTab('form');
      setError('');
    } else {
      setError('Could not parse valid SKU & Quantity from CSV.');
    }
  };

  // Submit Handler
  const handleFinalSubmit = (e) => {
    e.preventDefault();
    setError('');

    // Filter valid rows (non-empty SKU and qty > 0)
    const validRows = formRows.filter(r => r.skuCode && r.skuCode.trim() && r.qty > 0);

    if (validRows.length === 0) {
      setError('Please add at least one valid item row with a SKU Code and Quantity.');
      return;
    }

    // Ensure Vendor is set for all valid rows
    const missingVendorRows = validRows.filter(r => !r.party || !r.party.trim());
    if (missingVendorRows.length > 0) {
      setError('Please select or specify Vendor / Business Name for all item rows.');
      return;
    }

    onSubmit(validRows);
  };

  const totalInwardUnits = formRows.reduce((acc, curr) => acc + (curr.skuCode ? (curr.qty || 0) : 0), 0);
  const activeRowsCount = formRows.filter(r => r.skuCode && r.skuCode.trim()).length;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={styles.modalContent}>
        
        {/* Header */}
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ padding: '0.5rem', background: 'rgba(16,185,129,0.1)', borderRadius: '8px' }}>
              <Sparkles size={20} color="#10b981" />
            </div>
            <div>
              <h3 style={styles.title}>Multi-Item Inward Entry Form</h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Enter multiple SKUs, quantities, and vendor details in one easy interactive form.</p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={styles.errorBanner}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Top Control Bar: Tabs + Scanner + Quick Set */}
        <div style={styles.topControlBar}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setActiveTab('form')}
              style={{ ...styles.tabBtn, ...(activeTab === 'form' ? styles.tabBtnActive : {}) }}
            >
              <Layers size={14} /> Multi-Row Form
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('csv')}
              style={{ ...styles.tabBtn, ...(activeTab === 'csv' ? styles.tabBtnActive : {}) }}
            >
              <FileSpreadsheet size={14} /> CSV / Paste Import
            </button>
          </div>

          {/* Quick Scanner Box */}
          {activeTab === 'form' && (
            <form onSubmit={handleScanSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, maxWidth: '340px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Scan size={14} color="var(--primary)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={scanSkuInput}
                  onChange={e => setScanSkuInput(e.target.value)}
                  placeholder="Scan SKU barcode to add row..."
                  style={{ ...styles.quickInput, paddingLeft: '2rem', width: '100%', borderColor: 'rgba(6, 182, 212, 0.3)' }}
                />
              </div>
              <button type="submit" className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>+ Scan</button>
            </form>
          )}
        </div>

        {/* MAIN FORM VIEW */}
        {activeTab === 'form' ? (
          <div style={styles.formContainer}>
            
            {/* Quick Set Header Bar */}
            <div style={styles.quickSetPanel}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>⚡ Quick Set All:</span>
              <div style={{ display: 'flex', gap: '0.5rem', flex: 1, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Set Vendor / Company Name..."
                  value={bulkVendor}
                  onChange={(e) => setBulkVendor(e.target.value)}
                  list="bulk-vendors-list"
                  style={styles.quickInput}
                />
                <datalist id="bulk-vendors-list">
                  {vendorsList.map((v, i) => (
                    <option key={i} value={v.businessName || v.name}>
                      {v.businessName ? `${v.businessName} (Contact: ${v.name})` : v.name}
                    </option>
                  ))}
                </datalist>

                <input
                  type="number"
                  placeholder="Set Buy Price..."
                  value={bulkPurchasePrice}
                  onChange={(e) => setBulkPurchasePrice(e.target.value)}
                  style={{ ...styles.quickInput, maxWidth: '120px' }}
                  min="0"
                  step="0.01"
                />

                <input
                  type="number"
                  placeholder="Set Sell Price..."
                  value={bulkSalePrice}
                  onChange={(e) => setBulkSalePrice(e.target.value)}
                  style={{ ...styles.quickInput, maxWidth: '120px' }}
                  min="0"
                  step="0.01"
                />

                <button
                  type="button"
                  onClick={applyQuickSettings}
                  className="btn-secondary"
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem', fontWeight: 600 }}
                >
                  Apply to All Rows
                </button>
              </div>
            </div>

            {/* Dynamic Form Table */}
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={{ background: '#1e293b', color: '#ffffff' }}>
                    <th style={{ width: '22%', padding: '0.65rem 0.5rem' }}>SKU CODE *</th>
                    <th style={{ width: '22%', padding: '0.65rem 0.5rem' }}>ITEM NAME / DETAILS</th>
                    <th style={{ width: '10%', padding: '0.65rem 0.5rem', textAlign: 'center' }}>SIZE</th>
                    <th style={{ width: '10%', padding: '0.65rem 0.5rem', textAlign: 'center' }}>QTY *</th>
                    <th style={{ width: '12%', padding: '0.65rem 0.5rem', textAlign: 'right' }}>BUY PRICE</th>
                    <th style={{ width: '12%', padding: '0.65rem 0.5rem', textAlign: 'right' }}>SELL PRICE</th>
                    <th style={{ width: '18%', padding: '0.65rem 0.5rem' }}>VENDOR / COMPANY *</th>
                    <th style={{ width: '4%', padding: '0.65rem 0.5rem', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {formRows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                      
                      {/* SKU Code Input with Autocomplete */}
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <input
                          type="text"
                          value={row.skuCode}
                          onChange={(e) => handleSkuChange(idx, e.target.value)}
                          list="master-catalog-skus"
                          placeholder="Select/type SKU..."
                          style={styles.cellInput}
                          required
                        />
                      </td>

                      {/* Item Name */}
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <input
                          type="text"
                          value={row.itemName}
                          onChange={(e) => handleRowFieldChange(idx, 'itemName', e.target.value)}
                          placeholder="Item Description..."
                          style={styles.cellInput}
                        />
                      </td>

                      {/* Size */}
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <input
                          type="text"
                          value={row.size}
                          onChange={(e) => handleRowFieldChange(idx, 'size', e.target.value)}
                          placeholder="M, L..."
                          style={{ ...styles.cellInput, textAlign: 'center' }}
                        />
                      </td>

                      {/* Quantity */}
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <input
                          type="number"
                          value={row.qty}
                          onChange={(e) => handleRowFieldChange(idx, 'qty', e.target.value)}
                          min="1"
                          style={{ ...styles.cellInput, textAlign: 'center', fontWeight: 'bold', color: 'var(--primary)' }}
                          required
                        />
                      </td>

                      {/* Buy Price */}
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <input
                          type="number"
                          value={row.purchasePrice}
                          onChange={(e) => handleRowFieldChange(idx, 'purchasePrice', e.target.value)}
                          step="0.01"
                          min="0"
                          style={{ ...styles.cellInput, textAlign: 'right' }}
                        />
                      </td>

                      {/* Sell Price */}
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <input
                          type="number"
                          value={row.salePrice}
                          onChange={(e) => handleRowFieldChange(idx, 'salePrice', e.target.value)}
                          step="0.01"
                          min="0"
                          style={{ ...styles.cellInput, textAlign: 'right' }}
                        />
                      </td>

                      {/* Vendor Business Name */}
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <input
                          type="text"
                          value={row.party}
                          onChange={(e) => handleRowFieldChange(idx, 'party', e.target.value)}
                          list="master-vendors-list"
                          placeholder="Select Vendor..."
                          style={styles.cellInput}
                          required
                        />
                      </td>

                      {/* Delete Row Button */}
                      <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                        {formRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            style={styles.deleteRowBtn}
                            title="Remove Row"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Datalists for autocompletion */}
            <datalist id="master-catalog-skus">
              {catalogItems.map((c, i) => (
                <option key={i} value={c.skuCode}>
                  {c.description ? `${c.description} (${c.brand || 'Uniware'})` : c.skuCode}
                </option>
              ))}
              {storeInventory.map((inv, i) => (
                <option key={`inv-${i}`} value={inv.skuCode}>
                  {inv.itemName ? `${inv.itemName} (In Stock)` : inv.skuCode}
                </option>
              ))}
            </datalist>

            <datalist id="master-vendors-list">
              {vendorsList.map((v, i) => (
                <option key={i} value={v.businessName || v.name}>
                  {v.businessName ? `${v.businessName} (Contact: ${v.name})` : v.name}
                </option>
              ))}
            </datalist>

            {/* Add Row Action Button */}
            <button
              type="button"
              onClick={handleAddRow}
              style={styles.addRowBtn}
            >
              <Plus size={16} />
              <span>+ Add Another Item Row</span>
            </button>

          </div>
        ) : (
          /* OPTIONAL SECONDARY TAB: CSV / Paste Import */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, paddingTop: '0.5rem' }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Optional: Copy columns from Excel (SKU, Qty, Buy Price, Sell Price, Vendor) and paste below:
            </p>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              rows={8}
              placeholder="SKU-001, 10, 250, 499, Vendor Company Ltd&#10;SKU-002, 5, 120, 299, ABC Traders"
              style={styles.textarea}
            />
            <button
              type="button"
              onClick={() => processCsvText(pasteText)}
              className="btn-primary"
              style={{ alignSelf: 'flex-start', padding: '0.6rem 1.2rem' }}
            >
              Parse Data into Form Rows
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={styles.footer}>
          <div style={styles.statsSummary}>
            <CheckCircle size={16} color="#34d399" />
            <span style={{ fontSize: '0.85rem', color: '#e5e7eb' }}>
              Ready to Inward: <strong>{activeRowsCount} SKUs</strong> ({totalInwardUnits} total units)
            </span>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleFinalSubmit} className="btn-success" style={{ padding: '0.75rem 1.5rem', fontWeight: 'bold', fontSize: '0.95rem' }}>
              <Sparkles size={16} style={{ marginRight: '0.4rem' }} /> Confirm & Submit All Inwards
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

const styles = {
  modalContent: {
    padding: '1.5rem',
    maxWidth: '1100px',
    width: '96vw',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '90vh',
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
    fontSize: '1.25rem',
    fontWeight: '700',
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
  topControlBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    borderBottom: '1px solid var(--border-light)',
    paddingBottom: '0.75rem',
    marginBottom: '1rem',
    flexWrap: 'wrap',
  },
  tabBtn: {
    padding: '0.5rem 1rem',
    background: 'none',
    border: 'none',
    borderRadius: '6px',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  tabBtnActive: {
    background: 'rgba(16, 185, 129, 0.12)',
    color: '#10b981',
    fontWeight: 700,
  },
  formContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    flex: 1,
    overflow: 'hidden',
  },
  quickSetPanel: {
    background: 'rgba(16, 185, 129, 0.05)',
    border: '1px solid rgba(16, 185, 129, 0.15)',
    borderRadius: '8px',
    padding: '0.6rem 0.8rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  quickInput: {
    padding: '0.4rem 0.6.rem',
    fontSize: '0.8rem',
    borderRadius: '6px',
    border: '1px solid var(--border-light)',
    background: 'rgba(0,0,0,0.3)',
    color: '#f3f4f6',
    flex: 1,
    minWidth: '130px',
  },
  tableWrapper: {
    overflowY: 'auto',
    maxHeight: '48vh',
    border: '1px solid var(--border-light)',
    borderRadius: '8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.82rem',
  },
  cellInput: {
    width: '100%',
    border: '1px solid var(--border-light)',
    borderRadius: '4px',
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '0.45rem 0.5rem',
    fontSize: '0.82rem',
    color: '#ffffff',
    outline: 'none',
  },
  deleteRowBtn: {
    background: 'none',
    border: 'none',
    color: '#fca5a5',
    cursor: 'pointer',
    padding: '0.25rem',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRowBtn: {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px dashed var(--border-light)',
    color: 'var(--text-primary)',
    padding: '0.65rem 1rem',
    borderRadius: '8px',
    fontWeight: 700,
    fontSize: '0.85rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    width: '100%',
  },
  textarea: {
    width: '100%',
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    padding: '0.75rem',
    background: 'rgba(17, 24, 39, 0.4)',
    border: '1px solid var(--border-light)',
    borderRadius: '6px',
    color: '#f3f4f6',
    resize: 'vertical',
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
    gap: '0.5rem',
  },
};
