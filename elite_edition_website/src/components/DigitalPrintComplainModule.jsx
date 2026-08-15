import React, { useState, useEffect } from 'react';
import { api, getBaseUrl } from '../services/api';
import {
  AlertTriangle, PlusCircle, Search, RefreshCw, Edit2, Trash2, X, Save, Image as ImageIcon,
  CheckCircle, ShieldAlert, Download, Filter, Eye, AlertCircle, Clock, CheckCircle2, User, FileText, ArrowRight
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { triggerEliteAlert, triggerEliteConfirm } from './EliteModalDialog';

const CATEGORIES = [
  'Color Matching / Shade Difference',
  'Printing Defect',
  'Fabric Damage',
  'Quantity Shortage',
  'Delivery Delay',
  'Billing Issue',
  'Other'
];

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const STATUSES = ['Pending', 'In Progress', 'Resolved', 'Rejected'];

export default function DigitalPrintComplainModule() {
  const [complaints, setComplaints] = useState([]);
  const [parties, setParties] = useState([]);
  const [analytics, setAnalytics] = useState({
    total: 0, pending: 0, inProgress: 0, resolved: 0, rejected: 0, urgent: 0, totalDefectiveMeters: 0
  });
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // null = create
  const [showViewModal, setShowViewModal] = useState(null);
  const [zoomImg, setZoomImg] = useState(null);

  // Form State
  const [formVal, setFormVal] = useState({
    complaintNo: '',
    date: new Date().toISOString().split('T')[0],
    partyName: '',
    jobCardNo: '',
    designNo: '',
    category: 'Printing Defect',
    priority: 'Medium',
    status: 'Pending',
    defectiveMeters: 0,
    description: '',
    photoUrls: [],
    actionTaken: '',
    assignedTo: ''
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchComplaints();
    fetchAnalytics();
    fetchParties();
  }, [search, statusFilter, priorityFilter, categoryFilter, dateStart, dateEnd]);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const res = await api.getComplaints({
        search,
        status: statusFilter,
        priority: priorityFilter,
        category: categoryFilter,
        dateStart,
        dateEnd,
        limit: 500
      });
      if (res && res.data) {
        setComplaints(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const data = await api.getComplaintAnalytics();
      if (data) setAnalytics(data);
    } catch (e) {
      console.error('Failed to fetch complaint analytics:', e);
    }
  };

  const fetchParties = async () => {
    try {
      const res = await api.getParties({ limit: 1000 });
      if (res && res.data) setParties(res.data);
    } catch (e) {
      console.warn('Failed to fetch parties list:', e);
    }
  };

  const handleOpenNew = async () => {
    setEditingItem(null);
    setFormVal({
      complaintNo: '',
      date: new Date().toISOString().split('T')[0],
      partyName: '',
      jobCardNo: '',
      designNo: '',
      category: 'Printing Defect',
      priority: 'Medium',
      status: 'Pending',
      defectiveMeters: 0,
      description: '',
      photoUrls: [],
      actionTaken: '',
      assignedTo: ''
    });

    try {
      const res = await api.getNextComplaintNumber();
      if (res && res.nextComplaintNo) {
        setFormVal(prev => ({ ...prev, complaintNo: res.nextComplaintNo }));
      }
    } catch (e) {
      console.warn('Failed to fetch next complaint number:', e);
    }
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormVal({
      complaintNo: item.complaintNo || '',
      date: item.date || new Date().toISOString().split('T')[0],
      partyName: item.partyName || '',
      jobCardNo: item.jobCardNo || '',
      designNo: item.designNo || '',
      category: item.category || 'Printing Defect',
      priority: item.priority || 'Medium',
      status: item.status || 'Pending',
      defectiveMeters: item.defectiveMeters || 0,
      description: item.description || '',
      photoUrls: item.photoUrls || [],
      actionTaken: item.actionTaken || '',
      assignedTo: item.assignedTo || ''
    });
    setShowModal(true);
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    const uploadedUrls = [...(formVal.photoUrls || [])];

    for (let file of files) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const options = { maxSizeMB: 1.5, maxWidthOrHeight: 2048, useWebWorker: true };
        const compressedFile = await imageCompression(file, options);
        const res = await api.uploadImage(compressedFile);
        if (res && res.url) {
          uploadedUrls.push(res.url);
        }
      } catch (err) {
        triggerEliteAlert('Upload Error', 'Failed to upload photo: ' + err.message, 'error');
      }
    }

    setFormVal(prev => ({ ...prev, photoUrls: uploadedUrls }));
    setUploading(false);
  };

  const handleRemovePhoto = (idx) => {
    setFormVal(prev => ({
      ...prev,
      photoUrls: prev.photoUrls.filter((_, i) => i !== idx)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formVal.partyName.trim()) {
      triggerEliteAlert('Validation Error', 'Party Name is required.', 'warning');
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        await api.updateComplaint(editingItem._id, formVal);
        triggerEliteAlert('Complaint Updated', `Ticket ${formVal.complaintNo} updated.`, 'success');
      } else {
        await api.createComplaint(formVal);
        triggerEliteAlert('Complaint Logged', `New ticket ${formVal.complaintNo} created.`, 'success');
      }
      setShowModal(false);
      fetchComplaints();
      fetchAnalytics();
    } catch (err) {
      triggerEliteAlert('Save Error', err.message || 'Failed to save complaint.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, no) => {
    const confirmed = await triggerEliteConfirm({
      title: 'Delete Complaint Ticket',
      message: `Are you sure you want to delete complaint ticket "${no}"? This cannot be undone.`,
      confirmText: 'Delete Ticket',
      type: 'danger'
    });
    if (!confirmed) return;

    try {
      await api.deleteComplaint(id);
      fetchComplaints();
      fetchAnalytics();
    } catch (err) {
      triggerEliteAlert('Delete Failed', err.message || 'Failed to delete ticket.', 'error');
    }
  };

  const handleQuickStatusUpdate = async (item, newStatus) => {
    try {
      await api.updateComplaint(item._id, { status: newStatus });
      fetchComplaints();
      fetchAnalytics();
      if (showViewModal && showViewModal._id === item._id) {
        setShowViewModal(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      triggerEliteAlert('Update Failed', err.message || 'Failed to update status.', 'error');
    }
  };

  const handleExportCSV = () => {
    if (!complaints.length) {
      triggerEliteAlert('Export Notice', 'No complaint records to export.', 'warning');
      return;
    }
    const headers = ['Complaint No', 'Date', 'Party Name', 'Job Card No', 'Design No', 'Category', 'Priority', 'Status', 'Defective Meters', 'Description', 'Action Taken'];
    const rows = complaints.map(c => [
      `"${c.complaintNo || ''}"`,
      `"${c.date || ''}"`,
      `"${c.partyName || ''}"`,
      `"${c.jobCardNo || ''}"`,
      `"${c.designNo || ''}"`,
      `"${c.category || ''}"`,
      `"${c.priority || ''}"`,
      `"${c.status || ''}"`,
      c.defectiveMeters || 0,
      `"${(c.description || '').replace(/"/g, '""')}"`,
      `"${(c.actionTaken || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Digital_Print_Complaints_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPriorityColor = (p) => {
    switch (p) {
      case 'Urgent': return '#f87171';
      case 'High': return '#fbbf24';
      case 'Medium': return '#60a5fa';
      default: return '#9ca3af';
    }
  };

  const getStatusBadge = (s) => {
    switch (s) {
      case 'Pending': return { bg: 'rgba(234,179,8,0.15)', color: '#eab308', border: 'rgba(234,179,8,0.3)', icon: <Clock size={12} /> };
      case 'In Progress': return { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: 'rgba(59,130,246,0.3)', icon: <RefreshCw size={12} className="spin-loader" /> };
      case 'Resolved': return { bg: 'rgba(34,197,94,0.15)', color: '#4ade80', border: 'rgba(34,197,94,0.3)', icon: <CheckCircle2 size={12} /> };
      case 'Rejected': return { bg: 'rgba(239,68,68,0.15)', color: '#f87171', border: 'rgba(239,68,68,0.3)', icon: <X size={12} /> };
      default: return { bg: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: 'var(--border-light)', icon: null };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1rem' }}>
      
      {/* Top Banner */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: 46, height: 46, borderRadius: 12,
              background: 'linear-gradient(135deg, #f43f5e, #fb923c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(244,63,94,0.3)'
            }}>
              <AlertTriangle size={24} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Elite Digital Print — Complain & Quality ERP
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Customer complaint logging, shade/defect reporting, proof photos & resolution tracking
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleExportCSV}
              style={{
                padding: '0.55rem 1rem', fontSize: '0.8rem', fontWeight: 700, borderRadius: '8px',
                border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.12)', color: '#60a5fa',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem'
              }}
            >
              <Download size={15} /> Export CSV
            </button>
            <button
              onClick={handleOpenNew}
              style={{
                padding: '0.55rem 1.2rem', fontSize: '0.82rem', fontWeight: 800, borderRadius: '8px',
                border: 'none', background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: '#fff',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 4px 12px rgba(244,63,94,0.3)'
              }}
            >
              <PlusCircle size={16} /> + Log New Complaint
            </button>
          </div>
        </div>
      </div>

      {/* KPI Analytical Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem' }}>
        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #60a5fa' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Complaints</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: 4 }}>{analytics.total}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #eab308' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Pending Review</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#eab308', marginTop: 4 }}>{analytics.pending}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #f87171' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Urgent Tickets</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f87171', marginTop: 4 }}>{analytics.urgent}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #4ade80' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Resolved Issues</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#4ade80', marginTop: 4 }}>{analytics.resolved}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #a78bfa' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Defective Fabric</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#a78bfa', marginTop: 4 }}>{analytics.totalDefectiveMeters} <span style={{ fontSize: '0.85rem' }}>Mtr</span></div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Ticket, Party, Job Card, Design No..."
              style={{ paddingLeft: 32, width: '100%', fontSize: '0.82rem' }}
            />
          </div>

          {/* Status Filter Buttons */}
          <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--bg-main, #111827)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
            {['All', ...STATUSES].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, borderRadius: '4px', border: 'none',
                  background: statusFilter === st ? 'var(--primary)' : 'transparent',
                  color: statusFilter === st ? '#fff' : 'var(--text-muted)', cursor: 'pointer'
                }}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Priority Select */}
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            style={{ padding: '0.45rem 0.7rem', fontSize: '0.8rem', minWidth: 120 }}
          >
            <option value="All">All Priorities</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          {/* Category Select */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{ padding: '0.45rem 0.7rem', fontSize: '0.8rem', minWidth: 150 }}
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Complaints Grid / Table */}
      {loading ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <RefreshCw size={30} className="spin-loader" color="var(--primary)" />
          <p style={{ marginTop: '0.75rem', color: 'var(--text-muted)' }}>Loading complaint tickets...</p>
        </div>
      ) : complaints.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <CheckCircle size={48} color="#4ade80" style={{ opacity: 0.5 }} />
          <h3 style={{ marginTop: '1rem', color: 'var(--text-primary)' }}>No Complaints Logged</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>There are no quality complaints matching your selected filters.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {complaints.map(item => {
            const statusMeta = getStatusBadge(item.status);
            const priorityColor = getPriorityColor(item.priority);

            return (
              <div
                key={item._id}
                className="glass-panel"
                style={{
                  padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
                  borderTop: `4px solid ${priorityColor}`, position: 'relative'
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--primary)' }}>{item.complaintNo}</span>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px',
                        background: `${priorityColor}20`, color: priorityColor, border: `1px solid ${priorityColor}40`
                      }}>
                        {item.priority}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                      {item.partyName}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px',
                    background: statusMeta.bg, color: statusMeta.color, border: `1px solid ${statusMeta.border}`,
                    display: 'flex', alignItems: 'center', gap: '0.3rem'
                  }}>
                    {statusMeta.icon} {item.status}
                  </span>
                </div>

                {/* Details Pills */}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.73rem' }}>
                  {item.jobCardNo && (
                    <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}>
                      JC: {item.jobCardNo}
                    </span>
                  )}
                  {item.designNo && (
                    <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}>
                      Design: {item.designNo}
                    </span>
                  )}
                  <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                    📅 {item.date}
                  </span>
                  {item.defectiveMeters > 0 && (
                    <span style={{ background: 'rgba(244,63,94,0.12)', padding: '2px 6px', borderRadius: '4px', color: '#f43f5e', fontWeight: 700 }}>
                      ⚠️ {item.defectiveMeters} Mtr
                    </span>
                  )}
                </div>

                {/* Category & Description */}
                <div style={{ fontSize: '0.78rem', background: 'var(--bg-main, #111827)', padding: '0.65rem', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', marginBottom: 2 }}>
                    Category: {item.category}
                  </div>
                  <div style={{ color: 'var(--text-primary)', lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {item.description || 'No description provided.'}
                  </div>
                </div>

                {/* Photos Thumbnails */}
                {item.photoUrls && item.photoUrls.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Proof ({item.photoUrls.length}):</span>
                    {item.photoUrls.slice(0, 3).map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt="Defect proof"
                        onClick={() => setZoomImg(url)}
                        style={{ width: 30, height: 30, borderRadius: 4, objectFit: 'cover', cursor: 'zoom-in', border: '1px solid var(--border-light)' }}
                      />
                    ))}
                  </div>
                )}

                {/* Resolution Summary if Action Taken */}
                {item.actionTaken && (
                  <div style={{ fontSize: '0.73rem', color: '#4ade80', background: 'rgba(34,197,94,0.08)', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <strong>Action Taken:</strong> {item.actionTaken}
                  </div>
                )}

                {/* Actions Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.4rem', borderTop: '1px solid var(--border-light)', marginTop: 'auto' }}>
                  <button
                    onClick={() => setShowViewModal(item)}
                    style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <Eye size={14} /> View & Resolve
                  </button>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      onClick={() => handleOpenEdit(item)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                      title="Edit Complaint"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(item._id, item.complaintNo)}
                      style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px' }}
                      title="Delete Ticket"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT COMPLAINT MODAL */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200, padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-card, #1f2937)', border: '1px solid var(--border-light)', borderRadius: '12px',
            width: '100%', maxWidth: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(244,63,94,0.2), rgba(251,146,60,0.2))', padding: '1.1rem 1.5rem',
              borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={20} color="#f43f5e" />
                {editingItem ? `Edit Complaint (${formVal.complaintNo})` : 'Log New Quality Complaint Ticket'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Complaint No</label>
                  <input type="text" value={formVal.complaintNo} readOnly style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem', fontWeight: 800, background: 'var(--bg-main)' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date *</label>
                  <input type="date" value={formVal.date} onChange={e => setFormVal({ ...formVal, date: e.target.value })} required style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} />
                </div>
              </div>

              {/* Party Name */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Party / Client Name *</label>
                <input
                  type="text"
                  list="parties-list"
                  placeholder="Select or type Party Name..."
                  value={formVal.partyName}
                  onChange={e => setFormVal({ ...formVal, partyName: e.target.value })}
                  required
                  style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
                />
                <datalist id="parties-list">
                  {parties.map(p => <option key={p._id || p.name} value={p.name || p.partyName} />)}
                </datalist>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Job Card No (Optional)</label>
                  <input type="text" placeholder="e.g. JC-1001" value={formVal.jobCardNo} onChange={e => setFormVal({ ...formVal, jobCardNo: e.target.value })} style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Design No (Optional)</label>
                  <input type="text" placeholder="e.g. ED-101" value={formVal.designNo} onChange={e => setFormVal({ ...formVal, designNo: e.target.value })} style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Defect Category</label>
                  <select value={formVal.category} onChange={e => setFormVal({ ...formVal, category: e.target.value })} style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Priority</label>
                  <select value={formVal.priority} onChange={e => setFormVal({ ...formVal, priority: e.target.value })} style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Defective Meters</label>
                  <input type="number" min="0" value={formVal.defectiveMeters} onChange={e => setFormVal({ ...formVal, defectiveMeters: parseFloat(e.target.value) || 0 })} style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} />
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Complaint Details / Description</label>
                <textarea rows={3} placeholder="Describe the defect, shade difference, or customer issue..." value={formVal.description} onChange={e => setFormVal({ ...formVal, description: e.target.value })} style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} />
              </div>

              {/* Photos Upload */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Attach Defect Photos / Proof</label>
                <label style={{ border: '2px dashed var(--border-light)', borderRadius: 8, padding: '1rem', textAlign: 'center', cursor: 'pointer', display: 'block', background: 'rgba(255,255,255,0.01)' }}>
                  <input type="file" multiple accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                  <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700 }}>
                    {uploading ? 'Compressing & Uploading Photos...' : '📷 Click to Upload Defect Photos'}
                  </span>
                </label>

                {formVal.photoUrls && formVal.photoUrls.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    {formVal.photoUrls.map((url, idx) => (
                      <div key={idx} style={{ position: 'relative' }}>
                        <img src={url} alt="Proof" style={{ width: 50, height: 50, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border-light)' }} />
                        <button type="button" onClick={() => handleRemovePhoto(idx)} style={{ position: 'absolute', top: -5, right: -5, background: '#f87171', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 10, cursor: 'pointer' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status & Resolution for Edit Mode */}
              {editingItem && (
                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ticket Status</label>
                      <select value={formVal.status} onChange={e => setFormVal({ ...formVal, status: e.target.value })} style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}>
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assigned Responsible Staff</label>
                      <input type="text" placeholder="e.g. Quality Inspector" value={formVal.assignedTo} onChange={e => setFormVal({ ...formVal, assignedTo: e.target.value })} style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Action Taken / Corrective Resolution</label>
                    <textarea rows={2} placeholder="Log root cause, reprint approval, credit note or replacement details..." value={formVal.actionTaken} onChange={e => setFormVal({ ...formVal, actionTaken: e.target.value })} style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '0.5rem 1rem', background: 'none', border: '1px solid var(--border-light)', color: 'var(--text-primary)', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: '0.5rem 1.25rem', background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 800, cursor: 'pointer' }}>
                  {saving ? 'Saving...' : editingItem ? 'Update Complaint' : 'Log Ticket 🚨'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW & RESOLVE MODAL */}
      {showViewModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200, padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-card, #1f2937)', border: '1px solid var(--border-light)', borderRadius: '12px',
            width: '100%', maxWidth: '700px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <div style={{
              background: 'var(--bg-main, #111827)', padding: '1.25rem', borderBottom: '1px solid var(--border-light)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--primary)' }}>{showViewModal.complaintNo}</span>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>{showViewModal.partyName}</div>
              </div>
              <button onClick={() => setShowViewModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.3rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Status Change Toolbar */}
              <div style={{ background: 'var(--bg-main, #111827)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>Quick Status Transition:</span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {STATUSES.map(st => (
                    <button
                      key={st}
                      onClick={() => handleQuickStatusUpdate(showViewModal, st)}
                      style={{
                        padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: 700, borderRadius: '4px',
                        border: showViewModal.status === st ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                        background: showViewModal.status === st ? 'var(--primary)' : 'transparent',
                        color: showViewModal.status === st ? '#fff' : 'var(--text-muted)', cursor: 'pointer'
                      }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Info Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', fontSize: '0.82rem' }}>
                <div><strong>Category:</strong> {showViewModal.category}</div>
                <div><strong>Priority:</strong> {showViewModal.priority}</div>
                <div><strong>Job Card No:</strong> {showViewModal.jobCardNo || 'N/A'}</div>
                <div><strong>Design No:</strong> {showViewModal.designNo || 'N/A'}</div>
                <div><strong>Defective Quantity:</strong> {showViewModal.defectiveMeters} Mtr</div>
                <div><strong>Date Logged:</strong> {showViewModal.date}</div>
              </div>

              {/* Description */}
              <div style={{ background: 'var(--bg-main, #111827)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.85rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Complaint Description</div>
                {showViewModal.description || 'No detailed description provided.'}
              </div>

              {/* Photos Gallery */}
              {showViewModal.photoUrls && showViewModal.photoUrls.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Uploaded Defect Proof Photos ({showViewModal.photoUrls.length})</div>
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                    {showViewModal.photoUrls.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt="Defect"
                        onClick={() => setZoomImg(url)}
                        style={{ width: 80, height: 80, borderRadius: 6, objectFit: 'cover', cursor: 'zoom-in', border: '1px solid var(--border-light)' }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Action Taken */}
              <div style={{ background: 'rgba(34,197,94,0.06)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.2)', fontSize: '0.85rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#4ade80', textTransform: 'uppercase', marginBottom: 4 }}>Action Taken / Corrective Resolution</div>
                {showViewModal.actionTaken || 'No corrective action recorded yet. Click Edit to add resolution notes.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomImg && (
        <div onClick={() => setZoomImg(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1400, cursor: 'zoom-out' }}>
          <img src={zoomImg} alt="Zoom" style={{ maxHeight: '90vh', maxWidth: '90vw', borderRadius: 8, boxShadow: 'var(--shadow-xl)' }} />
        </div>
      )}

    </div>
  );
}
