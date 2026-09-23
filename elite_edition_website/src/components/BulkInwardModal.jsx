import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Plus, Minus, Trash2, CheckCircle, Sparkles, AlertCircle, Scan, Image as ImageIcon, Camera, Building2, Package } from 'lucide-react';
import { api } from '../services/api';
import { extractSizeFromSku, matchSkuOrBrandCode } from '../utils/skuHelper';
import { playSuccessBeep, playErrorBeep } from '../utils/audioHelper';
import CameraBarcodeScanner from './CameraBarcodeScanner';
import VendorPartyManagerModal from './VendorPartyManagerModal';

const R2_PUBLIC_BASE = 'https://pub-66cb4aaa7dca442893dd7569e70ff7bd.r2.dev';

function convertDriveUrl(link, sku = '') {
  if (!link || typeof link !== 'string' || !link.trim()) {
    if (sku && typeof sku === 'string' && sku.trim()) {
      return `${R2_PUBLIC_BASE}/${encodeURIComponent(sku.trim())}.jpg`;
    }
    return '';
  }
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
      const uMatches = trimmed.match(/([-\w]{25,})/g);
      if (uMatches && uMatches.length > 0) fid = uMatches[0];
    }
    if (fid) {
      return `https://lh3.googleusercontent.com/d/${fid}=s400`;
    }
  }
  return trimmed;
}

export default function BulkInwardModal({ onSubmit, onClose }) {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [error, setError] = useState('');
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showVendorManager, setShowVendorManager] = useState(false);
  const [justScannedSku, setJustScannedSku] = useState(null);
  const [lastScannedItem, setLastScannedItem] = useState(null);
  const scannedTimeoutRef = React.useRef(null);
  
  // Master Reference Lists
  const [vendorsList, setVendorsList] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [storeInventory, setStoreInventory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Quick Set Header Controls
  const [bulkVendor, setBulkVendor] = useState('');
  const [bulkChallanNo, setBulkChallanNo] = useState('');

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
    return match ? (match.businessName || match.name) : val;
  };

  // Quick Set Vendor for all rows
  const applyQuickSetVendor = (val) => {
    setBulkVendor(val);
    const resolvedVendor = resolveVendorName(val) || val;
    setFormRows(prev => prev.map(item => ({
      ...item,
      party: resolvedVendor
    })));
  };

  // Quick Set Challan for all rows
  const applyQuickSetChallan = (val) => {
    setBulkChallanNo(val);
    setFormRows(prev => prev.map(item => ({
      ...item,
      challanNo: val
    })));
  };

  // Add a new empty row
  const handleAddRow = () => {
    const defaultVendor = resolveVendorName(bulkVendor) || (formRows[0]?.party || '');
    const defaultChallan = bulkChallanNo || (formRows[0]?.challanNo || '');

    setFormRows(prev => [
      ...prev,
      createEmptyRow(defaultVendor, defaultChallan)
    ]);
  };

  // Remove a row
  const handleRemoveRow = (index) => {
    setFormRows(prev => prev.filter((_, i) => i !== index));
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

  // Resolve Master SKU Code so brand barcodes combine under Master SKU
  const resolveMasterSku = (matchedInventory, matchedCatalog, inputSku, resolvedSize) => {
    if (matchedInventory && matchedInventory.skuCode) {
      return matchedInventory.skuCode;
    }
    if (matchedCatalog && matchedCatalog.skuCode) {
      const baseCatalogSku = matchedCatalog.skuCode.trim();
      const extractedSize = extractSizeFromSku(baseCatalogSku);
      if (extractedSize) {
        return baseCatalogSku;
      }
      if (resolvedSize && resolvedSize !== 'N/A') {
        return `${baseCatalogSku}_${resolvedSize.toUpperCase()}`;
      }
      return baseCatalogSku;
    }
    return inputSku.trim();
  };

  // SKU Autocomplete Handler for a Row
  const handleSkuChange = (index, value) => {
    const skuRaw = value.trim();
    const updated = [...formRows];

    if (!skuRaw) {
      updated[index].skuCode = value;
      setFormRows(updated);
      return;
    }

    const matchedInventory = storeInventory.find(item => matchSkuOrBrandCode(item, skuRaw));
    const matchedCatalog = catalogItems.find(item => matchSkuOrBrandCode(item, skuRaw));
    const effectiveSize = resolveEffectiveSize(matchedInventory || matchedCatalog, skuRaw);
    const masterSku = resolveMasterSku(matchedInventory, matchedCatalog, skuRaw, effectiveSize);

    updated[index].skuCode = masterSku;
    updated[index].size = effectiveSize;

    if (matchedInventory) {
      updated[index].itemName = matchedInventory.itemName || updated[index].itemName || masterSku;
      updated[index].purchasePrice = updated[index].purchasePrice || matchedInventory.purchasePrice || 0;
      updated[index].salePrice = updated[index].salePrice || matchedInventory.salePrice || 0;
      updated[index].party = updated[index].party || resolveVendorName(matchedInventory.party) || '';
      updated[index].imageUrl = matchedInventory.imageUrl || matchedCatalog?.imageUrl || '';
      updated[index].status = 'UPDATE';
    } else if (matchedCatalog) {
      updated[index].itemName = matchedCatalog.description || updated[index].itemName || masterSku;
      updated[index].purchasePrice = updated[index].purchasePrice || matchedCatalog.basePrice || 0;
      updated[index].salePrice = updated[index].salePrice || matchedCatalog.price || 0;
      updated[index].party = updated[index].party || resolveVendorName(matchedCatalog.brand) || '';
      updated[index].imageUrl = matchedCatalog.imageUrl || '';
      updated[index].status = 'CATALOG_MATCH';
    } else {
      if (!updated[index].itemName) updated[index].itemName = masterSku;
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

  // Process a Scanned Barcode (USB scanner or Camera scanner)
  const processScannedSku = (skuRaw) => {
    const cleanSku = (skuRaw || '').trim();
    if (!cleanSku) return;

    playSuccessBeep();

    setFormRows(prev => {
      const matchedInventory = storeInventory.find(item => matchSkuOrBrandCode(item, cleanSku));
      const matchedCatalog = catalogItems.find(item => matchSkuOrBrandCode(item, cleanSku));
      const size = resolveEffectiveSize(matchedInventory || matchedCatalog, cleanSku);
      const masterSku = resolveMasterSku(matchedInventory, matchedCatalog, cleanSku, size);

      setJustScannedSku(masterSku);
      if (scannedTimeoutRef.current) clearTimeout(scannedTimeoutRef.current);
      scannedTimeoutRef.current = setTimeout(() => setJustScannedSku(null), 3000);

      const existingIndex = prev.findIndex(r => r.skuCode && (r.skuCode.trim().toLowerCase() === cleanSku.toLowerCase() || r.skuCode.trim().toLowerCase() === masterSku.toLowerCase()));
      if (existingIndex !== -1) {
        const existingItem = prev[existingIndex];
        const newQty = (existingItem.qty || 0) + 1;
        setLastScannedItem({
          skuCode: masterSku,
          qty: newQty,
          size,
          itemName: existingItem.itemName
        });
        const updatedItem = {
          ...existingItem,
          skuCode: masterSku,
          size,
          qty: newQty
        };
        const otherItems = prev.filter((_, i) => i !== existingIndex);
        return [updatedItem, ...otherItems]; // Always bring active scanned item to TOP
      } else {
        let itemName = masterSku;
        let purchasePrice = matchedInventory?.purchasePrice || matchedCatalog?.basePrice || 0;
        let salePrice = matchedInventory?.salePrice || matchedCatalog?.price || 0;
        let party = resolveVendorName(bulkVendor) || (prev[0]?.party || '');
        let challanNo = bulkChallanNo || (prev[0]?.challanNo || '');
        let imageUrl = matchedCatalog?.imageUrl || matchedInventory?.imageUrl || '';
        let status = 'NEW';

        if (matchedInventory) {
          itemName = matchedInventory.itemName || itemName;
          party = party || resolveVendorName(matchedInventory.party) || '';
          status = 'UPDATE';
        } else if (matchedCatalog) {
          itemName = matchedCatalog.description || itemName;
          party = party || resolveVendorName(matchedCatalog.brand) || '';
          status = 'CATALOG_MATCH';
        }

        setLastScannedItem({
          skuCode: masterSku,
          qty: 1,
          size,
          itemName
        });

        const validRows = prev.filter(r => r.skuCode && r.skuCode.trim() !== '');
        return [
          {
            skuCode: masterSku,
            itemName,
            size,
            qty: 1,
            purchasePrice,
            salePrice,
            party,
            challanNo,
            imageUrl,
            status
          },
          ...validRows // Always place newly scanned item at TOP
        ];
      }
    });
  };

  // Barcode / SKU Form Submit Handler
  const handleScanSubmit = (e) => {
    e.preventDefault();
    processScannedSku(scanSkuInput);
    setScanSkuInput('');
  };

  // Quick Apply Settings to all rows
  const applyQuickSettings = () => {
    const resolvedVendor = resolveVendorName(bulkVendor);
    setFormRows(prev => prev.map(item => ({
      ...item,
      party: resolvedVendor || item.party,
      challanNo: bulkChallanNo !== '' ? bulkChallanNo : item.challanNo,
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
      playErrorBeep();
      return;
    }

    // Ensure Vendor is set for all valid rows
    const missingVendorRows = validRows.filter(r => !r.party || !r.party.trim());
    if (missingVendorRows.length > 0) {
      setError('Please select or specify Vendor / Business Name for all item rows.');
      playErrorBeep();
      return;
    }

    onSubmit(validRows);
  };

  const totalInwardUnits = formRows.reduce((acc, curr) => acc + (curr.skuCode ? (curr.qty || 0) : 0), 0);
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
      onClick={onClose}
    >
      <div
        className="bulk-inward-modal-content"
        style={{
          ...styles.modalContent,
          ...(isMobile ? {
            width: '100vw',
            maxWidth: '100vw',
            height: '100vh',
            maxHeight: '100vh',
            borderRadius: 0,
            padding: '0.75rem',
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            border: 'none',
            boxShadow: 'none'
          } : {})
        }}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="bulk-inward-header" style={styles.header}>
          <div className="bulk-inward-title-group" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={styles.headerBadge}>
              <Sparkles size={22} color="#059669" />
            </div>
            <div>
              <h3 style={styles.title}>Inward Stock Entry</h3>
              <p style={styles.subtitle}>Scan or enter SKUs to auto-increment quantities with sound confirmation.</p>
            </div>
          </div>
          
          {/* Quick Scanner & Camera Controls */}
          <div className="bulk-inward-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowCameraScanner(!showCameraScanner)}
              style={{
                ...styles.scanBtn,
                background: showCameraScanner ? '#dc2626' : '#10b981',
                color: '#ffffff',
                padding: '0.5rem 0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: isMobile ? '0.85rem' : '0.82rem',
                fontWeight: 800,
                borderRadius: '8px'
              }}
              title="Toggle Mobile Camera Scanner"
            >
              <Camera size={16} />
              <span>{showCameraScanner ? 'Close Camera' : '📷 Camera Scan'}</span>
            </button>

            <form className="bulk-inward-scan-form" onSubmit={handleScanSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: isMobile ? '100%' : '260px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Scan size={15} color="#475569" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={scanSkuInput}
                  onChange={e => setScanSkuInput(e.target.value)}
                  placeholder="Scan SKU barcode..."
                  style={{
                    ...styles.scannerInput,
                    fontSize: isMobile ? '16px' : '0.82rem'
                  }}
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

        {/* Embedded Mobile Camera Scanner */}
        {showCameraScanner && (
          <div style={{ marginBottom: isMobile ? '0.4rem' : '0.85rem' }}>
            <CameraBarcodeScanner
              compact={isMobile}
              totalPieces={totalInwardUnits}
              totalItems={activeRowsCount}
              lastScannedItem={lastScannedItem}
              itemsList={formRows.filter(r => r.skuCode && r.skuCode.trim())}
              onScan={(code) => processScannedSku(code)}
              onClose={() => setShowCameraScanner(false)}
            />
          </div>
        )}

        {/* MAIN FORM VIEW */}
        <div style={styles.formContainer}>
          
          {/* Quick Set Header Bar - Compact when camera is active on mobile */}
          {isMobile && showCameraScanner ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0.65rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.75rem' }}>
              <span style={{ fontWeight: 700, color: '#475569' }}>
                🏢 Default Vendor: <strong style={{ color: '#059669' }}>{bulkVendor || 'All Rows'}</strong>
              </span>
              <button
                type="button"
                onClick={() => setShowVendorManager(true)}
                style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.25rem 0.5rem', fontSize: '0.72rem', fontWeight: 800, color: '#059669', cursor: 'pointer' }}
              >
                + Manage Vendor
              </button>
            </div>
          ) : (
            <div className="bulk-inward-quickset" style={styles.quickSetPanel}>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#d97706', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                ⚡ Quick Set All Rows:
              </span>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.35rem', flex: 1, minWidth: isMobile ? '100%' : '240px', alignItems: 'center' }}>
                  <input
                    type="text"
                    list="master-vendors-list"
                    value={bulkVendor}
                    onChange={e => applyQuickSetVendor(e.target.value)}
                    placeholder="Bulk Vendor for all rows..."
                    style={{ ...styles.quickInput, flex: 1, fontSize: isMobile ? '16px' : '0.82rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowVendorManager(true)}
                    style={{
                      padding: '0.5rem 0.65rem',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      color: '#059669',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                    title="Manage Vendors & Suppliers"
                  >
                    <Building2 size={14} />
                    <span>+ Vendors</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={bulkChallanNo}
                  onChange={e => applyQuickSetChallan(e.target.value)}
                  placeholder="Bulk Challan No for all rows..."
                  style={{ ...styles.quickInput, width: isMobile ? '100%' : 'auto', fontSize: isMobile ? '16px' : '0.82rem' }}
                />
              </div>
            </div>
          )}

          {/* Live Scanned Items Status Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.45rem 0.8rem',
            background: showCameraScanner ? '#ecfdf5' : '#f8fafc',
            border: showCameraScanner ? '1.5px solid #10b981' : '1px solid #cbd5e1',
            borderRadius: '10px',
            fontSize: '0.8rem',
            fontWeight: 800,
            color: showCameraScanner ? '#065f46' : '#334155',
            gap: '0.5rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span>📋 Inward Items ({activeRowsCount} Styles)</span>
              <span style={{
                background: '#059669',
                color: '#ffffff',
                padding: '2px 8px',
                borderRadius: '6px',
                fontWeight: 900,
                fontSize: '0.78rem',
                boxShadow: '0 2px 6px rgba(5,150,105,0.25)'
              }}>
                📦 {totalInwardUnits} PCS TOTAL
              </span>
            </div>
            {justScannedSku ? (
              <span style={{ color: '#ffffff', background: '#059669', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 900 }}>
                ✨ Scanned: {justScannedSku}
              </span>
            ) : showCameraScanner ? (
              <span style={{ color: '#059669', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669', display: 'inline-block' }}></span>
                Camera Live
              </span>
            ) : null}
          </div>

          {/* Dynamic Form View: Mobile Card View vs Desktop Table */}
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', overflowY: 'auto', flex: 1, minHeight: 0, padding: '2px' }}>
              {formRows.map((row, idx) => {
                const isJustScanned = justScannedSku && (row.skuCode === justScannedSku || (row.skuCode && row.skuCode.toLowerCase() === justScannedSku.toLowerCase()));
                return (
                  <div key={idx} style={{
                    background: isJustScanned ? '#f0fdf4' : '#ffffff',
                    border: isJustScanned ? '2px solid #10b981' : '1.5px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.55rem',
                    boxShadow: isJustScanned ? '0 0 14px rgba(16,185,129,0.35)' : '0 2px 6px rgba(0,0,0,0.04)',
                    transition: 'all 0.25s ease'
                  }}>
                    {/* Card Top: Thumbnail + SKU input + Size badge + Delete button */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                        {row.imageUrl ? (
                          <img
                            src={convertDriveUrl(row.imageUrl, row.skuCode)}
                            alt={row.skuCode || 'Item'}
                            style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0', flexShrink: 0 }}
                            onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; }}
                          />
                        ) : null}
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '8px',
                          background: isJustScanned ? '#bbf7d0' : '#f0fdf4',
                          color: '#059669',
                          border: '1px solid #bbf7d0',
                          display: row.imageUrl ? 'none' : 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Package size={18} />
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b' }}>
                              #{idx + 1} • SKU CODE
                            </span>
                            {isJustScanned && (
                              <span style={{ fontSize: '0.62rem', fontWeight: 900, background: '#10b981', color: '#ffffff', padding: '1px 5px', borderRadius: '4px' }}>
                                SCANNED +1
                              </span>
                            )}
                          </div>
                        <input
                          type="text"
                          value={row.skuCode}
                          onChange={(e) => handleSkuChange(idx, e.target.value)}
                          list="master-catalog-skus"
                          placeholder="Type / Scan SKU..."
                          style={{
                            width: '100%',
                            padding: '0.4rem 0.5rem',
                            fontSize: '16px',
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            color: '#059669',
                            background: '#f0fdf4',
                            border: '1.5px solid #a7f3d0',
                            borderRadius: '6px',
                            boxSizing: 'border-box'
                          }}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ padding: '0.25rem 0.5rem', background: '#f1f5f9', borderRadius: '6px', fontWeight: 800, color: '#334155', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        {typeof row.size === 'string' ? row.size : (Array.isArray(row.size) ? row.size.join('/') : (row.size || 'N/A'))}
                      </span>
                      {formRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#fee2e2', border: 'none', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          title="Remove Row"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Item Name Description */}
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>
                      ITEM DESCRIPTION
                    </label>
                    <input
                      type="text"
                      value={row.itemName}
                      onChange={(e) => handleRowFieldChange(idx, 'itemName', e.target.value)}
                      placeholder="Item Description..."
                      style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '16px', color: '#0f172a', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Card Middle: Stepper & Buy Price */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '0.6rem', background: '#f8fafc', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <div>
                      <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: '4px' }}>
                        INWARD QUANTITY
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => handleRowFieldChange(idx, 'qty', Math.max(1, (row.qty || 1) - 1))}
                          style={{ width: '38px', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Minus size={18} strokeWidth={2.5} />
                        </button>
                        <input
                          type="number"
                          value={row.qty}
                          onChange={(e) => handleRowFieldChange(idx, 'qty', e.target.value)}
                          min="1"
                          style={{ width: '56px', height: '38px', padding: 0, textAlign: 'center', fontWeight: 900, fontSize: '16px', borderRadius: '8px', border: '1.5px solid #059669', color: '#059669', background: '#ffffff' }}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => handleRowFieldChange(idx, 'qty', (row.qty || 0) + 1)}
                          style={{ width: '38px', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Plus size={18} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: '4px' }}>
                        BUY PRICE (₹)
                      </span>
                      <input
                        type="number"
                        value={row.purchasePrice}
                        onChange={(e) => handleRowFieldChange(idx, 'purchasePrice', e.target.value)}
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        style={{ width: '100%', height: '38px', padding: '0.4rem 0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', fontWeight: 700, color: '#0f172a', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  {/* Card Bottom: Vendor & Challan */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>
                        VENDOR / COMPANY *
                      </label>
                      <input
                        type="text"
                        value={row.party}
                        onChange={(e) => handleRowFieldChange(idx, 'party', e.target.value)}
                        list="master-vendors-list"
                        placeholder="Select Vendor..."
                        style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '16px', color: '#0f172a', boxSizing: 'border-box' }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>
                        CHALLAN NO.
                      </label>
                      <input
                        type="text"
                        value={row.challanNo}
                        onChange={(e) => handleRowFieldChange(idx, 'challanNo', e.target.value)}
                        placeholder="CH-001..."
                        style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '16px', color: '#0f172a', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: '4%', padding: '0.75rem 0.4rem', textAlign: 'center' }}>SR NO</th>
                    <th style={{ width: '6%', padding: '0.75rem 0.4rem', textAlign: 'center' }}>IMAGE</th>
                    <th style={{ width: '20%', padding: '0.75rem 0.6rem' }}>SKU CODE *</th>
                    <th style={{ width: '20%', padding: '0.75rem 0.6rem' }}>ITEM NAME / DETAILS</th>
                    <th style={{ width: '10%', padding: '0.75rem 0.4rem', textAlign: 'center' }}>SIZE</th>
                    <th style={{ width: '9%', padding: '0.75rem 0.4rem', textAlign: 'center' }}>QTY *</th>
                    <th style={{ width: '11%', padding: '0.75rem 0.4rem', textAlign: 'right' }}>BUY PRICE</th>
                    <th style={{ width: '12%', padding: '0.75rem 0.6rem' }}>VENDOR / COMPANY *</th>
                    <th style={{ width: '10%', padding: '0.75rem 0.6rem' }}>CHALLAN NO.</th>
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
                            src={convertDriveUrl(row.imageUrl, row.skuCode)}
                            alt={row.skuCode || 'Item'}
                            style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'inline-block' }}
                            onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; }}
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

                      {/* Size (Auto-populated / Read-only) */}
                      <td style={{ padding: '0.5rem 0.4rem' }}>
                        <input
                          type="text"
                          value={typeof row.size === 'string' ? row.size : (Array.isArray(row.size) ? row.size.join('/') : (row.size || ''))}
                          readOnly
                          tabIndex={-1}
                          placeholder="Size..."
                          style={{
                            ...styles.cellInput,
                            textAlign: 'center',
                            fontWeight: 700,
                            background: '#f8fafc',
                            color: '#64748b',
                            cursor: 'not-allowed',
                            borderColor: '#e2e8f0'
                          }}
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
          )}

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
        <div className="bulk-inward-footer" style={styles.footer}>
          <div style={styles.statsSummary}>
            <CheckCircle size={18} color="#059669" />
            <span style={{ fontSize: '0.88rem', color: '#059669', fontWeight: 600 }}>
              Ready to Inward: <span style={{ color: '#0f172a', fontWeight: 800 }}>{activeRowsCount} SKUs</span> ({totalInwardUnits} total units)
            </span>
          </div>
          
          <div className="bulk-inward-btn-group" style={{ display: 'flex', gap: '0.85rem' }}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>
              Cancel
            </button>
            <button onClick={handleFinalSubmit} style={styles.submitBtn}>
              <Sparkles size={16} style={{ marginRight: '0.4rem' }} /> Confirm & Submit All Inwards
            </button>
          </div>
        </div>

      </div>

      {showVendorManager && (
        <VendorPartyManagerModal
          mode="vendors"
          onClose={() => setShowVendorManager(false)}
          onSelectVendor={(vName) => {
            setBulkVendor(vName);
            applyQuickSetVendor(vName);
            setShowVendorManager(false);
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

// Inject Responsive Mobile CSS Styles for Bulk Inward Modal
if (typeof document !== 'undefined') {
  const styleElId = 'bulk-inward-modal-responsive-style';
  if (!document.getElementById(styleElId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleElId;
    styleEl.innerHTML = `
      @media (max-width: 768px) {
        .bulk-inward-modal-content {
          width: 100vw !important;
          max-width: 100vw !important;
          height: 100vh !important;
          max-height: 100vh !important;
          padding: 0.75rem !important;
          padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px)) !important;
          border-radius: 0px !important;
          border: none !important;
          box-sizing: border-box !important;
        }
        .bulk-inward-header {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 0.65rem !important;
          margin-bottom: 0.65rem !important;
          padding-bottom: 0.65rem !important;
        }
        .bulk-inward-title-group {
          width: 100% !important;
        }
        .bulk-inward-header-actions {
          width: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 0.4rem !important;
        }
        .bulk-inward-scan-form {
          width: 100% !important;
        }
        .bulk-inward-quickset {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 0.5rem !important;
          padding: 0.65rem !important;
        }
        .bulk-inward-footer {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 0.65rem !important;
          padding-top: 0.65rem !important;
          padding-bottom: env(safe-area-inset-bottom, 0px) !important;
        }
        .bulk-inward-footer > div {
          width: 100% !important;
        }
        .bulk-inward-btn-group {
          width: 100% !important;
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 0.5rem !important;
        }
        .bulk-inward-btn-group button {
          width: 100% !important;
          justify-content: center !important;
          font-size: 0.88rem !important;
          padding: 0.65rem 0.5rem !important;
          min-height: 44px !important;
          white-space: nowrap !important;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }
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
