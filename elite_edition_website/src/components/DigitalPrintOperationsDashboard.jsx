import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Printer,
  Flame,
  Layers,
  Zap,
  Users,
  Building,
  Truck,
  Droplets,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  RefreshCw,
  ArrowRight,
  Receipt,
  Download,
  AlertCircle,
  Activity,
  BarChart3,
  ShieldCheck,
  Package
} from 'lucide-react';
import { api } from '../services/api';
import DateRangePicker, { getDatePresetRange } from './DateRangePicker';

const fmtINR = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtMtr = (n) => `${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m`;

export default function DigitalPrintOperationsDashboard({ onNavigateDepartment }) {
  const [datePreset, setDatePreset] = useState('today');
  const [dateStart, setDateStart] = useState(() => getDatePresetRange('today').dateStart);
  const [dateEnd, setDateEnd] = useState(() => getDatePresetRange('today').dateEnd);
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [shift, setShift] = useState('All');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.getDigitalPrintDashboard({
        dateStart,
        dateEnd,
        shift
      });
      if (res && res.success) {
        setData(res);
        setLastRefreshed(new Date());
      } else {
        setError(res?.error || 'Failed to fetch operations dashboard.');
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err.message || 'Error loading dashboard.');
    } finally {
      setLoading(false);
    }
  }, [dateStart, dateEnd, shift]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Periodic background refresh every 60 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      fetchDashboardData();
    }, 60000);
    return () => clearInterval(timer);
  }, [fetchDashboardData]);

  const summary = data?.summary || {};
  const printing = data?.printing || {};
  const fusing = data?.fusing || {};
  const pipeline = data?.pipeline || {};
  const rawMaterials = data?.rawMaterials || {};
  const fabric = data?.fabric || {};
  const financialPulse = data?.financialPulse || {};
  const quality = data?.quality || {};

  const isTodayPlus = summary.isTodayPlus ?? true;

  return (
    <div style={{
      maxWidth: '1440px',
      margin: '0 auto',
      padding: '0.5rem 0.25rem 2rem',
      color: '#141824',
      fontFamily: 'inherit'
    }}>
      {/* ── Phoenix Hero Grid (Left: Header, 3 Badges, Velocity Chart; Right: 4 Smart KPI Cards) ── */}
      <div className="phoenix-hero-row">
        {/* LEFT COLUMN: Overview, 3 Iconic Badges, and Velocity Chart */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Header Title & Subtitle */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <h2 className="phoenix-page-title" style={{ margin: '0 0 0.25rem 0' }}>Digital Print Operations Dashboard</h2>
                <h5 className="phoenix-page-subtitle" style={{ margin: 0 }}>Real-time operations command center across Printing, Fusing, Dispatch & Financials</h5>
              </div>

              {/* Phoenix Filters Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <DateRangePicker
                  preset={datePreset}
                  onChange={({ preset: p, dateStart: ds, dateEnd: de }) => {
                    setDatePreset(p);
                    setDateStart(ds);
                    setDateEnd(de);
                  }}
                  customStart={customDateStart}
                  customEnd={customDateEnd}
                  onCustomChange={(s, e) => {
                    setCustomDateStart(s);
                    setCustomDateEnd(e);
                    setDateStart(s);
                    setDateEnd(e);
                  }}
                  theme="light"
                />

                <select
                  value={shift}
                  onChange={e => setShift(e.target.value)}
                  className="phoenix-form-select"
                >
                  <option value="All">All Shifts</option>
                  <option value="Morning">Morning Shift</option>
                  <option value="Night">Night Shift</option>
                </select>

                <button
                  type="button"
                  onClick={fetchDashboardData}
                  title={`Last refreshed at ${lastRefreshed.toLocaleTimeString()}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.45rem 0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd0dd',
                    background: '#ffffff',
                    color: '#3874ff',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <RefreshCw size={14} className={loading ? 'spin-loader' : ''} />
                  <span>Refresh</span>
                </button>

                {onNavigateDepartment && (
                  <button
                    type="button"
                    onClick={() => onNavigateDepartment('list')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.45rem 0.95rem',
                      borderRadius: '6px',
                      border: '1px solid #3874ff',
                      background: '#3874ff',
                      color: '#ffffff',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      boxShadow: '0 2px 4px rgba(56, 116, 255, 0.25)'
                    }}
                  >
                    <Layers size={14} />
                    <span>Job Cards</span>
                  </button>
                )}
              </div>
            </div>

            {/* 3 Iconic Phoenix Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              {/* Badge 1: Print Orders / Output Today */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => onNavigateDepartment?.('printing_log')}>
                <div style={{ position: 'relative', width: '42px', height: '42px', flexShrink: 0 }}>
                  <div style={{
                    position: 'absolute',
                    width: '30px',
                    height: '30px',
                    background: '#e8f7ee',
                    borderRadius: '6px',
                    transform: 'rotate(-10deg) translate(2px, 6px)'
                  }} />
                  <div style={{
                    position: 'absolute',
                    width: '30px',
                    height: '30px',
                    background: '#25b003',
                    borderRadius: '50%',
                    right: '0',
                    top: '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    boxShadow: '0 2px 6px rgba(37, 176, 3, 0.3)'
                  }}>
                    <span style={{ fontSize: '13px' }}>★</span>
                  </div>
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#141824', lineHeight: 1.2 }}>
                    {summary.dailyPrintedJobs || 0} Print Orders
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#6e7891', fontWeight: 500 }}>
                    {summary.dailyPrintedMeters ? `${fmtMtr(summary.dailyPrintedMeters)} printed today` : 'Awaiting print run'}
                  </p>
                </div>
              </div>

              {/* Badge 2: Fusing Queue / Pending Fusing */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => onNavigateDepartment?.('fusing')}>
                <div style={{ position: 'relative', width: '42px', height: '42px', flexShrink: 0 }}>
                  <div style={{
                    position: 'absolute',
                    width: '30px',
                    height: '30px',
                    background: '#fdf3e6',
                    borderRadius: '6px',
                    transform: 'rotate(-10deg) translate(2px, 6px)'
                  }} />
                  <div style={{
                    position: 'absolute',
                    width: '30px',
                    height: '30px',
                    background: '#e5780b',
                    borderRadius: '50%',
                    right: '0',
                    top: '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    boxShadow: '0 2px 6px rgba(229, 120, 11, 0.3)'
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 900 }}>❚❚</span>
                  </div>
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#141824', lineHeight: 1.2 }}>
                    {summary.pendingFusingCards || 0} Fusing Queue
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#6e7891', fontWeight: 500 }}>
                    {summary.pendingFusingMeters ? `${fmtMtr(summary.pendingFusingMeters)} pending fusing` : 'In sync with print'}
                  </p>
                </div>
              </div>

              {/* Badge 3: Dispatch Ready */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => onNavigateDepartment?.('list')}>
                <div style={{ position: 'relative', width: '42px', height: '42px', flexShrink: 0 }}>
                  <div style={{
                    position: 'absolute',
                    width: '30px',
                    height: '30px',
                    background: '#feecee',
                    borderRadius: '6px',
                    transform: 'rotate(-10deg) translate(2px, 6px)'
                  }} />
                  <div style={{
                    position: 'absolute',
                    width: '30px',
                    height: '30px',
                    background: '#3874ff',
                    borderRadius: '50%',
                    right: '0',
                    top: '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    boxShadow: '0 2px 6px rgba(56, 116, 255, 0.3)'
                  }}>
                    <span style={{ fontSize: '13px', fontWeight: 900 }}>✓</span>
                  </div>
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#141824', lineHeight: 1.2 }}>
                    {pipeline.readyForDelivery?.count || 0} Ready for Dispatch
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#6e7891', fontWeight: 500 }}>
                    {pipeline.readyForDelivery?.meters ? `${fmtMtr(pipeline.readyForDelivery?.meters)} ready for dispatch` : 'Packaged & verified'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e3e6ed', margin: '0.5rem 0 1.25rem 0' }} />

          {/* Velocity Line Chart Card */}
          <div className="phoenix-card" style={{ padding: '1.35rem 1.4rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, color: '#141824' }}>Production & Delivery Velocity</h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#6e7891' }}>Real-time printing output vs. fusing & dispatch velocity</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: '#525b75', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '12px', height: '3px', background: '#3874ff', borderRadius: '2px', display: 'inline-block' }} />
                    <span>Printing Output</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '12px', height: '2px', borderTop: '2px dashed #0097eb', display: 'inline-block' }} />
                    <span>Fusing & Dispatch</span>
                  </div>
                </div>
                <select className="phoenix-form-select" style={{ fontSize: '0.78rem', padding: '0.35rem 1.8rem 0.35rem 0.75rem' }}>
                  <option>This Month (MTD)</option>
                  <option>Last 30 Days</option>
                  <option>Quarter to Date</option>
                </select>
              </div>
            </div>

            {/* SVG Line Chart 1:1 with ECharts styling and gradient fill */}
            <div style={{ width: '100%', height: '260px', position: 'relative' }}>
              <svg viewBox="0 0 900 230" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="phoenixPrintArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3874ff" stopOpacity="0.28" />
                    <stop offset="70%" stopColor="#3874ff" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#3874ff" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="phoenixFusingArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0097eb" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#0097eb" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines */}
                <line x1="0" y1="40" x2="900" y2="40" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3,3" />
                <line x1="0" y1="90" x2="900" y2="90" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3,3" />
                <line x1="0" y1="140" x2="900" y2="140" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3,3" />
                <line x1="0" y1="190" x2="900" y2="190" stroke="#e2e8f0" strokeWidth="1.2" />

                {/* Vertical subtle guides */}
                <line x1="0" y1="20" x2="0" y2="190" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="225" y1="20" x2="225" y2="190" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="450" y1="20" x2="450" y2="190" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="675" y1="20" x2="675" y2="190" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="900" y1="20" x2="900" y2="190" stroke="#f1f5f9" strokeWidth="1" />

                {/* Dashed Secondary Line (Fusing & Dispatch Velocity) with Area Fill */}
                <path
                  d="M 0 170 Q 75 185, 150 160 T 300 165 T 450 155 Q 525 100, 600 75 T 750 130 T 900 145 L 900 190 L 0 190 Z"
                  fill="url(#phoenixFusingArea)"
                />
                <path
                  d="M 0 170 Q 75 185, 150 160 T 300 165 T 450 155 Q 525 100, 600 75 T 750 130 T 900 145"
                  fill="none"
                  stroke="#0097eb"
                  strokeWidth="2.2"
                  strokeDasharray="4,4"
                />

                {/* Solid Primary Line (Daily Printing Output) with Area Gradient */}
                <path
                  d="M 0 180 Q 80 140, 160 140 T 320 150 Q 400 130, 480 95 Q 560 55, 640 100 T 800 135 L 900 140 L 900 190 L 0 190 Z"
                  fill="url(#phoenixPrintArea)"
                />
                <path
                  d="M 0 180 Q 80 140, 160 140 T 320 150 Q 400 130, 480 95 Q 560 55, 640 100 T 800 135 L 900 140"
                  fill="none"
                  stroke="#3874ff"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Key data dots */}
                <circle cx="160" cy="140" r="4" fill="#3874ff" stroke="#ffffff" strokeWidth="2" />
                <circle cx="480" cy="95" r="4" fill="#3874ff" stroke="#ffffff" strokeWidth="2" />
                <circle cx="640" cy="100" r="4.5" fill="#3874ff" stroke="#ffffff" strokeWidth="2.5" />
                <circle cx="800" cy="135" r="4" fill="#3874ff" stroke="#ffffff" strokeWidth="2" />

                <circle cx="600" cy="75" r="3.5" fill="#0097eb" stroke="#ffffff" strokeWidth="2" />
              </svg>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#6e7891', marginTop: '2px', fontWeight: 600 }}>
                <span>01 {new Date().toLocaleString('default', { month: 'short' })}</span>
                <span>08 {new Date().toLocaleString('default', { month: 'short' })}</span>
                <span>15 {new Date().toLocaleString('default', { month: 'short' })}</span>
                <span>22 {new Date().toLocaleString('default', { month: 'short' })}</span>
                <span>30 {new Date().toLocaleString('default', { month: 'short' })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 4 Smart KPI Cards in 2x2 Grid with Micro Visualizations */}
        <div className="phoenix-kpi-grid">
          {/* Card 1: Daily Printing Output */}
          <div
            onClick={() => onNavigateDepartment?.('printing_log')}
            className="phoenix-kpi-card"
            style={{ cursor: onNavigateDepartment ? 'pointer' : 'default' }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                <div>
                  <h5 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#141824' }}>
                    Daily Printing
                  </h5>
                  <span style={{ fontSize: '0.72rem', color: '#6e7891', fontWeight: 500 }}>Active Print Line</span>
                </div>
                <span className="badge-phoenix badge-phoenix-primary">
                  {summary.dailyPrintedJobs || 0} Jobs
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '0.5rem 0' }}>
                <span style={{ fontSize: '1.65rem', fontWeight: 900, color: '#3874ff', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {fmtMtr(summary.dailyPrintedMeters)}
                </span>
              </div>
            </div>

            {/* Micro Visualization: Target Progress Arc */}
            <div style={{ padding: '0.65rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: '90px', height: '52px', overflow: 'hidden' }}>
                <svg viewBox="0 0 100 55" style={{ width: '100%', height: '100%' }}>
                  <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#eff2f6" strokeWidth="8" strokeLinecap="round" />
                  <path d="M 10 50 A 40 40 0 0 1 70 20" fill="none" stroke="#3874ff" strokeWidth="8" strokeLinecap="round" />
                </svg>
                <div style={{ position: 'absolute', bottom: '0', left: 0, right: 0, textAlign: 'center', fontSize: '0.68rem', fontWeight: 800, color: '#3874ff' }}>
                  {Math.round(((summary.dailyPrintedMeters || 0) / 10000) * 100)}% Target
                </div>
              </div>
            </div>

            {/* Bullets Detail */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderTop: '1px solid #f1f5f9', paddingTop: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#525b75' }}>
                  <span className="phoenix-bullet-item" style={{ background: '#3874ff' }} />
                  <span>Month-to-Date</span>
                </div>
                <strong style={{ color: '#141824' }}>{fmtMtr(summary.monthPrintedMeters)}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#525b75' }}>
                  <span className="phoenix-bullet-item" style={{ background: '#cbd0dd' }} />
                  <span>Daily Target</span>
                </div>
                <strong style={{ color: '#6e7891' }}>10,000m</strong>
              </div>
            </div>
          </div>

          {/* Card 2: Fusing & Heat Press */}
          <div
            onClick={() => onNavigateDepartment?.('fusing')}
            className="phoenix-kpi-card"
            style={{ cursor: onNavigateDepartment ? 'pointer' : 'default' }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                <div>
                  <h5 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#141824' }}>
                    Fusing & Heat Press
                  </h5>
                  <span style={{ fontSize: '0.72rem', color: '#6e7891', fontWeight: 500 }}>Curing & Finishing</span>
                </div>
                <span className="badge-phoenix badge-phoenix-warning">
                  {summary.pendingFusingCards || 0} Pending
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '0.5rem 0' }}>
                <span style={{ fontSize: '1.65rem', fontWeight: 900, color: '#e5780b', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {fmtMtr(summary.dailyFusedMeters)}
                </span>
              </div>
            </div>

            {/* Micro Visualization: Mini 7-Bar Chart */}
            <div style={{ padding: '0.65rem 0', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '6px', height: '52px' }}>
              {[35, 55, 40, 75, 60, 90, 45].map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: '8px',
                    height: `${h * 0.45}px`,
                    background: i === 5 ? '#e5780b' : '#fdf3e6',
                    borderRadius: '2px',
                    border: i === 5 ? 'none' : '1px solid #fed7aa'
                  }}
                  title={`Day ${i+1}`}
                />
              ))}
            </div>

            {/* Bullets Detail */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderTop: '1px solid #f1f5f9', paddingTop: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#525b75' }}>
                  <span className="phoenix-bullet-item" style={{ background: '#e5780b' }} />
                  <span>Pending Queue</span>
                </div>
                <strong style={{ color: '#e5780b' }}>{fmtMtr(summary.pendingFusingMeters)}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#525b75' }}>
                  <span className="phoenix-bullet-item" style={{ background: '#fed7aa' }} />
                  <span>Queue Sync</span>
                </div>
                <strong style={{ color: summary.pendingFusingCards > 0 ? '#e5780b' : '#25b003' }}>
                  {summary.pendingFusingCards > 0 ? 'Active Queue' : 'Synchronized'}
                </strong>
              </div>
            </div>
          </div>

          {/* Card 3: Ready for Dispatch */}
          <div
            onClick={() => onNavigateDepartment?.('list')}
            className="phoenix-kpi-card"
            style={{ cursor: onNavigateDepartment ? 'pointer' : 'default' }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                <div>
                  <h5 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#141824' }}>
                    Ready for Dispatch
                  </h5>
                  <span style={{ fontSize: '0.72rem', color: '#6e7891', fontWeight: 500 }}>Packaging & QA</span>
                </div>
                <span className="badge-phoenix badge-phoenix-success">
                  {pipeline.readyForDelivery?.count || 0} Finished
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '0.5rem 0' }}>
                <span style={{ fontSize: '1.65rem', fontWeight: 900, color: '#25b003', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {fmtMtr(pipeline.readyForDelivery?.meters || 0)}
                </span>
              </div>
            </div>

            {/* Micro Visualization: Mini Donut Chart */}
            <div style={{ padding: '0.65rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: '52px', height: '52px' }}>
                <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e8f7ee" strokeWidth="4" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" strokeDasharray="82, 100" fill="none" stroke="#25b003" strokeWidth="4" strokeLinecap="round" />
                </svg>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, color: '#25b003' }}>
                  ✓
                </div>
              </div>
            </div>

            {/* Bullets Detail */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderTop: '1px solid #f1f5f9', paddingTop: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#525b75' }}>
                  <span className="phoenix-bullet-item" style={{ background: '#25b003' }} />
                  <span>Delivered MTD</span>
                </div>
                <strong style={{ color: '#141824' }}>{pipeline.delivered?.count || 0} Cards</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#525b75' }}>
                  <span className="phoenix-bullet-item" style={{ background: '#86efac' }} />
                  <span>QC Cleared</span>
                </div>
                <strong style={{ color: '#25b003' }}>100% Passed</strong>
              </div>
            </div>
          </div>

          {/* Card 4: Financial Net Pulse */}
          <div
            onClick={() => onNavigateDepartment?.('costing')}
            className="phoenix-kpi-card"
            style={{ cursor: onNavigateDepartment ? 'pointer' : 'default' }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                <div>
                  <h5 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#141824' }}>
                    Financial Net Pulse
                  </h5>
                  <span style={{ fontSize: '0.72rem', color: '#6e7891', fontWeight: 500 }}>Today Net Billed</span>
                </div>
                <span className={`badge-phoenix ${isTodayPlus ? 'badge-phoenix-success' : 'badge-phoenix-danger'}`}>
                  {isTodayPlus ? '+ PLUS' : '- MINUS'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '0.5rem 0' }}>
                <span style={{ fontSize: '1.65rem', fontWeight: 900, color: isTodayPlus ? '#25b003' : '#fa3b1d', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {fmtINR(summary.todayBilledRevenue)}
                </span>
              </div>
            </div>

            {/* Micro Visualization: Mini Sparkline */}
            <div style={{ padding: '0.65rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '100px', height: '40px' }}>
                <svg viewBox="0 0 100 40" style={{ width: '100%', height: '100%' }}>
                  <path d="M 0 35 Q 25 15, 50 25 T 100 8 L 100 40 L 0 40 Z" fill={isTodayPlus ? 'rgba(37, 176, 3, 0.12)' : 'rgba(250, 59, 29, 0.12)'} />
                  <path d="M 0 35 Q 25 15, 50 25 T 100 8" fill="none" stroke={isTodayPlus ? '#25b003' : '#fa3b1d'} strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* Bullets Detail */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderTop: '1px solid #f1f5f9', paddingTop: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#525b75' }}>
                  <span className="phoenix-bullet-item" style={{ background: '#fa3b1d' }} />
                  <span>Today Exp</span>
                </div>
                <strong style={{ color: '#fa3b1d' }}>{fmtINR(summary.todayExpenses)}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#525b75' }}>
                  <span className="phoenix-bullet-item" style={{ background: '#3874ff' }} />
                  <span>Month Rev</span>
                </div>
                <strong style={{ color: '#3874ff' }}>{fmtINR(summary.monthBilledRevenue)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* ── SECTION 1: PRINTING MACHINES & SHIFT ANALYTICS ──────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', marginBottom: '1.75rem' }}>
        
        {/* Machine Breakdown */}
        <div className="phoenix-card" style={{ padding: '1.4rem 1.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#141824', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Printer size={18} color="#2563eb" /> Machine-Wise Production
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                {printing.machineBreakdown?.length || 0} Active Machines
              </span>
              {onNavigateDepartment && (
                <button
                  type="button"
                  onClick={() => onNavigateDepartment('printing_log')}
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #e3e6ed',
                    color: '#2563eb',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Log Entry →
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {(!printing.machineBreakdown || printing.machineBreakdown.length === 0) ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                No machine print logs recorded for this period.
              </div>
            ) : (
              printing.machineBreakdown.map((m, idx) => (
                <div key={idx} style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>{m.machineName}</span>
                    <span style={{ fontWeight: 900, fontSize: '0.95rem', color: '#2563eb' }}>{fmtMtr(m.meters)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#64748b', marginBottom: '0.4rem' }}>
                    <span>{m.jobsCount} logs recorded</span>
                    <span>{m.pct}% of total</span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(m.pct, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #2563eb)', borderRadius: '999px' }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Shift Breakdown & Operator Leaderboard */}
        <div className="phoenix-card" style={{ padding: '1.4rem 1.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#141824', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={18} color="#2563eb" /> Shifts & Operator Leaderboard
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Shift Efficiency</span>
          </div>

          {/* Shift split boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            {['Morning', 'Night'].map(sName => {
              const sObj = printing.shiftBreakdown?.find(s => s.shift.toLowerCase() === sName.toLowerCase()) || { meters: 0, jobsCount: 0 };
              return (
                <div key={sName} style={{ background: '#eff6ff', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #e3e6ed' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1d4ed8' }}>{sName === 'Morning' ? '☀️ Morning Shift' : '🌙 Night Shift'}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#141824', marginTop: '2px' }}>{fmtMtr(sObj.meters)}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{sObj.jobsCount} logs recorded</div>
                </div>
              );
            })}
          </div>

          {/* Operator Leaderboard List */}
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>
            Top Operators
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
            {(!printing.operatorLeaderboard || printing.operatorLeaderboard.length === 0) ? (
              <div style={{ color: '#64748b', fontSize: '0.8rem' }}>No operator logs recorded.</div>
            ) : (
              printing.operatorLeaderboard.map((op, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>
                    {i + 1}. {op.operatorName}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#2563eb' }}>
                    {fmtMtr(op.meters)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 2: PRODUCTION PIPELINE STAGES ────────────────────────────── */}
      <div className="phoenix-card" style={{
        padding: '1.4rem 1.6rem',
        marginBottom: '1.75rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#141824', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} color="#2563eb" /> Active Job Cards Production Pipeline
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              End-to-end movement of fabric orders through Printing, Fusing, QA and Dispatch
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', background: '#eff6ff', color: '#1d4ed8', padding: '4px 12px', borderRadius: '999px', fontWeight: 800 }}>
              {pipeline.todayCreated?.count || 0} New Cards Received Today ({fmtMtr(pipeline.todayCreated?.meters || 0)})
            </span>
            {onNavigateDepartment && (
              <button
                type="button"
                onClick={() => onNavigateDepartment('list')}
                style={{
                  background: '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '5px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                View Cards Table →
              </button>
            )}
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem'
        }}>
          {/* Stage 1: Printing Pending */}
          <div style={{ background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '1.1rem' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>1. Print Pending</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', margin: '4px 0' }}>
              {pipeline.pending?.count || 0} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Cards</span>
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#2563eb' }}>{fmtMtr(pipeline.pending?.meters || 0)}</div>
          </div>

          {/* Stage 2: Fusing Pending */}
          <div style={{ background: '#fff7ed', borderRadius: '8px', border: '1px solid #fed7aa', padding: '1.1rem' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#c2410c', textTransform: 'uppercase' }}>2. In Fusing Queue</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ea580c', margin: '4px 0' }}>
              {pipeline.inFusing?.count || 0} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#c2410c' }}>Cards</span>
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ea580c' }}>{fmtMtr(pipeline.inFusing?.meters || 0)}</div>
          </div>

          {/* Stage 3: Ready for Delivery */}
          <div style={{ background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', padding: '1.1rem' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>3. Ready for Dispatch</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#059669', margin: '4px 0' }}>
              {pipeline.readyForDelivery?.count || 0} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#047857' }}>Cards</span>
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#059669' }}>{fmtMtr(pipeline.readyForDelivery?.meters || 0)}</div>
          </div>

          {/* Stage 4: Delivered */}
          <div style={{ background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', padding: '1.1rem' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>4. Dispatched Total</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1d4ed8', margin: '4px 0' }}>
              {pipeline.delivered?.count || 0} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e40af' }}>Cards</span>
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#2563eb' }}>{fmtMtr(pipeline.delivered?.meters || 0)}</div>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: RAW MATERIALS & INK STOCK GAUGES ─────────────────────── */}
      <div className="phoenix-card" style={{
        padding: '1.4rem 1.6rem',
        marginBottom: '1.75rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#141824', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Droplets size={18} color="#2563eb" /> Live Ink Levels & Raw Materials Health
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Current factory ink canister levels (CMYK Liters) and sublimation paper stock
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', fontWeight: 700, flexWrap: 'wrap' }}>
            <span style={{ background: '#eff6ff', color: '#2563eb', padding: '4px 10px', borderRadius: '8px', border: '1px solid #e3e6ed' }}>
              📜 Paper Rolls: {rawMaterials.inkStock?.paperRolls || 0} Rolls in Stock
            </span>
            <span style={{ background: '#f0fdf4', color: '#15803d', padding: '4px 10px', borderRadius: '8px', border: '1px solid #e3e6ed' }}>
              💧 Today Consumed: {rawMaterials.todayInkConsumed || 0} L
            </span>
            {onNavigateDepartment && (
              <button
                type="button"
                onClick={() => onNavigateDepartment('raw_materials')}
                style={{
                  background: '#eff6ff',
                  border: '1px solid #e3e6ed',
                  color: '#2563eb',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Inks & Stock Manager →
              </button>
            )}
          </div>
        </div>

        {/* Grando Ink Canisters */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e40af', marginBottom: '0.5rem' }}>
            🖨️ GRANDO INK CANISTERS (LITERS)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
            {[
              { code: 'C', name: 'Cyan (C)', color: '#0284c7', bg: '#e0f2fe', val: rawMaterials.inkStock?.grando?.C || 0 },
              { code: 'M', name: 'Magenta (M)', color: '#db2777', bg: '#fce7f3', val: rawMaterials.inkStock?.grando?.M || 0 },
              { code: 'Y', name: 'Yellow (Y)', color: '#ca8a04', bg: '#fef9c3', val: rawMaterials.inkStock?.grando?.Y || 0 },
              { code: 'K', name: 'Black (K)', color: '#1e293b', bg: '#f1f5f9', val: rawMaterials.inkStock?.grando?.K || 0 },
              { code: 'CS', name: 'Cleaning Sol.', color: '#7c3aed', bg: '#ede9fe', val: rawMaterials.inkStock?.grando?.CS || 0 }
            ].map(ink => (
              <div key={ink.code} style={{ background: '#f8fafc', padding: '0.75rem 0.85rem', borderRadius: '12px', border: `1.5px solid ${ink.color}40`, textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: ink.color }}>{ink.name}</span>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: ink.color, marginTop: '2px' }}>
                  {ink.val} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>L</span>
                </div>
                <div style={{ fontSize: '0.68rem', color: ink.val < 3 ? '#dc2626' : '#059669', fontWeight: 700, marginTop: '2px' }}>
                  {ink.val < 3 ? '⚠️ Low Stock' : '✓ Normal'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PrintDot Ink Canisters */}
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e40af', marginBottom: '0.5rem' }}>
            🖨️ PRINTDOT INK CANISTERS (LITERS)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
            {[
              { code: 'C', name: 'Cyan (C)', color: '#0284c7', bg: '#e0f2fe', val: rawMaterials.inkStock?.printdot?.C || 0 },
              { code: 'M', name: 'Magenta (M)', color: '#db2777', bg: '#fce7f3', val: rawMaterials.inkStock?.printdot?.M || 0 },
              { code: 'Y', name: 'Yellow (Y)', color: '#ca8a04', bg: '#fef9c3', val: rawMaterials.inkStock?.printdot?.Y || 0 },
              { code: 'K', name: 'Black (K)', color: '#1e293b', bg: '#f1f5f9', val: rawMaterials.inkStock?.printdot?.K || 0 }
            ].map(ink => (
              <div key={ink.code} style={{ background: '#f8fafc', padding: '0.75rem 0.85rem', borderRadius: '12px', border: `1.5px solid ${ink.color}40`, textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: ink.color }}>{ink.name}</span>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: ink.color, marginTop: '2px' }}>
                  {ink.val} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>L</span>
                </div>
                <div style={{ fontSize: '0.68rem', color: ink.val < 3 ? '#dc2626' : '#059669', fontWeight: 700, marginTop: '2px' }}>
                  {ink.val < 3 ? '⚠️ Low Stock' : '✓ Normal'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 4: FABRIC MOVEMENT & QUALITY PULSE ──────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Fabric Inward & Outward */}
        <div className="phoenix-card" style={{ padding: '1.35rem 1.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#141824', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Package size={18} color="#2563eb" /> Daily Fabric Management
            </h3>
            {onNavigateDepartment && (
              <button
                type="button"
                onClick={() => onNavigateDepartment('fabric')}
                style={{
                  background: '#eff6ff',
                  border: '1px solid #cbd0dd',
                  color: '#2563eb',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Fabric Register →
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ background: '#f0fdf4', padding: '0.85rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#15803d' }}>📥 Fabric Inward Today</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
                {fmtMtr(fabric.inwardMetersToday || 0)}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{fabric.inwardRollsToday || 0} Rolls Received</div>
            </div>

            <div style={{ background: '#eff6ff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1d4ed8' }}>📤 Fabric Issued Today</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#2563eb', marginTop: '2px' }}>
                {fmtMtr(fabric.issuedMetersToday || 0)}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{fabric.issuedRollsToday || 0} Rolls to Production</div>
            </div>
          </div>
        </div>

        {/* Quality & Complaints Status */}
        <div className="phoenix-card" style={{ padding: '1.35rem 1.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#141824', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} color="#2563eb" /> Quality & Complaints Health
            </h3>
            {onNavigateDepartment && (
              <button
                type="button"
                onClick={() => onNavigateDepartment('complaint')}
                style={{
                  background: '#eff6ff',
                  border: '1px solid #e3e6ed',
                  color: '#2563eb',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Complaints Log →
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ background: '#fef2f2', padding: '0.85rem', borderRadius: '12px', border: '1px solid #fecaca' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#b91c1c' }}>⚠️ Open Complaints</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#dc2626', marginTop: '2px' }}>
                {quality.openComplaints || 0}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Active customer complaints</div>
            </div>

            <div style={{ background: '#f0fdf4', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e3e6ed' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#15803d' }}>✓ Resolved Complaints</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
                {quality.resolvedComplaints || 0}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Successfully resolved</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
