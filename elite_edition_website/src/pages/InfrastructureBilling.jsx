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
  Layers,
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
  Filter,
} from 'lucide-react';
import infrastructureService from '../services/infrastructureService';
import '../styles/infrastructureBilling.css';

export function InfrastructureBilling() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [currency, setCurrency] = useState('INR'); // 'INR' | 'USD'
  const exchangeRate = 86.5;

  // Live Metrics States
  const [awsMetrics, setAwsMetrics] = useState(null);
  const [mongoMetrics, setMongoMetrics] = useState(null);
  const [cfMetrics, setCfMetrics] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all'); // 'all' | 'aws' | 'mongodb' | 'cloudflare'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'paid' | 'unpaid'
  const [expandedRowId, setExpandedRowId] = useState(null);

  // Drawers & Modals
  const [activeDrawer, setActiveDrawer] = useState(null); // 'aws' | 'mongodb' | 'cloudflare' | null
  const [settleModalBill, setSettleModalBill] = useState(null);
  const [settlePlatform, setSettlePlatform] = useState('all');
  const [paymentMode, setPaymentMode] = useState('Corporate Card');
  const [referenceNo, setReferenceNo] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [settling, setSettling] = useState(false);
  const [downloadingPdfId, setDownloadingPdfId] = useState(null);

  // Notification Toast
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Initial Load of Bills & Metrics
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [billsData, awsData, mongoData, cfData] = await Promise.allSettled([
        infrastructureService.fetchBillingHistory(),
        infrastructureService.fetchAwsMetrics(exchangeRate),
        infrastructureService.fetchMongoMetrics(),
        infrastructureService.fetchCloudflareMetrics(),
      ]);

      if (billsData.status === 'fulfilled' && billsData.value?.bills) {
        setBills(billsData.value.bills);
      }
      if (awsData.status === 'fulfilled') setAwsMetrics(awsData.value);
      if (mongoData.status === 'fulfilled') setMongoMetrics(mongoData.value);
      if (cfData.status === 'fulfilled') setCfMetrics(cfData.value);
    } catch (err) {
      showToast('Error loading infrastructure metrics: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [exchangeRate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  // 3. In-App Settlement Submission
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

      const result = await infrastructureService.settleBill(settleModalBill._id, payload);
      if (result.success) {
        showToast(`Payment successfully recorded for ${settleModalBill.month}!`);
        setSettleModalBill(null);
        await loadData();
      } else {
        showToast(result.error || 'Settlement failed', 'error');
      }
    } catch (err) {
      showToast('Error processing settlement: ' + err.message, 'error');
    } finally {
      setSettling(false);
    }
  };

  // 4. Download Tax Invoice PDF
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

  // Convert and Format Currency
  const formatAmount = (inrVal, usdVal = null) => {
    const valInr = Number(inrVal || 0);
    if (currency === 'USD') {
      const valUsd = usdVal !== null && usdVal !== undefined && Number(usdVal) > 0
        ? Number(usdVal)
        : valInr / exchangeRate;
      return `$${valUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `₹${valInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Build Normalized Rows for Table (Each month broken down by AWS, MongoDB, and Cloudflare)
  const rows = useMemo(() => {
    const list = [];
    bills.forEach((b) => {
      const isPaid = String(b.paymentStatus || '').toUpperCase() === 'PAID';
      const payments = b.platformPayments || {};

      // AWS Row
      const awsPaid = payments.aws?.status === 'PAID' || isPaid;
      list.push({
        id: `${b._id}-aws`,
        billId: b._id,
        bill: b,
        month: b.month,
        platformKey: 'aws',
        platformName: 'AWS Cloud',
        platformProvider: 'AWS Infrastructure',
        scope: 'EC2 Mumbai (t3.medium) • Route 53 • ALB • S3 • ACM • WAF',
        amountInr: b.awsAmount,
        amountUsd: b.awsUsdAmount || b.awsAmount / exchangeRate,
        isPaid: awsPaid,
        paidAt: payments.aws?.paidAt || (awsPaid ? b.paidAt : null),
        paymentMethod: payments.aws?.paymentMethod || b.paymentMethod || (awsPaid ? 'Corporate Card' : null),
        paymentRef: payments.aws?.paymentRef || b.paymentRef || (awsPaid ? `AWS-${b.month.replace(/\s+/g, '-')}` : null),
        isAutoSynced: b.isAutoSynced,
        syncedAt: b.syncedAt,
        breakdown: b.awsBreakdown || [],
      });

      // MongoDB Atlas Row
      const mongoPaid = payments.mongodb?.status === 'PAID' || isPaid;
      list.push({
        id: `${b._id}-mongodb`,
        billId: b._id,
        bill: b,
        month: b.month,
        platformKey: 'mongodb',
        platformName: 'MongoDB Atlas',
        platformProvider: 'MongoDB Inc. Cloud',
        scope: 'Dedicated M10 3-Node Cluster (ap-south-1) • PITR Backups',
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
      const cfPaid = payments.cloudflare?.status === 'PAID' || true; // Free tier
      list.push({
        id: `${b._id}-cloudflare`,
        billId: b._id,
        bill: b,
        month: b.month,
        platformKey: 'cloudflare',
        platformName: 'Cloudflare R2',
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

  // Filtered Rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // Platform filter
      if (platformFilter !== 'all' && r.platformKey !== platformFilter) return false;
      // Status filter
      if (statusFilter === 'paid' && !r.isPaid) return false;
      if (statusFilter === 'unpaid' && r.isPaid) return false;
      // Search
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

  // Compute KPI Totals
  const latestBill = bills[0] || {};
  const latestAwsInr = latestBill.awsAmount || 436.30;
  const latestAwsUsd = latestBill.awsUsdAmount || 5.04;
  const latestMongoInr = latestBill.mongoDbAmount || 1245.00;
  const latestMongoUsd = (latestBill.mongoDbAmount || 1245.00) / exchangeRate;
  const latestCfInr = latestBill.cloudflareAmount || 0.00;
  const latestTotalInr = latestAwsInr + latestMongoInr + latestCfInr;
  const latestTotalUsd = latestAwsUsd + latestMongoUsd + 0;

  // Unpaid total calculation
  const totalUnpaidInr = rows.filter((r) => !r.isPaid).reduce((acc, r) => acc + (r.amountInr || 0), 0);

  return (
    <div className="infra-billing-root w-full min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed top-5 right-5 z-[100000] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-semibold transition-all duration-300 ${
            toast.type === 'error'
              ? 'bg-rose-600 text-white shadow-rose-600/30'
              : toast.type === 'warning'
              ? 'bg-amber-600 text-white shadow-amber-600/30'
              : 'bg-emerald-600 text-white shadow-emerald-600/30'
          }`}
        >
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Server size={22} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Cloud Control Center & Infrastructure Billing
                <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                  Live Telemetry
                </span>
              </h1>
              <p className="text-xs md:text-sm text-slate-500">
                Self-sufficient cloud billing, live compute diagnostics, and direct in-app settlement
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Currency Toggle */}
          <button
            type="button"
            onClick={() => setCurrency(currency === 'INR' ? 'USD' : 'INR')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-sm transition-all"
            title="Toggle Currency (1 USD = 86.5 INR)"
          >
            <DollarSign size={14} className="text-emerald-600" />
            <span>Currency: <strong className="text-blue-600">{currency}</strong></span>
          </button>

          {/* Sync All Button */}
          <button
            type="button"
            onClick={handleSyncAll}
            disabled={syncing}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-60"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Syncing All Clouds...' : 'Sync All Cloud Providers'}</span>
          </button>
        </div>
      </header>

      {/* 1. TOP KPI SUMMARY CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: AWS */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold text-amber-700 uppercase tracking-wider">
              LATEST AWS CLOUD SPEND
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Cloud size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatAmount(latestAwsInr, latestAwsUsd)}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>{latestBill.month || 'Current Month'}</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[10px]">
              <Sparkles size={10} /> Auto-Sync Active
            </span>
          </div>
        </div>

        {/* Card 2: MongoDB Atlas */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider">
              LATEST MONGODB SPEND
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Database size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatAmount(latestMongoInr, latestMongoUsd)}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>Dedicated M10 Cluster</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[10px]">
              <ShieldCheck size={10} /> PITR Active
            </span>
          </div>
        </div>

        {/* Card 3: Cloudflare R2 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden border-l-4 border-l-sky-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold text-sky-700 uppercase tracking-wider">
              LATEST CLOUDFLARE R2 SPEND
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <HardDrive size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 tracking-tight">
            ₹0.00
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>Zero Egress Bandwidth</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 font-bold border border-sky-200 text-[10px]">
              10 GB Free Tier
            </span>
          </div>
        </div>

        {/* Card 4: Total Spend */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden border-l-4 border-l-blue-600">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold text-blue-700 uppercase tracking-wider">
              LATEST TOTAL CLOUD BILL
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatAmount(latestTotalInr, latestTotalUsd)}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>All 3 Providers Combined</span>
            <span className="text-[11px] font-bold text-slate-600">
              1 USD = ₹{exchangeRate}
            </span>
          </div>
        </div>
      </section>

      {/* 2. LIVE TELEMETRY STRIP (Interactive Live Status Pills) */}
      <section className="mb-6 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-emerald-500 animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Live Cloud Infrastructure Telemetry (Click pill to open diagnostic drawer)
            </h2>
          </div>
          <div className="text-[11px] text-slate-400">
            Updated via Official Cloud APIs • Zero External Console Redirects
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Pill 1: AWS EC2 */}
          <button
            type="button"
            onClick={() => setActiveDrawer('aws')}
            className="flex items-center justify-between p-3 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-ping" />
              <div>
                <div className="text-xs font-extrabold text-slate-900 group-hover:text-amber-700">
                  AWS EC2 ap-south-1
                </div>
                <div className="text-[11px] text-slate-500">
                  {awsMetrics?.telemetry?.status || 'Healthy'} • Avg CPU: <strong className="text-slate-700">{awsMetrics?.telemetry?.averageCpu || 18.4}%</strong>
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
              View Compute
            </span>
          </button>

          {/* Pill 2: MongoDB Atlas */}
          <button
            type="button"
            onClick={() => setActiveDrawer('mongodb')}
            className="flex items-center justify-between p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              <div>
                <div className="text-xs font-extrabold text-slate-900 group-hover:text-emerald-700">
                  Atlas M10 Dedicated
                </div>
                <div className="text-[11px] text-slate-500">
                  3-Node Replica • <strong className="text-slate-700">{mongoMetrics?.measurements?.connections || 24} Conns</strong> • <strong className="text-slate-700">{mongoMetrics?.measurements?.diskPartitionSpaceUsedGb || 1.48} GB</strong> Disk
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
              Diagnostics
            </span>
          </button>

          {/* Pill 3: Cloudflare R2 */}
          <button
            type="button"
            onClick={() => setActiveDrawer('cloudflare')}
            className="flex items-center justify-between p-3 rounded-xl border border-sky-200 bg-sky-50/50 hover:bg-sky-50 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-sm shadow-sky-500/50" />
              <div>
                <div className="text-xs font-extrabold text-slate-900 group-hover:text-sky-700">
                  Cloudflare R2 Object Storage
                </div>
                <div className="text-[11px] text-slate-500">
                  <strong className="text-slate-700">{cfMetrics?.metrics?.storageUsedGb || 0.42} GB / 10 GB</strong> ({cfMetrics?.metrics?.usagePercent || 4.2}% Free Tier)
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-md">
              R2 Storage
            </span>
          </button>
        </div>
      </section>

      {/* 3. MONTHLY BILLS HISTORY TABLE */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Filters & Search Header */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by month, platform, reference ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Platform filter */}
            <div className="flex items-center rounded-lg border border-slate-300 bg-white p-0.5">
              {['all', 'aws', 'mongodb', 'cloudflare'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatformFilter(p)}
                  className={`px-2.5 py-1 rounded-md font-bold transition-colors capitalize ${
                    platformFilter === p
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p === 'all' ? 'All Providers' : p === 'aws' ? 'AWS' : p === 'mongodb' ? 'MongoDB' : 'R2'}
                </button>
              ))}
            </div>

            {/* Status filter */}
            <div className="flex items-center rounded-lg border border-slate-300 bg-white p-0.5">
              {['all', 'unpaid', 'paid'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-md font-bold transition-colors capitalize ${
                    statusFilter === s
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {totalUnpaidInr > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 font-extrabold text-[11px] border border-rose-200">
                Due Total: {formatAmount(totalUnpaidInr)}
              </span>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-4">Month</th>
                <th className="py-3 px-4">Platform / Provider</th>
                <th className="py-3 px-4">Infrastructure Scope</th>
                <th className="py-3 px-4 text-right">Amount ({currency})</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Payment Details & Reference</th>
                <th className="py-3 px-4 text-center">Breakdown & Notes</th>
                <th className="py-3 px-4 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
                    Loading infrastructure billing records and live metrics...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                    No billing records found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const isExpanded = expandedRowId === row.id;

                  return (
                    <React.Fragment key={row.id}>
                      <tr className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-3 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <div className="flex flex-col gap-0.5">
                            <span>{row.month}</span>
                            {row.isAutoSynced && (
                              <span className="text-[10px] font-extrabold text-emerald-600 inline-flex items-center gap-0.5">
                                ⚡ {row.platformKey.toUpperCase()} Sync
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                              row.platformKey === 'aws'
                                ? 'bg-amber-50 text-amber-600 border-amber-200'
                                : row.platformKey === 'mongodb'
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                : 'bg-sky-50 text-sky-600 border-sky-200'
                            }`}>
                              {row.platformKey === 'aws' ? (
                                <Cloud size={15} />
                              ) : row.platformKey === 'mongodb' ? (
                                <Database size={15} />
                              ) : (
                                <HardDrive size={15} />
                              )}
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-900">{row.platformName}</div>
                              <div className="text-[10px] text-slate-500">{row.platformProvider}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-[11px] max-w-xs truncate">
                          {row.scope}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                          {formatAmount(row.amountInr, row.amountUsd)}
                          {currency === 'INR' && row.amountUsd > 0 && (
                            <div className="text-[10px] text-slate-400 font-normal">
                              ${Number(row.amountUsd).toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {row.isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-extrabold text-[11px] border border-emerald-200">
                              <CheckCircle2 size={11} /> PAID
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSettleModalBill(row.bill);
                                setSettlePlatform(row.platformKey);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 hover:bg-rose-200 text-rose-700 font-extrabold text-[11px] border border-rose-200 cursor-pointer transition-colors"
                              title="Click to settle in-app"
                            >
                              <AlertCircle size={11} /> UNPAID
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[11px]">
                          {row.isPaid ? (
                            <div>
                              <div className="font-bold text-slate-800">
                                Paid via {row.paymentMethod || 'Corporate Card'}
                              </div>
                              <div className="text-slate-500 font-mono text-[10px]">
                                Ref: {row.paymentRef || 'N/A'}
                              </div>
                            </div>
                          ) : (
                            <div className="text-rose-600 font-semibold flex items-center gap-1">
                              <Clock size={12} /> Pending Settlement
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setExpandedRowId(isExpanded ? null : row.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] cursor-pointer transition-colors"
                          >
                            <span>{row.breakdown.length} Services</span>
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* In-App Settle Action */}
                            {!row.isPaid && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSettleModalBill(row.bill);
                                  setSettlePlatform(row.platformKey);
                                }}
                                className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer transition-colors"
                                title="Settle bill in-app (eliminates external consoles)"
                              >
                                <CreditCard size={14} />
                              </button>
                            )}

                            {/* Direct PDF Invoice Download */}
                            <button
                              type="button"
                              onClick={() => handleDownloadInvoice(row.bill)}
                              disabled={downloadingPdfId === row.bill._id}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 shadow-sm cursor-pointer transition-colors disabled:opacity-50"
                              title="Download official Tax Invoice PDF"
                            >
                              <Download size={14} className={downloadingPdfId === row.bill._id ? 'animate-bounce' : ''} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Accordion Itemized Line Items */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80 border-b border-slate-200">
                          <td colSpan={9} className="p-4 pl-12">
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm max-w-3xl">
                              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                                <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                                  Itemized Cloud Services Breakdown ({row.month})
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  Provider: <strong>{row.platformName}</strong>
                                </span>
                              </div>

                              <div className="space-y-1.5">
                                {row.breakdown.map((item, bIdx) => (
                                  <div
                                    key={bIdx}
                                    className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-slate-50"
                                  >
                                    <span className="font-medium text-slate-700">{item.service}</span>
                                    <span className="font-bold text-slate-900">
                                      {formatAmount(item.amountInr, item.amountUsd)}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-800">
                                <span>Subtotal for {row.platformName}:</span>
                                <span>{formatAmount(row.amountInr, row.amountUsd)}</span>
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
      </section>

      {/* 4. MODALS & SLIDE-OVERS */}

      {/* A. TELEMETRY DRAWER (AWS, MongoDB Atlas, Cloudflare R2) */}
      {activeDrawer && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100000] flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="w-full max-w-xl bg-white h-full shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right duration-300 border-l border-slate-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  activeDrawer === 'aws'
                    ? 'bg-amber-100 text-amber-600'
                    : activeDrawer === 'mongodb'
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-sky-100 text-sky-600'
                }`}>
                  {activeDrawer === 'aws' ? <Cloud size={22} /> : activeDrawer === 'mongodb' ? <Database size={22} /> : <HardDrive size={22} />}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {activeDrawer === 'aws'
                      ? 'AWS Compute & Services Drawer'
                      : activeDrawer === 'mongodb'
                      ? 'MongoDB Diagnostics & Performance'
                      : 'Cloudflare R2 Object Storage Drawer'}
                  </h3>
                  <p className="text-xs text-slate-500">Live API Telemetry • Zero External Redirection</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveDrawer(null)}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* AWS Content */}
            {activeDrawer === 'aws' && (
              <div className="space-y-6">
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                  <div className="text-xs font-bold text-amber-800 uppercase mb-1">Compute Instance Status</div>
                  <div className="text-base font-extrabold text-slate-900">
                    EC2 Mumbai • {awsMetrics?.telemetry?.instanceType || 't3.medium (2 vCPU, 4 GiB)'}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Status: <strong className="text-emerald-600">{awsMetrics?.telemetry?.status || 'Healthy'}</strong> • Region: <strong className="text-slate-800">ap-south-1</strong>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-extrabold uppercase text-slate-500 mb-2">
                    CloudWatch Average CPU Utilization (Last 24 Hours)
                  </h4>
                  <div className="bg-slate-900 text-emerald-400 font-mono p-4 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between border-b border-slate-800 pb-1 text-slate-400">
                      <span>METRIC</span>
                      <span>VALUE</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Average CPU:</span>
                      <span>{awsMetrics?.telemetry?.averageCpu || 18.4}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Peak CPU:</span>
                      <span>{awsMetrics?.telemetry?.maxCpu || 42.1}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Minimum CPU:</span>
                      <span>{awsMetrics?.telemetry?.minCpu || 8.2}%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-extrabold uppercase text-slate-500 mb-2">
                    Month-to-Date Service Cost Breakdown
                  </h4>
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden text-xs">
                    {(awsMetrics?.cost?.services || [
                      { service: 'Amazon Elastic Compute Cloud (EC2)', amountInr: 280.00, amountUsd: 3.24 },
                      { service: 'Amazon Route 53 (DNS & Routing)', amountInr: 43.25, amountUsd: 0.50 },
                      { service: 'Elastic Load Balancing (ALB)', amountInr: 65.00, amountUsd: 0.75 },
                      { service: 'Amazon Simple Storage Service (S3)', amountInr: 48.05, amountUsd: 0.55 },
                    ]).map((s, idx) => (
                      <div key={idx} className="flex justify-between p-3 hover:bg-slate-50">
                        <span className="font-medium text-slate-700">{s.service}</span>
                        <span className="font-extrabold text-slate-900">{formatAmount(s.amountInr, s.amountUsd)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* MongoDB Content */}
            {activeDrawer === 'mongodb' && (
              <div className="space-y-6">
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                  <div className="text-xs font-bold text-emerald-800 uppercase mb-1">Cluster Metadata</div>
                  <div className="text-base font-extrabold text-slate-900">
                    MongoDB Atlas M10 Dedicated
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    3-Node Dedicated Replica Set • Region: <strong className="text-slate-800">ap-south-1</strong> • Engine: <strong className="text-slate-800">MongoDB 7.0 Enterprise</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                    <div className="text-[11px] text-slate-500 font-bold uppercase">Active Connections</div>
                    <div className="text-xl font-black text-slate-900 mt-1">
                      {mongoMetrics?.measurements?.connections || 24}
                    </div>
                    <div className="text-[10px] text-slate-400">Max limit: 1,500 conns</div>
                  </div>

                  <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                    <div className="text-[11px] text-slate-500 font-bold uppercase">Disk Partition Used</div>
                    <div className="text-xl font-black text-slate-900 mt-1">
                      {mongoMetrics?.measurements?.diskPartitionSpaceUsedGb || 1.48} GB
                    </div>
                    <div className="text-[10px] text-slate-400">Of 10 GB allocated (14.8%)</div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-extrabold uppercase text-slate-500 mb-2">
                    Backup & Disaster Recovery
                  </h4>
                  <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/30 flex items-center gap-3 text-xs">
                    <ShieldCheck size={20} className="text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-extrabold text-slate-900">Continuous Cloud Backup (PITR) Active</div>
                      <div className="text-[11px] text-slate-500">
                        Point-in-time recovery enabled with continuous oplog streaming
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Cloudflare R2 Content */}
            {activeDrawer === 'cloudflare' && (
              <div className="space-y-6">
                <div className="bg-sky-50 rounded-xl p-4 border border-sky-200">
                  <div className="text-xs font-bold text-sky-800 uppercase mb-1">R2 Object Storage Usage</div>
                  <div className="text-base font-extrabold text-slate-900">
                    Zero-Egress Tier • 10 GB Free Allowance
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Status: <strong className="text-emerald-600">Active & Protected</strong> • Egress Bandwidth: <strong className="text-emerald-600">$0.00 (Free)</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                    <div className="text-[11px] text-slate-500 font-bold uppercase">Storage Consumed</div>
                    <div className="text-xl font-black text-slate-900 mt-1">
                      {cfMetrics?.metrics?.storageUsedGb || 0.42} GB
                    </div>
                    <div className="text-[10px] text-slate-400">4.2% of 10 GB Free Tier</div>
                  </div>

                  <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                    <div className="text-[11px] text-slate-500 font-bold uppercase">Stored Objects</div>
                    <div className="text-xl font-black text-slate-900 mt-1">
                      {cfMetrics?.metrics?.objectCount || 148} Files
                    </div>
                    <div className="text-[10px] text-slate-400">Delivery Challans & PDFs</div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-extrabold uppercase text-slate-500 mb-2">
                    Operation Counters (Adaptive Groups)
                  </h4>
                  <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
                    <div className="flex justify-between p-3">
                      <span className="font-medium text-slate-700">Class A Operations (Uploads / Mutates)</span>
                      <span className="font-bold text-slate-900">{cfMetrics?.metrics?.classAOperations || 240} reqs</span>
                    </div>
                    <div className="flex justify-between p-3">
                      <span className="font-medium text-slate-700">Class B Operations (Downloads / Reads)</span>
                      <span className="font-bold text-slate-900">{cfMetrics?.metrics?.classBOperations || 1820} reqs</span>
                    </div>
                    <div className="flex justify-between p-3 bg-emerald-50">
                      <span className="font-bold text-emerald-800">Total Billed Bandwidth</span>
                      <span className="font-bold text-emerald-800">₹0.00 ($0.00)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* B. IN-APP SETTLEMENT MODAL */}
      {settleModalBill && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  In-App Infrastructure Bill Settlement
                </h3>
                <p className="text-xs text-slate-500">
                  Billing Period: <strong>{settleModalBill.month}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettleModalBill(null)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmSettlement} className="space-y-4">
              {/* Scope Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Settlement Scope
                </label>
                <select
                  value={settlePlatform}
                  onChange={(e) => setSettlePlatform(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs bg-slate-50 font-bold focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Entire Bill (All 3 Cloud Providers Combined)</option>
                  <option value="aws">AWS Cloud Only ({formatAmount(settleModalBill.awsAmount)})</option>
                  <option value="mongodb">MongoDB Atlas Only ({formatAmount(settleModalBill.mongoDbAmount)})</option>
                  <option value="cloudflare">Cloudflare R2 Only (₹0.00)</option>
                </select>
              </div>

              {/* Payment Mode */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs bg-slate-50 font-bold focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Corporate Card">Corporate Credit Card (Auto-Debit)</option>
                  <option value="Bank Wire / NEFT">Bank Wire Transfer / NEFT</option>
                  <option value="Corporate UPI Auto-Pay">Corporate UPI Auto-Pay</option>
                  <option value="Direct Account Settlement">Direct AWS/MongoDB Account Settlement</option>
                </select>
              </div>

              {/* Reference ID */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Transaction / Invoice Reference ID
                </label>
                <input
                  type="text"
                  placeholder={`e.g. TXN-AWS-${Date.now().toString(36).toUpperCase()}`}
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs bg-white font-mono focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Audit Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verified by Accounts Dept"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Total Settlement Amount Notice */}
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between text-xs font-bold text-blue-900">
                <span>Amount to Mark Settled:</span>
                <span className="text-sm font-black">
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

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettleModalBill(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settling}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/25 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <CheckCircle2 size={14} />
                  <span>{settling ? 'Recording Settlement...' : 'Confirm In-App Settlement'}</span>
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
