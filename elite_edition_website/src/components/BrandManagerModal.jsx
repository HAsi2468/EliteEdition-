import React, { useState } from 'react';
import { X, Building2, Plus, Trash2, CheckCircle, Tag, Sparkles } from 'lucide-react';

export default function BrandManagerModal({ 
  existingBrands = [], 
  customBrands = [], 
  onAddBrand, 
  onDeleteBrand, 
  onClose 
}) {
  const [newBrandName, setNewBrandName] = useState('');
  const [error, setError] = useState('');

  const safeExisting = Array.isArray(existingBrands) ? existingBrands : [];
  const safeCustom = Array.isArray(customBrands) ? customBrands : [];

  const handleAdd = (e) => {
    e.preventDefault();
    setError('');
    const trimmed = newBrandName.trim();
    if (!trimmed) {
      setError('Brand name cannot be empty.');
      return;
    }

    const allCurrent = [...safeExisting, ...safeCustom].map(b => (b || '').toLowerCase());
    if (allCurrent.includes(trimmed.toLowerCase())) {
      setError('This brand already exists.');
      return;
    }

    if (onAddBrand) {
      onAddBrand(trimmed.toUpperCase());
    }
    setNewBrandName('');
  };

  return (
    <div className="modal-overlay" style={styles.overlay} onClick={onClose}>
      <div style={styles.container} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitleGroup}>
            <div style={styles.badge}>
              <Sparkles size={14} style={{ marginRight: '6px' }} />
              DYNAMIC BRAND MANAGER
            </div>
            <h2 style={styles.title}>Manage Catalog Brands</h2>
            <p style={styles.subtitle}>
              Add and manage brand values used for catalog filtering and product creation.
            </p>
          </div>
          <button onClick={onClose} style={styles.closeBtn} title="Close Modal">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={styles.body}>
          {/* Add Brand Form */}
          <form onSubmit={handleAdd} style={styles.addForm}>
            <div style={styles.inputGroup}>
              <Building2 size={18} color="#10b981" style={{ marginLeft: '10px' }} />
              <input
                type="text"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                placeholder="Type new brand name (e.g. ZARA, HERA, MYNTRA)..."
                style={styles.input}
              />
              <button type="submit" style={styles.addBtn}>
                <Plus size={16} />
                Add Brand
              </button>
            </div>
            {error && <span style={styles.errorText}>{error}</span>}
          </form>

          {/* Brands List */}
          <div style={styles.sectionTitle}>
            <span>ALL ACTIVE BRANDS ({safeExisting.length + safeCustom.length})</span>
          </div>

          <div style={styles.brandsGrid}>
            {/* Custom Brands First */}
            {safeCustom.map((brand, idx) => (
              <div key={`custom-${idx}`} style={styles.brandChipCustom}>
                <div style={styles.brandChipLeft}>
                  <Tag size={13} color="#34d399" />
                  <span style={styles.brandNameCustom}>{brand}</span>
                  <span style={styles.customBadge}>Custom</span>
                </div>
                {onDeleteBrand && (
                  <button
                    type="button"
                    onClick={() => onDeleteBrand(brand)}
                    style={styles.deleteBtn}
                    title={`Delete ${brand}`}
                  >
                    <Trash2 size={14} color="#f87171" />
                  </button>
                )}
              </div>
            ))}

            {/* Catalog Brands */}
            {safeExisting.map((brand, idx) => (
              <div key={`cat-${idx}`} style={styles.brandChip}>
                <div style={styles.brandChipLeft}>
                  <Tag size={13} color="#94a3b8" />
                  <span style={styles.brandName}>{brand}</span>
                </div>
                <span style={styles.catBadge}>Catalog</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button type="button" onClick={onClose} style={styles.doneBtn}>
            <CheckCircle size={16} />
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(3, 7, 18, 0.75)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100000,
    padding: '1.25rem',
  },
  container: {
    backgroundColor: '#1e293b',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '560px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '85vh',
  },
  header: {
    padding: '1.25rem 1.5rem',
    background: '#0f172a',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitleGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: '#34d399',
    fontSize: '0.7rem',
    fontWeight: '700',
    padding: '0.2rem 0.6rem',
    borderRadius: '20px',
    letterSpacing: '0.05em',
    width: 'fit-content',
    border: '1px solid rgba(16, 185, 129, 0.3)',
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: '700',
    color: '#f8fafc',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    margin: 0,
  },
  closeBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94a3b8',
    cursor: 'pointer',
  },
  body: {
    padding: '1.25rem 1.5rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  addForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  inputGroup: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '8px',
    backgroundColor: '#0f172a',
    overflow: 'hidden',
    gap: '0.5rem',
  },
  input: {
    flex: 1,
    border: 'none',
    outline: 'none',
    padding: '0.65rem 0.5rem',
    fontSize: '0.875rem',
    backgroundColor: 'transparent',
    color: '#f8fafc',
    fontWeight: '600',
  },
  addBtn: {
    backgroundColor: '#10b981',
    color: '#ffffff',
    border: 'none',
    padding: '0.65rem 1rem',
    fontWeight: '700',
    fontSize: '0.825rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
  },
  errorText: {
    fontSize: '0.75rem',
    color: '#f87171',
    fontWeight: '600',
    marginLeft: '4px',
  },
  sectionTitle: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: '0.05em',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '0.35rem',
  },
  brandsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  brandChip: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '0.4rem 0.75rem',
    borderRadius: '8px',
    gap: '0.75rem',
    fontSize: '0.825rem',
  },
  brandChipCustom: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    padding: '0.4rem 0.75rem',
    borderRadius: '8px',
    gap: '0.75rem',
    fontSize: '0.825rem',
  },
  brandChipLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  brandName: {
    fontWeight: '700',
    color: '#cbd5e1',
  },
  brandNameCustom: {
    fontWeight: '700',
    color: '#34d399',
  },
  catBadge: {
    fontSize: '0.65rem',
    color: '#94a3b8',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: '0.15rem 0.4rem',
    borderRadius: '4px',
    fontWeight: '600',
  },
  customBadge: {
    fontSize: '0.65rem',
    color: '#34d399',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    padding: '0.15rem 0.4rem',
    borderRadius: '4px',
    fontWeight: '700',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.1rem',
    display: 'flex',
    alignItems: 'center',
  },
  footer: {
    padding: '1rem 1.5rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    justifyContent: 'flex-end',
    backgroundColor: '#0f172a',
  },
  doneBtn: {
    padding: '0.55rem 1.5rem',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#10b981',
    color: '#ffffff',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
};
