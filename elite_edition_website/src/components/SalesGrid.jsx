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
import EntityBrandBadge from './common/EntityBrandBadge';
import QuickActionMenu from './common/QuickActionMenu';
import { extractApiProductImage } from '../utils/imageUrlHelper';

export default function SalesGrid() {
  const [orders, setOrders] = useState([]);
  const [serverSummary, setServerSummary] = useState(null);
  const [tabCounts, setTabCounts] = useState(null);
  const [selectedOrderMap, setSelectedOrderMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncingOrderId, setSyncingOrderId] = useState('');
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [activeStatusTab, setActiveStatusTab] = useState('ALL');
  
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
  }, [sortField, sortOrder, activeFilters, dateStart, dateEnd, searchQuery, activeStatusTab]);

  const resolveStatusParam = () => {
    const statuses = activeFilters.status || [];
    if (statuses.length > 0) return statuses.join(',');
    if (activeStatusTab === 'DELIVERED') return 'DELIVERED,COMPLETE';
    if (activeStatusTab === 'IN_TRANSIT') return 'SHIPPED,IN_TRANSIT,PROCESSING';
    if (activeStatusTab === 'CANCELLED') return 'CANCELLED,RETURNED';
    return undefined;
  };

  const fetchOrders = async (isSilent = false, targetPage = 1) => {
    if (!isSilent) setLoading(true);
    setError('');
    try {
      const effectivePage = targetPage;
      const cities = activeFilters.city || [];
      const categories = activeFilters.category || [];

      const params = {
        page: effectivePage,
        limit: 25,
        groupBy: 'order',
        sortField: sortField === 'itemSKUCodeCount' ? 'saleCount' : sortField,
        sortOrder,
        itemSKUCode: searchQuery.trim() || undefined,
        shippingAddressCity: cities.length > 0 ? cities.join(',') : undefined,
        category: categories.length > 0 ? categories.join(',') : undefined,
        saleOrderStatus: resolveStatusParam(),
        dateStart: dateStart || undefined,
        endDate: dateEnd || undefined
      };

      const res = await api.getSales(params);
      if (res && res.data) {
        setOrders(res.data);
        const resTotalPages = res.meta?.totalPages ?? res.totalPages ?? 1;
        const resTotal = res.meta?.totalRecords ?? res.totalRecords ?? res.data.length ?? 0;
        const resSummary = res.meta?.summary ?? res.summary ?? null;
        setTotalPages(resTotalPages);
        setTotal(resTotal);
        if (resSummary) {
          setServerSummary(resSummary);
          if (activeStatusTab === 'ALL') {
            setTabCounts({
              all: resTotal,
              delivered: resSummary.deliveredCount ?? 0,
              transit: resSummary.transitCount ?? 0,
              cancelled: resSummary.cancelledCount ?? 0
            });
          }
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
      const cities = activeFilters.city || [];
      const categories = activeFilters.category || [];

      const params = {
        page: nextPage,
        limit: 25,
        groupBy: 'order',
        sortField: sortField === 'itemSKUCodeCount' ? 'saleCount' : sortField,
        sortOrder,
        itemSKUCode: searchQuery.trim() || undefined,
        shippingAddressCity: cities.length > 0 ? cities.join(',') : undefined,
        category: categories.length > 0 ? categories.join(',') : undefined,
        saleOrderStatus: resolveStatusParam(),
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
    return orders.filter(order => {
      if (activeStatusTab !== 'ALL') {
        const st = (order.saleOrderStatus || '').toUpperCase();
        if (activeStatusTab === 'DELIVERED' && st !== 'DELIVERED' && st !== 'COMPLETE') return false;
        if (activeStatusTab === 'IN_TRANSIT' && st !== 'SHIPPED' && st !== 'IN_TRANSIT' && st !== 'PROCESSING') return false;
        if (activeStatusTab === 'CANCELLED' && st !== 'CANCELLED' && st !== 'RETURNED') return false;
      }
      return matchSearchQuery(order, searchQuery, ['itemSKUCode', 'shippingAddressCity', 'shippingAddressState', 'category', 'saleOrderStatus', 'saleOrderItemCode', 'saleOrderCode']);
    });
  }, [orders, searchQuery, activeStatusTab]);

  const calcStats = useMemo(() => {
    const localRevenue = filteredOrders.reduce((s, o) => s + (parseFloat(o.totalPrice) || 0), 0);
    const localUnits = filteredOrders.reduce((s, o) => s + (parseInt(o.itemSKUCodeCount, 10) || 1), 0);
    const localDelivered = filteredOrders.filter(o => ['DELIVERED', 'COMPLETE'].includes((o.saleOrderStatus || '').toUpperCase())).length;
    const localTransit = filteredOrders.filter(o => ['SHIPPED', 'IN_TRANSIT', 'PROCESSING'].includes((o.saleOrderStatus || '').toUpperCase())).length;

    return {
      totalOrders: total || serverSummary?.totalOrders || filteredOrders.length,
      totalRevenue: serverSummary ? Number(serverSummary.totalRevenue || 0) : localRevenue,
      totalUnits: serverSummary ? Number(serverSummary.totalUnits || 0) : localUnits,
      deliveredCount: serverSummary ? Number(serverSummary.deliveredCount || 0) : localDelivered,
      transitCount: serverSummary ? Number(serverSummary.transitCount || 0) : localTransit,
      cancelledCount: serverSummary ? Number(serverSummary.cancelledCount || 0) : 0
    };
  }, [filteredOrders, serverSummary, total]);

  const isInitialLoading = loading && orders.length === 0;

  return (
    <div style={styles.panel}>
      {/* TIER 1: GLASS SCREEN HEADER */}
      <div className="glass-screen-header">
        <div className="glass-title-capsule">
          <span className="glass-title-icon">🛍️</span>
          <h1>Sales Orders Register</h1>
          <EntityBrandBadge entityCode="EE" size="sm" />
        </div>
        <div className="glass-header-actions">
          <QuickActionMenu
            actions={[
              { label: 'Refresh Live Orders', icon: '🔄', onClick: () => fetchOrders(false, 1) },
              { label: 'Reset All Filters', icon: '🧹', onClick: handleClearAllFilters },
            ]}
          />
        </div>
      </div>

      {/* TIER 2: SUB-SCREEN BUTTONS */}
      <div className="glass-subtabs-bar" data-screen-subtabs="primary" role="tablist">
        {[
          { id: 'ALL', label: `All Orders (${isInitialLoading ? '...' : (tabCounts?.all ?? calcStats.totalOrders)})` },
          { id: 'DELIVERED', label: `Delivered & Complete (${isInitialLoading ? '...' : (tabCounts?.delivered ?? calcStats.deliveredCount)})` },
          { id: 'IN_TRANSIT', label: `Shipped & In Transit (${isInitialLoading ? '...' : (tabCounts?.transit ?? calcStats.transitCount)})` },
          { id: 'CANCELLED', label: `Cancelled / Returned${!isInitialLoading && (tabCounts?.cancelled ?? calcStats.cancelledCount) ? ` (${tabCounts?.cancelled ?? calcStats.cancelledCount})` : ''}` },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => { setActiveStatusTab(tab.id); setPage(1); }}
            className={`glass-subtab-btn ${activeStatusTab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TIER 3: SIDE-SCROLLING CALCULATION CARDS */}
      <div className="glass-scroll-track">
        <div className="glass-calc-card">
          <span className="glass-calc-title">TOTAL ORDERS</span>
          <span className="glass-calc-value">{isInitialLoading ? '...' : calcStats.totalOrders.toLocaleString('en-IN')}</span>
          <span className="glass-calc-sub">{isInitialLoading ? 'Loading orders...' : `${filteredOrders.length} shown on page`}</span>
        </div>
        <div className="glass-calc-card">
          <span className="glass-calc-title">GROSS ORDER VALUE</span>
          <span className="glass-calc-value" style={{ color: '#34d399' }}>
            {isInitialLoading ? '...' : `₹${calcStats.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          </span>
          <span className="glass-calc-sub">{isInitialLoading ? 'Calculating...' : `${calcStats.totalUnits.toLocaleString('en-IN')} total units`}</span>
        </div>
        <div className="glass-calc-card">
          <span className="glass-calc-title">DELIVERED ORDERS</span>
          <span className="glass-calc-value" style={{ color: '#38bdf8' }}>{isInitialLoading ? '...' : calcStats.deliveredCount.toLocaleString('en-IN')}</span>
          <span className="glass-calc-sub">Completed fulfillment</span>
        </div>
        <div className="glass-calc-card">
          <span className="glass-calc-title">IN TRANSIT / SHIPPED</span>
          <span className="glass-calc-value" style={{ color: '#fbbf24' }}>{isInitialLoading ? '...' : calcStats.transitCount.toLocaleString('en-IN')}</span>
          <span className="glass-calc-sub">Active logistics dispatch</span>
        </div>
      </div>

      {/* TIER 4: UNIFIED FILTER BAR WITH TABLE/CARD VIEW TOGGLE */}
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
            <div className="glass-view-toggle">
              <button
                type="button"
                className={`glass-view-btn ${viewMode === 'card' ? 'active' : ''}`}
                onClick={() => setViewMode('card')}
              >
                🎴 Cards
              </button>
              <button
                type="button"
                className={`glass-view-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
              >
                📄 Table
              </button>
            </div>
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

      {/* TIER 5: DUAL-MODE CONTENT (CARDS OR TABLE) */}
      {viewMode === 'card' ? (
        loading && orders.length === 0 ? (
          <div style={styles.loadingBox}>
            <RefreshCw size={28} className="spin-loader" color="#38bdf8" />
            <p style={{ marginTop: '0.75rem', color: 'rgba(255,255,255,0.72)' }}>Loading sales orders...</p>
          </div>
        ) : (
        <div className="glass-cards-grid">
          {filteredOrders.map((order, idx) => {
            const orderKey = order.id || order._id || order.saleOrderItemCode || idx;
            return (
              <div key={orderKey} className="glass-data-card">
                <div className="glass-card-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <SmartThumbnail
                      src={extractApiProductImage(order)}
                      sku={order.itemSKUCode}
                      alt={order.itemSKUCode || 'SKU'}
                      title={order.skuName || order.itemSKUCode || 'Product'}
                      size="md"
                      aspectRatio="1:1"
                      category="catalog"
                    />
                    <div style={{ minWidth: 0 }}>
                      <div className="glass-card-id">{order.saleOrderCode || order.saleOrderItemCode || 'ORDER'}</div>
                      <div className="glass-card-title">{order.itemSKUCode || 'SKU'}</div>
                    </div>
                  </div>
                  <span style={styles.qtyBadge}>{order.saleOrderStatus || 'ACTIVE'}</span>
                </div>
                <div className="glass-card-metrics">
                  <div className="glass-metric-box">
                    <span className="glass-metric-label">PRICE</span>
                    <span className="glass-metric-val">
                      ₹{parseFloat(order.totalPrice || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="glass-metric-box">
                    <span className="glass-metric-label">DESTINATION</span>
                    <span className="glass-metric-val">{order.shippingAddressCity || 'N/A'}</span>
                  </div>
                </div>
                <div className="glass-card-footer">
                  <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)' }}>
                    {formatDateTimeDDMMYYYY(order.orderDate)}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8' }}>
                    Qty: {order.itemSKUCodeCount || 1}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        )
      ) : (
        <div className="table-responsive-wrapper" style={styles.tableWrap}>
          <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {loading && orders.length === 0 ? (
              <div style={styles.loadingBox}>
                <RefreshCw size={28} className="spin-loader" color="#38bdf8" />
                <p style={{ marginTop: '0.75rem', color: 'rgba(255,255,255,0.72)' }}>Loading sales orders...</p>
              </div>
            ) : orders.length === 0 ? (
              <div style={styles.emptyBox}>
                <ShoppingBag size={36} color="rgba(255,255,255,0.5)" />
                <h4 style={{ marginTop: '0.8rem', color: '#ffffff', fontWeight: 700 }}>No sales orders recorded</h4>
                <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)' }}>Check your search criteria or date filter selection.</p>
              </div>
            ) : (
              <table className="glass-table" style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse' }}>
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
                    let statusBg = 'rgba(56, 189, 248, 0.16)';
                    let statusColor = '#38bdf8';
                    let statusBorder = 'rgba(56, 189, 248, 0.35)';

                    if (status === 'DELIVERED' || status === 'COMPLETE') {
                      statusBg = 'rgba(16, 185, 129, 0.16)';
                      statusColor = '#34d399';
                      statusBorder = 'rgba(16, 185, 129, 0.35)';
                    } else if (status === 'CANCELLED' || status === 'RETURNED') {
                      statusBg = 'rgba(239, 68, 68, 0.16)';
                      statusColor = '#f87171';
                      statusBorder = 'rgba(239, 68, 68, 0.35)';
                    } else if (status === 'SHIPPED' || status === 'IN_TRANSIT') {
                      statusBg = 'rgba(245, 158, 11, 0.16)';
                      statusColor = '#fbbf24';
                      statusBorder = 'rgba(245, 158, 11, 0.35)';
                    }
                    
                    return (
                      <tr key={orderKey} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: getRowHighlightStyle(isSelected) }}>
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
                        <td style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                          {formatDateTimeDDMMYYYY(order.orderDate)}
                        </td>
                        <td>
                          <div style={styles.skuCell}>
                            <SmartThumbnail
                              src={extractApiProductImage(order)}
                              sku={order.itemSKUCode}
                              alt={order.itemSKUCode || 'SKU'}
                              title={order.skuName || order.itemSKUCode || 'Product'}
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
                        <td style={{ color: 'rgba(255,255,255,0.75)' }}>{order.category || 'N/A'}</td>
                        <td>
                          <div style={styles.destCell}>
                            <div style={styles.cityText}>{order.shippingAddressCity || 'N/A'}</div>
                            <div style={styles.stateText}>{order.shippingAddressState || 'N/A'} {order.shippingAddressPincode}</div>
                          </div>
                        </td>
                        <td className="text-right" style={{ fontWeight: 700, color: '#34d399' }}>
                          {order.totalPrice ? `₹${parseFloat(order.totalPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}
                        </td>
                        <td className="text-right" style={{ color: 'rgba(255,255,255,0.65)' }}>
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
      )}

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
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  tableWrap: {
    marginTop: '0.25rem',
    background: 'rgba(15, 23, 42, 0.72)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: '14px',
    border: '1px solid rgba(255, 255, 255, 0.14)',
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
    color: 'rgba(255, 255, 255, 0.78)',
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
    color: '#38bdf8',
    fontWeight: '700',
  },
  destCell: {
    display: 'flex',
    flexDirection: 'column',
  },
  cityText: {
    fontWeight: '600',
    color: '#ffffff',
    fontSize: '0.82rem'
  },
  stateText: {
    fontSize: '0.72rem',
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: '2px',
  },
  qtyBadge: {
    fontSize: '0.8rem',
    fontWeight: '700',
    color: '#38bdf8',
    background: 'rgba(56, 189, 248, 0.16)',
    border: '1px solid rgba(56, 189, 248, 0.35)',
    padding: '0.15rem 0.45rem',
    borderRadius: '6px',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '1rem',
    paddingTop: '1rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.12)',
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
    color: 'rgba(255, 255, 255, 0.72)',
    fontWeight: 600
  },
  error: {
    background: 'rgba(239, 68, 68, 0.16)',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    borderRadius: '8px',
    padding: '0.75rem',
    color: '#f87171',
    fontSize: '0.82rem',
    marginBottom: '0.75rem',
    fontWeight: 600
  },
};
