import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ArrowRight
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
  { id: 'REJECT SAMPLE drowning', label: 'REJECT SAMPLE drowning', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: Ban },
  { id: 'REJECT SAMPLE FOR C.M.', label: 'REJECT SAMPLE FOR C.M.', color: '#ea580c', bg: '#fff7ed', border: '#ffedd5', icon: RotateCcw },
  { id: 'APPROVED SAMPLE', label: 'APPROVED SAMPLE', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: CheckCircle2 },
];

export const PRIORITY_STYLES = {
  Urgent: { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5', badge: '🔴' },
  High: { bg: '#ffedd5', color: '#ea580c', border: '#fdba74', badge: '🟠' },
  Medium: { bg: '#fef9c3', color: '#ca8a04', border: '#fde047', badge: '🟡' },
  Low: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', badge: '🟢' },
};

export default function DesignerScreen({ currentUser, isAdmin = false, onNavigate }) {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dropdown options from settings
  const [printConfig, setPrintConfig] = useState({ designers: [], fabrics: [] });

  // User Connected Designer Name
  const userDesignerName = currentUser?.designerName || '';
  const isDesignerRestricted = !isAdmin && Boolean(userDesignerName);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [selectedDesigner, setSelectedDesigner] = useState(userDesignerName || 'All');
  const [selectedFabric, setSelectedFabric] = useState('All');
  const [drowFilter, setDrowFilter] = useState('All');
  const [cmFilter, setCmFilter] = useState('All');
  const [finalFilter, setFinalFilter] = useState('All');

  useEffect(() => {
    if (isDesignerRestricted && userDesignerName) {
      setSelectedDesigner(userDesignerName);
    }
  }, [userDesignerName, isDesignerRestricted]);

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

  // Load Data
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const activeDesignerQuery = isDesignerRestricted ? userDesignerName : selectedDesigner;
      const [cfg, resTasks, resStats] = await Promise.all([
        api.getPrintConfig().catch(() => ({})),
        api.getDesignerTasks({
          startDate: activeDateRange.dateStart || '',
          endDate: activeDateRange.dateEnd || '',
          designerName: activeDesignerQuery,
          fabricName: selectedFabric,
          drowDesignStatus: drowFilter,
          colourMatchingStatus: cmFilter,
          finalDesignStatus: finalFilter,
          search: searchQuery,
        }),
        api.getDesignerStats().catch(() => null),
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
  ]);

  // Client-side quick filter
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // If non-admin user is restricted to a designer, filter locally to their designs only
    if (isDesignerRestricted && userDesignerName) {
      const uDes = userDesignerName.toLowerCase();
      result = result.filter(t => {
        const dStr = String(t.designerName || '').toLowerCase();
        const dArr = Array.isArray(t.designers) ? t.designers.map(s => String(s).toLowerCase()) : [];
        return dStr.includes(uDes) || dArr.some(d => d.includes(uDes));
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
  }, [tasks, searchQuery, isDesignerRestricted, userDesignerName]);

  // Open the Status & Image Modal
  const handleOpenStatusModal = (task, category, statusType, statusValue = '') => {
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

  return (
    <div style={{ padding: '1.25rem', maxWidth: '1600px', margin: '0 auto', color: '#0f172a' }}>
      {/* ─── Top Header Bar ────────────────────────────────────────────── */}
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
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(29, 78, 216, 0.25)',
              }}
            >
              <Palette size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                Designer Screen
              </h1>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
                Elite Digital Prints • Live Design Workflow & Multi-Image Cloudflare R2 Proofs
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
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
            Refresh
          </button>

          {onNavigate && (
            <button
              onClick={() => onNavigate('designer_module')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.95rem',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#1d4ed8',
                cursor: 'pointer',
              }}
            >
              <Layers size={14} /> Pipeline & Admin View
            </button>
          )}
        </div>
      </div>

      {/* ─── Metric Stats Strip ────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '0.85rem',
          marginBottom: '1.25rem',
        }}
      >
        {/* Draw Design Metrics Card */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #dbeafe',
            borderRadius: '12px',
            padding: '1rem',
            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={14} color="#2563eb" /> 1. Drow Design Status
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>In Drawing</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
            <div style={{ flex: 1, background: '#eff6ff', padding: '0.5rem 0.6rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#1d4ed8' }}>START WORK</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e3a8a' }}>{stats?.drow?.startWorking || 0}</div>
            </div>
            <div style={{ flex: 1, background: '#fffbeb', padding: '0.5rem 0.6rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#b45309' }}>REVIEW</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#92400e' }}>{stats?.drow?.reviewSample || 0}</div>
            </div>
            <div style={{ flex: 1, background: '#eef2ff', padding: '0.5rem 0.6rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#4338ca' }}>FINAL</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#312e81' }}>{stats?.drow?.finalSample || 0}</div>
            </div>
          </div>
        </div>

        {/* Colour Matching Metrics Card */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #fce7f3',
            borderRadius: '12px',
            padding: '1rem',
            boxShadow: '0 2px 6px rgba(219, 39, 119, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#9d174d', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Palette size={14} color="#db2777" /> 2. Colour Matching Status
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>C.M. Studio</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
            <div style={{ flex: 1, background: '#fdf2f8', padding: '0.5rem 0.6rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#be185d' }}>PANTON</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#831843' }}>{stats?.cm?.colourPanton || 0}</div>
            </div>
            <div style={{ flex: 1, background: '#fffbeb', padding: '0.5rem 0.6rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#b45309' }}>REVIEW</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#92400e' }}>{stats?.cm?.reviewSample || 0}</div>
            </div>
            <div style={{ flex: 1, background: '#eef2ff', padding: '0.5rem 0.6rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#4338ca' }}>FINAL</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#312e81' }}>{stats?.cm?.finalSample || 0}</div>
            </div>
          </div>
        </div>

        {/* Final Design Status Metrics Card */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #dcfce7',
            borderRadius: '12px',
            padding: '1rem',
            boxShadow: '0 2px 6px rgba(22, 163, 74, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CheckCircle2 size={14} color="#16a34a" /> 3. Final Design Status
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Approval Gate</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem' }}>
            <div style={{ flex: 1, background: '#f0fdf4', padding: '0.5rem 0.4rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#15803d' }}>APPROVED</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#14532d' }}>{stats?.final?.approvedSample || 0}</div>
            </div>
            <div style={{ flex: 1, background: '#fef2f2', padding: '0.5rem 0.4rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#b91c1c' }}>REJ DROW</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#7f1d1d' }}>{stats?.final?.rejectDrow || 0}</div>
            </div>
            <div style={{ flex: 1, background: '#fff7ed', padding: '0.5rem 0.4rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#c2410c' }}>REJ C.M.</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#7c2d12' }}>{stats?.final?.rejectCM || 0}</div>
            </div>
          </div>
        </div>
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
          {isDesignerRestricted ? (
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
              title="Locked to your assigned designs"
            >
              <User size={13} color="#2563eb" />
              <span>My Designs: {userDesignerName}</span>
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
              <option value="All">👤 All Designers</option>
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
        {(datePreset !== 'all' || (!isDesignerRestricted && selectedDesigner !== 'All') || selectedFabric !== 'All' || drowFilter !== 'All' || cmFilter !== 'All' || finalFilter !== 'All' || searchQuery) && (
          <button
            onClick={() => {
              setDatePreset('all');
              if (!isDesignerRestricted) setSelectedDesigner('All');
              setSelectedFabric('All');
              setDrowFilter('All');
              setCmFilter('All');
              setFinalFilter('All');
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

      {/* ─── Task Cards Grid ───────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <RefreshCw size={28} className="animate-spin" color="#2563eb" style={{ margin: '0 auto 0.75rem' }} />
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>Loading design tasks from server...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <Palette size={40} color="#94a3b8" style={{ margin: '0 auto 0.75rem' }} />
          <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.1rem', color: '#334155' }}>No Design Tasks Found</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            Try changing the date filter, clearing search, or creating a design task in the Admin module.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1.15rem' }}>
          {filteredTasks.map((task) => {
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
              <div
                key={task._id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.9rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                {/* ── Card Header ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
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
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                      {task.designName}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px',
                        background: priorityConfig.bg,
                        color: priorityConfig.color,
                        border: `1px solid ${priorityConfig.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <span>{priorityConfig.badge}</span>
                      <span>{task.priority || 'Medium'}</span>
                    </span>

                    <button
                      onClick={() => setHistoryTask(task)}
                      title="View Complete Stage & Audit History"
                      style={{
                        padding: '0.3rem 0.5rem',
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        color: '#475569',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                      }}
                    >
                      <History size={13} />
                      <span>{task.stageHistory?.length || 0}</span>
                    </button>
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
                {(task.sampleImage || task.sampleLink) && (
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
                          width: '54px',
                          height: '54px',
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
                      <span>DROW DESIGN STATUS</span>
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
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
                    {DROW_STATUS_OPTIONS.map((opt) => {
                      const isActive = task.drowDesignStatus === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleOpenStatusModal(task, 'drow_design', 'DROW DESIGN STATUS', opt.id)}
                          style={{
                            flex: 1,
                            minWidth: '85px',
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
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>No drow images uploaded yet</span>
                      )}
                    </div>

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
                      <Upload size={11} /> + Upload Image(s)
                    </button>
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
                      <span>COLOUR MATCHING STATUS</span>
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
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
                    {COLOUR_MATCHING_OPTIONS.map((opt) => {
                      const isActive = task.colourMatchingStatus === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleOpenStatusModal(task, 'colour_matching', 'COLOUR MATCHING STATUS', opt.id)}
                          style={{
                            flex: 1,
                            minWidth: '85px',
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
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>No C.M. images uploaded yet</span>
                      )}
                    </div>

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
                      <Upload size={11} /> + Upload Image(s)
                    </button>
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
                      <span>FINAL DESIGN STATUS</span>
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
                        {task.finalDesignStatus}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontStyle: 'italic' }}>Pending Review</span>
                    )}
                  </div>

                  {/* Action Buttons for Final Design */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.35rem', marginBottom: '0.45rem' }}>
                    {FINAL_DESIGN_OPTIONS.map((opt) => {
                      const isActive = task.finalDesignStatus === opt.id;
                      const IconComp = opt.icon || CheckCircle2;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleOpenStatusModal(task, 'final_design', 'FINAL DESIGN STATUS', opt.id)}
                          style={{
                            padding: '0.35rem 0.45rem',
                            fontSize: '0.66rem',
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
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>No final proofs uploaded yet</span>
                      )}
                    </div>

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
                      <Upload size={11} /> + Upload Image(s)
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MODAL: UPDATE STATUS & MULTI-IMAGE UPLOAD TO CLOUDFLARE R2 ─── */}
      {activeModalData && (
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
    </div>
  );
}
