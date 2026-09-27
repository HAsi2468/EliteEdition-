import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, Edit2, Trash2, Plus, RefreshCw, UserCheck, Users, ShoppingBag, History, Save, RotateCw, Building2, Tag, Search, Check, Warehouse } from 'lucide-react';
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
  const [facilities, setFacilities] = useState([]);
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
  const [facilityForm, setFacilityForm] = useState({ name: '', code: '', address: '', contactPerson: '', phone: '', isDefault: false });

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
      } else if (activeTab === 'facilities') {
        const res = await api.getFacilities();
        setFacilities(res || []);
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

  // 4. Storage Facilities
  const handleFacilitySubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (editingId) {
        await api.updateFacility(editingId, facilityForm);
        setSuccess('Storage facility updated successfully.');
      } else {
        await api.createFacility(facilityForm);
        setSuccess('Storage facility created successfully.');
      }
      setFacilityForm({ name: '', code: '', address: '', contactPerson: '', phone: '', isDefault: false });
      setEditingId(null);
      loadTabData();
      try {
        window.dispatchEvent(new CustomEvent('elite_facilities_updated'));
      } catch (ev) {}
    } catch (err) {
      setError(err.message || 'Failed to save storage facility.');
    }
  };

  const handleEditFacility = (fac) => {
    setEditingId(fac._id || fac.id);
    setFacilityForm({
      name: fac.name || '',
      code: fac.code || '',
      address: fac.address || '',
      contactPerson: fac.contactPerson || '',
      phone: fac.phone || '',
      isDefault: Boolean(fac.isDefault),
    });
  };

  const handleDeleteFacility = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete storage facility "${name}"?`)) return;
    setError('');
    try {
      await api.deleteFacility(id);
      setSuccess('Storage facility deleted successfully.');
      loadTabData();
      try {
        window.dispatchEvent(new CustomEvent('elite_facilities_updated'));
      } catch (ev) {}
    } catch (err) {
      setError(err.message || 'Failed to delete storage facility.');
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
          <div style={styles.headerLeft}>
            <div style={styles.headerIconBadge}>
              <Building2 size={20} color="#2563eb" />
            </div>
            <div>
              <h2 style={styles.title}>Manager Control Panel</h2>
              <p style={styles.subtitle}>Brands, Vendors, Parties & Storage Facility Management</p>
            </div>
          </div>
          <button type="button" onClick={handleModalClose} style={styles.closeBtn} title="Close Modal">
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
                onClick={() => setActiveTab('facilities')}
                style={{ ...styles.tabBtn, ...(activeTab === 'facilities' ? styles.tabBtnActive : {}) }}
              >
                <Warehouse size={16} />
                <span>Storage Facilities</span>
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
                <RefreshCw className="animate-spin" size={24} color="#2563eb" />
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Loading manager records...</span>
              </div>
            ) : (
              <>
                {/* 0. BRANDS TAB */}
                {activeTab === 'brands' && (
                  <div style={styles.tabContent}>
                    <form onSubmit={handleAddBrand} style={styles.inlineForm}>
                      <span style={styles.formTitle}>
                        <Tag size={16} color="#2563eb" />
                        Add New Catalog Brand
                      </span>
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
                    <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '8px', padding: '0.5rem 0.75rem', gap: '0.5rem' }}>
                      <Search size={15} color="#64748b" />
                      <input
                        type="text"
                        value={brandSearchTerm}
                        onChange={(e) => setBrandSearchTerm(e.target.value)}
                        placeholder="Filter catalog brands..."
                        style={{ background: 'none', border: 'none', color: '#0f172a', fontSize: '0.85rem', outline: 'none', flex: 1, fontWeight: '500' }}
                      />
                      {brandSearchTerm && (
                        <button onClick={() => setBrandSearchTerm('')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }} title="Clear Search">
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: '800', color: '#475569', letterSpacing: '0.04em' }}>
                        MANAGED BRANDS DIRECTORY ({filteredCustomBrands.length})
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '350px', overflowY: 'auto', padding: '0.2rem' }}>
                        {filteredCustomBrands.map((b, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', backgroundColor: '#eff6ff', border: '1.5px solid #bfdbfe', padding: '0.35rem 0.75rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: '700', color: '#1d4ed8' }}>
                            <Tag size={13} color="#2563eb" />
                            {editingBrandTag === b ? (
                              <input
                                type="text"
                                value={editingBrandInputValue}
                                onChange={(e) => setEditingBrandInputValue(e.target.value)}
                                autoFocus
                                style={{ background: '#ffffff', border: '1.5px solid #2563eb', color: '#0f172a', fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', width: '95px', outline: 'none' }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRenameBrand(b);
                                  if (e.key === 'Escape') setEditingBrandTag(null);
                                }}
                              />
                            ) : (
                              <span>{b}</span>
                            )}
                            {editingBrandTag === b ? (
                              <button onClick={() => handleSaveRenameBrand(b)} style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer', padding: 0, display: 'flex' }} title="Save">
                                <Check size={13} />
                              </button>
                            ) : (
                              <button onClick={() => { setEditingBrandTag(b); setEditingBrandInputValue(b); }} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, display: 'flex' }} title="Rename Brand">
                                <Edit2 size={12} />
                              </button>
                            )}
                            <button onClick={() => handleDeleteBrandTag(b)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 0, display: 'flex' }} title="Delete Custom Brand">
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
                        <Building2 size={16} color="#2563eb" />
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
                            style={styles.cancelBtn}
                          >
                            Cancel
                          </button>
                        )}
                        <button type="submit" style={styles.submitBtn}>
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
                              <td colSpan="5" className="text-center" style={{ color: '#64748b', padding: '1.5rem' }}>No vendors found.</td>
                            </tr>
                          ) : (
                            vendors.map((v) => (
                              <tr key={v._id}>
                                <td style={{ fontWeight: '700', color: '#0f172a' }}>{v.businessName || 'N/A'}</td>
                                <td style={{ color: '#334155' }}>{v.name}</td>
                                <td style={{ color: '#64748b' }}>{v.phone || 'N/A'}</td>
                                <td>
                                  {v.gstin ? (
                                    <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: '#eff6ff', color: '#2563eb', padding: '2px 6px', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                                      {v.gstin}
                                    </span>
                                  ) : 'N/A'}
                                </td>
                                <td>
                                  <div style={styles.actionsCell}>
                                    <button onClick={() => handleEditVendor(v)} style={styles.editBtn} title="Edit Vendor">
                                      <Edit2 size={13} />
                                    </button>
                                    <button onClick={() => handleDeleteVendor(v._id)} style={styles.trashBtn} title="Delete Vendor">
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
                        <Users size={16} color="#2563eb" />
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
                            style={styles.cancelBtn}
                          >
                            Cancel
                          </button>
                        )}
                        <button type="submit" style={styles.submitBtn}>
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
                              <td colSpan="4" className="text-center" style={{ color: '#64748b', padding: '1.5rem' }}>No parties found.</td>
                            </tr>
                          ) : (
                            parties.map((p) => (
                              <tr key={p._id}>
                                <td style={{ fontWeight: '700', color: '#0f172a' }}>{p.name}</td>
                                <td style={{ color: '#64748b' }}>{p.phone || 'N/A'}</td>
                                <td style={{ color: '#334155' }}>{p.address || 'N/A'}</td>
                                <td>
                                  <div style={styles.actionsCell}>
                                    <button onClick={() => handleEditParty(p)} style={styles.editBtn} title="Edit Party">
                                      <Edit2 size={13} />
                                    </button>
                                    <button onClick={() => handleDeleteParty(p._id)} style={styles.trashBtn} title="Delete Party">
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
                      <button onClick={handleSyncProducts} disabled={syncing} style={styles.syncBtn}>
                        <RotateCw size={14} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Syncing...' : 'Sync Catalog from Store Inventory'}
                      </button>
                    </div>

                    <form onSubmit={handleProductSubmit} style={styles.inlineForm}>
                      <span style={styles.formTitle}>
                        <ShoppingBag size={16} color="#2563eb" />
                        {editingId ? 'Edit Product' : 'Create New Product'}
                      </span>
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
                            style={styles.cancelBtn}
                          >
                            Cancel
                          </button>
                        )}
                        <button type="submit" style={styles.submitBtn}>
                          <Save size={14} />
                          <span>{editingId ? 'Save Product' : 'Create Product'}</span>
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
                              <td colSpan="4" className="text-center" style={{ color: '#64748b', padding: '1.5rem' }}>No products in catalog.</td>
                            </tr>
                          ) : (
                            products.map((pr) => (
                              <tr key={pr._id}>
                                <td>
                                  <span style={styles.skuText}>{pr.skuCode}</span>
                                </td>
                                <td style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: '600', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                                    <button onClick={() => handleEditProduct(pr)} style={styles.editBtn} title="Edit Product">
                                      <Edit2 size={13} />
                                    </button>
                                    <button onClick={() => handleDeleteProduct(pr._id)} style={styles.trashBtn} title="Delete Product">
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
                              <td colSpan="4" className="text-center" style={{ color: '#64748b', padding: '1.5rem' }}>No outward logs recorded.</td>
                            </tr>
                          ) : (
                            history.map((log) => (
                              <tr key={log._id}>
                                <td>
                                  <span style={styles.skuText}>{log.skuCode}</span>
                                </td>
                                <td style={{ fontWeight: '600', color: '#0f172a' }}>{log.party}</td>
                                <td className="text-center" style={{ fontWeight: 'bold', color: '#dc2626' }}>
                                  {log.qtyOut}
                                </td>
                                <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
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

                {/* 5. STORAGE FACILITIES TAB */}
                {activeTab === 'facilities' && (
                  <div style={styles.tabContent}>
                    <form onSubmit={handleFacilitySubmit} style={styles.inlineForm}>
                      <span style={styles.formTitle}>
                        <Warehouse size={16} color="#2563eb" />
                        {editingId ? 'Edit Storage Facility' : 'Add New Storage Facility'}
                      </span>
                      <div style={styles.formGrid}>
                        <input
                          type="text"
                          placeholder="Facility / Godown Name (e.g. Pramukh Park, Godown 1) *"
                          value={facilityForm.name}
                          onChange={(e) => setFacilityForm({ ...facilityForm, name: e.target.value })}
                          required
                          style={styles.formInput}
                        />
                        <input
                          type="text"
                          placeholder="Short Code (e.g. PP, W1)"
                          value={facilityForm.code}
                          onChange={(e) => setFacilityForm({ ...facilityForm, code: e.target.value.toUpperCase() })}
                          style={styles.formInput}
                        />
                        <input
                          type="text"
                          placeholder="Contact Person (Optional)"
                          value={facilityForm.contactPerson}
                          onChange={(e) => setFacilityForm({ ...facilityForm, contactPerson: e.target.value })}
                          style={styles.formInput}
                        />
                        <input
                          type="text"
                          placeholder="Phone / Mobile (Optional)"
                          value={facilityForm.phone}
                          onChange={(e) => setFacilityForm({ ...facilityForm, phone: e.target.value })}
                          style={styles.formInput}
                        />
                        <input
                          type="text"
                          placeholder="Full Address / Location (Optional)"
                          value={facilityForm.address}
                          onChange={(e) => setFacilityForm({ ...facilityForm, address: e.target.value })}
                          style={{ ...styles.formInput, gridColumn: 'span 2' }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', gridColumn: 'span 2', marginTop: '0.2rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: '#334155', fontWeight: 600 }}>
                            <input
                              type="checkbox"
                              checked={facilityForm.isDefault}
                              onChange={(e) => setFacilityForm({ ...facilityForm, isDefault: e.target.checked })}
                              style={{ width: '17px', height: '17px', cursor: 'pointer', accentColor: '#2563eb' }}
                            />
                            <span>Set as Default Facility for new stock inward</span>
                          </label>
                        </div>
                      </div>
                      <div style={styles.formActions}>
                        {editingId && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setFacilityForm({ name: '', code: '', address: '', contactPerson: '', phone: '', isDefault: false });
                            }}
                            style={styles.cancelBtn}
                          >
                            Cancel
                          </button>
                        )}
                        <button type="submit" style={styles.submitBtn}>
                          <Save size={14} /> {editingId ? 'Update Facility' : 'Save Facility'}
                        </button>
                      </div>
                    </form>

                    <div className="table-container" style={styles.tableWrap}>
                      <table>
                        <thead>
                          <tr>
                            <th>Facility Name</th>
                            <th>Code</th>
                            <th>Address</th>
                            <th>Contact</th>
                            <th className="text-center">Default</th>
                            <th className="text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {facilities.length === 0 ? (
                            <tr>
                              <td colSpan="6" className="text-center" style={{ color: '#64748b', padding: '1.5rem' }}>No storage facilities configured.</td>
                            </tr>
                          ) : (
                            facilities.map((fac) => (
                              <tr key={fac._id || fac.id}>
                                <td style={{ fontWeight: '700', color: '#0f172a' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                    <Warehouse size={15} color="#2563eb" />
                                    <span>{fac.name}</span>
                                  </div>
                                </td>
                                <td>
                                  {fac.code ? (
                                    <span style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                      {fac.code}
                                    </span>
                                  ) : '—'}
                                </td>
                                <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{fac.address || '—'}</td>
                                <td style={{ fontSize: '0.82rem', color: '#334155' }}>
                                  {fac.contactPerson || fac.phone ? (
                                    <span>{fac.contactPerson} {fac.phone && `(${fac.phone})`}</span>
                                  ) : '—'}
                                </td>
                                <td className="text-center">
                                  {fac.isDefault ? (
                                    <span style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '2px 9px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 'bold' }}>
                                      Default
                                    </span>
                                  ) : <span style={{ color: '#94a3b8' }}>—</span>}
                                </td>
                                <td>
                                  <div style={styles.actionsCell}>
                                    <button onClick={() => handleEditFacility(fac)} style={styles.editBtn} title="Edit Facility">
                                      <Edit2 size={13} />
                                    </button>
                                    <button onClick={() => handleDeleteFacility(fac._id || fac.id, fac.name)} style={styles.trashBtn} title="Delete Facility">
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

// Inject Responsive CSS & White/Blue Theme Styles for Catalog Manager Modal
if (typeof document !== 'undefined') {
  const styleElId = 'catalog-manager-modal-responsive-style';
  if (!document.getElementById(styleElId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleElId;
    styleEl.innerHTML = `
      .catalog-manager-container {
        background: #ffffff !important;
        color: #0f172a !important;
      }
      .catalog-manager-container table {
        width: 100% !important;
        border-collapse: collapse !important;
        background: #ffffff !important;
      }
      .catalog-manager-container table thead tr {
        background: #f8fafc !important;
      }
      .catalog-manager-container table th {
        background: #f8fafc !important;
        color: #475569 !important;
        font-weight: 700 !important;
        font-size: 0.74rem !important;
        padding: 0.7rem 0.85rem !important;
        border-bottom: 1.5px solid #e2e8f0 !important;
        text-align: left !important;
      }
      .catalog-manager-container table th.text-center {
        text-align: center !important;
      }
      .catalog-manager-container table td {
        padding: 0.7rem 0.85rem !important;
        font-size: 0.84rem !important;
        color: #1e293b !important;
        border-bottom: 1px solid #f1f5f9 !important;
        background: #ffffff !important;
      }
      .catalog-manager-container table tr:hover td {
        background: #f0f7ff !important;
      }
      .catalog-manager-container input:focus {
        border-color: #2563eb !important;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15) !important;
      }
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
          border-bottom: 1px solid #e2e8f0 !important;
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

// Clean White & Blue Theme Styles configuration
const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(5px)',
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.75rem',
    boxSizing: 'border-box',
  },
  content: {
    width: '960px',
    maxWidth: '96vw',
    maxHeight: '92vh',
    height: 'auto',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    borderRadius: '18px',
    border: '1px solid #dbeafe',
    boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(37, 99, 235, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.1rem 1.4rem',
    background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
    borderBottom: '1px solid #dbeafe',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  headerIconBadge: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    background: '#dbeafe',
    border: '1px solid #bfdbfe',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#1d4ed8',
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: '800',
    color: '#1e3a8a',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.78rem',
    color: '#64748b',
    margin: 0,
    fontWeight: '500',
  },
  closeBtn: {
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    color: '#64748b',
    cursor: 'pointer',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  layout: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
  },
  sidebar: {
    width: '210px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    background: '#f8fafc',
    borderRight: '1px solid #e2e8f0',
    padding: '1rem 0.75rem',
    flexShrink: 0,
  },
  tabBtn: {
    background: 'transparent',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.7rem 0.9rem',
    width: '100%',
    textAlign: 'left',
    color: '#475569',
    fontSize: '0.85rem',
    fontWeight: '600',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: '#ffffff',
    fontWeight: '700',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.28)',
  },
  mainArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    maxHeight: 'calc(92vh - 75px)',
    padding: '1.25rem 1.4rem',
    background: '#ffffff',
    gap: '1rem',
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.1rem',
    height: 'auto',
  },
  inlineForm: {
    background: 'linear-gradient(135deg, #f0f7ff 0%, #ffffff 100%)',
    border: '1.5px solid #bfdbfe',
    borderRadius: '14px',
    padding: '1.15rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
    flexShrink: 0,
    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.05)',
  },
  formTitle: {
    fontSize: '0.85rem',
    fontWeight: '800',
    color: '#1d4ed8',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem',
  },
  formInput: {
    width: '100%',
    padding: '0.6rem 0.85rem',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
    borderRadius: '8px',
    border: '1.5px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.6rem',
    marginTop: '0.25rem',
  },
  submitBtn: {
    padding: '0.6rem 1.25rem',
    fontSize: '0.84rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    borderRadius: '8px',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: '#ffffff',
    border: 'none',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
  },
  cancelBtn: {
    padding: '0.6rem 1rem',
    fontSize: '0.82rem',
    fontWeight: 600,
    borderRadius: '8px',
    cursor: 'pointer',
    background: '#ffffff',
    border: '1.5px solid #cbd5e1',
    color: '#475569',
  },
  tableWrap: {
    overflowY: 'auto',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
  },
  actionsCell: {
    display: 'flex',
    gap: '0.4rem',
    justifyContent: 'center',
  },
  editBtn: {
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    color: '#2563eb',
    padding: '0.35rem 0.5rem',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashBtn: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    padding: '0.35rem 0.5rem',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogCtrl: {
    display: 'flex',
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  syncBtn: {
    padding: '0.55rem 1.1rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    background: '#eff6ff',
    color: '#2563eb',
    border: '1.5px solid #bfdbfe',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  skuText: {
    fontFamily: 'monospace',
    fontSize: '0.78rem',
    color: '#1d4ed8',
    background: '#eff6ff',
    padding: '0.15rem 0.4rem',
    borderRadius: '4px',
    border: '1px solid #bfdbfe',
    fontWeight: '700',
  },
  miniBadge: {
    fontSize: '0.72rem',
    color: '#1e40af',
    background: '#eff6ff',
    padding: '0.1rem 0.35rem',
    borderRadius: '4px',
    border: '1px solid #dbeafe',
    fontWeight: '600',
  },
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '0.6rem 0.85rem',
    color: '#dc2626',
    fontSize: '0.82rem',
    fontWeight: '600',
    flexShrink: 0,
    margin: '0.5rem 1.4rem 0',
  },
  success: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    padding: '0.6rem 0.85rem',
    color: '#16a34a',
    fontSize: '0.82rem',
    fontWeight: '600',
    flexShrink: 0,
    margin: '0.5rem 1.4rem 0',
  },
  loaderBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: '0.75rem',
    padding: '3rem 0',
  },
};