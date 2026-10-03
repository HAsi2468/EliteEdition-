import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Building2,
  Briefcase,
  HardHat,
  Star,
  Clock,
  Calendar,
  MessageSquare,
  Edit2,
  Trash2,
  ExternalLink,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Tag,
  X,
  Printer,
  LayoutGrid,
  List,
  Sparkles,
  Send,
  UserCheck,
  CreditCard,
  Building
} from 'lucide-react';
import DateRangePicker, { getDatePresetRange } from './DateRangePicker';

const TYPE_CONFIG = {
  ALL: { label: 'All Profiles', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: Users },
  VENDOR: { label: 'Vendors & Suppliers', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: Building2 },
  EMPLOYEE: { label: 'Salaried Staff', color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe', icon: Briefcase },
  WORKER: { label: 'Factory Workers', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', icon: HardHat }
};

export default function ConnectionProfilesPanel({ currentUser, onSwitchToDirectory }) {
  const [connections, setConnections] = useState([]);
  const [counts, setCounts] = useState({ total: 0, vendor: 0, employee: 0, worker: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'name'

  // Date Range Filter State
  const [datePreset, setDatePreset] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Selected Profile for Detail Drawer
  const [selectedProfile, setSelectedProfile] = useState(null);

  // Add / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    record_type: 'VENDOR',
    common_directory: {
      name: '',
      primary_phone: '',
      whatsapp_phone: '',
      email: '',
      city: '',
      state: 'Gujarat',
      address: '',
      is_active: true
    },
    vendor_data: {
      company_name: '',
      gst_or_tax_id: '',
      bank_account: '',
      bank_ifsc: '',
      upi_id: '',
      payment_terms: 'Advance',
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

  // Note State inside Drawer
  const [noteText, setNoteText] = useState('');
  const [loggingNote, setLoggingNote] = useState(false);

  useEffect(() => {
    fetchConnections();
  }, [typeFilter]);

  const fetchConnections = async () => {
    setLoading(true);
    try {
      const res = await api.getBusinessConnections({
        record_type: typeFilter
      });
      setConnections(res?.connections || []);
      if (res?.counts) setCounts(res.counts);
    } catch (err) {
      console.error('Error fetching connection profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  // Date range filter
  const dateRangeInfo = getDatePresetRange(datePreset, customStart, customEnd);
  const filteredProfiles = useMemo(() => {
    return connections.filter((item) => {
      const dir = item.common_directory || {};
      const type = item.record_type || 'VENDOR';

      // Type filter
      if (typeFilter !== 'ALL' && type !== typeFilter) return false;

      // Status filter
      if (statusFilter === 'ACTIVE' && dir.is_active === false) return false;
      if (statusFilter === 'INACTIVE' && dir.is_active !== false) return false;

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const vComp = item.vendor_data?.company_name || '';
        const vGst = item.vendor_data?.gst_or_tax_id || '';
        const eDesig = item.employee_data?.designation || '';
        const eDept = item.employee_data?.department || '';
        const wSkill = item.worker_data?.station_or_skill || '';
        const wDesig = item.worker_data?.designation || '';

        const match =
          (dir.name && dir.name.toLowerCase().includes(q)) ||
          (dir.primary_phone && dir.primary_phone.includes(q)) ||
          (dir.city && dir.city.toLowerCase().includes(q)) ||
          vComp.toLowerCase().includes(q) ||
          vGst.toLowerCase().includes(q) ||
          eDesig.toLowerCase().includes(q) ||
          eDept.toLowerCase().includes(q) ||
          wSkill.toLowerCase().includes(q) ||
          wDesig.toLowerCase().includes(q);

        if (!match) return false;
      }

      // Date range filter
      if (dateRangeInfo.dateStart || dateRangeInfo.dateEnd) {
        const itemDate = item.createdAt ? new Date(item.createdAt) : null;
        if (itemDate && !isNaN(itemDate.getTime())) {
          const itemYMD = itemDate.toISOString().split('T')[0];
          if (dateRangeInfo.dateStart && itemYMD < dateRangeInfo.dateStart) return false;
          if (dateRangeInfo.dateEnd && itemYMD > dateRangeInfo.dateEnd) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = a.common_directory?.name || '';
        const nameB = b.common_directory?.name || '';
        return nameA.localeCompare(nameB);
      }
      // Default: newest
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [connections, typeFilter, statusFilter, search, dateRangeInfo, sortBy]);

  // Open Add Modal
  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      record_type: typeFilter === 'ALL' ? 'VENDOR' : typeFilter,
      common_directory: {
        name: '',
        primary_phone: '',
        whatsapp_phone: '',
        email: '',
        city: '',
        state: 'Gujarat',
        address: '',
        is_active: true
      },
      vendor_data: {
        company_name: '',
        gst_or_tax_id: '',
        bank_account: '',
        bank_ifsc: '',
        upi_id: '',
        payment_terms: 'Advance',
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
    setShowModal(true);
  };

  // Open Edit Modal
  const openEditModal = (item) => {
    setEditingId(item._id);
    setFormData({
      record_type: item.record_type || 'VENDOR',
      common_directory: {
        name: item.common_directory?.name || '',
        primary_phone: item.common_directory?.primary_phone || '',
        whatsapp_phone: item.common_directory?.whatsapp_phone || '',
        email: item.common_directory?.email || '',
        city: item.common_directory?.city || '',
        state: item.common_directory?.state || 'Gujarat',
        address: item.common_directory?.address || '',
        is_active: item.common_directory?.is_active !== false
      },
      vendor_data: {
        company_name: item.vendor_data?.company_name || '',
        gst_or_tax_id: item.vendor_data?.gst_or_tax_id || '',
        bank_account: item.vendor_data?.bank_account || '',
        bank_ifsc: item.vendor_data?.bank_ifsc || '',
        upi_id: item.vendor_data?.upi_id || '',
        payment_terms: item.vendor_data?.payment_terms || 'Advance',
        supplied_items: item.vendor_data?.supplied_items || ''
      },
      employee_data: {
        department: item.employee_data?.department || 'Production',
        designation: item.employee_data?.designation || '',
        monthly_salary: item.employee_data?.monthly_salary || '',
        joining_date: item.employee_data?.joining_date || '',
        emergency_contact: item.employee_data?.emergency_contact || ''
      },
      worker_data: {
        designation: item.worker_data?.designation || '',
        station_or_skill: item.worker_data?.station_or_skill || '',
        wage_model: item.worker_data?.wage_model || 'DAILY_WAGE',
        rate_amount: item.worker_data?.rate_amount || '',
        payout_schedule: item.worker_data?.payout_schedule || 'WEEKLY'
      }
    });
    setShowModal(true);
  };

  // Save Connection Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!formData.common_directory.name.trim()) {
      alert('Please fill in the full name.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await api.updateBusinessConnection(editingId, formData);
      } else {
        await api.createBusinessConnection(formData);
      }
      setShowModal(false);
      fetchConnections();
      if (selectedProfile && selectedProfile._id === editingId) {
        setSelectedProfile((prev) => ({ ...prev, ...formData }));
      }
    } catch (err) {
      alert('Error saving profile: ' + (err.message || 'Server error'));
    } finally {
      setSaving(false);
    }
  };

  // Delete Profile
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this business connection profile?')) return;
    try {
      await api.deleteBusinessConnection(id);
      setConnections((prev) => prev.filter((c) => c._id !== id));
      if (selectedProfile?._id === id) setSelectedProfile(null);
    } catch (err) {
      alert('Failed to delete profile');
    }
  };

  // Add Note to Profile
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteText.trim() || !selectedProfile) return;

    setLoggingNote(true);
    try {
      await api.addBusinessConnectionNote(selectedProfile._id, {
        text: noteText.trim(),
        createdBy: currentUser?.name || 'Staff'
      });
      const newNote = {
        text: noteText.trim(),
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.name || 'Staff'
      };
      setSelectedProfile((prev) => ({
        ...prev,
        notes: [newNote, ...(prev.notes || [])]
      }));
      setConnections((prev) =>
        prev.map((c) =>
          c._id === selectedProfile._id
            ? { ...c, notes: [newNote, ...(c.notes || [])] }
            : c
        )
      );
      setNoteText('');
    } catch (err) {
      alert('Failed to add note');
    } finally {
      setLoggingNote(false);
    }
  };

  // WhatsApp quick helper
  const openWhatsApp = (phone, name = '') => {
    if (!phone) return;
    const cleanNum = phone.replace(/[^0-9]/g, '');
    const formatted = cleanNum.length === 10 ? `91${cleanNum}` : cleanNum;
    const msg = encodeURIComponent(`Hello ${name || 'Sir/Madam'}, greeting from Elite Digital Prints.`);
    window.open(`https://wa.me/${formatted}?text=${msg}`, '_blank');
  };

  // Print Profile PDF
  const handlePrintSingleProfile = (item) => {
    if (!item) return;
    const dir = item.common_directory || {};
    const type = item.record_type || 'VENDOR';
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to export PDF.');
      return;
    }

    const title = `${dir.name || 'Connection'} - Profile Record (${type})`;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 30px; color: #0f172a; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
          .company { font-size: 22px; font-weight: 800; color: #2563eb; }
          .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 11px; text-transform: uppercase; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
          .card h4 { margin: 0 0 10px 0; color: #1e40af; font-size: 13px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
          .lbl { font-weight: 600; color: #64748b; }
          .val { font-weight: 700; color: #0f172a; text-align: right; }
          .timeline { margin-top: 15px; }
          .note-item { padding: 10px; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 8px; font-size: 12px; }
          @media print { body { margin: 15mm; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="company">Elite Digital Prints</div>
            <div style="font-size: 13px; color: #64748b;">Business Connection Profile Dossier</div>
          </div>
          <div style="text-align: right;">
            <span class="badge" style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe;">${type}</span>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 5px;">Printed: ${new Date().toLocaleString('en-IN')}</div>
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <h4>Contact & Identity</h4>
            <div class="row"><span class="lbl">Full Name:</span><span class="val">${dir.name || '-'}</span></div>
            <div class="row"><span class="lbl">Primary Phone:</span><span class="val">${dir.primary_phone || '-'}</span></div>
            <div class="row"><span class="lbl">WhatsApp:</span><span class="val">${dir.whatsapp_phone || dir.primary_phone || '-'}</span></div>
            <div class="row"><span class="lbl">Email:</span><span class="val">${dir.email || '-'}</span></div>
            <div class="row"><span class="lbl">City / State:</span><span class="val">${[dir.city, dir.state].filter(Boolean).join(', ') || '-'}</span></div>
            <div class="row"><span class="lbl">Full Address:</span><span class="val">${dir.address || '-'}</span></div>
          </div>

          <div class="card">
            <h4>Organizational Profile</h4>
            ${type === 'VENDOR' ? `
              <div class="row"><span class="lbl">Company Name:</span><span class="val">${item.vendor_data?.company_name || '-'}</span></div>
              <div class="row"><span class="lbl">GSTIN / Tax ID:</span><span class="val">${item.vendor_data?.gst_or_tax_id || '-'}</span></div>
              <div class="row"><span class="lbl">Payment Terms:</span><span class="val">${item.vendor_data?.payment_terms || 'Advance'}</span></div>
              <div class="row"><span class="lbl">Supplied Items:</span><span class="val">${item.vendor_data?.supplied_items || '-'}</span></div>
              <div class="row"><span class="lbl">Bank Account:</span><span class="val">${item.vendor_data?.bank_account || '-'}</span></div>
              <div class="row"><span class="lbl">Bank IFSC:</span><span class="val">${item.vendor_data?.bank_ifsc || '-'}</span></div>
              <div class="row"><span class="lbl">UPI ID:</span><span class="val">${item.vendor_data?.upi_id || '-'}</span></div>
            ` : type === 'EMPLOYEE' ? `
              <div class="row"><span class="lbl">Department:</span><span class="val">${item.employee_data?.department || '-'}</span></div>
              <div class="row"><span class="lbl">Designation:</span><span class="val">${item.employee_data?.designation || '-'}</span></div>
              <div class="row"><span class="lbl">Monthly Salary:</span><span class="val">₹${Number(item.employee_data?.monthly_salary || 0).toLocaleString('en-IN')}/mo</span></div>
              <div class="row"><span class="lbl">Joining Date:</span><span class="val">${item.employee_data?.joining_date || '-'}</span></div>
              <div class="row"><span class="lbl">Emergency Contact:</span><span class="val">${item.employee_data?.emergency_contact || '-'}</span></div>
            ` : `
              <div class="row"><span class="lbl">Designation:</span><span class="val">${item.worker_data?.designation || '-'}</span></div>
              <div class="row"><span class="lbl">Station / Skill:</span><span class="val">${item.worker_data?.station_or_skill || '-'}</span></div>
              <div class="row"><span class="lbl">Wage Model:</span><span class="val">${item.worker_data?.wage_model || 'DAILY_WAGE'}</span></div>
              <div class="row"><span class="lbl">Rate Amount:</span><span class="val">₹${item.worker_data?.rate_amount || '-'}</span></div>
              <div class="row"><span class="lbl">Payout Schedule:</span><span class="val">${item.worker_data?.payout_schedule || 'WEEKLY'}</span></div>
            `}
          </div>
        </div>

        <div class="card timeline">
          <h4>Activity Notes & Remarks</h4>
          ${(item.notes && item.notes.length > 0) ? item.notes.map(n => `
            <div class="note-item">
              <div style="font-weight: 700; color: #1e40af; margin-bottom: 2px;">
                ${n.createdBy || 'Staff'} &bull; <span style="font-weight: normal; color: #64748b;">${new Date(n.createdAt).toLocaleDateString('en-IN')}</span>
              </div>
              <div>${n.text}</div>
            </div>
          `).join('') : '<div style="color: #94a3b8; font-size: 12px;">No historical notes recorded.</div>'}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div style={{ color: 'var(--text-main)' }}>
      {/* Top Profile Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        <div
          onClick={() => setTypeFilter('ALL')}
          style={{
            padding: '1.1rem',
            borderRadius: '12px',
            background: typeFilter === 'ALL' ? 'rgba(37,99,235,0.08)' : 'var(--bg-card, #ffffff)',
            border: `1.5px solid ${typeFilter === 'ALL' ? '#2563eb' : 'var(--border-light, #e2e8f0)'}`,
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              Total Profiles
            </span>
            <div style={{ width: 34, height: 34, borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '6px', color: '#2563eb' }}>
            {counts.total || connections.length}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Directory Records
          </div>
        </div>

        <div
          onClick={() => setTypeFilter('VENDOR')}
          style={{
            padding: '1.1rem',
            borderRadius: '12px',
            background: typeFilter === 'VENDOR' ? 'rgba(22,163,74,0.08)' : 'var(--bg-card, #ffffff)',
            border: `1.5px solid ${typeFilter === 'VENDOR' ? '#16a34a' : 'var(--border-light, #e2e8f0)'}`,
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              Vendors & Suppliers
            </span>
            <div style={{ width: 34, height: 34, borderRadius: '8px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
              <Building2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '6px', color: '#16a34a' }}>
            {counts.vendor || 0}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Fabric & Dye Suppliers
          </div>
        </div>

        <div
          onClick={() => setTypeFilter('EMPLOYEE')}
          style={{
            padding: '1.1rem',
            borderRadius: '12px',
            background: typeFilter === 'EMPLOYEE' ? 'rgba(79,70,229,0.08)' : 'var(--bg-card, #ffffff)',
            border: `1.5px solid ${typeFilter === 'EMPLOYEE' ? '#4f46e5' : 'var(--border-light, #e2e8f0)'}`,
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              Salaried Staff
            </span>
            <div style={{ width: 34, height: 34, borderRadius: '8px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
              <Briefcase size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '6px', color: '#4f46e5' }}>
            {counts.employee || 0}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Design, Accounts & Mgmt
          </div>
        </div>

        <div
          onClick={() => setTypeFilter('WORKER')}
          style={{
            padding: '1.1rem',
            borderRadius: '12px',
            background: typeFilter === 'WORKER' ? 'rgba(2,132,199,0.08)' : 'var(--bg-card, #ffffff)',
            border: `1.5px solid ${typeFilter === 'WORKER' ? '#0284c7' : 'var(--border-light, #e2e8f0)'}`,
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              Factory Workers
            </span>
            <div style={{ width: 34, height: 34, borderRadius: '8px', background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
              <HardHat size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '6px', color: '#0284c7' }}>
            {counts.worker || 0}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Operators & Floor Team
          </div>
        </div>
      </div>

      {/* Search, Filter Bar and Action Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '1rem 1.2rem',
          borderRadius: '14px',
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-light, #e2e8f0)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          marginBottom: '1.5rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 300px', maxWidth: '420px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search
              size={17}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search profiles by name, phone, company, skill..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 38px',
                borderRadius: '8px',
                border: '1px solid var(--border-light, #e2e8f0)',
                background: 'var(--bg-input, #f8fafc)',
                color: 'var(--text-main)',
                fontSize: '0.88rem'
              }}
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {['ALL', 'VENDOR', 'EMPLOYEE', 'WORKER'].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: `1px solid ${typeFilter === t ? '#2563eb' : 'var(--border-light, #e2e8f0)'}`,
                background: typeFilter === t ? '#2563eb' : 'transparent',
                color: typeFilter === t ? '#ffffff' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {t === 'ALL' ? 'All' : t === 'VENDOR' ? 'Vendors' : t === 'EMPLOYEE' ? 'Staff' : 'Workers'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <DateRangePicker
            preset={datePreset}
            onChange={({ preset, dateStart, dateEnd }) => {
              setDatePreset(preset);
              if (preset === 'custom') {
                setCustomStart(dateStart);
                setCustomEnd(dateEnd);
              }
            }}
            customStart={customStart}
            customEnd={customEnd}
            onCustomChange={(s, e) => {
              setCustomStart(s);
              setCustomEnd(e);
            }}
          />

          {/* Toggle View */}
          <div
            style={{
              display: 'inline-flex',
              padding: '3px',
              borderRadius: '8px',
              background: 'var(--bg-input, #f8fafc)',
              border: '1px solid var(--border-light, #e2e8f0)'
            }}
          >
            <button
              onClick={() => setViewMode('cards')}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'cards' ? '#2563eb' : 'transparent',
                color: viewMode === 'cards' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
              title="Cards Grid"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'table' ? '#2563eb' : 'transparent',
                color: viewMode === 'table' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
              title="Data Table"
            >
              <List size={15} />
            </button>
          </div>

          <button
            onClick={openAddModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(37,99,235,0.25)'
            }}
          >
            <Plus size={16} />
            <span>Add Profile</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'flex', gap: '1.5rem', position: 'relative' }}>
        {/* Profile Directory Cards/Table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="spin-icon" style={{ marginBottom: '8px' }} />
              <div>Loading connection profiles...</div>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div
              style={{
                padding: '3rem',
                textAlign: 'center',
                background: 'var(--bg-card, #ffffff)',
                borderRadius: '14px',
                border: '1px dashed var(--border-light, #e2e8f0)'
              }}
            >
              <Users size={44} color="#94a3b8" style={{ marginBottom: '10px' }} />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 6px 0' }}>No Profiles Found</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                Click "Add Profile" to create a complete profile for a Vendor, Staff, or Worker.
              </p>
            </div>
          ) : viewMode === 'cards' ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '1.2rem'
              }}
            >
              {filteredProfiles.map((item) => {
                const dir = item.common_directory || {};
                const type = item.record_type || 'VENDOR';
                const typeConf = TYPE_CONFIG[type] || TYPE_CONFIG.VENDOR;
                const isSelected = selectedProfile?._id === item._id;

                const initials = (dir.name || 'U')
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                return (
                  <div
                    key={item._id}
                    onClick={() => setSelectedProfile(item)}
                    style={{
                      borderRadius: '14px',
                      background: 'var(--bg-card, #ffffff)',
                      border: `1.5px solid ${isSelected ? '#2563eb' : 'var(--border-light, #e2e8f0)'}`,
                      padding: '1.2rem',
                      boxShadow: isSelected
                        ? '0 6px 20px rgba(37,99,235,0.15)'
                        : '0 2px 6px rgba(0,0,0,0.03)',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      position: 'relative'
                    }}
                  >
                    {/* Top Identity Row */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                      <div
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: '12px',
                          background: typeConf.bg,
                          color: typeConf.color,
                          border: `1px solid ${typeConf.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '1rem',
                          flexShrink: 0
                        }}
                      >
                        {initials}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              padding: '2px 7px',
                              borderRadius: '4px',
                              background: typeConf.bg,
                              color: typeConf.color,
                              border: `1px solid ${typeConf.border}`,
                              textTransform: 'uppercase'
                            }}
                          >
                            {type}
                          </span>
                          {dir.is_active === false && (
                            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#fee2e2', color: '#dc2626', fontWeight: 700 }}>
                              Inactive
                            </span>
                          )}
                        </div>

                        <h3
                          style={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            margin: '4px 0 2px 0',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {dir.name || 'Unnamed Person'}
                        </h3>

                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {type === 'VENDOR' && (item.vendor_data?.company_name || 'Vendor')}
                          {type === 'EMPLOYEE' && `${item.employee_data?.designation || 'Staff'} • ${item.employee_data?.department || 'Production'}`}
                          {type === 'WORKER' && `${item.worker_data?.designation || item.worker_data?.station_or_skill || 'Operator'}`}
                        </div>
                      </div>
                    </div>

                    {/* Contact Badges */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '12px', fontSize: '0.82rem' }}>
                      {dir.primary_phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-muted)' }}>
                          <Phone size={14} color="#2563eb" />
                          <span>{dir.primary_phone}</span>
                        </div>
                      )}
                      {(dir.city || dir.state) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-muted)' }}>
                          <MapPin size={14} color="#2563eb" />
                          <span>{[dir.city, dir.state].filter(Boolean).join(', ')}</span>
                        </div>
                      )}
                    </div>

                    {/* Category Key Highlights */}
                    <div
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: 'var(--bg-input, #f8fafc)',
                        border: '1px solid var(--border-light, #e2e8f0)',
                        fontSize: '0.78rem',
                        marginBottom: '12px'
                      }}
                    >
                      {type === 'VENDOR' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                          <span>Terms: <strong style={{ color: 'var(--text-main)' }}>{item.vendor_data?.payment_terms || 'Advance'}</strong></span>
                          {item.vendor_data?.gst_or_tax_id && (
                            <span>GST: <strong style={{ color: 'var(--text-main)' }}>{item.vendor_data.gst_or_tax_id}</strong></span>
                          )}
                        </div>
                      )}
                      {type === 'EMPLOYEE' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                          <span>Dept: <strong style={{ color: 'var(--text-main)' }}>{item.employee_data?.department || 'Prod'}</strong></span>
                          {item.employee_data?.monthly_salary && (
                            <span style={{ color: '#16a34a', fontWeight: 700 }}>₹{Number(item.employee_data.monthly_salary).toLocaleString('en-IN')}/mo</span>
                          )}
                        </div>
                      )}
                      {type === 'WORKER' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                          <span>Model: <strong style={{ color: 'var(--text-main)' }}>{item.worker_data?.wage_model || 'DAILY'}</strong></span>
                          {item.worker_data?.rate_amount && (
                            <span style={{ color: '#2563eb', fontWeight: 700 }}>₹{item.worker_data.rate_amount}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Footer */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '8px',
                        borderTop: '1px solid var(--border-light, #e2e8f0)'
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProfile(item);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'none',
                          border: 'none',
                          color: '#2563eb',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        <span>View Profile</span>
                        <ChevronRight size={14} />
                      </button>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        {dir.whatsapp_phone && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openWhatsApp(dir.whatsapp_phone, dir.name);
                            }}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '6px',
                              border: '1px solid #bbf7d0',
                              background: '#f0fdf4',
                              color: '#16a34a',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                            title="Chat on WhatsApp"
                          >
                            <MessageSquare size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(item);
                          }}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '6px',
                            border: '1px solid var(--border-light)',
                            background: 'transparent',
                            color: '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                          title="Edit Profile"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintSingleProfile(item);
                          }}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '6px',
                            border: '1px solid var(--border-light)',
                            background: 'transparent',
                            color: '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                          title="Print Profile PDF"
                        >
                          <Printer size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <div
              style={{
                borderRadius: '14px',
                background: 'var(--bg-card, #ffffff)',
                border: '1px solid var(--border-light, #e2e8f0)',
                overflow: 'hidden'
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Name & Role</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Category</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Phone & WhatsApp</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>City / State</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Financial / Work Info</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProfiles.map((item) => {
                    const dir = item.common_directory || {};
                    const type = item.record_type || 'VENDOR';
                    const typeConf = TYPE_CONFIG[type] || TYPE_CONFIG.VENDOR;

                    return (
                      <tr
                        key={item._id}
                        onClick={() => setSelectedProfile(item)}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          background: selectedProfile?._id === item._id ? 'rgba(37,99,235,0.05)' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{dir.name || 'Unnamed'}</div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            {type === 'VENDOR' ? item.vendor_data?.company_name || 'Vendor' : type === 'EMPLOYEE' ? item.employee_data?.designation || 'Staff' : item.worker_data?.designation || 'Worker'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: typeConf.bg,
                              color: typeConf.color,
                              border: `1px solid ${typeConf.border}`
                            }}
                          >
                            {type}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#334155' }}>
                          {dir.primary_phone || '-'}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>
                          {[dir.city, dir.state].filter(Boolean).join(', ') || '-'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {type === 'VENDOR' && (item.vendor_data?.gst_or_tax_id ? `GST: ${item.vendor_data.gst_or_tax_id}` : `Terms: ${item.vendor_data?.payment_terms || 'Advance'}`)}
                          {type === 'EMPLOYEE' && (item.employee_data?.monthly_salary ? `₹${Number(item.employee_data.monthly_salary).toLocaleString('en-IN')}/mo` : (item.employee_data?.department || '-'))}
                          {type === 'WORKER' && (item.worker_data?.station_or_skill || item.worker_data?.wage_model || '-')}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(item);
                            }}
                            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', marginRight: '8px' }}
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintSingleProfile(item);
                            }}
                            style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer' }}
                          >
                            <Printer size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Profile Detail Drawer */}
        {selectedProfile && (
          <div
            style={{
              width: '380px',
              flexShrink: 0,
              borderRadius: '16px',
              background: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-light, #e2e8f0)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.2rem',
              maxHeight: 'calc(100vh - 180px)',
              overflowY: 'auto'
            }}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: TYPE_CONFIG[selectedProfile.record_type]?.bg || '#eff6ff',
                    color: TYPE_CONFIG[selectedProfile.record_type]?.color || '#2563eb',
                    border: `1px solid ${TYPE_CONFIG[selectedProfile.record_type]?.border || '#bfdbfe'}`,
                    textTransform: 'uppercase'
                  }}
                >
                  {selectedProfile.record_type} Profile
                </span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '6px 0 2px 0' }}>
                  {selectedProfile.common_directory?.name || 'Unnamed'}
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Record ID: #{selectedProfile._id.slice(-6)}
                </div>
              </div>

              <button
                onClick={() => setSelectedProfile(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Action Button Group */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              <button
                onClick={() => {
                  if (selectedProfile.common_directory?.primary_phone) {
                    window.open(`tel:${selectedProfile.common_directory.primary_phone}`);
                  }
                }}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-input, #f8fafc)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#2563eb'
                }}
              >
                <Phone size={15} />
                <span>Call</span>
              </button>

              <button
                onClick={() => openWhatsApp(selectedProfile.common_directory?.whatsapp_phone || selectedProfile.common_directory?.primary_phone, selectedProfile.common_directory?.name)}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid #bbf7d0',
                  background: '#f0fdf4',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#16a34a'
                }}
              >
                <MessageSquare size={15} />
                <span>WhatsApp</span>
              </button>

              <button
                onClick={() => openEditModal(selectedProfile)}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-input, #f8fafc)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#475569'
                }}
              >
                <Edit2 size={15} />
                <span>Edit</span>
              </button>

              <button
                onClick={() => handlePrintSingleProfile(selectedProfile)}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-input, #f8fafc)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#2563eb'
                }}
              >
                <Printer size={15} />
                <span>Print PDF</span>
              </button>
            </div>

            {/* Profile Contact & Address Block */}
            <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-input, #f8fafc)', border: '1px solid var(--border-light, #e2e8f0)', fontSize: '0.82rem' }}>
              <div style={{ fontWeight: 700, color: '#1e40af', marginBottom: '8px', textTransform: 'uppercase', fontSize: '0.72rem' }}>
                Contact & Address Details
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Primary Phone:</span>
                  <span style={{ fontWeight: 600 }}>{selectedProfile.common_directory?.primary_phone || '-'}</span>
                </div>
                {selectedProfile.common_directory?.whatsapp_phone && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>WhatsApp:</span>
                    <span style={{ fontWeight: 600, color: '#16a34a' }}>{selectedProfile.common_directory.whatsapp_phone}</span>
                  </div>
                )}
                {selectedProfile.common_directory?.email && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Email:</span>
                    <span style={{ fontWeight: 600 }}>{selectedProfile.common_directory.email}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>City / State:</span>
                  <span style={{ fontWeight: 600 }}>{[selectedProfile.common_directory?.city, selectedProfile.common_directory?.state].filter(Boolean).join(', ') || '-'}</span>
                </div>
                {selectedProfile.common_directory?.address && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Full Address:</span>
                    <span style={{ fontWeight: 600 }}>{selectedProfile.common_directory.address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Role Specific Block */}
            {selectedProfile.record_type === 'VENDOR' && selectedProfile.vendor_data && (
              <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-input, #f8fafc)', border: '1px solid var(--border-light, #e2e8f0)', fontSize: '0.82rem' }}>
                <div style={{ fontWeight: 700, color: '#16a34a', marginBottom: '8px', textTransform: 'uppercase', fontSize: '0.72rem' }}>
                  Vendor & Financial Profile
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Company:</span>
                    <span style={{ fontWeight: 700 }}>{selectedProfile.vendor_data.company_name || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>GSTIN:</span>
                    <span style={{ fontWeight: 700 }}>{selectedProfile.vendor_data.gst_or_tax_id || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Payment Terms:</span>
                    <span style={{ fontWeight: 600 }}>{selectedProfile.vendor_data.payment_terms || 'Advance'}</span>
                  </div>
                  {selectedProfile.vendor_data.supplied_items && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Supplied Items:</span>
                      <span style={{ fontWeight: 600 }}>{selectedProfile.vendor_data.supplied_items}</span>
                    </div>
                  )}
                  {selectedProfile.vendor_data.bank_account && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Bank A/C:</span>
                      <span style={{ fontWeight: 600 }}>{selectedProfile.vendor_data.bank_account}</span>
                    </div>
                  )}
                  {selectedProfile.vendor_data.bank_ifsc && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>IFSC:</span>
                      <span style={{ fontWeight: 600 }}>{selectedProfile.vendor_data.bank_ifsc}</span>
                    </div>
                  )}
                  {selectedProfile.vendor_data.upi_id && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>UPI ID:</span>
                      <span style={{ fontWeight: 600, color: '#2563eb' }}>{selectedProfile.vendor_data.upi_id}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedProfile.record_type === 'EMPLOYEE' && selectedProfile.employee_data && (
              <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-input, #f8fafc)', border: '1px solid var(--border-light, #e2e8f0)', fontSize: '0.82rem' }}>
                <div style={{ fontWeight: 700, color: '#4f46e5', marginBottom: '8px', textTransform: 'uppercase', fontSize: '0.72rem' }}>
                  Employment Details
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Department:</span>
                    <span style={{ fontWeight: 700 }}>{selectedProfile.employee_data.department || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Designation:</span>
                    <span style={{ fontWeight: 700 }}>{selectedProfile.employee_data.designation || '-'}</span>
                  </div>
                  {selectedProfile.employee_data.monthly_salary && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Monthly Salary:</span>
                      <span style={{ fontWeight: 700, color: '#16a34a' }}>₹{Number(selectedProfile.employee_data.monthly_salary).toLocaleString('en-IN')}/mo</span>
                    </div>
                  )}
                  {selectedProfile.employee_data.joining_date && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Joining Date:</span>
                      <span style={{ fontWeight: 600 }}>{selectedProfile.employee_data.joining_date}</span>
                    </div>
                  )}
                  {selectedProfile.employee_data.emergency_contact && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Emergency Contact:</span>
                      <span style={{ fontWeight: 600 }}>{selectedProfile.employee_data.emergency_contact}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedProfile.record_type === 'WORKER' && selectedProfile.worker_data && (
              <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-input, #f8fafc)', border: '1px solid var(--border-light, #e2e8f0)', fontSize: '0.82rem' }}>
                <div style={{ fontWeight: 700, color: '#0284c7', marginBottom: '8px', textTransform: 'uppercase', fontSize: '0.72rem' }}>
                  Floor & Wage Setup
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Designation:</span>
                    <span style={{ fontWeight: 700 }}>{selectedProfile.worker_data.designation || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Station / Skill:</span>
                    <span style={{ fontWeight: 700 }}>{selectedProfile.worker_data.station_or_skill || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Wage Model:</span>
                    <span style={{ fontWeight: 600 }}>{selectedProfile.worker_data.wage_model || 'DAILY_WAGE'}</span>
                  </div>
                  {selectedProfile.worker_data.rate_amount && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Rate Amount:</span>
                      <span style={{ fontWeight: 700, color: '#2563eb' }}>₹{selectedProfile.worker_data.rate_amount}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Payout Schedule:</span>
                    <span style={{ fontWeight: 600 }}>{selectedProfile.worker_data.payout_schedule || 'WEEKLY'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Activity & Remarks Timeline */}
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '8px' }}>
                Notes & Activity History ({selectedProfile.notes?.length || 0})
              </div>

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="Add note or remark..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '0.82rem'
                  }}
                />
                <button
                  type="submit"
                  disabled={loggingNote || !noteText.trim()}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  <Send size={14} />
                </button>
              </form>

              {/* Notes List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                {selectedProfile.notes && selectedProfile.notes.length > 0 ? (
                  selectedProfile.notes.map((n, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: 'var(--bg-input, #f8fafc)',
                        border: '1px solid var(--border-light, #e2e8f0)',
                        fontSize: '0.78rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '3px' }}>
                        <span style={{ fontWeight: 700 }}>{n.createdBy || 'Staff'}</span>
                        <span>{new Date(n.createdAt).toLocaleDateString('en-IN')}</span>
                      </div>
                      <div style={{ color: 'var(--text-main)' }}>{n.text}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>
                    No notes recorded yet.
                  </div>
                )}
              </div>
            </div>

            {/* Danger Zone: Delete */}
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => handleDelete(selectedProfile._id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#dc2626',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={14} />
                <span>Delete Profile</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Profile Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '580px',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: '18px',
              padding: '1.8rem',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-card, #ffffff)',
              color: 'var(--text-main)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                {editingId ? 'Edit Connection Profile' : 'Add New Connection Profile'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Type Switcher */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-muted)' }}>
                  Profile Category *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { key: 'VENDOR', label: 'Vendor' },
                    { key: 'EMPLOYEE', label: 'Salaried Staff' },
                    { key: 'WORKER', label: 'Worker' }
                  ].map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setFormData({ ...formData, record_type: t.key })}
                      style={{
                        padding: '8px',
                        borderRadius: '8px',
                        border: `1.5px solid ${formData.record_type === t.key ? '#2563eb' : 'var(--border-light)'}`,
                        background: formData.record_type === t.key ? '#eff6ff' : 'transparent',
                        color: formData.record_type === t.key ? '#2563eb' : 'var(--text-main)',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer'
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Personal & Contact Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Patel"
                    value={formData.common_directory.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        common_directory: { ...formData.common_directory, name: e.target.value }
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                    Primary Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +91 98250 12345"
                    value={formData.common_directory.primary_phone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        common_directory: { ...formData.common_directory, primary_phone: e.target.value }
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                    WhatsApp Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +91 98250 12345"
                    value={formData.common_directory.whatsapp_phone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        common_directory: { ...formData.common_directory, whatsapp_phone: e.target.value }
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="contact@example.com"
                    value={formData.common_directory.email}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        common_directory: { ...formData.common_directory, email: e.target.value }
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                    City / Market Hub
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Surat"
                    value={formData.common_directory.city}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        common_directory: { ...formData.common_directory, city: e.target.value }
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                    State
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Gujarat"
                    value={formData.common_directory.state}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        common_directory: { ...formData.common_directory, state: e.target.value }
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                  Full Address / Facility Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Plot 102, GIDC Sachin, Surat"
                  value={formData.common_directory.address}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      common_directory: { ...formData.common_directory, address: e.target.value }
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              {/* Conditional Section: Vendor Data */}
              {formData.record_type === 'VENDOR' && (
                <div style={{ padding: '12px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontWeight: 700, color: '#16a34a', fontSize: '0.82rem' }}>Vendor Specific Fields</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#166534', marginBottom: '3px' }}>Company / Firm Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Shree Ram Fabrics"
                        value={formData.vendor_data.company_name}
                        onChange={(e) => setFormData({ ...formData, vendor_data: { ...formData.vendor_data, company_name: e.target.value } })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#fff', fontSize: '0.82rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#166534', marginBottom: '3px' }}>GSTIN / Tax ID</label>
                      <input
                        type="text"
                        placeholder="e.g. 24ABCDE1234F1Z5"
                        value={formData.vendor_data.gst_or_tax_id}
                        onChange={(e) => setFormData({ ...formData, vendor_data: { ...formData.vendor_data, gst_or_tax_id: e.target.value.toUpperCase() } })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#fff', fontSize: '0.82rem' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#166534', marginBottom: '3px' }}>Payment Terms</label>
                      <select
                        value={formData.vendor_data.payment_terms}
                        onChange={(e) => setFormData({ ...formData, vendor_data: { ...formData.vendor_data, payment_terms: e.target.value } })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#fff', fontSize: '0.82rem' }}
                      >
                        <option value="Advance">Advance</option>
                        <option value="Net 15">Net 15 Days</option>
                        <option value="Net 30">Net 30 Days</option>
                        <option value="COD">Cash on Delivery (COD)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#166534', marginBottom: '3px' }}>Supplied Items</label>
                      <input
                        type="text"
                        placeholder="e.g. Georgette Grey, Sublimation Inks"
                        value={formData.vendor_data.supplied_items}
                        onChange={(e) => setFormData({ ...formData, vendor_data: { ...formData.vendor_data, supplied_items: e.target.value } })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#fff', fontSize: '0.82rem' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#166534', marginBottom: '2px' }}>Bank A/C</label>
                      <input
                        type="text"
                        placeholder="Account number"
                        value={formData.vendor_data.bank_account}
                        onChange={(e) => setFormData({ ...formData, vendor_data: { ...formData.vendor_data, bank_account: e.target.value } })}
                        style={{ width: '100%', padding: '7px 8px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#fff', fontSize: '0.8rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#166534', marginBottom: '2px' }}>Bank IFSC</label>
                      <input
                        type="text"
                        placeholder="IFSC Code"
                        value={formData.vendor_data.bank_ifsc}
                        onChange={(e) => setFormData({ ...formData, vendor_data: { ...formData.vendor_data, bank_ifsc: e.target.value.toUpperCase() } })}
                        style={{ width: '100%', padding: '7px 8px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#fff', fontSize: '0.8rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#166534', marginBottom: '2px' }}>UPI ID</label>
                      <input
                        type="text"
                        placeholder="e.g. name@okhdfcbank"
                        value={formData.vendor_data.upi_id}
                        onChange={(e) => setFormData({ ...formData, vendor_data: { ...formData.vendor_data, upi_id: e.target.value } })}
                        style={{ width: '100%', padding: '7px 8px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#fff', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Conditional Section: Employee Data */}
              {formData.record_type === 'EMPLOYEE' && (
                <div style={{ padding: '12px', borderRadius: '10px', background: '#eef2ff', border: '1px solid #c7d2fe', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontWeight: 700, color: '#4f46e5', fontSize: '0.82rem' }}>Staff & Employment Fields</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#3730a3', marginBottom: '3px' }}>Department</label>
                      <select
                        value={formData.employee_data.department}
                        onChange={(e) => setFormData({ ...formData, employee_data: { ...formData.employee_data, department: e.target.value } })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #c7d2fe', background: '#fff', fontSize: '0.82rem' }}
                      >
                        <option value="Production">Production</option>
                        <option value="Design">Design</option>
                        <option value="Sales">Sales</option>
                        <option value="Accounts">Accounts</option>
                        <option value="Management">Management</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#3730a3', marginBottom: '3px' }}>Designation</label>
                      <input
                        type="text"
                        placeholder="e.g. Senior Graphic Designer"
                        value={formData.employee_data.designation}
                        onChange={(e) => setFormData({ ...formData, employee_data: { ...formData.employee_data, designation: e.target.value } })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #c7d2fe', background: '#fff', fontSize: '0.82rem' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#3730a3', marginBottom: '3px' }}>Monthly Salary (₹)</label>
                      <input
                        type="number"
                        placeholder="e.g. 35000"
                        value={formData.employee_data.monthly_salary}
                        onChange={(e) => setFormData({ ...formData, employee_data: { ...formData.employee_data, monthly_salary: e.target.value } })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #c7d2fe', background: '#fff', fontSize: '0.82rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#3730a3', marginBottom: '3px' }}>Joining Date</label>
                      <input
                        type="date"
                        value={formData.employee_data.joining_date}
                        onChange={(e) => setFormData({ ...formData, employee_data: { ...formData.employee_data, joining_date: e.target.value } })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #c7d2fe', background: '#fff', fontSize: '0.82rem' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Conditional Section: Worker Data */}
              {formData.record_type === 'WORKER' && (
                <div style={{ padding: '12px', borderRadius: '10px', background: '#f0f9ff', border: '1px solid #bae6fd', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontWeight: 700, color: '#0284c7', fontSize: '0.82rem' }}>Factory Worker Setup</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0369a1', marginBottom: '3px' }}>Designation / Role</label>
                      <input
                        type="text"
                        placeholder="e.g. Printing Machine Operator"
                        value={formData.worker_data.designation}
                        onChange={(e) => setFormData({ ...formData, worker_data: { ...formData.worker_data, designation: e.target.value } })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #bae6fd', background: '#fff', fontSize: '0.82rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0369a1', marginBottom: '3px' }}>Station / Skill</label>
                      <input
                        type="text"
                        placeholder="e.g. Fusing Line 2"
                        value={formData.worker_data.station_or_skill}
                        onChange={(e) => setFormData({ ...formData, worker_data: { ...formData.worker_data, station_or_skill: e.target.value } })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #bae6fd', background: '#fff', fontSize: '0.82rem' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#0369a1', marginBottom: '2px' }}>Wage Model</label>
                      <select
                        value={formData.worker_data.wage_model}
                        onChange={(e) => setFormData({ ...formData, worker_data: { ...formData.worker_data, wage_model: e.target.value } })}
                        style={{ width: '100%', padding: '7px 8px', borderRadius: '6px', border: '1px solid #bae6fd', background: '#fff', fontSize: '0.8rem' }}
                      >
                        <option value="DAILY_WAGE">Daily Wage</option>
                        <option value="PIECE_RATE">Piece Rate</option>
                        <option value="MONTHLY">Monthly</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#0369a1', marginBottom: '2px' }}>Rate (₹)</label>
                      <input
                        type="number"
                        placeholder="e.g. 600"
                        value={formData.worker_data.rate_amount}
                        onChange={(e) => setFormData({ ...formData, worker_data: { ...formData.worker_data, rate_amount: e.target.value } })}
                        style={{ width: '100%', padding: '7px 8px', borderRadius: '6px', border: '1px solid #bae6fd', background: '#fff', fontSize: '0.8rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#0369a1', marginBottom: '2px' }}>Payout</label>
                      <select
                        value={formData.worker_data.payout_schedule}
                        onChange={(e) => setFormData({ ...formData, worker_data: { ...formData.worker_data, payout_schedule: e.target.value } })}
                        style={{ width: '100%', padding: '7px 8px', borderRadius: '6px', border: '1px solid #bae6fd', background: '#fff', fontSize: '0.8rem' }}
                      >
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {saving ? 'Saving...' : editingId ? 'Update Profile' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
