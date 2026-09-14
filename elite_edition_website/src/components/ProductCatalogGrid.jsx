import React, { useState, useEffect, useRef } from 'react';
import { Edit2, Trash2, Search, Plus, SlidersHorizontal, RefreshCw, Eye, Tag, Printer, Building2 } from 'lucide-react';
import BrandManagerModal from './BrandManagerModal';
import { matchSearchQuery } from '../utils/searchUtils';

export default function ProductCatalogGrid({ items, onEdit, onDelete, onAdd, onSync, onOpenManager }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sizeFilter, setSizeFilter] = useState('All');
  const [brandFilter, setBrandFilter] = useState('All');
  const [sortField, setSortField] = useState('description');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
  const [syncing, setSyncing] = useState(false);
  const [showBrandManager, setShowBrandManager] = useState(false);
  const savedBrandManagerScrollRef = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!showBrandManager) {
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        if (y > 0) {
          savedBrandManagerScrollRef.current = y;
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showBrandManager]);

  const handleOpenBrandManager = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    savedBrandManagerScrollRef.current = window.scrollY || document.documentElement.scrollTop || 0;
    setShowBrandManager(true);
  };

  const handleCloseBrandManager = () => {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    const targetY = savedBrandManagerScrollRef.current || 0;
    setShowBrandManager(false);
    
    const doScroll = () => {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: targetY, behavior: 'instant' });
      }
    };

    doScroll();
    requestAnimationFrame(doScroll);
    setTimeout(doScroll, 30);
    setTimeout(doScroll, 100);
    setTimeout(doScroll, 300);
  };

  // Managed custom brands in localStorage + Event Listener for real-time updates from Manage Brands
  const [customBrands, setCustomBrands] = useState(() => {
    try {
      const saved = localStorage.getItem('elite_managed_brands');
      return saved ? JSON.parse(saved) : ['ANOUK', 'ELITE EDITION', 'HERA', 'MYNTRA'];
    } catch (err) {
      return ['ANOUK', 'ELITE EDITION', 'HERA', 'MYNTRA'];
    }
  });

  useEffect(() => {
    const handleBrandsUpdated = () => {
      try {
        const saved = localStorage.getItem('elite_managed_brands');
        if (saved) setCustomBrands(JSON.parse(saved));
      } catch (e) {}
    };

    window.addEventListener('storage', handleBrandsUpdated);
    window.addEventListener('elite_brands_updated', handleBrandsUpdated);
    return () => {
      window.removeEventListener('storage', handleBrandsUpdated);
      window.removeEventListener('elite_brands_updated', handleBrandsUpdated);
    };
  }, []);

  const handleAddBrand = (brandName) => {
    const updated = [...customBrands, brandName];
    setCustomBrands(updated);
    try {
      localStorage.setItem('elite_managed_brands', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('elite_brands_updated', { detail: updated }));
    } catch (e) {}
  };

  const handleDeleteBrand = (brandName) => {
    const updated = customBrands.filter(b => b.toLowerCase() !== brandName.toLowerCase());
    setCustomBrands(updated);
    try {
      localStorage.setItem('elite_managed_brands', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('elite_brands_updated', { detail: updated }));
    } catch (e) {}
  };

  // Extract unique brands from catalog items + brandCodes + custom managed brands
  const catalogBrandSet = new Set();
  (items || []).forEach(item => {
    if (item.brand && typeof item.brand === 'string') catalogBrandSet.add(item.brand.trim());
    if (Array.isArray(item.brandCodes)) {
      item.brandCodes.forEach(bc => {
        const b = typeof bc === 'object' ? bc.brand : bc;
        if (b && typeof b === 'string') catalogBrandSet.add(b.trim());
      });
    }
  });
  (customBrands || []).forEach(b => {
    if (b && typeof b === 'string') catalogBrandSet.add(b.trim());
  });

  const sortedCatalogBrands = Array.from(catalogBrandSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  const allBrands = ['All', ...sortedCatalogBrands];

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
      const matchSearch = matchSearchQuery(item, searchTerm, ['description', 'brand', 'skuCode', 'categoryName', 'color', 'size']);
      
      const matchSize = sizeFilter === 'All' || (item.size && item.size.includes(sizeFilter));
      
      const matchBrand = brandFilter === 'All' || 
        (item.brand && item.brand.trim().toLowerCase() === brandFilter.trim().toLowerCase()) ||
        (Array.isArray(item.brandCodes) && item.brandCodes.some(bc => {
          const bName = typeof bc === 'object' ? bc.brand : bc;
          return bName && bName.trim().toLowerCase() === brandFilter.trim().toLowerCase();
        }));

      return matchSearch && matchSize && matchBrand;
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

  // Thermal Barcode Label Printing with All Product Details & Images
  const handlePrintBarcodes = (targetItems) => {
    const printList = Array.isArray(targetItems) ? targetItems : [targetItems];
    if (printList.length === 0) {
      alert("No products available to print barcodes.");
      return;
    }

    const countStr = window.prompt(
      `Print Barcode Labels:\nHow many copies per product sticker?`,
      "1"
    );
    if (countStr === null) return;

    const count = parseInt(countStr, 10);
    if (isNaN(count) || count <= 0) {
      alert("Please enter a valid positive number.");
      return;
    }

    const printWindow = window.open('', '_blank', 'width=950,height=750');
    let stickersHtml = '';
    let barcodeScripts = '';
    let barcodeCounter = 0;

    printList.forEach((item) => {
      const sku = item.skuCode || 'NO-SKU';
      const name = item.description || 'Unnamed Product';
      const category = item.categoryName || 'General';
      const brand = item.brand || 'ANOUK';
      const size = Array.isArray(item.size) ? (item.size[0] || 'N/A') : (item.size || 'N/A');
      const price = item.price ? `Rs. ${item.price.toFixed(2)}` : (item.basePrice ? `Rs. ${item.basePrice.toFixed(2)}` : 'Rs. 0.00');
      const imgUrl = item.imageUrl || '';

      for (let c = 0; c < count; c++) {
        const barcodeId = `barcode_${barcodeCounter}`;
        barcodeCounter++;

        stickersHtml += `
          <div class="sticker-card">
            <div class="sticker-header">
              <span class="brand-title">${brand.toUpperCase()}</span>
              <span class="price-tag">${price}</span>
            </div>
            <div class="sticker-body">
              ${imgUrl ? `<img src="${imgUrl}" class="item-thumb" onError="this.style.display='none'" />` : '<div class="item-thumb-placeholder">NO IMG</div>'}
              <div class="item-info">
                <div class="item-name">${name}</div>
                <div class="item-meta">Category: ${category}</div>
                <div class="item-details">
                  <span class="size-badge">SIZE: <b>${size}</b></span>
                </div>
              </div>
            </div>
            <div class="barcode-container">
              <svg id="${barcodeId}"></svg>
            </div>
            <div class="sku-footer">${sku}</div>
          </div>
        `;

        barcodeScripts += `
          try {
            JsBarcode("#${barcodeId}", "${sku}", {
              format: "CODE128",
              displayValue: false,
              margin: 0,
              background: "transparent",
              lineColor: "#000",
              width: 1.8,
              height: 35
            });
          } catch(e) { console.error(e); }
        `;
      }
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Product Barcodes - Elite Online</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
          @page { size: A4; margin: 8mm; }
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #fff;
            color: #0f172a;
          }
          .no-print {
            padding: 12px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
            text-align: center;
            position: sticky;
            top: 0;
            z-index: 100;
          }
          .print-btn {
            padding: 10px 24px;
            font-size: 14px;
            font-weight: 700;
            background: #059669;
            color: #fff;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
          }
          .label-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 6mm;
            padding: 4mm;
          }
          .sticker-card {
            border: 1.5px solid #0f172a;
            border-radius: 8px;
            padding: 8px 12px;
            box-sizing: border-box;
            background: #fff;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            page-break-inside: avoid;
            height: 50mm;
          }
          .sticker-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 4px;
            margin-bottom: 6px;
          }
          .brand-title {
            font-size: 9.5pt;
            font-weight: 800;
            letter-spacing: 0.05em;
            color: #0f172a;
          }
          .price-tag {
            font-size: 9.5pt;
            font-weight: 800;
            color: #059669;
          }
          .sticker-body {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 4px;
          }
          .item-thumb {
            width: 42px;
            height: 42px;
            object-fit: cover;
            border-radius: 6px;
            border: 1px solid #cbd5e1;
            flex-shrink: 0;
          }
          .item-thumb-placeholder {
            width: 42px;
            height: 42px;
            border-radius: 6px;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 7pt;
            font-weight: bold;
            color: #94a3b8;
            flex-shrink: 0;
          }
          .item-info {
            flex: 1;
            min-width: 0;
          }
          .item-name {
            font-size: 9pt;
            font-weight: 700;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: #0f172a;
          }
          .item-meta {
            font-size: 7.5pt;
            color: #64748b;
            margin-top: 1px;
          }
          .item-details {
            font-size: 7.5pt;
            color: #475569;
            margin-top: 3px;
          }
          .size-badge {
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 1px 5px;
            border-radius: 4px;
            font-size: 7.5pt;
            color: #0f172a;
          }
          .barcode-container {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 12mm;
            width: 100%;
            margin-top: 2px;
          }
          .barcode-container svg {
            max-width: 100%;
            height: 11mm;
          }
          .sku-footer {
            text-align: center;
            font-family: monospace;
            font-size: 9pt;
            font-weight: 800;
            letter-spacing: 0.08em;
            color: #0f172a;
            margin-top: 1px;
          }
          @media print {
            .no-print { display: none !important; }
            body { background: white; }
          }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button class="print-btn" onclick="window.print()">🖨️ Print All Labels Now</button>
        </div>
        <div class="label-grid">
          ${stickersHtml}
        </div>
        <script>
          setTimeout(function() {
            ${barcodeScripts}
          }, 150);
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="glass-panel" style={styles.gridPanel}>
      {/* Control Header */}
      <div className="catalog-control-header" style={styles.controlHeader}>
        <div className="catalog-left-controls" style={styles.leftControls}>
          <div className="catalog-search-box" style={styles.searchBox}>
            <Search size={16} color="#64748b" style={styles.searchIcon} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search catalog by SKU, name, or brand..."
              style={styles.searchInput}
            />
          </div>

          <div className="catalog-filter-box" style={styles.filterBox}>
            <SlidersHorizontal size={14} color="#059669" />
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

          <div className="catalog-filter-box" style={styles.filterBox}>
            <Building2 size={14} color="#059669" />
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              style={styles.selectInput}
            >
              {allBrands.map((b, idx) => (
                <option key={idx} value={b}>{b === 'All' ? 'All Brands' : b}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="catalog-action-group" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            type="button"
            onClick={handleOpenBrandManager}
            className="btn-secondary" 
            style={{ ...styles.addBtn, background: '#e0e7ff', color: '#4338ca', borderColor: '#c7d2fe', fontWeight: 700 }}
            title="Manage Brands & Dynamic Dropdown Values"
          >
            <Building2 size={16} />
            <span>Manage Brands</span>
          </button>

          <button 
            onClick={() => handlePrintBarcodes(filteredItems)} 
            className="btn-secondary" 
            style={{ ...styles.addBtn, background: '#d1fae5', color: '#047857', borderColor: '#a7f3d0', fontWeight: 700 }}
            title="Print Barcode Labels for All Filtered Products"
          >
            <Printer size={16} />
            <span>Print All Barcodes ({filteredItems.length})</span>
          </button>

          <button onClick={onAdd} className="btn-success" style={styles.primaryAddBtn}>
            <Plus size={16} />
            Add Product
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="table-container data-table-container" style={{ ...styles.tableWrap, overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
        {filteredItems.length === 0 ? (
          <div style={styles.emptyTable}>
            No products match your filters.
          </div>
        ) : (
          <table className="data-table" style={{ ...styles.table, minWidth: '820px', width: '100%' }}>
            <thead>
              <tr>
                <th onClick={() => handleSort('description')} style={{ cursor: 'pointer' }}>
                  PRODUCT DETAILS {sortField === 'description' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => handleSort('skuCode')} style={{ cursor: 'pointer' }}>
                  SKU CODE {sortField === 'skuCode' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => handleSort('brand')} style={{ cursor: 'pointer' }}>
                  BRAND {sortField === 'brand' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th>SIZES</th>
                <th onClick={() => handleSort('basePrice')} style={{ cursor: 'pointer' }}>
                  BASE PRICE {sortField === 'basePrice' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => handleSort('price')} style={{ cursor: 'pointer' }}>
                  PRICE {sortField === 'price' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="text-center">LIVE STOCK</th>
                <th className="text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                // Determine snapshot stock if available
                const snapStock = item.inventorySnapshots?.inventory;
                const hasSnapshot = snapStock !== undefined && snapStock !== null;
                
                let stockClass = 'badge-success';
                let stockLabel = hasSnapshot ? `${snapStock} Units` : 'No Live Sync';
                if (hasSnapshot && snapStock === 0) {
                  stockClass = 'badge-danger';
                  stockLabel = '0 Units (Out of Stock)';
                } else if (hasSnapshot && snapStock <= 5) {
                  stockClass = 'badge-warning';
                  stockLabel = `${snapStock} Units (Low Stock)`;
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
                          <div style={styles.itemMeta}>Category: {item.categoryName || 'KURTA SET'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={styles.skuBadge}>{item.skuCode}</span>
                      {Array.isArray(item.brandCodes) && item.brandCodes.length > 0 && (
                        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {item.brandCodes.map((bc, bIdx) => (
                            <span key={bIdx} style={{ fontSize: '0.68rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '1px 5px', fontWeight: 600 }}>
                              {typeof bc === 'string' ? bc : `${bc.brand ? bc.brand + ': ' : ''}${bc.code}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={styles.brandBadge}>{item.brand || 'ANOUK'}</span>
                    </td>
                    <td>
                      {Array.isArray(item.size) ? (
                        <div style={styles.sizeWrap}>
                          {item.size.map((sz, i) => (
                            <span key={i} style={styles.sizeBadge}>{sz}</span>
                          ))}
                        </div>
                      ) : (
                        <span style={styles.sizeBadge}>{item.size || 'N/A'}</span>
                      )}
                    </td>
                    <td>Rs. {(item.basePrice || 0).toFixed(2)}</td>
                    <td style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                      Rs. {(item.price || 0).toFixed(2)}
                    </td>
                    <td className="text-center">
                      <span className={`badge ${stockClass}`}>
                        {stockLabel}
                      </span>
                    </td>
                    <td className="text-center">
                      <div style={styles.actionGroup}>
                        <button
                          onClick={() => handlePrintBarcodes(item)}
                          className="btn-icon"
                          style={{ color: '#059669', borderColor: '#a7f3d0', background: '#ecfdf5' }}
                          title="Print Barcode Sticker for this product"
                        >
                          <Printer size={15} />
                        </button>
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

      {/* Brand Manager Modal */}
      {showBrandManager && (
        <BrandManagerModal
          existingBrands={catalogBrands || []}
          customBrands={customBrands || []}
          onAddBrand={handleAddBrand}
          onDeleteBrand={handleDeleteBrand}
          onClose={handleCloseBrandManager}
        />
      )}
    </div>
  );
}

// Inject Responsive Mobile & Laptop CSS Styles
if (typeof document !== 'undefined') {
  const styleElId = 'product-catalog-grid-responsive-style';
  if (!document.getElementById(styleElId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleElId;
    styleEl.innerHTML = `
      @media (max-width: 1200px) {
        .catalog-control-header {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 0.85rem !important;
        }
        .catalog-left-controls {
          width: 100% !important;
          flex-wrap: wrap !important;
          justify-content: flex-start !important;
        }
        .catalog-search-box {
          flex: 1 !important;
          min-width: 220px !important;
        }
        .catalog-action-group {
          width: 100% !important;
          justify-content: flex-start !important;
        }
      }

      @media (max-width: 768px) {
        .catalog-control-header {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 0.75rem !important;
        }
        .catalog-left-controls {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 0.5rem !important;
          width: 100% !important;
        }
        .catalog-search-box {
          grid-column: span 2 !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        .catalog-filter-box {
          width: 100% !important;
          justify-content: space-between !important;
        }
        .catalog-filter-box select {
          flex: 1 !important;
          width: 100% !important;
        }
        .catalog-action-group {
          width: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 0.5rem !important;
        }
        .catalog-action-group button {
          width: 100% !important;
          justify-content: center !important;
          font-size: 0.8rem !important;
          padding: 0.6rem 0.5rem !important;
        }
        .data-table-container {
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch !important;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }
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
    gap: '0.85rem',
    flexWrap: 'wrap',
  },
  leftControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    flexWrap: 'nowrap',
  },
  searchBox: {
    position: 'relative',
    width: '260px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: '0.75rem',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    padding: '0.55rem 0.75rem 0.55rem 2.2rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: '0.85rem',
    fontWeight: '500',
    outline: 'none',
    boxSizing: 'border-box',
  },
  filterBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    padding: '0 0.65rem',
    borderRadius: '8px',
    height: '38px',
    boxSizing: 'border-box',
    flexShrink: 0,
  },
  selectInput: {
    border: 'none',
    backgroundColor: 'transparent',
    padding: '0.4rem 0.2rem',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#0f172a',
    outline: 'none',
    cursor: 'pointer',
  },
  addBtn: {
    padding: '0.55rem 1rem',
    borderRadius: '8px',
    fontSize: '0.825rem',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    boxSizing: 'border-box',
    height: '38px',
  },
  primaryAddBtn: {
    padding: '0.55rem 1.25rem',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#059669',
    color: '#ffffff',
    fontSize: '0.85rem',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    height: '38px',
    boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.3)',
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

if (typeof document !== 'undefined') {
  const styleElId = 'catalog-grid-responsive-style';
  if (!document.getElementById(styleElId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleElId;
    styleEl.innerHTML = `
      @media (max-width: 768px) {
        .catalog-control-header {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 0.65rem !important;
          padding: 0.85rem !important;
        }
        .catalog-left-controls {
          flex-direction: column !important;
          width: 100% !important;
          gap: 0.5rem !important;
        }
        .catalog-search-box {
          width: 100% !important;
        }
        .catalog-filter-box {
          width: 100% !important;
        }
        .catalog-action-group {
          display: grid !important;
          grid-template-columns: repeat(2, 1fr) !important;
          width: 100% !important;
          gap: 0.5rem !important;
        }
        .catalog-action-group button {
          width: 100% !important;
          justify-content: center !important;
          box-sizing: border-box !important;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }
}

