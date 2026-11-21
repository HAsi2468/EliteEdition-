import React, { useRef } from 'react';
import soundEffects from '../../services/soundEffects';
import {
  LayoutDashboard,
  Printer,
  Flame,
  Database,
  Receipt,
  FileText,
  BookOpen,
  Layers,
  Package,
  PackageCheck,
  ShoppingCart,
  ShoppingBag,
  AlertTriangle,
  Settings,
  MoreHorizontal,
  MessageSquare,
  CheckSquare,
  Scale
} from 'lucide-react';

/**
 * Company-Specific Mobile Bottom Navigation
 * 
 * Rules:
 * - Dynamically renders only the quick screens for the current active company.
 * - Native iOS App style with icons + crisp labels.
 * - Safe area inset support: padding-bottom env(safe-area-inset-bottom).
 * - Minimum 44px tap targets.
 */

const COMPANY_NAV_CONFIG = {
  digital_print: [
    { id: 'jobcards_printing_log', label: 'Printing', icon: Printer },
    { id: 'jobcards_fusing_log', label: 'Fusing', icon: Flame },
    { id: 'jobcards_fabric', label: 'Fabric', icon: Database },
    { id: 'jobcards_billing', label: 'Finance', icon: Receipt },
    { id: '__more__', label: 'More', icon: MoreHorizontal }
  ],
  stitching: [
    { id: 'es_dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'jobcards_list', label: 'Jobcards', icon: FileText },
    { id: 'jobcards_catalogue', label: 'Design', icon: BookOpen },
    { id: 'jobcards_stitching_challan', label: 'Challan', icon: Database },
    { id: '__more__', label: 'More', icon: MoreHorizontal }
  ],
  elite_online: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Stock', icon: Package },
    { id: 'sales', label: 'Orders', icon: ShoppingCart },
    { id: 'myntra', label: 'Myntra', icon: ShoppingBag },
    { id: '__more__', label: 'More', icon: MoreHorizontal }
  ],
  elite_edition: [
    { id: 'ee_dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'ee_rfd', label: 'Process', icon: Layers },
    { id: 'ee_invoices', label: 'Finance', icon: Receipt },
    { id: 'ee_complaints', label: 'Complaints', icon: AlertTriangle },
    { id: '__more__', label: 'More', icon: MoreHorizontal }
  ],
  elite_fabtex: [
    { id: 'ef_dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'ef_rfd', label: 'Process', icon: Layers },
    { id: 'ef_invoices', label: 'Finance', icon: Receipt },
    { id: 'ef_complaints', label: 'Complaints', icon: AlertTriangle },
    { id: '__more__', label: 'More', icon: MoreHorizontal }
  ],
  sobise: [
    { id: 'so_dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'so_rfd', label: 'Process', icon: Layers },
    { id: 'so_invoices', label: 'Finance', icon: Receipt },
    { id: 'so_complaints', label: 'Complaints', icon: AlertTriangle },
    { id: '__more__', label: 'More', icon: MoreHorizontal }
  ],
  ethno_wear: [
    { id: 'ew_dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'ew_design', label: 'Design', icon: BookOpen },
    { id: 'ew_rfd', label: 'Process', icon: Layers },
    { id: 'ew_invoices', label: 'Finance', icon: Receipt },
    { id: '__more__', label: 'More', icon: MoreHorizontal }
  ],
  yamunaji: [
    { id: 'yj_dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'yj_rfd', label: 'Process', icon: Layers },
    { id: 'yj_raw_materials', label: 'Materials', icon: PackageCheck },
    { id: 'yj_invoices', label: 'Finance', icon: Receipt },
    { id: '__more__', label: 'More', icon: MoreHorizontal }
  ],
  exedp: [
    { id: 'exedp_invoices', label: 'Finance', icon: Receipt },
    { id: 'communication', label: 'Chat', icon: MessageSquare },
    { id: 'task_management', label: 'Tasks', icon: CheckSquare },
    { id: '__more__', label: 'More', icon: MoreHorizontal }
  ]
};

export function MobileBottomNav({
  activeDepartment = 'digital_print',
  activeTab = 'jobcards_printing_log',
  onSelectTab = () => {},
  onOpenMenu = () => {},
  badgeCounts = {},
  style = {}
}) {
  const items = COMPANY_NAV_CONFIG[activeDepartment] || COMPANY_NAV_CONFIG.digital_print;
  const swipeStartXRef = useRef(null);

  const handleNavTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      swipeStartXRef.current = e.touches[0].clientX;
    }
  };

  const handleNavTouchEnd = (e) => {
    if (swipeStartXRef.current == null || !e.changedTouches?.[0]) return;
    const dx = e.changedTouches[0].clientX - swipeStartXRef.current;
    swipeStartXRef.current = null;
    if (Math.abs(dx) < 48) return;
    const navTabs = items.filter((it) => it.id !== '__more__');
    if (navTabs.length < 2) return;
    const currIdx = navTabs.findIndex((it) => it.id === activeTab);
    const nextIdx = dx < 0
      ? (currIdx + 1) % navTabs.length
      : (currIdx <= 0 ? navTabs.length - 1 : currIdx - 1);
    if (navTabs[nextIdx]) {
      soundEffects.playScrollTick?.();
      try { navigator.vibrate?.(10); } catch (_) {}
      onSelectTab(navTabs[nextIdx].id);
    }
  };

  return (
    <nav
      className="mobile-bottom-nav glass-panel"
      onTouchStart={handleNavTouchStart}
      onTouchEnd={handleNavTouchEnd}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--bg-glass-heavy, var(--bg-card, rgba(15, 23, 42, 0.94)))',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: '1px solid var(--border-light, rgba(148, 163, 184, 0.22))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingTop: '6px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6px)',
        zIndex: 9000,
        height: 'calc(58px + env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.16)',
        ...style
      }}
    >
      {items.map((item) => {
        const isMore = item.id === '__more__';
        const isActive = !isMore && (activeTab === item.id);
        const count = badgeCounts[item.id];
        const IconComponent = item.icon || LayoutDashboard;
        const activeColor = 'var(--primary, #2563eb)';
        const inactiveColor = 'var(--text-secondary, #64748b)';
        const color = isActive ? activeColor : inactiveColor;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (isMore) {
                onOpenMenu();
              } else {
                onSelectTab(item.id);
              }
            }}
            style={{
              flex: 1,
              height: '46px',
              minHeight: '46px',
              border: 'none',
              background: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: color,
              position: 'relative',
              outline: 'none',
              padding: 0,
              gap: '2px',
              transition: 'all 0.15s ease'
            }}
          >
            <div className={`mobile-bottom-icon-3d ${isActive ? 'active' : ''}`}>
              <IconComponent
                size={18}
                strokeWidth={isActive ? 2.3 : 1.8}
                style={{
                  color: color,
                  transition: 'transform 0.15s ease'
                }}
              />
              {count > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-6px',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    fontSize: '9px',
                    padding: '1px 4px',
                    borderRadius: '999px',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 700,
                    lineHeight: 1
                  }}
                >
                  {count}
                </span>
              )}
            </div>

            <span
              style={{
                fontSize: '10px',
                fontWeight: isActive ? 700 : 500,
                color: color,
                lineHeight: 1,
                letterSpacing: '-0.01em',
                maxWidth: '64px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {item.label}
            </span>

            {isActive && (
              <span
                style={{
                  width: '16px',
                  height: '2px',
                  backgroundColor: activeColor,
                  borderRadius: '2px',
                  marginTop: '1px'
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

export default MobileBottomNav;
