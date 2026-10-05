import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import { triggerPushNotification } from './NotificationToast';
import {
  ShieldAlert,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  RotateCw,
  Eye,
  Filter,
  Check,
  X,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  User,
  Layers,
  ArrowRight,
  Sliders,
  ShieldCheck,
  FileText
} from 'lucide-react';

export default function AdminChangeApprovalQueue({ onCountChange }) {
  const socket = useSocket();
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('PENDING'); // 'PENDING', 'APPROVED', 'REJECTED', 'ALL'
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState([]);
  const [processingId, setProcessingId] = useState(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Expanded cards for full diff view
  const [expandedIds, setExpandedIds] = useState({});

  // Reject modal state
  const [rejectModalItem, setRejectModalItem] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [bulkRejectModalOpen, setBulkRejectModalOpen] = useState(false);
  const [bulkRejectionReason, setBulkRejectionReason] = useState('');

  // Approval master toggle state
  const [approvalSettings, setApprovalSettingsState] = useState({ enabled: true });
  const [updatingSettings, setUpdatingSettings] = useState(false);

  // Fetch summary stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.getChangeApprovalStats();
      if (res && res.data) {
        setStats(res.data);
        if (typeof onCountChange === 'function') {
          onCountChange(res.data.pending || 0);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch approval stats:', err);
    }
  }, [onCountChange]);

  // Fetch approval requests
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getChangeApprovals({
        status: statusFilter,
        module: moduleFilter,
        search,
        page,
        limit: 30,
      });

      if (res && res.data) {
        setRequests(res.data || []);
        if (res.meta) {
          setPagination({
            total: res.meta.total || 0,
            totalPages: res.meta.totalPages || 1,
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch change approvals:', err);
      triggerPushNotification('Error', err.message || 'Failed to load approvals', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, moduleFilter, search, page]);

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.getChangeApprovalSettings();
      if (res && res.data) {
        setApprovalSettingsState(res.data);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchStats();
    fetchRequests();
    fetchSettings();
  }, [fetchStats, fetchRequests, fetchSettings]);

  // Socket listener for real-time live updates
  useEffect(() => {
    if (!socket) return;

    const handleNewRequest = (item) => {
      triggerPushNotification(
        'New Change For Approval',
        `${item.requestedBy?.name || 'A user'} submitted an edit on ${item.module} (${item.targetIdentifier})`,
        'info'
      );
      fetchStats();
      fetchRequests();
    };

    const handleStatusChanged = () => {
      fetchStats();
      fetchRequests();
    };

    socket.on('new-approval-request', handleNewRequest);
    socket.on('approval-status-changed', handleStatusChanged);

    return () => {
      socket.off('new-approval-request', handleNewRequest);
      socket.off('approval-status-changed', handleStatusChanged);
    };
  }, [socket, fetchStats, fetchRequests]);

  // Toggle card expansion
  const toggleExpand = (id) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Select / Deselect single
  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Select All on current page
  const handleSelectAll = () => {
    const pendingOnPage = requests.filter(r => r.status === 'PENDING').map(r => r._id);
    if (selectedIds.length === pendingOnPage.length && pendingOnPage.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingOnPage);
    }
  };

  // Single Approve
  const handleApprove = async (item) => {
    if (!window.confirm(`Approve and immediately apply changes to ${item.module} (${item.targetIdentifier})?`)) {
      return;
    }

    setProcessingId(item._id);
    try {
      await api.approveChangeRequest(item._id, 'Approved via Admin Panel');
      triggerPushNotification('Approved', `Changes applied to ${item.targetIdentifier}`, 'success');
      fetchStats();
      fetchRequests();
    } catch (err) {
      console.error('Approve failed:', err);
      triggerPushNotification('Approve Failed', err.message || 'Error executing changes', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // Single Reject
  const handleOpenRejectModal = (item) => {
    setRejectModalItem(item);
    setRejectionReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectModalItem) return;

    setProcessingId(rejectModalItem._id);
    try {
      await api.rejectChangeRequest(rejectModalItem._id, rejectionReason.trim() || 'Rejected by Admin');
      triggerPushNotification('Rejected', `Change request for ${rejectModalItem.targetIdentifier} was rejected.`, 'info');
      setRejectModalItem(null);
      setRejectionReason('');
      fetchStats();
      fetchRequests();
    } catch (err) {
      console.error('Reject failed:', err);
      triggerPushNotification('Reject Failed', err.message || 'Error rejecting request', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // Bulk Approve
  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to approve all ${selectedIds.length} selected change requests?`)) {
      return;
    }

    setBulkProcessing(true);
    try {
      const res = await api.bulkApproveChangeRequests(selectedIds, 'Bulk approved via Admin Panel');
      triggerPushNotification('Bulk Approved', res.message || `Processed ${selectedIds.length} approvals`, 'success');
      setSelectedIds([]);
      fetchStats();
      fetchRequests();
    } catch (err) {
      console.error('Bulk approve failed:', err);
      triggerPushNotification('Bulk Approve Failed', err.message || 'Error in bulk approve', 'error');
    } finally {
      setBulkProcessing(false);
    }
  };

  // Bulk Reject
  const handleConfirmBulkReject = async () => {
    if (selectedIds.length === 0) return;

    setBulkProcessing(true);
    try {
      await api.bulkRejectChangeRequests(selectedIds, bulkRejectionReason.trim() || 'Bulk rejected by Admin');
      triggerPushNotification('Bulk Rejected', `Marked ${selectedIds.length} requests as rejected.`, 'info');
      setBulkRejectModalOpen(false);
      setBulkRejectionReason('');
      setSelectedIds([]);
      fetchStats();
      fetchRequests();
    } catch (err) {
      console.error('Bulk reject failed:', err);
      triggerPushNotification('Bulk Reject Failed', err.message || 'Error in bulk reject', 'error');
    } finally {
      setBulkProcessing(false);
    }
  };

  // Master Toggle: Enable / Disable Approvals
  const handleToggleMasterApproval = async () => {
    const nextState = !approvalSettings.enabled;
    const msg = nextState
      ? 'Enable Admin Approval requirement? All non-admin user edits will be held for your review.'
      : 'Disable Admin Approval requirement? User edits will apply directly without your review.';

    if (!window.confirm(msg)) return;

    setUpdatingSettings(true);
    try {
      const res = await api.updateChangeApprovalSettings({ enabled: nextState });
      if (res && res.data) {
        setApprovalSettingsState(res.data);
      }
      triggerPushNotification(
        'Settings Updated',
        `Admin approval requirement is now ${nextState ? 'ACTIVE' : 'BYPASSED'}.`,
        'success'
      );
    } catch (err) {
      triggerPushNotification('Failed', err.message || 'Failed to update settings', 'error');
    } finally {
      setUpdatingSettings(false);
    }
  };

  const moduleOptions = [
    'ALL',
    'JobCard',
    'GarmentJobCard',
    'BillingInvoice',
    'BillingCustomer',
    'BillingItem',
    'BillingPurchase',
    'Expense',
    'FabricChallan',
    'Fabric',
    'Inventory',
    'RawMaterial',
    'Product',
    'Design',
    'Stitching',
    'Complaint',
    'Vendor',
    'Party',
    'Client'
  ];

  const formatValue = (val) => {
    if (val === null || val === undefined) return '<empty>';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val);
      } catch (e) {
        return String(val);
      }
    }
    return String(val);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', fontFamily: 'inherit' }}>
      {/* Top Banner & Master Toggle */}
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
            <ShieldAlert size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
              System Review & Approval Queue
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              Review, approve, or reject record modifications submitted by staff users across all modules.
            </p>
          </div>
        </div>

        {/* Master Approval Toggle Switch */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.8rem',
          background: '#eff6ff',
          border: '1.5px solid #bfdbfe',
          padding: '0.5rem 0.9rem',
          borderRadius: '10px'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>
              Approval Enforcement
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: approvalSettings.enabled ? '#1d4ed8' : '#64748b' }}>
              {approvalSettings.enabled ? 'ACTIVE (User edits held for review)' : 'BYPASSED (Direct edits allowed)'}
            </div>
          </div>
          <button
            type="button"
            disabled={updatingSettings}
            onClick={handleToggleMasterApproval}
            style={{
              padding: '0.35rem 0.8rem',
              borderRadius: '6px',
              border: approvalSettings.enabled ? '1px solid #2563eb' : '1px solid #cbd5e1',
              background: approvalSettings.enabled ? '#2563eb' : '#ffffff',
              color: approvalSettings.enabled ? '#ffffff' : '#64748b',
              fontWeight: 800,
              fontSize: '0.75rem',
              cursor: 'pointer',
              boxShadow: approvalSettings.enabled ? '0 1px 3px rgba(37,99,235,0.2)' : 'none'
            }}
          >
            {updatingSettings ? 'Saving...' : approvalSettings.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      {/* KPI Stats Cards (Pure White & Blue) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
        {/* Pending */}
        <div
          onClick={() => { setStatusFilter('PENDING'); setPage(1); }}
          style={{
            background: statusFilter === 'PENDING' ? '#eff6ff' : '#ffffff',
            border: statusFilter === 'PENDING' ? '2px solid #2563eb' : '1.5px solid #bfdbfe',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(37,99,235,0.06)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>
              Pending Review
            </span>
            <Clock size={18} color="#2563eb" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1d4ed8', marginTop: '0.3rem' }}>
            {stats.pending || 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
            Awaiting Admin authorization
          </div>
        </div>

        {/* Approved */}
        <div
          onClick={() => { setStatusFilter('APPROVED'); setPage(1); }}
          style={{
            background: statusFilter === 'APPROVED' ? '#eff6ff' : '#ffffff',
            border: statusFilter === 'APPROVED' ? '2px solid #2563eb' : '1.5px solid #bfdbfe',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(37,99,235,0.06)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>
              Approved & Applied
            </span>
            <CheckCircle size={18} color="#2563eb" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', marginTop: '0.3rem' }}>
            {stats.approved || 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
            Applied into production
          </div>
        </div>

        {/* Rejected */}
        <div
          onClick={() => { setStatusFilter('REJECTED'); setPage(1); }}
          style={{
            background: statusFilter === 'REJECTED' ? '#eff6ff' : '#ffffff',
            border: statusFilter === 'REJECTED' ? '2px solid #2563eb' : '1.5px solid #bfdbfe',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(37,99,235,0.06)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>
              Rejected
            </span>
            <XCircle size={18} color="#2563eb" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', marginTop: '0.3rem' }}>
            {stats.rejected || 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
            Discarded change requests
          </div>
        </div>

        {/* Total */}
        <div
          onClick={() => { setStatusFilter('ALL'); setPage(1); }}
          style={{
            background: statusFilter === 'ALL' ? '#eff6ff' : '#ffffff',
            border: statusFilter === 'ALL' ? '2px solid #2563eb' : '1.5px solid #bfdbfe',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(37,99,235,0.06)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>
              Total Requests
            </span>
            <FileText size={18} color="#2563eb" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', marginTop: '0.3rem' }}>
            {stats.total || 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
            All submission history
          </div>
        </div>
      </div>

      {/* Control Bar: Filters, Search & Bulk Actions */}
      <div style={{
        background: '#ffffff',
        border: '1.5px solid #bfdbfe',
        borderRadius: '12px',
        padding: '0.9rem 1.2rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        boxShadow: '0 2px 10px rgba(37,99,235,0.04)'
      }}>
        {/* Left: Status Filter Pills */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { key: 'PENDING', label: `Pending (${stats.pending || 0})` },
            { key: 'APPROVED', label: 'Approved' },
            { key: 'REJECTED', label: 'Rejected' },
            { key: 'ALL', label: 'All' },
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setStatusFilter(tab.key); setPage(1); }}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '7px',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                border: statusFilter === tab.key ? '1.5px solid #2563eb' : '1px solid #bfdbfe',
                background: statusFilter === tab.key ? '#2563eb' : '#ffffff',
                color: statusFilter === tab.key ? '#ffffff' : '#1e40af',
                boxShadow: statusFilter === tab.key ? '0 1px 4px rgba(37,99,235,0.2)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Middle: Module Dropdown & Search */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', flex: '1 1 auto', maxWidth: '520px' }}>
          {/* Module filter */}
          <select
            value={moduleFilter}
            onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }}
            style={{
              padding: '0.45rem 0.65rem',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 700,
              background: '#ffffff',
              border: '1.5px solid #bfdbfe',
              color: '#0f172a'
            }}
          >
            {moduleOptions.map(m => (
              <option key={m} value={m}>
                {m === 'ALL' ? 'All Modules' : m}
              </option>
            ))}
          </select>

          {/* Search box */}
          <div style={{ position: 'relative', flex: '1 1 auto', minWidth: '180px' }}>
            <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by ID, job #, user name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem 0.45rem 2rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                background: '#ffffff',
                border: '1.5px solid #bfdbfe',
                color: '#0f172a'
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => { fetchStats(); fetchRequests(); }}
            title="Refresh List"
            style={{
              padding: '0.45rem 0.65rem',
              borderRadius: '6px',
              border: '1.5px solid #bfdbfe',
              background: '#ffffff',
              color: '#1d4ed8',
              cursor: 'pointer'
            }}
          >
            <RotateCw size={15} />
          </button>
        </div>

        {/* Right: Bulk Operations (Only when in PENDING view) */}
        {statusFilter === 'PENDING' && (
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleSelectAll}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: '1px solid #bfdbfe',
                background: '#ffffff',
                color: '#1e40af',
                cursor: 'pointer'
              }}
            >
              {selectedIds.length > 0 && selectedIds.length === requests.filter(r => r.status === 'PENDING').length
                ? 'Deselect All'
                : 'Select All'}
            </button>

            {selectedIds.length > 0 && (
              <>
                <button
                  type="button"
                  disabled={bulkProcessing}
                  onClick={handleBulkApprove}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    border: '1px solid #1d4ed8',
                    background: '#2563eb',
                    color: '#ffffff',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(37,99,235,0.2)'
                  }}
                >
                  ✓ Approve ({selectedIds.length})
                </button>
                <button
                  type="button"
                  disabled={bulkProcessing}
                  onClick={() => { setBulkRejectModalOpen(true); setBulkRejectionReason(''); }}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    border: '1px solid #bfdbfe',
                    background: '#ffffff',
                    color: '#1e40af',
                    cursor: 'pointer'
                  }}
                >
                  ✕ Reject ({selectedIds.length})
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Main Request Cards List */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', background: '#ffffff', border: '1.5px solid #bfdbfe', borderRadius: '12px' }}>
          <RotateCw size={28} color="#2563eb" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.75rem' }} />
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e40af' }}>Loading change requests...</div>
        </div>
      ) : requests.length === 0 ? (
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          background: '#ffffff',
          border: '1.5px solid #bfdbfe',
          borderRadius: '12px',
          boxShadow: '0 2px 10px rgba(37,99,235,0.04)'
        }}>
          <ShieldCheck size={42} color="#2563eb" style={{ margin: '0 auto 0.75rem' }} />
          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
            No {statusFilter === 'ALL' ? '' : statusFilter.toLowerCase()} requests found
          </h4>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
            {statusFilter === 'PENDING'
              ? 'All clear! There are no pending changes awaiting Admin authorization.'
              : 'Try changing your search term or filters.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {requests.map(item => {
            const isSelected = selectedIds.includes(item._id);
            const isExpanded = !!expandedIds[item._id];
            const diffs = Array.isArray(item.diffSummary) && item.diffSummary.length > 0
              ? item.diffSummary
              : [];

            return (
              <div
                key={item._id}
                style={{
                  background: isSelected ? '#eff6ff' : '#ffffff',
                  border: isSelected ? '2px solid #2563eb' : '1.5px solid #bfdbfe',
                  borderRadius: '12px',
                  padding: '1.1rem 1.3rem',
                  boxShadow: '0 2px 8px rgba(37,99,235,0.05)',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: '1 1 auto', minWidth: '240px' }}>
                    {item.status === 'PENDING' && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item._id)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2563eb' }}
                      />
                    )}

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {/* Module Badge */}
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe'
                        }}>
                          {item.module}
                        </span>

                        {/* Action Badge */}
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          background: item.action === 'DELETE' ? '#eff6ff' : '#eff6ff',
                          color: '#1e40af',
                          border: '1px solid #bfdbfe'
                        }}>
                          {item.action}
                        </span>

                        {/* Status Badge */}
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          background: item.status === 'APPROVED' ? '#eff6ff' : item.status === 'REJECTED' ? '#eff6ff' : '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe'
                        }}>
                          {item.status}
                        </span>

                        {/* Target Identifier */}
                        <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>
                          {item.targetIdentifier || 'Document Record'}
                        </span>
                      </div>

                      {/* Submitter & Timestamp */}
                      <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span>
                          Requested by: <strong style={{ color: '#1e40af' }}>{item.requestedBy?.name || 'Staff User'}</strong> ({item.requestedBy?.role || 'user'})
                        </span>
                        <span>•</span>
                        <span>Dept: <strong style={{ color: '#0f172a' }}>{item.requestedBy?.department || 'General'}</strong></span>
                        <span>•</span>
                        <span>Submitted: {new Date(item.createdAt).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions (Approve / Reject) */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {item.status === 'PENDING' ? (
                      <>
                        <button
                          type="button"
                          disabled={processingId === item._id}
                          onClick={() => handleApprove(item)}
                          style={{
                            padding: '0.45rem 1rem',
                            borderRadius: '7px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            border: '1px solid #1d4ed8',
                            background: '#2563eb',
                            color: '#ffffff',
                            cursor: 'pointer',
                            boxShadow: '0 1px 3px rgba(37,99,235,0.2)'
                          }}
                        >
                          {processingId === item._id ? 'Applying...' : '✓ Approve & Apply'}
                        </button>

                        <button
                          type="button"
                          disabled={processingId === item._id}
                          onClick={() => handleOpenRejectModal(item)}
                          style={{
                            padding: '0.45rem 0.9rem',
                            borderRadius: '7px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            border: '1px solid #bfdbfe',
                            background: '#ffffff',
                            color: '#1e40af',
                            cursor: 'pointer'
                          }}
                        >
                          ✕ Reject
                        </button>
                      </>
                    ) : (
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', background: '#eff6ff', padding: '4px 10px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                        {item.status === 'APPROVED' ? (
                          <span>✓ Approved by {item.reviewedBy?.name || 'Admin'} on {item.reviewedAt ? new Date(item.reviewedAt).toLocaleDateString('en-IN') : ''}</span>
                        ) : (
                          <span>✕ Rejected: {item.rejectionReason || 'Rejected by Admin'}</span>
                        )}
                      </div>
                    )}

                    {/* Expand/Collapse Diff Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(item._id)}
                      style={{
                        padding: '0.45rem 0.6rem',
                        borderRadius: '6px',
                        border: '1px solid #bfdbfe',
                        background: '#ffffff',
                        color: '#1d4ed8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                    >
                      <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                        {isExpanded ? 'Hide Diff' : 'View Diff'}
                      </span>
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                </div>

                {/* Diff Viewer Section */}
                <div style={{
                  marginTop: '0.85rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid #bfdbfe'
                }}>
                  {item.action === 'DELETE' ? (
                    <div style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      background: '#eff6ff',
                      border: '1.5px solid #bfdbfe',
                      fontSize: '0.8rem',
                      color: '#1e40af',
                      fontWeight: 700
                    }}>
                      ⚠️ User has requested to permanently DELETE this entire record. Approving will delete it from the database.
                    </div>
                  ) : diffs.length > 0 ? (
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e3a8a', marginBottom: '0.45rem', textTransform: 'uppercase' }}>
                        Proposed Field Modifications ({diffs.length} changed):
                      </div>

                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #bfdbfe' }}>
                              <th style={{ padding: '0.45rem 0.75rem', textAlign: 'left', fontWeight: 800, color: '#1e40af', width: '25%' }}>Field Name</th>
                              <th style={{ padding: '0.45rem 0.75rem', textAlign: 'left', fontWeight: 800, color: '#64748b', width: '37%' }}>Before (Current Value)</th>
                              <th style={{ padding: '0.45rem 0.75rem', textAlign: 'left', fontWeight: 800, color: '#1d4ed8', width: '38%' }}>After (Proposed Value)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {diffs.map((d, dIdx) => (
                              <tr key={dIdx} style={{ borderBottom: '1px solid #e2e8f0', background: dIdx % 2 === 0 ? '#ffffff' : '#f8faff' }}>
                                <td style={{ padding: '0.5rem 0.75rem', fontWeight: 800, color: '#0f172a' }}>
                                  {d.field}
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem', color: '#64748b', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.76rem' }}>
                                  <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                    {formatValue(d.before)}
                                  </span>
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem', color: '#1d4ed8', fontWeight: 700, wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.76rem' }}>
                                  <span style={{ background: '#eff6ff', padding: '2px 6px', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                                    {formatValue(d.after)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Payload update contains {Object.keys(item.requestBody || {}).length} fields. Click &quot;View Diff&quot; to inspect full details.
                    </div>
                  )}

                  {/* Expanded Full JSON Data Viewer */}
                  {isExpanded && (
                    <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: '3px' }}>
                          Original Document State (Before):
                        </div>
                        <pre style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '0.75rem',
                          fontSize: '0.7rem',
                          maxHeight: '200px',
                          overflow: 'auto',
                          margin: 0,
                          color: '#334155'
                        }}>
                          {JSON.stringify(item.beforeData, null, 2) || '<No before snapshot>'}
                        </pre>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1d4ed8', marginBottom: '3px' }}>
                          Submitted Payload (Proposed After):
                        </div>
                        <pre style={{
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          borderRadius: '8px',
                          padding: '0.75rem',
                          fontSize: '0.7rem',
                          maxHeight: '200px',
                          overflow: 'auto',
                          margin: 0,
                          color: '#1e40af'
                        }}>
                          {JSON.stringify(item.requestBody, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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

      {/* Reject Reason Modal (Single Item) */}
      {rejectModalItem && (
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
            maxWidth: '480px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)'
          }}>
            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>
              Reject Change Request
            </h4>
            <p style={{ margin: '4px 0 1rem', fontSize: '0.8rem', color: '#64748b' }}>
              Provide an explanation for rejecting changes to {rejectModalItem.module} ({rejectModalItem.targetIdentifier}).
            </p>

            <textarea
              rows={4}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Incorrect quantity entered, please verify with challan..."
              style={{
                width: '100%',
                padding: '0.65rem',
                borderRadius: '8px',
                border: '1.5px solid #bfdbfe',
                fontSize: '0.85rem',
                color: '#0f172a',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.2rem' }}>
              <button
                type="button"
                onClick={() => setRejectModalItem(null)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                style={{
                  padding: '0.5rem 1.2rem',
                  borderRadius: '7px',
                  border: '1px solid #2563eb',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(37,99,235,0.2)'
                }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Reject Modal */}
      {bulkRejectModalOpen && (
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
            maxWidth: '480px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)'
          }}>
            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>
              Bulk Reject {selectedIds.length} Requests
            </h4>
            <p style={{ margin: '4px 0 1rem', fontSize: '0.8rem', color: '#64748b' }}>
              Enter a rejection reason for all selected requests.
            </p>

            <textarea
              rows={4}
              value={bulkRejectionReason}
              onChange={(e) => setBulkRejectionReason(e.target.value)}
              placeholder="e.g. Bulk rejected by administrator..."
              style={{
                width: '100%',
                padding: '0.65rem',
                borderRadius: '8px',
                border: '1.5px solid #bfdbfe',
                fontSize: '0.85rem',
                color: '#0f172a',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.2rem' }}>
              <button
                type="button"
                onClick={() => setBulkRejectModalOpen(false)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkReject}
                style={{
                  padding: '0.5rem 1.2rem',
                  borderRadius: '7px',
                  border: '1px solid #2563eb',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(37,99,235,0.2)'
                }}
              >
                Confirm Bulk Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
