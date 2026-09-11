import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, CheckCircle, Sparkles, AlertCircle, Scan, Image as ImageIcon } from 'lucide-react';
import { api } from '../services/api';
import { extractSizeFromSku } from '../utils/skuHelper';

export default function BulkInwardModal({ onSubmit, onClose }) {
  const [error, setError] = useState('');
  
  // Master Reference Lists
  const [vendorsList, setVendorsList] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [storeInventory, setStoreInventory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Quick Set Header Controls
  const [bulkVendor, setBulkVendor] = useState('');
  const [bulkChallanNo, setBulkChallanNo] = useState('');
  const [bulkPurchasePrice, setBulkPurchasePrice] = useState('');
  const [bulkSalePrice, setBulkSalePrice] = useState('');

  // Barcode / SKU Scanner Input
  const [scanSkuInput, setScanSkuInput] = useState('');

  // Multi-Row Form Data State (Default 3 rows)
  const createEmptyRow = (vendorName = '', challanNum = '') => ({
    skuCode: '',
    itemName: '',
    size: '',
    qty: 1,
    purchasePrice: 0,
    salePrice: 0,
    party: vendorName || '',
    challanNo: challanNum || '',
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
    const defaultChallan = bulkChallanNo || (formRows[0]?.challanNo || '');
    const defaultBuy = bulkPurchasePrice ? parseFloat(bulkPurchasePrice) : 0;
    const defaultSell = bulkSalePrice ? parseFloat(bulkSalePrice) : 0;

    setFormRows(prev => [
      ...prev,
      {
        ...createEmptyRow(defaultVendor, defaultChallan),
        purchasePrice: defaultBuy,
        salePrice: defaultSell,
      }
    ]);
  };

  // Remove a row
  const handleRemoveRow = (index) => {
    setFormRows(prev => prev.filter((_, i) => i !== index));
  };

  // Resolve Effective Size from Catalog / Inventory / SKU code
  const resolveEffectiveSize = (sourceObj, skuCode) => {
    if (sourceObj) {
      if (typeof sourceObj.size === 'string' && sourceObj.size.trim() && sourceObj.size.trim().toUpperCase() !== 'N/A') {
        return sourceObj.size.trim().toUpperCase();
      }
      if (Array.isArray(sourceObj.size) && sourceObj.size.length > 0) {
        const validFirst = sourceObj.size.find(s => typeof s === 'string' && s.trim() && s.trim().toUpperCase() !== 'N/A');
        if (validFirst) return validFirst.trim().toUpperCase();
      }
    }
    return extractSizeFromSku(skuCode) || 'N/A';
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
      updated[index].size = resolveEffectiveSize(matchedInventory, skuRaw);
      updated[index].purchasePrice = updated[index].purchasePrice || matchedInventory.purchasePrice || 0;
      updated[index].salePrice = updated[index].salePrice || matchedInventory.salePrice || 0;
      updated[index].party = updated[index].party || resolveVendorName(matchedInventory.party) || '';
      updated[index].imageUrl = matchedInventory.imageUrl || matchedCatalog?.imageUrl || '';
      updated[index].status = 'UPDATE';
    } else if (matchedCatalog) {
      updated[index].itemName = matchedCatalog.description || updated[index].itemName || skuRaw;
      updated[index].size = resolveEffectiveSize(matchedCatalog, skuRaw);
      updated[index].purchasePrice = updated[index].purchasePrice || matchedCatalog.basePrice || 0;
      updated[index].salePrice = updated[index].salePrice || matchedCatalog.price || 0;
      updated[index].party = updated[index].party || resolveVendorName(matchedCatalog.brand) || '';
      updated[index].imageUrl = matchedCatalog.imageUrl || '';
      updated[index].status = 'CATALOG_MATCH';
    } else {
      updated[index].size = extractSizeFromSku(skuRaw) || 'N/A';
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
      let size = resolveEffectiveSize(matchedInventory || matchedCatalog, skuRaw);
      let purchasePrice = bulkPurchasePrice ? parseFloat(bulkPurchasePrice) : 0;
      let salePrice = bulkSalePrice ? parseFloat(bulkSalePrice) : 0;
      let party = resolveVendorName(bulkVendor) || (formRows[0]?.party || '');
      let challanNo = bulkChallanNo || (formRows[0]?.challanNo || '');
      let imageUrl = matchedCatalog?.imageUrl || matchedInventory?.imageUrl || '';
      let status = 'NEW';

      if (matchedInventory) {
        itemName = matchedInventory.itemName || itemName;
        purchasePrice = purchasePrice || matchedInventory.purchasePrice || 0;
        salePrice = salePrice || matchedInventory.salePrice || 0;
        party = party || resolveVendorName(matchedInventory.party) || '';
        imageUrl = imageUrl || matchedInventory.imageUrl || '';
        status = 'UPDATE';
      } else if (matchedCatalog) {
        itemName = matchedCatalog.description || itemName;
        purchasePrice = purchasePrice || matchedCatalog.basePrice || 0;
        salePrice = salePrice || matchedCatalog.price || 0;
        party = party || resolveVendorName(matchedCatalog.brand) || '';
        imageUrl = imageUrl || matchedCatalog.imageUrl || '';
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
          challanNo,
          imageUrl,
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
      challanNo: bulkChallanNo !== '' ? bulkChallanNo : item.challanNo,
      purchasePrice: bulkPurchasePrice ? parseFloat(bulkPurchasePrice) : item.purchasePrice,
      salePrice: bulkSalePrice ? parseFloat(bulkSalePrice) : item.salePrice
    })));
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={styles.headerBadge}>
              <Sparkles size={22} color="#059669" />
            </div>
            <div>
              <h3 style={styles.title}>Multi-Item Inward Entry Form</h3>
              <p style={styles.subtitle}>Enter multiple SKUs, quantities, images, and challan details in one interactive form.</p>
            </div>
          </div>
          
          {/* Quick Scanner Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <form onSubmit={handleScanSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '300px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Scan size={15} color="#475569" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={scanSkuInput}
                  onChange={e => setScanSkuInput(e.target.value)}
                  placeholder="Scan SKU barcode..."
                  style={styles.scannerInput}
                />
              </div>
              <button type="submit" style={styles.scanBtn}>+ Scan</button>
            </form>
            
            <button onClick={onClose} style={styles.closeBtn} title="Close Modal">
              <X size={18} />
            </button>
          </div>
        </div>

        {error && (
          <div style={styles.errorBanner}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* MAIN FORM VIEW */}
        <div style={styles.formContainer}>
          
          {/* Quick Set Header Bar */}
          <div style={styles.quickSetPanel}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#d97706', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              ⚡ Quick Set All:
            </span>
            <div style={{ display: 'flex', gap: '0.6rem', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Set Vendor / Company..."
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
                type="text"
                placeholder="Set Challan No..."
                value={bulkChallanNo}
                onChange={(e) => setBulkChallanNo(e.target.value)}
                style={{ ...styles.quickInput, maxWidth: '140px' }}
              />

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
                style={styles.applyAllBtn}
              >
                Apply to All Rows
              </button>
            </div>
          </div>

          {/* Dynamic Form Table */}
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '4%', padding: '0.75rem 0.4rem', textAlign: 'center' }}>SR NO</th>
                  <th style={{ width: '6%', padding: '0.75rem 0.4rem', textAlign: 'center' }}>IMAGE</th>
                  <th style={{ width: '18%', padding: '0.75rem 0.6rem' }}>SKU CODE *</th>
                  <th style={{ width: '18%', padding: '0.75rem 0.6rem' }}>ITEM NAME / DETAILS</th>
                  <th style={{ width: '8%', padding: '0.75rem 0.4rem', textAlign: 'center' }}>SIZE</th>
                  <th style={{ width: '8%', padding: '0.75rem 0.4rem', textAlign: 'center' }}>QTY *</th>
                  <th style={{ width: '10%', padding: '0.75rem 0.4rem', textAlign: 'right' }}>BUY PRICE</th>
                  <th style={{ width: '10%', padding: '0.75rem 0.4rem', textAlign: 'right' }}>SELL PRICE</th>
                  <th style={{ width: '14%', padding: '0.75rem 0.6rem' }}>VENDOR / COMPANY *</th>
                  <th style={{ width: '12%', padding: '0.75rem 0.6rem' }}>CHALLAN NO.</th>
                  <th style={{ width: '4%', padding: '0.75rem 0.4rem', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {formRows.map((row, idx) => (
                  <tr key={idx} style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
                    
                    {/* Sr. No */}
                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'center', fontWeight: '800', color: '#64748b', fontSize: '0.82rem' }}>
                      #{idx + 1}
                    </td>

                    {/* Image Thumbnail */}
                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'center' }}>
                      {row.imageUrl ? (
                        <img
                          src={row.imageUrl}
                          alt={row.skuCode || 'Item'}
                          style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'inline-block' }}
                          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                        />
                      ) : null}
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '6px',
                        background: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        display: row.imageUrl ? 'none' : 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto',
                        color: '#94a3b8'
                      }}>
                        <ImageIcon size={16} />
                      </div>
                    </td>

                    {/* SKU Code Input with Autocomplete */}
                    <td style={{ padding: '0.5rem 0.6rem' }}>
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
                    <td style={{ padding: '0.5rem 0.6rem' }}>
                      <input
                        type="text"
                        value={row.itemName}
                        onChange={(e) => handleRowFieldChange(idx, 'itemName', e.target.value)}
                        placeholder="Item Description..."
                        style={styles.cellInput}
                      />
                    </td>

                    {/* Size */}
                    <td style={{ padding: '0.5rem 0.4rem' }}>
                      <input
                        type="text"
                        value={row.size}
                        onChange={(e) => handleRowFieldChange(idx, 'size', e.target.value)}
                        placeholder="M, L..."
                        style={{ ...styles.cellInput, textAlign: 'center' }}
                      />
                    </td>

                    {/* Quantity */}
                    <td style={{ padding: '0.5rem 0.4rem' }}>
                      <input
                        type="number"
                        value={row.qty}
                        onChange={(e) => handleRowFieldChange(idx, 'qty', e.target.value)}
                        min="1"
                        style={{ ...styles.cellInput, textAlign: 'center', fontWeight: '800', color: '#1d4ed8', fontSize: '0.95rem' }}
                        required
                      />
                    </td>

                    {/* Buy Price */}
                    <td style={{ padding: '0.5rem 0.4rem' }}>
                      <input
                        type="number"
                        value={row.purchasePrice}
                        onChange={(e) => handleRowFieldChange(idx, 'purchasePrice', e.target.value)}
                        step="0.01"
                        min="0"
                        style={{ ...styles.cellInput, textAlign: 'right', color: '#0f172a' }}
                      />
                    </td>

                    {/* Sell Price */}
                    <td style={{ padding: '0.5rem 0.4rem' }}>
                      <input
                        type="number"
                        value={row.salePrice}
                        onChange={(e) => handleRowFieldChange(idx, 'salePrice', e.target.value)}
                        step="0.01"
                        min="0"
                        style={{ ...styles.cellInput, textAlign: 'right', color: '#0f172a' }}
                      />
                    </td>

                    {/* Vendor Business Name */}
                    <td style={{ padding: '0.5rem 0.6rem' }}>
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

                    {/* Challan No. */}
                    <td style={{ padding: '0.5rem 0.6rem' }}>
                      <input
                        type="text"
                        value={row.challanNo}
                        onChange={(e) => handleRowFieldChange(idx, 'challanNo', e.target.value)}
                        placeholder="CH-001..."
                        style={styles.cellInput}
                      />
                    </td>

                    {/* Delete Row Button */}
                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'center' }}>
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
            <Plus size={18} color="#0f172a" />
            <span>+ Add Another Item Row</span>
          </button>

        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <div style={styles.statsSummary}>
            <CheckCircle size={18} color="#059669" />
            <span style={{ fontSize: '0.88rem', color: '#059669', fontWeight: 600 }}>
              Ready to Inward: <span style={{ color: '#0f172a', fontWeight: 800 }}>{activeRowsCount} SKUs</span> ({totalInwardUnits} total units)
            </span>
          </div>
          
          <div style={{ display: 'flex', gap: '0.85rem' }}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>
              Cancel
            </button>
            <button onClick={handleFinalSubmit} style={styles.submitBtn}>
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
    maxWidth: '1240px',
    width: '98vw',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '92vh',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '18px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    color: '#0f172a',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '0.85rem',
  },
  headerBadge: {
    padding: '0.65rem',
    background: '#d1fae5',
    border: '1px solid #a7f3d0',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: '1.3rem',
    fontWeight: '800',
    color: '#0f172a',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: 0,
    fontSize: '0.82rem',
    color: '#64748b',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: '0.4rem',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  errorBanner: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    borderRadius: '8px',
    padding: '0.65rem 0.9rem',
    fontSize: '0.85rem',
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
  },
  scannerInput: {
    width: '100%',
    padding: '0.45rem 0.7rem 0.45rem 2.2rem',
    fontSize: '0.82rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    background: '#cbd5e1',
    color: '#0f172a',
    outline: 'none',
    fontWeight: 500,
  },
  scanBtn: {
    padding: '0.45rem 0.9rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    background: '#f1f5f9',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  formContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    flex: 1,
    overflow: 'hidden',
  },
  quickSetPanel: {
    background: '#f1f5f9',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '0.65rem 0.9rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    flexWrap: 'wrap',
  },
  quickInput: {
    padding: '0.45rem 0.7rem',
    fontSize: '0.82rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    background: '#cbd5e1',
    color: '#0f172a',
    flex: 1,
    minWidth: '130px',
    outline: 'none',
    fontWeight: 500,
  },
  applyAllBtn: {
    padding: '0.45rem 1rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    background: '#e2e8f0',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  tableWrapper: {
    overflowY: 'auto',
    maxHeight: '48vh',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    background: '#ffffff',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
  },
  cellInput: {
    width: '100%',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    background: '#ffffff',
    padding: '0.5rem 0.65rem',
    fontSize: '0.85rem',
    color: '#0f172a',
    outline: 'none',
    transition: 'border-color 0.15s ease',
  },
  deleteRowBtn: {
    background: '#fee2e2',
    border: '1px solid #fecaca',
    color: '#ef4444',
    cursor: 'pointer',
    padding: '0.35rem',
    borderRadius: '6px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  addRowBtn: {
    background: '#ffffff',
    border: '1px dashed #cbd5e1',
    color: '#0f172a',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    fontWeight: 800,
    fontSize: '0.88rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    width: '100%',
    transition: 'all 0.2s ease',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '1.25rem',
    borderTop: '1px solid #e2e8f0',
    paddingTop: '1rem',
  },
  statsSummary: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
  },
  cancelBtn: {
    background: '#f1f5f9',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    padding: '0.65rem 1.25rem',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '0.88rem',
    cursor: 'pointer',
  },
  submitBtn: {
    background: 'linear-gradient(135deg, #059669, #10b981)',
    color: '#ffffff',
    border: 'none',
    padding: '0.65rem 1.6rem',
    borderRadius: '8px',
    fontWeight: 700,
    fontSize: '0.92rem',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
    display: 'flex',
    alignItems: 'center',
  },
};
