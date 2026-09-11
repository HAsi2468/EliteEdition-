import React, { useState } from 'react';
import { X, Building2, Plus, Trash2, CheckCircle, Tag, Sparkles } from 'lucide-react';

export default function BrandManagerModal({ existingBrands, customBrands, onAddBrand, onDeleteBrand, onClose }) {
  const [newBrandName, setNewBrandName] = useState('');
  const [error, setError] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    setError('');
    const trimmed = newBrandName.trim();
    if (!trimmed) {
      setError('Brand name cannot be empty.');
      return;
    }

    const allCurrent = [...existingBrands, ...customBrands].map(b => b.toLowerCase());
    if (allCurrent.includes(trimmed.toLowerCase())) {
      setError('This brand already exists.');
      return;
    }

    onAddBrand(trimmed.toUpperCase());
    setNewBrandName('');
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
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
              <Building2 size={18} color="#059669" style={{ marginLeft: '10px' }} />
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
            <span>ALL ACTIVE BRANDS ({existingBrands.length + customBrands.length})</span>
          </div>

          <div style={styles.brandsGrid}>
            {/* Custom Brands First */}
            {customBrands.map((brand, idx) => (
              <div key={`custom-${idx}`} style={styles.brandChipCustom}>
                <div style={styles.brandChipLeft}>
                  <Tag size={13} color="#059669" />
                  <span style={styles.brandName}>{brand}</span>
                  <span style={styles.customBadge}>Custom</span>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteBrand(brand)}
                  style={styles.deleteBtn}
                  title={`Delete ${brand}`}
                >
                  <Trash2 size={14} color="#ef4444" />
                </button>
              </div>
            ))}

            {/* Catalog Brands */}
            {existingBrands.map((brand, idx) => (
              <div key={`cat-${idx}`} style={styles.brandChip}>
                <div style={styles.brandChipLeft}>
                  <Tag size={13} color="#64748b" />
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    padding: '1.25rem',
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '560px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '85vh',
  },
  header: {
    padding: '1.25rem 1.5rem',
    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
    borderBottom: '1px solid #e2e8f0',
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
    backgroundColor: '#d1fae5',
    color: '#047857',
    fontSize: '0.7rem',
    fontWeight: '700',
    padding: '0.2rem 0.6rem',
    borderRadius: '20px',
    letterSpacing: '0.05em',
    width: 'fit-content',
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: '700',
    color: '#0f172a',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.8rem',
    color: '#64748b',
    margin: 0,
  },
  closeBtn: {
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748b',
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
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
    gap: '0.5rem',
  },
  input: {
    flex: 1,
    border: 'none',
    outline: 'none',
    padding: '0.6rem 0.5rem',
    fontSize: '0.875rem',
    backgroundColor: 'transparent',
    color: '#0f172a',
    fontWeight: '600',
  },
  addBtn: {
    backgroundColor: '#059669',
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
    color: '#dc2626',
    fontWeight: '600',
    marginLeft: '4px',
  },
  sectionTitle: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #f1f5f9',
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
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    padding: '0.4rem 0.75rem',
    borderRadius: '8px',
    gap: '0.75rem',
    fontSize: '0.825rem',
  },
  brandChipCustom: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ecfdf5',
    border: '1px solid #a7f3d0',
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
    color: '#0f172a',
  },
  catBadge: {
    fontSize: '0.65rem',
    color: '#64748b',
    backgroundColor: '#e2e8f0',
    padding: '0.15rem 0.4rem',
    borderRadius: '4px',
    fontWeight: '600',
  },
  customBadge: {
    fontSize: '0.65rem',
    color: '#047857',
    backgroundColor: '#d1fae5',
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
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'flex-end',
    backgroundColor: '#f8fafc',
  },
  doneBtn: {
    padding: '0.55rem 1.5rem',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#0f172a',
    color: '#ffffff',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
};
