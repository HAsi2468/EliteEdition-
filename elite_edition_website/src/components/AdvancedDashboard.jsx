import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  ShoppingBag, 
  Activity, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  Target,
  Clock,
  Layers,
  Sparkles,
  PieChart as PieIcon,
  BarChart2
} from 'lucide-react';

const MONTHLY_PROJECTIONS = [
  { month: 'Apr', projected: 42, actual: 45, variance: '+7.1%' },
  { month: 'May', projected: 48, actual: 52, variance: '+8.3%' },
  { month: 'Jun', projected: 55, actual: 51, variance: '-7.2%' },
  { month: 'Jul', projected: 60, actual: 64, variance: '+6.6%' },
  { month: 'Aug', projected: 68, actual: 72, variance: '+5.8%' },
  { month: 'Sep', projected: 75, actual: 81, variance: '+8.0%' }
];

const RETENTION_COHORTS = [
  { cohort: 'Apr 2026', totalClients: 140, m1: '100%', m2: '78%', m3: '65%', m4: '61%', m5: '58%' },
  { cohort: 'May 2026', totalClients: 165, m1: '100%', m2: '82%', m3: '71%', m4: '67%', m5: '-' },
  { cohort: 'Jun 2026', totalClients: 180, m1: '100%', m2: '85%', m3: '74%', m4: '-', m5: '-' },
  { cohort: 'Jul 2026', totalClients: 210, m1: '100%', m2: '89%', m3: '-', m4: '-', m5: '-' },
  { cohort: 'Aug 2026', totalClients: 235, m1: '100%', m2: '-', m3: '-', m4: '-', m5: '-' }
];

export default function AdvancedDashboard() {
  const [selectedTimeframe, setSelectedTimeframe] = useState('H1-2026');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-main)', color: 'var(--text-primary)', overflowY: 'auto', padding: '1.5rem', gap: '1.5rem' }}>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid var(--border-light)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #3874ff 0%, #00d2ff 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(56,116,255,0.3)'
          }}>
            <BarChart2 size={22} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>Advanced Analytics & Projections</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Phoenix-grade revenue projections, customer retention cohorts, and production velocity
            </p>
          </div>
        </div>

        {/* Timeframe Selector */}
        <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 8, padding: '3px' }}>
          {['This Month', 'Q3 Forecast', 'H1-2026', 'YTD'].map(tf => (
            <button
              key={tf}
              onClick={() => setSelectedTimeframe(tf)}
              style={{
                border: 'none',
                background: selectedTimeframe === tf ? 'var(--primary)' : 'transparent',
                color: selectedTimeframe === tf ? '#fff' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.78rem',
                padding: '5px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 12, padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actual vs Target</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center' }}>
              +8.0% Beats Target <ArrowUpRight size={14} />
            </span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, marginTop: '0.5rem' }}>₹365.0 Lakhs</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Target: ₹348.0 Lakhs (104.8% achievement)
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 12, padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Returning Customer Rate</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#3874ff', display: 'flex', alignItems: 'center' }}>
              84.2% Loyal <Sparkles size={13} style={{ marginLeft: 3 }} />
            </span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, marginTop: '0.5rem' }}>84.2%</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            +4.6% improvement over previous quarter
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 12, padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Average Job Cycle SLA</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981' }}>-14h Faster</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, marginTop: '0.5rem' }}>3.2 Days</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            From Inward fabric arrival to dispatch
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 12, padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fabric Defect / QA Rate</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981' }}>0.78% (Low)</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, marginTop: '0.5rem' }}>0.78%</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Industry benchmark is 2.50%
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1.5rem' }}>
        {/* Projection vs Actual Bar Comparison Chart */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 14, padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Projection vs Actual Monthly Revenue</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Monthly figures in ₹ Lakhs</span>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 10, height: 10, background: 'var(--primary)', borderRadius: 3 }} />
                <span>Actual</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 10, height: 10, background: 'rgba(56,189,248,0.25)', borderRadius: 3, border: '1px dashed var(--primary)' }} />
                <span>Projected</span>
              </div>
            </div>
          </div>

          {/* Bar Chart Visual */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 240, gap: '1rem', paddingTop: '1rem', borderBottom: '1px solid var(--border-light)' }}>
            {MONTHLY_PROJECTIONS.map((item, idx) => {
              const maxVal = 90;
              const actualH = (item.actual / maxVal) * 100;
              const projH = (item.projected / maxVal) * 100;

              return (
                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: item.actual >= item.projected ? '#10b981' : '#f43f5e' }}>
                    {item.variance}
                  </div>
                  <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '4px', height: '100%' }}>
                    {/* Projected Bar */}
                    <div
                      style={{
                        width: '40%',
                        height: `${projH}%`,
                        background: 'rgba(56, 189, 248, 0.25)',
                        border: '1.5px dashed var(--primary)',
                        borderRadius: '6px 6px 0 0',
                        transition: 'height 0.3s ease'
                      }}
                      title={`Projected: ₹${item.projected}L`}
                    />
                    {/* Actual Bar */}
                    <div
                      style={{
                        width: '40%',
                        height: `${actualH}%`,
                        background: 'linear-gradient(180deg, var(--primary) 0%, #1e40af 100%)',
                        borderRadius: '6px 6px 0 0',
                        boxShadow: '0 4px 10px rgba(56,116,255,0.25)',
                        transition: 'height 0.3s ease'
                      }}
                      title={`Actual: ₹${item.actual}L`}
                    />
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)' }}>{item.month}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span>*Based on historical orders, seasonality indices and capacity forecast</span>
            <span style={{ fontWeight: 800, color: '#10b981' }}>Average Variance: +4.8% above plan</span>
          </div>
        </div>

        {/* Fabric & Product Category Split */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 14, padding: '1.5rem', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 800 }}>Production Volume by Fabric</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, justifyContent: 'center' }}>
            {[
              { label: 'Pure Silk & Silk Blends', pct: 42, meters: '184,000m', color: '#3874ff' },
              { label: 'Viscose Georgette / Modal', pct: 28, meters: '122,500m', color: '#00d2ff' },
              { label: 'Cotton Satin & Cambric', pct: 18, meters: '78,900m', color: '#10b981' },
              { label: 'Organza & Chiffon Dupattas', pct: 8, meters: '35,000m', color: '#f59e0b' },
              { label: 'Denim & Speciality Coatings', pct: 4, meters: '17,500m', color: '#ec4899' }
            ].map((f, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, marginBottom: 4 }}>
                  <span>{f.label}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{f.meters} ({f.pct}%)</span>
                </div>
                <div style={{ width: '100%', height: 7, background: 'var(--bg-input)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${f.pct}%`, height: '100%', background: f.color, borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Customer Retention Cohort Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Customer Retention & Reorder Cohorts</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Percentage of clients placing repeat orders month-over-month</span>
          </div>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
            High Repeat Rate (84%)
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '0.75rem 1.25rem' }}>Cohort Group</th>
                <th style={{ padding: '0.75rem 1rem' }}>New Accounts</th>
                <th style={{ padding: '0.75rem 1rem' }}>Month 1</th>
                <th style={{ padding: '0.75rem 1rem' }}>Month 2</th>
                <th style={{ padding: '0.75rem 1rem' }}>Month 3</th>
                <th style={{ padding: '0.75rem 1rem' }}>Month 4</th>
                <th style={{ padding: '0.75rem 1rem' }}>Month 5</th>
              </tr>
            </thead>
            <tbody>
              {RETENTION_COHORTS.map((c, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '0.75rem 1.25rem', fontWeight: 800 }}>{c.cohort}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 700 }}>{c.totalClients} Brands</td>
                  {[c.m1, c.m2, c.m3, c.m4, c.m5].map((val, i) => {
                    const num = parseInt(val);
                    const bg = isNaN(num) ? 'transparent' : num >= 80 ? 'rgba(16,185,129,0.18)' : num >= 65 ? 'rgba(56,189,248,0.18)' : 'rgba(251,191,36,0.18)';
                    const color = isNaN(num) ? 'var(--text-muted)' : num >= 80 ? '#10b981' : num >= 65 ? '#0284c7' : '#d97706';
                    return (
                      <td key={i} style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 6, background: bg, color: color, fontWeight: 800, fontSize: '0.75rem' }}>
                          {val}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
