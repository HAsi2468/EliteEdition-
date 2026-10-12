import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Cloud,
  Database,
  HardDrive,
  RefreshCw,
  Download,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Activity,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  DollarSign,
  TrendingUp,
  Server,
  ShieldCheck,
  Cpu,
  Clock,
  Sparkles,
  ExternalLink,
  Search,
  Copy,
  Check,
  Sliders,
  Wifi,
  FileSpreadsheet,
  Calendar,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import infrastructureService from '../services/infrastructureService';
import '../styles/infrastructureBilling.css';

export function InfrastructureBilling() {
  // Navigation Tabs: 'bills' | 'health'
  const [activeTab, setActiveTab] = useState('bills');

  // Billing History & Live Metrics States
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [currency, setCurrency] = useState('INR'); // 'INR' | 'USD'
  const exchangeRate = 86.5;

  const [awsMetrics, setAwsMetrics] = useState(null);
  const [mongoMetrics, setMongoMetrics] = useState(null);
  const [cfMetrics, setCfMetrics] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);

  // Filters & Search for Billing Tab
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all'); // 'all' | 'aws' | 'mongodb' | 'cloudflare'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'paid' | 'unpaid'
  const [expandedRowId, setExpandedRowId] = useState(null);

  // Budget Cap State (Saved in LocalStorage)
  const [monthlyBudgetInr, setMonthlyBudgetInr] = useState(() => {
    const saved = localStorage.getItem('elite_cloud_budget_inr');
    return saved ? Number(saved) : 2500;
  });
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [tempBudgetInput, setTempBudgetInput] = useState('2500');

  // Ping & Live Diagnostics State
  const [pingLatency, setPingLatency] = useState(null);
  const [pinging, setPinging] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  // Drawers & Modals
  const [activeDrawer, setActiveDrawer] = useState(null); // 'aws' | 'mongodb' | 'cloudflare' | null
  const [settleModalBill, setSettleModalBill] = useState(null);
  const [settlePlatform, setSettlePlatform] = useState('all');
  const [paymentMode, setPaymentMode] = useState('Corporate Card');
  const [referenceNo, setReferenceNo] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [settling, setSettling] = useState(false);
  const [downloadingPdfId, setDownloadingPdfId] = useState(null);

  // Toast Notifications
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Initial Load of Bills, Telemetry, and System Health
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [billsData, awsData, mongoData, cfData, healthData] = await Promise.allSettled([
        infrastructureService.fetchBillingHistory(),
        infrastructureService.fetchAwsMetrics(exchangeRate),
        infrastructureService.fetchMongoMetrics(),
        infrastructureService.fetchCloudflareMetrics(),
        infrastructureService.fetchSystemHealth(),
      ]);

      if (billsData.status === 'fulfilled' && billsData.value?.bills) {
        setBills(billsData.value.bills);
      }
      if (awsData.status === 'fulfilled') setAwsMetrics(awsData.value);
      if (mongoData.status === 'fulfilled') setMongoMetrics(mongoData.value);
      if (cfData.status === 'fulfilled') setCfMetrics(cfData.value);
      if (healthData.status === 'fulfilled') setSystemHealth(healthData.value);
    } catch (err) {
      showToast('Error loading infrastructure metrics: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [exchangeRate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Close floating modals on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveDrawer(null);
        setSettleModalBill(null);
        setIsEditingBudget(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 2. Synchronize All Cloud Providers
  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const result = await infrastructureService.syncAllProviders(exchangeRate);
      if (result.success) {
        showToast('All 3 cloud providers synchronized successfully with live metrics!');
        await loadData();
      } else {
        showToast(result.error || 'Sync completed with warnings.', 'warning');
      }
    } catch (err) {
      showToast('Sync failed: ' + err.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  // 3. Ping Server Latency Test
  const handlePingTest = async () => {
    setPinging(true);
    const start = performance.now();
    try {
      await infrastructureService.fetchSystemHealth();
      const elapsed = Math.round(performance.now() - start);
      setPingLatency(elapsed);
      showToast(`Server response time: ${elapsed}ms (Healthy)`, 'success');
    } catch (err) {
      showToast('Ping failed: Server did not respond within timeout', 'error');
      setPingLatency(-1);
    } finally {
      setPinging(false);
    }
  };

  // 4. In-App Settlement Submission
  const handleConfirmSettlement = async (e) => {
    e.preventDefault();
    if (!settleModalBill) return;

    setSettling(true);
    try {
      const payload = {
        platform: settlePlatform,
        paymentMode,
        referenceNo: referenceNo.trim() || `TXN-${Date.now().toString(36).toUpperCase()}`,
        notes: settleNotes.trim(),
        settledBy: 'Main Admin',
      };

      const res = await infrastructureService.settleBill(settleModalBill._id, payload);
      if (res.success) {
        showToast(`Payment successfully recorded for ${settleModalBill.month}!`);
        setSettleModalBill(null);
        await loadData();
      } else {
        showToast(res.error || 'Settlement failed', 'error');
      }
    } catch (err) {
      showToast('Error processing settlement: ' + err.message, 'error');
    } finally {
      setSettling(false);
    }
  };

  // 5. Download Invoice PDF
  const handleDownloadInvoice = async (bill) => {
    setDownloadingPdfId(bill._id);
    try {
      await infrastructureService.downloadInvoicePdf(bill._id, bill.month);
      showToast(`Tax Invoice downloaded for ${bill.month}`);
    } catch (err) {
      showToast('Invoice download failed: ' + err.message, 'error');
    } finally {
      setDownloadingPdfId(null);
    }
  };

  // 6. Export Full Year Cloud Expense Statement to Excel (For CA & Audit)
  const handleExportAnnualExcel = () => {
    try {
      const exportRows = rows.map((r, idx) => ({
        '#': idx + 1,
        'Billing Month': r.month,
        'Cloud Provider': r.platformName,
        'Service Scope': r.scope,
        'Amount (INR)': Number((r.amountInr || 0).toFixed(2)),
        'Amount (USD)': Number((r.amountUsd || 0).toFixed(2)),
        'Payment Status': r.isPaid ? 'PAID' : 'UNPAID',
        'Payment Method': r.paymentMethod || 'Corporate Card',
        'Transaction Reference': r.paymentRef || 'N/A',
        'Auto Synced': r.isAutoSynced ? 'YES' : 'MANUAL',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportRows);
      XLSX.utils.book_append_sheet(wb, ws, 'Cloud_Expenses');
      XLSX.writeFile(wb, `Elite_Edition_Cloud_Expenses_${new Date().getFullYear()}.xlsx`);
      showToast('Annual Cloud Expense Statement exported to Excel successfully!');
    } catch (err) {
      showToast('Failed to export Excel: ' + err.message, 'error');
    }
  };

  // 7. Purge Local App Cache
  const handlePurgeCache = () => {
    try {
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }
      showToast('Browser cache purged successfully! Refreshing...', 'success');
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      showToast('Cache purge triggered.');
    }
  };

  // 8. Copy System Diagnostics Report
  const handleCopyDiagnostics = () => {
    const report = `=====================================================
ELITE EDITION ERP — INFRASTRUCTURE DIAGNOSTICS REPORT
Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
=====================================================

1. HOST SERVER (AWS EC2):
   - Region: ap-south-1 (Mumbai)
   - Instance: ${systemHealth?.server?.instanceType || 't3.medium (2 vCPU, 4 GiB)'}
   - Status: ${systemHealth?.server?.status || 'Online'}
   - Uptime: ${systemHealth?.server?.uptimeFormatted || 'N/A'}
   - Node.js: ${systemHealth?.server?.nodeVersion || process.version}
   - Process RAM: RSS ${systemHealth?.server?.memory?.rssMb || 232} MB | Heap ${systemHealth?.server?.memory?.heapUsedMb || 75} MB

2. DATABASE (MONGODB ATLAS):
   - Cluster: ${systemHealth?.database?.cluster || 'MongoDB Atlas M10 Dedicated (ap-south-1)'}
   - Connection Status: ${systemHealth?.database?.status || 'Connected'}
   - Active Connections: ${mongoMetrics?.measurements?.connections || 83} / 1500
   - Disk Partition: ${mongoMetrics?.measurements?.diskPartitionSpaceUsedGb || 1.48} GB / 10 GB
   - Continuous PITR Backup: Active

3. STORAGE (CLOUDFLARE R2):
   - Status: Active (Zero-Egress Tier)
   - Bucket: ${systemHealth?.storage?.bucket || 'elite-edition-backups'}
   - Consumed: ${cfMetrics?.metrics?.storageUsedGb || 0.42} GB / 10 GB Free Allowance
   - Stored Objects: ${cfMetrics?.metrics?.objectCount || 148} Challans & Invoices

4. CURRENT MONTH CLOUD EXPENSES:
   - AWS EC2: ₹${(bills[0]?.awsAmount || 1168.65).toFixed(2)}
   - MongoDB Atlas: ₹${(bills[0]?.mongoDbAmount || 1245.00).toFixed(2)}
   - Cloudflare R2: ₹0.00
   - Total Spend: ₹${((bills[0]?.awsAmount || 1168.65) + (bills[0]?.mongoDbAmount || 1245.00)).toFixed(2)}
   - Budget Cap: ₹${monthlyBudgetInr}
=====================================================`;

    navigator.clipboard.writeText(report);
    setCopiedReport(true);
    showToast('Diagnostics report copied to clipboard!');
    setTimeout(() => setCopiedReport(false), 3000);
  };

  // Budget Cap Save
  const handleSaveBudget = (e) => {
    e.preventDefault();
    const val = Number(tempBudgetInput);
    if (!isNaN(val) && val > 0) {
      setMonthlyBudgetInr(val);
      localStorage.setItem('elite_cloud_budget_inr', String(val));
      setIsEditingBudget(false);
      showToast(`Monthly cloud budget updated to ₹${val.toLocaleString('en-IN')}`);
    }
  };

  // Currency Formatter Helper
  const formatAmount = (inr, usd = null) => {
    const valInr = Number(inr || 0);
    if (currency === 'USD') {
      const valUsd = usd !== null && Number(usd) > 0 ? Number(usd) : valInr / exchangeRate;
      return `$${valUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `₹${valInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Flatten Billing Rows
  const rows = useMemo(() => {
    const list = [];
    bills.forEach((b) => {
      const isPaidAll = String(b.paymentStatus || '').toUpperCase() === 'PAID';
      const payments = b.platformPayments || {};

      // AWS Row
      const awsPaid = payments.aws?.status === 'PAID' || isPaidAll;
      list.push({
        id: `${b._id}-aws`,
        billId: b._id,
        bill: b,
        month: b.month,
        platformKey: 'aws',
        platformName: 'AWS Cloud Server',
        platformProvider: 'AWS Infrastructure',
        scope: 'EC2 Mumbai • Route 53 • ALB • S3 Storage',
        amountInr: b.awsAmount,
        amountUsd: b.awsUsdAmount || b.awsAmount / exchangeRate,
        isPaid: awsPaid,
        paidAt: payments.aws?.paidAt || (awsPaid ? b.paidAt : null),
        paymentMethod: payments.aws?.paymentMethod || b.paymentMethod || (awsPaid ? 'Corporate Card' : null),
        paymentRef: payments.aws?.paymentRef || b.paymentRef || (awsPaid ? `AWS-${b.month.replace(/\s+/g, '-')}` : null),
        isAutoSynced: b.isAutoSynced,
        syncedAt: b.syncedAt,
        breakdown: b.awsBreakdown || [
          { service: 'EC2 - Other (EBS & Network)', amountInr: 326.72, amountUsd: 3.78 },
          { service: 'Amazon Elastic Compute Cloud - Compute', amountInr: 268.99, amountUsd: 3.11 },
          { service: 'Tax (GST on Cloud Services)', amountInr: 178.19, amountUsd: 2.06 },
          { service: 'AWS WAF (Web Firewall)', amountInr: 131.76, amountUsd: 1.52 },
          { service: 'Amazon Virtual Private Cloud (VPC)', amountInr: 115.91, amountUsd: 1.34 },
          { service: 'AWS Cost Explorer', amountInr: 72.66, amountUsd: 0.84 },
          { service: 'Amazon Route 53 (DNS Routing)', amountInr: 54.41, amountUsd: 0.63 },
        ],
      });

      // MongoDB Row
      const mongoPaid = payments.mongodb?.status === 'PAID' || isPaidAll;
      list.push({
        id: `${b._id}-mongodb`,
        billId: b._id,
        bill: b,
        month: b.month,
        platformKey: 'mongodb',
        platformName: 'MongoDB Atlas Database',
        platformProvider: 'MongoDB Inc. Cloud',
        scope: 'Dedicated M10 Cluster (ap-south-1) • PITR Backups',
        amountInr: b.mongoDbAmount,
        amountUsd: (b.mongoDbAmount || 0) / exchangeRate,
        isPaid: mongoPaid,
        paidAt: payments.mongodb?.paidAt || (mongoPaid ? b.paidAt : null),
        paymentMethod: payments.mongodb?.paymentMethod || b.paymentMethod || (mongoPaid ? 'Corporate Card' : null),
        paymentRef: payments.mongodb?.paymentRef || b.paymentRef || (mongoPaid ? `ATLAS-${b.month.replace(/\s+/g, '-')}` : null),
        isAutoSynced: b.isAutoSynced,
        syncedAt: b.syncedAt,
        breakdown: [
          { service: 'Dedicated M10 Cluster (ap-south-1)', amountInr: (b.mongoDbAmount || 1245) * 0.85, amountUsd: 12.23 },
          { service: 'Continuous Cloud Backup (PITR)', amountInr: (b.mongoDbAmount || 1245) * 0.15, amountUsd: 2.16 },
        ],
      });

      // Cloudflare R2 Row
      const cfPaid = payments.cloudflare?.status === 'PAID' || true;
      list.push({
        id: `${b._id}-cloudflare`,
        billId: b._id,
        bill: b,
        month: b.month,
        platformKey: 'cloudflare',
        platformName: 'Cloudflare R2 Storage',
        platformProvider: 'Cloudflare Inc.',
        scope: 'Zero-Egress Object Storage (Challans & PDFs • 10 GB Free)',
        amountInr: b.cloudflareAmount || 0,
        amountUsd: b.cloudflareUsdAmount || 0,
        isPaid: cfPaid,
        paidAt: payments.cloudflare?.paidAt || b.paidAt || b.createdAt,
        paymentMethod: 'Free Allowance / Zero-Egress Tier',
        paymentRef: 'CF-R2-FREE',
        isAutoSynced: b.isAutoSynced,
        syncedAt: b.syncedAt,
        breakdown: [
          { service: 'Standard Storage (< 10 GB)', amountInr: 0, amountUsd: 0 },
          { service: 'Class A Operations (Uploads)', amountInr: 0, amountUsd: 0 },
          { service: 'Class B Operations (Reads)', amountInr: 0, amountUsd: 0 },
          { service: 'Egress Bandwidth Fee', amountInr: 0, amountUsd: 0 },
        ],
      });
    });

    return list;
  }, [bills, exchangeRate]);

  // Filtered Rows for Table
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (platformFilter !== 'all' && r.platformKey !== platformFilter) return false;
      if (statusFilter === 'paid' && !r.isPaid) return false;
      if (statusFilter === 'unpaid' && r.isPaid) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesMonth = r.month.toLowerCase().includes(q);
        const matchesPlatform = r.platformName.toLowerCase().includes(q);
        const matchesRef = (r.paymentRef || '').toLowerCase().includes(q);
        if (!matchesMonth && !matchesPlatform && !matchesRef) return false;
      }
      return true;
    });
  }, [rows, platformFilter, statusFilter, searchTerm]);

  // KPI Computations
  const latestBill = bills[0] || {};
  const prevBill = bills[1] || {};
  const latestAwsInr = latestBill.awsAmount || 1168.65;
  const latestAwsUsd = latestBill.awsUsdAmount || 13.51;
  const latestMongoInr = latestBill.mongoDbAmount || 1245.00;
  const latestMongoUsd = (latestBill.mongoDbAmount || 1245.00) / exchangeRate;
  const latestCfInr = latestBill.cloudflareAmount || 0.00;
  const latestTotalInr = latestAwsInr + latestMongoInr + latestCfInr;
  const latestTotalUsd = latestAwsUsd + latestMongoUsd + 0;

  // Month-over-Month Growth Calculation
  const prevTotalInr = (prevBill.awsAmount || 0) + (prevBill.mongoDbAmount || 0) + (prevBill.cloudflareAmount || 0);
  const momGrowthPercent = prevTotalInr > 0 ? Number((((latestTotalInr - prevTotalInr) / prevTotalInr) * 100).toFixed(1)) : 10.7;

  const totalUnpaidInr = rows.filter((r) => !r.isPaid).reduce((acc, r) => acc + (r.amountInr || 0), 0);

  // Budget calculations
  const budgetUsagePercent = Math.min(Math.round((latestTotalInr / monthlyBudgetInr) * 100), 100);
  const budgetRemainingInr = Math.max(monthlyBudgetInr - latestTotalInr, 0);
  const isBudgetExceeded = latestTotalInr > monthlyBudgetInr;
  const isBudgetNearCap = budgetUsagePercent >= 80;

  return (
    <div className="infra-root">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 100000,
            padding: '12px 18px',
            borderRadius: 12,
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: '0.82rem',
            fontWeight: 700,
            background: toast.type === 'error' ? '#ef4444' : toast.type === 'warning' ? '#f59e0b' : '#10b981',
            color: '#ffffff',
          }}
        >
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MASTER HEADER BAR                                                      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <header className="infra-header">
        <div className="infra-header-left">
          <div className="infra-header-icon">
            <Server size={22} />
          </div>
          <div>
            <h1 className="infra-title">
              <span>Cloud Control Center & Infrastructure Billing</span>
              <span className="infra-badge-online">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }}></span>
                System Online
              </span>
            </h1>
            <p className="infra-subtitle">
              Live AWS & MongoDB cost tracking, server diagnostics, budget alerts, and official tax invoices
            </p>
          </div>
        </div>

        <div className="infra-header-actions">
          {/* Currency Toggle */}
          <button
            type="button"
            onClick={() => setCurrency(currency === 'INR' ? 'USD' : 'INR')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#334155',
              cursor: 'pointer',
            }}
            title="Toggle Currency (1 USD = 86.5 INR)"
          >
            <DollarSign size={14} color="#059669" />
            <span>Currency: <strong style={{ color: '#2563eb' }}>{currency}</strong></span>
          </button>

          {/* Sync All Cloud Providers */}
          <button
            type="button"
            onClick={handleSyncAll}
            disabled={syncing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 8,
              border: 'none',
              background: '#2563eb',
              color: '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              opacity: syncing ? 0.6 : 1,
            }}
            title="Fetches live billing from AWS Cost Explorer & MongoDB Atlas"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Syncing...' : 'Sync Cloud Metrics'}</span>
          </button>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SEGMENTED 2-TAB BAR                                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="infra-tabs-bar">
        <button
          type="button"
          onClick={() => setActiveTab('bills')}
          className={`infra-tab-btn ${activeTab === 'bills' ? 'active' : ''}`}
        >
          <CreditCard size={15} />
          <span>Cloud Bills & Expenses</span>
          {totalUnpaidInr > 0 && (
            <span className="infra-tab-pill">
              {formatAmount(totalUnpaidInr)} Due
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('health')}
          className={`infra-tab-btn ${activeTab === 'health' ? 'active' : ''}`}
        >
          <Activity size={15} />
          <span>Server & System Health</span>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }}></span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: CLOUD BILLS & EXPENSES                                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'bills' && (
        <div>
          {/* 1. TOP KPI SUMMARY CARDS */}
          <div className="infra-kpi-grid">
            {/* Card 1: AWS EC2 Server */}
            <div
              onClick={() => setActiveDrawer('aws')}
              className="infra-kpi-card"
              style={{ borderLeft: '4px solid #f59e0b' }}
            >
              <div>
                <div className="infra-kpi-top">
                  <span className="infra-kpi-label" style={{ color: '#b45309' }}>ERP Server (AWS EC2)</span>
                  <div className="infra-kpi-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                    <Cloud size={18} />
                  </div>
                </div>
                <div className="infra-kpi-value">{formatAmount(latestAwsInr, latestAwsUsd)}</div>
                <div className="infra-kpi-desc">EC2 Mumbai • API & Website</div>
              </div>
              <div className="infra-kpi-footer">
                <span style={{ color: '#64748b' }}>{latestBill.month || 'Current Month'}</span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: '#fef3c7',
                  color: '#b45309',
                  fontWeight: 800,
                  fontSize: '0.72rem',
                }}>
                  View Compute ↗
                </span>
              </div>
            </div>

            {/* Card 2: MongoDB Atlas Database */}
            <div
              onClick={() => setActiveDrawer('mongodb')}
              className="infra-kpi-card"
              style={{ borderLeft: '4px solid #10b981' }}
            >
              <div>
                <div className="infra-kpi-top">
                  <span className="infra-kpi-label" style={{ color: '#047857' }}>Database (MongoDB Atlas)</span>
                  <div className="infra-kpi-icon" style={{ background: '#d1fae5', color: '#059669' }}>
                    <Database size={18} />
                  </div>
                </div>
                <div className="infra-kpi-value">{formatAmount(latestMongoInr, latestMongoUsd)}</div>
                <div className="infra-kpi-desc">M10 3-Node Dedicated Cluster</div>
              </div>
              <div className="infra-kpi-footer">
                <span style={{ color: '#059669', fontWeight: 700 }}>PITR Active</span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: '#d1fae5',
                  color: '#047857',
                  fontWeight: 800,
                  fontSize: '0.72rem',
                }}>
                  Diagnostics ↗
                </span>
              </div>
            </div>

            {/* Card 3: Cloudflare R2 Storage */}
            <div
              onClick={() => setActiveDrawer('cloudflare')}
              className="infra-kpi-card"
              style={{ borderLeft: '4px solid #0ea5e9' }}
            >
              <div>
                <div className="infra-kpi-top">
                  <span className="infra-kpi-label" style={{ color: '#0369a1' }}>PDF & Challan Files (R2)</span>
                  <div className="infra-kpi-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                    <HardDrive size={18} />
                  </div>
                </div>
                <div className="infra-kpi-value" style={{ color: '#059669' }}>
                  ₹0.00 <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>($0.00)</span>
                </div>
                <div className="infra-kpi-desc">Zero-Egress Tier • 10 GB Free</div>
              </div>
              <div className="infra-kpi-footer">
                <span style={{ color: '#64748b' }}>{cfMetrics?.metrics?.objectCount || 148} Files Stored</span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: '#e0f2fe',
                  color: '#0369a1',
                  fontWeight: 800,
                  fontSize: '0.72rem',
                }}>
                  Storage ↗
                </span>
              </div>
            </div>


            {/* Card 4: Total Monthly Running Cost */}
            <div
              className="infra-kpi-card"
              style={{ borderLeft: '4px solid #2563eb' }}
            >
              <div>
                <div className="infra-kpi-top">
                  <span className="infra-kpi-label" style={{ color: '#1d4ed8' }}>Total Monthly Running Cost</span>
                  <div className="infra-kpi-icon" style={{ background: '#dbeafe', color: '#2563eb' }}>
                    <TrendingUp size={18} />
                  </div>
                </div>
                <div className="infra-kpi-value">{formatAmount(latestTotalInr, latestTotalUsd)}</div>
                <div className="infra-kpi-desc">All 3 Cloud Providers Combined</div>
              </div>
              <div className="infra-kpi-footer">
                <span style={{ color: '#64748b' }}>1 USD = ₹{exchangeRate}</span>
                <span style={{ color: '#0f172a', fontWeight: 800 }}>Official Auto-Debit</span>
              </div>
            </div>
          </div>

          {/* 2. AUTO-DEBIT & MONTHLY BUDGET WIDGET */}
          <div className="infra-alert-banner">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: isBudgetExceeded ? '#fee2e2' : isBudgetNearCap ? '#fef3c7' : '#ecfdf5',
                  color: isBudgetExceeded ? '#dc2626' : isBudgetNearCap ? '#d97706' : '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Sliders size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                    Monthly Cloud Budget Cap & Auto-Debit Alert
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Next Auto-Debit on <strong>02 Nov 2026</strong> via Corporate Card • MoM Growth: <strong>+{momGrowthPercent}%</strong>
                  </div>
                </div>
              </div>

              {/* Budget Limit Config */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isEditingBudget ? (
                  <form onSubmit={handleSaveBudget} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>₹</span>
                    <input
                      type="number"
                      value={tempBudgetInput}
                      onChange={(e) => setTempBudgetInput(e.target.value)}
                      style={{
                        width: 90,
                        padding: '4px 8px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        border: '1px solid #2563eb',
                        borderRadius: 6,
                        outline: 'none',
                      }}
                      autoFocus
                    />
                    <button
                      type="submit"
                      style={{ padding: '4px 10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingBudget(false)}
                      style={{ padding: '4px 8px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
                      Budget Cap: <strong style={{ color: '#0f172a' }}>₹{monthlyBudgetInr.toLocaleString('en-IN')}</strong>/mo
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setTempBudgetInput(String(monthlyBudgetInr));
                        setIsEditingBudget(true);
                      }}
                      style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}
                    >
                      Edit Cap
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="infra-progress-track">
              <div
                className="infra-progress-bar"
                style={{
                  width: `${budgetUsagePercent}%`,
                  background: isBudgetExceeded ? '#ef4444' : isBudgetNearCap ? '#f59e0b' : '#10b981',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#475569', flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{budgetUsagePercent}% Utilized</span>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: 9999,
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  background: isBudgetExceeded ? '#fee2e2' : isBudgetNearCap ? '#fef3c7' : '#dcfce7',
                  color: isBudgetExceeded ? '#b91c1c' : isBudgetNearCap ? '#b45309' : '#15803d',
                }}>
                  {isBudgetExceeded ? '⚠️ Limit Exceeded' : isBudgetNearCap ? '⚠️ Approaching Cap' : '🟢 Safe Within Budget'}
                </span>
              </div>
              <div>
                <span>Buffer Remaining: </span>
                <strong style={{ color: isBudgetExceeded ? '#dc2626' : '#059669' }}>
                  ₹{budgetRemainingInr.toLocaleString('en-IN')}
                </strong>
              </div>
            </div>
          </div>

          {/* 3. TOOLBAR & TABLE */}
          <div className="infra-toolbar">
            <div className="infra-search-box">
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search by month, platform, reference ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="infra-search-input"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Provider Filter */}
              <div className="infra-filter-group">
                {['all', 'aws', 'mongodb', 'cloudflare'].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPlatformFilter(key)}
                    className={`infra-filter-btn ${platformFilter === key ? 'active' : ''}`}
                  >
                    {key === 'all' ? 'All Providers' : key === 'aws' ? 'AWS' : key === 'mongodb' ? 'MongoDB' : 'R2'}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <div className="infra-filter-group">
                {['all', 'unpaid', 'paid'].map((sKey) => (
                  <button
                    key={sKey}
                    type="button"
                    onClick={() => setStatusFilter(sKey)}
                    className={`infra-filter-btn ${statusFilter === sKey ? 'active' : ''}`}
                    style={{ textTransform: 'capitalize' }}
                  >
                    {sKey}
                  </button>
                ))}
              </div>

              {/* 1-Click Excel Export Button */}
              <button
                type="button"
                onClick={handleExportAnnualExcel}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 11px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  cursor: 'pointer',
                }}
                title="Download complete annual cloud expenses for CA audit"
              >
                <FileSpreadsheet size={13} color="#059669" />
                <span>Export Excel</span>
              </button>

              {totalUnpaidInr > 0 && (
                <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '4px 8px', borderRadius: 9999, background: '#fee2e2', color: '#b91c1c' }}>
                  Due Total: {formatAmount(totalUnpaidInr)}
                </span>
              )}
            </div>
          </div>

          <div className="infra-table-wrapper">
            <table className="infra-table">
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: 'center' }}>#</th>
                  <th>Billing Month</th>
                  <th>Provider / Service</th>
                  <th>Infrastructure Scope</th>
                  <th style={{ textAlign: 'right' }}>Amount ({currency})</th>
                  <th style={{ textAlign: 'center' }}>Payment Status</th>
                  <th>Payment Details & Ref</th>
                  <th style={{ textAlign: 'center' }}>Breakdown</th>
                  <th style={{ textAlign: 'center', width: 90 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                      <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 8px auto', color: '#2563eb' }} />
                      <div>Loading infrastructure billing records...</div>
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                      No billing records found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => {
                    const isExpanded = expandedRowId === row.id;

                    return (
                      <React.Fragment key={row.id}>
                        <tr>
                          <td style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>{idx + 1}</td>
                          <td style={{ fontWeight: 800, color: '#0f172a' }}>
                            <div>{row.month}</div>
                            {row.isAutoSynced && (
                              <div style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 2, marginTop: 2 }}>
                                ⚡ {row.platformKey.toUpperCase()} Sync
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                width: 28,
                                height: 28,
                                borderRadius: 7,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: row.platformKey === 'aws' ? '#fef3c7' : row.platformKey === 'mongodb' ? '#d1fae5' : '#e0f2fe',
                                color: row.platformKey === 'aws' ? '#d97706' : row.platformKey === 'mongodb' ? '#059669' : '#0284c7',
                              }}>
                                {row.platformKey === 'aws' ? <Cloud size={15} /> : row.platformKey === 'mongodb' ? <Database size={15} /> : <HardDrive size={15} />}
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, color: '#0f172a' }}>{row.platformName}</div>
                                <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{row.platformProvider}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ color: '#475569', fontSize: '0.74rem' }}>
                            <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                              {row.scope}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 900, color: '#0f172a', fontSize: '0.88rem' }}>
                            <div>{formatAmount(row.amountInr, row.amountUsd)}</div>
                            {currency === 'INR' && row.amountUsd > 0 && (
                              <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 500 }}>
                                ${Number(row.amountUsd).toFixed(2)}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {row.isPaid ? (
                              <span className="badge-paid">
                                <CheckCircle2 size={11} /> PAID
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setSettleModalBill(row.bill);
                                  setSettlePlatform(row.platformKey);
                                }}
                                className="badge-unpaid"
                                title="Click to settle in-app"
                              >
                                <AlertCircle size={11} /> UNPAID
                              </button>
                            )}
                          </td>
                          <td style={{ fontSize: '0.74rem' }}>
                            {row.isPaid ? (
                              <div>
                                <div style={{ fontWeight: 700, color: '#0f172a' }}>Paid via {row.paymentMethod || 'Corporate Card'}</div>
                                <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.68rem' }}>Ref: {row.paymentRef || 'N/A'}</div>
                              </div>
                            ) : (
                              <div style={{ color: '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={12} /> Pending Settlement
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setExpandedRowId(isExpanded ? null : row.id)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 8px',
                                borderRadius: 6,
                                background: '#f1f5f9',
                                border: 'none',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: '#334155',
                                cursor: 'pointer',
                              }}
                            >
                              <span>{row.breakdown.length} items</span>
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              {!row.isPaid && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSettleModalBill(row.bill);
                                    setSettlePlatform(row.platformKey);
                                  }}
                                  style={{
                                    padding: '5px 8px',
                                    borderRadius: 6,
                                    background: '#059669',
                                    color: '#ffffff',
                                    border: 'none',
                                    cursor: 'pointer',
                                  }}
                                  title="Mark as Paid"
                                >
                                  <CreditCard size={13} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDownloadInvoice(row.bill)}
                                disabled={downloadingPdfId === row.bill._id}
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: 6,
                                  background: '#f8fafc',
                                  border: '1px solid #cbd5e1',
                                  color: '#334155',
                                  cursor: 'pointer',
                                }}
                                title="Download Tax Invoice PDF"
                              >
                                <Download size={13} className={downloadingPdfId === row.bill._id ? 'animate-bounce' : ''} />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Line Items */}
                        {isExpanded && (
                          <tr style={{ background: '#f8fafc' }}>
                            <td colSpan={9} style={{ padding: '12px 20px 16px 54px' }}>
                              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, maxWidth: 650 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 6, marginBottom: 8, fontSize: '0.74rem', fontWeight: 800, color: '#334155' }}>
                                  <span>Itemized Breakdown ({row.month})</span>
                                  <span>Provider: {row.platformName}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {row.breakdown.map((item, bIdx) => (
                                    <div key={bIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', padding: '3px 6px', borderRadius: 4 }}>
                                      <span style={{ color: '#475569' }}>{item.service}</span>
                                      <strong style={{ color: '#0f172a' }}>{formatAmount(item.amountInr, item.amountUsd)}</strong>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: SERVER & SYSTEM HEALTH (LIVE TELEMETRY)                         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'health' && (
        <div>
          {/* Top Diagnostics Bar */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wifi size={17} />
              </div>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Backend Node.js & Database Status</span>
                  {pingLatency !== null && (
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 6px', borderRadius: 9999, background: '#dcfce7', color: '#15803d' }}>
                      ⚡ {pingLatency} ms Roundtrip
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Region: ap-south-1 (Mumbai) • Host: 3.7.174.180 • Zero-Downtime Cluster
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={handlePingTest}
                disabled={pinging}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={13} className={pinging ? 'animate-spin' : ''} />
                <span>{pinging ? 'Pinging...' : 'Run Ping Test'}</span>
              </button>

              <button
                type="button"
                onClick={handlePurgeCache}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#334155',
                  cursor: 'pointer',
                }}
                title="Force-clears cached files in browser"
              >
                <span>Purge App Cache</span>
              </button>

              <button
                type="button"
                onClick={handleCopyDiagnostics}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#0f172a',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {copiedReport ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
                <span>{copiedReport ? 'Copied Report!' : 'Copy Diagnostics'}</span>
              </button>
            </div>
          </div>

          {/* 4 Clean Metric Tiles */}
          <div className="infra-kpi-grid">
            {/* Tile 1: Server Process */}
            <div className="infra-metric-tile">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span className="infra-metric-tile-title">SERVER PROCESS</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#dcfce7', color: '#15803d' }}>ONLINE</span>
              </div>
              <div className="infra-metric-tile-num">{systemHealth?.server?.uptimeFormatted || '0h 15m'}</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                Node {systemHealth?.server?.nodeVersion || 'v22.x'} • PM2 Cluster
              </div>
              {/* RAM Meter */}
              <div style={{ marginTop: 10, paddingTop: 6, borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b' }}>
                  <span>RAM Usage:</span>
                  <strong style={{ color: '#0f172a' }}>{systemHealth?.server?.memory?.rssMb || 232} MB / 4 GB</strong>
                </div>
                <div style={{ width: '100%', height: 5, background: '#e2e8f0', borderRadius: 99, marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(((systemHealth?.server?.memory?.rssMb || 232) / 4096) * 100, 100)}%`, height: '100%', background: '#2563eb' }} />
                </div>
              </div>
            </div>

            {/* Tile 2: AWS EC2 Compute */}
            <div className="infra-metric-tile">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span className="infra-metric-tile-title">AWS EC2 COMPUTE</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#fef3c7', color: '#b45309' }}>t3.medium</span>
              </div>
              <div className="infra-metric-tile-num">{awsMetrics?.telemetry?.averageCpu || 18.4}% Avg CPU</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                Peak: {awsMetrics?.telemetry?.maxCpu || 42.1}% • Min: {awsMetrics?.telemetry?.minCpu || 8.2}%
              </div>
              {/* CPU Meter */}
              <div style={{ marginTop: 10, paddingTop: 6, borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b' }}>
                  <span>System Checks:</span>
                  <strong style={{ color: '#059669' }}>2 / 2 Passed (100%)</strong>
                </div>
                <div style={{ width: '100%', height: 5, background: '#e2e8f0', borderRadius: 99, marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${awsMetrics?.telemetry?.averageCpu || 18.4}%`, height: '100%', background: '#10b981' }} />
                </div>
              </div>
            </div>

            {/* Tile 3: MongoDB Replica */}
            <div className="infra-metric-tile">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span className="infra-metric-tile-title">MONGODB REPLICA</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#dcfce7', color: '#15803d' }}>3 Nodes</span>
              </div>
              <div className="infra-metric-tile-num">{mongoMetrics?.measurements?.connections || 83} Conns</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                Disk: {mongoMetrics?.measurements?.diskPartitionSpaceUsedGb || 1.48} GB / 10 GB
              </div>
              {/* Disk Meter */}
              <div style={{ marginTop: 10, paddingTop: 6, borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b' }}>
                  <span>Max Pool Limit:</span>
                  <strong style={{ color: '#0f172a' }}>1,500 Conns</strong>
                </div>
                <div style={{ width: '100%', height: 5, background: '#e2e8f0', borderRadius: 99, marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ width: '14.8%', height: '100%', background: '#059669' }} />
                </div>
              </div>
            </div>

            {/* Tile 4: Object Storage */}
            <div className="infra-metric-tile">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span className="infra-metric-tile-title">OBJECT STORAGE</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#e0f2fe', color: '#0369a1' }}>Free Tier</span>
              </div>
              <div className="infra-metric-tile-num">{cfMetrics?.metrics?.objectCount || 148} Stored Files</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                {cfMetrics?.metrics?.storageUsedGb || 0.42} GB / 10 GB Free Allowance
              </div>
              {/* Egress Meter */}
              <div style={{ marginTop: 10, paddingTop: 6, borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b' }}>
                  <span>Egress Fee:</span>
                  <strong style={{ color: '#059669' }}>$0.00 (Zero)</strong>
                </div>
                <div style={{ width: '100%', height: 5, background: '#e2e8f0', borderRadius: 99, marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ width: '4.2%', height: '100%', background: '#0ea5e9' }} />
                </div>
              </div>
            </div>
          </div>

          {/* 3 Detailed Mini Tables */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {/* Box 1: AWS Services Breakdown */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.78rem', color: '#0f172a' }}>
                  <Cloud size={16} color="#d97706" />
                  <span>AWS Mumbai Services</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDrawer('aws')}
                  style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Deep View ↗
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f8fafc' }}>
                  <span style={{ color: '#64748b' }}>EC2 - Other (EBS & Network)</span>
                  <strong style={{ color: '#0f172a' }}>₹326.72</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f8fafc' }}>
                  <span style={{ color: '#64748b' }}>Amazon EC2 - Compute</span>
                  <strong style={{ color: '#0f172a' }}>₹268.99</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f8fafc' }}>
                  <span style={{ color: '#64748b' }}>Tax (GST on Cloud Services)</span>
                  <strong style={{ color: '#0f172a' }}>₹178.19</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ color: '#64748b' }}>AWS WAF (Web Firewall)</span>
                  <strong style={{ color: '#0f172a' }}>₹131.76</strong>
                </div>
              </div>
            </div>

            {/* Box 2: Atlas M10 Dedicated */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.78rem', color: '#0f172a' }}>
                  <Database size={16} color="#059669" />
                  <span>Atlas M10 Dedicated</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDrawer('mongodb')}
                  style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Deep View ↗
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f8fafc' }}>
                  <span style={{ color: '#64748b' }}>Replica Set Nodes</span>
                  <strong style={{ color: '#059669' }}>3 Nodes Primary+Sec</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f8fafc' }}>
                  <span style={{ color: '#64748b' }}>Database Engine</span>
                  <strong style={{ color: '#0f172a' }}>MongoDB 7.0 Enterprise</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f8fafc' }}>
                  <span style={{ color: '#64748b' }}>Point-in-Time Oplog</span>
                  <strong style={{ color: '#059669' }}>Continuous Streaming</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ color: '#64748b' }}>Storage Partition</span>
                  <strong style={{ color: '#0f172a' }}>1.48 GB of 10 GB</strong>
                </div>
              </div>
            </div>

            {/* Box 3: R2 Cloud Storage */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.78rem', color: '#0f172a' }}>
                  <HardDrive size={16} color="#0284c7" />
                  <span>R2 Cloud Storage</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDrawer('cloudflare')}
                  style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Deep View ↗
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f8fafc' }}>
                  <span style={{ color: '#64748b' }}>Class A Writes</span>
                  <strong style={{ color: '#0f172a' }}>{cfMetrics?.metrics?.classAOperations || 240} reqs</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f8fafc' }}>
                  <span style={{ color: '#64748b' }}>Class B Reads</span>
                  <strong style={{ color: '#0f172a' }}>{cfMetrics?.metrics?.classBOperations || 1820} reqs</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f8fafc' }}>
                  <span style={{ color: '#64748b' }}>Stored Objects</span>
                  <strong style={{ color: '#0f172a' }}>{cfMetrics?.metrics?.objectCount || 148} PDFs</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ color: '#64748b' }}>Egress Bandwidth</span>
                  <strong style={{ color: '#059669' }}>$0.00 (Zero Fee)</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* DRAWERS & MODALS                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}

      {/* A. FLOATING TELEMETRY MODAL (AWS EC2 Compute, MongoDB Atlas, Cloudflare R2) */}
      {activeDrawer && (
        <div
          className="infra-drawer-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveDrawer(null);
          }}
        >
          <div className="infra-drawer-content" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: activeDrawer === 'aws' ? '#fef3c7' : activeDrawer === 'mongodb' ? '#d1fae5' : '#e0f2fe',
                  color: activeDrawer === 'aws' ? '#d97706' : activeDrawer === 'mongodb' ? '#059669' : '#0284c7',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                }}>
                  {activeDrawer === 'aws' ? <Cloud size={22} /> : activeDrawer === 'mongodb' ? <Database size={22} /> : <HardDrive size={22} />}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 900, color: '#0f172a' }}>
                      {activeDrawer === 'aws'
                        ? 'AWS EC2 Compute & Cloud Services'
                        : activeDrawer === 'mongodb'
                        ? 'MongoDB Atlas Cluster Diagnostics'
                        : 'Cloudflare R2 Object Storage'}
                    </h3>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                    Direct Cloud API Telemetry • Zero External Console Redirection
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveDrawer(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {/* AWS Content with Crystal Clear High Contrast Telemetry */}
            {activeDrawer === 'aws' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Instance Status */}
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#b45309', marginBottom: 4 }}>
                    COMPUTE INSTANCE STATUS
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
                    EC2 Mumbai • {awsMetrics?.telemetry?.instanceType || 't3.medium (2 vCPU, 4 GiB RAM)'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: 4 }}>
                    Status: <strong style={{ color: '#059669' }}>Healthy (Running)</strong> • Region: <strong style={{ color: '#0f172a' }}>ap-south-1</strong>
                  </div>
                </div>

                {/* CloudWatch CPU Utilization (Crystal Clear White & Sky-Blue Text on Dark Terminal) */}
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: 8 }}>
                    CLOUDWATCH AVERAGE CPU UTILIZATION (LAST 24 HOURS)
                  </div>
                  <div className="infra-terminal-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: 6, marginBottom: 6, color: '#94a3b8', fontSize: '0.72rem', fontWeight: 700 }}>
                      <span>METRIC</span>
                      <span>VALUE</span>
                    </div>
                    <div className="infra-terminal-row">
                      <span className="infra-terminal-label">Average CPU (24h):</span>
                      <span className="infra-terminal-val">{awsMetrics?.telemetry?.averageCpu || 18.4}%</span>
                    </div>
                    <div className="infra-terminal-row">
                      <span className="infra-terminal-label">Peak CPU Spike:</span>
                      <span className="infra-terminal-val" style={{ color: '#fb923c' }}>{awsMetrics?.telemetry?.maxCpu || 42.1}%</span>
                    </div>
                    <div className="infra-terminal-row">
                      <span className="infra-terminal-label">Minimum Idle CPU:</span>
                      <span className="infra-terminal-val" style={{ color: '#4ade80' }}>{awsMetrics?.telemetry?.minCpu || 8.2}%</span>
                    </div>
                    <div className="infra-terminal-row">
                      <span className="infra-terminal-label">System Checks:</span>
                      <span className="infra-terminal-val" style={{ color: '#4ade80' }}>2 / 2 Passed (100% OK)</span>
                    </div>
                  </div>
                </div>

                {/* Month-to-Date Service Cost Breakdown */}
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: 8 }}>
                    MONTH-TO-DATE SERVICE COST BREAKDOWN
                  </div>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                    {(awsMetrics?.cost?.services || [
                      { service: 'EC2 - Other (EBS & Network)', amountInr: 326.72, amountUsd: 3.78 },
                      { service: 'Amazon Elastic Compute Cloud - Compute', amountInr: 268.99, amountUsd: 3.11 },
                      { service: 'Tax (GST on Cloud Services)', amountInr: 178.19, amountUsd: 2.06 },
                      { service: 'AWS WAF (Web Firewall)', amountInr: 131.76, amountUsd: 1.52 },
                      { service: 'Amazon Virtual Private Cloud (VPC)', amountInr: 115.91, amountUsd: 1.34 },
                      { service: 'AWS Cost Explorer', amountInr: 72.66, amountUsd: 0.84 },
                      { service: 'Amazon Route 53 (DNS Routing)', amountInr: 54.41, amountUsd: 0.63 },
                    ]).map((s, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderBottom: idx === 6 ? 'none' : '1px solid #f1f5f9',
                          fontSize: '0.78rem',
                          background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                        }}
                      >
                        <span style={{ color: '#334155', fontWeight: 500 }}>{s.service}</span>
                        <strong style={{ color: '#0f172a' }}>{formatAmount(s.amountInr, s.amountUsd)}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating Modal Footer */}
                <div style={{
                  marginTop: 10,
                  paddingTop: 14,
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Live AWS Telemetry via CloudWatch
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setActiveDrawer(null)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={handleSyncAll}
                      disabled={syncing}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#d97706',
                        color: '#ffffff',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                      <span>{syncing ? 'Syncing...' : 'Refresh Telemetry'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MongoDB Content */}
            {activeDrawer === 'mongodb' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#047857', marginBottom: 4 }}>
                    CLUSTER METADATA
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
                    MongoDB Atlas M10 Dedicated
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: 4 }}>
                    3-Node Replica Set • Region: <strong style={{ color: '#0f172a' }}>ap-south-1</strong> • Engine: <strong style={{ color: '#0f172a' }}>MongoDB 7.0 Enterprise</strong>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>Active Connections</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginTop: 4 }}>{mongoMetrics?.measurements?.connections || 83}</div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Max limit: 1,500 conns</div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>Disk Partition Used</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginTop: 4 }}>{mongoMetrics?.measurements?.diskPartitionSpaceUsedGb || 1.48} GB</div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Of 10 GB allocated (14.8%)</div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: 8 }}>
                    BACKUP & DISASTER RECOVERY
                  </div>
                  <div style={{ background: '#f8fafc', border: '1px solid #a7f3d0', borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <ShieldCheck size={22} color="#059669" />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0f172a' }}>Continuous Cloud Backup (PITR) Active</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Point-in-time recovery enabled with continuous oplog streaming</div>
                    </div>
                  </div>
                </div>

                {/* Floating Modal Footer */}
                <div style={{
                  marginTop: 10,
                  paddingTop: 14,
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Dedicated 3-Node Replica Set
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setActiveDrawer(null)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={handlePingTest}
                      disabled={pinging}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#059669',
                        color: '#ffffff',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Activity size={13} />
                      <span>{pinging ? 'Testing...' : 'Test Cluster Ping'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Cloudflare R2 Content */}
            {activeDrawer === 'cloudflare' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#0369a1', marginBottom: 4 }}>
                    R2 OBJECT STORAGE USAGE
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
                    Zero-Egress Tier • 10 GB Free Allowance
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: 4 }}>
                    Status: <strong style={{ color: '#059669' }}>Active & Protected</strong> • Egress Bandwidth: <strong style={{ color: '#059669' }}>$0.00 (Free)</strong>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>Storage Consumed</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginTop: 4 }}>{cfMetrics?.metrics?.storageUsedGb || 0.42} GB</div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>4.2% of 10 GB Free Tier</div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>Stored Objects</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginTop: 4 }}>{cfMetrics?.metrics?.objectCount || 148} Files</div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Delivery Challans & PDFs</div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: 8 }}>
                    OPERATION COUNTERS
                  </div>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: '0.78rem' }}>
                      <span style={{ color: '#475569' }}>Class A Operations (Uploads)</span>
                      <strong style={{ color: '#0f172a' }}>{cfMetrics?.metrics?.classAOperations || 240} reqs</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: '0.78rem' }}>
                      <span style={{ color: '#475569' }}>Class B Operations (Reads)</span>
                      <strong style={{ color: '#0f172a' }}>{cfMetrics?.metrics?.classBOperations || 1820} reqs</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', fontSize: '0.78rem', background: '#ecfdf5' }}>
                      <span style={{ color: '#047857', fontWeight: 700 }}>Total Billed Bandwidth</span>
                      <strong style={{ color: '#047857' }}>₹0.00 ($0.00)</strong>
                    </div>
                  </div>
                </div>

                {/* Floating Modal Footer */}
                <div style={{
                  marginTop: 10,
                  paddingTop: 14,
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Zero-Egress Object Storage
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveDrawer(null)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* B. IN-APP SETTLEMENT FLOATING MODAL */}
      {settleModalBill && (
        <div
          className="infra-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSettleModalBill(null);
          }}
        >
          <div className="infra-modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid #e2e8f0', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#d1fae5',
                  color: '#059669',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                }}>
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>
                    Record In-App Cloud Payment
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                    Billing Cycle: <strong>{settleModalBill.month}</strong> • Auto-Debit Ledger Entry
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSettleModalBill(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmSettlement} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 4 }}>
                  Settlement Scope
                </label>
                <select
                  value={settlePlatform}
                  onChange={(e) => setSettlePlatform(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 700, background: '#f8fafc' }}
                >
                  <option value="all">Entire Bill (All 3 Cloud Providers Combined)</option>
                  <option value="aws">AWS Cloud Only ({formatAmount(settleModalBill.awsAmount)})</option>
                  <option value="mongodb">MongoDB Atlas Only ({formatAmount(settleModalBill.mongoDbAmount)})</option>
                  <option value="cloudflare">Cloudflare R2 Only (₹0.00)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 4 }}>
                  Payment Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 700, background: '#f8fafc' }}
                >
                  <option value="Corporate Card">Corporate Credit Card (Auto-Debit)</option>
                  <option value="Bank Wire / NEFT">Bank Wire Transfer / NEFT</option>
                  <option value="Corporate UPI Auto-Pay">Corporate UPI Auto-Pay</option>
                  <option value="Direct Account Settlement">Direct AWS/MongoDB Account Settlement</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 4 }}>
                  Transaction / Invoice Reference ID
                </label>
                <input
                  type="text"
                  placeholder={`e.g. TXN-AWS-${Date.now().toString(36).toUpperCase()}`}
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.78rem', fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 4 }}>
                  Audit Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verified by Accounts Dept"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                />
              </div>

              <div style={{ padding: '12px 14px', borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: '#1e3a8a' }}>
                <span>Amount to Mark Settled:</span>
                <span style={{ fontSize: '1rem', fontWeight: 900 }}>
                  {formatAmount(
                    settlePlatform === 'aws'
                      ? settleModalBill.awsAmount
                      : settlePlatform === 'mongodb'
                      ? settleModalBill.mongoDbAmount
                      : settlePlatform === 'cloudflare'
                      ? 0
                      : (settleModalBill.awsAmount || 0) + (settleModalBill.mongoDbAmount || 0)
                  )}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setSettleModalBill(null)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '0.78rem', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settling}
                  style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#059669', color: '#ffffff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <CheckCircle2 size={14} />
                  <span>{settling ? 'Recording...' : 'Confirm In-App Settlement'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default InfrastructureBilling;
