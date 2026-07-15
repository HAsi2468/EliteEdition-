import React, { useState, useEffect } from 'react';
import { X, Edit2, Trash2, Plus, RefreshCw, UserCheck, Users, ShoppingBag, History, Save, RotateCw } from 'lucide-react';
import { api } from '../services/api';

export default function CatalogManagerModal({ initialTab = 'vendors', context = 'elite_online', onClose }) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'vendors', 'parties', 'products', 'history'

  // Data States
  const [vendors, setVendors] = useState([]);
  const [parties, setParties] = useState([]);
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form States
  const [editingId, setEditingId] = useState(null); // ID of item being edited
  const [vendorForm, setVendorForm] = useState({ name: '', phone: '', address: '' });
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

  // --- CRUD ACTION HANDLERS ---

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
      setVendorForm({ name: '', phone: '', address: '' });
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
      phone: vendor.phone || '',
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

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={styles.content}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Manager Control Panel</h2>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={18} />
          </button>
        </div>

        {/* Status Messages */}
        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        {/* Tab Layout Container */}
        <div style={styles.layout}>
          {/* Left Navigation Tabs */}
          <nav style={styles.sidebar}>
            <button
              onClick={() => setActiveTab('vendors')}
              style={{ ...styles.tabBtn, ...(activeTab === 'vendors' ? styles.tabBtnActive : {}) }}
            >
              <UserCheck size={16} />
              <span>Vendors</span>
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
              <>
                <button
                  onClick={() => setActiveTab('products')}
                  style={{ ...styles.tabBtn, ...(activeTab === 'products' ? styles.tabBtnActive : {}) }}
                >
                  <ShoppingBag size={16} />
                  <span>Products Catalog</span>
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  style={{ ...styles.tabBtn, ...(activeTab === 'history' ? styles.tabBtnActive : {}) }}
                >
                  <History size={16} />
                  <span>Outward Log</span>
                </button>
              </>
            )}
          </nav>

          {/* Right Content View */}
          <div style={styles.mainArea}>
            {loading ? (
              <div style={styles.loaderBox}>
                <RotateCw size={24} className="spin-loader" color="var(--primary)" />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading records...</span>
              </div>
            ) : (
              <>
                {/* 1. VENDORS TAB */}
                {activeTab === 'vendors' && (
                  <div style={styles.tabContent}>
                    {/* Add / Edit Form */}
                    <form onSubmit={handleVendorSubmit} style={styles.inlineForm}>
                      <h4 style={styles.formTitle}>{editingId ? 'Edit Vendor' : 'Add New Vendor'}</h4>
                      <div style={styles.formGrid}>
                        <input
                          type="text"
                          value={vendorForm.name}
                          onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                          placeholder="Vendor Name *"
                          required
                          style={styles.formInput}
                        />
                        <input
                          type="text"
                          value={vendorForm.phone}
                          onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                          placeholder="Phone Number"
                          style={styles.formInput}
                        />
                        <input
                          type="text"
                          value={vendorForm.address}
                          onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
                          placeholder="Address"
                          style={{ ...styles.formInput, gridColumn: 'span 2' }}
                        />
                      </div>
                      <div style={styles.formActions}>
                        {editingId && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setVendorForm({ name: '', phone: '', address: '' });
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

                    {/* Table List */}
                    <div className="table-container" style={styles.tableWrap}>
                      <table>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Address</th>
                            <th className="text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vendors.length === 0 ? (
                            <tr>
                              <td colSpan="4" className="text-center" style={{ color: 'var(--text-muted)' }}>No vendors registered.</td>
                            </tr>
                          ) : (
                            vendors.map((v) => (
                              <tr key={v._id}>
                                <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{v.name}</td>
                                <td>{v.phone || '-'}</td>
                                <td style={{ fontSize: '0.8rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.address || '-'}</td>
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
                      <h4 style={styles.formTitle}>{editingId ? 'Edit Party' : 'Add New Party'}</h4>
                      <div style={styles.formGrid}>
                        <input
                          type="text"
                          value={partyForm.name}
                          onChange={(e) => setPartyForm({ ...partyForm, name: e.target.value })}
                          placeholder="Party Name *"
                          required
                          style={styles.formInput}
                        />
                        <input
                          type="text"
                          value={partyForm.phone}
                          onChange={(e) => setPartyForm({ ...partyForm, phone: e.target.value })}
                          placeholder="Phone Number"
                          style={styles.formInput}
                        />
                        <input
                          type="text"
                          value={partyForm.address}
                          onChange={(e) => setPartyForm({ ...partyForm, address: e.target.value })}
                          placeholder="Address"
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
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Address</th>
                            <th className="text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parties.length === 0 ? (
                            <tr>
                              <td colSpan="4" className="text-center" style={{ color: 'var(--text-muted)' }}>No parties registered.</td>
                            </tr>
                          ) : (
                            parties.map((p) => (
                              <tr key={p._id}>
                                <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{p.name}</td>
                                <td>{p.phone || '-'}</td>
                                <td style={{ fontSize: '0.8rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address || '-'}</td>
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
                    {/* Catalog Control Header */}
                    <div style={styles.catalogCtrl}>
                      <button
                        onClick={handleSyncProducts}
                        disabled={syncing}
                        className="btn-primary"
                        style={styles.syncBtn}
                      >
                        <RefreshCw size={14} className={syncing ? 'spin-loader' : ''} />
                        <span>{syncing ? 'Syncing...' : 'Sync Missing Products'}</span>
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
}

// Styles configuration object remains exactly the same
const styles = {
  content: {
    width: '900px',
    maxWidth: '95vw',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    height: '600px',
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
  },
  sidebar: {
    width: '200px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    borderRight: '1px solid var(--border-light)',
    paddingRight: '1rem',
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
    overflow: 'hidden',
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    height: '100%',
    overflow: 'hidden',
  },
  inlineForm: {
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-light)',
    borderRadius: '8px',
    padding: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    flexShrink: 0,
  },
  formTitle: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'var(--primary)',
    margin: 0,
    textTransform: 'uppercase',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.6rem',
  },
  formInput: {
    padding: '0.5rem',
    fontSize: '0.8rem',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.5rem',
  },
  formBtn: {
    padding: '0.4rem 1rem',
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
  },
  tableWrap: {
    flex: 1,
    overflowY: 'auto',
  },
  actionsCell: {
    display: 'flex',
    gap: '0.3rem',
    justifyContent: 'center',
  },
  trashBtn: {
    color: '#fca5a5',
    borderColor: 'rgba(239, 68, 68, 0.1)',
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