import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  UserPlus,
  ShieldAlert,
  Key,
  Edit2,
  Trash2,
  Save,
  RotateCw,
  User,
  Check,
  X,
  Lock,
  Mail,
  Sliders,
  Coins,
  CreditCard,
  DollarSign,
  FileText
} from 'lucide-react';

const AVAILABLE_SCREENS = [
  { id: 'dashboard', label: 'Dashboard Overview' },
  { id: 'inventory', label: 'Store Inventory' },
  { id: 'catalog', label: 'Product Catalog' },
  { id: 'returns', label: 'Returns Department' },
  { id: 'sales', label: 'Sales Orders Department' },
  { id: 'reports', label: 'Reports Center' },
  { id: 'unicommerce', label: 'Uniware Integrations' },
  { id: 'myntra', label: 'Myntra Integrations' },
  { id: 'jobcards', label: 'Elite Prints: Dashboard' },
  { id: 'jobcards_list', label: 'Elite Prints: Job Card' },
  { id: 'jobcards_catalogue', label: 'Elite Prints: Design Catalog' },
  { id: 'jobcards_tracking', label: 'Elite Prints: Job Card Tracking' },
  { id: 'jobcards_master', label: 'Elite Prints: Design Master' },
  { id: 'jobcards_fabric', label: 'Elite Prints: Fabric Management' },
  { id: 'jobcards_raw_materials', label: 'Elite Prints: Raw Materials' },
  { id: 'jobcards_settings', label: 'Elite Prints: Settings' },
];

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Sub Tab Navigation
  const [activeSubTab, setActiveSubTab] = useState('users'); // 'users' or 'billing'
  const [bills, setBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [billFormData, setBillFormData] = useState({
    month: '',
    awsAmount: '',
    mongoDbAmount: '',
    notes: ''
  });
  const [editingBill, setEditingBill] = useState(null); // null means "Add Mode"

  // Form State
  const [editingUser, setEditingUser] = useState(null); // null means "Add Mode"
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    permissions: []
  });

  const fetchBills = async () => {
    setBillsLoading(true);
    setError('');
    try {
      const res = await api.getInfraBills();
      if (res && res.success) {
        setBills(res.bills || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch billing records.');
    } finally {
      setBillsLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'billing') {
      fetchBills();
    }
  }, [activeSubTab]);

  const handleBillSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!billFormData.month.trim()) {
      setError('Month is required.');
      return;
    }

    setSubmitLoading(true);
    try {
      const payload = {
        month: billFormData.month.trim(),
        awsAmount: Number(billFormData.awsAmount || 0),
        mongoDbAmount: Number(billFormData.mongoDbAmount || 0),
        notes: (billFormData.notes || '').trim()
      };

      if (editingBill) {
        await api.updateInfraBill(editingBill._id || editingBill.id, payload);
        setSuccess(`Billing for "${billFormData.month}" updated successfully.`);
      } else {
        await api.createInfraBill(payload);
        setSuccess(`Billing for "${billFormData.month}" logged successfully.`);
      }

      handleCancelBillEdit();
      fetchBills();
    } catch (err) {
      setError(err.message || 'Failed to save billing record.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEditBillClick = (bill) => {
    setEditingBill(bill);
    setBillFormData({
      month: bill.month || '',
      awsAmount: bill.awsAmount !== undefined ? String(bill.awsAmount) : '',
      mongoDbAmount: bill.mongoDbAmount !== undefined ? String(bill.mongoDbAmount) : '',
      notes: bill.notes || ''
    });
    setError('');
    setSuccess('');
  };

  const handleCancelBillEdit = () => {
    setEditingBill(null);
    setBillFormData({
      month: '',
      awsAmount: '',
      mongoDbAmount: '',
      notes: ''
    });
    setError('');
    setSuccess('');
  };

  const handleDeleteBill = async (bill) => {
    if (!window.confirm(`Are you sure you want to delete the billing record for "${bill.month}"?`)) return;

    setError('');
    setSuccess('');
    try {
      await api.deleteInfraBill(bill._id || bill.id);
      setSuccess(`Billing for "${bill.month}" deleted successfully.`);
      fetchBills();
      if (editingBill && (editingBill._id === bill._id || editingBill.id === bill.id)) {
        handleCancelBillEdit();
      }
    } catch (err) {
      setError(err.message || 'Failed to delete billing record.');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getUsers({ limit: 100 });
      if (res && res.users) {
        setUsers(res.users.rows || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch users list.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleRoleChange = (e) => {
    const roleValue = e.target.value;
    setFormData(prev => ({
      ...prev,
      role: roleValue,
      // If admin, auto-select all screen permissions, otherwise empty them
      permissions: roleValue === 'admin' ? AVAILABLE_SCREENS.map(s => s.id) : []
    }));
  };

  const handlePermissionCheckbox = (screenId) => {
    setFormData(prev => {
      const isChecked = prev.permissions.includes(screenId);
      let updatedPerms = [];
      if (isChecked) {
        updatedPerms = prev.permissions.filter(p => p !== screenId);
      } else {
        updatedPerms = [...prev.permissions, screenId];
      }
      return {
        ...prev,
        permissions: updatedPerms
      };
    });
  };

  const handleEditClick = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      password: '', // Don't prefill password
      role: user.role || (user.permissions?.length === AVAILABLE_SCREENS.length ? 'admin' : 'user'),
      permissions: user.permissions || []
    });
    setError('');
    setSuccess('');
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'user',
      permissions: []
    });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name.trim() || !formData.email.trim()) {
      setError('Name and Email are required.');
      return;
    }

    if (!editingUser && !formData.password) {
      setError('Password is required for new users.');
      return;
    }

    setSubmitLoading(true);
    try {
      if (editingUser) {
        // Update user payload
        const updatePayload = {
          name: formData.name.trim(),
          email: formData.email.trim(),
          role: formData.role,
          permissions: formData.permissions
        };
        if (formData.password) {
          updatePayload.password = formData.password;
        }

        await api.updateUser(editingUser.id, updatePayload);
        setSuccess(`User "${formData.name}" updated successfully.`);
      } else {
        // Create user payload
        await api.createUser({
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password,
          role: formData.role,
          permissions: formData.permissions
        });
        setSuccess(`User "${formData.name}" created successfully.`);
      }

      handleCancelEdit();
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Failed to save user.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteUser = async (user) => {
    const currentUser = api.getCurrentUser();
    if (currentUser && currentUser.id === user.id) {
      setError("You cannot delete your own logged-in account.");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete user "${user.name}"?`)) return;

    setError('');
    setSuccess('');
    try {
      await api.deleteUser(user.id);
      setSuccess(`User "${user.name}" deleted successfully.`);
      fetchUsers();
      if (editingUser && editingUser.id === user.id) {
        handleCancelEdit();
      }
    } catch (err) {
      setError(err.message || 'Failed to delete user.');
    }
  };

  return (
    <div style={styles.container}>
      {/* Page Title Header */}
      <div className="glass-panel" style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <ShieldAlert size={22} color="var(--primary)" />
          <div>
            <h2 style={styles.pageTitle}>
              {activeSubTab === 'users' ? 'Admin User Management' : 'Infrastructure Billing Management'}
            </h2>
            <p style={styles.pageSubtitle}>
              {activeSubTab === 'users'
                ? 'Create system users, set passwords, and manage screen-by-screen functionality credentials.'
                : 'Track monthly cloud bills for AWS and MongoDB to monitor hosting costs.'}
            </p>
          </div>
        </div>
      </div>

      {/* Sub Tabs Selection */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => { setActiveSubTab('users'); setError(''); setSuccess(''); }}
          className={activeSubTab === 'users' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem' }}
        >
          <User size={16} /> User Accounts
        </button>
        <button
          onClick={() => { setActiveSubTab('billing'); setError(''); setSuccess(''); }}
          className={activeSubTab === 'billing' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem' }}
        >
          <CreditCard size={16} /> Infrastructure Billing
        </button>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}
      {success && <div style={styles.successBox}>{success}</div>}

      {activeSubTab === 'users' ? (
        <div style={styles.contentLayout}>
          {/* Left Side: Users List */}
          <div className="glass-panel" style={styles.tablePanel}>
            <div style={styles.panelHeader}>
              <Sliders size={16} color="var(--primary)" />
              <h3 style={styles.panelTitle}>Active Accounts</h3>
              {loading && <RotateCw size={14} className="spin-loader" style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />}
            </div>

            <div className="table-container" style={styles.tableWrap}>
              {loading && users.length === 0 ? (
                <div style={styles.emptyState}>
                  <RotateCw size={24} className="spin-loader" color="var(--primary)" />
                  <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>Loading users list...</p>
                </div>
              ) : users.length === 0 ? (
                <div style={styles.emptyState}>
                  <User size={28} color="var(--text-muted)" />
                  <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>No user accounts found.</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Allowed Screens</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const checkAdmin = u.role === 'admin' || (u.permissions && u.permissions.length === AVAILABLE_SCREENS.length);

                      return (
                        <tr key={u.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={styles.avatar(checkAdmin)}>
                                {u.name ? u.name[0].toUpperCase() : 'U'}
                              </div>
                              <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{u.name}</span>
                            </div>
                          </td>
                          <td>{u.email}</td>
                          <td>
                            <span className={`badge ${checkAdmin ? 'badge-danger' : 'badge-success'}`}>
                              {checkAdmin ? 'ADMIN' : 'USER'}
                            </span>
                          </td>
                          <td>
                            <div style={styles.permissionsList}>
                              {checkAdmin ? (
                                <span style={styles.adminAllBadge}>ALL SCREENS</span>
                              ) : u.permissions && u.permissions.length > 0 ? (
                                u.permissions.map(p => {
                                  const screenObj = AVAILABLE_SCREENS.find(s => s.id === p);
                                  return (
                                    <span key={p} style={styles.permissionBadge}>
                                      {screenObj ? screenObj.label : p}
                                    </span>
                                  );
                                })
                              ) : (
                                <span style={styles.noScreensBadge}>NO SCREENS</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div style={styles.actionsCell}>
                              <button
                                onClick={() => handleEditClick(u)}
                                className="btn-icon"
                                title="Edit Credentials"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="btn-icon"
                                style={styles.trashBtn}
                                title="Delete User"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right Side: Create/Edit Form */}
          <div className="glass-panel" style={styles.formPanel}>
            <div style={styles.panelHeader}>
              <UserPlus size={16} color="var(--primary)" />
              <h3 style={styles.panelTitle}>
                {editingUser ? `Edit User Credentials — ${editingUser.name}` : 'Create New User'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Full Name *</label>
                <div style={styles.inputWrapper}>
                  <User size={14} style={styles.inputIcon} />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter user's name..."
                    required
                    style={styles.formInput}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Email Address *</label>
                <div style={styles.inputWrapper}>
                  <Mail size={14} style={styles.inputIcon} />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="user@elite.com..."
                    required
                    style={styles.formInput}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {editingUser ? 'New Password (leave blank to keep current)' : 'Password *'}
                </label>
                <div style={styles.inputWrapper}>
                  <Lock size={14} style={styles.inputIcon} />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder={editingUser ? 'Enter new password...' : 'Enter password...'}
                    required={!editingUser}
                    style={styles.formInput}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Account Role *</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleRoleChange}
                  style={styles.selectInput}
                >
                  <option value="user">User (Restricted Access)</option>
                  <option value="admin">Admin (Full Access)</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Functionality Access (Allowed Screens)</label>
                <p style={styles.helpText}>
                  Select which screens and operational tabs this user is permitted to see.
                </p>
                <div style={styles.checkboxGrid}>
                  {AVAILABLE_SCREENS.map(screen => {
                    const isChecked = formData.permissions.includes(screen.id);
                    return (
                      <label
                        key={screen.id}
                        style={{
                          ...styles.checkboxLabel,
                          ...(formData.role === 'admin' ? styles.checkboxLabelDisabled : {})
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={formData.role === 'admin'}
                          onChange={() => handlePermissionCheckbox(screen.id)}
                          style={styles.checkbox}
                        />
                        <span style={{ fontSize: '0.85rem' }}>{screen.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={styles.formActions}>
                {editingUser && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="btn-secondary"
                    style={styles.btn}
                  >
                    <X size={14} />
                    <span>Cancel</span>
                  </button>
                )}
                <button
                  type="submit"
                  className="btn-success"
                  style={{ ...styles.btn, ...styles.submitBtn }}
                  disabled={submitLoading}
                >
                  {submitLoading ? (
                    <RotateCw size={14} className="spin-loader" />
                  ) : (
                    <Save size={14} />
                  )}
                  <span>{editingUser ? 'Save Credentials' : 'Create User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div style={styles.contentLayout}>
          {/* Left Side: Bills List */}
          <div className="glass-panel" style={styles.tablePanel}>
            <div style={styles.panelHeader}>
              <CreditCard size={16} color="var(--primary)" />
              <h3 style={styles.panelTitle}>Monthly Bills History</h3>
              {billsLoading && <RotateCw size={14} className="spin-loader" style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />}
            </div>

            <div className="table-container" style={styles.tableWrap}>
              {billsLoading && bills.length === 0 ? (
                <div style={styles.emptyState}>
                  <RotateCw size={24} className="spin-loader" color="var(--primary)" />
                  <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>Loading billing history...</p>
                </div>
              ) : bills.length === 0 ? (
                <div style={styles.emptyState}>
                  <CreditCard size={28} color="var(--text-muted)" />
                  <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>No billing records registered yet.</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Sr. No.</th>
                      <th>Month</th>
                      <th className="text-right">AWS Amount</th>
                      <th className="text-right">MongoDB Amount</th>
                      <th className="text-right">Total Amount</th>
                      <th>Notes</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((b, idx) => (
                      <tr key={b._id || b.id}>
                        <td>{idx + 1}</td>
                        <td>
                          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{b.month}</span>
                        </td>
                        <td className="text-right" style={{ color: 'var(--text-primary)' }}>Rs. {Number(b.awsAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right" style={{ color: 'var(--text-primary)' }}>Rs. {Number(b.mongoDbAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right" style={{ fontWeight: '700', color: 'var(--primary)' }}>Rs. {Number(b.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.notes}>{b.notes || '—'}</td>
                        <td>
                          <div style={styles.actionsCell}>
                            <button
                              onClick={() => handleEditBillClick(b)}
                              className="btn-icon"
                              title="Edit Bill"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteBill(b)}
                              className="btn-icon"
                              style={styles.trashBtn}
                              title="Delete Bill"
                            >
                              <Trash2 size={14} />
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

          {/* Right Side: Add/Edit Bill Form */}
          <div className="glass-panel" style={styles.formPanel}>
            <div style={styles.panelHeader}>
              <UserPlus size={16} color="var(--primary)" />
              <h3 style={styles.panelTitle}>
                {editingBill ? `Edit Billing Record — ${editingBill.month}` : 'Add Monthly Bill'}
              </h3>
            </div>

            <form onSubmit={handleBillSubmit} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Month *</label>
                <div style={styles.inputWrapper}>
                  <input
                    type="text"
                    name="month"
                    value={billFormData.month}
                    onChange={e => setBillFormData(p => ({ ...p, month: e.target.value }))}
                    placeholder="e.g. June 2026"
                    required
                    style={styles.formInputWithoutIcon}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>AWS Amount (Rs.) *</label>
                <div style={styles.inputWrapper}>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    name="awsAmount"
                    value={billFormData.awsAmount}
                    onChange={e => setBillFormData(p => ({ ...p, awsAmount: e.target.value }))}
                    placeholder="e.g. 2169.78"
                    required
                    style={styles.formInputWithoutIcon}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>MongoDB Amount (Rs.) *</label>
                <div style={styles.inputWrapper}>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    name="mongoDbAmount"
                    value={billFormData.mongoDbAmount}
                    onChange={e => setBillFormData(p => ({ ...p, mongoDbAmount: e.target.value }))}
                    placeholder="e.g. 0.00"
                    required
                    style={styles.formInputWithoutIcon}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Notes</label>
                <textarea
                  name="notes"
                  value={billFormData.notes}
                  onChange={e => setBillFormData(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Add any billing context or invoices details..."
                  style={{
                    ...styles.formInputWithoutIcon,
                    minHeight: '80px',
                    background: 'rgba(17, 24, 39, 0.7)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.75rem',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={styles.formActions}>
                {editingBill && (
                  <button
                    type="button"
                    onClick={handleCancelBillEdit}
                    className="btn-secondary"
                    style={styles.btn}
                  >
                    <X size={14} />
                    <span>Cancel</span>
                  </button>
                )}
                <button
                  type="submit"
                  className="btn-success"
                  style={{ ...styles.btn, ...styles.submitBtn }}
                  disabled={submitLoading}
                >
                  {submitLoading ? (
                    <RotateCw size={14} className="spin-loader" />
                  ) : (
                    <Save size={14} />
                  )}
                  <span>{editingBill ? 'Save Changes' : 'Log Bill'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    width: '100%',
    maxWidth: '1100px',
    margin: '0 auto',
  },
  topBar: {
    padding: '1rem 1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  pageTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0
  },
  pageSubtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    margin: '2px 0 0 0'
  },
  contentLayout: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 1fr',
    gap: '1.5rem',
    alignItems: 'start'
  },
  tablePanel: {
    padding: '1.5rem',
    minHeight: '450px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  },
  formPanel: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.2rem'
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    borderBottom: '1px solid var(--border-light)',
    paddingBottom: '0.75rem'
  },
  panelTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    margin: 0
  },
  tableWrap: {
    flex: 1
  },
  avatar: (isAdmin) => ({
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8rem',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    background: isAdmin
      ? 'linear-gradient(135deg, #ef4444, #b91c1c)'
      : 'linear-gradient(135deg, var(--primary), #0891b2)'
  }),
  permissionsList: {
    display: 'flex',
    gap: '0.25rem',
    flexWrap: 'wrap',
    maxWidth: '300px'
  },
  permissionBadge: {
    fontSize: '0.7rem',
    background: 'rgba(6, 182, 212, 0.08)',
    border: '1px solid rgba(6, 182, 212, 0.15)',
    color: 'var(--primary)',
    padding: '0.1rem 0.4rem',
    borderRadius: '4px'
  },
  adminAllBadge: {
    fontSize: '0.7rem',
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#fca5a5',
    padding: '0.1rem 0.4rem',
    borderRadius: '4px',
    fontWeight: 'bold'
  },
  noScreensBadge: {
    fontSize: '0.7rem',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-muted)',
    padding: '0.1rem 0.4rem',
    borderRadius: '4px'
  },
  actionsCell: {
    display: 'flex',
    gap: '0.4rem',
    justifyContent: 'center'
  },
  trashBtn: {
    color: '#fca5a5',
    borderColor: 'rgba(239, 68, 68, 0.1)'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 1rem',
    textAlign: 'center'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.1rem'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem'
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: '500',
    color: '#d1d5db',
    marginLeft: '2px'
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  inputIcon: {
    position: 'absolute',
    left: '0.75rem',
    color: 'var(--text-muted)'
  },
  formInput: {
    width: '100%',
    paddingLeft: '2.2rem'
  },
  formInputWithoutIcon: {
    width: '100%',
  },
  selectInput: {
    width: '100%',
    padding: '0.65rem 0.75rem',
    background: 'rgba(17, 24, 39, 0.7)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    outline: 'none',
  },
  helpText: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    margin: '0 0 0.25rem 2px'
  },
  checkboxGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.75rem',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-light)',
    padding: '1rem',
    borderRadius: 'var(--radius-sm)'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    color: '#d1d5db',
    userSelect: 'none'
  },
  checkboxLabelDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  checkbox: {
    cursor: 'pointer'
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '0.5rem'
  },
  btn: {
    padding: '0.6rem 1.2rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.85rem'
  },
  submitBtn: {
    flex: 1,
    justifyContent: 'center'
  },
  errorBox: {
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    borderRadius: '6px',
    padding: '0.65rem 0.75rem',
    color: '#fca5a5',
    fontSize: '0.8rem'
  },
  successBox: {
    background: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.15)',
    borderRadius: '6px',
    padding: '0.65rem 0.75rem',
    color: '#a7f3d0',
    fontSize: '0.8rem'
  }
};