import React, { useState, useEffect } from 'react';
import { api, getBaseUrl } from '../services/api';
import {
  AlertTriangle, PlusCircle, Search, RefreshCw, Edit2, Trash2, X, Save, Image as ImageIcon,
  CheckCircle, ShieldAlert, Download, Filter, Eye, AlertCircle, Clock, CheckCircle2, User, FileText, ArrowRight, Calendar, MessageSquare
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { triggerEliteAlert, triggerEliteConfirm } from './EliteModalDialog';
import DateRangePicker from './DateRangePicker';

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
const STATUSES = ['Open', 'In Progress', 'Hold', 'Pending', 'Feedback', 'Close'];

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

export default function DigitalPrintComplainModule({ companyEntity = 'Elite Digital Print' }) {
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
  const [datePreset, setDatePreset] = useState('all');
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
    responsiblePerson: '',
    responsiblePersons: [],
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
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMsg, setLookupMsg] = useState(null);

  const handleOrderLookup = async (searchTerm) => {
    if (!searchTerm || searchTerm.trim().length < 2) return;
    setLookupLoading(true);
    setLookupMsg(null);

    try {
      const res = await api.lookupOrderDetails(searchTerm);
      if (res && res.success && res.data) {
        const d = res.data;
        setFormVal(prev => ({
          ...prev,
          partyName: d.partyName || prev.partyName,
          jobCardNo: d.jobCardNo || prev.jobCardNo,
          challanNo: d.challanNo || prev.challanNo,
          invoiceNo: d.invoiceNo || prev.invoiceNo,
          designNo: d.designNo || prev.designNo,
          defectiveMeters: (prev.defectiveMeters === 0 && d.totalMeters > 0) ? d.totalMeters : prev.defectiveMeters
        }));

        if (d.partyName && !parties.includes(d.partyName)) {
          setParties(prev => [...prev, d.partyName]);
        }

        setLookupMsg({
          type: 'success',
          text: `✨ Linked Order Found! Auto-filled details from ${d.foundIn || 'Database'} (Customer: ${d.partyName || 'Found'})`
        });
      } else {
        setLookupMsg({
          type: 'error',
          text: `⚠️ No matching Job Card, Challan, or Invoice found for "${searchTerm}".`
        });
      }
    } catch (err) {
      console.warn('Order lookup failed:', err);
    } finally {
      setLookupLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
    fetchAnalytics();
    fetchParties();
  }, [search, statusFilter, priorityFilter, categoryFilter, dateStart, dateEnd, companyEntity]);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const currentUser = api.getCurrentUser();
      const isAdmin = !currentUser || currentUser.role === 'admin';
      const currentUserName = currentUser ? (currentUser.name || currentUser.fullName || currentUser.username || '') : '';

      const params = {
        companyEntity,
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
      let list = Array.isArray(res) ? res : (res && Array.isArray(res.data) ? res.data : []);
      if (!isAdmin && currentUserName) {
        const normName = currentUserName.toLowerCase().trim();
        list = list.filter(item => {
          const aTo = (item.assignedTo || '').toLowerCase();
          const rPerson = (item.responsiblePerson || '').toLowerCase();
          const rPersons = Array.isArray(item.responsiblePersons)
            ? item.responsiblePersons.map(p => (p || '').toLowerCase())
            : [];

          return (
            aTo.includes(normName) ||
            rPerson.includes(normName) ||
            rPersons.some(p => p.includes(normName))
          );
        });
      }
      setComplaints(list);
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

      const params = { companyEntity, dateStart, dateEnd };
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
        api.getPrintConfig(companyEntity).catch(() => ({})),
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
      companyEntity,
      complaintNo: 'Loading...',
      date: new Date().toISOString().split('T')[0],
      partyName: '',
      assignedTo: currentUserName,
      responsiblePerson: '',
      responsiblePersons: [],
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

    api.getNextComplaintNumber(companyEntity).then(res => {
      if (res && res.nextComplaintNo) {
        setFormVal(prev => ({ ...prev, complaintNo: res.nextComplaintNo }));
      } else {
        setFormVal(prev => ({ ...prev, complaintNo: 'COMP-1001' }));
      }
    }).catch(err => {
      console.warn('Failed to fetch next complaint number:', err);
      setFormVal(prev => ({ ...prev, complaintNo: 'COMP-1001' }));
    });
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    const cat = item.category || 'Printing Defect';
    const subOpts = SUB_CATEGORIES[cat] || ['Other'];

    const respList = Array.isArray(item.responsiblePersons) && item.responsiblePersons.length > 0
      ? item.responsiblePersons
      : (item.responsiblePerson ? item.responsiblePerson.split(',').map(s => s.trim()).filter(Boolean) : []);

    setFormVal({
      complaintNo: item.complaintNo || '',
      date: item.date || new Date().toISOString().split('T')[0],
      partyName: item.partyName || '',
      assignedTo: item.assignedTo || '',
      responsiblePerson: item.responsiblePerson || respList.join(', '),
      responsiblePersons: respList,
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

  const handleOpenViewModal = async (item) => {
    setShowViewModal(item);
    try {
      const freshDoc = await api.getComplaintById(item._id);
      if (freshDoc) {
        setShowViewModal(freshDoc);
      }
    } catch (e) {
      console.warn('Failed to fetch fresh complaint details:', e);
    }
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

  const handleClearAllComplaints = async () => {
    const confirmed = await triggerEliteConfirm({
      title: 'Clear All Complaint Records',
      message: 'Are you sure you want to delete ALL complaint ticket records? This will clear all test tickets and reset complaints data.',
      confirmText: 'Clear All Complaints',
      type: 'danger'
    });
    if (!confirmed) return;

    try {
      const res = await api.clearAllComplaints();
      triggerEliteAlert('Complaints Cleared', res.message || 'All complaint records have been cleared.', 'success');
      fetchComplaints();
      fetchAnalytics();
    } catch (err) {
      triggerEliteAlert('Clear Error', err.message || 'Failed to clear complaints.', 'error');
    }
  };

  const handleQuickStatusUpdate = async (item, newStatus) => {
    try {
      const currentUser = api.getCurrentUser();
      const currentUserName = currentUser ? (currentUser.name || currentUser.fullName || currentUser.username || 'User') : 'User';
      const res = await api.updateComplaint(item._id, { status: newStatus, updatedBy: currentUserName });
      fetchComplaints();
      fetchAnalytics();
      if (showViewModal && showViewModal._id === item._id) {
        setShowViewModal(res || { ...showViewModal, status: newStatus });
      }
    } catch (err) {
      triggerEliteAlert('Update Failed', err.message || 'Failed to update status.', 'error');
    }
  };

  const [newCommentText, setNewCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  const handleAddComment = async (complaintId) => {
    if (!newCommentText.trim()) return;
    setPostingComment(true);
    try {
      const currentUser = api.getCurrentUser();
      const currentUserName = currentUser ? (currentUser.name || currentUser.fullName || currentUser.username || 'Staff User') : 'Staff User';
      const updated = await api.addComplaintComment(complaintId, {
        text: newCommentText.trim(),
        userName: currentUserName
      });
      setNewCommentText('');
      fetchComplaints();
      if (showViewModal && showViewModal._id === complaintId) {
        setShowViewModal(updated);
      }
      triggerEliteAlert('Comment Added', 'Your remark was logged to ticket activity timeline.', 'success');
    } catch (err) {
      triggerEliteAlert('Comment Error', err.message || 'Failed to add comment.', 'error');
    } finally {
      setPostingComment(false);
    }
  };

  const handleExportPDF = () => {
    if (!complaints.length) {
      triggerEliteAlert('Export Notice', 'No complaint records to export.', 'warning');
      return;
    }
    const printWin = window.open('', '_blank');
    if (!printWin) {
      triggerEliteAlert('Export Notice', 'Please allow popups in your browser to view/download PDF.', 'warning');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Digital Print Complaints Report - Elite Edition ERP</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 25px; color: #1e293b; background: #fff; margin: 0; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f43f5e; padding-bottom: 12px; margin-bottom: 20px; }
          .company-title { font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: 0.5px; }
          .report-title { font-size: 13px; font-weight: 700; color: #f43f5e; text-transform: uppercase; margin-top: 4px; }
          .meta-info { font-size: 11px; color: #64748b; text-align: right; }
          
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          th { background: #0f172a; color: #fff; text-transform: uppercase; font-size: 10px; font-weight: 800; padding: 8px 10px; text-align: left; }
          td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; color: #334155; }
          tr:nth-child(even) { background: #f8fafc; }
          
          .footer { margin-top: 25px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="company-title">ELITE DIGITAL PRINTS</div>
            <div class="report-title">QUALITY COMPLAINTS & TICKETS REPORT</div>
          </div>
          <div class="meta-info">
            <div><strong>Date Range:</strong> ${activeRange.labelText}</div>
            <div><strong>Generated On:</strong> ${new Date().toLocaleString('en-IN')}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Ticket No</th>
              <th>Date</th>
              <th>Customer Party</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Assigned By</th>
              <th>Responsible Person</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${complaints.map(c => `
              <tr>
                <td><strong>${c.complaintNo || ''}</strong></td>
                <td>${c.date || ''}</td>
                <td>${c.partyName || ''}</td>
                <td>${c.category || ''}</td>
                <td>${c.priority || ''}</td>
                <td>${c.status || ''}</td>
                <td>${c.assignedTo || ''}</td>
                <td>${c.responsiblePerson || ''}</td>
                <td>${c.description || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <div>Elite Edition ERP System &bull; Confidential Quality Report</div>
          <div>Report Generated Successfully</div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
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
      
      {/* Minimal White Card Header with Entry Button Top Right */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', background: '#ffffff', borderRadius: '14px', border: '1px solid var(--border-light, #e2e8f0)', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'linear-gradient(135deg, #f43f5e, #fb923c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <AlertTriangle size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Quality Complaints
              </h2>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Defect Reporting & Complaint Resolution Logs
              </p>
            </div>
          </div>

          {/* Entry Buttons Top in Header */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {canCreateComplaint && (
              <button
                onClick={handleOpenNew}
                style={{
                  padding: '0.45rem 1rem', fontSize: '0.82rem', fontWeight: 800, borderRadius: '8px',
                  border: 'none', background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: '#fff',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <PlusCircle size={15} /> New Complaint Ticket
              </button>
            )}
            {canViewDashboard && (
              <button
                onClick={handleExportPDF}
                style={{
                  padding: '0.45rem 1rem', fontSize: '0.82rem', fontWeight: 800, borderRadius: '8px',
                  border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <FileText size={15} color="#e11d48" /> Export PDF
              </button>
            )}
            {isAdmin && (
              <button
                onClick={handleClearAllComplaints}
                style={{
                  padding: '0.45rem 1rem', fontSize: '0.82rem', fontWeight: 800, borderRadius: '8px',
                  border: '1px solid #fecdd3', background: '#fff1f2', color: '#e11d48',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
                title="Clear all test complaints and reset data"
              >
                <Trash2 size={15} color="#e11d48" /> Clear All Tickets
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dashboard View (Scoped by Permission) */}
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

              <DateRangePicker
                preset={datePreset}
                onChange={({ preset: p }) => setDatePreset(p)}
                customStart={customDateStart}
                customEnd={customDateEnd}
                onCustomChange={(s, e) => {
                  setCustomDateStart(s);
                  setCustomDateEnd(e);
                }}
              />

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
                const statusMeta = getStatusBadge(item?.status) || { bg: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: 'var(--border-light)' };
                const priorityColor = getPriorityColor(item?.priority);
                const statusOptions = Array.from(new Set([...STATUSES, item?.status].filter(Boolean)));

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
                        <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span>{item.date ? new Date(item.date).toLocaleDateString('en-IN') : ''}</span>
                          <span style={{ fontSize: '0.7rem', color: '#0284c7', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            👤 By: {item.createdByName || item.createdBy || 'Staff User'}
                          </span>
                          {item.updatedByName && item.updatedByName !== (item.createdByName || item.createdBy) && (
                            <span style={{ fontSize: '0.68rem', color: '#475569', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }}>
                              ✏️ Edit: {item.updatedByName}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Interactive Status Select Dropdown on Card Header */}
                      <select
                        value={item.status || 'Open'}
                        onChange={e => handleQuickStatusUpdate(item, e.target.value)}
                        onClick={e => e.stopPropagation()}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                          fontSize: '0.75rem', fontWeight: 800, padding: '0.25rem 0.6rem', borderRadius: '20px',
                          background: statusMeta.bg, color: statusMeta.color, border: `1.5px solid ${statusMeta.border}`,
                          cursor: 'pointer', outline: 'none'
                        }}
                      >
                        {statusOptions.map(st => (
                          <option key={st} value={st} style={{ background: '#1e293b', color: '#fff' }}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Customer, Assigned To & Responsible Person */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem', fontSize: '0.78rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.66rem' }}>Customer:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{item.partyName || 'N/A'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.66rem' }}>Assigned By:</span>
                        <strong style={{ color: '#60a5fa' }}>{item.assignedTo || 'Unassigned'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#f43f5e', display: 'block', fontSize: '0.66rem', fontWeight: 800 }}>Responsible Person:</span>
                        <strong style={{ color: '#f43f5e' }}>
                          {Array.isArray(item.responsiblePersons) && item.responsiblePersons.length > 0
                            ? item.responsiblePersons.join(', ')
                            : (item.responsiblePerson || 'Unassigned')}
                        </strong>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button
                          onClick={() => handleOpenViewModal(item)}
                          style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <Eye size={14} /> View & Resolve
                        </button>
                        <button
                          onClick={() => handleOpenViewModal(item)}
                          style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa', fontSize: '0.7rem', fontWeight: 700, borderRadius: '12px', padding: '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <MessageSquare size={12} /> {item.comments?.length || 0} Comments
                        </button>
                      </div>

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
            New Complaint Ticket
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
            <PlusCircle size={20} /> + New Complaint Ticket
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
                {editingItem ? `Edit Complaint (${formVal.complaintNo})` : 'New Complaint Ticket'}
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: '0.65rem' }}>
                  {/* Customer Name Dropdown */}
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Customer Name *</label>
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

                  {/* Assigned By (Dropdown with all ERP Users) */}
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase' }}>Assigned By *</label>
                    <select
                      value={formVal.assignedTo}
                      onChange={e => setFormVal({ ...formVal, assignedTo: e.target.value })}
                      style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                    >
                      <option value="">-- Select Assigned By (ERP User) --</option>
                      {staffList.map((sName, idx) => (
                        <option key={idx} value={sName}>{sName}</option>
                      ))}
                      {formVal.assignedTo && !staffList.includes(formVal.assignedTo) && (
                        <option value={formVal.assignedTo}>{formVal.assignedTo}</option>
                      )}
                    </select>
                  </div>

                  {/* Responsible Person (Multi-Select Pills for ERP Users) */}
                  <div style={{ marginTop: '0.75rem', gridColumn: '1 / -1' }}>
                    {(() => {
                      const safeRespPersons = Array.isArray(formVal.responsiblePersons)
                        ? formVal.responsiblePersons
                        : (typeof formVal.responsiblePerson === 'string' && formVal.responsiblePerson.trim()
                            ? formVal.responsiblePerson.split(',').map(s => s.trim()).filter(Boolean)
                            : []);
                      const safeStaffList = Array.isArray(staffList) ? staffList : [];

                      return (
                        <>
                          <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f43f5e', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                            <span>👥 Responsible Person (Select One or Multiple ERP Users) *</span>
                            <span style={{ fontSize: '0.68rem', color: '#f43f5e', fontWeight: 900, background: 'rgba(244,63,94,0.15)', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(244,63,94,0.3)' }}>
                              {safeRespPersons.length} Selected
                            </span>
                          </label>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', background: 'rgba(255,255,255,0.03)', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(244,63,94,0.3)', maxHeight: '130px', overflowY: 'auto' }}>
                            {safeStaffList.map((sName, idx) => {
                              const isSelected = safeRespPersons.includes(sName);
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    let nextList = [...safeRespPersons];
                                    if (isSelected) {
                                      nextList = nextList.filter(n => n !== sName);
                                    } else {
                                      nextList.push(sName);
                                    }
                                    setFormVal(prev => ({
                                      ...prev,
                                      responsiblePersons: nextList,
                                      responsiblePerson: nextList.join(', ')
                                    }));
                                  }}
                                  style={{
                                    padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, borderRadius: '20px',
                                    border: isSelected ? '1px solid #f43f5e' : '1px solid var(--border-light)',
                                    background: isSelected ? 'linear-gradient(135deg, #f43f5e, #e11d48)' : 'rgba(255,255,255,0.05)',
                                    color: isSelected ? '#ffffff' : 'var(--text-muted)',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem',
                                    boxShadow: isSelected ? '0 3px 10px rgba(244,63,94,0.3)' : 'none',
                                    transition: 'all 0.15s'
                                  }}
                                >
                                  {isSelected ? '✓ ' : '+ '} {sName}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* SECTION 2: ORDER LINKAGE WITH AUTO-FETCH */}
              <div style={{ background: 'var(--bg-main, #111827)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase' }}>
                    🔗 Order Linkage (Type any No. to Auto-Fill Data)
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const term = formVal.jobCardNo || formVal.challanNo || formVal.invoiceNo;
                      handleOrderLookup(term);
                    }}
                    disabled={lookupLoading}
                    style={{
                      padding: '0.25rem 0.65rem', fontSize: '0.72rem', fontWeight: 800, borderRadius: '4px',
                      border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(56,189,248,0.12)', color: '#38bdf8',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem'
                    }}
                  >
                    {lookupLoading ? <RefreshCw size={12} className="spin-loader" /> : <Search size={12} />}
                    ⚡ Auto-Fetch Details
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Job Card No.</label>
                    <input
                      type="text"
                      placeholder="e.g. JC-1001"
                      value={formVal.jobCardNo}
                      onChange={e => setFormVal({ ...formVal, jobCardNo: e.target.value })}
                      onBlur={e => handleOrderLookup(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleOrderLookup(e.target.value); } }}
                      style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Challan No.</label>
                    <input
                      type="text"
                      placeholder="e.g. EDP-CH-1001"
                      value={formVal.challanNo}
                      onChange={e => setFormVal({ ...formVal, challanNo: e.target.value })}
                      onBlur={e => handleOrderLookup(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleOrderLookup(e.target.value); } }}
                      style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Invoice No.</label>
                    <input
                      type="text"
                      placeholder="e.g. EDP-INV-1001"
                      value={formVal.invoiceNo}
                      onChange={e => setFormVal({ ...formVal, invoiceNo: e.target.value })}
                      onBlur={e => handleOrderLookup(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleOrderLookup(e.target.value); } }}
                      style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Design No. (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. ED-101"
                      value={formVal.designNo}
                      onChange={e => setFormVal({ ...formVal, designNo: e.target.value })}
                      style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                {/* Auto-Fetch Status Message */}
                {lookupMsg && (
                  <div style={{
                    marginTop: '0.65rem', padding: '0.45rem 0.75rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700,
                    background: lookupMsg.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    color: lookupMsg.type === 'success' ? '#4ade80' : '#f87171',
                    border: lookupMsg.type === 'success' ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(239,68,68,0.3)'
                  }}>
                    {lookupMsg.text}
                  </div>
                )}
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
                <div><strong>Assigned By:</strong> {showViewModal.assignedTo || 'Unassigned'}</div>
                <div style={{ color: '#f43f5e', fontWeight: 700 }}>
                  <strong>Responsible Person:</strong> {' '}
                  {Array.isArray(showViewModal.responsiblePersons) && showViewModal.responsiblePersons.length > 0
                    ? showViewModal.responsiblePersons.join(', ')
                    : (showViewModal.responsiblePerson || 'Unassigned')}
                </div>
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

              {/* COMMENTS & ACTIVITY TIMELINE */}
              <div style={{ background: 'var(--bg-main, #111827)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-light)', marginTop: '0.2rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <MessageSquare size={16} /> Ticket Activity & Comments Timeline ({showViewModal.comments?.length || 0})
                </div>

                {/* Comments List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '200px', overflowY: 'auto', marginBottom: '0.75rem', paddingRight: '0.25rem' }}>
                  {!showViewModal.comments || showViewModal.comments.length === 0 ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>No remarks or activity comments yet. Add the first comment below.</div>
                  ) : (
                    showViewModal.comments.map((cm, idx) => (
                      <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.78rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                          <span style={{ fontWeight: 800, color: cm.userName === 'System' ? '#f59e0b' : '#60a5fa' }}>
                            👤 {cm.userName}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            📅 {cm.createdAt ? new Date(cm.createdAt).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-primary)', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{cm.text}</div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment Input */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Add progress remark or comment with date & time..."
                    value={newCommentText}
                    onChange={e => setNewCommentText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddComment(showViewModal._id); }}
                    style={{ flex: 1, padding: '0.45rem 0.75rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddComment(showViewModal._id)}
                    disabled={postingComment || !newCommentText.trim()}
                    style={{
                      padding: '0.45rem 1rem', fontSize: '0.75rem', fontWeight: 800, borderRadius: '6px',
                      background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff', border: 'none',
                      cursor: postingComment || !newCommentText.trim() ? 'not-allowed' : 'pointer', opacity: postingComment || !newCommentText.trim() ? 0.5 : 1
                    }}
                  >
                    {postingComment ? 'Posting...' : '💬 Post Comment'}
                  </button>
                </div>
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
