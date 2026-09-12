import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Briefcase,
  Users,
  HardHat,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Trash2,
  Edit3,
  Building2,
  FileText,
  X,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';

const RECORD_TYPES = [
  { key: 'ALL', label: 'All Connections', icon: Users, color: '#2563eb' },
  { key: 'VENDOR', label: 'Vendors & Suppliers', icon: Building2, color: '#0d9488' },
  { key: 'EMPLOYEE', label: 'Salaried Staff', icon: Briefcase, color: '#6366f1' },
  { key: 'WORKER', label: 'Factory Workers', icon: HardHat, color: '#2563eb' }
];

export default function BusinessConnectionPanel({ currentUser }) {
  const [connections, setConnections] = useState([]);
  const [counts, setCounts] = useState({ total: 0, vendor: 0, employee: 0, worker: 0 });
  const [loading, setLoading] = useState(false);
  const [activeType, setActiveType] = useState('ALL');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Manual Add / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    record_type: 'VENDOR',
    common_directory: {
      name: '',
      primary_phone: '',
      whatsapp_phone: '',
      email: '',
      city: '',
      state: '',
      address: '',
      is_active: true
    },
    vendor_data: {
      company_name: '',
      gst_or_tax_id: '',
      bank_account: '',
      bank_ifsc: '',
      upi_id: '',
      payment_terms: 'Net 30',
      supplied_items: ''
    },
    employee_data: {
      department: 'Production',
      designation: '',
      monthly_salary: '',
      joining_date: '',
      emergency_contact: ''
    },
    worker_data: {
      designation: '',
      station_or_skill: '',
      wage_model: 'DAILY_WAGE',
      rate_amount: '',
      payout_schedule: 'WEEKLY'
    }
  });

  // Note Modal State
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [activeConnectionForNote, setActiveConnectionForNote] = useState(null);
  const [noteText, setNoteText] = useState('');

  const fetchConnections = async () => {
    setLoading(true);
    try {
      const res = await api.getBusinessConnections({
        record_type: activeType,
        search: search,
        priority: priorityFilter
      });
      setConnections(res.connections || []);
      if (res.counts) setCounts(res.counts);
    } catch (err) {
      console.error('Error fetching connections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, [activeType, priorityFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchConnections();
  };

  // Save Connection (Create or Edit)
  const handleSaveConnection = async () => {
    if (!formData.common_directory?.name) {
      alert('Contact name is required.');
      return;
    }
    try {
      if (editingId) {
        await api.updateBusinessConnection(editingId, formData);
      } else {
        await api.createBusinessConnection(formData);
      }
      setShowModal(false);
      setEditingId(null);
      fetchConnections();
    } catch (err) {
      console.error('Save connection error:', err);
      alert('Failed to save connection: ' + (err.message || 'Server error'));
    }
  };

  // Delete Connection
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this business connection?')) return;
    try {
      await api.deleteBusinessConnection(id);
      fetchConnections();
    } catch (err) {
      alert('Failed to delete connection.');
    }
  };

  // Add Note
  const handleAddNote = async () => {
    if (!noteText.trim() || !activeConnectionForNote) return;
    try {
      await api.addBusinessConnectionNote(activeConnectionForNote._id, {
        text: noteText,
        createdBy: currentUser?.name || 'Staff'
      });
      setNoteText('');
      setShowNoteModal(false);
      fetchConnections();
    } catch (err) {
      alert('Failed to add note.');
    }
  };

  // Open Edit Form
  const handleOpenEdit = (item) => {
    setEditingId(item._id);
    setFormData({
      record_type: item.record_type || 'VENDOR',
      companyEntity: item.companyEntity || 'Elite Digital Print',
      common_directory: item.common_directory || { name: '', primary_phone: '', whatsapp_phone: '', email: '', city: '', state: '', address: '', is_active: true },
      vendor_data: item.vendor_data || { company_name: '', gst_or_tax_id: '', bank_account: '', bank_ifsc: '', upi_id: '', payment_terms: 'Net 30', supplied_items: '' },
      employee_data: item.employee_data || { department: 'Production', designation: '', monthly_salary: '', joining_date: '', emergency_contact: '' },
      worker_data: item.worker_data || { designation: '', station_or_skill: '', wage_model: 'DAILY_WAGE', rate_amount: '', payout_schedule: 'WEEKLY' }
    });
    setShowModal(true);
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-icon {
          animation: spin 0.8s linear infinite;
        }
      `}</style>

      {/* Top Header */}
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.pageTitle}>
            <UserCheck size={28} color="#2563eb" />
            <span>Business Connection</span>
          </h2>
          <p style={styles.pageSubtitle}>
            Centralized directory for managing Fabric Vendors, Salaried Staff &amp; Factory Workers.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingId(null);
            setFormData({
              record_type: activeType === 'ALL' ? 'VENDOR' : activeType,
              common_directory: { name: '', primary_phone: '', whatsapp_phone: '', email: '', city: '', state: '', address: '', is_active: true },
              vendor_data: { company_name: '', gst_or_tax_id: '', bank_account: '', bank_ifsc: '', upi_id: '', payment_terms: 'Net 30', supplied_items: '' },
              employee_data: { department: 'Production', designation: '', monthly_salary: '', joining_date: '', emergency_contact: '' },
              worker_data: { designation: '', station_or_skill: '', wage_model: 'DAILY_WAGE', rate_amount: '', payout_schedule: 'WEEKLY' }
            });
            setShowModal(true);
          }}
          style={styles.addBtn}
        >
          <Plus size={18} />
          <span>Add New Connection</span>
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div style={styles.metricsGrid}>
        {RECORD_TYPES.map((cat) => {
          const IconComponent = cat.icon;
          const isSelected = activeType === cat.key;
          let count = counts.total;
          if (cat.key === 'VENDOR') count = counts.vendor;
          if (cat.key === 'EMPLOYEE') count = counts.employee;
          if (cat.key === 'WORKER') count = counts.worker;

          return (
            <div
              key={cat.key}
              onClick={() => setActiveType(cat.key)}
              style={{
                ...styles.metricCard,
                ...(isSelected ? styles.metricCardSelected : {})
              }}
            >
              <div>
                <span style={styles.metricLabel}>{cat.label}</span>
                <div style={styles.metricCount}>{count}</div>
              </div>
              <div style={styles.metricIconBox}>
                <IconComponent size={22} color="#2563eb" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div style={styles.filterBar}>
        <form onSubmit={handleSearchSubmit} style={styles.searchForm}>
          <Search size={18} color="#64748b" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, designation, phone, city, or company..."
            style={styles.searchInput}
          />
          <button type="submit" style={styles.searchBtn}>
            Search
          </button>
        </form>

        <button
          onClick={fetchConnections}
          disabled={loading}
          style={styles.inlineRefreshBtn}
        >
          <RefreshCw size={14} className={loading ? "spin-icon" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Connections Data List */}
      {loading ? (
        <div style={styles.loadingBox}>
          <RefreshCw size={28} color="#2563eb" className="spin-icon" style={{ marginBottom: '0.5rem' }} />
          <div>Loading Business Connections...</div>
        </div>
      ) : connections.length === 0 ? (
        <div style={styles.emptyState}>
          <Users size={48} color="#94a3b8" />
          <h3 style={styles.emptyTitle}>No Connections Found</h3>
          <p style={styles.emptyText}>Click "Add New Connection" above to register a Vendor, Employee, or Worker.</p>
        </div>
      ) : (
        <div style={styles.cardList}>
          {connections.map((item) => {
            const dir = item.common_directory || {};
            const typeKey = item.record_type || 'VENDOR';

            return (
              <div key={item._id} style={styles.connectionCard}>
                <div style={styles.cardTopRow}>
                  <div style={styles.cardIdentity}>
                    <span
                      style={{
                        ...styles.typeBadge,
                        backgroundColor:
                          typeKey === 'VENDOR' ? '#f0fdf4' :
                          typeKey === 'EMPLOYEE' ? '#e0e7ff' : '#eff6ff',
                        color:
                          typeKey === 'VENDOR' ? '#15803d' :
                          typeKey === 'EMPLOYEE' ? '#4338ca' : '#1d4ed8',
                        border: `1px solid ${
                          typeKey === 'VENDOR' ? '#bbf7d0' :
                          typeKey === 'EMPLOYEE' ? '#c7d2fe' : '#bfdbfe'
                        }`
                      }}
                    >
                      {typeKey}
                    </span>
                    <h3 style={styles.contactName}>{dir.name || 'Unnamed Contact'}</h3>
                  </div>

                  <div style={styles.cardActions}>
                    <button onClick={() => handleOpenEdit(item)} style={styles.iconBtnAction} title="Edit Connection">
                      <Edit3 size={16} color="#2563eb" />
                    </button>
                    <button
                      onClick={() => {
                        setActiveConnectionForNote(item);
                        setShowNoteModal(true);
                      }}
                      style={styles.iconBtnAction}
                      title="Add Note"
                    >
                      <FileText size={16} color="#0284c7" />
                    </button>
                    <button onClick={() => handleDelete(item._id)} style={styles.iconBtnAction} title="Delete">
                      <Trash2 size={16} color="#ef4444" />
                    </button>
                  </div>
                </div>

                {/* Contact Detail Chips */}
                <div style={styles.contactDetailsRow}>
                  {dir.primary_phone && (
                    <div style={styles.detailChip}>
                      <Phone size={14} color="#2563eb" />
                      <span>{dir.primary_phone}</span>
                    </div>
                  )}
                  {dir.email && (
                    <div style={styles.detailChip}>
                      <Mail size={14} color="#2563eb" />
                      <span>{dir.email}</span>
                    </div>
                  )}
                  {(dir.city || dir.state) && (
                    <div style={styles.detailChip}>
                      <MapPin size={14} color="#2563eb" />
                      <span>{[dir.city, dir.state].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* Specific Category Highlight */}
                {typeKey === 'VENDOR' && item.vendor_data && (
                  <div style={styles.leadInfoBox}>
                    <div style={styles.leadInfoItem}>
                      <span style={styles.subLabel}>Company:</span>
                      <span style={styles.subVal}>{item.vendor_data.company_name || dir.name}</span>
                    </div>
                    {item.vendor_data.gst_or_tax_id && (
                      <div style={styles.leadInfoItem}>
                        <span style={styles.subLabel}>GSTIN:</span>
                        <span style={styles.subVal}>{item.vendor_data.gst_or_tax_id}</span>
                      </div>
                    )}
                    <div style={styles.leadInfoItem}>
                      <span style={styles.subLabel}>Terms:</span>
                      <span style={styles.subVal}>{item.vendor_data.payment_terms || 'Net 30'}</span>
                    </div>
                  </div>
                )}

                {typeKey === 'EMPLOYEE' && item.employee_data && (
                  <div style={styles.leadInfoBox}>
                    <div style={styles.leadInfoItem}>
                      <span style={styles.subLabel}>Designation:</span>
                      <span style={styles.subVal}>{item.employee_data.designation || 'Salaried Staff'}</span>
                    </div>
                    {item.employee_data.department && (
                      <div style={styles.leadInfoItem}>
                        <span style={styles.subLabel}>Dept:</span>
                        <span style={styles.subVal}>{item.employee_data.department}</span>
                      </div>
                    )}
                    {item.employee_data.monthly_salary && (
                      <div style={styles.leadInfoItem}>
                        <span style={styles.subLabel}>Salary:</span>
                        <span style={styles.subVal}>₹{Number(item.employee_data.monthly_salary).toLocaleString('en-IN')}/mo</span>
                      </div>
                    )}
                  </div>
                )}

                {typeKey === 'WORKER' && item.worker_data && (
                  <div style={styles.leadInfoBox}>
                    {item.worker_data.designation && (
                      <div style={styles.leadInfoItem}>
                        <span style={styles.subLabel}>Designation:</span>
                        <span style={styles.subVal}>{item.worker_data.designation}</span>
                      </div>
                    )}
                    <div style={styles.leadInfoItem}>
                      <span style={styles.subLabel}>Station/Skill:</span>
                      <span style={styles.subVal}>{item.worker_data.station_or_skill || 'Operator'}</span>
                    </div>
                    <div style={styles.leadInfoItem}>
                      <span style={styles.subLabel}>Wage Model:</span>
                      <span style={styles.subVal}>{item.worker_data.wage_model || 'DAILY_WAGE'}</span>
                    </div>
                    {item.worker_data.rate_amount && (
                      <div style={styles.leadInfoItem}>
                        <span style={styles.subLabel}>Rate:</span>
                        <span style={styles.subVal}>₹{item.worker_data.rate_amount}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add or Edit Connection */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {editingId ? 'Edit Business Connection' : 'Add New Connection'}
              </h3>
              <button onClick={() => setShowModal(false)} style={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>

            <div style={styles.modalBody}>
              {/* Record Type Switcher */}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Connection Type</label>
                <div style={styles.typeSwitchGrid}>
                  {['VENDOR', 'EMPLOYEE', 'WORKER'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormData({ ...formData, record_type: t })}
                      style={{
                        ...styles.switchBtn,
                        ...(formData.record_type === t ? styles.switchBtnActive : {})
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Common Directory Fields */}
              <h4 style={styles.formSectionHeader}>Contact Directory</h4>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Full Name *</label>
                  <input
                    type="text"
                    value={formData.common_directory.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        common_directory: { ...formData.common_directory, name: e.target.value }
                      })
                    }
                    placeholder="e.g. Rahul Mehta"
                    style={styles.formInput}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Primary Phone *</label>
                  <input
                    type="text"
                    value={formData.common_directory.primary_phone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        common_directory: { ...formData.common_directory, primary_phone: e.target.value }
                      })
                    }
                    placeholder="e.g. +91 98251 44321"
                    style={styles.formInput}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Email Address</label>
                  <input
                    type="email"
                    value={formData.common_directory.email}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        common_directory: { ...formData.common_directory, email: e.target.value }
                      })
                    }
                    placeholder="e.g. rahul@example.com"
                    style={styles.formInput}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>City / Location</label>
                  <input
                    type="text"
                    value={formData.common_directory.city}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        common_directory: { ...formData.common_directory, city: e.target.value }
                      })
                    }
                    placeholder="e.g. Surat"
                    style={styles.formInput}
                  />
                </div>
              </div>

              {/* Category Specific Form Fields */}
              {formData.record_type === 'VENDOR' && (
                <>
                  <h4 style={styles.formSectionHeader}>Vendor & Payment Details</h4>
                  <div style={styles.formGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Company Name</label>
                      <input
                        type="text"
                        value={formData.vendor_data?.company_name || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            vendor_data: { ...formData.vendor_data, company_name: e.target.value }
                          })
                        }
                        placeholder="e.g. Apex Dyechem Pvt Ltd"
                        style={styles.formInput}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>GSTIN / Tax ID</label>
                      <input
                        type="text"
                        value={formData.vendor_data?.gst_or_tax_id || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            vendor_data: { ...formData.vendor_data, gst_or_tax_id: e.target.value }
                          })
                        }
                        placeholder="24AAACA1234F1Z9"
                        style={styles.formInput}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Payment Terms</label>
                      <select
                        value={formData.vendor_data?.payment_terms || 'Net 30'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            vendor_data: { ...formData.vendor_data, payment_terms: e.target.value }
                          })
                        }
                        style={styles.formSelect}
                      >
                        <option value="Advance">Advance</option>
                        <option value="Net 15">Net 15</option>
                        <option value="Net 30">Net 30</option>
                        <option value="COD">COD</option>
                      </select>
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Supplied Items</label>
                      <input
                        type="text"
                        value={formData.vendor_data?.supplied_items || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            vendor_data: { ...formData.vendor_data, supplied_items: e.target.value }
                          })
                        }
                        placeholder="e.g. Raw Fabric, Inks, Paper"
                        style={styles.formInput}
                      />
                    </div>
                  </div>
                </>
              )}

              {formData.record_type === 'EMPLOYEE' && (
                <>
                  <h4 style={styles.formSectionHeader}>Employee & Salary Details</h4>
                  <div style={styles.formGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Job Designation *</label>
                      <input
                        type="text"
                        value={formData.employee_data?.designation || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            employee_data: { ...formData.employee_data, designation: e.target.value }
                          })
                        }
                        placeholder="e.g. Senior Fabric Designer, Chief Accountant"
                        style={styles.formInput}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Department</label>
                      <select
                        value={formData.employee_data?.department || 'Production'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            employee_data: { ...formData.employee_data, department: e.target.value }
                          })
                        }
                        style={styles.formSelect}
                      >
                        <option value="Production">Production</option>
                        <option value="Design">Design</option>
                        <option value="Sales">Sales</option>
                        <option value="Accounts">Accounts</option>
                        <option value="Management">Management</option>
                      </select>
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Monthly Salary (₹)</label>
                      <input
                        type="number"
                        value={formData.employee_data?.monthly_salary || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            employee_data: { ...formData.employee_data, monthly_salary: e.target.value }
                          })
                        }
                        placeholder="e.g. 35000"
                        style={styles.formInput}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Joining Date</label>
                      <input
                        type="date"
                        value={formData.employee_data?.joining_date || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            employee_data: { ...formData.employee_data, joining_date: e.target.value }
                          })
                        }
                        style={styles.formInput}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Emergency Contact</label>
                      <input
                        type="text"
                        value={formData.employee_data?.emergency_contact || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            employee_data: { ...formData.employee_data, emergency_contact: e.target.value }
                          })
                        }
                        placeholder="e.g. +91 98765 43210"
                        style={styles.formInput}
                      />
                    </div>
                  </div>
                </>
              )}

              {formData.record_type === 'WORKER' && (
                <>
                  <h4 style={styles.formSectionHeader}>Worker & Wage Details</h4>
                  <div style={styles.formGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Job Designation / Role *</label>
                      <input
                        type="text"
                        value={formData.worker_data?.designation || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            worker_data: { ...formData.worker_data, designation: e.target.value }
                          })
                        }
                        placeholder="e.g. Printing Press Operator, Cutting Specialist, QC Inspector"
                        style={styles.formInput}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Station / Primary Skill</label>
                      <input
                        type="text"
                        value={formData.worker_data?.station_or_skill || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            worker_data: { ...formData.worker_data, station_or_skill: e.target.value }
                          })
                        }
                        placeholder="e.g. Sublimation Printer / Fabric Stretcher"
                        style={styles.formInput}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Wage Model</label>
                      <select
                        value={formData.worker_data?.wage_model || 'DAILY_WAGE'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            worker_data: { ...formData.worker_data, wage_model: e.target.value }
                          })
                        }
                        style={styles.formSelect}
                      >
                        <option value="DAILY_WAGE">Daily Wage</option>
                        <option value="PIECE_RATE">Piece Rate (Per Meter / Piece)</option>
                        <option value="MONTHLY">Monthly Contract</option>
                      </select>
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Rate Amount (₹)</label>
                      <input
                        type="number"
                        value={formData.worker_data?.rate_amount || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            worker_data: { ...formData.worker_data, rate_amount: e.target.value }
                          })
                        }
                        placeholder="e.g. 700 / day or 5 / meter"
                        style={styles.formInput}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Payout Schedule</label>
                      <select
                        value={formData.worker_data?.payout_schedule || 'WEEKLY'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            worker_data: { ...formData.worker_data, payout_schedule: e.target.value }
                          })
                        }
                        style={styles.formSelect}
                      >
                        <option value="WEEKLY">Weekly (Saturday Payout)</option>
                        <option value="DAILY">Daily Cash</option>
                        <option value="MONTHLY">Monthly</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => setShowModal(false)} style={styles.cancelBtn}>
                Cancel
              </button>
              <button onClick={handleSaveConnection} style={styles.saveBtn}>
                Save Connection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {showNoteModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: '500px' }}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Add Connection Note</h3>
              <button onClick={() => setShowNoteModal(false)} style={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>
            <div style={styles.modalBody}>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Type note details or update history..."
                rows={4}
                style={styles.formTextarea}
              />
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowNoteModal(false)} style={styles.cancelBtn}>
                Cancel
              </button>
              <button onClick={handleAddNote} style={styles.saveBtn}>
                Add Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '1.5rem',
    maxWidth: '1400px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    backgroundColor: '#f8fafc',
    minHeight: '100vh'
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
    backgroundColor: '#ffffff',
    padding: '1.25rem 1.5rem',
    borderRadius: '14px',
    boxShadow: '0 4px 16px -2px rgba(37, 99, 235, 0.06)',
    border: '1px solid #e2e8f0'
  },
  pageTitle: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: '800',
    color: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem'
  },
  pageSubtitle: {
    margin: '4px 0 0',
    fontSize: '0.88rem',
    color: '#64748b'
  },
  headerBtnGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem'
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.7rem 1.25rem',
    borderRadius: '10px',
    backgroundColor: '#ffffff',
    color: '#2563eb',
    fontSize: '0.9rem',
    fontWeight: '700',
    border: '1.5px solid #2563eb',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.08)',
    transition: 'all 0.2s ease'
  },
  inlineRefreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.45rem 0.85rem',
    borderRadius: '8px',
    backgroundColor: '#eff6ff',
    color: '#2563eb',
    fontSize: '0.82rem',
    fontWeight: '600',
    border: '1px solid #bfdbfe',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.7rem 1.25rem',
    borderRadius: '10px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontSize: '0.9rem',
    fontWeight: '700',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
    transition: 'all 0.2s ease'
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem'
  },
  metricCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '1.1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
    transition: 'all 0.2s ease'
  },
  metricCardSelected: {
    border: '2px solid #2563eb',
    backgroundColor: '#eff6ff',
    boxShadow: '0 4px 16px rgba(37, 99, 235, 0.12)'
  },
  metricLabel: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#64748b'
  },
  metricCount: {
    fontSize: '1.65rem',
    fontWeight: '800',
    color: '#0f172a',
    marginTop: '4px'
  },
  metricIconBox: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    backgroundColor: '#dbeafe',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
    backgroundColor: '#ffffff',
    padding: '1rem 1.25rem',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
  },
  searchForm: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flex: '1',
    maxWidth: '550px',
    backgroundColor: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '0.4rem 0.75rem'
  },
  searchInput: {
    border: 'none',
    backgroundColor: 'transparent',
    outline: 'none',
    width: '100%',
    fontSize: '0.88rem',
    color: '#0f172a'
  },
  searchBtn: {
    padding: '0.35rem 0.85rem',
    borderRadius: '6px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer'
  },
  loadingBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    color: '#2563eb',
    fontWeight: '600'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 1rem',
    backgroundColor: '#ffffff',
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
    textAlign: 'center'
  },
  emptyTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: '#0f172a',
    marginTop: '0.75rem',
    marginBottom: '0.25rem'
  },
  emptyText: {
    fontSize: '0.85rem',
    color: '#64748b',
    margin: 0
  },
  cardList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '1rem'
  },
  connectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '1.1rem',
    boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem'
  },
  cardTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardIdentity: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem'
  },
  typeBadge: {
    padding: '0.2rem 0.55rem',
    borderRadius: '6px',
    fontSize: '0.72rem',
    fontWeight: '800',
    letterSpacing: '0.05em'
  },
  contactName: {
    margin: 0,
    fontSize: '1.05rem',
    fontWeight: '700',
    color: '#0f172a'
  },
  cardActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem'
  },
  iconBtnAction: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '0.35rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  contactDetailsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem'
  },
  detailChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.3rem 0.6rem',
    borderRadius: '6px',
    backgroundColor: '#eff6ff',
    color: '#1e40af',
    fontSize: '0.78rem',
    fontWeight: '500'
  },
  leadInfoBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    padding: '0.65rem 0.75rem',
    borderRadius: '8px',
    backgroundColor: '#f8fafc',
    border: '1px solid #f1f5f9',
    fontSize: '0.8rem'
  },
  leadInfoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem'
  },
  subLabel: {
    color: '#64748b',
    fontWeight: '600',
    minWidth: '85px'
  },
  subVal: {
    color: '#0f172a',
    fontWeight: '700'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem'
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '650px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e2e8f0',
    overflow: 'hidden'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc'
  },
  modalTitle: {
    margin: 0,
    fontSize: '1.15rem',
    fontWeight: '700',
    color: '#0f172a'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer'
  },
  modalBody: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    maxHeight: '75vh',
    overflowY: 'auto'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem'
  },
  formLabel: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#475569'
  },
  typeSwitchGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.5rem'
  },
  switchBtn: {
    padding: '0.5rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
    color: '#475569',
    fontSize: '0.8rem',
    fontWeight: '700',
    cursor: 'pointer'
  },
  switchBtnActive: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    borderColor: '#2563eb'
  },
  formSectionHeader: {
    margin: '0.5rem 0 0',
    fontSize: '0.9rem',
    fontWeight: '700',
    color: '#2563eb',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '0.35rem'
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.85rem'
  },
  formInput: {
    padding: '0.6rem 0.85rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: '0.88rem',
    outline: 'none'
  },
  formSelect: {
    padding: '0.6rem 0.85rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: '0.88rem',
    outline: 'none'
  },
  formTextarea: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: '0.88rem',
    outline: 'none',
    boxSizing: 'border-box'
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    padding: '1rem 1.5rem',
    borderTop: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc'
  },
  cancelBtn: {
    padding: '0.6rem 1.1rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#475569',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer'
  },
  saveBtn: {
    padding: '0.6rem 1.25rem',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontSize: '0.85rem',
    fontWeight: '700',
    cursor: 'pointer'
  }
};
