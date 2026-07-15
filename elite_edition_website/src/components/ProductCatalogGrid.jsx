import React, { useState } from 'react';
import { Edit2, Trash2, Search, Plus, SlidersHorizontal, RefreshCw, Eye, Tag, MoreVertical } from 'lucide-react';

export default function ProductCatalogGrid({ items, onEdit, onDelete, onAdd, onSync }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sizeFilter, setSizeFilter] = useState('All');
  const [sortField, setSortField] = useState('description');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
  const [syncing, setSyncing] = useState(false);

  // Get unique sizes for the filter dropdown
  const sizes = ['All', ...new Set(items.flatMap(item => item.size || []).filter(Boolean))];

  // Handle Sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filter & Search Logic
  const filteredItems = items
    .filter(item => {
      const matchSearch = 
        (item.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.brand || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.skuCode || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchSize = sizeFilter === 'All' || (item.size && item.size.includes(sizeFilter));
      
      return matchSearch && matchSize;
    })
    .sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  const handleSyncTrigger = async () => {
    setSyncing(true);
    try {
      await onSync();
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="glass-panel" style={styles.gridPanel}>
      {/* Control Header */}
      <div style={styles.controlHeader}>
        <div style={styles.leftControls}>
          <div style={styles.searchBox}>
            <Search size={16} color="var(--text-muted)" style={styles.searchIcon} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search catalog by SKU, name, or brand..."
              style={styles.searchInput}
            />
          </div>

          <div style={styles.filterBox}>
            <SlidersHorizontal size={14} color="var(--text-muted)" />
            <select
              value={sizeFilter}
              onChange={(e) => setSizeFilter(e.target.value)}
              style={styles.selectInput}
            >
              {sizes.map((s, idx) => (
                <option key={idx} value={s}>{s === 'All' ? 'All Sizes' : `Size ${s}`}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            onClick={handleSyncTrigger} 
            disabled={syncing} 
            className="btn-secondary" 
            style={{ ...styles.addBtn, background: 'rgba(6, 182, 212, 0.1)', color: 'var(--primary)', borderColor: 'rgba(6, 182, 212, 0.2)' }}
          >
            <RefreshCw size={16} className={syncing ? 'spin-loader' : ''} />
            <span>Sync Catalog</span>
          </button>
          <button onClick={onAdd} className="btn-success" style={styles.addBtn}>
            <Plus size={16} />
            Add Product
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="table-container" style={styles.tableWrap}>
        {filteredItems.length === 0 ? (
          <div style={styles.emptyTable}>
            <span style={{ fontSize: '2.5rem' }}>🔍</span>
            <h4 style={{ marginTop: '0.8rem', color: 'var(--text-primary)' }}>No catalog products found</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Try adjusting your search terms or filters.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('description')} style={styles.thSort}>
                  Product Details {sortField === 'description' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => handleSort('skuCode')} style={styles.thSort}>
                  SKU Code {sortField === 'skuCode' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => handleSort('brand')} style={styles.thSort}>
                  Brand {sortField === 'brand' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th>Sizes</th>
                <th onClick={() => handleSort('basePrice')} style={styles.thSort} className="text-right">
                  Base Price {sortField === 'basePrice' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => handleSort('price')} style={styles.thSort} className="text-right">
                  Price {sortField === 'price' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="text-center">Live Stock</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                // Determine snapshot stock if available
                const snapStock = item.inventorySnapshots?.inventory;
                const hasSnapshot = snapStock !== undefined && snapStock !== null;
                
                let stockClass = 'badge-success';
                let stockLabel = hasSnapshot ? `${snapStock} in stock` : 'No Live Sync';
                if (hasSnapshot && snapStock === 0) {
                  stockClass = 'badge-danger';
                  stockLabel = 'Out of Stock';
                } else if (hasSnapshot && snapStock <= 5) {
                  stockClass = 'badge-warning';
                  stockLabel = `Low (${snapStock})`;
                }

                return (
                  <tr key={item._id}>
                    <td>
                      <div style={styles.itemCell}>
                        <div style={styles.itemImgWrapper}>
                          {item.imageUrl ? (
                            <img 
                              src={item.imageUrl} 
                              alt={item.description} 
                              style={styles.itemImg}
                              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                            />
                          ) : null}
                          <div style={{ ...styles.imgPlaceholder, display: item.imageUrl ? 'none' : 'flex' }}>
                            {item.description ? item.description[0].toUpperCase() : 'P'}
                          </div>
                        </div>
                        <div>
                          <div style={styles.itemName}>{item.description || 'Unnamed Product'}</div>
                          <div style={styles.itemMeta}>Category: {item.categoryName || 'General'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={styles.skuText}>{item.skuCode || 'N/A'}</span>
                    </td>
                    <td>{item.brand || 'Uniware'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                        {Array.isArray(item.size) ? (
                          item.size.map((sz, i) => (
                            <span key={i} style={styles.sizeBadge}>{sz}</span>
                          ))
                        ) : item.size ? (
                          <span style={styles.sizeBadge}>{item.size}</span>
                        ) : (
                          <span style={styles.sizeBadge}>N/A</span>
                        )}
                      </div>
                    </td>
                    <td className="text-right">
                      {item.basePrice ? `Rs. ${item.basePrice.toFixed(2)}` : 'Rs. 0.00'}
                    </td>
                    <td className="text-right">
                      {item.price ? `Rs. ${item.price.toFixed(2)}` : 'Rs. 0.00'}
                    </td>
                    <td className="text-center">
                      <span className={`badge ${hasSnapshot ? stockClass : 'badge-secondary'}`}>{stockLabel}</span>
                    </td>
                    <td>
                      <div style={styles.actionsCell}>
                        <button
                          onClick={() => onEdit(item)}
                          className="btn-icon"
                          title="Edit Product Details"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => onDelete(item._id)}
                          className="btn-icon"
                          style={styles.trashBtn}
                          title="Delete Product"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const styles = {
  gridPanel: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.2rem',
    minHeight: '450px',
  },
  controlHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  leftControls: {
    display: 'flex',
    gap: '0.8rem',
    flexWrap: 'wrap',
    flex: 1,
  },
  searchBox: {
    position: 'relative',
    flex: 1,
    minWidth: '240px',
    maxWidth: '400px',
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
  },
  filterBox: {
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
    padding: '0.6rem 0.5rem',
    fontSize: '0.85rem',
    color: '#e5e7eb',
    outline: 'none',
    cursor: 'pointer',
  },
  addBtn: {
    padding: '0.6rem 1.2rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  tableWrap: {
    flex: 1,
  },
  emptyTable: {
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
  itemCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  itemImgWrapper: {
    width: '38px',
    height: '38px',
    borderRadius: '8px',
    overflow: 'hidden',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-light)',
    flexShrink: 0,
    position: 'relative',
  },
  itemImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  imgPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--primary)',
    background: 'rgba(6, 182, 212, 0.1)',
  },
  itemName: {
    fontWeight: '500',
    color: 'var(--text-primary)',
  },
  itemMeta: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  skuText: {
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    color: 'var(--primary)',
    background: 'rgba(6, 182, 212, 0.05)',
    padding: '0.15rem 0.4rem',
    borderRadius: '4px',
    border: '1px solid rgba(6, 182, 212, 0.1)',
  },
  sizeBadge: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    background: 'rgba(255, 255, 255, 0.06)',
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
    border: '1px solid var(--border-light)',
  },
  actionsCell: {
    display: 'flex',
    gap: '0.4rem',
    justifyContent: 'center',
  },
  trashBtn: {
    color: '#fca5a5',
    borderColor: 'rgba(239, 68, 68, 0.1)',
  },
};
