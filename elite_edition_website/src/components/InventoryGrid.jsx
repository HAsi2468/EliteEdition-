import React, { useState } from 'react';
import { Edit2, Trash2, Printer, Search, Plus, SlidersHorizontal, Eye, TrendingDown, MoreVertical, Sparkles } from 'lucide-react';

export default function InventoryGrid({ items, onEdit, onDelete, onAdd, onStockOut, onOpenManager, onBulkInward }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sizeFilter, setSizeFilter] = useState('All');
  const [sortField, setSortField] = useState('itemName');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'

  // Get unique sizes for the filter dropdown
  const sizes = ['All', ...new Set(items.map(item => item.size).filter(Boolean))];

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
        (item.itemName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.party || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.skuCode || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchSize = sizeFilter === 'All' || item.size === sizeFilter;
      
      return matchSearch && matchSize;
    })
    .sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      // Default nulls
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

  // Client-side Thermal Barcode Printing (100mm x 25mm page size, 2-up stickers)
  const printBarcode = (item) => {
    const sku = item.skuCode || 'NO-SKU';
    const size = item.size || 'N/A';
    const itemName = item.itemName || 'Elite Item';

    const countStr = window.prompt(`How many barcodes do you want to print for SKU "${sku}"?`, "1");
    if (countStr === null) return; // Cancelled by user

    const count = parseInt(countStr, 10);
    if (isNaN(count) || count <= 0) {
      alert("Please enter a valid positive number.");
      return;
    }

    // Open a new tab/window for printing
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    // Generate sheets HTML dynamically
    const totalSheets = Math.ceil(count / 2);
    let sheetsHtml = '';
    
    for (let i = 0; i < totalSheets; i++) {
      const idx1 = i * 2;
      const idx2 = i * 2 + 1;
      
      const sticker1Html = `
        <div class="sticker">
          <div class="title">ELITE EDITION</div>
          <div class="barcode-container">
            <svg class="barcode-img" id="barcode_${idx1}"></svg>
          </div>
          <div class="footer-row">
            <span class="sku-text">${sku}</span>
            <span class="size-text">Size: ${size}</span>
          </div>
        </div>
      `;
      
      // If second sticker is within count, print barcode; otherwise, empty sticker (visibility hidden)
      const sticker2Html = idx2 < count 
        ? `
          <div class="sticker">
            <div class="title">ELITE EDITION</div>
            <div class="barcode-container">
              <svg class="barcode-img" id="barcode_${idx2}"></svg>
            </div>
            <div class="footer-row">
              <span class="sku-text">${sku}</span>
              <span class="size-text">Size: ${size}</span>
            </div>
          </div>
        `
        : `
          <div class="sticker" style="visibility: hidden;"></div>
        `;
        
      sheetsHtml += `
        <div class="sheet">
          ${sticker1Html}
          ${sticker2Html}
        </div>
      `;
    }

    // Script to render barcodes dynamically
    let barcodeScripts = '';
    for (let j = 0; j < count; j++) {
      barcodeScripts += `
        JsBarcode("#barcode_${j}", "${sku}", {
          format: "CODE128",
          displayValue: false,
          margin: 0,
          background: "transparent",
          lineColor: "#000",
          width: 2,
          height: 40
        });
      `;
    }

    // HTML content for printing
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Barcodes - ${sku}</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
          @page {
            size: 100mm 25mm;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: white;
            color: black;
            -webkit-print-color-adjust: exact;
          }
          /* 100mm x 25mm printable sheet container */
          .sheet {
            display: flex;
            width: 100mm;
            height: 25mm;
            box-sizing: border-box;
            overflow: hidden;
            page-break-after: always;
          }
          .sheet:last-child {
            page-break-after: avoid;
          }
          /* Individual sticker: 50mm x 25mm */
          .sticker {
            flex: 1;
            width: 50mm;
            height: 25mm;
            box-sizing: border-box;
            padding: 2.2mm 3.5mm 1.5mm 3.5mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            overflow: hidden;
            border-right: 0.5px dashed #ccc; /* Cut guideline for screen, hidden in print */
          }
          .sticker:last-child {
            border-right: none;
          }
          .title {
            font-size: 8.5pt;
            font-weight: bold;
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            width: 100%;
            line-height: 1.1;
            letter-spacing: 0.2px;
          }
          .barcode-container {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 12.5mm;
            width: 100%;
            overflow: hidden;
          }
          .barcode-img {
            max-width: 44mm;
            height: 11mm;
          }
          .footer-row {
            display: flex;
            justify-content: space-between;
            width: 100%;
            font-size: 7.5pt;
            font-weight: 500;
            line-height: 1.1;
          }
          .sku-text {
            font-family: monospace;
            font-weight: bold;
          }
          .size-text {
            font-weight: bold;
          }
          @media print {
            .sticker {
              border-right: none;
            }
          }
        </style>
      </head>
      <body>
        ${sheetsHtml}

        <script>
          // Render barcode SVGs using JsBarcode
          try {
            ${barcodeScripts}
          } catch (e) {
            console.error('Failed to generate barcode', e);
          }

          // Trigger Print automatically
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 300);
          }
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
      <div style={styles.controlHeader}>
        <div style={styles.leftControls}>
          <div style={styles.searchBox}>
            <Search size={16} color="var(--text-muted)" style={styles.searchIcon} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by SKU, item, or vendor..."
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
          <button onClick={() => onStockOut(null)} className="btn-secondary" style={{ ...styles.addBtn, background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <TrendingDown size={16} />
            Outward
          </button>
          <button onClick={onBulkInward} className="btn-primary" style={styles.addBtn}>
            <Sparkles size={16} />
            Bulk Inward
          </button>
          <button onClick={onAdd} className="btn-success" style={styles.addBtn}>
            <Plus size={16} />
            Add Item
          </button>
          <button onClick={() => onOpenManager('vendors')} className="btn-icon" style={{ ...styles.addBtn, padding: '0.6rem 0.8rem' }} title="Control Panel (More)">
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="table-container" style={styles.tableWrap}>
        {filteredItems.length === 0 ? (
          <div style={styles.emptyTable}>
            <span style={{ fontSize: '2.5rem' }}>🔍</span>
            <h4 style={{ marginTop: '0.8rem', color: 'var(--text-primary)' }}>No inventory items found</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Try adjusting your search terms or filters.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('itemName')} style={styles.thSort}>
                  Item Details {sortField === 'itemName' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => handleSort('skuCode')} style={styles.thSort}>
                  SKU Code {sortField === 'skuCode' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => handleSort('party')} style={styles.thSort}>
                  Vendor {sortField === 'party' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => handleSort('size')} style={styles.thSort}>
                  Size {sortField === 'size' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => handleSort('purchasePrice')} style={styles.thSort} className="text-right">
                  Buy Price {sortField === 'purchasePrice' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => handleSort('salePrice')} style={styles.thSort} className="text-right">
                  Sell Price {sortField === 'salePrice' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => handleSort('currentlyAvailableStock')} style={styles.thSort} className="text-center">
                  Stock Level {sortField === 'currentlyAvailableStock' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const stock = item.currentlyAvailableStock || 0;
                let stockClass = 'badge-success';
                let stockLabel = `${stock} in stock`;
                if (stock === 0) {
                  stockClass = 'badge-danger';
                  stockLabel = 'Out of Stock';
                } else if (stock <= 5) {
                  stockClass = 'badge-warning';
                  stockLabel = `Low (${stock})`;
                }

                return (
                  <tr key={item._id}>
                    <td>
                      <div style={styles.itemCell}>
                        <div style={styles.itemImgWrapper}>
                          {item.imageUrl ? (
                            <img 
                              src={item.imageUrl} 
                              alt={item.itemName} 
                              style={styles.itemImg}
                              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                            />
                          ) : null}
                          <div style={{ ...styles.imgPlaceholder, display: item.imageUrl ? 'none' : 'flex' }}>
                            {item.itemName ? item.itemName[0].toUpperCase() : 'E'}
                          </div>
                        </div>
                        <div>
                          <div style={styles.itemName}>{item.itemName}</div>
                          <div style={styles.itemMeta}>Created: {item.created_date_time ? new Date(item.created_date_time).toLocaleDateString('en-IN') : 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={styles.skuText}>{item.skuCode || 'N/A'}</span>
                    </td>
                    <td>{item.party}</td>
                    <td>
                      <span style={styles.sizeBadge}>{item.size}</span>
                    </td>
                    <td className="text-right">
                      {item.purchasePrice ? `Rs. ${item.purchasePrice.toFixed(2)}` : 'Rs. 0.00'}
                    </td>
                    <td className="text-right">
                      {item.salePrice ? `Rs. ${item.salePrice.toFixed(2)}` : 'Rs. 0.00'}
                    </td>
                    <td className="text-center">
                      <span className={`badge ${stockClass}`}>{stockLabel}</span>
                    </td>
                    <td>
                      <div style={styles.actionsCell}>
                        <button
                          onClick={() => onStockOut(item)}
                          className="btn-icon"
                          style={{ color: '#fca5a5' }}
                          title="Outward Item"
                        >
                          <TrendingDown size={15} />
                        </button>
                        <button
                          onClick={() => printBarcode(item)}
                          className="btn-icon"
                          title="Print 10x2.5cm Barcode Sticker"
                        >
                          <Printer size={15} />
                        </button>
                        <button
                          onClick={() => onEdit(item)}
                          className="btn-icon"
                          title="Edit Item"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => onDelete(item._id)}
                          className="btn-icon"
                          style={styles.trashBtn}
                          title="Delete Item"
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

// Inject CSS alignments
const styleEl = document.createElement('style');
styleEl.innerHTML = `
  .text-right { text-align: right !important; }
  .text-center { text-align: center !important; }
  th.text-right { padding-right: 1.5rem; }
  th.text-center { text-align: center !important; }
  .trashBtn:hover {
    background: var(--danger) !important;
    border-color: var(--danger) !important;
    color: white !important;
  }
`;
document.head.appendChild(styleEl);
