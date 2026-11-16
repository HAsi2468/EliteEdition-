import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Plus, ChevronDown, FileText, Truck, Receipt, BarChart3, Calculator, X } from 'lucide-react';

const MENU_WIDTH = 270;
const VIEWPORT_MARGIN = 8;

export default function QuickActionMenu({
  items,
  onNewInvoice,
  onNewChallan,
  onExpenseEntry,
  onLedgerReports,
  onGstReports,
  buttonText = 'Quick Action'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
  });
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, maxHeight: 400 });
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Position the portaled dropdown relative to the trigger (viewport coordinates)
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, rect.right - MENU_WIDTH),
      vw - MENU_WIDTH - VIEWPORT_MARGIN
    );
    const top = rect.bottom + 6;
    setMenuPos({ top, left, maxHeight: Math.max(200, vh - top - VIEWPORT_MARGIN) });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || isMobileView) return undefined;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, isMobileView, updatePosition]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (e) => {
      if (isMobileView) return;
      const inTrigger = menuRef.current && menuRef.current.contains(e.target);
      const inDropdown = dropdownRef.current && dropdownRef.current.contains(e.target);
      if (!inTrigger && !inDropdown) setIsOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isMobileView]);

  const handleAction = (callback) => {
    setIsOpen(false);
    if (callback) callback();
  };

  const defaultItems = [
    ...(onNewInvoice ? [{
      id: 'invoice',
      icon: FileText,
      label: 'New Invoice',
      subtitle: 'Create GST or standard sales tax invoice',
      iconColor: '#38bdf8',
      iconBg: 'rgba(56, 189, 248, 0.16)',
      action: onNewInvoice
    }] : []),
    ...(onNewChallan ? [{
      id: 'challan',
      icon: Truck,
      label: 'New Challan',
      subtitle: 'Generate dispatch or job work delivery challan',
      iconColor: '#34d399',
      iconBg: 'rgba(52, 211, 153, 0.16)',
      action: onNewChallan
    }] : []),
    ...(onExpenseEntry ? [{
      id: 'expense',
      icon: Receipt,
      label: 'Expense Entry',
      subtitle: 'Log factory operational expense or payout',
      iconColor: '#fbbf24',
      iconBg: 'rgba(251, 191, 36, 0.16)',
      action: onExpenseEntry
    }] : []),
    ...(onLedgerReports ? [{
      id: 'ledger',
      icon: BarChart3,
      label: 'Ledger Reports',
      subtitle: 'View party statement of accounts & costing',
      iconColor: '#c084fc',
      iconBg: 'rgba(192, 132, 252, 0.16)',
      action: onLedgerReports
    }] : []),
    ...(onGstReports ? [{
      id: 'gst',
      icon: Calculator,
      label: 'GST Summary',
      subtitle: 'Sales GST, Purchase GST Credit & TDS',
      iconColor: '#f87171',
      iconBg: 'rgba(248, 113, 113, 0.16)',
      action: onGstReports
    }] : [])
  ];

  const menuItems = (items && items.length > 0 ? items : defaultItems).filter(Boolean);

  if (menuItems.length === 0) {
    return null;
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={menuRef}>
      {/* Primary Consolidated Action Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          padding: '0.48rem 1.15rem',
          fontSize: '0.84rem',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
          transition: 'all 0.15s ease',
          minHeight: '38px',
          whiteSpace: 'nowrap'
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span style={{ fontSize: '0.95rem' }}>⚡</span>
        <span>{buttonText}</span>
        <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
      </button>

      {/* Desktop Popover Dropdown (>= 1024px) — portaled to <body> so no parent stacking context can cover it */}
      {isOpen && !isMobileView && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          className="quick-action-dropdown"
          role="menu"
          style={{
            position: 'fixed',
            top: `${menuPos.top}px`,
            left: `${menuPos.left}px`,
            width: `${MENU_WIDTH}px`,
            maxHeight: `${menuPos.maxHeight}px`,
            overflowY: 'auto',
            background: 'rgba(15, 23, 42, 0.97)',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            boxShadow: '0 16px 40px -6px rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            zIndex: 100000,
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            animation: 'fadeInMenu 0.15s ease-out'
          }}
        >
          {menuItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleAction(item.action)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background 0.12s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    background: item.iconBg,
                    color: item.iconColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Icon size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#ffffff' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.65)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>,
        document.body
      )}

      {/* Mobile / Tablet Bottom-Sheet Modal (< 1024px) */}
      {isOpen && isMobileView && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center'
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.98)',
              width: '100%',
              maxWidth: '500px',
              borderRadius: '16px 16px 0 0',
              borderTop: '1px solid rgba(255, 255, 255, 0.16)',
              padding: '16px 18px calc(18px + env(safe-area-inset-bottom, 0px))',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 -10px 25px rgba(0,0,0,0.5)',
              animation: 'slideUpSheet 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Sheet Handle & Header */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '38px', height: '4px', borderRadius: '2px', background: 'rgba(255, 255, 255, 0.25)' }} />
              <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>Quick Actions</span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: 'rgba(255, 255, 255, 0.7)', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Sheet Menu Items (48px Touch Targets) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {menuItems.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAction(item.action)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.14)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      minHeight: '48px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'background 0.12s ease'
                    }}
                  >
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: item.iconBg,
                        color: item.iconColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.68)', marginTop: '1px' }}>
                        {item.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: '4px'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
