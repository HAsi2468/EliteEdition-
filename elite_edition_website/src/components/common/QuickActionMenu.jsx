import React, { useState, useEffect, useRef } from 'react';
import { Plus, ChevronDown, FileText, Truck, Receipt, BarChart3, X } from 'lucide-react';

export default function QuickActionMenu({
  onNewInvoice,
  onNewChallan,
  onExpenseEntry,
  onLedgerReports,
  buttonText = 'Quick Action'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
  });
  const menuRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !isMobileView) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isMobileView]);

  const handleAction = (callback) => {
    setIsOpen(false);
    if (callback) callback();
  };

  const menuItems = [
    {
      id: 'invoice',
      icon: FileText,
      label: 'New Invoice',
      subtitle: 'Create GST or standard sales tax invoice',
      iconColor: '#2563eb',
      iconBg: '#eff6ff',
      action: onNewInvoice
    },
    {
      id: 'challan',
      icon: Truck,
      label: 'New Challan',
      subtitle: 'Generate dispatch or job work delivery challan',
      iconColor: '#0284c7',
      iconBg: '#f0f9ff',
      action: onNewChallan
    },
    {
      id: 'expense',
      icon: Receipt,
      label: 'Expense Entry',
      subtitle: 'Log factory operational expense or payout',
      iconColor: '#d97706',
      iconBg: '#fffbeb',
      action: onExpenseEntry
    },
    {
      id: 'ledger',
      icon: BarChart3,
      label: 'Ledger Reports',
      subtitle: 'View party statement of accounts & costing',
      iconColor: '#059669',
      iconBg: '#ecfdf5',
      action: onLedgerReports
    }
  ];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={menuRef}>
      {/* Primary Consolidated Action Trigger */}
      <button
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
          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
          transition: 'all 0.15s ease',
          minHeight: '38px',
          whiteSpace: 'nowrap'
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Plus size={16} strokeWidth={2.5} />
        <span>{buttonText}</span>
        <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
      </button>

      {/* Desktop Popover Dropdown (>= 1024px) */}
      {isOpen && !isMobileView && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: '270px',
            background: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
            zIndex: 1000,
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
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
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
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0f172a' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
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
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(2px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center'
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: '500px',
              borderRadius: '16px 16px 0 0',
              borderTop: '1px solid #e2e8f0',
              padding: '16px 18px calc(18px + env(safe-area-inset-bottom, 0px))',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 -10px 25px rgba(0,0,0,0.1)',
              animation: 'slideUpSheet 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Sheet Handle & Header */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '38px', height: '4px', borderRadius: '2px', background: '#cbd5e1' }} />
              <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>Quick Actions</span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
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
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
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
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '1px' }}>
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
                background: '#f1f5f9',
                color: '#475569',
                border: '1px solid #cbd5e1',
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
