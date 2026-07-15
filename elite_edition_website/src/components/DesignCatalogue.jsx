import React, { useState, useEffect, useRef } from 'react';
import { api, getBaseUrl } from '../services/api';
import {
  PlusCircle, Search, RefreshCw, Edit2, Trash2, X, Save, Image,
  Eye, FileText, ChevronLeft, ChevronRight, CheckCircle, AlertCircle
} from 'lucide-react';
import { COLOR_NAMES, getColorHex, detectDominantColors } from '../utils/colors';
import imageCompression from 'browser-image-compression';

// Copy convertDriveUrl helper
function convertDriveUrl(link) {
  if (!link || !link.trim()) return '';
  if (link.startsWith('data:')) return link;
  
  // If it's a local relative path
  if (link.startsWith('/')) {
    const baseUrl = getBaseUrl();
    if (baseUrl && baseUrl.startsWith('http')) {
      try {
        const url = new URL(baseUrl);
        return `${url.origin}${link}`;
      } catch (e) {}
    }
    return link;
  }
  
  // If it's a Google Drive link
  if (link.includes('drive.google.com') || link.includes('googleusercontent') || link.includes('lh3.google')) {
    if (link.includes('uc?export') || link.includes('lh3.google') || link.includes('googleusercontent')) return link;
    const fileMatch = link.match(/\/d\/([-\w]{20,})/);
    if (fileMatch) return `https://drive.google.com/uc?export=view&id=${fileMatch[1]}`;
    const openMatch = link.match(/[?&]id=([-\w]{20,})/);
    if (openMatch) return `https://drive.google.com/uc?export=view&id=${openMatch[1]}`;
    if (link.includes('/folders/')) return '';
    const idMatch = link.match(/([-\w]{25,})/);
    return idMatch ? `https://drive.google.com/uc?export=view&id=${idMatch[1]}` : link;
  }
  
  // If it's any other external link (e.g. starts with http)
  if (link.startsWith('http')) {
    return link;
  }
  
  // Fallback
  return link;
}

// Image compression helper
function compressAndConvertToBase64(file, maxWidth = 900, maxHeight = 900, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

const BLANK_DESIGN = {
  designName: '',
  designerName: '',
  colourMatching: '',
  fabricName: '',
  fusingTemp: '',
  speed: '',
  machineProfiles: {},
  colors: '',
  panna: '',
  pass: '',
  category: '',
  imageUrl: '',
  imageUrl2: '',
  notes: '',
  status: 'Active',
  top100: '',
  sleeve100: '',
  bottom100: '',
  dupatta100: '',
  cut100: '',
  totalMtr100: '',
  setCopy100: '',
};

// Form Field Component
function FormField({ label, name, value, onChange, placeholder, type = 'text', options, required }) {
  const showColorPreview = name === 'colors' && getColorHex(value);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: '1 1 calc(50% - 0.5rem)', minWidth: '180px' }}>
      <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
          {options ? (
            <>
              <input 
                type={type}
                name={name} 
                value={value} 
                onChange={onChange} 
                list={`${name}-options`}
                placeholder={placeholder || 'Select or type...'}
                required={required}
                style={{ padding: '0.5rem 0.7rem', fontSize: '0.85rem', width: '100%' }}
              />
              <datalist id={`${name}-options`}>
                {options.filter(o => o).map(o => <option key={o} value={o} />)}
              </datalist>
            </>
          ) : (
            <input
              type={type}
              name={name}
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              required={required}
              style={{ padding: '0.5rem 0.7rem', fontSize: '0.85rem', width: '100%' }}
            />
          )}
        </div>
        {showColorPreview && (
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: getColorHex(value),
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            flexShrink: 0
          }} title={value} />
        )}
      </div>
    </div>
  );
}

// Image Input Component with Drag & Drop / File Select / Live Preview
function DesignImageField({ label, name, value, onChange, placeholder }) {
  const raw = value || '';
  const [mode, setMode] = useState(raw && !raw.startsWith('data:') ? 'url' : 'file'); // 'file' or 'url'
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const options = { maxSizeMB: 1.5, maxWidthOrHeight: 2048, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);
      const res = await api.uploadImage(compressedFile);
      onChange({ target: { name, value: res.url } });
    } catch (err) {
      alert('Failed to upload image: ' + err.message);
    }
  };

  const handleClear = () => {
    onChange({ target: { name, value: '' } });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isBase64 = raw.startsWith('data:');
  const directUrl = isBase64 ? raw : convertDriveUrl(raw);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: '1 1 100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </label>
        <button
          type="button"
          onClick={() => {
            setMode(m => m === 'file' ? 'url' : 'file');
            handleClear();
          }}
          style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
        >
          {mode === 'file' ? 'Paste Image URL instead' : 'Upload Image File instead'}
        </button>
      </div>

      {mode === 'file' ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={async (e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
              try {
                const options = { maxSizeMB: 1.5, maxWidthOrHeight: 2048, useWebWorker: true };
                const compressedFile = await imageCompression(file, options);
                const res = await api.uploadImage(compressedFile);
                onChange({ target: { name, value: res.url } });
              } catch (err) {
                alert('Failed to upload image: ' + err.message);
              }
            }
          }}
          style={{
            border: '2px dashed var(--border-light)',
            borderRadius: 'var(--radius-sm)',
            padding: '1.25rem',
            textAlign: 'center',
            cursor: 'pointer',
            background: 'rgba(255,255,255,0.01)',
            transition: 'border-color 0.2s',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-light)'}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            style={{ display: 'none' }}
          />
          {directUrl ? (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img
                src={directUrl}
                alt="Selected preview"
                style={{ maxHeight: '110px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                style={{
                  position: 'absolute', top: -8, right: -8,
                  background: 'var(--danger)', color: 'var(--text-primary)', border: 'none',
                  borderRadius: '50%', width: '20px', height: '20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <>
              <Image size={24} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Drag & Drop or <strong style={{ color: 'var(--primary)' }}>Browse</strong> to upload design image
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.7 }}>
                Supports JPG, PNG (automatically compressed client-side)
              </span>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <input
            type="text"
            name={name}
            value={raw}
            onChange={onChange}
            placeholder={placeholder}
            style={{ padding: '0.5rem 0.7rem', fontSize: '0.82rem', borderColor: directUrl ? 'rgba(52,211,153,0.4)' : undefined }}
          />
          {raw.includes('/folders/') && (
            <div style={{ fontSize: '0.7rem', color: 'var(--warning)', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              ⚠️ Folder link detected. Copy direct link of individual files in Drive instead.
            </div>
          )}
          {directUrl && (
            <div style={{
              display: 'inline-flex',
              gap: '0.8rem',
              alignItems: 'center',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-light)',
              background: 'rgba(255,255,255,0.02)',
              padding: '0.5rem'
            }}>
              <img
                src={directUrl}
                alt="Preview"
                style={{ height: '60px', width: '60px', objectFit: 'cover', borderRadius: '4px', background: '#000' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <div style={{ display: 'none', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                🔒 CORS block (Will show in Print/PDF)
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 600 }}>✓ Link Auto-Converted</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DesignCatalogue() {
  const [designs, setDesigns] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Search & Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [colorFilter, setColorFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [sortBy, setSortBy] = useState('designName');
  const [sortOrder, setSortOrder] = useState('asc');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal form states
  const [showForm, setShowForm] = useState(false);
  const [formDesign, setFormDesign] = useState(null); // null means New
  const [formVal, setFormVal] = useState({ ...BLANK_DESIGN });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [allDesignsList, setAllDesignsList] = useState([]);

  useEffect(() => {
    if (showForm) {
      const loadAllDesigns = async () => {
        try {
          const res = await api.getDesigns({ limit: 1000 });
          if (res && res.data) setAllDesignsList(res.data);
        } catch (e) {
          console.warn('Failed to load all designs for validation', e);
        }
      };
      loadAllDesigns();
    }
  }, [showForm]);

  // Auto-detect color state
  const [detectingColor, setDetectingColor] = useState(false);
  const [detectedColors, setDetectedColors] = useState(null);

  // Bulk auto-detect state
  const [bulkDetecting, setBulkDetecting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, updated: 0, skipped: 0, failed: 0, log: [] });

  // Print Config state
  const [printConfig, setPrintConfig] = useState({
    categories: [], passes: [], parties: [], widths: [], fabrics: []
  });

  // Image zoom modal
  const [zoomImg, setZoomImg] = useState(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const cfg = await api.getPrintConfig();
        setPrintConfig(cfg);
      } catch (err) {
        console.error('Failed to load print settings:', err);
      }
    };

    const loadAll = () => {
      fetchDesigns();
      fetchCategories();
      fetchConfig();
    };

    loadAll();
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, [search, categoryFilter, colorFilter, statusFilter, page, sortBy, sortOrder]);

  const fetchDesigns = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getDesigns({
        search,
        category: categoryFilter,
        colors: colorFilter,
        status: statusFilter,
        sortBy,
        sortOrder,
        page,
        limit: 12
      });
      if (res && res.data) {
        setDesigns(res.data);
        setTotal(res.total);
        setPages(res.pages || 1);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch designs.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const cats = await api.getDesignCategories();
      setCategories(cats || []);
    } catch (e) {
      console.error(e);
    }
  };

  const openNew = () => {
    setFormDesign(null);
    setFormVal({ ...BLANK_DESIGN });
    setFormError('');
    setDetectedColors(null);
    setShowForm(true);
  };

  const openEdit = (d) => {
    setFormDesign(d);
    setFormVal({ ...BLANK_DESIGN, ...d });
    setFormError('');
    setDetectedColors(null);
    setShowForm(true);
  };

  // Auto-detect dominant color from the currently attached image
  const handleAutoDetectColor = async () => {
    const raw = formVal.imageUrl || '';
    if (!raw) {
      setFormError('Please upload or paste an image first, then detect colour.');
      return;
    }
    const isBase64 = raw.startsWith('data:');
    const imageSrc = isBase64 ? raw : (raw.startsWith('http') ? raw : convertDriveUrl(raw));
    if (!imageSrc) {
      setFormError('Could not resolve image URL. Please upload a file instead.');
      return;
    }

    setDetectingColor(true);
    setDetectedColors(null);
    setFormError('');
    try {
      const colors = await detectDominantColors(imageSrc, 3);
      setDetectedColors(colors);
      // Auto-fill the first (most dominant) color
      if (colors && colors.length > 0) {
        setFormVal(prev => ({ ...prev, colors: colors[0].name }));
      }
    } catch (err) {
      setFormError('⚠️ Auto-detect failed: ' + err.message);
    } finally {
      setDetectingColor(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormVal(prev => ({ ...prev, [name]: value }));
  };

  const handleMachineProfileChange = (machineName, profileValue) => {
    setFormVal(prev => ({
      ...prev,
      machineProfiles: {
        ...(prev.machineProfiles || {}),
        [machineName]: profileValue
      }
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formVal.designName.trim()) {
      setFormError('Design Name is required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const sanitizedVal = {
        ...formVal,
        top100: formVal.top100 === '' || formVal.top100 === null || formVal.top100 === undefined ? 0 : Number(formVal.top100),
        sleeve100: formVal.sleeve100 === '' || formVal.sleeve100 === null || formVal.sleeve100 === undefined ? 0 : Number(formVal.sleeve100),
        bottom100: formVal.bottom100 === '' || formVal.bottom100 === null || formVal.bottom100 === undefined ? 0 : Number(formVal.bottom100),
        dupatta100: formVal.dupatta100 === '' || formVal.dupatta100 === null || formVal.dupatta100 === undefined ? 0 : Number(formVal.dupatta100),
        cut100: formVal.cut100 === '' || formVal.cut100 === null || formVal.cut100 === undefined ? 0 : Number(formVal.cut100),
        totalMtr100: formVal.totalMtr100 === '' || formVal.totalMtr100 === null || formVal.totalMtr100 === undefined ? 0 : Number(formVal.totalMtr100),
        setCopy100: formVal.setCopy100 === '' || formVal.setCopy100 === null || formVal.setCopy100 === undefined ? 0 : Number(formVal.setCopy100),
      };

      if (formDesign) {
        await api.updateDesign(formDesign._id, sanitizedVal);
      } else {
        await api.createDesign(sanitizedVal);
      }
      setShowForm(false);
      fetchDesigns();
      fetchCategories();
    } catch (err) {
      setFormError(err.message || 'Failed to save design.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete design "${name}"?`)) return;
    try {
      await api.deleteDesign(id);
      fetchDesigns();
      fetchCategories();
    } catch (err) {
      alert(err.message || 'Failed to delete design.');
    }
  };

  // Bulk auto-detect colours for ALL designs
  const handleBulkAutoDetectColors = async () => {
    if (!window.confirm('This will analyze every design image and set the colour field to the most dominant colour detected.\n\nDesigns without images will be skipped.\n\nContinue?')) return;

    setBulkDetecting(true);
    setBulkProgress({ current: 0, total: 0, updated: 0, skipped: 0, failed: 0, log: [] });

    try {
      // Fetch ALL designs (no filter, large limit)
      const res = await api.getDesigns({ status: 'All', limit: 9999 });
      const allDesigns = res?.data || [];
      const totalCount = allDesigns.length;
      setBulkProgress(prev => ({ ...prev, total: totalCount }));

      let updated = 0, skipped = 0, failed = 0;
      const log = [];

      for (let i = 0; i < allDesigns.length; i++) {
        const d = allDesigns[i];
        const rawUrl = d.imageUrl || '';

        // Skip designs with no image
        if (!rawUrl) {
          skipped++;
          log.push({ name: d.designName, status: 'skipped', reason: 'No image' });
          setBulkProgress({ current: i + 1, total: totalCount, updated, skipped, failed, log: [...log] });
          continue;
        }

        const isBase64 = rawUrl.startsWith('data:');
        const imageSrc = isBase64 ? rawUrl : (rawUrl.startsWith('http') ? rawUrl : convertDriveUrl(rawUrl));

        if (!imageSrc) {
          skipped++;
          log.push({ name: d.designName, status: 'skipped', reason: 'Invalid URL' });
          setBulkProgress({ current: i + 1, total: totalCount, updated, skipped, failed, log: [...log] });
          continue;
        }

        try {
          const colors = await detectDominantColors(imageSrc, 1);
          if (colors && colors.length > 0) {
            const dominantColor = colors[0].name;
            await api.updateDesign(d._id, { colors: dominantColor });
            updated++;
            log.push({ name: d.designName, status: 'updated', color: dominantColor, pct: colors[0].percentage });
          } else {
            skipped++;
            log.push({ name: d.designName, status: 'skipped', reason: 'No colours detected' });
          }
        } catch (err) {
          failed++;
          log.push({ name: d.designName, status: 'failed', reason: err.message?.includes('CORS') || err.message?.includes('load image') ? 'CORS / Image load failed' : err.message });
        }

        setBulkProgress({ current: i + 1, total: totalCount, updated, skipped, failed, log: [...log] });
      }

      // Refresh the grid
      fetchDesigns();
    } catch (err) {
      alert('Bulk operation failed: ' + err.message);
    } finally {
      // Keep modal open so user can see results — they close it manually
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
      {/* Top Banner */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#38bdf8,#8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Image size={22} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Design Catalogue</h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>
                Store & display master designs — {total} total designs
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleBulkAutoDetectColors}
              disabled={bulkDetecting}
              style={{
                padding: '0.55rem 1.1rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                fontFamily: 'var(--font-sans)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(139,92,246,0.4)',
                background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(56,189,248,0.12))',
                color: '#a78bfa',
                cursor: bulkDetecting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.2s',
                opacity: bulkDetecting ? 0.6 : 1
              }}
            >
              {bulkDetecting ? (
                <><RefreshCw size={14} className="spin-loader" /> Processing...</>
              ) : (
                <><span style={{ fontSize: '1rem' }}>🎨</span> Auto-set All Colours</>
              )}
            </button>
            <button className="btn-primary" onClick={openNew} style={{ padding: '0.55rem 1.25rem' }}>
              <PlusCircle size={15} /> New Design
            </button>
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search Design name, fabric, matching, designer..."
              style={{ paddingLeft: 32, width: '100%', fontSize: '0.85rem' }}
            />
          </div>

          {/* Categories select filter */}
          <div style={{ minWidth: 150 }}>
            <select
              value={categoryFilter}
              onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
              style={{ width: '100%', padding: '0.45rem 0.7rem', fontSize: '0.85rem' }}
            >
              <option value="All">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Colors select filter */}
          <div style={{ minWidth: 150 }}>
            <select
              value={colorFilter}
              onChange={e => { setColorFilter(e.target.value); setPage(1); }}
              style={{ width: '100%', padding: '0.45rem 0.7rem', fontSize: '0.85rem' }}
            >
              <option value="All">All Colors</option>
              {COLOR_NAMES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Status Buttons */}
          {['Active', 'Inactive', 'All'].map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              style={{
                padding: '0.45rem 0.9rem', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)',
                fontWeight: 600, cursor: 'pointer', border: '1px solid',
                borderColor: statusFilter === s ? 'var(--primary)' : 'var(--border-light)',
                background: statusFilter === s ? 'var(--nav-active-bg)' : 'transparent',
                color: statusFilter === s ? 'var(--primary)' : 'var(--text-muted)',
                transition: 'all 0.15s'
              }}
            >
              {s}
            </button>
          ))}

          {/* Sorting */}
          <div style={{ minWidth: 140 }}>
            <select
              value={sortBy}
              onChange={e => { setSortBy(e.target.value); setPage(1); }}
              style={{ width: '100%', padding: '0.45rem 0.7rem', fontSize: '0.85rem' }}
            >
              <option value="designName">Sort by Name</option>
              <option value="createdAt">Sort by Date</option>
            </select>
          </div>
          <button
            onClick={() => { setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); setPage(1); }}
            style={{
              padding: '0.45rem 0.9rem', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)',
              fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-light)',
              background: 'transparent', color: 'var(--text-muted)',
              transition: 'all 0.15s'
            }}
          >
            {sortOrder === 'asc' ? '▲ Asc' : '▼ Desc'}
          </button>

          <button onClick={fetchDesigns} className="btn-icon" title="Refresh">
            <RefreshCw size={14} className={loading ? 'spin-loader' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', color: '#fca5a5', fontSize: '0.85rem' }}>{error}</div>
      )}

      {/* Grid catalogue */}
      {loading && designs.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <RefreshCw size={32} className="spin-loader" color="var(--primary)" />
          <p style={{ marginTop: '1rem' }}>Loading designs catalogue...</p>
        </div>
      ) : designs.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <Image size={48} color="var(--text-muted)" style={{ opacity: 0.4 }} />
          <h4 style={{ marginTop: '1rem', color: 'var(--text-primary)' }}>No Designs Stored</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>Click "New Design" to upload design parameters and image.</p>
          <button className="btn-primary" onClick={openNew} style={{ marginTop: '1.25rem', padding: '0.55rem 1.3rem' }}>
            <PlusCircle size={14} /> Add First Design
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.2rem' }}>
            {designs.map(d => {
              const mainImg = convertDriveUrl(d.imageUrl);
              const subImg = convertDriveUrl(d.imageUrl2);

              return (
                <div
                  key={d._id}
                  className="glass-panel"
                  style={{
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.8rem',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                >
                  {/* Category badge */}
                  {d.category && (
                    <span style={{
                      position: 'absolute', top: 16, left: 16,
                      background: 'rgba(139,92,246,0.25)', color: '#a78bfa',
                      fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px',
                      textTransform: 'uppercase', letterSpacing: '0.02em', zIndex: 2
                    }}>
                      {d.category}
                    </span>
                  )}

                  {/* Status badge */}
                  <span style={{
                    position: 'absolute', top: 16, right: 16,
                    background: d.status === 'Active' ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)',
                    color: d.status === 'Active' ? '#34d399' : 'var(--text-muted)',
                    fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px',
                    border: d.status === 'Active' ? '1px solid rgba(52,211,153,0.3)' : '1px solid var(--border-light)',
                    zIndex: 2
                  }}>
                    {d.status}
                  </span>

                  {/* Main Image View */}
                  <div
                    style={{
                      height: '180px',
                      background: '#04070d',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      border: '1px solid var(--border-light)',
                      marginTop: '1.25rem'
                    }}
                  >
                    {mainImg ? (
                      <img
                        src={mainImg}
                        alt={d.designName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }}
                        onClick={() => setZoomImg(mainImg)}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}

                    {(!mainImg) && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--text-muted)', gap: '0.4rem' }}>
                        <Image size={24} style={{ opacity: 0.3 }} />
                        <span style={{ fontSize: '0.7rem' }}>No Design Image</span>
                      </div>
                    )}
                    {mainImg && (
                      <div style={{ display: 'none', position: 'absolute', inset: 0, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', color: 'var(--text-muted)', gap: '0.4rem' }}>
                        <Image size={24} style={{ opacity: 0.3 }} />
                        <span style={{ fontSize: '0.7rem', padding: '0.5rem', textAlign: 'center' }}>🔒 CORS blocked preview</span>
                      </div>
                    )}

                    {/* Small Sub image thumbnail inside card if available */}
                    {subImg && (
                      <div
                        onClick={() => setZoomImg(subImg)}
                        style={{
                          position: 'absolute', bottom: 6, right: 6, width: '36px', height: '36px',
                          border: '1px solid var(--border-light)', borderRadius: '4px', overflow: 'hidden',
                          background: '#000', cursor: 'pointer', zIndex: 3
                        }}
                      >
                        <img src={subImg} alt="Sub view" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                  </div>

                  {/* Design Info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
                        {d.designName}
                      </span>
                      {d.designerName && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                          By: {d.designerName}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem 0.5rem', fontSize: '0.78rem', borderTop: '1px dashed var(--border-light)', paddingTop: '0.5rem' }}>
                      {[
                        ['Colour Match', d.colourMatching],
                        ['Fabric', d.fabricName],
                        ['Fusing Temp', d.fusingTemp],
                        ['Speed', d.speed],
                        ['Colors', d.colors],
                        ['Panna/Pass', d.panna && d.pass ? `${d.panna}" / ${d.pass}P` : d.panna || d.pass || '—']
                      ].map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{k}</span>
                          {k === 'Colors' && v ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              {getColorHex(v) && (
                                <span style={{
                                  display: 'inline-block',
                                  width: '10px',
                                  height: '10px',
                                  borderRadius: '2px',
                                  backgroundColor: getColorHex(v),
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  flexShrink: 0
                                }} />
                              )}
                              <span style={{ color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {v}
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {v || '—'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {d.notes && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', padding: '0.35rem 0.5rem', borderRadius: 4, fontStyle: 'italic' }}>
                        Notes: {d.notes}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.7rem', marginTop: 'auto' }}>
                    <button onClick={() => openEdit(d)} className="btn-secondary" style={{ flex: 1, padding: '0.4rem', fontSize: '0.78rem', justifyContent: 'center' }}>
                      <Edit2 size={13} /> Edit Design
                    </button>
                    <button
                      onClick={() => handleDelete(d._id, d.designName)}
                      style={{
                        padding: '0.4rem 0.7rem', fontSize: '0.78rem', borderRadius: 'var(--radius-sm)',
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                        color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem',
                        fontFamily: 'var(--font-sans)', transition: 'all 0.15s'
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-icon">
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Page {page} of {pages}</span>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="btn-icon">
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '2rem' }}>
          <div style={{ background: 'var(--bg-modal,#161b26)', border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 700,
            boxShadow: 'var(--shadow-lg)', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary-glow)' }}>
                  <Image size={18} color="var(--primary)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {formDesign ? `Edit Design — ${formDesign.designName}` : 'New Master Design'}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>Design Catalogue parameters</p>
                </div>
              </div>
              <button onClick={() => setShowForm(false)} className="btn-icon"><X size={16} /></button>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleFormSubmit} style={{ overflowY: 'auto', padding: '1.25rem 1.5rem', flex: 1, display: 'flex', flexFlow: 'row wrap', gap: '0.85rem' }}>
              {formError && (
                <div style={{ width: '100%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.9rem', color: '#fca5a5', fontSize: '0.8rem' }}>
                  {formError}
                </div>
              )}

              <FormField label="Design Name (e.g. ED1, ED2)" name="designName" value={formVal.designName} onChange={handleFormChange} required placeholder="ED1" />
              {(() => {
                const nameExists = allDesignsList.some(d => 
                  d.designName.toLowerCase() === formVal.designName.trim().toLowerCase() && 
                  (!formDesign || d._id !== formDesign._id)
                );
                if (nameExists && formVal.designName.trim()) {
                  return (
                    <div style={{ color: '#fbbf24', fontSize: '0.72rem', fontWeight: 600, width: '100%', marginTop: '-0.4rem', paddingLeft: '4px' }}>
                      ⚠️ Notice: A design named "{formVal.designName}" already exists. Saving will overwrite or fail.
                    </div>
                  );
                }
                return null;
              })()}
              <FormField label="Designer Name" name="designerName" value={formVal.designerName} onChange={handleFormChange} options={['', ...(printConfig.designers || [])]} placeholder="e.g. Rahul" />
              <FormField label="Colour Matching Name" name="colourMatching" value={formVal.colourMatching} onChange={handleFormChange} options={['', ...(printConfig.designers || [])]} placeholder="e.g. Green Matching" />
              <FormField label="Fabric Name" name="fabricName" value={formVal.fabricName} onChange={handleFormChange} options={['', ...(printConfig.fabrics || [])]} />
              <FormField label="Paper Type" name="paperType" value={formVal.paperType} onChange={handleFormChange} options={['', ...(printConfig.paperTypes || [])]} />

              {/* Section: Fusing Configuration */}
              <div style={{
                fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                color: 'var(--primary)', marginBottom: '0.4rem', marginTop: '0.8rem', width: '100%',
                borderBottom: '1px solid var(--border-light)', paddingBottom: '0.2rem'
              }}>
                🔥 Fusing Configuration
              </div>
              <FormField label="Fusing Temperature" name="fusingTemp" value={formVal.fusingTemp} onChange={handleFormChange} options={['', ...(printConfig.temperatures || [])]} />
              <FormField label="Speed" name="speed" value={formVal.speed} onChange={handleFormChange} options={['', ...(printConfig.speeds || [])]} />

              {/* Section: Print Configuration */}
              <div style={{
                fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                color: 'var(--primary)', marginBottom: '0.4rem', marginTop: '0.8rem', width: '100%',
                borderBottom: '1px solid var(--border-light)', paddingBottom: '0.2rem'
              }}>
                🖨 Print Configuration
              </div>
              <FormField label="Colour" name="colors" value={formVal.colors} onChange={handleFormChange} options={COLOR_NAMES} placeholder="Select or type colour..." />

              {/* Auto-detect color from image button */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleAutoDetectColor}
                  disabled={detectingColor || !formVal.imageUrl}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    fontFamily: 'var(--font-sans)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid',
                    borderColor: !formVal.imageUrl ? 'var(--border-light)' : 'rgba(139,92,246,0.4)',
                    background: !formVal.imageUrl ? 'rgba(255,255,255,0.02)' : 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(56,189,248,0.15))',
                    color: !formVal.imageUrl ? 'var(--text-muted)' : '#a78bfa',
                    cursor: !formVal.imageUrl ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s',
                    width: 'fit-content'
                  }}
                  onMouseEnter={e => { if (formVal.imageUrl) { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.7)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(139,92,246,0.2)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = !formVal.imageUrl ? 'var(--border-light)' : 'rgba(139,92,246,0.4)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  {detectingColor ? (
                    <><RefreshCw size={14} className="spin-loader" /> Detecting colours...</>
                  ) : (
                    <><span style={{ fontSize: '1rem' }}>🪄</span> Auto-detect Colour from Image</>
                  )}
                </button>

                {!formVal.imageUrl && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Upload or paste an image above first to enable auto-detection
                  </span>
                )}

                {/* Detected colors result swatches */}
                {detectedColors && detectedColors.length > 0 && (
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: '0.4rem',
                    background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)',
                    borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.8rem'
                  }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Detected Colours (click to select)
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {detectedColors.map((c, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setFormVal(prev => ({ ...prev, colors: c.name }))}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.35rem 0.7rem', borderRadius: 'var(--radius-sm)',
                            border: formVal.colors === c.name ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                            background: formVal.colors === c.name ? 'var(--nav-active-bg)' : 'rgba(255,255,255,0.03)',
                            cursor: 'pointer', transition: 'all 0.15s',
                            fontFamily: 'var(--font-sans)'
                          }}
                        >
                          <span style={{
                            width: '16px', height: '16px', borderRadius: '3px',
                            backgroundColor: c.hex, border: '1px solid rgba(255,255,255,0.2)',
                            flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                          }} />
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {c.name}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            {c.percentage}%
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <FormField label="Panna (width)" name="panna" value={formVal.panna} onChange={handleFormChange} options={['', ...(printConfig.widths || [])]} />
              
              {printConfig.machines?.map(machine => (
                <FormField 
                  key={machine.name}
                  label={`${machine.name} Profile`} 
                  name={`profile_${machine.name}`} 
                  value={(formVal.machineProfiles || {})[machine.name] || ''} 
                  onChange={e => handleMachineProfileChange(machine.name, e.target.value)} 
                  options={['', ...(machine.profiles || [])]} 
                />
              ))}

              <FormField label="Pass" name="pass" value={formVal.pass} onChange={handleFormChange} options={['', ...printConfig.passes]} />
              <FormField label="Category" name="category" value={formVal.category} onChange={handleFormChange} options={['', ...printConfig.categories]} />

              <DesignImageField label="Primary Design Image URL (Google Drive Share Link)" name="imageUrl" value={formVal.imageUrl} onChange={handleFormChange} placeholder="Paste Drive link..." />
              {(() => {
                const imageExists = formVal.imageUrl && allDesignsList.find(d => 
                  d.imageUrl === formVal.imageUrl && 
                  (!formDesign || d._id !== formDesign._id)
                );
                if (imageExists) {
                  return (
                    <div style={{ color: '#fbbf24', fontSize: '0.72rem', fontWeight: 600, width: '100%', marginTop: '-0.4rem', paddingLeft: '4px' }}>
                      ⚠️ Notice: This image is already used by design "{imageExists.designName}".
                    </div>
                  );
                }
                return null;
              })()}
              <DesignImageField label="Secondary Design Image URL (Optional)" name="imageUrl2" value={formVal.imageUrl2} onChange={handleFormChange} placeholder="Paste Drive link..." />

              {/* Section: 100 Pcs Standards */}
              <div style={{
                fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                color: 'var(--primary)', marginBottom: '0.4rem', marginTop: '0.8rem', width: '100%',
                borderBottom: '1px solid var(--border-light)', paddingBottom: '0.2rem'
              }}>
                👗 100 Pcs Standards (for Job Card auto-calculations)
              </div>
              <FormField label="Top (100 Pcs)" name="top100" value={formVal.top100} onChange={handleFormChange} type="number" placeholder="e.g. 250" />
              <FormField label="Sleeve (100 Pcs)" name="sleeve100" value={formVal.sleeve100} onChange={handleFormChange} type="number" placeholder="e.g. 60" />
              <FormField label="Bottom (100 Pcs)" name="bottom100" value={formVal.bottom100} onChange={handleFormChange} type="number" placeholder="e.g. 200" />
              <FormField label="Dupatta (100 Pcs)" name="dupatta100" value={formVal.dupatta100} onChange={handleFormChange} type="number" placeholder="e.g. 225" />
              <FormField label="Cut (100 Pcs)" name="cut100" value={formVal.cut100} onChange={handleFormChange} type="number" placeholder="e.g. 735" />
              <FormField label="Total Mtr (mtr per 100 pcs)" name="totalMtr100" value={formVal.totalMtr100} onChange={handleFormChange} type="number" placeholder="e.g. 735" />
              <FormField label="Set Copy (100 Pcs)" name="setCopy100" value={formVal.setCopy100} onChange={handleFormChange} type="number" placeholder="e.g. 100" />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', width: '100%' }}>
                <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Notes / Printing Instructions</label>
                <textarea
                  name="notes"
                  value={formVal.notes}
                  onChange={handleFormChange}
                  rows={2}
                  placeholder="Any extra instructions..."
                  style={{ width: '100%', padding: '0.5rem 0.7rem', fontSize: '0.85rem', background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
                />
              </div>

              <FormField label="Status" name="status" value={formVal.status} onChange={handleFormChange} options={['Active', 'Inactive']} />

              {/* Actions Footer */}
              <div style={{ width: '100%', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem', marginTop: '0.75rem' }}>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary" style={{ padding: '0.5rem 1.2rem' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '0.5rem 1.5rem' }}>
                  <Save size={14} style={{ marginRight: '0.25rem' }} /> {saving ? 'Saving...' : 'Save Design'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Auto-detect Progress Modal */}
      {bulkDetecting && (
        <div className="modal-overlay" style={{ alignItems: 'center', zIndex: 10000 }}>
          <div style={{
            background: 'var(--bg-modal,#161b26)', border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 560,
            boxShadow: 'var(--shadow-lg)', overflow: 'hidden', maxHeight: '85vh', display: 'flex', flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(56,189,248,0.2))' }}>
                  <span style={{ fontSize: '1.2rem' }}>🎨</span>
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Auto-setting All Colours
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>
                    Analyzing design images...
                  </p>
                </div>
              </div>
              {bulkProgress.current === bulkProgress.total && bulkProgress.total > 0 && (
                <button onClick={() => setBulkDetecting(false)} className="btn-icon"><X size={16} /></button>
              )}
            </div>

            {/* Progress bar */}
            <div style={{ padding: '1rem 1.5rem', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {bulkProgress.current} / {bulkProgress.total} designs
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {bulkProgress.total > 0 ? Math.round((bulkProgress.current / bulkProgress.total) * 100) : 0}%
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{
                  width: `${bulkProgress.total > 0 ? (bulkProgress.current / bulkProgress.total) * 100 : 0}%`,
                  height: '100%',
                  borderRadius: '4px',
                  background: 'linear-gradient(90deg, #8b5cf6, #38bdf8)',
                  transition: 'width 0.3s ease'
                }} />
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.8rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <CheckCircle size={14} color="#34d399" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#34d399' }}>{bulkProgress.updated}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Updated</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <AlertCircle size={14} color="#fbbf24" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fbbf24' }}>{bulkProgress.skipped}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Skipped</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <X size={14} color="#f87171" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f87171' }}>{bulkProgress.failed}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Failed</span>
                </div>
              </div>
            </div>

            {/* Log */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.5rem 1.25rem', maxHeight: '340px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {bulkProgress.log.slice().reverse().map((entry, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.6rem',
                    borderRadius: 'var(--radius-sm)', fontSize: '0.78rem',
                    background: entry.status === 'updated' ? 'rgba(52,211,153,0.06)' : entry.status === 'failed' ? 'rgba(248,113,113,0.06)' : 'rgba(255,255,255,0.02)',
                    border: '1px solid',
                    borderColor: entry.status === 'updated' ? 'rgba(52,211,153,0.12)' : entry.status === 'failed' ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.04)'
                  }}>
                    {entry.status === 'updated' && <CheckCircle size={12} color="#34d399" />}
                    {entry.status === 'skipped' && <AlertCircle size={12} color="#fbbf24" />}
                    {entry.status === 'failed' && <X size={12} color="#f87171" />}
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', minWidth: '60px' }}>{entry.name}</span>
                    {entry.status === 'updated' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>→</span>
                        <span style={{
                          width: '12px', height: '12px', borderRadius: '2px',
                          backgroundColor: getColorHex(entry.color) || '#000', border: '1px solid rgba(255,255,255,0.2)',
                          flexShrink: 0
                        }} />
                        <span style={{ color: '#34d399', fontWeight: 600 }}>{entry.color}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>({entry.pct}%)</span>
                      </div>
                    ) : (
                      <span style={{ color: entry.status === 'failed' ? '#f87171' : '#fbbf24', fontSize: '0.72rem' }}>
                        {entry.reason}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Done footer */}
            {bulkProgress.current === bulkProgress.total && bulkProgress.total > 0 && (
              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                <button onClick={() => setBulkDetecting(false)} className="btn-primary" style={{ padding: '0.5rem 1.5rem' }}>
                  <CheckCircle size={14} style={{ marginRight: '0.3rem' }} /> Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox / Zoom modal */}
      {zoomImg && (
        <div
          onClick={() => setZoomImg(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out'
          }}
        >
          <button
            onClick={() => setZoomImg(null)}
            style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--text-primary)', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
          <img src={zoomImg} alt="Zoomed view" style={{ maxWidth: '94%', maxHeight: '90%', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }} />
        </div>
      )}
    </div>
  );
}
