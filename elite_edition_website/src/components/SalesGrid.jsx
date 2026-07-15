import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { uniwareApi } from '../services/uniware';
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal, RefreshCw, ShoppingBag } from 'lucide-react';

export default function SalesGrid() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncingOrderId, setSyncingOrderId] = useState('');
  const [error, setError] = useState('');
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(25);

  // Sorting State
  const [sortField, setSortField] = useState('orderDate');
  const [sortOrder, setSortOrder] = useState('desc');

  // Filter States
  const [skuSearch, setSkuSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const syncLiveOrderStatus = async (code) => {
    if (!code) return;
    setSyncingOrderId(code);
    try {
      const res = await uniwareApi.getLiveOrderStatus(code);
      if (res && res.success && res.order) {
        // Update local state
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

  // Debounced filters or search on trigger
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [page, sortField, sortOrder, statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        limit,
        sortField,
        sortOrder,
        itemSKUCode: skuSearch.trim() || undefined,
        shippingAddressCity: citySearch.trim() || undefined,
        saleOrderStatus: statusFilter === 'All' ? undefined : statusFilter,
      };

      const res = await api.getSales(params);
      if (res && res.data) {
        setOrders(res.data);
        if (res.meta) {
          setTotalPages(res.meta.totalPages || 1);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch sales orders.');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc'); // Default to desc for dates/counts
    }
    setPage(1);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  const handleClearFilters = () => {
    setSkuSearch('');
    setCitySearch('');
    setStatusFilter('All');
    setPage(1);
    // Fetch immediately
    setTimeout(() => fetchOrders(), 0);
  };

  return (
    <div className="glass-panel" style={styles.panel}>
      {/* Search Header Form */}
      <form onSubmit={handleSearchSubmit} style={styles.formHeader}>
        <div style={styles.filtersRow}>
          <div style={styles.searchBox}>
            <Search size={15} color="var(--text-muted)" style={styles.searchIcon} />
            <input
              type="text"
              value={skuSearch}
              onChange={(e) => setSkuSearch(e.target.value)}
              placeholder="Search SKU..."
              style={styles.searchInput}
            />
          </div>

          <div style={styles.searchBox}>
            <Search size={15} color="var(--text-muted)" style={styles.searchIcon} />
            <input
              type="text"
              value={citySearch}
              onChange={(e) => setCitySearch(e.target.value)}
              placeholder="Search City..."
              style={styles.searchInput}
            />
          </div>

          <div style={styles.filterSelectWrap}>
            <SlidersHorizontal size={13} color="var(--text-muted)" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              style={styles.selectInput}
            >
              <option value="All">All Statuses</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="RETURNED">Returned</option>
              <option value="SHIPPED">Shipped</option>
              <option value="IN_TRANSIT">In Transit</option>
            </select>
          </div>

          <div style={styles.btnRow}>
            <button type="submit" className="btn-primary" style={styles.actionBtn}>
              Search
            </button>
            <button 
              type="button" 
              onClick={handleClearFilters} 
              className="btn-secondary" 
              style={styles.actionBtn}
            >
              Reset
            </button>
          </div>
        </div>
      </form>

      {error && <div style={styles.error}>{error}</div>}

      {/* Grid Table */}
      <div className="table-container" style={styles.tableWrap}>
        {loading ? (
          <div style={styles.loadingBox}>
            <RefreshCw size={28} className="spin-loader" color="var(--primary)" />
            <p style={{ marginTop: '0.75rem', color: 'var(--text-muted)' }}>Loading sales orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div style={styles.emptyBox}>
            <ShoppingBag size={36} color="var(--text-muted)" />
            <h4 style={{ marginTop: '0.8rem', color: 'var(--text-primary)' }}>No sales orders recorded</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Check your search criteria or server connection.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('orderDate')} style={styles.thSort}>
                  Order Date {sortField === 'orderDate' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => handleSort('itemSKUCode')} style={styles.thSort}>
                  SKU Code {sortField === 'itemSKUCode' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th>Category</th>
                <th>Destination</th>
                <th onClick={() => handleSort('totalPrice')} style={styles.thSort} className="text-right">
                  Price {sortField === 'totalPrice' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => handleSort('discount')} style={styles.thSort} className="text-right">
                  Discount {sortField === 'discount' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => handleSort('itemSKUCodeCount')} style={styles.thSort} className="text-center">
                  Qty {sortField === 'itemSKUCodeCount' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="text-center">Status</th>
                <th className="text-center">Sync Live</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, idx) => {
                const status = (order.saleOrderStatus || '').toUpperCase();
                let statusClass = 'badge-warning';
                if (status === 'DELIVERED') statusClass = 'badge-success';
                if (status === 'CANCELLED' || status === 'RETURNED') statusClass = 'badge-danger';
                
                return (
                  <tr key={order.id || idx}>
                    <td>
                      {order.orderDate ? new Date(order.orderDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'N/A'}
                    </td>
                    <td>
                      <div style={styles.skuCell}>
                        {order.productImage ? (
                          <img 
                            src={order.productImage} 
                            alt={order.itemSKUCode} 
                            style={styles.productThumbnail}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : null}
                        <span style={styles.skuText}>{order.itemSKUCode}</span>
                      </div>
                    </td>
                    <td>{order.category || 'N/A'}</td>
                    <td>
                      <div style={styles.destCell}>
                        <div style={styles.cityText}>{order.shippingAddressCity || 'N/A'}</div>
                        <div style={styles.stateText}>{order.shippingAddressState || 'N/A'} {order.shippingAddressPincode}</div>
                      </div>
                    </td>
                    <td className="text-right">
                      {order.totalPrice ? `Rs. ${parseFloat(order.totalPrice).toFixed(2)}` : 'Rs. 0.00'}
                    </td>
                    <td className="text-right">
                      {order.discount ? `Rs. ${parseFloat(order.discount).toFixed(2)}` : 'Rs. 0.00'}
                    </td>
                    <td className="text-center">
                      <span style={styles.qtyBadge}>{order.itemSKUCodeCount || 1}</span>
                    </td>
                    <td className="text-center">
                      <span className={`badge ${statusClass}`}>{order.saleOrderStatus || 'N/A'}</span>
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        onClick={() => syncLiveOrderStatus(order.saleOrderItemCode || order.saleOrderCode || order.displayorderCode || order.displayOrderCode)}
                        disabled={!!syncingOrderId}
                        className="btn-secondary"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', height: '24px' }}
                      >
                        <RefreshCw size={11} className={syncingOrderId === (order.saleOrderItemCode || order.saleOrderCode || order.displayorderCode || order.displayOrderCode) ? 'spin-loader' : ''} />
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

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="btn-secondary"
            style={styles.pagBtn}
          >
            <ChevronLeft size={16} />
            Prev
          </button>
          
          <span style={styles.pageIndicator}>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>
          </span>
          
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
            className="btn-secondary"
            style={styles.pagBtn}
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  panel: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.2rem',
    minHeight: '450px',
  },
  formHeader: {
    width: '100%',
  },
  filtersRow: {
    display: 'flex',
    gap: '0.8rem',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  searchBox: {
    position: 'relative',
    flex: 1,
    minWidth: '160px',
    maxWidth: '280px',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: '0.75rem',
  },
  searchInput: {
    width: '100%',
    paddingLeft: '2.2rem',
    paddingTop: '0.5rem',
    paddingBottom: '0.5rem',
  },
  filterSelectWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'rgba(17, 24, 39, 0.6)',
    border: '1px solid var(--border-light)',
    padding: '0 0.5rem',
    borderRadius: 'var(--radius-sm)',
  },
  selectInput: {
    border: 'none',
    background: 'none',
    padding: '0.5rem 0.5rem',
    fontSize: '0.85rem',
    color: '#e5e7eb',
    outline: 'none',
    cursor: 'pointer',
  },
  btnRow: {
    display: 'flex',
    gap: '0.5rem',
  },
  actionBtn: {
    padding: '0.5rem 1rem',
    fontSize: '0.8rem',
  },
  tableWrap: {
    flex: 1,
    position: 'relative',
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
  },
  skuCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  productThumbnail: {
    width: '28px',
    height: '28px',
    borderRadius: '4px',
    objectFit: 'cover',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-light)',
  },
  skuText: {
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    color: 'var(--text-primary)',
    fontWeight: '600',
  },
  destCell: {
    display: 'flex',
    flexDirection: 'column',
  },
  cityText: {
    fontWeight: '500',
    color: 'var(--text-primary)',
  },
  stateText: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  qtyBadge: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--primary)',
    background: 'rgba(6, 182, 212, 0.1)',
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '1rem',
    paddingTop: '1rem',
    borderTop: '1px solid var(--border-light)',
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
    color: 'var(--text-muted)',
  },
  error: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.75rem',
    color: '#fca5a5',
    fontSize: '0.8rem',
  },
};
