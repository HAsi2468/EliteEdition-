import React from 'react';

/**
 * Company-Specific Mobile Bottom Navigation
 * 
 * Rules:
 * - Dynamically renders only the quick screens for the current active company.
 * - Text only, clean typography.
 * - Safe area inset support: padding-bottom env(safe-area-inset-bottom).
 * - Minimum 44px tap targets.
 */

const COMPANY_NAV_CONFIG = {
  digital_print: [
    { id: 'jobcards_printing_log', label: 'Printing' },
    { id: 'jobcards_fusing_log', label: 'Fusing' },
    { id: 'jobcards_fabric', label: 'Fabric' },
    { id: 'jobcards_billing', label: 'Finance' },
    { id: '__more__', label: 'More' }
  ],
  stitching: [
    { id: 'es_dashboard', label: 'Dashboard' },
    { id: 'jobcards_list', label: 'Jobcard' },
    { id: 'jobcards_catalogue', label: 'Design' },
    { id: 'jobcards_stitching_challan', label: 'Challan' },
    { id: '__more__', label: 'More' }
  ],
  elite_online: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'inventory', label: 'Stock' },
    { id: 'sales', label: 'Orders' },
    { id: 'returns', label: 'Returns' },
    { id: '__more__', label: 'More' }
  ],
  elite_edition: [
    { id: 'ee_dashboard', label: 'Dashboard' },
    { id: 'ee_invoices', label: 'Finance' },
    { id: 'ee_complaints', label: 'Complaints' },
    { id: 'ee_settings', label: 'Settings' },
    { id: '__more__', label: 'More' }
  ],
  elite_fabtex: [
    { id: 'ef_dashboard', label: 'Dashboard' },
    { id: 'ef_invoices', label: 'Finance' },
    { id: 'ef_complaints', label: 'Complaints' },
    { id: 'ef_settings', label: 'Settings' },
    { id: '__more__', label: 'More' }
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

  return (
    <nav
      className="mobile-bottom-nav"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingTop: '4px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4px)',
        zIndex: 9000,
        height: 'calc(54px + env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box',
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.03)',
        ...style
      }}
    >
      {items.map((item) => {
        const isMore = item.id === '__more__';
        const isActive = !isMore && (activeTab === item.id);
        const count = badgeCounts[item.id];

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
              height: '44px',
              minHeight: '44px',
              border: 'none',
              background: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: isActive ? '#1d4ed8' : '#64748b',
              fontWeight: isActive ? 700 : 500,
              fontSize: '12px',
              position: 'relative',
              outline: 'none',
              padding: 0,
              transition: 'color 0.15s ease'
            }}
          >
            <span style={{ position: 'relative' }}>
              {item.label}
              {count > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-12px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    fontSize: '9px',
                    padding: '1px 4px',
                    borderRadius: '4px',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 700
                  }}
                >
                  {count}
                </span>
              )}
            </span>
            {isActive && (
              <span
                style={{
                  width: '18px',
                  height: '2.5px',
                  backgroundColor: '#2563eb',
                  borderRadius: '2px',
                  marginTop: '3px'
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
