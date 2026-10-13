import React from 'react';
import { getNestedValue } from '../../utils/tokenResolver';

export default function DynamicTableElement({ element, dataContext = {}, isPreview = false }) {
  const { tableConfig = {}, style = {} } = element;
  const items = dataContext.invoice?.items || dataContext.items || dataContext.challan?.items || dataContext.jobCard?.items || [
    { index: 1, description: 'Digital Print Fabric (Pure Modal Silk)', hsn: '5407', quantity: 350, rate: 65, total: 22750 },
    { index: 2, description: 'Viscose Rayon Printed Meters (140 GSM)', hsn: '5407', quantity: 280, rate: 52, total: 14560 },
    { index: 3, description: 'Job Work Printing Service (Cotton Satin)', hsn: '9988', quantity: 220, rate: 50, total: 11000 }
  ];

  const columns = tableConfig.columns || [
    { key: 'sr', label: 'Sr', width: '35px', align: 'center', field: 'index' },
    { key: 'description', label: 'Item Description', width: '220px', align: 'left', field: 'description' },
    { key: 'hsn', label: 'HSN/SAC', width: '70px', align: 'center', field: 'hsn' },
    { key: 'qty', label: 'Qty', width: '70px', align: 'right', field: 'quantity' },
    { key: 'rate', label: 'Rate (₹)', width: '70px', align: 'right', field: 'rate' },
    { key: 'total', label: 'Amount (₹)', width: '90px', align: 'right', field: 'total' }
  ];

  const headerBg = tableConfig.headerBg || '#0f172a';
  const headerColor = tableConfig.headerColor || '#ffffff';
  const borderColor = tableConfig.borderColor || '#e2e8f0';
  const rowHeight = tableConfig.rowHeight || 25;

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', userSelect: 'none' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: `${style.fontSize || 10}px` }}>
        {tableConfig.showHeader !== false && (
          <thead>
            <tr style={{ backgroundColor: headerBg, height: `${rowHeight + 4}px` }}>
              {columns.map((col, idx) => (
                <th
                  key={col.key || idx}
                  style={{
                    border: `1px solid ${borderColor}`,
                    padding: '3px 6px',
                    color: headerColor,
                    fontWeight: 700,
                    textAlign: col.align || 'left',
                    width: col.width || 'auto',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {items.slice(0, 8).map((row, rIdx) => {
            const isStriped = tableConfig.striped && rIdx % 2 === 1;
            return (
              <tr
                key={rIdx}
                style={{
                  backgroundColor: isStriped ? '#f8fafc' : '#ffffff',
                  height: `${rowHeight}px`
                }}
              >
                {columns.map((col, cIdx) => {
                  let val = getNestedValue(row, col.field || col.key);
                  if (typeof val === 'number') {
                    const l = col.label.toLowerCase();
                    if (l.includes('rate') || l.includes('total') || l.includes('amount') || l.includes('price')) {
                      val = `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    }
                  }
                  return (
                    <td
                      key={cIdx}
                      style={{
                        border: `1px solid ${borderColor}`,
                        padding: '3px 6px',
                        textAlign: col.align || 'left',
                        color: style.color || '#1e293b',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {val !== '' && val !== undefined ? val : '-'}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
