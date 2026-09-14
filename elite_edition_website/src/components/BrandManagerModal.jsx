import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, Building2, Plus, Trash2, CheckCircle, Tag, Sparkles, Search, Edit2, Check, AlertCircle } from 'lucide-react';

export default function BrandManagerModal({ 
  existingBrands = [], 
  customBrands: propCustomBrands, 
  onAddBrand, 
  onDeleteBrand,
  onUpdateBrand,
  onClose 
}) {
  const [newBrandName, setNewBrandName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingBrand, setEditingBrand] = useState(null); // Brand name being edited
  const [editInputValue, setEditInputValue] = useState('');

  // Scroll preservation reference
  const scrollPosRef = useRef(0);

  useEffect(() => {
    scrollPosRef.current = window.scrollY || document.documentElement.scrollTop || 0;
    return () => {
      const targetY = scrollPosRef.current;
      if (typeof window !== 'undefined' && targetY > 0) {
        window.scrollTo({ top: targetY, behavior: 'instant' });
        setTimeout(() => window.scrollTo({ top: targetY, behavior: 'instant' }), 30);
        setTimeout(() => window.scrollTo({ top: targetY, behavior: 'instant' }), 100);
        setTimeout(() => window.scrollTo({ top: targetY, behavior: 'instant' }), 300);
      }
    };
  }, []);

  const handleModalClose = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    const targetY = scrollPosRef.current || window.scrollY || 0;
    if (onClose) onClose();

    if (typeof window !== 'undefined' && targetY > 0) {
      window.scrollTo({ top: targetY, behavior: 'instant' });
      requestAnimationFrame(() => window.scrollTo({ top: targetY, behavior: 'instant' }));
      setTimeout(() => window.scrollTo({ top: targetY, behavior: 'instant' }), 30);
      setTimeout(() => window.scrollTo({ top: targetY, behavior: 'instant' }), 100);
      setTimeout(() => window.scrollTo({ top: targetY, behavior: 'instant' }), 300);
    }
  };

  // Internal custom brands state synced with localStorage
  const [customBrands, setCustomBrands] = useState(() => {
    if (Array.isArray(propCustomBrands) && propCustomBrands.length > 0) {
      return propCustomBrands;
    }
    try {
      const saved = localStorage.getItem('elite_managed_brands');
      return saved ? JSON.parse(saved) : ['ANOUK', 'ELITE EDITION', 'HERA', 'MYNTRA'];
    } catch (e) {
      return ['ANOUK', 'ELITE EDITION', 'HERA', 'MYNTRA'];
    }
  });

  // Keep state updated if prop changes
  useEffect(() => {
    if (Array.isArray(propCustomBrands) && propCustomBrands.length > 0) {
      setCustomBrands(propCustomBrands);
    }
  }, [propCustomBrands]);

  // Handle Keyboard ESC to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleModalClose(e);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const safeExisting = useMemo(() => {
    return Array.isArray(existingBrands) ? existingBrands.filter(Boolean) : [];
  }, [existingBrands]);

  // Combined active brands list
  const allCurrentBrands = useMemo(() => {
    const set = new Set();
    [...customBrands, ...safeExisting].forEach(b => {
      if (b && typeof b === 'string') set.add(b.toUpperCase());
    });
    return Array.from(set).sort();
  }, [customBrands, safeExisting]);

  // Filtered brands matching search query
  const filteredBrands = useMemo(() => {
    if (!searchTerm.trim()) return allCurrentBrands;
    return allCurrentBrands.filter(b => b.toLowerCase().includes(searchTerm.trim().toLowerCase()));
  }, [allCurrentBrands, searchTerm]);

  // Helper to persist custom brands
  const persistBrands = (newBrandsList) => {
    setCustomBrands(newBrandsList);
    try {
      localStorage.setItem('elite_managed_brands', JSON.stringify(newBrandsList));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('elite_brands_updated', { detail: newBrandsList }));
    } catch (e) {
      console.error('Failed to save brands to localStorage', e);
    }
  };

  // --- ADD BRAND ---
  const handleAdd = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const trimmed = newBrandName.trim().toUpperCase();

    if (!trimmed) {
      setError('Brand name cannot be empty.');
      return;
    }

    if (allCurrentBrands.some(b => b.toLowerCase() === trimmed.toLowerCase())) {
      setError(`Brand "${trimmed}" already exists.`);
      return;
    }

    const updated = [...customBrands, trimmed];
    persistBrands(updated);

    if (onAddBrand) {
      onAddBrand(trimmed);
    }

    setNewBrandName('');
    setSuccess(`Brand "${trimmed}" added successfully.`);
    setTimeout(() => setSuccess(''), 3000);
  };

  // --- DELETE BRAND ---
  const handleDelete = (brandToDelete) => {
    if (!window.confirm(`Delete custom brand "${brandToDelete}"?`)) {
      return;
    }

    setError('');
    setSuccess('');

    const updated = customBrands.filter(b => b.toLowerCase() !== brandToDelete.toLowerCase());
    persistBrands(updated);

    if (onDeleteBrand) {
      onDeleteBrand(brandToDelete);
    }

    setSuccess(`Brand "${brandToDelete}" removed.`);
    setTimeout(() => setSuccess(''), 3000);
  };

  // --- START EDIT BRAND ---
  const startEdit = (brandName) => {
    setEditingBrand(brandName);
    setEditInputValue(brandName);
    setError('');
  };

  // --- SAVE EDIT BRAND ---
  const saveEdit = (oldBrandName) => {
    const trimmed = editInputValue.trim().toUpperCase();
    if (!trimmed) {
      setError('Brand name cannot be empty.');
      return;
    }

    if (trimmed !== oldBrandName.toUpperCase() && allCurrentBrands.some(b => b.toLowerCase() === trimmed.toLowerCase())) {
      setError(`Brand "${trimmed}" already exists.`);
      return;
    }

    const updated = customBrands.map(b => (b.toLowerCase() === oldBrandName.toLowerCase() ? trimmed : b));
    persistBrands(updated);

    if (onUpdateBrand) {
      onUpdateBrand(oldBrandName, trimmed);
    }

    setEditingBrand(null);
    setSuccess(`Updated to "${trimmed}".`);
    setTimeout(() => setSuccess(''), 3000);
  };

  const modalMarkup = (
    <div className="modal-overlay" style={styles.overlay} onClick={handleModalClose}>
      <div style={styles.container} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitleGroup}>
            <div style={styles.badge}>
              <Sparkles size={13} style={{ marginRight: '4px' }} />
              DYNAMIC BRAND MANAGER
            </div>
            <h2 style={styles.title}>Manage Catalog Brands</h2>
          </div>
          <button type="button" onClick={handleModalClose} style={styles.closeBtn} title="Close Modal (Esc)">
            <X size={18} />
          </button>
        </div>

        {/* Stats Strip */}
        <div style={styles.statsStrip}>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>TOTAL BRANDS</span>
            <span style={styles.statValue}>{allCurrentBrands.length}</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statBox}>
            <span style={styles.statLabel}>CUSTOM BRANDS</span>
            <span style={styles.statValueCustom}>{customBrands.length}</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statBox}>
            <span style={styles.statLabel}>CATALOG BRANDS</span>
            <span style={styles.statValueCat}>{safeExisting.length}</span>
          </div>
        </div>

        {/* Modal Body */}
        <div style={styles.body}>
          {/* Status Feedback Alerts */}
          {error && (
            <div style={styles.alertError}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div style={styles.alertSuccess}>
              <CheckCircle size={14} style={{ flexShrink: 0 }} />
              <span>{success}</span>
            </div>
          )}

          {/* Quick Add Brand Input Strip */}
          <form onSubmit={handleAdd} style={styles.addForm}>
            <div style={styles.inputGroup}>
              <Building2 size={18} color="#2563eb" style={{ marginLeft: '10px', flexShrink: 0 }} />
              <input
                type="text"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                placeholder="Type new brand name (e.g. ZARA, HERA, MYNTRA)..."
                style={styles.input}
                autoFocus
              />
              <button type="submit" style={styles.addBtn}>
                <Plus size={15} />
                <span>Add Brand</span>
              </button>
            </div>
          </form>

          {/* Search Filter Bar */}
          <div style={styles.searchWrap}>
            <Search size={15} color="#64748b" style={{ marginLeft: '10px', flexShrink: 0 }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search brand list..."
              style={styles.searchInput}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} style={styles.clearSearchBtn} title="Clear Search">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Brands Directory Grid */}
          <div style={styles.sectionHeader}>
            <span>ACTIVE BRANDS DIRECTORY ({filteredBrands.length})</span>
          </div>

          <div style={styles.brandsGrid}>
            {filteredBrands.length === 0 ? (
              <div style={styles.emptyState}>
                <Tag size={24} color="#94a3b8" />
                <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                  {searchTerm ? `No brands matching "${searchTerm}"` : 'No active brands available.'}
                </p>
              </div>
            ) : (
              filteredBrands.map((brand, idx) => {
                const isCustom = customBrands.some(cb => cb.toLowerCase() === brand.toLowerCase());
                const isEditing = editingBrand === brand;

                if (isEditing) {
                  return (
                    <div key={`edit-${idx}`} style={styles.brandChipEditing}>
                      <input
                        type="text"
                        value={editInputValue}
                        onChange={(e) => setEditInputValue(e.target.value)}
                        style={styles.editInput}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(brand);
                          if (e.key === 'Escape') setEditingBrand(null);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => saveEdit(brand)}
                        style={styles.saveBtn}
                        title="Save Brand Name"
                      >
                        <Check size={13} color="#ffffff" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingBrand(null)}
                        style={styles.cancelBtn}
                        title="Cancel Editing"
                      >
                        <X size={13} color="#64748b" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={`brand-${idx}`} style={isCustom ? styles.brandChipCustom : styles.brandChip}>
                    <div style={styles.brandChipLeft}>
                      <Tag size={13} color={isCustom ? '#2563eb' : '#64748b'} />
                      <span style={isCustom ? styles.brandNameCustom : styles.brandName}>{brand}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span style={isCustom ? styles.customBadge : styles.catBadge}>
                        {isCustom ? 'Custom' : 'Catalog'}
                      </span>

                      {isCustom && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(brand)}
                            style={styles.actionIconBtn}
                            title={`Rename ${brand}`}
                          >
                            <Edit2 size={13} color="#2563eb" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(brand)}
                            style={styles.actionIconBtn}
                            title={`Delete ${brand}`}
                          >
                            <Trash2 size={13} color="#ef4444" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button type="button" onClick={handleModalClose} style={styles.doneBtn}>
            <CheckCircle size={15} />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return ReactDOM.createPortal(modalMarkup, document.body);
  }
  return modalMarkup;
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999999,
    padding: '1rem',
    boxSizing: 'border-box',
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '14px',
    width: '100%',
    maxWidth: '540px',
    boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35), 0 2px 4px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '85vh',
    position: 'relative',
    margin: 'auto',
  },
  header: {
    padding: '1rem 1.25rem 0.85rem 1.25rem',
    background: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: '#e0e7ff',
    color: '#3730a3',
    fontSize: '0.65rem',
    fontWeight: '800',
    padding: '0.2rem 0.55rem',
    borderRadius: '20px',
    letterSpacing: '0.04em',
    border: '1px solid #c7d2fe',
  },
  title: {
    fontSize: '1.15rem',
    fontWeight: '800',
    color: '#0f172a',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  closeBtn: {
    background: '#f1f5f9',
    border: '1px solid #cbd5e1',
    borderRadius: '50%',
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748b',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  statsStrip: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
    borderBottom: '1px solid #e2e8f0',
    padding: '0.45rem 1rem',
  },
  statBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: '0.6rem',
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: '0.04em',
  },
  statValue: {
    fontSize: '1rem',
    fontWeight: '800',
    color: '#0f172a',
  },
  statValueCustom: {
    fontSize: '1rem',
    fontWeight: '800',
    color: '#2563eb',
  },
  statValueCat: {
    fontSize: '1rem',
    fontWeight: '800',
    color: '#475569',
  },
  statDivider: {
    width: '1px',
    height: '20px',
    backgroundColor: '#cbd5e1',
  },
  body: {
    padding: '1rem 1.25rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  alertError: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#991b1b',
    padding: '0.45rem 0.75rem',
    borderRadius: '6px',
    fontSize: '0.78rem',
    fontWeight: '600',
  },
  alertSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#166534',
    padding: '0.45rem 0.75rem',
    borderRadius: '6px',
    fontSize: '0.78rem',
    fontWeight: '600',
  },
  addForm: {
    display: 'flex',
    flexDirection: 'column',
  },
  inputGroup: {
    display: 'flex',
    alignItems: 'center',
    border: '2px solid #2563eb',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.12)',
  },
  input: {
    flex: 1,
    border: 'none',
    outline: 'none',
    padding: '0.55rem 0.65rem',
    fontSize: '0.85rem',
    backgroundColor: 'transparent',
    color: '#0f172a',
    fontWeight: '700',
  },
  addBtn: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    padding: '0.55rem 1rem',
    fontWeight: '800',
    fontSize: '0.825rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    transition: 'background 0.15s ease',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    padding: '0.45rem 0.65rem',
    fontSize: '0.8rem',
    backgroundColor: 'transparent',
    color: '#0f172a',
  },
  clearSearchBtn: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    padding: '0.25rem 0.5rem',
    display: 'flex',
    alignItems: 'center',
  },
  sectionHeader: {
    fontSize: '0.68rem',
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: '0.04em',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '0.25rem',
  },
  brandsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
    gap: '0.45rem',
    maxHeight: '260px',
    overflowY: 'auto',
    paddingRight: '2px',
  },
  emptyState: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem 1rem',
    textAlign: 'center',
  },
  brandChip: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    padding: '0.4rem 0.65rem',
    borderRadius: '6px',
    gap: '0.4rem',
  },
  brandChipCustom: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    padding: '0.4rem 0.65rem',
    borderRadius: '6px',
    gap: '0.4rem',
  },
  brandChipEditing: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    backgroundColor: '#ffffff',
    border: '1px solid #2563eb',
    padding: '0.25rem 0.45rem',
    borderRadius: '6px',
  },
  editInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: '#0f172a',
    fontSize: '0.82rem',
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: '4px',
    padding: '0.2rem 0.35rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  cancelBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.2rem',
    display: 'flex',
    alignItems: 'center',
  },
  brandChipLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    overflow: 'hidden',
  },
  brandName: {
    fontWeight: '700',
    color: '#334155',
    fontSize: '0.82rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  brandNameCustom: {
    fontWeight: '800',
    color: '#1e40af',
    fontSize: '0.82rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  catBadge: {
    fontSize: '0.62rem',
    color: '#64748b',
    backgroundColor: '#e2e8f0',
    padding: '0.1rem 0.35rem',
    borderRadius: '4px',
    fontWeight: '600',
  },
  customBadge: {
    fontSize: '0.62rem',
    color: '#1e40af',
    backgroundColor: '#dbeafe',
    padding: '0.1rem 0.35rem',
    borderRadius: '4px',
    fontWeight: '800',
  },
  actionIconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.1rem',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '3px',
  },
  footer: {
    padding: '0.75rem 1.25rem',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'flex-end',
    backgroundColor: '#f8fafc',
  },
  doneBtn: {
    padding: '0.5rem 1.4rem',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontSize: '0.825rem',
    fontWeight: '800',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
  },
};
