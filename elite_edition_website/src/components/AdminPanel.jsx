import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { triggerPushNotification } from './NotificationToast';
import { matchSearchQuery } from '../utils/searchUtils';
import PrintSettings from './PrintSettings';
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
  FileText,
  Database,
  Calendar,
  Layers,
  Download,
  FileSpreadsheet,
  Search,
  Settings
} from 'lucide-react';

const AVAILABLE_SCREENS = [
  // General & Core
  { id: 'dashboard', label: 'Dashboard Overview', category: 'General' },
  { id: 'workspace', label: 'Workspace / Chat', category: 'General' },
  { id: 'reports', label: 'Reports Center', category: 'General' },
  { id: 'unicommerce', label: 'Uniware Integrations', category: 'General' },
  { id: 'myntra', label: 'Myntra Integrations', category: 'General' },
  { id: 'admin', label: 'Admin User & Infrastructure Settings', category: 'General' },

  // Elite Edition (E-Commerce)
  { id: 'elite_online', label: 'Elite Online: Dashboard', category: 'Elite Edition' },
  { id: 'inventory', label: 'Elite Online: Store Inventory', category: 'Elite Edition' },
  { id: 'catalog', label: 'Elite Online: Product Catalog', category: 'Elite Edition' },
  { id: 'returns', label: 'Elite Online: Returns Department', category: 'Elite Edition' },
  { id: 'sales', label: 'Elite Online: Sales Orders', category: 'Elite Edition' },

  // Elite Digital Print
  { id: 'jobcards', label: 'Elite Prints: Dashboard', category: 'Elite Digital Print' },
  { id: 'jobcards_list', label: 'Elite Prints: Job Card', category: 'Elite Digital Print' },
  { id: 'jobcards_catalogue', label: 'Elite Prints: Design Catalog', category: 'Elite Digital Print' },
  { id: 'jobcards_tracking', label: 'Elite Prints: Job Card Tracking', category: 'Elite Digital Print' },
  { id: 'jobcards_printing_log', label: 'Elite Prints: Printing Department', category: 'Elite Digital Print' },
  { id: 'jobcards_master', label: 'Elite Prints: Design Master (100 Pic)', category: 'Elite Digital Print' },
  { id: 'jobcards_fabric', label: 'Elite Prints: Fabric Management', category: 'Elite Digital Print' },
  { id: 'jobcards_raw_materials', label: 'Elite Prints: Raw Materials', category: 'Elite Digital Print' },
  { id: 'jobcards_billing', label: 'Elite Prints: Billing & Invoicing', category: 'Elite Digital Print' },
  { id: 'complaint_dashboard', label: 'Elite Prints: Complaint Dashboard (View Only)', category: 'Elite Digital Print' },
  { id: 'complaint_create', label: 'Elite Prints: Log New Complaint (Create Access)', category: 'Elite Digital Print' },
  { id: 'expense_dashboard', label: 'Elite Prints: Department Expenses (View Only)', category: 'Elite Digital Print' },
  { id: 'expense_create', label: 'Elite Prints: Log Department Expense (IN/OUT)', category: 'Elite Digital Print' },
  { id: 'jobcards_settings', label: 'Elite Prints: Settings', category: 'Elite Digital Print' },

  // Elite Stitching
  { id: 'stitching_jobcards', label: 'Elite Stitching: Job Card Tracking', category: 'Elite Stitching' },
  { id: 'stitching_design', label: 'Elite Stitching: Design Room', category: 'Elite Stitching' },
  { id: 'stitching_fabric', label: 'Elite Stitching: Fabric Challans', category: 'Elite Stitching' },
  { id: 'stitching_settings', label: 'Elite Stitching: Settings', category: 'Elite Stitching' },
];

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Sub Tab Navigation
  const [activeSubTab, setActiveSubTab] = useState('users'); // 'users', 'billing', 'backup'
  const [bills, setBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [billFormData, setBillFormData] = useState({
    month: '',
    awsAmount: '',
    mongoDbAmount: '',
    notes: ''
  });
  const [editingBill, setEditingBill] = useState(null); // null means "Add Mode"

  // Data Backup Form State
  const [backupForm, setBackupForm] = useState({
    startDate: '',
    endDate: '',
    department: 'all',
    format: 'json'
  });
  const [backupLoading, setBackupLoading] = useState(false);

  // Form & Modal State
  const [showUserModal, setShowUserModal] = useState(false);
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

  const handleDownloadBackup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBackupLoading(true);
    try {
      await api.downloadDataBackup({
        startDate: backupForm.startDate,
        endDate: backupForm.endDate,
        department: backupForm.department,
        format: backupForm.format
      });
      setSuccess('Full data backup archive generated and downloaded successfully!');
      triggerPushNotification('Data Backup Complete', 'Backup file downloaded to your system.');
    } catch (err) {
      setError(err.message || 'Failed to generate data backup.');
    } finally {
      setBackupLoading(false);
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
      password: '',
      role: user.role || (user.permissions?.length === AVAILABLE_SCREENS.length ? 'admin' : 'user'),
      permissions: user.permissions || []
    });
    setError('');
    setSuccess('');
    setShowUserModal(true);
  };

  const handleCreateNewClick = () => {
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
    setShowUserModal(true);
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setShowUserModal(false);
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
        const updatePayload = {
          name: formData.name.trim(),
          email: formData.email.trim(),
          role: formData.role,
          permissions: formData.permissions
        };
        if (formData.password) {
          updatePayload.password = formData.password;
        }

        const updatedRes = await api.updateUser(editingUser.id || editingUser._id, updatePayload);
        const loggedUser = api.getCurrentUser();
        if (loggedUser && (loggedUser.id === editingUser.id || loggedUser._id === editingUser.id)) {
          if (updatedRes && updatedRes.user) {
            localStorage.setItem('elite_user', JSON.stringify(updatedRes.user));
          } else {
            localStorage.setItem('elite_user', JSON.stringify({ ...loggedUser, ...updatePayload }));
          }
        }

        setSuccess(`User "${formData.name}" credentials updated successfully.`);
        triggerPushNotification('👤 User Updated', `User "${formData.name}" credentials updated successfully!`, 'info');
      } else {
        await api.createUser({
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password,
          role: formData.role,
          permissions: formData.permissions
        });
        setSuccess(`User "${formData.name}" created successfully.`);
        triggerPushNotification('👤 User Account Created', `User "${formData.name}" added successfully!`, 'success');
      }

      setShowUserModal(false);
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
              {activeSubTab === 'users' ? 'Admin User Management' : activeSubTab === 'billing' ? 'Infrastructure Billing Management' : activeSubTab === 'backup' ? 'System Data Backup & Export' : 'Department Expense Settings'}
            </h2>
            <p style={styles.pageSubtitle}>
              {activeSubTab === 'users'
                ? 'Create system users, set passwords, and manage screen-by-screen functionality credentials.'
                : activeSubTab === 'billing'
                ? 'Track monthly cloud bills for AWS and MongoDB to monitor hosting costs.'
                : activeSubTab === 'backup'
                ? 'Export comprehensive system data filtered by department and custom date ranges.'
                : 'Configure Cash IN categories, Cash OUT categories, and Payment Modes for department expense entry forms.'}
            </p>
          </div>
        </div>
      </div>

      {/* Sub Tabs Selection */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => { setActiveSubTab('users'); setError(''); setSuccess(''); }}
          className={activeSubTab === 'users' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem' }}
        >
          <User size={16} /> User Accounts
        </button>
        <button
          onClick={() => { setActiveSubTab('settings'); setError(''); setSuccess(''); }}
          className={activeSubTab === 'settings' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Settings size={16} /> Expense Settings
        </button>
        <button
          onClick={() => { setActiveSubTab('billing'); setError(''); setSuccess(''); }}
          className={activeSubTab === 'billing' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem' }}
        >
          <CreditCard size={16} /> Infrastructure Billing
        </button>
        <button
          onClick={() => { setActiveSubTab('backup'); setError(''); setSuccess(''); }}
          className={activeSubTab === 'backup' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Database size={16} /> Data Backup
        </button>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}
      {success && <div style={styles.successBox}>{success}</div>}

      {activeSubTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Summary Metric Cards Header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem', borderLeft: '4px solid #2563eb' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={20} color="#2563eb" />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Registered Accounts</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{users.length} Users</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem', borderLeft: '4px solid #dc2626' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldAlert size={20} color="#dc2626" />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Administrator Roles</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#dc2626', marginTop: 2 }}>
                  {users.filter(u => u.role === 'admin' || (u.permissions && u.permissions.length === AVAILABLE_SCREENS.length)).length} Admins
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem', borderLeft: '4px solid #16a34a' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserPlus size={20} color="#16a34a" />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Standard Accounts</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a', marginTop: 2 }}>
                  {users.filter(u => u.role !== 'admin' && (u.permissions?.length !== AVAILABLE_SCREENS.length)).length} Standard Users
                </div>
              </div>
            </div>
          </div>

          {/* 100% Full-Width Users Table Panel */}
          <div className="glass-panel" style={{ ...styles.tablePanel, width: '100%' }}>
            <div style={styles.panelHeader}>
              <Sliders size={16} color="var(--primary)" />
              <h3 style={styles.panelTitle}>Active User Accounts ({users.length})</h3>
              {loading && <RotateCw size={14} className="spin-loader" style={{ marginLeft: '0.5rem', color: 'var(--text-muted)' }} />}
              <button
                type="button"
                onClick={handleCreateNewClick}
                className="btn-primary"
                style={{ marginLeft: 'auto', padding: '0.45rem 1rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderRadius: '8px' }}
              >
                <UserPlus size={15} />
                <span>Add New User</span>
              </button>
            </div>

            {/* Live Search Input */}
            <div style={{ position: 'relative', marginTop: '0.5rem' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Filter users by name, email, or role..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                style={{ width: '100%', paddingLeft: 34, fontSize: '0.85rem', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '6px' }}
              />
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
                      <th>Account</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Allowed Functionalities</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users
                      .filter(u => matchSearchQuery(u, userSearch, ['name', 'email', 'role']))
                      .map((u) => {
                        const checkAdmin = u.role === 'admin' || (u.permissions && u.permissions.length === AVAILABLE_SCREENS.length);
                        const isCurrentlyEditing = editingUser && (editingUser.id === u.id || editingUser._id === u.id);

                        return (
                          <tr key={u.id || u._id} style={{ background: isCurrentlyEditing ? '#eff6ff' : 'transparent', transition: 'background 0.15s' }}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                <div style={styles.avatar(checkAdmin)}>
                                  {u.name ? u.name[0].toUpperCase() : 'U'}
                                </div>
                                <div>
                                  <span style={{ fontWeight: '700', color: '#0f172a', display: 'block', fontSize: '0.88rem' }}>{u.name}</span>
                                  {isCurrentlyEditing && (
                                    <span style={{ fontSize: '0.68rem', color: '#2563eb', fontWeight: 800 }}>[Editing Now]</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td style={{ color: '#334155', fontWeight: 500, fontSize: '0.82rem' }}>{u.email}</td>
                            <td>
                              <span style={{
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                textTransform: 'uppercase',
                                background: checkAdmin ? '#fee2e2' : '#dbeafe',
                                color: checkAdmin ? '#dc2626' : '#1d4ed8',
                                border: `1px solid ${checkAdmin ? '#fca5a5' : '#93c5fd'}`
                              }}>
                                {checkAdmin ? '🛡️ ADMIN' : '👤 USER'}
                              </span>
                            </td>
                            <td>
                              <div style={styles.permissionsList}>
                                {checkAdmin ? (
                                  <span style={styles.adminAllBadge}>⚡ FULL SYSTEM ACCESS</span>
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
                                  <span style={styles.noScreensBadge}>NO ACCESS GRANTED</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div style={styles.actionsCell}>
                                <button
                                  onClick={() => handleEditClick(u)}
                                  style={{
                                    padding: '0.4rem 0.75rem',
                                    background: '#eff6ff',
                                    border: '1px solid #bfdbfe',
                                    color: '#2563eb',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                  }}
                                  title="Edit Credentials"
                                >
                                  <Edit2 size={14} /> Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  style={{
                                    padding: '0.4rem 0.75rem',
                                    background: '#fef2f2',
                                    border: '1px solid #fecaca',
                                    color: '#dc2626',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                  }}
                                  title="Delete User"
                                >
                                  <Trash2 size={14} /> Delete
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

          {/* 🌟 FLOATING MODAL OVERLAY FOR USER FORM 🌟 */}
          {showUserModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(5px)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <div style={{
                background: '#ffffff',
                width: '100%',
                maxWidth: '680px',
                maxHeight: '90vh',
                borderRadius: '14px',
                boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
                border: '1px solid #cbd5e1',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                {/* Modal Header */}
                <div style={{
                  padding: '1.1rem 1.5rem',
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: '#eff6ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <UserPlus size={18} color="#2563eb" />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                        {editingUser ? `Edit Account — ${editingUser.name}` : 'Create New Account'}
                      </h3>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                        {editingUser ? 'Update user role, credentials, and screen access permissions.' : 'Configure credentials and assign operational screen permissions.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    style={{
                      background: '#f1f5f9',
                      border: 'none',
                      borderRadius: '50%',
                      width: 32,
                      height: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Modal Form Body */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                  <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Full Name *</label>
                      <div style={styles.inputWrapper}>
                        <User size={15} style={styles.inputIcon} />
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          placeholder="e.g. Rahul Sharma"
                          required
                          style={styles.formInput}
                        />
                      </div>
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>Email Address *</label>
                      <div style={styles.inputWrapper}>
                        <Mail size={15} style={styles.inputIcon} />
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="rahul@elite.com"
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
                        <Lock size={15} style={styles.inputIcon} />
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
                        <option value="user">User (Restricted Screen Access)</option>
                        <option value="admin">Admin (Full System Access)</option>
                      </select>
                    </div>

                    <div style={styles.formGroup}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
                        <label style={styles.label}>Functionality Access (Allowed Screens)</label>
                        {formData.role !== 'admin' && (
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => setFormData(p => ({ ...p, permissions: AVAILABLE_SCREENS.map(s => s.id) }))}
                              className="btn-secondary"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', fontWeight: 700 }}
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData(p => ({ ...p, permissions: [] }))}
                              className="btn-secondary"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', fontWeight: 700 }}
                            >
                              Clear All
                            </button>
                          </div>
                        )}
                      </div>
                      <p style={styles.helpText}>
                        Select which operational modules and screens this user is authorized to open.
                      </p>

                      {Array.from(new Set(AVAILABLE_SCREENS.map(s => s.category))).map(cat => {
                        const catScreens = AVAILABLE_SCREENS.filter(s => s.category === cat);
                        const allChecked = catScreens.every(s => formData.permissions.includes(s.id));
                        const catTitle = cat === 'General' ? '⚙️ Core & General' :
                                         cat === 'Elite Edition' ? '🛍️ Elite Edition (E-Commerce)' :
                                         cat === 'Elite Digital Print' ? '🖨️ Elite Digital Print' :
                                         cat === 'Elite Stitching' ? '✂️ Elite Stitching' : `📁 ${cat}`;

                        return (
                          <div key={cat} style={{ marginBottom: '0.85rem', background: '#f8fafc', padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {catTitle}
                              </span>
                              {formData.role !== 'admin' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const ids = catScreens.map(s => s.id);
                                    setFormData(prev => {
                                      const hasAll = ids.every(id => prev.permissions.includes(id));
                                      const updated = hasAll
                                        ? prev.permissions.filter(id => !ids.includes(id))
                                        : Array.from(new Set([...prev.permissions, ...ids]));
                                      return { ...prev, permissions: updated };
                                    });
                                  }}
                                  style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
                                >
                                  {allChecked ? 'Deselect Category' : 'Select Category'}
                                </button>
                              )}
                            </div>

                            <div style={styles.checkboxGrid}>
                              {catScreens.map(screen => {
                                const isChecked = formData.permissions.includes(screen.id);
                                return (
                                  <label
                                    key={screen.id}
                                    style={{
                                      ...styles.checkboxLabel,
                                      background: isChecked ? '#eff6ff' : '#ffffff',
                                      borderColor: isChecked ? '#2563eb' : '#e2e8f0',
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
                                    <span style={{ fontSize: '0.82rem', fontWeight: isChecked ? 700 : 500, color: isChecked ? '#1d4ed8' : '#334155' }}>{screen.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Modal Footer Actions */}
                  <div style={{
                    padding: '1rem 1.5rem',
                    background: '#f8fafc',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.75rem'
                  }}>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="btn-secondary"
                      style={{ padding: '0.55rem 1.2rem', fontSize: '0.85rem', fontWeight: 700, borderRadius: '6px' }}
                    >
                      <X size={15} />
                      <span>Cancel</span>
                    </button>
                    <button
                      type="submit"
                      className="btn-success"
                      style={{
                        padding: '0.55rem 1.4rem',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}
                      disabled={submitLoading}
                    >
                      {submitLoading ? (
                        <RotateCw size={15} className="spin-loader" />
                      ) : (
                        <Save size={15} />
                      )}
                      <span>{editingUser ? 'Save Credentials' : 'Create User Account'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'billing' && (
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

      {activeSubTab === 'backup' && (
        <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <Database size={24} color="var(--primary)" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>System Data Backup & Export</h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                Export comprehensive system data filtered by department and custom start/end date ranges.
              </p>
            </div>
          </div>

          <form onSubmit={handleDownloadBackup} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginTop: '1rem' }}>
            {/* Start Date */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Start Date (Optional)</label>
              <div style={styles.inputWrapper}>
                <Calendar size={14} style={styles.inputIcon} />
                <input
                  type="date"
                  value={backupForm.startDate}
                  onChange={(e) => setBackupForm(prev => ({ ...prev, startDate: e.target.value }))}
                  style={styles.formInput}
                />
              </div>
            </div>

            {/* End Date */}
            <div style={styles.formGroup}>
              <label style={styles.label}>End Date (Optional)</label>
              <div style={styles.inputWrapper}>
                <Calendar size={14} style={styles.inputIcon} />
                <input
                  type="date"
                  value={backupForm.endDate}
                  onChange={(e) => setBackupForm(prev => ({ ...prev, endDate: e.target.value }))}
                  style={styles.formInput}
                />
              </div>
            </div>

            {/* Department Select */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Select Department *</label>
              <div style={styles.inputWrapper}>
                <Layers size={14} style={styles.inputIcon} />
                <select
                  value={backupForm.department}
                  onChange={(e) => setBackupForm(prev => ({ ...prev, department: e.target.value }))}
                  style={styles.formInput}
                >
                  <option value="all">⚡ All Departments (Full System Backup)</option>
                  <option value="billing">🧾 Billing & Invoicing</option>
                  <option value="design">🎨 Design Room</option>
                  <option value="digital_printing">🖨️ Digital Printing (Job Cards & Logs)</option>
                  <option value="fabric">🧵 Fabric Inventory & Stock</option>
                  <option value="stitching">🪡 Stitching Department</option>
                  <option value="garment">👔 Garment Job Cards</option>
                  <option value="sales">🛒 E-Commerce Sales & Catalog</option>
                  <option value="customers">👥 Customers & Vendors Master</option>
                </select>
              </div>
            </div>

            {/* File Format */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Export File Format *</label>
              <div style={styles.inputWrapper}>
                <FileSpreadsheet size={14} style={styles.inputIcon} />
                <select
                  value={backupForm.format}
                  onChange={(e) => setBackupForm(prev => ({ ...prev, format: e.target.value }))}
                  style={styles.formInput}
                >
                  <option value="json">JSON Data Archive (.json)</option>
                  <option value="csv">CSV Spreadsheet (.csv)</option>
                </select>
              </div>
            </div>

            {/* Download Button */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={backupLoading}
                style={{ padding: '0.7rem 1.8rem', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {backupLoading ? <RotateCw size={16} className="spin-loader" /> : <Download size={16} />}
                <span>{backupLoading ? 'Generating Backup File...' : 'Download Data Backup'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {activeSubTab === 'settings' && (
        <PrintSettings expenseOnly={true} />
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
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
    fontWeight: '800',
    color: '#ffffff',
    boxShadow: isAdmin ? '0 2px 8px rgba(220, 38, 38, 0.25)' : '0 2px 8px rgba(37, 99, 235, 0.25)',
    background: isAdmin
      ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
      : 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)'
  }),
  permissionsList: {
    display: 'flex',
    gap: '0.3rem',
    flexWrap: 'wrap',
    maxWidth: '320px'
  },
  permissionBadge: {
    fontSize: '0.7rem',
    fontWeight: 600,
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    color: '#1d4ed8',
    padding: '0.15rem 0.45rem',
    borderRadius: '4px'
  },
  adminAllBadge: {
    fontSize: '0.72rem',
    background: '#fee2e2',
    border: '1px solid #fca5a5',
    color: '#dc2626',
    padding: '0.15rem 0.55rem',
    borderRadius: '4px',
    fontWeight: '800',
    letterSpacing: '0.02em'
  },
  noScreensBadge: {
    fontSize: '0.7rem',
    background: '#f1f5f9',
    border: '1px solid #cbd5e1',
    color: '#64748b',
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
    fontWeight: 600
  },
  actionsCell: {
    display: 'flex',
    gap: '0.4rem',
    justifyContent: 'center'
  },
  trashBtn: {
    color: '#dc2626',
    borderColor: '#fecaca',
    background: '#fef2f2'
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
    fontSize: '0.82rem',
    fontWeight: '700',
    color: '#1e293b',
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
    color: '#64748b'
  },
  formInput: {
    width: '100%',
    paddingLeft: '2.2rem',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    color: '#0f172a',
    borderRadius: '6px',
    fontSize: '0.88rem'
  },
  formInputWithoutIcon: {
    width: '100%',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    color: '#0f172a',
    borderRadius: '6px',
    fontSize: '0.88rem'
  },
  selectInput: {
    width: '100%',
    padding: '0.65rem 0.75rem',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    color: '#0f172a',
    borderRadius: '6px',
    fontSize: '0.88rem',
    fontWeight: 600,
    outline: 'none',
  },
  helpText: {
    fontSize: '0.72rem',
    color: '#64748b',
    margin: '0 0 0.25rem 2px',
    fontWeight: 500
  },
  checkboxGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: '0.5rem',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    padding: '0.45rem 0.6rem',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    transition: 'all 0.15s ease',
    userSelect: 'none'
  },
  checkboxLabelDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  checkbox: {
    cursor: 'pointer',
    accentColor: '#2563eb',
    width: '15px',
    height: '15px'
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
    fontSize: '0.85rem',
    borderRadius: '6px',
    fontWeight: 700
  },
  submitBtn: {
    flex: 1,
    justifyContent: 'center'
  },
  errorBox: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '0.65rem 0.75rem',
    color: '#dc2626',
    fontWeight: 700,
    fontSize: '0.82rem'
  },
  successBox: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '6px',
    padding: '0.65rem 0.75rem',
    color: '#16a34a',
    fontWeight: 700,
    fontSize: '0.82rem'
  }
};