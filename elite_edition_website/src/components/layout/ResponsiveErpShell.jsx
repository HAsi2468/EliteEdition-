import React, { useState } from 'react';
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
 * Top-Level Architecture Layout Controller for Enterprise ERP Platform
 * Seamlessly adapts across 10 platform variants (PC/Desktop, Tablet, Mobile across Browser Web & PWA Standalone).
 * 
 * Responsive Adaptations:
 * 1. Desktop (>=1200px):
 *    - Multi-level collapsible persistent left sidebar.
 *    - Global omni-bar header with tenant switcher and Command Palette (⌘K).
 *    - In-app browser-style multi-tab workspace preserving keep-alive state.
 *    - High-density data content grid.
 * 2. Tablet (768px - 1199px):
 *    - Collapsible left navigation drawer.
 *    - Two-column master/detail pane (fixed 380px master list + fluid right detail pane).
 * 3. Mobile (<768px):
 *    - Minimal top branding header with tenant switcher.
 *    - Full-width touch-friendly card stack.
 *    - Fixed bottom navigation bar (Home, Modules, Scanner, Tasks, Profile) with safe-area insets.
 * 4. PWA Detection:
 *    - Queries `display-mode: standalone` to hide browser chrome and render native-like in-app back navigation.
 */
export function ResponsiveErpShell({
  children,
  activeModule = 'Production',
  onModuleChange,
  activeTenant = 'Digital Print Division',
  onTenantChange,
  tenants = ['Digital Print Division', 'Elite Edition E-Commerce', 'Fabtex Garments & Stitching'],
  tabs = [],
  activeTabId,
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

  // Navigation Items
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
              title="Toggle Sidebar (Ctrl+B)"
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
            >
              <Menu size={16} />
            </button>
          )}

          {/* Brand Logo & Name */}
          <div className="erp-brand-badge">
            <span style={{ color: 'var(--erp-primary, #2563eb)', fontWeight: 800 }}>ELITE</span>
            <span>ERP</span>
          </div>

          {/* Tenant / Company Switcher */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Building2 size={13} color="#64748b" />
            <select
              value={activeTenant}
              onChange={(e) => onTenantChange?.(e.target.value)}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#334155',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '5px',
                padding: '3px 6px',
                outline: 'none',
                cursor: 'pointer',
                maxWidth: isMobile ? '130px' : '190px'
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

          {/* Command Palette Trigger (Cmd+K) */}
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
              padding: '4px 9px',
              fontSize: '12px',
              fontWeight: 500,
              color: '#475569',
              cursor: 'pointer',
              marginLeft: '4px'
            }}
          >
            <Search size={13} color="#2563eb" />
            <span style={{ display: isMobile ? 'none' : 'inline' }}>Search</span>
            <kbd style={{ padding: '1px 5px', fontSize: '10px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '3px' }}>
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Header Right Actions */}
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
      {!isMobile && tabs && tabs.length > 0 && (
        <MultiTabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={onSelectTab}
          onCloseTab={onCloseTab}
          onNewTab={onNewTab}
        />
      )}

      {/* =====================================================================
          3. Main Structural Body
          ===================================================================== */}
      <div className="erp-body">
        {/* Desktop Collapsible Left Sidebar */}
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
                    title={item.name}
                  >
                    <ItemIcon size={18} />
                    {!sidebarCollapsed && <span>{item.name}</span>}
                    {!sidebarCollapsed && item.count && (
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontSize: '10px',
                          background: isActive ? '#dbeafe' : '#f1f5f9',
                          color: isActive ? '#1d4ed8' : '#64748b',
                          padding: '1px 6px',
                          borderRadius: '999px',
                          fontVariantNumeric: 'tabular-nums'
                        }}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>
        )}

        {/* Dynamic Viewport Container */}
        <main className="erp-content-viewport">
          {/* ── Tablet Two-Column Master/Detail Layout Mode (768px - 1199px) ── */}
          {isTablet && tabletMasterList ? (
            <div className="erp-tablet-split-view">
              {/* Left Column: Fixed 380px Master List */}
              <div
                className="erp-tablet-master-list"
                style={{ width: '380px', minWidth: '380px', maxWidth: '380px', flex: 'none' }}
              >
                {tabletMasterList}
              </div>

              {/* Right Column: Fluid Workspace Detail Content */}
              <div className="erp-tablet-detail-pane" style={{ flex: 1, minWidth: 0 }}>
                {children}
              </div>
            </div>
          ) : (
            /* Standard Grid / Workspace View */
            children
          )}

          {/* Mobile Docked Action Group */}
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
          4. Mobile Fixed Bottom Navigation Bar (Home, Modules, Scanner, Tasks, Profile)
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

      {/* Mobile Side Drawer Menu */}
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
              backgroundColor: '#ffffff',
              boxShadow: '4px 0 20px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              padding: '16px',
              animation: 'erpDrawerFadeIn 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div style={{ fontWeight: 800, color: 'var(--erp-primary, #2563eb)' }}>ELITE ERP</div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
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
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: isActive ? '#eff6ff' : 'transparent',
                      color: isActive ? '#2563eb' : '#334155',
                      fontWeight: isActive ? 600 : 500,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <ItemIcon size={18} />
                    <span>{item.name}</span>
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
