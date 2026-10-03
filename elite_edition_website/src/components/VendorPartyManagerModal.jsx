import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, Building2, Plus, Trash2, Edit2, CheckCircle, Search, Sparkles, AlertCircle, Phone, MapPin, Check } from 'lucide-react';
import { api } from '../services/api';

export default function VendorPartyManagerModal({
  mode = 'vendors', // 'vendors' | 'parties'
  onClose,
  onSelectVendor,
  onSelectParty
}) {
  const isVendor = mode === 'vendors';
  const title = isVendor ? 'Manage Vendors & Suppliers' : 'Manage Recipient Parties';
  const subtitle = isVendor
    ? 'Add, edit or select supplier vendors for Inward Stock entry.'
    : 'Add, edit or select client/recipient parties for Outward Stock entry.';

  const [itemsList, setItemsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    businessName: '',
    name: '',
    phone: '',
    gstin: '',
    address: ''
  });

  const scrollPosRef = useRef(0);

  useEffect(() => {
    scrollPosRef.current = window.scrollY || document.documentElement.scrollTop || 0;
    loadData();
    return () => {
      const targetY = scrollPosRef.current;
      if (typeof window !== 'undefined' && targetY > 0) {
        window.scrollTo({ top: targetY, behavior: 'instant' });
      }
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      let data = [];
      if (isVendor) {
        data = await api.getVendors().catch(() => []);
      } else {
        const [pData, vData] = await Promise.all([
          api.getParties().catch(() => []),
          api.getVendors().catch(() => [])
        ]);
        data = (pData && pData.length > 0) ? pData : vData;
      }
      setItemsList(data || []);
    } catch (err) {
      console.warn('Failed to load list:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();
    const targetY = scrollPosRef.current || 0;
    if (onClose) onClose();
    if (typeof window !== 'undefined' && targetY > 0) {
      window.scrollTo({ top: targetY, behavior: 'instant' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.businessName.trim() && !form.name.trim()) {
      setError(`${isVendor ? 'Vendor / Business' : 'Party'} name is required.`);
      return;
    }

    try {
      const savedItemName = form.businessName.trim() || form.name.trim();
      if (editingId) {
        if (isVendor) {
          await api.updateVendor(editingId, form);
        } else {
          await api.updateParty(editingId, form).catch(() => api.updateVendor(editingId, form));
        }
        setSuccess(`${isVendor ? 'Vendor' : 'Party'} updated successfully!`);
      } else {
        if (isVendor) {
          await api.createVendor(form);
        } else {
          await api.createParty(form).catch(() => api.createVendor(form));
        }
        setSuccess(`${isVendor ? 'Vendor' : 'Party'} created successfully!`);
      }

      setForm({ businessName: '', name: '', phone: '', gstin: '', address: '' });
      setEditingId(null);
      await loadData();

      if (isVendor && onSelectVendor) {
        onSelectVendor(savedItemName);
      } else if (!isVendor && onSelectParty) {
        onSelectParty(savedItemName);
      }
    } catch (err) {
      setError(err.message || `Failed to save ${isVendor ? 'vendor' : 'party'}.`);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item._id);
    setForm({
      businessName: item.businessName || '',
      name: item.name || '',
      phone: item.phone || '',
      gstin: item.gstin || '',
      address: item.address || ''
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`Are you sure you want to delete this ${isVendor ? 'vendor' : 'party'}?`)) return;
    setError('');
    try {
      if (isVendor) {
        await api.deleteVendor(id);
      } else {
        await api.deleteParty(id).catch(() => api.deleteVendor(id));
      }
      setSuccess(`${isVendor ? 'Vendor' : 'Party'} deleted.`);
      loadData();
    } catch (err) {
      setError(err.message || `Failed to delete ${isVendor ? 'vendor' : 'party'}.`);
    }
  };

  const handleUseItem = (item) => {
    const val = item.businessName || item.name;
    if (isVendor && onSelectVendor) {
      onSelectVendor(val);
    } else if (!isVendor && onSelectParty) {
      onSelectParty(val);
    }
    handleModalClose();
  };

  const filteredItems = itemsList.filter(item => {
    const q = searchQuery.toLowerCase();
    const bName = (item.businessName || '').toLowerCase();
    const pName = (item.name || '').toLowerCase();
    const ph = (item.phone || '').toLowerCase();
    return bName.includes(q) || pName.includes(q) || ph.includes(q);
  });

  const modalMarkup = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        boxSizing: 'border-box'
      }}
      onClick={handleModalClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          background: isVendor ? 'linear-gradient(135deg, #059669, #047857)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '0.5rem', borderRadius: '10px', display: 'flex' }}>
              <Building2 size={22} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>{title}</h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', opacity: 0.9 }}>{subtitle}</p>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: '#ffffff',
              padding: '0.4rem',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {error && (
            <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div style={{ padding: '0.75rem 1rem', background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: '8px', color: '#065f46', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={16} />
              <span>{success}</span>
            </div>
          )}

          {/* Add / Edit Form Card */}
          <form onSubmit={handleSubmit} style={{ background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.92rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sparkles size={16} color={isVendor ? '#059669' : '#3b82f6'} />
              <span>{editingId ? `Edit ${isVendor ? 'Vendor' : 'Party'}` : `+ Add New ${isVendor ? 'Vendor' : 'Party'}`}</span>
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>
                  {isVendor ? 'Business / Vendor Name *' : 'Party / Business Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isVendor ? 'e.g. Elite Tex, Pramukh Park' : 'e.g. Kaushik Traders'}
                  value={form.businessName}
                  onChange={e => setForm({ ...form, businessName: e.target.value })}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>
                  Contact Person
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kaushik Patel"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 98980XXXXX"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>
                  GSTIN (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 24AAAAA0000A1Z5"
                  value={form.gstin}
                  onChange={e => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm({ businessName: '', name: '', phone: '', gstin: '', address: '' });
                  }}
                  style={{ padding: '0.45rem 0.9rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="submit"
                style={{
                  padding: '0.45rem 1.25rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: isVendor ? '#059669' : '#3b82f6',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                }}
              >
                <Plus size={16} />
                <span>{editingId ? 'Update' : `Save ${isVendor ? 'Vendor' : 'Party'}`}</span>
              </button>
            </div>
          </form>

          {/* List Section Header & Search */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
              Existing {isVendor ? 'Vendors' : 'Parties'} ({filteredItems.length})
            </h4>

            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={15} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder={`Search ${isVendor ? 'vendors' : 'parties'}...`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '0.4rem 0.5rem 0.4rem 2rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Vendors / Parties Grid List */}
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
              Loading master list...
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
              No {isVendor ? 'vendors' : 'parties'} found. Add one using the form above!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.2rem' }}>
              {filteredItems.map((item, idx) => {
                const displayName = item.businessName || item.name || 'Unnamed';
                return (
                  <div
                    key={item._id || idx}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '0.75rem 0.9rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justify: 'space-between',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>
                          {displayName}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUseItem(item)}
                          style={{
                            padding: '0.25rem 0.65rem',
                            borderRadius: '6px',
                            border: '1px solid #bbf7d0',
                            background: '#f0fdf4',
                            color: '#15803d',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                          title="Select for quick set"
                        >
                          <Check size={12} />
                          <span>Select</span>
                        </button>
                      </div>

                      {item.name && item.businessName && (
                        <div style={{ fontSize: '0.78rem', color: '#475569', marginBottom: '0.2rem' }}>
                          Contact: <strong>{item.name}</strong>
                        </div>
                      )}

                      {item.phone && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.2rem' }}>
                          <Phone size={12} />
                          <span>{item.phone}</span>
                        </div>
                      )}

                      {item.gstin && (
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                          GST: {item.gstin}
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: '0.65rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        style={{ padding: '0.25rem 0.5rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                      >
                        <Edit2 size={12} />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item._id)}
                        style={{ padding: '0.25rem 0.5rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#b91c1c', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                      >
                        <Trash2 size={12} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleModalClose}
            style={{
              padding: '0.55rem 1.5rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Close
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
