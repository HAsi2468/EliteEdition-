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
  ShieldCheck
} from 'lucide-react';

const fmtINR = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CompanyDedicatedDashboard({ companyEntity = 'Elite Edition', onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    invoiceCount: 0,
    paidAmount: 0,
    balanceDue: 0,
    paidCount: 0,
    unpaidCount: 0,
    partiallyPaidCount: 0,
    recentInvoices: []
  });
  const [complaintStats, setComplaintStats] = useState({ total: 0, open: 0, resolved: 0 });
  const [expenseStats, setExpenseStats] = useState({ totalIn: 0, totalOut: 0 });

  useEffect(() => {
    fetchDashboardData();
  }, [companyEntity]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Billing Stats
      const billingRes = await api.getBillingDashboardStats({ companyEntity });
      if (billingRes && billingRes.success) {
        setStats({
          totalRevenue: billingRes.data?.totalRevenue || 0,
          invoiceCount: billingRes.data?.invoiceCount || 0,
          paidAmount: billingRes.data?.paidAmount || 0,
          balanceDue: billingRes.data?.balanceDue || 0,
          paidCount: billingRes.data?.paidCount || 0,
          unpaidCount: billingRes.data?.unpaidCount || 0,
          partiallyPaidCount: billingRes.data?.partiallyPaidCount || 0,
          recentInvoices: billingRes.data?.recentInvoices || []
        });
      }

      // 2. Fetch Complaints Stats
      try {
        const compRes = await api.getComplaintAnalytics({ companyEntity });
        if (compRes) {
          setComplaintStats({
            total: compRes.total || 0,
            open: compRes.open || 0,
            resolved: compRes.resolved || 0
          });
        }
      } catch (e) {
        console.warn('Failed to load complaint stats:', e);
      }

      // 3. Fetch Expenses Stats
      try {
        const expRes = await api.getExpenseAnalytics({ companyEntity });
        if (expRes) {
          setExpenseStats({
            totalIn: expRes.totalIn || 0,
            totalOut: expRes.totalOut || 0
          });
        }
      } catch (e) {
        console.warn('Failed to load expense stats:', e);
      }
    } catch (err) {
      console.error('Failed to load company dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getAccentColor = () => {
    return '#4f46e5'; // Unified Professional Deep Indigo Theme for All Companies
  };

  const accentColor = getAccentColor();

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', margin: '1rem' }}>
        <RefreshCw size={32} className="spin-loader" style={{ color: accentColor, marginBottom: '0.75rem' }} />
        <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Loading {companyEntity} Dashboard Intelligence...</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>Aggregating real-time financial, invoicing, and complaint analytics.</p>
      </div>
    );
  }

  const netProfitOrMargin = (stats.totalRevenue || 0) - (expenseStats.totalOut || 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '2rem' }}>
      {/* 👑 Top Header Banner */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', borderLeft: `5px solid ${accentColor}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${accentColor}40` }}>
            <Building size={22} color={accentColor} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {companyEntity} Executive Dashboard
              </h2>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}40` }}>
                LIVE REAL-TIME SCOPE
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Financial Performance, Tax Invoicing, Complaints & Ledger Overview for {companyEntity}.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => onNavigate && onNavigate(companyEntity === 'Elite Fabtex' ? 'ef_invoices' : 'ee_invoices')}
            className="btn-primary"
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <PlusCircle size={15} /> New Tax Invoice
          </button>
          <button
            onClick={fetchDashboardData}
            className="btn-secondary"
            style={{ padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
            title="Refresh Intelligence Data"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* 📊 5 Key Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
        {/* Card 1: Total Revenue */}
        <div className="glass-panel" style={{ padding: '1.1rem', borderLeft: `4px solid ${accentColor}`, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Invoiced Revenue</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: `${accentColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} color={accentColor} />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-primary)' }}>{fmtINR(stats.totalRevenue)}</div>
          <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
            <ArrowUpRight size={14} /> {stats.invoiceCount} Tax Invoices Billed
          </div>
        </div>

        {/* Card 2: Received Cash */}
        <div className="glass-panel" style={{ padding: '1.1rem', borderLeft: '4px solid #10b981', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Paid Amount Received</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} color="#10b981" />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#10b981' }}>{fmtINR(stats.paidAmount)}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {stats.paidCount} Fully Paid • {stats.partiallyPaidCount} Partial
          </div>
        </div>

        {/* Card 3: Pending Balance Due */}
        <div className="glass-panel" style={{ padding: '1.1rem', borderLeft: '4px solid #ef4444', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Outstanding Balance Due</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} color="#ef4444" />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#ef4444' }}>{fmtINR(stats.balanceDue)}</div>
          <div style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 700 }}>
            {stats.unpaidCount} Unpaid Pending Invoices
          </div>
        </div>

        {/* Card 4: Open Quality Complaints */}
        <div className="glass-panel" style={{ padding: '1.1rem', borderLeft: '4px solid #f97316', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Open Quality Complaints</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(249,115,22,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={16} color="#f97316" />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#f97316' }}>{complaintStats.open} Open</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {complaintStats.total} Total Logged ({complaintStats.resolved} Resolved)
          </div>
        </div>

        {/* Card 5: Operational Outflow / Expenses */}
        <div className="glass-panel" style={{ padding: '1.1rem', borderLeft: '4px solid #8b5cf6', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Operational Outflow</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={16} color="#8b5cf6" />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#8b5cf6' }}>{fmtINR(expenseStats.totalOut)}</div>
          <div style={{ fontSize: '0.72rem', color: netProfitOrMargin >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
            Net Margin: {fmtINR(netProfitOrMargin)}
          </div>
        </div>
      </div>

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

        <div style={{ height: '10px', borderRadius: '5px', background: '#e2e8f0', overflow: 'hidden', display: 'flex' }}>
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
            onClick={() => onNavigate && onNavigate(companyEntity === 'Elite Fabtex' ? 'ef_invoices' : 'ee_invoices')}
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
                      <td>{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN') : ''}</td>
                      <td style={{ fontWeight: 700 }}>{inv.customer?.businessName || inv.customer?.name || inv.partyName || '--'}</td>
                      <td style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{fmtINR(inv.grandTotal)}</td>
                      <td>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px',
                          background: isPaid ? '#d1fae5' : isPartial ? '#fef3c7' : '#fee2e2',
                          color: isPaid ? '#047857' : isPartial ? '#b45309' : '#dc2626',
                          border: `1px solid ${isPaid ? '#a7f3d0' : isPartial ? '#fde68a' : '#fca5a5'}`
                        }}>
                          {inv.paymentStatus || 'UNPAID'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0284c7', background: '#e0f2fe', padding: '2px 7px', borderRadius: '4px' }}>
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
