import React, { useState, useEffect } from 'react';
import { api, getBaseUrl } from '../services/api';
import { X, Upload, FileText, Image as ImageIcon, CheckCircle, AlertTriangle, RefreshCw, ArrowRight, ShieldCheck } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { triggerEliteAlert } from './EliteModalDialog';

export default function PKDOrdersImportModal({ onClose, onImportSuccess }) {
  const [activeTab, setActiveTab] = useState('paste'); // 'paste', 'images', 'csv'
  const [pastedText, setPastedText] = useState('');
  const [parsedItems, setParsedItems] = useState([]);
  const [existingNames, setExistingNames] = useState(new Set());
  const [existingUrls, setExistingUrls] = useState(new Set());
  
  const [uploadingImages, setUploadingImages] = useState(false);
  const [importing, setImporting] = useState(false);

  // Load existing designs to perform client-side duplicate checking before upload
  useEffect(() => {
    const loadExistingDesigns = async () => {
      try {
        const res = await api.getDesigns({ status: 'All', limit: 9999 });
        if (res && res.data) {
          const names = new Set(res.data.map(d => (d.designName || '').toLowerCase().trim()));
          const urls = new Set(res.data.map(d => (d.imageUrl || '').trim()).filter(Boolean));
          setExistingNames(names);
          setExistingUrls(urls);
        }
      } catch (e) {
        console.warn('Failed to load existing designs for duplicate checking', e);
      }
    };
    loadExistingDesigns();
  }, []);

  // System Naming Normalization: e.g. "1001" -> "PKD-1001", "pkd 1002" -> "PKD-1002"
  const normalizeOrderNo = (rawNo) => {
    if (!rawNo) return '';
    let clean = String(rawNo).trim().toUpperCase();
    if (!clean.startsWith('PKD-')) {
      const numOnly = clean.replace(/[^0-9]/g, '');
      if (numOnly && !clean.startsWith('ED')) {
        return `PKD-${numOnly || clean}`;
      } else if (!clean.includes('-')) {
        return `PKD-${clean}`;
      }
    }
    return clean;
  };

  // 1. Handle Pasted Google Sheet Data (PHOTO, ORDER NO)
  const handleParsePastedText = () => {
    if (!pastedText.trim()) return;

    const lines = pastedText.split('\n');
    const items = [];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Handle tab-separated (from Google Sheets / Excel copy-paste) or comma-separated
      const parts = trimmed.includes('\t') ? trimmed.split('\t') : trimmed.split(',');
      if (parts.length >= 2) {
        let photoVal = parts[0].trim();
        let orderNoVal = parts[1].trim();

        // If user pasted header line "PHOTO", "ORDER NO"
        if (photoVal.toUpperCase() === 'PHOTO' || orderNoVal.toUpperCase().includes('ORDER')) {
          return;
        }

        // Swap if Order No is in 1st column and photo in 2nd
        if (photoVal.toUpperCase().startsWith('PKD') || !isNaN(photoVal) && photoVal.length <= 6) {
          const temp = photoVal;
          photoVal = orderNoVal;
          orderNoVal = temp;
        }

        const normalized = normalizeOrderNo(orderNoVal);
        if (normalized) {
          items.push({
            id: idx + 1,
            photo: photoVal,
            rawOrderNo: orderNoVal,
            normalizedName: normalized,
            status: validateItemStatus(normalized, photoVal)
          });
        }
      }
    });

    setParsedItems(items);
  };

  // 2. Handle Multi-Image Drag & Drop Upload (e.g. PKD-1001.jpg, 1002.png)
  const handleImageFilesUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploadingImages(true);
    const newItems = [...parsedItems];

    for (let file of files) {
      if (!file.type.startsWith('image/')) continue;

      // Extract Order No from file name: e.g. "PKD-1001.jpg" -> "PKD-1001", "1002.png" -> "PKD-1002"
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      const normalized = normalizeOrderNo(nameWithoutExt);

      try {
        const options = { maxSizeMB: 1.5, maxWidthOrHeight: 2048, useWebWorker: true };
        const compressedFile = await imageCompression(file, options);
        const res = await api.uploadImage(compressedFile);
        const imageUrl = res.url;

        newItems.push({
          id: newItems.length + 1,
          photo: imageUrl,
          rawOrderNo: nameWithoutExt,
          normalizedName: normalized,
          fileName: file.name,
          status: validateItemStatus(normalized, imageUrl)
        });
      } catch (err) {
        console.error('Failed to upload image file:', file.name, err);
      }
    }

    setParsedItems(newItems);
    setUploadingImages(false);
  };

  // 3. Handle CSV / Excel File Upload
  const handleCSVFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target.result;
      setPastedText(content);
      // Auto parse after reading text
      setTimeout(() => {
        const lines = content.split('\n');
        const items = [];
        lines.forEach((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          const parts = trimmed.includes('\t') ? trimmed.split('\t') : trimmed.split(',');
          if (parts.length >= 2) {
            let photoVal = parts[0].trim();
            let orderNoVal = parts[1].trim();
            if (photoVal.toUpperCase() === 'PHOTO' || orderNoVal.toUpperCase().includes('ORDER')) return;
            if (photoVal.toUpperCase().startsWith('PKD') || (!isNaN(photoVal) && photoVal.length <= 6)) {
              const temp = photoVal; photoVal = orderNoVal; orderNoVal = temp;
            }
            const normalized = normalizeOrderNo(orderNoVal);
            if (normalized) {
              items.push({
                id: idx + 1,
                photo: photoVal,
                rawOrderNo: orderNoVal,
                normalizedName: normalized,
                status: validateItemStatus(normalized, photoVal)
              });
            }
          }
        });
        setParsedItems(items);
      }, 100);
    };
    reader.readAsText(file);
  };

  const validateItemStatus = (name, url) => {
    const isNameDup = existingNames.has(name.toLowerCase().trim());
    const isUrlDup = url && existingUrls.has(url.trim());
    if (isNameDup) return 'duplicate_name';
    if (isUrlDup) return 'duplicate_url';
    return 'ready';
  };

  const handleConfirmImport = async () => {
    const readyItems = parsedItems.filter(i => i.status === 'ready');
    if (!readyItems.length) {
      triggerEliteAlert('Import Warning', 'No non-duplicate items ready to import.', 'warning');
      return;
    }

    setImporting(true);
    try {
      const payload = readyItems.map(i => ({
        orderNo: i.normalizedName,
        photo: i.photo
      }));

      const res = await api.importPKDOrders(payload);
      if (res && res.success) {
        triggerEliteAlert('PKD Orders Imported!', `Successfully created ${res.createdCount} designs. (${res.skippedCount} duplicates skipped)`, 'success');
        if (onImportSuccess) onImportSuccess(res);
        onClose();
      }
    } catch (err) {
      triggerEliteAlert('Import Failed', err.message || 'Failed to import PKD orders.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const readyCount = parsedItems.filter(i => i.status === 'ready').length;
  const dupCount = parsedItems.filter(i => i.status !== 'ready').length;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1200,
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--bg-card, #1f2937)',
        border: '1px solid var(--border-light)',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '820px',
        maxHeight: '90vh',
        boxShadow: 'var(--shadow-xl)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(56,189,248,0.25))',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <ShieldCheck size={24} color="#38bdf8" />
              PKD ORDERS Batch Design Importer
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Bulk upload PHOTO & ORDER NO into Stitching Department & Design Room with duplicate protection.
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.3rem', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', background: 'var(--bg-main, #111827)', borderBottom: '1px solid var(--border-light)', padding: '0 1.25rem' }}>
          <button
            onClick={() => setActiveTab('paste')}
            style={{
              padding: '0.75rem 1rem', background: 'none', border: 'none',
              borderBottom: activeTab === 'paste' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'paste' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem'
            }}
          >
            <FileText size={16} /> 1. Paste Sheet Data
          </button>
          <button
            onClick={() => setActiveTab('images')}
            style={{
              padding: '0.75rem 1rem', background: 'none', border: 'none',
              borderBottom: activeTab === 'images' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'images' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem'
            }}
          >
            <ImageIcon size={16} /> 2. Bulk Image Files Upload
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            style={{
              padding: '0.75rem 1rem', background: 'none', border: 'none',
              borderBottom: activeTab === 'csv' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'csv' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem'
            }}
          >
            <Upload size={16} /> 3. Upload CSV/Excel
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.2rem', flex: 1 }}>
          {activeTab === 'paste' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Copy columns <strong>PHOTO</strong> (Image Link) and <strong>ORDER NO</strong> directly from Google Sheets or Excel and paste below:
              </div>
              <textarea
                rows={6}
                placeholder="Paste here... E.g.&#10;https://drive.google.com/uc?id=...	1001&#10;https://drive.google.com/uc?id=...	1002"
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                style={{
                  width: '100%', background: 'var(--bg-main, #111827)', border: '1px solid var(--border-light)',
                  borderRadius: '8px', color: 'var(--text-primary)', padding: '0.75rem', fontSize: '0.82rem', fontFamily: 'monospace'
                }}
              />
              <button
                onClick={handleParsePastedText}
                style={{
                  alignSelf: 'flex-start', background: '#38bdf8', border: 'none', color: '#000',
                  padding: '0.45rem 1rem', borderRadius: '6px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer'
                }}
              >
                ⚡ Parse & Validate Sheet Data
              </button>
            </div>
          )}

          {activeTab === 'images' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Select or Drag & Drop photo files named after Order Nos (e.g. <code>PKD-1001.jpg</code>, <code>1002.png</code>):
              </div>
              <label style={{
                border: '2px dashed var(--border-light)', borderRadius: '8px', padding: '2rem', textAlign: 'center',
                cursor: 'pointer', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem'
              }}>
                <input type="file" multiple accept="image/*" onChange={handleImageFilesUpload} style={{ display: 'none' }} />
                <ImageIcon size={32} color="#a78bfa" />
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {uploadingImages ? 'Uploading & Compressing Photos...' : 'Drop Photo Files Here or Click to Browse'}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Files will be auto-compressed & uploaded to design master.
                </span>
              </label>
            </div>
          )}

          {activeTab === 'csv' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Upload a <code>.csv</code> file containing <code>PHOTO</code> and <code>ORDER NO</code> columns:
              </div>
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleCSVFileUpload}
                style={{ background: 'var(--bg-main, #111827)', border: '1px solid var(--border-light)', padding: '0.6rem', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.85rem' }}
              />
            </div>
          )}

          {/* Validation Summary Bar */}
          {parsedItems.length > 0 && (
            <div style={{
              background: 'var(--bg-main, #111827)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--border-light)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem'
            }}>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                <span>Total Parsed: <strong>{parsedItems.length} Records</strong></span>
                <span style={{ color: '#34d399' }}>✅ Ready to Import: <strong>{readyCount}</strong></span>
                {dupCount > 0 && <span style={{ color: '#fbbf24' }}>⚠️ Duplicates Skipped: <strong>{dupCount}</strong></span>}
              </div>
              <button
                onClick={() => setParsedItems([])}
                style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Clear Preview
              </button>
            </div>
          )}

          {/* Live Validation & Normalization Grid */}
          {parsedItems.length > 0 && (
            <div style={{ border: '1px solid var(--border-light)', borderRadius: '8px', overflow: 'hidden', maxHeight: '280px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
                    <th style={{ padding: '0.5rem 0.75rem' }}>#</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Raw Order No</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>System Design Name</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Image Preview</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Validation Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedItems.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.45rem 0.75rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td style={{ padding: '0.45rem 0.75rem', fontWeight: 600 }}>{item.rawOrderNo}</td>
                      <td style={{ padding: '0.45rem 0.75rem', fontWeight: 800, color: 'var(--primary)' }}>{item.normalizedName}</td>
                      <td style={{ padding: '0.45rem 0.75rem' }}>
                        {item.photo ? (
                          <img src={item.photo} alt="Preview" style={{ height: '36px', width: '36px', objectFit: 'cover', borderRadius: '4px' }} />
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>No Image</span>
                        )}
                      </td>
                      <td style={{ padding: '0.45rem 0.75rem' }}>
                        {item.status === 'ready' ? (
                          <span style={{ color: '#34d399', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <CheckCircle size={13} /> Ready to Import
                          </span>
                        ) : (
                          <span style={{ color: '#fbbf24', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <AlertTriangle size={13} /> Duplicate Skipped
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border-light)', background: 'var(--bg-main, #111827)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Imported designs will be tagged under <strong>Stitching Department</strong> & <strong>Design Room</strong>.
          </span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--border-light)', color: 'var(--text-primary)', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={importing || readyCount === 0}
              style={{
                background: readyCount > 0 ? 'var(--primary)' : '#4b5563',
                border: 'none', color: '#fff', padding: '0.5rem 1.25rem', borderRadius: '6px', fontWeight: 800, cursor: readyCount > 0 ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: '0.4rem'
              }}
            >
              {importing ? 'Importing...' : `Confirm & Import ${readyCount} Designs 📥`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
