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
  Printer,
  Download,
  Trash2,
  Copy,
  Plus
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
 * Automatically adapts across 10 platform variants (Desktop, Tablet, Mobile across Web Browser & PWA Standalone).
 * 
 * Layout Strategies:
 * 1. Desktop (>=1200px): Persistent collapsible sidebar + multi-tab workspace + high-density grid.
 * 2. Tablet (768px - 1199px): Master-detail split pane or compact drawer navigation.
 * 3. Mobile (<768px): Touch-friendly stacked cards + bottom tab bar + gesture ActionSheets.
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

  const defaultNavigationItems = [
    { name: 'Production', icon: Layers },
    { name: 'Job Cards', icon: FileText },
    { name: 'Inventory', icon: Package },
    { name: 'Billing', icon: Receipt },
    { name: 'Analytics', icon: BarChart3 },
    { name: 'Settings', icon: Settings }
  ];

  return (
    <div className={`erp-layout-shell ${isPWA ? 'is-pwa' : ''}`}>
      {/* ── 1. Unified Enterprise Header ── */}
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
            <span style={{ color: 'var(--erp-primary, #2563eb)', fontWeight: 800 }}>ELITE</span>
            <span>ERP</span>
          </div>

          {/* Form Factor & Breakpoint Indicator Badge */}
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

          {/* Global Command Palette Trigger */}
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

      {/* ── 3. Main Body Structure ── */}
      <div className="erp-body">
        {/* Desktop Sidebar */}
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

      {/* ── 4. Mobile Bottom Navigation Bar (< 768px) ── */}
      {isMobile && (
        <nav className="erp-mobile-bottom-nav">
          {defaultNavigationItems.slice(0, 4).map((tab) => {
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
