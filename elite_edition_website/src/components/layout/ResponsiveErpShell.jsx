import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  FileText,
  Package,
  Receipt,
  Users,
  Settings,
  BarChart3,
  Menu,
  Monitor,
  Tablet,
  Smartphone,
  Search,
  CheckCircle,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  QrCode,
  CheckSquare,
  Home,
  SlidersHorizontal,
  Building2,
  X
} from 'lucide-react';
import { useDeviceContext } from '../../hooks/useDeviceContext';
import { SplitActionGroup } from '../common/SplitActionGroup';
import { MultiTabBar } from './MultiTabBar';
import { GlobalSearchModal } from '../common/GlobalSearchModal';
import './ErpLayoutShell.css';

/**
 * ResponsiveErpShell
 * 
 * Principal Responsive UI Skeleton for Multi-Device Enterprise ERP Platform
 * Targets:
 * 1. Desktop/PC: Web & Installed PWA / Standalone Web App (>= 1200px)
 * 2. iPad & Android Tablets: Web & Installed PWA (768px - 1199px)
 * 3. iPhone & Android Phones: Web & Installed PWA (< 768px)
 * 
 * Strict Typography Contract:
 * - NO fluid viewport-relative typography.
 * - Body text, grid rows, inputs, form values: exactly 14px (line-height: 20px).
 * - Status badges, labels, column subheaders: exactly 12px (line-height: 16px).
 * - Navigation and card titles: exactly 16px. Section/page titles: exactly 18px–20px.
 * - font-variant-numeric: tabular-nums globally on numeric values (currencies, counts, IDs).
 * 
 * Form Factor Adaptation:
 * - Desktop (>= 1200px): Permanent collapsible dark-themed left-sidebar, top 'Cmd/Ctrl + K' search Command Palette,
 *   browser-style workspace Tabs ("Tab 1: Job Cards", "Tab 2: Fabric Stock"), standard compact density grids.
 * - Tablet (768px - 1199px): Master-Detail split-pane with collapsing master lists, slide-out drawer navigator,
 *   touch-ready targets scaled to minimum 44x44px with 14px font.
 * - Mobile (< 768px): Bottom primary sticky navigation tab bar, full-width content cards stacked vertically,
 *   safe-area insets (env(safe-area-inset-top), env(safe-area-inset-bottom)), and iOS auto-zoom prevention (16px input font).
 * 
 * Consolidated Multi-Operation Components (SplitActionGroup):
 * - Desktop: Primary button + attached right-chevron dropdown popover.
 * - Tablet: Icon-text action header + dropdown button.
 * - Mobile: Primary single bottom-docked focus button + overflow toggle "..." trigger sliding native bottom action sheet modal.
 */
export function ResponsiveErpShell({
  children,
  activeModule = 'Production',
  onModuleChange,
  activeTenant = 'Digital Print Division',
  onTenantChange,
  tenants = ['Digital Print Division', 'Elite Edition E-Commerce', 'Fabtex Garments & Stitching'],
  tabs: propTabs,
  activeTabId: propActiveTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  primaryAction,
  secondaryActions = [],
  // Tablet master-detail props
  tabletMasterList,
  tabletSelectedId,
  onTabletSelect
}) {
  const { breakpoint, isMobile, isTablet, isDesktop, isPWA } = useDeviceContext();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [mobileActiveNav, setMobileActiveNav] = useState('Home');

  // Default browser-style workspace tabs if none provided
  const [internalTabs, setInternalTabs] = useState([
    { id: 'job-cards', title: 'Tab 1: Job Cards', icon: FileText, isDirty: false },
    { id: 'fabric-stock', title: 'Tab 2: Fabric Stock', icon: Package, isDirty: false }
  ]);
  const [internalActiveTabId, setInternalActiveTabId] = useState('job-cards');

  const currentTabs = propTabs || internalTabs;
  const currentActiveTabId = propActiveTabId || internalActiveTabId;

  const handleSelectTab = (tabId) => {
    if (onSelectTab) onSelectTab(tabId);
    else setInternalActiveTabId(tabId);
  };

  const handleCloseTab = (tabId) => {
    if (onCloseTab) {
      onCloseTab(tabId);
    } else {
      const filtered = internalTabs.filter((t) => t.id !== tabId);
      setInternalTabs(filtered);
      if (internalActiveTabId === tabId && filtered.length > 0) {
        setInternalActiveTabId(filtered[0].id);
      }
    }
  };

  const handleNewTab = () => {
    if (onNewTab) {
      onNewTab();
    } else {
      const nextId = `tab-${internalTabs.length + 1}`;
      const newTab = {
        id: nextId,
        title: `Tab ${internalTabs.length + 1}: Workspace`,
        icon: FileText
      };
      setInternalTabs([...internalTabs, newTab]);
      setInternalActiveTabId(nextId);
    }
  };

  // Keyboard shortcut listener for Cmd/Ctrl + K (Global Command Palette)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      if (isMod && e.key.toLowerCase() === 'b' && isDesktop) {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isDesktop]);

  // Primary Navigation Roster
  const navigationItems = [
    { name: 'Production', icon: Layers, count: 18 },
    { name: 'Job Cards', icon: FileText, count: 42 },
    { name: 'Inventory', icon: Package, count: 5 },
    { name: 'Billing', icon: Receipt },
    { name: 'Analytics', icon: BarChart3 },
    { name: 'Settings', icon: Settings }
  ];

  // Mobile Bottom Navigation Bar Items (Home, Modules, Scanner, Tasks, Profile)
  const mobileNavItems = [
    { id: 'Home', label: 'Home', icon: Home },
    { id: 'Modules', label: 'Modules', icon: Layers },
    { id: 'Scanner', label: 'Scanner', icon: QrCode },
    { id: 'Tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'Profile', label: 'Profile', icon: Users }
  ];

  return (
    <div className={`erp-layout-shell ${isPWA ? 'is-pwa' : ''}`}>
      {/* =====================================================================
          1. Global Omni-Bar Header (Desktop & Tablet) / Minimal Header (Mobile)
          ===================================================================== */}
      <header className="erp-header">
        <div className="erp-header-left">
          {/* PWA In-App Back Navigation Button */}
          {isPWA && (
            <button
              type="button"
              className="split-sheet-close"
              onClick={() => window.history.back()}
              title="Go Back"
              style={{ width: 32, height: 32, marginRight: 4 }}
            >
              <ChevronLeft size={16} />
            </button>
          )}

          {/* Desktop & Tablet Sidebar Toggle */}
          {!isMobile && (
            <button
              type="button"
              className="split-sheet-close"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              title="Toggle Sidebar (Ctrl+B / ⌘B)"
              style={{ width: 32, height: 32 }}
            >
              <Menu size={16} />
            </button>
          )}

          {/* Mobile Drawer Toggle */}
          {isMobile && (
            <button
              type="button"
              className="split-sheet-close"
              onClick={() => setMobileDrawerOpen(true)}
              style={{ width: 32, height: 32 }}
              aria-label="Open Navigation Drawer"
            >
              <Menu size={16} />
            </button>
          )}

          {/* Brand Logo & Name */}
          <div className="erp-brand-badge">
            <span style={{ color: 'var(--erp-primary, #2563eb)', fontWeight: 800 }}>ELITE</span>
            <span>EDITION ERP</span>
          </div>

          {/* Tenant / Company Switcher */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Building2 size={13} color="#64748b" />
            <select
              value={activeTenant}
              onChange={(e) => onTenantChange?.(e.target.value)}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '5px',
                padding: '3px 8px',
                outline: 'none',
                cursor: 'pointer',
                maxWidth: isMobile ? '130px' : '200px'
              }}
            >
              {tenants.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Platform & Breakpoint Indicator Badge */}
          <div style={{ display: isMobile ? 'none' : 'flex', alignItems: 'center', gap: '6px' }}>
            <span className={`erp-mode-pill ${isPWA ? 'pwa' : 'browser'}`}>
              {isPWA ? 'PWA Standalone' : 'Web Browser'}
            </span>
            <span
              style={{
                fontSize: '11px',
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

          {/* Command Palette Trigger (Cmd+K / Ctrl+K) */}
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
              marginLeft: '4px'
            }}
          >
            <Search size={13} color="#2563eb" />
            <span style={{ display: isMobile ? 'none' : 'inline' }}>Quick Search</span>
            <kbd style={{ padding: '1px 5px', fontSize: '10px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '3px' }}>
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Header Right Actions (Desktop & Tablet) */}
        <div className="erp-header-right">
          {!isMobile && primaryAction && (
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
          2. In-App Browser-Style Multi-Tab Workspace Bar (Desktop & Tablet)
          ===================================================================== */}
      {!isMobile && currentTabs && currentTabs.length > 0 && (
        <MultiTabBar
          tabs={currentTabs}
          activeTabId={currentActiveTabId}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          onNewTab={handleNewTab}
        />
      )}

      {/* =====================================================================
          3. Main Structural Body (Dark Sidebar + Viewport)
          ===================================================================== */}
      <div className="erp-body">
        {/* Desktop Permanent Collapsible Dark-Themed Left Sidebar */}
        {isDesktop && (
          <aside className={`erp-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
            <nav className="erp-sidebar-nav">
              {navigationItems.map((item) => {
                const ItemIcon = item.icon;
                const isActive = activeModule === item.name;

                return (
                  <button
                    key={item.name}
                    type="button"
                    className={`erp-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => onModuleChange?.(item.name)}
                    title={sidebarCollapsed ? item.name : undefined}
                  >
                    <ItemIcon size={18} />
                    {!sidebarCollapsed && <span>{item.name}</span>}
                    {!sidebarCollapsed && item.count && (
                      <span className="erp-nav-badge">
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>
        )}

        {/* Dynamic Responsive Viewport */}
        <main className="erp-content-viewport">
          {/* ── Tablet Two-Column Master/Detail Layout Mode (768px - 1199px) ── */}
          {isTablet && tabletMasterList ? (
            <div className="erp-tablet-split-view">
              {/* Left Column: Fixed 380px Master List (Touch targets >= 44x44px) */}
              <div className="erp-tablet-master-list">
                {tabletMasterList}
              </div>

              {/* Right Column: Fluid Workspace Detail Content */}
              <div className="erp-tablet-detail-pane">
                {children}
              </div>
            </div>
          ) : (
            /* Standard Grid / Workspace View */
            children
          )}

          {/* Mobile Bottom-Docked Action Group */}
          {isMobile && primaryAction && (
            <SplitActionGroup
              primaryAction={primaryAction}
              secondaryActions={secondaryActions}
              mobilePlacement="dock"
            />
          )}
        </main>
      </div>

      {/* =====================================================================
          4. Mobile Fixed Bottom Navigation Bar (< 768px)
          Touch targets scaled to >= 44x44px with safe-area bottom padding
          ===================================================================== */}
      {isMobile && (
        <nav className="erp-mobile-bottom-nav">
          {mobileNavItems.map((item) => {
            const ItemIcon = item.icon;
            const isActive = mobileActiveNav === item.id;

            return (
              <button
                key={item.id}
                type="button"
                className={`erp-mobile-nav-tab ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setMobileActiveNav(item.id);
                  if (item.id === 'Modules') {
                    setMobileDrawerOpen(true);
                  }
                }}
              >
                <ItemIcon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Mobile Drawer Navigator Modal */}
      {isMobile && mobileDrawerOpen && (
        <div
          className="split-sheet-backdrop"
          onClick={() => setMobileDrawerOpen(false)}
          style={{ zIndex: 99999 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: '80%',
              maxWidth: '300px',
              backgroundColor: '#0f172a',
              color: '#f8fafc',
              boxShadow: '4px 0 24px rgba(0,0,0,0.4)',
              display: 'flex',
              flexDirection: 'column',
              padding: '16px',
              animation: 'erpDrawerFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))',
              paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
              <div style={{ fontWeight: 800, color: '#3b82f6', fontSize: '16px' }}>ELITE ERP</div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Close Navigation Drawer"
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '14px', flex: 1, overflowY: 'auto' }}>
              {navigationItems.map((item) => {
                const ItemIcon = item.icon;
                const isActive = activeModule === item.name;

                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      onModuleChange?.(item.name);
                      setMobileDrawerOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: isActive ? 'rgba(37, 99, 235, 0.25)' : 'transparent',
                      color: isActive ? '#60a5fa' : '#cbd5e1',
                      fontWeight: isActive ? 600 : 500,
                      fontSize: '14px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      minHeight: '44px' // Accessible touch target floor
                    }}
                  >
                    <ItemIcon size={18} />
                    <span>{item.name}</span>
                    {item.count && (
                      <span style={{ marginLeft: 'auto', fontSize: '12px', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '999px', fontVariantNumeric: 'tabular-nums' }}>
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          5. Global Command Palette Modal (Cmd+K / Ctrl+K)
          ===================================================================== */}
      <GlobalSearchModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectResult={(item) => {
          if (item.tab) {
            onModuleChange?.(item.tab);
          }
        }}
      />
    </div>
  );
}

export default ResponsiveErpShell;
