import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, Edit2, Trash2, Plus, RefreshCw, UserCheck, Users, ShoppingBag, History, Save, RotateCw, Building2, Tag, Search, Check } from 'lucide-react';
import { api } from '../services/api';

export default function CatalogManagerModal({ initialTab = 'vendors', context = 'elite_online', onClose }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'brands'); // 'brands', 'vendors', 'parties', 'products', 'history'

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

  // Data States
  const [vendors, setVendors] = useState([]);
  const [parties, setParties] = useState([]);
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [customBrands, setCustomBrands] = useState(() => {
    try {
      const saved = localStorage.getItem('elite_managed_brands');
      return saved ? JSON.parse(saved) : ['ANOUK', 'ELITE EDITION', 'HERA', 'MYNTRA'];
    } catch (e) {
      return ['ANOUK', 'ELITE EDITION', 'HERA', 'MYNTRA'];
    }
  });
  const [newBrandInput, setNewBrandInput] = useState('');
  const [brandSearchTerm, setBrandSearchTerm] = useState('');
  const [editingBrandTag, setEditingBrandTag] = useState(null);
  const [editingBrandInputValue, setEditingBrandInputValue] = useState('');

  // Loading states
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form States
  const [editingId, setEditingId] = useState(null); // ID of item being edited
  const [vendorForm, setVendorForm] = useState({ name: '', businessName: '', phone: '', gstin: '', address: '' });
  const [partyForm, setPartyForm] = useState({ name: '', phone: '', address: '' });
  const [productForm, setProductForm] = useState({ skuCode: '', description: '', imageUrl: '', size: '' });

  // Load data depending on active tab
  useEffect(() => {
    loadTabData();
  }, [activeTab]);

  const loadTabData = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    setEditingId(null);
    try {
      if (activeTab === 'vendors') {
        const res = context === 'elite_print' ? await api.getFabricVendors() : await api.getVendors();
        setVendors(res || []);
      } else if (activeTab === 'parties') {
        const res = await api.getParties();
        setParties(res || []);
      } else if (activeTab === 'products') {
        const res = await api.getProductsCatalog();

        // 🛠️ NEW FIX: Safety check for missing product names/descriptions
        // We map over incoming products array to scan for invalid or null descriptions
        const cleanedProducts = (res || []).map(prod => {
          // If description is empty, null, undefined, or literal "null" string
          if (!prod.description || prod.description === "null") {
            return {
              ...prod,
              description: "ABC" // Automatically enforce fallback value "ABC"
            };
          }
          return prod; // If text is valid, keep it as is
        });

        // Set the safe, sanitized product array into state
        setProducts(cleanedProducts);

      } else if (activeTab === 'history') {
        const res = await api.getStockOuts();
        setHistory(res || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load catalog data.');
    } finally {
      setLoading(false);
    }
  };

  // --- BRAND ACTION HANDLERS ---
  const handleAddBrandTag = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const trimmed = newBrandInput.trim().toUpperCase();
    if (!trimmed) return;
    if (customBrands.some(b => b.toLowerCase() === trimmed.toLowerCase())) {
      setError('This brand already exists.');
      return;
    }
    const updated = [...customBrands, trimmed];
    setCustomBrands(updated);
    try {
      localStorage.setItem('elite_managed_brands', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('elite_brands_updated', { detail: updated }));
    } catch (e) {}
    setNewBrandInput('');
    setSuccess(`Brand "${trimmed}" added successfully.`);
  };

  const handleDeleteBrandTag = (brandName) => {
    if (!window.confirm(`Are you sure you want to delete brand "${brandName}"?`)) return;
    setError('');
    setSuccess('');
    const updated = customBrands.filter(b => b.toLowerCase() !== brandName.toLowerCase());
    setCustomBrands(updated);
    try {
      localStorage.setItem('elite_managed_brands', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('elite_brands_updated', { detail: updated }));
    } catch (e) {}
    setSuccess(`Brand "${brandName}" removed.`);
  };

  const handleSaveEditedBrandTag = (oldBrandName) => {
    setError('');
    setSuccess('');
    const trimmed = editingBrandInputValue.trim().toUpperCase();
    if (!trimmed) {
      setError('Brand name cannot be empty.');
      return;
    }
    if (trimmed !== oldBrandName.toUpperCase() && customBrands.some(b => b.toLowerCase() === trimmed.toLowerCase())) {
      setError(`Brand "${trimmed}" already exists.`);
      return;
    }
    const updated = customBrands.map(b => (b.toLowerCase() === oldBrandName.toLowerCase() ? trimmed : b));
    setCustomBrands(updated);
    try {
      localStorage.setItem('elite_managed_brands', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('elite_brands_updated', { detail: updated }));
    } catch (e) {}
    setEditingBrandTag(null);
    setSuccess(`Updated brand "${oldBrandName}" to "${trimmed}".`);
  };

  // 1. Vendors
  const handleVendorSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (editingId) {
        if (context === 'elite_print') {
          await api.updateFabricVendor(editingId, vendorForm);
        } else {
          await api.updateVendor(editingId, vendorForm);
        }
        setSuccess('Vendor updated successfully.');
      } else {
        if (context === 'elite_print') {
          await api.createFabricVendor(vendorForm);
        } else {
          await api.createVendor(vendorForm);
        }
        setSuccess('Vendor created successfully.');
      }
      setVendorForm({ name: '', businessName: '', phone: '', gstin: '', address: '' });
      setEditingId(null);
      loadTabData();
    } catch (err) {
      setError(err.message || 'Failed to save vendor.');
    }
  };

  const handleEditVendor = (vendor) => {
    setEditingId(vendor._id);
    setVendorForm({
      name: vendor.name || '',
      businessName: vendor.businessName || '',
      phone: vendor.phone || '',
      gstin: vendor.gstin || '',
      address: vendor.address || '',
    });
  };

  const handleDeleteVendor = async (id) => {
    if (!window.confirm('Delete this vendor?')) return;
    setError('');
    try {
      if (context === 'elite_print') {
        await api.deleteFabricVendor(id);
      } else {
        await api.deleteVendor(id);
      }
      setSuccess('Vendor deleted successfully.');
      loadTabData();
    } catch (err) {
      setError(err.message || 'Failed to delete vendor.');
    }
  };

  // 2. Parties
  const handlePartySubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (editingId) {
        await api.updateParty(editingId, partyForm);
        setSuccess('Party updated successfully.');
      } else {
        await api.createParty(partyForm);
        setSuccess('Party created successfully.');
      }
      setPartyForm({ name: '', phone: '', address: '' });
      setEditingId(null);
      loadTabData();
    } catch (err) {
      setError(err.message || 'Failed to save party.');
    }
  };

  const handleEditParty = (party) => {
    setEditingId(party._id);
    setPartyForm({
      name: party.name || '',
      phone: party.phone || '',
      address: party.address || '',
    });
  };

  const handleDeleteParty = async (id) => {
    if (!window.confirm('Delete this party?')) return;
    setError('');
    try {
      await api.deleteParty(id);
      setSuccess('Party deleted successfully.');
      loadTabData();
    } catch (err) {
      setError(err.message || 'Failed to delete party.');
    }
  };

  // 3. Products Catalog
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (editingId) {
        await api.updateProductCatalog(editingId, productForm);
        setSuccess('Product updated successfully.');
      } else {
        await api.createProductCatalog(productForm);
        setSuccess('Product created successfully.');
      }
      setProductForm({ skuCode: '', description: '', imageUrl: '', size: '' });
      setEditingId(null);
      loadTabData();
    } catch (err) {
      setError(err.message || 'Failed to save product.');
    }
  };

  const handleEditProduct = (prod) => {
    setEditingId(prod._id);
    setProductForm({
      skuCode: prod.skuCode || '',
      description: prod.description || '',
      imageUrl: prod.imageUrl || '',
      size: Array.isArray(prod.size) ? prod.size.join(', ') : prod.size || '',
    });
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Delete this product from catalog?')) return;
    setError('');
    try {
      await api.deleteProductCatalog(id);
      setSuccess('Product deleted from catalog.');
      loadTabData();
    } catch (err) {
      setError(err.message || 'Failed to delete product.');
    }
  };

  const handleSyncProducts = async () => {
    setSyncing(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.syncMissingProducts();
      setSuccess(res.message || 'Product catalog sync triggered successfully!');
      loadTabData();
    } catch (err) {
      setError(err.message || 'Failed to sync products.');
    } finally {
      setSyncing(false);
    }
  };

  const handleResetAndSyncUniwareSkus = async () => {
    if (!window.confirm('WARNING: Are you sure you want to remove all existing mismatched SKUs and fetch fresh SKUs directly from Uniware?')) {
      return;
    }
    setSyncing(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.resetAndSyncUniwareSkus();
      setSuccess(res.message || 'Successfully cleared mismatched SKUs and imported fresh SKUs from Uniware!');
      loadTabData();
    } catch (err) {
      setError(err.message || 'Failed to reset and sync SKUs from Uniware.');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddBrand = handleAddBrandTag;
  const handleSaveRenameBrand = handleSaveEditedBrandTag;
  const filteredCustomBrands = customBrands.filter(b => b.toLowerCase().includes((brandSearchTerm || '').toLowerCase()));

  const modalMarkup = (
    <div className="modal-overlay" style={styles.overlay} onClick={handleModalClose}>
      <div className="modal-content catalog-manager-container" style={styles.content} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Manager Control Panel</h2>
          <button type="button" onClick={handleModalClose} style={styles.closeBtn}>
            <X size={18} />
          </button>
        </div>

        {/* Status Messages */}
        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        {/* Tab Layout Container */}
        <div className="catalog-manager-layout" style={styles.layout}>
          {/* Left Navigation Tabs */}
          <nav className="catalog-manager-sidebar" style={styles.sidebar}>
            <button
              onClick={() => setActiveTab('brands')}
              style={{ ...styles.tabBtn, ...(activeTab === 'brands' ? styles.tabBtnActive : {}) }}
            >
              <Tag size={16} />
              <span>Catalog Brands</span>
            </button>
            <button
              onClick={() => setActiveTab('vendors')}
              style={{ ...styles.tabBtn, ...(activeTab === 'vendors' ? styles.tabBtnActive : {}) }}
            >
              <Building2 size={16} />
              <span>Vendors & Suppliers</span>
            </button>
            {context !== 'elite_print' && (
              <button
                onClick={() => setActiveTab('parties')}
                style={{ ...styles.tabBtn, ...(activeTab === 'parties' ? styles.tabBtnActive : {}) }}
              >
                <Users size={16} />
                <span>Parties</span>
              </button>
            )}
            {context === 'elite_online' && (
              <button
                onClick={() => setActiveTab('products')}
                style={{ ...styles.tabBtn, ...(activeTab === 'products' ? styles.tabBtnActive : {}) }}
              >
                <ShoppingBag size={16} />
                <span>Products Catalog</span>
              </button>
            )}
            {context === 'elite_online' && (
              <button
                onClick={() => setActiveTab('history')}
                style={{ ...styles.tabBtn, ...(activeTab === 'history' ? styles.tabBtnActive : {}) }}
              >
                <History size={16} />
                <span>Stock Out Log</span>
              </button>
            )}
          </nav>

          {/* Right Tab Body Content Area */}
          <div style={styles.mainArea}>
            {loading ? (
              <div style={styles.loaderBox}>
                <RefreshCw className="animate-spin" size={24} color="var(--primary)" />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading manager records...</span>
              </div>
            ) : (
              <>
                {/* 0. BRANDS TAB */}
                {activeTab === 'brands' && (
                  <div style={styles.tabContent}>
                    <form onSubmit={handleAddBrand} style={styles.inlineForm}>
                      <span style={styles.formTitle}>Add New Catalog Brand</span>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={newBrandInput}
                          onChange={(e) => setNewBrandInput(e.target.value)}
                          placeholder="Type brand name (e.g. ZARA, HERA, MYNTRA)..."
                          style={{ ...styles.formInput, flex: 1 }}
                        />
                        <button type="submit" style={styles.submitBtn}>
                          <Plus size={15} /> Add Brand
                        </button>
                      </div>
                    </form>

                    {/* Search & Filter Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.4rem 0.75rem', gap: '0.5rem' }}>
                      <Search size={15} color="var(--text-muted)" />
                      <input
                        type="text"
                        value={brandSearchTerm}
                        onChange={(e) => setBrandSearchTerm(e.target.value)}
                        placeholder="Filter catalog brands..."
                        style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.8rem', outline: 'none', flex: 1 }}
                      />
                      {brandSearchTerm && (
                        <button onClick={() => setBrandSearchTerm('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }} title="Clear Search">
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                        MANAGED BRANDS DIRECTORY ({filteredCustomBrands.length})
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '350px', overflowY: 'auto', padding: '0.2rem' }}>
                        {filteredCustomBrands.map((b, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'rgba(37, 99, 235, 0.15)', border: '1px solid rgba(37, 99, 235, 0.3)', padding: '0.35rem 0.65rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '700', color: '#60a5fa' }}>
                            <Tag size={13} color="#60a5fa" />
                            {editingBrandTag === b ? (
                              <input
                                type="text"
                                value={editingBrandInputValue}
                                onChange={(e) => setEditingBrandInputValue(e.target.value)}
                                autoFocus
                                style={{ background: '#1e293b', border: '1px solid #3b82f6', color: '#fff', fontSize: '0.75rem', padding: '2px 4px', borderRadius: '4px', width: '90px' }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRenameBrand(b);
                                  if (e.key === 'Escape') setEditingBrandTag(null);
                                }}
                              />
                            ) : (
                              <span>{b}</span>
                            )}
                            {editingBrandTag === b ? (
                              <button onClick={() => handleSaveRenameBrand(b)} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: 0, display: 'flex' }} title="Save">
                                <Check size={13} />
                              </button>
                            ) : (
                              <button onClick={() => { setEditingBrandTag(b); setEditingBrandInputValue(b); }} style={{ background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', padding: 0, display: 'flex' }} title="Rename Brand">
                                <Edit2 size={12} />
                              </button>
                            )}
                            <button onClick={() => handleDeleteBrandTag(b)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, display: 'flex' }} title="Delete Custom Brand">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 1. VENDORS TAB */}
                {activeTab === 'vendors' && (
                  <div style={styles.tabContent}>
                    <form onSubmit={handleVendorSubmit} style={styles.inlineForm}>
                      <span style={styles.formTitle}>
                        {editingId ? 'Edit Vendor / Supplier' : 'Add New Vendor / Supplier'}
                      </span>
                      <div style={styles.formGrid}>
                        <input
                          type="text"
                          placeholder="Vendor Contact Person *"
                          value={vendorForm.name}
                          onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                          required
                          style={styles.formInput}
                        />
                        <input
                          type="text"
                          placeholder="Business / Company Name *"
                          value={vendorForm.businessName}
                          onChange={(e) => setVendorForm({ ...vendorForm, businessName: e.target.value })}
                          required
                          style={styles.formInput}
                        />
                        <input
                          type="text"
                          placeholder="Phone Number"
                          value={vendorForm.phone}
                          onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                          style={styles.formInput}
                        />
                        <input
                          type="text"
                          placeholder="GSTIN Number"
                          value={vendorForm.gstin}
                          onChange={(e) => setVendorForm({ ...vendorForm, gstin: e.target.value })}
                          style={styles.formInput}
                        />
                        <input
                          type="text"
                          placeholder="Full Address"
                          value={vendorForm.address}
                          onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
                          style={{ ...styles.formInput, gridColumn: 'span 2' }}
                        />
                      </div>
                      <div style={styles.formActions}>
                        {editingId && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setVendorForm({ name: '', businessName: '', phone: '', gstin: '', address: '' });
                            }}
                            className="btn-secondary"
                            style={styles.cancelBtn}
                          >
                            Cancel
                          </button>
                        )}
                        <button type="submit" className="btn-primary" style={styles.submitBtn}>
                          <Save size={14} /> {editingId ? 'Update Vendor' : 'Save Vendor'}
                        </button>
                      </div>
                    </form>

                    <div className="table-container" style={styles.tableWrap}>
                      <table>
                        <thead>
                          <tr>
                            <th>Company</th>
                            <th>Contact Person</th>
                            <th>Phone</th>
                            <th>GSTIN</th>
                            <th className="text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vendors.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="text-center" style={{ color: 'var(--text-muted)' }}>No vendors found.</td>
                            </tr>
                          ) : (
                            vendors.map((v) => (
                              <tr key={v._id}>
                                <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{v.businessName || 'N/A'}</td>
                                <td>{v.name}</td>
                                <td>{v.phone || 'N/A'}</td>
                                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{v.gstin || 'N/A'}</td>
                                <td>
                                  <div style={styles.actionsCell}>
                                    <button onClick={() => handleEditVendor(v)} className="btn-icon" title="Edit">
                                      <Edit2 size={13} />
                                    </button>
                                    <button onClick={() => handleDeleteVendor(v._id)} className="btn-icon" style={styles.trashBtn} title="Delete">
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 2. PARTIES TAB */}
                {activeTab === 'parties' && (
                  <div style={styles.tabContent}>
                    <form onSubmit={handlePartySubmit} style={styles.inlineForm}>
                      <span style={styles.formTitle}>
                        {editingId ? 'Edit Receiver Party' : 'Add New Receiver Party'}
                      </span>
                      <div style={styles.formGrid}>
                        <input
                          type="text"
                          placeholder="Party / Receiver Name *"
                          value={partyForm.name}
                          onChange={(e) => setPartyForm({ ...partyForm, name: e.target.value })}
                          required
                          style={styles.formInput}
                        />
                        <input
                          type="text"
                          placeholder="Phone Number"
                          value={partyForm.phone}
                          onChange={(e) => setPartyForm({ ...partyForm, phone: e.target.value })}
                          style={styles.formInput}
                        />
                        <input
                          type="text"
                          placeholder="Address / Destination"
                          value={partyForm.address}
                          onChange={(e) => setPartyForm({ ...partyForm, address: e.target.value })}
                          style={{ ...styles.formInput, gridColumn: 'span 2' }}
                        />
                      </div>
                      <div style={styles.formActions}>
                        {editingId && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setPartyForm({ name: '', phone: '', address: '' });
                            }}
                            className="btn-secondary"
                            style={styles.cancelBtn}
                          >
                            Cancel
                          </button>
                        )}
                        <button type="submit" className="btn-primary" style={styles.submitBtn}>
                          <Save size={14} /> {editingId ? 'Update Party' : 'Save Party'}
                        </button>
                      </div>
                    </form>

                    <div className="table-container" style={styles.tableWrap}>
                      <table>
                        <thead>
                          <tr>
                            <th>Party Name</th>
                            <th>Phone</th>
                            <th>Address</th>
                            <th className="text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parties.length === 0 ? (
                            <tr>
                              <td colSpan="4" className="text-center" style={{ color: 'var(--text-muted)' }}>No parties found.</td>
                            </tr>
                          ) : (
                            parties.map((p) => (
                              <tr key={p._id}>
                                <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{p.name}</td>
                                <td>{p.phone || 'N/A'}</td>
                                <td>{p.address || 'N/A'}</td>
                                <td>
                                  <div style={styles.actionsCell}>
                                    <button onClick={() => handleEditParty(p)} className="btn-icon" title="Edit">
                                      <Edit2 size={13} />
                                    </button>
                                    <button onClick={() => handleDeleteParty(p._id)} className="btn-icon" style={styles.trashBtn} title="Delete">
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3. PRODUCTS CATALOG TAB */}
                {activeTab === 'products' && (
                  <div style={styles.tabContent}>
                    <div style={styles.catalogCtrl}>
                      <button onClick={handleSyncProducts} disabled={syncing} className="btn-secondary" style={styles.syncBtn}>
                        <RotateCw size={14} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Syncing...' : 'Sync Catalog from Store Inventory'}
                      </button>
                    </div>

                    <form onSubmit={handleProductSubmit} style={styles.inlineForm}>
                      <h4 style={styles.formTitle}>{editingId ? 'Edit Product' : 'Create New Product'}</h4>
                      <div style={styles.formGrid}>
                        <input
                          type="text"
                          value={productForm.skuCode}
                          onChange={(e) => setProductForm({ ...productForm, skuCode: e.target.value })}
                          placeholder="SKU Code *"
                          required
                          disabled={!!editingId}
                          style={styles.formInput}
                        />
                        <input
                          type="text"
                          value={productForm.description}
                          onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                          placeholder="Product Name / Description *"
                          required
                          style={styles.formInput}
                        />
                        <input
                          type="text"
                          value={productForm.imageUrl}
                          onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                          placeholder="Image URL"
                          style={styles.formInput}
                        />
                        <input
                          type="text"
                          value={productForm.size}
                          onChange={(e) => setProductForm({ ...productForm, size: e.target.value })}
                          placeholder="Sizes (comma-separated, e.g. M, L, XL)"
                          style={styles.formInput}
                        />
                      </div>
                      <div style={styles.formActions}>
                        {editingId && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setProductForm({ skuCode: '', description: '', imageUrl: '', size: '' });
                            }}
                            className="btn-secondary"
                            style={styles.formBtn}
                          >
                            Cancel
                          </button>
                        )}
                        <button type="submit" className="btn-success" style={styles.formBtn}>
                          <Save size={14} />
                          <span>{editingId ? 'Save' : 'Create'}</span>
                        </button>
                      </div>
                    </form>

                    <div className="table-container" style={styles.tableWrap}>
                      <table>
                        <thead>
                          <tr>
                            <th>SKU</th>
                            <th>Name / Description</th>
                            <th>Sizes</th>
                            <th className="text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.length === 0 ? (
                            <tr>
                              <td colSpan="4" className="text-center" style={{ color: 'var(--text-muted)' }}>No products in catalog.</td>
                            </tr>
                          ) : (
                            products.map((pr) => (
                              <tr key={pr._id}>
                                <td>
                                  <span style={styles.skuText}>{pr.skuCode}</span>
                                </td>
                                <td style={{ fontSize: '0.85rem', color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {pr.description}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                                    {Array.isArray(pr.size) ? pr.size.map((sz, i) => (
                                      <span key={i} style={styles.miniBadge}>{sz}</span>
                                    )) : pr.size ? <span style={styles.miniBadge}>{pr.size}</span> : '-'}
                                  </div>
                                </td>
                                <td>
                                  <div style={styles.actionsCell}>
                                    <button onClick={() => handleEditProduct(pr)} className="btn-icon" title="Edit">
                                      <Edit2 size={13} />
                                    </button>
                                    <button onClick={() => handleDeleteProduct(pr._id)} className="btn-icon" style={styles.trashBtn} title="Delete">
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 4. STOCK OUT LOG TAB */}
                {activeTab === 'history' && (
                  <div style={styles.tabContent}>
                    <div className="table-container" style={styles.tableWrap}>
                      <table>
                        <thead>
                          <tr>
                            <th>SKU Code</th>
                            <th>Party / Receiver</th>
                            <th className="text-center">Qty Out</th>
                            <th>Outward Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.length === 0 ? (
                            <tr>
                              <td colSpan="4" className="text-center" style={{ color: 'var(--text-muted)' }}>No outward logs recorded.</td>
                            </tr>
                          ) : (
                            history.map((log) => (
                              <tr key={log._id}>
                                <td>
                                  <span style={styles.skuText}>{log.skuCode}</span>
                                </td>
                                <td style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{log.party}</td>
                                <td className="text-center" style={{ fontWeight: 'bold', color: '#fca5a5' }}>
                                  {log.qtyOut
                                  }</td>
                                <td style={{ fontSize: '0.8rem' }}>
                                  {log.created_date_time ? new Date(log.created_date_time).toLocaleString('en-IN') : 'N/A'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return ReactDOM.createPortal(modalMarkup, document.body);
  }
  return modalMarkup;
}

// Inject Responsive Mobile CSS Styles for Catalog Manager Modal
if (typeof document !== 'undefined') {
  const styleElId = 'catalog-manager-modal-responsive-style';
  if (!document.getElementById(styleElId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleElId;
    styleEl.innerHTML = `
      @media (max-width: 768px) {
        .catalog-manager-container {
          width: 96vw !important;
          max-width: 96vw !important;
          padding: 0.85rem !important;
          max-height: 94vh !important;
          border-radius: 12px !important;
          box-sizing: border-box !important;
        }
        .catalog-manager-layout {
          flex-direction: column !important;
          gap: 0.75rem !important;
        }
        .catalog-manager-sidebar {
          width: 100% !important;
          flex-direction: row !important;
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch !important;
          border-right: none !important;
          border-bottom: 1px solid rgba(255,255,255,0.1) !important;
          padding-right: 0 !important;
          padding-bottom: 0.5rem !important;
        }
        .catalog-manager-sidebar button {
          flex: 0 0 auto !important;
          white-space: nowrap !important;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }
}

// Styles configuration object remains exactly the same
const styles = {
  content: {
    width: '940px',
    maxWidth: '95vw',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    maxHeight: '92vh',
    height: 'auto',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-light)',
    paddingBottom: '0.75rem',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: '700',
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
  layout: {
    display: 'flex',
    flex: 1,
    gap: '1.5rem',
    overflow: 'hidden',
    minHeight: 0,
  },
  sidebar: {
    width: '190px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    borderRight: '1px solid var(--border-light)',
    paddingRight: '1rem',
    flexShrink: 0,
  },
  tabBtn: {
    background: 'none',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.75rem 1rem',
    width: '100%',
    textAlign: 'left',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    fontWeight: '500',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  tabBtnActive: {
    background: 'rgba(6, 182, 212, 0.1)',
    color: 'var(--text-primary)',
    fontWeight: '600',
    borderLeft: '3px solid var(--primary)',
    paddingLeft: 'calc(1rem - 3px)',
    borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
  },
  mainArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    maxHeight: 'calc(92vh - 80px)',
    paddingRight: '4px',
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    height: 'auto',
  },
  inlineForm: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-light)',
    borderRadius: '12px',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
    flexShrink: 0,
  },
  formTitle: {
    fontSize: '0.85rem',
    fontWeight: '800',
    color: '#4f46e5',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem',
  },
  formInput: {
    width: '100%',
    padding: '0.55rem 0.8rem',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
    borderRadius: '6px',
    border: '1px solid var(--border-light)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.6rem',
    marginTop: '0.25rem',
  },
  formBtn: {
    padding: '0.55rem 1.25rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  tableWrap: {
    overflowY: 'auto',
    borderRadius: '10px',
    border: '1px solid var(--border-light)',
  },
  actionsCell: {
    display: 'flex',
    gap: '0.4rem',
    justifyContent: 'center',
  },
  trashBtn: {
    color: '#ef4444',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  catalogCtrl: {
    display: 'flex',
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  syncBtn: {
    padding: '0.5rem 1rem',
    fontSize: '0.8rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  skuText: {
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    color: 'var(--primary)',
    background: 'rgba(6, 182, 212, 0.05)',
    padding: '0.1rem 0.3rem',
    borderRadius: '3px',
    border: '1px solid rgba(6, 182, 212, 0.1)',
  },
  miniBadge: {
    fontSize: '0.7rem',
    color: '#e5e7eb',
    background: 'rgba(255,255,255,0.05)',
    padding: '0.05rem 0.25rem',
    borderRadius: '3px',
    border: '1px solid var(--border-light)',
  },
  error: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.5rem 0.75rem',
    color: '#fca5a5',
    fontSize: '0.8rem',
    flexShrink: 0,
  },
  success: {
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.5rem 0.75rem',
    color: '#a7f3d0',
    fontSize: '0.8rem',
    flexShrink: 0,
  },
  loaderBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: '0.75rem',
  },
};