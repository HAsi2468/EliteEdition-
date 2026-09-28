import React from 'react';

/**
 * Minimal Text-Only Mobile Bottom Navigation
 * 
 * Rules:
 * - 4-5 items max
 * - Text only, NO decorative icons
 * - Safe area inset support: padding-bottom env(safe-area-inset-bottom)
 * - Minimum 44px tap targets
 */

export function MobileBottomNav({
  activeTab = 'jobcards',
  onSelectTab = () => {},
  onOpenMenu = () => {},
  badgeCounts = {},
  style = {}
}) {
  const items = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'jobcards', label: 'Jobs' },
    { id: 'ee_invoices', label: 'Invoices' },
    { id: 'inventory', label: 'Stock' },
    { id: '__more__', label: 'More' }
  ];

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
        ...style
      }}
    >
      {items.map((item) => {
        const isMore = item.id === '__more__';
        const isActive = !isMore && (activeTab === item.id || (item.id === 'jobcards' && activeTab.startsWith('jobcards')));
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
              color: isActive ? '#0f172a' : '#64748b',
              fontWeight: isActive ? 600 : 500,
              fontSize: '12px',
              position: 'relative',
              outline: 'none',
              padding: 0
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
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    fontSize: '9px',
                    padding: '1px 4px',
                    borderRadius: '4px',
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  {count}
                </span>
              )}
            </span>
            {isActive && (
              <span
                style={{
                  width: '16px',
                  height: '2px',
                  backgroundColor: '#0f172a',
                  borderRadius: '1px',
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
