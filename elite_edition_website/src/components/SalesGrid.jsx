import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../services/api';
import { uniwareApi } from '../services/uniware';
import { 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  ShoppingBag,
  Package,
  MapPin,
  Clock,
  RotateCcw
} from 'lucide-react';
import { formatDateTimeDDMMYYYY } from '../utils/dateUtils';
import { matchSearchQuery } from '../utils/searchUtils';
import InfiniteScrollPagination from './InfiniteScrollPagination';
import { SmartThumbnail } from './common/SmartThumbnail';
import ErpUnifiedFilterBar from './common/ErpUnifiedFilterBar';
import { ErpTh, MasterCheckboxTh, RowCheckboxTd, getRowHighlightStyle } from './common/ErpTableParts';

export default function SalesGrid() {
  const [orders, setOrders] = useState([]);
  const [selectedOrderMap, setSelectedOrderMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncingOrderId, setSyncingOrderId] = useState('');
  const [error, setError] = useState('');
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(25);

  // Sorting State
  const [sortField, setSortField] = useState('orderDate');
  const [sortOrder, setSortOrder] = useState('desc');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  
  // Standard Date States
  const [datePreset, setDatePreset] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');

  // Unified Multi-Filter Popover States
  const [activeFilters, setActiveFilters] = useState({});

  const salesFilterCategories = useMemo(() => [
    {
      id: 'status',
      label: 'Order Status',
      icon: Clock,
      multi: true,
      options: [
        { value: 'DELIVERED', label: 'Delivered' },
        { value: 'SHIPPED', label: 'Shipped' },
        { value: 'IN_TRANSIT', label: 'In Transit' },
        { value: 'COMPLETE', label: 'Complete' },
        { value: 'PROCESSING', label: 'Processing' },
        { value: 'CREATED', label: 'Created' },
        { value: 'CANCELLED', label: 'Cancelled' },
        { value: 'RETURNED', label: 'Returned' }
      ]
    },
    {
      id: 'city',
      label: 'Top Destinations',
      icon: MapPin,
      multi: true,
      options: [
        { value: 'Surat', label: 'Surat' },
        { value: 'Mumbai', label: 'Mumbai' },
        { value: 'Ahmedabad', label: 'Ahmedabad' },
        { value: 'Delhi', label: 'Delhi' },
        { value: 'Bengaluru', label: 'Bengaluru' },
        { value: 'Jaipur', label: 'Jaipur' },
        { value: 'Kolkata', label: 'Kolkata' },
        { value: 'Hyderabad', label: 'Hyderabad' },
        { value: 'Pune', label: 'Pune' },
        { value: 'Lucknow', label: 'Lucknow' }
      ]
    },
    {
      id: 'category',
      label: 'Category',
      icon: Package,
      multi: true,
      options: [
        { value: 'Kurti', label: 'Kurti' },
        { value: 'Suit', label: 'Suit' },
        { value: 'Saree', label: 'Saree' },
        { value: 'Fabric', label: 'Fabric' },
        { value: 'Dress Material', label: 'Dress Material' }
      ]
    }
  ], []);

  const syncLiveOrderStatus = async (code) => {
    if (!code) return;
    setSyncingOrderId(code);
    try {
      const res = await uniwareApi.getLiveOrderStatus(code);
      if (res && res.success && res.order) {
        setOrders(prev => prev.map(o => {
          const orderId = o.saleOrderItemCode || o.saleOrderCode || o.displayorderCode || o.displayOrderCode;
          if (orderId === code) {
            return { ...o, saleOrderStatus: res.order.status };
          }
          return o;
        }));
      } else {
        alert(`Failed to sync status for order: ${code}`);
      }
    } catch (err) {
      alert(`Live sync error for order ${code}: ${err.message}`);
    } finally {
      setSyncingOrderId('');
    }
  };

  const pageRef = useRef(page);
  pageRef.current = page;
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    fetchOrders(false, 1);
    const interval = setInterval(() => fetchOrders(true, pageRef.current), 30000);
    return () => clearInterval(interval);
  }, [sortField, sortOrder, activeFilters, dateStart, dateEnd, searchQuery]);

  const fetchOrders = async (isSilent = false, targetPage = 1) => {
    if (!isSilent && orders.length === 0) setLoading(true);
    setError('');
    try {
      const effectivePage = targetPage;
      const statuses = activeFilters.status || [];
      const cities = activeFilters.city || [];
      const categories = activeFilters.category || [];

      const params = {
        page: effectivePage,
        limit: 25,
        sortField,
        sortOrder,
        itemSKUCode: searchQuery.trim() || undefined,
        shippingAddressCity: cities.length > 0 ? cities.join(',') : undefined,
        category: categories.length > 0 ? categories.join(',') : undefined,
        saleOrderStatus: statuses.length > 0 ? statuses.join(',') : undefined,
        dateStart: dateStart || undefined,
        endDate: dateEnd || undefined
      };

      const res = await api.getSales(params);
      if (res && res.data) {
        setOrders(res.data);
        if (res.meta) {
          setTotalPages(res.meta.totalPages || 1);
          setTotal(res.meta.totalRecords ?? res.totalRecords ?? res.data.length ?? 0);
        }
        setPage(targetPage);
        pageRef.current = targetPage;
      }
    } catch (err) {
      if (!isSilent) setError(err.message || 'Failed to fetch sales orders.');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loadingMoreRef.current || pageRef.current >= totalPages) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const nextPage = pageRef.current + 1;
      const statuses = activeFilters.status || [];
      const cities = activeFilters.city || [];
      const categories = activeFilters.category || [];

      const params = {
        page: nextPage,
        limit: 25,
        sortField,
        sortOrder,
        itemSKUCode: searchQuery.trim() || undefined,
        shippingAddressCity: cities.length > 0 ? cities.join(',') : undefined,
        category: categories.length > 0 ? categories.join(',') : undefined,
        saleOrderStatus: statuses.length > 0 ? statuses.join(',') : undefined,
        dateStart: dateStart || undefined,
        endDate: dateEnd || undefined
      };

      const res = await api.getSales(params);
      if (res && res.data && res.data.length > 0) {
        setOrders(prev => {
          const map = new Map();
          prev.forEach(o => map.set(o.id || o._id || o.saleOrderItemCode, o));
          res.data.forEach(o => map.set(o.id || o._id || o.saleOrderItemCode, o));
          return Array.from(map.values());
        });
        setPage(nextPage);
        pageRef.current = nextPage;
        if (res.meta?.totalPages) setTotalPages(res.meta.totalPages);
        if (res.meta?.totalRecords) setTotal(res.meta.totalRecords);
      }
    } catch (err) {
      console.warn('Failed to load more sales orders:', err);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setDatePreset('all');
    setDateStart('');
    setDateEnd('');
    setCustomDateStart('');
    setCustomDateEnd('');
    setActiveFilters({});
    setPage(1);
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => matchSearchQuery(order, searchQuery, ['itemSKUCode', 'shippingAddressCity', 'shippingAddressState', 'category', 'saleOrderStatus', 'saleOrderItemCode', 'saleOrderCode']));
  }, [orders, searchQuery]);

  return (
    <div className="glass-panel" style={styles.panel}>
      {/* ── Standard ERP Unified Filter Toolbar ── */}
      <ErpUnifiedFilterBar
        searchQuery={searchQuery}
        onSearchChange={(q) => { setSearchQuery(q); setPage(1); }}
        searchPlaceholder="Search SKU, Order Code, City..."
        
        datePreset={datePreset}
        onDateChange={({ preset: p, dateStart: ds, dateEnd: de }) => {
          setDatePreset(p);
          setDateStart(ds || '');
          setDateEnd(de || '');
          setPage(1);
        }}
        customDateStart={customDateStart}
        customDateEnd={customDateEnd}
        onCustomDateChange={(s, e) => {
          setCustomDateStart(s);
          setCustomDateEnd(e);
          setDateStart(s);
          setDateEnd(e);
          setPage(1);
        }}

        categories={salesFilterCategories}
        activeFilters={activeFilters}
        onFilterChange={(newFilters) => {
          setActiveFilters(newFilters);
          setPage(1);
        }}
        filterPlaceholder="Status / City / Category"
        showChips={true}
        onReset={handleClearAllFilters}
        rightContent={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
              <strong>{total}</strong> Orders
            </span>
            <button
              type="button"
              onClick={() => fetchOrders(false, 1)}
              className="btn-secondary"
              style={{ padding: '0.35rem 0.65rem', minHeight: '36px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}
              title="Refresh Sales"
            >
              <RefreshCw size={13} className={loading ? 'spin-loader' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {error && <div style={styles.error}>{error}</div>}

      {/* Grid Table with Smooth Touch Scroll */}
      <div className="table-responsive-wrapper" style={styles.tableWrap}>
        <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {loading && orders.length === 0 ? (
            <div style={styles.loadingBox}>
              <RefreshCw size={28} className="spin-loader" color="var(--primary)" />
              <p style={{ marginTop: '0.75rem', color: 'var(--text-muted)' }}>Loading sales orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div style={styles.emptyBox}>
              <ShoppingBag size={36} color="var(--text-muted)" />
              <h4 style={{ marginTop: '0.8rem', color: '#0f172a', fontWeight: 700 }}>No sales orders recorded</h4>
              <p style={{ fontSize: '0.82rem', color: '#64748b' }}>Check your search criteria or date filter selection.</p>
            </div>
          ) : (
            <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', background: '#ffffff' }}>
              <thead>
                <tr>
                  <MasterCheckboxTh
                    allSelected={filteredOrders.length > 0 && filteredOrders.every(o => !!selectedOrderMap[o.id || o._id || o.saleOrderItemCode])}
                    someSelected={filteredOrders.some(o => !!selectedOrderMap[o.id || o._id || o.saleOrderItemCode])}
                    onToggleAll={e => {
                      if (e.target.checked) {
                        setSelectedOrderMap(filteredOrders.reduce((acc, o) => {
                          const k = o.id || o._id || o.saleOrderItemCode;
                          if (k) acc[k] = true;
                          return acc;
                        }, {}));
                      } else {
                        setSelectedOrderMap({});
                      }
                    }}
                    totalCount={filteredOrders.length}
                  />
                  <ErpTh columnKey="orderDate" sortState={{ columnKey: sortField, order: sortOrder }} onSortChange={({ columnKey, order }) => { setSortField(columnKey); setSortOrder(order || 'asc'); }}>Order Date</ErpTh>
                  <ErpTh columnKey="itemSKUCode" sortState={{ columnKey: sortField, order: sortOrder }} onSortChange={({ columnKey, order }) => { setSortField(columnKey); setSortOrder(order || 'asc'); }}>SKU Code</ErpTh>
                  <ErpTh columnKey="category" sortState={{ columnKey: sortField, order: sortOrder }} onSortChange={({ columnKey, order }) => { setSortField(columnKey); setSortOrder(order || 'asc'); }}>Category</ErpTh>
                  <ErpTh columnKey="shippingAddressCity" sortState={{ columnKey: sortField, order: sortOrder }} onSortChange={({ columnKey, order }) => { setSortField(columnKey); setSortOrder(order || 'asc'); }}>Destination</ErpTh>
                  <ErpTh columnKey="totalPrice" sortState={{ columnKey: sortField, order: sortOrder }} onSortChange={({ columnKey, order }) => { setSortField(columnKey); setSortOrder(order || 'asc'); }} align="right">Price (₹)</ErpTh>
                  <ErpTh columnKey="discount" sortState={{ columnKey: sortField, order: sortOrder }} onSortChange={({ columnKey, order }) => { setSortField(columnKey); setSortOrder(order || 'asc'); }} align="right">Discount (₹)</ErpTh>
                  <ErpTh columnKey="itemSKUCodeCount" sortState={{ columnKey: sortField, order: sortOrder }} onSortChange={({ columnKey, order }) => { setSortField(columnKey); setSortOrder(order || 'asc'); }} align="center">Qty</ErpTh>
                  <ErpTh columnKey="saleOrderStatus" sortState={{ columnKey: sortField, order: sortOrder }} onSortChange={({ columnKey, order }) => { setSortField(columnKey); setSortOrder(order || 'asc'); }} align="center">Status</ErpTh>
                  <ErpTh hideSort align="center">Sync Live</ErpTh>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order, idx) => {
                  const orderKey = order.id || order._id || order.saleOrderItemCode || idx;
                  const isSelected = !!selectedOrderMap[orderKey];
                  const status = (order.saleOrderStatus || '').toUpperCase();
                  let statusBg = '#eff6ff';
                  let statusColor = '#1d4ed8';
                  let statusBorder = '#bfdbfe';

                  if (status === 'DELIVERED' || status === 'COMPLETE') {
                    statusBg = '#ecfdf5';
                    statusColor = '#065f46';
                    statusBorder = '#a7f3d0';
                  } else if (status === 'CANCELLED' || status === 'RETURNED') {
                    statusBg = '#fef2f2';
                    statusColor = '#991b1b';
                    statusBorder = '#fecaca';
                  } else if (status === 'SHIPPED' || status === 'IN_TRANSIT') {
                    statusBg = '#fffbeb';
                    statusColor = '#78350f';
                    statusBorder = '#fcd34d';
                  }
                  
                  return (
                    <tr key={orderKey} style={{ borderBottom: '1px solid #f1f5f9', background: getRowHighlightStyle(isSelected) }}>
                      <RowCheckboxTd
                        checked={isSelected}
                        onChange={e => {
                          setSelectedOrderMap(prev => {
                            const next = { ...prev };
                            if (e.target.checked) next[orderKey] = true;
                            else delete next[orderKey];
                            return next;
                          });
                        }}
                      />
                      <td style={{ color: '#334155', fontWeight: 600 }}>
                        {formatDateTimeDDMMYYYY(order.orderDate)}
                      </td>
                      <td>
                        <div style={styles.skuCell}>
                          <SmartThumbnail
                            src={order.productImage}
                            alt={order.itemSKUCode || 'SKU'}
                            title={order.itemSKUCode || 'Product'}
                            size="sm"
                            aspectRatio="1:1"
                            category="catalog"
                            metadata={{
                              SKU: order.itemSKUCode,
                              Category: order.category || 'N/A',
                              OrderNo: order.saleOrderCode || order.id || 'N/A',
                              City: order.shippingAddressCity || 'N/A'
                            }}
                          />
                          <span style={styles.skuText}>{order.itemSKUCode}</span>
                        </div>
                      </td>
                      <td style={{ color: '#475569' }}>{order.category || 'N/A'}</td>
                      <td>
                        <div style={styles.destCell}>
                          <div style={styles.cityText}>{order.shippingAddressCity || 'N/A'}</div>
                          <div style={styles.stateText}>{order.shippingAddressState || 'N/A'} {order.shippingAddressPincode}</div>
                        </div>
                      </td>
                      <td className="text-right" style={{ fontWeight: 700, color: '#0f172a' }}>
                        {order.totalPrice ? `₹${parseFloat(order.totalPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}
                      </td>
                      <td className="text-right" style={{ color: '#64748b' }}>
                        {order.discount ? `₹${parseFloat(order.discount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}
                      </td>
                      <td className="text-center">
                        <span style={styles.qtyBadge}>{order.itemSKUCodeCount || 1}</span>
                      </td>
                      <td className="text-center">
                        <span style={{
                          display: 'inline-block',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: statusBg,
                          color: statusColor,
                          border: `1px solid ${statusBorder}`,
                          whiteSpace: 'nowrap'
                        }}>
                          {order.saleOrderStatus || 'N/A'}
                        </span>
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          onClick={() => syncLiveOrderStatus(order.saleOrderItemCode || order.saleOrderCode || order.displayorderCode || order.displayOrderCode)}
                          disabled={!!syncingOrderId}
                          className="btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', height: '26px' }}
                        >
                          <RefreshCw size={12} className={syncingOrderId === (order.saleOrderItemCode || order.saleOrderCode) ? 'spin-loader' : ''} />
                          <span>Sync</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Infinite Scroll Trigger */}
      <InfiniteScrollPagination
        loading={loadingMore}
        hasMore={page < totalPages}
        onLoadMore={loadMore}
        totalRecords={total}
        loadedRecords={orders.length}
      />

      {/* Fallback pagination */}
      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button 
            type="button"
            disabled={page <= 1} 
            onClick={() => { const p = Math.max(1, page - 1); setPage(p); fetchOrders(false, p); }}
            className="btn-secondary"
            style={styles.pagBtn}
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <span style={styles.pageIndicator}>
            Page {page} of {totalPages} ({total} Orders)
          </span>
          <button 
            type="button"
            disabled={page >= totalPages} 
            onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); fetchOrders(false, p); }}
            className="btn-secondary"
            style={styles.pagBtn}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  panel: {
    padding: '1.25rem',
    background: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(15,23,42,0.04)'
  },
  tableWrap: {
    marginTop: '0.5rem',
    background: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    overflow: 'hidden'
  },
  loadingBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 1rem',
  },
  emptyBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 1rem',
    textAlign: 'center',
  },
  thSort: {
    cursor: 'pointer',
    userSelect: 'none',
    padding: '10px 14px',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  skuCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  skuText: {
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    color: '#0f172a',
    fontWeight: '700',
  },
  destCell: {
    display: 'flex',
    flexDirection: 'column',
  },
  cityText: {
    fontWeight: '600',
    color: '#0f172a',
    fontSize: '0.82rem'
  },
  stateText: {
    fontSize: '0.72rem',
    color: '#64748b',
    marginTop: '2px',
  },
  qtyBadge: {
    fontSize: '0.8rem',
    fontWeight: '700',
    color: '#1d4ed8',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    padding: '0.15rem 0.45rem',
    borderRadius: '6px',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '1rem',
    paddingTop: '1rem',
    borderTop: '1px solid #e2e8f0',
  },
  pagBtn: {
    padding: '0.4rem 0.8rem',
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  pageIndicator: {
    fontSize: '0.8rem',
    color: '#64748b',
    fontWeight: 600
  },
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '0.75rem',
    color: '#991b1b',
    fontSize: '0.82rem',
    marginBottom: '0.75rem',
    fontWeight: 600
  },
};
