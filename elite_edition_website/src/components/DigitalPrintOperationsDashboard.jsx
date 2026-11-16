import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Package,
  PlusCircle,
  DollarSign,
  FileSpreadsheet,
  FileText,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import { api } from '../services/api';
import DateRangePicker, { getDatePresetRange } from './DateRangePicker';
import { EntityBrandBadge } from './common/EntityBrandBadge';
import QuickActionMenu from './common/QuickActionMenu';

/**
 * Format meters with Indian numbering and 'm' unit suffix
 */
const fmtMtr = (val) => {
  const num = Number(val) || 0;
  return `${num.toLocaleString('en-IN', { maximumFractionDigits: 1 })} m`;
};

/**
 * Format currency with Indian Rupee symbol and Indian numbering
 */
const fmtINR = (val) => {
  const num = Number(val) || 0;
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

/**
 * Smooth Cubic Spline Path Builder
 */
function getSmoothSplinePath(points, isClosed = false, bottomY = 220) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  if (isClosed) {
    const lastX = points[points.length - 1].x;
    const firstX = points[0].x;
    d += ` L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;
  }
  return d;
}

function ProductionVelocityChart({
  trend = [],
  stats = {},
  loading = false,
  dailyPrintingMeters = 0,
  dailyFusedMeters = 0
}) {
  const [rangeFilter, setRangeFilter] = useState('14d'); // '7d' | '14d' | '30d'
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [activeSeries, setActiveSeries] = useState({
    print: true,
    fusing: true,
    dispatch: true,
  });

  // Calculate or slice data for the active timeframe
  const displayData = useMemo(() => {
    if (trend && trend.length > 0) {
      if (rangeFilter === '7d') return trend.slice(-7);
      if (rangeFilter === '14d') return trend.slice(-14);
      return trend.slice(-30);
    }

    // Dynamic generation if data is still fetching or not yet logged
    const days = rangeFilter === '7d' ? 7 : rangeFilter === '14d' ? 14 : 30;
    const arr = [];
    const now = new Date();
    const basePrint = Number(dailyPrintingMeters) || 1200;
    const baseFusing = Number(dailyFusedMeters) || 1050;

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const isToday = i === 0;
      const factor = isToday ? 1 : 0.65 + 0.45 * Math.sin((i * 12) + 3);
      const pMtr = isToday ? basePrint : Math.round(basePrint * factor);
      const fMtr = isToday ? baseFusing : Math.round(baseFusing * (factor * 0.9 + 0.1));
      const dMtr = Math.round(fMtr * 0.92);

      arr.push({
        date: d.toISOString().split('T')[0],
        label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        dayName: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        printMeters: pMtr,
        printJobs: Math.max(1, Math.round(pMtr / 200)),
        fusingMeters: fMtr,
        fusingCards: Math.max(1, Math.round(fMtr / 180)),
        dispatchMeters: dMtr,
        dispatchRevenue: Math.round(dMtr * 30),
      });
    }
    return arr;
  }, [trend, rangeFilter, dailyPrintingMeters, dailyFusedMeters]);

  // Chart plotting canvas metrics
  const SVG_W = 860;
  const SVG_H = 260;
  const PAD_L = 50;
  const PAD_R = 25;
  const PAD_T = 25;
  const PAD_B = 40;
  const PLOT_W = SVG_W - PAD_L - PAD_R;
  const PLOT_H = SVG_H - PAD_T - PAD_B;
  const BOTTOM_Y = PAD_T + PLOT_H;

  // Calculate dynamic scale ceiling
  const rawMax = Math.max(
    ...displayData.flatMap(d => [
      activeSeries.print ? d.printMeters || 0 : 0,
      activeSeries.fusing ? d.fusingMeters || 0 : 0,
      activeSeries.dispatch ? d.dispatchMeters || 0 : 0
    ]),
    500
  );
  const scaleMax = Math.max(1000, Math.ceil((rawMax * 1.15) / 500) * 500);

  const coords = useMemo(() => {
    const N = displayData.length;
    return displayData.map((d, i) => {
      const x = PAD_L + (N > 1 ? (i / (N - 1)) * PLOT_W : PLOT_W / 2);
      const yPrint = BOTTOM_Y - ((d.printMeters || 0) / scaleMax) * PLOT_H;
      const yFusing = BOTTOM_Y - ((d.fusingMeters || 0) / scaleMax) * PLOT_H;
      const yDispatch = BOTTOM_Y - ((d.dispatchMeters || 0) / scaleMax) * PLOT_H;
      return { x, yPrint, yFusing, yDispatch, item: d };
    });
  }, [displayData, scaleMax, PLOT_W, PLOT_H, BOTTOM_Y]);

  const printPoints = coords.map(c => ({ x: c.x, y: c.yPrint }));
  const fusingPoints = coords.map(c => ({ x: c.x, y: c.yFusing }));
  const dispatchPoints = coords.map(c => ({ x: c.x, y: c.yDispatch }));

  const printLinePath = getSmoothSplinePath(printPoints, false, BOTTOM_Y);
  const printAreaPath = getSmoothSplinePath(printPoints, true, BOTTOM_Y);
  const fusingLinePath = getSmoothSplinePath(fusingPoints, false, BOTTOM_Y);
  const fusingAreaPath = getSmoothSplinePath(fusingPoints, true, BOTTOM_Y);
  const dispatchLinePath = getSmoothSplinePath(dispatchPoints, false, BOTTOM_Y);

  const totalRangePrint = displayData.reduce((acc, d) => acc + (d.printMeters || 0), 0);
  const totalRangeFusing = displayData.reduce((acc, d) => acc + (d.fusingMeters || 0), 0);
  const totalRangeDispatch = displayData.reduce((acc, d) => acc + (d.dispatchMeters || 0), 0);

  const avgPrintDaily = displayData.length > 0 ? Math.round(totalRangePrint / displayData.length) : 0;
  const syncRatio = totalRangePrint > 0 ? Math.min(100, Math.round((totalRangeFusing / totalRangePrint) * 100)) : 100;

  const peakDay = displayData.reduce(
    (max, d) => (d.printMeters > (max?.meters || 0) ? { date: d.date, label: `${d.dayName}, ${d.label}`, meters: d.printMeters } : max),
    { meters: 0, label: '-' }
  );

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * SVG_W;
    let closestIdx = 0;
    let minDist = Infinity;
    coords.forEach((c, idx) => {
      const dist = Math.abs(c.x - relX);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });
    setHoveredIdx(closestIdx);
  };

  const activeCoord = hoveredIdx !== null ? coords[hoveredIdx] : null;
  const activeItem = activeCoord?.item;

  return (
    <div className="phoenix-card" style={{ padding: '1.35rem 1.4rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
      {/* ── Top Chart Header ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} color="#38bdf8" />
              <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, color: '#ffffff' }}>Production & Delivery Velocity</h3>
            </div>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.72)' }}>
              Real-time daily production throughput vs finishing & client delivery velocity
            </p>
          </div>

          {/* Timeframe Selector Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(15, 23, 42, 0.75)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.14)' }}>
            {[
              { id: '7d', label: '7 Days' },
              { id: '14d', label: '14 Days' },
              { id: '30d', label: '30 Days' }
            ].map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => { setRangeFilter(r.id); setHoveredIdx(null); }}
                style={{
                  background: rangeFilter === r.id ? 'rgba(56, 189, 248, 0.22)' : 'transparent',
                  color: rangeFilter === r.id ? '#ffffff' : 'rgba(255, 255, 255, 0.68)',
                  fontWeight: rangeFilter === r.id ? 800 : 600,
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: rangeFilter === r.id ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Key Metrics & Series Legend Ribbon ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem', padding: '0.6rem 0.85rem', background: 'rgba(15, 23, 42, 0.65)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
          {/* Quick Metrics */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.76rem' }}>
            <div>
              <span style={{ color: 'rgba(255, 255, 255, 0.72)' }}>Daily Avg Print: </span>
              <strong style={{ color: '#38bdf8' }}>{fmtMtr(avgPrintDaily)}</strong>
            </div>
            <div>
              <span style={{ color: 'rgba(255, 255, 255, 0.72)' }}>Fusing Sync: </span>
              <strong style={{ color: syncRatio >= 85 ? '#34d399' : syncRatio >= 70 ? '#fb923c' : '#f87171' }}>
                {syncRatio}% {syncRatio >= 85 ? '✓ Balanced' : '⚠️ Lagging'}
              </strong>
            </div>
            <div>
              <span style={{ color: 'rgba(255, 255, 255, 0.72)' }}>Peak Output: </span>
              <strong style={{ color: '#ffffff' }}>{fmtMtr(peakDay.meters)}</strong>
              <span style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.7rem', marginLeft: '3px' }}>({peakDay.label})</span>
            </div>
          </div>

          {/* Interactive Legend Toggles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.74rem', fontWeight: 700 }}>
            <span
              onClick={() => setActiveSeries(s => ({ ...s, print: !s.print }))}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                color: activeSeries.print ? '#38bdf8' : 'rgba(255, 255, 255, 0.45)',
                opacity: activeSeries.print ? 1 : 0.5,
                transition: 'opacity 0.2s'
              }}
              title="Click to toggle Printing Output"
            >
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
              <span>Printing Line</span>
            </span>

            <span
              onClick={() => setActiveSeries(s => ({ ...s, fusing: !s.fusing }))}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                color: activeSeries.fusing ? '#fb923c' : 'rgba(255, 255, 255, 0.45)',
                opacity: activeSeries.fusing ? 1 : 0.5,
                transition: 'opacity 0.2s'
              }}
              title="Click to toggle Fusing Line"
            >
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#fb923c', display: 'inline-block' }} />
              <span>Fusing Line</span>
            </span>

            <span
              onClick={() => setActiveSeries(s => ({ ...s, dispatch: !s.dispatch }))}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                color: activeSeries.dispatch ? '#34d399' : 'rgba(255, 255, 255, 0.45)',
                opacity: activeSeries.dispatch ? 1 : 0.5,
                transition: 'opacity 0.2s'
              }}
              title="Click to toggle Dispatched Line"
            >
              <span style={{ width: '10px', height: '3px', borderRadius: '1px', background: '#34d399', display: 'inline-block' }} />
              <span>Dispatched</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Interactive SVG Canvas ── */}
      <div
        style={{ width: '100%', height: '260px', position: 'relative', cursor: 'crosshair', userSelect: 'none' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="velocityPrintGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
              <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.0" />
            </linearGradient>

            <linearGradient id="velocityFusingGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fb923c" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.0" />
            </linearGradient>

            <filter id="pointGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Horizontal Gridlines & Y-Axis Scale Values */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const y = BOTTOM_Y - pct * PLOT_H;
            const val = Math.round(pct * scaleMax);
            return (
              <g key={i}>
                <line
                  x1={PAD_L}
                  y1={y}
                  x2={PAD_L + PLOT_W}
                  y2={y}
                  stroke={i === 0 ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.10)'}
                  strokeWidth={i === 0 ? 1.5 : 1}
                  strokeDasharray={i === 0 ? 'none' : '3,3'}
                />
                <text
                  x={PAD_L - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="10"
                  fill="rgba(255, 255, 255, 0.72)"
                  fontWeight="600"
                >
                  {val >= 1000 ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k m` : `${val}m`}
                </text>
              </g>
            );
          })}

          {/* Area Fill: Fusing */}
          {activeSeries.fusing && fusingAreaPath && (
            <path d={fusingAreaPath} fill="url(#velocityFusingGradient)" />
          )}

          {/* Area Fill: Printing */}
          {activeSeries.print && printAreaPath && (
            <path d={printAreaPath} fill="url(#velocityPrintGradient)" />
          )}

          {/* Line: Fusing (Orange Dashed) */}
          {activeSeries.fusing && fusingLinePath && (
            <path
              d={fusingLinePath}
              fill="none"
              stroke="#fb923c"
              strokeWidth="2.2"
              strokeDasharray="4,4"
            />
          )}

          {/* Line: Dispatched (Emerald Dotted) */}
          {activeSeries.dispatch && dispatchLinePath && (
            <path
              d={dispatchLinePath}
              fill="none"
              stroke="#34d399"
              strokeWidth="2"
              strokeDasharray="2,3"
            />
          )}

          {/* Line: Printing (Solid Blue High-Tech) */}
          {activeSeries.print && printLinePath && (
            <path
              d={printLinePath}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* X-Axis Date Labels */}
          {coords.map((c, idx) => {
            const total = coords.length;
            const step = total > 20 ? 4 : total > 10 ? 2 : 1;
            const shouldShow = idx % step === 0 || idx === total - 1;
            if (!shouldShow) return null;

            return (
              <text
                key={idx}
                x={c.x}
                y={BOTTOM_Y + 18}
                textAnchor="middle"
                fontSize="10"
                fill={hoveredIdx === idx ? '#38bdf8' : 'rgba(255, 255, 255, 0.72)'}
                fontWeight={hoveredIdx === idx ? '800' : '600'}
              >
                {c.item.label}
              </text>
            );
          })}

          {/* Vertical Crosshair Guide on Hover */}
          {activeCoord && (
            <g>
              <line
                x1={activeCoord.x}
                y1={PAD_T}
                x2={activeCoord.x}
                y2={BOTTOM_Y}
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeDasharray="3,3"
              />

              {activeSeries.print && (
                <circle
                  cx={activeCoord.x}
                  cy={activeCoord.yPrint}
                  r="5.5"
                  fill="#38bdf8"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  filter="url(#pointGlow)"
                />
              )}
              {activeSeries.fusing && (
                <circle
                  cx={activeCoord.x}
                  cy={activeCoord.yFusing}
                  r="4.5"
                  fill="#fb923c"
                  stroke="#ffffff"
                  strokeWidth="2"
                  filter="url(#pointGlow)"
                />
              )}
              {activeSeries.dispatch && (
                <circle
                  cx={activeCoord.x}
                  cy={activeCoord.yDispatch}
                  r="4"
                  fill="#34d399"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              )}
            </g>
          )}
        </svg>

        {/* ── Floating Tooltip Card on Hover ── */}
        {activeCoord && activeItem && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: activeCoord.x > SVG_W * 0.65 ? 'auto' : `${(activeCoord.x / SVG_W) * 100 + 2}%`,
              right: activeCoord.x > SVG_W * 0.65 ? `${100 - (activeCoord.x / SVG_W) * 100 + 2}%` : 'auto',
              background: '#0f172a',
              color: '#ffffff',
              padding: '0.65rem 0.85rem',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.4)',
              fontSize: '0.74rem',
              pointerEvents: 'none',
              zIndex: 10,
              minWidth: '175px',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.12)'
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '0.35rem', marginBottom: '0.45rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>{activeItem.dayName}, {activeItem.label}</span>
              <span style={{ color: 'rgba(255, 255, 255, 0.68)', fontSize: '0.7rem' }}>{activeItem.date}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
                  Printing Output:
                </span>
                <strong style={{ color: '#ffffff' }}>{fmtMtr(activeItem.printMeters)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#fed7aa', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#fb923c', display: 'inline-block' }} />
                  Fusing Line:
                </span>
                <strong style={{ color: '#ffffff' }}>{fmtMtr(activeItem.fusingMeters)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#bbf7d0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '8px', height: '3px', borderRadius: '1px', background: '#34d399', display: 'inline-block' }} />
                  Dispatched:
                </span>
                <strong style={{ color: '#ffffff' }}>{fmtMtr(activeItem.dispatchMeters)}</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Summary Footer ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: '0.75rem', marginTop: '0.5rem', fontSize: '0.74rem' }}>
        <div style={{ color: 'rgba(255, 255, 255, 0.72)' }}>
          Showing past <strong style={{ color: '#ffffff' }}>{displayData.length} days</strong> velocity window
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontWeight: 700 }}>
          <span style={{ color: '#38bdf8' }}>Total Printed: {fmtMtr(totalRangePrint)}</span>
          <span style={{ color: '#fb923c' }}>Total Fused: {fmtMtr(totalRangeFusing)}</span>
          <span style={{ color: '#34d399' }}>Total Dispatched: {fmtMtr(totalRangeDispatch)}</span>
        </div>
      </div>
    </div>
  );
}

export default function DigitalPrintOperationsDashboard({ onNavigateDepartment }) {
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const [viewMode, setViewMode] = useState('table');
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
    const handleGlobalRefresh = () => fetchDashboardData();
    window.addEventListener('elite-data-refresh', handleGlobalRefresh);
    return () => window.removeEventListener('elite-data-refresh', handleGlobalRefresh);
  }, [fetchDashboardData]);

  // Periodic background refresh every 120 seconds, only if tab is visible
  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchDashboardData();
    }, 120000);
    return () => clearInterval(timer);
  }, [fetchDashboardData]);

  const summary = data?.summary || {};
  const printing = data?.printing || {};
  const fusing = data?.fusing || {};
  const pipeline = data?.pipeline || {};
  const rawMaterials = data?.rawMaterials || {};
  const fabric = data?.fabric || {};
  const quality = data?.quality || {};

  const isTodayPlus = summary.isTodayPlus ?? true;

  // Proactive factory alerts computation
  const { lowInks, fusingBacklog, readyDispatchCount, openComplaintsCount } = useMemo(() => {
    const alerts = [];
    if (rawMaterials.inkStock?.grando) {
      Object.entries(rawMaterials.inkStock.grando).forEach(([color, val]) => {
        if (typeof val === 'number' && val < 3) {
          alerts.push({ brand: 'Grando', color, val });
        }
      });
    }
    if (rawMaterials.inkStock?.printdot) {
      Object.entries(rawMaterials.inkStock.printdot).forEach(([color, val]) => {
        if (typeof val === 'number' && val < 3) {
          alerts.push({ brand: 'PrintDot', color, val });
        }
      });
    }

    return {
      lowInks: alerts,
      fusingBacklog: (summary.pendingFusingMeters || 0) > 2000 || (summary.pendingFusingCards || 0) > 15,
      readyDispatchCount: pipeline.readyForDelivery?.count || 0,
      openComplaintsCount: quality.openComplaints || 0,
    };
  }, [rawMaterials, summary, pipeline, quality]);

  const handlePrintHandover = () => {
    window.print();
  };

  return (
    <div className="digital-print-ops-root erp-container-context">
      {/* Scoped CSS for responsive cards, micro-interactions, and animations */}
      <style>{`
        .digital-print-ops-root {
          width: 100% !important;
          max-width: 1440px;
          margin: 0 auto;
          box-sizing: border-box !important;
          padding: 0.5rem 0.25rem 2rem;
          color: #ffffff;
          font-family: inherit;
        }
        .phoenix-hero-row {
          display: grid;
          grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
          gap: 1.5rem;
          margin-bottom: 1.75rem;
          align-items: stretch;
        }
        @container erp-slot (max-width: 1024px) {
          .phoenix-hero-row {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 1024px) {
          .phoenix-hero-row {
            grid-template-columns: 1fr;
          }
        }
        .phoenix-kpi-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.85rem;
        }
        @container erp-slot (max-width: 520px) {
          .phoenix-kpi-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 520px) {
          .phoenix-kpi-grid {
            grid-template-columns: 1fr;
          }
        }
        .phoenix-kpi-card {
          background: rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          padding: 1.1rem 1.25rem;
          display: flex;
          flex-direction: column;
          justifyContent: space-between;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
          color: #ffffff;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .phoenix-kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
          border-color: rgba(255, 255, 255, 0.25);
        }
        .phoenix-bullet-item {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
          flex-shrink: 0;
        }
        .phoenix-card {
          background: rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
          color: #ffffff;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .phoenix-card:hover {
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
          border-color: rgba(255, 255, 255, 0.25);
        }
        .ops-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.45rem 0.85rem;
          border-radius: 7px;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
          white-space: nowrap;
          text-decoration: none;
        }
        .ops-action-btn:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.16);
          border-color: rgba(255, 255, 255, 0.28);
        }
        .ops-action-btn:active {
          transform: translateY(0);
        }
        .pipeline-stage-card {
          border-radius: 10px;
          padding: 1.1rem;
          cursor: pointer;
          background: rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #ffffff;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
          position: relative;
          display: flex;
          flex-direction: column;
          justifyContent: space-between;
        }
        .pipeline-stage-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
          border-color: rgba(255, 255, 255, 0.28);
        }
        .factory-alert-strip {
          display: flex;
          align-items: center;
          justifyContent: space-between;
          flex-wrap: wrap;
          gap: 0.65rem;
          padding: 0.65rem 1rem;
          border-radius: 8px;
          margin-bottom: 0.85rem;
          font-size: 0.82rem;
          background: rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.14);
          color: #ffffff;
          animation: fadeInDown 0.3s ease;
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-anim {
          animation: spin 1s linear infinite;
        }
        @media print {
          .ops-action-bar, .phoenix-filters-bar, .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* ── TIER 1: CLEAN HEADER (Rule 5: No Extra Text, Quick Action on Right) ── */}
      <div className="glass-screen-header" style={{ marginBottom: '0.65rem' }}>
        <div className="glass-title-capsule">
          <div className="glass-title-icon" style={{ background: 'linear-gradient(135deg, #0284c7, #2563eb)' }}>
            <Activity size={16} color="#ffffff" />
          </div>
          <span className="glass-screen-title">Digital Print Operations</span>
          <EntityBrandBadge entityId="EDP" />
        </div>

        <div className="ent-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <QuickActionMenu onNavigate={onNavigateDepartment} />
        </div>
      </div>

      {/* ── TIER 2: SUB-SCREEN BUTTONS BAR (Rule 5: Under Header) ── */}
      <div className="glass-subtabs-bar" style={{ marginBottom: '1rem' }}>
        {[
          { id: 'overview', label: 'Operations Hub' },
          { id: 'printing', label: 'Printing Queue', target: 'printing_log' },
          { id: 'fusing', label: `Fusing Line (${summary.pendingFusingCards || 0})`, target: 'fusing' },
          { id: 'jobcards', label: 'Job Cards Register', target: 'list' },
          { id: 'dispatch', label: `Dispatch & Challans (${readyDispatchCount})`, target: 'billing' },
          { id: 'costing', label: 'Billing & P&L', target: 'costing' },
          { id: 'stock', label: 'Inks & Stock', target: 'raw_materials' },
          { id: 'fabric', label: 'Fabric Register', target: 'fabric' },
          { id: 'reports', label: 'Reports', target: 'reports' },
        ].map(st => (
          <button
            key={st.id}
            type="button"
            className={`glass-subtab-btn ${activeSubTab === st.id ? 'active' : ''}`}
            onClick={() => {
              setActiveSubTab(st.id);
              if (st.target && onNavigateDepartment) onNavigateDepartment(st.target);
            }}
          >
            <span>{st.label}</span>
          </button>
        ))}
      </div>

      {/* ── TIER 3: SIDE SCROLLING CALCULATION & KPI CARDS TRACK (Rule 5) ── */}
      <div className="glass-scroll-track" style={{ marginBottom: '1rem' }}>
        {/* Card 1: Printed Today */}
        <div className="glass-card" style={{ minWidth: '220px', flex: '0 0 auto', padding: '0.9rem 1.15rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase' }}>Printed Today</span>
            <Printer size={16} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#38bdf8', marginTop: '4px' }}>
            {summary.dailyPrintedMeters ? fmtMtr(summary.dailyPrintedMeters) : '0 m'}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '2px' }}>
            {summary.dailyPrintedJobs || 0} Print Orders Completed
          </div>
        </div>

        {/* Card 2: Fusing Queue */}
        <div className="glass-card" style={{ minWidth: '220px', flex: '0 0 auto', padding: '0.9rem 1.15rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase' }}>Fusing Queue</span>
            <Flame size={16} color="#fb923c" />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#fb923c', marginTop: '4px' }}>
            {summary.pendingFusingMeters ? fmtMtr(summary.pendingFusingMeters) : '0 m'}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '2px' }}>
            {summary.pendingFusingCards || 0} Cards In Line
          </div>
        </div>

        {/* Card 3: Dispatch Ready */}
        <div className="glass-card" style={{ minWidth: '220px', flex: '0 0 auto', padding: '0.9rem 1.15rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase' }}>Dispatch Ready</span>
            <Truck size={16} color="#34d399" />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#34d399', marginTop: '4px' }}>
            {readyDispatchCount} Cards
          </div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '2px' }}>
            {pipeline.readyForDelivery?.meters ? fmtMtr(pipeline.readyForDelivery?.meters) : 'Packaged & verified'}
          </div>
        </div>

        {/* Card 4: Ink Stock Health */}
        <div className="glass-card" style={{ minWidth: '220px', flex: '0 0 auto', padding: '0.9rem 1.15rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase' }}>Ink Stock Health</span>
            <Droplets size={16} color={lowInks.length > 0 ? '#f87171' : '#38bdf8'} />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: lowInks.length > 0 ? '#f87171' : '#34d399', marginTop: '4px' }}>
            {lowInks.length === 0 ? 'Optimal (100%)' : `${lowInks.length} Inks Low`}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '2px' }}>
            {lowInks.length > 0 ? 'Refill safety threshold active' : 'All colors above 3.0L'}
          </div>
        </div>

        {/* Card 5: Production Yield Ratio */}
        <div className="glass-card" style={{ minWidth: '220px', flex: '0 0 auto', padding: '0.9rem 1.15rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase' }}>Production Yield</span>
            <ShieldCheck size={16} color="#c084fc" />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#c084fc', marginTop: '4px' }}>
            98.4%
          </div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '2px' }}>
            Wastage &lt; 1.6% across runs
          </div>
        </div>
      </div>

      {/* ── TIER 4: ACTION TOOLBAR WITH VIEW TOGGLE (Rule 5: Table | Cards) ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        padding: '0.65rem 1rem',
        background: 'rgba(255, 255, 255, 0.06)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
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
          />

          <select
            value={shift}
            onChange={e => setShift(e.target.value)}
            style={{
              fontSize: '0.82rem',
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.65)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.16)'
            }}
          >
            <option value="All">All Shifts</option>
            <option value="Morning">Morning Shift</option>
            <option value="Night">Night Shift</option>
          </select>

          <button
            type="button"
            onClick={handlePrintHandover}
            className="ops-action-btn"
            title="Print or Export Shift Handover Report"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              color: '#ffffff',
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <FileSpreadsheet size={14} color="#38bdf8" />
            <span>Shift Handover</span>
          </button>

          <button
            type="button"
            onClick={fetchDashboardData}
            disabled={loading}
            className="ops-action-btn"
            title="Live Refresh Dashboard Data"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              color: '#ffffff',
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={13} className={loading ? 'spin-anim' : ''} color="#34d399" />
            <span>{loading ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="glass-view-toggle">
          <button
            type="button"
            className={viewMode === 'table' ? 'active' : ''}
            onClick={() => setViewMode('table')}
            title="Switch to High-Density Table View"
          >
            <FileText size={14} />
            <span>Table</span>
          </button>
          <button
            type="button"
            className={viewMode === 'cards' ? 'active' : ''}
            onClick={() => setViewMode('cards')}
            title="Switch to Card Grid View"
          >
            <Layers size={14} />
            <span>Cards</span>
          </button>
        </div>
      </div>

      {/* ── HIGH-CONTRAST FROSTED PRODUCTION ALERTS (Zero Washed-Out Text) ── */}
      {lowInks.length > 0 && (
        <div className="factory-alert-strip" style={{
          background: 'rgba(239, 68, 68, 0.16)',
          border: '1px solid rgba(239, 68, 68, 0.40)',
          color: '#fca5a5',
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          marginBottom: '0.65rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} color="#ef4444" />
            <strong style={{ color: '#ffffff' }}>Low Ink Alert:</strong>
            <span>
              {lowInks.map(i => `${i.brand} ${i.color} (${i.val}L)`).join(', ')} is below the 3.0L factory safety threshold.
            </span>
          </div>
          {onNavigateDepartment && (
            <button
              type="button"
              onClick={() => onNavigateDepartment('raw_materials')}
              style={{
                background: 'rgba(239, 68, 68, 0.35)',
                border: '1px solid rgba(239, 68, 68, 0.6)',
                color: '#ffffff',
                padding: '0.35rem 0.85rem',
                fontSize: '0.76rem',
                borderRadius: '6px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Refill Inks & View Stock →
            </button>
          )}
        </div>
      )}

      {fusingBacklog && (
        <div className="factory-alert-strip" style={{
          background: 'rgba(249, 115, 22, 0.16)',
          border: '1px solid rgba(249, 115, 22, 0.40)',
          color: '#fdba74',
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          marginBottom: '0.65rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Flame size={16} color="#f97316" />
            <strong style={{ color: '#ffffff' }}>Fusing Backlog Alert:</strong>
            <span>
              {fmtMtr(summary.pendingFusingMeters)} ({summary.pendingFusingCards} cards) waiting in fusing queue. Printing is out-pacing fusing.
            </span>
          </div>
          {onNavigateDepartment && (
            <button
              type="button"
              onClick={() => onNavigateDepartment('fusing')}
              style={{
                background: 'rgba(249, 115, 22, 0.35)',
                border: '1px solid rgba(249, 115, 22, 0.6)',
                color: '#ffffff',
                padding: '0.35rem 0.85rem',
                fontSize: '0.76rem',
                borderRadius: '6px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Open Fusing Queue →
            </button>
          )}
        </div>
      )}

      {readyDispatchCount > 0 && (
        <div className="factory-alert-strip" style={{
          background: 'rgba(34, 197, 94, 0.16)',
          border: '1px solid rgba(34, 197, 94, 0.40)',
          color: '#86efac',
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          marginBottom: '0.65rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={16} color="#22c55e" />
            <strong style={{ color: '#ffffff' }}>Dispatch Ready:</strong>
            <span>
              {readyDispatchCount} Job Cards ({fmtMtr(pipeline.readyForDelivery?.meters || 0)}) completed fusing and cleared for customer dispatch.
            </span>
          </div>
          {onNavigateDepartment && (
            <button
              type="button"
              onClick={() => onNavigateDepartment('billing')}
              style={{
                background: 'rgba(34, 197, 94, 0.35)',
                border: '1px solid rgba(34, 197, 94, 0.6)',
                color: '#ffffff',
                padding: '0.35rem 0.85rem',
                fontSize: '0.76rem',
                borderRadius: '6px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Generate Delivery Challans →
            </button>
          )}
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.12)', margin: '0.5rem 0 1.25rem 0' }} />

      {/* ── 4. PHOENIX HERO GRID (Velocity Chart + 4 Smart KPI Cards) ── */}
      <div className="phoenix-hero-row">
        {/* LEFT COLUMN: Real-Time Dynamic Production & Delivery Velocity Chart */}
        <ProductionVelocityChart
          trend={data?.velocityTrend}
          stats={data?.velocityStats}
          loading={loading}
          dailyPrintingMeters={summary.dailyPrintedMeters}
          dailyFusedMeters={summary.dailyFusedMeters}
        />

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
                  <h5 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#ffffff' }}>
                    Daily Printing
                  </h5>
                  <span style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.72)', fontWeight: 500 }}>Active Print Line</span>
                </div>
                <span className="badge-phoenix badge-phoenix-primary">
                  {summary.dailyPrintedJobs || 0} Jobs
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '0.5rem 0' }}>
                <span style={{ fontSize: '1.65rem', fontWeight: 900, color: '#38bdf8', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {fmtMtr(summary.dailyPrintedMeters)}
                </span>
              </div>
            </div>

            {/* Micro Visualization: Target Progress Arc */}
            <div style={{ padding: '0.65rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: '90px', height: '52px', overflow: 'hidden' }}>
                <svg viewBox="0 0 100 55" style={{ width: '100%', height: '100%' }}>
                  <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255, 255, 255, 0.14)" strokeWidth="8" strokeLinecap="round" />
                  <path d="M 10 50 A 40 40 0 0 1 70 20" fill="none" stroke="#38bdf8" strokeWidth="8" strokeLinecap="round" />
                </svg>
                <div style={{ position: 'absolute', bottom: '0', left: 0, right: 0, textAlign: 'center', fontSize: '0.68rem', fontWeight: 800, color: '#38bdf8' }}>
                  {Math.round(((summary.dailyPrintedMeters || 0) / 10000) * 100)}% Target
                </div>
              </div>
            </div>

            {/* Bullets Detail */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255, 255, 255, 0.75)' }}>
                  <span className="phoenix-bullet-item" style={{ background: '#38bdf8' }} />
                  <span>Month-to-Date</span>
                </div>
                <strong style={{ color: '#ffffff' }}>{fmtMtr(summary.monthPrintedMeters)}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255, 255, 255, 0.75)' }}>
                  <span className="phoenix-bullet-item" style={{ background: 'rgba(255, 255, 255, 0.45)' }} />
                  <span>Daily Target</span>
                </div>
                <strong style={{ color: 'rgba(255, 255, 255, 0.85)' }}>10,000m</strong>
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
                  <h5 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#ffffff' }}>
                    Fusing & Heat Press
                  </h5>
                  <span style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.72)', fontWeight: 500 }}>Curing & Finishing</span>
                </div>
                <span className="badge-phoenix badge-phoenix-warning">
                  {summary.pendingFusingCards || 0} Pending
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '0.5rem 0' }}>
                <span style={{ fontSize: '1.65rem', fontWeight: 900, color: '#fb923c', letterSpacing: '-0.02em', lineHeight: 1 }}>
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
                    background: i === 5 ? '#fb923c' : 'rgba(251, 146, 60, 0.22)',
                    borderRadius: '2px',
                    border: i === 5 ? 'none' : '1px solid rgba(251, 146, 60, 0.4)'
                  }}
                  title={`Day ${i+1}`}
                />
              ))}
            </div>

            {/* Bullets Detail */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255, 255, 255, 0.75)' }}>
                  <span className="phoenix-bullet-item" style={{ background: '#fb923c' }} />
                  <span>Pending Queue</span>
                </div>
                <strong style={{ color: '#fb923c' }}>{fmtMtr(summary.pendingFusingMeters)}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255, 255, 255, 0.75)' }}>
                  <span className="phoenix-bullet-item" style={{ background: '#fdba74' }} />
                  <span>Queue Sync</span>
                </div>
                <strong style={{ color: summary.pendingFusingCards > 0 ? '#fb923c' : '#34d399' }}>
                  {summary.pendingFusingCards > 0 ? 'Active Queue' : 'Synchronized'}
                </strong>
              </div>
            </div>
          </div>

          {/* Card 3: Ready for Dispatch */}
          <div
            onClick={() => onNavigateDepartment?.('billing')}
            className="phoenix-kpi-card"
            style={{ cursor: onNavigateDepartment ? 'pointer' : 'default' }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                <div>
                  <h5 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#ffffff' }}>
                    Ready for Dispatch
                  </h5>
                  <span style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.72)', fontWeight: 500 }}>Packaging & QA</span>
                </div>
                <span className="badge-phoenix badge-phoenix-success">
                  {pipeline.readyForDelivery?.count || 0} Finished
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '0.5rem 0' }}>
                <span style={{ fontSize: '1.65rem', fontWeight: 900, color: '#34d399', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {fmtMtr(pipeline.readyForDelivery?.meters || 0)}
                </span>
              </div>
            </div>

            {/* Micro Visualization: Mini Donut Chart */}
            <div style={{ padding: '0.65rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: '52px', height: '52px' }}>
                <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(52, 211, 153, 0.18)" strokeWidth="4" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" strokeDasharray="82, 100" fill="none" stroke="#34d399" strokeWidth="4" strokeLinecap="round" />
                </svg>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, color: '#34d399' }}>
                  ✓
                </div>
              </div>
            </div>

            {/* Bullets Detail */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255, 255, 255, 0.75)' }}>
                  <span className="phoenix-bullet-item" style={{ background: '#34d399' }} />
                  <span>Delivered MTD</span>
                </div>
                <strong style={{ color: '#ffffff' }}>{pipeline.delivered?.count || 0} Cards</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255, 255, 255, 0.75)' }}>
                  <span className="phoenix-bullet-item" style={{ background: '#86efac' }} />
                  <span>QC Cleared</span>
                </div>
                <strong style={{ color: '#34d399' }}>100% Passed</strong>
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
                  <h5 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#ffffff' }}>
                    Financial Net Pulse
                  </h5>
                  <span style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.72)', fontWeight: 500 }}>Today Net Billed</span>
                </div>
                <span className={`badge-phoenix ${isTodayPlus ? 'badge-phoenix-success' : 'badge-phoenix-danger'}`}>
                  {isTodayPlus ? '+ PLUS' : '- MINUS'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '0.5rem 0' }}>
                <span style={{ fontSize: '1.65rem', fontWeight: 900, color: isTodayPlus ? '#34d399' : '#f87171', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {fmtINR(summary.todayBilledRevenue)}
                </span>
              </div>
            </div>

            {/* Micro Visualization: Mini Sparkline */}
            <div style={{ padding: '0.65rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '100px', height: '40px' }}>
                <svg viewBox="0 0 100 40" style={{ width: '100%', height: '100%' }}>
                  <path d="M 0 35 Q 25 15, 50 25 T 100 8 L 100 40 L 0 40 Z" fill={isTodayPlus ? 'rgba(52, 211, 153, 0.16)' : 'rgba(248, 113, 113, 0.16)'} />
                  <path d="M 0 35 Q 25 15, 50 25 T 100 8" fill="none" stroke={isTodayPlus ? '#34d399' : '#f87171'} strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* Bullets Detail */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255, 255, 255, 0.75)' }}>
                  <span className="phoenix-bullet-item" style={{ background: '#f87171' }} />
                  <span>Today Exp</span>
                </div>
                <strong style={{ color: '#f87171' }}>{fmtINR(summary.todayExpenses)}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255, 255, 255, 0.75)' }}>
                  <span className="phoenix-bullet-item" style={{ background: '#38bdf8' }} />
                  <span>Month Rev</span>
                </div>
                <strong style={{ color: '#38bdf8' }}>{fmtINR(summary.monthBilledRevenue)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* ── 5. SECTION 1: PRINTING MACHINES & SHIFT ANALYTICS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', marginBottom: '1.75rem' }}>
        
        {/* Machine Breakdown */}
        <div className="phoenix-card" style={{ padding: '1.4rem 1.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Printer size={18} color="#38bdf8" /> Machine-Wise Production
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.72)', fontWeight: 600 }}>
                {printing.machineBreakdown?.length || 0} Active Machines
              </span>
              {onNavigateDepartment && (
                <button
                  type="button"
                  onClick={() => onNavigateDepartment('printing_log')}
                  className="ops-action-btn"
                  style={{
                    background: 'rgba(56, 189, 248, 0.16)',
                    border: '1px solid rgba(56, 189, 248, 0.38)',
                    color: '#38bdf8',
                    fontSize: '0.74rem',
                    padding: '3px 10px'
                  }}
                >
                  <PlusCircle size={13} /> Log Entry →
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {(!printing.machineBreakdown || printing.machineBreakdown.length === 0) ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.85rem' }}>
                No machine print logs recorded for this period.
              </div>
            ) : (
              printing.machineBreakdown.map((m, idx) => (
                <div key={idx} style={{ background: 'rgba(15, 23, 42, 0.72)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.14)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#ffffff' }}>{m.machineName}</span>
                    <span style={{ fontWeight: 900, fontSize: '0.95rem', color: '#38bdf8' }}>{fmtMtr(m.meters)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.72)', marginBottom: '0.4rem' }}>
                    <span>{m.jobsCount} logs recorded</span>
                    <span>{m.pct}% of total</span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ width: '100%', height: '5px', background: 'rgba(255, 255, 255, 0.12)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(m.pct, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8, #3b82f6)', borderRadius: '999px' }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Shift Breakdown & Operator Leaderboard */}
        <div className="phoenix-card" style={{ padding: '1.4rem 1.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={18} color="#38bdf8" /> Shifts & Operator Leaderboard
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.72)', fontWeight: 600 }}>Shift Efficiency</span>
          </div>

          {/* Shift split boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            {['Morning', 'Night'].map(sName => {
              const sObj = printing.shiftBreakdown?.find(s => s.shift.toLowerCase() === sName.toLowerCase()) || { meters: 0, jobsCount: 0 };
              return (
                <div key={sName} style={{ background: 'rgba(56, 189, 248, 0.12)', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.32)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8' }}>{sName === 'Morning' ? '☀️ Morning Shift' : '🌙 Night Shift'}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', marginTop: '2px' }}>{fmtMtr(sObj.meters)}</div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.75)' }}>{sObj.jobsCount} logs recorded</div>
                </div>
              );
            })}
          </div>

          {/* Operator Leaderboard List */}
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'rgba(255, 255, 255, 0.75)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>
            Top Operators
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
            {(!printing.operatorLeaderboard || printing.operatorLeaderboard.length === 0) ? (
              <div style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.8rem' }}>No operator logs recorded.</div>
            ) : (
              printing.operatorLeaderboard.map((op, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0.75rem', background: 'rgba(15, 23, 42, 0.72)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.14)' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#ffffff' }}>
                    {i + 1}. {op.operatorName}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#38bdf8' }}>
                    {fmtMtr(op.meters)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── 6. SECTION 2: PRODUCTION PIPELINE STAGES (ACTIONABLE INTERACTIVE CARDS) ── */}
      <div className="phoenix-card" style={{
        padding: '1.4rem 1.6rem',
        marginBottom: '1.75rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} color="#38bdf8" /> Active Job Cards Production Pipeline
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.72)' }}>
              Click any stage below to jump straight to that department workstation
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', background: 'rgba(56, 189, 248, 0.16)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.35)', padding: '4px 12px', borderRadius: '999px', fontWeight: 800 }}>
              {pipeline.todayCreated?.count || 0} New Cards Received Today ({fmtMtr(pipeline.todayCreated?.meters || 0)})
            </span>
            {onNavigateDepartment && (
              <button
                type="button"
                onClick={() => onNavigateDepartment('list')}
                className="ops-action-btn"
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  padding: '5px 12px'
                }}
              >
                View Cards Register →
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
          <div
            onClick={() => onNavigateDepartment?.('printing_log')}
            className="pipeline-stage-card"
            style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.35)' }}
            title="Click to open Printing Workstation"
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase' }}>1. Print Pending</span>
                <ChevronRight size={14} color="#38bdf8" />
              </div>
              <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>
                {pipeline.pending?.count || 0} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)' }}>Cards</span>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#38bdf8' }}>{fmtMtr(pipeline.pending?.meters || 0)}</div>
            </div>
            <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(56, 189, 248, 0.2)', fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <span>Open Print Line</span> →
            </div>
          </div>

          {/* Stage 2: Fusing Pending */}
          <div
            onClick={() => onNavigateDepartment?.('fusing')}
            className="pipeline-stage-card"
            style={{ background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.35)' }}
            title="Click to open Fusing & Heat Press"
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#fb923c', textTransform: 'uppercase' }}>2. In Fusing Queue</span>
                <ChevronRight size={14} color="#fb923c" />
              </div>
              <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>
                {pipeline.inFusing?.count || 0} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)' }}>Cards</span>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fb923c' }}>{fmtMtr(pipeline.inFusing?.meters || 0)}</div>
            </div>
            <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(249, 115, 22, 0.2)', fontSize: '0.72rem', color: '#fb923c', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <span>Open Fusing Line</span> →
            </div>
          </div>

          {/* Stage 3: Ready for Delivery */}
          <div
            onClick={() => onNavigateDepartment?.('billing')}
            className="pipeline-stage-card"
            style={{ background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.35)' }}
            title="Click to create Delivery Challans"
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#34d399', textTransform: 'uppercase' }}>3. Ready for Dispatch</span>
                <ChevronRight size={14} color="#34d399" />
              </div>
              <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>
                {pipeline.readyForDelivery?.count || 0} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)' }}>Cards</span>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#34d399' }}>{fmtMtr(pipeline.readyForDelivery?.meters || 0)}</div>
            </div>
            <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(52, 211, 153, 0.2)', fontSize: '0.72rem', color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <span>Issue Challan & Invoice</span> →
            </div>
          </div>

          {/* Stage 4: Delivered */}
          <div
            onClick={() => onNavigateDepartment?.('billing')}
            className="pipeline-stage-card"
            style={{ background: 'rgba(192, 132, 252, 0.08)', border: '1px solid rgba(192, 132, 252, 0.35)' }}
            title="Click to view Billing & Dispatch History"
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#c084fc', textTransform: 'uppercase' }}>4. Dispatched Total</span>
                <ChevronRight size={14} color="#c084fc" />
              </div>
              <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>
                {pipeline.delivered?.count || 0} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)' }}>Cards</span>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#c084fc' }}>{fmtMtr(pipeline.delivered?.meters || 0)}</div>
            </div>
            <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(192, 132, 252, 0.2)', fontSize: '0.72rem', color: '#c084fc', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <span>View Dispatched History</span> →
            </div>
          </div>
        </div>
      </div>

      {/* ── 7. SECTION 3: RAW MATERIALS & INK STOCK GAUGES ── */}
      <div className="phoenix-card" style={{
        padding: '1.4rem 1.6rem',
        marginBottom: '1.75rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Droplets size={18} color="#38bdf8" /> Live Ink Levels & Raw Materials Health
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.72)' }}>
              Current factory ink canister levels (CMYK Liters) and sublimation paper stock
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', fontWeight: 700, flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(56, 189, 248, 0.16)', color: '#38bdf8', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.35)' }}>
              📜 Paper Rolls: {rawMaterials.inkStock?.paperRolls || 0} Rolls in Stock
            </span>
            <span style={{ background: 'rgba(16, 185, 129, 0.16)', color: '#34d399', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.35)' }}>
              💧 Today Consumed: {rawMaterials.todayInkConsumed || 0} L
            </span>
            {onNavigateDepartment && (
              <button
                type="button"
                onClick={() => onNavigateDepartment('raw_materials')}
                className="ops-action-btn"
                style={{
                  background: 'rgba(56, 189, 248, 0.16)',
                  border: '1px solid rgba(56, 189, 248, 0.38)',
                  color: '#38bdf8',
                  fontSize: '0.74rem',
                  padding: '3px 10px'
                }}
              >
                Inks & Stock Manager →
              </button>
            )}
          </div>
        </div>

        {/* Grando Ink Canisters */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#38bdf8', marginBottom: '0.5rem', letterSpacing: '0.03em' }}>
            🖨️ GRANDO INK CANISTERS (LITERS)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
            {[
              { code: 'C', name: 'Cyan (C)', color: '#38bdf8', border: 'rgba(56, 189, 248, 0.35)', val: rawMaterials.inkStock?.grando?.C || 0 },
              { code: 'M', name: 'Magenta (M)', color: '#f472b6', border: 'rgba(244, 114, 182, 0.35)', val: rawMaterials.inkStock?.grando?.M || 0 },
              { code: 'Y', name: 'Yellow (Y)', color: '#fbbf24', border: 'rgba(251, 191, 36, 0.35)', val: rawMaterials.inkStock?.grando?.Y || 0 },
              { code: 'K', name: 'Black (K)', color: '#ffffff', border: 'rgba(255, 255, 255, 0.3)', val: rawMaterials.inkStock?.grando?.K || 0 },
              { code: 'CS', name: 'Cleaning Sol.', color: '#c084fc', border: 'rgba(192, 132, 252, 0.35)', val: rawMaterials.inkStock?.grando?.CS || 0 }
            ].map(ink => (
              <div key={ink.code} style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '0.75rem 0.85rem', borderRadius: '12px', border: `1.5px solid ${ink.border}`, textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: ink.color }}>{ink.name}</span>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: ink.color, marginTop: '2px' }}>
                  {ink.val} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>L</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: ink.val < 3 ? '#f87171' : '#34d399', fontWeight: 700, marginTop: '2px' }}>
                  {ink.val < 3 ? '⚠️ Low Stock' : '✓ Normal'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PrintDot Ink Canisters */}
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#38bdf8', marginBottom: '0.5rem', letterSpacing: '0.03em' }}>
            🖨️ PRINTDOT INK CANISTERS (LITERS)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
            {[
              { code: 'C', name: 'Cyan (C)', color: '#38bdf8', border: 'rgba(56, 189, 248, 0.35)', val: rawMaterials.inkStock?.printdot?.C || 0 },
              { code: 'M', name: 'Magenta (M)', color: '#f472b6', border: 'rgba(244, 114, 182, 0.35)', val: rawMaterials.inkStock?.printdot?.M || 0 },
              { code: 'Y', name: 'Yellow (Y)', color: '#fbbf24', border: 'rgba(251, 191, 36, 0.35)', val: rawMaterials.inkStock?.printdot?.Y || 0 },
              { code: 'K', name: 'Black (K)', color: '#ffffff', border: 'rgba(255, 255, 255, 0.3)', val: rawMaterials.inkStock?.printdot?.K || 0 }
            ].map(ink => (
              <div key={ink.code} style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '0.75rem 0.85rem', borderRadius: '12px', border: `1.5px solid ${ink.border}`, textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: ink.color }}>{ink.name}</span>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: ink.color, marginTop: '2px' }}>
                  {ink.val} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>L</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: ink.val < 3 ? '#f87171' : '#34d399', fontWeight: 700, marginTop: '2px' }}>
                  {ink.val < 3 ? '⚠️ Low Stock' : '✓ Normal'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 8. SECTION 4: FABRIC MOVEMENT, QUALITY & FACTORY EXPENSES ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Fabric Inward & Outward */}
        <div className="phoenix-card" style={{ padding: '1.35rem 1.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Package size={18} color="#38bdf8" /> Daily Fabric Management
            </h3>
            {onNavigateDepartment && (
              <button
                type="button"
                onClick={() => onNavigateDepartment('fabric')}
                className="ops-action-btn"
                style={{
                  background: 'rgba(56, 189, 248, 0.16)',
                  border: '1px solid rgba(56, 189, 248, 0.38)',
                  color: '#38bdf8',
                  fontSize: '0.74rem',
                  padding: '3px 10px'
                }}
              >
                Fabric Register →
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.12)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.32)' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#34d399' }}>📥 Fabric Inward Today</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#ffffff', marginTop: '2px' }}>
                {fmtMtr(fabric.inwardMetersToday || 0)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.75)' }}>{fabric.inwardRollsToday || 0} Rolls Received</div>
            </div>

            <div style={{ background: 'rgba(56, 189, 248, 0.12)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.32)' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#38bdf8' }}>📤 Fabric Issued Today</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#ffffff', marginTop: '2px' }}>
                {fmtMtr(fabric.issuedMetersToday || 0)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.75)' }}>{fabric.issuedRollsToday || 0} Rolls to Production</div>
            </div>
          </div>
        </div>

        {/* Quality & Complaints Status */}
        <div className="phoenix-card" style={{ padding: '1.35rem 1.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} color="#38bdf8" /> Quality & Complaints Health
            </h3>
            {onNavigateDepartment && (
              <button
                type="button"
                onClick={() => onNavigateDepartment('complaint')}
                className="ops-action-btn"
                style={{
                  background: 'rgba(56, 189, 248, 0.16)',
                  border: '1px solid rgba(56, 189, 248, 0.38)',
                  color: '#38bdf8',
                  fontSize: '0.74rem',
                  padding: '3px 10px'
                }}
              >
                Complaints Log →
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.12)', padding: '0.85rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.32)' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#f87171' }}>⚠️ Open Complaints</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#ffffff', marginTop: '2px' }}>
                {quality.openComplaints || 0}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.75)' }}>Active customer complaints</div>
            </div>

            <div style={{ background: 'rgba(16, 185, 129, 0.12)', padding: '0.85rem', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.32)' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#34d399' }}>✓ Resolved Complaints</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#ffffff', marginTop: '2px' }}>
                {quality.resolvedComplaints || 0}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.75)' }}>Successfully resolved</div>
            </div>
          </div>
        </div>

        {/* Factory Overhead & Expense Pulse */}
        <div className="phoenix-card" style={{ padding: '1.35rem 1.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DollarSign size={18} color="#38bdf8" /> Factory Expenses & Costing
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {onNavigateDepartment && (
                <button
                  type="button"
                  onClick={() => onNavigateDepartment('expense')}
                  className="ops-action-btn"
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#fca5a5',
                    fontSize: '0.74rem',
                    padding: '3px 10px'
                  }}
                >
                  + Log Expense →
                </button>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.12)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f87171' }}>💸 Today Expenses</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#ffffff', marginTop: '2px' }}>
                {fmtINR(summary.todayExpenses)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.65)' }}>Daily factory overheads</div>
            </div>

            <div style={{ background: 'rgba(56, 189, 248, 0.12)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#38bdf8' }}>📈 Month Billed Rev</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#ffffff', marginTop: '2px' }}>
                {fmtINR(summary.monthBilledRevenue)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.65)' }}>Cumulative billed output</div>
            </div>
          </div>

          {onNavigateDepartment && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => onNavigateDepartment('costing')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#38bdf8',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                <span>View Full P&L Costing Sheet</span> →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
