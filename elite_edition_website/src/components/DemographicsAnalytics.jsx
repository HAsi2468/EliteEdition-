import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  RefreshCw,
  MapPin,
  Calendar,
  Filter,
  Globe2,
  Building2,
  Layers,
  TrendingUp,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtCurrency = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function DemographicsAnalytics() {
  const [loading, setLoading] = useState(false);
  const [demoData, setDemoData] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [dateStart, setDateStart] = useState(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  });
  const [dateEnd, setDateEnd] = useState(() => new Date().toISOString().split('T')[0]);
  const [stateFilter, setStateFilter] = useState('');
  const [heatmapDimension, setHeatmapDimension] = useState('category'); // 'category' | 'color'
  const [sortField, setSortField] = useState('orders');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => { fetchData(); fetchHeatmap(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.getDemographicsAnalytics({ dateStart, dateEnd, state: stateFilter });
      if (res && res.success) setDemoData(res);
    } catch (err) { console.error('Demographics error:', err); }
    finally { setLoading(false); }
  };

  const fetchHeatmap = async () => {
    setHeatmapLoading(true);
    try {
      const res = await api.getTimeHeatmapData({ dateStart, dateEnd, dimension: heatmapDimension });
      if (res && res.success) setHeatmapData(res);
    } catch (err) { console.error('Heatmap error:', err); }
    finally { setHeatmapLoading(false); }
  };

  useEffect(() => { fetchHeatmap(); }, [heatmapDimension]);

  // Sort state data
  const sortedStates = demoData ? [...demoData.stateData].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
  }) : [];

  const handleSort = (field) => {
    if (sortField === field) setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
  };

  // Heatmap color interpolation
  const getHeatColor = (count, max) => {
    if (count === 0 || max === 0) return 'rgba(255,255,255,0.02)';
    const ratio = count / max;
    // Interpolate from light cyan to deep teal
    const r = Math.round(224 - ratio * 224);
    const g = Math.round(247 - ratio * 170);
    const b = Math.round(250 - ratio * 186);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const maxCityOrders = demoData && demoData.topCities.length > 0 ? demoData.topCities[0].orders : 1;

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
          {demoData && demoData.availableStates && (
            <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} style={styles.selectInput}>
              <option value="">All States</option>
              {demoData.availableStates.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
        <button onClick={() => { fetchData(); fetchHeatmap(); }} disabled={loading} className="btn-primary" style={styles.applyBtn}>
          <RefreshCw size={13} className={loading ? 'spin-loader' : ''} />
          <span>{loading ? 'Loading...' : 'Apply'}</span>
        </button>
      </div>

      {loading && !demoData && (
        <div className="glass-panel" style={styles.loadingBox}>
          <RefreshCw size={28} className="spin-loader" color="var(--primary)" />
          <p style={{ marginTop: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Aggregating geographic distribution...
          </p>
        </div>
      )}

      {demoData && (
        <>
          {/* Two-column layout: State table + City leaderboard */}
          <div style={styles.twoCol}>
            {/* State-wise Table */}
            <div className="glass-panel" style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <Globe2 size={16} color="var(--primary)" />
                <h3 style={styles.sectionTitle}>State-wise Performance</h3>
                <span style={styles.badge}>{sortedStates.length} States</span>
              </div>
              <div className="table-container" style={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>State</th>
                      <th className="text-center" style={{ cursor: 'pointer' }} onClick={() => handleSort('orders')}>
                        Orders {sortField === 'orders' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                      </th>
                      <th className="text-center" style={{ cursor: 'pointer' }} onClick={() => handleSort('revenue')}>
                        Revenue {sortField === 'revenue' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                      </th>
                      <th className="text-center" style={{ cursor: 'pointer' }} onClick={() => handleSort('aov')}>
                        AOV {sortField === 'aov' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                      </th>
                      <th className="text-center">Top Size</th>
                      <th className="text-center">Top Color</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStates.length === 0 ? (
                      <tr><td colSpan="6" className="text-center" style={{ padding: '2rem', color: 'var(--text-muted)' }}>No data</td></tr>
                    ) : (
                      sortedStates.map((row) => (
                        <tr
                          key={row.state}
                          style={{ cursor: 'pointer', background: stateFilter === row.state ? 'rgba(6, 182, 212, 0.05)' : 'transparent' }}
                          onClick={() => { setStateFilter(stateFilter === row.state ? '' : row.state); }}
                        >
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <MapPin size={12} color="var(--primary)" />
                              <span style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '0.82rem' }}>{row.state}</span>
                            </div>
                          </td>
                          <td className="text-center" style={{ color: '#67e8f9', fontWeight: '600' }}>{fmt(row.orders)}</td>
                          <td className="text-center" style={{ color: '#86efac', fontWeight: '600' }}>{fmtCurrency(row.revenue)}</td>
                          <td className="text-center" style={{ color: '#fcd34d', fontWeight: '600' }}>{fmtCurrency(row.aov)}</td>
                          <td className="text-center"><span style={styles.sizeBadge}>{row.topSize}</span></td>
                          <td className="text-center"><span style={styles.colorBadge}>{row.topColor}</span></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Cities Leaderboard */}
            <div className="glass-panel" style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <Building2 size={16} color="var(--primary)" />
                <h3 style={styles.sectionTitle}>Top 10 Cities</h3>
              </div>
              <div style={styles.cityList}>
                {demoData.topCities.map((city, i) => (
                  <div key={city.city} style={styles.cityRow}>
                    <div style={styles.cityRank}>#{i + 1}</div>
                    <div style={styles.cityInfo}>
                      <div style={styles.cityName}>{city.city}</div>
                      <div style={styles.cityBar}>
                        <div style={{
                          height: '100%', borderRadius: '3px',
                          width: `${(city.orders / maxCityOrders) * 100}%`,
                          background: `linear-gradient(90deg, rgba(56,189,248,0.3), rgba(56,189,248,0.8))`,
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                    </div>
                    <div style={styles.cityStats}>
                      <div style={{ color: '#67e8f9', fontWeight: '600', fontSize: '0.82rem' }}>{fmt(city.orders)}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{fmtCurrency(city.revenue)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Price Tier Distribution */}
          {demoData.priceTierData && demoData.priceTierData.length > 0 && (
            <div className="glass-panel" style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <Layers size={16} color="var(--primary)" />
                <h3 style={styles.sectionTitle}>Price Tier Distribution by State</h3>
              </div>
              <div style={styles.legendRow}>
                <div style={styles.legendItem}><div style={{ ...styles.legendDot, background: '#38bdf8' }} /><span>Tier 1 (&lt;₹499)</span></div>
                <div style={styles.legendItem}><div style={{ ...styles.legendDot, background: '#a78bfa' }} /><span>Tier 2 (₹500-999)</span></div>
                <div style={styles.legendItem}><div style={{ ...styles.legendDot, background: '#34d399' }} /><span>Tier 3 (₹1000+)</span></div>
              </div>
              <div style={styles.stackedChartContainer}>
                {demoData.priceTierData.map((row) => {
                  const total = row.tier1 + row.tier2 + row.tier3;
                  if (total === 0) return null;
                  return (
                    <div key={row.state} style={styles.stackedRow}>
                      <div style={styles.stackedLabel}>{row.state}</div>
                      <div style={styles.stackedTrack}>
                        <div style={{ width: `${(row.tier1 / total) * 100}%`, background: '#38bdf8', height: '100%' }} title={`Tier 1: ${row.tier1}`} />
                        <div style={{ width: `${(row.tier2 / total) * 100}%`, background: '#a78bfa', height: '100%' }} title={`Tier 2: ${row.tier2}`} />
                        <div style={{ width: `${(row.tier3 / total) * 100}%`, background: '#34d399', height: '100%' }} title={`Tier 3: ${row.tier3}`} />
                      </div>
                      <div style={styles.stackedTotal}>{fmt(total)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Time-Wise Multi-Dimensional Heatmap */}
      <div className="glass-panel" style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <TrendingUp size={16} color="var(--primary)" />
          <h3 style={styles.sectionTitle}>Time-Wise Multi-Dimensional Heatmap</h3>
          <button
            onClick={() => setHeatmapDimension(heatmapDimension === 'category' ? 'color' : 'category')}
            style={styles.toggleBtn}
          >
            {heatmapDimension === 'category' ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
            <span>{heatmapDimension === 'category' ? 'By Category' : 'By Color'}</span>
          </button>
        </div>
        {heatmapLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <RefreshCw size={20} className="spin-loader" color="var(--primary)" />
          </div>
        ) : heatmapData && heatmapData.heatmapRows && heatmapData.heatmapRows.length > 0 ? (
          <>
            <div style={styles.heatmapScaleRow}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Low</span>
              <div style={styles.heatmapScale} />
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>High</span>
            </div>
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: '2px' }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: '140px' }}>{heatmapDimension === 'category' ? 'Category' : 'Color'}</th>
                    {heatmapData.months.map((m) => (
                      <th key={m} className="text-center" style={{ minWidth: '52px', fontSize: '0.72rem' }}>{m}</th>
                    ))}
                    <th className="text-center" style={{ fontWeight: '700' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {heatmapData.heatmapRows.map((row) => (
                    <tr key={row.label}>
                      <td style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '0.8rem' }}>{row.label}</td>
                      {row.months.map((count, mIdx) => (
                        <td
                          key={mIdx}
                          className="text-center"
                          style={{
                            background: getHeatColor(count, heatmapData.maxCount),
                            color: count > heatmapData.maxCount * 0.5 ? '#0f172a' : '#d1d5db',
                            fontWeight: count > 0 ? '600' : '400',
                            fontSize: '0.75rem',
                            borderRadius: '3px',
                            padding: '0.4rem 0.25rem',
                            transition: 'background 0.3s ease',
                          }}
                          title={`${heatmapData.months[mIdx]}: ${count} orders`}
                        >
                          {count > 0 ? count : ''}
                        </td>
                      ))}
                      <td className="text-center" style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '0.82rem', background: 'rgba(255,255,255,0.03)' }}>
                        {fmt(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem', fontSize: '0.85rem' }}>No heatmap data available. Apply filters and try again.</p>
        )}
      </div>
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
  twoCol: { display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.25rem' },
  sectionCard: { padding: '1.25rem' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' },
  sectionTitle: { fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)', margin: 0, flex: 1 },
  badge: {
    fontSize: '0.7rem', color: 'var(--primary)', background: 'rgba(6, 182, 212, 0.08)',
    border: '1px solid rgba(6, 182, 212, 0.15)', padding: '0.15rem 0.5rem', borderRadius: '12px',
  },
  tableWrap: { maxHeight: '400px', overflowY: 'auto' },
  sizeBadge: {
    fontSize: '0.7rem', color: '#fcd34d', background: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.15)', padding: '0.1rem 0.35rem', borderRadius: '4px',
  },
  colorBadge: {
    fontSize: '0.7rem', color: '#c4b5fd', background: 'rgba(139, 92, 246, 0.08)',
    border: '1px solid rgba(139, 92, 246, 0.15)', padding: '0.1rem 0.35rem', borderRadius: '4px',
  },
  cityList: { display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  cityRow: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  cityRank: {
    width: '28px', height: '28px', borderRadius: '6px',
    background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', flexShrink: 0,
  },
  cityInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' },
  cityName: { fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: '500' },
  cityBar: {
    height: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px',
    border: '1px solid var(--border-light)', overflow: 'hidden',
  },
  cityStats: { textAlign: 'right', flexShrink: 0 },
  legendRow: { display: 'flex', gap: '1.25rem', marginBottom: '0.75rem' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--text-muted)' },
  legendDot: { width: '10px', height: '10px', borderRadius: '3px' },
  stackedChartContainer: { display: 'flex', flexDirection: 'column', gap: '0.45rem' },
  stackedRow: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  stackedLabel: { width: '120px', fontSize: '0.75rem', color: '#d1d5db', textAlign: 'right', flexShrink: 0 },
  stackedTrack: {
    flex: 1, height: '20px', display: 'flex', borderRadius: '4px', overflow: 'hidden',
    border: '1px solid var(--border-light)',
  },
  stackedTotal: { width: '60px', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '600', flexShrink: 0 },
  toggleBtn: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)',
    borderRadius: '6px', padding: '0.3rem 0.65rem', color: 'var(--primary)',
    fontSize: '0.72rem', fontWeight: '500', cursor: 'pointer',
  },
  heatmapScaleRow: {
    display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem',
    justifyContent: 'flex-end',
  },
  heatmapScale: {
    width: '120px', height: '10px', borderRadius: '5px',
    background: 'linear-gradient(90deg, rgba(255,255,255,0.02), #e0f7fa, #80cbc4, #26a69a, #004d40)',
    border: '1px solid var(--border-light)',
  },
};
