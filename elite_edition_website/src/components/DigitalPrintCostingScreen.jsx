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
  Edit3,
  X,
  FileText,
  Receipt,
  Download,
  Table,
  LayoutGrid
} from 'lucide-react';
import { api } from '../services/api';
import QuickActionMenu from './common/QuickActionMenu';
import { EntityBrandBadge } from './common/EntityBrandBadge';

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
  const [costingViewMode, setCostingViewMode] = useState('table'); // 'table' | 'cards'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState(null);
  const [activeSubView, setActiveSubView] = useState('overview'); // 'overview', 'invoices', 'expenses'

  // Modal for editing fixed monthly overheads
  const [showOverheadsModal, setShowOverheadsModal] = useState(false);
  const [savingOverheads, setSavingOverheads] = useState(false);
  const [overheadForm, setOverheadForm] = useState({
    fabricCost: 0,
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

  useEffect(() => {
    const handleGlobalRefresh = () => {
      fetchCostingReport();
    };
    window.addEventListener('elite-data-refresh', handleGlobalRefresh);
    return () => window.removeEventListener('elite-data-refresh', handleGlobalRefresh);
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
      {/* ── TIER 1: HEADER (Rule 5: No Extra Text, Quick Action on Right) ── */}
      <div className="glass-screen-header" style={{ marginBottom: '0.65rem' }}>
        <div className="glass-title-capsule">
          <div className="glass-title-icon" style={{ background: 'linear-gradient(135deg, #0284c7, #2563eb)' }}>
            <TrendingUp size={16} color="#ffffff" />
          </div>
          <span className="glass-screen-title">Costing</span>
          <EntityBrandBadge entityId={companyEntity} />
        </div>

        <div className="ent-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <QuickActionMenu />
        </div>
      </div>

      {/* ── TIER 2: SUB-SCREEN BUTTONS BAR (Rule 5) ── */}
      <div className="glass-subtabs-bar" style={{ marginBottom: '1rem' }}>
        {[
          { id: 'overview', label: `Cost Centers Breakdown (${Object.keys(breakdown).length})` },
          { id: 'invoices', label: `Billed Invoices (${invoices.length})` },
          { id: 'expenses', label: `Expense Records (${expenses.length})` }
        ].map(t => (
          <button
            key={t.id}
            type="button"
            className={`glass-subtab-btn ${activeSubView === t.id ? 'active' : ''}`}
            onClick={() => setActiveSubView(t.id)}
          >
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {error && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          background: 'rgba(239, 68, 68, 0.16)',
          border: '1px solid rgba(239, 68, 68, 0.40)',
          color: '#fca5a5',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.85rem',
          fontWeight: 600
        }}>
          <AlertCircle size={16} color="#ef4444" /> {error}
        </div>
      )}

      {/* ── TIER 3: SIDE SCROLLING CALCULATION CARDS TRACK (Rule 5) ── */}
      <div className="glass-scroll-track" style={{ marginBottom: '1rem' }}>
        {/* Card 1: Bottom Line Standing */}
        <div className="glass-card" style={{ minWidth: '220px', flex: '0 0 auto', padding: '0.9rem 1.15rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase' }}>Net Standing</span>
            {isPlus ? <TrendingUp size={16} color="#34d399" /> : <TrendingDown size={16} color="#f87171" />}
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: isPlus ? '#34d399' : '#f87171', marginTop: '4px' }}>
            {isPlus ? '+' : '-'}{fmtINR(netAmount)}
          </div>
          <div style={{ fontSize: '0.72rem', color: isPlus ? '#34d399' : '#f87171', marginTop: '2px', fontWeight: 700 }}>
            {isPlus ? `+${summary.profitMarginPct || 0}% Profit Margin` : 'Operating in Minus'}
          </div>
        </div>

        {/* Card 2: Total Billed Revenue */}
        <div className="glass-card" style={{ minWidth: '220px', flex: '0 0 auto', padding: '0.9rem 1.15rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase' }}>Total Billed Revenue</span>
            <DollarSign size={16} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#38bdf8', marginTop: '4px' }}>
            {fmtINR(summary.totalRevenue)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '2px' }}>
            {summary.invoiceCount || 0} Invoices Generated
          </div>
        </div>

        {/* Card 3: Total Factory Operating Costs */}
        <div className="glass-card" style={{ minWidth: '220px', flex: '0 0 auto', padding: '0.9rem 1.15rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase' }}>Factory Costs</span>
            <Receipt size={16} color="#f87171" />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#f87171', marginTop: '4px' }}>
            {fmtINR(summary.totalOperationalCost)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '2px' }}>
            11 Cost Centers
          </div>
        </div>

        {/* Card 4: Volume Printed */}
        <div className="glass-card" style={{ minWidth: '220px', flex: '0 0 auto', padding: '0.9rem 1.15rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase' }}>Volume Printed</span>
            <Printer size={16} color="#c084fc" />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#c084fc', marginTop: '4px' }}>
            {(summary.effectiveProductionMeters || 0).toLocaleString('en-IN')} Mtr
          </div>
          <div style={{ fontSize: '0.72rem', color: isPlus ? '#34d399' : '#f87171', marginTop: '2px', fontWeight: 700 }}>
            {isPlus ? `+₹ ${summary.profitPerMeter || 0}/Mtr` : `-₹ ${Math.abs(summary.profitPerMeter || 0)}/Mtr`}
          </div>
        </div>

        {/* Card 5: Production Cost / Mtr */}
        <div className="glass-card" style={{ minWidth: '220px', flex: '0 0 auto', padding: '0.9rem 1.15rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase' }}>Cost / Meter</span>
            <Zap size={16} color="#fbbf24" />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#fbbf24', marginTop: '4px' }}>
            ₹ {summary.costPerMeter || 0}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '2px' }}>
            All 11 overheads included
          </div>
        </div>

        {/* Card 6: Average Billed / Mtr */}
        <div className="glass-card" style={{ minWidth: '220px', flex: '0 0 auto', padding: '0.9rem 1.15rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase' }}>Realization / Mtr</span>
            <CheckCircle2 size={16} color="#34d399" />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#34d399', marginTop: '4px' }}>
            ₹ {summary.revenuePerMeter || 0}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '2px' }}>
            Avg realization rate
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
        marginBottom: '1.25rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Month Selector */}
          <div style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(15, 23, 42, 0.65)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.16)', padding: '2px' }}>
            <button onClick={handlePrevMonth} style={{ background: 'transparent', border: 'none', color: '#38bdf8', padding: '0.4rem 0.65rem', cursor: 'pointer', fontWeight: 800 }}>◀</button>
            <span style={{ padding: '0.35rem 0.75rem', fontWeight: 800, fontSize: '0.82rem', color: '#ffffff' }}>{monthLabel()}</span>
            <button onClick={handleNextMonth} style={{ background: 'transparent', border: 'none', color: '#38bdf8', padding: '0.4rem 0.65rem', cursor: 'pointer', fontWeight: 800 }}>▶</button>
          </div>

          <button
            onClick={() => setShowOverheadsModal(true)}
            style={{
              padding: '0.45rem 0.95rem',
              borderRadius: '8px',
              border: '1px solid rgba(56, 189, 248, 0.45)',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Edit3 size={14} /> Update Fixed Overheads
          </button>
        </div>

        {/* View Mode Toggle: Table View vs Card View */}
        <div className="glass-view-toggle">
          <button
            type="button"
            className={costingViewMode === 'table' ? 'active' : ''}
            onClick={() => setCostingViewMode('table')}
            title="Switch to High-Density Table View"
          >
            <FileText size={14} />
            <span>Table</span>
          </button>
          <button
            type="button"
            className={costingViewMode === 'cards' ? 'active' : ''}
            onClick={() => setCostingViewMode('cards')}
            title="Switch to Card Grid View"
          >
            <Layers size={14} />
            <span>Cards</span>
          </button>
        </div>
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
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#7c3aed', marginBottom: '4px' }}>
                    🧵 Fabric Purchase Budget (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={overheadForm.fabricCost}
                    onChange={(e) => setOverheadForm({ ...overheadForm, fabricCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 600 }}
                  />
                </div>

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
