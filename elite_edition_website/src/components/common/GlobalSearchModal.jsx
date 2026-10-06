import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  X, 
  ArrowRight, 
  PlusCircle, 
  FileText, 
  Layers, 
  Scissors, 
  Receipt, 
  Package, 
  Users, 
  RefreshCw, 
  QrCode, 
  BarChart3, 
  MessageSquare, 
  CheckSquare, 
  Settings,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { api } from '../../services/api';
import { triggerAIMeasurementModal } from './AIMeasurementAgentModal';

/**
 * Enterprise Command Palette (Search & Quick Navigation)
 * Triggered by Ctrl+K / Cmd+K on desktop or search button in header.
 * Allows searching across modules, challans, orders, parties, and triggering frequent shortcuts.
 */

const FREQUENT_SHORTCUTS = [
  {
    id: 'shortcut_ai_measurement',
    title: 'AI Textile Measurement & Yield Agent',
    subtitle: 'Calibrate fabric shrinkage %, net fresh output meters & piece yield',
    category: 'Shortcut',
    badge: 'AI Tool',
    icon: Sparkles,
    color: '#2563eb',
    action: 'ai_measurement'
  },
  {
    id: 'shortcut_new_jobcard',
    title: 'New Job Card',
    subtitle: 'Create a new garment or digital print production job card',
    category: 'Shortcut',
    badge: 'Action',
    icon: PlusCircle,
    color: '#2563eb',
    action: 'new_jobcard',
    tab: 'jobcards'
  },
  {
    id: 'shortcut_new_inward',
    title: 'New Inward Entry',
    subtitle: 'Log roll or fabric inward lot arrival with challan & invoice details',
    category: 'Shortcut',
    badge: 'Action',
    icon: Layers,
    color: '#059669',
    action: 'new_inward'
  },
  {
    id: 'shortcut_view_stock',
    title: 'View Stock & Fabric Rolls',
    subtitle: 'Inspect available fabric meters, lots, and warehouse inventory',
    category: 'Shortcut',
    badge: 'Navigate',
    icon: Package,
    color: '#d97706',
    action: 'view_stock',
    tab: 'fabric_inventory'
  },
  {
    id: 'shortcut_new_invoice',
    title: 'Create New Invoice',
    subtitle: 'Generate GST-compliant tax invoice in Billing Department',
    category: 'Shortcut',
    badge: 'Action',
    icon: Receipt,
    color: '#7c3aed',
    action: 'new_invoice',
    tab: 'billing'
  },
  {
    id: 'shortcut_stitching_challan',
    title: 'New Stitching Challan',
    subtitle: 'Issue lots or cut pieces to stitching master/contractor',
    category: 'Shortcut',
    badge: 'Action',
    icon: Scissors,
    color: '#0891b2',
    action: 'stitching_challan',
    tab: 'stitching_challan'
  },
  {
    id: 'shortcut_refresh_data',
    title: 'Refresh Live Data',
    subtitle: 'Resync real-time tables, inventory tallies, and notifications',
    category: 'Shortcut',
    badge: 'System',
    icon: RefreshCw,
    color: '#475569',
    action: 'refresh_data'
  }
];

const MODULE_NAVIGATION = [
  { id: 'nav_jobcards', title: 'Job Cards Dashboard', subtitle: 'Production tracking, stages & QA cards', category: 'Navigation', tab: 'jobcards', icon: FileText, color: '#2563eb' },
  { id: 'nav_printing_log', title: 'Digital Print Operations', subtitle: 'Live print queue, meters run & machine status', category: 'Navigation', tab: 'job_printing_log', icon: Layers, color: '#0284c7' },
  { id: 'nav_fabric_inv', title: 'Fabric & Lot Inventory', subtitle: 'Roll stock, lot transfers & meters ledger', category: 'Navigation', tab: 'fabric_inventory', icon: Package, color: '#16a34a' },
  { id: 'nav_billing', title: 'Elite Billing & Invoicing', subtitle: 'GST invoices, payment ledgers & sales register', category: 'Navigation', tab: 'billing', icon: Receipt, color: '#9333ea' },
  { id: 'nav_stitching', title: 'Stitching Department', subtitle: 'Vendor job work, lot dispatches & piece receipts', category: 'Navigation', tab: 'stitching_challan', icon: Scissors, color: '#ea580c' },
  { id: 'nav_catalog', title: 'Design Catalogue', subtitle: 'Master sample gallery, artwork tags & SKU lookup', category: 'Navigation', tab: 'catalog', icon: Sparkles, color: '#db2777' },
  { id: 'nav_parties', title: 'Customer & Vendor Profiles', subtitle: 'Client directory, GST numbers & payment history', category: 'Navigation', tab: 'customer_profiles', icon: Users, color: '#4f46e5' },
  { id: 'nav_reports', title: 'Reports & Analytics Center', subtitle: 'Executive revenue charts, stock tallies & audit exports', category: 'Navigation', tab: 'reports', icon: BarChart3, color: '#059669' },
  { id: 'nav_communication', title: 'Workforce Communication', subtitle: 'Inter-department team chat, announcements & files', category: 'Navigation', tab: 'communication', icon: MessageSquare, color: '#2563eb' },
  { id: 'nav_tasks', title: 'Task Manager', subtitle: 'Shift duties, production checklists & reminders', category: 'Navigation', tab: 'task_management', icon: CheckSquare, color: '#0891b2' },
  { id: 'nav_admin', title: 'Admin & System Settings', subtitle: 'User roles, facility configurations & master backup', category: 'Navigation', tab: 'admin', icon: Settings, color: '#64748b' }
];

export function GlobalSearchModal({ isOpen, onClose, onSelectResult, activeCompanyId = 'digital_print' }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all'); // 'all' | 'shortcuts' | 'navigation' | 'database'
  const [dbResults, setDbResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  // Mobile swipe to dismiss
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartYRef = useRef(0);
  const currentYRef = useRef(0);

  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const stored = localStorage.getItem(`elite_recent_searches_${activeCompanyId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
      setDragOffset(0);
    } else {
      setSearchTerm('');
      setDbResults([]);
    }
  }, [isOpen]);

  // Debounced database search query
  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed || trimmed.length < 2) {
      setDbResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const res = await api.globalSearch(trimmed, activeCompanyId);
        if (!controller.signal.aborted) {
          setDbResults(res?.results || []);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setDbResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm, activeCompanyId]);

  // Compute combined list based on search term & category filter
  const query = searchTerm.toLowerCase().trim();

  const filteredShortcuts = FREQUENT_SHORTCUTS.filter(s => 
    !query || s.title.toLowerCase().includes(query) || s.subtitle.toLowerCase().includes(query)
  );

  const filteredNavigation = MODULE_NAVIGATION.filter(m =>
    !query || m.title.toLowerCase().includes(query) || m.subtitle.toLowerCase().includes(query)
  );

  let displayedItems = [];
  if (activeCategory === 'shortcuts') {
    displayedItems = filteredShortcuts;
  } else if (activeCategory === 'navigation') {
    displayedItems = filteredNavigation;
  } else if (activeCategory === 'database') {
    displayedItems = dbResults;
  } else {
    // 'all'
    if (!query) {
      displayedItems = [...filteredShortcuts, ...filteredNavigation];
    } else {
      displayedItems = [...filteredShortcuts, ...filteredNavigation, ...dbResults];
    }
  }

  // Keep selected index in bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm, activeCategory]);

  const saveRecentSearch = (term) => {
    if (!term) return;
    try {
      const updated = [term, ...recentSearches.filter((s) => s !== term)].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem(`elite_recent_searches_${activeCompanyId}`, JSON.stringify(updated));
    } catch {}
  };

  const handleSelect = (item) => {
    if (!item) return;
    saveRecentSearch(searchTerm.trim() || item.title);
    onClose();

    if (item.action === 'ai_measurement') {
      triggerAIMeasurementModal();
      return;
    }

    if (onSelectResult) {
      onSelectResult(item);
    } else if (item.route) {
      window.location.hash = item.route;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < displayedItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : Math.max(0, displayedItems.length - 1)));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (displayedItems[selectedIndex]) {
        handleSelect(displayedItems[selectedIndex]);
      }
    }
  };

  // Mobile swipe-to-dismiss handlers
  const handleTouchStart = (e) => {
    if (!isMobile) return;
    touchStartYRef.current = e.touches[0].clientY;
    currentYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || !isMobile) return;
    const clientY = e.touches[0].clientY;
    currentYRef.current = clientY;
    const diff = clientY - touchStartYRef.current;
    if (diff > 0) {
      setDragOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging || !isMobile) return;
    setIsDragging(false);
    const diff = currentYRef.current - touchStartYRef.current;
    if (diff > 100) {
      onClose();
    } else {
      setDragOffset(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'flex-start',
        justifyContent: 'center',
        padding: isMobile ? 0 : '16px',
        paddingTop: isMobile ? 0 : 'min(10vh, 72px)'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: isMobile ? '560px' : '640px',
          backgroundColor: '#ffffff',
          borderRadius: isMobile ? '20px 20px 0 0' : '14px',
          border: isMobile ? 'none' : '1px solid #cbd5e1',
          boxShadow: isMobile ? '0 -10px 40px rgba(0,0,0,0.25)' : '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 25px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: isMobile ? '90dvh' : '82vh',
          transform: isMobile ? `translateY(${dragOffset}px)` : 'none',
          transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          paddingBottom: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 8px)' : 0
        }}
      >
        {/* Mobile Swipe Drag Pill */}
        {isMobile && (
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              padding: '8px 0 4px',
              cursor: 'grab',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #f1f5f9'
            }}
          >
            <div
              style={{
                width: '42px',
                height: '4px',
                backgroundColor: '#cbd5e1',
                borderRadius: '999px'
              }}
            />
          </div>
        )}

        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid #e2e8f0',
            gap: '10px',
            backgroundColor: '#f8fafc'
          }}
        >
          <Search size={18} color="#2563eb" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search orders, challans, parties..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '15px',
              color: '#0f172a',
              backgroundColor: 'transparent',
              fontWeight: 500
            }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '12px',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px 6px'
              }}
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#475569',
              cursor: 'pointer',
              padding: '3px 7px'
            }}
          >
            ESC
          </button>
        </div>

        {/* Category Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            padding: '6px 12px',
            borderBottom: '1px solid #f1f5f9',
            backgroundColor: '#ffffff',
            overflowX: 'auto'
          }}
        >
          {[
            { id: 'all', label: 'All' },
            { id: 'shortcuts', label: 'Shortcuts' },
            { id: 'navigation', label: 'Modules' },
            { id: 'database', label: 'Data Search' }
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeCategory === cat.id ? '#eff6ff' : 'transparent',
                color: activeCategory === cat.id ? '#2563eb' : '#64748b',
                whiteSpace: 'nowrap'
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Results Container */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
          {loading && (
            <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#64748b', fontSize: '13px' }}>
              <RefreshCw size={14} className="spin-loader" />
              <span>Searching ERP database...</span>
            </div>
          )}

          {!searchTerm && recentSearches.length > 0 && (
            <div style={{ padding: '8px 14px', borderBottom: '1px solid #f8fafc' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em' }}>
                Recent Searches
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {recentSearches.map((term, i) => (
                  <button
                    key={i}
                    onClick={() => setSearchTerm(term)}
                    style={{
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: '#334155',
                      cursor: 'pointer'
                    }}
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {displayedItems.length === 0 && !loading && (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: '#64748b' }}>
              <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600, color: '#334155' }}>
                No matching results
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                Try searching for a job card #, challan, party name, or shortcut
              </p>
            </div>
          )}

          {displayedItems.map((item, index) => {
            const isSelected = index === selectedIndex;
            const Icon = item.icon || FileText;

            return (
              <div
                key={`${item.category}-${item.id || item.title}-${index}`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(index)}
                style={{
                  padding: '9px 14px',
                  backgroundColor: isSelected ? '#f8fafc' : 'transparent',
                  borderLeft: isSelected ? '3px solid #2563eb' : '3px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #f8fafc',
                  minHeight: '42px',
                  transition: 'background-color 0.1s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '6px',
                      backgroundColor: isSelected ? '#eff6ff' : '#f1f5f9',
                      color: item.color || '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Icon size={16} />
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                        {item.title}
                      </span>
                      {item.badge && (
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: item.badge === 'Action' ? '#dcfce7' : '#eff6ff',
                            color: item.badge === 'Action' ? '#15803d' : '#1d4ed8',
                            textTransform: 'uppercase'
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    {item.subtitle && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#64748b',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      padding: '2px 5px',
                      color: '#475569',
                      fontWeight: 500
                    }}
                  >
                    {item.category}
                  </span>
                  <ChevronRight size={14} color="#94a3b8" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer shortcuts hint */}
        <div
          style={{
            padding: '8px 14px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#64748b'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span><kbd style={{ padding: '1px 4px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '3px' }}>↑↓</kbd> Navigate</span>
            <span><kbd style={{ padding: '1px 4px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '3px' }}>↵</kbd> Select</span>
            <span><kbd style={{ padding: '1px 4px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '3px' }}>esc</kbd> Dismiss</span>
          </div>
          <div>
            <span>Elite Edition ERP</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GlobalSearchModal;
