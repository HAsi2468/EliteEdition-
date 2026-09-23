import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, QrCode, ClipboardList, Info, AlertTriangle, Camera, Check, Plus, Minus, Trash2, Sparkles, Package, Building2 } from 'lucide-react';
import { playSuccessBeep, playErrorBeep } from '../utils/audioHelper';
import CameraBarcodeScanner from './CameraBarcodeScanner';
import { extractSizeFromSku, matchSkuOrBrandCode } from '../utils/skuHelper';
import VendorPartyManagerModal from './VendorPartyManagerModal';

const R2_PUBLIC_BASE = 'https://pub-66cb4aaa7dca442893dd7569e70ff7bd.r2.dev';

function convertDriveUrl(link) {
  if (!link || typeof link !== 'string' || !link.trim()) return '';
  const trimmed = link.trim();
  if (trimmed.startsWith('data:')) return trimmed;

  if (trimmed.includes('drive.google.com') || trimmed.includes('googleusercontent') || trimmed.includes('lh3.google')) {
    if (trimmed.includes('/folders/')) return '';
    let fid = '';
    const fileMatch = trimmed.match(/\/d\/([-\w]{20,})/);
    if (fileMatch) fid = fileMatch[1];
    if (!fid) {
      const openMatch = trimmed.match(/[?&]id=([-\w]{20,})/);
      if (openMatch) fid = openMatch[1];
    }
    if (!fid) {
      const idMatch = trimmed.match(/([-\w]{25,})/);
      if (idMatch) fid = idMatch[1];
    }
    if (fid) return `https://lh3.googleusercontent.com/d/${fid}=s1000`;
  }

  if (trimmed.includes('/designs/')) {
    const filename = trimmed.split('/designs/')[1].replace(/^\/+/, '');
    return `${R2_PUBLIC_BASE}/designs/${filename}`;
  }
  if (trimmed.includes('/uploads/')) {
    const filename = trimmed.split('/uploads/')[1].replace(/^\/+/, '');
    return `${R2_PUBLIC_BASE}/uploads/${filename}`;
  }

  if (trimmed.startsWith('https://')) return encodeURI(trimmed);

  if (trimmed.includes('3.7.174.180') || trimmed.startsWith('http://')) {
    const clean = trimmed.replace(/^http:\/\/[^\/]+/, '');
    if (clean.includes('/designs/') || clean.includes('/uploads/')) {
      const sub = clean.startsWith('/') ? clean.substring(1) : clean;
      return `${R2_PUBLIC_BASE}/${sub}`;
    }
    return encodeURI(trimmed.replace('http://', 'https://'));
  }

  if (!trimmed.startsWith('http') && !trimmed.includes('/')) {
    const filename = trimmed.includes('.') ? trimmed : `${trimmed}.jpeg`;
    return `${R2_PUBLIC_BASE}/designs/${encodeURIComponent(filename)}`;
  }

  return encodeURI(trimmed);
}

export default function StockOutForm({ items = [], parties = [], prefilledItem, onSubmit, onClose }) {
  const [defaultParty, setDefaultParty] = useState('');
  const [customParty, setCustomParty] = useState('');
  const [useCustomParty, setUseCustomParty] = useState(false);
  const [bulkChallanNo, setBulkChallanNo] = useState('');

  const [scanInput, setScanInput] = useState('');
  const [error, setError] = useState('');
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showPartyManager, setShowPartyManager] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Scroll preservation reference
  const scrollPosRef = useRef(0);
  const scanInputRef = useRef(null);

  // Helper to create empty row
  const createEmptyRow = (partyVal = '') => ({
    skuCode: '',
    itemName: '',
    size: '',
    qtyOut: 1,
    availableStock: 0,
    party: partyVal,
    imageUrl: '',
  });

  const [formRows, setFormRows] = useState(() => {
    if (prefilledItem) {
      const sizeStr = Array.isArray(prefilledItem.size) ? prefilledItem.size[0] : (prefilledItem.size || '');
      return [{
        skuCode: prefilledItem.skuCode || '',
        itemName: prefilledItem.itemName || prefilledItem.description || '',
        size: sizeStr,
        qtyOut: 1,
        availableStock: prefilledItem.currentlyAvailableStock || 0,
        party: prefilledItem.party || '',
        imageUrl: prefilledItem.imageUrl || '',
        originalItem: prefilledItem
      }];
    }
    return [createEmptyRow()];
  });

  // Real registered parties for autocompletion
  const [allParties, setAllParties] = useState([]);

  useEffect(() => {
    setAllParties(parties || []);
  }, [parties]);

  // Preserve scroll position on mount/unmount
  useEffect(() => {
    scrollPosRef.current = window.scrollY || document.documentElement.scrollTop || 0;
    if (scanInputRef.current) {
      scanInputRef.current.focus();
    }
    return () => {
      const targetY = scrollPosRef.current;
      if (typeof window !== 'undefined' && targetY > 0) {
        window.scrollTo({ top: targetY, behavior: 'instant' });
        setTimeout(() => window.scrollTo({ top: targetY, behavior: 'instant' }), 30);
      }
    };
  }, []);

  const handleModalClose = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    const targetY = scrollPosRef.current || 0;
    if (onClose) onClose();

    if (typeof window !== 'undefined' && targetY > 0) {
      window.scrollTo({ top: targetY, behavior: 'instant' });
      setTimeout(() => window.scrollTo({ top: targetY, behavior: 'instant' }), 30);
    }
  };

  // Helper to resolve effective vendor name
  const resolveVendorName = (vName) => {
    if (!vName) return '';
    const trimmed = vName.trim();
    const matchedVendor = parties.find(p => 
      (p.name && p.name.trim().toLowerCase() === trimmed.toLowerCase()) ||
      (p.businessName && p.businessName.trim().toLowerCase() === trimmed.toLowerCase())
    );
    return matchedVendor && matchedVendor.businessName ? matchedVendor.businessName : trimmed;
  };

  // Resolve Effective Size from Catalog / Inventory / SKU code
  const resolveEffectiveSize = (sourceObj, skuCode) => {
    if (sourceObj && Array.isArray(sourceObj.brandCodes) && skuCode) {
      const matchedBc = sourceObj.brandCodes.find(bc => {
        if (typeof bc === 'string') return bc.trim().toLowerCase() === skuCode.trim().toLowerCase();
        return bc && bc.code && String(bc.code).trim().toLowerCase() === skuCode.trim().toLowerCase();
      });
      if (matchedBc && typeof matchedBc === 'object' && matchedBc.size && String(matchedBc.size).trim()) {
        return String(matchedBc.size).trim().toUpperCase();
      }
    }
    const extracted = extractSizeFromSku(skuCode);
    if (extracted) return extracted;

    if (sourceObj) {
      if (typeof sourceObj.size === 'string' && sourceObj.size.trim() && sourceObj.size.trim().toUpperCase() !== 'N/A') {
        const firstSize = sourceObj.size.split(',')[0].trim();
        if (firstSize) return firstSize.toUpperCase();
      }
      if (Array.isArray(sourceObj.size) && sourceObj.size.length > 0) {
        const validFirst = sourceObj.size.find(s => typeof s === 'string' && s.trim() && s.trim().toUpperCase() !== 'N/A');
        if (validFirst) return validFirst.trim().toUpperCase();
      }
    }
    return 'N/A';
  };

  // Resolve Master SKU Code
  const resolveMasterSku = (matchedInventory, inputSku, resolvedSize) => {
    if (matchedInventory && matchedInventory.skuCode) {
      return matchedInventory.skuCode;
    }
    const cleanInput = inputSku.trim();
    const extractedSize = extractSizeFromSku(cleanInput);
    if (extractedSize) {
      return cleanInput;
    }
    if (resolvedSize && resolvedSize !== 'N/A') {
      return `${cleanInput}_${resolvedSize.toUpperCase()}`;
    }
    return cleanInput;
  };

  // Process a Scanned Barcode (USB scanner or Camera scanner)
  const processBarcodeScan = (scannedCode) => {
    const cleanSku = (scannedCode || '').trim();
    if (!cleanSku) return;

    const foundInv = (items || []).find((item) => matchSkuOrBrandCode(item, cleanSku));

    if (!foundInv) {
      setError(`SKU / Barcode "${cleanSku}" not found in store inventory.`);
      playErrorBeep();
      return;
    }

    const available = foundInv.currentlyAvailableStock ?? foundInv.qty ?? 0;
    const resolvedSize = resolveEffectiveSize(foundInv, cleanSku);
    const masterSku = resolveMasterSku(foundInv, cleanSku, resolvedSize);

    if (available <= 0) {
      setError(`SKU "${masterSku}" has 0 available stock.`);
      playErrorBeep();
      return;
    }

    playSuccessBeep();
    setError('');

    const partyValue = useCustomParty ? customParty.trim() : (defaultParty.trim() || '');

    setFormRows(prev => {
      const existingIndex = prev.findIndex(r => r.skuCode && (r.skuCode.trim().toLowerCase() === cleanSku.toLowerCase() || r.skuCode.trim().toLowerCase() === masterSku.toLowerCase()));

      if (existingIndex !== -1) {
        const currentQty = prev[existingIndex].qtyOut || 0;
        if (currentQty + 1 > available) {
          setError(`Cannot outward ${currentQty + 1} units for "${masterSku}". Only ${available} units available in stock.`);
          playErrorBeep();
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          skuCode: masterSku,
          size: resolvedSize,
          availableStock: available,
          party: partyValue || updated[existingIndex].party,
          qtyOut: currentQty + 1
        };
        return updated;
      } else {
        const validRows = prev.filter(r => r.skuCode && r.skuCode.trim() !== '');

        return [
          ...validRows,
          {
            skuCode: masterSku,
            itemName: foundInv.itemName || masterSku,
            size: resolvedSize,
            qtyOut: 1,
            availableStock: available,
            party: partyValue,
            imageUrl: foundInv.imageUrl || '',
            originalItem: foundInv
          }
        ];
      }
    });
  };

  const handleManualScanSubmit = (e) => {
    e.preventDefault();
    if (scanInput) {
      processBarcodeScan(scanInput);
      setScanInput('');
    }
  };

  // Add a new row
  const handleAddRow = () => {
    const activeParty = useCustomParty ? customParty.trim() : defaultParty.trim();
    setFormRows(prev => [...prev, createEmptyRow(activeParty)]);
  };

  // Remove a row
  const handleRemoveRow = (index) => {
    setFormRows(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.length > 0 ? filtered : [createEmptyRow(defaultParty)];
    });
  };

  // Row Field Edit Handler
  const handleRowFieldChange = (index, field, value) => {
    const updated = [...formRows];
    if (field === 'qtyOut') {
      const val = parseInt(value, 10) || 0;
      const avail = updated[index].availableStock || 0;
      if (avail > 0 && val > avail) {
        setError(`Cannot outward ${val} units for "${updated[index].skuCode}". Only ${avail} available.`);
      } else {
        setError('');
      }
      updated[index].qtyOut = val;
    } else if (field === 'skuCode') {
      const skuRaw = value.trim();
      updated[index].skuCode = value;
      const foundInv = (items || []).find((item) => matchSkuOrBrandCode(item, skuRaw));
      if (foundInv) {
        const resolvedSize = resolveEffectiveSize(foundInv, skuRaw);
        const masterSku = resolveMasterSku(foundInv, skuRaw, resolvedSize);
        updated[index].skuCode = masterSku;
        updated[index].itemName = foundInv.itemName || masterSku;
        updated[index].size = resolvedSize;
        updated[index].availableStock = foundInv.currentlyAvailableStock ?? foundInv.qty ?? 0;
        updated[index].party = updated[index].party || defaultParty || '';
        updated[index].imageUrl = foundInv.imageUrl || '';
        setError('');
      } else {
        updated[index].itemName = '';
        updated[index].size = extractSizeFromSku(value) || 'N/A';
        updated[index].availableStock = 0;
        updated[index].party = updated[index].party || defaultParty || '';
        updated[index].imageUrl = '';
      }
    } else {
      updated[index][field] = value;
    }
    setFormRows(updated);
  };

  // Form Submit Handler for All Outward Rows
  const handleFinalSubmit = (e) => {
    e.preventDefault();
    setError('');

    const validRows = formRows.filter(r => r.skuCode && r.skuCode.trim());

    if (validRows.length === 0) {
      setError('Please add or scan at least one valid item to dispatch.');
      playErrorBeep();
      return;
    }

    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      const pVal = r.party || (useCustomParty ? customParty.trim() : defaultParty.trim());
      if (!pVal) {
        setError(`Row #${i + 1} (${r.skuCode}): Please select or enter a recipient party.`);
        playErrorBeep();
        return;
      }
      if (!r.qtyOut || r.qtyOut <= 0) {
        setError(`Row #${i + 1} (${r.skuCode}): Quantity out must be greater than 0.`);
        playErrorBeep();
        return;
      }
      if (r.availableStock > 0 && r.qtyOut > r.availableStock) {
        setError(`Row #${i + 1} (${r.skuCode}): Cannot dispatch ${r.qtyOut} units. Only ${r.availableStock} available in stock.`);
        playErrorBeep();
        return;
      }
    }

    playSuccessBeep();

    const payload = validRows.map(r => ({
      skuCode: r.skuCode.trim(),
      party: r.party || (useCustomParty ? customParty.trim() : defaultParty.trim()),
      qtyOut: Number(r.qtyOut),
      challanNo: bulkChallanNo.trim() || undefined
    }));

    onSubmit(payload);
  };

  const totalOutwardUnits = formRows.reduce((acc, curr) => acc + (curr.skuCode ? (curr.qtyOut || 0) : 0), 0);
  const activeRowsCount = formRows.filter(r => r.skuCode && r.skuCode.trim()).length;

  const modalMarkup = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.5rem',
        boxSizing: 'border-box'
      }}
    >
      <div
        className="bulk-outward-modal-content"
        style={{
          width: isMobile ? '100vw' : '95vw',
          maxWidth: '1200px',
          height: isMobile ? '100vh' : 'auto',
          maxHeight: isMobile ? '100vh' : '92vh',
          background: '#ffffff',
          border: isMobile ? 'none' : '1px solid #e2e8f0',
          borderRadius: isMobile ? '0' : '18px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          color: '#0f172a',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '0.75rem 1rem' : '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ padding: '0.5rem', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', color: '#dc2626', display: 'flex' }}>
              <Package size={isMobile ? 18 : 22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: isMobile ? '1.05rem' : '1.25rem', fontWeight: 800, color: '#0f172a' }}>Outward Dispatch (EON)</h3>
              <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b' }}>Scan barcodes to auto-map Master SKUs and dispatch stock</p>
            </div>
          </div>
          <button onClick={handleModalClose} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#64748b', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0.75rem' : '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          
          {/* Error Alert */}
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.65rem 0.85rem', color: '#991b1b', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Top Controls: Scanner Input & Default Vendor */}
          <div style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '12px', padding: isMobile ? '0.75rem' : '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            
            {/* Barcode Scanner Bar */}
            <form onSubmit={handleManualScanSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: isMobile ? '100%' : '200px' }}>
                <QrCode size={18} color="#64748b" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  ref={scanInputRef}
                  type="text"
                  placeholder="Scan SKU or Brand Barcode..."
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem 0.6rem 2.6rem',
                    fontSize: isMobile ? '16px' : '0.9rem',
                    borderRadius: '10px',
                    border: '2px solid #3b82f6',
                    outline: 'none',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', width: isMobile ? '100%' : 'auto' }}>
                <button type="submit" style={{ flex: isMobile ? 1 : 'none', padding: '0.6rem 1.1rem', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  + Scan / Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowCameraScanner(prev => !prev)}
                  style={{ flex: isMobile ? 1 : 'none', padding: '0.6rem 0.85rem', background: showCameraScanner ? '#ef4444' : '#059669', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', boxShadow: '0 2px 8px rgba(5,150,105,0.25)' }}
                >
                  <Camera size={16} />
                  <span>{showCameraScanner ? 'Close Camera' : '📷 Camera Scan'}</span>
                </button>
              </div>
            </form>

            {/* Camera Scanner View */}
            {showCameraScanner && (
              <div style={{ margin: '0.25rem 0', padding: '0.5rem', background: '#000', borderRadius: '12px' }}>
                <CameraBarcodeScanner
                  onScan={(code) => {
                    processBarcodeScan(code);
                  }}
                  onScanSuccess={(code) => {
                    processBarcodeScan(code);
                  }}
                  onClose={() => setShowCameraScanner(false)}
                />
              </div>
            )}

            {/* Default Recipient Party & Reference */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: isMobile ? '100%' : '220px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem', display: 'block' }}>
                  Default Recipient Party / Customer
                </label>
                {!useCustomParty ? (
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      list="outward-parties-list"
                      placeholder="Select party for all..."
                      value={defaultParty}
                      onChange={(e) => {
                        const val = resolveVendorName(e.target.value);
                        setDefaultParty(val);
                        setFormRows(prev => prev.map(r => ({ ...r, party: val })));
                      }}
                      style={{ flex: 1, padding: '0.5rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: isMobile ? '16px' : '0.82rem', color: '#0f172a' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPartyManager(true)}
                      style={{
                        padding: '0.5rem 0.65rem',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        color: '#3b82f6',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        whiteSpace: 'nowrap'
                      }}
                      title="Manage Recipient Parties"
                    >
                      <Building2 size={14} />
                      <span>+ Parties</span>
                    </button>
                    <button type="button" onClick={() => setUseCustomParty(true)} style={{ padding: '0.5rem 0.65rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                      + Custom
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <input
                      type="text"
                      placeholder="Enter custom party name..."
                      value={customParty}
                      onChange={(e) => {
                        setCustomParty(e.target.value);
                        setFormRows(prev => prev.map(r => ({ ...r, party: e.target.value })));
                      }}
                      style={{ flex: 1, padding: '0.5rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: isMobile ? '16px' : '0.82rem', color: '#0f172a' }}
                    />
                    <button type="button" onClick={() => setUseCustomParty(false)} style={{ padding: '0.5rem 0.65rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                      List
                    </button>
                  </div>
                )}
              </div>

              <div style={{ width: isMobile ? '100%' : '200px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem', display: 'block' }}>
                  Challan / Ref No. (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. OUT-10492"
                  value={bulkChallanNo}
                  onChange={(e) => setBulkChallanNo(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: isMobile ? '16px' : '0.82rem', color: '#0f172a', boxSizing: 'border-box' }}
                />
              </div>
            </div>

          </div>

          {/* Multi-Item Outward View: Mobile Card View vs Desktop Table */}
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {formRows.map((row, idx) => {
                const isStockDeficit = row.availableStock > 0 && row.qtyOut > row.availableStock;
                return (
                  <div key={idx} style={{
                    background: isStockDeficit ? '#fff1f2' : '#ffffff',
                    border: isStockDeficit ? '1.5px solid #fca5a5' : '1.5px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                  }}>
                    {/* Card Top: Thumbnail + SKU + Size + Delete */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                        {row.imageUrl ? (
                          <img src={convertDriveUrl(row.imageUrl, row.skuCode || row.sku)} alt="Thumbnail" style={{ width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                            <Package size={18} />
                          </div>
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <input
                            type="text"
                            value={row.skuCode}
                            onChange={(e) => handleRowFieldChange(idx, 'skuCode', e.target.value)}
                            list="outward-master-skus"
                            placeholder="Type / Scan SKU..."
                            style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '16px', fontWeight: 800, fontFamily: 'monospace', color: '#1e40af', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', boxSizing: 'border-box' }}
                          />
                          {row.itemName && (
                            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {row.itemName}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ padding: '0.2rem 0.5rem', background: '#f1f5f9', borderRadius: '6px', fontWeight: 800, color: '#334155', fontSize: '0.75rem' }}>
                          {row.size || 'N/A'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fee2e2', border: 'none', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          title="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Card Middle: Stock Info & Large Thumb Stepper */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                      <div>
                        <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800, display: 'block' }}>AVAILABLE STOCK</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 900, color: row.availableStock > 0 ? '#059669' : '#dc2626' }}>
                          {row.availableStock} in stock
                        </span>
                      </div>

                      {/* Large Stepper */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => handleRowFieldChange(idx, 'qtyOut', Math.max(1, row.qtyOut - 1))}
                          style={{ width: '38px', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Minus size={18} strokeWidth={2.5} />
                        </button>
                        <input
                          type="number"
                          value={row.qtyOut}
                          onChange={(e) => handleRowFieldChange(idx, 'qtyOut', e.target.value)}
                          min="1"
                          style={{ width: '56px', height: '38px', padding: 0, textAlign: 'center', fontWeight: 900, fontSize: '16px', borderRadius: '8px', border: isStockDeficit ? '2px solid #ef4444' : '1.5px solid #3b82f6', color: isStockDeficit ? '#dc2626' : '#0f172a', background: '#ffffff' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRowFieldChange(idx, 'qtyOut', row.qtyOut + 1)}
                          style={{ width: '38px', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Plus size={18} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>

                    {/* Card Bottom: Recipient Party */}
                    <div>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>RECIPIENT PARTY</label>
                      <input
                        type="text"
                        value={row.party}
                        onChange={(e) => handleRowFieldChange(idx, 'party', e.target.value)}
                        list="outward-parties-list"
                        placeholder="Select Recipient Party..."
                        style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '16px', color: '#0f172a', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#ffffff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '0.65rem 0.75rem', width: '40px' }}>#</th>
                    <th style={{ padding: '0.65rem 0.75rem' }}>SKU Code (Master)</th>
                    <th style={{ padding: '0.65rem 0.75rem' }}>Product &amp; Details</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Size</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Stock Status</th>
                    <th style={{ padding: '0.65rem 0.75rem', width: '120px', textAlign: 'center' }}>Dispatch Qty</th>
                    <th style={{ padding: '0.65rem 0.75rem' }}>Recipient Party</th>
                    <th style={{ padding: '0.65rem 0.75rem', width: '50px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {formRows.map((row, idx) => {
                    const isStockDeficit = row.availableStock > 0 && row.qtyOut > row.availableStock;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: isStockDeficit ? '#fff1f2' : idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                        <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>

                        {/* Master SKU Field */}
                        <td style={{ padding: '0.65rem 0.75rem' }}>
                          <input
                            type="text"
                            value={row.skuCode}
                            onChange={(e) => handleRowFieldChange(idx, 'skuCode', e.target.value)}
                            list="outward-master-skus"
                            placeholder="Scan / Type SKU..."
                            style={{
                              width: '100%',
                              padding: '0.4rem 0.6rem',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: '#1e40af',
                              background: '#eff6ff',
                              boxSizing: 'border-box'
                            }}
                          />
                        </td>

                        {/* Product Name & Photo */}
                        <td style={{ padding: '0.65rem 0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {row.imageUrl ? (
                              <img src={convertDriveUrl(row.imageUrl, row.skuCode || row.sku)} alt="Thumbnail" style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                            ) : (
                              <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                                {row.itemName ? row.itemName[0].toUpperCase() : '?'}
                              </div>
                            )}
                            <span style={{ fontWeight: 600, color: '#0f172a' }}>{row.itemName || '—'}</span>
                          </div>
                        </td>

                        {/* Size */}
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                          <span style={{ padding: '0.2rem 0.5rem', background: '#f1f5f9', borderRadius: '6px', fontWeight: 700, color: '#334155', fontSize: '0.75rem' }}>
                            {row.size || 'N/A'}
                          </span>
                        </td>

                        {/* Stock Status Badge */}
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '0.25rem 0.65rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            background: row.availableStock > 0 ? '#d1fae5' : '#fee2e2',
                            color: row.availableStock > 0 ? '#047857' : '#dc2626',
                            border: row.availableStock > 0 ? '1px solid #a7f3d0' : '1px solid #fca5a5'
                          }}>
                            {row.availableStock} in stock
                          </span>
                        </td>

                        {/* Outward Quantity Input */}
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                            <button
                              type="button"
                              onClick={() => handleRowFieldChange(idx, 'qtyOut', Math.max(1, row.qtyOut - 1))}
                              style={{ width: '26px', height: '26px', padding: 0, borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                              title="Decrease Qty"
                            >
                              <Minus size={13} color="#475569" strokeWidth={2.5} />
                            </button>
                            <input
                              type="number"
                              value={row.qtyOut}
                              onChange={(e) => handleRowFieldChange(idx, 'qtyOut', e.target.value)}
                              min="1"
                              style={{ width: '50px', padding: '0.3rem 0.2rem', textAlign: 'center', fontWeight: 800, fontSize: '0.85rem', borderRadius: '6px', border: isStockDeficit ? '2px solid #ef4444' : '1px solid #cbd5e1', color: isStockDeficit ? '#dc2626' : '#0f172a' }}
                            />
                            <button
                              type="button"
                              onClick={() => handleRowFieldChange(idx, 'qtyOut', row.qtyOut + 1)}
                              style={{ width: '26px', height: '26px', padding: 0, borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                              title="Increase Qty"
                            >
                              <Plus size={13} color="#475569" strokeWidth={2.5} />
                            </button>
                          </div>
                        </td>

                        {/* Recipient Party */}
                        <td style={{ padding: '0.65rem 0.75rem' }}>
                          <input
                            type="text"
                            value={row.party}
                            onChange={(e) => handleRowFieldChange(idx, 'party', e.target.value)}
                            list="outward-parties-list"
                            placeholder="Select Party..."
                            style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', color: '#0f172a', boxSizing: 'border-box' }}
                          />
                        </td>

                        {/* Remove Button */}
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem', borderRadius: '4px' }}
                            title="Remove item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Datalists for Autocomplete */}
          <datalist id="outward-master-skus">
            {items.map((item, i) => (
              <option key={i} value={item.skuCode}>
                {item.itemName ? `${item.skuCode} — ${item.itemName} (${item.currentlyAvailableStock || 0} in stock)` : item.skuCode}
              </option>
            ))}
          </datalist>

          <datalist id="outward-parties-list">
            {allParties.map((p, i) => (
              <option key={i} value={p.businessName || p.name}>
                {p.businessName ? `${p.businessName} (Contact: ${p.name})` : p.name}
              </option>
            ))}
          </datalist>

          {/* Add Row Action Button */}
          <button
            type="button"
            onClick={handleAddRow}
            style={{
              alignSelf: 'flex-start',
              padding: '0.55rem 1rem',
              background: '#eff6ff',
              color: '#2563eb',
              border: '1.5px solid #bfdbfe',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Plus size={16} />
            <span>+ Add Another Outward Item Row</span>
          </button>

        </div>

        {/* Footer */}
        <div style={{
          padding: '0.85rem 1.25rem',
          paddingBottom: isMobile ? 'calc(0.85rem + env(safe-area-inset-bottom, 0px))' : '0.85rem',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
            Ready to Outward: <span style={{ color: '#dc2626', fontWeight: 900 }}>{activeRowsCount} SKUs</span> (<span style={{ color: '#0f172a', fontWeight: 900 }}>{totalOutwardUnits} total units</span>)
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', width: isMobile ? '100%' : 'auto' }}>
            <button
              type="button"
              onClick={handleModalClose}
              style={{ flex: isMobile ? 1 : 'none', padding: '0.6rem 1.1rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleFinalSubmit}
              style={{ flex: isMobile ? 2 : 'none', padding: '0.6rem 1.3rem', background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)', border: 'none', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 800, color: '#ffffff', cursor: 'pointer', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
            >
              <Sparkles size={16} />
              <span>Confirm &amp; Dispatch ({totalOutwardUnits} Pcs)</span>
            </button>
          </div>
        </div>

      </div>

      {showPartyManager && (
        <VendorPartyManagerModal
          mode="parties"
          onClose={() => setShowPartyManager(false)}
          onSelectParty={(pName) => {
            setDefaultParty(pName);
            setFormRows(prev => prev.map(r => ({ ...r, party: r.party || pName })));
            setShowPartyManager(false);
          }}
        />
      )}
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return ReactDOM.createPortal(modalMarkup, document.body);
  }
  return modalMarkup;
}
