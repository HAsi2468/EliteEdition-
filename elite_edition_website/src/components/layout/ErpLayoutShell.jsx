import React, { useState } from 'react';
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
  BarChart3
} from 'lucide-react';
import { useDeviceContext } from '../../hooks/useDeviceContext';
import { SplitActionGroup } from '../common/SplitActionGroup';
import './ErpLayoutShell.css';

/**
 * Mock ERP Dataset for Demonstration of Adaptive Views
 */
const SAMPLE_ORDERS = [
  { id: 'ORD-9841', party: 'Vogue Apparels Ltd', meterage: '2,450 m', fabric: 'Cotton Satin 60s', status: 'In Production', priority: 'High', date: '08 Oct 2026' },
  { id: 'ORD-9842', party: 'Sanskriti Textiles', meterage: '1,200 m', fabric: 'Modal Silk 40s', status: 'Ready for Dispatch', priority: 'Normal', date: '08 Oct 2026' },
  { id: 'ORD-9843', party: 'Zenith Retail Hub', meterage: '4,800 m', fabric: 'Viscose Rayon 30s', status: 'Printing Queue', priority: 'Urgent', date: '07 Oct 2026' },
  { id: 'ORD-9844', party: 'Surat Fashion House', meterage: '850 m', fabric: 'Pure Linen 50 Lea', status: 'Drafting', priority: 'Normal', date: '07 Oct 2026' },
  { id: 'ORD-9845', party: 'Royal Silk Mills', meterage: '3,100 m', fabric: 'Crepe De Chine', status: 'Completed', priority: 'Low', date: '06 Oct 2026' },
];

/**
 * ErpLayoutShell
 * 
 * Principal Responsive ERP Layout Architecture
 * Dynamically pivots layout density and interaction models across:
 *  1. Desktop PC: Dense fixed-header data table, persistent sidebar, keyboard shortcuts.
 *  2. Tablet: Master-detail split pane, tap-friendly list, modal form inspectors.
 *  3. Mobile Phone: Scannable stacked cards, bottom navigation bar, docked SplitActionGroup with bottom sheet.
 */
export function ErpLayoutShell({ activeModule = 'Production', onModuleChange }) {
  const { breakpoint, isMobile, isTablet, isDesktop, isPWA, platform } = useDeviceContext();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('ORD-9841');
  const [activeTab, setActiveTab] = useState(activeModule);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  const selectedOrder = SAMPLE_ORDERS.find((o) => o.id === selectedOrderId) || SAMPLE_ORDERS[0];

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
    setNotification('Saved and opened new blank record.');
    setTimeout(() => setNotification(null), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    setNotification(`Exported ${selectedOrder.id} to Excel.`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedOrder.id}?`)) {
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
      label: 'Save & Create New',
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
      onClick: () => setNotification('Record duplicated.'),
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
              title="Toggle Sidebar (Ctrl+B)"
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
              1. DESKTOP VIEWPORT (>=1200px): Dense Grid + Fixed Header
              ================================================================= */}
          {isDesktop && (
            <div className="erp-desktop-grid-container">
              <div className="erp-top-action-bar" style={{ borderRadius: '8px', border: '1px solid var(--erp-border-color)' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Production Orders Overview</h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--erp-text-muted)' }}>
                    High-density data grid with fixed headers and hotkey action consolidation (Ctrl/Cmd + S).
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Filter records..."
                      style={{
                        padding: '6px 10px 6px 30px',
                        fontSize: '0.82rem',
                        borderRadius: '6px',
                        border: '1px solid var(--erp-border-color)',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="erp-table-card">
                <div className="erp-dense-table-wrapper">
                  <table className="erp-dense-table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Client / Party</th>
                        <th>Fabric Specification</th>
                        <th>Total Meterage</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Entry Date</th>
                        <th style={{ textAlign: 'right' }}>Quick Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SAMPLE_ORDERS.map((order) => (
                        <tr
                          key={order.id}
                          style={{
                            background: selectedOrderId === order.id ? '#f0f7ff' : 'transparent',
                            cursor: 'pointer',
                          }}
                          onClick={() => setSelectedOrderId(order.id)}
                        >
                          <td style={{ fontWeight: 700, color: 'var(--erp-primary)' }}>{order.id}</td>
                          <td style={{ fontWeight: 600 }}>{order.party}</td>
                          <td>{order.fabric}</td>
                          <td style={{ fontWeight: 600 }}>{order.meterage}</td>
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
                          <td style={{ color: 'var(--erp-text-muted)' }}>{order.date}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="split-sheet-close"
                              style={{ width: 28, height: 28, display: 'inline-flex' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrderId(order.id);
                              }}
                              title="Inspect order"
                            >
                              <FileText size={14} />
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
                <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--erp-border-color)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Production Orders ({SAMPLE_ORDERS.length})</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--erp-text-muted)' }}>Tap an order to review details</div>
                </div>
                {SAMPLE_ORDERS.map((order) => (
                  <div
                    key={order.id}
                    className={`erp-tablet-row-card ${selectedOrderId === order.id ? 'selected' : ''}`}
                    onClick={() => setSelectedOrderId(order.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--erp-primary)' }}>{order.id}</span>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{order.meterage}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', marginTop: '2px' }}>
                      {order.party}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.72rem' }}>
                      <span style={{ color: '#64748b' }}>{order.fabric}</span>
                      <span style={{ fontWeight: 700, color: order.status === 'Completed' ? '#16a34a' : '#2563eb' }}>
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
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '2px' }}>{selectedOrder.meterage}</div>
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
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{SAMPLE_ORDERS.length} records</span>
              </div>

              {SAMPLE_ORDERS.map((order) => (
                <div
                  key={order.id}
                  className="erp-mobile-card"
                  onClick={() => setSelectedOrderId(order.id)}
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

                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>{order.party}</div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                    <span>{order.fabric}</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{order.meterage}</span>
                  </div>
                </div>
              ))}

              {/* Mobile Docked Action Bar: Dominant CTA + More (...) Bottom Sheet */}
              <SplitActionGroup
                primaryAction={primaryAction}
                secondaryActions={secondaryActions}
                mobilePlacement="dock"
              />
            </div>
          )}
        </main>
      </div>

      {/* Mobile Primary Module Navigation Bar (<768px) */}
      {isMobile && (
        <nav className="erp-mobile-bottom-nav">
          {[
            { name: 'Production', icon: Layers },
            { name: 'Job Cards', icon: FileText },
            { name: 'Inventory', icon: Package },
            { name: 'Settings', icon: Settings },
          ].map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.name;
            return (
              <button
                key={tab.name}
                type="button"
                className={`erp-mobile-nav-tab ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.name)}
              >
                <TabIcon size={20} />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

export default ErpLayoutShell;
