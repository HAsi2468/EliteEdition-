import React, { useState, useRef } from 'react';
import {
  FolderOpen, FileText, Image, Film, Archive, Upload, Plus, Search,
  Grid, List, Trash2, Download, MoreHorizontal, ChevronRight, Home, File,
  X, Copy, Edit2
} from 'lucide-react';

const DEMO_FOLDERS = [
  { id: 'f1', name: 'Design Files', type: 'folder', items: 14, updated: '2026-09-20' },
  { id: 'f2', name: 'Job Card PDFs', type: 'folder', items: 89, updated: '2026-09-22' },
  { id: 'f3', name: 'Fabric Samples', type: 'folder', items: 32, updated: '2026-09-18' },
  { id: 'f4', name: 'Invoice Exports', type: 'folder', items: 57, updated: '2026-09-23' },
  { id: 'f5', name: 'Brand Assets', type: 'folder', items: 21, updated: '2026-09-10' },
  { id: 'f6', name: 'Reports', type: 'folder', items: 8, updated: '2026-09-24' },
];

const DEMO_FILES = [
  { id: 'fi1', name: 'Q3_Summary_Report.pdf',      type: 'pdf',   size: '2.4 MB', updated: '2026-09-24', starred: true },
  { id: 'fi2', name: 'Logo_Final_v3.png',           type: 'image', size: '1.1 MB', updated: '2026-09-23', starred: false },
  { id: 'fi3', name: 'Job_Card_EDP-1042.pdf',       type: 'pdf',   size: '340 KB', updated: '2026-09-22', starred: false },
  { id: 'fi4', name: 'Fabric_Colour_Catalog.xlsx',  type: 'sheet', size: '5.8 MB', updated: '2026-09-21', starred: true },
  { id: 'fi5', name: 'Sample_Video_Process.mp4',    type: 'video', size: '48 MB',  updated: '2026-09-19', starred: false },
  { id: 'fi6', name: 'Design_Sketch_Kurta.jpg',     type: 'image', size: '890 KB', updated: '2026-09-18', starred: false },
  { id: 'fi7', name: 'Challan_EDP-Stitch-234.pdf',  type: 'pdf',   size: '210 KB', updated: '2026-09-17', starred: false },
  { id: 'fi8', name: 'Monthly_Stock_Aug.zip',        type: 'zip',   size: '12 MB',  updated: '2026-09-10', starred: false },
];

const ICON_MAP = {
  folder: { icon: '📁', bg: 'rgba(251,191,36,0.15)', color: '#fbbf24' },
  pdf:    { icon: '📄', bg: 'rgba(239,68,68,0.15)',  color: '#f87171' },
  image:  { icon: '🖼️', bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
  video:  { icon: '🎬', bg: 'rgba(168,85,247,0.15)', color: '#a855f7' },
  sheet:  { icon: '📊', bg: 'rgba(56,189,248,0.15)', color: '#38bdf8' },
  zip:    { icon: '🗜️', bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  default:{ icon: '📁', bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
};

const SIDEBAR_FOLDERS = [
  { id: 'all', label: 'All Files', icon: <Home size={14} /> },
  { id: 'f1',  label: 'Design Files', icon: <FolderOpen size={14} /> },
  { id: 'f2',  label: 'Job Card PDFs', icon: <FolderOpen size={14} /> },
  { id: 'f3',  label: 'Fabric Samples', icon: <FolderOpen size={14} /> },
  { id: 'f4',  label: 'Invoice Exports', icon: <FolderOpen size={14} /> },
  { id: 'f5',  label: 'Brand Assets', icon: <FolderOpen size={14} /> },
  { id: 'f6',  label: 'Reports', icon: <FolderOpen size={14} /> },
];

function formatDate(s) {
  const d = new Date(s);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

export default function FileManager() {
  const [viewMode, setViewMode] = useState('grid'); // grid | list
  const [search, setSearch] = useState('');
  const [activeFolder, setActiveFolder] = useState('all');
  const [selectedItems, setSelectedItems] = useState([]);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, item }
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef();

  const allItems = [...DEMO_FOLDERS, ...DEMO_FILES];
  const filtered = allItems.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchFolder = activeFolder === 'all' || (item.type !== 'folder' && activeFolder !== 'all');
    return matchSearch;
  });

  const toggleSelect = (id) => setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const isSelected = (id) => selectedItems.includes(id);

  const handleContextMenu = (e, item) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const simulateUpload = () => {
    setUploading(true);
    setTimeout(() => { setUploading(false); setShowUploadModal(false); }, 1800);
  };

  const getIcon = (type) => ICON_MAP[type] || ICON_MAP.default;

  return (
    <div style={{ display: 'flex', height: '100%', gap: '1rem' }} onClick={() => setContextMenu(null)}>
      {/* Sidebar */}
      <div className="glass-panel" style={{ width: '200px', flexShrink: 0, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', overflow: 'hidden' }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>Folders</div>
        {SIDEBAR_FOLDERS.map(f => (
          <button key={f.id} onClick={() => setActiveFolder(f.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.6rem', borderRadius: '8px',
              background: activeFolder === f.id ? 'var(--nav-active-bg)' : 'transparent',
              border: activeFolder === f.id ? '1px solid var(--primary)' : '1px solid transparent',
              color: activeFolder === f.id ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', width: '100%' }}>
            {f.icon}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</span>
          </button>
        ))}
        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Storage</div>
          <div style={{ background: 'var(--border-light)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
            <div style={{ width: '47%', height: '100%', background: 'linear-gradient(90deg,#6366f1,#38bdf8)', borderRadius: '4px' }} />
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>4.7 GB of 10 GB used</div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <Home size={13} />
            <ChevronRight size={11} />
            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
              {activeFolder === 'all' ? 'All Files' : SIDEBAR_FOLDERS.find(f => f.id === activeFolder)?.label}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files..." style={{ paddingLeft: '2rem', width: '180px' }} />
            </div>
            <button onClick={() => setViewMode('grid')} style={{ padding: '0.35rem', borderRadius: '6px', border: `1px solid ${viewMode==='grid'?'var(--primary)':'var(--border-light)'}`, background: viewMode==='grid'?'var(--primary-glow)':'transparent', color: viewMode==='grid'?'var(--primary)':'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <Grid size={15} />
            </button>
            <button onClick={() => setViewMode('list')} style={{ padding: '0.35rem', borderRadius: '6px', border: `1px solid ${viewMode==='list'?'var(--primary)':'var(--border-light)'}`, background: viewMode==='list'?'var(--primary-glow)':'transparent', color: viewMode==='list'?'var(--primary)':'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <List size={15} />
            </button>
            <button onClick={() => setShowUploadModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', borderRadius: '8px', background: 'linear-gradient(135deg,#6366f1,#38bdf8)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
              <Upload size={13} /> Upload
            </button>
          </div>
        </div>

        {/* Selection bar */}
        {selectedItems.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.85rem', borderRadius: '8px', background: 'var(--primary-glow)', border: '1px solid var(--primary)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)' }}>
            <span>{selectedItems.length} selected</span>
            <button onClick={() => setSelectedItems([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 700, fontSize: '0.78rem', fontFamily: 'var(--font-sans)' }}><X size={12} /> Clear</button>
            <button style={{ marginLeft: 'auto', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '6px', padding: '0.25rem 0.6rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'var(--font-sans)' }}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}

        {/* Folders section */}
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>Folders</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
            {DEMO_FOLDERS.map(folder => {
              const ic = getIcon('folder');
              return (
                <div key={folder.id} onContextMenu={e => handleContextMenu(e, folder)}
                  className={`file-card${isSelected(folder.id) ? ' selected' : ''}`}
                  onClick={() => toggleSelect(folder.id)} onDoubleClick={() => setActiveFolder(folder.id)}>
                  <div className="file-card-icon" style={{ background: ic.bg, fontSize: '1.8rem' }}>📁</div>
                  <div className="file-card-name">{folder.name}</div>
                  <div className="file-card-meta">{folder.items} items · {formatDate(folder.updated)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Files section */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>Files</div>
          {viewMode === 'grid' ? (
            <div className="file-manager-grid">
              {DEMO_FILES.filter(f => f.name.toLowerCase().includes(search.toLowerCase())).map(file => {
                const ic = getIcon(file.type);
                return (
                  <div key={file.id} onContextMenu={e => handleContextMenu(e, file)}
                    className={`file-card${isSelected(file.id) ? ' selected' : ''}`}
                    onClick={() => toggleSelect(file.id)}>
                    <div className="file-card-icon" style={{ background: ic.bg, fontSize: '1.5rem' }}>{ic.icon}</div>
                    <div className="file-card-name">{file.name}</div>
                    <div className="file-card-meta">{file.size} · {formatDate(file.updated)}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="glass-panel" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%' }}>
                <thead><tr>
                  <th>Name</th><th>Size</th><th>Updated</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  {DEMO_FILES.filter(f => f.name.toLowerCase().includes(search.toLowerCase())).map(file => {
                    const ic = getIcon(file.type);
                    return (
                      <tr key={file.id} onClick={() => toggleSelect(file.id)} style={{ background: isSelected(file.id) ? 'var(--nav-active-bg)' : 'transparent', cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span style={{ fontSize: '1.1rem' }}>{ic.icon}</span>
                            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{file.name}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: '0.82rem' }}>{file.size}</td>
                        <td style={{ fontSize: '0.82rem' }}>{formatDate(file.updated)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center' }}><Download size={13} /></button>
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', display: 'flex', alignItems: 'center' }}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, background: 'var(--bg-modal)', border: '1px solid var(--border-light)', borderRadius: '10px', boxShadow: 'var(--shadow-lg)', zIndex: 10000, minWidth: '160px', overflow: 'hidden', animation: 'fadeIn 0.15s ease' }} onClick={e => e.stopPropagation()}>
          {[
            { icon: <Download size={13} />, label: 'Download' },
            { icon: <Copy size={13} />, label: 'Copy' },
            { icon: <Edit2 size={13} />, label: 'Rename' },
            { icon: <Trash2 size={13} />, label: 'Delete', danger: true },
          ].map(item => (
            <button key={item.label} onClick={() => setContextMenu(null)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.85rem', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', color: item.danger ? '#f87171' : 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'background 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--nav-active-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" style={{ maxWidth: '400px', padding: '1.5rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', margin: 0 }}>Upload Files</h3>
              <button onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div onClick={() => uploadRef.current?.click()}
              style={{ border: '2px dashed var(--border-light)', borderRadius: '12px', padding: '2rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', background: 'var(--nav-active-bg)' }}
              onDragOver={e => e.preventDefault()} onDrop={simulateUpload}>
              <Upload size={32} style={{ color: 'var(--primary)', margin: '0 auto 0.75rem', display: 'block' }} />
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>Drag & drop files here</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>or click to browse</div>
              <input ref={uploadRef} type="file" multiple style={{ display: 'none' }} onChange={simulateUpload} />
            </div>
            {uploading && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                  <span>Uploading...</span><span>68%</span>
                </div>
                <div style={{ background: 'var(--border-light)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                  <div style={{ width: '68%', height: '100%', background: 'linear-gradient(90deg,#6366f1,#38bdf8)', borderRadius: '4px', animation: 'toastProgress 1.8s linear' }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
