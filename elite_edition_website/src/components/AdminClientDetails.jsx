import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import {
  UserPlus,
  Users,
  Search,
  Filter,
  Building2,
  Phone,
  Key,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Upload,
  CheckCircle2,
  XCircle,
  X,
  RotateCw,
  Copy,
  Check,
  Shield,
  ExternalLink,
  Lock,
  Sparkles,
  Camera
} from 'lucide-react';

export default function AdminClientDetails() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Parties from Settings -> Parties (Clients)
  const [partyOptions, setPartyOptions] = useState([]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [companyCodeFilter, setCompanyCodeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Image Preview Modal
  const [previewImage, setPreviewImage] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    username: '',
    mobile: '',
    companyName: '',
    companyCode: '',
    password: '',
    image: '',
    status: 'Active',
    notes: '',
  });

  const fileInputRef = useRef(null);

  // Fetch Parties (Clients) from Settings
  const fetchParties = async () => {
    try {
      const cfg = await api.getPrintConfig();
      if (cfg && Array.isArray(cfg.parties)) {
        setPartyOptions(cfg.parties.filter(Boolean));
      }
    } catch (err) {
      console.warn('Failed to fetch print config parties:', err);
    }
  };

  // Fetch Clients
  const fetchClients = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getClients({
        search: searchQuery,
        companyCode: companyCodeFilter,
        status: statusFilter,
      });
      if (res && res.data) {
        setClients(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load client details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParties();
    fetchClients();
  }, [companyCodeFilter, statusFilter]);

  // Handle Search submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchClients();
  };

  // Open Modal for Add
  const handleOpenAdd = () => {
    setEditingClient(null);
    setFormData({
      username: '',
      mobile: '',
      companyName: '',
      companyCode: partyOptions.length > 0 ? partyOptions[0] : '',
      password: '',
      image: '',
      status: 'Active',
      notes: '',
    });
    setShowPassword(false);
    setError('');
    setShowModal(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (client) => {
    setEditingClient(client);
    setFormData({
      username: client.username || '',
      mobile: client.mobile || '',
      companyName: client.companyName || '',
      companyCode: client.companyCode || '',
      password: client.password || '',
      image: client.image || '',
      status: client.status || 'Active',
      notes: client.notes || '',
    });
    setShowPassword(false);
    setError('');
    setShowModal(true);
  };

  // Image Upload to Cloudflare R2
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 15MB)
    if (file.size > 15 * 1024 * 1024) {
      alert('File size exceeds 15MB. Please choose a smaller image.');
      return;
    }

    setUploadingImage(true);
    try {
      const res = await api.uploadClientImage(file);
      if (res && (res.url || res.fileUrl)) {
        const uploadedUrl = res.url || res.fileUrl;
        setFormData((prev) => ({ ...prev, image: uploadedUrl }));
        setSuccess('Image uploaded to Cloudflare R2 successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        throw new Error('No image URL returned from upload server');
      }
    } catch (err) {
      alert('Failed to upload image to Cloudflare R2: ' + err.message);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.username.trim()) {
      setError('User Name is required');
      return;
    }
    if (!formData.mobile.trim()) {
      setError('Mobile Number is required');
      return;
    }
    if (!formData.companyName.trim()) {
      setError('Company Name is required');
      return;
    }
    if (!formData.companyCode.trim()) {
      setError('Company Code is required (Select from Parties)');
      return;
    }
    if (!formData.password.trim()) {
      setError('Password is required');
      return;
    }

    setSubmitLoading(true);
    try {
      if (editingClient) {
        await api.updateClient(editingClient._id, formData);
        setSuccess(`Client "${formData.username}" updated successfully!`);
      } else {
        await api.createClient(formData);
        setSuccess(`Client "${formData.username}" created successfully!`);
      }
      setShowModal(false);
      fetchClients();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to save client');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Delete Client
  const handleDelete = async (client) => {
    if (!window.confirm(`Are you sure you want to delete client account "${client.username}" (${client.companyName})?`)) {
      return;
    }

    try {
      await api.deleteClient(client._id);
      setSuccess(`Client "${client.username}" deleted successfully.`);
      fetchClients();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to delete client');
    }
  };

  // Copy helper
  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered clients for quick search
  const displayedClients = clients.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.username || '').toLowerCase().includes(q) ||
      (c.mobile || '').toLowerCase().includes(q) ||
      (c.companyName || '').toLowerCase().includes(q) ||
      (c.companyCode || '').toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Alert Banners */}
      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer' }}><X size={16} /></button>
        </div>
      )}

      {success && (
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#15803d', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} style={{ background: 'none', border: 'none', color: '#15803d', cursor: 'pointer' }}><X size={16} /></button>
        </div>
      )}

      {/* Top Stat Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Clients</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>{clients.length}</div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem 1.25rem', background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)', color: '#fff', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Accounts</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>
            {clients.filter((c) => c.status === 'Active').length}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem 1.25rem', background: 'linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)', color: '#fff', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#c7d2fe', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Parties Configured in Settings</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#a5b4fc', marginTop: '4px' }}>
            {partyOptions.length}
          </div>
        </div>
      </div>

      {/* Action & Filter Toolbar */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderRadius: '12px', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)' }}>
        
        {/* Search */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 260px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by username, mobile, company, or party code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem 0.5rem 2rem',
                fontSize: '0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <button type="submit" className="btn-secondary" style={{ padding: '0.5rem 0.9rem', fontSize: '0.8rem', fontWeight: 700, borderRadius: '8px' }}>
            Filter
          </button>
        </form>

        {/* Dropdown Filters & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          
          {/* Company Code Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Party:</span>
            <select
              value={companyCodeFilter}
              onChange={(e) => setCompanyCodeFilter(e.target.value)}
              style={{
                padding: '0.45rem 0.65rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              <option value="All">All Parties</option>
              {partyOptions.map((p, idx) => (
                <option key={idx} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Status Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '0.45rem 0.65rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => { fetchParties(); fetchClients(); }}
            className="btn-secondary"
            title="Refresh list"
            style={{ padding: '0.45rem 0.75rem', borderRadius: '8px' }}
          >
            <RotateCw size={14} className={loading ? 'spin' : ''} />
          </button>

          {/* Add Client Button */}
          <button
            onClick={handleOpenAdd}
            className="btn-primary"
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 800,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <UserPlus size={16} />
            <span>+ Add Client</span>
          </button>
        </div>

      </div>

      {/* Clients Data Grid / Table */}
      <div className="glass-panel" style={{ padding: 0, borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-card)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '0.85rem 1rem' }}>Client</th>
                <th style={{ padding: '0.85rem 1rem' }}>User Name</th>
                <th style={{ padding: '0.85rem 1rem' }}>Mobile Number</th>
                <th style={{ padding: '0.85rem 1rem' }}>Company Name</th>
                <th style={{ padding: '0.85rem 1rem' }}>Company Code (Party)</th>
                <th style={{ padding: '0.85rem 1rem' }}>Password</th>
                <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <RotateCw size={18} className="spin" />
                      <span>Loading client details...</span>
                    </div>
                  </td>
                </tr>
              ) : displayedClients.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Users size={32} color="#94a3b8" />
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>No clients found</span>
                      <span style={{ fontSize: '0.8rem' }}>Click "+ Add Client" to create your first client account.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedClients.map((client) => {
                  const initial = (client.username || client.companyName || 'C')[0].toUpperCase();
                  return (
                    <tr
                      key={client._id}
                      style={{
                        borderBottom: '1px solid var(--border-light)',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      {/* Avatar / Image stored in Cloudflare R2 */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {client.image ? (
                          <div
                            onClick={() => setPreviewImage(client.image)}
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: '50%',
                              overflow: 'hidden',
                              border: '2px solid #2563eb',
                              cursor: 'pointer',
                              position: 'relative'
                            }}
                            title="Click to view full image"
                          >
                            <img
                              src={client.image}
                              alt={client.username}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                        ) : (
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.95rem',
                              boxShadow: '0 2px 5px rgba(37,99,235,0.2)'
                            }}
                          >
                            {initial}
                          </div>
                        )}
                      </td>

                      {/* User Name */}
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{client.username}</span>
                          <button
                            onClick={() => handleCopy(client.username, `user_${client._id}`)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                            title="Copy username"
                          >
                            {copiedId === `user_${client._id}` ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>

                      {/* Mobile Number */}
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Phone size={13} color="#64748b" />
                          <span>{client.mobile}</span>
                        </div>
                      </td>

                      {/* Company Name */}
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Building2 size={13} color="#2563eb" />
                          <span>{client.companyName}</span>
                        </div>
                      </td>

                      {/* Company Code (from Parties in Settings) */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            display: 'inline-block'
                          }}
                        >
                          {client.companyCode}
                        </span>
                      </td>

                      {/* Password */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                            {client.password}
                          </span>
                          <button
                            onClick={() => handleCopy(client.password, `pass_${client._id}`)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                            title="Copy password"
                          >
                            {copiedId === `pass_${client._id}` ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: client.status === 'Active' ? '#f0fdf4' : '#fef2f2',
                            color: client.status === 'Active' ? '#16a34a' : '#ef4444',
                            border: `1px solid ${client.status === 'Active' ? '#bbf7d0' : '#fecaca'}`
                          }}
                        >
                          {client.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => handleOpenEdit(client)}
                            className="btn-secondary"
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', borderRadius: '6px' }}
                            title="Edit Client"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(client)}
                            style={{
                              background: '#fee2e2',
                              border: '1px solid #fca5a5',
                              color: '#dc2626',
                              padding: '0.35rem 0.6rem',
                              fontSize: '0.75rem',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                            title="Delete Client"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CREATE / EDIT CLIENT MODAL ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: 580, maxHeight: '90vh', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#ffffff', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '1.1rem 1.4rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Users size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
                  {editingClient ? 'Edit Client Details' : 'Add New Client'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.4rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Profile Image & R2 Storage Section */}
              <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ position: 'relative', width: 68, height: 68, borderRadius: '50%', overflow: 'hidden', background: '#e2e8f0', border: '2px solid #2563eb', flexShrink: 0 }}>
                  {formData.image ? (
                    <img src={formData.image} alt="Client Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                      <ImageIcon size={28} />
                    </div>
                  )}
                  {uploadingImage && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                      <RotateCw size={18} className="spin" />
                    </div>
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>Client Image / Logo</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#0284c7', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>Cloudflare R2</span>
                  </div>
                  <p style={{ margin: '2px 0 6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Upload image will be stored securely in Cloudflare R2 bucket.
                  </p>
                  
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}
                      disabled={uploadingImage}
                      style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        color: '#2563eb',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Camera size={13} />
                      <span>{uploadingImage ? 'Uploading to R2...' : formData.image ? 'Change Image' : 'Upload Image'}</span>
                    </button>
                    {formData.image && (
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, image: '' }))}
                        style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Remove
                      </button>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />
                  </div>
                </div>
              </div>

              {/* User Name & Mobile Number */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    User Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. rohit_sharma"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.55rem', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid var(--border-light)', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.55rem', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid var(--border-light)', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Company Name & Company Code (Parties in Settings) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Company Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Fabtex Apparel Pvt Ltd"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.55rem', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid var(--border-light)', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Company Code (From Parties in Settings) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={formData.companyCode}
                      onChange={(e) => setFormData({ ...formData, companyCode: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '0.55rem',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        borderRadius: '6px',
                        border: '1.5px solid #2563eb',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        cursor: 'pointer',
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="">-- Select Party from Settings --</option>
                      {partyOptions.map((p, idx) => (
                        <option key={idx} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  {partyOptions.length === 0 && (
                    <span style={{ fontSize: '0.68rem', color: '#ea580c', marginTop: '2px', display: 'block' }}>
                      No parties found in Settings &rarr; Parties (Clients).
                    </span>
                  )}
                </div>
              </div>

              {/* Password & Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Password *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter client password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.55rem 2.2rem 0.55rem 0.55rem', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid var(--border-light)', boxSizing: 'border-box' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Account Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: '#ffffff', boxSizing: 'border-box' }}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                  Remarks / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Internal notes or reference info..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-light)', boxSizing: 'border-box' }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                  style={{ padding: '0.55rem 1.2rem', borderRadius: '8px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading || uploadingImage}
                  className="btn-primary"
                  style={{ padding: '0.55rem 1.4rem', borderRadius: '8px', fontWeight: 800 }}
                >
                  {submitLoading ? 'Saving...' : editingClient ? 'Update Client' : 'Create Client'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ── IMAGE PREVIEW LIGHTBOX ── */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <button
              onClick={() => setPreviewImage(null)}
              style={{
                position: 'absolute',
                top: -12,
                right: -12,
                background: '#ef4444',
                border: 'none',
                color: '#fff',
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
              }}
            >
              <X size={18} />
            </button>
            <img
              src={previewImage}
              alt="Client Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '85vh',
                borderRadius: '12px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
}
