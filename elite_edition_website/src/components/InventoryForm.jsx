import React, { useState, useEffect } from 'react';
import { X, Sparkles, PackagePlus, Building2, Tag, FileText, DollarSign, Image as ImageIcon, CheckCircle, Barcode } from 'lucide-react';
import { api } from '../services/api';
import { extractSizeFromSku } from '../utils/skuHelper';

export default function InventoryForm({ item, onSubmit, onClose }) {
  const [formData, setFormData] = useState({
    party: '',
    itemName: '',
    size: '',
    currentlyAvailableStock: 1,
    qty: 1,
    purchasePrice: 0.0,
    salePrice: 0.0,
    skuCode: '',
    challanNo: '',
    imageUrl: '',
  });

  const [error, setError] = useState('');
  const [vendorsList, setVendorsList] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [storeInventory, setStoreInventory] = useState([]);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const loadFormData = async () => {
      try {
        const [vData, cData, invData] = await Promise.all([
          api.getVendors().catch(() => []),
          api.getProductsCatalog().catch(() => []),
          api.getInventory().catch(() => []),
        ]);
        setVendorsList(vData || []);
        setCatalogItems(cData || []);
        setStoreInventory(invData || []);
      } catch (err) {
        console.warn('Failed to load form reference data:', err);
      }
    };
    loadFormData();
  }, []);

  useEffect(() => {
    if (item) {
      const stockVal = item.currentlyAvailableStock ?? item.qty ?? 1;
      setFormData({
        party: item.party || '',
        itemName: item.itemName || '',
        size: item.size || '',
        currentlyAvailableStock: stockVal,
        qty: stockVal,
        purchasePrice: item.purchasePrice ?? 0.0,
        salePrice: item.salePrice ?? 0.0,
        skuCode: item.skuCode || '',
        challanNo: item.challanNo || '',
        imageUrl: item.imageUrl || '',
      });
    }
  }, [item]);

  // Helper to extract effective size from catalog item or SKU string
  const resolveEffectiveSize = (matchedCatObj, skuStr) => {
    if (matchedCatObj && matchedCatObj.size) {
      if (typeof matchedCatObj.size === 'string' && matchedCatObj.size.trim() && matchedCatObj.size.trim().toUpperCase() !== 'N/A') {
        return matchedCatObj.size.trim().toUpperCase();
      }
      if (Array.isArray(matchedCatObj.size) && matchedCatObj.size.length > 0) {
        const validFirst = matchedCatObj.size.find(s => typeof s === 'string' && s.trim() && s.trim().toUpperCase() !== 'N/A');
        if (validFirst) return validFirst.trim().toUpperCase();
      }
    }
    return extractSizeFromSku(skuStr) || '';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'skuCode') {
      const sku = value;
      setImageError(false);
      
      const matchedCatalog = catalogItems.find(c => c.skuCode && c.skuCode.trim().toLowerCase() === sku.trim().toLowerCase());
      const matchedInventory = storeInventory.find(inv => inv.skuCode && inv.skuCode.trim().toLowerCase() === sku.trim().toLowerCase());
      
      const currentStock = matchedInventory ? (matchedInventory.currentlyAvailableStock || 0) : 0;
      const derivedSize = resolveEffectiveSize(matchedCatalog, sku);

      if (matchedCatalog) {
        setFormData(prev => ({
          ...prev,
          skuCode: sku,
          itemName: matchedCatalog.description || prev.itemName,
          size: derivedSize || prev.size,
          purchasePrice: matchedCatalog.basePrice ?? prev.purchasePrice,
          salePrice: matchedCatalog.price ?? prev.salePrice,
          imageUrl: matchedCatalog.imageUrl || prev.imageUrl,
          party: matchedCatalog.brand ? (vendorsList.find(v => (v.name && v.name.toLowerCase() === matchedCatalog.brand.toLowerCase()) || (v.businessName && v.businessName.toLowerCase() === matchedCatalog.brand.toLowerCase()))?.businessName || matchedCatalog.brand) : prev.party,
          currentlyAvailableStock: prev.currentlyAvailableStock || 1,
          qty: prev.currentlyAvailableStock || 1,
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          skuCode: sku,
          size: derivedSize || prev.size,
        }));
      }
    } else if (name === 'currentlyAvailableStock' || name === 'qty') {
      const numVal = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0);
      setFormData(prev => ({
        ...prev,
        currentlyAvailableStock: numVal,
        qty: numVal
      }));
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
      const numericFields = ['purchasePrice', 'salePrice'];
      setFormData(prev => ({
        ...prev,
        [name]: numericFields.includes(name) ? (value === '' ? '' : parseFloat(value) || 0) : value,
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!formData.itemName.trim()) {
      setError('Item / Product Name is required.');
      return;
    }
    if (!formData.party.trim()) {
      setError('Vendor / Business Name is required.');
      return;
    }
    if (!formData.size.trim()) {
      setError('Product Size is required.');
      return;
    }
    if (Number(formData.currentlyAvailableStock) <= 0) {
      setError('Inward Quantity must be at least 1.');
      return;
    }

    const stockVal = Number(formData.currentlyAvailableStock) || 1;

    const payload = {
      ...formData,
      currentlyAvailableStock: stockVal,
      qty: stockVal,
      purchasePrice: Number(formData.purchasePrice) || 0.0,
      salePrice: Number(formData.salePrice) || 0.0,
    };

    onSubmit(payload);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        {/* Modal Header */}
        <div style={styles.header}>
          <div style={styles.headerTitleGroup}>
            <div style={styles.badge}>
              <Sparkles size={14} style={{ marginRight: '6px' }} />
              SINGLE INWARD ENTRY
            </div>
            <h2 style={styles.title}>
              {item ? 'Edit Inward Inventory Item' : 'Single Item Inward Form'}
            </h2>
            <p style={styles.subtitle}>
              Register stock inward entry with instant Uniware catalog auto-fill & vendor business name mapping.
            </p>
          </div>
          <button onClick={onClose} style={styles.closeBtn} title="Close Form">
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
          <div style={styles.mainGrid}>
            {/* Left Card: Thumbnail & Live Inward Summary */}
            <div style={styles.summaryCard}>
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
                  <span style={styles.summaryLabel}>INWARD QTY</span>
                  <span style={styles.summaryValueQty}>{formData.currentlyAvailableStock || 0} Pcs</span>
                </div>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>PURCHASE PRICE</span>
                  <span style={styles.summaryValueCost}>Rs. {(Number(formData.purchasePrice) || 0).toFixed(2)}</span>
                </div>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>SALE PRICE</span>
                  <span style={styles.summaryValueRetail}>Rs. {(Number(formData.salePrice) || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Right Card: Form Controls */}
            <div style={styles.formFieldsGrid}>
              {/* Row 1: SKU & Item Name */}
              <div style={styles.formRow2Col}>
                <div style={styles.fieldCol}>
                  <label style={styles.label}>
                    <Barcode size={14} color="#059669" />
                    SKU Code (Auto-Fill)
                  </label>
                  <input
                    type="text"
                    name="skuCode"
                    value={formData.skuCode}
                    onChange={handleChange}
                    list="form-skucodes-single"
                    placeholder="Type or select SKU (e.g. 301_L)..."
                    style={styles.input}
                    autoComplete="off"
                  />
                  <datalist id="form-skucodes-single">
                    {catalogItems.map((c, i) => (
                      <option key={i} value={c.skuCode}>
                        {c.description ? `${c.description} (${c.brand || 'Uniware'})` : c.skuCode}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div style={styles.fieldCol}>
                  <label style={styles.label}>
                    <Tag size={14} color="#059669" />
                    Item Name / Product Title *
                  </label>
                  <input
                    type="text"
                    name="itemName"
                    value={formData.itemName}
                    onChange={handleChange}
                    placeholder="e.g., Kurta Set / Co-Ord Set"
                    style={styles.input}
                    required
                  />
                </div>
              </div>

              {/* Row 2: Vendor & Challan No */}
              <div style={styles.formRow2Col}>
                <div style={styles.fieldCol}>
                  <label style={styles.label}>
                    <Building2 size={14} color="#059669" />
                    Vendor / Company Name *
                  </label>
                  <input
                    type="text"
                    name="party"
                    value={formData.party}
                    onChange={handleChange}
                    list="form-vendors-single"
                    placeholder="Select or type vendor company name..."
                    style={styles.input}
                    required
                  />
                  <datalist id="form-vendors-single">
                    {vendorsList.map((v, i) => (
                      <option key={i} value={v.businessName || v.name}>
                        {v.businessName ? `${v.businessName} (Contact: ${v.name})` : v.name}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div style={styles.fieldCol}>
                  <label style={styles.label}>
                    <FileText size={14} color="#059669" />
                    Challan No. / Inward Bill No.
                  </label>
                  <input
                    type="text"
                    name="challanNo"
                    value={formData.challanNo}
                    onChange={handleChange}
                    placeholder="e.g., CH-2026-001"
                    style={styles.input}
                  />
                </div>
              </div>

              {/* Row 3: Size, Inward Qty, Purchase Price, Sale Price */}
              <div style={styles.formRow4Col}>
                <div style={styles.fieldCol}>
                  <label style={styles.label}>Size *</label>
                  <input
                    type="text"
                    name="size"
                    value={formData.size}
                    onChange={handleChange}
                    placeholder="e.g., M, L, XL"
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.fieldCol}>
                  <label style={{ ...styles.label, color: '#047857', fontWeight: '700' }}>
                    Inward Qty *
                  </label>
                  <input
                    type="number"
                    name="currentlyAvailableStock"
                    value={formData.currentlyAvailableStock}
                    onChange={handleChange}
                    min="1"
                    placeholder="1"
                    style={styles.highlightInput}
                    required
                  />
                </div>

                <div style={styles.fieldCol}>
                  <label style={styles.label}>Purchase Price (Rs.)</label>
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
                  <label style={styles.label}>Sale Price (Rs.)</label>
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

              {/* Row 4: Image URL */}
              <div style={styles.fieldColFull}>
                <label style={styles.label}>
                  <ImageIcon size={14} color="#059669" />
                  Product Image URL
                </label>
                <input
                  type="text"
                  name="imageUrl"
                  value={formData.imageUrl}
                  onChange={handleChange}
                  placeholder="https://example.com/product-image.jpg"
                  style={styles.input}
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div style={styles.footer}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>
              Cancel
            </button>
            <button type="submit" style={styles.submitBtn}>
              <PackagePlus size={18} />
              {item ? 'Save Changes' : 'Submit Single Inward Entry'}
            </button>
          </div>
        </form>
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
    maxWidth: '920px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '92vh',
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
  summaryValueQty: {
    fontWeight: '800',
    color: '#059669',
    backgroundColor: '#d1fae5',
    padding: '0.1rem 0.5rem',
    borderRadius: '12px',
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
  formRow4Col: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.2fr 1fr 1fr',
    gap: '0.75rem',
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
  highlightInput: {
    width: '100%',
    padding: '0.55rem 0.75rem',
    borderRadius: '8px',
    border: '2px solid #059669',
    backgroundColor: '#f0fdf4',
    color: '#047857',
    fontSize: '0.9rem',
    fontWeight: '800',
    outline: 'none',
    boxSizing: 'border-box',
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

