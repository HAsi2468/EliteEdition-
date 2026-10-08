import React, { useState, useMemo } from 'react';
import {
  Layers,
  FileText,
  Printer,
  Download,
  Trash2,
  Copy,
  PlusCircle,
  Menu,
  ChevronLeft,
  Search,
  CheckCircle,
  Clock,
  Smartphone,
  Tablet,
  Monitor,
  Sparkles,
  Package,
  Users,
  Settings,
  BarChart3,
  SlidersHorizontal,
  Zap,
  CornerDownLeft,
  X,
  Eye
} from 'lucide-react';
import { useDeviceContext } from '../../hooks/useDeviceContext';
import { SplitActionGroup } from '../common/SplitActionGroup';
import { useTableDensity, TableDensityToggle } from '../../hooks/useTableDensity';
import { RowPeekDrawer } from '../common/RowPeekDrawer';
import { useKeyboardProgression } from '../../hooks/useKeyboardProgression';
import { useFormDraft, DraftStatusBadge } from '../../utils/useFormDraft';
import { GlobalSearchModal } from '../common/GlobalSearchModal';
import './ErpLayoutShell.css';

/**
 * Enterprise ERP Dataset for Demonstration of High-Density Grids & Adaptive Views
 */
const INITIAL_ORDERS = [
  { id: 'ORD-9841', party: 'Vogue Apparels Ltd', meterage: '2,450.00 m', fabric: 'Cotton Satin 60s', status: 'In Production', priority: 'High', date: '08 Oct 2026' },
  { id: 'ORD-9842', party: 'Sanskriti Textiles', meterage: '1,200.50 m', fabric: 'Modal Silk 40s', status: 'Ready for Dispatch', priority: 'Normal', date: '08 Oct 2026' },
  { id: 'ORD-9843', party: 'Zenith Retail Hub', meterage: '4,800.00 m', fabric: 'Viscose Rayon 30s', status: 'Printing Queue', priority: 'Urgent', date: '07 Oct 2026' },
  { id: 'ORD-9844', party: 'Surat Fashion House', meterage: '850.25 m', fabric: 'Pure Linen 50 Lea', status: 'Drafting', priority: 'Normal', date: '07 Oct 2026' },
  { id: 'ORD-9845', party: 'Royal Silk Mills', meterage: '3,100.00 m', fabric: 'Crepe De Chine', status: 'Completed', priority: 'Low', date: '06 Oct 2026' },
  { id: 'ORD-9846', party: 'Ambience Garments', meterage: '1,980.75 m', fabric: 'Cotton Cambric 60s', status: 'In Production', priority: 'High', date: '06 Oct 2026' },
  { id: 'ORD-9847', party: 'Monarch Prints', meterage: '5,420.00 m', fabric: 'Georgette 60g', status: 'Printing Queue', priority: 'Urgent', date: '05 Oct 2026' }
];

export function ErpLayoutShell({ activeModule = 'Production', onModuleChange }) {
  const { breakpoint, isMobile, isTablet, isDesktop, isPWA, platform } = useDeviceContext();

  const [orders, setOrders] = useState(INITIAL_ORDERS);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('ORD-9841');
  const [activeTab, setActiveTab] = useState(activeModule);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');

  // 1. High-Density Table Controls & Peek Drawer State
  const { density, setDensity, toggleDensity, isCompact } = useTableDensity('compact');
  const [isPeekDrawerOpen, setIsPeekDrawerOpen] = useState(false);

  // 2. Global Command Palette Modal State
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // 3. Rapid Data Entry Modal & Hook States
  const [isRapidModalOpen, setIsRapidModalOpen] = useState(false);
  const [rapidForm, setRapidForm] = useState({
    party: '',
    fabric: 'Cotton Satin 60s',
    meterage: '',
    priority: 'Normal'
  });

  // Rapid form auto-draft persistence via IndexedDB / LocalStorage
  const { clearDraft, saveStatus, lastSavedAt } = useFormDraft(
    'rapid_order_entry_demo',
    rapidForm,
    setRapidForm,
    isRapidModalOpen
  );

  // Handle adding order from Rapid Data Entry
  const handleRapidOrderSubmit = () => {
    if (!rapidForm.party.trim()) {
      alert('Please enter a Client / Party name.');
      return;
    }

    const nextNum = 9840 + orders.length + 1;
    const newRecord = {
      id: `ORD-${nextNum}`,
      party: rapidForm.party.trim(),
      meterage: `${parseFloat(rapidForm.meterage || 1000).toFixed(2)} m`,
      fabric: rapidForm.fabric || 'Cotton Satin 60s',
      status: 'Printing Queue',
      priority: rapidForm.priority || 'Normal',
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    };

    setOrders([newRecord, ...orders]);
    setSelectedOrderId(newRecord.id);
    clearDraft();
    setRapidForm({
      party: '',
      fabric: 'Cotton Satin 60s',
      meterage: '',
      priority: 'Normal'
    });
    setIsRapidModalOpen(false);
    setNotification(`Created ${newRecord.id} via Rapid Data Entry!`);
    setTimeout(() => setNotification(null), 3500);
  };

  // Rapid Data Entry Keyboard Progression (Enter moves to next input, submits on last)
  const { containerRef: rapidFormRef, handleKeyDown: handleRapidKeyDown } = useKeyboardProgression({
    onComplete: handleRapidOrderSubmit,
    autoFocusFirst: true
  });

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    if (!searchFilter.trim()) return orders;
    const q = searchFilter.toLowerCase();
    return orders.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        o.party.toLowerCase().includes(q) ||
        o.fabric.toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q)
    );
  }, [orders, searchFilter]);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) || orders[0] || {};
  const currentOrderIndex = orders.findIndex((o) => o.id === selectedOrderId);

  // Action handlers
  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setNotification(`Saved ${selectedOrder.id} successfully!`);
      setTimeout(() => setNotification(null), 3000);
    }, 600);
  };

  const handleSaveAndNew = () => {
    setIsRapidModalOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    setNotification(`Exported ${selectedOrder.id} to CSV.`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedOrder.id}?`)) {
      setOrders(orders.filter((o) => o.id !== selectedOrder.id));
      setIsPeekDrawerOpen(false);
      setNotification(`Deleted ${selectedOrder.id}`);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Consolidated Action Definitions
  const primaryAction = {
    label: 'Save Changes',
    icon: CheckCircle,
    onClick: handleSave,
    loading: isSaving,
    shortcut: 'mod+s',
  };

  const secondaryActions = [
    {
      id: 'save-new',
      label: 'Rapid Entry (New Record)',
      icon: PlusCircle,
      onClick: handleSaveAndNew,
      shortcut: 'mod+shift+s',
    },
    {
      id: 'print',
      label: 'Print Job Card',
      icon: Printer,
      onClick: handlePrint,
      shortcut: 'mod+p',
    },
    {
      id: 'export',
      label: 'Export to Excel / CSV',
      icon: Download,
      onClick: handleExport,
    },
    {
      id: 'duplicate',
      label: 'Duplicate Record',
      icon: Copy,
      onClick: () => {
        setNotification(`Record ${selectedOrder.id} duplicated.`);
        setTimeout(() => setNotification(null), 3000);
      },
      dividerAfter: true,
    },
    {
      id: 'delete',
      label: 'Delete Record',
      icon: Trash2,
      isDestructive: true,
      onClick: handleDelete,
    },
  ];

  // Fields for Peek Drawer
  const peekFields = [
    { label: 'Client / Party', value: selectedOrder.party },
    { label: 'Fabric Quality', value: selectedOrder.fabric },
    { label: 'Total Meterage', value: selectedOrder.meterage, isNumeric: true },
    { label: 'Workflow Stage', value: selectedOrder.status, color: '#2563eb' },
    { label: 'Priority Flag', value: selectedOrder.priority, color: selectedOrder.priority === 'Urgent' ? '#dc2626' : '#1e293b' },
    { label: 'Entry Date', value: selectedOrder.date, isNumeric: true },
    { label: 'GST Tax Code', value: 'HSN 5407 (Fabric Printing)' },
    { label: 'Production Line', value: 'Reggiani Digital Printer 02' }
  ];

  return (
    <div className={`erp-layout-shell ${isPWA ? 'is-pwa' : ''}`}>
      {/* =====================================================================
          Unified Enterprise Header Bar
          ===================================================================== */}
      <header className="erp-header">
        <div className="erp-header-left">
          {isDesktop && (
            <button
              type="button"
              className="split-sheet-close"
              onClick={() => setSidebarCollapsed((p) => !p)}
              title="Toggle Sidebar"
              style={{ width: 32, height: 32 }}
            >
              <Menu size={16} />
            </button>
          )}

          <div className="erp-brand-badge">
            <span style={{ color: 'var(--erp-primary)', fontWeight: 800 }}>ELITE</span>
            <span>EDITION ERP</span>
          </div>

          {/* Platform & Breakpoint Indicator Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className={`erp-mode-pill ${isPWA ? 'pwa' : 'browser'}`}>
              {isPWA ? 'PWA Standalone' : 'Web Browser'}
            </span>
            <span
              style={{
                fontSize: '0.68rem',
                background: '#f1f5f9',
                color: '#475569',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {isDesktop && <Monitor size={12} />}
              {isTablet && <Tablet size={12} />}
              {isMobile && <Smartphone size={12} />}
              <span>{breakpoint.toUpperCase()}</span>
            </span>
          </div>

          {/* Shortcut-Driven Command Palette Trigger in Header */}
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            title="Open Global Command Palette (⌘K / Ctrl+K)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: 500,
              color: '#475569',
              cursor: 'pointer',
              marginLeft: '8px'
            }}
          >
            <Search size={13} color="#2563eb" />
            <span style={{ display: isMobile ? 'none' : 'inline' }}>Command Palette</span>
            <kbd style={{ padding: '1px 5px', fontSize: '10px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '3px' }}>
              ⌘K
            </kbd>
          </button>
        </div>

        <div className="erp-header-right">
          {notification && (
            <div
              style={{
                fontSize: '0.78rem',
                color: '#065f46',
                background: '#d1fae5',
                padding: '4px 10px',
                borderRadius: '6px',
                fontWeight: 600,
                animation: 'splitDropdownFadeIn 0.2s ease',
              }}
            >
              {notification}
            </div>
          )}

          {/* Desktop inline SplitActionGroup inside top action header */}
          {!isMobile && (
            <SplitActionGroup
              primaryAction={primaryAction}
              secondaryActions={secondaryActions}
              variant="primary"
              align="right"
            />
          )}
        </div>
      </header>

      {/* =====================================================================
          Main ERP Body (Sidebar + Dynamic Workspace)
          ===================================================================== */}
      <div className="erp-body">
        {/* Persistent Desktop Sidebar */}
        {isDesktop && (
          <aside className={`erp-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
            <nav className="erp-sidebar-nav">
              {[
                { name: 'Production', icon: Layers },
                { name: 'Job Cards', icon: FileText },
                { name: 'Inventory', icon: Package },
                { name: 'Analytics', icon: BarChart3 },
                { name: 'Team & Access', icon: Users },
                { name: 'System Settings', icon: Settings },
              ].map((item) => {
                const ItemIcon = item.icon;
                const isActive = activeTab === item.name;
                return (
                  <button
                    key={item.name}
                    type="button"
                    className={`erp-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveTab(item.name)}
                    title={item.name}
                  >
                    <ItemIcon size={18} />
                    {!sidebarCollapsed && <span>{item.name}</span>}
                  </button>
                );
              })}
            </nav>
          </aside>
        )}

        {/* Dynamic Viewport Container */}
        <main className="erp-content-viewport">
          {/* =================================================================
              1. DESKTOP VIEWPORT (>=1200px): Dense Grid + Sticky Header + Frozen Cols
              ================================================================= */}
          {isDesktop && (
            <div className="erp-desktop-grid-container">
              <div
                className="erp-top-action-bar"
                style={{
                  borderRadius: '8px',
                  border: '1px solid var(--erp-border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 14px'
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Production Orders Grid</h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--erp-text-muted)' }}>
                    Sticky headers, column freezing, tabular metrics, and flyout row peek drawers.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Grid Density Toggle (Compact vs Comfortable) */}
                  <TableDensityToggle density={density} onChange={setDensity} />

                  {/* Rapid Data Entry Trigger */}
                  <button
                    type="button"
                    onClick={() => setIsRapidModalOpen(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                    title="Rapid Keyboard-First Data Entry (Enter/Tab progression)"
                  >
                    <Zap size={13} />
                    <span>Rapid Entry</span>
                  </button>

                  {/* Filter Search Input */}
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Filter records..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      style={{
                        padding: '5px 10px 5px 30px',
                        fontSize: '0.82rem',
                        borderRadius: '6px',
                        border: '1px solid var(--erp-border-color)',
                        outline: 'none',
                        width: '180px'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Data Table Card with Sticky Headers & Column Freezing */}
              <div className="erp-table-card">
                <div className="erp-dense-table-wrapper">
                  <table className={`erp-dense-table sticky-header ${isCompact ? 'erp-density-compact' : 'erp-density-comfortable'}`}>
                    <thead>
                      <tr>
                        <th className="freeze-col-left" style={{ width: '130px', minWidth: '130px' }}>Order ID</th>
                        <th>Client / Party</th>
                        <th>Fabric Specification</th>
                        <th className="tabular-nums" style={{ textAlign: 'right' }}>Total Meterage</th>
                        <th>Workflow Status</th>
                        <th>Priority</th>
                        <th className="tabular-nums" style={{ textAlign: 'right' }}>Entry Date</th>
                        <th className="freeze-col-right" style={{ textAlign: 'right', width: '120px', minWidth: '120px' }}>Quick Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((order) => (
                        <tr
                          key={order.id}
                          style={{
                            background: selectedOrderId === order.id ? '#f0f7ff' : 'transparent',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            setSelectedOrderId(order.id);
                            setIsPeekDrawerOpen(true);
                          }}
                        >
                          {/* Frozen Left Column: Order ID */}
                          <td className="freeze-col-left" style={{ fontWeight: 700, color: 'var(--erp-primary)', background: selectedOrderId === order.id ? '#f0f7ff' : '#ffffff' }}>
                            {order.id}
                          </td>
                          <td style={{ fontWeight: 600 }}>{order.party}</td>
                          <td>{order.fabric}</td>
                          {/* Tabular Numeric Meterage */}
                          <td className="tabular-nums" style={{ fontWeight: 600, color: '#0f172a' }}>
                            {order.meterage}
                          </td>
                          <td>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: order.status === 'Completed' ? '#dcfce7' : '#eff6ff',
                                color: order.status === 'Completed' ? '#166534' : '#1d4ed8',
                              }}
                            >
                              {order.status}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600, color: order.priority === 'Urgent' ? '#dc2626' : '#475569' }}>
                              {order.priority}
                            </span>
                          </td>
                          {/* Tabular Numeric Date */}
                          <td className="tabular-nums" style={{ color: 'var(--erp-text-muted)' }}>
                            {order.date}
                          </td>
                          {/* Frozen Right Column: Actions */}
                          <td className="freeze-col-right" style={{ textAlign: 'right', background: selectedOrderId === order.id ? '#f0f7ff' : '#ffffff' }}>
                            <button
                              type="button"
                              className="split-sheet-close"
                              style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrderId(order.id);
                                setIsPeekDrawerOpen(true);
                              }}
                              title="Inspect order in right peek drawer"
                            >
                              <Eye size={14} color="#2563eb" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              2. TABLET VIEWPORT (768px - 1199px): Master-Detail Split Pane
              ================================================================= */}
          {isTablet && (
            <div className="erp-tablet-split-view">
              {/* Left Column: Master List */}
              <div className="erp-tablet-master-list">
                <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--erp-border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Production Orders ({orders.length})</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--erp-text-muted)' }}>Tap an order to review details</div>
                  </div>
                  <TableDensityToggle density={density} onChange={setDensity} />
                </div>
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className={`erp-tablet-row-card ${selectedOrderId === order.id ? 'selected' : ''}`}
                    onClick={() => setSelectedOrderId(order.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--erp-primary)' }}>{order.id}</span>
                      <span className="tabular-nums" style={{ fontSize: '0.72rem', color: '#64748b' }}>{order.meterage}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', marginTop: '2px' }}>
                      {order.party}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.72rem' }}>
                      <span style={{ color: '#64748b' }}>{order.fabric}</span>
                      <span style={{ fontWeight: 700, color: order.status === 'Completed' ? '#166534' : '#2563eb' }}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Right Column: Detail Pane */}
              <div className="erp-tablet-detail-pane">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '1rem', borderRadius: '10px', border: '1px solid var(--erp-border-color)' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Selected Record</span>
                    <h3 style={{ margin: '2px 0 0 0', fontSize: '1.2rem', fontWeight: 700 }}>{selectedOrder.id} — {selectedOrder.party}</h3>
                  </div>
                  <SplitActionGroup
                    primaryAction={primaryAction}
                    secondaryActions={secondaryActions}
                    variant="primary"
                    align="right"
                  />
                </div>

                <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--erp-border-color)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Fabric Quality</label>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '2px' }}>{selectedOrder.fabric}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Batch Meterage</label>
                    <div className="tabular-nums" style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '2px', textAlign: 'left' }}>{selectedOrder.meterage}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Current Workflow Stage</label>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#2563eb', marginTop: '2px' }}>{selectedOrder.status}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Priority Flag</label>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: selectedOrder.priority === 'Urgent' ? '#dc2626' : '#1e293b', marginTop: '2px' }}>{selectedOrder.priority}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              3. MOBILE PHONE VIEWPORT (<768px): Scannable Cards + Bottom Bar
              ================================================================= */}
          {isMobile && (
            <div className="erp-mobile-container">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Active Job Cards</h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{orders.length} records</span>
              </div>

              {orders.map((order) => (
                <div
                  key={order.id}
                  className="erp-mobile-card"
                  onClick={() => {
                    setSelectedOrderId(order.id);
                    setIsPeekDrawerOpen(true);
                  }}
                  style={{
                    borderColor: selectedOrderId === order.id ? 'var(--erp-primary)' : 'var(--erp-border-color)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--erp-primary)' }}>{order.id}</span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        background: order.status === 'Completed' ? '#dcfce7' : '#eff6ff',
                        color: order.status === 'Completed' ? '#166534' : '#1d4ed8',
                      }}
                    >
                      {order.status}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a', margin: '4px 0 2px' }}>
                    {order.party}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                    <span>{order.fabric}</span>
                    <span className="tabular-nums" style={{ fontWeight: 600, color: '#0f172a' }}>{order.meterage}</span>
                  </div>
                </div>
              ))}

              {/* Mobile Docked Action Group */}
              <SplitActionGroup
                primaryAction={primaryAction}
                secondaryActions={secondaryActions}
                mobilePlacement="dock"
              />
            </div>
          )}
        </main>
      </div>

      {/* =====================================================================
          High-Density Right-Side Peek Drawer (Flyout Panel)
          ===================================================================== */}
      <RowPeekDrawer
        isOpen={isPeekDrawerOpen}
        onClose={() => setIsPeekDrawerOpen(false)}
        title={selectedOrder.id}
        subtitle={selectedOrder.party}
        badgeText={selectedOrder.status}
        badgeColor={selectedOrder.status === 'Completed' ? '#166534' : '#1d4ed8'}
        badgeBg={selectedOrder.status === 'Completed' ? '#dcfce7' : '#eff6ff'}
        record={selectedOrder}
        fields={peekFields}
        currentIndex={currentOrderIndex}
        totalCount={orders.length}
        onNavigatePrevious={currentOrderIndex > 0 ? () => setSelectedOrderId(orders[currentOrderIndex - 1].id) : null}
        onNavigateNext={currentOrderIndex < orders.length - 1 ? () => setSelectedOrderId(orders[currentOrderIndex + 1].id) : null}
        actions={[
          {
            label: 'Print Job Card',
            icon: Printer,
            variant: 'secondary',
            onClick: handlePrint
          },
          {
            label: 'Save & Dispatch',
            icon: CheckCircle,
            variant: 'primary',
            onClick: handleSave
          }
        ]}
      />

      {/* =====================================================================
          Rapid Data Entry Modal (Keyboard-First + Auto-Draft Persistence)
          ===================================================================== */}
      {isRapidModalOpen && (
        <div
          onClick={() => setIsRapidModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            ref={rapidFormRef}
            onKeyDown={handleRapidKeyDown}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              width: '100%',
              maxWidth: '480px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                    Rapid Data Entry Mode
                  </h3>
                  <DraftStatusBadge saveStatus={saveStatus} lastSavedAt={lastSavedAt} onClear={clearDraft} />
                </div>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Keyboard-first workflow: Press <kbd style={{ padding: '1px 4px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '3px' }}>↵ Enter</kbd> to advance between fields.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRapidModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Inputs with Enter Progression */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Client / Party Name *
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Vogue Apparels Ltd"
                  value={rapidForm.party}
                  onChange={(e) => setRapidForm({ ...rapidForm, party: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Fabric Specification
                  </label>
                  <select
                    value={rapidForm.fabric}
                    onChange={(e) => setRapidForm({ ...rapidForm, fabric: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="Cotton Satin 60s">Cotton Satin 60s</option>
                    <option value="Modal Silk 40s">Modal Silk 40s</option>
                    <option value="Viscose Rayon 30s">Viscose Rayon 30s</option>
                    <option value="Pure Linen 50 Lea">Pure Linen 50 Lea</option>
                    <option value="Crepe De Chine">Crepe De Chine</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Meterage (Meters)
                  </label>
                  <input
                    type="number"
                    placeholder="2500"
                    value={rapidForm.meterage}
                    onChange={(e) => setRapidForm({ ...rapidForm, meterage: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      fontVariantNumeric: 'tabular-nums',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Priority Level
                </label>
                <select
                  value={rapidForm.priority}
                  onChange={(e) => setRapidForm({ ...rapidForm, priority: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CornerDownLeft size={12} />
                <span>Enter on last field adds record</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsRapidModalOpen(false)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRapidOrderSubmit}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'var(--erp-primary, #2563eb)',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>Add Order</span>
                  <kbd style={{ padding: '1px 4px', fontSize: '10px', background: 'rgba(255,255,255,0.25)', borderRadius: '3px' }}>↵</kbd>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          Global Command Palette Modal
          ===================================================================== */}
      <GlobalSearchModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectResult={(item) => {
          if (item.action === 'new_jobcard') {
            setIsRapidModalOpen(true);
          } else if (item.tab) {
            setActiveTab(item.tab);
          }
        }}
      />
    </div>
  );
}

export default ErpLayoutShell;
