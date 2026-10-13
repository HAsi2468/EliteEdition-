import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Truck,
  FileText,
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Building,
  Calendar,
  Layers,
  Percent,
  Sparkles,
  Info,
  Scale,
  Printer,
  Edit2,
  Trash2,
  Eye,
  X,
  CreditCard,
  ShieldCheck,
  CheckCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';
import DateRangePicker, { getDatePresetRange } from './DateRangePicker';
import { formatDateDDMMYYYY, toLocalYMD } from '../utils/dateUtils';
import { triggerEliteAlert, triggerEliteConfirm } from './EliteModalDialog';

const INDIAN_STATES = [
  { code: '24', name: 'Gujarat' },
  { code: '27', name: 'Maharashtra' },
  { code: '08', name: 'Rajasthan' },
  { code: '07', name: 'Delhi' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '29', name: 'Karnataka' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '19', name: 'West Bengal' },
  { code: '03', name: 'Punjab' },
  { code: '06', name: 'Haryana' },
  { code: '10', name: 'Bihar' },
  { code: '23', name: 'Madhya Pradesh' }
];

const fmtINR = (val) => {
  const num = Number(val) || 0;
  return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtNum = (val) => {
  const num = Number(val) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function GtaFreightRcmPanel({
  companyEntity = 'Elite Digital Print',
  companyGstin = '24AANFE0044M1ZG',
  refreshTrigger = 0
}) {
  const [bills, setBills] = useState([]);
  const [metrics, setMetrics] = useState({
    totalFreight: 0,
    totalCashRcm: 0,
    totalIgst: 0,
    totalCgst: 0,
    totalSgst: 0,
    eligibleItc: 0,
    pendingSelfInvoices: 0,
    settledCount: 0,
    settledAmount: 0,
    pendingSettlementCount: 0,
    pendingSettlementAmount: 0
  });
  const [loading, setLoading] = useState(false);

  // Filters
  const [datePreset, setDatePreset] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PENDING, PAID
  const [transporterTypeFilter, setTransporterTypeFilter] = useState('ALL'); // ALL, UNREGISTERED, REGISTERED
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [viewingSelfInvoice, setViewingSelfInvoice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [generatingInvoices, setGeneratingInvoices] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    lrNumber: '',
    billNo: '',
    billDate: toLocalYMD(new Date()),
    transporterName: '',
    isUnregistered: true,
    transporterGstin: '',
    originStateCode: '24',
    destinationStateCode: '24',
    freightAmount: '',
    rcmRate: 5.0,
    isEligibleItc: true,
    settlementStatus: 'PENDING',
    vehicleNo: '',
    weightKg: '',
    packagesCount: '',
    notes: ''
  });

  const activeDateRange = useMemo(() => {
    return getDatePresetRange(datePreset, customStart, customEnd);
  }, [datePreset, customStart, customEnd]);

  // Load Freight Bills
  const loadBills = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        companyEntity,
        settlementStatus: statusFilter !== 'ALL' ? statusFilter : undefined,
        startDate: activeDateRange.start ? toLocalYMD(activeDateRange.start) : undefined,
        endDate: activeDateRange.end ? toLocalYMD(activeDateRange.end) : undefined
      };
      const res = await api.getFreightRcm(params);
      if (res && res.success) {
        setBills(res.records || []);
        if (res.metrics) setMetrics(res.metrics);
      }
    } catch (err) {
      console.warn('Failed to fetch GTA freight bills from backend, checking fallback...', err);
      // Fallback from localStorage
      try {
        const local = localStorage.getItem(`elite_freight_bills_${companyEntity}`);
        if (local) {
          const parsed = JSON.parse(local);
          setBills(Array.isArray(parsed) ? parsed : []);
        }
      } catch (e) {}
    } finally {
      setLoading(false);
    }
  }, [companyEntity, statusFilter, activeDateRange]);

  useEffect(() => {
    loadBills();
  }, [loadBills, refreshTrigger]);

  // Filtered displayed records
  const filteredBills = useMemo(() => {
    return (bills || []).filter((b) => {
      // Transporter type filter
      const isUnreg = !b.transporterGstin || b.transporterGstin.trim().length === 0;
      if (transporterTypeFilter === 'UNREGISTERED' && !isUnreg) return false;
      if (transporterTypeFilter === 'REGISTERED' && isUnreg) return false;

      // Settlement filter
      if (statusFilter !== 'ALL' && b.settlementStatus !== statusFilter) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const lr = (b.lrNumber || '').toLowerCase();
        const tName = (b.transporterName || '').toLowerCase();
        const sinv = (b.selfInvoiceNumber || '').toLowerCase();
        const billNo = (b.billNo || '').toLowerCase();
        if (!lr.includes(q) && !tName.includes(q) && !sinv.includes(q) && !billNo.includes(q)) return false;
      }

      return true;
    });
  }, [bills, transporterTypeFilter, statusFilter, searchQuery]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingBill(null);
    setFormData({
      lrNumber: '',
      billNo: '',
      billDate: toLocalYMD(new Date()),
      transporterName: '',
      isUnregistered: true,
      transporterGstin: '',
      originStateCode: '24',
      destinationStateCode: '24',
      freightAmount: '',
      rcmRate: 5.0,
      isEligibleItc: true,
      settlementStatus: 'PENDING',
      vehicleNo: '',
      weightKg: '',
      packagesCount: '',
      notes: ''
    });
    setShowCreateModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (bill) => {
    setEditingBill(bill);
    setFormData({
      lrNumber: bill.lrNumber || '',
      billNo: bill.billNo || '',
      billDate: bill.billDate || toLocalYMD(new Date()),
      transporterName: bill.transporterName || '',
      isUnregistered: !bill.transporterGstin,
      transporterGstin: bill.transporterGstin || '',
      originStateCode: bill.originStateCode || '24',
      destinationStateCode: bill.destinationStateCode || '24',
      freightAmount: bill.freightAmount != null ? String(bill.freightAmount) : '',
      rcmRate: bill.rcmRate || 5.0,
      isEligibleItc: bill.isEligibleItc !== false,
      settlementStatus: bill.settlementStatus || 'PENDING',
      vehicleNo: bill.vehicleNo || '',
      weightKg: bill.weightKg ? String(bill.weightKg) : '',
      packagesCount: bill.packagesCount ? String(bill.packagesCount) : '',
      notes: bill.notes || ''
    });
    setShowCreateModal(true);
  };

  // Save Freight Bill
  const handleSaveBill = async (e) => {
    e.preventDefault();
    if (!formData.lrNumber.trim()) {
      triggerEliteAlert('Please enter LR / Bilty Number.');
      return;
    }
    if (!formData.transporterName.trim()) {
      triggerEliteAlert('Please enter Transporter Name.');
      return;
    }
    const amt = parseFloat(formData.freightAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      triggerEliteAlert('Please enter a valid positive Freight Amount (₹).');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        companyEntity,
        tenantGstin: companyGstin,
        lrNumber: formData.lrNumber.trim(),
        billNo: formData.billNo.trim(),
        billDate: formData.billDate,
        transporterName: formData.transporterName.trim(),
        transporterGstin: formData.isUnregistered ? '' : formData.transporterGstin.trim().toUpperCase(),
        originStateCode: formData.originStateCode,
        destinationStateCode: formData.destinationStateCode,
        freightAmount: amt,
        rcmRate: Number(formData.rcmRate) || 5.0,
        isEligibleItc: formData.isEligibleItc,
        settlementStatus: formData.settlementStatus,
        vehicleNo: formData.vehicleNo.trim(),
        weightKg: Number(formData.weightKg) || 0,
        packagesCount: Number(formData.packagesCount) || 0,
        notes: formData.notes.trim()
      };

      if (editingBill && (editingBill._id || editingBill.id)) {
        await api.updateFreightBill(editingBill._id || editingBill.id, payload);
        triggerEliteAlert('✨ Freight bill updated successfully!');
      } else {
        await api.createFreightBill(payload);
        triggerEliteAlert('✨ Freight bill recorded successfully under GTA RCM!');
      }

      setShowCreateModal(false);
      loadBills();
    } catch (err) {
      console.error('Failed to save freight bill:', err);
      triggerEliteAlert(`Failed to save freight bill: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Bill
  const handleDeleteBill = async (bill) => {
    const ok = await triggerEliteConfirm(`Are you sure you want to delete Freight Bill (LR #${bill.lrNumber})?`);
    if (!ok) return;

    try {
      if (bill._id || bill.id) {
        await api.deleteFreightBill(bill._id || bill.id);
      }
      triggerEliteAlert('Freight bill removed.');
      loadBills();
    } catch (err) {
      console.error('Failed to delete freight bill:', err);
      triggerEliteAlert(`Delete failed: ${err.message}`);
    }
  };

  // Toggle Settle
  const handleToggleSettle = async (bill) => {
    const nextStatus = bill.settlementStatus === 'PAID' ? 'PENDING' : 'PAID';
    try {
      if (bill._id || bill.id) {
        await api.updateFreightBill(bill._id || bill.id, {
          settlementStatus: nextStatus,
          paymentDate: nextStatus === 'PAID' ? toLocalYMD(new Date()) : ''
        });
      }
      loadBills();
    } catch (err) {
      console.error('Failed to update settlement status:', err);
    }
  };

  // Batch Generate Self-Invoices (Section 31(3)(f))
  const handleBatchGenerateSelfInvoices = async () => {
    const unregPending = bills.filter(
      (b) => (!b.transporterGstin || b.transporterGstin.trim() === '') && (!b.selfInvoiceNumber || b.selfInvoiceNumber.trim() === '')
    );

    if (!unregPending.length) {
      triggerEliteAlert('No unregistered GTA bills currently pending self-invoice numbering.');
      return;
    }

    const ok = await triggerEliteConfirm(
      `Found ${unregPending.length} unregistered freight bills. Generate statutory Section 31(3)(f) Self-Invoices (SINV-YYYY-XXXXX) for all of them now?`
    );
    if (!ok) return;

    setGeneratingInvoices(true);
    try {
      const curYear = new Date().getFullYear();
      const res = await api.generateSelfInvoices({
        companyEntity,
        periodYear: curYear
      });
      triggerEliteAlert(`✅ ${res?.count || unregPending.length} Self-Invoices generated successfully compliant with CGST Sec 31(3)(f)!`);
      loadBills();
    } catch (err) {
      console.error('Failed to generate self-invoices:', err);
      triggerEliteAlert(`Failed: ${err.message}`);
    } finally {
      setGeneratingInvoices(false);
    }
  };

  // 1-Click Copy TSV
  const handleCopyTSV = async () => {
    try {
      const headers = [
        'LR Number',
        'Bill Date',
        'Transporter Name',
        'Transporter GSTIN',
        'Type',
        'Freight Amount (₹)',
        'RCM Rate (%)',
        'IGST (₹)',
        'CGST (₹)',
        'SGST (₹)',
        'Total Cash RCM (3.1(d))',
        'Eligible ITC (4(A)(3))',
        'Self Invoice No (31(3)(f))',
        'Status'
      ];

      const lines = [headers.join('\t')];
      filteredBills.forEach((b) => {
        lines.push(
          [
            b.lrNumber,
            b.billDate,
            b.transporterName,
            b.transporterGstin || 'UNREGISTERED',
            b.isInterstate ? 'Inter-state' : 'Intra-state',
            Number(b.freightAmount || 0).toFixed(2),
            `${b.rcmRate || 5}%`,
            Number(b.rcmIgst || 0).toFixed(2),
            Number(b.rcmCgst || 0).toFixed(2),
            Number(b.rcmSgst || 0).toFixed(2),
            Number(b.totalRcmTax || 0).toFixed(2),
            b.isEligibleItc ? Number(b.totalRcmTax || 0).toFixed(2) : '0.00',
            b.selfInvoiceNumber || (b.transporterGstin ? 'N/A (Registered)' : 'PENDING'),
            b.settlementStatus
          ].join('\t')
        );
      });

      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to copy TSV:', err);
    }
  };

  // 1-Click Export Excel
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const exportRows = filteredBills.map((b) => ({
        'LR / Bilty No': b.lrNumber,
        'Bill No': b.billNo || '-',
        'Bill Date': b.billDate,
        'Transporter Name': b.transporterName,
        'Transporter GSTIN': b.transporterGstin || 'UNREGISTERED',
        'Origin State': `${b.originStateName} (${b.originStateCode})`,
        'Destination State': `${b.destinationStateName} (${b.destinationStateCode})`,
        'Freight Amount (₹)': Number(b.freightAmount || 0),
        'Supply Type': b.isInterstate ? 'Inter-state' : 'Intra-state',
        'RCM Rate': `${b.rcmRate || 5}%`,
        'RCM IGST (₹)': Number(b.rcmIgst || 0),
        'RCM CGST (₹)': Number(b.rcmCgst || 0),
        'RCM SGST (₹)': Number(b.rcmSgst || 0),
        'Total Cash RCM (3.1(d))': Number(b.totalRcmTax || 0),
        'Eligible ITC (4(A)(3))': b.isEligibleItc ? Number(b.totalRcmTax || 0) : 0,
        'Self Invoice No (31(3)(f))': b.selfInvoiceNumber || (b.transporterGstin ? 'N/A (Registered)' : 'PENDING'),
        'Self Invoice Date': b.selfInvoiceDate || '-',
        'Settlement Status': b.settlementStatus
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      XLSX.utils.book_append_sheet(wb, ws, 'GTA Freight RCM');
      XLSX.writeFile(wb, `GTA_Freight_RCM_${companyGstin}_${toLocalYMD(new Date())}.xlsx`);
    } catch (err) {
      console.error('Failed to export Excel:', err);
    }
  };

  // Computed real-time form taxes
  const formTaxCalc = useMemo(() => {
    const amt = parseFloat(formData.freightAmount) || 0;
    const isInter = formData.originStateCode !== formData.destinationStateCode;
    const rate = Number(formData.rcmRate) || 5.0;

    let igst = 0;
    let cgst = 0;
    let sgst = 0;

    if (isInter) {
      igst = amt * (rate / 100);
    } else {
      cgst = amt * (rate / 2 / 100);
      sgst = amt * (rate / 2 / 100);
    }

    return {
      isInter,
      igst,
      cgst,
      sgst,
      totalTax: igst + cgst + sgst
    };
  }, [formData.freightAmount, formData.originStateCode, formData.destinationStateCode, formData.rcmRate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* ── STATUTORY COMPLIANCE BANNER ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98))',
          color: '#ffffff',
          padding: '1rem 1.25rem',
          borderRadius: '14px',
          border: '1px solid #334155',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: 38, height: 38, borderRadius: '10px', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)' }}>
              <Truck size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, letterSpacing: '0.02em' }}>
                  GTA Freight Reverse Charge Mechanism (RCM) Tracker
                </h3>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
                  CGST Sec 9(3) • Sec 49(4) • Sec 31(3)(f)
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 }}>
                Inward Transporter Freight Bills (SAC 9965 / 9967) • Mandatory Cash Ledger Payments &amp; Statutory Self-Invoicing
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleBatchGenerateSelfInvoices}
              disabled={generatingInvoices || metrics.pendingSelfInvoices === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.75rem',
                fontWeight: 800,
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: metrics.pendingSelfInvoices > 0 ? '#f59e0b' : '#334155',
                color: metrics.pendingSelfInvoices > 0 ? '#78350f' : '#94a3b8',
                cursor: metrics.pendingSelfInvoices > 0 ? 'pointer' : 'not-allowed',
                boxShadow: metrics.pendingSelfInvoices > 0 ? '0 2px 8px rgba(245, 158, 11, 0.4)' : 'none',
                transition: 'all 0.15s ease'
              }}
              title="Batch generate Section 31(3)(f) self-invoices for all unregistered transporters"
            >
              <Sparkles size={14} />
              <span>{generatingInvoices ? 'Generating...' : `⚡ Auto-Generate Self-Invoices (${metrics.pendingSelfInvoices})`}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.75rem',
                fontWeight: 800,
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: '#10b981',
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.15s ease'
              }}
            >
              <Plus size={15} />
              <span>Record Freight Bill</span>
            </button>
          </div>
        </div>

        {/* 3 Statutory Rules Callout Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.65rem', marginTop: '0.25rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.7rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', color: '#cbd5e1' }}>
            <span style={{ color: '#f59e0b', fontSize: '0.85rem' }}>⚠️</span>
            <span>
              <strong style={{ color: '#fbbf24' }}>Cash Discharge (Sec 49(4)):</strong> RCM tax cannot be paid using credit ledger balances. It must be discharged in cash in <strong>GSTR-3B Table 3.1(d)</strong>.
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', color: '#cbd5e1' }}>
            <span style={{ color: '#10b981', fontSize: '0.85rem' }}>🟢</span>
            <span>
              <strong style={{ color: '#34d399' }}>Simultaneous ITC (Table 4(A)(3)):</strong> 100% of the tax discharged in cash is immediately claimable as ITC in the same filing period.
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', color: '#cbd5e1' }}>
            <span style={{ color: '#60a5fa', fontSize: '0.85rem' }}>📝</span>
            <span>
              <strong style={{ color: '#93c5fd' }}>Self-Invoice (Sec 31(3)(f)):</strong> A numbered self-invoice (SINV) &amp; payment voucher must be issued for every bill from an unregistered GTA.
            </span>
          </div>
        </div>
      </div>

      {/* ── 4 KPI METRIC CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
        {/* 1. Total Freight */}
        <div className="glass-panel" style={{ padding: '0.85rem 1rem', borderRadius: '12px', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>Total GTA Freight</span>
            <div style={{ width: 28, height: 28, borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
              <Truck size={15} />
            </div>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
            {fmtINR(metrics.totalFreight)}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>
            Inward freight turnover (SAC 9965 / 9967)
          </div>
        </div>

        {/* 2. Cash RCM Payable */}
        <div className="glass-panel" style={{ padding: '0.85rem 1rem', borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca', boxShadow: '0 2px 8px rgba(220, 38, 38, 0.05)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#b91c1c' }}>Cash RCM Payable (5%)</span>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '1px 6px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}>
              GSTR-3B Table 3.1(d)
            </span>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#dc2626' }}>
            {fmtINR(metrics.totalCashRcm)}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#991b1b', fontWeight: 600 }}>
            Mandatory Cash Ledger Settlement (CGST Sec 49(4))
          </div>
        </div>

        {/* 3. Eligible ITC Claim */}
        <div className="glass-panel" style={{ padding: '0.85rem 1rem', borderRadius: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.05)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#15803d' }}>Simultaneous ITC Claim</span>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '1px 6px', borderRadius: '10px', background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac' }}>
              GSTR-3B Table 4(A)(3)
            </span>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#16a34a' }}>
            {fmtINR(metrics.eligibleItc)}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#166534', fontWeight: 600 }}>
            Input Tax Credit claimable against cash payment
          </div>
        </div>

        {/* 4. Pending Self-Invoices */}
        <div className="glass-panel" style={{ padding: '0.85rem 1rem', borderRadius: '12px', background: metrics.pendingSelfInvoices > 0 ? '#fffbeb' : '#f8fafc', border: metrics.pendingSelfInvoices > 0 ? '1.5px solid #fcd34d' : '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: metrics.pendingSelfInvoices > 0 ? '#b45309' : '#64748b' }}>Pending Self-Invoices</span>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '1px 6px', borderRadius: '10px', background: metrics.pendingSelfInvoices > 0 ? '#fef3c7' : '#f1f5f9', color: metrics.pendingSelfInvoices > 0 ? '#d97706' : '#64748b', border: '1px solid rgba(0,0,0,0.06)' }}>
              CGST Sec 31(3)(f)
            </span>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: metrics.pendingSelfInvoices > 0 ? '#d97706' : '#334155' }}>
            {metrics.pendingSelfInvoices} Bills
          </div>
          <div style={{ fontSize: '0.68rem', color: metrics.pendingSelfInvoices > 0 ? '#b45309' : '#94a3b8', fontWeight: 600 }}>
            {metrics.pendingSelfInvoices > 0 ? '⚠️ Unregistered GTAs awaiting SINV numbers' : '✓ All unregistered bills self-invoiced'}
          </div>
        </div>
      </div>

      {/* ── TOOLBAR & FILTERS ── */}
      <div className="glass-panel" style={{ padding: '0.6rem 0.85rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.55rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Date Picker */}
          <DateRangePicker
            preset={datePreset}
            onPresetChange={setDatePreset}
            customStart={customStart}
            customEnd={customEnd}
            onCustomDateChange={(s, e) => {
              setCustomStart(s);
              setCustomEnd(e);
            }}
          />

          {/* Search Box */}
          <div style={{ position: 'relative', width: 220 }}>
            <Search size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search LR, Transporter, SINV..."
              style={{
                width: '100%',
                padding: '5px 8px 5px 28px',
                fontSize: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                outline: 'none'
              }}
            />
          </div>

          {/* Transporter Type Filter */}
          <select
            value={transporterTypeFilter}
            onChange={(e) => setTransporterTypeFilter(e.target.value)}
            style={{
              padding: '5px 8px',
              fontSize: '0.75rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              fontWeight: 700,
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">All Transporters</option>
            <option value="UNREGISTERED">⚠️ Unregistered GTA (Sec 9(3))</option>
            <option value="REGISTERED">✓ Registered GTA</option>
          </select>

          {/* Settlement Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '5px 8px',
              fontSize: '0.75rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              fontWeight: 700,
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">All Settlement Status</option>
            <option value="PENDING">Pending Settlement</option>
            <option value="PAID">Settled in Cash</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <button
            type="button"
            onClick={loadBills}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '5px 9px',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#475569',
              cursor: 'pointer'
            }}
            title="Refresh Ledger"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={handleCopyTSV}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '5px 10px',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: copiedSuccess ? '#ecfdf5' : '#ffffff',
              color: copiedSuccess ? '#059669' : '#334155',
              cursor: 'pointer'
            }}
            title="Copy TSV to clipboard for Excel / CA reconciliation"
          >
            {copiedSuccess ? <Check size={13} color="#059669" /> : <Copy size={13} />}
            <span>{copiedSuccess ? 'Copied!' : 'Copy TSV'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '5px 11px',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '8px',
              border: '1px solid #bbf7d0',
              background: '#f0fdf4',
              color: '#15803d',
              cursor: 'pointer'
            }}
            title="Export GTA Audit & GSTR-3B Excel workbook"
          >
            <FileSpreadsheet size={14} color="#16a34a" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* ── DATA TABLE ── */}
      <div
        className="glass-panel"
        style={{
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          overflow: 'hidden',
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 800 }}>
                <th style={{ padding: '9px 12px' }}>LR / Bilty No</th>
                <th style={{ padding: '9px 12px' }}>Date</th>
                <th style={{ padding: '9px 12px' }}>Transporter Details</th>
                <th style={{ padding: '9px 12px' }}>Route &amp; State</th>
                <th style={{ padding: '9px 12px', textAlign: 'right' }}>Freight Amt</th>
                <th style={{ padding: '9px 12px', textAlign: 'right' }}>RCM Tax (5%)</th>
                <th style={{ padding: '9px 12px', textAlign: 'center' }}>Eligible ITC</th>
                <th style={{ padding: '9px 12px' }}>Self-Invoice (Sec 31(3)(f))</th>
                <th style={{ padding: '9px 12px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '9px 12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <Truck size={32} color="#cbd5e1" />
                      <span style={{ fontWeight: 700 }}>No freight bills found for the selected period.</span>
                      <button
                        type="button"
                        onClick={handleOpenCreate}
                        style={{
                          marginTop: '0.25rem',
                          padding: '5px 12px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          borderRadius: '6px',
                          border: 'none',
                          background: '#3b82f6',
                          color: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        + Record First Freight Bill
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBills.map((b) => {
                  const isUnreg = !b.transporterGstin || b.transporterGstin.trim().length === 0;
                  const hasSelfInvoice = !!b.selfInvoiceNumber && b.selfInvoiceNumber.trim().length > 0;

                  return (
                    <tr
                      key={b._id || b.id || b.lrNumber}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.12s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* LR Number */}
                      <td style={{ padding: '9px 12px', fontWeight: 800, color: '#0f172a' }}>
                        <div>{b.lrNumber}</div>
                        {b.billNo && <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Bill: {b.billNo}</div>}
                      </td>

                      {/* Date */}
                      <td style={{ padding: '9px 12px', color: '#334155' }}>
                        {formatDateDDMMYYYY(b.billDate)}
                      </td>

                      {/* Transporter Details */}
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ fontWeight: 800, color: '#1e293b' }}>{b.transporterName}</div>
                        <div style={{ marginTop: '2px' }}>
                          {isUnreg ? (
                            <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                              ⚠️ Unregistered GTA (Sec 9(3))
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
                              ✓ {b.transporterGstin}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Route & State */}
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#334155' }}>
                          <span>{b.originStateCode}</span>
                          <ArrowRight size={11} color="#94a3b8" />
                          <span>{b.destinationStateCode}</span>
                        </div>
                        <span style={{ fontSize: '0.62rem', color: b.isInterstate ? '#6366f1' : '#059669', fontWeight: 700 }}>
                          {b.isInterstate ? 'Inter-state (IGST)' : 'Intra-state (CGST+SGST)'}
                        </span>
                      </td>

                      {/* Freight Amount */}
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                        {fmtINR(b.freightAmount)}
                      </td>

                      {/* RCM Tax (5%) */}
                      <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: '#dc2626' }}>{fmtINR(b.totalRcmTax)}</div>
                        <div style={{ fontSize: '0.62rem', color: '#64748b' }}>
                          {b.isInterstate
                            ? `IGST: ₹${fmtNum(b.rcmIgst)}`
                            : `C+S: ₹${fmtNum(b.rcmCgst)} + ₹${fmtNum(b.rcmSgst)}`}
                        </div>
                      </td>

                      {/* Eligible ITC */}
                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                        {b.isEligibleItc ? (
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#16a34a', background: '#ecfdf5', padding: '2px 7px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                            ✓ 100% ITC ({fmtINR(b.totalRcmTax)})
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8' }}>Ineligible</span>
                        )}
                      </td>

                      {/* Self-Invoice */}
                      <td style={{ padding: '9px 12px' }}>
                        {hasSelfInvoice ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ fontWeight: 800, color: '#4338ca', fontSize: '0.72rem', background: '#eef2ff', padding: '2px 6px', borderRadius: '4px', border: '1px solid #c7d2fe' }}>
                              {b.selfInvoiceNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => setViewingSelfInvoice(b)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#4f46e5',
                                cursor: 'pointer',
                                padding: '2px'
                              }}
                              title="View &amp; Print Self-Invoice Voucher"
                            >
                              <Eye size={13} />
                            </button>
                          </div>
                        ) : isUnreg ? (
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#d97706', background: '#fffbeb', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fcd34d' }}>
                            ⚠️ Pending SINV
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>N/A (Forward Charge)</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleSettle(b)}
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            border: b.settlementStatus === 'PAID' ? '1px solid #86efac' : '1px solid #fcd34d',
                            background: b.settlementStatus === 'PAID' ? '#f0fdf4' : '#fffbeb',
                            color: b.settlementStatus === 'PAID' ? '#15803d' : '#b45309',
                            cursor: 'pointer'
                          }}
                          title="Click to toggle Cash Ledger settlement status"
                        >
                          {b.settlementStatus === 'PAID' ? '✓ Settled in Cash' : '⏳ Pending Payment'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(b)}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                              background: '#ffffff',
                              color: '#475569',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Edit Freight Bill"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBill(b)}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: '6px',
                              border: '1px solid #fee2e2',
                              background: '#fef2f2',
                              color: '#dc2626',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Delete Bill"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: RECORD / EDIT FREIGHT BILL
      ══════════════════════════════════════════════════════════════════════ */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '560px',
              background: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0369a1' }}>
                  <Truck size={17} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 900, color: '#0f172a' }}>
                    {editingBill ? 'Edit Freight Bill (RCM)' : 'Record GTA Freight Bill (Sec 9(3) RCM)'}
                  </h4>
                  <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                    SAC 9965 • Automatic 5% CGST/SGST or IGST Computation
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveBill} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '75vh', overflowY: 'auto' }}>
              {/* Row 1: LR No & Bill Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#334155' }}>
                    LR / Bilty Number <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lrNumber}
                    onChange={(e) => setFormData({ ...formData, lrNumber: e.target.value })}
                    placeholder="e.g. LR-98421"
                    style={{ width: '100%', padding: '7px 9px', fontSize: '0.78rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '3px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#334155' }}>Bill Date <span style={{ color: '#dc2626' }}>*</span></label>
                  <input
                    type="date"
                    required
                    value={formData.billDate}
                    onChange={(e) => setFormData({ ...formData, billDate: e.target.value })}
                    style={{ width: '100%', padding: '7px 9px', fontSize: '0.78rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '3px' }}
                  />
                </div>
              </div>

              {/* Row 2: Transporter Name & Unregistered Toggle */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#334155' }}>
                  Transporter / Agency Name <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.transporterName}
                  onChange={(e) => setFormData({ ...formData, transporterName: e.target.value })}
                  placeholder="e.g. Patel Roadways / Shree Balaji Transport"
                  style={{ width: '100%', padding: '7px 9px', fontSize: '0.78rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '3px' }}
                />
              </div>

              {/* Unregistered checkbox & GSTIN */}
              <div style={{ padding: '0.65rem', borderRadius: '8px', background: formData.isUnregistered ? '#fffbeb' : '#f0fdf4', border: formData.isUnregistered ? '1px solid #fde68a' : '1px solid #bbf7d0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.72rem', fontWeight: 800, color: formData.isUnregistered ? '#92400e' : '#166534', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.isUnregistered}
                    onChange={(e) => setFormData({ ...formData, isUnregistered: e.target.checked })}
                  />
                  <span>Transporter is UNREGISTERED under GST (Mandates Self-Invoice under Sec 31(3)(f))</span>
                </label>
                {!formData.isUnregistered && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <input
                      type="text"
                      value={formData.transporterGstin}
                      onChange={(e) => setFormData({ ...formData, transporterGstin: e.target.value })}
                      placeholder="Enter 15-Digit Transporter GSTIN"
                      maxLength={15}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #86efac', textTransform: 'uppercase' }}
                    />
                  </div>
                )}
              </div>

              {/* Row 3: Origin & Destination States */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#334155' }}>Origin State</label>
                  <select
                    value={formData.originStateCode}
                    onChange={(e) => setFormData({ ...formData, originStateCode: e.target.value })}
                    style={{ width: '100%', padding: '7px 9px', fontSize: '0.78rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '3px' }}
                  >
                    {INDIAN_STATES.map((st) => (
                      <option key={st.code} value={st.code}>
                        {st.code} - {st.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#334155' }}>Destination State</label>
                  <select
                    value={formData.destinationStateCode}
                    onChange={(e) => setFormData({ ...formData, destinationStateCode: e.target.value })}
                    style={{ width: '100%', padding: '7px 9px', fontSize: '0.78rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '3px' }}
                  >
                    {INDIAN_STATES.map((st) => (
                      <option key={st.code} value={st.code}>
                        {st.code} - {st.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 4: Freight Amount & RCM Rate */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#334155' }}>
                    Freight Amount (₹) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.freightAmount}
                    onChange={(e) => setFormData({ ...formData, freightAmount: e.target.value })}
                    placeholder="e.g. 15000.00"
                    style={{ width: '100%', padding: '7px 9px', fontSize: '0.78rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '3px', fontWeight: 800 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#334155' }}>RCM Rate</label>
                  <input
                    type="text"
                    disabled
                    value="5% Flat"
                    style={{ width: '100%', padding: '7px 9px', fontSize: '0.78rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '3px', background: '#f8fafc', color: '#64748b', fontWeight: 800 }}
                  />
                </div>
              </div>

              {/* Real-time Tax Impact Summary Box */}
              <div style={{ padding: '0.75rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                  <span style={{ color: '#64748b' }}>Supply Nature:</span>
                  <strong style={{ color: formTaxCalc.isInter ? '#4f46e5' : '#059669' }}>
                    {formTaxCalc.isInter ? 'Inter-state (5% IGST)' : 'Intra-state (2.5% CGST + 2.5% SGST)'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                  <span style={{ color: '#64748b' }}>Reverse Charge Liability:</span>
                  <strong style={{ color: '#dc2626' }}>{fmtINR(formTaxCalc.totalTax)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#15803d', borderTop: '1px dashed #cbd5e1', paddingTop: '4px' }}>
                  <span>Eligible ITC Claim (4(A)(3)):</span>
                  <strong>{fmtINR(formTaxCalc.totalTax)}</strong>
                </div>
              </div>

              {/* Row 5: Settlement & Vehicle */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#334155' }}>Settlement Status</label>
                  <select
                    value={formData.settlementStatus}
                    onChange={(e) => setFormData({ ...formData, settlementStatus: e.target.value })}
                    style={{ width: '100%', padding: '7px 9px', fontSize: '0.78rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '3px' }}
                  >
                    <option value="PENDING">Pending Payment</option>
                    <option value="PAID">Settled in Cash</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#334155' }}>Vehicle Number</label>
                  <input
                    type="text"
                    value={formData.vehicleNo}
                    onChange={(e) => setFormData({ ...formData, vehicleNo: e.target.value })}
                    placeholder="e.g. GJ-05-XX-1234"
                    style={{ width: '100%', padding: '7px 9px', fontSize: '0.78rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '3px' }}
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '7px 14px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '7px 16px', fontSize: '0.75rem', fontWeight: 800, borderRadius: '8px', border: 'none', background: '#3b82f6', color: '#ffffff', cursor: submitting ? 'not-allowed' : 'pointer' }}
                >
                  {submitting ? 'Saving...' : editingBill ? 'Update Bill' : 'Save Freight Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: STATUTORY SELF-INVOICE VOUCHER (SECTION 31(3)(f))
      ══════════════════════════════════════════════════════════════════════ */}
      {viewingSelfInvoice && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(5px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '650px',
              background: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Action Bar */}
            <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={17} color="#4338ca" />
                <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#1e293b' }}>
                  Statutory Tax Invoice / Payment Voucher under Section 31(3)(f)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '4px 10px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    cursor: 'pointer'
                  }}
                >
                  <Printer size={13} />
                  <span>Print Voucher</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingSelfInvoice(null)}
                  style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Printable Voucher Paper */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#ffffff', fontSize: '0.8rem', color: '#1e293b' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '0.75rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase' }}>
                  {companyEntity}
                </h2>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginTop: '2px' }}>
                  GSTIN: {companyGstin} • State: Gujarat (24)
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4338ca', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  INVOICE ISSUED UNDER SECTION 31(3)(f) OF CGST ACT, 2017 (REVERSE CHARGE)
                </div>
              </div>

              {/* Meta Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.75rem' }}>
                <div>
                  <div><strong>Self-Invoice No:</strong> {viewingSelfInvoice.selfInvoiceNumber}</div>
                  <div><strong>Date of Issue:</strong> {formatDateDDMMYYYY(viewingSelfInvoice.selfInvoiceDate || viewingSelfInvoice.billDate)}</div>
                  <div><strong>LR / Bilty No:</strong> {viewingSelfInvoice.lrNumber}</div>
                  {viewingSelfInvoice.vehicleNo && <div><strong>Vehicle No:</strong> {viewingSelfInvoice.vehicleNo}</div>}
                </div>
                <div>
                  <div><strong>Supplier Name:</strong> {viewingSelfInvoice.transporterName}</div>
                  <div><strong>Supplier Status:</strong> <span style={{ color: '#dc2626', fontWeight: 800 }}>UNREGISTERED PERSON</span></div>
                  <div><strong>Place of Supply (POS):</strong> {viewingSelfInvoice.destinationStateName} ({viewingSelfInvoice.destinationStateCode})</div>
                  <div><strong>SAC Code:</strong> 9965 (Goods Transport Agency)</div>
                </div>
              </div>

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Description of Service</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center' }}>SAC</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Taxable Value</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center' }}>Tax Rate</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Tax Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>
                      Road Transportation of Goods by Goods Transport Agency (GTA)
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>9965</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>
                      {fmtINR(viewingSelfInvoice.freightAmount)}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>
                      {viewingSelfInvoice.rcmRate || 5}%
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontWeight: 800, color: '#dc2626' }}>
                      {fmtINR(viewingSelfInvoice.totalRcmTax)}
                    </td>
                  </tr>
                  <tr style={{ fontWeight: 800, background: '#f8fafc' }}>
                    <td colSpan={2} style={{ padding: '8px', textAlign: 'right' }}>Total (₹):</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{fmtINR(viewingSelfInvoice.freightAmount)}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>-</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#dc2626' }}>{fmtINR(viewingSelfInvoice.totalRcmTax)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Statutory Note */}
              <div style={{ padding: '0.65rem', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fecaca', fontSize: '0.7rem', color: '#991b1b' }}>
                <strong>Statutory Declaration:</strong> "Whether tax is payable on reverse charge basis: <strong>YES</strong>. The supply covered under this invoice is subject to tax under Section 9(3) of the Central Goods and Services Tax Act, 2017. Tax will be discharged in cash under GSTR-3B Table 3.1(d)."
              </div>

              {/* Signatures */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px dashed #cbd5e1' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Prepared By</div>
                  <div style={{ marginTop: '1.5rem', fontWeight: 800 }}>Accountant / Compliance Desk</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>For {companyEntity}</div>
                  <div style={{ marginTop: '1.5rem', fontWeight: 800 }}>Authorised Signatory</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
