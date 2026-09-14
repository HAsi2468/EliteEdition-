import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, Sparkles, Layers, Tag, Building2, Barcode, DollarSign, Image as ImageIcon, CheckCircle, FileCode } from 'lucide-react';
import { api } from '../services/api';
import { extractSizeFromSku } from '../utils/skuHelper';

export default function InventoryForm({ item, onSubmit, onClose }) {
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

  const [formData, setFormData] = useState({
    skuCode: '',
    itemName: '',
    party: 'ANOUK',
    categoryName: 'KURTA SET',
    size: '',
    purchasePrice: 0.0,
    salePrice: 0.0,
    hsnCode: '',
    imageUrl: '',
    currentlyAvailableStock: 0,
    challanNo: '',
  });

  const [error, setError] = useState('');
  const [vendorsList, setVendorsList] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const loadFormData = async () => {
      try {
        const [vData, cData] = await Promise.all([
          api.getVendors().catch(() => []),
          api.getProductsCatalog().catch(() => []),
        ]);
        setVendorsList(vData || []);
        setCatalogItems(cData || []);
      } catch (err) {
        console.warn('Failed to load form reference data:', err);
      }
    };
    loadFormData();
  }, []);

  useEffect(() => {
    if (item) {
      const formattedSize = Array.isArray(item.size) 
        ? item.size.join(', ') 
        : (item.size || '');

      setFormData({
        skuCode: item.skuCode || '',
        itemName: item.description || item.itemName || '',
        party: item.brand || item.party || 'ANOUK',
        categoryName: item.categoryName || 'KURTA SET',
        size: formattedSize,
        purchasePrice: item.basePrice ?? item.purchasePrice ?? 0.0,
        salePrice: item.price ?? item.salePrice ?? 0.0,
        hsnCode: item.hsnCode || '',
        imageUrl: item.imageUrl || '',
        currentlyAvailableStock: item.currentlyAvailableStock ?? item.qty ?? 0,
        challanNo: item.challanNo || '',
      });
    }
  }, [item]);

  // Handle Input Changes
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'skuCode') {
      const sku = value;
      setImageError(false);
      
      const matchedCatalog = catalogItems.find(c => c.skuCode && c.skuCode.trim().toLowerCase() === sku.trim().toLowerCase());
      const extractedSize = extractSizeFromSku(sku);

      if (matchedCatalog) {
        setFormData(prev => ({
          ...prev,
          skuCode: sku,
          itemName: matchedCatalog.description || prev.itemName,
          party: matchedCatalog.brand || prev.party,
          categoryName: matchedCatalog.categoryName || prev.categoryName,
          size: Array.isArray(matchedCatalog.size) ? matchedCatalog.size.join(', ') : (matchedCatalog.size || extractedSize || prev.size),
          purchasePrice: matchedCatalog.basePrice ?? prev.purchasePrice,
          salePrice: matchedCatalog.price ?? prev.salePrice,
          hsnCode: matchedCatalog.hsnCode || prev.hsnCode,
          imageUrl: matchedCatalog.imageUrl || prev.imageUrl,
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          skuCode: sku,
          size: prev.size || extractedSize || '',
        }));
      }
    } else if (name === 'party') {
      const selectedVal = value;
      const matchedVendor = vendorsList.find(v => 
        (v.name && v.name.trim().toLowerCase() === selectedVal.trim().toLowerCase()) ||
        (v.businessName && v.businessName.trim().toLowerCase() === selectedVal.trim().toLowerCase())
      );
      const finalVendorName = matchedVendor && matchedVendor.businessName ? matchedVendor.businessName : selectedVal;
      setFormData(prev => ({
        ...prev,
        party: finalVendorName,
      }));
    } else if (name === 'imageUrl') {
      setImageError(false);
      setFormData(prev => ({ ...prev, imageUrl: value }));
    } else {
      const numericFields = ['purchasePrice', 'salePrice', 'currentlyAvailableStock'];
      setFormData(prev => ({
        ...prev,
        [name]: numericFields.includes(name) ? (value === '' ? '' : parseFloat(value) || 0) : value,
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!formData.skuCode.trim()) {
      setError('SKU Code is required.');
      return;
    }
    if (!formData.itemName.trim()) {
      setError('Product Name / Description is required.');
      return;
    }
    if (!formData.party.trim()) {
      setError('Brand / Vendor is required.');
      return;
    }
    if (!formData.size.trim()) {
      setError('Product Size is required.');
      return;
    }

    const payload = {
      ...formData,
      description: formData.itemName,
      brand: formData.party,
      basePrice: Number(formData.purchasePrice) || 0.0,
      price: Number(formData.salePrice) || 0.0,
      currentlyAvailableStock: Number(formData.currentlyAvailableStock) || 0,
      qty: Number(formData.currentlyAvailableStock) || 0,
    };

    onSubmit(payload);
  };

  // Managed brands array for datalist dropdown
  const managedBrands = (() => {
    try {
      const saved = localStorage.getItem('elite_managed_brands');
      const custom = saved ? JSON.parse(saved) : ['ANOUK', 'ELITE EDITION', 'HERA', 'MYNTRA'];
      const catBrands = catalogItems.map(c => c.brand).filter(Boolean);
      const vBrands = vendorsList.map(v => v.businessName || v.name).filter(Boolean);
      return Array.from(new Set([...custom, ...catBrands, ...vBrands])).sort();
    } catch (e) {
      return ['ANOUK', 'ELITE EDITION', 'HERA', 'MYNTRA'];
    }
  })();

  return (
    <div style={styles.overlay}>
      <div className="inventory-modal-container" style={styles.container}>
        {/* Modal Header */}
        <div style={styles.header}>
          <div style={styles.headerTitleGroup}>
            <div style={styles.badge}>
              <Sparkles size={14} style={{ marginRight: '6px' }} />
              PRODUCT MASTER MANAGEMENT
            </div>
            <h2 style={styles.title}>
              {item ? 'Edit Product Details' : 'Add New Product to Catalog'}
            </h2>
            <p style={styles.subtitle}>
              Manage product SKU, brand, category, description, sizes, pricing, and image URL.
            </p>
          </div>
          <button type="button" onClick={handleModalClose} style={styles.closeBtn} title="Close Form">
            <X size={20} />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={styles.errorBox}>
            <span>⚠️ {error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.formContent}>
          <div className="inventory-main-grid" style={styles.mainGrid}>
            {/* Left Card: Image Preview & Live Product Card */}
            <div className="inventory-summary-card" style={styles.summaryCard}>
              <div style={styles.imagePreviewContainer}>
                {formData.imageUrl && !imageError ? (
                  <img
                    src={formData.imageUrl}
                    alt="Product Preview"
                    style={styles.previewImg}
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div style={styles.placeholderImg}>
                    <ImageIcon size={36} color="#94a3b8" />
                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', fontWeight: '500' }}>
                      No Image Preview
                    </span>
                  </div>
                )}
              </div>

              <div style={styles.summaryDetails}>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>SKU CODE</span>
                  <span style={styles.summaryValueSKU}>{formData.skuCode || 'NOT SET'}</span>
                </div>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>BRAND</span>
                  <span style={styles.summaryValueBrand}>{formData.party || 'ANOUK'}</span>
                </div>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>CATEGORY</span>
                  <span style={styles.summaryValueCat}>{formData.categoryName || 'KURTA SET'}</span>
                </div>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>SIZE(S)</span>
                  <span style={styles.summaryValueSize}>{formData.size || 'N/A'}</span>
                </div>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>BASE PRICE</span>
                  <span style={styles.summaryValueCost}>Rs. {(Number(formData.purchasePrice) || 0).toFixed(2)}</span>
                </div>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>SALE PRICE</span>
                  <span style={styles.summaryValueRetail}>Rs. {(Number(formData.salePrice) || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Right Card: Product Form Fields */}
            <div style={styles.formFieldsGrid}>
              {/* Row 1: SKU & Product Name */}
              <div className="inventory-form-row-2col" style={styles.formRow2Col}>
                <div style={styles.fieldCol}>
                  <label style={styles.label}>
                    <Barcode size={14} color="#059669" />
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    name="skuCode"
                    value={formData.skuCode}
                    onChange={handleChange}
                    placeholder="e.g., 301_L, 273_2XL"
                    style={styles.input}
                    required
                    autoComplete="off"
                  />
                </div>

                <div style={styles.fieldCol}>
                  <label style={styles.label}>
                    <Tag size={14} color="#059669" />
                    Product Title / Description *
                  </label>
                  <input
                    type="text"
                    name="itemName"
                    value={formData.itemName}
                    onChange={handleChange}
                    placeholder="e.g., Women Printed Kurta Set with Dupatta"
                    style={styles.input}
                    required
                  />
                </div>
              </div>

              {/* Row 2: Brand & Category */}
              <div className="inventory-form-row-2col" style={styles.formRow2Col}>
                <div style={styles.fieldCol}>
                  <label style={styles.label}>
                    <Building2 size={14} color="#059669" />
                    Brand / Manufacturer *
                  </label>
                  <input
                    type="text"
                    name="party"
                    value={formData.party}
                    onChange={handleChange}
                    list="form-brand-suggestions"
                    placeholder="e.g., ANOUK, ELITE EDITION"
                    style={styles.input}
                    required
                  />
                  <datalist id="form-brand-suggestions">
                    {managedBrands.map((b, i) => (
                      <option key={i} value={b} />
                    ))}
                  </datalist>
                </div>

                <div style={styles.fieldCol}>
                  <label style={styles.label}>
                    <Layers size={14} color="#059669" />
                    Category Name
                  </label>
                  <input
                    type="text"
                    name="categoryName"
                    value={formData.categoryName}
                    onChange={handleChange}
                    list="form-category-suggestions"
                    placeholder="e.g., KURTA SET, CO-ORD SET"
                    style={styles.input}
                  />
                  <datalist id="form-category-suggestions">
                    <option value="KURTA SET" />
                    <option value="CO-ORD SET" />
                    <option value="DRESS" />
                    <option value="SUIT" />
                    <option value="SAREE" />
                    <option value="LEHENGA" />
                    <option value="TOP" />
                  </datalist>
                </div>
              </div>

              {/* Row 3: Size(s) & HSN Code */}
              <div className="inventory-form-row-2col" style={styles.formRow2Col}>
                <div style={styles.fieldCol}>
                  <label style={styles.label}>
                    Product Size(s) *
                  </label>
                  <input
                    type="text"
                    name="size"
                    value={formData.size}
                    onChange={handleChange}
                    placeholder="e.g., L or S, M, L, XL, 2XL"
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.fieldCol}>
                  <label style={styles.label}>
                    <FileCode size={14} color="#059669" />
                    HSN Code
                  </label>
                  <input
                    type="text"
                    name="hsnCode"
                    value={formData.hsnCode}
                    onChange={handleChange}
                    placeholder="e.g., 6204"
                    style={styles.input}
                  />
                </div>
              </div>

              {/* Row 4: Base Price & Sale Price */}
              <div className="inventory-form-row-2col" style={styles.formRow2Col}>
                <div style={styles.fieldCol}>
                  <label style={styles.label}>
                    <DollarSign size={14} color="#059669" />
                    Base Price / Cost (Rs.)
                  </label>
                  <input
                    type="number"
                    name="purchasePrice"
                    value={formData.purchasePrice}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    style={styles.input}
                  />
                </div>

                <div style={styles.fieldCol}>
                  <label style={styles.label}>
                    <DollarSign size={14} color="#059669" />
                    Sale Price / MSRP (Rs.)
                  </label>
                  <input
                    type="number"
                    name="salePrice"
                    value={formData.salePrice}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    style={styles.input}
                  />
                </div>
              </div>

              {/* Row 5: Image URL */}
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Product Image URL (Direct Link)
                </label>
                <input
                  type="text"
                  name="imageUrl"
                  value={formData.imageUrl}
                  onChange={handleChange}
                  placeholder="https://example.com/image.jpg"
                  style={styles.input}
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="inventory-footer" style={styles.footer}>
            <button type="button" onClick={handleModalClose} style={styles.cancelBtn}>
              Cancel
            </button>
            <button type="submit" style={styles.submitBtn}>
              <CheckCircle size={16} style={{ marginRight: '6px' }} />
              {item ? 'Save Changes' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return ReactDOM.createPortal(modalMarkup, document.body);
  }
  return modalMarkup;
}

// Inject Responsive Mobile CSS Styles
if (typeof document !== 'undefined') {
  const styleElId = 'inventory-form-responsive-style';
  if (!document.getElementById(styleElId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleElId;
    styleEl.innerHTML = `
      @media (max-width: 768px) {
        .inventory-modal-container {
          max-height: 94vh !important;
          width: 95% !important;
          border-radius: 12px !important;
        }
        .inventory-main-grid {
          grid-template-columns: 1fr !important;
          gap: 1rem !important;
        }
        .inventory-summary-card {
          flex-direction: row !important;
          align-items: center !important;
          gap: 0.75rem !important;
          padding: 0.75rem !important;
        }
        .inventory-summary-card > div:first-child {
          width: 90px !important;
          height: 100px !important;
          flex-shrink: 0 !important;
        }
        .inventory-form-row-2col {
          grid-template-columns: 1fr !important;
          gap: 0.75rem !important;
        }
        .inventory-footer {
          flex-direction: column-reverse !important;
          gap: 0.5rem !important;
        }
        .inventory-footer button {
          width: 100% !important;
          justify-content: center !important;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }
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
    padding: '1.25rem',
    boxSizing: 'border-box',
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '920px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '92vh',
    position: 'relative',
    margin: 'auto',
  },
  header: {
    padding: '1.25rem 1.75rem',
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
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#0f172a',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.825rem',
    color: '#64748b',
    margin: 0,
  },
  closeBtn: {
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '50%',
    width: '34px',
    height: '34px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748b',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  errorBox: {
    margin: '1rem 1.75rem 0',
    padding: '0.75rem 1rem',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '0.85rem',
    fontWeight: '600',
  },
  formContent: {
    padding: '1.5rem 1.75rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '240px 1fr',
    gap: '1.5rem',
    alignItems: 'start',
  },
  summaryCard: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    alignItems: 'center',
  },
  imagePreviewContainer: {
    width: '100%',
    height: '180px',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    backgroundColor: '#ffffff',
  },
  placeholderImg: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryDetails: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    borderTop: '1px solid #e2e8f0',
    paddingTop: '0.75rem',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.75rem',
  },
  summaryLabel: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: '0.68rem',
  },
  summaryValueSKU: {
    fontWeight: '700',
    color: '#1e293b',
    backgroundColor: '#e2e8f0',
    padding: '0.1rem 0.4rem',
    borderRadius: '4px',
    fontFamily: 'monospace',
  },
  summaryValueBrand: {
    fontWeight: '700',
    color: '#0f172a',
  },
  summaryValueCat: {
    fontWeight: '600',
    color: '#059669',
    backgroundColor: '#d1fae5',
    padding: '0.1rem 0.4rem',
    borderRadius: '4px',
    fontSize: '0.68rem',
  },
  summaryValueSize: {
    fontWeight: '700',
    color: '#475569',
    backgroundColor: '#f1f5f9',
    padding: '0.1rem 0.4rem',
    borderRadius: '4px',
  },
  summaryValueCost: {
    fontWeight: '600',
    color: '#475569',
  },
  summaryValueRetail: {
    fontWeight: '700',
    color: '#2563eb',
  },
  formFieldsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.1rem',
  },
  formRow2Col: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  fieldCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  fieldColFull: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  label: {
    fontSize: '0.78rem',
    fontWeight: '600',
    color: '#334155',
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
  },
  input: {
    width: '100%',
    padding: '0.55rem 0.75rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: '0.85rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '0.75rem',
    paddingTop: '1rem',
    borderTop: '1px solid #e2e8f0',
    marginTop: '0.5rem',
  },
  cancelBtn: {
    padding: '0.6rem 1.25rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#475569',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  submitBtn: {
    padding: '0.6rem 1.5rem',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#059669',
    color: '#ffffff',
    fontSize: '0.875rem',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.3)',
    transition: 'all 0.15s ease',
  },
};

