import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { triggerPushNotification } from './NotificationToast';
import {
  FileText,
  User,
  Search,
  RotateCw,
  Eye,
  Filter,
  Calendar,
  Layers,
  Download,
  Users,
  Clock,
  ArrowRight,
  X,
  CreditCard,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Printer,
  Flame,
  Truck,
  Scissors,
  Package,
  CheckCircle,
  FileCheck,
  Hash,
  Tag,
  DollarSign,
  AlertCircle
} from 'lucide-react';

export default function AdminUserDataReview() {
  const [entries, setEntries] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState('ALL');
  const [selectedModule, setSelectedModule] = useState('ALL');
  const [selectedCompany, setSelectedCompany] = useState('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [datePreset, setDatePreset] = useState('ALL'); // 'TODAY', 'YESTERDAY', 'WEEK', 'MONTH', 'ALL'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // Detail Modal
  const [inspectEntry, setInspectEntry] = useState(null);
  const [showRawJson, setShowRawJson] = useState(false);

  // Fetch list of users who entered data
  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.getEntryUsersList();
      if (res && res.data) {
        setUsersList(res.data || []);
      }
    } catch (e) {
      console.warn('Failed to load entry users:', e);
    }
  }, []);

  // Fetch user entries
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getUserDataEntries({
        user: selectedUser,
        module: selectedModule,
        company: selectedCompany,
        department: selectedDepartment,
        startDate,
        endDate,
        search,
        page,
        limit: 35,
      });

      if (res && res.data) {
        setEntries(res.data || []);
        if (res.meta) {
          setPagination({
            total: res.meta.total || 0,
            totalPages: res.meta.totalPages || 1,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load user entries:', err);
      triggerPushNotification('Error', err.message || 'Failed to fetch user entries', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedUser, selectedModule, selectedCompany, selectedDepartment, startDate, endDate, search, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Handle Date Presets
  const applyDatePreset = (preset) => {
    setDatePreset(preset);
    setPage(1);

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'TODAY') {
      const todayStr = toYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'YESTERDAY') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = toYMD(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === 'WEEK') {
      const w = new Date();
      w.setDate(w.getDate() - 7);
      setStartDate(toYMD(w));
      setEndDate(toYMD(now));
    } else if (preset === 'MONTH') {
      const m = new Date();
      m.setDate(m.getDate() - 30);
      setStartDate(toYMD(m));
      setEndDate(toYMD(now));
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  // Export filtered entries to CSV
  const handleExportCsv = () => {
    if (entries.length === 0) {
      triggerPushNotification('No Data', 'No entries available to export.', 'info');
      return;
    }

    const headers = ['Date & Time', 'Company', 'Department', 'Created By', 'Last Edited By', 'Last Edited Time', 'Module', 'Identifier', 'Party / Project', 'Amount / Quantity', 'Status', 'Details'];
    const rows = entries.map(e => [
      `"${new Date(e.createdAt).toLocaleString('en-IN')}"`,
      `"${(e.companyEntity || 'Elite Digital Print').replace(/"/g, '""')}"`,
      `"${(e.department || 'General').replace(/"/g, '""')}"`,
      `"${e.createdBy || 'Staff User'}"`,
      `"${e.updatedByName || e.updatedBy || '—'}"`,
      `"${e.updatedAt ? new Date(e.updatedAt).toLocaleString('en-IN') : '—'}"`,
      `"${e.moduleLabel || e.module}"`,
      `"${e.identifier || ''}"`,
      `"${(e.party || e.project || '').replace(/"/g, '""')}"`,
      `"${(e.amountOrQuantity || '').replace(/"/g, '""')}"`,
      `"${e.status || ''}"`,
      `"${(e.details || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `user_data_entries_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerPushNotification('Export Complete', `Exported ${entries.length} records.`, 'success');
  };

  const companyOptions = [
    { value: 'ALL', label: '🏢 All Companies' },
    { value: 'Elite Digital Print', label: '🏢 Elite Digital Print' },
    { value: 'Elite Online', label: '🏢 Elite Online' },
    { value: 'Elite Stitching', label: '🏢 Elite Stitching' },
    { value: 'Elite Fabtex', label: '🏢 Elite Fabtex' },
    { value: 'Elite Edition', label: '🏢 Elite Edition' },
  ];

  const departmentOptions = [
    { value: 'ALL', label: '🏛️ All Departments' },
    { value: 'Digital Printing', label: '🖨️ Digital Printing' },
    { value: 'Fabric & Stock', label: '🧵 Fabric & Stock' },
    { value: 'Design & Pre-Press', label: '🎨 Design & Pre-Press' },
    { value: 'Billing & Accounts', label: '💰 Billing & Accounts' },
    { value: 'Stitching & Garments', label: '✂️ Stitching & Garments' },
    { value: 'E-Commerce & Orders', label: '🛒 E-Commerce & Orders' },
    { value: 'Inventory & Warehouse', label: '📦 Inventory & Warehouse' },
    { value: 'Projects & Tasks', label: '📋 Projects & Tasks' },
    { value: 'Quality & Complaints', label: '⚠️ Quality & Complaints' },
  ];

  const moduleOptions = [
    { value: 'ALL', label: 'All Modules' },
    { value: 'JobCard', label: 'Job Cards (Digital Print)' },
    { value: 'JobPrintLog', label: 'Printing Logs (Machine Meterage)' },
    { value: 'JobFusingLog', label: 'Fusing Logs (Heat-Press Runs)' },
    { value: 'Task', label: 'Projects & Tasks' },
    { value: 'FabricTransaction', label: 'Fabric Inward/Outward' },
    { value: 'RawMaterialTransaction', label: 'Raw Materials' },
    { value: 'BillingInvoice', label: 'Tax Invoices' },
    { value: 'BillingPurchase', label: 'Purchase Bills' },
    { value: 'Expense', label: 'Expenses' },
    { value: 'Complaint', label: 'Quality Complaints' },
    { value: 'Design', label: 'Catalog Designs' },
    { value: 'DesignerTask', label: 'Designer Tasks' },
    { value: 'FabricChallan', label: 'Fabric Challans' },
    { value: 'StitchingChallan', label: 'Stitching Challans' },
    { value: 'GarmentJobCard', label: 'Garment Job Cards' },
    { value: 'Inventory', label: 'Inventory Items' },
    { value: 'StockOut', label: 'Stock Out Dispatches' },
    { value: 'SaleOrder', label: 'Sale Orders' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', fontFamily: 'inherit' }}>
      {/* Top Banner */}
      <div style={{
        background: '#ffffff',
        border: '1.5px solid #bfdbfe',
        borderRadius: '12px',
        padding: '1.2rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: '0 2px 10px rgba(37,99,235,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            border: '1.5px solid #93c5fd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1d4ed8'
          }}>
            <FileText size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
              User Data Entry Review & Audit Feed
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              Track and review all records, invoices, job cards, and fabric transactions entered into the ERP by staff users.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          style={{
            padding: '0.55rem 1.1rem',
            borderRadius: '8px',
            border: '1px solid #bfdbfe',
            background: '#eff6ff',
            color: '#1d4ed8',
            fontSize: '0.8rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            boxShadow: '0 1px 3px rgba(37,99,235,0.1)'
          }}
        >
          <Download size={15} /> Export to CSV
        </button>
      </div>

      {/* Control & Filter Panel */}
      <div style={{
        background: '#ffffff',
        border: '1.5px solid #bfdbfe',
        borderRadius: '12px',
        padding: '1.1rem 1.3rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        boxShadow: '0 2px 10px rgba(37,99,235,0.04)'
      }}>
        {/* Row 1: Company, Department, User, Module & Search Selectors */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Company selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '1 1 180px' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>
              🏢 Company:
            </label>
            <select
              value={selectedCompany}
              onChange={(e) => { setSelectedCompany(e.target.value); setPage(1); }}
              style={{
                padding: '0.55rem 0.75rem',
                borderRadius: '7px',
                fontSize: '0.85rem',
                fontWeight: 700,
                background: '#ffffff',
                border: '1.5px solid #bfdbfe',
                color: '#0f172a'
              }}
            >
              {companyOptions.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Department selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '1 1 180px' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>
              🏛️ Department:
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => { setSelectedDepartment(e.target.value); setPage(1); }}
              style={{
                padding: '0.55rem 0.75rem',
                borderRadius: '7px',
                fontSize: '0.85rem',
                fontWeight: 700,
                background: '#ffffff',
                border: '1.5px solid #bfdbfe',
                color: '#0f172a'
              }}
            >
              {departmentOptions.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* User selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '1 1 180px' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>
              👤 Filter by User:
            </label>
            <select
              value={selectedUser}
              onChange={(e) => { setSelectedUser(e.target.value); setPage(1); }}
              style={{
                padding: '0.55rem 0.75rem',
                borderRadius: '7px',
                fontSize: '0.85rem',
                fontWeight: 700,
                background: '#ffffff',
                border: '1.5px solid #bfdbfe',
                color: '#0f172a'
              }}
            >
              <option value="ALL">-- All Staff Users ({usersList.length}) --</option>
              {usersList.map((u, i) => (
                <option key={i} value={u}>{u}</option>
              ))}
            </select>
          </div>

          {/* Module selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '1 1 180px' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>
              📁 Module:
            </label>
            <select
              value={selectedModule}
              onChange={(e) => { setSelectedModule(e.target.value); setPage(1); }}
              style={{
                padding: '0.55rem 0.75rem',
                borderRadius: '7px',
                fontSize: '0.85rem',
                fontWeight: 700,
                background: '#ffffff',
                border: '1.5px solid #bfdbfe',
                color: '#0f172a'
              }}
            >
              {moduleOptions.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Search box */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '2 1 240px' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>
              🔍 Search Query:
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={15} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search by Job #, Invoice #, Party, Fabric..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem 0.55rem 2.1rem',
                  borderRadius: '7px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  background: '#ffffff',
                  border: '1.5px solid #bfdbfe',
                  color: '#0f172a',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div style={{ alignSelf: 'flex-end' }}>
            <button
              type="button"
              onClick={fetchEntries}
              title="Refresh Entries"
              style={{
                padding: '0.55rem 0.9rem',
                borderRadius: '7px',
                border: '1.5px solid #bfdbfe',
                background: '#ffffff',
                color: '#1d4ed8',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontWeight: 700,
                fontSize: '0.8rem'
              }}
            >
              <RotateCw size={15} /> Refresh
            </button>
          </div>
        </div>

        {/* Row 2: Date Filters & Presets */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e40af' }}>
            Date Filter:
          </span>

          {[
            { key: 'ALL', label: 'All Time' },
            { key: 'TODAY', label: 'Today' },
            { key: 'YESTERDAY', label: 'Yesterday' },
            { key: 'WEEK', label: 'Last 7 Days' },
            { key: 'MONTH', label: 'Last 30 Days' },
          ].map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyDatePreset(p.key)}
              style={{
                padding: '0.3rem 0.7rem',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: 'pointer',
                border: datePreset === p.key ? '1.5px solid #2563eb' : '1px solid #bfdbfe',
                background: datePreset === p.key ? '#2563eb' : '#ffffff',
                color: datePreset === p.key ? '#ffffff' : '#1e40af'
              }}
            >
              {p.label}
            </button>
          ))}

          {/* Custom Date Pickers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginLeft: 'auto' }}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setDatePreset('CUSTOM'); setPage(1); }}
              style={{ padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '0.75rem', color: '#0f172a' }}
            />
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setDatePreset('CUSTOM'); setPage(1); }}
              style={{ padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '0.75rem', color: '#0f172a' }}
            />
          </div>
        </div>
      </div>

      {/* Summary Stats Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: '0.85rem'
      }}>
        <div style={{ background: '#ffffff', border: '1.5px solid #bfdbfe', borderRadius: '10px', padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Total Entries</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1d4ed8', marginTop: '2px' }}>{pagination.total}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1.5px solid #bfdbfe', borderRadius: '10px', padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Company Filter</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{selectedCompany === 'ALL' ? '🏢 All Companies' : selectedCompany}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1.5px solid #bfdbfe', borderRadius: '10px', padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Department Filter</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{selectedDepartment === 'ALL' ? '🏛️ All Depts' : selectedDepartment}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1.5px solid #bfdbfe', borderRadius: '10px', padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Staff User</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{selectedUser === 'ALL' ? '👤 All Users' : selectedUser}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1.5px solid #bfdbfe', borderRadius: '10px', padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Module Filter</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{selectedModule === 'ALL' ? '📁 All Modules' : selectedModule}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1.5px solid #bfdbfe', borderRadius: '10px', padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Date Scope</div>
          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>
            {startDate && endDate ? `${startDate} to ${endDate}` : 'All Recorded History'}
          </div>
        </div>
      </div>

      {/* Entries List */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', background: '#ffffff', border: '1.5px solid #bfdbfe', borderRadius: '12px' }}>
          <RotateCw size={28} color="#2563eb" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.75rem' }} />
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e40af' }}>Loading user entries feed...</div>
        </div>
      ) : entries.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', background: '#ffffff', border: '1.5px solid #bfdbfe', borderRadius: '12px' }}>
          <FileText size={38} color="#2563eb" style={{ margin: '0 auto 0.75rem' }} />
          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>No user data entries found</h4>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
            Try expanding your date range or clearing filters to view more entries.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {entries.map(item => (
            <div
              key={`${item.module}_${item.id}`}
              style={{
                background: '#ffffff',
                border: '1.5px solid #bfdbfe',
                borderRadius: '10px',
                padding: '0.9rem 1.2rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                boxShadow: '0 2px 6px rgba(37,99,235,0.04)',
                transition: 'all 0.15s ease'
              }}
            >
              {/* Left Column: Module, ID, and Details */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', flex: '1 1 auto', minWidth: '260px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#1d4ed8',
                  flexShrink: 0,
                  marginTop: '2px'
                }}>
                  <Briefcase size={18} />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {/* Company Badge */}
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      background: '#f8fafc',
                      color: '#0f172a',
                      border: '1.5px solid #cbd5e1',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      🏢 {item.companyEntity || 'Elite Digital Print'}
                    </span>

                    {/* Department Badge */}
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      background: '#e0e7ff',
                      color: '#3730a3',
                      border: '1px solid #c7d2fe',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      🏛️ {item.department || 'General'}
                    </span>

                    {/* Module Tag */}
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe'
                    }}>
                      {item.moduleLabel || item.module}
                    </span>

                    {/* Document Number */}
                    <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>
                      {item.identifier}
                    </span>

                    {/* Party Tag */}
                    {item.party && (
                      <span style={{
                        padding: '1px 6px',
                        borderRadius: '5px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        color: '#334155'
                      }}>
                        {item.party}
                      </span>
                    )}

                    {/* Status badge */}
                    <span style={{
                      padding: '1px 6px',
                      borderRadius: '5px',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      color: '#1e40af'
                    }}>
                      {item.status}
                    </span>
                  </div>

                  {/* Summary Details line */}
                  <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '3px' }}>
                    {item.details}
                  </div>
                </div>
              </div>

              {/* Middle: Creator, Editor & Timestamps */}
              <div style={{ textAlign: 'right', minWidth: '190px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                  <User size={13} color="#2563eb" />
                  <span>Created: {item.createdBy || 'Staff User'}</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : 'N/A'}
                </div>
                {!(item.updatedByName || item.updatedBy) && (
                  <div style={{
                    marginTop: '2px',
                    fontSize: '0.73rem',
                    fontWeight: 800,
                    color: '#15803d',
                    background: '#dcfce7',
                    border: '1px solid #bbf7d0',
                    padding: '1px 6px',
                    borderRadius: '5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span>➕ New Entry</span>
                  </div>
                )}
                {(item.updatedByName || item.updatedBy) && (
                  <div style={{
                    marginTop: '2px',
                    fontSize: '0.73rem',
                    fontWeight: 800,
                    color: '#92400e',
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    padding: '1px 6px',
                    borderRadius: '5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span>✏️ Edited: {item.updatedByName || item.updatedBy}</span>
                    {Array.isArray(item.auditTrail) && item.auditTrail.length > 1 && (
                      <span style={{ fontSize: '0.67rem', color: '#b45309', fontWeight: 900 }}>
                        ({item.auditTrail.length}x)
                      </span>
                    )}
                  </div>
                )}
                {item.updatedAt && (item.updatedByName || item.updatedBy) && (
                  <div style={{ fontSize: '0.68rem', color: '#b45309' }}>
                    {new Date(item.updatedAt).toLocaleString('en-IN')}
                  </div>
                )}
              </div>

              {/* Right: Value badge & View Details Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  border: '1px solid #93c5fd',
                  color: '#1d4ed8',
                  fontSize: '0.85rem',
                  fontWeight: 900,
                  whiteSpace: 'nowrap'
                }}>
                  {item.amountOrQuantity}
                </div>

                <button
                  type="button"
                  onClick={() => setInspectEntry(item)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #bfdbfe',
                    background: '#ffffff',
                    color: '#1d4ed8',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Eye size={13} /> View
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Footer */}
      {pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              border: '1px solid #bfdbfe',
              background: '#ffffff',
              color: '#1d4ed8',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              opacity: page <= 1 ? 0.5 : 1
            }}
          >
            Previous
          </button>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e40af' }}>
            Page {page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              border: '1px solid #bfdbfe',
              background: '#ffffff',
              color: '#1d4ed8',
              cursor: page >= pagination.totalPages ? 'not-allowed' : 'pointer',
              opacity: page >= pagination.totalPages ? 0.5 : 1
            }}
          >
            Next
          </button>
        </div>
      )}

      {/* Inspect Entry Modal */}
      {inspectEntry && (() => {
        const raw = inspectEntry.rawDoc || inspectEntry;
        return (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}>
            <div style={{
              background: '#ffffff',
              border: '2px solid #bfdbfe',
              borderRadius: '12px',
              padding: '1.5rem',
              width: '100%',
              maxWidth: '780px',
              maxHeight: '88vh',
              overflowY: 'auto',
              boxShadow: '0 10px 30px rgba(0,0,0,0.15)'
            }}>
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #bfdbfe', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 900,
                    background: '#f8fafc',
                    color: '#0f172a',
                    border: '1.5px solid #cbd5e1',
                  }}>
                    🏢 {inspectEntry.companyEntity || 'Elite Digital Print'}
                  </span>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 900,
                    background: '#e0e7ff',
                    color: '#3730a3',
                    border: '1px solid #c7d2fe',
                  }}>
                    🏛️ {inspectEntry.department || 'General'}
                  </span>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 900,
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    textTransform: 'uppercase'
                  }}>
                    {inspectEntry.moduleLabel || inspectEntry.module}
                  </span>
                  <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>
                    {inspectEntry.identifier}
                  </h4>
                  {inspectEntry.status && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      background: '#f0fdf4',
                      color: '#1e40af',
                      border: '1px solid #bfdbfe'
                    }}>
                      {inspectEntry.status}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setInspectEntry(null); setShowRawJson(false); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Highlights KPI Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
                <div style={{ background: '#f8faff', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Company</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    🏢 {inspectEntry.companyEntity || 'Elite Digital Print'}
                  </div>
                </div>
                <div style={{ background: '#f8faff', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Department</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    🏛️ {inspectEntry.department || 'General'}
                  </div>
                </div>
                <div style={{ background: '#f8faff', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Party / Project</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {inspectEntry.party || inspectEntry.project || '—'}
                  </div>
                </div>
                <div style={{ background: '#f8faff', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Created By</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0f172a' }}>
                    {inspectEntry.createdBy || 'Staff User'}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                    {inspectEntry.createdAt ? new Date(inspectEntry.createdAt).toLocaleString('en-IN') : 'N/A'}
                  </div>
                </div>
                <div style={{
                  background: (inspectEntry.updatedByName || inspectEntry.updatedBy) ? '#fffbeb' : '#f8faff',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '8px',
                  border: (inspectEntry.updatedByName || inspectEntry.updatedBy) ? '1.5px solid #fde68a' : '1px solid #bfdbfe'
                }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: (inspectEntry.updatedByName || inspectEntry.updatedBy) ? '#92400e' : '#64748b', textTransform: 'uppercase' }}>
                    Last Edited By
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 900, color: (inspectEntry.updatedByName || inspectEntry.updatedBy) ? '#92400e' : '#64748b' }}>
                    {inspectEntry.updatedByName || inspectEntry.updatedBy || 'No edits recorded'}
                  </div>
                  {inspectEntry.updatedAt && (inspectEntry.updatedByName || inspectEntry.updatedBy) && (
                    <div style={{ fontSize: '0.68rem', color: '#b45309' }}>
                      {new Date(inspectEntry.updatedAt).toLocaleString('en-IN')}
                    </div>
                  )}
                </div>
                <div style={{ background: '#f8faff', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Quantity / Value</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#1d4ed8' }}>
                    {inspectEntry.amountOrQuantity}
                  </div>
                </div>
              </div>

              {/* Module-Specific Structured Human-Readable Sections */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* 1. Job Card Details */}
                {inspectEntry.module === 'JobCard' && (
                  <>
                    <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                      <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <FileText size={15} /> Order & Fabric Specifications
                      </h5>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem', fontSize: '0.78rem' }}>
                        <div><span style={{ color: '#64748b' }}>Job No:</span> <b style={{ color: '#0f172a' }}>{raw.jobNo || '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>Party Name:</span> <b style={{ color: '#0f172a' }}>{raw.partyName || raw.party || '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>Fabric:</span> <b style={{ color: '#0f172a' }}>{raw.fabric || raw.fabricName || '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>Design No:</span> <b style={{ color: '#0f172a' }}>{raw.designNo || raw.designName || '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>Total Order Mtr:</span> <b style={{ color: '#1d4ed8' }}>{raw.totalMtr ? `${raw.totalMtr} m` : '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>Panna:</span> <b style={{ color: '#0f172a' }}>{raw.panna || '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>Consumption:</span> <b style={{ color: '#0f172a' }}>{raw.consumption || '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>Colors:</span> <b style={{ color: '#0f172a' }}>{raw.colors || '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>Cut:</span> <b style={{ color: '#0f172a' }}>{raw.cut || '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>Category:</span> <b style={{ color: '#0f172a' }}>{raw.category || '—'}</b></div>
                      </div>
                    </div>

                    {(raw.fusingStatus || raw.fusingMtr || raw.fusingDate || raw.fusingOperator || raw.freshMtr) && (
                      <div style={{ background: '#f0f7ff', border: '1.5px solid #93c5fd', borderRadius: '8px', padding: '0.85rem' }}>
                        <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Flame size={15} color="#2563eb" /> Fusing Department Production Data
                        </h5>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem', fontSize: '0.78rem' }}>
                          <div><span style={{ color: '#64748b' }}>Fusing Status:</span> <b style={{ color: '#1d4ed8' }}>{raw.fusingStatus || 'Pending'}</b></div>
                          <div><span style={{ color: '#64748b' }}>Fusing Date:</span> <b style={{ color: '#0f172a' }}>{raw.fusingDate || '—'}</b></div>
                          <div><span style={{ color: '#64748b' }}>Operator:</span> <b style={{ color: '#0f172a' }}>{raw.fusingOperator || '—'}</b></div>
                          <div><span style={{ color: '#64748b' }}>Machine:</span> <b style={{ color: '#0f172a' }}>{raw.fusingMachine || '—'}</b></div>
                          <div><span style={{ color: '#64748b' }}>Shift:</span> <b style={{ color: '#0f172a' }}>{raw.shift || '—'}</b></div>
                          <div><span style={{ color: '#64748b' }}>Speed:</span> <b style={{ color: '#0f172a' }}>{raw.fusingSpeed || raw.speed || '—'}</b></div>
                          <div><span style={{ color: '#64748b' }}>Temp:</span> <b style={{ color: '#0f172a' }}>{raw.fusingTemp || raw.temperature || '—'}°C</b></div>
                          <div><span style={{ color: '#64748b' }}>Fresh Meter:</span> <b style={{ color: '#1d4ed8' }}>{raw.freshMtr ? `${raw.freshMtr} m` : '—'}</b></div>
                          <div><span style={{ color: '#64748b' }}>Wastage Meter:</span> <b style={{ color: '#1d4ed8' }}>{raw.totalWastageMtr ? `${raw.totalWastageMtr} m` : '0 m'}</b></div>
                          <div><span style={{ color: '#64748b' }}>Total Fabric Used:</span> <b style={{ color: '#1d4ed8' }}>{raw.totalFabricUsedMtr ? `${raw.totalFabricUsedMtr} m` : '—'}</b></div>
                          <div><span style={{ color: '#64748b' }}>Fusing Meter:</span> <b style={{ color: '#1e40af', fontWeight: 900 }}>{raw.fusingMtr ? `${raw.fusingMtr} m` : '—'}</b></div>
                          <div><span style={{ color: '#64748b' }}>Butter Paper:</span> <b style={{ color: '#0f172a' }}>{raw.useButterPaper || 'No'} {raw.butterPaperWeightKg ? `(${raw.butterPaperWeightKg} kg)` : ''}</b></div>
                        </div>
                        {(Number(raw.fabricFaultMtr || 0) > 0 || Number(raw.fusingFaultMtr || 0) > 0 || Number(raw.genuineFaultMtr || 0) > 0 || Number(raw.printFaultMtr || 0) > 0) && (
                          <div style={{ marginTop: '0.6rem', padding: '0.45rem 0.65rem', background: '#ffffff', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '0.74rem' }}>
                            <span style={{ fontWeight: 800, color: '#1e40af' }}>Faults Logged: </span>
                            {raw.fusingFaultMtr ? `Fusing Fault: ${raw.fusingFaultMtr}m • ` : ''}
                            {raw.fabricFaultMtr ? `Fabric Fault: ${raw.fabricFaultMtr}m • ` : ''}
                            {raw.printFaultMtr ? `Print Fault: ${raw.printFaultMtr}m • ` : ''}
                            {raw.genuineFaultMtr ? `Genuine Fault: ${raw.genuineFaultMtr}m` : ''}
                          </div>
                        )}
                        {raw.emergencyNotes && (
                          <div style={{ marginTop: '0.5rem', fontSize: '0.74rem', color: '#1e40af', background: '#ffffff', padding: '0.4rem 0.6rem', borderRadius: '5px', border: '1px solid #bfdbfe' }}>
                            <b>Notes:</b> {raw.emergencyNotes}
                          </div>
                        )}
                      </div>
                    )}

                    {(raw.printStatus || raw.printMtr || raw.printDate || raw.operatorName || raw.printOperator) && (
                      <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                        <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Printer size={15} /> Printing Department Data
                        </h5>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem', fontSize: '0.78rem' }}>
                          <div><span style={{ color: '#64748b' }}>Print Status:</span> <b style={{ color: '#1d4ed8' }}>{raw.printStatus || 'Pending'}</b></div>
                          <div><span style={{ color: '#64748b' }}>Print Date:</span> <b style={{ color: '#0f172a' }}>{raw.printDate || raw.printingDate || '—'}</b></div>
                          <div><span style={{ color: '#64748b' }}>Printed Meter:</span> <b style={{ color: '#1d4ed8' }}>{raw.printMtr || raw.printedMtr || '—'}</b></div>
                          <div><span style={{ color: '#64748b' }}>Printer / Machine:</span> <b style={{ color: '#0f172a' }}>{raw.machineName || raw.printMachine || '—'}</b></div>
                          <div><span style={{ color: '#64748b' }}>Print Operator:</span> <b style={{ color: '#0f172a' }}>{raw.printOperator || raw.operatorName || '—'}</b></div>
                          <div><span style={{ color: '#64748b' }}>Pass / Profile:</span> <b style={{ color: '#0f172a' }}>{raw.pass || raw.profile || '—'}</b></div>
                        </div>
                      </div>
                    )}

                    {(raw.deliveryStatus || raw.deliveryMtr || raw.deliveryDate || raw.qaStatus) && (
                      <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                        <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Truck size={15} /> Delivery & QA Status
                        </h5>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem', fontSize: '0.78rem' }}>
                          <div><span style={{ color: '#64748b' }}>Delivery Status:</span> <b style={{ color: '#1d4ed8' }}>{raw.deliveryStatus || 'Pending'}</b></div>
                          <div><span style={{ color: '#64748b' }}>Delivery Date:</span> <b style={{ color: '#0f172a' }}>{raw.deliveryDate || '—'}</b></div>
                          <div><span style={{ color: '#64748b' }}>Delivery Meter:</span> <b style={{ color: '#1d4ed8' }}>{raw.deliveryMtr || raw.deliveredMtr ? `${raw.deliveryMtr || raw.deliveredMtr} m` : '—'}</b></div>
                          <div><span style={{ color: '#64748b' }}>QA Status:</span> <b style={{ color: '#0f172a' }}>{raw.qaStatus || '—'}</b></div>
                          <div><span style={{ color: '#64748b' }}>QA Inspector:</span> <b style={{ color: '#0f172a' }}>{raw.qaInspector || '—'}</b></div>
                        </div>
                      </div>
                    )}

                    {Array.isArray(raw.auditTrail) && raw.auditTrail.length > 0 && (
                      <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                        <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Clock size={15} /> Change History & Actions Log ({raw.auditTrail.length})
                        </h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
                          {raw.auditTrail.slice().reverse().map((at, idx) => (
                            <div key={idx} style={{ padding: '0.4rem 0.6rem', background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.73rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, color: '#1e40af' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span>{at.performedByName || at.performedBy || 'Staff'}</span>
                                  {at.action === 'FUSING_ENTRY' && <span style={{ color: '#c2410c', background: '#ffedd5', border: '1px solid #fed7aa', padding: '1px 6px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 800 }}>🔥 New Fusing Entry</span>}
                                  {at.action === 'PRINT_ENTRY' && <span style={{ color: '#1d4ed8', background: '#dbeafe', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 800 }}>🖨️ New Print Entry</span>}
                                  {at.action === 'CREATE' && <span style={{ color: '#15803d', background: '#dcfce7', border: '1px solid #bbf7d0', padding: '1px 6px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 800 }}>✨ Created Job Card</span>}
                                  {(at.action === 'UPDATE' || at.action === 'EDIT') && <span style={{ color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', padding: '1px 6px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 800 }}>✏️ Edited Record</span>}
                                  {at.action !== 'FUSING_ENTRY' && at.action !== 'PRINT_ENTRY' && at.action !== 'CREATE' && at.action !== 'UPDATE' && at.action !== 'EDIT' && (
                                    <span style={{ color: '#475569', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '1px 6px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 700 }}>{at.action || 'UPDATE'}</span>
                                  )}
                                </div>
                                <span style={{ color: '#64748b', fontWeight: 600 }}>{at.timestamp ? new Date(at.timestamp).toLocaleString('en-IN') : ''}</span>
                              </div>
                              {at.details && <div style={{ color: '#334155', marginTop: '2px' }}>{at.details}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* 2. Billing Invoice Details */}
                {inspectEntry.module === 'BillingInvoice' && (
                  <>
                    <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                      <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Users size={15} /> Customer & Billing Information
                      </h5>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', fontSize: '0.78rem' }}>
                        <div><span style={{ color: '#64748b' }}>Customer:</span> <b style={{ color: '#0f172a' }}>{raw.customer?.name || raw.customerName || '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>Business Name:</span> <b style={{ color: '#0f172a' }}>{raw.customer?.businessName || '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>GSTIN:</span> <b style={{ color: '#0f172a' }}>{raw.customer?.gstin || '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>Phone:</span> <b style={{ color: '#0f172a' }}>{raw.customer?.phone || '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>Invoice Date:</span> <b style={{ color: '#0f172a' }}>{raw.invoiceDate ? new Date(raw.invoiceDate).toLocaleDateString('en-IN') : '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>Payment Status:</span> <b style={{ color: '#1d4ed8' }}>{raw.paymentStatus || 'UNPAID'}</b></div>
                      </div>
                    </div>

                    {Array.isArray(raw.items) && raw.items.length > 0 && (
                      <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                        <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Layers size={15} /> Invoice Items ({raw.items.length})
                        </h5>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                            <thead>
                              <tr style={{ background: '#eff6ff', color: '#1e40af', textAlign: 'left' }}>
                                <th style={{ padding: '6px', borderBottom: '1.5px solid #bfdbfe' }}>Item</th>
                                <th style={{ padding: '6px', borderBottom: '1.5px solid #bfdbfe' }}>Fabric / Job</th>
                                <th style={{ padding: '6px', borderBottom: '1.5px solid #bfdbfe' }}>Qty</th>
                                <th style={{ padding: '6px', borderBottom: '1.5px solid #bfdbfe' }}>Rate</th>
                                <th style={{ padding: '6px', borderBottom: '1.5px solid #bfdbfe', textAlign: 'right' }}>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {raw.items.map((it, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td style={{ padding: '6px', fontWeight: 700 }}>{it.itemName}</td>
                                  <td style={{ padding: '6px', color: '#64748b' }}>{it.fabric || it.fabricName || it.jobNo || '—'}</td>
                                  <td style={{ padding: '6px', fontWeight: 800, color: '#1d4ed8' }}>{it.qty} {it.unit || 'm'}</td>
                                  <td style={{ padding: '6px' }}>₹{it.unitPrice}</td>
                                  <td style={{ padding: '6px', fontWeight: 900, textAlign: 'right', color: '#0f172a' }}>₹{Number(it.totalAmount || 0).toLocaleString('en-IN')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1.5rem', marginTop: '0.75rem', fontSize: '0.82rem', fontWeight: 900, borderTop: '1.5px solid #bfdbfe', paddingTop: '0.5rem' }}>
                          <div>Grand Total: <span style={{ color: '#1d4ed8' }}>₹{Number(raw.grandTotal || 0).toLocaleString('en-IN')}</span></div>
                          <div>Due: <span style={{ color: '#1e40af' }}>₹{Number(raw.balanceDue || 0).toLocaleString('en-IN')}</span></div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* 3. Expense Details */}
                {inspectEntry.module === 'Expense' && (
                  <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                    <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <CreditCard size={15} /> Expense Voucher Details
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', fontSize: '0.78rem' }}>
                      <div><span style={{ color: '#64748b' }}>Voucher No:</span> <b style={{ color: '#0f172a' }}>{raw.voucherNo || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Type:</span> <b style={{ color: '#1d4ed8' }}>{raw.type === 'IN' ? 'Cash IN' : 'Cash OUT'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Category:</span> <b style={{ color: '#0f172a' }}>{raw.category || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Amount:</span> <b style={{ color: '#1d4ed8', fontSize: '0.9rem' }}>₹{Number(raw.amount || 0).toLocaleString('en-IN')}</b></div>
                      <div><span style={{ color: '#64748b' }}>Payment Mode:</span> <b style={{ color: '#0f172a' }}>{raw.paymentMode || 'Cash'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Party / Vendor:</span> <b style={{ color: '#0f172a' }}>{raw.paidToOrReceivedFrom || raw.partyName || raw.vendorName || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Bill No:</span> <b style={{ color: '#0f172a' }}>{raw.billNo || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Date:</span> <b style={{ color: '#0f172a' }}>{raw.date || '—'}</b></div>
                    </div>
                    {raw.description && (
                      <div style={{ marginTop: '0.6rem', padding: '0.5rem', background: '#ffffff', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '0.75rem', color: '#0f172a' }}>
                        <b>Description:</b> {raw.description}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Fabric Challan Details */}
                {inspectEntry.module === 'FabricChallan' && (
                  <>
                    <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                      <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Layers size={15} /> Fabric Challan Information
                      </h5>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', fontSize: '0.78rem' }}>
                        <div><span style={{ color: '#64748b' }}>Challan No:</span> <b style={{ color: '#0f172a' }}>#{raw.challanNo || '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>Party Name:</span> <b style={{ color: '#0f172a' }}>{raw.partyName || '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>Fabric Name:</span> <b style={{ color: '#0f172a' }}>{raw.fabricName || '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>Lot No:</span> <b style={{ color: '#0f172a' }}>{raw.lotNo || '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>Total Meters:</span> <b style={{ color: '#1d4ed8' }}>{raw.totalMtr || raw.totalMeters || 0} m</b></div>
                        <div><span style={{ color: '#64748b' }}>Total Rolls:</span> <b style={{ color: '#0f172a' }}>{raw.totalRolls || raw.tpDetails?.length || 0}</b></div>
                        <div><span style={{ color: '#64748b' }}>Shortage %:</span> <b style={{ color: '#0f172a' }}>{raw.shortagePct !== undefined && raw.shortagePct !== null ? `${raw.shortagePct}%` : '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>Vendor Challan:</span> <b style={{ color: '#0f172a' }}>{raw.vendorChallanNo || '—'}</b></div>
                      </div>
                    </div>
                    {Array.isArray(raw.tpDetails) && raw.tpDetails.length > 0 && (
                      <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                        <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Layers size={15} /> TP Rolls Breakdown ({raw.tpDetails.length} Rolls)
                        </h5>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
                          {raw.tpDetails.map((tp, idx) => (
                            <div key={idx} style={{ padding: '0.4rem', background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.72rem' }}>
                              <span style={{ fontWeight: 800, color: '#1e40af' }}>TP #{tp.tpNo}</span>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{tp.tpMeter || tp.freshMtr || 0} Mtr</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* 5. Stitching Challan Details */}
                {inspectEntry.module === 'StitchingChallan' && (
                  <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                    <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Scissors size={15} /> Stitching Challan Details
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', fontSize: '0.78rem' }}>
                      <div><span style={{ color: '#64748b' }}>Challan No:</span> <b style={{ color: '#0f172a' }}>#{raw.challanNo || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Job No:</span> <b style={{ color: '#0f172a' }}>{raw.jobNo || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Worker Name:</span> <b style={{ color: '#0f172a' }}>{raw.workerName || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Party Name:</span> <b style={{ color: '#0f172a' }}>{raw.partyName || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Total Pieces:</span> <b style={{ color: '#1d4ed8', fontSize: '0.9rem' }}>{raw.totalPieces || raw.pieces || 0} Pcs</b></div>
                      <div><span style={{ color: '#64748b' }}>Status:</span> <b style={{ color: '#1d4ed8' }}>{raw.status || 'Active'}</b></div>
                    </div>
                  </div>
                )}

                {/* 6. Inventory Details */}
                {inspectEntry.module === 'Inventory' && (
                  <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                    <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Package size={15} /> Inventory Stock Details
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', fontSize: '0.78rem' }}>
                      <div><span style={{ color: '#64748b' }}>Product Name:</span> <b style={{ color: '#0f172a' }}>{raw.productName || raw.itemName || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Category:</span> <b style={{ color: '#0f172a' }}>{raw.category || raw.type || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Quantity:</span> <b style={{ color: '#1d4ed8', fontSize: '0.9rem' }}>{raw.quantity || 0} {raw.unit || 'Units'}</b></div>
                      <div><span style={{ color: '#64748b' }}>SKU:</span> <b style={{ color: '#0f172a' }}>{raw.sku || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Vendor:</span> <b style={{ color: '#0f172a' }}>{raw.vendorName || raw.supplier || '—'}</b></div>
                    </div>
                  </div>
                )}

                {/* 7. Project & Task Details */}
                {inspectEntry.module === 'Task' && (
                  <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                    <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Briefcase size={15} /> Project & Task Details
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', fontSize: '0.78rem' }}>
                      <div><span style={{ color: '#64748b' }}>Project Ref:</span> <b style={{ color: '#0f172a' }}>{raw.projectRef || 'General'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Task Title:</span> <b style={{ color: '#0f172a' }}>{raw.title || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Department:</span> <b style={{ color: '#0f172a' }}>{raw.department || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Priority:</span> <b style={{ color: raw.priority === 'urgent' || raw.priority === 'high' ? '#dc2626' : '#1e40af', textTransform: 'uppercase' }}>{raw.priority || 'medium'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Status:</span> <b style={{ color: '#1d4ed8' }}>{raw.status || 'To Do'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Estimated:</span> <b style={{ color: '#0f172a' }}>{raw.estimatedHours ? `${raw.estimatedHours} hrs` : '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Client:</span> <b style={{ color: '#0f172a' }}>{raw.clientName || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Due Date:</span> <b style={{ color: '#0f172a' }}>{raw.dueDate ? new Date(raw.dueDate).toLocaleDateString('en-IN') : '—'}</b></div>
                    </div>
                    {raw.description && (
                      <div style={{ marginTop: '0.6rem', padding: '0.5rem 0.7rem', background: '#ffffff', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '0.75rem', color: '#334155' }}>
                        <b>Description:</b> {raw.description}
                      </div>
                    )}
                  </div>
                )}

                {/* 8. Fabric Transaction Details */}
                {inspectEntry.module === 'FabricTransaction' && (
                  <>
                    <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                      <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Truck size={15} /> Fabric Ledger & Transaction Info
                      </h5>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', fontSize: '0.78rem' }}>
                        <div><span style={{ color: '#64748b' }}>Transaction Type:</span> <b style={{ color: '#1d4ed8' }}>{raw.type}</b></div>
                        <div><span style={{ color: '#64748b' }}>Lot No:</span> <b style={{ color: '#0f172a' }}>#{raw.lotNo || '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>Fabric Quality:</span> <b style={{ color: '#0f172a' }}>{raw.fabricQuality || '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>Quantity:</span> <b style={{ color: '#1d4ed8', fontSize: '0.9rem' }}>{raw.qty || 0} Mtr</b></div>
                        <div><span style={{ color: '#64748b' }}>Party / Vendor:</span> <b style={{ color: '#0f172a' }}>{raw.partyName || raw.vendorName || '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>Panna:</span> <b style={{ color: '#0f172a' }}>{raw.panna || '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>Challan No:</span> <b style={{ color: '#0f172a' }}>{raw.challanNo || '—'}</b></div>
                        <div><span style={{ color: '#64748b' }}>Total Rolls:</span> <b style={{ color: '#0f172a' }}>{raw.totalTp || raw.tpDetails?.length || 0}</b></div>
                      </div>
                      {raw.notes && (
                        <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', background: '#ffffff', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '0.74rem' }}>
                          <b>Notes:</b> {raw.notes}
                        </div>
                      )}
                    </div>
                    {Array.isArray(raw.tpDetails) && raw.tpDetails.length > 0 && (
                      <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                        <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Layers size={15} /> TP Rolls Breakdown ({raw.tpDetails.length} Rolls)
                        </h5>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
                          {raw.tpDetails.map((tp, idx) => (
                            <div key={idx} style={{ padding: '0.4rem', background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.72rem' }}>
                              <span style={{ fontWeight: 800, color: '#1e40af' }}>TP #{tp.tpNo}</span>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{tp.tpMeter || 0} Mtr</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* 9. Catalog Design Details */}
                {inspectEntry.module === 'Design' && (
                  <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                    <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Tag size={15} /> Catalog Design Specifications
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', fontSize: '0.78rem' }}>
                      <div><span style={{ color: '#64748b' }}>Design Name:</span> <b style={{ color: '#0f172a' }}>{raw.designName || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Designer:</span> <b style={{ color: '#0f172a' }}>{raw.designerName || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Fabric Name:</span> <b style={{ color: '#0f172a' }}>{raw.fabricName || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Category:</span> <b style={{ color: '#0f172a' }}>{raw.category || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Colors:</span> <b style={{ color: '#0f172a' }}>{raw.colors || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Panna:</span> <b style={{ color: '#0f172a' }}>{raw.panna || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Status:</span> <b style={{ color: '#1d4ed8' }}>{raw.status || 'Active'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Parties:</span> <b style={{ color: '#0f172a' }}>{Array.isArray(raw.parties) ? raw.parties.join(', ') : '—'}</b></div>
                    </div>
                  </div>
                )}

                {/* 10. Sale Order Details */}
                {inspectEntry.module === 'SaleOrder' && (
                  <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                    <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Package size={15} /> Sale Order Details
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', fontSize: '0.78rem' }}>
                      <div><span style={{ color: '#64748b' }}>Order Code:</span> <b style={{ color: '#0f172a' }}>{raw.displayOrderCode || raw.saleOrderItemCode || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Customer:</span> <b style={{ color: '#0f172a' }}>{raw.shippingAddressName || raw.billingAddressName || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>SKU Code:</span> <b style={{ color: '#0f172a' }}>{raw.itemSKUCode || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Item Name:</span> <b style={{ color: '#0f172a' }}>{raw.itemTypeName || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Total Price:</span> <b style={{ color: '#1d4ed8', fontSize: '0.9rem' }}>₹{raw.totalPrice || 0}</b></div>
                      <div><span style={{ color: '#64748b' }}>Status:</span> <b style={{ color: '#1d4ed8' }}>{raw.saleOrderItemStatus || raw.saleOrderStatus || 'Pending'}</b></div>
                      <div><span style={{ color: '#64748b' }}>City:</span> <b style={{ color: '#0f172a' }}>{raw.shippingAddressCity || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>State:</span> <b style={{ color: '#0f172a' }}>{raw.shippingAddressState || '—'}</b></div>
                    </div>
                  </div>
                )}

                {/* 11. Quality Complaint Details */}
                {inspectEntry.module === 'Complaint' && (
                  <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                    <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AlertCircle size={15} color="#dc2626" /> Quality Complaint & Defect Log
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', fontSize: '0.78rem' }}>
                      <div><span style={{ color: '#64748b' }}>Complaint #:</span> <b style={{ color: '#0f172a' }}>{raw.complaintNo}</b></div>
                      <div><span style={{ color: '#64748b' }}>Party Name:</span> <b style={{ color: '#0f172a' }}>{raw.partyName}</b></div>
                      <div><span style={{ color: '#64748b' }}>Category:</span> <b style={{ color: '#0f172a' }}>{raw.category || 'Printing Defect'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Sub-Category:</span> <b style={{ color: '#0f172a' }}>{raw.subCategory || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Priority:</span> <b style={{ color: raw.priority === 'Urgent' ? '#dc2626' : '#1e40af' }}>{raw.priority || 'Medium'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Status:</span> <b style={{ color: '#1d4ed8' }}>{raw.status || 'Open'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Defective Mtr:</span> <b style={{ color: '#dc2626' }}>{raw.defectiveMeters || 0} m</b></div>
                      <div><span style={{ color: '#64748b' }}>Expected Amount:</span> <b style={{ color: '#1d4ed8' }}>₹{raw.expectedAmount || 0}</b></div>
                      <div><span style={{ color: '#64748b' }}>Job Card #:</span> <b style={{ color: '#0f172a' }}>{raw.jobCardNo || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Invoice #:</span> <b style={{ color: '#0f172a' }}>{raw.invoiceNo || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Responsible:</span> <b style={{ color: '#0f172a' }}>{raw.responsiblePerson || (Array.isArray(raw.responsiblePersons) ? raw.responsiblePersons.join(', ') : '—')}</b></div>
                      <div><span style={{ color: '#64748b' }}>Assigned To:</span> <b style={{ color: '#0f172a' }}>{raw.assignedTo || '—'}</b></div>
                    </div>
                    {raw.description && (
                      <div style={{ marginTop: '0.6rem', padding: '0.5rem 0.7rem', background: '#ffffff', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '0.75rem', color: '#334155' }}>
                        <b>Description:</b> {raw.description}
                      </div>
                    )}
                    {raw.actionTaken && (
                      <div style={{ marginTop: '0.4rem', padding: '0.5rem 0.7rem', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '0.75rem', color: '#166534' }}>
                        <b>Action Taken:</b> {raw.actionTaken}
                      </div>
                    )}
                  </div>
                )}

                {/* 12. Raw Material Transaction Details */}
                {inspectEntry.module === 'RawMaterialTransaction' && (
                  <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                    <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Package size={15} /> Raw Material Transaction Details
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', fontSize: '0.78rem' }}>
                      <div><span style={{ color: '#64748b' }}>Movement:</span> <b style={{ color: '#1d4ed8' }}>{raw.type}</b></div>
                      <div><span style={{ color: '#64748b' }}>Material Name:</span> <b style={{ color: '#0f172a' }}>{raw.materialName}</b></div>
                      <div><span style={{ color: '#64748b' }}>Quantity:</span> <b style={{ color: '#1d4ed8', fontSize: '0.9rem' }}>{raw.qty} {raw.unit || 'Rolls'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Party / Vendor:</span> <b style={{ color: '#0f172a' }}>{raw.vendorName || raw.issuedTo || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Challan No:</span> <b style={{ color: '#0f172a' }}>{raw.challanNo || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Job No:</span> <b style={{ color: '#0f172a' }}>{raw.jobNo || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Received By:</span> <b style={{ color: '#0f172a' }}>{raw.receivedBy || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Purpose:</span> <b style={{ color: '#0f172a' }}>{raw.purpose || '—'}</b></div>
                    </div>
                    {raw.remarks && (
                      <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', background: '#ffffff', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '0.74rem' }}>
                        <b>Remarks:</b> {raw.remarks}
                      </div>
                    )}
                  </div>
                )}

                {/* 13. Billing Purchase Details */}
                {inspectEntry.module === 'BillingPurchase' && (
                  <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                    <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <CreditCard size={15} /> Purchase Bill Details
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', fontSize: '0.78rem' }}>
                      <div><span style={{ color: '#64748b' }}>PO Number:</span> <b style={{ color: '#0f172a' }}>{raw.purchaseNo}</b></div>
                      <div><span style={{ color: '#64748b' }}>Vendor:</span> <b style={{ color: '#0f172a' }}>{raw.vendorName}</b></div>
                      <div><span style={{ color: '#64748b' }}>Taxable Amount:</span> <b style={{ color: '#0f172a' }}>₹{(raw.taxableAmount || 0).toLocaleString('en-IN')}</b></div>
                      <div><span style={{ color: '#64748b' }}>GST Rate / Amount:</span> <b style={{ color: '#0f172a' }}>{raw.gstRate || 0}% (₹{(raw.gstAmount || 0).toLocaleString('en-IN')})</b></div>
                      <div><span style={{ color: '#64748b' }}>Total Bill:</span> <b style={{ color: '#1d4ed8', fontSize: '0.9rem' }}>₹{(raw.totalAmount || 0).toLocaleString('en-IN')}</b></div>
                      <div><span style={{ color: '#64748b' }}>Date:</span> <b style={{ color: '#0f172a' }}>{raw.date ? new Date(raw.date).toLocaleDateString('en-IN') : '—'}</b></div>
                    </div>
                  </div>
                )}

                {/* 14. Stock Out Dispatch Details */}
                {inspectEntry.module === 'StockOut' && (
                  <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                    <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Package size={15} /> Warehouse Stock Outward Dispatch
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', fontSize: '0.78rem' }}>
                      <div><span style={{ color: '#64748b' }}>SKU Code:</span> <b style={{ color: '#0f172a' }}>{raw.skuCode}</b></div>
                      <div><span style={{ color: '#64748b' }}>Party / Outward:</span> <b style={{ color: '#0f172a' }}>{raw.party}</b></div>
                      <div><span style={{ color: '#64748b' }}>Quantity Out:</span> <b style={{ color: '#1d4ed8', fontSize: '0.9rem' }}>{raw.qtyOut || 1} Units</b></div>
                      <div><span style={{ color: '#64748b' }}>Warehouse Facility:</span> <b style={{ color: '#0f172a' }}>{raw.facility || 'Warehouse'}</b></div>
                    </div>
                  </div>
                )}

                {/* 15. Designer Task Details */}
                {inspectEntry.module === 'DesignerTask' && (
                  <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                    <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Tag size={15} /> Designer Task & Pre-Press Assignment
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', fontSize: '0.78rem' }}>
                      <div><span style={{ color: '#64748b' }}>Task #:</span> <b style={{ color: '#0f172a' }}>{raw.taskNo}</b></div>
                      <div><span style={{ color: '#64748b' }}>Design Name:</span> <b style={{ color: '#0f172a' }}>{raw.designName}</b></div>
                      <div><span style={{ color: '#64748b' }}>Designer:</span> <b style={{ color: '#1d4ed8' }}>{raw.designerName || 'Unassigned'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Client:</span> <b style={{ color: '#0f172a' }}>{raw.clientName || 'In-House'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Category:</span> <b style={{ color: '#0f172a' }}>{raw.category || 'General'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Priority:</span> <b style={{ color: '#0f172a' }}>{raw.priority || 'Normal'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Status:</span> <b style={{ color: '#1d4ed8' }}>{raw.status || 'Pending'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Date:</span> <b style={{ color: '#0f172a' }}>{raw.date || '—'}</b></div>
                    </div>
                    {raw.outputLink && (
                      <div style={{ marginTop: '0.6rem', fontSize: '0.75rem' }}>
                        <span style={{ color: '#64748b' }}>Output Link: </span>
                        <a href={raw.outputLink} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 700 }}>{raw.outputLink}</a>
                      </div>
                    )}
                    {raw.notes && (
                      <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', background: '#ffffff', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '0.74rem' }}>
                        <b>Notes:</b> {raw.notes}
                      </div>
                    )}
                  </div>
                )}

                {/* 16. Printing Machine Log Details */}
                {inspectEntry.module === 'JobPrintLog' && (
                  <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                    <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Printer size={15} /> Printing Machine Production Log
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', fontSize: '0.78rem' }}>
                      <div><span style={{ color: '#64748b' }}>Job No:</span> <b style={{ color: '#0f172a' }}>{raw.jobNo}</b></div>
                      <div><span style={{ color: '#64748b' }}>Machine:</span> <b style={{ color: '#1d4ed8' }}>{raw.machineName}</b></div>
                      <div><span style={{ color: '#64748b' }}>Printed Meters:</span> <b style={{ color: '#1d4ed8', fontSize: '0.9rem' }}>{raw.meters} Mtr</b></div>
                      <div><span style={{ color: '#64748b' }}>Pass:</span> <b style={{ color: '#0f172a' }}>{raw.pass || '4 Pass'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Operator:</span> <b style={{ color: '#0f172a' }}>{raw.operatorName || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Shift:</span> <b style={{ color: '#0f172a' }}>{raw.shift || 'General'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Date:</span> <b style={{ color: '#0f172a' }}>{raw.date ? new Date(raw.date).toLocaleDateString('en-IN') : '—'}</b></div>
                    </div>
                    {raw.notes && (
                      <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', background: '#ffffff', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '0.74rem' }}>
                        <b>Notes:</b> {raw.notes}
                      </div>
                    )}
                  </div>
                )}

                {/* 17. Fusing Machine Log Details */}
                {inspectEntry.module === 'JobFusingLog' && (
                  <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                    <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Flame size={15} color="#ea580c" /> Fusing Machine Production Log
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', fontSize: '0.78rem' }}>
                      <div><span style={{ color: '#64748b' }}>Job No:</span> <b style={{ color: '#0f172a' }}>{raw.jobNo}</b></div>
                      <div><span style={{ color: '#64748b' }}>Machine:</span> <b style={{ color: '#ea580c' }}>{raw.fusingMachine || 'Fusing Machine'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Fresh Output:</span> <b style={{ color: '#059669', fontSize: '0.9rem' }}>{raw.freshMtr} Mtr</b></div>
                      <div><span style={{ color: '#64748b' }}>Total Wastage:</span> <b style={{ color: '#dc2626' }}>{raw.totalWastageMtr || 0} Mtr</b></div>
                      <div><span style={{ color: '#64748b' }}>Temp / Speed:</span> <b style={{ color: '#0f172a' }}>{raw.fusingTemp || '210°C'} / {raw.fusingSpeed || '80'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Operator:</span> <b style={{ color: '#0f172a' }}>{raw.operatorName || '—'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Shift:</span> <b style={{ color: '#0f172a' }}>{raw.shift || 'General'}</b></div>
                      <div><span style={{ color: '#64748b' }}>Date:</span> <b style={{ color: '#0f172a' }}>{raw.date ? new Date(raw.date).toLocaleDateString('en-IN') : '—'}</b></div>
                    </div>
                    {raw.notes && (
                      <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', background: '#ffffff', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '0.74rem' }}>
                        <b>Notes:</b> {raw.notes}
                      </div>
                    )}
                  </div>
                )}

                {/* Universal Audit & Change History for Any Module (e.g. Task, JobCard, etc.) */}
                {Array.isArray(inspectEntry.auditTrail) && inspectEntry.auditTrail.length > 0 && inspectEntry.module !== 'JobCard' && (
                  <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem' }}>
                    <h5 style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Clock size={15} /> Revision & Audit Log ({inspectEntry.auditTrail.length} Edits)
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
                      {inspectEntry.auditTrail.slice().reverse().map((at, idx) => (
                        <div key={idx} style={{ padding: '0.4rem 0.6rem', background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.73rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#1e40af' }}>
                            <span>{at.performedByName || at.performedBy || 'Staff'} ({at.action || 'UPDATE'})</span>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>{at.timestamp ? new Date(at.timestamp).toLocaleString('en-IN') : ''}</span>
                          </div>
                          {at.details && <div style={{ color: '#334155', marginTop: '2px' }}>{at.details}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible Raw Technical JSON Toggle */}
              <div style={{ marginTop: '1.2rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowRawJson(!showRawJson)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: 0
                  }}
                >
                  {showRawJson ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  {showRawJson ? 'Hide Technical Document Data' : 'View Advanced Technical Document Data'}
                </button>

                {showRawJson && (
                  <pre style={{
                    background: '#f8fafc',
                    border: '1.5px solid #bfdbfe',
                    borderRadius: '8px',
                    padding: '0.9rem',
                    fontSize: '0.72rem',
                    maxHeight: '260px',
                    overflow: 'auto',
                    margin: '0.6rem 0 0',
                    color: '#0f172a',
                    fontFamily: 'monospace'
                  }}>
                    {JSON.stringify(raw, null, 2)}
                  </pre>
                )}
              </div>

              {/* Footer Close Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
                <button
                  type="button"
                  onClick={() => { setInspectEntry(null); setShowRawJson(false); }}
                  style={{
                    padding: '0.5rem 1.4rem',
                    borderRadius: '7px',
                    border: '1px solid #2563eb',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(37,99,235,0.2)'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

