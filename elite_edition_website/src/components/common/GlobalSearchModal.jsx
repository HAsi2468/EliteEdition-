import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  ChevronRight,
  SlidersHorizontal,
  Database,
  ShieldCheck,
  Zap,
  CornerDownLeft
} from 'lucide-react';
import { api } from '../../services/api';
import { triggerAIMeasurementModal } from './AIMeasurementAgentModal';
import { AVAILABLE_SCREENS } from '../../config/screensConfig';

/**
 * Intelligent Fuzzy Matching Algorithm
 * Returns a score > 0 if query fuzzy-matches target string.
 */
function fuzzyScore(target, query) {
  if (!query) return 1;
  if (!target) return 0;
  const t = target.toLowerCase();
  const q = query.toLowerCase();

  if (t === q) return 100;
  if (t.startsWith(q)) return 85 + (q.length / t.length) * 10;
  if (t.includes(q)) return 70 + (q.length / t.length) * 10;

  // Acronym match (e.g. "jc" -> "Job Card", "eo" -> "Elite Online")
  const words = t.split(/[\s-_/]+/);
  const initials = words.map(w => w[0]).join('');
  if (initials.includes(q)) return 60;

  // Subsequence matching
  let ti = 0;
  let qi = 0;
  let score = 0;
  let consecutive = 0;
  while (ti < t.length && qi < q.length) {
    if (t[ti] === q[qi]) {
      score += 8 + (consecutive * 4);
      consecutive++;
      qi++;
    } else {
      consecutive = 0;
    }
    ti++;
  }

  return qi === q.length ? score : 0;
}

/**
 * Instant Module Actions Registry
 */
const INSTANT_ACTIONS = [
  {
    id: 'act_ai_measurement',
    title: 'AI Textile Measurement & Yield Agent',
    subtitle: 'Calibrate fabric shrinkage %, net fresh output meters & piece yield',
    category: 'Actions',
    badge: 'AI Tool',
    icon: Sparkles,
    color: '#2563eb',
    action: 'ai_measurement',
    shortcut: '⌘ M'
  },
  {
    id: 'act_new_jobcard',
    title: 'Create New Job Card',
    subtitle: 'Initiate a new production lot, cutting, or digital print job card',
    category: 'Actions',
    badge: 'Quick Action',
    icon: PlusCircle,
    color: '#2563eb',
    action: 'new_jobcard',
    tab: 'jobcards',
    shortcut: 'N J'
  },
  {
    id: 'act_new_inward',
    title: 'New Fabric Inward Entry',
    subtitle: 'Log raw lot arrivals, roll meterages, and supplier delivery challans',
    category: 'Actions',
    badge: 'Quick Action',
    icon: Layers,
    color: '#059669',
    action: 'new_inward',
    shortcut: 'N I'
  },
  {
    id: 'act_new_invoice',
    title: 'Create GST Tax Invoice',
    subtitle: 'Generate GST-compliant tax invoice in Billing Department',
    category: 'Actions',
    badge: 'Quick Action',
    icon: Receipt,
    color: '#7c3aed',
    action: 'new_invoice',
    shortcut: 'N B'
  },
  {
    id: 'act_stitching_challan',
    title: 'New Stitching Challan',
    subtitle: 'Issue lots or cut pieces to stitching master/contractor',
    category: 'Actions',
    badge: 'Quick Action',
    icon: Scissors,
    color: '#0891b2',
    action: 'stitching_challan',
    tab: 'stitching_challan',
    shortcut: 'N S'
  },
  {
    id: 'act_toggle_density',
    title: 'Toggle Table Grid Density',
    subtitle: 'Switch between Compact (dense 28px) and Comfortable (spacious 44px) views',
    category: 'Actions',
    badge: 'Smart UI',
    icon: SlidersHorizontal,
    color: '#0284c7',
    action: 'toggle_density',
    shortcut: '⌘ D'
  },
  {
    id: 'act_approvals_queue',
    title: 'Review & Approvals Queue',
    subtitle: 'Inspect pending cross-department edits, updates, and deletion requests',
    category: 'Actions',
    badge: 'Approvals',
    icon: ShieldCheck,
    color: '#f59e0b',
    action: 'nav_approvals',
    tab: 'admin',
    shortcut: 'G A'
  },
  {
    id: 'act_backup_center',
    title: 'Backup & Cloud Sync Center',
    subtitle: 'Export master database, AWS S3/Cloudflare R2 archives, and system restore',
    category: 'Actions',
    badge: 'Infrastructure',
    icon: Database,
    color: '#6366f1',
    action: 'nav_backup',
    tab: 'admin'
  },
  {
    id: 'act_refresh_data',
    title: 'Refresh Realtime Data',
    subtitle: 'Resync real-time tables, inventory tallies, and notifications',
    category: 'Actions',
    badge: 'Sync',
    icon: RefreshCw,
    color: '#475569',
    action: 'refresh_data',
    shortcut: 'R'
  }
];

export function GlobalSearchModal({ isOpen, onClose, onSelectResult, activeCompanyId = 'digital_print' }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all'); // 'all' | 'actions' | 'navigation' | 'database'
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
      setTimeout(() => inputRef.current?.focus(), 40);
      setSelectedIndex(0);
      setDragOffset(0);
    } else {
      setSearchTerm('');
      setDbResults([]);
    }
  }, [isOpen]);

  // Dynamically map AVAILABLE_SCREENS to Navigation Registry
  const screenNavItems = useMemo(() => {
    return (AVAILABLE_SCREENS || []).map((scr) => {
      let icon = FileText;
      let color = '#2563eb';

      if (scr.category === 'Elite Digital Print') {
        icon = Layers;
        color = '#0284c7';
      } else if (scr.category === 'Elite Stitching') {
        icon = Scissors;
        color = '#ea580c';
      } else if (scr.category === 'Elite Online') {
        icon = Package;
        color = '#16a34a';
      } else if (scr.id.includes('billing') || scr.id.includes('invoices')) {
        icon = Receipt;
        color = '#9333ea';
      } else if (scr.id === 'admin') {
        icon = Settings;
        color = '#64748b';
      } else if (scr.id.includes('report')) {
        icon = BarChart3;
        color = '#059669';
      }

      return {
        id: `nav_${scr.id}`,
        title: scr.label,
        subtitle: `${scr.category} Department Module`,
        category: 'Navigation',
        tab: scr.id,
        badge: scr.category,
        icon,
        color
      };
    });
  }, []);

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
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm, activeCompanyId]);

  // Compute fuzzy matches for Actions & Navigation
  const { filteredActions, filteredNavigation } = useMemo(() => {
    const q = searchTerm.trim();
    if (!q) {
      return {
        filteredActions: INSTANT_ACTIONS,
        filteredNavigation: screenNavItems.slice(0, 12)
      };
    }

    const scoredActions = INSTANT_ACTIONS.map(item => {
      const s1 = fuzzyScore(item.title, q);
      const s2 = fuzzyScore(item.subtitle, q);
      const s3 = fuzzyScore(item.badge, q);
      const score = Math.max(s1, s2 * 0.7, s3 * 0.6);
      return { item, score };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).map(x => x.item);

    const scoredNav = screenNavItems.map(item => {
      const s1 = fuzzyScore(item.title, q);
      const s2 = fuzzyScore(item.subtitle, q);
      const s3 = fuzzyScore(item.badge, q);
      const score = Math.max(s1, s2 * 0.7, s3 * 0.6);
      return { item, score };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).map(x => x.item);

    return {
      filteredActions: scoredActions,
      filteredNavigation: scoredNav
    };
  }, [searchTerm, screenNavItems]);

  // Combine items by category tab
  const displayedItems = useMemo(() => {
    if (activeCategory === 'actions') {
      return filteredActions;
    } else if (activeCategory === 'navigation') {
      return filteredNavigation;
    } else if (activeCategory === 'database') {
      return dbResults;
    }

    // 'all': Interleave Actions, Navigation, and DB Records
    if (!searchTerm.trim()) {
      return [...filteredActions, ...filteredNavigation];
    }
    return [...filteredActions, ...filteredNavigation, ...dbResults];
  }, [activeCategory, filteredActions, filteredNavigation, dbResults, searchTerm]);

  // Reset selected index when results change
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

    if (item.action === 'toggle_density') {
      if (typeof window !== 'undefined') {
        const current = localStorage.getItem('elite_erp_table_density') || 'compact';
        const next = current === 'compact' ? 'comfortable' : 'compact';
        localStorage.setItem('elite_erp_table_density', next);
        document.documentElement.setAttribute('data-user-density', next);
        window.dispatchEvent(new CustomEvent('elite-density-change', { detail: { density: next } }));
        if (window.showToast) {
          window.showToast(`Grid density switched to ${next.toUpperCase()}`, 'info');
        }
      }
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
    } else if (e.key === 'Tab') {
      // Tab cycles through categories
      e.preventDefault();
      const categories = ['all', 'actions', 'navigation', 'database'];
      const nextIdx = (categories.indexOf(activeCategory) + 1) % categories.length;
      setActiveCategory(categories[nextIdx]);
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
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'flex-start',
        justifyContent: 'center',
        padding: isMobile ? 0 : '16px',
        paddingTop: isMobile ? 0 : 'min(10vh, 72px)',
        animation: 'erpDrawerFadeIn 0.18s ease'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: isMobile ? '560px' : '680px',
          backgroundColor: '#ffffff',
          borderRadius: isMobile ? '20px 20px 0 0' : '12px',
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

        {/* Command Palette Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '13px 18px',
            borderBottom: '1px solid #e2e8f0',
            gap: '12px',
            backgroundColor: '#f8fafc'
          }}
        >
          <Search size={19} color="#2563eb" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, screen name, job card, or party..."
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
            gap: '6px',
            padding: '7px 14px',
            borderBottom: '1px solid #f1f5f9',
            backgroundColor: '#ffffff',
            overflowX: 'auto'
          }}
        >
          {[
            { id: 'all', label: 'All', icon: Zap },
            { id: 'actions', label: '⚡ Actions', count: filteredActions.length },
            { id: 'navigation', label: '🧭 Screens', count: filteredNavigation.length },
            { id: 'database', label: '📄 Database Records', count: dbResults.length }
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
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span>{cat.label}</span>
              {typeof cat.count === 'number' && cat.count > 0 && (
                <span
                  style={{
                    fontSize: '10px',
                    backgroundColor: activeCategory === cat.id ? '#dbeafe' : '#f1f5f9',
                    color: activeCategory === cat.id ? '#1d4ed8' : '#64748b',
                    padding: '1px 5px',
                    borderRadius: '999px',
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  {cat.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Results Container */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
          {loading && (
            <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#64748b', fontSize: '13px' }}>
              <RefreshCw size={14} className="spin-loader" />
              <span>Querying ERP database...</span>
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
                No matching results found
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                Try searching for a job card #, challan, party name, or instant action
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
                  padding: '9px 16px',
                  backgroundColor: isSelected ? '#f8fafc' : 'transparent',
                  borderLeft: isSelected ? '3px solid #2563eb' : '3px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #f8fafc',
                  minHeight: '44px',
                  transition: 'background-color 0.1s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '7px',
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
                            backgroundColor: item.badge === 'Quick Action' ? '#dcfce7' : item.badge === 'AI Tool' ? '#eff6ff' : '#f1f5f9',
                            color: item.badge === 'Quick Action' ? '#15803d' : item.badge === 'AI Tool' ? '#1d4ed8' : '#475569',
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
                  {item.shortcut && (
                    <kbd
                      style={{
                        padding: '1px 5px',
                        fontSize: '10px',
                        fontFamily: 'monospace',
                        color: '#64748b',
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px'
                      }}
                    >
                      {item.shortcut}
                    </kbd>
                  )}
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
            padding: '8px 16px',
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
            <span><kbd style={{ padding: '1px 4px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '3px' }}>Tab</kbd> Switch Tab</span>
            <span><kbd style={{ padding: '1px 4px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '3px' }}>esc</kbd> Dismiss</span>
          </div>
          <div>
            <span style={{ fontWeight: 600, color: '#334155' }}>⌘K Palette</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GlobalSearchModal;
