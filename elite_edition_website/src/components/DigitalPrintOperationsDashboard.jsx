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
      padding: '1.25rem 1.5rem',
      color: '#0f172a',
      fontFamily: 'inherit'
    }}>
      {/* ── Top Header Toolbar (White & Blue) ─────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem',
        background: '#ffffff',
        padding: '1.25rem 1.75rem',
        borderRadius: '16px',
        border: '1px solid #bfdbfe',
        boxShadow: '0 4px 20px -2px rgba(37, 99, 235, 0.08)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
            }}>
              <Activity size={22} />
            </span>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em', color: '#1e3a8a' }}>
              Digital Print Master Dashboard
            </h1>
            <span style={{
              background: '#eff6ff',
              color: '#1d4ed8',
              padding: '3px 12px',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: '1px solid #93c5fd'
            }}>
              Elite Digital Print
            </span>
          </div>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Real-time daily operations command center across Printing, Fusing, Stock, Pipeline & Financials
          </p>
        </div>

        {/* Date Filter Presets, Shift & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Standard ERP DateRangePicker */}
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

          {/* Shift Filter */}
          <select
            value={shift}
            onChange={e => setShift(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: '0.82rem',
              fontWeight: 700
            }}
          >
            <option value="All">All Shifts</option>
            <option value="Morning">Morning Shift</option>
            <option value="Night">Night Shift</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={fetchDashboardData}
            title={`Last refreshed at ${lastRefreshed.toLocaleTimeString()}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#2563eb',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.8rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin-loader' : ''} />
            <span>Refresh</span>
          </button>

          {/* Quick Department Shortcuts */}
          {onNavigateDepartment && (
            <>
              <button
                type="button"
                onClick={() => onNavigateDepartment('list')}
                title="View All Job Cards Table"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid #bfdbfe',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  boxShadow: '0 1px 3px rgba(37,99,235,0.08)'
                }}
              >
                <Layers size={14} />
                <span>Job Cards List</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateDepartment('reports')}
                title="Open Reports Center & PDF Export"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                <BarChart3 size={14} />
                <span>Reports & Exports</span>
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          padding: '1rem 1.25rem',
          borderRadius: '12px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: 600
        }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* ── TOP EXECUTIVE KPI STRIP (4 Pillars of Daily Operations) ─────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '1.25rem',
        marginBottom: '1.75rem'
      }}>
        {/* KPI 1: Printing Production */}
        <div
          onClick={() => onNavigateDepartment?.('printing_log')}
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #bfdbfe',
            padding: '1.25rem 1.4rem',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.05)',
            position: 'relative',
            overflow: 'hidden',
            cursor: onNavigateDepartment ? 'pointer' : 'default',
            transition: 'transform 0.15s, box-shadow 0.15s'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#1e40af', letterSpacing: '0.5px' }}>
              🖨️ Daily Printing Output
            </span>
            <span style={{ fontSize: '0.72rem', background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
              {summary.dailyPrintedJobs || 0} Jobs Logged →
            </span>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#1e3a8a', letterSpacing: '-0.02em' }}>
            {fmtMtr(summary.dailyPrintedMeters)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
            <span>Month-to-Date: <strong style={{ color: '#2563eb' }}>{fmtMtr(summary.monthPrintedMeters)}</strong></span>
            <span>Target: <strong>10,000m</strong></span>
          </div>
        </div>

        {/* KPI 2: Fusing Output & Queue */}
        <div
          onClick={() => onNavigateDepartment?.('fusing')}
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #fed7aa',
            padding: '1.25rem 1.4rem',
            boxShadow: '0 4px 14px rgba(249, 115, 22, 0.05)',
            position: 'relative',
            overflow: 'hidden',
            cursor: onNavigateDepartment ? 'pointer' : 'default',
            transition: 'transform 0.15s, box-shadow 0.15s'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#c2410c', letterSpacing: '0.5px' }}>
              ⚡ Fusing Production
            </span>
            <span style={{ fontSize: '0.72rem', background: '#fff7ed', color: '#ea580c', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
              Queue: {summary.pendingFusingCards || 0} Cards →
            </span>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#ea580c', letterSpacing: '-0.02em' }}>
            {fmtMtr(summary.dailyFusedMeters)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
            <span>Pending Fusing: <strong style={{ color: '#ea580c' }}>{fmtMtr(summary.pendingFusingMeters)}</strong></span>
            <span>Status: <strong style={{ color: '#059669' }}>Synchronized</strong></span>
          </div>
        </div>

        {/* KPI 3: Pipeline / Ready for Dispatch */}
        <div
          onClick={() => onNavigateDepartment?.('list')}
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #bbf7d0',
            padding: '1.25rem 1.4rem',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.05)',
            position: 'relative',
            overflow: 'hidden',
            cursor: onNavigateDepartment ? 'pointer' : 'default',
            transition: 'transform 0.15s, box-shadow 0.15s'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#047857', letterSpacing: '0.5px' }}>
              🚚 Ready for Dispatch
            </span>
            <span style={{ fontSize: '0.72rem', background: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
              {pipeline.readyForDelivery?.count || 0} Finished Cards →
            </span>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#059669', letterSpacing: '-0.02em' }}>
            {fmtMtr(pipeline.readyForDelivery?.meters || 0)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
            <span>Delivered MTD: <strong style={{ color: '#059669' }}>{fmtMtr(pipeline.delivered?.meters || 0)}</strong></span>
            <span>Total Delivered: <strong>{pipeline.delivered?.count || 0}</strong></span>
          </div>
        </div>

        {/* KPI 4: Financial Pulse (Today & Month) */}
        <div
          onClick={() => onNavigateDepartment?.('costing')}
          style={{
            background: isTodayPlus ? 'linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)' : '#fef2f2',
            borderRadius: '16px',
            border: `1.5px solid ${isTodayPlus ? '#86efac' : '#fca5a5'}`,
            padding: '1.25rem 1.4rem',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.04)',
            position: 'relative',
            overflow: 'hidden',
            cursor: onNavigateDepartment ? 'pointer' : 'default',
            transition: 'transform 0.15s, box-shadow 0.15s'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: isTodayPlus ? '#047857' : '#b91c1c', letterSpacing: '0.5px' }}>
              💰 Financial Net Pulse
            </span>
            <span style={{
              fontSize: '0.72rem',
              background: isTodayPlus ? '#dcfce7' : '#fee2e2',
              color: isTodayPlus ? '#15803d' : '#b91c1c',
              padding: '2px 8px',
              borderRadius: '999px',
              fontWeight: 800
            }}>
              {isTodayPlus ? '🟢 PLUS' : '🔴 MINUS'} →
            </span>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: isTodayPlus ? '#047857' : '#b91c1c', letterSpacing: '-0.02em' }}>
            {fmtINR(summary.todayBilledRevenue)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#475569', marginTop: '0.5rem', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '0.5rem' }}>
            <span>Today Exp: <strong style={{ color: '#dc2626' }}>{fmtINR(summary.todayExpenses)}</strong></span>
            <span>Month Rev: <strong style={{ color: '#2563eb' }}>{fmtINR(summary.monthBilledRevenue)}</strong></span>
          </div>
        </div>
      </div>

      {/* ── SECTION 1: PRINTING MACHINES & SHIFT ANALYTICS ──────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', marginBottom: '1.75rem' }}>
        
        {/* Machine Breakdown */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #bfdbfe',
          padding: '1.4rem 1.6rem',
          boxShadow: '0 4px 16px rgba(37, 99, 235, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                    border: '1px solid #bfdbfe',
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
                <div key={idx} style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
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
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #bfdbfe',
          padding: '1.4rem 1.6rem',
          boxShadow: '0 4px 16px rgba(37, 99, 235, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={18} color="#2563eb" /> Shifts & Operator Leaderboard
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Shift Efficiency</span>
          </div>

          {/* Shift split boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            {['Morning', 'Night'].map(sName => {
              const sObj = printing.shiftBreakdown?.find(s => s.shift.toLowerCase() === sName.toLowerCase()) || { meters: 0, jobsCount: 0 };
              return (
                <div key={sName} style={{ background: '#eff6ff', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1d4ed8' }}>{sName === 'Morning' ? '☀️ Morning Shift' : '🌙 Night Shift'}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1e3a8a', marginTop: '2px' }}>{fmtMtr(sObj.meters)}</div>
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
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #bfdbfe',
        padding: '1.4rem 1.6rem',
        marginBottom: '1.75rem',
        boxShadow: '0 4px 16px rgba(37, 99, 235, 0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                  borderRadius: '7px',
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
          <div style={{ background: '#f8fafc', borderRadius: '14px', border: '1.5px solid #e2e8f0', padding: '1.1rem' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>1. Print Pending</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', margin: '4px 0' }}>
              {pipeline.pending?.count || 0} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Cards</span>
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#2563eb' }}>{fmtMtr(pipeline.pending?.meters || 0)}</div>
          </div>

          {/* Stage 2: Fusing Pending */}
          <div style={{ background: '#fff7ed', borderRadius: '14px', border: '1.5px solid #fed7aa', padding: '1.1rem' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#c2410c', textTransform: 'uppercase' }}>2. In Fusing Queue</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ea580c', margin: '4px 0' }}>
              {pipeline.inFusing?.count || 0} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#c2410c' }}>Cards</span>
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ea580c' }}>{fmtMtr(pipeline.inFusing?.meters || 0)}</div>
          </div>

          {/* Stage 3: Ready for Delivery */}
          <div style={{ background: '#f0fdf4', borderRadius: '14px', border: '1.5px solid #bbf7d0', padding: '1.1rem' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>3. Ready for Dispatch</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#059669', margin: '4px 0' }}>
              {pipeline.readyForDelivery?.count || 0} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#047857' }}>Cards</span>
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#059669' }}>{fmtMtr(pipeline.readyForDelivery?.meters || 0)}</div>
          </div>

          {/* Stage 4: Delivered */}
          <div style={{ background: '#eff6ff', borderRadius: '14px', border: '1.5px solid #bfdbfe', padding: '1.1rem' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>4. Dispatched Total</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1d4ed8', margin: '4px 0' }}>
              {pipeline.delivered?.count || 0} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e40af' }}>Cards</span>
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#2563eb' }}>{fmtMtr(pipeline.delivered?.meters || 0)}</div>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: RAW MATERIALS & INK STOCK GAUGES ─────────────────────── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #bfdbfe',
        padding: '1.4rem 1.6rem',
        marginBottom: '1.75rem',
        boxShadow: '0 4px 16px rgba(37, 99, 235, 0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Droplets size={18} color="#2563eb" /> Live Ink Levels & Raw Materials Health
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Current factory ink canister levels (CMYK Liters) and sublimation paper stock
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', fontWeight: 700, flexWrap: 'wrap' }}>
            <span style={{ background: '#eff6ff', color: '#2563eb', padding: '4px 10px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
              📜 Paper Rolls: {rawMaterials.inkStock?.paperRolls || 0} Rolls in Stock
            </span>
            <span style={{ background: '#f0fdf4', color: '#15803d', padding: '4px 10px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              💧 Today Consumed: {rawMaterials.todayInkConsumed || 0} L
            </span>
            {onNavigateDepartment && (
              <button
                type="button"
                onClick={() => onNavigateDepartment('raw_materials')}
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
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
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #bfdbfe',
          padding: '1.35rem 1.6rem',
          boxShadow: '0 4px 16px rgba(37, 99, 235, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Package size={18} color="#2563eb" /> Daily Fabric Management
            </h3>
            {onNavigateDepartment && (
              <button
                type="button"
                onClick={() => onNavigateDepartment('fabric')}
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
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
            <div style={{ background: '#f0fdf4', padding: '0.85rem', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#15803d' }}>📥 Fabric Inward Today</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
                {fmtMtr(fabric.inwardMetersToday || 0)}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{fabric.inwardRollsToday || 0} Rolls Received</div>
            </div>

            <div style={{ background: '#eff6ff', padding: '0.85rem', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1d4ed8' }}>📤 Fabric Issued Today</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#2563eb', marginTop: '2px' }}>
                {fmtMtr(fabric.issuedMetersToday || 0)}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{fabric.issuedRollsToday || 0} Rolls to Production</div>
            </div>
          </div>
        </div>

        {/* Quality & Complaints Status */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #bfdbfe',
          padding: '1.35rem 1.6rem',
          boxShadow: '0 4px 16px rgba(37, 99, 235, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} color="#2563eb" /> Quality & Complaints Health
            </h3>
            {onNavigateDepartment && (
              <button
                type="button"
                onClick={() => onNavigateDepartment('complaint')}
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
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

            <div style={{ background: '#f0fdf4', padding: '0.85rem', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
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
