import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Building, CreditCard, Save, RefreshCw, FileText, Upload, Image as ImageIcon, 
  Trash2, Plus, Sliders, CheckCircle2, Users, User, UserPlus, Shield, Key, 
  Lock, Check, X, Search, Edit2
} from 'lucide-react';
import { triggerEliteAlert, triggerEliteConfirm } from './EliteModalDialog';
import { AVAILABLE_SCREENS } from '../config/screensConfig';

const getCompanyAccentColor = (entity) => {
  return 'var(--primary)';
};

export default function CompanySettingsPanel({ companyEntity = 'Elite Edition' }) {
  const accentColor = getCompanyAccentColor(companyEntity);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    companyName: companyEntity.toUpperCase(),
    companyGstin: '',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    companyLogo: '',
    companyState: 'Gujarat',
    companyStateCode: '24',
    companyBankName: '',
    companyAccountNo: '',
    companyIfscCode: '',
    invoicePrefix: companyEntity === 'Elite Fabtex' ? 'EF-2627-' : companyEntity === 'Elite Edition' ? 'EE-2627-' : 'EDP-INV-',
    startingInvoiceNo: companyEntity === 'Elite Online' ? 1001 : 1,
    companyTerms: 'Payment due within 30 days from invoice date. Subject to Surat jurisdiction.',
    categories: [],
    paperTypes: [],
    fabrics: [],
    passes: []
  });

  const [newTagInput, setNewTagInput] = useState({
    categories: '',
    paperTypes: '',
    fabrics: '',
    widths: '',
    passes: ''
  });

  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'users', 'tags'
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userSubmitLoading, setUserSubmitLoading] = useState(false);
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    isMainAdmin: false,
    permissions: []
  });

  const fetchCompanyUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await api.getUsers({ limit: 200 });
      if (res && res.users) {
        const companyStaff = (res.users.rows || []).filter(u => 
          Array.isArray(u.allowedCompanies) && u.allowedCompanies.includes(companyEntity)
        );
        setUsers(companyStaff);
      }
    } catch (err) {
      console.warn('Failed to fetch company users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [companyEntity]);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchCompanyUsers();
    }
  }, [activeTab, companyEntity]);

  const handleCreateStaffUser = () => {
    setEditingUser(null);
    setUserFormData({
      name: '',
      email: '',
      password: '',
      role: 'user',
      isMainAdmin: false,
      permissions: []
    });
    setShowUserModal(true);
  };

  const handleEditStaffUser = (u) => {
    setEditingUser(u);
    setUserFormData({
      name: u.name || '',
      email: u.email || '',
      password: '',
      role: u.role || 'user',
      isMainAdmin: Boolean(u.isMainAdmin || u.email === 'harshitsidapara2468@gmail.com'),
      permissions: u.permissions || []
    });
    setShowUserModal(true);
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (!userFormData.name.trim() || !userFormData.email.trim()) {
      triggerEliteAlert('Validation Error', 'Name and Email are required for staff user.', 'error');
      return;
    }
    if (!editingUser && !userFormData.password) {
      triggerEliteAlert('Validation Error', 'Password is required for new staff account.', 'error');
      return;
    }

    setUserSubmitLoading(true);
    try {
      if (editingUser) {
        const updatePayload = {
          name: userFormData.name.trim(),
          email: userFormData.email.trim(),
          role: userFormData.role,
          isMainAdmin: userFormData.isMainAdmin,
          allowedCompanies: Array.from(new Set([...(editingUser.allowedCompanies || []), companyEntity])),
          permissions: userFormData.permissions
        };
        if (userFormData.password) {
          updatePayload.password = userFormData.password;
        }
        await api.updateUser(editingUser.id || editingUser._id, updatePayload);
        triggerEliteAlert('Staff Account Updated', `Staff user "${userFormData.name}" updated successfully for ${companyEntity}.`, 'success');
      } else {
        await api.createUser({
          name: userFormData.name.trim(),
          email: userFormData.email.trim(),
          password: userFormData.password,
          role: userFormData.role,
          isMainAdmin: userFormData.isMainAdmin,
          allowedCompanies: [companyEntity],
          permissions: userFormData.permissions
        });
        triggerEliteAlert('Staff Account Created', `Staff user "${userFormData.name}" created for ${companyEntity}.`, 'success');
      }
      setShowUserModal(false);
      fetchCompanyUsers();
    } catch (err) {
      triggerEliteAlert('Error', err.message || 'Failed to save staff user.', 'error');
    } finally {
      setUserSubmitLoading(false);
    }
  };

  const handleDeleteStaffUser = async (u) => {
    const isConfirmed = await triggerEliteConfirm(
      'Delete Staff Account',
      `Are you sure you want to delete staff account "${u.name}" (${u.email})?`
    );
    if (!isConfirmed) return;
    try {
      await api.deleteUser(u.id || u._id);
      triggerEliteAlert('Deleted', `Staff user "${u.name}" deleted.`, 'success');
      fetchCompanyUsers();
    } catch (err) {
      triggerEliteAlert('Error', err.message || 'Failed to delete user.', 'error');
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.getCompanySettings(companyEntity);
      if (res && res.data) {
        setForm(f => ({
          ...f,
          ...res.data,
          categories: Array.isArray(res.data.categories) ? res.data.categories : [],
          paperTypes: Array.isArray(res.data.paperTypes) ? res.data.paperTypes : [],
          fabrics: Array.isArray(res.data.fabrics) ? res.data.fabrics : [],
          widths: Array.isArray(res.data.widths) ? res.data.widths : [],
          passes: Array.isArray(res.data.passes) ? res.data.passes : []
        }));
      }
    } catch (err) {
      console.warn('Failed to load company settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      triggerEliteAlert('File Too Large', 'Please upload a logo image smaller than 2MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setForm(f => ({ ...f, companyLogo: uploadEvent.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setForm(f => ({ ...f, companyLogo: '' }));
  };

  const handleAddTag = (field) => {
    const val = (newTagInput[field] || '').trim();
    if (!val) return;
    if (form[field]?.includes(val)) return;
    setForm(f => ({ ...f, [field]: [...(f[field] || []), val] }));
    setNewTagInput(t => ({ ...t, [field]: '' }));
  };

  const handleRemoveTag = (field, tagToRemove) => {
    setForm(f => ({ ...f, [field]: f[field].filter(t => t !== tagToRemove) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateCompanySettings({ ...form, companyEntity });
      triggerEliteAlert({
        title: 'Settings Saved',
        message: `Company Settings for "${companyEntity}" updated successfully!`
      });
    } catch (err) {
      triggerEliteAlert({
        title: 'Save Failed',
        message: err.message || 'Failed to update company settings.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  if (loading) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw className="spin" size={28} style={{ color: accentColor, marginBottom: '0.5rem' }} />
        <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>Loading Official Settings for {companyEntity}...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1040px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '1.5rem 1.75rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          borderLeft: `5px solid ${accentColor}`,
          boxShadow: `0 8px 32px rgba(0,0,0,0.25)`
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              🏢 {companyEntity} — Corporate Profile & Settings
            </h2>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '999px',
                background: `${accentColor}25`,
                color: accentColor,
                border: `1px solid ${accentColor}50`
              }}
            >
              ISOLATED COMPANY SCOPE
            </span>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: '0.35rem', marginBottom: 0 }}>
            Manage official letterhead logo, legal address, GSTIN, bank details, invoice numbering prefix, and custom dynamic dropdowns for <strong>{companyEntity}</strong>.
          </p>
        </div>

        <button onClick={loadSettings} className="btn-secondary" style={{ padding: '0.55rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Subtab Navigation Bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '0.6rem 1.25rem', fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px' }}
        >
          <Building size={16} /> 🏢 Corporate Profile & GST
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '0.6rem 1.25rem', fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px' }}
        >
          <Users size={16} /> 👥 Staff Accounts & Access ({users.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tags')}
          className={activeTab === 'tags' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '0.6rem 1.25rem', fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px' }}
        >
          <Sliders size={16} /> ⚙️ Dynamic Dropdowns & Tags
        </button>
      </div>

      {/* TAB 2: STAFF ACCOUNTS & PERMISSIONS FOR THIS COMPANY */}
      {activeTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={18} color={accentColor} /> {companyEntity} — Staff Accounts & Access Control
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Staff accounts authorized to access <strong>{companyEntity}</strong> dashboards, billing, and tools.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCreateStaffUser}
                className="btn-primary"
                style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderRadius: '8px', background: accentColor, borderColor: accentColor }}
              >
                <UserPlus size={16} /> + Add Staff Account
              </button>
            </div>

            {/* Staff Search Filter */}
            <div style={{ position: 'relative', marginTop: '1rem' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Filter staff by name or email..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                style={{ width: '100%', paddingLeft: 34, fontSize: '0.85rem', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '6px' }}
              />
            </div>
          </div>

          {/* Staff Accounts Table */}
          <div className="glass-panel" style={{ padding: '1.25rem', overflowX: 'auto' }}>
            {usersLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw className="spin" size={24} color={accentColor} />
                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Loading staff users list...</p>
              </div>
            ) : users.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <User size={32} color={accentColor} />
                <p style={{ marginTop: '0.5rem', fontWeight: 600 }}>No staff users allocated to {companyEntity} yet.</p>
                <button onClick={handleCreateStaffUser} className="btn-primary" style={{ marginTop: '0.5rem', padding: '0.4rem 1rem', fontSize: '0.82rem' }}>
                  Add First Staff User
                </button>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.65rem' }}>Staff Member</th>
                    <th style={{ padding: '0.65rem' }}>Email Address</th>
                    <th style={{ padding: '0.65rem' }}>Role</th>
                    <th style={{ padding: '0.65rem' }}>Screen Permissions</th>
                    <th style={{ padding: '0.65rem', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users
                    .filter(u => !userSearch || u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase()))
                    .map(u => (
                      <tr key={u.id || u._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.75rem 0.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${accentColor}30`, color: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>
                              {(u.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            {u.name}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.65rem', color: 'var(--text-muted)' }}>{u.email}</td>
                        <td style={{ padding: '0.75rem 0.65rem' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            background: u.isMainAdmin || u.email === 'harshitsidapara2468@gmail.com' ? '#ef444420' : u.role === 'admin' ? '#3b82f620' : '#10b98120',
                            color: u.isMainAdmin || u.email === 'harshitsidapara2468@gmail.com' ? '#f87171' : u.role === 'admin' ? '#60a5fa' : '#34d399',
                            border: `1px solid ${u.isMainAdmin || u.email === 'harshitsidapara2468@gmail.com' ? '#ef444450' : u.role === 'admin' ? '#3b82f650' : '#10b98150'}`
                          }}>
                            {u.isMainAdmin || u.email === 'harshitsidapara2468@gmail.com' ? '👑 MAIN ADMIN' : u.role === 'admin' ? '🛡️ COMPANY ADMIN' : '👤 STANDARD STAFF'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.65rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {u.role === 'admin' ? 'FULL ACCESS' : `${u.permissions?.length || 0} screens permitted`}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.65rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleEditStaffUser(u)}
                              className="btn-secondary"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                              title="Edit Staff Access"
                            >
                              <Edit2 size={13} /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteStaffUser(u)}
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', cursor: 'pointer' }}
                              title="Delete Account"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* STAFF USER EDIT / CREATE MODAL */}
      {showUserModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            border: `1px solid ${accentColor}50`,
            borderRadius: '16px',
            width: '100%',
            maxWidth: '560px',
            padding: '1.75rem',
            color: '#f8fafc',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserPlus size={18} color={accentColor} />
                {editingUser ? `Edit Staff User: ${editingUser.name}` : `Create New Staff for ${companyEntity}`}
              </h3>
              <button onClick={() => setShowUserModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.35rem' }}>Staff Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Sharma"
                  value={userFormData.name}
                  onChange={e => setUserFormData(f => ({ ...f, name: e.target.value }))}
                  style={{ width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.88rem', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.35rem' }}>Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. ramesh@elite.com"
                  value={userFormData.email}
                  onChange={e => setUserFormData(f => ({ ...f, email: e.target.value }))}
                  style={{ width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.88rem', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Password {editingUser ? '(Leave blank to keep existing password)' : '*'}
                </label>
                <input
                  type="password"
                  placeholder={editingUser ? '••••••••' : 'Enter password'}
                  value={userFormData.password}
                  onChange={e => setUserFormData(f => ({ ...f, password: e.target.value }))}
                  style={{ width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.88rem', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.35rem' }}>Staff Role & Authorization</label>
                <select
                  value={userFormData.role}
                  onChange={e => setUserFormData(f => ({ ...f, role: e.target.value, permissions: e.target.value === 'admin' ? AVAILABLE_SCREENS.map(s => s.id) : f.permissions }))}
                  style={{ width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.88rem', borderRadius: '6px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600 }}
                >
                  <option value="user">👤 Standard User (Selected Permissions Only)</option>
                  <option value="admin">🛡️ Company Admin (Full Access to {companyEntity})</option>
                </select>
              </div>

              {/* Screen Permissions selector for standard users */}
              {userFormData.role !== 'admin' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Permitted Screens ({userFormData.permissions.length} selected)
                  </label>
                  <div style={{ maxHeight: '160px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.5rem' }}>
                    {AVAILABLE_SCREENS.map(scr => {
                      const isChecked = userFormData.permissions.includes(scr.id);
                      return (
                        <label key={scr.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.78rem', color: isChecked ? '#38bdf8' : '#94a3b8' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setUserFormData(f => {
                                const exists = f.permissions.includes(scr.id);
                                return {
                                  ...f,
                                  permissions: exists ? f.permissions.filter(p => p !== scr.id) : [...f.permissions, scr.id]
                                };
                              });
                            }}
                          />
                          {scr.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowUserModal(false)} className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                  Cancel
                </button>
                <button type="submit" disabled={userSubmitLoading} className="btn-primary" style={{ padding: '0.5rem 1.5rem', background: accentColor, borderColor: accentColor }}>
                  {userSubmitLoading ? 'Saving...' : editingUser ? 'Update Staff Account' : 'Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FORM FOR PROFILE AND TAGS */}
      {(activeTab === 'profile' || activeTab === 'tags') && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Company Logo & Letterhead Header */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderTop: `3px solid ${accentColor}` }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: accentColor, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <ImageIcon size={18} /> Company Letterhead Logo (Printed on Invoice PDFs)
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem', flexWrap: 'wrap' }}>
            <div
              style={{
                width: '200px',
                height: '85px',
                borderRadius: '12px',
                border: `2px dashed ${form.companyLogo ? accentColor : 'var(--border-light)'}`,
                background: 'rgba(0,0,0,0.25)',
                display: 'flex',
                alignItems: 'center',
                justify: 'center',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: form.companyLogo ? `0 4px 16px ${accentColor}25` : 'none'
              }}
            >
              {form.companyLogo ? (
                <img src={form.companyLogo} alt="Company Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem' }}>
                  No Logo Uploaded (Default will be used)
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label
                  className="btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    padding: '0.65rem 1.25rem',
                    background: accentColor,
                    borderColor: accentColor
                  }}
                >
                  <Upload size={16} /> Upload Company Logo Image
                  <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleLogoUpload} style={{ display: 'none' }} />
                </label>

                {form.companyLogo && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    style={{
                      color: '#ef4444',
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      padding: '0.6rem 1rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <Trash2 size={14} /> Remove Logo
                  </button>
                )}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Recommended: Transparent PNG logo (Max 2MB). This exact logo will print at the top left of all Tax Invoice PDFs for <strong>{companyEntity}</strong>.
              </span>
            </div>
          </div>
        </div>

        {/* Company Business Profile */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <Building size={18} color={accentColor} /> Legal Business Profile & GSTIN
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div>
              <label className="form-label">Company / Firm Legal Name *</label>
              <input
                type="text"
                name="companyName"
                value={form.companyName}
                onChange={handleChange}
                className="form-control"
                style={{ fontWeight: 600 }}
                required
              />
            </div>

            <div>
              <label className="form-label">GSTIN Number</label>
              <input
                type="text"
                name="companyGstin"
                value={form.companyGstin}
                onChange={handleChange}
                placeholder="24AAAAA0000A1Z5"
                className="form-control"
                style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}
              />
            </div>

            <div>
              <label className="form-label">Phone / Mobile</label>
              <input
                type="text"
                name="companyPhone"
                value={form.companyPhone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
                className="form-control"
              />
            </div>

            <div>
              <label className="form-label">Email Address</label>
              <input
                type="email"
                name="companyEmail"
                value={form.companyEmail}
                onChange={handleChange}
                placeholder="billing@company.com"
                className="form-control"
              />
            </div>

            <div>
              <label className="form-label">State Name</label>
              <input
                type="text"
                name="companyState"
                value={form.companyState}
                onChange={handleChange}
                className="form-control"
              />
            </div>

            <div>
              <label className="form-label">State GST Code</label>
              <input
                type="text"
                name="companyStateCode"
                value={form.companyStateCode}
                onChange={handleChange}
                placeholder="24"
                className="form-control"
              />
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label className="form-label">Registered Office & Factory Address</label>
            <textarea
              name="companyAddress"
              value={form.companyAddress}
              onChange={handleChange}
              rows={3}
              className="form-control"
              placeholder="Full address printed on Tax Invoices"
            />
          </div>
        </div>

        {/* Bank & Payment Details */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#10b981', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <CreditCard size={18} /> Bank Account Details (Printed on Invoices)
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div>
              <label className="form-label">Bank Name</label>
              <input
                type="text"
                name="companyBankName"
                value={form.companyBankName}
                onChange={handleChange}
                placeholder="HDFC Bank / ICICI Bank"
                className="form-control"
              />
            </div>

            <div>
              <label className="form-label">Account Number</label>
              <input
                type="text"
                name="companyAccountNo"
                value={form.companyAccountNo}
                onChange={handleChange}
                placeholder="50200012345678"
                className="form-control"
              />
            </div>

            <div>
              <label className="form-label">IFSC Code</label>
              <input
                type="text"
                name="companyIfscCode"
                value={form.companyIfscCode}
                onChange={handleChange}
                placeholder="HDFC0001234"
                className="form-control"
                style={{ textTransform: 'uppercase' }}
              />
            </div>
          </div>
        </div>

        {/* Invoice Numbering & Sequence */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f59e0b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <FileText size={18} /> Invoice Prefix & Numbering Sequence
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div>
              <label className="form-label">Invoice Prefix</label>
              <input
                type="text"
                name="invoicePrefix"
                value={form.invoicePrefix}
                onChange={handleChange}
                placeholder={companyEntity === 'Elite Fabtex' ? 'EF-2627-' : 'EE-2627-'}
                className="form-control"
              />
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                Preview generated invoice: <strong>{form.invoicePrefix}{String(form.startingInvoiceNo || 1).padStart(4, '0')}</strong>
              </span>
            </div>

            <div>
              <label className="form-label">Starting Sequence Number</label>
              <input
                type="number"
                name="startingInvoiceNo"
                value={form.startingInvoiceNo}
                onChange={handleChange}
                className="form-control"
              />
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label className="form-label">Terms & Conditions (Printed on Invoice Footer)</label>
            <textarea
              name="companyTerms"
              value={form.companyTerms}
              onChange={handleChange}
              rows={3}
              className="form-control"
            />
          </div>
        </div>

        {/* Dynamic Values & Dropdowns */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ec4899', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <Sliders size={18} /> Dynamic Settings & Custom Dropdowns
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {/* Product Categories */}
            <div>
              <label className="form-label">Product Categories</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  value={newTagInput.categories}
                  onChange={(e) => setNewTagInput(t => ({ ...t, categories: e.target.value }))}
                  placeholder="Add category..."
                  className="form-control"
                />
                <button type="button" onClick={() => handleAddTag('categories')} className="btn-secondary" style={{ padding: '0.4rem 0.85rem' }}>
                  <Plus size={16} />
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {form.categories?.map(tag => (
                  <span key={tag} style={{ background: 'rgba(236,72,153,0.15)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.3)', padding: '3px 10px', borderRadius: '6px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    {tag} <Trash2 size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveTag('categories', tag)} />
                  </span>
                ))}
              </div>
            </div>

            {/* Fabrics */}
            <div>
              <label className="form-label">Fabric Types</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  value={newTagInput.fabrics}
                  onChange={(e) => setNewTagInput(t => ({ ...t, fabrics: e.target.value }))}
                  placeholder="Add fabric..."
                  className="form-control"
                />
                <button type="button" onClick={() => handleAddTag('fabrics')} className="btn-secondary" style={{ padding: '0.4rem 0.85rem' }}>
                  <Plus size={16} />
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {form.fabrics?.map(tag => (
                  <span key={tag} style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', padding: '3px 10px', borderRadius: '6px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    {tag} <Trash2 size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveTag('fabrics', tag)} />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Save Action */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
            style={{
              padding: '0.85rem 3rem',
              fontSize: '1rem',
              fontWeight: 800,
              background: `linear-gradient(135deg, ${accentColor} 0%, #4c1d95 100%)`,
              borderColor: accentColor,
              boxShadow: `0 4px 18px ${accentColor}40`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.6rem'
            }}
          >
            {saving ? <RefreshCw className="spin" size={18} /> : <CheckCircle2 size={18} />} Save All Company Settings
          </button>
        </div>
      </form>
      )}
    </div>
  );
}
