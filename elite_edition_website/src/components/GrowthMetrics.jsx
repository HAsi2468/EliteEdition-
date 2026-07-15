import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  RefreshCw,
  Archive,
  AlertTriangle,
  IndianRupee,
  Clock,
  TrendingDown,
  Package,
  Zap,
} from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtCurrency = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function GrowthMetrics() {
  const [deadStockData, setDeadStockData] = useState(null);
  const [lostRevenueData, setLostRevenueData] = useState(null);
  const [deadStockLoading, setDeadStockLoading] = useState(false);
  const [lostRevenueLoading, setLostRevenueLoading] = useState(false);
  const [thresholdDays, setThresholdDays] = useState('60');

  useEffect(() => { fetchDeadStock(); fetchLostRevenue(); }, []);

  const fetchDeadStock = async () => {
    setDeadStockLoading(true);
    try {
      const res = await api.getDeadStockReport({ thresholdDays });
      if (res && res.success) setDeadStockData(res);
    } catch (err) { console.error('Dead stock error:', err); }
    finally { setDeadStockLoading(false); }
  };

  const fetchLostRevenue = async () => {
    setLostRevenueLoading(true);
    try {
      const res = await api.getLostRevenueEstimate({});
      if (res && res.success) setLostRevenueData(res);
    } catch (err) { console.error('Lost revenue error:', err); }
    finally { setLostRevenueLoading(false); }
  };

  useEffect(() => { fetchDeadStock(); }, [thresholdDays]);

  const getAgeBadge = (days) => {
    if (days >= 90) return { label: `${days}d`, color: '#fca5a5', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.2)' };
    if (days >= 60) return { label: `${days}d`, color: '#fdba74', bg: 'rgba(251, 146, 60, 0.1)', border: 'rgba(251, 146, 60, 0.2)' };
    return { label: `${days}d`, color: '#fcd34d', bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.2)' };
  };

  return (
    <div style={styles.container}>
      {/* ═══════ DEAD STOCK AGEING MONITOR ═══════ */}
      <div className="glass-panel" style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <Archive size={16} color="#fbbf24" />
          <h3 style={styles.sectionTitle}>Dead Stock Ageing Monitor</h3>
          <div style={styles.thresholdSelect}>
            <Clock size={12} color="var(--text-muted)" />
            <select
              value={thresholdDays}
              onChange={(e) => setThresholdDays(e.target.value)}
              style={styles.selectInput}
            >
              <option value="30">30 Days</option>
              <option value="60">60 Days</option>
              <option value="90">90 Days</option>
              <option value="120">120 Days</option>
            </select>
          </div>
          <button onClick={fetchDeadStock} disabled={deadStockLoading} className="btn-secondary" style={styles.refreshBtn}>
            <RefreshCw size={12} className={deadStockLoading ? 'spin-loader' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {deadStockData && (
          <div style={styles.miniStats}>
            <div style={styles.miniStat}>
              <Package size={14} color="#fbbf24" />
              <span style={{ color: '#fbbf24', fontWeight: '700', fontSize: '1.1rem' }}>
                {fmt(deadStockData.totalDeadSkus)}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Dead SKUs (≥{thresholdDays} days)</span>
            </div>
          </div>
        )}

        <div className="table-container" style={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>SKU Code</th>
                <th>Product Name</th>
                <th>Brand</th>
                <th>Category</th>
                <th className="text-center">Price</th>
                <th className="text-center">Current Stock</th>
                <th className="text-center">Days Silent</th>
                <th>Last Sale</th>
              </tr>
            </thead>
            <tbody>
              {deadStockLoading ? (
                <tr>
                  <td colSpan="8" className="text-center" style={{ padding: '3rem' }}>
                    <RefreshCw size={22} className="spin-loader" color="var(--primary)" />
                    <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Scanning inventory...</div>
                  </td>
                </tr>
              ) : !deadStockData || deadStockData.deadStock.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center" style={{ color: 'var(--text-muted)', padding: '2rem' }}>
                    No dead stock found for the selected threshold. 🎉
                  </td>
                </tr>
              ) : (
                deadStockData.deadStock.map((item) => {
                  const badge = getAgeBadge(item.daysSinceLastSale);
                  return (
                    <tr key={item.skuCode}>
                      <td><span style={styles.skuBadge}>{item.skuCode}</span></td>
                      <td style={{ color: '#d1d5db', fontSize: '0.8rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{item.brand}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{item.category}</td>
                      <td className="text-center" style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '0.82rem' }}>
                        {fmtCurrency(item.price)}
                      </td>
                      <td className="text-center" style={{ fontWeight: '600', color: item.currentStock > 0 ? '#67e8f9' : 'var(--text-muted)' }}>
                        {fmt(item.currentStock)}
                      </td>
                      <td className="text-center">
                        <span style={{
                          display: 'inline-flex', padding: '0.15rem 0.45rem', borderRadius: '8px',
                          fontSize: '0.72rem', fontWeight: '600',
                          color: badge.color, background: badge.bg, border: `1px solid ${badge.border}`,
                        }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{item.lastSaleDate}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════ LOST REVENUE ESTIMATOR ═══════ */}
      <div className="glass-panel" style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <TrendingDown size={16} color="#ef4444" />
          <h3 style={styles.sectionTitle}>Lost Revenue Estimator (Stockouts)</h3>
          <button onClick={fetchLostRevenue} disabled={lostRevenueLoading} className="btn-secondary" style={styles.refreshBtn}>
            <RefreshCw size={12} className={lostRevenueLoading ? 'spin-loader' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {lostRevenueData && (
          <div style={styles.miniStats}>
            <div style={styles.miniStat}>
              <IndianRupee size={14} color="#ef4444" />
              <span style={{ color: '#fca5a5', fontWeight: '700', fontSize: '1.1rem' }}>
                {fmtCurrency(lostRevenueData.totalLostRevenue)}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Total Estimated Lost Revenue</span>
            </div>
            <div style={styles.miniStat}>
              <Zap size={14} color="#fbbf24" />
              <span style={{ color: '#fcd34d', fontWeight: '700', fontSize: '1.1rem' }}>
                {fmt(lostRevenueData.totalAffectedSkus)}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Affected SKUs (High-Velocity + OOS)</span>
            </div>
          </div>
        )}

        <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '0.75rem', fontStyle: 'italic' }}>
          Formula: (Trailing 30-Day Avg Daily Velocity) × (Days Out of Stock) × (Avg Unit Price)
        </p>

        <div className="table-container" style={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>SKU Code</th>
                <th>Product</th>
                <th>Brand</th>
                <th className="text-center">Daily Velocity</th>
                <th className="text-center">Days OOS</th>
                <th className="text-center">Unit Price</th>
                <th className="text-center">Estimated Loss</th>
                <th>Last Sale</th>
              </tr>
            </thead>
            <tbody>
              {lostRevenueLoading ? (
                <tr>
                  <td colSpan="8" className="text-center" style={{ padding: '3rem' }}>
                    <RefreshCw size={22} className="spin-loader" color="var(--primary)" />
                    <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Computing revenue impact...</div>
                  </td>
                </tr>
              ) : !lostRevenueData || lostRevenueData.items.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center" style={{ color: 'var(--text-muted)', padding: '2rem' }}>
                    No stockout impact detected. All high-velocity SKUs are in stock. ✅
                  </td>
                </tr>
              ) : (
                lostRevenueData.items.map((item) => (
                  <tr key={item.skuCode}>
                    <td><span style={styles.skuBadge}>{item.skuCode}</span></td>
                    <td style={{ color: '#d1d5db', fontSize: '0.8rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{item.brand}</td>
                    <td className="text-center" style={{ color: '#67e8f9', fontWeight: '600', fontSize: '0.82rem' }}>
                      {item.dailyVelocity}/day
                    </td>
                    <td className="text-center">
                      <span style={{
                        display: 'inline-flex', padding: '0.15rem 0.45rem', borderRadius: '8px',
                        fontSize: '0.72rem', fontWeight: '600',
                        color: '#fca5a5', background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                      }}>
                        {item.daysOutOfStock}d
                      </span>
                    </td>
                    <td className="text-center" style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '0.82rem' }}>
                      {fmtCurrency(item.unitPrice)}
                    </td>
                    <td className="text-center">
                      <span style={{
                        display: 'inline-flex', padding: '0.2rem 0.5rem', borderRadius: '8px',
                        fontSize: '0.78rem', fontWeight: '700',
                        color: item.estimatedLoss > 10000 ? '#fca5a5' : '#fdba74',
                        background: item.estimatedLoss > 10000 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(251, 146, 60, 0.08)',
                        border: item.estimatedLoss > 10000 ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(251, 146, 60, 0.2)',
                      }}>
                        {fmtCurrency(item.estimatedLoss)}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{item.lastSaleDate}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  sectionCard: { padding: '1.25rem' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' },
  sectionTitle: { fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)', margin: 0, flex: 1 },
  refreshBtn: { display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.7rem', fontSize: '0.72rem' },
  thresholdSelect: {
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)',
    borderRadius: '6px', padding: '0.2rem 0.4rem',
  },
  selectInput: {
    background: 'transparent', border: 'none', color: '#d1d5db',
    fontSize: '0.72rem', cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
  },
  miniStats: { display: 'flex', gap: '2rem', marginBottom: '1rem', flexWrap: 'wrap' },
  miniStat: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  tableWrap: { maxHeight: '450px', overflowY: 'auto' },
  skuBadge: {
    fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--primary)',
    background: 'rgba(6, 182, 212, 0.05)', padding: '0.15rem 0.4rem',
    borderRadius: '4px', border: '1px solid rgba(6, 182, 212, 0.1)',
  },
};
