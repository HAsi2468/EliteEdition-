import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  RefreshCw,
  Grid3X3,
  Palette,
  Package,
  TrendingUp,
  IndianRupee,
  AlertTriangle,
  Calendar,
  Filter,
  BarChart2,
} from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtCurrency = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function VariantAnalytics() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [dateStart, setDateStart] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 6);
    return d.toISOString().split('T')[0];
  });
  const [dateEnd, setDateEnd] = useState(() => new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.getVariantAnalytics({ dateStart, dateEnd, category, brand });
      if (res && res.success) setData(res);
    } catch (err) {
      console.error('Variant analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Cell color based on sales count relative to max
  const getCellBg = (sales, returns, maxSales) => {
    if (sales === 0) return 'transparent';
    const returnRate = sales > 0 ? (returns / sales) * 100 : 0;
    if (returnRate > 15) {
      // Red gradient for high return rate
      const intensity = Math.min(returnRate / 50, 1);
      return `rgba(239, 68, 68, ${0.12 + intensity * 0.25})`;
    }
    // Green gradient for healthy sales
    const ratio = maxSales > 0 ? sales / maxSales : 0;
    return `rgba(16, 185, 129, ${0.05 + ratio * 0.3})`;
  };

  const getCellBorder = (sales, returns) => {
    if (sales === 0) return '1px solid var(--border-light)';
    const returnRate = sales > 0 ? (returns / sales) * 100 : 0;
    if (returnRate > 15) return '1px solid rgba(239, 68, 68, 0.35)';
    return '1px solid rgba(16, 185, 129, 0.15)';
  };

  // Max sales for color scaling
  let maxCellSales = 0;
  if (data && data.sizeFitMatrix) {
    data.sizeFitMatrix.forEach((row) => {
      Object.values(row.sizes).forEach((s) => {
        if (s.sales > maxCellSales) maxCellSales = s.sales;
      });
    });
  }

  // Max color revenue for bar chart width scaling
  const maxColorRevenue = data && data.colorPerformance && data.colorPerformance.length > 0
    ? data.colorPerformance[0].revenue
    : 1;

  return (
    <div style={styles.container}>
      {/* Filter Bar */}
      <div className="glass-panel" style={styles.filterBar}>
        <div style={styles.filterLeft}>
          <Filter size={14} color="var(--primary)" />
          <span style={styles.filterLabel}>Filters</span>
          <div style={styles.inputGroup}>
            <Calendar size={12} color="var(--text-muted)" />
            <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} style={styles.dateInput} />
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>to</span>
          <div style={styles.inputGroup}>
            <Calendar size={12} color="var(--text-muted)" />
            <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} style={styles.dateInput} />
          </div>
          {data && data.filters && (
            <>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.selectInput}>
                <option value="">All Categories</option>
                {data.filters.categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={brand} onChange={(e) => setBrand(e.target.value)} style={styles.selectInput}>
                <option value="">All Brands</option>
                {data.filters.brands.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </>
          )}
        </div>
        <button onClick={fetchData} disabled={loading} className="btn-primary" style={styles.applyBtn}>
          <RefreshCw size={13} className={loading ? 'spin-loader' : ''} />
          <span>{loading ? 'Analyzing...' : 'Apply Filters'}</span>
        </button>
      </div>

      {loading && !data && (
        <div className="glass-panel" style={styles.loadingBox}>
          <RefreshCw size={28} className="spin-loader" color="var(--primary)" />
          <p style={{ marginTop: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Running variant aggregation pipeline...
          </p>
        </div>
      )}

      {data && (
        <>
          {/* Summary Cards */}
          <div style={styles.statsGrid}>
            <div className="glass-panel" style={styles.statCard}>
              <div style={styles.statIcon}><Package size={18} color="#38bdf8" /></div>
              <div>
                <div style={styles.statValue}>{fmt(data.summary.totalSkus)}</div>
                <div style={styles.statLabel}>SKUs Analyzed</div>
              </div>
            </div>
            <div className="glass-panel" style={styles.statCard}>
              <div style={styles.statIcon}><IndianRupee size={18} color="#34d399" /></div>
              <div>
                <div style={{ ...styles.statValue, color: '#34d399' }}>{fmtCurrency(data.summary.totalRevenue)}</div>
                <div style={styles.statLabel}>Total Revenue</div>
              </div>
            </div>
            <div className="glass-panel" style={styles.statCard}>
              <div style={styles.statIcon}><TrendingUp size={18} color="#a78bfa" /></div>
              <div>
                <div style={{ ...styles.statValue, color: '#a78bfa' }}>{fmtCurrency(data.summary.avgOrderValue)}</div>
                <div style={styles.statLabel}>Avg Order Value</div>
              </div>
            </div>
            <div className="glass-panel" style={styles.statCard}>
              <div style={styles.statIcon}><AlertTriangle size={18} color={parseFloat(data.summary.returnRate) > 15 ? '#ef4444' : '#fbbf24'} /></div>
              <div>
                <div style={{ ...styles.statValue, color: parseFloat(data.summary.returnRate) > 15 ? '#ef4444' : '#fbbf24' }}>
                  {data.summary.returnRate}%
                </div>
                <div style={styles.statLabel}>Return Rate ({fmt(data.summary.totalReturns)} items)</div>
              </div>
            </div>
          </div>

          {/* Size Fit Matrix Grid */}
          <div className="glass-panel" style={styles.sectionCard}>
            <div style={styles.sectionHeader}>
              <Grid3X3 size={16} color="var(--primary)" />
              <h3 style={styles.sectionTitle}>Size Fit Matrix Grid</h3>
              <span style={styles.sectionBadge}>{data.sizeFitMatrix.length} Parent SKUs</span>
            </div>
            <div style={styles.legendRow}>
              <div style={styles.legendItem}>
                <div style={{ ...styles.legendDot, background: 'rgba(16, 185, 129, 0.3)' }} />
                <span>Healthy Sales</span>
              </div>
              <div style={styles.legendItem}>
                <div style={{ ...styles.legendDot, background: 'rgba(239, 68, 68, 0.3)' }} />
                <span>Return Rate &gt; 15%</span>
              </div>
            </div>
            <div className="table-container" style={styles.matrixWrap}>
              <table>
                <thead>
                  <tr>
                    <th style={{ minWidth: '180px' }}>Parent SKU</th>
                    <th>Brand</th>
                    {data.availableSizes.map((size) => (
                      <th key={size} className="text-center" style={{ minWidth: '55px' }}>{size}</th>
                    ))}
                    <th className="text-center">Total</th>
                    <th className="text-center">Return %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sizeFitMatrix.length === 0 ? (
                    <tr><td colSpan={data.availableSizes.length + 4} className="text-center" style={{ padding: '2rem', color: 'var(--text-muted)' }}>No data available for selected filters</td></tr>
                  ) : (
                    data.sizeFitMatrix.map((row) => (
                      <tr key={row.parentSku}>
                        <td>
                          <span style={styles.skuBadge}>{row.parentSku}</span>
                        </td>
                        <td style={{ color: '#d1d5db', fontSize: '0.8rem' }}>{row.brand}</td>
                        {data.availableSizes.map((size) => {
                          const cell = row.sizes[size];
                          const sales = cell ? cell.sales : 0;
                          const returns = cell ? cell.returns : 0;
                          const returnRate = sales > 0 ? ((returns / sales) * 100) : 0;
                          return (
                            <td
                              key={size}
                              className="text-center"
                              style={{
                                background: getCellBg(sales, returns, maxCellSales),
                                border: getCellBorder(sales, returns),
                                fontWeight: sales > 0 ? '600' : '400',
                                color: sales === 0 ? 'var(--text-muted)' : returnRate > 15 ? '#fca5a5' : '#a7f3d0',
                                fontSize: '0.8rem',
                                position: 'relative',
                                cursor: sales > 0 ? 'default' : 'auto',
                              }}
                              title={sales > 0 ? `Sales: ${sales} | Returns: ${returns} (${returnRate.toFixed(1)}%)` : 'No sales'}
                            >
                              {sales > 0 ? sales : '—'}
                            </td>
                          );
                        })}
                        <td className="text-center" style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                          {fmt(row.totalSales)}
                        </td>
                        <td className="text-center">
                          <span style={{
                            ...styles.rateBadge,
                            color: parseFloat(row.returnRate) > 15 ? '#fca5a5' : '#86efac',
                            background: parseFloat(row.returnRate) > 15 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.08)',
                            border: parseFloat(row.returnRate) > 15 ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.15)',
                          }}>
                            {row.returnRate}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Color Performance Bar Chart */}
          <div className="glass-panel" style={styles.sectionCard}>
            <div style={styles.sectionHeader}>
              <Palette size={16} color="var(--primary)" />
              <h3 style={styles.sectionTitle}>Revenue by Color Variant</h3>
              <span style={styles.sectionBadge}>{data.colorPerformance.length} Colors</span>
            </div>
            <div style={styles.barChartContainer}>
              {data.colorPerformance.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No color data available</p>
              ) : (
                data.colorPerformance.map((item, i) => {
                  const widthPct = maxColorRevenue > 0 ? (item.revenue / maxColorRevenue) * 100 : 0;
                  // Assign a visually appealing color based on index
                  const barColors = ['#38bdf8', '#34d399', '#a78bfa', '#f472b6', '#fbbf24', '#fb923c', '#60a5fa', '#4ade80', '#c084fc', '#f87171',
                    '#2dd4bf', '#818cf8', '#fb7185', '#facc15', '#a3e635', '#22d3ee', '#e879f9', '#f97316', '#14b8a6', '#8b5cf6'];
                  
                  const mapColorNameToHex = (colorName) => {
                    const normalized = String(colorName).toLowerCase().trim().replace(/[^a-z]/g, '');
                    const colorMap = {
                      red: '#ef4444', darkred: '#991b1b', maroon: '#7f1d1d', burgundy: '#831843', wine: '#831843',
                      blue: '#3b82f6', navy: '#1e3a8a', navyblue: '#1e3a8a', lightblue: '#7dd3fc', sky: '#38bdf8', skyblue: '#38bdf8', indigo: '#6366f1',
                      green: '#22c55e', darkgreen: '#14532d', olive: '#65a30d', olivegreen: '#65a30d', mint: '#6ee7b7', emerald: '#10b981',
                      yellow: '#eab308', mustard: '#ca8a04', gold: '#fbbf24', khaki: '#fde047',
                      orange: '#f97316', peach: '#fdba74', rust: '#9a3412',
                      pink: '#ec4899', hotpink: '#db2777', rose: '#f43f5e', coral: '#fb7185', salmon: '#fca5a5',
                      purple: '#a855f7', violet: '#8b5cf6', lavender: '#c4b5fd', magenta: '#d946ef',
                      black: '#6b7280', white: '#e5e7eb', offwhite: '#f3f4f6', cream: '#fef3c7', // Softened black/white for visibility
                      grey: '#9ca3af', gray: '#9ca3af', silver: '#d1d5db',
                      brown: '#78350f', beige: '#d6d3d1', tan: '#d6d3d1',
                      teal: '#14b8a6', cyan: '#06b6d4'
                    };
                    return colorMap[normalized];
                  };

                  const barColor = mapColorNameToHex(item.color) || barColors[i % barColors.length];

                  return (
                    <div key={item.color} style={styles.barRow}>
                      <div style={styles.barLabel}>{item.color}</div>
                      <div style={styles.barTrack}>
                        <div style={{
                          ...styles.barFill,
                          width: `${Math.max(widthPct, 2)}%`,
                          background: `linear-gradient(90deg, ${barColor}44, ${barColor})`,
                          borderRight: `2px solid ${barColor}`,
                        }} />
                      </div>
                      <div style={styles.barValue}>{fmtCurrency(item.revenue)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  filterBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.75rem 1.25rem', flexWrap: 'wrap', gap: '0.75rem',
  },
  filterLeft: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' },
  filterLabel: { color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: '600' },
  inputGroup: {
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)',
    borderRadius: '6px', padding: '0.3rem 0.5rem',
  },
  dateInput: {
    background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.75rem',
    outline: 'none', fontFamily: 'inherit',
  },
  selectInput: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)',
    borderRadius: '6px', padding: '0.35rem 0.5rem', color: '#d1d5db',
    fontSize: '0.75rem', cursor: 'pointer', outline: 'none',
  },
  applyBtn: { display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', fontSize: '0.78rem' },
  loadingBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '3rem', minHeight: '200px',
  },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' },
  statCard: { padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' },
  statIcon: {
    width: '40px', height: '40px', borderRadius: '10px',
    background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  statValue: { fontSize: '1.3rem', fontWeight: '700', color: 'var(--text-primary)', lineHeight: '1' },
  statLabel: { fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' },
  sectionCard: { padding: '1.25rem' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' },
  sectionTitle: { fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)', margin: 0, flex: 1 },
  sectionBadge: {
    fontSize: '0.7rem', color: 'var(--primary)', background: 'rgba(6, 182, 212, 0.08)',
    border: '1px solid rgba(6, 182, 212, 0.15)', padding: '0.15rem 0.5rem', borderRadius: '12px',
  },
  legendRow: { display: 'flex', gap: '1.25rem', marginBottom: '0.75rem' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--text-muted)' },
  legendDot: { width: '10px', height: '10px', borderRadius: '3px' },
  matrixWrap: { maxHeight: '500px', overflowY: 'auto', overflowX: 'auto' },
  skuBadge: {
    fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--primary)',
    background: 'rgba(6, 182, 212, 0.05)', padding: '0.15rem 0.4rem',
    borderRadius: '4px', border: '1px solid rgba(6, 182, 212, 0.1)',
  },
  rateBadge: {
    display: 'inline-flex', padding: '0.15rem 0.4rem', borderRadius: '8px',
    fontSize: '0.72rem', fontWeight: '600',
  },
  barChartContainer: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  barRow: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  barLabel: { width: '100px', fontSize: '0.78rem', color: '#d1d5db', fontWeight: '500', textAlign: 'right', flexShrink: 0 },
  barTrack: {
    flex: 1, height: '22px', background: 'rgba(255,255,255,0.02)',
    borderRadius: '4px', border: '1px solid var(--border-light)', overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: '4px 0 0 4px', transition: 'width 0.6s ease' },
  barValue: { width: '100px', fontSize: '0.75rem', color: '#86efac', fontWeight: '600', flexShrink: 0 },
};
