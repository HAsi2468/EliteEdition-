import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  TrendingUp,
  Receipt,
  AlertTriangle,
  Wallet,
  Building,
  CheckCircle2,
  Clock,
  DollarSign,
  PlusCircle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  FileText,
  ChevronRight,
  Users,
  ShieldCheck,
  Layers
} from 'lucide-react';
import JobCardStatusDashboard from './JobCardStatusDashboard';
import QuickActionMenu from './common/QuickActionMenu';
import { EntityBrandBadge } from './common/EntityBrandBadge';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

const fmtINR = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CompanyDedicatedDashboard({ companyEntity = 'Elite Edition', onNavigate }) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(() => {
    try {
      const saved = localStorage.getItem(`elite_dashboard_stats_${companyEntity}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      totalRevenue: 0,
      invoiceCount: 0,
      paidAmount: 0,
      balanceDue: 0,
      paidCount: 0,
      unpaidCount: 0,
      partiallyPaidCount: 0,
      recentInvoices: []
    };
  });
  const [complaintStats, setComplaintStats] = useState({ total: 0, open: 0, resolved: 0 });
  const [expenseStats, setExpenseStats] = useState({ totalIn: 0, totalOut: 0 });

  useEffect(() => {
    fetchDashboardData();
  }, [companyEntity]);

  useEffect(() => {
    const handleGlobalRefresh = () => {
      fetchDashboardData();
    };
    window.addEventListener('elite-data-refresh', handleGlobalRefresh);
    return () => window.removeEventListener('elite-data-refresh', handleGlobalRefresh);
  }, [companyEntity]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [billingSettled, invSettled, compSettled, expSettled] = await Promise.allSettled([
        api.getBillingDashboardStats(companyEntity),
        api.getBillingInvoices({ companyEntity, limit: 10 }),
        api.getComplaintAnalytics({ companyEntity }),
        api.getExpenseAnalytics({ companyEntity }),
      ]);

      const billingRes = billingSettled.status === 'fulfilled' ? billingSettled.value : null;
      const invRes = invSettled.status === 'fulfilled' ? invSettled.value : null;
      const compRes = compSettled.status === 'fulfilled' ? compSettled.value : null;
      const expRes = expSettled.status === 'fulfilled' ? expSettled.value : null;

      let recent = [];
      if (invRes && invRes.success && Array.isArray(invRes.data)) {
        recent = invRes.data;
      } else if (Array.isArray(invRes)) {
        recent = invRes;
      }

      if (billingRes && (billingRes.success || billingRes.data || billingRes.totalRevenue !== undefined)) {
        const bData = billingRes.data || billingRes;
        const nextStats = {
          totalRevenue: Number(bData?.totalRevenue || 0),
          invoiceCount: Number(bData?.invoiceCount || 0),
          paidAmount: Number(bData?.paidAmount || 0),
          balanceDue: Number(bData?.balanceDue || 0),
          paidCount: Number(bData?.paidCount || 0),
          unpaidCount: Number(bData?.unpaidCount || 0),
          partiallyPaidCount: Number(bData?.partiallyPaidCount || 0),
          recentInvoices: (Array.isArray(bData?.recentInvoices) && bData.recentInvoices.length > 0)
            ? bData.recentInvoices
            : recent
        };
        setStats(nextStats);
        try {
          localStorage.setItem(`elite_dashboard_stats_${companyEntity}`, JSON.stringify(nextStats));
        } catch (e) {}
      }

      if (compRes) {
        const cData = compRes.data || compRes;
        setComplaintStats({
          total: Number(cData.total || 0),
          open: Number(cData.open || 0),
          resolved: Number(cData.resolved || 0)
        });
      }

      if (expRes) {
        const eData = expRes.data || expRes;
        setExpenseStats({
          totalIn: Number(eData.totalIn || 0),
          totalOut: Number(eData.totalOut || 0)
        });
      }
    } catch (err) {
      console.error('Failed to load company dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getAccentColor = () => {
    const norm = String(companyEntity || '').toLowerCase().trim();
    if (norm.includes('fabtex') || norm === 'ef') return '#f59e0b';
    if (norm.includes('sobise') || norm === 'so') return '#fb7185';
    if (norm.includes('ethno') || norm === 'ew') return '#d97706';
    if (norm.includes('yamunaji') || norm === 'yj') return '#38bdf8';
    if (norm.includes('stitching') || norm === 'es') return '#34d399';
    if (norm.includes('online') || norm === 'eon') return '#818cf8';
    if (norm.includes('exedp')) return '#38bdf8';
    return '#a78bfa';
  };

  const accentColor = getAccentColor();

  const netProfitOrMargin = (stats.totalRevenue || 0) - (expenseStats.totalOut || 0);

  const getEntityPrefix = (entity) => {
    const norm = String(entity || '').toLowerCase().trim();
    if (norm.includes('sobise') || norm === 'so') return 'so';
    if (norm.includes('fabtex') || norm === 'ef') return 'ef';
    if (norm.includes('ethno') || norm === 'ew') return 'ew';
    if (norm.includes('yamunaji') || norm === 'yj') return 'yj';
    if (norm.includes('stitching') || norm === 'es') return 'es';
    if (norm.includes('online') || norm === 'eon') return 'eo';
    if (norm.includes('exedp')) return 'exedp';
    return 'ee';
  };

  const prefix = getEntityPrefix(companyEntity);
  const getInvoicesTab = () => `${prefix}_invoices`;
  const getRfdTab = () => `${prefix}_rfd`;
  const getExpensesTab = () => `${prefix}_expenses`;
  const getComplaintsTab = () => `${prefix}_complaints`;
  const showRfdSubTab = ['ee', 'ef', 'so', 'ew', 'yj'].includes(prefix);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingBottom: '2rem' }}>
      {/* ── TIER 1: UNIFIED GLASS SCREEN HEADER ── */}
      <div className="glass-screen-header">
        <div className="glass-title-capsule">
          <Building size={20} color="#38bdf8" />
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
            {companyEntity} Executive Dashboard
          </span>
          <EntityBrandBadge />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate(getInvoicesTab(companyEntity))}
            className="glass-btn-primary"
            style={{
              background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.9), rgba(37, 99, 235, 0.85))',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.84rem',
              padding: '0.55rem 1.1rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              cursor: 'pointer'
            }}
          >
            <PlusCircle size={15} /> New Tax Invoice
          </button>
          <QuickActionMenu
            onRefresh={fetchDashboardData}
            customActions={[
              { label: 'New Tax Invoice', onClick: () => onNavigate && onNavigate(getInvoicesTab()) },
              { label: 'View Expenses', onClick: () => onNavigate && onNavigate(getExpensesTab()) },
              ...(prefix !== 'exedp' ? [{ label: 'View Complaints', onClick: () => onNavigate && onNavigate(getComplaintsTab()) }] : [])
            ]}
          />
        </div>
      </div>

      {/* ── TIER 2: SUB-SCREENS BUTTONS ── */}
      <div className="glass-subtabs-bar" style={{ marginTop: '0.2rem' }}>
        <button
          type="button"
          className="glass-subtab-btn active"
        >
          <TrendingUp size={15} />
          <span>Executive Overview</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate && onNavigate(getInvoicesTab())}
          className="glass-subtab-btn"
        >
          <Receipt size={15} />
          <span>Tax Invoices</span>
        </button>
        {showRfdSubTab && (
          <button
            type="button"
            onClick={() => onNavigate && onNavigate(getRfdTab())}
            className="glass-subtab-btn"
          >
            <Layers size={15} />
            <span>Fabric Process</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => onNavigate && onNavigate(getExpensesTab())}
          className="glass-subtab-btn"
        >
          <Wallet size={15} />
          <span>Expenses</span>
        </button>
        {prefix !== 'exedp' && (
          <button
            type="button"
            onClick={() => onNavigate && onNavigate(getComplaintsTab())}
            className="glass-subtab-btn"
          >
            <AlertTriangle size={15} />
            <span>Complaints</span>
          </button>
        )}
      </div>

      {/* ── TIER 3: HORIZONTAL CALCULATION CARDS SCROLL TRACK ── */}
      <div className="glass-scroll-track" style={{ marginTop: '0.2rem' }}>
        <div className="glass-calc-card">
          <span className="glass-calc-title">Total Invoiced</span>
          <span className="glass-calc-value" style={{ color: '#ffffff' }}>{fmtINR(stats.totalRevenue)}</span>
          <span className="glass-calc-sub">{stats.invoiceCount} Tax Invoices</span>
        </div>

        <div className="glass-calc-card">
          <span className="glass-calc-title">Paid Received</span>
          <span className="glass-calc-value" style={{ color: '#34d399' }}>{fmtINR(stats.paidAmount)}</span>
          <span className="glass-calc-sub">{stats.paidCount} Fully Paid</span>
        </div>

        <div className="glass-calc-card">
          <span className="glass-calc-title">Outstanding Due</span>
          <span className="glass-calc-value" style={{ color: '#f87171' }}>{fmtINR(stats.balanceDue)}</span>
          <span className="glass-calc-sub">{stats.unpaidCount} Pending Invoices</span>
        </div>

        <div className="glass-calc-card">
          <span className="glass-calc-title">Open Complaints</span>
          <span className="glass-calc-value" style={{ color: '#fb923c' }}>{complaintStats.open}</span>
          <span className="glass-calc-sub">{complaintStats.total} Total Logged</span>
        </div>

        <div className="glass-calc-card">
          <span className="glass-calc-title">Operational Outflow</span>
          <span className="glass-calc-value" style={{ color: '#c084fc' }}>{fmtINR(expenseStats.totalOut)}</span>
          <span className="glass-calc-sub" style={{ color: netProfitOrMargin >= 0 ? '#34d399' : '#f87171' }}>
            Net Margin: {fmtINR(netProfitOrMargin)}
          </span>
        </div>
      </div>

      {/* 📊 Job Card Pending Status Overview (Only for Digital Printing factory) */}
      {(companyEntity === 'Elite Digital Prints' || companyEntity === 'Elite Digital Print') && (
        <JobCardStatusDashboard department="digital_print" />
      )}

      {/* 📉 Financial Distribution & Payment Health Progress Bar */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Billing Payment Clearance Health
          </h3>
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: accentColor }}>
            {stats.invoiceCount > 0 ? Math.round((stats.paidCount / stats.invoiceCount) * 100) : 0}% Fully Cleared
          </span>
        </div>

        <div style={{ height: '10px', borderRadius: '5px', background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${stats.invoiceCount > 0 ? (stats.paidCount / stats.invoiceCount) * 100 : 0}%`, background: '#10b981', transition: 'width 0.5s ease' }} title={`Paid: ${stats.paidCount}`} />
          <div style={{ width: `${stats.invoiceCount > 0 ? (stats.partiallyPaidCount / stats.invoiceCount) * 100 : 0}%`, background: '#f59e0b', transition: 'width 0.5s ease' }} title={`Partially Paid: ${stats.partiallyPaidCount}`} />
          <div style={{ width: `${stats.invoiceCount > 0 ? (stats.unpaidCount / stats.invoiceCount) * 100 : 0}%`, background: '#ef4444', transition: 'width 0.5s ease' }} title={`Unpaid: ${stats.unpaidCount}`} />
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.85rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
            <span style={{ color: 'var(--text-muted)' }}>Fully Paid ({stats.paidCount})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
            <span style={{ color: 'var(--text-muted)' }}>Partially Paid ({stats.partiallyPaidCount})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
            <span style={{ color: 'var(--text-muted)' }}>Unpaid Pending ({stats.unpaidCount})</span>
          </div>
        </div>
      </div>

      {/* 📄 Recent Tax Invoices Table Panel */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <Receipt size={18} color={accentColor} />
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Recent {companyEntity} Tax Invoices
            </h3>
          </div>
          <button
            onClick={() => onNavigate && onNavigate(getInvoicesTab(companyEntity))}
            style={{ background: 'none', border: 'none', color: accentColor, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            View All Invoices <ChevronRight size={14} />
          </button>
        </div>

        <div className="table-container">
          {stats.recentInvoices.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No recent tax invoices generated for {companyEntity}.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Date</th>
                  <th>Customer / Party Name</th>
                  <th>Grand Total</th>
                  <th>Status</th>
                  <th>Logged By</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentInvoices.map((inv) => {
                  const isPaid = inv.paymentStatus === 'PAID';
                  const isPartial = inv.paymentStatus === 'PARTIALLY_PAID';

                  return (
                    <tr key={inv._id}>
                      <td style={{ fontWeight: 800, color: accentColor }}>{inv.invoiceNo}</td>
                      <td>{inv.invoiceDate ? formatDateDDMMYYYY(inv.invoiceDate) : ''}</td>
                      <td style={{ fontWeight: 700 }}>{inv.customer?.businessName || inv.customer?.name || inv.partyName || '--'}</td>
                      <td style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{fmtINR(inv.grandTotal)}</td>
                      <td>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px',
                          background: isPaid ? 'rgba(16, 185, 129, 0.16)' : isPartial ? 'rgba(245, 158, 11, 0.16)' : 'rgba(239, 68, 68, 0.16)',
                          color: isPaid ? '#34d399' : isPartial ? '#fbbf24' : '#fca5a5',
                          border: `1px solid ${isPaid ? 'rgba(16, 185, 129, 0.35)' : isPartial ? 'rgba(245, 158, 11, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`
                        }}>
                          {inv.paymentStatus || 'UNPAID'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.35)', padding: '2px 7px', borderRadius: '4px' }}>
                          👤 {inv.createdByName || inv.createdBy || 'Staff'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
