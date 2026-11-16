import React from 'react';
import { Table, LayoutGrid } from 'lucide-react';
import QuickActionMenu from './QuickActionMenu';
import { EntityBrandBadge } from './EntityBrandBadge';

/**
 * StandardEnterpriseScreen
 * 
 * Enforces the universal 5-Tier layout defined by the Finance screen:
 * Tier 1: Glass Screen Header with title capsule (Icon + Screen Name + EntityBrandBadge, NO extra text) & Quick Action Button
 * Tier 2: Glass Subtabs Bar for sub-screen navigation
 * Tier 3: Side-Scrolling Track for all calculation & KPI cards
 * Tier 4: Action / Filter Toolbar with Table vs Cards View Mode toggle
 * Tier 5: Body Content Area (Dual mode: Table View or Card View)
 */
export default function StandardEnterpriseScreen({
  icon: Icon,
  title,
  companyEntity = 'Elite Digital Prints',
  quickActions,
  onQuickAction,
  subTabs = [],
  activeSubTab,
  onSubTabChange,
  kpiCards = [],
  viewMode = 'table',
  onViewModeChange,
  showViewToggle = true,
  toolbarExtra,
  children
}) {
  return (
    <div className="ent-screen-container">
      {/* ── TIER 1: UNIFIED GLASS SCREEN HEADER ── */}
      <div className="glass-screen-header">
        <div className="glass-title-capsule">
          {Icon && (
            <div className="glass-title-icon">
              <Icon size={16} color="#fff" />
            </div>
          )}
          <span className="glass-screen-title">{title}</span>
          <EntityBrandBadge entityId={companyEntity} />
        </div>

        {/* Quick Action Button */}
        <div className="ent-header-actions">
          <QuickActionMenu
            buttonText="+ Quick Action"
            items={quickActions}
            onNewInvoice={onQuickAction}
          />
        </div>
      </div>

      {/* ── TIER 2: SUB-SCREEN NAVIGATION BUTTONS ── */}
      {subTabs.length > 0 && (
        <div
          className="glass-subtabs-bar"
          role="tablist"
          style={{ marginBottom: '0.85rem' }}
        >
          {subTabs.map(t => {
            const isActive = activeSubTab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => onSubTabChange && onSubTabChange(t.id)}
                className={`glass-subtab-btn ${isActive ? 'active' : ''}`}
              >
                {t.icon && <t.icon size={13} style={{ marginRight: 5 }} />}
                <span>{t.label}</span>
                {t.count !== undefined && (
                  <span style={{ marginLeft: 5, opacity: 0.85, fontSize: '0.72rem' }}>
                    ({t.count})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── TIER 3: SIDE SCROLLING CALCULATION / KPI CARDS TRACK ── */}
      {kpiCards && kpiCards.length > 0 && (
        <div className="glass-scroll-track" style={{ marginBottom: '1rem', display: 'flex', gap: '0.85rem', overflowX: 'auto', paddingBottom: '6px' }}>
          {kpiCards.map((kpi, idx) => (
            <div
              key={idx}
              className="ent-stat-card"
              style={{
                minWidth: '220px',
                flex: '0 0 auto',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderLeft: kpi.accentColor ? `4px solid ${kpi.accentColor}` : '4px solid #38bdf8',
                borderRadius: 10,
                padding: '0.9rem 1rem',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
                backdropFilter: 'blur(12px)',
                ...kpi.style
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.72)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {kpi.label}
                </span>
                {kpi.icon && (
                  <span style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: kpi.iconBg || 'rgba(56, 189, 248, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: kpi.iconColor || '#38bdf8', fontSize: '0.75rem'
                  }}>
                    {kpi.icon}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: kpi.valColor || '#ffffff', marginTop: 4 }}>
                {kpi.value}
              </div>
              {kpi.sub && (
                <div style={{ fontSize: '0.72rem', color: kpi.subColor || '#38bdf8', marginTop: 4, fontWeight: 700 }}>
                  {kpi.sub}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── TIER 4: TOOLBAR WITH TABLE VS CARDS VIEW TOGGLE ── */}
      {showViewToggle && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', flex: 1 }}>
            {toolbarExtra}
          </div>
          <div className="glass-view-toggle">
            <button
              type="button"
              className={viewMode === 'table' ? 'active' : ''}
              onClick={() => onViewModeChange && onViewModeChange('table')}
              title="Table View (List)"
            >
              <Table size={13} /> Table
            </button>
            <button
              type="button"
              className={viewMode === 'cards' ? 'active' : ''}
              onClick={() => onViewModeChange && onViewModeChange('cards')}
              title="Card View (Grid)"
            >
              <LayoutGrid size={13} /> Cards
            </button>
          </div>
        </div>
      )}

      {/* ── TIER 5: BODY CONTENT AREA ── */}
      <div className="ent-screen-body">
        {children}
      </div>
    </div>
  );
}
