import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Layers,
  Zap,
  Users,
  Building,
  Wrench,
  Truck,
  Trash2,
  Coffee,
  Printer,
  Package,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Edit3,
  X,
  FileText,
  Receipt,
  Download
} from 'lucide-react';
import { api } from '../services/api';

const fmtINR = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CATEGORY_META = {
  paper: { label: 'Paper Cost', icon: Layers, color: '#0284c7', bg: '#e0f2fe', border: '#bae6fd' },
  ink: { label: 'Ink Cost', icon: Zap, color: '#2563eb', bg: '#dbeafe', border: '#bfdbfe' },
  salary: { label: 'Salaries & Wages', icon: Users, color: '#4f46e5', bg: '#e0e7ff', border: '#c7d2fe' },
  rent: { label: 'Factory Rent', icon: Building, color: '#0891b2', bg: '#cffafe', border: '#a5f3fc' },
  electricity: { label: 'Electricity & Utility', icon: Zap, color: '#d97706', bg: '#fef3c7', border: '#fde68a' },
  maintenance: { label: 'Machine Maintenance', icon: Wrench, color: '#0d9488', bg: '#ccfbf1', border: '#99f6e4' },
  transport: { label: 'Transportation & Freight', icon: Truck, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  wastage: { label: 'Wastage & Scrap Loss', icon: Trash2, color: '#e11d48', bg: '#ffe4e6', border: '#fecdd3' },
  food: { label: 'Food & Refreshments', icon: Coffee, color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0' },
  machine: { label: 'Machine Cost / EMI', icon: Printer, color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd' },
  other: { label: 'Other Sundry Expenses', icon: Package, color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0' }
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
    <div style={{
      padding: '1.25rem 1.5rem',
      maxWidth: '1440px',
      margin: '0 auto',
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
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe'
            }}>
              <TrendingUp size={22} />
            </span>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: '#1e3a8a' }}>
              Costing
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
              {companyEntity}
            </span>
          </div>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Monthly cost centers breakdown, invoice billing realization & net financial standing
          </p>
        </div>

        {/* Month Picker & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#eff6ff',
            borderRadius: '10px',
            border: '1px solid #bfdbfe',
            padding: '2px'
          }}>
            <button
              onClick={handlePrevMonth}
              title="Previous Month"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#2563eb',
                padding: '0.45rem 0.75rem',
                cursor: 'pointer',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '0.85rem'
              }}
            >
              ◀
            </button>
            <div style={{ padding: '0.35rem 0.85rem', fontWeight: 800, fontSize: '0.9rem', color: '#1e40af' }}>
              {monthLabel()}
            </div>
            <button
              onClick={handleNextMonth}
              title="Next Month"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#2563eb',
                padding: '0.45rem 0.75rem',
                cursor: 'pointer',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '0.85rem'
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
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: '0.85rem',
              fontWeight: 600,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
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
              border: '1px solid #bfdbfe',
              background: '#eff6ff',
              color: '#1d4ed8',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s'
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
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#2563eb',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
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
              padding: '0.5rem 1.15rem',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)'
            }}
          >
            <Printer size={15} /> Print Report
          </button>
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
          fontSize: '0.9rem',
          fontWeight: 600
        }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* ── Executive Hero Verdict: PLUS or MINUS (White & Blue Theme) ──────── */}
      <div style={{
        background: isPlus
          ? 'linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)'
          : 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)',
        border: `1.5px solid ${isPlus ? '#86efac' : '#fca5a5'}`,
        borderRadius: '20px',
        padding: '1.75rem 2rem',
        marginBottom: '1.75rem',
        boxShadow: isPlus
          ? '0 10px 25px -5px rgba(16, 185, 129, 0.12), 0 4px 10px -3px rgba(37, 99, 235, 0.05)'
          : '0 10px 25px -5px rgba(239, 68, 68, 0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.5rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.5rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: isPlus ? '#10b981' : '#ef4444',
              color: '#ffffff',
              boxShadow: isPlus
                ? '0 6px 16px rgba(16, 185, 129, 0.35)'
                : '0 6px 16px rgba(239, 68, 68, 0.35)'
            }}>
              {isPlus ? <TrendingUp size={26} /> : <TrendingDown size={26} />}
            </span>
            <div>
              <span style={{
                fontSize: '0.78rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: isPlus ? '#047857' : '#b91c1c'
              }}>
                Monthly Bottom Line Status ({monthLabel()})
              </span>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: 900,
                margin: '2px 0 0 0',
                color: isPlus ? '#047857' : '#b91c1c',
                letterSpacing: '-0.03em'
              }}>
                {isPlus ? '🟢 YOU ARE IN PLUS' : '🔴 YOU ARE IN MINUS'}: {isPlus ? '+' : '-'}{fmtINR(netAmount)}
              </h2>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>
            {isPlus
              ? `🎉 Net Profit margin of ${summary.profitMarginPct || 0}% across all generated bills and factory operating costs.`
              : `⚠️ Operating costs exceed billed revenue by ${fmtINR(netAmount)}. Review high-expense cost centers below.`}
          </p>
        </div>

        {/* Big Key Figures Pills (Clean White Cards) */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #bfdbfe',
            padding: '0.95rem 1.35rem',
            borderRadius: '14px',
            minWidth: '170px',
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.06)'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Billed (Revenue)
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#2563eb', marginTop: '2px' }}>
              {fmtINR(summary.totalRevenue)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', fontWeight: 600 }}>
              {summary.invoiceCount || 0} Invoices Generated
            </div>
          </div>

          <div style={{
            background: '#ffffff',
            border: '1px solid #fecaca',
            padding: '0.95rem 1.35rem',
            borderRadius: '14px',
            minWidth: '170px',
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.05)'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Factory Costs
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#dc2626', marginTop: '2px' }}>
              {fmtINR(summary.totalOperationalCost)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', fontWeight: 600 }}>
              11 Cost Centers
            </div>
          </div>

          <div style={{
            background: '#ffffff',
            border: '1px solid #bbf7d0',
            padding: '0.95rem 1.35rem',
            borderRadius: '14px',
            minWidth: '170px',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.05)'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Volume Printed
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
              {(summary.effectiveProductionMeters || 0).toLocaleString('en-IN')} Mtr
            </div>
            <div style={{ fontSize: '0.75rem', color: isPlus ? '#059669' : '#b91c1c', marginTop: '2px', fontWeight: 700 }}>
              {isPlus ? `+₹ ${summary.profitPerMeter || 0}/Mtr Profit` : `-₹ ${Math.abs(summary.profitPerMeter || 0)}/Mtr Loss`}
            </div>
          </div>
        </div>
      </div>

      {/* ── Per-Meter Economics Strip (White & Blue Cards) ──────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          padding: '1.1rem 1.25rem',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Production Cost / Meter
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#dc2626', margin: '4px 0' }}>
            ₹ {summary.costPerMeter || 0} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>/ Mtr</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Paper, ink, power, rent & labor included</div>
        </div>

        <div style={{
          background: '#ffffff',
          border: '1px solid #bfdbfe',
          borderRadius: '14px',
          padding: '1.1rem 1.25rem',
          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.05)'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Average Billed / Meter
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#2563eb', margin: '4px 0' }}>
            ₹ {summary.revenuePerMeter || 0} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>/ Mtr</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Average billing realization rate</div>
        </div>

        <div style={{
          background: '#ffffff',
          border: '1px solid #bbf7d0',
          borderRadius: '14px',
          padding: '1.1rem 1.25rem',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Net Margin %
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: isPlus ? '#059669' : '#b91c1c', margin: '4px 0' }}>
            {summary.profitMarginPct || 0}%
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Percentage of billed revenue retained</div>
        </div>

        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          padding: '1.1rem 1.25rem',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Collected vs Pending
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#059669', margin: '4px 0' }}>
            {fmtINR(summary.totalPaid)} <span style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 700 }}>(Bal: {fmtINR(summary.totalBalance)})</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Payment collections this month</div>
        </div>
      </div>

      {/* ── Sub-navigation Tabs (White & Blue) ──────────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        background: '#ffffff',
        padding: '6px',
        borderRadius: '14px',
        border: '1px solid #bfdbfe',
        marginBottom: '1.5rem',
        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.04)'
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
                padding: '0.65rem 1.25rem',
                borderRadius: '10px',
                border: 'none',
                background: active ? '#2563eb' : 'transparent',
                color: active ? '#ffffff' : '#475569',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.15s',
                boxShadow: active ? '0 2px 8px rgba(37, 99, 235, 0.3)' : 'none'
              }}
            >
              <span>{t.label}</span>
              {t.count && (
                <span style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: active ? '#eff6ff' : '#f1f5f9',
                  color: active ? '#1d4ed8' : '#475569',
                  fontWeight: 800
                }}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── View 1: 11 Cost Centers Grid (White & Blue) ─────────────────────── */}
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
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)',
                    transition: 'transform 0.15s, box-shadow 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: meta.bg,
                        color: meta.color,
                        border: `1px solid ${meta.border}`
                      }}>
                        <IconComp size={19} />
                      </span>
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                          {data.label || meta.label}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
                          {pct}% of monthly costs
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#1e3a8a', marginBottom: '0.65rem' }}>
                    {fmtINR(data.total)}
                  </div>

                  {/* Split: Recorded vs Fixed */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.74rem',
                    color: '#64748b',
                    borderTop: '1px solid #f1f5f9',
                    paddingTop: '0.55rem',
                    fontWeight: 500
                  }}>
                    <span>Vouchers: <strong style={{ color: '#0f172a' }}>{fmtINR(data.recorded)}</strong></span>
                    <span>Fixed/Budget: <strong style={{ color: '#2563eb' }}>{fmtINR(data.fixed)}</strong></span>
                  </div>

                  {/* Progress Bar */}
                  <div style={{
                    width: '100%',
                    height: '5px',
                    background: '#eff6ff',
                    borderRadius: '999px',
                    marginTop: '0.65rem',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${Math.min(pct, 100)}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #3b82f6, #2563eb)',
                      borderRadius: '999px'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Overhead Adjustment Banner (White & Blue) */}
          <div style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            border: '1px solid #bfdbfe',
            borderRadius: '16px',
            padding: '1.25rem 1.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.06)'
          }}>
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 800, color: '#1e40af' }}>
                💡 Fixed Monthly Overheads (Rent, Machine EMI, Staff Salaries)
              </h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>
                If recurring items like Factory Rent or Machine EMIs are not entered via daily vouchers, you can set fixed monthly values here.
              </p>
            </div>
            <button
              onClick={() => setShowOverheadsModal(true)}
              style={{
                padding: '0.6rem 1.35rem',
                borderRadius: '10px',
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)'
              }}
            >
              <Edit3 size={15} /> Edit Monthly Overheads
            </button>
          </div>
        </>
      )}

      {/* ── View 2: Billed Invoices Table (White & Blue) ───────────────────── */}
      {activeSubView === 'invoices' && (
        <div style={{
          background: '#ffffff',
          border: '1px solid #bfdbfe',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(37, 99, 235, 0.06)'
        }}>
          <div style={{
            padding: '1.1rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#eff6ff'
          }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e3a8a' }}>
              All Invoices Billed for {monthLabel()}
            </h3>
            <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#2563eb' }}>
              Total: {fmtINR(summary.totalRevenue)}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.85rem 1rem', color: '#1e40af', fontWeight: 700 }}>Invoice No</th>
                  <th style={{ padding: '0.85rem 1rem', color: '#64748b', fontWeight: 700 }}>Date</th>
                  <th style={{ padding: '0.85rem 1rem', color: '#1e40af', fontWeight: 700 }}>Party / Client</th>
                  <th style={{ padding: '0.85rem 1rem', color: '#1e40af', textAlign: 'right', fontWeight: 700 }}>Meters</th>
                  <th style={{ padding: '0.85rem 1rem', color: '#64748b', textAlign: 'right', fontWeight: 700 }}>Taxable</th>
                  <th style={{ padding: '0.85rem 1rem', color: '#64748b', textAlign: 'right', fontWeight: 700 }}>GST</th>
                  <th style={{ padding: '0.85rem 1rem', color: '#1e40af', textAlign: 'right', fontWeight: 800 }}>Grand Total</th>
                  <th style={{ padding: '0.85rem 1rem', color: '#64748b', textAlign: 'center', fontWeight: 700 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                      No invoices found for {monthLabel()}.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#2563eb' }}>{inv.invoiceNo}</td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontWeight: 500 }}>{inv.date}</td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a' }}>{inv.party}</td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                        {inv.meters > 0 ? `${inv.meters.toLocaleString('en-IN')}m` : '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#334155' }}>{fmtINR(inv.subtotal)}</td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#d97706', fontWeight: 600 }}>{fmtINR(inv.tax)}</td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>
                        {fmtINR(inv.grandTotal)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '999px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          background: inv.paymentStatus === 'PAID' ? '#dcfce7' : '#fee2e2',
                          color: inv.paymentStatus === 'PAID' ? '#15803d' : '#b91c1c'
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

      {/* ── View 3: Expense Vouchers Table (White & Blue) ──────────────────── */}
      {activeSubView === 'expenses' && (
        <div style={{
          background: '#ffffff',
          border: '1px solid #bfdbfe',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(37, 99, 235, 0.06)'
        }}>
          <div style={{
            padding: '1.1rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#eff6ff'
          }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e3a8a' }}>
              Recorded Expense Vouchers for {monthLabel()}
            </h3>
            <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#dc2626' }}>
              Total: {fmtINR(expenses.reduce((s, e) => s + e.amount, 0))}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.85rem 1rem', color: '#1e40af', fontWeight: 700 }}>Voucher No</th>
                  <th style={{ padding: '0.85rem 1rem', color: '#64748b', fontWeight: 700 }}>Date</th>
                  <th style={{ padding: '0.85rem 1rem', color: '#1e40af', fontWeight: 700 }}>Title / Description</th>
                  <th style={{ padding: '0.85rem 1rem', color: '#1e40af', fontWeight: 700 }}>Cost Center</th>
                  <th style={{ padding: '0.85rem 1rem', color: '#64748b', fontWeight: 700 }}>Paid To</th>
                  <th style={{ padding: '0.85rem 1rem', color: '#64748b', fontWeight: 700 }}>Mode</th>
                  <th style={{ padding: '0.85rem 1rem', color: '#dc2626', textAlign: 'right', fontWeight: 800 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                      No expenses recorded for {monthLabel()}.
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp) => {
                    const meta = CATEGORY_META[exp.detectedKey] || CATEGORY_META.other;
                    return (
                      <tr key={exp._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#2563eb' }}>{exp.voucherNo}</td>
                        <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontWeight: 500 }}>{exp.date}</td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                          <div>{exp.title}</div>
                          {exp.description && <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 400 }}>{exp.description}</div>}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '8px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: meta.bg,
                            color: meta.color,
                            border: `1px solid ${meta.border}`
                          }}>
                            {meta.label}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: '#334155', fontWeight: 500 }}>{exp.paidTo || '—'}</td>
                        <td style={{ padding: '0.85rem 1rem', color: '#64748b' }}>{exp.paymentMode}</td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 900, color: '#dc2626' }}>
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

      {/* ── Fixed Overheads Edit Modal (Clean White & Blue Dialog) ─────────── */}
      {showOverheadsModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #bfdbfe',
            borderRadius: '20px',
            maxWidth: '680px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.75rem',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#1e3a8a' }}>
                  ⚙️ Fixed Overheads Budget — {monthLabel()}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Set monthly recurring amounts for Rent, Machine EMI, fixed staff payroll, etc.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOverheadsModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSaveOverheads}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0284c7', marginBottom: '4px' }}>
                    📄 Sublimation Paper Budget (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overheadForm.paperCost}
                    onChange={(e) => setOverheadForm({ ...overheadForm, paperCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 600 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#2563eb', marginBottom: '4px' }}>
                    🎨 Sublimation Ink Budget (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overheadForm.inkCost}
                    onChange={(e) => setOverheadForm({ ...overheadForm, inkCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 600 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#4f46e5', marginBottom: '4px' }}>
                    👥 Monthly Staff Salary (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overheadForm.salaryCost}
                    onChange={(e) => setOverheadForm({ ...overheadForm, salaryCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 600 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0891b2', marginBottom: '4px' }}>
                    🏢 Factory Rent (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overheadForm.rentCost}
                    onChange={(e) => setOverheadForm({ ...overheadForm, rentCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 600 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#d97706', marginBottom: '4px' }}>
                    ⚡ Electricity / Power (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overheadForm.electricityCost}
                    onChange={(e) => setOverheadForm({ ...overheadForm, electricityCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 600 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0d9488', marginBottom: '4px' }}>
                    🛠️ Machine Maintenance (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overheadForm.maintenanceCost}
                    onChange={(e) => setOverheadForm({ ...overheadForm, maintenanceCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 600 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#2563eb', marginBottom: '4px' }}>
                    🚚 Transportation & Freight (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overheadForm.transportCost}
                    onChange={(e) => setOverheadForm({ ...overheadForm, transportCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 600 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#e11d48', marginBottom: '4px' }}>
                    🗑️ Wastage & Scrap Loss (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overheadForm.wastageCost}
                    onChange={(e) => setOverheadForm({ ...overheadForm, wastageCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 600 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#16a34a', marginBottom: '4px' }}>
                    ☕ Staff Food & Refreshments (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overheadForm.foodCost}
                    onChange={(e) => setOverheadForm({ ...overheadForm, foodCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 600 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#1d4ed8', marginBottom: '4px' }}>
                    🖨️ Machine Cost / Monthly EMI (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overheadForm.machineCost}
                    onChange={(e) => setOverheadForm({ ...overheadForm, machineCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 600 }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    📦 Other Sundry Overheads (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overheadForm.otherCost}
                    onChange={(e) => setOverheadForm({ ...overheadForm, otherCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 600 }}
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
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#475569',
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
                    background: '#2563eb',
                    color: '#ffffff',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)'
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
