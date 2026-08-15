import React, { useState, useEffect } from 'react';
import { api, getBaseUrl } from '../services/api';
import {
  AlertTriangle, PlusCircle, Search, RefreshCw, Edit2, Trash2, X, Save, Image as ImageIcon,
  CheckCircle, ShieldAlert, Download, Filter, Eye, AlertCircle, Clock, CheckCircle2, User, FileText, ArrowRight
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { triggerEliteAlert, triggerEliteConfirm } from './EliteModalDialog';

const CATEGORIES = [
  'Printing Defect',
  'Color Matching / Shade Difference',
  'Fabric Damage',
  'Quantity Shortage',
  'Delivery Delay',
  'Billing Issue',
  'Other'
];

const SUB_CATEGORIES = {
  'Printing Defect': [
    'Line Defect', 'Ink Spot', 'Ghost Printing', 'Streaks', 'Smudge', 'Misalignment', 'White Specks', 'Paper Wrinkle', 'Other Printing Defect'
  ],
  'Color Matching / Shade Difference': [
    'Lighter Shade', 'Darker Shade', 'Tone Variation', 'Color Bleeding', 'Sample Mismatch', 'Shade Variation Across Width', 'Other Shade Issue'
  ],
  'Fabric Damage': [
    'Hole / Tear', 'Stains / Spots', 'Shrinkage', 'Weaving Flaw', 'Panna Variation', 'Other Fabric Defect'
  ],
  'Quantity Shortage': [
    'Meter Shortage', 'Piece Count Shortage', 'Partial Delivery', 'Missing Roll', 'Other Shortage'
  ],
  'Delivery Delay': [
    'Late Dispatch', 'Transit Delay', 'Missing Parcel', 'Wrong Address Delivery'
  ],
  'Billing Issue': [
    'Rate Mismatch', 'Discount Missing', 'GST Calculation Error', 'Duplicate Bill'
  ],
  'Other': [
    'General Customer Issue', 'Packaging Defect', 'Miscellaneous'
  ]
};

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const STATUSES = ['Open', 'Hold', 'Close', 'Feedback'];

export default function DigitalPrintComplainModule() {
  const [complaints, setComplaints] = useState([]);
  const [parties, setParties] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [analytics, setAnalytics] = useState({
    total: 0, open: 0, hold: 0, close: 0, feedback: 0, urgent: 0, totalDefectiveMeters: 0, totalExpectedAmount: 0
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
    assignedTo: '',
    jobCardNo: '',
    invoiceNo: '',
    designNo: '',
    category: 'Printing Defect',
    subCategory: 'Line Defect',
    priority: 'Medium',
    status: 'Open',
    defectiveMeters: 0,
    expectedAmount: 0,
    description: '',
    photoUrls: [],
    actionTaken: ''
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
      const [pRes, cfg, uRes] = await Promise.all([
        api.getParties({ limit: 1000 }).catch(() => ({ data: [] })),
        api.getPrintConfig().catch(() => ({})),
        api.getUsers({ limit: 500 }).catch(() => ({ results: [], data: [] }))
      ]);

      // 1. Party Names from Print Settings Parties (Clients) + Party Master
      const printConfigParties = (cfg && Array.isArray(cfg.parties)) ? cfg.parties : [];
      const partyMasterNames = (pRes && Array.isArray(pRes.data)) ? pRes.data.map(p => typeof p === 'string' ? p : (p.name || p.partyName)).filter(Boolean) : [];
      const mergedParties = Array.from(new Set([...printConfigParties, ...partyMasterNames]));
      setParties(mergedParties);

      // 2. Staff / Users who have access to Elite Digital Prints (Current & Future)
      const userList = (uRes && (uRes.results || uRes.data)) ? (uRes.results || uRes.data) : [];
      const userNames = Array.isArray(userList) ? userList.map(u => u.name || u.fullName || u.username).filter(Boolean) : [];
      const operators = (cfg && Array.isArray(cfg.operators)) ? cfg.operators : [];
      const autoUsers = (cfg && Array.isArray(cfg.autoScreenUsers)) ? cfg.autoScreenUsers : [];

      // 3. Dynamic Categories & Sub-Categories from Print Settings
      if (cfg && Array.isArray(cfg.complaintCategories) && cfg.complaintCategories.length > 0) {
        setDynamicCategories(cfg.complaintCategories);
      }
      if (cfg && cfg.complaintSubCategories && typeof cfg.complaintSubCategories === 'object') {
        setDynamicSubCategories(cfg.complaintSubCategories);
      }
    } catch (e) {
      console.warn('Failed to fetch metadata list:', e);
    }
  };

  const getSubCategoryOptions = (catName) => {
    let list = [];
    if (dynamicSubCategories) {
      if (Array.isArray(dynamicSubCategories[catName])) {
        list = dynamicSubCategories[catName];
      } else if (typeof dynamicSubCategories.get === 'function') {
        list = dynamicSubCategories.get(catName);
      }
    }
    if (!Array.isArray(list) || list.length === 0) {
      list = SUB_CATEGORIES[catName] || ['Other'];
    }
    return Array.isArray(list) ? list : ['Other'];
  };

  const handleOpenNew = () => {
    setEditingItem(null);
    const catList = Array.isArray(dynamicCategories) && dynamicCategories.length > 0 ? dynamicCategories : CATEGORIES;
    const defaultCat = catList[0] || 'Printing Defect';
    const subOptions = getSubCategoryOptions(defaultCat);

    setFormVal({
      complaintNo: 'Loading...',
      date: new Date().toISOString().split('T')[0],
      partyName: '',
      assignedTo: '',
      jobCardNo: '',
      invoiceNo: '',
      designNo: '',
      category: defaultCat,
      subCategory: subOptions[0] || '',
      priority: 'Medium',
      status: 'Open',
      defectiveMeters: 0,
      expectedAmount: 0,
      description: '',
      photoUrls: [],
      actionTaken: ''
    });

    setShowModal(true);

    api.getNextComplaintNumber().then(res => {
      if (res && res.nextComplaintNo) {
        setFormVal(prev => ({ ...prev, complaintNo: res.nextComplaintNo }));
      } else {
        setFormVal(prev => ({ ...prev, complaintNo: 'EDP-COMP-1001' }));
      }
    }).catch(err => {
      console.warn('Failed to fetch next complaint number:', err);
      setFormVal(prev => ({ ...prev, complaintNo: 'EDP-COMP-1001' }));
    });
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    const cat = item.category || 'Printing Defect';
    const subOpts = SUB_CATEGORIES[cat] || ['Other'];

    setFormVal({
      complaintNo: item.complaintNo || '',
      date: item.date || new Date().toISOString().split('T')[0],
      partyName: item.partyName || '',
      assignedTo: item.assignedTo || '',
      jobCardNo: item.jobCardNo || '',
      invoiceNo: item.invoiceNo || '',
      designNo: item.designNo || '',
      category: cat,
      subCategory: item.subCategory || subOpts[0] || '',
      priority: item.priority || 'Medium',
      status: item.status || 'Open',
      defectiveMeters: item.defectiveMeters || 0,
      expectedAmount: item.expectedAmount || 0,
      description: item.description || '',
      photoUrls: item.photoUrls || [],
      actionTaken: item.actionTaken || ''
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
      case 'Open': case 'Pending': return { bg: 'rgba(234,179,8,0.15)', color: '#eab308', border: 'rgba(234,179,8,0.3)', icon: <Clock size={12} /> };
      case 'Hold': case 'In Progress': return { bg: 'rgba(249,115,22,0.15)', color: '#f97316', border: 'rgba(249,115,22,0.3)', icon: <AlertCircle size={12} /> };
      case 'Close': case 'Resolved': return { bg: 'rgba(34,197,94,0.15)', color: '#4ade80', border: 'rgba(34,197,94,0.3)', icon: <CheckCircle2 size={12} /> };
      case 'Feedback': return { bg: 'rgba(168,85,247,0.15)', color: '#c084fc', border: 'rgba(168,85,247,0.3)', icon: <FileText size={12} /> };
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.85rem' }}>
        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #60a5fa' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: 4 }}>{analytics.total}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #eab308' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Open</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#eab308', marginTop: 4 }}>{analytics.open}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #f97316' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Hold</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f97316', marginTop: 4 }}>{analytics.hold}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #4ade80' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Close</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#4ade80', marginTop: 4 }}>{analytics.close}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #c084fc' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Feedback</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#c084fc', marginTop: 4 }}>{analytics.feedback}</div>
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
                  {item.invoiceNo && (
                    <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)' }}>
                      Inv: {item.invoiceNo}
                    </span>
                  )}
                  {item.designNo && (
                    <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}>
                      Design: {item.designNo}
                    </span>
                  )}
                  {item.assignedTo && (
                    <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', color: '#facc15', border: '1px solid rgba(250,204,21,0.2)' }}>
                      👤 {item.assignedTo}
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
                  {item.expectedAmount > 0 && (
                    <span style={{ background: 'rgba(34,197,94,0.12)', padding: '2px 6px', borderRadius: '4px', color: '#4ade80', fontWeight: 700 }}>
                      💰 ₹{item.expectedAmount}
                    </span>
                  )}
                </div>

                {/* Category & Sub-Category & Description */}
                <div style={{ fontSize: '0.78rem', background: 'var(--bg-main, #111827)', padding: '0.65rem', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', marginBottom: 2 }}>
                    {item.category} {item.subCategory ? `› ${item.subCategory}` : ''}
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

            <form onSubmit={handleSubmit} style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              
              {/* SECTION 1: BASIC DETAILS */}
              <div style={{ background: 'var(--bg-main, #111827)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.65rem' }}>
                  📌 Basic Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ticket ID (Auto)</label>
                    <input type="text" value={formVal.complaintNo} readOnly style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem', fontWeight: 800, background: 'rgba(255,255,255,0.04)' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date *</label>
                    <input type="date" value={formVal.date} onChange={e => setFormVal({ ...formVal, date: e.target.value })} required style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.65rem' }}>
                  {/* Customer Name Dropdown */}
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Customer Name (Print Settings Parties) *</label>
                    <select
                      value={formVal.partyName}
                      onChange={e => setFormVal({ ...formVal, partyName: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                    >
                      <option value="">-- Select Customer / Party --</option>
                      {parties.map((pName, idx) => (
                        <option key={idx} value={pName}>{pName}</option>
                      ))}
                    </select>
                  </div>

                  {/* Responsible Person Dropdown */}
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Responsible Person (Department User)</label>
                    <select
                      value={formVal.assignedTo}
                      onChange={e => setFormVal({ ...formVal, assignedTo: e.target.value })}
                      style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                    >
                      <option value="">-- Select Responsible Person --</option>
                      {staffList.map((sName, idx) => (
                        <option key={idx} value={sName}>{sName}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2: ORDER LINKAGE */}
              <div style={{ background: 'var(--bg-main, #111827)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '0.65rem' }}>
                  🔗 Order Linkage
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Job Card No.</label>
                    <input type="text" placeholder="e.g. JC-1001" value={formVal.jobCardNo} onChange={e => setFormVal({ ...formVal, jobCardNo: e.target.value })} style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Invoice No.</label>
                    <input type="text" placeholder="e.g. EDP-INV-1001" value={formVal.invoiceNo} onChange={e => setFormVal({ ...formVal, invoiceNo: e.target.value })} style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Design No. (Optional)</label>
                    <input type="text" placeholder="e.g. ED-101" value={formVal.designNo} onChange={e => setFormVal({ ...formVal, designNo: e.target.value })} style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
                  </div>
                </div>
              </div>

              {/* SECTION 3: COMPLAINT CATEGORY & SUB-CATEGORY */}
              <div style={{ background: 'var(--bg-main, #111827)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', marginBottom: '0.65rem' }}>
                  🏷️ Complaint Category & Sub-Category
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Complaint Category *</label>
                    <select
                      value={formVal.category}
                      onChange={e => {
                        const newCat = e.target.value;
                        const subOpts = dynamicSubCategories[newCat] || SUB_CATEGORIES[newCat] || ['Other'];
                        setFormVal({ ...formVal, category: newCat, subCategory: subOpts[0] || '' });
                      }}
                      style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                    >
                      {dynamicCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sub-Category *</label>
                    <select
                      value={formVal.subCategory}
                      onChange={e => setFormVal({ ...formVal, subCategory: e.target.value })}
                      style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                    >
                      {(dynamicSubCategories[formVal.category] || SUB_CATEGORIES[formVal.category] || ['Other']).map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 4: SEVERITY / PRIORITY & CLAIMED VALUE */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '0.85rem' }}>
                {/* Severity */}
                <div style={{ background: 'var(--bg-main, #111827)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Severity / Priority</label>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    {['Low', 'Medium', 'High', 'Urgent'].map(p => {
                      const active = formVal.priority === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setFormVal({ ...formVal, priority: p })}
                          style={{
                            flex: 1, padding: '0.35rem 0', fontSize: '0.72rem', fontWeight: 800, borderRadius: '4px',
                            border: active ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                            background: active ? 'var(--primary)' : 'transparent',
                            color: active ? '#fff' : 'var(--text-muted)', cursor: 'pointer'
                          }}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Claimed Value */}
                <div style={{ background: 'var(--bg-main, #111827)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Defective Mtr / Qty</label>
                      <input type="number" min="0" step="0.01" value={formVal.defectiveMeters} onChange={e => setFormVal({ ...formVal, defectiveMeters: parseFloat(e.target.value) || 0 })} style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Expected Claim (₹)</label>
                      <input type="number" min="0" step="1" placeholder="₹ Amount" value={formVal.expectedAmount} onChange={e => setFormVal({ ...formVal, expectedAmount: parseFloat(e.target.value) || 0 })} style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem', fontWeight: 700, color: '#4ade80' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Complaint Details / Description</label>
                <textarea rows={3} placeholder="Describe the defect, shade difference, or customer issue..." value={formVal.description} onChange={e => setFormVal({ ...formVal, description: e.target.value })} style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} />
              </div>

              {/* Attachments Section - Disabled per request */}
              <div style={{ opacity: 0.5, pointerEvents: 'none', background: 'rgba(255,255,255,0.02)', padding: '0.65rem', borderRadius: '6px', border: '1px dashed var(--border-light)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>📷 Attachments / Defect Proof (Currently Disabled)</span>
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
                <div><strong>Sub-Category:</strong> {showViewModal.subCategory || 'N/A'}</div>
                <div><strong>Severity / Priority:</strong> {showViewModal.priority}</div>
                <div><strong>Responsible Person:</strong> {showViewModal.assignedTo || 'Unassigned'}</div>
                <div><strong>Job Card No:</strong> {showViewModal.jobCardNo || 'N/A'}</div>
                <div><strong>Invoice No:</strong> {showViewModal.invoiceNo || 'N/A'}</div>
                <div><strong>Defective Quantity:</strong> {showViewModal.defectiveMeters} Mtr</div>
                <div><strong>Expected Claim (₹):</strong> {showViewModal.expectedAmount ? `₹${showViewModal.expectedAmount}` : 'N/A'}</div>
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
