import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  LayoutDashboard,
  Printer,
  Layers,
  Flame,
  Truck,
  MessageSquare,
  CheckSquare,
  DollarSign,
  AlertTriangle,
  Scissors,
  Shield,
  Building2,
  Package,
  Command,
  ArrowRight,
  Sparkles,
  X
} from 'lucide-react';

const ERP_COMMANDS = [
  // ── Production & Job Cards ──
  {
    id: 'nav-jobcards',
    title: 'Job Cards & Batches',
    subtitle: 'Track production stages, meters & proofing',
    category: 'Production',
    icon: Printer,
    screen: 'jobcards',
    department: 'digital_print',
    keywords: ['job', 'cards', 'jc', 'batch', 'meters', 'printing']
  },
  {
    id: 'nav-dashboard',
    title: 'Operations Dashboard',
    subtitle: 'Daily KPIs, machine meters & analytics',
    category: 'Production',
    icon: LayoutDashboard,
    screen: 'dashboard',
    department: 'digital_print',
    keywords: ['dashboard', 'stats', 'kpi', 'meters', 'overview']
  },
  {
    id: 'nav-printing-logs',
    title: 'Printing Production Logs',
    subtitle: 'Real-time roll printing meters & operator shifts',
    category: 'Production',
    icon: Printer,
    screen: 'printing_log',
    department: 'digital_print',
    keywords: ['print', 'logs', 'roll', 'machine', 'meters']
  },
  {
    id: 'nav-fusing-logs',
    title: 'Fusing Production Logs',
    subtitle: 'Heat press & fusing temperature logs',
    category: 'Production',
    icon: Flame,
    screen: 'fusing',
    department: 'digital_print',
    keywords: ['fusing', 'heat', 'press', 'temperature']
  },
  {
    id: 'nav-garment-jobcards',
    title: 'Garment Job Cards',
    subtitle: 'Stitching cut-to-pack workflow tracking',
    category: 'Production',
    icon: Scissors,
    screen: 'garment_jobcards',
    department: 'stitching',
    keywords: ['garment', 'stitching', 'cutting', 'tailor']
  },

  // ── Inventory & Fabric ──
  {
    id: 'nav-fabric-inventory',
    title: 'Fabric Inventory & Lot Stock',
    subtitle: 'Roll stock, panna widths & barcode tracking',
    category: 'Inventory',
    icon: Layers,
    screen: 'fabric_inventory',
    department: 'digital_print',
    keywords: ['fabric', 'inventory', 'stock', 'rolls', 'panna', 'lot']
  },
  {
    id: 'nav-vendors',
    title: 'Fabric Vendors & Challans',
    subtitle: 'Inward challans & supplier ledger',
    category: 'Inventory',
    icon: Building2,
    screen: 'fabric_challans',
    department: 'digital_print',
    keywords: ['vendor', 'supplier', 'fabric', 'challan', 'inward']
  },
  {
    id: 'nav-delivery-challan',
    title: 'Delivery Challans',
    subtitle: 'Outward dispatches & client gate passes',
    category: 'Logistics',
    icon: Truck,
    screen: 'delivery_challan',
    department: 'digital_print',
    keywords: ['delivery', 'challan', 'dispatch', 'gate pass', 'outward']
  },
  {
    id: 'nav-scan-pack',
    title: 'Scan & Pack Barcode Station',
    subtitle: 'High-speed order packing & manifest verify',
    category: 'Logistics',
    icon: Package,
    screen: 'scan_pack',
    department: 'digital_print',
    keywords: ['scan', 'pack', 'barcode', 'shipping', 'manifest']
  },

  // ── Communication & Management ──
  {
    id: 'nav-chat',
    title: 'Communication & Channels',
    subtitle: 'Staff team chat, direct messaging & audio',
    category: 'Collaboration',
    icon: MessageSquare,
    screen: 'communication',
    keywords: ['chat', 'messages', 'communication', 'dm', 'call']
  },
  {
    id: 'nav-tasks',
    title: 'Task Manager Panel',
    subtitle: 'Department task delegations & deadlines',
    category: 'Collaboration',
    icon: CheckSquare,
    screen: 'task_management',
    keywords: ['task', 'todo', 'assign', 'deadline']
  },
  {
    id: 'nav-expenses',
    title: 'Expense & Costing Center',
    subtitle: 'Monthly overheads, ink costing & ledger',
    category: 'Finance',
    icon: DollarSign,
    screen: 'expenses',
    department: 'digital_print',
    keywords: ['expense', 'costing', 'finance', 'ledger', 'ink']
  },
  {
    id: 'nav-complaints',
    title: 'QA & Customer Complaints',
    subtitle: 'Defect claims, credit notes & root cause',
    category: 'Support',
    icon: AlertTriangle,
    screen: 'complaints',
    department: 'digital_print',
    keywords: ['qa', 'complaint', 'defect', 'issue', 'ticket']
  },
  {
    id: 'nav-admin',
    title: 'Admin Control Center',
    subtitle: 'User access permissions, backups & audit logs',
    category: 'System',
    icon: Shield,
    screen: 'admin',
    keywords: ['admin', 'users', 'roles', 'permissions', 'system']
  }
];

export default function GlobalCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Global hotkey listener: Cmd+K (Mac) or Ctrl+K (Windows/Linux)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    const handleCustomOpen = () => setIsOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('erp:open-command-palette', handleCustomOpen);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('erp:open-command-palette', handleCustomOpen);
    };
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ERP_COMMANDS;

    return ERP_COMMANDS.filter((cmd) => {
      if (cmd.title.toLowerCase().includes(q)) return true;
      if (cmd.subtitle.toLowerCase().includes(q)) return true;
      if (cmd.category.toLowerCase().includes(q)) return true;
      return cmd.keywords?.some((kw) => kw.toLowerCase().includes(q));
    });
  }, [query]);

  // Handle keyboard navigation (Arrow Up, Down, Enter)
  const handleInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filteredCommands.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredCommands.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        executeCommand(filteredCommands[selectedIndex]);
      } else if (query.trim()) {
        executeSearch(query.trim());
      }
    }
  };

  const executeCommand = (cmd) => {
    setIsOpen(false);
    window.dispatchEvent(
      new CustomEvent('erp:navigate', {
        detail: {
          screen: cmd.screen,
          department: cmd.department
        }
      })
    );
  };

  const executeSearch = (searchTerm) => {
    setIsOpen(false);
    window.dispatchEvent(
      new CustomEvent('erp:navigate', {
        detail: {
          screen: 'jobcards',
          department: 'digital_print',
          searchQuery: searchTerm
        }
      })
    );
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999999,
        background: 'rgba(2, 6, 23, 0.72)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 'clamp(3rem, 12vh, 8rem)',
        paddingLeft: '1rem',
        paddingRight: '1rem',
        animation: 'paletteFadeIn 0.18s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false);
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '640px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: '20px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backdropFilter: 'blur(20px)',
          animation: 'paletteScaleUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            gap: '0.85rem'
          }}
        >
          <Search size={20} color="#38bdf8" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Type a screen, Job Card #, fabric name, or command..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '1rem',
              fontWeight: 500,
              fontFamily: 'inherit'
            }}
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
            >
              <X size={16} />
            </button>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 7px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#94a3b8',
                fontSize: '0.72rem',
                fontWeight: 600,
                letterSpacing: '0.5px'
              }}
            >
              <span>ESC</span>
            </div>
          )}
        </div>

        {/* Command / Results List */}
        <div
          ref={listRef}
          style={{
            maxHeight: '380px',
            overflowY: 'auto',
            padding: '0.6rem'
          }}
        >
          {/* If user typed a search query, show direct jump options */}
          {query.trim() && (
            <div
              onClick={() => executeSearch(query.trim())}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                cursor: 'pointer',
                marginBottom: '0.6rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Sparkles size={18} color="#38bdf8" />
                <span style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: 600 }}>
                  Search Job Cards for "{query.trim()}"
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#38bdf8', fontSize: '0.75rem' }}>
                <span>Press Enter</span>
                <ArrowRight size={14} />
              </div>
            </div>
          )}

          {filteredCommands.length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>No matching commands found for "{query}".</p>
              <p style={{ margin: '6px 0 0', fontSize: '0.8rem', opacity: 0.7 }}>
                Press Enter to run global search on Job Cards.
              </p>
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => executeCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.7rem 0.95rem',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(37, 99, 235, 0.25)' : 'transparent',
                    border: isSelected ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                    transition: 'all 0.12s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: isSelected ? '#2563eb' : 'rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isSelected ? '#ffffff' : '#94a3b8',
                        flexShrink: 0,
                        transition: 'all 0.12s ease'
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <div>
                      <div style={{ color: '#ffffff', fontSize: '0.88rem', fontWeight: 600 }}>{cmd.title}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.76rem', marginTop: '1px' }}>{cmd.subtitle}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: '#64748b',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.04)'
                      }}
                    >
                      {cmd.category}
                    </span>
                    {isSelected && <ArrowRight size={14} color="#60a5fa" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div
          style={{
            padding: '0.65rem 1.25rem',
            background: 'rgba(2, 6, 23, 0.6)',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.74rem',
            color: '#64748b'
          }}
        >
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span>↑ ↓ to navigate</span>
            <span>↵ to select</span>
            <span>ESC to close</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8' }}>
            <Command size={12} />
            <span>+ K Spotlight</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes paletteFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes paletteScaleUp {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
