import React, { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { api } from '../services/api';
import imageCompression from 'browser-image-compression';
import DateRangePicker, { getDatePresetRange } from './DateRangePicker';
import {
  Palette,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  RefreshCw,
  ExternalLink,
  Eye,
  AlertTriangle,
  History,
  X,
  Plus,
  Layers,
  ChevronRight,
  Sparkles,
  FileCheck,
  Check,
  Ban,
  RotateCcw,
  User,
  Scissors,
  Download,
  Calendar,
  ArrowRight,
  Edit2,
  Trash2,
  Link as LinkIcon,
  Video as VideoIcon,
  LayoutGrid,
  List,
  ShieldAlert
} from 'lucide-react';
import { triggerPushNotification } from './NotificationToast';

// ─── Status Definitions ────────────────────────────────────────────────────────
export const DROW_STATUS_OPTIONS = [
  { id: 'START WORKING', label: 'START WORKING', color: '#0284c7', bg: '#eff6ff', border: '#bfdbfe', icon: Clock },
  { id: 'REVIEW SAMPLE', label: 'REVIEW SAMPLE', color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: AlertTriangle },
  { id: 'FINAL SAMPLE', label: 'FINAL SAMPLE', color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe', icon: FileCheck },
];

export const COLOUR_MATCHING_OPTIONS = [
  { id: 'COLOUR PANTON', label: 'COLOUR PANTON', color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8', icon: Palette },
  { id: 'REVIEW SAMPLE', label: 'REVIEW SAMPLE', color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: AlertTriangle },
  { id: 'FINAL SAMPLE', label: 'FINAL SAMPLE', color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe', icon: FileCheck },
];

export const FINAL_DESIGN_OPTIONS = [
  { id: 'FINAL SAMPLE', label: 'FINAL SAMPLE', color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe', icon: FileCheck },
  { id: 'REJECT SAMPLE DRAWING', legacyId: 'REJECT SAMPLE drowning', label: 'REJECT DRAWING', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: Ban },
  { id: 'REJECT SAMPLE FOR C.M.', legacyId: 'REJECT SAMPLE FOR C.M.', label: 'REJECT C.M.', color: '#ea580c', bg: '#fff7ed', border: '#ffedd5', icon: RotateCcw },
  { id: 'APPROVED SAMPLE', label: 'APPROVED SAMPLE', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: CheckCircle2 },
];

export const PRIORITY_STYLES = {
  Urgent: { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5', badge: '🔴' },
  High: { bg: '#ffedd5', color: '#ea580c', border: '#fdba74', badge: '🟠' },
  Medium: { bg: '#fef9c3', color: '#ca8a04', border: '#fde047', badge: '🟡' },
  Low: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', badge: '🟢' },
};

/**
 * Modern multi-select tag picker with dropdown & custom input support
 */
function MultiSelectBox({
  label,
  icon: Icon,
  options = [],
  selected = [],
  onChange,
  tagTheme = { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }
}) {
  const [customVal, setCustomVal] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const availableOptions = useMemo(() => {
    const set = new Set(selected.map(s => String(s).trim().toLowerCase()));
    return options.filter(opt => opt && !set.has(String(opt).trim().toLowerCase()));
  }, [options, selected]);

  const handleSelect = (e) => {
    const val = e.target.value;
    if (val === '__custom__') {
      setShowCustomInput(true);
    } else if (val) {
      if (!selected.includes(val)) {
        onChange([...selected, val]);
      }
    }
    e.target.value = '';
  };

  const handleAddCustom = () => {
    const trimmed = customVal.trim();
    if (trimmed && !selected.includes(trimmed)) {
      onChange([...selected, trimmed]);
    }
    setCustomVal('');
    setShowCustomInput(false);
  };

  const handleRemove = (itemToRemove) => {
    onChange(selected.filter(item => item !== itemToRemove));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {Icon && <Icon size={13} color="#2563eb" />}
          <span>{label}</span>
          {selected.length > 0 && (
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '0 6px' }}>
              {selected.length}
            </span>
          )}
        </label>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.68rem', cursor: 'pointer', padding: 0 }}
          >
            Clear all
          </button>
        )}
      </div>

      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', padding: '0.45rem', background: '#f8faff', border: '1px solid #dbeafe', borderRadius: '8px' }}>
          {selected.map((item, idx) => (
            <span
              key={idx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.2rem 0.55rem',
                background: tagTheme.bg,
                color: tagTheme.color,
                border: `1px solid ${tagTheme.border}`,
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                boxShadow: '0 1px 3px rgba(37,99,235,0.06)'
              }}
            >
              <span>{item}</span>
              <button
                type="button"
                onClick={() => handleRemove(item)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  color: '#ef4444'
                }}
                title={`Remove ${item}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <select
        value=""
        onChange={handleSelect}
        style={{
          width: '100%',
          fontSize: '0.85rem',
          padding: '0.52rem 0.75rem',
          background: '#ffffff',
          color: '#0f172a',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          outline: 'none'
        }}
      >
        <option value="">+ Add {label}...</option>
        {availableOptions.map((opt, i) => (
          <option key={i} value={opt}>{opt}</option>
        ))}
        <option value="__custom__">+ Enter Custom {label}...</option>
      </select>

      {showCustomInput && (
        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.15rem' }}>
          <input
            type="text"
            value={customVal}
            onChange={e => setCustomVal(e.target.value)}
            placeholder={`Enter custom ${label.toLowerCase()}...`}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustom();
              } else if (e.key === 'Escape') {
                setShowCustomInput(false);
              }
            }}
            autoFocus
            style={{
              flex: 1,
              fontSize: '0.82rem',
              padding: '0.4rem 0.6rem',
              border: '1.5px solid #2563eb',
              borderRadius: '6px',
              outline: 'none',
              background: '#ffffff',
              color: '#0f172a'
            }}
          />
          <button
            type="button"
            onClick={handleAddCustom}
            style={{
              padding: '0.4rem 0.75rem',
              fontSize: '0.78rem',
              fontWeight: 800,
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => { setShowCustomInput(false); setCustomVal(''); }}
            style={{
              padding: '0.4rem 0.6rem',
              fontSize: '0.78rem',
              background: '#f1f5f9',
              color: '#64748b',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

const DesignerScreen = forwardRef(function DesignerScreen(
  { currentUser, isAdmin = false, onNavigate, embedded = false },
  ref
) {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── User Role & Strict Designer / Colour Matcher Access ─────────────────────
  const effectiveUser = currentUser || api.getCurrentUser() || {};
  const isMasterAdmin = Boolean(
    effectiveUser?.isMainAdmin ||
    (effectiveUser?.role || '').toLowerCase() === 'admin' ||
    (effectiveUser?.role || '').toLowerCase() === 'master_admin' ||
    (effectiveUser?.role || '').toLowerCase() === 'master' ||
    (effectiveUser?.username || '').toLowerCase() === 'admin' ||
    (effectiveUser?.username || '').toLowerCase() === 'master' ||
    (effectiveUser?.email || '').toLowerCase() === 'harshitsidapara2468@gmail.com' ||
    (effectiveUser?.email || '').toLowerCase() === 'admin@elite.com'
  );
  const isUserAdmin = isAdmin || isMasterAdmin;
  const userAssignedName = (currentUser?.designerName || currentUser?.name || '').trim();
  const isUserRestricted = !isUserAdmin && !embedded;
  const isDesignerRestricted = isUserRestricted;
  const canInputNewDesign = isUserAdmin ||
    embedded ||
    !currentUser ||
    Boolean(currentUser?.canInputNewDesign) ||
    currentUser?.permissions?.includes('input_new_design') ||
    currentUser?.permissions?.includes('jobcards_catalogue') ||
    currentUser?.permissions?.includes('jobcards');

  // Dropdown options from settings
  const [printConfig, setPrintConfig] = useState({ designers: [], fabrics: [] });

  // View Mode & Operational Stage Tabs
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [stageTab, setStageTab] = useState('ALL'); // 'ALL' | 'DROW' | 'CM' | 'PENDING_APPROVAL' | 'APPROVED' | 'REVISION'

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [selectedDesigner, setSelectedDesigner] = useState('All');
  const [selectedFabric, setSelectedFabric] = useState('All');
  const [drowFilter, setDrowFilter] = useState('All');
  const [cmFilter, setCmFilter] = useState('All');
  const [finalFilter, setFinalFilter] = useState('All');

  // Create / Edit Design Task Modal State
  const initialTaskForm = {
    date: new Date().toISOString().split('T')[0],
    designName: '',
    fabrics: [],
    fabricName: '',
    designers: [],
    designerName: '',
    colourMatches: [],
    colourMatching: '',
    priority: 'Medium',
    sampleImage: '',
    sampleLink: '',
    notes: '',
  };
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [taskFormData, setTaskFormData] = useState(initialTaskForm);
  const [savingTask, setSavingTask] = useState(false);
  const [uploadingSampleImage, setUploadingSampleImage] = useState(false);

  const activeDateRange = useMemo(
    () => getDatePresetRange(datePreset, customDateStart, customDateEnd),
    [datePreset, customDateStart, customDateEnd]
  );

  // Status Update & Multi-Image Upload Modal
  const [activeModalData, setActiveModalData] = useState(null);
  // shape: { task, category: 'drow_design' | 'colour_matching' | 'final_design', statusType, currentStatus, newStatus }

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [uploadNote, setUploadNote] = useState('');
  const [uploadLink, setUploadLink] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // History & Image Lightbox Modals
  const [historyTask, setHistoryTask] = useState(null);
  const [lightboxImages, setLightboxImages] = useState(null); // { images: [], activeIndex: 0, title: '' }

  // Resolve effective designer identifier from currentUser profile & registered designers
  const effectiveDesignerTokens = useMemo(() => {
    const dName = (currentUser?.designerName || '').trim();
    const uName = (currentUser?.name || '').trim();
    const tokens = new Set();
    if (dName) tokens.add(dName.toLowerCase());
    if (uName) {
      tokens.add(uName.toLowerCase());
      uName.split(/[\s._-]+/).forEach(p => {
        if (p.length >= 2) tokens.add(p.toLowerCase());
      });
    }

    // Also check if any registered designer in settings matches any of user's tokens
    (printConfig.designers || []).forEach(des => {
      const dLower = String(des).toLowerCase();
      if (tokens.has(dLower) || Array.from(tokens).some(t => dLower === t || dLower.includes(t) || t.includes(dLower))) {
        tokens.add(dLower);
      }
    });

    return Array.from(tokens);
  }, [currentUser?.designerName, currentUser?.name, printConfig.designers]);

  const primaryDesignerIdentifier = useMemo(() => {
    if (currentUser?.designerName) return currentUser.designerName;
    const matched = (printConfig.designers || []).find(des => {
      const dLow = String(des).toLowerCase();
      return effectiveDesignerTokens.includes(dLow);
    });
    return matched || userAssignedName || '';
  }, [currentUser?.designerName, printConfig.designers, effectiveDesignerTokens, userAssignedName]);

  // Load Data
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const activeAssignedUserParam = isUserRestricted
        ? (primaryDesignerIdentifier || userAssignedName || '__NO_NAME_ASSIGNED__')
        : (selectedDesigner !== 'All' ? selectedDesigner : '');

      const [cfg, resTasks, resStats] = await Promise.all([
        api.getPrintConfig().catch(() => ({})),
        api.getDesignerTasks({
          startDate: activeDateRange.dateStart || '',
          endDate: activeDateRange.dateEnd || '',
          assignedUser: isUserRestricted ? activeAssignedUserParam : undefined,
          designerName: !isUserRestricted && selectedDesigner !== 'All' ? selectedDesigner : undefined,
          fabricName: selectedFabric,
          drowDesignStatus: drowFilter,
          colourMatchingStatus: cmFilter,
          finalDesignStatus: finalFilter,
          search: searchQuery,
        }),
        api.getDesignerStats(isUserRestricted ? { assignedUser: activeAssignedUserParam } : {}).catch(() => null),
      ]);

      if (cfg) {
        setPrintConfig({
          designers: Array.isArray(cfg.designers) ? cfg.designers : [],
          fabrics: Array.isArray(cfg.fabrics) ? cfg.fabrics : [],
        });
      }

      if (resTasks && resTasks.data) {
        setTasks(resTasks.data);
      }
      if (resStats && resStats.data) {
        setStats(resStats.data);
      }
    } catch (err) {
      console.error('Failed to load designer screen data:', err);
      setError(err.message || 'Error loading design tasks');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [
    activeDateRange.dateStart,
    activeDateRange.dateEnd,
    selectedDesigner,
    selectedFabric,
    drowFilter,
    cmFilter,
    finalFilter,
    userAssignedName,
    primaryDesignerIdentifier,
  ]);

  // Real-time listener
  useEffect(() => {
    const handleRefresh = () => loadData(true);
    window.addEventListener('elite-data-refresh', handleRefresh);
    return () => window.removeEventListener('elite-data-refresh', handleRefresh);
  }, [
    activeDateRange.dateStart,
    activeDateRange.dateEnd,
    selectedDesigner,
    selectedFabric,
    drowFilter,
    cmFilter,
    finalFilter,
    userAssignedName,
    primaryDesignerIdentifier,
  ]);

  // Stage tab statistics based on current active list
  const stageCounts = useMemo(() => {
    let drow = 0, cm = 0, pending = 0, approved = 0, revision = 0;
    let base = tasks;
    if (isUserRestricted) {
      if (effectiveDesignerTokens.length === 0) return { all: 0, drow: 0, cm: 0, pending: 0, approved: 0, revision: 0 };
      base = base.filter(t => {
        const checkMatch = (val) => {
          if (!val) return false;
          const str = String(val).toLowerCase().trim();
          return effectiveDesignerTokens.some(tok => str === tok || str.includes(tok) || tok.includes(str));
        };
        return checkMatch(t.designerName) || (Array.isArray(t.designers) && t.designers.some(checkMatch)) ||
               checkMatch(t.colourMatching) || (Array.isArray(t.colourMatches) && t.colourMatches.some(checkMatch));
      });
    }

    base.forEach(t => {
      const isApproved = t.finalDesignStatus === 'APPROVED SAMPLE';
      const isRevision = String(t.finalDesignStatus || '').startsWith('REJECT');
      if (isApproved) {
        approved++;
      } else if (isRevision) {
        revision++;
      } else if (t.drowDesignStatus === 'FINAL SAMPLE' || t.colourMatchingStatus === 'FINAL SAMPLE') {
        pending++;
      } else if (t.colourMatchingStatus && t.colourMatchingStatus !== 'START WORKING') {
        cm++;
      } else {
        drow++;
      }
    });
    return { all: base.length, drow, cm, pending, approved, revision };
  }, [tasks, isUserRestricted, effectiveDesignerTokens]);

  // Client-side quick filter: STRICT isolation for non-admin users
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Strict non-admin user isolation: user MUST be in designers OR colourMatches
    if (isUserRestricted) {
      if (effectiveDesignerTokens.length === 0) {
        return []; // Non-admin without assigned profile cannot see any designs
      }

      result = result.filter(t => {
        const checkMatch = (val) => {
          if (!val) return false;
          const str = String(val).toLowerCase().trim();
          return effectiveDesignerTokens.some(tok => str === tok || str.includes(tok) || tok.includes(str));
        };

        const isDesigner = checkMatch(t.designerName) || (Array.isArray(t.designers) && t.designers.some(checkMatch));
        const isColourMatcher = checkMatch(t.colourMatching) || (Array.isArray(t.colourMatches) && t.colourMatches.some(checkMatch));

        // Design is ONLY visible if user is named in Designer OR Colour Matching
        return isDesigner || isColourMatcher;
      });
    }

    // Filter by Operational Stage Tab
    if (stageTab !== 'ALL') {
      result = result.filter(t => {
        const isApproved = t.finalDesignStatus === 'APPROVED SAMPLE';
        const isRevision = String(t.finalDesignStatus || '').startsWith('REJECT');
        if (stageTab === 'APPROVED') return isApproved;
        if (stageTab === 'REVISION') return isRevision;
        if (stageTab === 'PENDING_APPROVAL') {
          return !isApproved && !isRevision && (t.drowDesignStatus === 'FINAL SAMPLE' || t.colourMatchingStatus === 'FINAL SAMPLE');
        }
        if (stageTab === 'CM') {
          return !isApproved && !isRevision && t.colourMatchingStatus && t.colourMatchingStatus !== 'START WORKING';
        }
        if (stageTab === 'DROW') {
          return !isApproved && !isRevision && (t.drowDesignStatus === 'START WORKING' || t.drowDesignStatus === 'REVIEW SAMPLE' || !t.drowDesignStatus);
        }
        return true;
      });
    }

    if (!searchQuery.trim()) return result;
    const q = searchQuery.toLowerCase().trim();
    return result.filter((t) => {
      const taskNo = String(t.taskNo || '').toLowerCase();
      const designName = String(t.designName || '').toLowerCase();
      const designer = String(t.designerName || '').toLowerCase();
      const fabric = String(t.fabricName || '').toLowerCase();
      const cm = String(t.colourMatching || '').toLowerCase();
      const drowSt = String(t.drowDesignStatus || '').toLowerCase();
      const cmSt = String(t.colourMatchingStatus || '').toLowerCase();
      const finSt = String(t.finalDesignStatus || '').toLowerCase();
      return (
        taskNo.includes(q) ||
        designName.includes(q) ||
        designer.includes(q) ||
        fabric.includes(q) ||
        cm.includes(q) ||
        drowSt.includes(q) ||
        cmSt.includes(q) ||
        finSt.includes(q)
      );
    });
  }, [tasks, searchQuery, stageTab, isUserRestricted, effectiveDesignerTokens]);

  // Create & Edit Task Handlers
  const handleOpenCreate = () => {
    if (!canInputNewDesign) {
      alert('You do not have permission to input new designs. Please contact an Administrator.');
      return;
    }
    setEditingId(null);
    setTaskFormData({
      ...initialTaskForm,
      date: new Date().toISOString().split('T')[0],
      fabrics: [],
      fabricName: '',
      designers: isUserRestricted && userAssignedName ? [userAssignedName] : [],
      designerName: isUserRestricted && userAssignedName ? userAssignedName : '',
      colourMatches: [],
      colourMatching: '',
    });
    setShowCreateModal(true);
  };

  useImperativeHandle(ref, () => ({
    openCreateModal: handleOpenCreate,
    refreshData: () => loadData(false)
  }));

  const handleOpenEdit = (task) => {
    setEditingId(task._id);
    const taskFabrics = Array.isArray(task.fabrics) && task.fabrics.length > 0
      ? task.fabrics
      : (task.fabricName ? task.fabricName.split(',').map(s => s.trim()).filter(Boolean) : []);

    const taskDesigners = Array.isArray(task.designers) && task.designers.length > 0
      ? task.designers
      : (task.designerName ? task.designerName.split(',').map(s => s.trim()).filter(Boolean) : []);

    const taskColourMatches = Array.isArray(task.colourMatches) && task.colourMatches.length > 0
      ? task.colourMatches
      : (task.colourMatching ? task.colourMatching.split(',').map(s => s.trim()).filter(Boolean) : []);

    setTaskFormData({
      date: task.date || new Date().toISOString().split('T')[0],
      designName: task.designName || '',
      fabrics: taskFabrics,
      fabricName: taskFabrics.join(', '),
      designers: taskDesigners,
      designerName: taskDesigners.join(', '),
      colourMatches: taskColourMatches,
      colourMatching: taskColourMatches.join(', '),
      priority: task.priority || 'Medium',
      sampleImage: task.sampleImage || '',
      sampleLink: task.sampleLink || '',
      notes: task.notes || '',
    });
    setShowCreateModal(true);
  };

  const handleDeleteTask = async (task) => {
    if (!window.confirm(`Are you sure you want to delete design task "${task.taskNo} - ${task.designName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.deleteDesignerTask(task._id);
      triggerPushNotification('Task Deleted', `Design task ${task.taskNo} removed.`, 'warning');
      loadData(true);
    } catch (err) {
      alert('Failed to delete task: ' + err.message);
    }
  };

  const handleSampleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingSampleImage(true);
    try {
      const options = {
        maxSizeMB: 1.5,
        maxWidthOrHeight: 2048,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);
      const res = await api.uploadDesignerImage(compressedFile, 'sample_reference');
      if (res && res.url) {
        setTaskFormData(prev => ({ ...prev, sampleImage: res.url }));
        triggerPushNotification('Sample Reference Uploaded', 'Stored securely on Cloudflare R2', 'success');
      }
    } catch (err) {
      console.error('Sample image upload failed:', err);
      alert('Failed to upload image to R2: ' + err.message);
    } finally {
      setUploadingSampleImage(false);
    }
  };

  const handleSubmitTask = async (e) => {
    e.preventDefault();
    const finalDesignName = (taskFormData.designName && taskFormData.designName.trim())
      ? taskFormData.designName.trim()
      : `Design-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    const fabricsList = taskFormData.fabrics || [];
    const designersList = taskFormData.designers || [];
    const colourMatchesList = taskFormData.colourMatches || [];

    const submissionPayload = {
      ...taskFormData,
      designName: finalDesignName,
      fabrics: fabricsList,
      fabricName: fabricsList.join(', '),
      designers: designersList,
      designerName: designersList.join(', '),
      colourMatches: colourMatchesList,
      colourMatching: colourMatchesList.join(', ')
    };

    setSavingTask(true);
    try {
      if (editingId) {
        await api.updateDesignerTask(editingId, submissionPayload);
        triggerPushNotification('Design Task Updated', `Design "${finalDesignName}" updated.`, 'success');
      } else {
        await api.createDesignerTask(submissionPayload);
        triggerPushNotification('Design Task Created', `New design task "${finalDesignName}" registered.`, 'success');
      }
      setShowCreateModal(false);
      loadData(true);
    } catch (err) {
      console.error('Failed to save task:', err);
      alert('Error saving task: ' + err.message);
    } finally {
      setSavingTask(false);
    }
  };

  // Open the Status & Image Modal
  const handleOpenStatusModal = (task, category, statusType, statusValue = '') => {
    if (embedded) return;
    setActiveModalData({
      task,
      category,
      statusType,
      currentStatus:
        category === 'drow_design'
          ? task.drowDesignStatus
          : category === 'colour_matching'
          ? task.colourMatchingStatus
          : task.finalDesignStatus,
      newStatus: statusValue,
    });
    setSelectedFiles([]);
    setFilePreviews([]);
    setUploadNote('');
    setUploadLink('');
    setUploadProgress(0);
  };

  // Handle multi-file selection
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setSelectedFiles((prev) => [...prev, ...files]);

    // Generate local previews
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreviews((prev) => [...prev, { name: file.name, size: file.size, previewUrl: reader.result }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveSelectedFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Status Change & Upload Images to Cloudflare R2
  const handleSubmitStatusUpdate = async (e) => {
    e.preventDefault();
    if (!activeModalData) return;

    const { task, category, statusType, newStatus } = activeModalData;
    const targetStatus = newStatus || (
      category === 'drow_design'
        ? task.drowDesignStatus
        : category === 'colour_matching'
        ? task.colourMatchingStatus
        : task.finalDesignStatus
    );

    if (!targetStatus && selectedFiles.length === 0) {
      alert('Please select a status or at least one image to upload.');
      return;
    }

    setUploading(true);
    setUploadProgress(5);

    try {
      const uploadedUrls = [];

      // Sequentially compress and upload each file to Cloudflare R2
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        let fileToUpload = file;

        // Compress images
        if (file.type.startsWith('image/')) {
          try {
            const options = { maxSizeMB: 1.5, maxWidthOrHeight: 2048, useWebWorker: true };
            fileToUpload = await imageCompression(file, options);
          } catch (compErr) {
            console.warn('Image compression skipped for', file.name, compErr);
          }
        }

        const folder = `designs/${category}`;
        const res = await api.uploadImage(fileToUpload, folder);
        if (res && res.url) {
          uploadedUrls.push(res.url);
        }
        setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 85));
      }

      // Update task stage in MongoDB
      const payload = {
        category,
        statusType,
        statusValue: targetStatus,
        stage: targetStatus,
        images: uploadedUrls,
        note: uploadNote.trim(),
        outputLink: uploadLink.trim(),
      };

      await api.updateDesignerTaskStage(task._id, payload);
      setUploadProgress(100);

      triggerPushNotification(
        '🎨 Status Updated',
        `${task.taskNo}: ${statusType} set to "${targetStatus || 'Image Upload'}" with ${uploadedUrls.length} image(s) stored in R2.`,
        'success'
      );

      setActiveModalData(null);
      loadData(true);
    } catch (err) {
      console.error('Failed to update designer status:', err);
      alert('Failed to update status: ' + err.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Helper for Opening Lightbox Gallery
  const handleOpenLightbox = (images = [], startIndex = 0, title = 'Sample Images') => {
    if (!images || images.length === 0) return;
    setLightboxImages({
      images,
      activeIndex: startIndex,
      title,
    });
  };

  // Helper to compute workflow stage states for each task
  const getTaskStageProgress = (task) => {
    const isFinalApproved = task.finalDesignStatus === 'APPROVED SAMPLE';
    const isFinalRejectedDrow = task.finalDesignStatus === 'REJECT SAMPLE DRAWING' || task.finalDesignStatus === 'REJECT SAMPLE drowning';
    const isFinalRejectedCM = task.finalDesignStatus === 'REJECT SAMPLE FOR C.M.';

    let s1 = 'pending';
    if (task.drowDesignStatus === 'FINAL SAMPLE') s1 = 'done';
    else if (task.drowDesignStatus) s1 = 'active';
    if (isFinalRejectedDrow) s1 = 'revision';

    let s2 = 'pending';
    if (task.colourMatchingStatus === 'FINAL SAMPLE') s2 = 'done';
    else if (task.colourMatchingStatus) s2 = 'active';
    if (isFinalRejectedCM) s2 = 'revision';

    let s3 = 'pending';
    if (isFinalApproved) s3 = 'approved';
    else if (isFinalRejectedDrow || isFinalRejectedCM) s3 = 'revision';
    else if (task.finalDesignStatus) s3 = 'active';

    return { s1, s2, s3, isFinalApproved, isFinalRejectedDrow, isFinalRejectedCM };
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '1600px', margin: '0 auto', color: '#0f172a', boxSizing: 'border-box' }}>
      {/* ─── Top Header Bar ────────────────────────────────────────────── */}
      {embedded ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.65rem',
            marginBottom: '1rem',
            paddingBottom: '0.65rem',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                borderRadius: '12px',
                padding: '0.15rem 0.6rem',
              }}
            >
              {filteredTasks.length} {filteredTasks.length === 1 ? 'Design' : 'Designs'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* View Mode Toggle (Cards / Table) */}
            <div
              style={{
                display: 'inline-flex',
                background: '#f1f5f9',
                padding: '3px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.7rem',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: viewMode === 'grid' ? '#ffffff' : 'transparent',
                  color: viewMode === 'grid' ? '#2563eb' : '#64748b',
                  boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                }}
                title="Cards Grid View"
              >
                <LayoutGrid size={13} /> <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.7rem',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: viewMode === 'table' ? '#ffffff' : 'transparent',
                  color: viewMode === 'table' ? '#2563eb' : '#64748b',
                  boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                }}
                title="High-Density Table View"
              >
                <List size={13} /> <span>Table</span>
              </button>
            </div>

            <button
              onClick={() => loadData(false)}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.42rem 0.8rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#334155',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleOpenCreate}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.42rem 0.95rem',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
              }}
            >
              <Plus size={14} /> <span>Input New Design</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.25rem',
            paddingBottom: '1rem',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 14px rgba(29, 78, 216, 0.3)',
                flexShrink: 0,
              }}
            >
              <Palette size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                  Designer Screen
                </h1>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    borderRadius: '12px',
                    padding: '0.15rem 0.6rem',
                  }}
                >
                  {filteredTasks.length} {filteredTasks.length === 1 ? 'Design' : 'Designs'}
                </span>
              </div>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
                Live Design Workflow • Cloudflare R2 Proofs • Drawing & Colour Matching Studio
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* View Mode Toggle (Cards / Table) */}
            <div
              style={{
                display: 'inline-flex',
                background: '#f1f5f9',
                padding: '3px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: viewMode === 'grid' ? '#ffffff' : 'transparent',
                  color: viewMode === 'grid' ? '#2563eb' : '#64748b',
                  boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                }}
                title="Cards Grid View"
              >
                <LayoutGrid size={14} /> <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: viewMode === 'table' ? '#ffffff' : 'transparent',
                  color: viewMode === 'table' ? '#2563eb' : '#64748b',
                  boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                }}
                title="High-Density Table View"
              >
                <List size={14} /> <span>Table</span>
              </button>
            </div>

            <button
              onClick={() => loadData(false)}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.85rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#334155',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── Metric Stats Strip ────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: embedded ? '0.65rem' : '0.85rem',
          marginBottom: embedded ? '0.85rem' : '1.25rem',
        }}
      >
        {/* Draw Design Metrics Card */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #dbeafe',
            borderTop: '3px solid #2563eb',
            borderRadius: '12px',
            padding: embedded ? '0.65rem 0.8rem' : '0.9rem',
            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: embedded ? '0.4rem' : '0.6rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={14} color="#2563eb" /> 1. Drow Design Status
            </span>
            <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, background: '#f8fafc', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>Stage 1</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
            <div style={{ flex: 1, background: '#eff6ff', padding: embedded ? '0.35rem 0.4rem' : '0.5rem 0.5rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#1d4ed8' }}>START WORK</div>
              <div style={{ fontSize: embedded ? '1.05rem' : '1.2rem', fontWeight: 800, color: '#1e3a8a' }}>{stats?.drow?.startWorking || 0}</div>
            </div>
            <div style={{ flex: 1, background: '#fffbeb', padding: embedded ? '0.35rem 0.4rem' : '0.5rem 0.5rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#b45309' }}>REVIEW</div>
              <div style={{ fontSize: embedded ? '1.05rem' : '1.2rem', fontWeight: 800, color: '#92400e' }}>{stats?.drow?.reviewSample || 0}</div>
            </div>
            <div style={{ flex: 1, background: '#eef2ff', padding: embedded ? '0.35rem 0.4rem' : '0.5rem 0.5rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#4338ca' }}>FINAL</div>
              <div style={{ fontSize: embedded ? '1.05rem' : '1.2rem', fontWeight: 800, color: '#312e81' }}>{stats?.drow?.finalSample || 0}</div>
            </div>
          </div>
        </div>

        {/* Colour Matching Metrics Card */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #fce7f3',
            borderTop: '3px solid #db2777',
            borderRadius: '12px',
            padding: embedded ? '0.65rem 0.8rem' : '0.9rem',
            boxShadow: '0 2px 6px rgba(219, 39, 119, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: embedded ? '0.4rem' : '0.6rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#9d174d', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Palette size={14} color="#db2777" /> 2. Colour Matching Status
            </span>
            <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, background: '#f8fafc', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>Stage 2</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
            <div style={{ flex: 1, background: '#fdf2f8', padding: embedded ? '0.35rem 0.4rem' : '0.5rem 0.5rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#be185d' }}>PANTON</div>
              <div style={{ fontSize: embedded ? '1.05rem' : '1.2rem', fontWeight: 800, color: '#831843' }}>{stats?.cm?.colourPanton || 0}</div>
            </div>
            <div style={{ flex: 1, background: '#fffbeb', padding: embedded ? '0.35rem 0.4rem' : '0.5rem 0.5rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#b45309' }}>REVIEW</div>
              <div style={{ fontSize: embedded ? '1.05rem' : '1.2rem', fontWeight: 800, color: '#92400e' }}>{stats?.cm?.reviewSample || 0}</div>
            </div>
            <div style={{ flex: 1, background: '#eef2ff', padding: embedded ? '0.35rem 0.4rem' : '0.5rem 0.5rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#4338ca' }}>FINAL</div>
              <div style={{ fontSize: embedded ? '1.05rem' : '1.2rem', fontWeight: 800, color: '#312e81' }}>{stats?.cm?.finalSample || 0}</div>
            </div>
          </div>
        </div>

        {/* Final Design Status Metrics Card */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #dcfce7',
            borderTop: '3px solid #16a34a',
            borderRadius: '12px',
            padding: embedded ? '0.65rem 0.8rem' : '0.9rem',
            boxShadow: '0 2px 6px rgba(22, 163, 74, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: embedded ? '0.4rem' : '0.6rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CheckCircle2 size={14} color="#16a34a" /> 3. Final Design Status
            </span>
            <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, background: '#f8fafc', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>Stage 3</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem' }}>
            <div style={{ flex: 1, background: '#f0fdf4', padding: embedded ? '0.35rem 0.35rem' : '0.5rem 0.4rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#15803d' }}>APPROVED</div>
              <div style={{ fontSize: embedded ? '1.05rem' : '1.2rem', fontWeight: 800, color: '#14532d' }}>{stats?.final?.approvedSample || 0}</div>
            </div>
            <div style={{ flex: 1, background: '#fef2f2', padding: embedded ? '0.35rem 0.35rem' : '0.5rem 0.4rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#b91c1c' }}>REJ DROW</div>
              <div style={{ fontSize: embedded ? '1.05rem' : '1.2rem', fontWeight: 800, color: '#7f1d1d' }}>{stats?.final?.rejectDrow || 0}</div>
            </div>
            <div style={{ flex: 1, background: '#fff7ed', padding: embedded ? '0.35rem 0.35rem' : '0.5rem 0.4rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#c2410c' }}>REJ C.M.</div>
              <div style={{ fontSize: embedded ? '1.05rem' : '1.2rem', fontWeight: 800, color: '#7c2d12' }}>{stats?.final?.rejectCM || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Operational Stage Navigation Tabs ───────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: '0.4rem',
          overflowX: 'auto',
          paddingBottom: '0.35rem',
          marginBottom: '1rem',
          scrollbarWidth: 'thin',
        }}
      >
        {[
          { id: 'ALL', label: 'All Designs', count: stageCounts.all, color: '#1d4ed8', bg: '#eff6ff' },
          { id: 'DROW', label: '1. Drawing', count: stageCounts.drow, color: '#0284c7', bg: '#f0f9ff' },
          { id: 'CM', label: '2. Colour Match', count: stageCounts.cm, color: '#db2777', bg: '#fdf2f8' },
          { id: 'PENDING_APPROVAL', label: '3. Pending Gate', count: stageCounts.pending, color: '#ca8a04', bg: '#fefce8' },
          { id: 'APPROVED', label: 'Approved', count: stageCounts.approved, color: '#16a34a', bg: '#f0fdf4' },
          { id: 'REVISION', label: 'Revisions', count: stageCounts.revision, color: '#dc2626', bg: '#fef2f2' },
        ].map((tab) => {
          const isActive = stageTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setStageTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: isActive ? `1.5px solid ${tab.color}` : '1px solid #cbd5e1',
                background: isActive ? tab.color : '#ffffff',
                color: isActive ? '#ffffff' : '#475569',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: isActive ? `0 2px 8px ${tab.color}35` : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '0.1rem 0.45rem',
                  borderRadius: '10px',
                  background: isActive ? 'rgba(255, 255, 255, 0.25)' : tab.bg,
                  color: isActive ? '#ffffff' : tab.color,
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── Search & Date Range Toolbar ───────────────────────────────── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '0.85rem 1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
          <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search design, task #, fabric, designer..."
            style={{
              width: '100%',
              padding: '0.48rem 0.75rem 0.48rem 2.1rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.82rem',
              background: '#f8fafc',
              color: '#0f172a',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Date Range Picker */}
        <div style={{ flex: '0 0 auto' }}>
          <DateRangePicker
            datePreset={datePreset}
            setDatePreset={setDatePreset}
            customDateStart={customDateStart}
            setCustomDateStart={setCustomDateStart}
            customDateEnd={customDateEnd}
            setCustomDateEnd={setCustomDateEnd}
            theme="light"
          />
        </div>

        {/* Designer Filter */}
        <div style={{ flex: '0 0 auto' }}>
          {isUserRestricted ? (
            <div
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: '1.5px solid #bfdbfe',
                fontSize: '0.82rem',
                background: '#eff6ff',
                color: '#1d4ed8',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              title="Locked to your assigned designs & colour matching tasks"
            >
              <User size={13} color="#2563eb" />
              <span>👤 My Designs & C.M.: {userAssignedName || 'Not Configured'}</span>
            </div>
          ) : (
            <select
              value={selectedDesigner}
              onChange={(e) => setSelectedDesigner(e.target.value)}
              style={{
                padding: '0.48rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                background: '#ffffff',
                color: '#0f172a',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="All">👤 All Designers & Staff</option>
              {printConfig.designers.map((d, i) => (
                <option key={i} value={d}>{d}</option>
              ))}
            </select>
          )}
        </div>

        {/* Fabric Dropdown Filter */}
        <div style={{ flex: '0 0 auto' }}>
          <select
            value={selectedFabric}
            onChange={(e) => setSelectedFabric(e.target.value)}
            style={{
              padding: '0.48rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.82rem',
              background: '#ffffff',
              color: '#0f172a',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="All">🧵 All Fabrics</option>
            {printConfig.fabrics.map((f, i) => (
              <option key={i} value={f}>{f}</option>
            ))}
          </select>
        </div>

        {/* Reset Filters */}
        {(datePreset !== 'all' || (!isDesignerRestricted && selectedDesigner !== 'All') || selectedFabric !== 'All' || drowFilter !== 'All' || cmFilter !== 'All' || finalFilter !== 'All' || stageTab !== 'ALL' || searchQuery) && (
          <button
            onClick={() => {
              setDatePreset('all');
              if (!isDesignerRestricted) setSelectedDesigner('All');
              setSelectedFabric('All');
              setDrowFilter('All');
              setCmFilter('All');
              setFinalFilter('All');
              setStageTab('ALL');
              setSearchQuery('');
            }}
            style={{
              padding: '0.45rem 0.75rem',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#64748b',
              cursor: 'pointer',
            }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* ─── Task Content: Cards Grid vs Table View ───────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', margin: '0.5rem 0' }}>
          {/* Executive Pulse Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1.25rem 1.5rem',
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ position: 'relative', width: '48px', height: '48px', flexShrink: 0 }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    border: '3px solid transparent',
                    borderTopColor: '#2563eb',
                    borderRightColor: '#7c3aed',
                    borderBottomColor: '#ec4899',
                    animation: 'spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: '4px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    boxShadow: '0 4px 12px rgba(29, 78, 216, 0.35)',
                    animation: 'pulseGlow 2s ease-in-out infinite',
                  }}
                >
                  <Sparkles size={20} />
                </div>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                  Loading Live Design Pipeline...
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
                  Synchronizing design tasks, reference proofs & 3-stage workflow progress
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#2563eb',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '20px',
                  padding: '0.3rem 0.75rem',
                }}
              >
                <RefreshCw size={12} className="spin-loader" /> Cloudflare R2 & DB Connected
              </span>
            </div>
          </div>

          {/* Skeleton Cards Grid matching luxury cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                style={{
                  background: '#ffffff',
                  borderRadius: '18px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Hero skeleton */}
                <div
                  style={{
                    height: '210px',
                    background: 'linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.8s infinite linear',
                    position: 'relative',
                    padding: '0.75rem 0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ width: '80px', height: '22px', borderRadius: '6px', background: 'rgba(255,255,255,0.7)' }} />
                    <div style={{ width: '90px', height: '22px', borderRadius: '20px', background: 'rgba(255,255,255,0.7)' }} />
                  </div>
                </div>

                {/* Body skeleton */}
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ width: '60%', height: '20px', borderRadius: '6px', background: 'linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.8s infinite linear' }} />
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <div style={{ width: '70px', height: '22px', borderRadius: '20px', background: '#f1f5f9' }} />
                    <div style={{ width: '90px', height: '22px', borderRadius: '20px', background: '#f1f5f9' }} />
                  </div>
                  <div style={{ height: '70px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                    <div style={{ flex: 1, borderRadius: '8px', background: '#ffffff' }} />
                    <div style={{ flex: 1, borderRadius: '8px', background: '#ffffff' }} />
                    <div style={{ flex: 1, borderRadius: '8px', background: '#ffffff' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <Palette size={40} color="#94a3b8" style={{ margin: '0 auto 0.75rem' }} />
          <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.1rem', color: '#334155' }}>No Design Tasks Found</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            {isUserRestricted
              ? (userAssignedName
                  ? `No designs currently assigned to "${userAssignedName}". You only see designs where your name is assigned as Designer or Colour Matcher.`
                  : 'Your account is not linked to a Designer or Colour Matcher profile. Please ask an administrator to assign your profile in Admin Panel.')
              : (canInputNewDesign
                  ? 'Try changing the date filter, clearing search, or creating a new design task with "+ Input New Design".'
                  : 'No design tasks found matching the selected filters.')}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* ─── TABLE VIEW ──────────────────────────────────────────────── */
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 800 }}>Task # / Date</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 800 }}>Design & Priority</th>
                  <th style={{ padding: '0.85rem 0.75rem', fontWeight: 800 }}>Sample Ref</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 800 }}>Assigned Team</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 800 }}>1. Drow Status</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 800 }}>2. Colour Match</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 800 }}>3. Final Approval</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 800, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task, idx) => {
                  const priorityConfig = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.Medium;
                  const allFabrics = Array.isArray(task.fabrics) && task.fabrics.length > 0
                    ? task.fabrics
                    : task.fabricName ? task.fabricName.split(',').map((s) => s.trim()).filter(Boolean) : [];
                  const allDesigners = Array.isArray(task.designers) && task.designers.length > 0
                    ? task.designers
                    : task.designerName ? task.designerName.split(',').map((s) => s.trim()).filter(Boolean) : [];
                  const allColourMatches = Array.isArray(task.colourMatches) && task.colourMatches.length > 0
                    ? task.colourMatches
                    : task.colourMatching ? task.colourMatching.split(',').map((s) => s.trim()).filter(Boolean) : [];

                  const drowImgs = task.drowDesignImages || [];
                  const cmImgs = task.colourMatchingImages || [];
                  const finalImgs = task.finalDesignImages || [];

                  return (
                    <tr
                      key={task._id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: idx % 2 === 0 ? '#ffffff' : '#fcfdff',
                        transition: 'background 0.1s ease',
                      }}
                    >
                      {/* Task # & Date */}
                      <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                        <div style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '0.15rem 0.5rem', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                          {task.taskNo}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                          {task.date}
                        </div>
                      </td>

                      {/* Design & Priority */}
                      <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                          {task.designName}
                        </div>
                        <div style={{ marginTop: '0.25rem' }}>
                          <span
                            style={{
                              fontSize: '0.66rem',
                              fontWeight: 800,
                              padding: '0.15rem 0.45rem',
                              borderRadius: '5px',
                              background: priorityConfig.bg,
                              color: priorityConfig.color,
                              border: `1px solid ${priorityConfig.border}`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                            }}
                          >
                            <span>{priorityConfig.badge}</span>
                            <span>{task.priority || 'Medium'}</span>
                          </span>
                        </div>
                      </td>

                      {/* Sample Ref */}
                      <td style={{ padding: '0.85rem 0.75rem', verticalAlign: 'middle' }}>
                        {task.sampleImage ? (
                          <div
                            onClick={() => handleOpenLightbox([task.sampleImage], 0, `Sample: ${task.designName}`)}
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '6px',
                              overflow: 'hidden',
                              border: '1px solid #cbd5e1',
                              cursor: 'pointer',
                              position: 'relative',
                            }}
                            title="Click to view sample"
                          >
                            <img src={task.sampleImage} alt="Sample" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ) : task.sampleLink ? (
                          <a
                            href={task.sampleLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', fontWeight: 700 }}
                            title="Open reference link"
                          >
                            <ExternalLink size={14} /> Link
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>—</span>
                        )}
                      </td>

                      {/* Assigned Team & Fabrics */}
                      <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {allDesigners.length > 0 && (
                            <div style={{ fontSize: '0.72rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <User size={12} color="#2563eb" /> <span>{allDesigners.join(', ')}</span>
                            </div>
                          )}
                          {allColourMatches.length > 0 && (
                            <div style={{ fontSize: '0.72rem', color: '#9d174d', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Palette size={12} color="#db2777" /> <span>{allColourMatches.join(', ')}</span>
                            </div>
                          )}
                          {allFabrics.length > 0 && (
                            <div style={{ fontSize: '0.7rem', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Scissors size={11} color="#0284c7" /> <span>{allFabrics.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 1. Drow Status */}
                      <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {embedded ? (
                            <span
                              style={{
                                padding: '0.25rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                border: task.drowDesignStatus ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                                background: task.drowDesignStatus === 'FINAL SAMPLE' ? '#eef2ff' : task.drowDesignStatus ? '#eff6ff' : '#f8fafc',
                                color: task.drowDesignStatus === 'FINAL SAMPLE' ? '#4338ca' : task.drowDesignStatus ? '#1d4ed8' : '#94a3b8',
                              }}
                            >
                              {task.drowDesignStatus || 'Pending'}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleOpenStatusModal(task, 'drow_design', 'DROW DESIGN STATUS', task.drowDesignStatus)}
                              style={{
                                padding: '0.25rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                border: task.drowDesignStatus ? '1px solid #bfdbfe' : '1px dashed #cbd5e1',
                                background: task.drowDesignStatus === 'FINAL SAMPLE' ? '#eef2ff' : task.drowDesignStatus ? '#eff6ff' : '#f8fafc',
                                color: task.drowDesignStatus === 'FINAL SAMPLE' ? '#4338ca' : task.drowDesignStatus ? '#1d4ed8' : '#94a3b8',
                              }}
                            >
                              {task.drowDesignStatus || '+ Set Status'}
                            </button>
                          )}
                          {drowImgs.length > 0 && (
                            <button
                              onClick={() => handleOpenLightbox(drowImgs, 0, `Drow Proof: ${task.designName}`)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontSize: '0.72rem', fontWeight: 700, padding: 0 }}
                              title={`${drowImgs.length} proof image(s)`}
                            >
                              🖼️ {drowImgs.length}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 2. Colour Match */}
                      <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {embedded ? (
                            <span
                              style={{
                                padding: '0.25rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                border: task.colourMatchingStatus ? '1px solid #fbcfe8' : '1px solid #e2e8f0',
                                background: task.colourMatchingStatus === 'FINAL SAMPLE' ? '#eef2ff' : task.colourMatchingStatus ? '#fdf2f8' : '#f8fafc',
                                color: task.colourMatchingStatus === 'FINAL SAMPLE' ? '#4338ca' : task.colourMatchingStatus ? '#be185d' : '#94a3b8',
                              }}
                            >
                              {task.colourMatchingStatus || 'Pending'}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleOpenStatusModal(task, 'colour_matching', 'COLOUR MATCHING STATUS', task.colourMatchingStatus)}
                              style={{
                                padding: '0.25rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                border: task.colourMatchingStatus ? '1px solid #fbcfe8' : '1px dashed #cbd5e1',
                                background: task.colourMatchingStatus === 'FINAL SAMPLE' ? '#eef2ff' : task.colourMatchingStatus ? '#fdf2f8' : '#f8fafc',
                                color: task.colourMatchingStatus === 'FINAL SAMPLE' ? '#4338ca' : task.colourMatchingStatus ? '#be185d' : '#94a3b8',
                              }}
                            >
                              {task.colourMatchingStatus || '+ Set Status'}
                            </button>
                          )}
                          {cmImgs.length > 0 && (
                            <button
                              onClick={() => handleOpenLightbox(cmImgs, 0, `Colour Proof: ${task.designName}`)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#db2777', fontSize: '0.72rem', fontWeight: 700, padding: 0 }}
                              title={`${cmImgs.length} proof image(s)`}
                            >
                              🎨 {cmImgs.length}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 3. Final Approval */}
                      <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {embedded ? (
                            <span
                              style={{
                                padding: '0.25rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                border: task.finalDesignStatus === 'APPROVED SAMPLE'
                                  ? '1.5px solid #16a34a'
                                  : String(task.finalDesignStatus || '').startsWith('REJECT')
                                  ? '1.5px solid #dc2626'
                                  : '1px solid #e2e8f0',
                                background: task.finalDesignStatus === 'APPROVED SAMPLE'
                                  ? '#dcfce7'
                                  : String(task.finalDesignStatus || '').startsWith('REJECT')
                                  ? '#fee2e2'
                                  : '#f8fafc',
                                color: task.finalDesignStatus === 'APPROVED SAMPLE'
                                  ? '#15803d'
                                  : String(task.finalDesignStatus || '').startsWith('REJECT')
                                  ? '#b91c1c'
                                  : '#94a3b8',
                              }}
                            >
                              {task.finalDesignStatus?.includes('drowning') || task.finalDesignStatus === 'REJECT SAMPLE DRAWING'
                                ? 'REJECT DRAWING'
                                : task.finalDesignStatus || 'Pending Gate'}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleOpenStatusModal(task, 'final_design', 'FINAL DESIGN STATUS', task.finalDesignStatus)}
                              style={{
                                padding: '0.25rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                border: task.finalDesignStatus === 'APPROVED SAMPLE'
                                  ? '1.5px solid #16a34a'
                                  : String(task.finalDesignStatus || '').startsWith('REJECT')
                                  ? '1.5px solid #dc2626'
                                  : '1px dashed #cbd5e1',
                                background: task.finalDesignStatus === 'APPROVED SAMPLE'
                                  ? '#dcfce7'
                                  : String(task.finalDesignStatus || '').startsWith('REJECT')
                                  ? '#fee2e2'
                                  : '#f8fafc',
                                color: task.finalDesignStatus === 'APPROVED SAMPLE'
                                  ? '#15803d'
                                  : String(task.finalDesignStatus || '').startsWith('REJECT')
                                  ? '#b91c1c'
                                  : '#94a3b8',
                              }}
                            >
                              {task.finalDesignStatus?.includes('drowning') || task.finalDesignStatus === 'REJECT SAMPLE DRAWING'
                                ? 'REJECT DRAWING'
                                : task.finalDesignStatus || '+ Gate Review'}
                            </button>
                          )}
                          {finalImgs.length > 0 && (
                            <button
                              onClick={() => handleOpenLightbox(finalImgs, 0, `Final Proof: ${task.designName}`)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', fontSize: '0.72rem', fontWeight: 700, padding: 0 }}
                              title={`${finalImgs.length} final proof image(s)`}
                            >
                              ✨ {finalImgs.length}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <button
                            onClick={() => setHistoryTask(task)}
                            title="View Complete Stage History"
                            style={{
                              padding: '0.35rem 0.5rem',
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              color: '#475569',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                            }}
                          >
                            <History size={13} />
                            <span>{task.stageHistory?.length || 0}</span>
                          </button>
                          {isUserAdmin && !embedded && (
                            <>
                              <button
                                onClick={() => handleOpenEdit(task)}
                                title="Edit Task"
                                style={{
                                  padding: '0.35rem 0.5rem',
                                  background: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  borderRadius: '6px',
                                  color: '#1d4ed8',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                }}
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteTask(task)}
                                title="Delete Task"
                                style={{
                                  padding: '0.35rem 0.5rem',
                                  background: '#fef2f2',
                                  border: '1px solid #fecaca',
                                  borderRadius: '6px',
                                  color: '#dc2626',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ─── CARDS GRID VIEW ─────────────────────────────────────────── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))', gap: '1.15rem' }}>
          {filteredTasks.map((task) => {
            const priorityConfig = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.Medium;
            const progress = getTaskStageProgress(task);

            const allFabrics = Array.isArray(task.fabrics) && task.fabrics.length > 0
              ? task.fabrics
              : task.fabricName ? task.fabricName.split(',').map((s) => s.trim()).filter(Boolean) : [];

            const allDesigners = Array.isArray(task.designers) && task.designers.length > 0
              ? task.designers
              : task.designerName ? task.designerName.split(',').map((s) => s.trim()).filter(Boolean) : [];

            const allColourMatches = Array.isArray(task.colourMatches) && task.colourMatches.length > 0
              ? task.colourMatches
              : task.colourMatching ? task.colourMatching.split(',').map((s) => s.trim()).filter(Boolean) : [];

            const drowImgs = task.drowDesignImages || [];
            const cmImgs = task.colourMatchingImages || [];
            const finalImgs = task.finalDesignImages || [];

            if (embedded) {
              const heroImg = task.sampleImage || finalImgs[0] || cmImgs[0] || drowImgs[0];
              const allLightboxImages = [
                ...(task.sampleImage ? [task.sampleImage] : []),
                ...drowImgs,
                ...cmImgs,
                ...finalImgs,
              ];
              const uniqueLightboxImages = Array.from(new Set(allLightboxImages));

              return (
                <div
                  key={task._id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                  className="hover:shadow-lg hover:border-blue-200"
                >
                  {/* Hero / Sample Image Preview */}
                  <div
                    style={{
                      height: '210px',
                      position: 'relative',
                      background: '#0f172a',
                      overflow: 'hidden',
                    }}
                  >
                    {heroImg ? (
                      <div
                        onClick={() => handleOpenLightbox(uniqueLightboxImages.length > 0 ? uniqueLightboxImages : [heroImg], 0, `Design: ${task.designName}`)}
                        style={{ width: '100%', height: '100%', cursor: 'pointer', position: 'relative' }}
                        title="Click to preview design image in lightbox"
                      >
                        <img
                          src={heroImg}
                          alt={task.designName}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            transition: 'transform 0.3s ease',
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'rgba(0,0,0,0.35)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            opacity: 0,
                            transition: 'opacity 0.15s ease',
                            gap: '0.4rem',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                          }}
                          className="hover:opacity-100"
                        >
                          <Eye size={18} />
                          <span>Preview Design</span>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                          color: '#94a3b8',
                          padding: '1rem',
                          textAlign: 'center',
                        }}
                      >
                        <Palette size={32} color="#64748b" style={{ marginBottom: '0.4rem' }} />
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1' }}>
                          No Sample Image Uploaded
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                          {task.designName}
                        </span>
                      </div>
                    )}

                    {/* Top Overlays */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        right: '10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        pointerEvents: 'none',
                        zIndex: 2,
                      }}
                    >
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <span
                          style={{
                            background: 'rgba(15, 23, 42, 0.82)',
                            backdropFilter: 'blur(8px)',
                            color: '#ffffff',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            border: '1px solid rgba(255,255,255,0.2)',
                            letterSpacing: '0.02em',
                          }}
                        >
                          {task.taskNo}
                        </span>
                        <span
                          style={{
                            background: priorityConfig.bg,
                            color: priorityConfig.color,
                            border: `1px solid ${priorityConfig.border}`,
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                          }}
                        >
                          <span>{priorityConfig.badge}</span>
                          <span>{task.priority || 'Medium'}</span>
                        </span>
                      </div>

                      {/* Overall Status Badge */}
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '0.22rem 0.6rem',
                          borderRadius: '6px',
                          backdropFilter: 'blur(8px)',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                          background:
                            task.finalDesignStatus === 'APPROVED SAMPLE'
                              ? '#10b981'
                              : String(task.finalDesignStatus || '').startsWith('REJECT')
                              ? '#ef4444'
                              : task.colourMatchingStatus
                              ? '#ec4899'
                              : task.drowDesignStatus
                              ? '#3b82f6'
                              : 'rgba(15, 23, 42, 0.75)',
                          color: '#ffffff',
                          border: '1px solid rgba(255,255,255,0.25)',
                        }}
                      >
                        {task.finalDesignStatus === 'APPROVED SAMPLE'
                          ? '✓ Approved'
                          : String(task.finalDesignStatus || '').startsWith('REJECT')
                          ? '✕ Rejected'
                          : task.colourMatchingStatus
                          ? '🎨 Colour Match'
                          : task.drowDesignStatus
                          ? '✏️ Drawing'
                          : '⏳ Pending'}
                      </span>
                    </div>

                    {/* Bottom Overlays */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '8px',
                        left: '10px',
                        right: '10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        zIndex: 2,
                      }}
                    >
                      <span
                        style={{
                          background: 'rgba(15, 23, 42, 0.75)',
                          backdropFilter: 'blur(8px)',
                          color: '#e2e8f0',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '5px',
                          fontSize: '0.66rem',
                          fontWeight: 600,
                        }}
                      >
                        📅 {task.date}
                      </span>

                      <button
                        onClick={() => setHistoryTask(task)}
                        title="View Complete Stage History"
                        style={{
                          background: 'rgba(15, 23, 42, 0.75)',
                          backdropFilter: 'blur(8px)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          color: '#ffffff',
                          borderRadius: '6px',
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <History size={11} />
                        <span>{task.stageHistory?.length || 0}</span>
                      </button>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: '0.95rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1 }}>
                    {/* Design Name */}
                    <div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '1.2rem',
                          fontWeight: 800,
                          color: '#0f172a',
                          letterSpacing: '-0.01em',
                          wordBreak: 'break-word',
                        }}
                      >
                        {task.designName}
                      </h3>

                      {/* Reference Link & Notes */}
                      {task.sampleLink && (
                        <div style={{ marginTop: '0.35rem' }}>
                          <a
                            href={task.sampleLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '0.72rem',
                              color: '#2563eb',
                              fontWeight: 700,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              padding: '0.18rem 0.5rem',
                              borderRadius: '5px',
                            }}
                          >
                            <ExternalLink size={12} /> Open Sample Link / Video
                          </a>
                        </div>
                      )}

                      {task.notes && (
                        <p
                          style={{
                            margin: '0.35rem 0 0',
                            fontSize: '0.72rem',
                            color: '#475569',
                            fontStyle: 'italic',
                            background: '#f8fafc',
                            padding: '0.3rem 0.55rem',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          "{task.notes}"
                        </p>
                      )}
                    </div>

                    {/* Metadata Badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {allDesigners.map((d, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: '#1e40af',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: '6px',
                            padding: '0.15rem 0.45rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <User size={11} /> {d}
                        </span>
                      ))}
                      {allFabrics.map((f, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: '#0369a1',
                            background: '#f0f9ff',
                            border: '1px solid #bae6fd',
                            borderRadius: '6px',
                            padding: '0.15rem 0.45rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <Scissors size={11} /> {f}
                        </span>
                      ))}
                      {allColourMatches.map((c, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: '#9d174d',
                            background: '#fdf2f8',
                            border: '1px solid #fbcfe8',
                            borderRadius: '6px',
                            padding: '0.15rem 0.45rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <Palette size={11} /> {c}
                        </span>
                      ))}
                    </div>

                    {/* Unified 3-Stage Workflow Status Box */}
                    <div
                      style={{
                        marginTop: 'auto',
                        background: '#f8fafc',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        padding: '0.7rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Workflow Status
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.66rem', fontWeight: 700 }}>
                          <span style={{ color: progress.s1 === 'done' ? '#16a34a' : '#2563eb' }}>1.Drow</span>
                          <span style={{ color: '#cbd5e1' }}>→</span>
                          <span style={{ color: progress.s2 === 'done' ? '#16a34a' : '#db2777' }}>2.C.M.</span>
                          <span style={{ color: '#cbd5e1' }}>→</span>
                          <span style={{ color: progress.s3 === 'approved' ? '#16a34a' : '#15803d' }}>3.Gate</span>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem' }}>
                        {/* Stage 1: Drawing */}
                        <div
                          style={{
                            background: '#ffffff',
                            borderRadius: '8px',
                            border: '1px solid #dbeafe',
                            padding: '0.5rem 0.35rem',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                            1. Drawing
                          </div>
                          <span
                            style={{
                              fontSize: '0.64rem',
                              fontWeight: 800,
                              padding: '0.15rem 0.35rem',
                              borderRadius: '5px',
                              background:
                                task.drowDesignStatus === 'START WORKING'
                                  ? '#dbeafe'
                                  : task.drowDesignStatus === 'REVIEW SAMPLE'
                                  ? '#fef3c7'
                                  : task.drowDesignStatus === 'FINAL SAMPLE'
                                  ? '#e0e7ff'
                                  : '#f1f5f9',
                              color:
                                task.drowDesignStatus === 'START WORKING'
                                  ? '#1e40af'
                                  : task.drowDesignStatus === 'REVIEW SAMPLE'
                                  ? '#92400e'
                                  : task.drowDesignStatus === 'FINAL SAMPLE'
                                  ? '#3730a3'
                                  : '#94a3b8',
                              border: '1px solid rgba(0,0,0,0.05)',
                              maxWidth: '100%',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {task.drowDesignStatus || 'Pending'}
                          </span>
                          {drowImgs.length > 0 && (
                            <button
                              onClick={() => handleOpenLightbox(drowImgs, 0, `Drawing Proofs: ${task.designName}`)}
                              style={{
                                marginTop: '0.35rem',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                fontSize: '0.64rem',
                                color: '#2563eb',
                                fontWeight: 700,
                                padding: 0,
                              }}
                              title="Click to view drawing proofs"
                            >
                              🖼️ {drowImgs.length} {drowImgs.length === 1 ? 'proof' : 'proofs'}
                            </button>
                          )}
                        </div>

                        {/* Stage 2: Colour Match */}
                        <div
                          style={{
                            background: '#ffffff',
                            borderRadius: '8px',
                            border: '1px solid #fce7f3',
                            padding: '0.5rem 0.35rem',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#9d174d', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                            2. Colour
                          </div>
                          <span
                            style={{
                              fontSize: '0.64rem',
                              fontWeight: 800,
                              padding: '0.15rem 0.35rem',
                              borderRadius: '5px',
                              background:
                                task.colourMatchingStatus === 'COLOUR PANTON'
                                  ? '#fce7f3'
                                  : task.colourMatchingStatus === 'REVIEW SAMPLE'
                                  ? '#fef3c7'
                                  : task.colourMatchingStatus === 'FINAL SAMPLE'
                                  ? '#e0e7ff'
                                  : '#f1f5f9',
                              color:
                                task.colourMatchingStatus === 'COLOUR PANTON'
                                  ? '#9d174d'
                                  : task.colourMatchingStatus === 'REVIEW SAMPLE'
                                  ? '#92400e'
                                  : task.colourMatchingStatus === 'FINAL SAMPLE'
                                  ? '#3730a3'
                                  : '#94a3b8',
                              border: '1px solid rgba(0,0,0,0.05)',
                              maxWidth: '100%',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {task.colourMatchingStatus || 'Pending'}
                          </span>
                          {cmImgs.length > 0 && (
                            <button
                              onClick={() => handleOpenLightbox(cmImgs, 0, `Colour Proofs: ${task.designName}`)}
                              style={{
                                marginTop: '0.35rem',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                fontSize: '0.64rem',
                                color: '#db2777',
                                fontWeight: 700,
                                padding: 0,
                              }}
                              title="Click to view colour proofs"
                            >
                              🎨 {cmImgs.length} {cmImgs.length === 1 ? 'proof' : 'proofs'}
                            </button>
                          )}
                        </div>

                        {/* Stage 3: Final Gate */}
                        <div
                          style={{
                            background: '#ffffff',
                            borderRadius: '8px',
                            border: '1px solid #dcfce7',
                            padding: '0.5rem 0.35rem',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                            3. Gate
                          </div>
                          <span
                            style={{
                              fontSize: '0.64rem',
                              fontWeight: 800,
                              padding: '0.15rem 0.35rem',
                              borderRadius: '5px',
                              background:
                                task.finalDesignStatus === 'APPROVED SAMPLE'
                                  ? '#dcfce7'
                                  : String(task.finalDesignStatus || '').startsWith('REJECT')
                                  ? '#fee2e2'
                                  : task.finalDesignStatus
                                  ? '#e0e7ff'
                                  : '#f1f5f9',
                              color:
                                task.finalDesignStatus === 'APPROVED SAMPLE'
                                  ? '#15803d'
                                  : String(task.finalDesignStatus || '').startsWith('REJECT')
                                  ? '#b91c1c'
                                  : task.finalDesignStatus
                                  ? '#3730a3'
                                  : '#94a3b8',
                              border: '1px solid rgba(0,0,0,0.05)',
                              maxWidth: '100%',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {task.finalDesignStatus?.includes('drowning') || task.finalDesignStatus === 'REJECT SAMPLE DRAWING'
                              ? 'REJ DRAW'
                              : task.finalDesignStatus || 'Pending'}
                          </span>
                          {finalImgs.length > 0 && (
                            <button
                              onClick={() => handleOpenLightbox(finalImgs, 0, `Final Proofs: ${task.designName}`)}
                              style={{
                                marginTop: '0.35rem',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                fontSize: '0.64rem',
                                color: '#16a34a',
                                fontWeight: 700,
                                padding: 0,
                              }}
                              title="Click to view final proofs"
                            >
                              ✨ {finalImgs.length} {finalImgs.length === 1 ? 'proof' : 'proofs'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={task._id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  position: 'relative',
                }}
              >
                {/* ── Workflow Progress Pipeline Strip ── */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#f8fafc',
                    padding: '0.35rem 0.6rem',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                  }}
                >
                  {/* Step 1: Drawing */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      color: progress.s1 === 'done' ? '#16a34a' : progress.s1 === 'active' ? '#2563eb' : progress.s1 === 'revision' ? '#dc2626' : '#94a3b8',
                    }}
                  >
                    <span style={{ fontSize: '0.65rem' }}>{progress.s1 === 'done' ? '✓' : '1'}</span>
                    <span>Drow</span>
                  </div>

                  <span style={{ color: '#cbd5e1' }}>──</span>

                  {/* Step 2: Colour Match */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      color: progress.s2 === 'done' ? '#16a34a' : progress.s2 === 'active' ? '#db2777' : progress.s2 === 'revision' ? '#ea580c' : '#94a3b8',
                    }}
                  >
                    <span style={{ fontSize: '0.65rem' }}>{progress.s2 === 'done' ? '✓' : '2'}</span>
                    <span>C.M.</span>
                  </div>

                  <span style={{ color: '#cbd5e1' }}>──</span>

                  {/* Step 3: Final Gate */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      color: progress.s3 === 'approved' ? '#16a34a' : progress.s3 === 'revision' ? '#dc2626' : progress.s3 === 'active' ? '#4f46e5' : '#94a3b8',
                    }}
                  >
                    <span style={{ fontSize: '0.65rem' }}>{progress.s3 === 'approved' ? '✓' : '3'}</span>
                    <span>{progress.s3 === 'approved' ? 'Approved' : 'Gate'}</span>
                  </div>
                </div>

                {/* ── Card Header ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          color: '#2563eb',
                          background: '#eff6ff',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '6px',
                          border: '1px solid #bfdbfe',
                        }}
                      >
                        {task.taskNo}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                        {task.date}
                      </span>
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', wordBreak: 'break-word' }}>
                      {task.designName}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '0.18rem 0.5rem',
                        borderRadius: '6px',
                        background: priorityConfig.bg,
                        color: priorityConfig.color,
                        border: `1px solid ${priorityConfig.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}
                    >
                      <span>{priorityConfig.badge}</span>
                      <span>{task.priority || 'Medium'}</span>
                    </span>

                    <button
                      onClick={() => setHistoryTask(task)}
                      title="View Complete Stage History"
                      style={{
                        padding: '0.3rem 0.45rem',
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        color: '#475569',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                      }}
                    >
                      <History size={13} />
                      <span>{task.stageHistory?.length || 0}</span>
                    </button>

                    {isUserAdmin && !embedded && (
                      <>
                        <button
                          onClick={() => handleOpenEdit(task)}
                          title="Edit Task"
                          style={{
                            padding: '0.3rem 0.45rem',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: '6px',
                            color: '#1d4ed8',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task)}
                          title="Delete Task"
                          style={{
                            padding: '0.3rem 0.45rem',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            color: '#dc2626',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* ── Metadata Badges (Designers, Fabrics, Colour Matches) ── */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {allDesigners.map((d, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#1e40af',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '6px',
                        padding: '0.15rem 0.5rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <User size={11} /> {d}
                    </span>
                  ))}
                  {allFabrics.map((f, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#0369a1',
                        background: '#f0f9ff',
                        border: '1px solid #bae6fd',
                        borderRadius: '6px',
                        padding: '0.15rem 0.5rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <Scissors size={11} /> {f}
                    </span>
                  ))}
                  {allColourMatches.map((c, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#9d174d',
                        background: '#fdf2f8',
                        border: '1px solid #fbcfe8',
                        borderRadius: '6px',
                        padding: '0.15rem 0.5rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <Palette size={11} /> {c}
                    </span>
                  ))}
                </div>

                {/* ── Admin Sample Image / Reference Link ── */}
                {(task.sampleImage || task.sampleLink || task.notes) && (
                  <div
                    style={{
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '0.65rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                    }}
                  >
                    {task.sampleImage && (
                      <div
                        onClick={() => handleOpenLightbox([task.sampleImage], 0, `Sample: ${task.designName}`)}
                        style={{
                          width: '52px',
                          height: '52px',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          border: '1px solid #cbd5e1',
                          cursor: 'pointer',
                          position: 'relative',
                          flexShrink: 0,
                        }}
                      >
                        <img src={task.sampleImage} alt="Sample" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'rgba(0,0,0,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            opacity: 0,
                            transition: 'opacity 0.15s',
                          }}
                          className="hover:opacity-100"
                        >
                          <Eye size={14} />
                        </div>
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                        Admin Sample / Reference
                      </div>
                      {task.sampleLink && (
                        <a
                          href={task.sampleLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '0.75rem',
                            color: '#2563eb',
                            fontWeight: 700,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            marginTop: '0.15rem',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <ExternalLink size={12} /> Open Sample Link / Video
                        </a>
                      )}
                      {task.notes && (
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: '#475569', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          "{task.notes}"
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* ── STAGE 1: DROW DESIGN STATUS ─────────────────────────────────── */}
                <div
                  style={{
                    background: '#f8faff',
                    border: '1px solid #dbeafe',
                    borderRadius: '10px',
                    padding: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Clock size={13} color="#2563eb" />
                      <span>1. DROW DESIGN STATUS</span>
                    </div>
                    {task.drowDesignStatus ? (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '6px',
                          background:
                            task.drowDesignStatus === 'START WORKING'
                              ? '#dbeafe'
                              : task.drowDesignStatus === 'REVIEW SAMPLE'
                              ? '#fef3c7'
                              : '#e0e7ff',
                          color:
                            task.drowDesignStatus === 'START WORKING'
                              ? '#1e40af'
                              : task.drowDesignStatus === 'REVIEW SAMPLE'
                              ? '#92400e'
                              : '#3730a3',
                          border: '1px solid rgba(0,0,0,0.06)',
                        }}
                      >
                        {task.drowDesignStatus}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontStyle: 'italic' }}>Pending</span>
                    )}
                  </div>

                  {/* Quick Status Buttons */}
                  {!embedded && (
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
                      {DROW_STATUS_OPTIONS.map((opt) => {
                        const isActive = task.drowDesignStatus === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => handleOpenStatusModal(task, 'drow_design', 'DROW DESIGN STATUS', opt.id)}
                            style={{
                              flex: '1 1 calc(33.33% - 0.35rem)',
                              minWidth: '70px',
                              padding: '0.32rem 0.45rem',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              border: isActive ? `1.5px solid ${opt.color}` : '1px solid #cbd5e1',
                              background: isActive ? opt.bg : '#ffffff',
                              color: isActive ? opt.color : '#475569',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.2rem',
                              boxShadow: isActive ? `0 1px 4px ${opt.color}25` : 'none',
                            }}
                          >
                            {isActive && <Check size={11} />}
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Stored Images Gallery for Drow Design */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                      {drowImgs.length > 0 ? (
                        drowImgs.map((imgUrl, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleOpenLightbox(drowImgs, idx, `Drow Proof: ${task.designName}`)}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '5px',
                              overflow: 'hidden',
                              border: '1px solid #bfdbfe',
                              cursor: 'pointer',
                              position: 'relative',
                            }}
                            title={`Drow Image #${idx + 1} (stored in R2)`}
                          >
                            <img src={imgUrl} alt={`Drow ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ))
                      ) : (
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>No proofs uploaded</span>
                      )}
                    </div>

                    {!embedded && (
                      <button
                        onClick={() => handleOpenStatusModal(task, 'drow_design', 'DROW DESIGN STATUS', task.drowDesignStatus)}
                        style={{
                          padding: '0.25rem 0.55rem',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          background: '#ffffff',
                          border: '1px solid #bfdbfe',
                          borderRadius: '5px',
                          color: '#1d4ed8',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <Upload size={11} /> + Proof
                      </button>
                    )}
                  </div>
                </div>

                {/* ── STAGE 2: COLOUR MATCHING STATUS ────────────────────────────── */}
                <div
                  style={{
                    background: '#fdf4f8',
                    border: '1px solid #fbcfe8',
                    borderRadius: '10px',
                    padding: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#9d174d', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Palette size={13} color="#db2777" />
                      <span>2. COLOUR MATCHING STATUS</span>
                    </div>
                    {task.colourMatchingStatus ? (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '6px',
                          background:
                            task.colourMatchingStatus === 'COLOUR PANTON'
                              ? '#fce7f3'
                              : task.colourMatchingStatus === 'REVIEW SAMPLE'
                              ? '#fef3c7'
                              : '#e0e7ff',
                          color:
                            task.colourMatchingStatus === 'COLOUR PANTON'
                              ? '#9d174d'
                              : task.colourMatchingStatus === 'REVIEW SAMPLE'
                              ? '#92400e'
                              : '#3730a3',
                          border: '1px solid rgba(0,0,0,0.06)',
                        }}
                      >
                        {task.colourMatchingStatus}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontStyle: 'italic' }}>Pending</span>
                    )}
                  </div>

                  {/* Quick Status Buttons */}
                  {!embedded && (
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
                      {COLOUR_MATCHING_OPTIONS.map((opt) => {
                        const isActive = task.colourMatchingStatus === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => handleOpenStatusModal(task, 'colour_matching', 'COLOUR MATCHING STATUS', opt.id)}
                            style={{
                              flex: '1 1 calc(33.33% - 0.35rem)',
                              minWidth: '70px',
                              padding: '0.32rem 0.45rem',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              border: isActive ? `1.5px solid ${opt.color}` : '1px solid #cbd5e1',
                              background: isActive ? opt.bg : '#ffffff',
                              color: isActive ? opt.color : '#475569',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.2rem',
                              boxShadow: isActive ? `0 1px 4px ${opt.color}25` : 'none',
                            }}
                          >
                            {isActive && <Check size={11} />}
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Stored Images Gallery for Colour Matching */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                      {cmImgs.length > 0 ? (
                        cmImgs.map((imgUrl, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleOpenLightbox(cmImgs, idx, `Colour Proof: ${task.designName}`)}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '5px',
                              overflow: 'hidden',
                              border: '1px solid #fbcfe8',
                              cursor: 'pointer',
                              position: 'relative',
                            }}
                            title={`C.M. Image #${idx + 1} (stored in R2)`}
                          >
                            <img src={imgUrl} alt={`CM ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ))
                      ) : (
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>No proofs uploaded</span>
                      )}
                    </div>

                    {!embedded && (
                      <button
                        onClick={() => handleOpenStatusModal(task, 'colour_matching', 'COLOUR MATCHING STATUS', task.colourMatchingStatus)}
                        style={{
                          padding: '0.25rem 0.55rem',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          background: '#ffffff',
                          border: '1px solid #fbcfe8',
                          borderRadius: '5px',
                          color: '#be185d',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <Upload size={11} /> + Proof
                      </button>
                    )}
                  </div>
                </div>

                {/* ── STAGE 3: FINAL DESIGN STATUS ───────────────────────────────── */}
                <div
                  style={{
                    background: '#f9fdfa',
                    border: '1px solid #bbf7d0',
                    borderRadius: '10px',
                    padding: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <CheckCircle2 size={13} color="#16a34a" />
                      <span>3. FINAL DESIGN STATUS</span>
                    </div>
                    {task.finalDesignStatus ? (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '6px',
                          background:
                            task.finalDesignStatus === 'APPROVED SAMPLE'
                              ? '#dcfce7'
                              : task.finalDesignStatus.startsWith('REJECT')
                              ? '#fee2e2'
                              : '#e0e7ff',
                          color:
                            task.finalDesignStatus === 'APPROVED SAMPLE'
                              ? '#15803d'
                              : task.finalDesignStatus.startsWith('REJECT')
                              ? '#b91c1c'
                              : '#3730a3',
                          border: '1px solid rgba(0,0,0,0.06)',
                        }}
                      >
                        {task.finalDesignStatus?.includes('drowning') || task.finalDesignStatus === 'REJECT SAMPLE DRAWING'
                          ? 'REJECT DRAWING'
                          : task.finalDesignStatus}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontStyle: 'italic' }}>Pending Review</span>
                    )}
                  </div>

                  {/* Action Buttons for Final Design */}
                  {!embedded && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.35rem', marginBottom: '0.45rem' }}>
                      {FINAL_DESIGN_OPTIONS.map((opt) => {
                        const isActive =
                          task.finalDesignStatus === opt.id ||
                          (opt.legacyId && task.finalDesignStatus === opt.legacyId) ||
                          (opt.id.includes('DRAWING') && task.finalDesignStatus?.includes('drowning'));
                        const IconComp = opt.icon || CheckCircle2;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => handleOpenStatusModal(task, 'final_design', 'FINAL DESIGN STATUS', opt.id)}
                            style={{
                              padding: '0.35rem 0.45rem',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              border: isActive ? `1.5px solid ${opt.color}` : '1px solid #cbd5e1',
                              background: isActive ? opt.bg : '#ffffff',
                              color: isActive ? opt.color : '#475569',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.25rem',
                              boxShadow: isActive ? `0 1px 4px ${opt.color}25` : 'none',
                            }}
                          >
                            <IconComp size={11} color={isActive ? opt.color : '#64748b'} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Stored Images Gallery for Final Design */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                      {finalImgs.length > 0 ? (
                        finalImgs.map((imgUrl, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleOpenLightbox(finalImgs, idx, `Final Proof: ${task.designName}`)}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '5px',
                              overflow: 'hidden',
                              border: '1px solid #bbf7d0',
                              cursor: 'pointer',
                              position: 'relative',
                            }}
                            title={`Final Image #${idx + 1} (stored in R2)`}
                          >
                            <img src={imgUrl} alt={`Final ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ))
                      ) : (
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>No final proofs</span>
                      )}
                    </div>

                    {!embedded && (
                      <button
                        onClick={() => handleOpenStatusModal(task, 'final_design', 'FINAL DESIGN STATUS', task.finalDesignStatus)}
                        style={{
                          padding: '0.25rem 0.55rem',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          background: '#ffffff',
                          border: '1px solid #bbf7d0',
                          borderRadius: '5px',
                          color: '#15803d',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <Upload size={11} /> + Proof
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MODAL: UPDATE STATUS & MULTI-IMAGE UPLOAD TO CLOUDFLARE R2 ─── */}
      {!embedded && activeModalData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={() => !uploading && setActiveModalData(null)}
        >
          <div
            style={{
              position: 'relative',
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Status & Proof Uploading Loading Screen */}
            {uploading && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(12px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 200,
                  borderRadius: '16px',
                  padding: '2.5rem 1.5rem',
                  animation: 'fadeIn 0.2s ease',
                  textAlign: 'center',
                }}
              >
                <div style={{ position: 'relative', width: '76px', height: '76px', marginBottom: '1.25rem' }}>
                  <div
                    style={{
                      position: 'absolute',
                      inset: '-3px',
                      borderRadius: '50%',
                      border: '3px solid transparent',
                      borderTopColor: '#38bdf8',
                      borderRightColor: '#6366f1',
                      borderBottomColor: '#ec4899',
                      animation: 'spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: '4px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #7c3aed 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      boxShadow: '0 0 25px rgba(59, 130, 246, 0.7)',
                      animation: 'pulseGlow 2s ease-in-out infinite',
                    }}
                  >
                    <Upload size={30} />
                  </div>
                </div>

                <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                  Publishing Proofs & Status Update
                </h3>
                <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#cbd5e1', maxWidth: '340px' }}>
                  Compressing and uploading high-resolution proofs directly to Cloudflare R2 bucket...
                </p>

                {/* Live Progress Bar with % */}
                <div style={{ width: '100%', maxWidth: '300px', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 800, color: '#38bdf8', marginBottom: '0.35rem' }}>
                    <span>Cloudflare R2 Direct Upload</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.15)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(5, uploadProgress)}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8, #818cf8)', borderRadius: '999px', transition: 'width 0.2s ease' }} />
                  </div>
                </div>

                <div style={{ marginTop: '1rem', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
                  Live Workflow Sync • Please do not close
                </div>
              </div>
            )}
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', marginBottom: '0.15rem' }}>
                  {activeModalData.statusType || 'Workflow Update'}
                </div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                  Update & Upload Proof(s)
                </h3>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Task: {activeModalData.task?.taskNo} • Design: {activeModalData.task?.designName}
                </p>
              </div>

              {!uploading && (
                <button
                  type="button"
                  onClick={() => setActiveModalData(null)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={20} />
                </button>
              )}
            </div>

            <form onSubmit={handleSubmitStatusUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Status Selector */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'block' }}>
                  Select Status
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                  {(activeModalData.category === 'drow_design'
                    ? DROW_STATUS_OPTIONS
                    : activeModalData.category === 'colour_matching'
                    ? COLOUR_MATCHING_OPTIONS
                    : FINAL_DESIGN_OPTIONS
                  ).map((opt) => {
                    const isSelected = activeModalData.newStatus === opt.id;
                    return (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => setActiveModalData((prev) => ({ ...prev, newStatus: opt.id }))}
                        style={{
                          padding: '0.45rem 0.75rem',
                          borderRadius: '8px',
                          border: isSelected ? `2px solid ${opt.color}` : '1px solid #cbd5e1',
                          background: isSelected ? opt.bg : '#ffffff',
                          color: isSelected ? opt.color : '#334155',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          boxShadow: isSelected ? `0 2px 6px ${opt.color}25` : 'none',
                        }}
                      >
                        {isSelected && <Check size={14} />}
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Image File Input (Direct to Cloudflare R2) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Upload size={13} color="#2563eb" />
                    <span>Upload Images (Stored in Cloudflare R2)</span>
                  </label>
                  <span style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 700 }}>
                    Multiple files supported
                  </span>
                </div>

                <div
                  style={{
                    border: '2px dashed #93c5fd',
                    borderRadius: '10px',
                    padding: '1.25rem',
                    textAlign: 'center',
                    background: '#f8faff',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                  onClick={() => document.getElementById('r2-multi-file-input')?.click()}
                >
                  <input
                    id="r2-multi-file-input"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <ImageIcon size={32} color="#3b82f6" style={{ margin: '0 auto 0.5rem' }} />
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1d4ed8' }}>
                    Click to select multiple sample images
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                    PNG, JPG, WEBP • Automatically compressed and uploaded to Cloudflare R2
                  </div>
                </div>

                {/* Previews of newly selected files */}
                {filePreviews.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                      Selected ({filePreviews.length}):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {filePreviews.map((p, idx) => (
                        <div
                          key={idx}
                          style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '1px solid #bfdbfe',
                            position: 'relative',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                          }}
                        >
                          <img src={p.previewUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveSelectedFile(idx);
                            }}
                            style={{
                              position: 'absolute',
                              top: '2px',
                              right: '2px',
                              background: 'rgba(239, 68, 68, 0.9)',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '50%',
                              width: '18px',
                              height: '18px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Note / Comments */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'block' }}>
                  Comments / Note (Optional)
                </label>
                <textarea
                  rows={2}
                  value={uploadNote}
                  onChange={(e) => setUploadNote(e.target.value)}
                  placeholder="e.g. Swatch matched against Pantone 19-4052. Prepared for final print test..."
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    color: '#0f172a',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              {/* External Output Link */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'block' }}>
                  External File / Video Link (Optional)
                </label>
                <input
                  type="url"
                  value={uploadLink}
                  onChange={(e) => setUploadLink(e.target.value)}
                  placeholder="https://drive.google.com/... or Figma link"
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    color: '#0f172a',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Upload Progress Bar */}
              {uploading && (
                <div style={{ marginTop: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', marginBottom: '0.25rem' }}>
                    <span>Storing to Cloudflare R2...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div style={{ height: '6px', background: '#dbeafe', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#2563eb', transition: 'width 0.2s ease' }} />
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveModalData(null)}
                  disabled={uploading}
                  style={{
                    flex: 1,
                    padding: '0.65rem 1rem',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#64748b',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  style={{
                    flex: 2,
                    padding: '0.65rem 1rem',
                    background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    color: '#ffffff',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                  }}
                >
                  {uploading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" /> Storing to R2...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> Save Status & Upload
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: STAGE AUDIT HISTORY ─────────────────────────────────── */}
      {historyTask && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={() => setHistoryTask(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '650px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>
                  Audit Trail & History
                </div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                  {historyTask.taskNo} — {historyTask.designName}
                </h3>
              </div>
              <button
                onClick={() => setHistoryTask(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
              >
                <X size={20} />
              </button>
            </div>

            {(!historyTask.stageHistory || historyTask.stageHistory.length === 0) ? (
              <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', margin: '2rem 0' }}>
                No stage history recorded yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {historyTask.stageHistory.slice().reverse().map((entry, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#f8fafc',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      padding: '0.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '0.15rem 0.55rem',
                          borderRadius: '6px',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe',
                        }}
                      >
                        {entry.statusType ? `${entry.statusType}: ` : ''}{entry.stage}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
                        {new Date(entry.updatedAt).toLocaleString()}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 600 }}>
                      Updated by: <span style={{ color: '#0f172a' }}>{entry.updatedByName || 'Designer'}</span>
                    </div>

                    {entry.note && (
                      <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', color: '#475569', fontStyle: 'italic' }}>
                        "{entry.note}"
                      </p>
                    )}

                    {/* Stage Images */}
                    {(Array.isArray(entry.images) && entry.images.length > 0) && (
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                        {entry.images.map((imgUrl, i) => (
                          <div
                            key={i}
                            onClick={() => handleOpenLightbox(entry.images, i, `History Proof (${entry.stage})`)}
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '6px',
                              overflow: 'hidden',
                              border: '1px solid #cbd5e1',
                              cursor: 'pointer',
                            }}
                          >
                            <img src={imgUrl} alt="proof" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: FULL RESOLUTION IMAGE LIGHTBOX ─────────────────────── */}
      {lightboxImages && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setLightboxImages(null)}
        >
          <div
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              display: 'flex',
              gap: '0.75rem',
            }}
          >
            <a
              href={lightboxImages.images[lightboxImages.activeIndex]}
              target="_blank"
              rel="noopener noreferrer"
              download
              onClick={(e) => e.stopPropagation()}
              style={{
                color: '#ffffff',
                background: 'rgba(255,255,255,0.2)',
                padding: '0.4rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <Download size={14} /> Open Full
            </a>
            <button
              onClick={() => setLightboxImages(null)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: '#ffffff',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div
            style={{
              maxWidth: '90vw',
              maxHeight: '80vh',
              borderRadius: '10px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImages.images[lightboxImages.activeIndex]}
              alt={lightboxImages.title}
              style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block' }}
            />
          </div>

          {lightboxImages.images.length > 1 && (
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                marginTop: '1rem',
                background: 'rgba(0,0,0,0.5)',
                padding: '0.5rem',
                borderRadius: '10px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {lightboxImages.images.map((img, i) => (
                <div
                  key={i}
                  onClick={() => setLightboxImages((prev) => ({ ...prev, activeIndex: i }))}
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    border: i === lightboxImages.activeIndex ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.4)',
                    cursor: 'pointer',
                    opacity: i === lightboxImages.activeIndex ? 1 : 0.6,
                  }}
                >
                  <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Create / Edit Design Task Modal ─────────────────────────────── */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              position: 'relative',
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #cbd5e1',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Create / Update Modal Loading Screen */}
            {(savingTask || uploadingSampleImage) && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(12px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 200,
                  borderRadius: '16px',
                  padding: '2.5rem 1.5rem',
                  animation: 'fadeIn 0.2s ease',
                  textAlign: 'center',
                }}
              >
                {/* Glowing Multi-Ring Pulse */}
                <div style={{ position: 'relative', width: '84px', height: '84px', marginBottom: '1.5rem' }}>
                  <div
                    style={{
                      position: 'absolute',
                      inset: '-4px',
                      borderRadius: '50%',
                      border: '3px solid transparent',
                      borderTopColor: '#38bdf8',
                      borderRightColor: '#818cf8',
                      borderBottomColor: '#ec4899',
                      animation: 'spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: '4px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #7c3aed 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      boxShadow: '0 0 30px rgba(59, 130, 246, 0.7)',
                      animation: 'pulseGlow 2s ease-in-out infinite',
                    }}
                  >
                    <Sparkles size={34} />
                  </div>
                </div>

                <h3 style={{ margin: '0 0 0.45rem', fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                  {uploadingSampleImage
                    ? 'Compressing & Storing Artwork to R2'
                    : editingId
                    ? 'Updating Design Task & Workflow'
                    : 'Publishing New Design to Live Workflow'}
                </h3>
                <p style={{ margin: '0 0 1.75rem', fontSize: '0.86rem', color: '#cbd5e1', maxWidth: '380px', lineHeight: 1.5 }}>
                  {uploadingSampleImage
                    ? 'Optimizing high-res image and streaming to Cloudflare R2 bucket with secure CDN links...'
                    : 'Saving design specifications, updating team assignments and synchronizing live ERP pipeline...'}
                </p>

                {/* Animated Gradient Bar */}
                <div
                  style={{
                    width: '100%',
                    maxWidth: '340px',
                    height: '6px',
                    background: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: '999px',
                    overflow: 'hidden',
                    position: 'relative',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: '60%',
                      background: 'linear-gradient(90deg, #38bdf8, #818cf8, #ec4899, #38bdf8)',
                      backgroundSize: '200% 100%',
                      borderRadius: '999px',
                      animation: 'shimmer 1.8s infinite linear',
                    }}
                  />
                </div>

                {/* Realtime Pipeline Steps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', width: '100%', maxWidth: '340px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.8rem', color: '#e2e8f0', background: 'rgba(255, 255, 255, 0.08)', padding: '0.5rem 0.85rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
                    <CheckCircle2 size={15} color="#34d399" />
                    <span>Design specs & designer tags verified</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.8rem', color: '#e2e8f0', background: 'rgba(255, 255, 255, 0.08)', padding: '0.5rem 0.85rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
                    <RefreshCw size={14} className="spin-loader" color="#38bdf8" />
                    <span>{uploadingSampleImage ? 'Transmitting sample media to Cloudflare R2' : 'Synchronizing live database records'}</span>
                  </div>
                </div>

                <div style={{ marginTop: '1.25rem', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
                  🔒 Master Admin Live Sync • Please do not close this window
                </div>
              </div>
            )}
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: '#eff6ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563eb',
                  }}
                >
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                    {editingId ? 'Edit Design Task' : 'Input New Design'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                    Assign designers, colour matching staff, fabrics & sample reference media
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '0.35rem',
                  borderRadius: '6px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitTask} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'block' }}>
                    Design Date
                  </label>
                  <input
                    type="date"
                    required
                    value={taskFormData.date}
                    onChange={(e) => setTaskFormData((prev) => ({ ...prev, date: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.52rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                      color: '#0f172a',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'block' }}>
                    Priority
                  </label>
                  <select
                    value={taskFormData.priority}
                    onChange={(e) => setTaskFormData((prev) => ({ ...prev, priority: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.52rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                      color: '#0f172a',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  >
                    <option value="Urgent">🔴 Urgent</option>
                    <option value="High">🟠 High</option>
                    <option value="Medium">🟡 Medium</option>
                    <option value="Low">🟢 Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'block' }}>
                  Design Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Spring Floral Pattern 01 (leave empty for auto-generated name)"
                  value={taskFormData.designName}
                  onChange={(e) => setTaskFormData((prev) => ({ ...prev, designName: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.52rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    color: '#0f172a',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Multi-Select: Designers */}
              <MultiSelectBox
                label="Assigned Designers"
                icon={User}
                options={printConfig.designers || []}
                selected={taskFormData.designers || []}
                onChange={(selected) => setTaskFormData((prev) => ({ ...prev, designers: selected }))}
                tagTheme={{ bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }}
              />

              {/* Multi-Select: Colour Matching Staff */}
              <MultiSelectBox
                label="Colour Matching Staff"
                icon={Palette}
                options={printConfig.designers || []}
                selected={taskFormData.colourMatches || []}
                onChange={(selected) => setTaskFormData((prev) => ({ ...prev, colourMatches: selected }))}
                tagTheme={{ bg: '#fdf2f8', color: '#db2777', border: '#fbcfe8' }}
              />

              {/* Multi-Select: Fabrics */}
              <MultiSelectBox
                label="Assigned Fabrics"
                icon={Scissors}
                options={printConfig.fabrics || []}
                selected={taskFormData.fabrics || []}
                onChange={(selected) => setTaskFormData((prev) => ({ ...prev, fabrics: selected }))}
                tagTheme={{ bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' }}
              />

              {/* Sample Reference Image Upload (to Cloudflare R2) */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'block' }}>
                  Sample Reference Image (Stored in Cloudflare R2)
                </label>
                {taskFormData.sampleImage ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem', border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: '8px' }}>
                    <img
                      src={taskFormData.sampleImage}
                      alt="Sample"
                      style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #cbd5e1' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#1e40af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {taskFormData.sampleImage}
                      </p>
                      <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 700 }}>✓ Uploaded to R2</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTaskFormData((prev) => ({ ...prev, sampleImage: '' }))}
                      style={{
                        padding: '0.3rem 0.5rem',
                        background: '#fee2e2',
                        color: '#dc2626',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      border: '2px dashed #93c5fd',
                      borderRadius: '8px',
                      padding: '1rem',
                      textAlign: 'center',
                      background: '#f8faff',
                      cursor: 'pointer',
                    }}
                    onClick={() => document.getElementById('task-sample-file-input')?.click()}
                  >
                    <input
                      id="task-sample-file-input"
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleSampleImageUpload}
                    />
                    <Upload size={22} color="#2563eb" style={{ margin: '0 auto 0.35rem' }} />
                    <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#1e40af' }}>
                      {uploadingSampleImage ? 'Compressing & Uploading to R2...' : 'Click to select sample reference image'}
                    </p>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.7rem', color: '#64748b' }}>
                      JPG, PNG, WebP up to 10MB
                    </p>
                  </div>
                )}
              </div>

              {/* Sample Link or Reference Video */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'block' }}>
                  Sample Video / Reference URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/... or YouTube / Figma link"
                  value={taskFormData.sampleLink}
                  onChange={(e) => setTaskFormData((prev) => ({ ...prev, sampleLink: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.52rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    color: '#0f172a',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'block' }}>
                  Design Notes / Instructions (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Specific requirements, pantone codes, repeat instructions..."
                  value={taskFormData.notes}
                  onChange={(e) => setTaskFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.52rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    color: '#0f172a',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '0.55rem 1.1rem',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTask || uploadingSampleImage}
                  style={{
                    padding: '0.55rem 1.35rem',
                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    cursor: (savingTask || uploadingSampleImage) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
                  }}
                >
                  {savingTask ? 'Saving Design Task...' : (editingId ? 'Update Design Task' : 'Create Design Task')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});

export default DesignerScreen;
