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
  Briefcase
} from 'lucide-react';

export default function AdminUserDataReview() {
  const [entries, setEntries] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState('ALL');
  const [selectedModule, setSelectedModule] = useState('ALL');
  const [datePreset, setDatePreset] = useState('ALL'); // 'TODAY', 'YESTERDAY', 'WEEK', 'MONTH', 'ALL'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // Detail Modal
  const [inspectEntry, setInspectEntry] = useState(null);

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
  }, [selectedUser, selectedModule, startDate, endDate, search, page]);

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

    const headers = ['Date & Time', 'User', 'Module', 'Identifier', 'Party / Entity', 'Amount / Quantity', 'Status', 'Details'];
    const rows = entries.map(e => [
      `"${new Date(e.createdAt).toLocaleString('en-IN')}"`,
      `"${e.createdBy || 'Staff User'}"`,
      `"${e.moduleLabel || e.module}"`,
      `"${e.identifier || ''}"`,
      `"${(e.party || '').replace(/"/g, '""')}"`,
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

  const moduleOptions = [
    { value: 'ALL', label: 'All Modules' },
    { value: 'JobCard', label: 'Job Cards' },
    { value: 'BillingInvoice', label: 'Tax Invoices' },
    { value: 'Expense', label: 'Expenses' },
    { value: 'FabricChallan', label: 'Fabric Challans' },
    { value: 'StitchingChallan', label: 'Stitching Challans' },
    { value: 'Inventory', label: 'Inventory Items' },
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
        {/* Row 1: User & Module Selectors */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* User selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '1 1 200px' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '1 1 200px' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '2 1 260px' }}>
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
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '0.85rem'
      }}>
        <div style={{ background: '#ffffff', border: '1.5px solid #bfdbfe', borderRadius: '10px', padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Total Entries</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1d4ed8', marginTop: '2px' }}>{pagination.total}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1.5px solid #bfdbfe', borderRadius: '10px', padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Filtered By User</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{selectedUser === 'ALL' ? 'All Users' : selectedUser}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1.5px solid #bfdbfe', borderRadius: '10px', padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Module Filter</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{selectedModule === 'ALL' ? 'All Modules' : selectedModule}</div>
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

              {/* Middle: User & Timestamp */}
              <div style={{ textAlign: 'right', minWidth: '170px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                  <User size={13} color="#2563eb" />
                  <span>{item.createdBy || 'Staff User'}</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : 'N/A'}
                </div>
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
      {inspectEntry && (
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
            maxWidth: '680px',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #bfdbfe', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe'
                }}>
                  {inspectEntry.moduleLabel || inspectEntry.module}
                </span>
                <h4 style={{ margin: '4px 0 0', fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
                  {inspectEntry.identifier}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setInspectEntry(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Entry Metadata Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
              <div style={{ background: '#eff6ff', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Created By</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>{inspectEntry.createdBy || 'Staff User'}</div>
              </div>
              <div style={{ background: '#eff6ff', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Date & Time</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>{inspectEntry.createdAt ? new Date(inspectEntry.createdAt).toLocaleString('en-IN') : 'N/A'}</div>
              </div>
              <div style={{ background: '#eff6ff', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Value / Qty</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#1d4ed8' }}>{inspectEntry.amountOrQuantity}</div>
              </div>
              <div style={{ background: '#eff6ff', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Party / Entity</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>{inspectEntry.party || 'N/A'}</div>
              </div>
            </div>

            {/* Complete Document Data JSON Viewer */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                Full Raw Document Record:
              </label>
              <pre style={{
                background: '#f8fafc',
                border: '1.5px solid #bfdbfe',
                borderRadius: '8px',
                padding: '0.9rem',
                fontSize: '0.74rem',
                maxHeight: '340px',
                overflow: 'auto',
                margin: 0,
                color: '#0f172a',
                fontFamily: 'monospace'
              }}>
                {JSON.stringify(inspectEntry.rawDoc || inspectEntry, null, 2)}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
              <button
                type="button"
                onClick={() => setInspectEntry(null)}
                style={{
                  padding: '0.5rem 1.2rem',
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
      )}
    </div>
  );
}
