import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  X,
  FileText,
  Package,
  Receipt,
  Search,
  ScanLine,
  MessageSquare,
  Bell,
  HelpCircle,
  Zap,
  Sparkles
} from 'lucide-react';

/**
 * GlobalQuickActions Speed-Dial Menu
 * 
 * Accessible floating launcher providing 1-click execution for top factory & office actions:
 * - Create Job Card (Shift + J)
 * - Inward Fabric / Gray (Shift + I)
 * - Create GST Invoice (Shift + B)
 * - Global Omnibar Search (⌘K / Ctrl+K)
 * - Barcode Scan & Pack (Shift + S)
 * - Team Chat & Announcements (Shift + M)
 * - Notifications Drawer (Shift + N)
 * - Shortcuts Guide (?)
 */
export default function GlobalQuickActions({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  onNavigateTab,
  onOpenBulkInward,
  onOpenGlobalSearch,
  onOpenNotifications,
  activeDepartment
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = (val) => {
    if (controlledOnClose && !val) {
      controlledOnClose();
    }
    setInternalIsOpen(val);
  };
  const menuRef = useRef(null);

  // Global custom event to open quick actions from header or any button
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('elite:open-quick-actions', handleOpen);
    return () => window.removeEventListener('elite:open-quick-actions', handleOpen);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Global Hotkey Listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target;
      const isInput = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );
      if (isInput) return;

      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
        return;
      }

      // Hotkeys with Shift key
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === 'J' || e.key === 'j') {
          e.preventDefault();
          onNavigateTab('jobcards');
          setIsOpen(false);
        } else if (e.key === 'I' || e.key === 'i') {
          e.preventDefault();
          if (onOpenBulkInward) onOpenBulkInward();
          setIsOpen(false);
        } else if (e.key === 'B' || e.key === 'b') {
          e.preventDefault();
          const targetTab = activeDepartment === 'elite_edition' ? 'ee_invoices' : 'billing';
          onNavigateTab(targetTab);
          setIsOpen(false);
        } else if (e.key === 'S' || e.key === 's') {
          e.preventDefault();
          onNavigateTab('scan_and_pack');
          setIsOpen(false);
        } else if (e.key === 'M' || e.key === 'm') {
          e.preventDefault();
          onNavigateTab('communication');
          setIsOpen(false);
        } else if (e.key === 'N' || e.key === 'n') {
          e.preventDefault();
          if (onOpenNotifications) onOpenNotifications();
          setIsOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onNavigateTab, onOpenBulkInward, onOpenNotifications, activeDepartment]);

  const quickActions = [
    {
      id: 'jobcard',
      label: 'Create Job Card',
      desc: 'New cutting, printing or production lot',
      icon: FileText,
      color: '#2563eb',
      shortcut: 'Shift + J',
      onClick: () => {
        onNavigateTab('jobcards');
        setIsOpen(false);
      }
    },
    {
      id: 'inward',
      label: 'Inward Fabric / Gray',
      desc: 'Log arrival, roll meters & supplier challan',
      icon: Package,
      color: '#059669',
      shortcut: 'Shift + I',
      onClick: () => {
        if (onOpenBulkInward) onOpenBulkInward();
        setIsOpen(false);
      }
    },
    {
      id: 'invoice',
      label: 'Create GST Invoice',
      desc: 'Bill dispatched goods or client sales',
      icon: Receipt,
      color: '#7c3aed',
      shortcut: 'Shift + B',
      onClick: () => {
        const targetTab = activeDepartment === 'elite_edition' ? 'ee_invoices' : 'billing';
        onNavigateTab(targetTab);
        setIsOpen(false);
      }
    },
    {
      id: 'scan',
      label: 'Barcode Scan & Pack',
      desc: 'Fast dispatch scanning & verification',
      icon: ScanLine,
      color: '#d97706',
      shortcut: 'Shift + S',
      onClick: () => {
        onNavigateTab('scan_and_pack');
        setIsOpen(false);
      }
    },
    {
      id: 'search',
      label: 'Global Search',
      desc: 'Find any Challan, Invoice, Party or Design',
      icon: Search,
      color: '#0284c7',
      shortcut: '⌘K',
      onClick: () => {
        if (onOpenGlobalSearch) onOpenGlobalSearch();
        setIsOpen(false);
      }
    },
    {
      id: 'chat',
      label: 'Team Communication',
      desc: 'Instant channel notes & announcements',
      icon: MessageSquare,
      color: '#0d9488',
      shortcut: 'Shift + M',
      onClick: () => {
        onNavigateTab('communication');
        setIsOpen(false);
      }
    },
    {
      id: 'shortcuts',
      label: 'Shortcuts Reference',
      desc: 'Keyboard cheat sheet for all screens',
      icon: HelpCircle,
      color: '#64748b',
      shortcut: '?',
      onClick: () => {
        window.dispatchEvent(new CustomEvent('elite:open-shortcuts-modal'));
        setIsOpen(false);
      }
    }
  ];

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9998,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        pointerEvents: 'auto'
      }}
    >
      {/* Action Menu Card */}
      {isOpen && (
        <div
          style={{
            marginBottom: '12px',
            width: '320px',
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 20px 40px -8px rgba(15, 23, 42, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            animation: 'slideUpFade 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            transformOrigin: 'bottom right'
          }}
        >
          {/* Menu Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #f1f5f9',
              background: 'linear-gradient(135deg, #f8fafc, #ffffff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  background: 'rgba(37, 99, 235, 0.1)',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Zap size={14} />
              </div>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
                Quick Actions
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontSize: '0.6875rem',
                  color: '#64748b',
                  background: '#f1f5f9',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 600
                }}
              >
                Esc
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close Quick Actions"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '4px'
                }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Action Items List */}
          <div style={{ padding: '6px' }}>
            {quickActions.map((item) => {
              const IconComp = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: `${item.color}15`,
                        color: item.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <IconComp size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e293b', lineHeight: 1.2 }}>
                        {item.label}
                      </div>
                      <div
                        style={{
                          fontSize: '0.6875rem',
                          color: '#64748b',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginTop: '2px'
                        }}
                      >
                        {item.desc}
                      </div>
                    </div>
                  </div>

                  <kbd
                    style={{
                      fontSize: '0.625rem',
                      fontFamily: 'inherit',
                      fontWeight: 600,
                      background: '#f1f5f9',
                      color: '#475569',
                      padding: '2px 6px',
                      borderRadius: '5px',
                      border: '1px solid #e2e8f0',
                      marginLeft: '8px',
                      flexShrink: 0
                    }}
                  >
                    {item.shortcut}
                  </kbd>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUpFade {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
