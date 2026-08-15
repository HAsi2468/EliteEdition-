import React, { useState, useEffect } from 'react';
import { api, getBaseUrl } from '../services/api';
import {
  AlertTriangle, PlusCircle, Search, RefreshCw, Edit2, Trash2, X, Save, Image as ImageIcon,
  CheckCircle, ShieldAlert, Download, Filter, Eye, AlertCircle, Clock, CheckCircle2, User, FileText, ArrowRight, Calendar
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

const PRESET_OPTIONS = [
  { id: 'today', name: 'Today' },
  { id: 'yesterday', name: 'Yesterday' },
  { id: 'this_week', name: 'This Week' },
  { id: 'last_week', name: 'Last Week' },
  { id: 'last_7_days', name: 'Last 7 Days' },
  { id: 'this_month', name: 'This Month' },
  { id: 'previous_month', name: 'Previous Month' },
  { id: 'last_30_days', name: 'Last 30 Days' },
  { id: 'this_quarter', name: 'This Quarter' },
  { id: 'previous_quarter', name: 'Previous Quarter' },
  { id: 'current_fiscal_year', name: 'Current Fiscal Year' },
  { id: 'previous_fiscal_year', name: 'Previous Fiscal Year' },
  { id: 'last_365_days', name: 'Last 365 Days' },
  { id: 'all', name: 'All Time' },
  { id: 'custom', name: 'Custom' }
];

function getDatePresetRange(preset, customStart = '', customEnd = '') {
  const now = new Date();
  let start = null;
  let end = null;
  let labelText = '';

  const formatDate = (d) => {
    if (!d) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  switch (preset) {
    case 'today': {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0);
      end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'this_week': {
      const dayOfWeek = now.getDay();
      const distToMonday = (dayOfWeek + 6) % 7;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distToMonday, 0, 0, 0);
      const sun = new Date(start);
      sun.setDate(start.getDate() + 6);
      end = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate(), 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'last_week': {
      const dayOfWeek = now.getDay();
      const distToMonday = (dayOfWeek + 6) % 7;
      const prevMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distToMonday - 7, 0, 0, 0);
      start = prevMon;
      const prevSun = new Date(prevMon);
      prevSun.setDate(prevMon.getDate() + 6);
      end = new Date(prevSun.getFullYear(), prevSun.getMonth(), prevSun.getDate(), 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'last_7_days': {
      const d7 = new Date(now);
      d7.setDate(now.getDate() - 6);
      start = new Date(d7.getFullYear(), d7.getMonth(), d7.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'this_month': {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'previous_month': {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'last_30_days': {
      const d30 = new Date(now);
      d30.setDate(now.getDate() - 29);
      start = new Date(d30.getFullYear(), d30.getMonth(), d30.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'this_quarter': {
      const m = now.getMonth();
      const qStartMonth = Math.floor(m / 3) * 3;
      start = new Date(now.getFullYear(), qStartMonth, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), qStartMonth + 3, 0, 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'previous_quarter': {
      const m = now.getMonth();
      const qStartMonth = Math.floor(m / 3) * 3 - 3;
      start = new Date(now.getFullYear(), qStartMonth, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), qStartMonth + 3, 0, 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'current_fiscal_year': {
      const yr = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      start = new Date(yr, 3, 1, 0, 0, 0);
      end = new Date(yr + 1, 2, 31, 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'previous_fiscal_year': {
      const yr = (now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1) - 1;
      start = new Date(yr, 3, 1, 0, 0, 0);
      end = new Date(yr + 1, 2, 31, 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'last_365_days': {
      const d365 = new Date(now);
      d365.setDate(now.getDate() - 364);
      start = new Date(d365.getFullYear(), d365.getMonth(), d365.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'custom': {
      if (customStart) start = new Date(`${customStart}T00:00:00`);
      if (customEnd) end = new Date(`${customEnd}T23:59:59`);
      labelText = start && end ? `${formatDate(start)} - ${formatDate(end)}` : 'Custom Range';
      break;
    }
    case 'all':
    default: {
      start = null;
      end = null;
      labelText = 'All Time Records';
      break;
    }
  }

  return { start, end, labelText };
}

export default function DigitalPrintComplainModule() {
  const [complaints, setComplaints] = useState([]);
  const [parties, setParties] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [dynamicCategories, setDynamicCategories] = useState(CATEGORIES);
  const [dynamicSubCategories, setDynamicSubCategories] = useState(SUB_CATEGORIES);
  const [analytics, setAnalytics] = useState({
    total: 0, open: 0, hold: 0, close: 0, feedback: 0, urgent: 0, totalDefectiveMeters: 0, totalExpectedAmount: 0
  });
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [datePreset, setDatePreset] = useState('this_month');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);

  const activeRange = getDatePresetRange(datePreset, customDateStart, customDateEnd);
  const dateStart = activeRange.start ? activeRange.start.toISOString().split('T')[0] : '';
  const dateEnd = activeRange.end ? activeRange.end.toISOString().split('T')[0] : '';

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
    challanNo: '',
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
      const currentUser = api.getCurrentUser();
      const isAdmin = !currentUser || currentUser.role === 'admin';
      const currentUserName = currentUser ? (currentUser.name || currentUser.fullName || currentUser.username || '') : '';

      const params = {
        search,
        status: statusFilter,
        priority: priorityFilter,
        category: categoryFilter,
        dateStart,
        dateEnd,
        limit: 500
      };

      if (!isAdmin && currentUserName) {
        params.assignedTo = currentUserName;
      }

      const res = await api.getComplaints(params);
      if (res && res.data) {
        let list = res.data;
        if (!isAdmin && currentUserName) {
          list = list.filter(item => (item.assignedTo || '').toLowerCase().trim() === currentUserName.toLowerCase().trim());
        }
        setComplaints(list);
      }
    } catch (err) {
      console.error('Failed to fetch complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const currentUser = api.getCurrentUser();
      const isAdmin = !currentUser || currentUser.role === 'admin';
      const currentUserName = currentUser ? (currentUser.name || currentUser.fullName || currentUser.username || '') : '';

      const params = { dateStart, dateEnd };
      if (!isAdmin && currentUserName) {
        params.assignedTo = currentUserName;
      }

      const data = await api.getComplaintAnalytics(params);
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

      // 2. Responsible Persons strictly from System Users & Admins
      let userList = [];
      if (Array.isArray(uRes)) userList = uRes;
      else if (uRes && Array.isArray(uRes.users?.rows)) userList = uRes.users.rows;
      else if (uRes && Array.isArray(uRes.results)) userList = uRes.results;
      else if (uRes && Array.isArray(uRes.data)) userList = uRes.data;

      const registeredUsers = userList
        .map(u => typeof u === 'string' ? u : (u.name || u.fullName || u.username))
        .filter(Boolean);

      const currentUser = api.getCurrentUser();
      const currentUserName = currentUser ? (currentUser.name || currentUser.fullName || currentUser.username || '') : '';

      const mergedStaff = Array.from(new Set([...registeredUsers, currentUserName])).filter(Boolean);
      setStaffList(mergedStaff);

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
    const currentUser = api.getCurrentUser();
    const currentUserName = currentUser ? (currentUser.name || currentUser.fullName || currentUser.username || '') : '';

    setEditingItem(null);
    const catList = Array.isArray(dynamicCategories) && dynamicCategories.length > 0 ? dynamicCategories : CATEGORIES;
    const defaultCat = catList[0] || 'Printing Defect';
    const subOptions = getSubCategoryOptions(defaultCat);

    setFormVal({
      complaintNo: 'Loading...',
      date: new Date().toISOString().split('T')[0],
      partyName: '',
      assignedTo: currentUserName,
      jobCardNo: '',
      challanNo: '',
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
      challanNo: item.challanNo || '',
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

  const currentUser = api.getCurrentUser();
  const perms = currentUser?.permissions || [];
  const isAdmin = !currentUser || currentUser.role === 'admin';

  // Permission 1: Dashboard View
  const canViewDashboard = isAdmin || perms.includes('complaint_dashboard') || perms.includes('jobcards_complain') || perms.includes('jobcards');
  // Permission 2: Create Complaint
  const canCreateComplaint = isAdmin || perms.includes('complaint_create') || perms.includes('jobcards_complain') || perms.includes('jobcards');

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
            {canViewDashboard && (
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
            )}
            {canCreateComplaint && (
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
            )}
          </div>
        </div>
      </div>      {/* Dashboard View (Scoped by Permission) */}
      {canViewDashboard ? (
        <>
          {/* KPI Analytical Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.85rem' }}>
            <div className="glass-panel" style={{ padding: '0.9rem', borderLeft: '4px solid #60a5fa' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Total Complaints</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: 2 }}>{analytics.total || 0}</div>
            </div>

            <div className="glass-panel" style={{ padding: '0.9rem', borderLeft: '4px solid #eab308' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Open</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#eab308', marginTop: 2 }}>{analytics.open || 0}</div>
            </div>

            <div className="glass-panel" style={{ padding: '0.9rem', borderLeft: '4px solid #f97316' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Hold</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f97316', marginTop: 2 }}>{analytics.hold || 0}</div>
            </div>

            <div className="glass-panel" style={{ padding: '0.9rem', borderLeft: '4px solid #4ade80' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Close</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#4ade80', marginTop: 2 }}>{analytics.close || 0}</div>
            </div>

            <div className="glass-panel" style={{ padding: '0.9rem', borderLeft: '4px solid #c084fc' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Feedback</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#c084fc', marginTop: 2 }}>{analytics.feedback || 0}</div>
            </div>

            {/* Complaint Rate (%) */}
            <div className="glass-panel" style={{ padding: '0.9rem', borderLeft: '4px solid #f43f5e' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Complaint Rate (%)</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f43f5e', marginTop: 2 }}>
                {analytics.complaintRate || '0.00'}%
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>Tickets / Dispatched</div>
            </div>

            {/* Resolution SLA / TAT */}
            <div className="glass-panel" style={{ padding: '0.9rem', borderLeft: '4px solid #38bdf8' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Resolution SLA/TAT</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#38bdf8', marginTop: 2 }}>
                {analytics.avgTatFormatted || 'N/A'}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>Avg Open to Close Time</div>
            </div>

            {/* Defective Fabric Mtr */}
            <div className="glass-panel" style={{ padding: '0.9rem', borderLeft: '4px solid #a78bfa' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Defective Fabric</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#a78bfa', marginTop: 2 }}>{analytics.totalDefectiveMeters || 0} <span style={{ fontSize: '0.8rem' }}>Mtr</span></div>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="glass-panel" style={{ padding: '1rem 1.25rem', overflow: 'visible', position: 'relative', zIndex: 100 }}>
            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 200px' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search Ticket, Party, Job Card, Invoice No..."
                  style={{ paddingLeft: 32, width: '100%', fontSize: '0.82rem' }}
                />
              </div>

              {/* Invoice-style Date Range Preset Selector Component */}
              <div style={{ position: 'relative', display: 'inline-block', zIndex: 200 }}>
                <button
                  type="button"
                  onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.45rem 1.1rem',
                    borderRadius: '8px',
                    border: '1.5px solid #a78bfa',
                    background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)',
                    transition: 'all 0.2s'
                  }}
                >
                  <Calendar size={15} color="#a78bfa" />
                  <span>{PRESET_OPTIONS.find(p => p.id === datePreset)?.name || 'This Month'}</span>
                  <Calendar size={15} color="#a78bfa" />
                </button>

                {isDateDropdownOpen && (
                  <>
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                      onClick={() => setIsDateDropdownOpen(false)}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        width: '350px',
                        maxHeight: '380px',
                        overflowY: 'auto',
                        background: '#0f172a',
                        color: '#f8fafc',
                        borderRadius: '12px',
                        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(167, 139, 250, 0.3)',
                        border: '1px solid rgba(167, 139, 250, 0.35)',
                        zIndex: 9999,
                        padding: '0.35rem 0'
                      }}
                    >
                      {PRESET_OPTIONS.map(opt => {
                        const rangeInfo = getDatePresetRange(opt.id, customDateStart, customDateEnd);
                        const isSelected = datePreset === opt.id;
                        return (
                          <div
                            key={opt.id}
                            onClick={() => {
                              setDatePreset(opt.id);
                              if (opt.id !== 'custom') setIsDateDropdownOpen(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.6rem 0.95rem',
                              cursor: 'pointer',
                              background: isSelected ? 'rgba(124, 58, 237, 0.3)' : 'transparent',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                              fontSize: '0.82rem',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <span style={{ fontWeight: isSelected ? 800 : 500, color: isSelected ? '#a78bfa' : '#e2e8f0' }}>
                              {opt.name}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: '0.74rem', color: isSelected ? '#38bdf8' : '#94a3b8' }}>
                              {rangeInfo.labelText}
                            </span>
                          </div>
                        );
                      })}

                      {datePreset === 'custom' && (
                        <div style={{ padding: '0.75rem 1rem', background: '#1e293b', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            <div>
                              <label style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>From</label>
                              <input type="date" value={customDateStart} onChange={e => setCustomDateStart(e.target.value)} style={{ width: '100%', padding: '0.35rem', fontSize: '0.8rem', background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '6px' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>To</label>
                              <input type="date" value={customDateEnd} onChange={e => setCustomDateEnd(e.target.value)} style={{ width: '100%', padding: '0.35rem', fontSize: '0.8rem', background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '6px' }} />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsDateDropdownOpen(false)}
                            style={{ padding: '0.45rem', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}
                          >
                            Apply Custom Range
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
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
                {(Array.isArray(dynamicCategories) ? dynamicCategories : CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
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
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {item.date ? new Date(item.date).toLocaleDateString('en-IN') : ''}
                        </div>
                      </div>

                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        fontSize: '0.7rem', fontWeight: 800, padding: '0.25rem 0.6rem', borderRadius: '20px',
                        background: statusMeta.bg, color: statusMeta.color, border: `1px solid ${statusMeta.border}`
                      }}>
                        {statusMeta.icon} {item.status}
                      </span>
                    </div>

                    {/* Customer & Responsible Person */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.78rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>Customer:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{item.partyName || 'N/A'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>Assigned To:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{item.assignedTo || 'Unassigned'}</strong>
                      </div>
                    </div>

                    {/* Linkage Info */}
                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.73rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      {item.jobCardNo && <span>Job Card: <strong style={{ color: 'var(--text-primary)' }}>{item.jobCardNo}</strong></span>}
                      {item.challanNo && <span>Challan: <strong style={{ color: '#60a5fa' }}>{item.challanNo}</strong></span>}
                      {item.invoiceNo && <span>Invoice: <strong style={{ color: 'var(--text-primary)' }}>{item.invoiceNo}</strong></span>}
                      {item.defectiveMeters > 0 && (
                        <span style={{ background: 'rgba(239,68,68,0.12)', padding: '2px 6px', borderRadius: '4px', color: '#f87171', fontWeight: 700 }}>
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

                      {canCreateComplaint && (
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
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : canCreateComplaint ? (
        /* Fallback View for Users with ONLY Create Complaint Permission */
        <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center', maxWidth: 600, margin: '2rem auto' }}>
          <AlertTriangle size={56} color="#f43f5e" style={{ margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
            Log Quality Complaint Ticket
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            You have access to log new quality complaints and defect reports for Elite Digital Prints. Click below to submit a new ticket.
          </p>
          <button
            onClick={handleOpenNew}
            style={{
              padding: '0.75rem 2rem', fontSize: '0.95rem', fontWeight: 800, borderRadius: '10px',
              border: 'none', background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: '#fff',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.6rem', boxShadow: '0 6px 18px rgba(244,63,94,0.4)'
            }}
          >
            <PlusCircle size={20} /> + Log New Complaint
          </button>
        </div>
      ) : (
        /* No Permission Fallback */
        <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center', maxWidth: 600, margin: '2rem auto' }}>
          <ShieldAlert size={56} color="#ef4444" style={{ margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
            Access Restricted
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            You do not have permission to view or create complaints. Please contact your system administrator.
          </p>
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

                  {/* Assigned To Dropdown */}
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assigned To *</label>
                    <select
                      value={formVal.assignedTo}
                      onChange={e => setFormVal({ ...formVal, assignedTo: e.target.value })}
                      style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                    >
                      <option value="">-- Select Assigned User / Admin --</option>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Job Card No.</label>
                    <input type="text" placeholder="e.g. JC-1001" value={formVal.jobCardNo} onChange={e => setFormVal({ ...formVal, jobCardNo: e.target.value })} style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Challan No.</label>
                    <input type="text" placeholder="e.g. EDP-CH-1001" value={formVal.challanNo} onChange={e => setFormVal({ ...formVal, challanNo: e.target.value })} style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }} />
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
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assigned To</label>
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
                <div><strong>Assigned To:</strong> {showViewModal.assignedTo || 'Unassigned'}</div>
                <div><strong>Job Card No:</strong> {showViewModal.jobCardNo || 'N/A'}</div>
                <div><strong>Challan No:</strong> {showViewModal.challanNo || 'N/A'}</div>
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
