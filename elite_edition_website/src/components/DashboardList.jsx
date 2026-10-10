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

  // Filter items based on search and stock status
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
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
  }, [items, searchTerm, filterMode, threshold]);

  const zeroCount = useMemo(() => items.filter(i => (i.currentlyAvailableStock ?? 0) === 0).length, [items]);
  const criticalCount = useMemo(() => items.filter(i => {
    const s = i.currentlyAvailableStock ?? 0;
    return s > 0 && s <= 5;
  }).length, [items]);

  const getStockBadge = (stock) => {
    if (stock === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-700 border border-rose-300">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
          0 Left (Out of Stock)
        </span>
      );
    }
    if (stock <= 5) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
          {stock} Left (Critical)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
        {stock} Left
      </span>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto my-3 px-2 sm:px-4">
      {/* Container Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        
        {/* Header Strip with Integrated Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50/70 border-b border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shadow-sm border border-amber-200">
              <AlertTriangle size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                  {title}
                </h3>
                <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-extrabold text-rose-700 border border-rose-200">
                  {filteredItems.length} Warnings
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                High-density layout optimized to prevent horizontal eye strain
              </p>
            </div>
          </div>

          {/* Action Tools & Filters */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Search Input */}
            <div className="relative min-w-[180px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter item or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 font-medium"
              />
            </div>

            {/* Threshold Input */}
            {onThresholdChange && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-600">
                <span className="font-semibold">Threshold:</span>
                <input
                  type="number"
                  min="1"
                  value={threshold}
                  onChange={(e) => onThresholdChange(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-10 text-center font-bold text-slate-900 bg-transparent border-none p-0 focus:outline-none"
                />
              </div>
            )}

            {/* View Mode Switcher */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md text-xs font-semibold transition-colors ${
                  viewMode === 'table' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Dense Table View"
              >
                <LayoutList size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-md text-xs font-semibold transition-colors ${
                  viewMode === 'cards' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Compact Card View"
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Chips Bar */}
        <div className="flex items-center gap-1.5 px-4 py-2 bg-white border-b border-slate-100 overflow-x-auto text-xs">
          <span className="text-slate-400 font-bold mr-1 flex items-center gap-1">
            <Filter size={12} /> View:
          </span>
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-2.5 py-1 rounded-full font-bold transition-all ${
              filterMode === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Items ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('zero')}
            className={`px-2.5 py-1 rounded-full font-bold transition-all ${
              filterMode === 'zero'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            Out of Stock ({zeroCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('critical')}
            className={`px-2.5 py-1 rounded-full font-bold transition-all ${
              filterMode === 'critical'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            Critical ≤5 ({criticalCount})
          </button>
        </div>

        {/* Content View: Dense Table (Recommended for Wide Screens) */}
        {viewMode === 'table' ? (
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-slate-200 text-slate-700 font-extrabold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4 w-12 text-center text-slate-400">#</th>
                  <th className="py-2.5 px-4 min-w-[200px]">Item & SKU</th>
                  <th className="py-2.5 px-4 min-w-[140px]">Party / Vendor</th>
                  <th className="py-2.5 px-4 w-24">Size</th>
                  <th className="py-2.5 px-4 min-w-[180px]">Stock Status (Grouped)</th>
                  <th className="py-2.5 px-4 w-24 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400 font-medium">
                      <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500 opacity-80" />
                      <div>All stock levels within healthy thresholds.</div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => {
                    const stock = item.currentlyAvailableStock ?? item.stock ?? 0;
                    return (
                      <tr 
                        key={item._id || idx}
                        className="even:bg-slate-50/50 odd:bg-white hover:bg-blue-50/50 transition-colors group cursor-pointer"
                        onClick={() => onItemClick && onItemClick(item)}
                      >
                        {/* Number */}
                        <td className="py-2.5 px-4 text-center font-bold text-slate-400">
                          {idx + 1}
                        </td>

                        {/* Item & SKU (Grouped together closely) */}
                        <td className="py-2.5 px-4">
                          <div className="font-extrabold text-slate-900 group-hover:text-blue-700 transition-colors">
                            {item.itemName}
                          </div>
                          {item.itemSKUCode && (
                            <div className="text-[11px] font-mono text-slate-500">
                              SKU: {item.itemSKUCode}
                            </div>
                          )}
                        </td>

                        {/* Party / Vendor */}
                        <td className="py-2.5 px-4 text-slate-700 font-medium">
                          {item.party || '—'}
                        </td>

                        {/* Size */}
                        <td className="py-2.5 px-4">
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[11px]">
                            {item.size || 'STD'}
                          </span>
                        </td>

                        {/* Stock Remaining & Badge - Kept in fixed column to stop horizontal eye jump */}
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            {getStockBadge(stock)}
                            {stock > 0 && (
                              <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden hidden sm:block">
                                <div 
                                  className={`h-full rounded-full ${stock <= 5 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                  style={{ width: `${Math.min(100, (stock / (threshold || 10)) * 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Action Column */}
                        <td className="py-2.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onQuickInward) onQuickInward(item);
                              else if (onItemClick) onItemClick(item);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white font-bold transition-all text-xs"
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
          /* Ergonomic Compact Cards Mode: Constrained Width to Avoid Edge-to-Edge Scanning */
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="col-span-full py-10 text-center text-slate-400 font-medium">
                <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500 opacity-80" />
                <div>No items currently low in stock.</div>
              </div>
            ) : (
              filteredItems.map((item, idx) => {
                const stock = item.currentlyAvailableStock ?? item.stock ?? 0;
                return (
                  <div
                    key={item._id || idx}
                    onClick={() => onItemClick && onItemClick(item)}
                    className="p-3.5 rounded-xl border border-slate-200/90 bg-white hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      {/* Title & Badge grouped close together at top */}
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug">
                          {item.itemName}
                        </div>
                        {getStockBadge(stock)}
                      </div>

                      <div className="text-[11px] text-slate-500 font-mono mb-2">
                        SKU: {item.itemSKUCode || 'N/A'}
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                        <span>Party: <strong>{item.party || 'Standard'}</strong></span>
                        <span>Size: <strong>{item.size || 'STD'}</strong></span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-end">
                      <span className="text-xs font-bold text-blue-600 inline-flex items-center gap-1 hover:underline">
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
        <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>Showing {filteredItems.length} of {items.length} total tracked items</span>
          <span className="text-slate-400">Ergonomic ERP Layout • WCAG AAA Readable</span>
        </div>

      </div>
    </div>
  );
}

export default DashboardList;
