import React, { useState, useEffect } from 'react';
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
  Printer,
  Download,
  Trash2,
  Copy,
  Plus,
  ChevronLeft
} from 'lucide-react';
import { useDeviceContext } from '../../hooks/useDeviceContext';
import { SplitActionGroup } from '../common/SplitActionGroup';
import { MultiTabBar } from './MultiTabBar';
import { GlobalSearchModal } from '../common/GlobalSearchModal';
import './ErpLayoutShell.css';

/**
 * AppLayout
 * 
 * Principal Responsive Layout Shell for Enterprise ERP
 * Targets:
 * - Desktop/PC: Web & Installed PWA / Standalone Web App (>= 1200px)
 * - iPad & Android Tablets: Web & Installed PWA (768px - 1199px)
 * - iPhone & Android Phones: Web & Installed PWA (< 768px)
 */
export function AppLayout({
  children,
  activeModule = 'Production',
  onModuleChange,
  primaryAction,
  secondaryActions = [],
  tabs = [],
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab
}) {
  const { breakpoint, isMobile, isTablet, isDesktop, isPWA } = useDeviceContext();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Global Keyboard Shortcuts (Cmd/Ctrl + K for Search, Cmd/Ctrl + B for Sidebar)
  useEffect(() => {
    const handleKeyDown = (e) => {
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
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDesktop]);

  const defaultNavigationItems = [
    { name: 'Production', icon: Layers, count: 18 },
    { name: 'Job Cards', icon: FileText, count: 42 },
    { name: 'Inventory', icon: Package, count: 5 },
    { name: 'Billing', icon: Receipt },
    { name: 'Analytics', icon: BarChart3 },
    { name: 'Settings', icon: Settings }
  ];

  return (
    <div className={`erp-layout-shell ${isPWA ? 'is-pwa' : ''}`}>
      {/* ── 1. Unified Enterprise Header ── */}
      <header className="erp-header">
        <div className="erp-header-left">
          {/* PWA In-App Back Navigation */}
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
              onClick={() => setSidebarCollapsed((p) => !p)}
              title="Toggle Sidebar (Ctrl+B / ⌘B)"
              style={{ width: 32, height: 32 }}
            >
              <Menu size={16} />
            </button>
          )}

          <div className="erp-brand-badge">
            <span style={{ color: 'var(--erp-primary, #2563eb)', fontWeight: 800 }}>ELITE</span>
            <span>EDITION ERP</span>
          </div>

          {/* Form Factor & Breakpoint Indicator Badge */}
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

          {/* Global Command Palette Trigger (Cmd+K) */}
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            title="Open Command Palette (⌘K / Ctrl+K)"
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
              marginLeft: '6px'
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

      {/* ── 2. Multi-Tab In-App Workspace Bar (Desktop & Tablet) ── */}
      {!isMobile && tabs && tabs.length > 0 && (
        <MultiTabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={onSelectTab}
          onCloseTab={onCloseTab}
          onNewTab={onNewTab}
        />
      )}

      {/* ── 3. Main Body Structure (Dark Sidebar + Viewport) ── */}
      <div className="erp-body">
        {/* Desktop Permanent Collapsible Dark-Themed Left Sidebar */}
        {isDesktop && (
          <aside className={`erp-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
            <nav className="erp-sidebar-nav">
              {defaultNavigationItems.map((item) => {
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
          {children}

          {/* Mobile Floating / Docked Primary Action */}
          {isMobile && primaryAction && (
            <SplitActionGroup
              primaryAction={primaryAction}
              secondaryActions={secondaryActions}
              mobilePlacement="dock"
            />
          )}
        </main>
      </div>

      {/* ── 4. Mobile Bottom Navigation Bar (< 768px, >= 44x44px touch targets) ── */}
      {isMobile && (
        <nav className="erp-mobile-bottom-nav">
          {defaultNavigationItems.slice(0, 5).map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeModule === tab.name;
            return (
              <button
                key={tab.name}
                type="button"
                className={`erp-mobile-nav-tab ${isActive ? 'active' : ''}`}
                onClick={() => onModuleChange?.(tab.name)}
              >
                <TabIcon size={20} />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* ── 5. Command Palette Modal ── */}
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

export default AppLayout;
