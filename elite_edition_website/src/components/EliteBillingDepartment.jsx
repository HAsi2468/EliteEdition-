import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { triggerPushNotification } from './NotificationToast';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import { matchSearchQuery } from '../utils/searchUtils';
import StitchingChallanPanel from './StitchingChallanPanel';
import FabricInventoryPanel from './FabricInventoryPanel';
import ScreenGroupRoster from './ScreenGroupRoster';
import { dispatchScreenGroupEvent } from '../services/screenGroupService';
import { triggerEliteAlert } from './EliteModalDialog';
import {
  FileText,
  Plus,
  Trash2,
  Download,
  Printer,
  DollarSign,
  Users,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  CreditCard,
  Building,
  RefreshCw,
  PlusCircle,
  Eye,
  Edit2,
  ChevronRight,
  Package,
  Calendar,
  X,
  Truck,
  Receipt,
  Lock,
  BookOpen,
  FileSpreadsheet
} from 'lucide-react';

// Helper for Indian Currency formatting
const fmtINR = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Number to Words Converter in Indian format
function numToWords(amount) {
  const words = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n) {
    if (n < 20) return words[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + words[n % 10] : '');
    if (n < 1000) return words[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
  }

  const num = Math.floor(amount || 0);
  if (num === 0) return 'Rupees Zero Only';
  return 'Rupees ' + convert(num) + ' Only';
}

// Helper to format job card display string cleanly
function formatJobDisplay(jobStr) {
  if (!jobStr) return '';
  const str = String(jobStr);
  const matches = str.match(/\d+/g);
  if (matches && matches.length > 0) {
    const unique = [...new Set(matches)];
    if (unique.length === 1) return `Job Card: ${unique[0]}`;
    return `Job Cards: ${unique.join(', ')}`;
  }
  return str.replace(/JOB NO\.-?\s*/gi, '').replace(/Job\s*#?\s*/gi, '').trim();
}

const PRESET_OPTIONS = [
  { id: 'today', name: 'Today' },
  { id: 'yesterday', name: 'Yesterday' },
  { id: 'this_week', name: 'This Week' },
  { id: 'last_week', name: 'Last Week' },
  { id: 'last_7_days', name: 'Last 7 Days' },
  { id: 'this_month', name: 'This Month' },
  { id: 'previous_month', name: 'Previous Month' },
  { id: 'last_30_days', name: 'Last 30 Days' },
  { id: 'this_quarter', name: 'This Quarter' },
  { id: 'previous_quarter', name: 'Previous Quarter' },
  { id: 'current_fiscal_year', name: 'Current Fiscal Year' },
  { id: 'previous_fiscal_year', name: 'Previous Fiscal Year' },
  { id: 'last_365_days', name: 'Last 365 Days' },
  { id: 'all', name: 'All Time' },
  { id: 'custom', name: 'Custom' }
];

function getDatePresetRange(preset, customStart = '', customEnd = '') {
  const now = new Date();
  let start = null;
  let end = null;
  let labelText = '';

  const formatDate = (d) => {
    if (!d) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  switch (preset) {
    case 'today': {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0);
      end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'this_week': {
      const dayOfWeek = now.getDay();
      const distToMonday = (dayOfWeek + 6) % 7;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distToMonday, 0, 0, 0);
      const sun = new Date(start);
      sun.setDate(start.getDate() + 6);
      end = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate(), 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'last_week': {
      const dayOfWeek = now.getDay();
      const distToMonday = (dayOfWeek + 6) % 7;
      const prevMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distToMonday - 7, 0, 0, 0);
      start = prevMon;
      const prevSun = new Date(prevMon);
      prevSun.setDate(prevMon.getDate() + 6);
      end = new Date(prevSun.getFullYear(), prevSun.getMonth(), prevSun.getDate(), 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'last_7_days': {
      const d7 = new Date(now);
      d7.setDate(now.getDate() - 6);
      start = new Date(d7.getFullYear(), d7.getMonth(), d7.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'this_month': {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'previous_month': {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'last_30_days': {
      const d30 = new Date(now);
      d30.setDate(now.getDate() - 29);
      start = new Date(d30.getFullYear(), d30.getMonth(), d30.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'this_quarter': {
      const m = now.getMonth();
      const qStartMonth = Math.floor(m / 3) * 3;
      start = new Date(now.getFullYear(), qStartMonth, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), qStartMonth + 3, 0, 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'previous_quarter': {
      const m = now.getMonth();
      const qStartMonth = Math.floor(m / 3) * 3 - 3;
      start = new Date(now.getFullYear(), qStartMonth, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), qStartMonth + 3, 0, 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'current_fiscal_year': {
      const yr = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      start = new Date(yr, 3, 1, 0, 0, 0);
      end = new Date(yr + 1, 2, 31, 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'previous_fiscal_year': {
      const yr = (now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1) - 1;
      start = new Date(yr, 3, 1, 0, 0, 0);
      end = new Date(yr + 1, 2, 31, 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'last_365_days': {
      const d365 = new Date(now);
      d365.setDate(now.getDate() - 364);
      start = new Date(d365.getFullYear(), d365.getMonth(), d365.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'custom': {
      if (customStart) start = new Date(`${customStart}T00:00:00`);
      if (customEnd) end = new Date(`${customEnd}T23:59:59`);
      labelText = start && end ? `${formatDate(start)} - ${formatDate(end)}` : 'Custom Range';
      break;
    }
    case 'all':
    default: {
      start = null;
      end = null;
      labelText = 'All Time Records';
      break;
    }
  }

  return { start, end, labelText };
}

export default function EliteBillingDepartment({ initialChallanData = null, department = 'digital_print' }) {
  const [activeTab, setActiveTab] = useState('challans'); // 'challans', 'invoices', 'dashboard', 'create', 'customers', 'items'
  const [challanDept, setChallanDept] = useState(() => (department === 'stitching' ? 'stitching' : 'digital_print'));
  const [stats, setStats] = useState({
    totalInvoices: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    totalBalanceDue: 0,
    paidCount: 0,
    unpaidCount: 0,
    overdueCount: 0
  });

  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState('this_month');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);

  // Multi-select for bulk Invoice PDF download
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [bulkDownloading, setBulkDownloading] = useState(false);

  // ── Ledger System States ──────────────────────────────────────────────────
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerMode, setLedgerMode] = useState('party'); // 'party' or 'master'
  const [selectedPartyId, setSelectedPartyId] = useState('ALL');
  const [ledgerPreset, setLedgerPreset] = useState('this_month');
  const [ledgerDateStart, setLedgerDateStart] = useState('');
  const [ledgerDateEnd, setLedgerDateEnd] = useState('');
  const [ledgerFormat, setLedgerFormat] = useState('pdf'); // 'pdf', 'excel', 'csv', 'print'

  // Helper for Ledger dates
  const getLedgerDateRange = () => {
    const now = new Date();
    let startD = null;
    let endD = null;

    if (ledgerPreset === 'this_month') {
      startD = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      endD = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (ledgerPreset === 'last_quarter') {
      const m = now.getMonth();
      const qStartMonth = Math.floor(m / 3) * 3 - 3;
      startD = new Date(now.getFullYear(), qStartMonth, 1, 0, 0, 0);
      endD = new Date(now.getFullYear(), qStartMonth + 3, 0, 23, 59, 59);
    } else if (ledgerPreset === 'fy_ytd') {
      const yr = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      startD = new Date(yr, 3, 1, 0, 0, 0);
      endD = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (ledgerPreset === 'custom') {
      if (ledgerDateStart) startD = new Date(`${ledgerDateStart}T00:00:00`);
      if (ledgerDateEnd) endD = new Date(`${ledgerDateEnd}T23:59:59`);
    }
    return { startD, endD };
  };

  // Compute Party Ledger Data with robust matching & date parsing
  const computePartyLedger = (partyId, startD, endD) => {
    const parseInvDate = (dateVal) => {
      if (!dateVal) return new Date();
      if (dateVal instanceof Date) return dateVal;
      const str = String(dateVal);
      if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
          return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        }
      }
      const d = new Date(str);
      return isNaN(d.getTime()) ? new Date() : d;
    };

    const targetParty = customers.find(c => String(c._id) === String(partyId) || String(c.id) === String(partyId));

    const isMatch = (inv) => {
      if (!partyId || partyId === 'ALL') return true;
      if (inv.customerId && String(inv.customerId) === String(partyId)) return true;
      if (inv.customer?._id && String(inv.customer._id) === String(partyId)) return true;
      if (inv.customer?.id && String(inv.customer.id) === String(partyId)) return true;

      if (targetParty) {
        const pName = (targetParty.businessName || targetParty.name || '').toLowerCase().trim();
        const pGst = (targetParty.gstin || '').toLowerCase().trim();
        const pPhone = (targetParty.phone || '').toLowerCase().trim();

        const invCustName = (inv.customer?.businessName || inv.customer?.name || inv.customerName || (typeof inv.customer === 'string' ? inv.customer : '')).toLowerCase().trim();
        const invGst = (inv.customer?.gstin || inv.customerGst || '').toLowerCase().trim();
        const invPhone = (inv.customer?.phone || inv.customerPhone || '').toLowerCase().trim();

        if (pName && invCustName && (invCustName.includes(pName) || pName.includes(invCustName))) return true;
        if (pGst && invGst && invGst === pGst) return true;
        if (pPhone && invPhone && invPhone === pPhone) return true;
      }
      return false;
    };

    const sortedInvoices = [...invoices]
      .filter(isMatch)
      .sort((a, b) => parseInvDate(a.invoiceDate || a.createdAt) - parseInvDate(b.invoiceDate || b.createdAt));
    
    let openingBalance = 0;
    const periodTx = [];

    sortedInvoices.forEach(inv => {
      const invDate = parseInvDate(inv.invoiceDate || inv.createdAt);
      const grandTotal = Number(inv.grandTotal || inv.totalAmount || 0);
      const paidAmount = Number(inv.paidAmount || 0);

      if (startD && invDate < startD) {
        openingBalance += (grandTotal - paidAmount);
        return;
      }

      if (endD && invDate > endD) return;

      if (grandTotal > 0) {
        periodTx.push({
          date: formatDateDDMMYYYY(inv.invoiceDate || inv.createdAt),
          voucherNo: inv.invoiceNo || 'INV',
          particulars: `Sales Invoice #${inv.invoiceNo || ''}`,
          department: inv.department || 'Elite Digital Prints',
          debit: grandTotal,
          credit: 0
        });
      }

      if (paidAmount > 0) {
        periodTx.push({
          date: formatDateDDMMYYYY(inv.paymentDate || inv.invoiceDate || inv.createdAt),
          voucherNo: `REC-${inv.invoiceNo || ''}`,
          particulars: `Payment Received — Invoice #${inv.invoiceNo || ''}`,
          department: inv.department || 'Elite Digital Prints',
          debit: 0,
          credit: paidAmount
        });
      }
    });

    let runningBal = openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;

    const rows = periodTx.map(tx => {
      runningBal += (tx.debit - tx.credit);
      totalDebit += tx.debit;
      totalCredit += tx.credit;
      return { ...tx, runningBalance: runningBal, balType: runningBal >= 0 ? 'Dr' : 'Cr' };
    });

    return {
      openingBalance,
      totalDebit,
      totalCredit,
      closingBalance: runningBal,
      transactions: rows
    };
  };

  const handleGenerateLedgerExport = () => {
    const { startD, endD } = getLedgerDateRange();

    if (ledgerMode === 'party') {
      const selectedParty = customers.find(c => c._id === selectedPartyId) || { name: 'All Customers', businessName: 'Global Account Ledger' };
      const partyName = selectedParty.businessName || selectedParty.name;
      const ledger = computePartyLedger(selectedPartyId, startD, endD);

      if (ledgerFormat === 'csv' || ledgerFormat === 'excel') {
        let csvContent = `ELITE DIGITAL PRINTS — PARTY LEDGER STATEMENT\n`;
        csvContent += `Party Name: "${partyName}"\n`;
        csvContent += `Period: ${startD ? formatDateDDMMYYYY(startD) : 'Start'} to ${endD ? formatDateDDMMYYYY(endD) : 'Present'}\n`;
        csvContent += `Opening Balance: ₹ ${ledger.openingBalance.toFixed(2)}\n\n`;
        csvContent += `Date,Voucher No,Particulars,Department,Debit (₹),Credit (₹),Running Balance (₹),Dr/Cr\n`;

        ledger.transactions.forEach(t => {
          csvContent += `"${t.date}","${t.voucherNo}","${t.particulars}","${t.department}",${t.debit.toFixed(2)},${t.credit.toFixed(2)},${Math.abs(t.runningBalance).toFixed(2)},"${t.balType}"\n`;
        });

        csvContent += `\nTOTALS,,,"",${ledger.totalDebit.toFixed(2)},${ledger.totalCredit.toFixed(2)},${Math.abs(ledger.closingBalance).toFixed(2)},"${ledger.closingBalance >= 0 ? 'Dr' : 'Cr'}"\n`;

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Ledger_${partyName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        triggerPushNotification('📒 Ledger Exported', `Party statement for ${partyName} exported successfully.`, 'success');
      } else {
        const printWin = window.open('', '_blank');
        if (!printWin) {
          triggerEliteAlert('⚠️ Popup Blocked', 'Please allow popups for this site to view/download the PDF Ledger Statement.', 'warning');
          return;
        }
        printWin.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Party Ledger — ${partyName}</title>
              <style>
                @page { size: A4 portrait; margin: 12mm; }
                body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; padding: 20px; color: #0f172a; font-size: 11px; line-height: 1.4; }
                .no-print { display: flex; justify-content: space-between; align-items: center; background: #1e1b4b; color: #fff; padding: 10px 16px; border-radius: 8px; margin-bottom: 20px; }
                .no-print button { background: #10b981; color: #fff; border: none; padding: 8px 18px; font-weight: 800; border-radius: 6px; cursor: pointer; font-size: 13px; }
                .header { border-bottom: 2.5px solid #7c3aed; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-start; }
                .title { font-size: 22px; font-weight: 800; color: #4c1d95; letter-spacing: -0.5px; }
                .subtitle { font-size: 11px; color: #64748b; margin-top: 3px; font-weight: 600; }
                .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 16px; border-radius: 8px; margin-bottom: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 11px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
                th { background: #1e1b4b; color: #ffffff; text-align: left; padding: 8px 10px; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
                td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
                tr:nth-child(even) { background: #f8fafc; }
                .num { text-align: right; }
                .totals-row { font-weight: 800; background: #f1f5f9; border-top: 2px solid #1e1b4b; border-bottom: 2px solid #1e1b4b; font-size: 11px; }
                .footer { margin-top: 35px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 15px; }
                @media print {
                  .no-print { display: none !important; }
                  body { padding: 0; }
                }
              </style>
            </head>
            <body>
              <div class="no-print">
                <span style="font-weight: 700; font-size: 13px;">📄 ${partyName} — Ledger Statement PDF</span>
                <button onclick="window.print()">📥 Print / Save as PDF</button>
              </div>

              <div class="header">
                <div>
                  <div class="title">ELITE DIGITAL PRINTS</div>
                  <div class="subtitle">Cloud Accounting & GST Invoicing — Official Party Account Ledger Statement</div>
                </div>
                <div style="text-align: right; font-size: 11px; color: #475569;">
                  <div style="background: #7c3aed; color: #fff; padding: 3px 8px; border-radius: 4px; font-weight: 800; display: inline-block; margin-bottom: 4px;">LEDGER STATEMENT</div>
                  <div><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}</div>
                </div>
              </div>

              <div class="meta-box">
                <div>
                  <div style="font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700;">Account / Customer Details</div>
                  <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">${partyName}</div>
                  <div style="color: #475569; margin-top: 3px;">
                    ${selectedParty.gstin ? `GSTIN: <b>${selectedParty.gstin}</b> | ` : ''}
                    ${selectedParty.phone ? `Phone: <b>${selectedParty.phone}</b>` : ''}
                  </div>
                </div>
                <div style="text-align: right; border-left: 1px solid #e2e8f0; padding-left: 15px;">
                  <div style="font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700;">Statement Summary</div>
                  <div style="margin-top: 4px;">Opening Balance: <b>${fmtINR(ledger.openingBalance)}</b></div>
                  <div>Total Billed: <b>${fmtINR(ledger.totalDebit)}</b> | Total Paid: <b>${fmtINR(ledger.totalCredit)}</b></div>
                  <div style="margin-top: 3px;">Closing Balance: <span style="color: ${ledger.closingBalance > 0 ? '#dc2626' : '#16a34a'}; font-weight: 800; font-size: 13px;">${fmtINR(Math.abs(ledger.closingBalance))} (${ledger.closingBalance >= 0 ? 'Dr' : 'Cr'})</span></div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style="width: 12%;">Date</th>
                    <th style="width: 16%;">Voucher No</th>
                    <th>Particulars / Description</th>
                    <th style="width: 16%;">Department</th>
                    <th class="num" style="width: 14%;">Debit (₹)</th>
                    <th class="num" style="width: 14%;">Credit (₹)</th>
                    <th class="num" style="width: 16%;">Running Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="background: #f1f5f9; font-weight: 700;">
                    <td colspan="4"><i>Opening Balance B/F</i></td>
                    <td class="num">—</td>
                    <td class="num">—</td>
                    <td class="num"><b>${fmtINR(Math.abs(ledger.openingBalance))} ${ledger.openingBalance >= 0 ? 'Dr' : 'Cr'}</b></td>
                  </tr>
                  ${ledger.transactions.length === 0 ? '<tr><td colspan="7" style="text-align:center; padding: 20px; color: #64748b;">No transactions recorded for selected period.</td></tr>' : ledger.transactions.map(t => `
                    <tr>
                      <td>${t.date}</td>
                      <td><strong>${t.voucherNo}</strong></td>
                      <td>${t.particulars}</td>
                      <td>${t.department}</td>
                      <td class="num">${t.debit > 0 ? fmtINR(t.debit) : '—'}</td>
                      <td class="num">${t.credit > 0 ? fmtINR(t.credit) : '—'}</td>
                      <td class="num"><strong>${fmtINR(Math.abs(t.runningBalance))} ${t.balType}</strong></td>
                    </tr>
                  `).join('')}
                  <tr class="totals-row">
                    <td colspan="4">TOTAL PERIOD TRANSACTIONS</td>
                    <td class="num">${fmtINR(ledger.totalDebit)}</td>
                    <td class="num">${fmtINR(ledger.totalCredit)}</td>
                    <td class="num">${fmtINR(Math.abs(ledger.closingBalance))} ${ledger.closingBalance >= 0 ? 'Dr' : 'Cr'}</td>
                  </tr>
                </tbody>
              </table>

              <div class="footer">
                <div>Prepared By: Accounts & Billing Department — Elite Digital Prints</div>
                <div>Authorized Signatory: _______________________</div>
              </div>

              <script>
                window.onload = function() {
                  setTimeout(function() { window.print(); }, 300);
                };
              </script>
            </body>
          </html>
        `);
        printWin.document.close();
        triggerPushNotification('📄 Ledger PDF Ready', `Party statement PDF generated for ${partyName}.`, 'success');
      }
    } else {
      // Mode B: Master Ledger Export
      let csvContent = `ELITE DIGITAL PRINTS — ALL-PARTIES MASTER LEDGER SUMMARY\n`;
      csvContent += `Report Date: ${new Date().toLocaleDateString('en-IN')}\n\n`;
      csvContent += `Party Code,Party Name,GSTIN,Phone,Opening Balance (₹),Total Billed (₹),Total Paid (₹),Closing Balance (₹),Status\n`;

      let grandBilled = 0;
      let grandPaid = 0;
      let grandBal = 0;

      customers.forEach(cust => {
        const partyLedger = computePartyLedger(cust._id, startD, endD);
        grandBilled += partyLedger.totalDebit;
        grandPaid += partyLedger.totalCredit;
        grandBal += partyLedger.closingBalance;

        csvContent += `"CUST-${cust._id.slice(-4).toUpperCase()}","${cust.businessName || cust.name}","${cust.gstin || 'N/A'}","${cust.phone || 'N/A'}",${partyLedger.openingBalance.toFixed(2)},${partyLedger.totalDebit.toFixed(2)},${partyLedger.totalCredit.toFixed(2)},${partyLedger.closingBalance.toFixed(2)},"${partyLedger.closingBalance > 0 ? 'Overdue' : 'Active'}"\n`;
      });

      csvContent += `\nGRAND TOTALS,,,,,${grandBilled.toFixed(2)},${grandPaid.toFixed(2)},${grandBal.toFixed(2)},\n`;

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Master_Ledger_Summary_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      triggerPushNotification('🌐 Master Ledger Exported', `All-Parties Master Ledger exported successfully.`, 'success');
    }
  };

  const handleToggleSelectAllInvoices = (visibleInvoices) => {
    const visibleIds = visibleInvoices.map(i => i._id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedInvoiceIds.includes(id));
    if (allSelected) {
      setSelectedInvoiceIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedInvoiceIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleToggleSelectInvoice = (id) => {
    setSelectedInvoiceIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDownloadInvoices = async () => {
    if (selectedInvoiceIds.length === 0) return;
    setBulkDownloading(true);
    try {
      await api.downloadBulkInvoicesPdf(
        selectedInvoiceIds,
        `Combined_Tax_Invoices_${selectedInvoiceIds.length}_Invoices.pdf`
      );
      triggerPushNotification(
        '📥 Combined Invoices PDF Downloaded',
        `${selectedInvoiceIds.length} Invoices merged into 1 single multi-page PDF document successfully.`,
        'success'
      );
    } catch (e) {
      alert('Error during bulk invoice download: ' + e.message);
    } finally {
      setBulkDownloading(false);
    }
  };

  const activeRange = useMemo(() => {
    return getDatePresetRange(datePreset, customDateStart, customDateEnd);
  }, [datePreset, customDateStart, customDateEnd]);

  const periodInvoices = useMemo(() => {
    if (!activeRange.start && !activeRange.end) return invoices;
    return invoices.filter(inv => {
      const dateVal = inv.invoiceDate || inv.date || inv.createdAt;
      if (!dateVal) return true;
      const d = new Date(dateVal);
      if (activeRange.start && d < activeRange.start) return false;
      if (activeRange.end && d > activeRange.end) return false;
      return true;
    });
  }, [invoices, activeRange]);

  const periodStats = useMemo(() => {
    const totalInvoices = periodInvoices.length;
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalBalanceDue = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    let overdueCount = 0;

    const todayStr = new Date().toISOString().split('T')[0];

    periodInvoices.forEach(inv => {
      const grandTotal = Number(inv.grandTotal || inv.totalAmount || 0);
      const paid = Number(inv.paidAmount || 0);
      const balance = Math.max(0, grandTotal - paid);

      totalInvoiced += grandTotal;
      totalPaid += paid;
      totalBalanceDue += balance;

      if (inv.paymentStatus === 'PAID' || balance <= 0) {
        paidCount++;
      } else {
        unpaidCount++;
        if (inv.dueDate && inv.dueDate < todayStr) {
          overdueCount++;
        }
      }
    });

    return {
      totalInvoices,
      totalInvoiced,
      totalPaid,
      totalBalanceDue,
      paidCount,
      unpaidCount,
      overdueCount
    };
  }, [periodInvoices]);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [customerSearch, setCustomerSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [digitalChallans, setDigitalChallans] = useState([]);
  const [loadingChallans, setLoadingChallans] = useState(false);
  const [challanSearch, setChallanSearch] = useState('');

  const fetchDigitalChallans = async () => {
    setLoadingChallans(true);
    try {
      const res = await api.getFabricChallans();
      if (res && res.success && Array.isArray(res.data)) {
        setDigitalChallans(res.data);
      } else if (Array.isArray(res)) {
        setDigitalChallans(res);
      }
    } catch (e) {
      console.warn('Failed to load Digital Print Challans:', e);
    } finally {
      setLoadingChallans(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'challans' && department !== 'stitching') {
      fetchDigitalChallans();
    }
  }, [activeTab, department]);

  const [viewInvoiceModal, setViewInvoiceModal] = useState(null);
  const [pdfDuplicateModal, setPdfDuplicateModal] = useState(null); // { inv } when open
  const [pdfDuplicateChecked, setPdfDuplicateChecked] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);

  const openPdfDialog = (inv) => {
    setPdfDuplicateChecked(false);
    setPdfDuplicateModal(inv);
  };

  const handleConfirmDownloadPdf = async () => {
    if (!pdfDuplicateModal) return;
    setPdfDownloading(true);
    try {
      await api.downloadInvoicePdf(pdfDuplicateModal._id, pdfDuplicateModal.invoiceNo, pdfDuplicateChecked);
    } catch (e) {
      alert('Failed to download PDF: ' + e.message);
    } finally {
      setPdfDownloading(false);
      setPdfDuplicateModal(null);
    }
  };

  // Filtered Customers & Items
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.businessName || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.gstin || '').toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const filteredItems = useMemo(() => {
    if (!itemSearch) return itemsList;
    const q = itemSearch.toLowerCase();
    return itemsList.filter(i =>
      (i.itemName || '').toLowerCase().includes(q) ||
      (i.hsnCode || '').toLowerCase().includes(q) ||
      (i.category || '').toLowerCase().includes(q)
    );
  }, [itemsList, itemSearch]);

  // Delete Customer
  const handleDeleteCustomer = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete customer "${name}"?`)) return;
    try {
      await api.deleteBillingCustomer(id);
      setCustomers(prev => prev.filter(c => c._id !== id));
      triggerPushNotification('🗑️ Customer Deleted', `Customer "${name}" deleted.`, 'info');
    } catch (err) {
      alert(err.message || 'Failed to delete customer');
    }
  };

  // Delete Item
  const handleDeleteItem = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete product "${name}"?`)) return;
    try {
      await api.deleteBillingItem(id);
      setItemsList(prev => prev.filter(i => i._id !== id));
      triggerPushNotification('🗑️ Product Deleted', `Product "${name}" deleted.`, 'info');
    } catch (err) {
      alert(err.message || 'Failed to delete product');
    }
  };

  // Modal State for Payments
  const [paymentModalInvoice, setPaymentModalInvoice] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Bank Transfer');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [submittingPay, setSubmittingPay] = useState(false);

  // New Customer Modal State
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [custForm, setCustForm] = useState({
    name: '', businessName: '', phone: '', email: '', gstin: '', billingAddress: '', state: 'Gujarat', stateCode: '24'
  });

  // New Item Modal State
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [itemForm, setItemForm] = useState({
    itemName: '', hsnCode: '998821', unitPrice: '', unit: 'Meters', taxRate: 5, category: 'Printing Services'
  });

  // ── INVOICE EDITOR STATE (myBillBook style) ──────────────────────────────
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNo: '',
    invoiceSeq: 1001,
    ourChallanNo: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    customer: {
      customerId: '',
      name: '',
      businessName: '',
      phone: '',
      email: '',
      gstin: '',
      billingAddress: '',
      shippingAddress: '',
      state: 'Gujarat',
      stateCode: '24'
    },
    items: [
      { itemName: 'Digital Printing Service (Fabric)', hsnCode: '998821', qty: 100, unit: 'Meters', unitPrice: 45, discountPct: 0, taxRate: 5, butterPaper: false, jobNo: '', lotNo: '', partyChallan: '', ourChallanNo: '', imageUrl: '', totalAmount: 4500 }
    ],
    isButterPaperUsed: false,
    enableRoundOff: true,
    discountType: 'flat',
    discountValue: 0,
    taxType: 'CGST_SGST', // 'CGST_SGST' or 'IGST'
    paidAmount: 0,
    notes: 'Thank you for doing business with Elite Digital Prints!',
    terms: 'Payment due within 30 days from invoice date. Subject to Surat jurisdiction.'
  });

  // ── Fetch Initial Data ─────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [sRes, iRes, cRes, itemRes] = await Promise.all([
        api.getBillingDashboardStats(),
        api.getBillingInvoices({ limit: 5000, search, paymentStatus: statusFilter }),
        api.getBillingCustomers(),
        api.getBillingItems()
      ]);

      if (sRes.data) setStats(sRes.data);
      if (iRes.data) setInvoices(iRes.data);
      if (cRes.data) setCustomers(cRes.data);
      if (itemRes.data) setItemsList(itemRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter]);

  // Auto-populate Invoice from Challan with Saved Customer Auto-Selection & Multi-Challan Merging
  const loadInvoiceFromChallan = async (chInput) => {
    if (!chInput) return;
    try {
      const challanList = Array.isArray(chInput) ? chInput : [chInput];
      if (challanList.length === 0) return;

      // MAX 10 CHALLANS LIMIT
      if (challanList.length > 10) {
        triggerEliteAlert('Too Many Challans', 'Maximum 10 Challans can be merged into a single Invoice. Please deselect some and try again.', 'error');
        return;
      }

      // 1. FLEXIBLE SAME-CUSTOMER VALIDATION CHECK
      const normalizeKey = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const customerKeys = new Set(challanList.map(c => typeof c === 'string' ? '' : normalizeKey(c.billTo || c.partyName)).filter(Boolean));
      const partyNameKeys = new Set(challanList.map(c => typeof c === 'string' ? '' : normalizeKey(c.partyName || c.billTo)).filter(Boolean));

      if (customerKeys.size > 1 && partyNameKeys.size > 1) {
        const partyList = [...new Set(challanList.map(c => typeof c === 'string' ? c : (c.billTo || c.partyName)).filter(Boolean))].join(', ');
        triggerEliteAlert('Customer Mismatch', `Cannot merge Challans from different customers. Selected Challans belong to multiple customers: ${partyList}`, 'error');
        return;
      }

      // 2. Call backend merge endpoint for complete aggregation & customer resolution
      const challanIds = challanList.map(c => (typeof c === 'string' ? c : (c._id || c.id))).filter(Boolean);
      const mergeRes = await api.mergeChallansToInvoice(challanIds);

      if (!mergeRes || !mergeRes.success || !mergeRes.data) {
        throw new Error(mergeRes?.error || 'Failed to merge selected Challans.');
      }

      const { customer: custData, items: mergedItems, linkedChallanIds, linkedChallanNos, deliveryBy: mergeDeliveryBy } = mergeRes.data;

      // Add isLocked flag to ensure MTR fields are read-only
      const lockedItems = (mergedItems || []).map(it => ({
        ...it,
        isLocked: true
      }));

      const nextRes = await api.getNextInvoiceNo();
      const cfg = await api.getPrintConfig().catch(() => ({}));
      const dueDays = cfg?.paymentDueDays || 30;
      const termsStr = cfg?.companyTerms || 'Payment due within 30 days from invoice date. Subject to Surat jurisdiction.';
      const challanTagStr = (linkedChallanNos || []).join(', ');

      setInvoiceForm({
        invoiceNo: nextRes.invoiceNo || 'EDP-INV-1001',
        invoiceSeq: nextRes.nextSeq || 1001,
        ourChallanNo: challanTagStr,
        deliveryBy: mergeDeliveryBy || '',
        linkedChallanIds: linkedChallanIds || [],
        linkedChallanNos: linkedChallanNos || [],
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + dueDays * 86400000).toISOString().split('T')[0],
        customer: custData,
        items: lockedItems,
        isButterPaperUsed: false,
        enableRoundOff: true,
        discountType: 'flat',
        discountValue: 0,
        taxType: custData.stateCode && custData.stateCode !== '24' ? 'IGST' : 'CGST_SGST',
        paidAmount: 0,
        notes: `Auto-generated from Delivery Challan(s): #${challanTagStr}`,
        terms: termsStr
      });

      setEditingInvoiceId(null);
      setActiveTab('create');
      triggerPushNotification('Challans Merged 🚚', `${challanList.length} Delivery Challan(s) successfully imported into Invoice Generator.`, 'success');
    } catch (e) {
      console.error('Error loading invoice from challan:', e);
      triggerEliteAlert('Import Error', e.message || 'Failed to import Challan(s)', 'error');
    }
  };

  useEffect(() => {
    if (initialChallanData) {
      loadInvoiceFromChallan(initialChallanData);
    }
  }, [initialChallanData]);

  // Load next invoice number when opening create tab
  const handleOpenCreateTab = async (invoiceToEdit = null) => {
    if (invoiceToEdit) {
      setEditingInvoiceId(invoiceToEdit._id);
      const cleanedItems = (invoiceToEdit.items || []).map(it => {
        let hsn = it.hsnCode;
        if (!hsn || hsn === '5407') {
          const matched = itemsList.find(cat => cat.itemName.trim().toLowerCase() === (it.itemName || '').trim().toLowerCase());
          hsn = matched?.hsnCode || '998821';
        }
        return { ...it, hsnCode: hsn };
      });
      setInvoiceForm({
        ...invoiceToEdit,
        items: cleanedItems,
        invoiceDate: invoiceToEdit.invoiceDate ? invoiceToEdit.invoiceDate.split('T')[0] : '',
        dueDate: invoiceToEdit.dueDate ? invoiceToEdit.dueDate.split('T')[0] : ''
      });
      setActiveTab('create');
    } else {
      setEditingInvoiceId(null);
      try {
        const nextRes = await api.getNextInvoiceNo();
        const cfg = await api.getPrintConfig().catch(() => ({}));
        const dueDays = cfg?.paymentDueDays || 30;
        const termsStr = cfg?.companyTerms || 'Payment due within 30 days from invoice date. Subject to Surat jurisdiction.';

        setInvoiceForm({
          invoiceNo: nextRes.invoiceNo || 'EDP-INV-1001',
          invoiceSeq: nextRes.nextSeq || 1001,
          invoiceDate: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + dueDays * 86400000).toISOString().split('T')[0],
          customer: customers[0] ? { ...customers[0] } : {
            customerId: '', name: 'Walk-in Client', businessName: '', phone: '', email: '', gstin: '', billingAddress: '', state: 'Gujarat', stateCode: '24'
          },
          items: [
            { itemName: 'Digital Printing Service (Fabric)', hsnCode: '998821', qty: 100, unit: 'Meters', unitPrice: 45, discountPct: 0, taxRate: 5, totalAmount: 4500 }
          ],
          discountType: 'flat',
          discountValue: 0,
          taxType: 'CGST_SGST',
          paidAmount: 0,
          notes: 'Thank you for doing business with Elite Digital Prints!',
          terms: termsStr
        });
        setActiveTab('create');
      } catch (err) {
        console.error('Failed to get next invoice number:', err);
      }
    }
  };

  // ── REAL-TIME INVOICE CALCULATIONS ──────────────────────────────────────
  const calculatedInvoice = useMemo(() => {
    let subtotal = 0;
    const updatedItems = invoiceForm.items.map(it => {
      const qty = parseFloat(it.qty) || 0;
      const basePrice = parseFloat(it.unitPrice) || 0;
      const effectivePrice = basePrice + (it.butterPaper ? 3 : 0);
      const discPct = parseFloat(it.discountPct) || 0;
      const baseTotal = qty * effectivePrice;
      const discAmt = (baseTotal * discPct) / 100;
      const itemTotal = baseTotal - discAmt;
      subtotal += itemTotal;
      return {
        ...it,
        effectivePrice,
        discountAmt: discAmt,
        totalAmount: itemTotal
      };
    });

    const discVal = parseFloat(invoiceForm.discountValue) || 0;
    let discountTotal = 0;
    if (invoiceForm.discountType === 'percentage') {
      discountTotal = (subtotal * discVal) / 100;
    } else {
      discountTotal = discVal;
    }

    const netSubtotal = Math.max(0, subtotal - discountTotal);

    // Calculate Tax based on items individual tax rates or 5% default
    const totalTax = updatedItems.reduce((sum, i) => {
      const taxable = i.totalAmount || 0;
      const rate = parseFloat(i.taxRate !== undefined && i.taxRate !== null ? i.taxRate : 5);
      return sum + (taxable * rate / 100);
    }, 0);

    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (invoiceForm.taxType === 'IGST') {
      igstAmount = totalTax;
    } else {
      cgstAmount = totalTax / 2;
      sgstAmount = totalTax / 2;
    }

    const rawGrandTotal = netSubtotal + totalTax;
    let grandTotal = rawGrandTotal;
    let roundOff = 0;

    if (invoiceForm.enableRoundOff !== false) {
      if (invoiceForm.manualRoundOff !== undefined && invoiceForm.manualRoundOff !== '') {
        // Manual override: use user-specified round off value
        roundOff = parseFloat(invoiceForm.manualRoundOff);
        grandTotal = parseFloat((rawGrandTotal + roundOff).toFixed(2));
      } else {
        // Auto round off
        grandTotal = Math.round(rawGrandTotal);
        roundOff = parseFloat((grandTotal - rawGrandTotal).toFixed(2));
      }
    } else {
      grandTotal = parseFloat(rawGrandTotal.toFixed(2));
      roundOff = 0;
    }

    const paid = parseFloat(invoiceForm.paidAmount) || 0;
    const balanceDue = Math.max(0, grandTotal - paid);

    return {
      items: updatedItems,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discountTotal: parseFloat(discountTotal.toFixed(2)),
      netSubtotal: parseFloat(netSubtotal.toFixed(2)),
      cgstAmount: parseFloat(cgstAmount.toFixed(2)),
      sgstAmount: parseFloat(sgstAmount.toFixed(2)),
      igstAmount: parseFloat(igstAmount.toFixed(2)),
      totalTax: parseFloat(totalTax.toFixed(2)),
      roundOff,
      rawGrandTotal: parseFloat(rawGrandTotal.toFixed(2)),
      grandTotal,
      balanceDue: parseFloat(balanceDue.toFixed(2))
    };
  }, [invoiceForm.items, invoiceForm.isButterPaperUsed, invoiceForm.enableRoundOff, invoiceForm.discountType, invoiceForm.discountValue, invoiceForm.taxType, invoiceForm.paidAmount]);

  // Handle Dynamic Line Item Change with HSN Auto-Sync
  const handleItemChange = async (index, field, value) => {
    const newItems = [...invoiceForm.items];
    newItems[index][field] = value;

    // If item selected from dropdown or typed, fill default metadata
    if (field === 'itemName') {
      const matched = itemsList.find(i => i.itemName.trim().toLowerCase() === value.trim().toLowerCase());
      if (matched) {
        newItems[index].hsnCode = matched.hsnCode || '998821';
        newItems[index].unitPrice = matched.unitPrice != null ? matched.unitPrice : newItems[index].unitPrice;
        newItems[index].unit = matched.unit || 'Meters';
        newItems[index].taxRate = matched.taxRate != null ? matched.taxRate : 5;
      }
    }

    // Failsafe: if HSN is 5407 or empty, correct to product catalog HSN or 998821
    if (newItems[index].hsnCode === '5407' || !newItems[index].hsnCode) {
      const matched = itemsList.find(i => i.itemName.trim().toLowerCase() === (newItems[index].itemName || '').trim().toLowerCase());
      newItems[index].hsnCode = matched?.hsnCode || '998821';
    }

    // HSN Code Change Auto-Sync to Saved Product
    if (field === 'hsnCode' && newItems[index].itemName) {
      const matched = itemsList.find(i => i.itemName.trim().toLowerCase() === newItems[index].itemName.trim().toLowerCase());
      if (matched && matched._id) {
        try {
          await api.updateBillingItem(matched._id, { ...matched, hsnCode: value });
          setItemsList(prev => prev.map(i => i._id === matched._id ? { ...i, hsnCode: value } : i));
        } catch (e) {
          console.warn('HSN sync error:', e);
        }
      }
    }

    setInvoiceForm(prev => ({ ...prev, items: newItems }));
  };

  const handleAddItemRow = () => {
    setInvoiceForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { itemName: '', hsnCode: '998821', qty: 1, unit: 'Meters', unitPrice: 0, discountPct: 0, taxRate: 5, totalAmount: 0 }
      ]
    }));
  };

  const handleRemoveItemRow = (index) => {
    if (invoiceForm.items.length === 1) return;
    setInvoiceForm(prev => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index)
    }));
  };

  const handleCustomerSelect = (custName) => {
    const matched = customers.find(c => c.name === custName || c.businessName === custName);
    if (matched) {
      setInvoiceForm(prev => ({
        ...prev,
        customer: {
          customerId: matched._id,
          name: matched.name,
          businessName: matched.businessName || '',
          phone: matched.phone || '',
          email: matched.email || '',
          gstin: matched.gstin || '',
          billingAddress: matched.billingAddress || '',
          shippingAddress: matched.shippingAddress || matched.billingAddress || '',
          state: matched.state || 'Gujarat',
          stateCode: matched.stateCode || '24'
        },
        taxType: matched.stateCode && matched.stateCode !== '24' ? 'IGST' : 'CGST_SGST'
      }));
    }
  };

  // Submit Invoice Handler
  const handleSaveInvoice = async () => {
    setLoading(true);
    try {
      // Strip UI-only fields and build clean payload
      const { manualRoundOff, ...formRest } = invoiceForm;
      const payload = {
        ...formRest,
        items: calculatedInvoice.items,
        subtotal: calculatedInvoice.subtotal,
        discountTotal: calculatedInvoice.discountTotal,
        cgstAmount: calculatedInvoice.cgstAmount,
        sgstAmount: calculatedInvoice.sgstAmount,
        igstAmount: calculatedInvoice.igstAmount,
        totalTax: calculatedInvoice.totalTax,
        roundOff: calculatedInvoice.roundOff,
        grandTotal: calculatedInvoice.grandTotal,
        balanceDue: calculatedInvoice.balanceDue
      };

      // Guard against NaN values that would fail DB save
      if (!payload.grandTotal || isNaN(payload.grandTotal)) {
        alert('Grand Total is invalid. Please check item prices and quantities.');
        setLoading(false);
        return;
      }

      if (editingInvoiceId) {
        await api.updateBillingInvoice(editingInvoiceId, payload);
      } else {
        const createRes = await api.createBillingInvoice(payload);
        const invNoStr = createRes?.data?.invoiceNo || payload.invoiceNo || 'INV';
        dispatchScreenGroupEvent('jobcards_billing', 'New Tax Invoice Generated 🧾', `Invoice #${invNoStr} for ${payload.customerName || 'Customer'} (₹${Number(payload.grandTotal || 0).toLocaleString('en-IN')}) generated & dispatched to Billing Group.`, 'invoices');
      }

      alert(`Invoice ${editingInvoiceId ? 'updated' : 'created'} successfully!`);
      await loadData();
      setActiveTab('invoices');
    } catch (err) {
      alert(err.message || 'Failed to save invoice');
    } finally {
      setLoading(false);
    }
  };

  // Delete Invoice
  const handleDeleteInvoice = async (id, invNo) => {
    if (!window.confirm(`Delete Invoice "${invNo}"?`)) return;
    try {
      await api.deleteBillingInvoice(id);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to delete invoice');
    }
  };

  // Record Payment
  const handleSavePayment = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }
    setSubmittingPay(true);
    try {
      await api.recordInvoicePayment(paymentModalInvoice._id, {
        amount: parseFloat(payAmount),
        method: payMethod,
        referenceNo: payRef,
        notes: payNotes
      });
      alert('Payment recorded successfully!');
      setPaymentModalInvoice(null);
      setPayAmount('');
      setPayRef('');
      setPayNotes('');
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to record payment');
    } finally {
      setSubmittingPay(false);
    }
  };

  // Create / Update Customer Handler
  const handleSaveCustomer = async () => {
    if (!custForm.name) {
      alert('Customer Name is required');
      return;
    }
    try {
      if (editingCustomerId) {
        const res = await api.updateBillingCustomer(editingCustomerId, custForm);
        setCustomers(prev => prev.map(c => c._id === editingCustomerId ? res.data : c));
        triggerPushNotification('✏️ Customer Updated', `Customer "${custForm.name}" updated.`, 'success');
      } else {
        const res = await api.createBillingCustomer(custForm);
        setCustomers(prev => [...prev, res.data]);
        triggerPushNotification('👥 Customer Created', `Customer "${custForm.name}" registered.`, 'success');
      }
      setShowCustomerModal(false);
      setEditingCustomerId(null);
      setCustForm({ name: '', businessName: '', phone: '', email: '', gstin: '', billingAddress: '', state: 'Gujarat', stateCode: '24' });
    } catch (err) {
      alert(err.message || 'Failed to save customer');
    }
  };

  const handleEditCustomer = (c) => {
    setEditingCustomerId(c._id);
    setCustForm({
      name: c.name || '',
      businessName: c.businessName || '',
      phone: c.phone || '',
      email: c.email || '',
      gstin: c.gstin || '',
      billingAddress: c.billingAddress || '',
      state: c.state || 'Gujarat',
      stateCode: c.stateCode || '24'
    });
    setShowCustomerModal(true);
  };

  // Create / Update Item Handler
  const handleSaveItem = async () => {
    if (!itemForm.itemName || !itemForm.unitPrice) {
      alert('Item Name and Price are required');
      return;
    }
    try {
      if (editingItemId) {
        const res = await api.updateBillingItem(editingItemId, itemForm);
        setItemsList(prev => prev.map(i => i._id === editingItemId ? res.data : i));
        triggerPushNotification('✏️ Product Updated', `Product "${itemForm.itemName}" updated.`, 'success');
      } else {
        const res = await api.createBillingItem(itemForm);
        setItemsList(prev => [...prev, res.data]);
        triggerPushNotification('📦 Product Created', `Product "${itemForm.itemName}" cataloged.`, 'success');
      }
      setShowItemModal(false);
      setEditingItemId(null);
      setItemForm({ itemName: '', hsnCode: '998821', unitPrice: '', unit: 'Meters', taxRate: 5, category: 'Printing Services' });
    } catch (err) {
      alert(err.message || 'Failed to save product');
    }
  };
  const handleEditItem = (item) => {
    setEditingItemId(item._id);
    setItemForm({
      itemName: item.itemName || '',
      hsnCode: item.hsnCode || '998821',
      unitPrice: item.unitPrice != null ? item.unitPrice : '',
      unit: item.unit || 'Meters',
      taxRate: item.taxRate != null ? item.taxRate : 5,
      category: item.category || 'Printing Services'
    });
    setShowItemModal(true);
  };

  const handleOpenCreateChallan = () => {
    setActiveTab('challans');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-new-challan'));
    }, 50);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── TOP BANNER ──────────────────────────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={22} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Billing & Invoicing Department</h2>
                <ScreenGroupRoster screenId="jobcards_billing" />
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>
                Elite Digital Prints — Cloud Accounting & GST Invoicing System
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn-primary"
              onClick={() => setShowLedgerModal(true)}
              style={{ padding: '0.55rem 1.25rem', background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)', fontWeight: 800 }}
            >
              <BookOpen size={16} /> Ledger Reports
            </button>
            <button
              className="btn-primary"
              onClick={() => handleOpenCreateTab()}
              style={{ padding: '0.55rem 1.25rem', background: 'linear-gradient(135deg,#7c3aed,#6366f1)', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)', fontWeight: 800 }}
            >
              <PlusCircle size={16} /> Create Invoice
            </button>
            <button
              className="btn-primary"
              onClick={handleOpenCreateChallan}
              style={{ padding: '0.55rem 1.25rem', background: 'linear-gradient(135deg,#0284c7,#2563eb)', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)', fontWeight: 800 }}
            >
              <Truck size={16} /> Create Challan
            </button>
          </div>
        </div>

        {/* Sub-Tabs Bar */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.2rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.8rem', overflowX: 'auto' }}>
          {[
            { id: 'challans', label: '🚚 Challan' },
            { id: 'invoices', label: '🧾 Invoices Directory', count: stats.totalInvoices },
            ...(activeTab === 'create' ? [{ id: 'create', label: editingInvoiceId ? '✍️ Edit Invoice' : '✍️ New Invoice Generator' }] : []),
            { id: 'customers', label: `👥 Customers (${customers.length})` },
            { id: 'items', label: `📦 Item (${itemsList.length})` }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '0.5rem 1.1rem',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                border: '1px solid',
                borderColor: activeTab === t.id ? '#7c3aed' : 'var(--border-light)',
                background: activeTab === t.id ? 'rgba(124,58,237,0.18)' : 'transparent',
                color: activeTab === t.id ? '#a78bfa' : 'var(--text-muted)',
                transition: 'all 0.15s'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── DATE FILTER & KPI CARDS BAR (Displayed on Invoices Directory) ──────── */}
      {activeTab === 'invoices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', padding: '0.2rem 0.1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              <Calendar size={17} color="#a78bfa" />
              <span>Reporting Period:</span>
              <span style={{ fontSize: '0.78rem', color: '#a78bfa', fontWeight: 600 }}>({activeRange.labelText})</span>
            </div>

            {/* Date Range Preset Selector Component */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                type="button"
                onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.5rem 1.1rem',
                  borderRadius: '8px',
                  border: '1.5px solid #a78bfa',
                  background: 'var(--panel-bg, #1e1b4b)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(124, 58, 237, 0.25)',
                  transition: 'all 0.2s'
                }}
              >
                <Calendar size={16} color="#a78bfa" />
                <span>{PRESET_OPTIONS.find(p => p.id === datePreset)?.name || 'This Month'}</span>
                <Calendar size={16} color="#a78bfa" />
              </button>

              {isDateDropdownOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                    onClick={() => setIsDateDropdownOpen(false)}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      right: 0,
                      width: '380px',
                      maxHeight: '400px',
                      overflowY: 'auto',
                      background: '#ffffff',
                      color: '#1e293b',
                      borderRadius: '10px',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
                      border: '1px solid #cbd5e1',
                      zIndex: 999,
                      padding: '0.35rem 0'
                    }}
                  >
                    {PRESET_OPTIONS.map(opt => {
                      const rangeInfo = getDatePresetRange(opt.id, customDateStart, customDateEnd);
                      const isSelected = datePreset === opt.id;
                      return (
                        <div
                          key={opt.id}
                          onClick={() => {
                            setDatePreset(opt.id);
                            if (opt.id !== 'custom') setIsDateDropdownOpen(false);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justify: 'space-between',
                            padding: '0.65rem 1rem',
                            cursor: 'pointer',
                            background: isSelected ? '#f1f5f9' : 'transparent',
                            borderBottom: '1px solid #f1f5f9',
                            fontSize: '0.84rem',
                            transition: 'background 0.15s'
                          }}
                        >
                          <span style={{ fontWeight: isSelected ? 700 : 500, color: isSelected ? '#4338ca' : '#334155' }}>
                            {opt.name}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: '0.78rem', color: isSelected ? '#1e1b4b' : '#64748b' }}>
                            {rangeInfo.labelText}
                          </span>
                        </div>
                      );
                    })}

                    {datePreset === 'custom' && (
                      <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          <div>
                            <label style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>From</label>
                            <input type="date" value={customDateStart} onChange={e => setCustomDateStart(e.target.value)} style={{ width: '100%', padding: '0.3rem', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>To</label>
                            <input type="date" value={customDateEnd} onChange={e => setCustomDateEnd(e.target.value)} style={{ width: '100%', padding: '0.3rem', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                          </div>
                        </div>
                        <button
                          onClick={() => setIsDateDropdownOpen(false)}
                          style={{ padding: '0.4rem', background: '#4338ca', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Apply Custom Range
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* KPI CARDS GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1.1rem', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Invoiced</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{fmtINR(periodStats.totalInvoiced)}</div>
              <div style={{ fontSize: '0.72rem', color: '#3b82f6', marginTop: 4 }}>{periodStats.totalInvoices} Invoices Generated</div>
            </div>

            <div className="glass-panel" style={{ padding: '1.1rem', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Received (Paid)</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#34d399', marginTop: 4 }}>{fmtINR(periodStats.totalPaid)}</div>
              <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: 4 }}>{periodStats.paidCount} Fully Paid Invoices</div>
            </div>

            <div className="glass-panel" style={{ padding: '1.1rem', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Pending Receivables</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fbbf24', marginTop: 4 }}>{fmtINR(periodStats.totalBalanceDue)}</div>
              <div style={{ fontSize: '0.72rem', color: '#f59e0b', marginTop: 4 }}>{periodStats.unpaidCount} Pending / Partial</div>
            </div>

            <div className="glass-panel" style={{ padding: '1.1rem', borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Overdue Invoices</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f87171', marginTop: 4 }}>{periodStats.overdueCount}</div>
              <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: 4 }}>Payment Date Passed</div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 1: INVOICES DIRECTORY ───────────────────────────────────────── */}
      {activeTab === 'invoices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Search & Status Filters */}
          <div className="glass-panel" style={{ padding: '0.85rem 1.25rem', display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search Invoice No, Customer Name, Phone..."
                style={{ paddingLeft: 32, width: '100%', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {['ALL', 'UNPAID', 'PARTIALLY_PAID', 'PAID'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    border: '1px solid',
                    borderColor: statusFilter === st ? '#7c3aed' : 'var(--border-light)',
                    background: statusFilter === st ? 'rgba(124,58,237,0.15)' : 'transparent',
                    color: statusFilter === st ? '#a78bfa' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {st}
                </button>
              ))}
            </div>

            <button onClick={loadData} className="btn-icon" title="Refresh">
              <RefreshCw size={14} className={loading ? 'spin-loader' : ''} />
            </button>
          </div>

          {/* Bulk Invoices Selection Action Bar */}
          {selectedInvoiceIds.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 1.1rem', background: 'rgba(124, 58, 237, 0.18)', border: '1px solid #7c3aed', borderRadius: '10px', boxShadow: '0 4px 14px rgba(124, 58, 237, 0.25)' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={16} color="#a78bfa" />
                <span>{selectedInvoiceIds.length} Invoice{selectedInvoiceIds.length > 1 ? 's' : ''} Selected for Bulk PDF Download</span>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  onClick={handleBulkDownloadInvoices}
                  disabled={bulkDownloading}
                  className="btn-primary"
                  style={{ padding: '0.45rem 1.1rem', fontSize: '0.82rem', background: 'linear-gradient(135deg, #7c3aed, #6366f1)', border: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Download size={15} className={bulkDownloading ? 'spin-loader' : ''} />
                  {bulkDownloading ? 'Downloading Invoices...' : `Download ${selectedInvoiceIds.length} PDF${selectedInvoiceIds.length > 1 ? 's' : ''}`}
                </button>
                <button
                  onClick={() => setSelectedInvoiceIds([])}
                  className="btn-secondary"
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Invoices Table */}
          <div className="glass-panel" style={{ overflowX: 'auto', padding: 0 }}>
            {(() => {
              const displayedInvoices = periodInvoices.filter(inv => matchSearchQuery(inv, search, [
                'invoiceNo', 'ourChallanNo', 'challanNo', 'orderNo', 'dispatchDocNo',
                'customer.name', 'customer.businessName', 'customer.phone', 'customer.gstin',
                'items.itemName', 'items.jobNo', 'items.lotNo', 'items.partyChallan', 'items.ourChallanNo', 'items.hsnCode'
              ]));
              return (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.02)' }}>
                      <th style={{ padding: '0.75rem 0.5rem', width: '42px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={displayedInvoices.length > 0 && displayedInvoices.every(i => selectedInvoiceIds.includes(i._id))}
                          onChange={() => handleToggleSelectAllInvoices(displayedInvoices)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#7c3aed' }}
                          title="Select All Invoices"
                        />
                      </th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Invoice No</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Challan No</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Customer Name</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Grand Total</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Paid Amount</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Balance Due</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No invoices found for the selected date range ({activeRange.labelText}).
                        </td>
                      </tr>
                    ) : (
                      displayedInvoices.map(inv => (
                        <tr key={inv._id} style={{ borderBottom: '1px solid var(--border-light)', background: selectedInvoiceIds.includes(inv._id) ? 'rgba(124, 58, 237, 0.08)' : 'transparent' }}>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={selectedInvoiceIds.includes(inv._id)}
                              onChange={() => handleToggleSelectInvoice(inv._id)}
                              style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#7c3aed' }}
                            />
                          </td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 800, color: '#a78bfa' }}>
                          <button
                            onClick={() => setViewInvoiceModal(inv)}
                            style={{ background: 'none', border: 'none', color: '#a78bfa', fontWeight: 800, cursor: 'pointer', padding: 0, textDecoration: 'underline', outline: 'none' }}
                          >
                            {inv.invoiceNo}
                          </button>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#60a5fa', fontWeight: 700 }}>
                          {inv.ourChallanNo || (Array.isArray(inv.linkedChallanNos) && inv.linkedChallanNos.length > 0 ? inv.linkedChallanNos.join(', ') : '') || (inv.items && inv.items.map(i => i.ourChallanNo || i.partyChallan).filter(Boolean).join(', ')) || '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                          <div style={{ fontWeight: 700 }}>{inv.customer?.businessName || inv.customer?.name || '—'}</div>
                          {inv.customer?.gstin && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>GSTIN: {inv.customer.gstin}</div>}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                          {formatDateDDMMYYYY(inv.invoiceDate)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {fmtINR(inv.grandTotal)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#34d399', fontWeight: 700 }}>
                          {fmtINR(inv.paidAmount)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: inv.balanceDue > 0 ? '#f87171' : 'var(--text-muted)', fontWeight: 700 }}>
                          {fmtINR(inv.balanceDue)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: 6,
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            background: inv.paymentStatus === 'PAID' ? 'rgba(16,185,129,0.15)' : inv.paymentStatus === 'PARTIALLY_PAID' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                            color: inv.paymentStatus === 'PAID' ? '#34d399' : inv.paymentStatus === 'PARTIALLY_PAID' ? '#fbbf24' : '#f87171',
                            border: `1px solid ${inv.paymentStatus === 'PAID' ? 'rgba(16,185,129,0.3)' : inv.paymentStatus === 'PARTIALLY_PAID' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`
                          }}>
                            {inv.paymentStatus}
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                            <button onClick={() => setViewInvoiceModal(inv)} className="btn-icon" title="View Tax Invoice Details">
                              <Eye size={14} color="#38bdf8" />
                            </button>
                            <button onClick={() => openPdfDialog(inv)} className="btn-icon" title="Download GST PDF">
                              <Download size={14} color="#a78bfa" />
                            </button>
                            {inv.balanceDue > 0 && (
                              <button onClick={() => { setPaymentModalInvoice(inv); setPayAmount(inv.balanceDue); }} className="btn-icon" title="Record Payment">
                                <CreditCard size={14} color="#34d399" />
                              </button>
                            )}
                            <button onClick={() => handleOpenCreateTab(inv)} className="btn-icon" title="Edit Invoice">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => handleDeleteInvoice(inv._id, inv.invoiceNo)} className="btn-icon" title="Delete Invoice">
                              <Trash2 size={14} color="#f87171" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          );
        })()}
      </div>
        </div>
      )}

      {/* ── TAB: DELIVERY CHALLANS HUB ─────────────────────────────────────── */}
      {activeTab === 'challans' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {department === 'stitching' ? (
            <StitchingChallanPanel
              onNavigateToBilling={(ch) => {
                loadInvoiceFromChallan(ch);
                setActiveTab('create');
              }}
            />
          ) : (
            <FabricInventoryPanel
              department="digital_print"
              onlyChallan={true}
              onNavigateToBilling={(ch) => {
                loadInvoiceFromChallan(ch);
                setActiveTab('create');
              }}
            />
          )}
        </div>
      )}

      {/* ── TAB 2: INVOICE GENERATOR / EDITOR (myBillBook style) ────────────── */}
      {activeTab === 'create' && (
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.8rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {editingInvoiceId ? `Edit Invoice — ${invoiceForm.invoiceNo}` : 'New GST Tax Invoice Generator'}
            </h3>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="btn-secondary" onClick={() => setActiveTab('invoices')}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveInvoice} disabled={loading} style={{ background: 'linear-gradient(135deg,#7c3aed,#6366f1)' }}>
                {loading ? 'Saving...' : editingInvoiceId ? 'Update Invoice' : 'Save & Issue Invoice'}
              </button>
            </div>
          </div>

          {/* Core Metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Invoice No. *</label>
              <input
                type="text"
                value={invoiceForm.invoiceNo}
                onChange={e => setInvoiceForm(f => ({ ...f, invoiceNo: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Challan No.</label>
              <input
                type="text"
                value={invoiceForm.ourChallanNo || ''}
                onChange={e => setInvoiceForm(f => ({ ...f, ourChallanNo: e.target.value }))}
                placeholder="e.g. EDP-101"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Invoice Date *</label>
              <input
                type="date"
                value={invoiceForm.invoiceDate}
                onChange={e => setInvoiceForm(f => ({ ...f, invoiceDate: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Due Date</label>
              <input
                type="date"
                value={invoiceForm.dueDate}
                onChange={e => setInvoiceForm(f => ({ ...f, dueDate: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ ...labelStyle, color: '#a78bfa', fontWeight: 800 }}>⚡ GST Tax Type (Dynamic)</label>
              <select
                value={invoiceForm.taxType}
                onChange={e => setInvoiceForm(f => ({ ...f, taxType: e.target.value }))}
                style={{
                  ...inputStyle,
                  fontWeight: '700',
                  color: '#a78bfa',
                  background: 'rgba(124, 58, 237, 0.15)',
                  border: '1px solid rgba(167, 139, 250, 0.5)'
                }}
              >
                <option value="CGST_SGST">Intra-State (CGST + SGST)</option>
                <option value="IGST">Inter-State (IGST)</option>
              </select>
            </div>
          </div>

          {/* Customer Selection */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>🏢 Billed To (Customer Details)</div>
              <button type="button" onClick={() => setShowCustomerModal(true)} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}>
                + Add New Customer
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem' }}>
              <div>
                <label style={labelStyle}>Select Saved Customer</label>
                <select
                  onChange={e => handleCustomerSelect(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map(c => (
                    <option key={c._id} value={c.name}>{c.businessName ? `${c.businessName} (${c.name})` : c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Customer / Party Name *</label>
                <input
                  type="text"
                  value={invoiceForm.customer.name}
                  onChange={e => setInvoiceForm(f => ({ ...f, customer: { ...f.customer, name: e.target.value } }))}
                  style={inputStyle}
                  placeholder="e.g. Acme Prints Ltd."
                />
              </div>

              <div>
                <label style={labelStyle}>GSTIN Number</label>
                <input
                  type="text"
                  value={invoiceForm.customer.gstin}
                  onChange={e => setInvoiceForm(f => ({ ...f, customer: { ...f.customer, gstin: e.target.value } }))}
                  style={inputStyle}
                  placeholder="e.g. 24AAAFE1234F1Z5"
                />
              </div>

              <div>
                <label style={labelStyle}>Billing Address</label>
                <input
                  type="text"
                  value={invoiceForm.customer.billingAddress}
                  onChange={e => setInvoiceForm(f => ({ ...f, customer: { ...f.customer, billingAddress: e.target.value } }))}
                  style={inputStyle}
                  placeholder="Street / Area / City"
                />
              </div>
            </div>
          </div>

          {/* Dynamic Products / Line Items Table */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '1rem', overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>📦 Invoice Line Items</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', cursor: 'pointer', background: 'rgba(251,191,36,0.12)', padding: '0.3rem 0.65rem', borderRadius: '5px', border: '1px solid rgba(251,191,36,0.3)' }}>
                  <input
                    type="checkbox"
                    checked={invoiceForm.items.length > 0 && invoiceForm.items.every(it => it.butterPaper)}
                    ref={el => { if (el) el.indeterminate = invoiceForm.items.some(it => it.butterPaper) && !invoiceForm.items.every(it => it.butterPaper); }}
                    onChange={e => {
                      const checked = e.target.checked;
                      setInvoiceForm(f => ({
                        ...f,
                        isButterPaperUsed: checked,
                        items: f.items.map(item => ({ ...item, butterPaper: checked }))
                      }));
                    }}
                  />
                  🧈 Butter Paper Used (+ ₹3/m Rate)
                </label>
                <button type="button" onClick={handleAddItemRow} className="btn-secondary" style={{ padding: '0.35rem 0.8rem', fontSize: '0.75rem' }}>
                  <Plus size={13} /> Add Item Row
                </button>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '920px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.5rem' }}>Item Description & Details</th>
                  <th style={{ padding: '0.5rem', width: '90px' }}>HSN</th>
                  <th style={{ padding: '0.5rem', width: '80px' }}>Qty</th>
                  <th style={{ padding: '0.5rem', width: '90px' }}>Unit</th>
                  <th style={{ padding: '0.5rem', width: '100px' }}>Price (₹)</th>
                  <th style={{ padding: '0.5rem', width: '65px', textAlign: 'center' }}>🧈 Butter</th>
                  <th style={{ padding: '0.5rem', width: '75px' }}>Disc %</th>
                  <th style={{ padding: '0.5rem', width: '75px' }}>GST %</th>
                  <th style={{ padding: '0.5rem', width: '105px', textAlign: 'right' }}>Total (₹)</th>
                  <th style={{ padding: '0.5rem', width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {calculatedInvoice.items.map((it, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)', verticalAlign: 'top' }}>
                    <td style={{ padding: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        {it.imageUrl && (
                          <img src={it.imageUrl} alt="Design" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover', border: '1px solid var(--border-light)' }} />
                        )}
                        <input
                          type="text"
                          list={`items-list-${idx}`}
                          value={it.itemName}
                          onChange={e => handleItemChange(idx, 'itemName', e.target.value)}
                          placeholder="Type item or select..."
                          style={inputStyle}
                        />
                        <datalist id={`items-list-${idx}`}>
                          {itemsList.map(item => <option key={item._id} value={item.itemName} />)}
                        </datalist>
                      </div>

                      {/* Sub-inputs: Job No, Lot No, Party Challan, Our Challan, Image URL */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1.5fr', gap: '0.3rem' }}>
                        <input
                          type="text"
                          value={it.jobNo || ''}
                          onChange={e => handleItemChange(idx, 'jobNo', e.target.value)}
                          placeholder="Job Card"
                          style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}
                        />
                        <input
                          type="text"
                          value={it.lotNo || ''}
                          onChange={e => handleItemChange(idx, 'lotNo', e.target.value)}
                          placeholder="Lot No"
                          style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}
                        />
                        <input
                          type="text"
                          value={it.partyChallan || ''}
                          onChange={e => handleItemChange(idx, 'partyChallan', e.target.value)}
                          placeholder="Vendor Challan"
                          style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}
                        />
                        <input
                          type="text"
                          value={it.ourChallanNo || ''}
                          onChange={e => handleItemChange(idx, 'ourChallanNo', e.target.value)}
                          placeholder="Challan"
                          style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}
                        />
                        <input
                          type="text"
                          value={it.imageUrl || ''}
                          onChange={e => handleItemChange(idx, 'imageUrl', e.target.value)}
                          placeholder="Design Image Link..."
                          style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}
                        />
                      </div>
                    </td>
                    <td style={{ padding: '0.4rem' }}>
                      <input
                        type="text"
                        value={it.hsnCode}
                        onChange={e => handleItemChange(idx, 'hsnCode', e.target.value)}
                        style={inputStyle}
                      />
                    </td>
                    <td style={{ padding: '0.4rem' }}>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type="number"
                          value={it.qty}
                          readOnly={it.isLocked}
                          onChange={e => handleItemChange(idx, 'qty', e.target.value)}
                          style={{
                            ...inputStyle,
                            backgroundColor: it.isLocked ? 'rgba(255,255,255,0.06)' : undefined,
                            cursor: it.isLocked ? 'not-allowed' : 'text',
                            borderColor: it.isLocked ? 'rgba(251,191,36,0.35)' : undefined
                          }}
                        />
                        {it.isLocked && (
                          <Lock size={12} style={{ position: 'absolute', right: 6, color: '#fbbf24', pointerEvents: 'none' }} title="Metres / Qty locked from Delivery Challan" />
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.4rem' }}>
                      <select
                        value={it.unit}
                        onChange={e => handleItemChange(idx, 'unit', e.target.value)}
                        style={inputStyle}
                      >
                        <option value="Meters">Meters</option>
                        <option value="Pcs">Pcs</option>
                        <option value="Rolls">Rolls</option>
                        <option value="Hours">Hours</option>
                      </select>
                    </td>
                    <td style={{ padding: '0.4rem' }}>
                      <input
                        type="number"
                        value={it.unitPrice}
                        onChange={e => handleItemChange(idx, 'unitPrice', e.target.value)}
                        style={inputStyle}
                      />
                      {it.butterPaper && (
                        <span style={{ fontSize: '0.62rem', color: '#fbbf24', fontWeight: 700, display: 'block', textAlign: 'center', marginTop: '2px' }}>
                          Eff: ₹{(parseFloat(it.unitPrice || 0) + 3).toFixed(2)}
                        </span>
                      )}
                    </td>
                    {/* Per-item Butter Paper Toggle */}
                    <td style={{ padding: '0.4rem', textAlign: 'center', verticalAlign: 'middle' }}>
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }} title="Toggle Butter Paper (+₹3/m)">
                        <input
                          type="checkbox"
                          checked={!!it.butterPaper}
                          onChange={e => {
                            const checked = e.target.checked;
                            setInvoiceForm(f => ({
                              ...f,
                              items: f.items.map((item, i) => i === idx ? { ...item, butterPaper: checked } : item)
                            }));
                          }}
                          style={{ cursor: 'pointer', width: 14, height: 14 }}
                        />
                        <span style={{ fontSize: '0.6rem', color: it.butterPaper ? '#fbbf24' : 'var(--text-muted)', fontWeight: 700 }}>
                          {it.butterPaper ? '+₹3' : 'None'}
                        </span>
                      </label>
                    </td>
                    <td style={{ padding: '0.4rem' }}>
                      <input
                        type="number"
                        value={it.discountPct}
                        onChange={e => handleItemChange(idx, 'discountPct', e.target.value)}
                        style={inputStyle}
                      />
                    </td>
                    <td style={{ padding: '0.4rem' }}>
                      <select
                        value={it.taxRate}
                        onChange={e => handleItemChange(idx, 'taxRate', e.target.value)}
                        style={inputStyle}
                      >
                        <option value={0}>0%</option>
                        <option value={5}>5%</option>
                        <option value={12}>12%</option>
                        <option value={18}>18%</option>
                        <option value={28}>28%</option>
                      </select>
                    </td>
                    <td style={{ padding: '0.4rem', textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)' }}>
                      ₹ {(it.totalAmount || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                      <button type="button" onClick={() => handleRemoveItemRow(idx)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Summary & Tax Breakdown Box */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div>
                <label style={labelStyle}>Notes for Customer</label>
                <textarea
                  rows={2}
                  value={invoiceForm.notes}
                  onChange={e => setInvoiceForm(f => ({ ...f, notes: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Terms & Conditions</label>
                <textarea
                  rows={2}
                  value={invoiceForm.terms}
                  onChange={e => setInvoiceForm(f => ({ ...f, terms: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.1rem', background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.25)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>
                <span style={{ fontWeight: 700 }}>₹ {calculatedInvoice.subtotal.toFixed(2)}</span>
              </div>

              {calculatedInvoice.discountTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#34d399' }}>
                  <span>Discount:</span>
                  <span>- ₹ {calculatedInvoice.discountTotal.toFixed(2)}</span>
                </div>
              )}

              {invoiceForm.taxType === 'IGST' ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    IGST Tax ({calculatedInvoice.netSubtotal > 0 ? ((calculatedInvoice.totalTax / calculatedInvoice.netSubtotal) * 100).toFixed(1) : 5}%):
                  </span>
                  <span>₹ {calculatedInvoice.igstAmount.toFixed(2)}</span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      CGST Tax ({calculatedInvoice.netSubtotal > 0 ? ((calculatedInvoice.totalTax / calculatedInvoice.netSubtotal / 2) * 100).toFixed(1) : 2.5}%):
                    </span>
                    <span>₹ {calculatedInvoice.cgstAmount.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      SGST Tax ({calculatedInvoice.netSubtotal > 0 ? ((calculatedInvoice.totalTax / calculatedInvoice.netSubtotal / 2) * 100).toFixed(1) : 2.5}%):
                    </span>
                    <span>₹ {calculatedInvoice.sgstAmount.toFixed(2)}</span>
                  </div>
                </>
              )}

              {/* Round Off Checkbox & Editable Value */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: '#a78bfa', marginTop: '0.2rem', paddingTop: '0.2rem', borderTop: '1px dashed var(--border-light)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={invoiceForm.enableRoundOff !== false}
                    onChange={e => setInvoiceForm(f => ({ ...f, enableRoundOff: e.target.checked, manualRoundOff: undefined }))}
                  />
                  Round Off Total
                </label>
                <input
                  type="number"
                  step="0.01"
                  disabled={invoiceForm.enableRoundOff === false}
                  value={invoiceForm.manualRoundOff !== undefined ? invoiceForm.manualRoundOff : calculatedInvoice.roundOff}
                  onChange={e => setInvoiceForm(f => ({ ...f, manualRoundOff: e.target.value === '' ? undefined : parseFloat(e.target.value), enableRoundOff: true }))}
                  onBlur={e => { if (e.target.value === '') setInvoiceForm(f => ({ ...f, manualRoundOff: undefined })); }}
                  style={{ width: '90px', padding: '0.25rem 0.5rem', fontSize: '0.85rem', fontWeight: 700, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '5px', color: '#a78bfa', textAlign: 'right' }}
                  title="Auto-calculated. Edit to set manually."
                />
              </div>

              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800, color: '#a78bfa' }}>
                <span>Grand Total:</span>
                <span>₹ {calculatedInvoice.grandTotal.toFixed(2)}</span>
              </div>

              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.2rem' }}>
                Amount in Words: {numToWords(calculatedInvoice.grandTotal)}
              </div>

              <div style={{ marginTop: '0.8rem', paddingTop: '0.6rem', borderTop: '1px dashed var(--border-light)', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Advance / Paid (₹)</label>
                  <input
                    type="number"
                    value={invoiceForm.paidAmount}
                    onChange={e => setInvoiceForm(f => ({ ...f, paidAmount: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>BALANCE DUE</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: calculatedInvoice.balanceDue > 0 ? '#f87171' : '#34d399' }}>
                    ₹ {calculatedInvoice.balanceDue.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── TAB 3: FINANCIAL SUMMARY / DASHBOARD ────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>
              📊 Payment Collection & Revenue Progress
            </h3>

            {/* Collection Progress Bar */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', borderRadius: 8, padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Payment Collection Rate:</span>
                <span style={{ color: '#34d399' }}>
                  {stats.totalInvoiced > 0 ? ((stats.totalPaid / stats.totalInvoiced) * 100).toFixed(1) : 0}% Collected
                </span>
              </div>

              <div style={{ height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 5, overflow: 'hidden', display: 'flex' }}>
                <div style={{
                  height: '100%',
                  width: `${stats.totalInvoiced > 0 ? (stats.totalPaid / stats.totalInvoiced) * 100 : 0}%`,
                  background: 'linear-gradient(90deg, #10b981, #34d399)',
                  transition: 'width 0.5s ease'
                }} />
                <div style={{
                  height: '100%',
                  width: `${stats.totalInvoiced > 0 ? (stats.totalBalanceDue / stats.totalInvoiced) * 100 : 0}%`,
                  background: 'rgba(245,158,11,0.5)'
                }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                <div><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#34d399', marginRight: 5 }}></span> Collected: <strong>{fmtINR(stats.totalPaid)}</strong></div>
                <div><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', marginRight: 5 }}></span> Outstanding: <strong>{fmtINR(stats.totalBalanceDue)}</strong></div>
              </div>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                👥 Top Billed Customers
              </h4>
              {customers.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No customers found.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {customers.slice(0, 5).map((c, idx) => (
                    <div key={c._id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.82rem' }}>
                      <span style={{ fontWeight: 700 }}>{c.businessName || c.name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{c.phone || c.gstin || 'Active Client'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                📦 Top Billing Products & Services
              </h4>
              {itemsList.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No products cataloged.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {itemsList.slice(0, 5).map((item, idx) => (
                    <div key={item._id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.82rem' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{item.itemName}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>HSN: {item.hsnCode || '998821'}</div>
                      </div>
                      <div style={{ fontWeight: 800, color: '#a78bfa' }}>₹ {item.unitPrice}/{item.unit}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: CUSTOMERS DIRECTORY ───────────────────────────────────────── */}
      {activeTab === 'customers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass-panel" style={{ padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                placeholder="Search Customer Name, Phone, GSTIN..."
                style={{ paddingLeft: 32, width: '100%', fontSize: '0.85rem' }}
              />
            </div>
            <button className="btn-primary" onClick={() => setShowCustomerModal(true)}>
              <PlusCircle size={15} /> Add New Customer
            </button>
          </div>

          <div className="glass-panel" style={{ overflowX: 'auto', padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Customer / Contact</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Business Name</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Phone & Email</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>GSTIN</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Address & State</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No customers found. Click "Add New Customer" to register your client!
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map(c => (
                    <tr key={c._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{c.businessName || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                        <div>{c.phone || '—'}</div>
                        {c.email && <div style={{ fontSize: '0.7rem' }}>{c.email}</div>}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#a78bfa' }}>{c.gstin || 'Unregistered'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {c.billingAddress || '—'} ({c.state || 'Gujarat'})
                      </td>
                      <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                          <button onClick={() => handleEditCustomer(c)} className="btn-icon" title="Edit Customer">
                            <Edit2 size={14} color="var(--primary)" />
                          </button>
                          <button onClick={() => handleDeleteCustomer(c._id, c.name)} className="btn-icon" title="Delete Customer">
                            <Trash2 size={14} color="#f87171" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 5: BILLING PRODUCTS CATALOG ──────────────────────────────────── */}
      {activeTab === 'items' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass-panel" style={{ padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
                placeholder="Search Product Name, HSN Code, Category..."
                style={{ paddingLeft: 32, width: '100%', fontSize: '0.85rem' }}
              />
            </div>
            <button className="btn-primary" onClick={() => setShowItemModal(true)}>
              <PlusCircle size={15} /> Add Billing Product
            </button>
          </div>

          <div className="glass-panel" style={{ overflowX: 'auto', padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '750px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Product / Service</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Category</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>HSN Code</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Unit Price</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Default GST %</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No billing products found. Click "Add Billing Product" to add your service items!
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => (
                    <tr key={item._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.itemName}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{item.category || 'Printing Services'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#a78bfa' }}>{item.hsnCode || '998821'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#34d399' }}>₹ {item.unitPrice} / {item.unit || 'Meters'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{item.taxRate != null ? item.taxRate : 5}%</td>
                      <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                          <button onClick={() => handleEditItem(item)} className="btn-icon" title="Edit Product">
                            <Edit2 size={14} color="var(--primary)" />
                          </button>
                          <button onClick={() => handleDeleteItem(item._id, item.itemName)} className="btn-icon" title="Delete Product">
                            <Trash2 size={14} color="#f87171" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAX INVOICE PREVIEW / VIEW MODAL ────────────────────────────────── */}
      {viewInvoiceModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: '780px', maxHeight: '92vh', overflowY: 'auto', padding: '1.75rem', background: '#ffffff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 14, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)' }}>

            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.9rem', marginBottom: '1.1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#6d28d9', fontWeight: 900, fontSize: '1.25rem' }}>
                  🧾 Tax Invoice — {viewInvoiceModal.invoiceNo}
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500, marginTop: 2, display: 'block' }}>
                  Invoice Date: <strong>{formatDateDDMMYYYY(viewInvoiceModal.invoiceDate)}</strong> {viewInvoiceModal.dueDate ? `| Due Date: ${formatDateDDMMYYYY(viewInvoiceModal.dueDate)}` : ''}
                  {(viewInvoiceModal.ourChallanNo || viewInvoiceModal.challanNo) ? ` | Challan No: ${viewInvoiceModal.ourChallanNo || viewInvoiceModal.challanNo}` : ''}
                </span>
              </div>
              <button onClick={() => setViewInvoiceModal(null)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', borderRadius: 8, padding: '0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            {/* Billed To & Status Box */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem', background: '#f8fafc', padding: '1.1rem', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em' }}>BILLED TO CUSTOMER</div>
                <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#0f172a' }}>{viewInvoiceModal.customer?.businessName || viewInvoiceModal.customer?.name || 'Walk-in Client'}</div>
                {viewInvoiceModal.customer?.gstin && <div style={{ color: '#6d28d9', fontWeight: 700, marginTop: 3 }}>GSTIN: {viewInvoiceModal.customer.gstin}</div>}
                {viewInvoiceModal.customer?.billingAddress && <div style={{ color: '#475569', marginTop: 3, lineHeight: '1.35' }}>{viewInvoiceModal.customer.billingAddress}</div>}
                {viewInvoiceModal.customer?.phone && <div style={{ color: '#475569', marginTop: 3 }}>Phone: {viewInvoiceModal.customer.phone}</div>}
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em' }}>INVOICE DETAILS & STATUS</div>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  display: 'inline-block',
                  background: viewInvoiceModal.paymentStatus === 'PAID' ? '#ecfdf5' : viewInvoiceModal.paymentStatus === 'PARTIALLY_PAID' ? '#fffbeb' : '#fef2f2',
                  color: viewInvoiceModal.paymentStatus === 'PAID' ? '#059669' : viewInvoiceModal.paymentStatus === 'PARTIALLY_PAID' ? '#d97706' : '#dc2626',
                  border: `1px solid ${viewInvoiceModal.paymentStatus === 'PAID' ? '#6ee7b7' : viewInvoiceModal.paymentStatus === 'PARTIALLY_PAID' ? '#fcd34d' : '#fca5a5'}`
                }}>
                  {viewInvoiceModal.paymentStatus || 'UNPAID'}
                </span>
                {(viewInvoiceModal.ourChallanNo || viewInvoiceModal.challanNo) && (
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2563eb', marginTop: 5 }}>
                    Challan No: {viewInvoiceModal.ourChallanNo || viewInvoiceModal.challanNo}
                  </div>
                )}
                <div style={{ marginTop: '0.5rem', fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>
                  Total: {fmtINR(viewInvoiceModal.grandTotal)}
                </div>
                {viewInvoiceModal.balanceDue > 0 && (
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#dc2626', marginTop: 2 }}>
                    Balance Due: {fmtINR(viewInvoiceModal.balanceDue)}
                  </div>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div style={{ marginBottom: '1.25rem', overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <table style={{ width: '100%', fontSize: '0.83rem', borderCollapse: 'collapse', textAlign: 'left', background: '#ffffff' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '0.65rem 0.6rem', color: '#334155', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase' }}>Sr.</th>
                    <th style={{ padding: '0.65rem 0.6rem', color: '#334155', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', width: '50px' }}>Image</th>
                    <th style={{ padding: '0.65rem 0.6rem', color: '#334155', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase' }}>Item Description & Details</th>
                    <th style={{ padding: '0.65rem 0.6rem', color: '#334155', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase' }}>HSN</th>
                    <th style={{ padding: '0.65rem 0.6rem', textAlign: 'right', color: '#334155', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase' }}>Qty</th>
                    <th style={{ padding: '0.65rem 0.6rem', textAlign: 'right', color: '#334155', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase' }}>Rate</th>
                    <th style={{ padding: '0.65rem 0.6rem', textAlign: 'right', color: '#334155', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewInvoiceModal.items || []).map((it, idx) => {
                    const jobDisplay = formatJobDisplay(it.jobNo);
                    const secondaryBadges = [];
                    if (it.lotNo) secondaryBadges.push(`Lot: ${it.lotNo}`);
                    if (it.partyChallan) secondaryBadges.push(`Vendor Challan: ${it.partyChallan}`);
                    if (it.ourChallanNo) secondaryBadges.push(`Challan: ${it.ourChallanNo}`);

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', verticalAlign: 'top', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                        <td style={{ padding: '0.7rem 0.6rem', color: '#64748b', fontWeight: 700 }}>{idx + 1}</td>
                        <td style={{ padding: '0.7rem 0.6rem' }}>
                          {it.imageUrl ? (
                            <img src={it.imageUrl} alt="Item" style={{ width: 38, height: 38, borderRadius: 6, objectFit: 'cover', border: '1px solid #cbd5e1' }} />
                          ) : (
                            <div style={{ width: 38, height: 38, borderRadius: 6, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>No Img</div>
                          )}
                        </td>
                        <td style={{ padding: '0.7rem 0.6rem' }}>
                          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>{it.itemName}</div>
                          {jobDisplay && (
                            <div style={{ fontSize: '0.76rem', color: '#7c3aed', fontWeight: 700, marginTop: 3, display: 'inline-block', background: '#f3e8ff', padding: '2px 8px', borderRadius: 4, border: '1px solid #d8b4fe' }}>
                              📋 {jobDisplay}
                            </div>
                          )}
                          {secondaryBadges.length > 0 && (
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: 5 }}>
                              {secondaryBadges.map((b, bIdx) => (
                                <span key={bIdx} style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: 4, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', fontWeight: 600 }}>
                                  {b}
                                </span>
                              ))}
                            </div>
                          )}
                          {it.description && <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>{it.description}</div>}
                        </td>
                        <td style={{ padding: '0.7rem 0.6rem', fontWeight: 800, color: '#7c3aed' }}>{it.hsnCode || '998821'}</td>
                        <td style={{ padding: '0.7rem 0.6rem', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>{it.qty} {it.unit || 'Meters'}</td>
                        <td style={{ padding: '0.7rem 0.6rem', textAlign: 'right', color: '#475569', fontWeight: 600 }}>₹ {it.unitPrice}</td>
                        <td style={{ padding: '0.7rem 0.6rem', textAlign: 'right', fontWeight: 900, color: '#2563eb' }}>₹ {Number(it.totalAmount || 0).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Financial Totals Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div>
                {viewInvoiceModal.notes && (
                  <div style={{ marginBottom: '0.6rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>NOTES:</span>
                    <div style={{ color: '#334155', fontSize: '0.83rem', marginTop: 2, background: '#f8fafc', padding: '0.6rem', borderRadius: 6, border: '1px solid #e2e8f0' }}>{viewInvoiceModal.notes}</div>
                  </div>
                )}
                <div style={{ fontSize: '0.8rem', color: '#6d28d9', fontWeight: 700, background: '#f5f3ff', padding: '0.65rem 0.85rem', borderRadius: 8, border: '1px solid #ddd6fe' }}>
                  Amount in Words: <strong>{numToWords(viewInvoiceModal.grandTotal)}</strong>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Subtotal:</span>
                  <span style={{ color: '#0f172a', fontWeight: 700 }}>{fmtINR(viewInvoiceModal.subtotal)}</span>
                </div>
                {viewInvoiceModal.igstAmount > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>IGST Tax (18%):</span>
                    <span style={{ color: '#0f172a', fontWeight: 700 }}>{fmtINR(viewInvoiceModal.igstAmount)}</span>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>CGST Tax (9%):</span>
                      <span style={{ color: '#0f172a', fontWeight: 700 }}>{fmtINR(viewInvoiceModal.cgstAmount || (viewInvoiceModal.totalTax / 2))}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>SGST Tax (9%):</span>
                      <span style={{ color: '#0f172a', fontWeight: 700 }}>{fmtINR(viewInvoiceModal.sgstAmount || (viewInvoiceModal.totalTax / 2))}</span>
                    </div>
                  </>
                )}

                {/* Round Off Details Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#7c3aed', fontWeight: 600 }}>
                  <span>Round Off:</span>
                  <span style={{ fontWeight: 700 }}>{viewInvoiceModal.roundOff != null ? (viewInvoiceModal.roundOff > 0 ? '+' : '') + ' ₹ ' + Number(viewInvoiceModal.roundOff).toFixed(2) : '₹ 0.00'}</span>
                </div>

                <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '0.45rem', marginTop: '0.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#6d28d9', fontWeight: 800, fontSize: '1.05rem' }}>Grand Total:</span>
                  <span style={{ color: '#059669', fontWeight: 900, fontSize: '1.25rem' }}>{fmtINR(viewInvoiceModal.grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'flex-end', flexWrap: 'wrap', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <button style={{ padding: '0.5rem 1.1rem', background: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }} onClick={() => setViewInvoiceModal(null)}>Close</button>
              <button style={{ padding: '0.5rem 1.1rem', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }} onClick={() => openPdfDialog(viewInvoiceModal)}>
                <Download size={15} /> Download PDF
              </button>
              {viewInvoiceModal.balanceDue > 0 && (
                <button style={{ padding: '0.5rem 1.1rem', background: 'linear-gradient(135deg,#7c3aed,#6366f1)', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }} onClick={() => { const inv = viewInvoiceModal; setViewInvoiceModal(null); setPaymentModalInvoice(inv); setPayAmount(inv.balanceDue); }}>
                  <CreditCard size={15} /> Record Payment
                </button>
              )}
              <button style={{ padding: '0.5rem 1.1rem', background: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }} onClick={() => { const inv = viewInvoiceModal; setViewInvoiceModal(null); handleOpenCreateTab(inv); }}>
                <Edit2 size={15} /> Edit Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RECORD PAYMENT MODAL ────────────────────────────────────────────── */}
      {paymentModalInvoice && (
        <div className="modal-overlay" style={{ alignItems: 'center' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Record Payment — {paymentModalInvoice.invoiceNo}</h3>
              <button onClick={() => setPaymentModalInvoice(null)} className="btn-icon"><X size={16} /></button>
            </div>

            <div>
              <label style={labelStyle}>Payment Amount (₹) *</label>
              <input
                type="number"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Payment Mode</label>
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)} style={inputStyle}>
                <option value="UPI / GPay / PhonePe">UPI / GPay / PhonePe</option>
                <option value="Bank Transfer (NEFT/RTGS)">Bank Transfer (NEFT/RTGS)</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Transaction / Reference No</label>
              <input
                type="text"
                value={payRef}
                onChange={e => setPayRef(e.target.value)}
                placeholder="e.g. UTR123456789"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button className="btn-secondary" onClick={() => setPaymentModalInvoice(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleSavePayment} disabled={submittingPay} style={{ background: '#10b981' }}>
                {submittingPay ? 'Recording...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE CUSTOMER MODAL ───────────────────────────────────────────── */}
      {showCustomerModal && (
        <div className="modal-overlay" style={{ alignItems: 'center' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '450px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Add New Customer / Client</h3>
              <button onClick={() => setShowCustomerModal(false)} className="btn-icon"><X size={16} /></button>
            </div>

            <div>
              <label style={labelStyle}>Contact Person Name *</label>
              <input type="text" value={custForm.name} onChange={e => setCustForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Business / Company Name</label>
              <input type="text" value={custForm.businessName} onChange={e => setCustForm(f => ({ ...f, businessName: e.target.value }))} style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <input type="text" value={custForm.phone} onChange={e => setCustForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>GSTIN Number</label>
                <input type="text" value={custForm.gstin} onChange={e => setCustForm(f => ({ ...f, gstin: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Billing Address</label>
              <textarea rows={2} value={custForm.billingAddress} onChange={e => setCustForm(f => ({ ...f, billingAddress: e.target.value }))} style={inputStyle} />
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button className="btn-secondary" onClick={() => setShowCustomerModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveCustomer}>Save Customer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE ITEM MODAL ──────────────────────────────────────────────── */}
      {showItemModal && (
        <div className="modal-overlay" style={{ alignItems: 'center' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Add Billing Product / Service</h3>
              <button onClick={() => setShowItemModal(false)} className="btn-icon"><X size={16} /></button>
            </div>

            <div>
              <label style={labelStyle}>Product / Service Name *</label>
              <input type="text" value={itemForm.itemName} onChange={e => setItemForm(f => ({ ...f, itemName: e.target.value }))} style={inputStyle} placeholder="e.g. Digital Printing Service" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div>
                <label style={labelStyle}>HSN Code</label>
                <input type="text" value={itemForm.hsnCode} onChange={e => setItemForm(f => ({ ...f, hsnCode: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Unit Price (₹) *</label>
                <input type="number" value={itemForm.unitPrice} onChange={e => setItemForm(f => ({ ...f, unitPrice: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div>
                <label style={labelStyle}>Unit</label>
                <select value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))} style={inputStyle}>
                  <option value="Meters">Meters</option>
                  <option value="Pcs">Pcs</option>
                  <option value="Rolls">Rolls</option>
                  <option value="Hours">Hours</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Default GST %</label>
                <select value={itemForm.taxRate} onChange={e => setItemForm(f => ({ ...f, taxRate: e.target.value }))} style={inputStyle}>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                  <option value={28}>28%</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button className="btn-secondary" onClick={() => setShowItemModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveItem}>Save Product</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PDF DUPLICATE COPY DIALOG ─────────────────────────────────── */}
      {pdfDuplicateModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--bg-card, #1a2035)',
            border: '1px solid rgba(124,58,237,0.35)',
            borderRadius: '16px',
            padding: '2rem',
            width: '380px',
            boxShadow: '0 20px 60px rgba(76,29,149,0.4)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.2rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#4c1d95)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Download size={18} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary, #f7fafc)' }}>Download Invoice PDF</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
                  Invoice: {pdfDuplicateModal.invoiceNo}
                </div>
              </div>
            </div>

            {/* Checkbox option */}
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
              background: pdfDuplicateChecked ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1.5px solid ${pdfDuplicateChecked ? '#7c3aed' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '10px', padding: '0.85rem 1rem',
              cursor: 'pointer', transition: 'all 0.2s',
            }}>
              <input
                type="checkbox"
                checked={pdfDuplicateChecked}
                onChange={e => setPdfDuplicateChecked(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 2, accentColor: '#7c3aed', cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary, #f7fafc)', marginBottom: '0.2rem' }}>
                  Include Duplicate Copy
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.4 }}>
                  Adds a 2nd page — <b style={{ color: '#a78bfa' }}>black &amp; white</b> duplicate copy of this invoice for your records.
                </div>
              </div>
            </label>

            {/* Info note */}
            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted, #94a3b8)', margin: '0.8rem 0 1.4rem', paddingLeft: '0.3rem' }}>
              {pdfDuplicateChecked
                ? '📄 You will get a 2-page PDF: Page 1 (Original — Colourful) + Page 2 (Duplicate — Black & White)'
                : '📄 You will get a 1-page PDF: Original colourful copy only'}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.7rem', justifyContent: 'flex-end' }}>
              <button
                className="btn-secondary"
                onClick={() => setPdfDuplicateModal(null)}
                disabled={pdfDownloading}
                style={{ minWidth: 80 }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleConfirmDownloadPdf}
                disabled={pdfDownloading}
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)', display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 130 }}
              >
                {pdfDownloading ? (
                  <>⏳ Generating...</>
                ) : (
                  <><Download size={15} /> Download PDF</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DOWNLOAD ACCOUNTS & PARTY LEDGER MODAL ─────────────────────────────── */}
      {showLedgerModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1050, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '16px', width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', color: '#f8fafc', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <BookOpen size={22} color="#10b981" />
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>Ledger Export & Accounts Statement</h3>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Download Party Account Statements & Global Master Ledgers</span>
                </div>
              </div>
              <button onClick={() => setShowLedgerModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.2rem' }}>
                <X size={20} />
              </button>
            </div>

            {/* Mode Selector Tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', background: '#1e293b', padding: '0.3rem', borderRadius: '8px' }}>
              <button
                onClick={() => setLedgerMode('party')}
                style={{
                  padding: '0.65rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  background: ledgerMode === 'party' ? 'linear-gradient(135deg,#10b981,#059669)' : 'transparent',
                  color: ledgerMode === 'party' ? '#ffffff' : '#94a3b8',
                  transition: 'all 0.2s'
                }}
              >
                👤 Mode A: Party-Wise Detailed Ledger
              </button>
              <button
                onClick={() => setLedgerMode('master')}
                style={{
                  padding: '0.65rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  background: ledgerMode === 'master' ? 'linear-gradient(135deg,#7c3aed,#6366f1)' : 'transparent',
                  color: ledgerMode === 'master' ? '#ffffff' : '#94a3b8',
                  transition: 'all 0.2s'
                }}
              >
                🌐 Mode B: All-Parties Master Ledger
              </button>
            </div>

            {/* Mode A: Select Party */}
            {ledgerMode === 'party' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1' }}>Select Customer / Party Account</label>
                <select
                  value={selectedPartyId}
                  onChange={e => setSelectedPartyId(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#ffffff', fontSize: '0.85rem', outline: 'none' }}
                >
                  <option value="ALL">All Parties (Combined)</option>
                  {customers.map(c => (
                    <option key={c._id} value={c._id}>
                      {c.businessName || c.name} {c.phone ? `(${c.phone})` : ''} {c.gstin ? `— GSTIN: ${c.gstin}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Range Presets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1' }}>Date Range Filter</label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'this_month', label: 'This Month' },
                  { id: 'last_quarter', label: 'Last Quarter' },
                  { id: 'fy_ytd', label: 'Financial Year (YTD)' },
                  { id: 'all_time', label: 'All Time' },
                  { id: 'custom', label: 'Custom Date' }
                ].map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => setLedgerPreset(preset.id)}
                    style={{
                      padding: '0.4rem 0.85rem',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: ledgerPreset === preset.id ? '#10b981' : '#334155',
                      background: ledgerPreset === preset.id ? 'rgba(16,185,129,0.18)' : '#1e293b',
                      color: ledgerPreset === preset.id ? '#34d399' : '#94a3b8',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {ledgerPreset === 'custom' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginTop: '0.3rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>From Date</label>
                    <input type="date" value={ledgerDateStart} onChange={e => setLedgerDateStart(e.target.value)} style={{ width: '100%', padding: '0.45rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#ffffff', fontSize: '0.8rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>To Date</label>
                    <input type="date" value={ledgerDateEnd} onChange={e => setLedgerDateEnd(e.target.value)} style={{ width: '100%', padding: '0.45rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#ffffff', fontSize: '0.8rem' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Export Format Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1' }}>Select Export Format</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                {[
                  { id: 'excel', label: '📊 Excel (.xlsx)', icon: FileSpreadsheet },
                  { id: 'pdf', label: '📄 PDF Document', icon: FileText },
                  { id: 'csv', label: '📁 CSV File', icon: Download },
                  { id: 'print', label: '🖨️ Quick Print', icon: Printer }
                ].map(fmt => {
                  const Icon = fmt.icon;
                  const isSel = ledgerFormat === fmt.id;
                  return (
                    <button
                      key={fmt.id}
                      onClick={() => setLedgerFormat(fmt.id)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.75rem 0.5rem',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: isSel ? '#38bdf8' : '#334155',
                        background: isSel ? 'rgba(56,189,248,0.18)' : '#1e293b',
                        color: isSel ? '#38bdf8' : '#cbd5e1',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      <Icon size={18} />
                      <span>{fmt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Calculated Summary Box */}
            {(() => {
              const { startD, endD } = getLedgerDateRange();
              if (ledgerMode === 'party') {
                const ledger = computePartyLedger(selectedPartyId, startD, endD);
                return (
                  <div style={{ background: '#1e293b', borderRadius: '10px', padding: '1rem', border: '1px solid #334155', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Opening Balance</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc', marginTop: 2 }}>{fmtINR(ledger.openingBalance)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Total Debit (Billed)</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>{fmtINR(ledger.totalDebit)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Total Credit (Paid)</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#34d399', marginTop: 2 }}>{fmtINR(ledger.totalCredit)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Closing Balance</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: ledger.closingBalance > 0 ? '#fbbf24' : '#34d399', marginTop: 2 }}>{fmtINR(ledger.closingBalance)} ({ledger.closingBalance >= 0 ? 'Dr' : 'Cr'})</div>
                    </div>
                  </div>
                );
              } else {
                let grandBilled = 0;
                let grandPaid = 0;
                let grandBal = 0;
                customers.forEach(cust => {
                  const pL = computePartyLedger(cust._id, startD, endD);
                  grandBilled += pL.totalDebit;
                  grandPaid += pL.totalCredit;
                  grandBal += pL.closingBalance;
                });
                return (
                  <div style={{ background: '#1e293b', borderRadius: '10px', padding: '1rem', border: '1px solid #334155', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Parties Count</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc', marginTop: 2 }}>{customers.length} Accounts</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Period Billed</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>{fmtINR(grandBilled)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Period Collected</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#34d399', marginTop: 2 }}>{fmtINR(grandPaid)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Total Outstanding</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fbbf24', marginTop: 2 }}>{fmtINR(grandBal)}</div>
                    </div>
                  </div>
                );
              }
            })()}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
              <button className="btn-secondary" onClick={() => setShowLedgerModal(false)} style={{ padding: '0.55rem 1.1rem' }}>Cancel</button>
              <button
                className="btn-primary"
                onClick={handleGenerateLedgerExport}
                style={{ padding: '0.55rem 1.4rem', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Download size={16} /> Generate & Download Ledger
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

const labelStyle = {
  fontSize: '0.7rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  marginBottom: '0.3rem',
  display: 'block'
};

const inputStyle = {
  width: '100%',
  padding: '0.5rem 0.7rem',
  fontSize: '0.85rem',
  background: 'var(--bg-input, #161b26)',
  border: '1px solid var(--border-light, #2d3748)',
  borderRadius: 'var(--radius-sm, 6px)',
  color: 'var(--text-primary, #f7fafc)',
  boxSizing: 'border-box'
};
