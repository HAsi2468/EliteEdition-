import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../services/api';

export default function InventoryForm({ item, onSubmit, onClose }) {
  const [formData, setFormData] = useState({
    party: '',
    itemName: '',
    size: '',
    currentlyAvailableStock: 0,
    qty: 0,
    purchasePrice: 0.0,
    salePrice: 0.0,
    skuCode: '',
    imageUrl: '',
  });
  
  const [error, setError] = useState('');
  const [vendorsList, setVendorsList] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [storeInventory, setStoreInventory] = useState([]);

  useEffect(() => {
    const loadFormData = async () => {
      try {
        const vData = await api.getVendors();
        setVendorsList(vData || []);
      } catch (err) {
        console.warn('Failed to load vendors for form:', err);
      }
      try {
        const cData = await api.getProductsCatalog();
        setCatalogItems(cData || []);
      } catch (err) {
        console.warn('Failed to load catalog for form:', err);
      }
      try {
        const invData = await api.getInventory();
        setStoreInventory(invData || []);
      } catch (err) {
        console.warn('Failed to load store inventory for form:', err);
      }
    };
    loadFormData();
  }, []);

  useEffect(() => {
    if (item) {
      setFormData({
        party: item.party || '',
        itemName: item.itemName || '',
        size: item.size || '',
        currentlyAvailableStock: item.currentlyAvailableStock ?? 0,
        qty: item.qty ?? 0,
        purchasePrice: item.purchasePrice ?? 0.0,
        salePrice: item.salePrice ?? 0.0,
        skuCode: item.skuCode || '',
        imageUrl: item.imageUrl || '',
      });
    }
  }, [item]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'skuCode') {
      const sku = value;
      const matchedCatalog = catalogItems.find(item => item.skuCode && item.skuCode.trim().toLowerCase() === sku.trim().toLowerCase());
      const matchedInventory = storeInventory.find(item => item.skuCode && item.skuCode.trim().toLowerCase() === sku.trim().toLowerCase());
      
      const currentStock = matchedInventory ? (matchedInventory.currentlyAvailableStock || 0) : 0;

      if (matchedCatalog) {
        setFormData(prev => ({
          ...prev,
          skuCode: sku,
          itemName: matchedCatalog.description || prev.itemName,
          size: Array.isArray(matchedCatalog.size) ? matchedCatalog.size.join(', ') : (matchedCatalog.size || prev.size),
          purchasePrice: matchedCatalog.basePrice ?? prev.purchasePrice,
          salePrice: matchedCatalog.price ?? prev.salePrice,
          imageUrl: matchedCatalog.imageUrl || prev.imageUrl,
          currentlyAvailableStock: currentStock,
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          skuCode: sku,
          currentlyAvailableStock: currentStock,
        }));
      }
    } else {
      // Convert to number for specific fields
      const numericFields = ['currentlyAvailableStock', 'qty', 'purchasePrice', 'salePrice'];
      setFormData(prev => ({
        ...prev,
        [name]: numericFields.includes(name) ? (value === '' ? '' : parseFloat(value)) : value,
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    // Basic Validation
    if (!formData.party.trim() || !formData.itemName.trim() || !formData.size.trim()) {
      setError('Vendor, Item Name, and Size are required.');
      return;
    }

    const payload = {
      ...formData,
      currentlyAvailableStock: Number(formData.currentlyAvailableStock) || 0,
      qty: Number(formData.qty) || 0,
      purchasePrice: Number(formData.purchasePrice) || 0.0,
      salePrice: Number(formData.salePrice) || 0.0,
    };

    onSubmit(payload);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={styles.content}>
        <div style={styles.header}>
          <h3 style={styles.title}>{item ? 'Edit Inventory Item' : 'Add Inventory Item'}</h3>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={18} />
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.row}>
            <div style={styles.col}>
              <label style={styles.label}>Item Name *</label>
              <input
                type="text"
                name="itemName"
                value={formData.itemName}
                onChange={handleChange}
                placeholder="e.g., Slim Fit Jeans"
                required
              />
            </div>
            <div style={styles.col}>
              <label style={styles.label}>Vendor *</label>
              <input
                type="text"
                name="party"
                value={formData.party}
                onChange={handleChange}
                list="form-vendors"
                placeholder="Select or type vendor..."
                required
              />
              <datalist id="form-vendors">
                {vendorsList.map((v, i) => (
                  <option key={i} value={v.name} />
                ))}
              </datalist>
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.col}>
              <label style={styles.label}>Size *</label>
              <input
                type="text"
                name="size"
                value={formData.size}
                onChange={handleChange}
                placeholder="e.g., M, L, XL, 32"
                required
              />
            </div>
            <div style={styles.col}>
              <label style={styles.label}>SKU Code</label>
              <input
                type="text"
                name="skuCode"
                value={formData.skuCode}
                onChange={handleChange}
                list="form-skucodes"
                placeholder="Select or type SKU..."
              />
              <datalist id="form-skucodes">
                {catalogItems.map((item, i) => (
                  <option key={i} value={item.skuCode}>
                    {item.description ? `${item.description} (${item.brand || 'Uniware'})` : ''}
                  </option>
                ))}
              </datalist>
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.col}>
              <label style={styles.label}>Starting Quantity (Qty)</label>
              <input
                type="number"
                name="qty"
                value={formData.qty}
                onChange={handleChange}
                min="0"
              />
            </div>
            <div style={styles.col}>
              <label style={styles.label}>Available Stock</label>
              <input
                type="number"
                name="currentlyAvailableStock"
                value={formData.currentlyAvailableStock}
                onChange={handleChange}
                min="0"
                readOnly
                style={{ background: 'rgba(56, 189, 248, 0.04)', color: '#9ca3af', cursor: 'not-allowed' }}
              />
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.col}>
              <label style={styles.label}>Purchase Price</label>
              <input
                type="number"
                name="purchasePrice"
                value={formData.purchasePrice}
                onChange={handleChange}
                step="0.01"
                min="0"
              />
            </div>
            <div style={styles.col}>
              <label style={styles.label}>Sale Price</label>
              <input
                type="number"
                name="salePrice"
                value={formData.salePrice}
                onChange={handleChange}
                step="0.01"
                min="0"
              />
            </div>
          </div>

          <div style={styles.colFull}>
            <label style={styles.label}>Image URL</label>
            <input
              type="text"
              name="imageUrl"
              value={formData.imageUrl}
              onChange={handleChange}
              placeholder="e.g., https://example.com/image.jpg"
              style={{ width: '100%' }}
            />
          </div>

          <div style={styles.footer}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-success">
              {item ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  content: {
    padding: '1.5rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem',
  },
  title: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '0.25rem',
    display: 'flex',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  row: {
    display: 'flex',
    gap: '1rem',
  },
  col: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  colFull: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: '500',
    color: '#d1d5db',
    marginLeft: '2px',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '1.25rem',
    paddingTop: '1rem',
    borderTop: '1px solid var(--border-light)',
  },
  error: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.75rem',
    color: '#fca5a5',
    fontSize: '0.8rem',
    marginBottom: '1rem',
  },
};

// Inject CSS styling for input sizing in columns
const styleEl = document.createElement('style');
styleEl.innerHTML = `
  .modal-content input {
    width: 100% !important;
  }
  @media (max-width: 500px) {
    .modal-content div[style*="display: flex; gap: 1rem;"] {
      flex-direction: column !important;
      gap: 1rem !important;
    }
  }
`;
document.head.appendChild(styleEl);
