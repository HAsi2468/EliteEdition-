import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../services/api';
import imageCompression from 'browser-image-compression';
import {
  Palette,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  Layers,
  Sparkles,
  Link as LinkIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Clock3,
  RefreshCw,
  X,
  Eye,
  History,
  Trash2,
  Edit2,
  Upload,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  FileCheck,
  Check,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { triggerPushNotification } from './NotificationToast';

// Available design workflow stages
export const DESIGN_STAGES = [
  { id: 'New', label: 'New / Requested', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', border: '#38bdf8' },
  { id: 'Assigned', label: 'Assigned', color: '#818cf8', bg: 'rgba(129, 140, 248, 0.12)', border: '#818cf8' },
  { id: 'In Progress', label: 'In Progress', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)', border: '#fbbf24' },
  { id: 'Colour Matching', label: 'Colour Matching', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)', border: '#ec4899' },
  { id: 'Sample Proof Ready', label: 'Sample Proof Ready', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)', border: '#a855f7' },
  { id: 'Revision Requested', label: 'Revision Requested', color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)', border: '#f97316' },
  { id: 'Approved', label: 'Approved / Ready', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: '#10b981' },
  { id: 'Cancelled', label: 'Cancelled / On Hold', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: '#94a3b8' }
];

export const PRIORITIES = [
  { id: 'Urgent', label: 'Urgent', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', badge: '🔴' },
  { id: 'High', label: 'High', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', badge: '🟠' },
  { id: 'Medium', label: 'Medium', color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', badge: '🟡' },
  { id: 'Low', label: 'Low', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', badge: '🟢' },
];

/**
 * Detect media type from URL
 */
function getLinkMediaType(url = '') {
  if (!url || typeof url !== 'string') return 'link';
  const u = url.trim().toLowerCase();
  if (
    u.endsWith('.mp4') ||
    u.endsWith('.webm') ||
    u.endsWith('.mov') ||
    u.endsWith('.m4v') ||
    u.endsWith('.ogg') ||
    u.includes('youtube.com/watch') ||
    u.includes('youtu.be/') ||
    u.includes('youtube.com/shorts') ||
    u.includes('vimeo.com/')
  ) {
    return 'video';
  }
  if (
    u.endsWith('.jpg') ||
    u.endsWith('.jpeg') ||
    u.endsWith('.png') ||
    u.endsWith('.webp') ||
    u.endsWith('.gif') ||
    u.endsWith('.svg') ||
    u.includes('drive.google.com/uc?id=') ||
    u.includes('r2.dev/')
  ) {
    return 'image';
  }
  return 'link';
}

/**
 * Helper to embed or convert YouTube / Vimeo / Drive video links
 */
function getEmbedUrl(url = '') {
  if (!url) return '';
  const trimmed = url.trim();
  // YouTube watch
  const ytMatch = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=0`;
  }
  // Vimeo
  const vimeoMatch = trimmed.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }
  // Google Drive
  const driveMatch = trimmed.match(/\/file\/d\/([\w-]+)\/(?:view|preview)/);
  if (driveMatch) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }
  return trimmed;
}

export default function DesignerModule({ currentUser, isAdmin = false }) {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Settings dropdown data
  const [printConfig, setPrintConfig] = useState({
    designers: [],
    fabrics: [],
    colourMatchings: []
  });

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [designerFilter, setDesignerFilter] = useState('All');
  const [colourMatchFilter, setColourMatchFilter] = useState('All');
  const [stageFilter, setStageFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(null); // { type, url, title }

  const [activeTask, setActiveTask] = useState(null);

  // Form State
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const initialForm = {
    date: todayStr,
    designName: '',
    designerName: '',
    fabricName: '',
    colourMatching: '',
    priority: 'Medium',
    sampleImage: '',
    sampleLink: '',
    notes: '',
  };
  const [formData, setFormData] = useState({ ...initialForm });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Stage update form state
  const [stageFormData, setStageFormData] = useState({
    stage: 'In Progress',
    note: '',
    outputImage: '',
    outputLink: ''
  });
  const [updatingStage, setUpdatingStage] = useState(false);

  // Fetch settings & tasks
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [cfg, resTasks, resStats] = await Promise.all([
        api.getPrintConfig().catch(() => ({})),
        api.getDesignerTasks({
          date: dateFilter,
          designerName: designerFilter,
          colourMatching: colourMatchFilter,
          status: stageFilter,
          priority: priorityFilter,
          search: searchQuery
        }),
        api.getDesignerStats().catch(() => null)
      ]);

      if (cfg) {
        setPrintConfig({
          designers: cfg.designers || [],
          fabrics: cfg.fabrics || [],
          colourMatchings: (cfg.colourMatchings && cfg.colourMatchings.length > 0)
            ? cfg.colourMatchings
            : (cfg.designers || [])
        });
      }

      if (resTasks && resTasks.data) {
        setTasks(resTasks.data);
      }
      if (resStats && resStats.data) {
        setStats(resStats.data);
      }
    } catch (err) {
      console.error('Failed to load designer tasks:', err);
      setError(err.message || 'Failed to load designer module data');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateFilter, designerFilter, colourMatchFilter, stageFilter, priorityFilter]);

  // Real-time listener
  useEffect(() => {
    const handleRefresh = () => loadData(true);
    window.addEventListener('elite-data-refresh', handleRefresh);
    return () => window.removeEventListener('elite-data-refresh', handleRefresh);
  }, [dateFilter, designerFilter, colourMatchFilter, stageFilter, priorityFilter]);

  // Handle Image Upload to Cloudflare R2
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const options = {
        maxSizeMB: 1.5,
        maxWidthOrHeight: 2048,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);
      const res = await api.uploadImage(compressedFile, 'design_samples');
      if (res && res.url) {
        setFormData(prev => ({ ...prev, sampleImage: res.url }));
        triggerPushNotification('Sample Image Uploaded', 'Stored securely on Cloudflare R2', 'success');
      } else {
        throw new Error('Image upload failed: URL not returned');
      }
    } catch (err) {
      console.error('Image upload failed:', err);
      alert('Failed to upload image to R2: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  // Stage update image upload
  const handleOutputImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const options = {
        maxSizeMB: 1.5,
        maxWidthOrHeight: 2048,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);
      const res = await api.uploadImage(compressedFile, 'design_outputs');
      if (res && res.url) {
        setStageFormData(prev => ({ ...prev, outputImage: res.url }));
        triggerPushNotification('Output Image Uploaded', 'Stored securely on Cloudflare R2', 'success');
      }
    } catch (err) {
      alert('Failed to upload output image: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({ ...initialForm, date: new Date().toISOString().split('T')[0] });
    setShowCreateModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (task) => {
    setEditingId(task._id);
    setFormData({
      date: task.date || todayStr,
      designName: task.designName || '',
      designerName: task.designerName || '',
      fabricName: task.fabricName || '',
      colourMatching: task.colourMatching || '',
      priority: task.priority || 'Medium',
      sampleImage: task.sampleImage || '',
      sampleLink: task.sampleLink || '',
      notes: task.notes || '',
    });
    setShowCreateModal(true);
  };

  // Submit Create or Edit
  const handleSubmitTask = async (e) => {
    e.preventDefault();
    if (!formData.designName.trim()) {
      alert('Please enter a Design Name or Title.');
      return;
    }

    setSavingTask(true);
    try {
      if (editingId) {
        await api.updateDesignerTask(editingId, formData);
        triggerPushNotification('Design Task Updated', `Design "${formData.designName}" updated.`, 'success');
      } else {
        await api.createDesignerTask(formData);
        triggerPushNotification('Design Task Created', `New design task "${formData.designName}" registered.`, 'success');
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

  // Open Stage Modal
  const handleOpenStageModal = (task) => {
    setActiveTask(task);
    setStageFormData({
      stage: task.status || 'In Progress',
      note: '',
      outputImage: task.outputImage || '',
      outputLink: task.outputLink || ''
    });
    setShowStageModal(true);
  };

  // Submit Stage Change
  const handleSubmitStage = async (e) => {
    e.preventDefault();
    if (!activeTask) return;

    setUpdatingStage(true);
    try {
      await api.updateDesignerTaskStage(activeTask._id, stageFormData);
      triggerPushNotification('Stage Updated', `Task ${activeTask.taskNo} moved to "${stageFormData.stage}".`, 'info');
      setShowStageModal(false);
      loadData(true);
    } catch (err) {
      alert('Failed to update stage: ' + err.message);
    } finally {
      setUpdatingStage(false);
    }
  };

  // Open History Modal
  const handleOpenHistory = (task) => {
    setActiveTask(task);
    setShowHistoryModal(true);
  };

  // Delete Task
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

  // Filtered client-side list for search query
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const q = searchQuery.toLowerCase().trim();
    return tasks.filter(t =>
      (t.taskNo || '').toLowerCase().includes(q) ||
      (t.designName || '').toLowerCase().includes(q) ||
      (t.designerName || '').toLowerCase().includes(q) ||
      (t.fabricName || '').toLowerCase().includes(q) ||
      (t.colourMatching || '').toLowerCase().includes(q) ||
      (t.notes || '').toLowerCase().includes(q)
    );
  }, [tasks, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', boxSizing: 'border-box' }}>
      
      {/* ─── HEADER BAR ──────────────────────────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderRadius: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 14px rgba(236, 72, 153, 0.3)',
            flexShrink: 0
          }}>
            <Palette size={22} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Designer Team Module
              <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', border: '1px solid rgba(236, 72, 153, 0.3)' }}>
                DESIGN PIPELINE &amp; HISTORY
              </span>
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0', fontWeight: 500 }}>
              Track where designs are in each stage, assign to designers, preview sample media, and review history.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => loadData(false)}
            className="btn-secondary"
            style={{ padding: '0.55rem 0.85rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderRadius: '8px' }}
            title="Refresh Data"
          >
            <RefreshCw size={14} className={loading ? 'spin-loader' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            style={{
              padding: '0.55rem 1.25rem',
              fontSize: '0.82rem',
              fontWeight: 800,
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #ec4899 0%, #d946ef 100%)',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 4px 14px rgba(236, 72, 153, 0.35)',
              transition: 'all 0.15s ease'
            }}
          >
            <Plus size={16} />
            <span>+ Input New Design</span>
          </button>
        </div>
      </div>

      {/* ─── QUICK METRICS STATS BAR ────────────────────────────────────────── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          {[
            { label: 'Total Designs', val: stats.total || 0, color: '#38bdf8', icon: Layers },
            { label: 'New / Assigned', val: (stats.new || 0) + (stats.assigned || 0), color: '#818cf8', icon: Clock },
            { label: 'In Progress', val: stats.inProgress || 0, color: '#fbbf24', icon: RefreshCw },
            { label: 'Colour Matching', val: stats.colourMatching || 0, color: '#ec4899', icon: Palette },
            { label: 'Sample Proof Ready', val: stats.sampleReady || 0, color: '#a855f7', icon: Sparkles },
            { label: 'Approved Ready', val: stats.approved || 0, color: '#10b981', icon: CheckCircle },
            { label: 'Urgent / High', val: (stats.urgent || 0) + (stats.high || 0), color: '#ef4444', icon: AlertTriangle },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="glass-panel"
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderLeft: `3px solid ${item.color}`
                }}
              >
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {item.val}
                  </div>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color }}>
                  <Icon size={16} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MULTI-FILTER & HISTORY TOOLBAR ─────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            <Filter size={15} color="var(--primary)" />
            <span>History &amp; Stage Filters</span>
          </div>

          {(dateFilter || designerFilter !== 'All' || colourMatchFilter !== 'All' || stageFilter !== 'All' || priorityFilter !== 'All' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setDateFilter('');
                setDesignerFilter('All');
                setColourMatchFilter('All');
                setStageFilter('All');
                setPriorityFilter('All');
                setSearchQuery('');
              }}
              style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <X size={13} /> Reset All Filters
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'center' }}>
          
          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search design, task no, notes..."
              style={{ paddingLeft: 32, width: '100%', fontSize: '0.82rem', height: '36px' }}
            />
          </div>

          {/* Date Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--bg-input, rgba(0,0,0,0.25))', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '0 0.5rem', height: '36px' }}>
            <Calendar size={14} color="var(--text-muted)" />
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', width: '100%' }}
              title="Filter by Entry Date"
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                title="Clear Date"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Designer Filter Dropdown */}
          <div>
            <select
              value={designerFilter}
              onChange={e => setDesignerFilter(e.target.value)}
              style={{ width: '100%', fontSize: '0.82rem', height: '36px', padding: '0 0.6rem' }}
            >
              <option value="All">All Designers</option>
              {printConfig.designers.map((d, i) => (
                <option key={i} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Colour Matching Filter Dropdown */}
          <div>
            <select
              value={colourMatchFilter}
              onChange={e => setColourMatchFilter(e.target.value)}
              style={{ width: '100%', fontSize: '0.82rem', height: '36px', padding: '0 0.6rem' }}
            >
              <option value="All">All Colour Matches</option>
              {printConfig.colourMatchings.map((c, i) => (
                <option key={i} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Stage / Status Filter */}
          <div>
            <select
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value)}
              style={{ width: '100%', fontSize: '0.82rem', height: '36px', padding: '0 0.6rem' }}
            >
              <option value="All">All Stages</option>
              {DESIGN_STAGES.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              style={{ width: '100%', fontSize: '0.82rem', height: '36px', padding: '0 0.6rem' }}
            >
              <option value="All">All Priorities</option>
              {PRIORITIES.map(p => (
                <option key={p.id} value={p.id}>{p.badge} {p.label}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Stage Filter Chips for 1-click Quick Filtering */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', paddingTop: '0.3rem', borderTop: '1px dashed var(--border-light)' }}>
          <button
            type="button"
            onClick={() => setStageFilter('All')}
            style={{
              padding: '0.25rem 0.65rem',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: stageFilter === 'All' ? '1px solid #38bdf8' : '1px solid var(--border-light)',
              background: stageFilter === 'All' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              color: stageFilter === 'All' ? '#38bdf8' : 'var(--text-muted)'
            }}
          >
            All Stages ({tasks.length})
          </button>
          {DESIGN_STAGES.map(s => {
            const count = tasks.filter(t => t.status === s.id).length;
            const isSelected = stageFilter === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStageFilter(s.id)}
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: isSelected ? `1.5px solid ${s.border}` : '1px solid var(--border-light)',
                  background: isSelected ? s.bg : 'transparent',
                  color: isSelected ? s.color : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <span>{s.label}</span>
                <span style={{ fontSize: '0.65rem', opacity: 0.85, background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: '4px' }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── ERROR BANNER ───────────────────────────────────────────────────── */}
      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', padding: '0.75rem 1rem', color: '#fca5a5', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* ─── DESIGN TASKS GRID / LIST ───────────────────────────────────────── */}
      {loading && tasks.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={32} className="spin-loader" color="var(--primary)" />
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', fontWeight: 600 }}>Loading designer pipeline &amp; history...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3.5rem', textAlign: 'center' }}>
          <Palette size={48} color="var(--text-muted)" style={{ opacity: 0.35, margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>No Design Tasks Found</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            {tasks.length === 0
              ? 'No designs in pipeline yet. Click "+ Input New Design" to create the first request.'
              : 'No designs match the current filter criteria.'}
          </p>
          {tasks.length === 0 && (
            <button
              type="button"
              onClick={handleOpenCreate}
              style={{
                marginTop: '1.25rem',
                padding: '0.55rem 1.25rem',
                fontSize: '0.82rem',
                fontWeight: 800,
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #ec4899 0%, #d946ef 100%)',
                color: '#ffffff',
                cursor: 'pointer'
              }}
            >
              + Input First Design
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.2rem' }}>
          {filteredTasks.map((task) => {
            const stageConfig = DESIGN_STAGES.find(s => s.id === task.status) || DESIGN_STAGES[0];
            const priorityConfig = PRIORITIES.find(p => p.id === task.priority) || PRIORITIES[2];
            const linkMediaType = getLinkMediaType(task.sampleLink);

            return (
              <div
                key={task._id}
                className="glass-panel"
                style={{
                  padding: '1.2rem',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.9rem',
                  position: 'relative',
                  borderTop: `4px solid ${stageConfig.color}`,
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                {/* Top Task Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>
                      {task.taskNo}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Calendar size={11} />
                      {task.date || 'Today'}
                    </span>
                  </div>

                  {/* Priority Badge */}
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: priorityConfig.bg,
                      color: priorityConfig.color,
                      border: `1px solid ${priorityConfig.color}40`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <span>{priorityConfig.badge}</span>
                    <span>{priorityConfig.label}</span>
                  </span>
                </div>

                {/* Design Title */}
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
                    {task.designName}
                  </h4>
                  {task.notes && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {task.notes}
                    </p>
                  )}
                </div>

                {/* Media Preview Box (Sample Image & Sample Link) */}
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '0.6rem', border: '1px solid var(--border-light)' }}>
                  
                  {/* Sample Image Thumbnail */}
                  {task.sampleImage ? (
                    <div
                      onClick={() => setShowMediaModal({ type: 'image', url: task.sampleImage, title: `${task.taskNo} - Sample Image` })}
                      style={{ width: 64, height: 64, borderRadius: '6px', overflow: 'hidden', position: 'relative', cursor: 'pointer', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}
                      title="Click to view sample image"
                    >
                      <img
                        src={task.sampleImage}
                        alt="Sample"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{ position: 'absolute', bottom: 2, right: 2, background: 'rgba(0,0,0,0.7)', borderRadius: '3px', padding: '1px 3px', color: '#fff', fontSize: '9px' }}>
                        <Eye size={10} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text-muted)' }}>
                      <ImageIcon size={18} style={{ opacity: 0.4 }} />
                      <span style={{ fontSize: '9px', marginTop: 2 }}>No Image</span>
                    </div>
                  )}

                  {/* Sample Link or Video Embed Indicator */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {task.sampleLink ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', fontWeight: 700, color: linkMediaType === 'video' ? '#a855f7' : '#38bdf8' }}>
                          {linkMediaType === 'video' ? <VideoIcon size={13} /> : <LinkIcon size={13} />}
                          <span>{linkMediaType === 'video' ? 'Reference Video' : 'Reference Link'}</span>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setShowMediaModal({ type: linkMediaType, url: task.sampleLink, title: `${task.taskNo} - Reference Media` })}
                            style={{
                              padding: '0.25rem 0.55rem',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              borderRadius: '4px',
                              border: '1px solid var(--border-light)',
                              background: 'rgba(255,255,255,0.05)',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                          >
                            <Eye size={11} />
                            <span>Preview</span>
                          </button>

                          <a
                            href={task.sampleLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '0.7rem',
                              color: 'var(--primary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              textDecoration: 'none',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={task.sampleLink}
                          >
                            <ExternalLink size={11} /> Open Link
                          </a>
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        No sample link provided
                      </span>
                    )}

                    {/* Output artwork indicator if ready */}
                    {task.outputImage && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', color: '#10b981', fontWeight: 700, marginTop: '2px' }}>
                        <CheckCircle size={12} /> Output Artwork Uploaded
                      </div>
                    )}
                  </div>
                </div>

                {/* Attributes Grid (Designer, Fabric, Colour Matching) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 0.6rem', fontSize: '0.78rem', borderTop: '1px dashed var(--border-light)', paddingTop: '0.6rem' }}>
                  <div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Designer</span>
                    <span style={{ fontWeight: 700, color: task.designerName ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {task.designerName || 'Unassigned'}
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Fabric</span>
                    <span style={{ fontWeight: 700, color: task.fabricName ? '#38bdf8' : 'var(--text-muted)' }}>
                      {task.fabricName || '—'}
                    </span>
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Colour Match</span>
                    <span style={{ fontWeight: 700, color: task.colourMatching ? '#ec4899' : 'var(--text-muted)' }}>
                      {task.colourMatching || '—'}
                    </span>
                  </div>
                </div>

                {/* Current Stage Indicator */}
                <div style={{ background: stageConfig.bg, border: `1px solid ${stageConfig.border}40`, borderRadius: '8px', padding: '0.6rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800, color: stageConfig.color, letterSpacing: '0.04em', display: 'block' }}>
                      Current Stage:
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: stageConfig.color }}>
                      {stageConfig.label}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenStageModal(task)}
                    style={{
                      padding: '0.35rem 0.7rem',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      borderRadius: '6px',
                      border: `1px solid ${stageConfig.color}`,
                      background: stageConfig.color,
                      color: '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                    }}
                  >
                    <span>Update Stage</span>
                    <ArrowRight size={12} />
                  </button>
                </div>

                {/* Bottom Card Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={() => handleOpenHistory(task)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    <History size={13} color="var(--primary)" />
                    <span>View History ({task.stageHistory?.length || 1})</span>
                  </button>

                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(task)}
                      className="btn-secondary"
                      style={{ padding: '0.3rem 0.5rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                      title="Edit Design Details"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task)}
                      style={{
                        padding: '0.3rem 0.5rem',
                        fontSize: '0.72rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        color: '#f87171',
                        cursor: 'pointer'
                      }}
                      title="Delete Design Task"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ─── MODAL 1: CREATE / EDIT DESIGN TASK (FROM ADMIN) ───────────────── */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(3, 7, 18, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          boxSizing: 'border-box'
        }}>
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '620px',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: '16px',
              border: '1px solid var(--border-light)',
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.2rem'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Palette size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    {editingId ? 'Edit Design Task' : 'Input New Design (Admin)'}
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Fill design details, select designer, fabric, colour matching, and sample media.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.4rem' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitTask} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Row 1: Date & Priority */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                    Entry Date <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    required
                    style={{ width: '100%', fontSize: '0.85rem', padding: '0.55rem 0.75rem' }}
                  />
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>Default is set to today</span>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                    style={{ width: '100%', fontSize: '0.85rem', padding: '0.55rem 0.75rem' }}
                  >
                    {PRIORITIES.map(p => (
                      <option key={p.id} value={p.id}>{p.badge} {p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Design Name / Title */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                  Design Name / Reference <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.designName}
                  onChange={e => setFormData({ ...formData, designName: e.target.value })}
                  placeholder="e.g. ED-709 Floral Digital Print Kurti"
                  required
                  style={{ width: '100%', fontSize: '0.85rem', padding: '0.55rem 0.75rem' }}
                />
              </div>

              {/* Row 3: Dropdowns from Settings (Fabric, Designer, Colour Match) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem' }}>
                
                {/* Fabric Name Dropdown */}
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                    Fabric Name
                  </label>
                  <input
                    type="text"
                    list="fabric-options"
                    value={formData.fabricName}
                    onChange={e => setFormData({ ...formData, fabricName: e.target.value })}
                    placeholder="Select or type fabric..."
                    style={{ width: '100%', fontSize: '0.85rem', padding: '0.55rem 0.75rem' }}
                  />
                  <datalist id="fabric-options">
                    {printConfig.fabrics.map((f, i) => (
                      <option key={i} value={f}>{f}</option>
                    ))}
                  </datalist>
                </div>

                {/* Designer Select Dropdown */}
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                    Assign Designer
                  </label>
                  <select
                    value={formData.designerName}
                    onChange={e => setFormData({ ...formData, designerName: e.target.value })}
                    style={{ width: '100%', fontSize: '0.85rem', padding: '0.55rem 0.75rem' }}
                  >
                    <option value="">-- Choose Designer --</option>
                    {printConfig.designers.map((d, i) => (
                      <option key={i} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Colour Match Dropdown */}
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                    Colour Match
                  </label>
                  <input
                    type="text"
                    list="colourmatch-options"
                    value={formData.colourMatching}
                    onChange={e => setFormData({ ...formData, colourMatching: e.target.value })}
                    placeholder="e.g. Green Matching / Shade 02"
                    style={{ width: '100%', fontSize: '0.85rem', padding: '0.55rem 0.75rem' }}
                  />
                  <datalist id="colourmatch-options">
                    {printConfig.colourMatchings.map((c, i) => (
                      <option key={i} value={c}>{c}</option>
                    ))}
                  </datalist>
                </div>

              </div>

              {/* Row 4: Sample Image (Stored into Cloudflare R2) */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <ImageIcon size={15} color="#ec4899" />
                    Sample Image (Auto-saved to Cloudflare R2)
                  </label>
                  {formData.sampleImage && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, sampleImage: '' })}
                      style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}
                    >
                      Remove Image
                    </button>
                  )}
                </div>

                {formData.sampleImage ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.3)', padding: '0.6rem', borderRadius: '8px' }}>
                    <img
                      src={formData.sampleImage}
                      alt="Sample Preview"
                      style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <CheckCircle size={14} /> Image Stored on Cloudflare R2
                      </div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', wordBreak: 'break-all', display: 'block', marginTop: 2 }}>
                        {formData.sampleImage}
                      </span>
                    </div>
                  </div>
                ) : (
                  <label
                    style={{
                      border: '2px dashed var(--border-light)',
                      borderRadius: '8px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      cursor: uploadingImage ? 'wait' : 'pointer',
                      background: 'rgba(255,255,255,0.01)',
                      transition: 'border-color 0.15s ease'
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      style={{ display: 'none' }}
                    />
                    <Upload size={24} color={uploadingImage ? 'var(--primary)' : 'var(--text-muted)'} className={uploadingImage ? 'spin-loader' : ''} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {uploadingImage ? 'Compressing & Uploading to R2...' : 'Click to Upload Sample Photo'}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Supports PNG, JPG, WebP. Compressed &amp; uploaded automatically.
                    </span>
                  </label>
                )}
              </div>

              {/* Row 5: Sample Link (Image or Video preview) */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '1rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  <LinkIcon size={15} color="#38bdf8" />
                  Sample Link (Image, Video, Drive or Reference URL)
                </label>
                
                <input
                  type="url"
                  value={formData.sampleLink}
                  onChange={e => setFormData({ ...formData, sampleLink: e.target.value })}
                  placeholder="https://drive.google.com/... or https://youtu.be/... or image url"
                  style={{ width: '100%', fontSize: '0.85rem', padding: '0.55rem 0.75rem' }}
                />

                {/* Live Link Preview Indicator */}
                {formData.sampleLink && (
                  <div style={{ marginTop: '0.6rem', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {getLinkMediaType(formData.sampleLink) === 'video' ? (
                        <span style={{ color: '#a855f7', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <VideoIcon size={13} /> Video detected (Will show player preview)
                        </span>
                      ) : getLinkMediaType(formData.sampleLink) === 'image' ? (
                        <span style={{ color: '#38bdf8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <ImageIcon size={13} /> Image link detected
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <ExternalLink size={13} /> External link
                        </span>
                      )}
                    </div>

                    <a
                      href={formData.sampleLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}
                    >
                      Test Link ↗
                    </a>
                  </div>
                )}
              </div>

              {/* Row 6: Instructions / Notes */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                  Instructions / Specifications for Designer
                </label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Match tone with sample saree, scale motifs to 44 panna, create seamless pattern..."
                  style={{ width: '100%', fontSize: '0.85rem', padding: '0.55rem 0.75rem', resize: 'vertical' }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-light)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                  style={{ padding: '0.55rem 1.25rem', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTask || uploadingImage}
                  style={{
                    padding: '0.55rem 1.5rem',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #ec4899 0%, #d946ef 100%)',
                    color: '#ffffff',
                    cursor: (savingTask || uploadingImage) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(236, 72, 153, 0.4)'
                  }}
                >
                  {savingTask ? 'Saving Task...' : (editingId ? 'Save Changes' : '✓ Create Design Task')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: UPDATE DESIGN STAGE ───────────────────────────────────── */}
      {showStageModal && activeTask && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(3, 7, 18, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          boxSizing: 'border-box'
        }}>
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '540px',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.1rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Advance Design Stage
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>
                  {activeTask.taskNo} — {activeTask.designName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowStageModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitStage} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              
              {/* Select Stage */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                  Target Stage <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <select
                  value={stageFormData.stage}
                  onChange={e => setStageFormData({ ...stageFormData, stage: e.target.value })}
                  required
                  style={{ width: '100%', fontSize: '0.88rem', padding: '0.6rem 0.75rem' }}
                >
                  {DESIGN_STAGES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Stage Note */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                  Stage Transition Note / Comments
                </label>
                <textarea
                  rows={2}
                  value={stageFormData.note}
                  onChange={e => setStageFormData({ ...stageFormData, note: e.target.value })}
                  placeholder="e.g. Color matching approved, sending sample proof..."
                  style={{ width: '100%', fontSize: '0.85rem', padding: '0.55rem 0.75rem' }}
                />
              </div>

              {/* Optional Output Image (Artwork) */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.75rem' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '0.3rem' }}>
                  Upload Completed Artwork / Proof Image (Optional - saved to R2)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleOutputImageUpload}
                    disabled={uploadingImage}
                    style={{ fontSize: '0.78rem' }}
                  />
                  {uploadingImage && <span style={{ fontSize: '0.72rem', color: 'var(--primary)' }}>Uploading...</span>}
                </div>
                {stageFormData.outputImage && (
                  <span style={{ fontSize: '0.68rem', color: '#10b981', display: 'block', marginTop: '0.3rem' }}>
                    ✓ Artwork uploaded: {stageFormData.outputImage}
                  </span>
                )}
              </div>

              {/* Optional Output Link (Drive/File) */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                  Output Artwork Link (Optional)
                </label>
                <input
                  type="url"
                  value={stageFormData.outputLink}
                  onChange={e => setStageFormData({ ...stageFormData, outputLink: e.target.value })}
                  placeholder="e.g. Google Drive link to completed TIFF/PSD/CDR"
                  style={{ width: '100%', fontSize: '0.85rem', padding: '0.55rem 0.75rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem' }}>
                <button
                  type="button"
                  onClick={() => setShowStageModal(false)}
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1.1rem', fontSize: '0.82rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingStage || uploadingImage}
                  style={{
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    cursor: (updatingStage || uploadingImage) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {updatingStage ? 'Updating...' : 'Confirm Stage Change'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: AUDIT HISTORY TIMELINE ───────────────────────────────── */}
      {showHistoryModal && activeTask && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(3, 7, 18, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          boxSizing: 'border-box'
        }}>
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '580px',
              maxHeight: '85vh',
              overflowY: 'auto',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.2rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <History size={18} color="var(--primary)" />
                  Stage Transition History
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 700 }}>
                  {activeTask.taskNo} — {activeTask.designName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Timeline List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingLeft: '0.5rem' }}>
              {(activeTask.stageHistory && activeTask.stageHistory.length > 0) ? (
                activeTask.stageHistory.map((entry, idx) => {
                  const stageObj = DESIGN_STAGES.find(s => s.id === entry.stage) || { color: '#38bdf8', bg: 'rgba(56,189,248,0.1)' };
                  return (
                    <div key={idx} style={{ display: 'flex', gap: '0.85rem', position: 'relative' }}>
                      
                      {/* Timeline dot */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: 14, height: 14, borderRadius: '50%', background: stageObj.color, border: '2px solid #fff', marginTop: '2px', flexShrink: 0 }} />
                        {idx < activeTask.stageHistory.length - 1 && (
                          <div style={{ width: 2, background: 'var(--border-light)', flex: 1, marginTop: '4px' }} />
                        )}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: stageObj.color }}>
                            {entry.stage}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {entry.updatedAt ? new Date(entry.updatedAt).toLocaleString('en-IN') : 'Recent'}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          By: <strong style={{ color: 'var(--text-primary)' }}>{entry.updatedByName || 'Admin / User'}</strong>
                        </div>

                        {entry.note && (
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-primary)', margin: '6px 0 0 0', background: 'rgba(0,0,0,0.2)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                            {entry.note}
                          </p>
                        )}

                        {entry.outputImage && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <a href={entry.outputImage} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <ImageIcon size={12} /> View Attached Artwork ↗
                            </a>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })
              ) : (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No stage history recorded yet.</p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="btn-secondary"
                style={{ padding: '0.45rem 1.2rem', fontSize: '0.82rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: MEDIA VIEWER (IMAGE / VIDEO) ─────────────────────────── */}
      {showMediaModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.9)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          boxSizing: 'border-box'
        }}>
          {/* Header */}
          <div style={{ width: '100%', maxWidth: '850px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff' }}>
              {showMediaModal.title || 'Sample Media Preview'}
            </span>
            <button
              type="button"
              onClick={() => setShowMediaModal(null)}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Media Player / Image Container */}
          <div style={{ width: '100%', maxWidth: '850px', maxHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)' }}>
            {showMediaModal.type === 'video' ? (
              showMediaModal.url.includes('youtube') || showMediaModal.url.includes('vimeo') || showMediaModal.url.includes('drive.google.com') ? (
                <iframe
                  src={getEmbedUrl(showMediaModal.url)}
                  title="Video Player"
                  style={{ width: '100%', height: '480px', border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={showMediaModal.url}
                  controls
                  autoPlay
                  style={{ maxWidth: '100%', maxHeight: '75vh' }}
                >
                  Your browser does not support HTML5 video.
                </video>
              )
            ) : (
              <img
                src={showMediaModal.url}
                alt="Preview"
                style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain' }}
              />
            )}
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <a
              href={showMediaModal.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <ExternalLink size={14} /> Open Original in New Tab
            </a>
          </div>
        </div>
      )}

    </div>
  );
}
