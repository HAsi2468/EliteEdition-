import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  RefreshCw,
  Edit3,
  Check,
  X,
  FileText,
  Printer,
  ChevronRight,
  AlertCircle,
  PieChart,
  Truck,
  Users,
  Building,
  Zap,
  Wrench,
  Coffee,
  Trash2,
  Package,
  Layers,
  ShoppingBag,
  Receipt,
  Download
} from 'lucide-react';
import { api } from '../services/api';

const fmtINR = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CATEGORY_META = {
  paper: { label: 'Paper Cost', icon: Layers, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.3)' },
  ink: { label: 'Ink Cost', icon: Zap, color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.3)' },
  salary: { label: 'Salaries & Wages', icon: Users, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.3)' },
  rent: { label: 'Factory Rent', icon: Building, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)', border: 'rgba(99, 102, 241, 0.3)' },
  electricity: { label: 'Electricity & Utility', icon: Zap, color: '#eab308', bg: 'rgba(234, 179, 8, 0.12)', border: 'rgba(234, 179, 8, 0.3)' },
  maintenance: { label: 'Machine Maintenance', icon: Wrench, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.3)' },
  transport: { label: 'Transportation & Freight', icon: Truck, color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.12)', border: 'rgba(20, 184, 166, 0.3)' },
  wastage: { label: 'Wastage & Scrap Loss', icon: Trash2, color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.3)' },
  food: { label: 'Food & Refreshments', icon: Coffee, color: '#84cc16', bg: 'rgba(132, 204, 22, 0.12)', border: 'rgba(132, 204, 22, 0.3)' },
  machine: { label: 'Machine Cost / EMI', icon: Printer, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.3)' },
  other: { label: 'Other Sundry Expenses', icon: Package, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)' }
};

export default function DigitalPrintCostingScreen({ companyEntity = 'Elite Digital Print' }) {
  const getCurrentMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState(null);
  const [activeSubView, setActiveSubView] = useState('overview'); // 'overview', 'invoices', 'expenses'

  // Modal for editing fixed monthly overheads
  const [showOverheadsModal, setShowOverheadsModal] = useState(false);
  const [savingOverheads, setSavingOverheads] = useState(false);
  const [overheadForm, setOverheadForm] = useState({
    paperCost: 0,
    inkCost: 0,
    salaryCost: 0,
    rentCost: 0,
    electricityCost: 0,
    maintenanceCost: 0,
    transportCost: 0,
    wastageCost: 0,
    foodCost: 0,
    machineCost: 0,
    otherCost: 0,
    notes: ''
  });

  const fetchCostingReport = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.getMonthlyCostingReport({
        month: selectedMonth,
        companyEntity
      });
      if (res && res.success) {
        setReportData(res);
        if (res.overheads) {
          setOverheadForm(res.overheads);
        }
      } else {
        setError(res?.error || 'Failed to fetch costing report.');
      }
    } catch (err) {
      console.error('Costing report error:', err);
      setError(err.message || 'Failed to load costing report.');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, companyEntity]);

  useEffect(() => {
    fetchCostingReport();
  }, [fetchCostingReport]);

  const handleSaveOverheads = async (e) => {
    e.preventDefault();
    try {
      setSavingOverheads(true);
      await api.saveMonthlyCostingOverheads({
        month: selectedMonth,
        companyEntity,
        ...overheadForm
      });
      setShowOverheadsModal(false);
      await fetchCostingReport();
    } catch (err) {
      alert(err.message || 'Failed to save overheads.');
    } finally {
      setSavingOverheads(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const summary = reportData?.financialSummary || {};
  const breakdown = reportData?.costBreakdown || {};
  const invoices = reportData?.invoices || [];
  const expenses = reportData?.expenses || [];

  const isPlus = summary.isPlus ?? true;
  const netAmount = Math.abs(summary.netProfitOrLoss || 0);

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const monthLabel = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <div style={{ padding: '1.25rem 1.5rem', maxWidth: '1440px', margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* ── Top Header Toolbar ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem',
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))',
        padding: '1.25rem 1.5rem',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.4rem' }}>📊</span>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: '#fff' }}>
              Monthly Costing & Profit/Loss Statement
            </h1>
            <span style={{
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: '1px solid rgba(56, 189, 248, 0.3)'
            }}>
              {companyEntity}
            </span>
          </div>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
            Live aggregation of monthly invoice billings against Paper, Ink, Salaries, Rent, Electricity & Overheads.
          </p>
        </div>

        {/* Month Picker & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            padding: '2px'
          }}>
            <button
              onClick={handlePrevMonth}
              title="Previous Month"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                padding: '0.45rem 0.75rem',
                cursor: 'pointer',
                borderRadius: '8px'
              }}
            >
              ◀
            </button>
            <div style={{ padding: '0.35rem 0.85rem', fontWeight: 800, fontSize: '0.9rem', color: '#38bdf8' }}>
              {monthLabel()}
            </div>
            <button
              onClick={handleNextMonth}
              title="Next Month"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                padding: '0.45rem 0.75rem',
                cursor: 'pointer',
                borderRadius: '8px'
              }}
            >
              ▶
            </button>
          </div>

          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: 'rgba(15, 23, 42, 0.8)',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600
            }}
          />

          <button
            onClick={() => setShowOverheadsModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1rem',
              borderRadius: '10px',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(126, 34, 206, 0.2))',
              color: '#c084fc',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Edit3 size={15} /> Fixed Overheads
          </button>

          <button
            onClick={fetchCostingReport}
            title="Refresh Data"
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#cbd5e1',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={15} className={loading ? 'spin-loader' : ''} />
          </button>

          <button
            onClick={handlePrint}
            title="Print Monthly Report"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1rem',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#fff',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
            }}
          >
            <Printer size={15} /> Print Report
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          borderRadius: '12px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#fca5a5',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* ── Executive Hero Verdict: PLUS or MINUS ──────────────────────────── */}
      <div style={{
        background: isPlus
          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.08) 100%)'
          : 'linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(185, 28, 28, 0.08) 100%)',
        border: `1.5px solid ${isPlus ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
        borderRadius: '20px',
        padding: '1.75rem 2rem',
        marginBottom: '1.75rem',
        boxShadow: isPlus ? '0 12px 36px rgba(16, 185, 129, 0.15)' : '0 12px 36px rgba(239, 68, 68, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.5rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: isPlus ? '#10b981' : '#ef4444',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
            }}>
              {isPlus ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
            </span>
            <div>
              <span style={{
                fontSize: '0.78rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: isPlus ? '#34d399' : '#fca5a5'
              }}>
                Monthly Bottom Line Status ({monthLabel()})
              </span>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: 900,
                margin: '2px 0 0 0',
                color: isPlus ? '#10b981' : '#ef4444',
                letterSpacing: '-0.03em'
              }}>
                {isPlus ? '🟢 YOU ARE IN PLUS' : '🔴 YOU ARE IN MINUS'}: {isPlus ? '+' : '-'}{fmtINR(netAmount)}
              </h2>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            {isPlus
              ? `🎉 Net Profit margin of ${summary.profitMarginPct || 0}% across all generated bills and factory operating costs.`
              : `⚠️ Operating costs exceed billed revenue by ${fmtINR(netAmount)}. Review high-expense cost centers below.`}
          </p>
        </div>

        {/* Big Key Figures Pills */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '0.85rem 1.25rem',
            borderRadius: '14px',
            minWidth: '160px'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Total Billed (Revenue)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>
              {fmtINR(summary.totalRevenue)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
              {summary.invoiceCount || 0} Invoices Generated
            </div>
          </div>

          <div style={{
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '0.85rem 1.25rem',
            borderRadius: '14px',
            minWidth: '160px'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Total Factory Costs</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f43f5e', marginTop: '2px' }}>
              {fmtINR(summary.totalOperationalCost)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
              11 Cost Centers
            </div>
          </div>

          <div style={{
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '0.85rem 1.25rem',
            borderRadius: '14px',
            minWidth: '160px'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Total Volume Printed</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399', marginTop: '2px' }}>
              {(summary.effectiveProductionMeters || 0).toLocaleString('en-IN')} Mtr
            </div>
            <div style={{ fontSize: '0.72rem', color: isPlus ? '#34d399' : '#fca5a5', marginTop: '2px' }}>
              {isPlus ? `+₹ ${summary.profitPerMeter || 0}/Mtr Profit` : `-₹ ${Math.abs(summary.profitPerMeter || 0)}/Mtr Loss`}
            </div>
          </div>
        </div>
      </div>

      {/* ── Per-Meter Economics Strip ──────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          padding: '1rem 1.25rem'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Production Cost / Meter</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f43f5e', margin: '4px 0' }}>
            ₹ {summary.costPerMeter || 0} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>/ Mtr</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>All paper, ink, power, rent & labor included</div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          padding: '1rem 1.25rem'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Average Billed / Meter</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', margin: '4px 0' }}>
            ₹ {summary.revenuePerMeter || 0} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>/ Mtr</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Average billing realization rate</div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          padding: '1rem 1.25rem'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Net Margin %</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: isPlus ? '#34d399' : '#fca5a5', margin: '4px 0' }}>
            {summary.profitMarginPct || 0}%
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Percentage of billed revenue retained</div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          padding: '1rem 1.25rem'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Collected vs Pending</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#34d399', margin: '4px 0' }}>
            {fmtINR(summary.totalPaid)} <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>(Bal: {fmtINR(summary.totalBalance)})</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Payment collections this month</div>
        </div>
      </div>

      {/* ── Sub-navigation Tabs (Overview vs Invoices vs Expense Vouchers) ── */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        marginBottom: '1.5rem',
        paddingBottom: '0.5rem'
      }}>
        {[
          { id: 'overview', label: '📊 11 Cost Centers Breakdown', count: Object.keys(breakdown).length },
          { id: 'invoices', label: `🧾 Billed Invoices (${invoices.length})`, count: fmtINR(summary.totalRevenue) },
          { id: 'expenses', label: `💸 Expense Records (${expenses.length})`, count: fmtINR(summary.totalOperationalCost) }
        ].map(t => {
          const active = activeSubView === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveSubView(t.id)}
              style={{
                padding: '0.6rem 1.2rem',
                borderRadius: '10px',
                border: active ? '1px solid #38bdf8' : '1px solid transparent',
                background: active ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                color: active ? '#38bdf8' : '#94a3b8',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.15s'
              }}
            >
              <span>{t.label}</span>
              {t.count && (
                <span style={{
                  fontSize: '0.72rem',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background: active ? '#38bdf8' : 'rgba(255,255,255,0.08)',
                  color: active ? '#0f172a' : '#94a3b8',
                  fontWeight: 800
                }}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── View 1: 11 Cost Centers Grid ─────────────────────────────────── */}
      {activeSubView === 'overview' && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.25rem',
            marginBottom: '2rem'
          }}>
            {Object.entries(breakdown).map(([key, data]) => {
              const meta = CATEGORY_META[key] || CATEGORY_META.other;
              const IconComp = meta.icon;
              const totalCostSum = summary.totalOperationalCost || 1;
              const pct = Math.round(((data.total || 0) / totalCostSum) * 100);

              return (
                <div
                  key={key}
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${meta.border}`,
                    borderRadius: '16px',
                    padding: '1.25rem',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'transform 0.15s, box-shadow 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: meta.bg,
                        color: meta.color
                      }}>
                        <IconComp size={18} />
                      </span>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc' }}>
                          {data.label || meta.label}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                          {pct}% of monthly costs
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: meta.color, marginBottom: '0.65rem' }}>
                    {fmtINR(data.total)}
                  </div>

                  {/* Split: Recorded vs Fixed */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.72rem',
                    color: '#94a3b8',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    paddingTop: '0.5rem'
                  }}>
                    <span>Vouchers: <strong>{fmtINR(data.recorded)}</strong></span>
                    <span>Fixed/Budget: <strong>{fmtINR(data.fixed)}</strong></span>
                  </div>

                  {/* Progress Bar */}
                  <div style={{
                    width: '100%',
                    height: '4px',
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: '999px',
                    marginTop: '0.65rem',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${Math.min(pct, 100)}%`,
                      height: '100%',
                      background: meta.color,
                      borderRadius: '999px'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Overhead Adjustment Banner */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.1), rgba(124, 58, 237, 0.1))',
            border: '1px solid rgba(124, 58, 237, 0.3)',
            borderRadius: '16px',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 800, color: '#c084fc' }}>
                💡 Fixed Monthly Overheads (Rent, Machine EMI, Staff Salaries)
              </h4>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
                If recurring items like Factory Rent or Machine EMIs are not entered via daily vouchers, you can set fixed monthly values here.
              </p>
            </div>
            <button
              onClick={() => setShowOverheadsModal(true)}
              style={{
                padding: '0.55rem 1.25rem',
                borderRadius: '10px',
                border: 'none',
                background: '#8b5cf6',
                color: '#fff',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 4px 14px rgba(139, 92, 246, 0.3)'
              }}
            >
              <Edit3 size={15} /> Edit Monthly Overheads
            </button>
          </div>
        </>
      )}

      {/* ── View 2: Billed Invoices Table ─────────────────────────────────── */}
      {activeSubView === 'invoices' && (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>
              All Invoices Billed for {monthLabel()}
            </h3>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#38bdf8' }}>
              Total: {fmtINR(summary.totalRevenue)}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.2)', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>Invoice No</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>Date</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>Party / Client</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', textAlign: 'right' }}>Meters</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', textAlign: 'right' }}>Taxable</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', textAlign: 'right' }}>GST</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', textAlign: 'right' }}>Grand Total</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                      No invoices found for {monthLabel()}.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#38bdf8' }}>{inv.invoiceNo}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{inv.date}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{inv.party}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#34d399' }}>
                        {inv.meters > 0 ? `${inv.meters.toLocaleString('en-IN')}m` : '—'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{fmtINR(inv.subtotal)}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#f59e0b' }}>{fmtINR(inv.tax)}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#f8fafc' }}>
                        {fmtINR(inv.grandTotal)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          background: inv.paymentStatus === 'PAID' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: inv.paymentStatus === 'PAID' ? '#34d399' : '#fca5a5'
                        }}>
                          {inv.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── View 3: Expense Vouchers Table ────────────────────────────────── */}
      {activeSubView === 'expenses' && (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>
              Recorded Expense Vouchers for {monthLabel()}
            </h3>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f43f5e' }}>
              Total: {fmtINR(expenses.reduce((s, e) => s + e.amount, 0))}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.2)', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>Voucher No</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>Date</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>Title / Description</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>Cost Center</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>Paid To</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>Mode</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                      No expenses recorded for {monthLabel()}.
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp) => {
                    const meta = CATEGORY_META[exp.detectedKey] || CATEGORY_META.other;
                    return (
                      <tr key={exp._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#c084fc' }}>{exp.voucherNo}</td>
                        <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{exp.date}</td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                          <div>{exp.title}</div>
                          {exp.description && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{exp.description}</div>}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: meta.bg,
                            color: meta.color,
                            border: `1px solid ${meta.border}`
                          }}>
                            {meta.label}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>{exp.paidTo || '—'}</td>
                        <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{exp.paymentMode}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#f43f5e' }}>
                          {fmtINR(exp.amount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Fixed Overheads Edit Modal ────────────────────────────────────── */}
      {showOverheadsModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '20px',
            maxWidth: '680px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.75rem',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                  ⚙️ Fixed Overheads Budget — {monthLabel()}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                  Set monthly recurring amounts for Rent, Machine EMI, fixed staff payroll, etc.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOverheadsModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveOverheads}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#38bdf8', marginBottom: '4px' }}>
                    📄 Sublimation Paper Budget (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overheadForm.paperCost}
                    onChange={(e) => setOverheadForm({ ...overheadForm, paperCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#fff' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#f43f5e', marginBottom: '4px' }}>
                    🎨 Sublimation Ink Budget (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overheadForm.inkCost}
                    onChange={(e) => setOverheadForm({ ...overheadForm, inkCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#fff' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#a855f7', marginBottom: '4px' }}>
                    👥 Monthly Staff Salary (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overheadForm.salaryCost}
                    onChange={(e) => setOverheadForm({ ...overheadForm, salaryCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#fff' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#6366f1', marginBottom: '4px' }}>
                    🏢 Factory Rent (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overheadForm.rentCost}
                    onChange={(e) => setOverheadForm({ ...overheadForm, rentCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#fff' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#eab308', marginBottom: '4px' }}>
                    ⚡ Electricity / Power (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overheadForm.electricityCost}
                    onChange={(e) => setOverheadForm({ ...overheadForm, electricityCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#fff' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#ec4899', marginBottom: '4px' }}>
                    🛠️ Machine Maintenance (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overheadForm.maintenanceCost}
                    onChange={(e) => setOverheadForm({ ...overheadForm, maintenanceCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#fff' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#14b8a6', marginBottom: '4px' }}>
                    🚚 Transportation & Freight (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overheadForm.transportCost}
                    onChange={(e) => setOverheadForm({ ...overheadForm, transportCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#fff' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#f97316', marginBottom: '4px' }}>
                    🗑️ Wastage & Scrap Loss (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overheadForm.wastageCost}
                    onChange={(e) => setOverheadForm({ ...overheadForm, wastageCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#fff' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#84cc16', marginBottom: '4px' }}>
                    ☕ Staff Food & Refreshments (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overheadForm.foodCost}
                    onChange={(e) => setOverheadForm({ ...overheadForm, foodCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#fff' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#06b6d4', marginBottom: '4px' }}>
                    🖨️ Machine Cost / Monthly EMI (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overheadForm.machineCost}
                    onChange={(e) => setOverheadForm({ ...overheadForm, machineCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#fff' }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>
                    📦 Other Sundry Overheads (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overheadForm.otherCost}
                    onChange={(e) => setOverheadForm({ ...overheadForm, otherCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowOverheadsModal(false)}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '10px',
                    border: '1px solid #475569',
                    background: 'transparent',
                    color: '#cbd5e1',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingOverheads}
                  style={{
                    padding: '0.6rem 1.5rem',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#8b5cf6',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)'
                  }}
                >
                  {savingOverheads ? 'Saving...' : '💾 Save Overheads'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
