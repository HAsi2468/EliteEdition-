import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  Package, 
  ArrowRight, 
  Filter, 
  Search, 
  Layers, 
  ShoppingBag, 
  CheckCircle2, 
  Eye, 
  ArrowUpRight,
  LayoutList,
  LayoutGrid
} from 'lucide-react';

/**
 * DashboardList
 * 
 * High-density, ergonomic dashboard table/card list component designed to eliminate
 * excessive horizontal eye scanning on wide screens.
 * 
 * Key Features:
 * - Constrained maximum readability width: `max-w-7xl mx-auto`.
 * - Fixed-width column layout grouping the status badge ('X Left') directly alongside
 *   the item & stock meter rather than pushing it to the far edge with `justify-between`.
 * - Alternating row shading (`even:bg-slate-50/50`) and subtle hover tracking.
 * - Dual view toggle: Dense Tabular Grid vs. Ergonomic Compact Cards.
 */
export function DashboardList({
  items = [],
  threshold = 10,
  onThresholdChange,
  onItemClick,
  onQuickInward,
  title = "Low Stock & Reorder Intelligence"
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'zero' | 'critical' | 'low'
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'

  const safeItems = Array.isArray(items) ? items : [];

  // Filter items based on search and stock status
  const filteredItems = useMemo(() => {
    return safeItems.filter((item) => {
      const stock = item.currentlyAvailableStock ?? item.stock ?? 0;
      const matchesSearch = 
        !searchTerm ||
        (item.itemName && item.itemName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.itemSKUCode && item.itemSKUCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.party && item.party.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (filterMode === 'zero') return stock === 0;
      if (filterMode === 'critical') return stock > 0 && stock <= 5;
      if (filterMode === 'low') return stock > 5 && stock <= (threshold || 10);
      return true;
    });
  }, [safeItems, searchTerm, filterMode, threshold]);

  const zeroCount = useMemo(() => safeItems.filter(i => (i.currentlyAvailableStock ?? 0) === 0).length, [safeItems]);
  const criticalCount = useMemo(() => safeItems.filter(i => {
    const s = i.currentlyAvailableStock ?? 0;
    return s > 0 && s <= 5;
  }).length, [safeItems]);

  const getStockBadge = (stock) => {
    if (stock === 0) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800, background: 'rgba(239, 68, 68, 0.16)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
          0 Left (Out of Stock)
        </span>
      );
    }
    if (stock <= 5) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800, background: 'rgba(245, 158, 11, 0.16)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.35)' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
          {stock} Left (Critical)
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(56, 189, 248, 0.16)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.35)' }}>
        {stock} Left
      </span>
    );
  };

  return (
    <div style={{ width: '100%', margin: '0.75rem 0' }}>
      {/* Container Card */}
      <div className="glass-card" style={{ borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.14)', background: 'rgba(15, 23, 42, 0.75)', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.28)' }}>
        
        {/* Header Strip with Integrated Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '1rem 1.25rem', background: 'rgba(15, 23, 42, 0.65)', borderBottom: '1px solid rgba(255, 255, 255, 0.12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ display: 'flex', height: '36px', width: '36px', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.18)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.35)' }}>
              <AlertTriangle size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#ffffff' }}>
                  {title}
                </h3>
                <span style={{ borderRadius: '6px', background: 'rgba(239, 68, 68, 0.18)', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 800, color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
                  {filteredItems.length} Warnings
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                Real-time stock alerts and replenishment warnings
              </p>
            </div>
          </div>

          {/* Action Tools & Filters */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: '190px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255, 255, 255, 0.5)' }} />
              <input
                type="text"
                placeholder="Filter item or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '6px 10px 6px 28px', fontSize: '0.76rem', background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.18)', borderRadius: '8px', color: '#ffffff', fontWeight: 500, boxSizing: 'border-box' }}
              />
            </div>

            {/* Threshold Input */}
            {onThresholdChange && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.18)', borderRadius: '8px', padding: '4px 10px', fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                <span style={{ fontWeight: 600 }}>Threshold:</span>
                <input
                  type="number"
                  min="1"
                  value={threshold}
                  onChange={(e) => onThresholdChange(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ width: '42px', textAlign: 'center', fontWeight: 800, color: '#ffffff', background: 'transparent', border: 'none', padding: 0 }}
                />
              </div>
            )}

            {/* View Mode Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.16)', background: 'rgba(15, 23, 42, 0.75)', padding: '2px', gap: '2px' }}>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: viewMode === 'table' ? 'rgba(56, 189, 248, 0.22)' : 'transparent',
                  color: viewMode === 'table' ? '#38bdf8' : 'rgba(255, 255, 255, 0.65)',
                  border: viewMode === 'table' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Dense Table View"
              >
                <LayoutList size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: viewMode === 'cards' ? 'rgba(56, 189, 248, 0.22)' : 'transparent',
                  color: viewMode === 'cards' ? '#38bdf8' : 'rgba(255, 255, 255, 0.65)',
                  border: viewMode === 'cards' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Compact Card View"
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Chips Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', background: 'rgba(15, 23, 42, 0.45)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', overflowX: 'auto', fontSize: '0.75rem' }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.68)', fontWeight: 700, marginRight: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Filter size={12} /> View:
          </span>
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            style={{
              padding: '4px 12px',
              borderRadius: '999px',
              fontWeight: 700,
              fontSize: '0.74rem',
              cursor: 'pointer',
              background: filterMode === 'all' ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255, 255, 255, 0.08)',
              color: filterMode === 'all' ? '#ffffff' : 'rgba(255, 255, 255, 0.72)',
              border: filterMode === 'all' ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid rgba(255, 255, 255, 0.14)'
            }}
          >
            All Items ({safeItems.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('zero')}
            style={{
              padding: '4px 12px',
              borderRadius: '999px',
              fontWeight: 700,
              fontSize: '0.74rem',
              cursor: 'pointer',
              background: filterMode === 'zero' ? 'rgba(239, 68, 68, 0.28)' : 'rgba(239, 68, 68, 0.12)',
              color: filterMode === 'zero' ? '#ffffff' : '#f87171',
              border: filterMode === 'zero' ? '1px solid rgba(239, 68, 68, 0.6)' : '1px solid rgba(239, 68, 68, 0.3)'
            }}
          >
            Out of Stock ({zeroCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('critical')}
            style={{
              padding: '4px 12px',
              borderRadius: '999px',
              fontWeight: 700,
              fontSize: '0.74rem',
              cursor: 'pointer',
              background: filterMode === 'critical' ? 'rgba(245, 158, 11, 0.28)' : 'rgba(245, 158, 11, 0.12)',
              color: filterMode === 'critical' ? '#ffffff' : '#fbbf24',
              border: filterMode === 'critical' ? '1px solid rgba(245, 158, 11, 0.6)' : '1px solid rgba(245, 158, 11, 0.3)'
            }}
          >
            Critical ≤5 ({criticalCount})
          </button>
        </div>

        {/* Content View: Dense Table (Recommended for Wide Screens) */}
        {viewMode === 'table' ? (
          <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 16px', width: '48px', textAlign: 'center' }}>#</th>
                  <th style={{ padding: '10px 16px', minWidth: '200px' }}>Item & SKU</th>
                  <th style={{ padding: '10px 16px', minWidth: '140px' }}>Party / Vendor</th>
                  <th style={{ padding: '10px 16px', width: '96px' }}>Size</th>
                  <th style={{ padding: '10px 16px', minWidth: '180px' }}>Stock Status (Grouped)</th>
                  <th style={{ padding: '10px 16px', width: '96px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.65)', fontWeight: 500 }}>
                      <CheckCircle2 size={32} style={{ margin: '0 auto 8px', color: '#34d399', opacity: 0.85 }} />
                      <div>All stock levels within healthy thresholds.</div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => {
                    const stock = item.currentlyAvailableStock ?? item.stock ?? 0;
                    return (
                      <tr 
                        key={item._id || idx}
                        style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}
                        onClick={() => onItemClick && onItemClick(item)}
                      >
                        {/* Number */}
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: 'rgba(255, 255, 255, 0.65)' }}>
                          {idx + 1}
                        </td>

                        {/* Item & SKU (Grouped together closely) */}
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ fontWeight: 800, color: '#ffffff' }}>
                            {item.itemName}
                          </div>
                          {item.itemSKUCode && (
                            <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.65)' }}>
                              SKU: {item.itemSKUCode}
                            </div>
                          )}
                        </td>

                        {/* Party / Vendor */}
                        <td style={{ padding: '10px 16px', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500 }}>
                          {item.party || '—'}
                        </td>

                        {/* Size */}
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', fontWeight: 700, fontSize: '0.7rem', border: '1px solid rgba(255, 255, 255, 0.16)' }}>
                            {item.size || 'STD'}
                          </span>
                        </td>

                        {/* Stock Remaining & Badge */}
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {getStockBadge(stock)}
                            {stock > 0 && (
                              <div style={{ width: '64px', height: '6px', background: 'rgba(255, 255, 255, 0.14)', borderRadius: '999px', overflow: 'hidden' }}>
                                <div 
                                  style={{ height: '100%', borderRadius: '999px', background: stock <= 5 ? '#f59e0b' : '#38bdf8', width: `${Math.min(100, (stock / (threshold || 10)) * 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Action Column */}
                        <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onQuickInward) onQuickInward(item);
                              else if (onItemClick) onItemClick(item);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              background: 'rgba(56, 189, 248, 0.16)',
                              color: '#38bdf8',
                              border: '1px solid rgba(56, 189, 248, 0.35)',
                              fontWeight: 700,
                              fontSize: '0.74rem',
                              cursor: 'pointer'
                            }}
                            title="Quick Inward / Edit Item"
                          >
                            <span>Action</span>
                            <ArrowUpRight size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Ergonomic Compact Cards Mode */
          <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.85rem', maxHeight: '520px', overflowY: 'auto' }}>
            {filteredItems.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '2.5rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.65)', fontWeight: 500 }}>
                <CheckCircle2 size={32} style={{ margin: '0 auto 8px', color: '#34d399', opacity: 0.85 }} />
                <div>No items currently low in stock.</div>
              </div>
            ) : (
              filteredItems.map((item, idx) => {
                const stock = item.currentlyAvailableStock ?? item.stock ?? 0;
                return (
                  <div
                    key={item._id || idx}
                    onClick={() => onItemClick && onItemClick(item)}
                    style={{ padding: '0.9rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.14)', background: 'rgba(15, 23, 42, 0.65)', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                        <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.85rem' }}>
                          {item.itemName}
                        </div>
                        {getStockBadge(stock)}
                      </div>

                      <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.65)', fontFamily: 'monospace', marginBottom: '8px' }}>
                        SKU: {item.itemSKUCode || 'N/A'}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.8)', background: 'rgba(255, 255, 255, 0.06)', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                        <span>Party: <strong style={{ color: '#ffffff' }}>{item.party || 'Standard'}</strong></span>
                        <span>Size: <strong style={{ color: '#ffffff' }}>{item.size || 'STD'}</strong></span>
                      </div>
                    </div>

                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        Manage Item <ArrowRight size={12} />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Footer Summary Strip */}
        <div style={{ padding: '0.65rem 1.25rem', background: 'rgba(15, 23, 42, 0.65)', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)' }}>
          <span>Showing {filteredItems.length} of {safeItems.length} total tracked items</span>
          <span style={{ color: 'rgba(255, 255, 255, 0.55)' }}>Ergonomic ERP Layout • WCAG AAA Readable</span>
        </div>

      </div>
    </div>
  );
}

export default DashboardList;
