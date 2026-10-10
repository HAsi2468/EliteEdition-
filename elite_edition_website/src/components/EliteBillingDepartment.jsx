import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { triggerPushNotification } from './NotificationToast';
import { formatDateDDMMYYYY, formatForInputDate } from '../utils/dateUtils';
import { matchSearchQuery } from '../utils/searchUtils';
import StitchingChallanPanel from './StitchingChallanPanel';
import FabricInventoryPanel from './FabricInventoryPanel';
import DigitalPrintExpenseModule from './DigitalPrintExpenseModule';

import ScreenGroupRoster from './ScreenGroupRoster';
import { dispatchScreenGroupEvent } from '../services/screenGroupService';
import { triggerEliteAlert, triggerEliteConfirm } from './EliteModalDialog';
import { openPrintOptionsDialog } from '../utils/printService';
import DateRangePicker from './DateRangePicker';
import SignedDocumentUploadModal from './SignedDocumentUploadModal';
import SignedDocumentPreviewModal from './SignedDocumentPreviewModal';
import QuickActionMenu from './common/QuickActionMenu';
import { SmartActionGroup } from './common/SmartActionGroup';
import * as XLSX from 'xlsx';

const R2_PUBLIC_BASE = 'https://pub-66cb4aaa7dca442893dd7569e70ff7bd.r2.dev';

function convertDriveUrl(link) {
  if (!link || typeof link !== 'string' || !link.trim()) return '';
  const trimmed = link.trim();
  if (trimmed.startsWith('data:')) return trimmed;

  if (trimmed.includes('drive.google.com') || trimmed.includes('googleusercontent') || trimmed.includes('lh3.google')) {
    if (trimmed.includes('/folders/')) return '';
    let fid = '';
    const fileMatch = trimmed.match(/\/d\/([-\w]{20,})/);
    if (fileMatch) fid = fileMatch[1];
    if (!fid) {
      const openMatch = trimmed.match(/[?&]id=([-\w]{20,})/);
      if (openMatch) fid = openMatch[1];
    }
    if (!fid) {
      const idMatch = trimmed.match(/([-\w]{25,})/);
      if (idMatch) fid = idMatch[1];
    }
    if (fid) return `https://lh3.googleusercontent.com/d/${fid}=s1000`;
  }

  if (trimmed.includes('/designs/')) {
    const filename = trimmed.split('/designs/')[1].replace(/^\/+/, '');
    return `${R2_PUBLIC_BASE}/designs/${filename}`;
  }
  if (trimmed.includes('/uploads/')) {
    const filename = trimmed.split('/uploads/')[1].replace(/^\/+/, '');
    return `${R2_PUBLIC_BASE}/uploads/${filename}`;
  }

  if (trimmed.startsWith('https://')) return encodeURI(trimmed);

  if (trimmed.includes('3.7.174.180') || trimmed.startsWith('http://')) {
    const clean = trimmed.replace(/^http:\/\/[^\/]+/, '');
    if (clean.includes('/designs/') || clean.includes('/uploads/')) {
      const sub = clean.startsWith('/') ? clean.substring(1) : clean;
      return `${R2_PUBLIC_BASE}/${sub}`;
    }
    return encodeURI(trimmed.replace('http://', 'https://'));
  }

  if (!trimmed.startsWith('http') && !trimmed.includes('/')) {
    const filename = trimmed.includes('.') ? trimmed : `${trimmed}.jpeg`;
    return `${R2_PUBLIC_BASE}/designs/${encodeURIComponent(filename)}`;
  }

  return encodeURI(trimmed);
}

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
  FileSpreadsheet,
  ShoppingBag,
  FileCode,
  Filter,
  RotateCcw,
  Percent,
  Copy
} from 'lucide-react';

import { cloneDocumentPayload, focusPrimaryQuantityInput } from '../utils/documentCloneUtility';
import { ValidationDock } from './common/ValidationDock';
import { useValidationDock } from '../hooks/useValidationDock';
import { EntityBrandBadge } from './common/EntityBrandBadge';
import { ScrollSpyMiniMap } from './common/ScrollSpyMiniMap';
import { FeatureCoachmark } from './common/FeatureCoachmark';
import { CellHoverPeek } from './common/CellHoverPeek';
import { useHardwareBarcodeSniffer } from '../hooks/useHardwareBarcodeSniffer';

const INVOICE_FORM_SECTIONS = [
  { id: 'inv-sec-meta', label: 'Metadata & Taxes' },
  { id: 'inv-sec-customer', label: 'Customer / Party' },
  { id: 'inv-sec-items', label: 'Line Items' },
  { id: 'inv-sec-notes', label: 'Notes & Terms' },
  { id: 'inv-sec-totals', label: 'Summary & Total' }
];

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

export default function EliteBillingDepartment({ 
  initialChallanData = null, 
  department = 'digital_print', 
  companyEntity = (department === 'stitching' ? 'Elite Stitching' : department === 'elite_fabtex' ? 'Elite Fabtex' : department === 'elite_edition' ? 'Elite Edition' : 'Elite Digital Prints'), 
  initialTab = null 
}) {
  const [activeTab, setActiveTab] = useState(() => (initialTab && initialTab !== 'costing') || (companyEntity === 'Elite Edition' || companyEntity === 'Elite Fabtex' ? 'invoices' : 'challans')); // 'challans', 'invoices', 'dashboard', 'create', 'customers', 'items'
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
  const [selectedInvoiceHistory, setSelectedInvoiceHistory] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [vendorsList, setVendorsList] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState('this_month');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const currentUser = api.getCurrentUser();
  const [signedUploadTarget, setSignedUploadTarget] = useState(null);
  const [signedPreviewTarget, setSignedPreviewTarget] = useState(null);

  // Multi-select for bulk Invoice PDF download
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [bulkDownloading, setBulkDownloading] = useState(false);

  // Auto open Expense create modal
  const [autoOpenExpenseModal, setAutoOpenExpenseModal] = useState(false);

  // ── Ledger System States ──────────────────────────────────────────────────
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerMode, setLedgerMode] = useState('party'); // 'party' or 'master'
  const [selectedPartyId, setSelectedPartyId] = useState('ALL');
  const [ledgerPreset, setLedgerPreset] = useState('this_month');
  const [ledgerDateStart, setLedgerDateStart] = useState('');
  const [ledgerDateEnd, setLedgerDateEnd] = useState('');
  const [ledgerFormat, setLedgerFormat] = useState('pdf'); // 'excel', 'pdf', 'csv', 'print'
  // ── Purchase Module States ─────────────────────────────────────────────
  const [purchases, setPurchases] = useState(() => {
    try {
      const saved = localStorage.getItem(`elite_purchases_${companyEntity || 'edp'}`);
      if (saved) return JSON.parse(saved);
      for (const k of ['elite_purchases_edp', 'elite_purchases_Elite Digital Prints', 'elite_purchases_Elite Edition', 'elite_purchases_Elite Fabtex']) {
        const anySaved = localStorage.getItem(k);
        if (anySaved) {
          const parsed = JSON.parse(anySaved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
      return [];
    } catch (e) {
      return [];
    }
  });

  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [purchaseDatePreset, setPurchaseDatePreset] = useState('all');
  const [purchaseDateStart, setPurchaseDateStart] = useState('');
  const [purchaseDateEnd, setPurchaseDateEnd] = useState('');
  const [purchaseVendorFilter, setPurchaseVendorFilter] = useState('ALL');
  const [purchaseGstFilter, setPurchaseGstFilter] = useState('ALL');
  const [purchaseTypeFilter, setPurchaseTypeFilter] = useState('ALL');
  const [viewPurchaseModal, setViewPurchaseModal] = useState(null);
  const [editingPurchaseId, setEditingPurchaseId] = useState(null);

  // ── NON-BLOCKING VALIDATION DOCK & INDUSTRIAL SCANNER HOOKS ────────────────
  const { errors: validationErrors, setErrors: setValidationErrors, clearErrors: clearValidationErrors } = useValidationDock();

  // Ambient Barcode Sniffer: fast-filter search on current tab
  useHardwareBarcodeSniffer((scanData) => {
    if (!scanData?.code) return false;
    const code = scanData.code.trim();
    if (activeTab === 'invoices') {
      setSearch(code);
      triggerPushNotification('Barcode Sniffer 🔍', `Filtered invoices for: ${code}`, 'info');
      return true;
    } else if (activeTab === 'purchase') {
      setPurchaseSearch(code);
      triggerPushNotification('Barcode Sniffer 🔍', `Filtered purchases for: ${code}`, 'info');
      return true;
    }
    return false;
  });

  const createEmptyPurchaseItem = () => ({
    id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    itemName: '',
    description: '',
    hsnCode: '998821',
    qty: 1,
    quantity: 1,
    unit: 'Meters',
    unitPrice: 0,
    rate: 0,
    discountPct: 0,
    taxRate: 5,
    amount: 0,
    totalAmount: 0,
    jobNo: '',
    lotNo: '',
    partyChallan: '',
    ourChallanNo: ''
  });

  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    purchaseNo: 'PUR-2026-001',
    purchaseType: 'inventory', // 'inventory' (Inventory Purchase) or 'expense' (Expense Purchase)
    ourChallanNo: '',
    date: new Date().toISOString().split('T')[0],
    vendor: {
      vendorId: '',
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
    vendorName: '',
    items: [createEmptyPurchaseItem()],
    enableRoundOff: true,
    manualRoundOff: undefined,
    discountType: 'flat',
    discountValue: 0,
    taxType: 'CGST_SGST', // 'CGST_SGST' or 'IGST'
    gstRate: 5,
    paidAmount: 0,
    notes: 'Vendor purchase bill recorded in ERP.'
  });

  // ── REAL-TIME PURCHASE CALCULATIONS (mirroring calculatedInvoice) ─────────────
  const calculatedPurchase = useMemo(() => {
    let subtotal = 0;
    const items = purchaseForm.items || [];
    const updatedItems = items.map(it => {
      const q = parseFloat(it.qty !== undefined && it.qty !== '' ? it.qty : (it.quantity !== undefined && it.quantity !== '' ? it.quantity : 0)) || 0;
      const basePrice = parseFloat(it.unitPrice !== undefined && it.unitPrice !== '' ? it.unitPrice : (it.rate !== undefined && it.rate !== '' ? it.rate : 0)) || 0;
      const discPct = parseFloat(it.discountPct) || 0;
      const baseTotal = q * basePrice;
      const discAmt = (baseTotal * discPct) / 100;
      const itemTotal = Math.max(0, baseTotal - discAmt);
      subtotal += itemTotal;
      return {
        ...it,
        qty: q,
        quantity: q,
        unitPrice: basePrice,
        rate: basePrice,
        discountAmt: discAmt,
        totalAmount: itemTotal,
        amount: itemTotal
      };
    });

    const discVal = parseFloat(purchaseForm.discountValue) || 0;
    let discountTotal = 0;
    if (purchaseForm.discountType === 'percentage') {
      discountTotal = (subtotal * discVal) / 100;
    } else {
      discountTotal = discVal;
    }

    const netSubtotal = Math.max(0, subtotal - discountTotal);

    // Calculate Tax based on items individual tax rates or default to purchaseForm.gstRate or 5%
    const totalTax = updatedItems.reduce((sum, i) => {
      const taxable = i.totalAmount || 0;
      const rate = parseFloat(i.taxRate !== undefined && i.taxRate !== null && i.taxRate !== '' ? i.taxRate : (purchaseForm.gstRate || 5));
      return sum + (taxable * rate / 100);
    }, 0);

    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (purchaseForm.taxType === 'IGST') {
      igstAmount = totalTax;
    } else {
      cgstAmount = totalTax / 2;
      sgstAmount = totalTax / 2;
    }

    const rawGrandTotal = netSubtotal + totalTax;
    let grandTotal = rawGrandTotal;
    let roundOff = 0;

    if (purchaseForm.enableRoundOff !== false) {
      if (purchaseForm.manualRoundOff !== undefined && purchaseForm.manualRoundOff !== '') {
        roundOff = parseFloat(purchaseForm.manualRoundOff);
        grandTotal = parseFloat((rawGrandTotal + roundOff).toFixed(2));
      } else {
        grandTotal = Math.round(rawGrandTotal);
        roundOff = parseFloat((grandTotal - rawGrandTotal).toFixed(2));
      }
    } else {
      grandTotal = parseFloat(rawGrandTotal.toFixed(2));
      roundOff = 0;
    }

    const paid = parseFloat(purchaseForm.paidAmount) || 0;
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
  }, [purchaseForm.items, purchaseForm.enableRoundOff, purchaseForm.manualRoundOff, purchaseForm.discountType, purchaseForm.discountValue, purchaseForm.taxType, purchaseForm.gstRate, purchaseForm.paidAmount]);

  const handlePurchaseVendorSelect = (selectedName) => {
    if (!selectedName) {
      setPurchaseForm(prev => ({
        ...prev,
        vendorName: '',
        vendor: {
          vendorId: '',
          name: '',
          businessName: '',
          phone: '',
          email: '',
          gstin: '',
          billingAddress: '',
          shippingAddress: '',
          state: 'Gujarat',
          stateCode: '24'
        }
      }));
      return;
    }

    // 1. Look in Billing Vendors Master first (has full comprehensive details)
    const matchedBilling = (vendorsList || []).find(v => {
      const bName = String(v.businessName || v.name || '').trim().toLowerCase();
      const cName = String(v.name || '').trim().toLowerCase();
      const target = selectedName.trim().toLowerCase();
      return bName === target || cName === target;
    });

    if (matchedBilling) {
      const resolvedName = matchedBilling.name || selectedName;
      const resolvedBiz = matchedBilling.businessName || resolvedName;
      setPurchaseForm(prev => ({
        ...prev,
        vendorName: resolvedBiz || resolvedName,
        vendor: {
          vendorId: matchedBilling._id || matchedBilling.id || '',
          name: resolvedName,
          businessName: resolvedBiz,
          phone: matchedBilling.phone || '',
          email: matchedBilling.email || '',
          gstin: matchedBilling.gstin || '',
          billingAddress: matchedBilling.billingAddress || matchedBilling.address || '',
          shippingAddress: matchedBilling.shippingAddress || matchedBilling.billingAddress || matchedBilling.address || '',
          state: matchedBilling.state || 'Gujarat',
          stateCode: matchedBilling.stateCode || '24'
        }
      }));
      return;
    }

    // 2. Check recent purchases for vendor snapshot
    const matchedPurchase = (purchases || []).find(p => {
      const vName = (p.vendorName || (p.vendor && (p.vendor.businessName || p.vendor.name)) || '').trim().toLowerCase();
      return vName === selectedName.trim().toLowerCase();
    });

    if (matchedPurchase && matchedPurchase.vendor) {
      const pv = matchedPurchase.vendor;
      setPurchaseForm(prev => ({
        ...prev,
        vendorName: pv.businessName || pv.name || selectedName,
        vendor: {
          vendorId: pv.vendorId || '',
          name: pv.name || selectedName,
          businessName: pv.businessName || selectedName,
          phone: pv.phone || '',
          email: pv.email || '',
          gstin: pv.gstin || '',
          billingAddress: pv.billingAddress || '',
          shippingAddress: pv.shippingAddress || pv.billingAddress || '',
          state: pv.state || 'Gujarat',
          stateCode: pv.stateCode || '24'
        }
      }));
      return;
    }

    setPurchaseForm(prev => ({
      ...prev,
      vendorName: selectedName,
      vendor: {
        ...prev.vendor,
        name: selectedName,
        businessName: selectedName
      }
    }));
  };

  const handleAddPurchaseItem = () => {
    setPurchaseForm(prev => ({
      ...prev,
      items: [...(prev.items || []), createEmptyPurchaseItem()]
    }));
  };

  const handleRemovePurchaseItem = (index) => {
    setPurchaseForm(prev => {
      const items = prev.items || [];
      if (items.length <= 1) return prev;
      return {
        ...prev,
        items: items.filter((_, idx) => idx !== index)
      };
    });
  };

  const handlePurchaseItemChange = (index, field, value) => {
    setPurchaseForm(prev => {
      const items = [...(prev.items || [])];
      if (!items[index]) return prev;
      const updatedItem = { ...items[index], [field]: value };

      if (field === 'qty') {
        updatedItem.quantity = value;
      } else if (field === 'quantity') {
        updatedItem.qty = value;
      } else if (field === 'unitPrice') {
        updatedItem.rate = value;
      } else if (field === 'rate') {
        updatedItem.unitPrice = value;
      }

      // Catalog sync if selecting or typing itemName
      if (field === 'itemName') {
        const matched = itemsList.find(i => i.itemName.trim().toLowerCase() === String(value).trim().toLowerCase());
        if (matched) {
          updatedItem.hsnCode = matched.hsnCode || '998821';
          if (matched.unitPrice != null) {
            updatedItem.unitPrice = matched.unitPrice;
            updatedItem.rate = matched.unitPrice;
          }
          if (matched.unit) updatedItem.unit = matched.unit;
          if (matched.taxRate != null) updatedItem.taxRate = matched.taxRate;
        }
      }

      items[index] = updatedItem;
      return {
        ...prev,
        items
      };
    });
  };

  const handleGstRateChange = (newRate) => {
    const rateNum = Math.max(0, parseFloat(newRate) || 0);
    setPurchaseForm(prev => ({
      ...prev,
      gstRate: rateNum,
      items: (prev.items || []).map(it => ({ ...it, taxRate: rateNum }))
    }));
  };

  const handleEditPurchase = (p) => {
    setEditingPurchaseId(p._id || p.id);
    const pGstRate = p.gstRate != null ? p.gstRate : 5;
    const pItems = Array.isArray(p.items) && p.items.length > 0
      ? p.items.map(it => ({
          id: it.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          itemName: it.itemName || '',
          description: it.description || '',
          hsnCode: it.hsnCode || '998821',
          qty: it.qty != null ? it.qty : (it.quantity != null ? it.quantity : 1),
          quantity: it.quantity != null ? it.quantity : (it.qty != null ? it.qty : 1),
          unit: it.unit || 'Meters',
          unitPrice: it.unitPrice != null ? it.unitPrice : (it.rate != null ? it.rate : 0),
          rate: it.rate != null ? it.rate : (it.unitPrice != null ? it.unitPrice : 0),
          discountPct: it.discountPct || 0,
          taxRate: it.taxRate != null ? it.taxRate : (pGstRate || 5),
          amount: it.amount || 0,
          totalAmount: it.totalAmount || it.amount || 0,
          jobNo: it.jobNo || '',
          lotNo: it.lotNo || '',
          partyChallan: it.partyChallan || '',
          ourChallanNo: it.ourChallanNo || ''
        }))
      : [{
          id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          itemName: p.itemName || '',
          description: p.description || '',
          hsnCode: '998821',
          qty: p.quantity != null ? p.quantity : 1,
          quantity: p.quantity != null ? p.quantity : 1,
          unit: p.unit || 'Meters',
          unitPrice: p.rate !== '-' && p.rate != null ? p.rate : 0,
          rate: p.rate !== '-' && p.rate != null ? p.rate : 0,
          discountPct: 0,
          taxRate: pGstRate || 5,
          amount: p.totalAmount || 0,
          totalAmount: p.totalAmount || 0,
          jobNo: '',
          lotNo: '',
          partyChallan: '',
          ourChallanNo: ''
        }];

    setPurchaseForm({
      purchaseNo: p.purchaseNo || '',
      purchaseType: p.purchaseType || 'inventory',
      ourChallanNo: p.ourChallanNo || '',
      date: p.date ? (typeof p.date === 'string' && p.date.includes('T') ? p.date.split('T')[0] : (p.date instanceof Date ? p.date.toISOString().split('T')[0] : p.date)) : new Date().toISOString().split('T')[0],
      vendor: {
        vendorId: p.vendor?.vendorId || '',
        name: p.vendor?.name || p.vendorName || '',
        businessName: p.vendor?.businessName || p.vendorName || '',
        phone: p.vendor?.phone || '',
        email: p.vendor?.email || '',
        gstin: p.vendor?.gstin || '',
        billingAddress: p.vendor?.billingAddress || '',
        shippingAddress: p.vendor?.shippingAddress || '',
        state: p.vendor?.state || 'Gujarat',
        stateCode: p.vendor?.stateCode || '24'
      },
      vendorName: p.vendorName || p.vendor?.businessName || p.vendor?.name || '',
      items: pItems,
      enableRoundOff: p.enableRoundOff !== false,
      manualRoundOff: p.roundOff !== undefined ? p.roundOff : undefined,
      discountType: p.discountType || 'flat',
      discountValue: p.discountValue || 0,
      taxType: p.taxType || p.gstType || 'CGST_SGST',
      gstRate: pGstRate,
      paidAmount: p.paidAmount || 0,
      totalAmount: p.grandTotal || p.totalAmount || '',
      notes: p.notes || ''
    });
    setShowPurchaseModal(true);
  };

  // Professional Printable Purchase Inward Voucher via openPrintOptionsDialog
  const handlePrintPurchase = async (purchase) => {
    if (!purchase) return;
    try {
      const vName = purchase.vendor?.businessName || purchase.vendor?.name || purchase.vendorName || 'Vendor';
      const pDate = purchase.date ? (typeof purchase.date === 'string' && purchase.date.includes('T') ? purchase.date.split('T')[0] : (purchase.date instanceof Date ? purchase.date.toISOString().split('T')[0] : purchase.date)) : new Date().toISOString().split('T')[0];
      const pDueDate = purchase.dueDate ? (typeof purchase.dueDate === 'string' && purchase.dueDate.includes('T') ? purchase.dueDate.split('T')[0] : (purchase.dueDate instanceof Date ? purchase.dueDate.toISOString().split('T')[0] : purchase.dueDate)) : '';

      const items = Array.isArray(purchase.items) && purchase.items.length > 0
        ? purchase.items
        : [{
            itemName: purchase.itemName || 'Material Purchase',
            description: '',
            hsnCode: '998821',
            qty: purchase.quantity || 1,
            unit: purchase.unit || 'Nos',
            unitPrice: purchase.rate !== '-' ? (purchase.rate || 0) : 0,
            taxRate: purchase.gstRate || 0,
            totalAmount: purchase.totalAmount || 0
          }];

      const subtotal = Number(purchase.subtotal || purchase.subtotalAmount || (purchase.totalAmount - (purchase.totalTax || purchase.gstAmount || 0)) || 0);
      const discount = Number(purchase.discountTotal || 0);
      const taxRate = Number(purchase.gstRate || 5);
      const isIgst = purchase.taxType === 'IGST';
      const igstAmt = Number(purchase.igstAmount || purchase.totalTax || purchase.gstAmount || 0);
      const cgstAmt = Number(purchase.cgstAmount || (purchase.totalTax ? purchase.totalTax / 2 : 0));
      const sgstAmt = Number(purchase.sgstAmount || (purchase.totalTax ? purchase.totalTax / 2 : 0));
      const roundOff = Number(purchase.roundOff || 0);
      const grandTotal = Number(purchase.grandTotal || purchase.totalAmount || 0);
      const paidAmt = Number(purchase.paidAmount || 0);
      const balDue = purchase.balanceDue != null ? Number(purchase.balanceDue) : Math.max(0, grandTotal - paidAmt);

      const itemsHtml = items.map((it, idx) => {
        const qty = it.qty || it.quantity || 1;
        const rate = it.unitPrice || it.rate || 0;
        const lineTotal = Number(it.totalAmount || it.amount || (qty * rate));
        return `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 10px; text-align: center; color: #64748b;">${idx + 1}</td>
            <td style="padding: 8px 10px;">
              <strong style="color: #0f172a;">${it.itemName || ''}</strong>
              ${it.description ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">${it.description}</div>` : ''}
              ${(it.jobNo || it.lotNo || it.partyChallan || it.ourChallanNo) ? `
                <div style="font-size: 10px; color: #64748b; margin-top: 3px;">
                  ${it.jobNo ? `Job: ${it.jobNo} ` : ''}
                  ${it.lotNo ? `Lot: ${it.lotNo} ` : ''}
                  ${it.partyChallan ? `Vendor Ch: ${it.partyChallan} ` : ''}
                  ${it.ourChallanNo ? `Challan: ${it.ourChallanNo}` : ''}
                </div>` : ''}
            </td>
            <td style="padding: 8px 10px; text-align: center; color: #64748b;">${it.hsnCode || '998821'}</td>
            <td style="padding: 8px 10px; text-align: right; font-weight: 700;">${qty}</td>
            <td style="padding: 8px 10px; text-align: center; color: #64748b;">${it.unit || 'Nos'}</td>
            <td style="padding: 8px 10px; text-align: right;">₹${Number(rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td style="padding: 8px 10px; text-align: right;">${it.taxRate != null ? it.taxRate : taxRate}%</td>
            <td style="padding: 8px 10px; text-align: right; font-weight: 800; color: #0f172a;">₹${lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        `;
      }).join('');

      const htmlContent = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; padding: 24px; max-width: 820px; margin: 0 auto; line-height: 1.45;">
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>

          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px;">
            <div>
              <div style="font-size: 22px; font-weight: 900; color: #1e3a8a; letter-spacing: -0.5px; text-transform: uppercase;">
                ${companyEntity || 'ELITE DIGITAL PRINTS'}
              </div>
              <div style="font-size: 11px; color: #64748b; font-weight: 600; margin-top: 2px;">
                Enterprise ERP • Inward Materials & Vendor Purchase Voucher
              </div>
            </div>
            <div style="text-align: right;">
              <span style="background: #eff6ff; color: #1d4ed8; border: 1.5px solid #bfdbfe; font-size: 11px; font-weight: 900; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.5px; text-transform: uppercase; display: inline-block;">
                PURCHASE INWARD VOUCHER
              </span>
              <div style="font-size: 14px; font-weight: 900; color: #0f172a; margin-top: 6px;">
                Bill #${purchase.purchaseNo || '-'}
              </div>
            </div>
          </div>

          <!-- Metadata Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">
              <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">SUPPLIER / VENDOR DETAILS</div>
              <div style="font-size: 14px; font-weight: 900; color: #0f172a;">${vName}</div>
              ${purchase.vendor?.name && purchase.vendor?.name !== vName ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">Contact: <strong>${purchase.vendor.name}</strong></div>` : ''}
              ${purchase.vendor?.gstin ? `<div style="font-size: 11px; color: #1e3a8a; font-weight: 700; margin-top: 2px;">GSTIN: ${purchase.vendor.gstin}</div>` : ''}
              ${purchase.vendor?.billingAddress ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">${purchase.vendor.billingAddress}${purchase.vendor?.state ? `, ${purchase.vendor.state}` : ''}</div>` : ''}
              ${purchase.vendor?.phone ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">Phone: ${purchase.vendor.phone}</div>` : ''}
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; text-align: right;">
              <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">PURCHASE DETAILS</div>
              <div style="font-size: 11px; color: #475569;">Inward Date: <strong style="color: #0f172a;">${pDate}</strong></div>
              ${pDueDate ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">Due Date: <strong style="color: #d97706;">${pDueDate}</strong></div>` : ''}
              ${purchase.ourChallanNo ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">Challan / Ref: <strong style="color: #0284c7;">${purchase.ourChallanNo}</strong></div>` : ''}
              <div style="margin-top: 6px;">
                <span style="font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; background: ${purchase.paymentStatus === 'PAID' ? '#dcfce7' : (purchase.paymentStatus === 'PARTIAL' || purchase.paymentStatus === 'PARTIALLY_PAID') ? '#fef3c7' : '#fee2e2'}; color: ${purchase.paymentStatus === 'PAID' ? '#15803d' : (purchase.paymentStatus === 'PARTIAL' || purchase.paymentStatus === 'PARTIALLY_PAID') ? '#b45309' : '#b91c1c'};">
                  STATUS: ${purchase.paymentStatus || 'UNPAID'}
                </span>
              </div>
            </div>
          </div>

          <!-- Items Table -->
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
            <thead>
              <tr style="background: #1e3a8a; color: #ffffff; text-transform: uppercase; font-size: 10px; font-weight: 800; letter-spacing: 0.5px;">
                <th style="padding: 8px 10px; width: 30px; text-align: center;">#</th>
                <th style="padding: 8px 10px; text-align: left;">Item Description</th>
                <th style="padding: 8px 10px; text-align: center; width: 60px;">HSN</th>
                <th style="padding: 8px 10px; text-align: right; width: 60px;">Qty</th>
                <th style="padding: 8px 10px; text-align: center; width: 50px;">Unit</th>
                <th style="padding: 8px 10px; text-align: right; width: 80px;">Rate (₹)</th>
                <th style="padding: 8px 10px; text-align: right; width: 60px;">Tax %</th>
                <th style="padding: 8px 10px; text-align: right; width: 95px;">Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <!-- Financial Breakdown -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 20px;">
            <div style="flex: 1;">
              ${purchase.notes ? `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px;">
                  <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 3px;">Notes / Remarks</div>
                  <div style="font-size: 11px; color: #334155;">${purchase.notes}</div>
                </div>
              ` : ''}
            </div>

            <div style="width: 280px; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; font-size: 12px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="color: #64748b;">Subtotal:</span>
                <strong>₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
              ${discount > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #16a34a;">
                  <span>Discount:</span>
                  <strong>- ₹${discount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>` : ''}
              ${isIgst ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #475569;">
                  <span>IGST (${taxRate}%):</span>
                  <strong>₹${igstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>` : `
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #475569;">
                  <span>CGST (${taxRate / 2}%):</span>
                  <strong>₹${cgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #475569;">
                  <span>SGST (${taxRate / 2}%):</span>
                  <strong>₹${sgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>`}
              ${roundOff !== 0 ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #475569;">
                  <span>Round Off:</span>
                  <strong>${roundOff > 0 ? `+ ₹${roundOff.toFixed(2)}` : `- ₹${Math.abs(roundOff).toFixed(2)}`}</strong>
                </div>` : ''}
              <div style="border-top: 1.5px solid #0f172a; padding-top: 6px; margin-top: 4px; display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; color: #1e3a8a;">
                <span>Grand Total:</span>
                <span>₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 11px; color: #15803d; border-top: 1px dashed #cbd5e1; padding-top: 6px;">
                <span>Paid Amount:</span>
                <strong>₹${paidAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 12px; font-weight: 800; color: ${balDue > 0 ? '#dc2626' : '#15803d'};">
                <span>Balance Due:</span>
                <span>₹${balDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <!-- Signatures Footer -->
          <div style="display: flex; justify-content: space-between; border-top: 1px solid #cbd5e1; padding-top: 36px; margin-top: 30px; font-size: 11px; color: #64748b;">
            <div style="text-align: center; width: 180px; border-top: 1px dashed #94a3b8; padding-top: 6px;">
              Goods Received By
            </div>
            <div style="text-align: center; width: 180px; border-top: 1px dashed #94a3b8; padding-top: 6px;">
              Checked & Verified By
            </div>
            <div style="text-align: center; width: 180px; border-top: 1px dashed #94a3b8; padding-top: 6px;">
              Authorized Signatory
            </div>
          </div>
        </div>
      `;

      await openPrintOptionsDialog({
        title: `Purchase Voucher — ${purchase.purchaseNo || 'Entry'}`,
        content: htmlContent,
        defaultSettings: {
          paperSize: 'A4',
          orientation: 'portrait',
          margin: 'default'
        }
      });
      triggerPushNotification('🖨️ Purchase Voucher', `Print ready for #${purchase.purchaseNo || ''}.`, 'success');
    } catch (err) {
      console.error('Failed to print purchase voucher:', err);
      alert('Failed to prepare purchase voucher for printing: ' + err.message);
    }
  };

  const fetchPurchases = async () => {
    try {
      // One-time client purge of deleted test/stale entries from legacy localStorage keys
      try {
        const legacyKeys = [
          `elite_purchases_${companyEntity || 'edp'}`,
          'elite_purchases_edp',
          'elite_purchases_Elite Digital Prints',
          'elite_purchases_Elite Edition',
          'elite_purchases_Elite Fabtex'
        ];
        const purgedNos = new Set(['INV/26-27/563', '4177/26-27']);
        legacyKeys.forEach(k => {
          const raw = localStorage.getItem(k);
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              const cleaned = arr.filter(p => !purgedNos.has(p.purchaseNo));
              localStorage.setItem(k, JSON.stringify(cleaned));
            }
          }
        });
      } catch (cleanErr) {}

      // Authoritative fetch from MongoDB database
      const res = await api.getBillingPurchases(companyEntity);
      let dbPurchases = (res && res.data) ? res.data : [];

      setPurchases(dbPurchases);
      try {
        localStorage.setItem(`elite_purchases_${companyEntity || 'edp'}`, JSON.stringify(dbPurchases));
      } catch (e) {}
    } catch (err) {
      console.warn('Failed to load purchases from API:', err);
      try {
        const cached = localStorage.getItem(`elite_purchases_${companyEntity || 'edp'}`);
        if (cached) {
          const arr = JSON.parse(cached);
          if (Array.isArray(arr)) setPurchases(arr);
        }
      } catch (e) {}
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, [companyEntity]);

  useEffect(() => {
    const handleRefresh = (e) => {
      if (!e || !e.detail || e.detail === 'billing' || e.detail?.source === 'billing') {
        fetchPurchases();
      }
    };
    window.addEventListener('elite-data-refresh', handleRefresh);
    return () => window.removeEventListener('elite-data-refresh', handleRefresh);
  }, [companyEntity]);

  const handleCreatePurchase = async (e) => {
    e.preventDefault();
    const vendorFinalName = purchaseForm.vendor?.businessName || purchaseForm.vendor?.name || purchaseForm.vendorName;
    const errs = [];

    if (!vendorFinalName || !vendorFinalName.trim()) {
      errs.push({
        fieldId: 'purchase-vendor-name',
        label: 'Vendor / Supplier',
        message: 'Please select or enter Vendor Name'
      });
    }

    const items = calculatedPurchase.items || [];
    const validItems = items.filter(i => i.itemName && i.itemName.trim() !== '');
    if (validItems.length === 0) {
      errs.push({
        fieldId: 'purchase-item-name-0',
        label: 'Line Items',
        message: 'Please add at least one item description'
      });
    } else {
      items.forEach((it, idx) => {
        if (!it.itemName || !it.itemName.trim()) {
          errs.push({
            fieldId: `purchase-item-name-${idx}`,
            label: `Item #${idx + 1} Name`,
            message: 'Item description cannot be empty'
          });
        }
        if (!it.qty || Number(it.qty) <= 0) {
          errs.push({
            fieldId: `purchase-item-qty-${idx}`,
            label: `Item #${idx + 1} Qty`,
            message: 'Quantity must be greater than 0'
          });
        }
        if (it.unitPrice == null || Number(it.unitPrice) < 0) {
          errs.push({
            fieldId: `purchase-item-price-${idx}`,
            label: `Item #${idx + 1} Price`,
            message: 'Unit price cannot be negative'
          });
        }
      });
    }

    if (isNaN(calculatedPurchase.grandTotal) || calculatedPurchase.grandTotal <= 0) {
      errs.push({
        fieldId: 'purchase-item-price-0',
        label: 'Grand Total',
        message: 'Grand total is invalid. Please verify item quantities and prices.'
      });
    }

    if (errs.length > 0) {
      setValidationErrors(errs);
      return;
    }
    clearValidationErrors();

    const payload = {
      purchaseNo: purchaseForm.purchaseNo || `PUR-${Date.now().toString().slice(-4)}`,
      purchaseType: purchaseForm.purchaseType || 'inventory',
      ourChallanNo: purchaseForm.ourChallanNo || '',
      date: purchaseForm.date || new Date().toISOString().split('T')[0],
      dueDate: purchaseForm.dueDate || undefined,
      vendor: {
        vendorId: purchaseForm.vendor?.vendorId || undefined,
        name: purchaseForm.vendor?.name || vendorFinalName.trim(),
        businessName: purchaseForm.vendor?.businessName || vendorFinalName.trim(),
        phone: purchaseForm.vendor?.phone || '',
        email: purchaseForm.vendor?.email || '',
        gstin: purchaseForm.vendor?.gstin || '',
        billingAddress: purchaseForm.vendor?.billingAddress || '',
        shippingAddress: purchaseForm.vendor?.shippingAddress || '',
        state: purchaseForm.vendor?.state || 'Gujarat',
        stateCode: purchaseForm.vendor?.stateCode || '24'
      },
      vendorName: vendorFinalName.trim(),
      companyEntity: companyEntity || 'Elite Digital Prints',
      items: validItems.map(item => ({
        itemName: item.itemName.trim(),
        description: item.description || '',
        fabric: item.fabric || '',
        fabricName: item.fabricName || '',
        jobNo: item.jobNo || '',
        lotNo: item.lotNo || '',
        partyChallan: item.partyChallan || '',
        ourChallanNo: item.ourChallanNo || '',
        hsnCode: item.hsnCode || '998821',
        qty: parseFloat(item.qty) || 0,
        quantity: parseFloat(item.qty) || 0,
        unit: item.unit || 'Meters',
        unitPrice: parseFloat(item.unitPrice) || 0,
        rate: parseFloat(item.unitPrice) || 0,
        discountPct: parseFloat(item.discountPct) || 0,
        taxRate: parseFloat(item.taxRate) || 0,
        amount: parseFloat(item.totalAmount) || 0,
        totalAmount: parseFloat(item.totalAmount) || 0
      })),
      itemName: validItems.map(i => i.itemName.trim()).join(', '),
      quantity: validItems.reduce((acc, i) => acc + (parseFloat(i.qty) || 0), 0),
      unit: validItems[0]?.unit || 'Meters',
      rate: validItems.length === 1 ? (parseFloat(validItems[0].unitPrice) || 0) : '-',
      subtotal: calculatedPurchase.subtotal,
      subtotalAmount: calculatedPurchase.subtotal,
      taxableAmount: calculatedPurchase.netSubtotal,
      discountType: purchaseForm.discountType || 'flat',
      discountValue: parseFloat(purchaseForm.discountValue) || 0,
      discountTotal: calculatedPurchase.discountTotal,
      taxType: purchaseForm.taxType || 'CGST_SGST',
      gstRate: parseFloat(purchaseForm.gstRate) || 0,
      cgstAmount: calculatedPurchase.cgstAmount,
      sgstAmount: calculatedPurchase.sgstAmount,
      igstAmount: calculatedPurchase.igstAmount,
      totalTax: calculatedPurchase.totalTax,
      gstAmount: calculatedPurchase.totalTax,
      enableRoundOff: purchaseForm.enableRoundOff !== false,
      roundOff: calculatedPurchase.roundOff,
      totalAmount: calculatedPurchase.grandTotal,
      grandTotal: calculatedPurchase.grandTotal,
      paidAmount: parseFloat(purchaseForm.paidAmount) || 0,
      balanceDue: calculatedPurchase.balanceDue,
      paymentStatus: (parseFloat(purchaseForm.paidAmount) || 0) >= calculatedPurchase.grandTotal && calculatedPurchase.grandTotal > 0
        ? 'PAID'
        : (parseFloat(purchaseForm.paidAmount) || 0) > 0
          ? 'PARTIALLY_PAID'
          : 'UNPAID',
      notes: purchaseForm.notes || '',
      terms: purchaseForm.terms || ''
    };

    try {
      if (editingPurchaseId) {
        const isMongoId = /^[0-9a-fA-F]{24}$/.test(editingPurchaseId);
        if (isMongoId) {
          const res = await api.updateBillingPurchase(editingPurchaseId, payload);
          if (res && res.data) {
            setPurchases(prev => prev.map(p => ((p._id === editingPurchaseId || p.id === editingPurchaseId) ? res.data : p)));
          } else {
            setPurchases(prev => prev.map(p => ((p._id === editingPurchaseId || p.id === editingPurchaseId) ? { ...payload, _id: editingPurchaseId, id: editingPurchaseId } : p)));
          }
        } else {
          const res = await api.createBillingPurchase(payload);
          const saved = (res && res.data) ? res.data : { ...payload, id: editingPurchaseId };
          setPurchases(prev => prev.map(p => (p.id === editingPurchaseId ? saved : p)));
        }
        setEditingPurchaseId(null);
      } else {
        const res = await api.createBillingPurchase(payload);
        const saved = (res && res.data) ? res.data : { ...payload, id: `pur_${Date.now()}` };
        setPurchases(prev => [saved, ...prev]);
      }
    } catch (err) {
      console.error('Error saving purchase to DB:', err);
      const fallbackPur = {
        ...payload,
        id: editingPurchaseId || `pur_${Date.now()}`
      };
      if (editingPurchaseId) {
        setPurchases(prev => prev.map(p => (p.id === editingPurchaseId || p._id === editingPurchaseId ? fallbackPur : p)));
        setEditingPurchaseId(null);
      } else {
        setPurchases(prev => [fallbackPur, ...prev]);
      }
    }

    setShowPurchaseModal(false);
    setPurchaseForm({
      purchaseNo: `PUR-2026-00${purchases.length + 2}`,
      purchaseType: 'inventory',
      ourChallanNo: '',
      date: new Date().toISOString().split('T')[0],
      vendor: {
        vendorId: '',
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
      vendorName: '',
      items: [createEmptyPurchaseItem()],
      enableRoundOff: true,
      manualRoundOff: undefined,
      discountType: 'flat',
      discountValue: 0,
      taxType: 'CGST_SGST',
      gstRate: 5,
      paidAmount: 0,
      notes: 'Vendor purchase bill recorded in ERP.'
    });

    triggerPushNotification('Purchase Recorded 📥', `Purchase Bill #${payload.purchaseNo} saved successfully!`, 'success');
  };

  const handleDeletePurchase = async (id, purchaseNo, vendorName) => {
    const ok = await triggerEliteConfirm({
      title: 'Delete Purchase Record',
      message: `Are you sure you want to delete purchase record ${purchaseNo ? `#${purchaseNo}` : ''}? This action permanently purges all duplicates.`,
      confirmText: 'Yes, Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });
    if (!ok) return;
    try {
      await api.deleteBillingPurchase(id, { purchaseNo, vendorName });

      const cleanFilter = p => {
        const matchId = (p._id && (p._id === id || p._id === String(id))) || (p.id && (p.id === id || p.id === String(id)));
        const matchNo = purchaseNo && p.purchaseNo && p.purchaseNo.trim().toLowerCase() === String(purchaseNo).trim().toLowerCase();
        return !matchId && !matchNo;
      };

      setPurchases(prev => prev.filter(cleanFilter));

      // Authoritatively purge from all localStorage cache keys so it never resurrects
      const legacyKeys = [
        `elite_purchases_${companyEntity || 'edp'}`,
        'elite_purchases_edp',
        'elite_purchases_Elite Digital Prints',
        'elite_purchases_Elite Digital Print',
        'elite_purchases_Elite Edition',
        'elite_purchases_Elite Fabtex'
      ];
      legacyKeys.forEach(k => {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              const cleaned = arr.filter(cleanFilter);
              localStorage.setItem(k, JSON.stringify(cleaned));
            }
          }
        } catch (e) {}
      });

      triggerPushNotification('🗑️ Purchase Deleted', 'Purchase record deleted successfully.', 'success');
    } catch (err) {
      console.error('Error deleting purchase:', err);
      setPurchases(prev => prev.filter(p => p._id !== id && p.id !== id && (purchaseNo ? p.purchaseNo !== purchaseNo : true)));
    }
  };

  // Vendor options populated from Billing Vendors Master + historical purchases so no vendor is ever missing
  const vendorOptions = useMemo(() => {
    const list = new Set();

    (vendorsList || []).forEach(v => {
      const vName = v.businessName || v.name;
      if (vName && String(vName).trim()) list.add(String(vName).trim());
    });

    (purchases || []).forEach(p => {
      const pVendor = p.vendorName || (p.vendor && (p.vendor.businessName || p.vendor.name));
      if (pVendor && String(pVendor).trim()) list.add(String(pVendor).trim());
    });

    return Array.from(list).filter(Boolean).sort();
  }, [vendorsList, purchases]);

  // Dynamic list of unique vendors for purchases filter
  const purchaseVendorsList = useMemo(() => {
    const list = new Set();
    (purchases || []).forEach(p => {
      if (p.vendorName && p.vendorName.trim()) list.add(p.vendorName.trim());
    });
    (vendorsList || []).forEach(v => {
      const vName = v.businessName || v.name;
      if (vName && String(vName).trim()) list.add(String(vName).trim());
    });
    return Array.from(list).sort();
  }, [purchases, vendorsList]);

  // Date range object based on preset or custom range
  const purchaseDateRange = useMemo(() => {
    return getDatePresetRange(purchaseDatePreset, purchaseDateStart, purchaseDateEnd);
  }, [purchaseDatePreset, purchaseDateStart, purchaseDateEnd]);

  const hasActivePurchaseFilters = Boolean(
    (purchaseSearch && purchaseSearch.trim()) ||
    purchaseDatePreset !== 'all' ||
    purchaseVendorFilter !== 'ALL' ||
    purchaseGstFilter !== 'ALL' ||
    purchaseTypeFilter !== 'ALL'
  );

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      // 1. Text Search
      if (purchaseSearch && purchaseSearch.trim()) {
        const q = purchaseSearch.toLowerCase().trim();
        const matchNo = p.purchaseNo && p.purchaseNo.toLowerCase().includes(q);
        const matchVendor = p.vendorName && p.vendorName.toLowerCase().includes(q);
        const matchItem = p.itemName && p.itemName.toLowerCase().includes(q);
        const matchChildItems = Array.isArray(p.items) && p.items.some(it => (it.itemName && it.itemName.toLowerCase().includes(q)) || (it.description && it.description.toLowerCase().includes(q)));
        if (!matchNo && !matchVendor && !matchItem && !matchChildItems) return false;
      }

      // 2. Vendor Filter
      if (purchaseVendorFilter && purchaseVendorFilter !== 'ALL') {
        if ((p.vendorName || '').trim().toLowerCase() !== purchaseVendorFilter.trim().toLowerCase()) return false;
      }

      // 3. GST Rate Filter
      if (purchaseGstFilter && purchaseGstFilter !== 'ALL') {
        if (Number(p.gstRate || 0) !== Number(purchaseGstFilter)) return false;
      }

      // 3.5. Purchase Type Filter
      if (purchaseTypeFilter && purchaseTypeFilter !== 'ALL') {
        const pType = p.purchaseType || 'inventory';
        if (pType !== purchaseTypeFilter) return false;
      }

      // 4. Date Range Filter
      if (purchaseDateRange.start || purchaseDateRange.end) {
        if (!p.date) return false;
        const pDate = new Date(p.date);
        if (!isNaN(pDate.getTime())) {
          if (purchaseDateRange.start && pDate < purchaseDateRange.start) return false;
          if (purchaseDateRange.end && pDate > purchaseDateRange.end) return false;
        }
      }

      return true;
    });
  }, [purchases, purchaseSearch, purchaseVendorFilter, purchaseGstFilter, purchaseTypeFilter, purchaseDateRange]);

  const totalPurchaseValue = filteredPurchases.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);
  const totalInwardQty = filteredPurchases.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
  const uniqueVendorsCount = new Set(filteredPurchases.map(p => p.vendorName).filter(Boolean)).size;

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

  // Helper to extract taxable amount and GST tax breakup for Tally accuracy
  const extractInvoiceTaxDetails = (inv) => {
    if (!inv) return { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0, isIgst: false };
    
    let taxable = 0;
    if (inv.taxableAmount !== undefined && inv.taxableAmount !== null && Number(inv.taxableAmount) > 0) {
      taxable = Number(inv.taxableAmount);
    } else if (inv.subtotal !== undefined && inv.subtotal !== null && Number(inv.subtotal) > 0) {
      taxable = Number(inv.subtotal);
    } else if (inv.netSubtotal !== undefined && inv.netSubtotal !== null && Number(inv.netSubtotal) > 0) {
      taxable = Number(inv.netSubtotal);
    }

    const grandTotal = Number(inv.grandTotal || inv.totalAmount || 0);
    let totalTax = Number(inv.totalTax || inv.gstAmount || 0);
    let cgst = Number(inv.cgstAmount || 0);
    let sgst = Number(inv.sgstAmount || 0);
    let igst = Number(inv.igstAmount || 0);

    const isIgst = inv.taxType === 'IGST' || (inv.stateCode && inv.stateCode !== '24') || (inv.customer?.stateCode && inv.customer?.stateCode !== '24');

    if (cgst > 0 || sgst > 0 || igst > 0) {
      totalTax = cgst + sgst + igst;
    }

    if (taxable === 0) {
      if (grandTotal > 0 && totalTax > 0) {
        taxable = Math.max(0, grandTotal - totalTax);
      } else if (grandTotal > 0) {
        taxable = parseFloat((grandTotal / 1.05).toFixed(2));
        totalTax = parseFloat((grandTotal - taxable).toFixed(2));
        if (isIgst) {
          igst = totalTax;
        } else {
          cgst = parseFloat((totalTax / 2).toFixed(2));
          sgst = parseFloat((totalTax / 2).toFixed(2));
        }
      }
    } else if (totalTax === 0 && grandTotal > taxable) {
      totalTax = parseFloat((grandTotal - taxable).toFixed(2));
      if (isIgst) {
        igst = totalTax;
      } else {
        cgst = parseFloat((totalTax / 2).toFixed(2));
        sgst = parseFloat((totalTax / 2).toFixed(2));
      }
    } else if (totalTax > 0 && cgst === 0 && sgst === 0 && igst === 0) {
      if (isIgst) {
        igst = totalTax;
      } else {
        cgst = parseFloat((totalTax / 2).toFixed(2));
        sgst = parseFloat((totalTax / 2).toFixed(2));
      }
    }

    return {
      taxable: parseFloat(taxable.toFixed(2)),
      cgst: parseFloat(cgst.toFixed(2)),
      sgst: parseFloat(sgst.toFixed(2)),
      igst: parseFloat(igst.toFixed(2)),
      totalTax: parseFloat(totalTax.toFixed(2)),
      isIgst
    };
  };

  // Helper to comprehensively resolve customer / party name and GSTIN across invoices and master database
  const resolvePartyInfo = (inv, fallbackParty = null) => {
    let matchedCust = null;
    const invCustId = inv?.customer?.customerId || inv?.customerId || inv?.customer?._id || inv?.customer?.id;
    if (invCustId) {
      matchedCust = customers.find(c => String(c._id) === String(invCustId) || String(c.id) === String(invCustId));
    }

    const rawGst = (
      inv?.customer?.gstin ||
      inv?.customer?.partyGstin ||
      inv?.customerGst ||
      inv?.customerGstin ||
      inv?.partyGstin ||
      inv?.gstin ||
      ''
    ).trim().toUpperCase();

    if (!matchedCust && rawGst && rawGst !== 'N/A' && rawGst !== 'UNDEFINED' && rawGst !== 'NULL') {
      matchedCust = customers.find(c => (c.gstin || '').trim().toUpperCase() === rawGst);
    }

    const rawName = (
      inv?.customer?.businessName ||
      inv?.customer?.name ||
      inv?.customerName ||
      inv?.partyName ||
      inv?.billTo ||
      (typeof inv?.customer === 'string' ? inv?.customer : '') ||
      ''
    ).trim().toLowerCase();

    if (!matchedCust && rawName) {
      matchedCust = customers.find(c => {
        const cBiz = (c.businessName || '').trim().toLowerCase();
        const cName = (c.name || '').trim().toLowerCase();
        return (cBiz && (cBiz === rawName || rawName.includes(cBiz) || cBiz.includes(rawName))) ||
               (cName && (cName === rawName || rawName.includes(cName) || cName.includes(rawName)));
      });
    }

    const rawPhone = (inv?.customer?.phone || inv?.customerPhone || '').trim();
    if (!matchedCust && rawPhone && rawPhone !== 'N/A') {
      matchedCust = customers.find(c => (c.phone || '').trim() === rawPhone);
    }

    const finalCust = matchedCust || (fallbackParty && fallbackParty._id ? fallbackParty : null);

    // Business name is standard for Tally party ledgers, fallback to name or rawName
    const resolvedName = (
      finalCust?.businessName ||
      inv?.customer?.businessName ||
      finalCust?.name ||
      inv?.customer?.name ||
      inv?.customerName ||
      inv?.partyName ||
      inv?.billTo ||
      (typeof inv?.customer === 'string' ? inv?.customer : '') ||
      (fallbackParty?.businessName && fallbackParty.businessName !== 'Global Account Ledger' ? fallbackParty.businessName : '') ||
      (fallbackParty?.name && fallbackParty.name !== 'All Customers' ? fallbackParty.name : '') ||
      'Sundry Debtors'
    ).trim();

    // Clean GSTIN resolution
    const candidateGst = (
      rawGst ||
      finalCust?.gstin ||
      fallbackParty?.gstin ||
      ''
    ).trim().toUpperCase();
    const cleanGst = (candidateGst === 'N/A' || candidateGst === 'UNDEFINED' || candidateGst === 'NULL' || candidateGst === 'NONE') ? '' : candidateGst;

    const resolvedState = (
      finalCust?.state ||
      inv?.customer?.state ||
      inv?.state ||
      fallbackParty?.state ||
      (cleanGst.startsWith('24') ? 'Gujarat (24)' : (cleanGst ? 'Inter-State' : 'Gujarat (24)'))
    );

    const resolvedStateCode = (
      finalCust?.stateCode ||
      inv?.customer?.stateCode ||
      fallbackParty?.stateCode ||
      (cleanGst.length >= 2 && !isNaN(cleanGst.slice(0, 2)) ? cleanGst.slice(0, 2) : '24')
    );

    return {
      partyName: resolvedName,
      partyGstin: cleanGst,
      state: resolvedState,
      stateCode: resolvedStateCode,
      matchedCust: finalCust
    };
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
      if (inv.customer?.customerId && String(inv.customer.customerId) === String(partyId)) return true;

      if (targetParty) {
        const pName = (targetParty.businessName || targetParty.name || '').toLowerCase().trim();
        const pGst = (targetParty.gstin || '').toLowerCase().trim();
        const pPhone = (targetParty.phone || '').toLowerCase().trim();

        const invCustName = (inv.customer?.businessName || inv.customer?.name || inv.customerName || inv.partyName || inv.billTo || (typeof inv.customer === 'string' ? inv.customer : '')).toLowerCase().trim();
        const invGst = (inv.customer?.gstin || inv.customer?.partyGstin || inv.customerGst || inv.customerGstin || inv.partyGstin || inv.gstin || '').toLowerCase().trim();
        const invPhone = (inv.customer?.phone || inv.customerPhone || '').toLowerCase().trim();

        if (pName && invCustName && (invCustName === pName || invCustName.includes(pName) || pName.includes(invCustName))) return true;
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

      const taxDetails = extractInvoiceTaxDetails(inv);
      const partyInfo = resolvePartyInfo(inv, targetParty);
      const pName = partyInfo.partyName;
      const pGstin = partyInfo.partyGstin;
      const pState = partyInfo.state;
      const pStateCode = partyInfo.stateCode;

      if (grandTotal > 0) {
        let prodService = '';
        if (Array.isArray(inv.items) && inv.items.length > 0) {
          const itemNames = Array.from(new Set(inv.items.map(it => it.itemName?.trim()).filter(Boolean)));
          prodService = itemNames.join(', ');
        }
        if (!prodService) {
          prodService = inv.itemName || inv.productName || (inv.department === 'Elite Stitching' ? 'GARMENT STITCHING JOB WORK' : 'DIGITAL PRINT JOB WORK 58"');
        }

        periodTx.push({
          date: formatDateDDMMYYYY(inv.invoiceDate || inv.createdAt),
          rawDate: invDate,
          voucherType: 'Sales',
          voucherNo: inv.invoiceNo || 'INV',
          particulars: `Sales Invoice #${inv.invoiceNo || ''}`,
          department: inv.department || 'Elite Digital Prints',
          partyName: pName,
          partyGstin: pGstin,
          gstin: pGstin,
          state: pState,
          stateCode: pStateCode,
          opposingLedger: prodService,
          productService: prodService,
          taxableAmount: taxDetails.taxable,
          cgstAmount: taxDetails.cgst,
          sgstAmount: taxDetails.sgst,
          igstAmount: taxDetails.igst,
          totalTax: taxDetails.totalTax,
          debit: grandTotal,
          credit: 0,
          narration: `Job Work Digital Printing / Invoice #${inv.invoiceNo || ''}`
        });
      }

      if (paidAmount > 0) {
        const payMode = inv.paymentMode || inv.paymentMethod || 'Bank';
        const isCash = payMode.toLowerCase().includes('cash');
        const pDate = inv.paymentDate ? parseInvDate(inv.paymentDate) : invDate;
        periodTx.push({
          date: formatDateDDMMYYYY(inv.paymentDate || inv.invoiceDate || inv.createdAt),
          rawDate: pDate,
          voucherType: 'Receipt',
          voucherNo: `REC-${inv.invoiceNo || ''}`,
          particulars: `Payment Received (${payMode}) — Invoice #${inv.invoiceNo || ''}`,
          department: inv.department || 'Elite Digital Prints',
          partyName: pName,
          partyGstin: pGstin,
          gstin: pGstin,
          state: pState,
          stateCode: pStateCode,
          opposingLedger: isCash ? 'Cash Account' : 'Bank Account',
          productService: isCash ? 'Cash Account' : 'Bank Account',
          taxableAmount: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
          totalTax: 0,
          debit: 0,
          credit: paidAmount,
          narration: `Payment received against Invoice #${inv.invoiceNo || ''} via ${payMode}`
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

  // ── Helper to Generate Standard Tally XML (Tally.ERP 9 / TallyPrime) ───────
  const generateTallyXML = ({ mode, partyName, partyGstin, partyPhone, ledger, customers, startD, endD }) => {
    const toTallyDate = (dateStr) => {
      if (!dateStr) return new Date().toISOString().slice(0, 10).replace(/-/g, '');
      if (typeof dateStr === 'string' && dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
          return `${year}${month}${day}`;
        }
      }
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}${m}${day}`;
    };

    const escapeXml = (str) => {
      if (str == null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<ENVELOPE>\n';
    xml += '  <HEADER>\n';
    xml += '    <TALLYREQUEST>Import Data</TALLYREQUEST>\n';
    xml += '  </HEADER>\n';
    xml += '  <BODY>\n';
    xml += '    <IMPORTDATA>\n';
    xml += '      <REQUESTDESC>\n';
    xml += `        <REPORTNAME>${mode === 'party' ? 'All Masters &amp; Vouchers' : 'All Masters'}</REPORTNAME>\n`;
    xml += '        <STATICVARIABLES>\n';
    xml += '          <SVCURRENTCOMPANY>ELITE DIGITAL PRINTS</SVCURRENTCOMPANY>\n';
    xml += '        </STATICVARIABLES>\n';
    xml += '      </REQUESTDESC>\n';
    xml += '      <REQUESTDATA>\n';

    if (mode === 'party') {
      // 1. Ledger Master
      xml += '        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n';
      xml += `          <LEDGER NAME="${escapeXml(partyName)}" ACTION="Create">\n`;
      xml += `            <NAME>${escapeXml(partyName)}</NAME>\n`;
      xml += '            <PARENT>Sundry Debtors</PARENT>\n';
      xml += `            <OPENINGBALANCE>${(ledger.openingBalance || 0) > 0 ? (ledger.openingBalance * -1).toFixed(2) : Math.abs(ledger.openingBalance || 0).toFixed(2)}</OPENINGBALANCE>\n`;
      xml += '            <ISBILLWISEON>Yes</ISBILLWISEON>\n';
      if (partyGstin) xml += `            <PARTYGSTIN>${escapeXml(partyGstin)}</PARTYGSTIN>\n`;
      if (partyPhone) xml += `            <LEDGERPHONE>${escapeXml(partyPhone)}</LEDGERPHONE>\n`;
      xml += `            <MAILINGNAME>${escapeXml(partyName)}</MAILINGNAME>\n`;
      xml += '          </LEDGER>\n';
      xml += '        </TALLYMESSAGE>\n';

      // 2. Transactions as Tally Vouchers
      (ledger.transactions || []).forEach(t => {
        const isSales = (t.debit || 0) > 0;
        const vchType = isSales ? 'Sales' : 'Receipt';
        const tallyDate = toTallyDate(t.date);
        const amt = Math.abs(isSales ? t.debit : t.credit);
        const rowPartyName = t.partyName || (partyName !== 'All Customers (Combined)' && partyName !== 'Global Account Ledger' ? partyName : '') || 'Sundry Debtors';
        const rowGstin = (t.partyGstin || t.gstin || partyGstin || '').trim().toUpperCase();
        const cleanGst = (rowGstin === 'N/A' || rowGstin === 'UNDEFINED' || rowGstin === 'NULL') ? '' : rowGstin;

        xml += '        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n';
        xml += `          <VOUCHER VCHTYPE="${vchType}" ACTION="Create" OBJVIEW="Accounting Voucher View">\n`;
        xml += `            <DATE>${tallyDate}</DATE>\n`;
        xml += `            <EFFECTIVEDATE>${tallyDate}</EFFECTIVEDATE>\n`;
        xml += `            <VOUCHERTYPENAME>${vchType}</VOUCHERTYPENAME>\n`;
        xml += `            <VOUCHERNUMBER>${escapeXml(t.voucherNo || 'GEN')}</VOUCHERNUMBER>\n`;
        xml += `            <PARTYLEDGERNAME>${escapeXml(rowPartyName)}</PARTYLEDGERNAME>\n`;
        xml += `            <PARTYNAME>${escapeXml(rowPartyName)}</PARTYNAME>\n`;
        xml += `            <BASICBUYERNAME>${escapeXml(rowPartyName)}</BASICBUYERNAME>\n`;
        if (cleanGst) xml += `            <PARTYGSTIN>${escapeXml(cleanGst)}</PARTYGSTIN>\n`;
        xml += `            <NARRATION>${escapeXml(t.particulars || '')} - ${escapeXml(t.department || 'Digital Print')}</NARRATION>\n`;
        xml += '            <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>\n';

        if (isSales) {
          xml += '            <ALLLEDGERENTRIES.LIST>\n';
          xml += `              <LEDGERNAME>${escapeXml(rowPartyName)}</LEDGERNAME>\n`;
          xml += '              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>\n';
          xml += `              <AMOUNT>-${amt.toFixed(2)}</AMOUNT>\n`;
          xml += '              <BILLALLOCATIONS.LIST>\n';
          xml += `                <NAME>${escapeXml(t.voucherNo || 'INV')}</NAME>\n`;
          xml += '                <BILLTYPE>New Ref</BILLTYPE>\n';
          xml += `                <AMOUNT>-${amt.toFixed(2)}</AMOUNT>\n`;
          xml += '              </BILLALLOCATIONS.LIST>\n';
          xml += '            </ALLLEDGERENTRIES.LIST>\n';

          const taxableVal = t.taxableAmount > 0 ? t.taxableAmount : (amt - (t.totalTax || 0));
          xml += '            <ALLLEDGERENTRIES.LIST>\n';
          xml += '              <LEDGERNAME>Sales - Digital Print</LEDGERNAME>\n';
          xml += '              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n';
          xml += `              <AMOUNT>${taxableVal.toFixed(2)}</AMOUNT>\n`;
          xml += '            </ALLLEDGERENTRIES.LIST>\n';

          if (t.cgstAmount > 0) {
            xml += '            <ALLLEDGERENTRIES.LIST>\n';
            xml += '              <LEDGERNAME>CGST Output Tax</LEDGERNAME>\n';
            xml += '              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n';
            xml += `              <AMOUNT>${t.cgstAmount.toFixed(2)}</AMOUNT>\n`;
            xml += '            </ALLLEDGERENTRIES.LIST>\n';
          }
          if (t.sgstAmount > 0) {
            xml += '            <ALLLEDGERENTRIES.LIST>\n';
            xml += '              <LEDGERNAME>SGST Output Tax</LEDGERNAME>\n';
            xml += '              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n';
            xml += `              <AMOUNT>${t.sgstAmount.toFixed(2)}</AMOUNT>\n`;
            xml += '            </ALLLEDGERENTRIES.LIST>\n';
          }
          if (t.igstAmount > 0) {
            xml += '            <ALLLEDGERENTRIES.LIST>\n';
            xml += '              <LEDGERNAME>IGST Output Tax</LEDGERNAME>\n';
            xml += '              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n';
            xml += `              <AMOUNT>${t.igstAmount.toFixed(2)}</AMOUNT>\n`;
            xml += '            </ALLLEDGERENTRIES.LIST>\n';
          }
        } else {
          xml += '            <ALLLEDGERENTRIES.LIST>\n';
          xml += '              <LEDGERNAME>Bank / Cash Account</LEDGERNAME>\n';
          xml += '              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>\n';
          xml += `              <AMOUNT>-${amt.toFixed(2)}</AMOUNT>\n`;
          xml += '            </ALLLEDGERENTRIES.LIST>\n';

          xml += '            <ALLLEDGERENTRIES.LIST>\n';
          xml += `              <LEDGERNAME>${escapeXml(rowPartyName)}</LEDGERNAME>\n`;
          xml += '              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n';
          xml += `              <AMOUNT>${amt.toFixed(2)}</AMOUNT>\n`;
          xml += '              <BILLALLOCATIONS.LIST>\n';
          xml += `                <NAME>${escapeXml(t.voucherNo || 'Advance')}</NAME>\n`;
          xml += '                <BILLTYPE>Agst Ref</BILLTYPE>\n';
          xml += `                <AMOUNT>${amt.toFixed(2)}</AMOUNT>\n`;
          xml += '              </BILLALLOCATIONS.LIST>\n';
          xml += '            </ALLLEDGERENTRIES.LIST>\n';
        }

        xml += '          </VOUCHER>\n';
        xml += '        </TALLYMESSAGE>\n';
      });
    } else {
      // Mode B: All-Parties Master Ledger
      customers.forEach(cust => {
        const custName = cust.businessName || cust.name || 'Unknown';
        const partyLedger = computePartyLedger(cust._id, startD, endD);
        const opBal = partyLedger.openingBalance || 0;
        const foundGst = (partyLedger.transactions || []).find(x => x.partyGstin || x.gstin);
        const cleanGstin = (cust.gstin || foundGst?.partyGstin || foundGst?.gstin || '').trim().toUpperCase();

        xml += '        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n';
        xml += `          <LEDGER NAME="${escapeXml(custName)}" ACTION="Create">\n`;
        xml += `            <NAME>${escapeXml(custName)}</NAME>\n`;
        xml += '            <PARENT>Sundry Debtors</PARENT>\n';
        xml += `            <OPENINGBALANCE>${opBal > 0 ? (opBal * -1).toFixed(2) : Math.abs(opBal).toFixed(2)}</OPENINGBALANCE>\n`;
        xml += '            <ISBILLWISEON>Yes</ISBILLWISEON>\n';
        if (cleanGstin && cleanGstin !== 'N/A' && cleanGstin !== 'UNDEFINED' && cleanGstin !== 'NULL') xml += `            <PARTYGSTIN>${escapeXml(cleanGstin)}</PARTYGSTIN>\n`;
        if (cust.phone) xml += `            <LEDGERPHONE>${escapeXml(cust.phone)}</LEDGERPHONE>\n`;
        xml += `            <MAILINGNAME>${escapeXml(custName)}</MAILINGNAME>\n`;
        xml += '          </LEDGER>\n';
        xml += '        </TALLYMESSAGE>\n';
      });
    }

    xml += '      </REQUESTDATA>\n';
    xml += '    </IMPORTDATA>\n';
    xml += '  </BODY>\n';
    xml += '</ENVELOPE>\n';

    return xml;
  };

  const handleGenerateLedgerExport = async () => {
    const { startD, endD } = getLedgerDateRange();

    if (ledgerMode === 'party') {
      const selectedParty = customers.find(c => String(c._id) === String(selectedPartyId) || String(c.id) === String(selectedPartyId)) || { name: 'All Customers', businessName: 'Global Account Ledger' };
      const partyName = selectedPartyId === 'ALL' ? 'All Customers (Combined)' : (selectedParty.businessName || selectedParty.name);
      const ledger = computePartyLedger(selectedPartyId, startD, endD);

      if (ledgerFormat === 'tally' || ledgerFormat === 'xml') {
        const xmlContent = generateTallyXML({
          mode: 'party',
          partyName,
          partyGstin: selectedParty.gstin,
          partyPhone: selectedParty.phone,
          ledger,
          customers,
          startD,
          endD
        });
        const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Tally_Ledger_${partyName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xml`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        triggerPushNotification('🏛️ Tally XML Ready', `Tally XML ledger statement for ${partyName} exported successfully.`, 'success');
        return;
      }

      if (ledgerFormat === 'excel') {
        const wb = XLSX.utils.book_new();

        // ── SHEET 1: PARTY LEDGER STATEMENT (Comprehensive with Tax & Voucher Type) ──
        const pGst = (selectedParty?.gstin || '').trim().toUpperCase();
        const cleanPGst = (pGst === 'N/A' || pGst === 'UNDEFINED' || pGst === 'NULL') ? '' : pGst;
        const pPhone = selectedParty?.phone || 'N/A';
        const pState = selectedParty?.state || (cleanPGst.startsWith('24') ? 'Gujarat (24)' : (cleanPGst ? 'Inter-State' : 'Gujarat (24)'));

        const rows = [
          ['ELITE DIGITAL PRINTS — PARTY LEDGER STATEMENT'],
          ['Party Name:', partyName],
          ['GSTIN:', selectedPartyId === 'ALL' ? 'Various / Multi-Party' : (cleanPGst || 'Unregistered'), 'State / POS:', pState, 'Phone:', pPhone],
          ['Period:', `${startD ? formatDateDDMMYYYY(startD) : 'Start'} to ${endD ? formatDateDDMMYYYY(endD) : 'Present'}`],
          ['Opening Balance (₹):', Number(ledger.openingBalance) || 0],
          [],
          ['Date', 'Voucher Type', 'Voucher No', 'Party Ledger Name', 'Party GSTIN', 'Particulars', 'Taxable (₹)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)', 'Debit (₹)', 'Credit (₹)', 'Running Balance (₹)', 'Dr/Cr']
        ];

        let sumTaxable = 0;
        let sumCgst = 0;
        let sumSgst = 0;
        let sumIgst = 0;

        ledger.transactions.forEach(t => {
          sumTaxable += (t.taxableAmount || 0);
          sumCgst += (t.cgstAmount || 0);
          sumSgst += (t.sgstAmount || 0);
          sumIgst += (t.igstAmount || 0);

          const rowParty = t.partyName || (selectedPartyId !== 'ALL' && partyName !== 'All Customers (Combined)' ? partyName : '') || 'Sundry Debtors';
          const rowGstin = (t.partyGstin || t.gstin || (selectedPartyId !== 'ALL' ? cleanPGst : '') || '').trim().toUpperCase();
          const cleanRowGst = (rowGstin === 'N/A' || rowGstin === 'UNDEFINED' || rowGstin === 'NULL') ? '' : rowGstin;

          rows.push([
            t.date,
            t.voucherType || (t.debit > 0 ? 'Sales' : 'Receipt'),
            t.voucherNo,
            rowParty,
            cleanRowGst,
            t.particulars,
            Number(t.taxableAmount) || 0,
            Number(t.cgstAmount) || 0,
            Number(t.sgstAmount) || 0,
            Number(t.igstAmount) || 0,
            Number(t.debit) || 0,
            Number(t.credit) || 0,
            Number(Math.abs(t.runningBalance)) || 0,
            t.balType
          ]);
        });

        rows.push([]);
        rows.push([
          'TOTALS',
          '',
          '',
          '',
          '',
          '',
          parseFloat(sumTaxable.toFixed(2)),
          parseFloat(sumCgst.toFixed(2)),
          parseFloat(sumSgst.toFixed(2)),
          parseFloat(sumIgst.toFixed(2)),
          Number(ledger.totalDebit) || 0,
          Number(ledger.totalCredit) || 0,
          Number(Math.abs(ledger.closingBalance)) || 0,
          ledger.closingBalance >= 0 ? 'Dr' : 'Cr'
        ]);

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
          { wch: 13 }, // Date
          { wch: 14 }, // Voucher Type
          { wch: 20 }, // Voucher No
          { wch: 32 }, // Party Ledger Name
          { wch: 18 }, // Party GSTIN
          { wch: 42 }, // Particulars
          { wch: 15 }, // Taxable
          { wch: 12 }, // CGST
          { wch: 12 }, // SGST
          { wch: 12 }, // IGST
          { wch: 15 }, // Debit
          { wch: 15 }, // Credit
          { wch: 18 }, // Running Bal
          { wch: 8 },  // Dr/Cr
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Party Statement');

        // ── SHEET 2: TALLY PRIME / ACCOUNTING IMPORT FORMAT ──
        const sortVouchersInSeries = (list) => {
          return [...(list || [])].sort((a, b) => {
            const parseSeq = (str) => {
              if (!str) return null;
              const m = String(str).match(/(\d+)(?!.*\d)/);
              return m ? parseInt(m[1], 10) : null;
            };
            const seqA = parseSeq(a.voucherNo);
            const seqB = parseSeq(b.voucherNo);
            if (seqA !== null && seqB !== null && seqA !== seqB) {
              return seqA - seqB;
            }
            const cmp = String(a.voucherNo || '').localeCompare(String(b.voucherNo || ''), undefined, { numeric: true, sensitivity: 'base' });
            if (cmp !== 0) return cmp;
            return (a.rawDate || 0) - (b.rawDate || 0);
          });
        };

        const sortedPartyTransactions = sortVouchersInSeries(ledger.transactions);

        const tallyRows = [
          ['Date', 'Voucher Type', 'Voucher No', 'Party Ledger Name', 'Product / Service', 'Taxable Amount (₹)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)', 'Round Off (₹)', 'Total Amount (₹)', 'Place of Supply', 'Party GSTIN']
        ];

        sortedPartyTransactions.forEach(t => {
          const vType = t.voucherType || (t.debit > 0 ? 'Sales' : 'Receipt');
          const prodService = t.productService || t.opposingLedger || (vType === 'Sales' ? (t.department === 'Elite Stitching' ? 'GARMENT STITCHING JOB WORK' : 'DIGITAL PRINT JOB WORK 58"') : 'Bank Account');
          const baseTot = Number(t.debit > 0 ? t.debit : t.credit) || 0;

          const rowPartyName = t.partyName || (selectedPartyId !== 'ALL' && partyName !== 'All Customers (Combined)' ? partyName : '') || 'Sundry Debtors';
          const rowGstin = (t.partyGstin || t.gstin || (selectedPartyId !== 'ALL' ? cleanPGst : '') || '').trim().toUpperCase();
          const cleanRowGst = (rowGstin === 'N/A' || rowGstin === 'UNDEFINED' || rowGstin === 'NULL') ? '' : rowGstin;
          const rowState = t.state || pState || (cleanRowGst.startsWith('24') ? 'Gujarat (24)' : 'Gujarat (24)');

          const rawTaxable = Number(t.taxableAmount) || 0;
          const rawCgst = Number(t.cgstAmount) || 0;
          const rawSgst = Number(t.sgstAmount) || 0;
          const rawIgst = Number(t.igstAmount) || 0;

          let rawTaxSum = parseFloat((rawTaxable + rawCgst + rawSgst + rawIgst).toFixed(2));
          if (rawTaxSum === 0 && baseTot > 0) {
            rawTaxSum = parseFloat(baseTot.toFixed(2));
          }

          // Round Off: decimals >= 0.50 adds the round off, < 0.50 decreases to result in an exact integer total
          const roundedTotal = Math.round(rawTaxSum);
          const roundOff = parseFloat((roundedTotal - rawTaxSum).toFixed(2));

          tallyRows.push([
            t.date,
            vType,
            t.voucherNo,
            rowPartyName,
            prodService,
            rawTaxable,
            rawCgst,
            rawSgst,
            rawIgst,
            roundOff,
            roundedTotal,
            rowState,
            cleanRowGst
          ]);
        });

        const wsTally = XLSX.utils.aoa_to_sheet(tallyRows);
        wsTally['!cols'] = [
          { wch: 13 }, // Date
          { wch: 14 }, // Voucher Type
          { wch: 20 }, // Voucher No
          { wch: 32 }, // Party Ledger Name
          { wch: 32 }, // Product / Service
          { wch: 18 }, // Taxable Amount (₹)
          { wch: 12 }, // CGST (₹)
          { wch: 12 }, // SGST (₹)
          { wch: 12 }, // IGST (₹)
          { wch: 14 }, // Round Off (₹)
          { wch: 18 }, // Total Amount (₹)
          { wch: 18 }, // Place of Supply
          { wch: 18 }, // Party GSTIN
        ];
        XLSX.utils.book_append_sheet(wb, wsTally, 'Tally Import Format');

        const fileName = `Ledger_${partyName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        triggerPushNotification('📊 Excel Export Ready', `Party statement & Tally format for ${partyName} exported as XLSX.`, 'success');
        return;
      }

      if (ledgerFormat === 'csv') {
        let csvContent = `ELITE DIGITAL PRINTS — PARTY LEDGER STATEMENT\n`;
        csvContent += `Party Name: "${partyName}"\n`;
        csvContent += `Period: ${startD ? formatDateDDMMYYYY(startD) : 'Start'} to ${endD ? formatDateDDMMYYYY(endD) : 'Present'}\n`;
        csvContent += `Opening Balance: ₹ ${ledger.openingBalance.toFixed(2)}\n\n`;
        csvContent += `Date,Voucher No,Party Ledger Name,Party GSTIN,Particulars,Department,Debit (₹),Credit (₹),Running Balance (₹),Dr/Cr\n`;

        ledger.transactions.forEach(t => {
          const rowParty = t.partyName || (selectedPartyId !== 'ALL' && partyName !== 'All Customers (Combined)' ? partyName : '') || 'Sundry Debtors';
          const rowGstin = (t.partyGstin || t.gstin || (selectedPartyId !== 'ALL' ? selectedParty.gstin : '') || '').trim().toUpperCase();
          const cleanRowGst = (rowGstin === 'N/A' || rowGstin === 'UNDEFINED' || rowGstin === 'NULL') ? '' : rowGstin;
          csvContent += `"${t.date}","${t.voucherNo}","${rowParty}","${cleanRowGst}","${t.particulars}","${t.department}",${t.debit.toFixed(2)},${t.credit.toFixed(2)},${Math.abs(t.runningBalance).toFixed(2)},"${t.balType}"\n`;
        });

        csvContent += `\nTOTALS,,,,,"",${ledger.totalDebit.toFixed(2)},${ledger.totalCredit.toFixed(2)},${Math.abs(ledger.closingBalance).toFixed(2)},"${ledger.closingBalance >= 0 ? 'Dr' : 'Cr'}"\n`;

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
        const htmlContent = `
          <div style="font-family: 'Segoe UI', Arial, Helvetica, sans-serif; padding: 15px; color: #0f172a; font-size: 11px; line-height: 1.4;">
            <style>
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
            </style>

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
          </div>
        `;

        await openPrintOptionsDialog({
          title: `Party Ledger — ${partyName}`,
          content: htmlContent,
          defaultSettings: {
            paperSize: 'A4',
            orientation: 'portrait',
            margin: 'default'
          }
        });
        triggerPushNotification('📄 Ledger Ready', `Party statement print ready for ${partyName}.`, 'success');
      }
    } else {
      // Mode B: Master Ledger Export
      if (ledgerFormat === 'tally' || ledgerFormat === 'xml') {
        const xmlContent = generateTallyXML({
          mode: 'master',
          customers,
          startD,
          endD
        });
        const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Tally_Master_Ledgers_${new Date().toISOString().split('T')[0]}.xml`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        triggerPushNotification('🏛️ Tally XML Ready', `All-Parties Tally XML Master Ledgers exported successfully.`, 'success');
        return;
      }

      if (ledgerFormat === 'excel') {
        const wb = XLSX.utils.book_new();

        // ── SHEET 1: ALL-PARTIES MASTER SUMMARY ──
        const rows = [
          ['ELITE DIGITAL PRINTS — ALL-PARTIES MASTER LEDGER SUMMARY'],
          ['Report Date:', new Date().toLocaleDateString('en-IN')],
          ['Period:', `${startD ? formatDateDDMMYYYY(startD) : 'Start'} to ${endD ? formatDateDDMMYYYY(endD) : 'Present'}`],
          [],
          ['Party Code', 'Party Name', 'GSTIN', 'State / POS', 'Phone', 'Opening Balance (₹)', 'Total Billed (₹)', 'Total Paid (₹)', 'Closing Balance (₹)', 'Status']
        ];

        let grandBilled = 0;
        let grandPaid = 0;
        let grandBal = 0;
        const allTransactions = [];

        customers.forEach(cust => {
          const partyLedger = computePartyLedger(cust._id, startD, endD);
          grandBilled += partyLedger.totalDebit;
          grandPaid += partyLedger.totalCredit;
          grandBal += partyLedger.closingBalance;

          const pName = cust.businessName || cust.name || 'Party';
          const foundGst = (partyLedger.transactions || []).find(x => x.partyGstin || x.gstin);
          const rawCustGst = (cust.gstin || foundGst?.partyGstin || foundGst?.gstin || '').trim().toUpperCase();
          const cleanCustGst = (rawCustGst === 'N/A' || rawCustGst === 'UNDEFINED' || rawCustGst === 'NULL') ? '' : rawCustGst;
          const pState = cust.state || (cleanCustGst.startsWith('24') ? 'Gujarat (24)' : (cleanCustGst ? 'Inter-State' : 'Gujarat (24)'));

          (partyLedger.transactions || []).forEach(tx => {
            const txGst = (tx.partyGstin || tx.gstin || cleanCustGst || '').trim().toUpperCase();
            const cleanTxGst = (txGst === 'N/A' || txGst === 'UNDEFINED' || txGst === 'NULL') ? '' : txGst;
            allTransactions.push({
              ...tx,
              partyCode: `CUST-${cust._id.slice(-4).toUpperCase()}`,
              partyName: tx.partyName || pName,
              partyGstin: cleanTxGst,
              partyState: tx.state || pState
            });
          });

          rows.push([
            `CUST-${cust._id.slice(-4).toUpperCase()}`,
            pName,
            cleanCustGst || 'Unregistered',
            pState,
            cust.phone || 'N/A',
            Number(partyLedger.openingBalance) || 0,
            Number(partyLedger.totalDebit) || 0,
            Number(partyLedger.totalCredit) || 0,
            Number(partyLedger.closingBalance) || 0,
            partyLedger.closingBalance > 0 ? 'Overdue' : 'Active'
          ]);
        });

        // Include any standalone invoices not linked to customers list
        const processedInvNos = new Set(allTransactions.map(t => t.voucherNo));
        invoices.forEach(inv => {
          if (!inv.invoiceNo || processedInvNos.has(inv.invoiceNo)) return;
          const invDate = new Date(inv.invoiceDate || inv.createdAt);
          if (startD && invDate < startD) return;
          if (endD && invDate > endD) return;

          const pInfo = resolvePartyInfo(inv, null);
          const grandTotal = Number(inv.grandTotal || inv.totalAmount || 0);
          const taxD = extractInvoiceTaxDetails(inv);
          if (grandTotal > 0) {
            let prodService = '';
            if (Array.isArray(inv.items) && inv.items.length > 0) {
              const itemNames = Array.from(new Set(inv.items.map(it => it.itemName?.trim()).filter(Boolean)));
              prodService = itemNames.join(', ');
            }
            if (!prodService) {
              prodService = inv.itemName || inv.productName || (inv.department === 'Elite Stitching' ? 'GARMENT STITCHING JOB WORK' : 'DIGITAL PRINT JOB WORK 58"');
            }

            allTransactions.push({
              date: formatDateDDMMYYYY(inv.invoiceDate || inv.createdAt),
              rawDate: invDate,
              voucherType: 'Sales',
              voucherNo: inv.invoiceNo,
              particulars: `Sales Invoice #${inv.invoiceNo}`,
              department: inv.department || 'Elite Digital Prints',
              partyCode: 'CUST-WALK',
              partyName: pInfo.partyName,
              partyGstin: pInfo.partyGstin,
              partyState: pInfo.state,
              opposingLedger: prodService,
              productService: prodService,
              taxableAmount: taxD.taxable,
              cgstAmount: taxD.cgst,
              sgstAmount: taxD.sgst,
              igstAmount: taxD.igst,
              totalTax: taxD.totalTax,
              debit: grandTotal,
              credit: 0,
              narration: `Job Work Digital Printing / Invoice #${inv.invoiceNo}`
            });
          }
        });

        rows.push([]);
        rows.push([
          'GRAND TOTALS',
          '',
          '',
          '',
          '',
          '',
          Number(grandBilled) || 0,
          Number(grandPaid) || 0,
          Number(grandBal) || 0,
          ''
        ]);

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
          { wch: 14 },
          { wch: 35 },
          { wch: 20 },
          { wch: 18 },
          { wch: 16 },
          { wch: 20 },
          { wch: 20 },
          { wch: 20 },
          { wch: 22 },
          { wch: 12 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Master Summary');

        // ── SHEET 2: ALL VOUCHERS FOR TALLY IMPORT (INVOICES IN SERIES) ──
        allTransactions.sort((a, b) => {
          const parseSeq = (str) => {
            if (!str) return null;
            const m = String(str).match(/(\d+)(?!.*\d)/);
            return m ? parseInt(m[1], 10) : null;
          };
          const seqA = parseSeq(a.voucherNo);
          const seqB = parseSeq(b.voucherNo);
          if (seqA !== null && seqB !== null && seqA !== seqB) {
            return seqA - seqB;
          }
          const cmp = String(a.voucherNo || '').localeCompare(String(b.voucherNo || ''), undefined, { numeric: true, sensitivity: 'base' });
          if (cmp !== 0) return cmp;
          return (a.rawDate || 0) - (b.rawDate || 0);
        });

        const tallyRows = [
          ['Date', 'Voucher Type', 'Voucher No', 'Party Ledger Name', 'Product / Service', 'Taxable Amount (₹)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)', 'Round Off (₹)', 'Total Amount (₹)', 'Place of Supply', 'Party GSTIN']
        ];

        allTransactions.forEach(t => {
          const vType = t.voucherType || (t.debit > 0 ? 'Sales' : 'Receipt');
          const prodService = t.productService || t.opposingLedger || (vType === 'Sales' ? (t.department === 'Elite Stitching' ? 'GARMENT STITCHING JOB WORK' : 'DIGITAL PRINT JOB WORK 58"') : 'Bank Account');
          const baseTot = Number(t.debit > 0 ? t.debit : t.credit) || 0;

          const rowPartyName = t.partyName || 'Sundry Debtors';
          const rowGstin = (t.partyGstin || t.gstin || '').trim().toUpperCase();
          const cleanRowGst = (rowGstin === 'N/A' || rowGstin === 'UNDEFINED' || rowGstin === 'NULL') ? '' : rowGstin;
          const rowState = t.partyState || t.state || (cleanRowGst.startsWith('24') ? 'Gujarat (24)' : (cleanRowGst ? 'Inter-State' : 'Gujarat (24)'));

          const rawTaxable = Number(t.taxableAmount) || 0;
          const rawCgst = Number(t.cgstAmount) || 0;
          const rawSgst = Number(t.sgstAmount) || 0;
          const rawIgst = Number(t.igstAmount) || 0;

          let rawTaxSum = parseFloat((rawTaxable + rawCgst + rawSgst + rawIgst).toFixed(2));
          if (rawTaxSum === 0 && baseTot > 0) {
            rawTaxSum = parseFloat(baseTot.toFixed(2));
          }

          // Round Off: decimals >= 0.50 adds the round off, < 0.50 decreases to result in an exact integer total
          const roundedTotal = Math.round(rawTaxSum);
          const roundOff = parseFloat((roundedTotal - rawTaxSum).toFixed(2));

          tallyRows.push([
            t.date,
            vType,
            t.voucherNo,
            rowPartyName,
            prodService,
            rawTaxable,
            rawCgst,
            rawSgst,
            rawIgst,
            roundOff,
            roundedTotal,
            rowState,
            cleanRowGst
          ]);
        });

        const wsTally = XLSX.utils.aoa_to_sheet(tallyRows);
        wsTally['!cols'] = [
          { wch: 13 }, // Date
          { wch: 14 }, // Voucher Type
          { wch: 20 }, // Voucher No
          { wch: 32 }, // Party Ledger Name
          { wch: 32 }, // Product / Service
          { wch: 18 }, // Taxable Amount (₹)
          { wch: 12 }, // CGST (₹)
          { wch: 12 }, // SGST (₹)
          { wch: 12 }, // IGST (₹)
          { wch: 14 }, // Round Off (₹)
          { wch: 18 }, // Total Amount (₹)
          { wch: 18 }, // Place of Supply
          { wch: 18 }, // Party GSTIN
        ];
        XLSX.utils.book_append_sheet(wb, wsTally, 'Tally All Vouchers');

        const fileName = `Master_Ledger_Summary_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        triggerPushNotification('📊 Excel Export Ready', `All-Parties Master Ledger & Tally format exported as XLSX.`, 'success');
        return;
      }

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

  const getAmountWithoutGst = useCallback((inv) => {
    if (!inv) return 0;
    if (inv.subtotal !== undefined && inv.subtotal !== null && Number(inv.subtotal) > 0) {
      return Number(inv.subtotal);
    }
    if (inv.netSubtotal !== undefined && inv.netSubtotal !== null && Number(inv.netSubtotal) > 0) {
      return Number(inv.netSubtotal);
    }
    if (inv.taxableAmount !== undefined && inv.taxableAmount !== null && Number(inv.taxableAmount) > 0) {
      return Number(inv.taxableAmount);
    }
    const gTotal = Number(inv.grandTotal || inv.totalAmount || 0);
    const tax = Number(inv.totalTax || inv.gstAmount || (Number(inv.cgstAmount || 0) + Number(inv.sgstAmount || 0) + Number(inv.igstAmount || 0)) || 0);
    if (gTotal > 0 && tax > 0) {
      return Math.max(0, gTotal - tax);
    }
    if (gTotal > 0) {
      return gTotal / 1.05;
    }
    return 0;
  }, []);

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
      const amountExclGst = getAmountWithoutGst(inv);
      const paid = Number(inv.paidAmount || 0);
      const balance = Math.max(0, amountExclGst - paid);

      totalInvoiced += amountExclGst;
      totalPaid += paid;
      totalBalanceDue += balance;

      const grandTotal = Number(inv.grandTotal || inv.totalAmount || 0);
      if (inv.paymentStatus === 'PAID' || (grandTotal - paid) <= 0) {
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
  }, [periodInvoices, getAmountWithoutGst]);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [signedCopyFilter, setSignedCopyFilter] = useState('All');
  const [customerSearch, setCustomerSearch] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
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
  const [printingInvoiceId, setPrintingInvoiceId] = useState(null);
  const [previewImageModal, setPreviewImageModal] = useState(null);

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
    const list = Array.isArray(customers) ? customers : [];
    if (!customerSearch) return list;
    const q = customerSearch.toLowerCase();
    return list.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.businessName || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.gstin || '').toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const filteredVendors = useMemo(() => {
    const list = Array.isArray(vendorsList) ? vendorsList : [];
    if (!vendorSearch || !vendorSearch.trim()) return list;
    const q = vendorSearch.toLowerCase().trim();
    return list.filter(v =>
      (v.name || '').toLowerCase().includes(q) ||
      (v.businessName || '').toLowerCase().includes(q) ||
      (v.phone || '').toLowerCase().includes(q) ||
      (v.gstin || '').toLowerCase().includes(q) ||
      (v.email || '').toLowerCase().includes(q)
    );
  }, [vendorsList, vendorSearch]);

  const filteredItems = useMemo(() => {
    const list = Array.isArray(itemsList) ? itemsList : [];
    if (!itemSearch) return list;
    const q = itemSearch.toLowerCase();
    return list.filter(i =>
      (i.itemName || '').toLowerCase().includes(q) ||
      (i.hsnCode || '').toLowerCase().includes(q) ||
      (i.category || '').toLowerCase().includes(q)
    );
  }, [itemsList, itemSearch]);

  // Delete Customer
  const handleDeleteCustomer = async (id, name) => {
    const ok = await triggerEliteConfirm({
      title: 'Delete Customer',
      message: `Are you sure you want to delete customer "${name}"?`,
      confirmText: 'Yes, Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });
    if (!ok) return;
    try {
      await api.deleteBillingCustomer(id);
      setCustomers(prev => prev.filter(c => c._id !== id));
      triggerPushNotification('🗑️ Customer Deleted', `Customer "${name}" deleted.`, 'info');
    } catch (err) {
      alert(err.message || 'Failed to delete customer');
    }
  };

  // Delete Vendor
  const handleDeleteVendor = async (id, name) => {
    const ok = await triggerEliteConfirm({
      title: 'Delete Vendor',
      message: `Are you sure you want to delete vendor "${name}"?`,
      confirmText: 'Yes, Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });
    if (!ok) return;
    try {
      await api.deleteBillingVendor(id);
      setVendorsList(prev => prev.filter(v => (v._id || v.id) !== id));
      triggerPushNotification('🗑️ Vendor Deleted', `Vendor "${name}" deleted.`, 'info');
    } catch (err) {
      alert(err.message || 'Failed to delete vendor');
    }
  };

  // Delete Item
  const handleDeleteItem = async (id, name) => {
    const ok = await triggerEliteConfirm({
      title: 'Delete Product',
      message: `Are you sure you want to delete product "${name}"?`,
      confirmText: 'Yes, Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });
    if (!ok) return;
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

  // New Vendor Modal State
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [editingVendorId, setEditingVendorId] = useState(null);
  const [vendorForm, setVendorForm] = useState({
    name: '', businessName: '', phone: '', email: '', gstin: '', billingAddress: '', state: 'Gujarat', stateCode: '24', vendorType: 'General Supplier'
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
      const [sRes, iRes, cRes, itemRes, vRes] = await Promise.all([
        api.getBillingDashboardStats(companyEntity),
        api.getBillingInvoices({ companyEntity, search, paymentStatus: statusFilter }),
        api.getBillingCustomers(companyEntity),
        api.getBillingItems(companyEntity),
        api.getBillingVendors(companyEntity).catch(err => {
          console.warn('Billing vendors load warning:', err);
          return { data: [] };
        })
      ]);

      if (sRes?.data) setStats(sRes.data);
      if (iRes?.data) setInvoices(Array.isArray(iRes.data) ? iRes.data : []);
      if (cRes?.data) setCustomers(Array.isArray(cRes.data) ? cRes.data : []);
      if (itemRes?.data) setItemsList(Array.isArray(itemRes.data) ? itemRes.data : []);
      if (vRes) {
        const vData = Array.isArray(vRes.data) ? vRes.data : (Array.isArray(vRes) ? vRes : []);
        setVendorsList(vData);
      }
    } catch (err) {
      setError(err.message || 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = loadData;

  useEffect(() => {
    loadData();
  }, [search, statusFilter, companyEntity]);

  // Auto-populate Invoice from Challan with Saved Customer Auto-Selection & Multi-Challan Merging
  const loadInvoiceFromChallan = async (chInput) => {
    if (!chInput) return;
    try {
      const challanList = Array.isArray(chInput) ? chInput : [chInput];
      if (challanList.length === 0) return;

      // STRICT GUARD: Cannot bill already billed challans
      const alreadyBilled = challanList.filter(c => c && (c.status === 'INVOICED' || c.billingStatus === 'INVOICED' || c.isBilled || Boolean(c.invoiceNo)));
      if (alreadyBilled.length > 0) {
        const details = alreadyBilled.map(c => `Challan #${c.challanNo}${c.invoiceNo ? ` (Invoice #${c.invoiceNo})` : ''}`).join(', ');
        triggerEliteAlert('Already Invoiced', `Cannot generate bill: The following challan(s) are already billed:\n${details}\n\nA delivery challan cannot be billed a 2nd time.`, 'error');
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
      if (initialChallanData.isJobCardChallan) {
        setActiveTab('challans');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('open-new-challan', { detail: initialChallanData }));
        }, 100);
      } else {
        loadInvoiceFromChallan(initialChallanData);
      }
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
        const nextRes = await api.getNextInvoiceNo(companyEntity);
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

  // Standardized Invoice Clone Workflow (Line items duplicated, dates & status reset, quantity focused)
  const handleCloneInvoice = async (invoiceToClone) => {
    try {
      const cloned = cloneDocumentPayload(invoiceToClone, 'invoice');
      if (!cloned) return;

      let nextNo = '';
      try {
        const nextRes = await api.getNextInvoiceNo(companyEntity);
        if (nextRes?.invoiceNo) nextNo = nextRes.invoiceNo;
      } catch (err) {}

      if (!nextNo) {
        nextNo = `DRAFT-INV-${Date.now().toString().slice(-4)}`;
      }

      cloned.invoiceNo = nextNo;
      setEditingInvoiceId(null);
      setInvoiceForm(cloned);
      setActiveTab('create');

      triggerPushNotification('Invoice Cloned 📋', `Cloned #${invoiceToClone.invoiceNo || 'original'} into new draft #${nextNo}. Quantity field focused.`, 'info');
      focusPrimaryQuantityInput('[data-primary-qty="true"]', 200);
    } catch (err) {
      console.error('Failed to clone invoice:', err);
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

  const handleResyncMetersFromChallans = async () => {
    try {
      const [resChallans, resJobs] = await Promise.all([
        api.getFabricChallans(),
        api.getJobCards().catch(() => ({ data: [] }))
      ]);
      const allChallans = Array.isArray(resChallans) ? resChallans : (resChallans?.data || []);
      const allJobs = Array.isArray(resJobs) ? resJobs : (resJobs?.data || []);

      let updatedCount = 0;
      setInvoiceForm(f => {
        const updatedItems = f.items.map(it => {
          const itemChallanNoStr = String(it.ourChallanNo || it.description || f.ourChallanNo || '').toUpperCase();
          const matchChallan = allChallans.find(c => {
            if (it.challanId && String(c._id) === String(it.challanId)) return true;
            const cNo = `EDP-${c.challanNo}`.toUpperCase();
            const rawNo = String(c.challanNo);
            return itemChallanNoStr.includes(cNo) || itemChallanNoStr.includes(rawNo);
          });

          if (!matchChallan) return it;

          let itemChanged = false;
          const updatedItem = { ...it };

          // 1. Re-sync Metres / Qty
          if (matchChallan.totalMtr !== undefined && matchChallan.totalMtr !== null) {
            const newMtr = Number(matchChallan.totalMtr) || 0;
            if (newMtr > 0 && newMtr !== Number(it.qty)) {
              updatedItem.qty = newMtr;
              itemChanged = true;
            }
          }

          // 2. Re-sync Fabric Name & Description from Challan / Job Card
          const chJobNo = String(matchChallan.jobNo || it.jobNo || '').trim();
          const matchedJob = chJobNo ? allJobs.find(j => {
            const jNum = String(j.jobNo || '').replace(/\D/g, '');
            const targetNum = chJobNo.replace(/\D/g, '');
            return (targetNum && jNum === targetNum) || String(j.jobNo).toUpperCase() === chJobNo.toUpperCase();
          }) : null;

          const latestFabric = (matchChallan.fabricName || matchChallan.fabric || matchedJob?.fabric || '').trim();
          const chNoStr = matchChallan.challanNo
            ? (String(matchChallan.challanNo).startsWith('PCH') || String(matchChallan.challanNo).startsWith('EDP')
                ? String(matchChallan.challanNo)
                : `EDP-${matchChallan.challanNo}`)
            : (it.ourChallanNo || '');

          if (latestFabric) {
            if (updatedItem.fabric !== latestFabric || updatedItem.fabricName !== latestFabric) {
              updatedItem.fabric = latestFabric;
              updatedItem.fabricName = latestFabric;
              itemChanged = true;
            }

            const expectedDesc = chNoStr ? `Challan ${chNoStr} | Fabric: ${latestFabric}` : `Fabric: ${latestFabric}`;
            if (updatedItem.description !== expectedDesc) {
              updatedItem.description = expectedDesc;
              itemChanged = true;
            }
          }

          // 3. Re-sync Item Name if panna changed
          const pannaStr = String(matchChallan.panna || matchedJob?.panna || '').trim();
          if (pannaStr && updatedItem.itemName && updatedItem.itemName.startsWith('DIGITAL PRINT JOB WORK')) {
            let newItemName = 'DIGITAL PRINT JOB WORK 58"';
            if (pannaStr.includes('36')) newItemName = 'DIGITAL PRINT JOB WORK 36"';
            else if (pannaStr.includes('44')) newItemName = 'DIGITAL PRINT JOB WORK 44"';
            else if (pannaStr.includes('58')) newItemName = 'DIGITAL PRINT JOB WORK 58"';
            else if (pannaStr) newItemName = `DIGITAL PRINT JOB WORK ${pannaStr.replace(/['"]/g, '')}"`;

            if (updatedItem.itemName !== newItemName) {
              updatedItem.itemName = newItemName;
              itemChanged = true;
            }
          }

          // 4. Re-sync Job No, Lot No, Vendor Challan, Design Image
          if (matchChallan.jobNo && matchChallan.jobNo !== updatedItem.jobNo) {
            updatedItem.jobNo = matchChallan.jobNo;
            itemChanged = true;
          }
          if (matchChallan.lotNo && matchChallan.lotNo !== updatedItem.lotNo) {
            updatedItem.lotNo = matchChallan.lotNo;
            itemChanged = true;
          }
          const vChallan = matchChallan.vendorChallanNo || matchChallan.partyChallan || '';
          if (vChallan && vChallan !== updatedItem.partyChallan) {
            updatedItem.partyChallan = vChallan;
            itemChanged = true;
          }
          const dImg = matchChallan.designImage || matchChallan.imageUrl || matchedJob?.imageUrl1 || matchedJob?.imageUrl2 || '';
          if (dImg && !updatedItem.imageUrl) {
            updatedItem.imageUrl = dImg;
            itemChanged = true;
          }

          if (itemChanged) {
            updatedCount++;
            return updatedItem;
          }
          return it;
        });

        return { ...f, items: updatedItems };
      });

      if (updatedCount > 0) {
        triggerPushNotification('🔄 Challan Details Re-synced!', `Updated ${updatedCount} line item(s) with latest Fabric Name, Metres & details from Delivery Challan(s).`, 'success');
      } else {
        triggerPushNotification('ℹ️ Details Up-to-Date', 'Line item Fabric Name and Metres are already up-to-date with Delivery Challans.', 'info');
      }
    } catch (e) {
      console.error('Error re-syncing details from challans:', e);
      triggerEliteAlert('Sync Error', 'Failed to fetch latest Delivery Challans to re-sync details.', 'error');
    }
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
    const custName = invoiceForm.customer?.name || invoiceForm.customer?.businessName || invoiceForm.customerName;
    const errs = [];

    if (!custName || !custName.trim()) {
      errs.push({
        fieldId: 'invoice-customer-name',
        label: 'Customer Selection',
        message: 'Customer / Party name is required'
      });
    }

    const invItems = calculatedInvoice.items || [];
    const validInvItems = invItems.filter(it => it.itemName && it.itemName.trim() !== '');
    if (validInvItems.length === 0) {
      errs.push({
        fieldId: 'invoice-item-name-0',
        label: 'Line Items',
        message: 'Please add at least one line item'
      });
    } else {
      invItems.forEach((it, idx) => {
        if (!it.itemName || !it.itemName.trim()) {
          errs.push({
            fieldId: `invoice-item-name-${idx}`,
            label: `Item #${idx + 1} Name`,
            message: 'Item description cannot be empty'
          });
        }
        if (!it.qty || Number(it.qty) <= 0) {
          errs.push({
            fieldId: `invoice-item-qty-${idx}`,
            label: `Item #${idx + 1} Qty`,
            message: 'Quantity must be greater than 0'
          });
        }
        if (it.unitPrice == null || Number(it.unitPrice) < 0) {
          errs.push({
            fieldId: `invoice-item-price-${idx}`,
            label: `Item #${idx + 1} Price`,
            message: 'Unit price cannot be negative'
          });
        }
      });
    }

    if (!calculatedInvoice.grandTotal || isNaN(calculatedInvoice.grandTotal) || calculatedInvoice.grandTotal <= 0) {
      errs.push({
        fieldId: 'invoice-item-price-0',
        label: 'Grand Total',
        message: 'Grand Total is invalid. Please check item prices and quantities.'
      });
    }

    if (errs.length > 0) {
      setValidationErrors(errs);
      return;
    }
    clearValidationErrors();

    setLoading(true);
    try {
      // Strip UI-only fields and build clean payload
      const { manualRoundOff, ...formRest } = invoiceForm;
      const payload = {
        ...formRest,
        companyEntity: companyEntity || 'Elite Online',
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

      if (editingInvoiceId) {
        await api.updateBillingInvoice(editingInvoiceId, payload);
      } else {
        const createRes = await api.createBillingInvoice(payload);
        const invNoStr = createRes?.data?.invoiceNo || payload.invoiceNo || 'INV';
        dispatchScreenGroupEvent('jobcards_billing', 'New Tax Invoice Generated 🧾', `Invoice #${invNoStr} for ${payload.customerName || 'Customer'} (₹${Number(payload.grandTotal || 0).toLocaleString('en-IN')}) generated & dispatched to Billing Group.`, 'invoices');
      }

      window.dispatchEvent(new CustomEvent('elite-data-refresh', { detail: { source: 'billing', timestamp: Date.now() } }));
      triggerPushNotification('Invoice Saved 🧾', `Invoice #${payload.invoiceNo || 'INV'} ${editingInvoiceId ? 'updated' : 'created'} successfully!`, 'success');
      await loadData();
      setActiveTab('invoices');
    } catch (err) {
      triggerEliteAlert('Save Error', err.message || 'Failed to save invoice', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Delete Invoice
  const handleDeleteInvoice = async (id, invNo) => {
    const ok = await triggerEliteConfirm({
      title: 'Delete Tax Invoice',
      message: `Are you sure you want to delete Invoice "${invNo}"? This action cannot be undone.`,
      confirmText: 'Yes, Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });
    if (!ok) return;
    try {
      await api.deleteBillingInvoice(id);
      await loadData();
      triggerPushNotification('🗑️ Invoice Deleted', `Invoice "${invNo}" deleted successfully.`, 'info');
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
        const res = await api.createBillingCustomer({ ...custForm, companyEntity });
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

  // Create / Update Vendor Handler
  const handleSaveVendor = async () => {
    if (!vendorForm.name || !vendorForm.name.trim()) {
      alert('Vendor Contact / Representative Name is required');
      return;
    }
    try {
      if (editingVendorId) {
        const res = await api.updateBillingVendor(editingVendorId, vendorForm);
        setVendorsList(prev => prev.map(v => ((v._id || v.id) === editingVendorId ? res.data : v)));
        triggerPushNotification('✏️ Vendor Updated', `Vendor "${vendorForm.name}" updated.`, 'success');
      } else {
        const res = await api.createBillingVendor({ ...vendorForm, companyEntity });
        setVendorsList(prev => [...prev, res.data]);
        triggerPushNotification('🏢 Vendor Created', `Vendor "${vendorForm.name}" registered.`, 'success');
      }
      setShowVendorModal(false);
      setEditingVendorId(null);
      setVendorForm({ name: '', businessName: '', phone: '', email: '', gstin: '', billingAddress: '', state: 'Gujarat', stateCode: '24', vendorType: 'General Supplier' });
    } catch (err) {
      alert(err.message || 'Failed to save vendor');
    }
  };

  const handleEditVendor = (v) => {
    setEditingVendorId(v._id || v.id);
    setVendorForm({
      name: v.name || '',
      businessName: v.businessName || '',
      phone: v.phone || '',
      email: v.email || '',
      gstin: v.gstin || '',
      billingAddress: v.billingAddress || v.address || '',
      state: v.state || 'Gujarat',
      stateCode: v.stateCode || '24',
      vendorType: v.vendorType || 'Fabric'
    });
    setShowVendorModal(true);
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
        const res = await api.createBillingItem({ ...itemForm, companyEntity });
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
    <div className="ent-screen-container">

      {/* ── UNIFIED ENTERPRISE HEADER & SUB-TABS ── */}
      <div className="ent-screen-header has-subtabs" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.65rem', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', width: '100%' }}>
          <div className="ent-header-title-wrap">
            <div className="ent-header-icon-box" style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}>
              <FileText size={18} color="#fff" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <h2 className="ent-header-title">Billing & Invoicing</h2>
              <EntityBrandBadge entityId={companyEntity} />
              <ScreenGroupRoster screenId="jobcards_billing" />
            </div>
          </div>

          {/* Quick Action Menu */}
          <div className="ent-header-actions">
            <QuickActionMenu
              onNewInvoice={() => handleOpenCreateTab()}
              onNewChallan={handleOpenCreateChallan}
              onExpenseEntry={() => {
                setActiveTab('expense');
                setAutoOpenExpenseModal(true);
              }}
              onLedgerReports={() => setShowLedgerModal(true)}
            />
          </div>
        </div>

        {/* Sub-Tabs Bar */}
        <div
          className="ent-tab-bar"
          style={{
            display: 'flex',
            flexWrap: 'nowrap',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x pan-y',
            width: '100%',
            maxWidth: '100%',
            gap: '0.5rem',
            padding: '4px 2px 6px 2px',
            scrollbarWidth: 'none',
          }}
        >
          {[
            { id: 'challans', label: 'Challan' },
            { id: 'invoices', label: 'Invoices', count: stats.totalInvoices },
            { id: 'purchase', label: 'Purchases' },
            ...(activeTab === 'create' ? [{ id: 'create', label: editingInvoiceId ? 'Edit Invoice' : 'New Invoice' }] : []),
            { id: 'expense', label: 'Expenses & Ledger' },
            { id: 'customers', label: `Customers (${customers.length})` },
            { id: 'vendors', label: `Vendors (${vendorsList.length})` },
            { id: 'items', label: `Items (${itemsList.length})` }
          ].map(t => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`ent-tab-btn ${isActive ? 'active' : ''}`}
                style={{ flexShrink: 0, flex: '0 0 auto', whiteSpace: 'nowrap', minWidth: 'max-content' }}
              >
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── DATE FILTER & KPI CARDS BAR (Displayed on Invoices Directory) ──────── */}
      {activeTab === 'invoices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', padding: '0.1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              <Calendar size={15} color="#4f46e5" />
              <span>Reporting Period:</span>
              <span style={{ fontSize: '0.78rem', color: '#4f46e5', fontWeight: 700 }}>({activeRange.labelText})</span>
            </div>

            <DateRangePicker
              preset={datePreset}
              onChange={({ preset: p }) => setDatePreset(p)}
              customStart={customDateStart}
              customEnd={customDateEnd}
              onCustomChange={(s, e) => {
                setCustomDateStart(s);
                setCustomDateEnd(e);
              }}
            />
          </div>

          {/* KPI CARDS GRID */}
          <div className="ent-stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div className="ent-stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Invoiced</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{fmtINR(periodStats.totalInvoiced)}</div>
              <div style={{ fontSize: '0.68rem', color: '#3b82f6', marginTop: 2 }}>{periodStats.totalInvoices} Invoices</div>
            </div>

            <div className="ent-stat-card" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Received</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399', marginTop: 2 }}>{fmtINR(periodStats.totalPaid)}</div>
              <div style={{ fontSize: '0.68rem', color: '#10b981', marginTop: 2 }}>{periodStats.paidCount} Paid Invoices</div>
            </div>

            <div className="ent-stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Pending Balance</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24', marginTop: 2 }}>{fmtINR(periodStats.totalBalanceDue)}</div>
              <div style={{ fontSize: '0.68rem', color: '#f59e0b', marginTop: 2 }}>{periodStats.unpaidCount} Pending / Partial</div>
            </div>

            <div className="ent-stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Overdue Invoices</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f87171', marginTop: 2 }}>{periodStats.overdueCount}</div>
              <div style={{ fontSize: '0.68rem', color: '#ef4444', marginTop: 2 }}>Payment Passed</div>
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

            {/* Customers Button */}
            <button
              type="button"
              onClick={() => setActiveTab('customers')}
              className="ent-tab-btn"
              title="View & Manage All Customers"
              style={{
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.8rem',
                border: '1px solid var(--border-light, #cbd5e1)',
                background: '#ffffff',
                color: '#475569',
                borderRadius: '8px',
                height: '34px',
                padding: '0 0.95rem',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap'
              }}
            >
              <span>Customers ({customers.length})</span>
            </button>

            {/* Signed Copy Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginLeft: 'auto' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Signed:</span>
              <select
                value={signedCopyFilter}
                onChange={e => setSignedCopyFilter(e.target.value)}
                style={{
                  padding: '0.4rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-input, rgba(15, 23, 42, 0.6))',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                <option value="All">All Signed Status</option>
                <option value="NOT_UPLOADED">⚪ Not Uploaded (Gray)</option>
                <option value="PENDING">🟡 In Process (Yellow)</option>
                <option value="APPROVED">🟢 Approved (Green)</option>
                <option value="REJECTED">🔴 Rejected (Red)</option>
              </select>
            </div>
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
          <div className="table-responsive-wrapper" style={{ margin: '0 0 1rem 0' }}>
            <div className="table-responsive" style={{ padding: 0 }}>
            {(() => {
              const displayedInvoices = periodInvoices
                .filter(inv => matchSearchQuery(inv, search, [
                  'invoiceNo', 'ourChallanNo', 'challanNo', 'orderNo', 'dispatchDocNo',
                  'customer.name', 'customer.businessName', 'customer.phone', 'customer.gstin',
                  'items.itemName', 'items.jobNo', 'items.lotNo', 'items.partyChallan', 'items.ourChallanNo', 'items.hsnCode'
                ]))
                .filter(inv => {
                  if (!signedCopyFilter || signedCopyFilter === 'All') return true;
                  const sc = inv.signedCopy;
                  const st = sc?.status;
                  if (signedCopyFilter === 'NOT_UPLOADED') {
                    return !sc || !st || st === 'NONE' || (!sc.images?.length && !sc.pdfUrl && !sc.fileUrl && st !== 'APPROVED' && st !== 'PENDING' && st !== 'REJECTED');
                  }
                  if (signedCopyFilter === 'PENDING') {
                    return st === 'PENDING' || st === 'IN_PROCESS' || st === 'UPLOADED';
                  }
                  if (signedCopyFilter === 'APPROVED') {
                    return st === 'APPROVED';
                  }
                  if (signedCopyFilter === 'REJECTED') {
                    return st === 'REJECTED';
                  }
                  return true;
                });
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
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Created By</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No invoices found for the selected date range ({activeRange.labelText}).
                        </td>
                      </tr>
                    ) : (
                      displayedInvoices.map(inv => {
                        const rawChallanStr = inv.ourChallanNo || (Array.isArray(inv.linkedChallanNos) && inv.linkedChallanNos.length > 0 ? inv.linkedChallanNos.join(', ') : '') || (inv.items && inv.items.map(i => i.ourChallanNo || i.partyChallan).filter(Boolean).join(', ')) || '';
                        const challanList = rawChallanStr ? rawChallanStr.split(',').map(s => s.trim()).filter(Boolean) : [];

                        return (
                          <tr key={inv._id} style={{ borderBottom: '1px solid var(--border-light)', background: selectedInvoiceIds.includes(inv._id) ? 'rgba(124, 58, 237, 0.08)' : 'transparent' }}>
                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', verticalAlign: 'middle' }}>
                              <input
                                type="checkbox"
                                checked={selectedInvoiceIds.includes(inv._id)}
                                onChange={() => handleToggleSelectInvoice(inv._id)}
                                style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#7c3aed' }}
                              />
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 800, color: '#a78bfa', verticalAlign: 'middle' }}>
                              <button
                                onClick={() => setViewInvoiceModal(inv)}
                                style={{ background: 'none', border: 'none', color: '#a78bfa', fontWeight: 800, cursor: 'pointer', padding: 0, textDecoration: 'underline', outline: 'none', whiteSpace: 'nowrap' }}
                              >
                                {inv.invoiceNo}
                              </button>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', verticalAlign: 'middle', maxWidth: '220px' }}>
                              {challanList.length === 0 ? (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              ) : challanList.length <= 2 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {challanList.map((ch, idx) => (
                                    <span key={idx} style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(96, 165, 250, 0.12)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.28)', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                      {ch}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                                  {challanList.slice(0, 2).map((ch, idx) => (
                                    <span key={idx} style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(96, 165, 250, 0.12)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.28)', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                      {ch}
                                    </span>
                                  ))}
                                  <span
                                    title={challanList.join(', ')}
                                    style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(124, 58, 237, 0.15)', color: '#c084fc', border: '1px solid rgba(124, 58, 237, 0.35)', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                  >
                                    +{challanList.length - 2} more
                                  </span>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--text-primary)', verticalAlign: 'middle' }}>
                              <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{inv.customer?.businessName || inv.customer?.name || '—'}</div>
                              {inv.customer?.gstin && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>GSTIN: {inv.customer.gstin}</div>}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--text-primary)', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              {formatDateDDMMYYYY(inv.invoiceDate)}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              {fmtINR(getAmountWithoutGst(inv))}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#34d399', fontWeight: 700, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              {fmtINR(inv.paidAmount)}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: Math.max(0, getAmountWithoutGst(inv) - (inv.paidAmount || 0)) > 0 ? '#f87171' : 'var(--text-muted)', fontWeight: 700, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              {fmtINR(Math.max(0, getAmountWithoutGst(inv) - (inv.paidAmount || 0)))}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle' }}>
                              <span style={{
                                padding: '0.25rem 0.6rem',
                                borderRadius: 6,
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                background: inv.paymentStatus === 'PAID' ? 'rgba(16,185,129,0.15)' : inv.paymentStatus === 'PARTIALLY_PAID' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                                color: inv.paymentStatus === 'PAID' ? '#34d399' : inv.paymentStatus === 'PARTIALLY_PAID' ? '#fbbf24' : '#f87171',
                                border: `1px solid ${inv.paymentStatus === 'PAID' ? 'rgba(16,185,129,0.3)' : inv.paymentStatus === 'PARTIALLY_PAID' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                whiteSpace: 'nowrap',
                                display: 'inline-block'
                              }}>
                                {inv.paymentStatus}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', verticalAlign: 'middle' }}>
                              <span style={{ padding: '0.25rem 0.65rem', borderRadius: '6px', background: 'rgba(124, 58, 237, 0.12)', color: '#a78bfa', fontWeight: 700, fontSize: '0.75rem', border: '1px solid rgba(124, 58, 237, 0.25)', whiteSpace: 'nowrap', display: 'inline-block' }}>
                                {inv.createdByName || inv.createdBy || 'HASI'}
                              </span>
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                              {(() => {
                                const sc = inv.signedCopy;
                                const status = sc?.status;
                                const isApproved = status === 'APPROVED';
                                const isPending = status === 'PENDING' || status === 'IN_PROCESS' || status === 'UPLOADED';
                                const isRejected = status === 'REJECTED';

                                let signedIconColor = '#94a3b8';
                                let signedBgColor = 'rgba(148, 163, 184, 0.12)';
                                let signedBorderColor = 'rgba(148, 163, 184, 0.3)';
                                let signedTitle = 'Signed Copy: Not Uploaded (Click to upload)';
                                let SignedIcon = FileText;

                                if (isApproved) {
                                  signedIconColor = '#10b981';
                                  signedBgColor = 'rgba(16, 185, 129, 0.14)';
                                  signedBorderColor = 'rgba(16, 185, 129, 0.35)';
                                  signedTitle = `Signed Copy: Approved by Admin (${sc?.images?.length || 1} pages). Click to view.`;
                                  SignedIcon = CheckCircle;
                                } else if (isRejected) {
                                  signedIconColor = '#ef4444';
                                  signedBgColor = 'rgba(239, 68, 68, 0.14)';
                                  signedBorderColor = 'rgba(239, 68, 68, 0.35)';
                                  signedTitle = `Signed Copy: Rejected (${sc?.rejectionReason || 'Please re-upload'}). Click to re-upload.`;
                                  SignedIcon = AlertCircle;
                                } else if (isPending) {
                                  signedIconColor = '#f59e0b';
                                  signedBgColor = 'rgba(245, 158, 11, 0.14)';
                                  signedBorderColor = 'rgba(245, 158, 11, 0.35)';
                                  signedTitle = `Signed Copy: In Process / Pending Admin Review (${sc?.images?.length || 1} pages). Click to view.`;
                                  SignedIcon = Clock;
                                }

                                const invoiceActions = [
                                  {
                                    id: 'signed_copy',
                                    icon: SignedIcon,
                                    label: 'Signed Copy',
                                    tooltip: signedTitle,
                                    color: signedIconColor,
                                    bgColor: signedBgColor,
                                    borderColor: signedBorderColor,
                                    onClick: () => {
                                      if (isApproved || isPending) {
                                        setSignedPreviewTarget({
                                          _id: inv._id,
                                          docType: 'invoice',
                                          docNumber: inv.invoiceNo,
                                          partyName: inv.customer?.businessName || inv.customer?.name,
                                          signedCopy: inv.signedCopy
                                        });
                                      } else {
                                        setSignedUploadTarget({
                                          id: inv._id,
                                          docType: 'invoice',
                                          docNumber: inv.invoiceNo,
                                          partyName: inv.customer?.businessName || inv.customer?.name,
                                          existingSignedCopy: isRejected ? inv.signedCopy : null
                                        });
                                      }
                                    },
                                    isPrimary: true
                                  },
                                  {
                                    id: 'pdf',
                                    icon: Download,
                                    label: 'Download PDF',
                                    tooltip: 'Download Tax Invoice PDF',
                                    variant: 'purple',
                                    color: '#a78bfa',
                                    onClick: () => openPdfDialog(inv),
                                    isPrimary: true
                                  },
                                  {
                                    id: 'print-invoice',
                                    icon: Printer,
                                    label: 'Print Invoice',
                                    tooltip: 'Print Tax Invoice (Auto-loads images)',
                                    variant: 'blue',
                                    color: '#38bdf8',
                                    onClick: async () => {
                                      try {
                                        triggerPushNotification('🖨️ Preparing Invoice', `Loading images & preparing print for #${inv.invoiceNo}...`, 'info');
                                        await api.downloadInvoicePdf(inv._id, inv.invoiceNo, false);
                                      } catch (err) {
                                        alert('Failed to prepare invoice for printing: ' + err.message);
                                      }
                                    },
                                    isPrimary: true
                                  },
                                  {
                                    id: 'view',
                                    icon: Eye,
                                    label: 'View Details',
                                    tooltip: 'View Invoice Details',
                                    variant: 'default',
                                    color: '#38bdf8',
                                    onClick: () => setViewInvoiceModal(inv),
                                    isPrimary: false
                                  },
                                  ...(inv.balanceDue > 0 ? [
                                    {
                                      id: 'payment',
                                      icon: CreditCard,
                                      label: 'Record Payment',
                                      tooltip: `Record Payment (Due: ₹${inv.balanceDue})`,
                                      variant: 'success',
                                      color: '#34d399',
                                      onClick: () => { setPaymentModalInvoice(inv); setPayAmount(inv.balanceDue); },
                                      isPrimary: false
                                    }
                                  ] : []),
                                  {
                                    id: 'history',
                                    icon: Clock,
                                    label: 'Audit History',
                                    tooltip: 'View Audit History & Staff Log',
                                    variant: 'warning',
                                    color: '#fbbf24',
                                    onClick: () => setSelectedInvoiceHistory(inv),
                                    isPrimary: false
                                  },
                                  {
                                    id: 'edit',
                                    icon: Edit2,
                                    label: 'Edit',
                                    tooltip: 'Edit Invoice',
                                    variant: 'primary',
                                    onClick: () => handleOpenCreateTab(inv),
                                    isPrimary: false
                                  },
                                  {
                                    id: 'clone',
                                    icon: Copy,
                                    label: 'Clone',
                                    tooltip: 'Clone / Duplicate Invoice (Reset Dates/Status)',
                                    variant: 'secondary',
                                    color: '#8b5cf6',
                                    onClick: () => handleCloneInvoice(inv),
                                    isPrimary: false
                                  },
                                  {
                                    id: 'delete',
                                    icon: Trash2,
                                    label: 'Delete',
                                    tooltip: 'Delete Invoice',
                                    variant: 'danger',
                                    color: '#f87171',
                                    onClick: () => handleDeleteInvoice(inv._id, inv.invoiceNo),
                                    isPrimary: false
                                  }
                                ];

                                return <SmartActionGroup actions={invoiceActions} maxInlineMobile={2} align="center" />;
                              })()}
                            </td>
                          </tr>
                        );
                      })
                )}
              </tbody>
            </table>
          );
        })()}
      </div>
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
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative' }}>
          <ScrollSpyMiniMap sections={INVOICE_FORM_SECTIONS} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.8rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <FeatureCoachmark
                id="zen-focus-mode-tip"
                title="Zen Focus Mode"
                content="Press Alt+Z anytime to hide headers and sidebars for 100% full-screen table focus."
              >
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  {editingInvoiceId ? `Edit Invoice — ${invoiceForm.invoiceNo}` : 'New GST Tax Invoice Generator'}
                </h3>
              </FeatureCoachmark>
              <EntityBrandBadge entityId={companyEntity} />
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="btn-secondary" onClick={() => setActiveTab('invoices')}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveInvoice} disabled={loading} style={{ background: 'linear-gradient(135deg,#7c3aed,#6366f1)' }}>
                {loading ? 'Saving...' : editingInvoiceId ? 'Update Invoice' : 'Save & Issue Invoice'}
              </button>
            </div>
          </div>

          {/* Core Metadata */}
          <div id="inv-sec-meta" data-form-section="true" data-section-title="Metadata & Taxes" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ ...labelStyle, color: '#60a5fa', fontWeight: 800 }}>🏢 ISSUING COMPANY (SELLER) *</label>
              <select
                value="Elite Digital Print"
                disabled
                style={{
                  ...inputStyle,
                  fontWeight: '800',
                  color: '#60a5fa',
                  background: 'rgba(96, 165, 250, 0.12)',
                  border: '1px solid rgba(96, 165, 250, 0.4)',
                  cursor: 'not-allowed'
                }}
              >
                <option value="Elite Digital Print">🏢 Elite Digital Print</option>
              </select>
            </div>
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
                value={formatForInputDate(invoiceForm.invoiceDate)}
                onChange={e => setInvoiceForm(f => ({ ...f, invoiceDate: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Due Date</label>
              <input
                type="date"
                value={formatForInputDate(invoiceForm.dueDate)}
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
          <div id="inv-sec-customer" data-form-section="true" data-section-title="Customer / Party" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '1rem' }}>
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
                  id="invoice-customer-name"
                  type="text"
                  required
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
          <div id="inv-sec-items" data-form-section="true" data-section-title="Line Items" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '1rem', overflowX: 'auto' }}>
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
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={handleResyncMetersFromChallans}
                    className="btn-secondary"
                    style={{
                      padding: '0.35rem 0.8rem',
                      fontSize: '0.75rem',
                      color: '#38bdf8',
                      borderColor: 'rgba(56, 189, 248, 0.4)',
                      background: 'rgba(56, 189, 248, 0.12)',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                    title="Fetch latest metres, fabric name & job details from linked Delivery Challan(s)"
                  >
                    <RefreshCw size={13} /> 🔄 Re-sync Fabric & Meters
                  </button>
                  <button type="button" id="invoice-add-item-btn" onClick={handleAddItemRow} className="btn-secondary" style={{ padding: '0.35rem 0.8rem', fontSize: '0.75rem' }}>
                    <Plus size={13} /> Add Item Row
                  </button>
                </div>
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
                          <img src={convertDriveUrl(it.imageUrl, it.itemName)} alt="Design" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover', border: '1px solid var(--border-light)' }} onError={e => { e.target.style.display = 'none'; }} />
                        )}
                        <input
                          id={`invoice-item-name-${idx}`}
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

                      {/* Visible Fabric & Description badge so the user sees the fabric name! */}
                      {(it.fabric || it.fabricName || it.description) && (
                        <div style={{ fontSize: '0.72rem', color: '#4f46e5', background: '#eef2ff', padding: '2px 8px', borderRadius: 4, border: '1px solid #c7d2fe', display: 'flex', alignItems: 'center', gap: 5, width: 'fit-content' }}>
                          <span>🧵</span>
                          <span style={{ fontWeight: 700 }}>
                            {it.fabric || it.fabricName ? `Fabric: ${it.fabric || it.fabricName}` : it.description}
                          </span>
                          {it.description && !it.description.includes(it.fabric || it.fabricName || '') && (
                            <span style={{ color: '#64748b', fontWeight: 500 }}>({it.description})</span>
                          )}
                        </div>
                      )}

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
                          id={`invoice-item-qty-${idx}`}
                          data-primary-qty={idx === 0 ? "true" : undefined}
                          type="number"
                          step="0.01"
                          value={it.qty}
                          onChange={e => handleItemChange(idx, 'qty', e.target.value)}
                          style={{
                            ...inputStyle,
                            backgroundColor: it.isLocked ? 'rgba(251, 191, 36, 0.08)' : undefined,
                            borderColor: it.isLocked ? 'rgba(251, 191, 36, 0.5)' : undefined
                          }}
                        />
                        {it.isLocked && (
                          <Lock size={12} style={{ position: 'absolute', right: 6, color: '#fbbf24', pointerEvents: 'none' }} title="Imported from Delivery Challan (editable anytime)" />
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
                        <option value="KG">KG</option>
                        <option value="Kg">Kg</option>
                        <option value="Pcs">Pcs</option>
                        <option value="Rolls">Rolls</option>
                        <option value="Ltr">Ltr</option>
                        <option value="Boxes">Boxes</option>
                        <option value="Bags">Bags</option>
                        <option value="Set">Set</option>
                        <option value="Hours">Hours</option>
                      </select>
                    </td>
                    <td style={{ padding: '0.4rem' }}>
                      <input
                        id={`invoice-item-price-${idx}`}
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
            <div id="inv-sec-notes" data-form-section="true" data-section-title="Notes & Terms" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
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

            <div id="inv-sec-totals" data-form-section="true" data-section-title="Summary & Total" className="glass-panel" style={{ padding: '1.1rem', background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.25)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                <span key={calculatedInvoice.grandTotal} className="reactive-value-pulse" style={{ padding: '0 4px', borderRadius: 4 }}>
                  ₹ {calculatedInvoice.grandTotal.toFixed(2)}
                </span>
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
                  <div
                    key={calculatedInvoice.balanceDue}
                    className="reactive-value-pulse"
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      color: calculatedInvoice.balanceDue > 0 ? '#f87171' : '#34d399',
                      padding: '0 4px',
                      borderRadius: 4,
                      display: 'inline-block'
                    }}
                  >
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

      {/* ── TAB 4B: VENDORS DIRECTORY ─────────────────────────────────────────── */}
      {activeTab === 'vendors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass-panel" style={{ padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={vendorSearch}
                onChange={e => setVendorSearch(e.target.value)}
                placeholder="Search Vendor Name, Business, Phone, GSTIN..."
                style={{ paddingLeft: 32, width: '100%', fontSize: '0.85rem' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <button 
                type="button"
                className="btn-secondary" 
                onClick={() => setActiveTab('customers')}
                style={{ fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <span>Customers ({customers.length})</span>
              </button>
              <button 
                type="button"
                className="btn-primary" 
                onClick={() => {
                  setEditingVendorId(null);
                  setVendorForm({ name: '', businessName: '', phone: '', email: '', gstin: '', billingAddress: '', state: 'Gujarat', stateCode: '24', vendorType: 'General Supplier' });
                  setShowVendorModal(true);
                }}
              >
                <PlusCircle size={15} /> Add New Vendor
              </button>
            </div>
          </div>

          <div className="glass-panel" style={{ overflowX: 'auto', padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Vendor / Contact</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Business / Firm Name</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Phone & Email</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>GSTIN</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Address & State</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(filteredVendors || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No vendors found. Click "Add New Vendor" to register your supplier!
                    </td>
                  </tr>
                ) : (
                  (filteredVendors || []).map(v => (
                    <tr key={v._id || v.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span>{v.name}</span>
                          {v.vendorType && (
                            <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5', fontWeight: 700 }}>
                              {v.vendorType}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{v.businessName || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                        <div>{v.phone || '—'}</div>
                        {v.email && <div style={{ fontSize: '0.7rem' }}>{v.email}</div>}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0284c7' }}>{v.gstin || 'Unregistered'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {v.billingAddress || v.address || '—'} ({v.state || 'Gujarat'})
                      </td>
                      <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                          <button onClick={() => handleEditVendor(v)} className="btn-icon" title="Edit Vendor">
                            <Edit2 size={14} color="var(--primary)" />
                          </button>
                          <button onClick={() => handleDeleteVendor(v._id || v.id, v.name)} className="btn-icon" title="Delete Vendor">
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
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{item.hsnCode || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>₹{item.unitPrice} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>/ {item.unit || 'Meters'}</span></td>
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


      {/* ── TAB 6: EXPENSE & LEDGER MODULE ───────────────────────────────────── */}
      {activeTab === 'expense' && (
        <DigitalPrintExpenseModule
          companyEntity={companyEntity}
          autoOpenCreate={autoOpenExpenseModal}
          onModalOpened={() => setAutoOpenExpenseModal(false)}
        />
      )}
      {activeTab === 'purchase' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginTop: '1rem' }}>
          {/* Top Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ background: 'var(--bg-card, #ffffff)', padding: '1rem 1.2rem', borderRadius: '12px', border: '1px solid var(--border-light, #e2e8f0)', borderLeft: '4px solid #4f46e5', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>Total Purchase Orders</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#4f46e5', marginTop: 4 }}>{purchases.length}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', marginTop: 2 }}>Logged Inward Bills</div>
            </div>

            <div style={{ background: 'var(--bg-card, #ffffff)', padding: '1rem 1.2rem', borderRadius: '12px', border: '1px solid var(--border-light, #e2e8f0)', borderLeft: '4px solid #0284c7', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>Total Purchase Amount</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0284c7', marginTop: 4 }}>₹{totalPurchaseValue.toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', marginTop: 2 }}>Gross Material Cost</div>
            </div>

            <div style={{ background: 'var(--bg-card, #ffffff)', padding: '1rem 1.2rem', borderRadius: '12px', border: '1px solid var(--border-light, #e2e8f0)', borderLeft: '4px solid #16a34a', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>Total Inward Volume</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#16a34a', marginTop: 4 }}>{totalInwardQty.toLocaleString('en-IN')} Units</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', marginTop: 2 }}>Accumulated Material</div>
            </div>

            <div style={{ background: 'var(--bg-card, #ffffff)', padding: '1rem 1.2rem', borderRadius: '12px', border: '1px solid var(--border-light, #e2e8f0)', borderLeft: '4px solid #8b5cf6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>Active Vendors</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#8b5cf6', marginTop: 4 }}>{uniqueVendorsCount}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', marginTop: 2 }}>Registered Suppliers</div>
            </div>
          </div>

          {/* Filter Bar & Action Header */}
          <div style={{ background: 'var(--bg-card, #ffffff)', padding: '0.9rem 1.2rem', borderRadius: '12px', border: '1px solid var(--border-light, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
              {/* Search Bar */}
              <div style={{ position: 'relative', minWidth: 220, flex: '1 1 220px', maxWidth: 300 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search Bill No, Vendor, Item..."
                  value={purchaseSearch}
                  onChange={e => setPurchaseSearch(e.target.value)}
                  style={{ width: '100%', paddingLeft: 32, paddingRight: 10, paddingTop: 7, paddingBottom: 7, fontSize: '0.82rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                />
              </div>

              {/* Date Filter Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#f8fafc', padding: '5px 8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <Calendar size={13} style={{ color: '#4f46e5' }} />
                <select
                  value={purchaseDatePreset}
                  onChange={e => setPurchaseDatePreset(e.target.value)}
                  style={{ background: 'transparent', border: 'none', fontSize: '0.8rem', fontWeight: 600, color: '#334155', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="all">📅 All Dates</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="this_week">This Week</option>
                  <option value="last_7_days">Last 7 Days</option>
                  <option value="this_month">This Month</option>
                  <option value="previous_month">Previous Month</option>
                  <option value="last_30_days">Last 30 Days</option>
                  <option value="current_fiscal_year">Current FY</option>
                  <option value="custom">Custom Range...</option>
                </select>
              </div>

              {/* Custom Date Pickers */}
              {purchaseDatePreset === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#f8fafc', padding: '4px 8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <input
                    type="date"
                    value={purchaseDateStart}
                    onChange={e => setPurchaseDateStart(e.target.value)}
                    style={{ border: 'none', background: 'transparent', fontSize: '0.78rem', color: '#1e293b', outline: 'none' }}
                    title="From Date"
                  />
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>to</span>
                  <input
                    type="date"
                    value={purchaseDateEnd}
                    onChange={e => setPurchaseDateEnd(e.target.value)}
                    style={{ border: 'none', background: 'transparent', fontSize: '0.78rem', color: '#1e293b', outline: 'none' }}
                    title="To Date"
                  />
                </div>
              )}

              {/* Vendor Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#f8fafc', padding: '5px 8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <Building size={13} style={{ color: '#0284c7' }} />
                <select
                  value={purchaseVendorFilter}
                  onChange={e => setPurchaseVendorFilter(e.target.value)}
                  style={{ background: 'transparent', border: 'none', fontSize: '0.8rem', fontWeight: 600, color: '#334155', cursor: 'pointer', outline: 'none', maxWidth: 160 }}
                >
                  <option value="ALL">🏢 All Vendors</option>
                  {purchaseVendorsList.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              {/* GST Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#f8fafc', padding: '5px 8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <Percent size={12} style={{ color: '#8b5cf6' }} />
                <select
                  value={purchaseGstFilter}
                  onChange={e => setPurchaseGstFilter(e.target.value)}
                  style={{ background: 'transparent', border: 'none', fontSize: '0.8rem', fontWeight: 600, color: '#334155', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="ALL">All GST Rates</option>
                  <option value="0">0% GST</option>
                  <option value="5">5% GST</option>
                  <option value="12">12% GST</option>
                  <option value="18">18% GST</option>
                  <option value="28">28% GST</option>
                </select>
              </div>

              {/* Purchase Type Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#f8fafc', padding: '5px 8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <Package size={12} style={{ color: '#4f46e5' }} />
                <select
                  value={purchaseTypeFilter}
                  onChange={e => setPurchaseTypeFilter(e.target.value)}
                  style={{ background: 'transparent', border: 'none', fontSize: '0.8rem', fontWeight: 600, color: '#334155', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="ALL">All Types</option>
                  <option value="inventory">📦 Inventory Purchase</option>
                  <option value="expense">💼 Expense Purchase</option>
                </select>
              </div>

              {/* Clear Filters Button & Badge */}
              {hasActivePurchaseFilters && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setPurchaseSearch('');
                      setPurchaseDatePreset('all');
                      setPurchaseDateStart('');
                      setPurchaseDateEnd('');
                      setPurchaseVendorFilter('ALL');
                      setPurchaseGstFilter('ALL');
                      setPurchaseTypeFilter('ALL');
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 9px',
                      fontSize: '0.76rem', fontWeight: 700, color: '#ef4444', background: '#fef2f2',
                      border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer'
                    }}
                    title="Reset all filters"
                  >
                    <RotateCcw size={12} /> Clear
                  </button>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                    ({filteredPurchases.length} of {purchases.length})
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => setActiveTab('vendors')}
                className="ent-tab-btn"
                title="View & Manage All Registered Vendors"
                style={{
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  border: '1px solid var(--border-light, #cbd5e1)',
                  background: '#ffffff',
                  color: '#475569',
                  borderRadius: '8px',
                  height: '34px',
                  padding: '0 0.95rem',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>Vendors ({vendorsList.length})</span>
              </button>

              <button
                onClick={() => {
                  setEditingPurchaseId(null);
                  setPurchaseForm({
                    purchaseNo: `PUR-2026-00${purchases.length + 1}`,
                    purchaseType: 'inventory',
                    ourChallanNo: '',
                    date: new Date().toISOString().split('T')[0],
                    vendor: {
                      vendorId: '',
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
                    vendorName: '',
                    items: [createEmptyPurchaseItem()],
                    enableRoundOff: true,
                    manualRoundOff: undefined,
                    discountType: 'flat',
                    discountValue: 0,
                    taxType: 'CGST_SGST',
                    gstRate: 5,
                    paidAmount: 0,
                    notes: 'Vendor purchase bill recorded in ERP.'
                  });
                  setShowPurchaseModal(true);
                }}
                style={{
                  padding: '0.55rem 1.1rem', fontSize: '0.82rem', fontWeight: 800, borderRadius: '8px',
                  border: 'none', background: 'linear-gradient(135deg, #4f46e5, #3b82f6)', color: '#ffffff',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(79,70,229,0.3)',
                  whiteSpace: 'nowrap'
                }}
              >
                <Plus size={16} /> + New Purchase Inward Entry
              </button>
            </div>
          </div>

          {/* Purchase History Table */}
          <div style={{ background: 'var(--bg-card, #ffffff)', borderRadius: '12px', border: '1px solid var(--border-light, #e2e8f0)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.72rem' }}>
                  <th style={{ padding: '0.85rem 0.8rem' }}>Bill / Invoice No</th>
                  <th style={{ padding: '0.85rem 0.8rem' }}>Date & Due</th>
                  <th style={{ padding: '0.85rem 0.8rem' }}>Vendor / Supplier</th>
                  <th style={{ padding: '0.85rem 0.8rem' }}>Items Breakdown</th>
                  <th style={{ padding: '0.85rem 0.8rem', textAlign: 'right' }}>Qty / Mtr</th>
                  <th style={{ padding: '0.85rem 0.8rem', textAlign: 'right' }}>Grand Total (₹)</th>
                  <th style={{ padding: '0.85rem 0.8rem', textAlign: 'right' }}>Paid (₹)</th>
                  <th style={{ padding: '0.85rem 0.8rem', textAlign: 'right' }}>Balance Due (₹)</th>
                  <th style={{ padding: '0.85rem 0.8rem', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '0.85rem 0.8rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                      {hasActivePurchaseFilters ? (
                        <div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#64748b' }}>
                            🔍 No matching purchase bills found for the applied filters.
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPurchaseSearch('');
                              setPurchaseDatePreset('all');
                              setPurchaseDateStart('');
                              setPurchaseDateEnd('');
                              setPurchaseVendorFilter('ALL');
                              setPurchaseGstFilter('ALL');
                            }}
                            style={{ padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, color: '#4f46e5', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', cursor: 'pointer', marginTop: '0.6rem' }}
                          >
                            Reset Filters
                          </button>
                        </div>
                      ) : (
                        '🛒 No purchase invoices found. Click "+ New Purchase Inward Entry" to log vendor bills.'
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map((p) => {
                    const billTotal = Number(p.grandTotal || p.totalAmount || 0);
                    const paidAmt = Number(p.paidAmount || 0);
                    const balDue = p.balanceDue != null ? Number(p.balanceDue) : (p.paymentStatus === 'PAID' ? 0 : Math.max(0, billTotal - paidAmt));
                    const isPaid = p.paymentStatus === 'PAID' || (paidAmt >= billTotal && billTotal > 0);
                    const isPartial = p.paymentStatus === 'PARTIALLY_PAID' || p.paymentStatus === 'PARTIAL' || (paidAmt > 0 && balDue > 0);

                    return (
                      <tr key={p._id || p.id} style={{ borderBottom: '1px solid #f1f5f9', color: '#1e293b' }}>
                        <td style={{ padding: '0.85rem 0.8rem', verticalAlign: 'top' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 800, color: '#4f46e5' }}>{p.purchaseNo}</span>
                            <span style={{
                              fontSize: '0.67rem',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: '4px',
                              background: p.purchaseType === 'expense' ? '#fef3c7' : '#eff6ff',
                              color: p.purchaseType === 'expense' ? '#b45309' : '#1d4ed8',
                              border: p.purchaseType === 'expense' ? '1px solid #fde68a' : '1px solid #bfdbfe'
                            }}>
                              {p.purchaseType === 'expense' ? '💼 Expense' : '📦 Inventory'}
                            </span>
                          </div>
                          {p.ourChallanNo && (
                            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2 }}>
                              Challan: <strong style={{ color: '#0284c7' }}>{p.ourChallanNo}</strong>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 0.8rem', color: '#64748b', verticalAlign: 'top', fontSize: '0.78rem' }}>
                          <div>{p.date ? (typeof p.date === 'string' && p.date.includes('T') ? p.date.split('T')[0] : (p.date instanceof Date ? p.date.toISOString().split('T')[0] : p.date)) : ''}</div>
                          {p.dueDate && (
                            <div style={{ fontSize: '0.68rem', color: '#d97706', marginTop: 2 }}>
                              Due: {typeof p.dueDate === 'string' && p.dueDate.includes('T') ? p.dueDate.split('T')[0] : (p.dueDate instanceof Date ? p.dueDate.toISOString().split('T')[0] : p.dueDate)}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 0.8rem', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 800, color: '#0f172a' }}>{p.vendor?.businessName || p.vendorName}</div>
                          {p.vendor?.name && p.vendor?.name !== p.vendor?.businessName && (
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Contact: {p.vendor.name}</div>
                          )}
                          {p.vendor?.gstin && (
                            <div style={{ fontSize: '0.68rem', color: '#4f46e5', fontWeight: 700, marginTop: 2 }}>
                              GSTIN: {p.vendor.gstin}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 0.8rem', verticalAlign: 'top' }}>
                          {Array.isArray(p.items) && p.items.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {p.items.slice(0, 3).map((it, idx) => (
                                <div key={idx} style={{ fontSize: '0.8rem' }}>
                                  <span style={{ fontWeight: 700 }}>• {it.itemName}</span>
                                  <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '5px' }}>
                                    ({it.qty || it.quantity || 1} {it.unit || 'Mtr'} @ ₹{it.unitPrice || it.rate || 0})
                                  </span>
                                  {it.description && (
                                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '10px' }}>
                                      {it.description}
                                    </div>
                                  )}
                                </div>
                              ))}
                              {p.items.length > 3 && (
                                <div style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: 700 }}>
                                  +{p.items.length - 3} more items
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontWeight: 700 }}>{p.itemName || 'Material Purchase'}</span>
                          )}
                          {p.notes && <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '3px' }}>{p.notes}</div>}
                        </td>
                        <td style={{ padding: '0.85rem 0.8rem', textAlign: 'right', fontWeight: 700, verticalAlign: 'top' }}>
                          {(() => {
                            if (Array.isArray(p.items) && p.items.length > 0) {
                              const totalQty = p.items.reduce((acc, it) => acc + (parseFloat(it.qty || it.quantity) || 0), 0);
                              const units = [...new Set(p.items.map(it => it.unit).filter(Boolean))];
                              const unitStr = units.length === 1 ? units[0] : 'Units';
                              return (
                                <div>
                                  <span style={{ fontWeight: 800, color: '#1e293b' }}>{totalQty > 0 ? `${totalQty} ${unitStr}` : `${p.items.length} Items`}</span>
                                  {p.items.length > 1 && (
                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>({p.items.length} items)</div>
                                  )}
                                </div>
                              );
                            }
                            return `${p.quantity || 0} ${p.unit || 'Mtr'}`;
                          })()}
                        </td>
                        <td style={{ padding: '0.85rem 0.8rem', textAlign: 'right', fontWeight: 900, color: '#0284c7', verticalAlign: 'top' }}>
                          <div>₹{billTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          {(p.taxType === 'IGST' ? p.igstAmount > 0 : p.totalTax > 0) && (
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#4f46e5', marginTop: 2 }}>
                              Tax: ₹{Number(p.totalTax || p.gstAmount || 0).toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 0.8rem', textAlign: 'right', fontWeight: 700, color: '#16a34a', verticalAlign: 'top' }}>
                          ₹{paidAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '0.85rem 0.8rem', textAlign: 'right', fontWeight: 800, color: balDue > 0 ? '#ef4444' : '#16a34a', verticalAlign: 'top' }}>
                          ₹{balDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '0.85rem 0.8rem', textAlign: 'center', verticalAlign: 'top' }}>
                          {isPaid ? (
                            <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: 'rgba(16,185,129,0.15)', color: '#16a34a', display: 'inline-block' }}>
                              PAID
                            </span>
                          ) : isPartial ? (
                            <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: 'rgba(234,179,8,0.15)', color: '#ca8a04', display: 'inline-block' }}>
                              PARTIAL
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', display: 'inline-block' }}>
                              UNPAID
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 0.8rem', textAlign: 'center', verticalAlign: 'top' }}>
                          {(() => {
                            const purchaseActions = [
                              {
                                id: 'print-purchase',
                                icon: Printer,
                                label: 'Print Purchase',
                                tooltip: 'Print Purchase Voucher / Inward Bill',
                                variant: 'blue',
                                color: '#38bdf8',
                                onClick: () => handlePrintPurchase(p),
                                isPrimary: true
                              },
                              {
                                id: 'view',
                                icon: Eye,
                                label: 'View Details',
                                tooltip: 'View Purchase Details',
                                variant: 'default',
                                color: '#38bdf8',
                                onClick: () => setViewPurchaseModal(p),
                                isPrimary: false
                              },
                              {
                                id: 'edit',
                                icon: Edit2,
                                label: 'Edit',
                                tooltip: 'Edit Purchase Entry',
                                variant: 'primary',
                                color: '#fbbf24',
                                onClick: () => handleEditPurchase(p),
                                isPrimary: false
                              },
                              {
                                id: 'delete',
                                icon: Trash2,
                                label: 'Delete',
                                tooltip: 'Delete Purchase Entry',
                                variant: 'danger',
                                color: '#f87171',
                                onClick: () => handleDeletePurchase(p._id || p.id, p.purchaseNo, p.vendorName),
                                isPrimary: false
                              }
                            ];

                            return <SmartActionGroup actions={purchaseActions} maxInlineMobile={2} align="center" />;
                          })()}
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

      {/* ── NEW / EDIT PURCHASE ENTRY GENERATOR MODAL (MIRRORING INVOICE WITH VENDOR DETAILS) ── */}
      {showPurchaseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: '1080px', maxHeight: '92vh', overflowY: 'auto', background: 'var(--bg-card, #ffffff)', borderRadius: '14px', border: '1px solid var(--border-light, #cbd5e1)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', color: 'var(--text-primary, #1e293b)' }}>
            
            {/* Header */}
            <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border-light, #e2e8f0)', background: 'linear-gradient(135deg, #4f46e5, #3b82f6)', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <ShoppingBag size={22} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                      {editingPurchaseId ? `Edit Vendor Purchase Bill — ${purchaseForm.purchaseNo}` : 'New Vendor Purchase Inward Generator'}
                    </h3>
                    <EntityBrandBadge entityId={companyEntity} />
                  </div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.9, marginTop: 2 }}>
                    Comprehensive GST Inward Bill Entry & Vendor Accounting System
                  </div>
                </div>
              </div>
              <button onClick={() => setShowPurchaseModal(false)} style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            <form onSubmit={handleCreatePurchase} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Top Metadata Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem', background: 'rgba(79, 70, 229, 0.04)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(79, 70, 229, 0.15)' }}>
                <div>
                  <label style={labelStyle}>Purchasing Entity</label>
                  <select
                    disabled
                    value={companyEntity || 'Elite Digital Prints'}
                    style={{
                      ...inputStyle,
                      fontWeight: 700,
                      color: '#4f46e5',
                      background: 'rgba(79, 70, 229, 0.08)',
                      border: '1px solid rgba(79, 70, 229, 0.3)',
                      cursor: 'not-allowed'
                    }}
                  >
                    <option value={companyEntity || 'Elite Digital Prints'}>🏢 {companyEntity || 'Elite Digital Prints'}</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Type of Purchase</label>
                  <select
                    value={purchaseForm.purchaseType || 'inventory'}
                    onChange={e => setPurchaseForm(f => ({ ...f, purchaseType: e.target.value }))}
                    style={{
                      ...inputStyle,
                      fontWeight: 700,
                      color: purchaseForm.purchaseType === 'expense' ? '#d97706' : '#2563eb',
                      background: purchaseForm.purchaseType === 'expense' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(37, 99, 235, 0.08)',
                      border: purchaseForm.purchaseType === 'expense' ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(37, 99, 235, 0.35)',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="inventory">📦 Inventory Purchase</option>
                    <option value="expense">💼 Expense Purchase</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Bill / Invoice No. *</label>
                  <input
                    type="text"
                    required
                    value={purchaseForm.purchaseNo}
                    onChange={e => setPurchaseForm(f => ({ ...f, purchaseNo: e.target.value }))}
                    style={inputStyle}
                    placeholder="e.g. PUR-2026-001"
                  />
                </div>

                <div>
                  <label style={labelStyle}>Challan No. / Ref</label>
                  <input
                    type="text"
                    value={purchaseForm.ourChallanNo || ''}
                    onChange={e => setPurchaseForm(f => ({ ...f, ourChallanNo: e.target.value }))}
                    placeholder="e.g. EDP-101 / VEN-44"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Inward / Bill Date *</label>
                  <input
                    type="date"
                    required
                    value={formatForInputDate(purchaseForm.date)}
                    onChange={e => setPurchaseForm(f => ({ ...f, date: e.target.value }))}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={{ ...labelStyle, color: '#6366f1', fontWeight: 800 }}>⚡ GST Tax Type (Dynamic)</label>
                  <select
                    value={purchaseForm.taxType}
                    onChange={e => setPurchaseForm(f => ({ ...f, taxType: e.target.value }))}
                    style={{
                      ...inputStyle,
                      fontWeight: '700',
                      color: '#4f46e5',
                      background: 'rgba(79, 70, 229, 0.12)',
                      border: '1px solid rgba(79, 70, 229, 0.4)'
                    }}
                  >
                    <option value="CGST_SGST">Intra-State (CGST + SGST)</option>
                    <option value="IGST">Inter-State (IGST)</option>
                  </select>
                </div>
              </div>

              {/* Vendor Details (Supplied By) - Mirrors Customer Details */}
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    🏢 Supplied By (Vendor / Supplier Details)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {vendorsList.length} Registered Vendors
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingVendorId(null);
                        setVendorForm({ name: '', businessName: '', phone: '', email: '', gstin: '', billingAddress: '', state: 'Gujarat', stateCode: '24', vendorType: 'General Supplier' });
                        setShowVendorModal(true);
                      }}
                      style={{
                        background: '#e0e7ff',
                        color: '#4338ca',
                        border: '1px solid #c7d2fe',
                        borderRadius: '6px',
                        padding: '2px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      + Add New Vendor
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.8rem' }}>
                  <div>
                    <label style={labelStyle}>Select Saved Vendor</label>
                    <select
                      value={purchaseForm.vendorName}
                      onChange={e => handlePurchaseVendorSelect(e.target.value)}
                      style={{ ...inputStyle, fontWeight: 700 }}
                    >
                      <option value="">-- Choose or Enter Vendor --</option>
                      {vendorOptions.map((v, idx) => (
                        <option key={idx} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Vendor / Contact Person *</label>
                    <input
                      id="purchase-vendor-name"
                      type="text"
                      required
                      value={purchaseForm.vendor.name}
                      onChange={e => setPurchaseForm(f => ({
                        ...f,
                        vendorName: f.vendor.businessName || e.target.value,
                        vendor: { ...f.vendor, name: e.target.value }
                      }))}
                      style={inputStyle}
                      placeholder="e.g. Ramesh Bhai"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Business / Firm Name</label>
                    <input
                      type="text"
                      value={purchaseForm.vendor.businessName}
                      onChange={e => setPurchaseForm(f => ({
                        ...f,
                        vendorName: e.target.value || f.vendor.name,
                        vendor: { ...f.vendor, businessName: e.target.value }
                      }))}
                      style={inputStyle}
                      placeholder="e.g. Shree Ram Textiles Pvt Ltd"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>GSTIN Number</label>
                    <input
                      type="text"
                      value={purchaseForm.vendor.gstin}
                      onChange={e => setPurchaseForm(f => ({
                        ...f,
                        vendor: { ...f.vendor, gstin: e.target.value }
                      }))}
                      style={inputStyle}
                      placeholder="e.g. 24AAAFE1234F1Z5"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Phone / Mobile</label>
                    <input
                      type="text"
                      value={purchaseForm.vendor.phone}
                      onChange={e => setPurchaseForm(f => ({
                        ...f,
                        vendor: { ...f.vendor, phone: e.target.value }
                      }))}
                      style={inputStyle}
                      placeholder="e.g. +91 9876543210"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Email Address</label>
                    <input
                      type="email"
                      value={purchaseForm.vendor.email}
                      onChange={e => setPurchaseForm(f => ({
                        ...f,
                        vendor: { ...f.vendor, email: e.target.value }
                      }))}
                      style={inputStyle}
                      placeholder="e.g. supplier@domain.com"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Billing / Supplier Address</label>
                    <input
                      type="text"
                      value={purchaseForm.vendor.billingAddress}
                      onChange={e => setPurchaseForm(f => ({
                        ...f,
                        vendor: { ...f.vendor, billingAddress: e.target.value }
                      }))}
                      style={inputStyle}
                      placeholder="Street / Mill Complex / Ring Road"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>State</label>
                    <input
                      type="text"
                      value={purchaseForm.vendor.state}
                      onChange={e => setPurchaseForm(f => ({
                        ...f,
                        vendor: { ...f.vendor, state: e.target.value }
                      }))}
                      style={inputStyle}
                      placeholder="e.g. Gujarat"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Purchase Line Items Table */}
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '1rem', overflowX: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase' }}>
                    📦 Purchase Line Items ({(purchaseForm.items || []).length})
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      id="purchase-add-item-btn"
                      onClick={handleAddPurchaseItem}
                      className="btn-secondary"
                      style={{ padding: '0.35rem 0.8rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#eff6ff', color: '#4f46e5', border: '1px solid #bfdbfe' }}
                    >
                      <Plus size={13} /> Add Item Row
                    </button>
                  </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '880px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #cbd5e1', fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>
                      <th style={{ padding: '0.5rem' }}>Item Description & Details</th>
                      <th style={{ padding: '0.5rem', width: '90px' }}>HSN</th>
                      <th style={{ padding: '0.5rem', width: '80px' }}>Qty</th>
                      <th style={{ padding: '0.5rem', width: '95px' }}>Unit</th>
                      <th style={{ padding: '0.5rem', width: '100px' }}>Price (₹)</th>
                      <th style={{ padding: '0.5rem', width: '75px' }}>Disc %</th>
                      <th style={{ padding: '0.5rem', width: '75px' }}>GST %</th>
                      <th style={{ padding: '0.5rem', width: '105px', textAlign: 'right' }}>Total (₹)</th>
                      <th style={{ padding: '0.5rem', width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculatedPurchase.items.map((it, idx) => (
                      <tr key={it.id || idx} style={{ borderBottom: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                        <td style={{ padding: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <input
                            id={`purchase-item-name-${idx}`}
                            type="text"
                            list={`purchase-items-list-${idx}`}
                            value={it.itemName}
                            onChange={e => handlePurchaseItemChange(idx, 'itemName', e.target.value)}
                            placeholder="Type item or select from catalog..."
                            style={inputStyle}
                            required
                          />
                          <datalist id={`purchase-items-list-${idx}`}>
                            {itemsList.map(item => <option key={item._id} value={item.itemName} />)}
                          </datalist>

                          <input
                            type="text"
                            value={it.description || ''}
                            onChange={e => handlePurchaseItemChange(idx, 'description', e.target.value)}
                            placeholder="Description (optional)..."
                            style={{ ...inputStyle, fontSize: '0.78rem', padding: '0.3rem 0.5rem', color: '#475569' }}
                          />
                        </td>
                        <td style={{ padding: '0.4rem' }}>
                          <input
                            type="text"
                            value={it.hsnCode}
                            onChange={e => handlePurchaseItemChange(idx, 'hsnCode', e.target.value)}
                            style={inputStyle}
                          />
                        </td>
                        <td style={{ padding: '0.4rem' }}>
                          <input
                            id={`purchase-item-qty-${idx}`}
                            data-primary-qty={idx === 0 ? "true" : undefined}
                            type="number"
                            step="any"
                            value={it.qty}
                            onChange={e => handlePurchaseItemChange(idx, 'qty', e.target.value)}
                            style={inputStyle}
                          />
                        </td>
                        <td style={{ padding: '0.4rem' }}>
                          <select
                            value={it.unit}
                            onChange={e => handlePurchaseItemChange(idx, 'unit', e.target.value)}
                            style={inputStyle}
                          >
                            <option value="Meters">Meters</option>
                            <option value="Mtr">Mtr</option>
                            <option value="Pcs">Pcs</option>
                            <option value="Rolls">Rolls</option>
                            <option value="KG">KG</option>
                            <option value="Kg">Kg</option>
                            <option value="Ltr">Ltr</option>
                            <option value="Boxes">Boxes</option>
                            <option value="Bags">Bags</option>
                            <option value="Set">Set</option>
                            <option value="Hours">Hours</option>
                          </select>
                        </td>
                        <td style={{ padding: '0.4rem' }}>
                          <input
                            id={`purchase-item-price-${idx}`}
                            type="number"
                            step="any"
                            value={it.unitPrice}
                            onChange={e => handlePurchaseItemChange(idx, 'unitPrice', e.target.value)}
                            style={inputStyle}
                          />
                        </td>
                        <td style={{ padding: '0.4rem' }}>
                          <input
                            type="number"
                            step="any"
                            value={it.discountPct}
                            onChange={e => handlePurchaseItemChange(idx, 'discountPct', e.target.value)}
                            style={inputStyle}
                          />
                        </td>
                        <td style={{ padding: '0.4rem' }}>
                          <select
                            value={it.taxRate}
                            onChange={e => handlePurchaseItemChange(idx, 'taxRate', e.target.value)}
                            style={inputStyle}
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                          </select>
                        </td>
                        <td style={{ padding: '0.4rem', textAlign: 'right', fontWeight: 800, color: '#1e293b' }}>
                          ₹ {(it.totalAmount || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                          {(purchaseForm.items || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePurchaseItem(idx)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                              title="Remove Row"
                            >
                              <X size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Summary & Tax Breakdown Box (mirroring Invoice) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginTop: '0.2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <div>
                    <label style={labelStyle}>Notes for Vendor / Inward Remarks</label>
                    <textarea
                      rows={3}
                      value={purchaseForm.notes}
                      onChange={e => setPurchaseForm(f => ({ ...f, notes: e.target.value }))}
                      style={inputStyle}
                      placeholder="e.g. Delivery challan verified, fabric quality approved, transporter: XYZ Logistics"
                    />
                  </div>
                </div>

                <div style={{ padding: '1.1rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#64748b' }}>Subtotal:</span>
                    <span style={{ fontWeight: 700 }}>₹ {calculatedPurchase.subtotal.toFixed(2)}</span>
                  </div>

                  {calculatedPurchase.discountTotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#16a34a' }}>
                      <span>Discount:</span>
                      <span>- ₹ {calculatedPurchase.discountTotal.toFixed(2)}</span>
                    </div>
                  )}

                  {purchaseForm.taxType === 'IGST' ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#64748b' }}>
                        IGST Tax ({calculatedPurchase.netSubtotal > 0 ? ((calculatedPurchase.totalTax / calculatedPurchase.netSubtotal) * 100).toFixed(1) : 5}%):
                      </span>
                      <span style={{ fontWeight: 700, color: '#4f46e5' }}>₹ {calculatedPurchase.igstAmount.toFixed(2)}</span>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: '#64748b' }}>
                          CGST Tax ({calculatedPurchase.netSubtotal > 0 ? ((calculatedPurchase.totalTax / calculatedPurchase.netSubtotal / 2) * 100).toFixed(1) : 2.5}%):
                        </span>
                        <span style={{ fontWeight: 700, color: '#4f46e5' }}>₹ {calculatedPurchase.cgstAmount.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: '#64748b' }}>
                          SGST Tax ({calculatedPurchase.netSubtotal > 0 ? ((calculatedPurchase.totalTax / calculatedPurchase.netSubtotal / 2) * 100).toFixed(1) : 2.5}%):
                        </span>
                        <span style={{ fontWeight: 700, color: '#4f46e5' }}>₹ {calculatedPurchase.sgstAmount.toFixed(2)}</span>
                      </div>
                    </>
                  )}

                  {/* Round Off Checkbox & Value */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: '#4f46e5', marginTop: '0.2rem', paddingTop: '0.2rem', borderTop: '1px dashed #cbd5e1' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={purchaseForm.enableRoundOff !== false}
                        onChange={e => setPurchaseForm(f => ({ ...f, enableRoundOff: e.target.checked, manualRoundOff: undefined }))}
                      />
                      Round Off Total
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      disabled={purchaseForm.enableRoundOff === false}
                      value={purchaseForm.manualRoundOff !== undefined ? purchaseForm.manualRoundOff : calculatedPurchase.roundOff}
                      onChange={e => setPurchaseForm(f => ({ ...f, manualRoundOff: e.target.value === '' ? undefined : parseFloat(e.target.value), enableRoundOff: true }))}
                      onBlur={e => { if (e.target.value === '') setPurchaseForm(f => ({ ...f, manualRoundOff: undefined })); }}
                      style={{ width: '90px', padding: '0.25rem 0.5rem', fontSize: '0.85rem', fontWeight: 700, background: 'rgba(79, 70, 229, 0.08)', border: '1px solid rgba(79, 70, 229, 0.3)', borderRadius: '5px', color: '#4f46e5', textAlign: 'right' }}
                      title="Auto-calculated. Edit to set manually."
                    />
                  </div>

                  <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: 900, color: '#4f46e5' }}>
                    <span>Grand Total:</span>
                    <span>₹ {calculatedPurchase.grandTotal.toFixed(2)}</span>
                  </div>

                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', marginTop: '0.1rem' }}>
                    Amount in Words: {numToWords(calculatedPurchase.grandTotal)}
                  </div>

                  <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Advance / Paid Amount (₹)</label>
                      <input
                        type="number"
                        step="any"
                        value={purchaseForm.paidAmount}
                        onChange={e => setPurchaseForm(f => ({ ...f, paidAmount: e.target.value }))}
                        style={inputStyle}
                        placeholder="0.00"
                      />
                    </div>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>BALANCE DUE</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 900, color: calculatedPurchase.balanceDue > 0 ? '#ef4444' : '#16a34a' }}>
                        ₹ {calculatedPurchase.balanceDue.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button type="button" onClick={() => setShowPurchaseModal(false)} style={{ padding: '0.55rem 1.2rem', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: '0.6rem 1.6rem', background: 'linear-gradient(135deg, #4f46e5, #3b82f6)', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}>
                  Save Purchase Inward Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── VIEW PURCHASE ENTRY DETAILS MODAL ────────────────────────── */}
      {viewPurchaseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', overflowX: 'hidden', background: '#ffffff', borderRadius: '14px', border: '1px solid #cbd5e1', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(135deg, #1e40af, #2563eb)', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShoppingBag size={20} /> Purchase Inward Details — {viewPurchaseModal.purchaseNo}
              </h3>
              <button onClick={() => setViewPurchaseModal(null)} style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', color: '#1e293b' }}>
              {/* Metadata & Vendor Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '1.1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>SUPPLIED BY VENDOR</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>{viewPurchaseModal.vendor?.businessName || viewPurchaseModal.vendorName}</div>
                  {viewPurchaseModal.vendor?.name && viewPurchaseModal.vendor?.name !== viewPurchaseModal.vendor?.businessName && (
                    <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 2 }}>Contact: <strong>{viewPurchaseModal.vendor.name}</strong></div>
                  )}
                  {viewPurchaseModal.vendor?.gstin && (
                    <div style={{ fontSize: '0.78rem', color: '#4f46e5', fontWeight: 700, marginTop: 3 }}>
                      GSTIN: {viewPurchaseModal.vendor.gstin}
                    </div>
                  )}
                  {viewPurchaseModal.vendor?.billingAddress && (
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 3 }}>
                      {viewPurchaseModal.vendor.billingAddress}
                      {viewPurchaseModal.vendor?.state ? `, ${viewPurchaseModal.vendor.state}` : ''}
                    </div>
                  )}
                  {viewPurchaseModal.vendor?.phone && (
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                      Phone: {viewPurchaseModal.vendor.phone}
                    </div>
                  )}
                  {viewPurchaseModal.vendor?.email && (
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                      Email: {viewPurchaseModal.vendor.email}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>PURCHASE BILL DETAILS</div>
                  <div style={{ fontSize: '1rem', fontWeight: 900, color: '#4f46e5' }}>{viewPurchaseModal.purchaseNo}</div>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: viewPurchaseModal.purchaseType === 'expense' ? '#b45309' : '#1d4ed8', marginTop: 2 }}>
                    Type: {viewPurchaseModal.purchaseType === 'expense' ? '💼 Expense Purchase' : '📦 Inventory Purchase'}
                  </div>
                  {viewPurchaseModal.ourChallanNo && (
                    <div style={{ fontSize: '0.8rem', color: '#0284c7', fontWeight: 700, marginTop: 2 }}>
                      Challan / Ref: {viewPurchaseModal.ourChallanNo}
                    </div>
                  )}
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 4 }}>
                    Inward Date: <strong>{viewPurchaseModal.date ? (typeof viewPurchaseModal.date === 'string' && viewPurchaseModal.date.includes('T') ? viewPurchaseModal.date.split('T')[0] : (viewPurchaseModal.date instanceof Date ? viewPurchaseModal.date.toISOString().split('T')[0] : viewPurchaseModal.date)) : ''}</strong>
                  </div>
                  {viewPurchaseModal.dueDate && (
                    <div style={{ fontSize: '0.78rem', color: '#d97706', marginTop: 2 }}>
                      Due Date: {typeof viewPurchaseModal.dueDate === 'string' && viewPurchaseModal.dueDate.includes('T') ? viewPurchaseModal.dueDate.split('T')[0] : (viewPurchaseModal.dueDate instanceof Date ? viewPurchaseModal.dueDate.toISOString().split('T')[0] : viewPurchaseModal.dueDate)}
                    </div>
                  )}
                  <div style={{ marginTop: '0.5rem' }}>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      display: 'inline-block',
                      background: viewPurchaseModal.paymentStatus === 'PAID' ? '#ecfdf5' : (viewPurchaseModal.paymentStatus === 'PARTIALLY_PAID' || viewPurchaseModal.paymentStatus === 'PARTIAL') ? '#fffbeb' : '#fef2f2',
                      color: viewPurchaseModal.paymentStatus === 'PAID' ? '#059669' : (viewPurchaseModal.paymentStatus === 'PARTIALLY_PAID' || viewPurchaseModal.paymentStatus === 'PARTIAL') ? '#d97706' : '#dc2626',
                      border: `1px solid ${viewPurchaseModal.paymentStatus === 'PAID' ? '#6ee7b7' : (viewPurchaseModal.paymentStatus === 'PARTIALLY_PAID' || viewPurchaseModal.paymentStatus === 'PARTIAL') ? '#fcd34d' : '#fca5a5'}`
                    }}>
                      {viewPurchaseModal.paymentStatus || 'UNPAID'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div>
                <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.88rem', fontWeight: 800, color: '#334155' }}>
                  📦 Purchased Items Breakdown ({Array.isArray(viewPurchaseModal.items) ? viewPurchaseModal.items.length : 1})
                </h4>
                <div style={{ borderRadius: '8px', border: '1px solid #cbd5e1', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#475569', fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '0.6rem 0.8rem', width: '30px' }}>#</th>
                        <th style={{ padding: '0.6rem 0.8rem' }}>Item Description</th>
                        <th style={{ padding: '0.6rem 0.8rem' }}>HSN</th>
                        <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>Qty</th>
                        <th style={{ padding: '0.6rem 0.8rem' }}>Unit</th>
                        <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>Rate (₹)</th>
                        <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>GST %</th>
                        <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(viewPurchaseModal.items) && viewPurchaseModal.items.length > 0 ? (
                        viewPurchaseModal.items.map((it, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.6rem 0.8rem', color: '#64748b', fontWeight: 700 }}>{idx + 1}</td>
                            <td style={{ padding: '0.6rem 0.8rem', fontWeight: 700 }}>
                              <div>{it.itemName}</div>
                              {it.description && (
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, marginTop: 2 }}>
                                  {it.description}
                                </div>
                              )}
                              {(it.jobNo || it.lotNo || it.partyChallan || it.ourChallanNo) && (
                                <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', gap: '0.4rem', marginTop: 2, flexWrap: 'wrap' }}>
                                  {it.jobNo && <span style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>Job: {it.jobNo}</span>}
                                  {it.lotNo && <span style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>Lot: {it.lotNo}</span>}
                                  {it.partyChallan && <span style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>Vendor Ch: {it.partyChallan}</span>}
                                  {it.ourChallanNo && <span style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>Challan: {it.ourChallanNo}</span>}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '0.6rem 0.8rem', color: '#64748b' }}>{it.hsnCode || '998821'}</td>
                            <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right', fontWeight: 700 }}>{it.qty || it.quantity}</td>
                            <td style={{ padding: '0.6rem 0.8rem', color: '#64748b' }}>{it.unit || 'Meters'}</td>
                            <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>₹{it.unitPrice || it.rate}</td>
                            <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>{it.taxRate != null ? `${it.taxRate}%` : `${viewPurchaseModal.gstRate || 0}%`}</td>
                            <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right', fontWeight: 800, color: '#0284c7' }}>₹{Number(it.totalAmount || it.amount || ((it.qty || it.quantity || 1) * (it.unitPrice || it.rate || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td style={{ padding: '0.6rem 0.8rem', color: '#64748b' }}>1</td>
                          <td style={{ padding: '0.6rem 0.8rem', fontWeight: 700 }}>{viewPurchaseModal.itemName}</td>
                          <td style={{ padding: '0.6rem 0.8rem', color: '#64748b' }}>998821</td>
                          <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right', fontWeight: 700 }}>{viewPurchaseModal.quantity}</td>
                          <td style={{ padding: '0.6rem 0.8rem', color: '#64748b' }}>{viewPurchaseModal.unit}</td>
                          <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>{viewPurchaseModal.rate !== '-' ? `₹${viewPurchaseModal.rate}` : '-'}</td>
                          <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>{viewPurchaseModal.gstRate || 0}%</td>
                          <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right', fontWeight: 800, color: '#0284c7' }}>₹{Number(viewPurchaseModal.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Calculation Breakdown */}
              <div style={{ background: '#f8fafc', border: '1.5px solid #93c5fd', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748b' }}>Subtotal:</span>
                  <strong style={{ color: '#1e293b' }}>
                    ₹{Number(viewPurchaseModal.subtotal || viewPurchaseModal.subtotalAmount || (viewPurchaseModal.totalAmount - (viewPurchaseModal.totalTax || viewPurchaseModal.gstAmount || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </div>

                {viewPurchaseModal.discountTotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#16a34a' }}>
                    <span>Discount:</span>
                    <strong>- ₹{Number(viewPurchaseModal.discountTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                )}

                {viewPurchaseModal.taxType === 'IGST' ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#64748b' }}>IGST Tax ({viewPurchaseModal.gstRate || 5}%):</span>
                    <strong style={{ color: '#4f46e5' }}>
                      + ₹{Number(viewPurchaseModal.igstAmount || viewPurchaseModal.totalTax || viewPurchaseModal.gstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#64748b' }}>CGST Tax:</span>
                      <strong style={{ color: '#4f46e5' }}>
                        + ₹{Number(viewPurchaseModal.cgstAmount || ((viewPurchaseModal.totalTax || viewPurchaseModal.gstAmount || 0) / 2)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#64748b' }}>SGST Tax:</span>
                      <strong style={{ color: '#4f46e5' }}>
                        + ₹{Number(viewPurchaseModal.sgstAmount || ((viewPurchaseModal.totalTax || viewPurchaseModal.gstAmount || 0) / 2)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </>
                )}

                {viewPurchaseModal.roundOff !== 0 && viewPurchaseModal.roundOff != null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#64748b' }}>Round Off:</span>
                    <strong style={{ color: '#4f46e5' }}>
                      {viewPurchaseModal.roundOff > 0 ? `+ ₹${Number(viewPurchaseModal.roundOff).toFixed(2)}` : `- ₹${Math.abs(Number(viewPurchaseModal.roundOff)).toFixed(2)}`}
                    </strong>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1.5px solid #cbd5e1', paddingTop: '0.6rem', marginTop: '0.2rem' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0369a1' }}>Grand Total:</span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0284c7' }}>₹{Number(viewPurchaseModal.grandTotal || viewPurchaseModal.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem', marginTop: '0.2rem' }}>
                  <span style={{ color: '#16a34a', fontWeight: 700 }}>Advance / Paid Amount:</span>
                  <strong style={{ color: '#16a34a' }}>₹{Number(viewPurchaseModal.paidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: '#dc2626', fontWeight: 800 }}>Balance Due:</span>
                  <strong style={{ color: (viewPurchaseModal.balanceDue > 0 || (viewPurchaseModal.grandTotal || viewPurchaseModal.totalAmount) > (viewPurchaseModal.paidAmount || 0)) ? '#dc2626' : '#16a34a' }}>
                    ₹{Number(viewPurchaseModal.balanceDue != null ? viewPurchaseModal.balanceDue : Math.max(0, (viewPurchaseModal.grandTotal || viewPurchaseModal.totalAmount || 0) - (viewPurchaseModal.paidAmount || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>

              {viewPurchaseModal.notes && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: 2 }}>Notes / Remarks</div>
                  <div style={{ fontSize: '0.85rem', color: '#334155', background: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>{viewPurchaseModal.notes}</div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    const p = viewPurchaseModal;
                    setViewPurchaseModal(null);
                    handleEditPurchase(p);
                  }}
                  style={{ padding: '0.5rem 1.1rem', background: '#f59e0b', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Edit2 size={15} /> Edit Purchase Entry
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const p = viewPurchaseModal;
                    handlePrintPurchase(p);
                  }}
                  style={{ padding: '0.5rem 1.1rem', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <Printer size={15} /> Print Purchase Voucher
                </button>
                <button type="button" onClick={() => setViewPurchaseModal(null)} style={{ padding: '0.5rem 1.2rem', background: '#475569', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 800, cursor: 'pointer' }}>
                  Close
                </button>
              </div>
            </div>
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
                            <div
                              style={{ position: 'relative', width: 44, height: 44, cursor: 'pointer', borderRadius: 8, overflow: 'hidden', border: '1.5px solid #cbd5e1', boxShadow: '0 2px 4px rgba(0,0,0,0.08)', background: '#f8fafc' }}
                              onClick={() => setPreviewImageModal({ url: convertDriveUrl(it.imageUrl, it.itemName), title: it.itemName, jobNo: it.jobNo, fabric: it.fabric })}
                              title="Click to view full design preview"
                            >
                              <img
                                src={convertDriveUrl(it.imageUrl, it.itemName)}
                                alt="Item"
                                style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.18s ease' }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.12)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                onError={e => {
                                  e.target.style.display = 'none';
                                  if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                              <div style={{ display: 'none', width: '100%', height: '100%', background: '#f1f5f9', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>
                                No Img
                              </div>
                            </div>
                          ) : (
                            <div style={{ width: 44, height: 44, borderRadius: 8, background: '#f1f5f9', border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>
                              No Img
                            </div>
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
                <tfoot>
                  <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 800 }}>
                    <td colSpan={4} style={{ padding: '0.65rem', textAlign: 'right', color: '#475569', fontSize: '0.8rem' }}>Total Qty:</td>
                    <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', color: '#6d28d9', fontSize: '0.9rem', fontWeight: 900 }}>
                      {(viewInvoiceModal.items || []).reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0).toFixed(2)} {viewInvoiceModal.items?.[0]?.unit || 'MTR'}
                    </td>
                    <td colSpan={2} style={{ padding: '0.65rem' }}></td>
                  </tr>
                </tfoot>
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
              <button
                style={{ padding: '0.5rem 1.1rem', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                disabled={printingInvoiceId === viewInvoiceModal._id}
                onClick={async () => {
                  setPrintingInvoiceId(viewInvoiceModal._id);
                  try {
                    triggerPushNotification('🖨️ Preparing Invoice', `Loading images & preparing print for #${viewInvoiceModal.invoiceNo}...`, 'info');
                    await api.downloadInvoicePdf(viewInvoiceModal._id, viewInvoiceModal.invoiceNo, false);
                  } catch (err) {
                    alert('Failed to load invoice for printing: ' + err.message);
                  } finally {
                    setPrintingInvoiceId(null);
                  }
                }}
              >
                <Printer size={15} /> {printingInvoiceId === viewInvoiceModal._id ? 'Loading Images...' : 'Print Invoice'}
              </button>
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
              <button style={{ padding: '0.5rem 1.1rem', background: 'rgba(139, 92, 246, 0.1)', color: '#7c3aed', border: '1px solid #c4b5fd', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }} onClick={() => { const inv = viewInvoiceModal; setViewInvoiceModal(null); handleCloneInvoice(inv); }}>
                <Copy size={15} /> Clone Invoice
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

      {/* ── CREATE / EDIT VENDOR MODAL ────────────────────────────────────────── */}
      {showVendorModal && (
        <div className="modal-overlay" style={{ alignItems: 'center' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                {editingVendorId ? 'Edit Vendor / Supplier' : 'Add New Vendor / Supplier'}
              </h3>
              <button onClick={() => setShowVendorModal(false)} className="btn-icon"><X size={16} /></button>
            </div>

            <div>
              <label style={labelStyle}>Contact Person / Representative Name *</label>
              <input 
                type="text" 
                value={vendorForm.name} 
                onChange={e => setVendorForm(f => ({ ...f, name: e.target.value }))} 
                style={inputStyle} 
                placeholder="e.g. Ramesh Patel" 
              />
            </div>

            <div>
              <label style={labelStyle}>Business / Supplier Firm Name</label>
              <input 
                type="text" 
                value={vendorForm.businessName} 
                onChange={e => setVendorForm(f => ({ ...f, businessName: e.target.value }))} 
                style={inputStyle} 
                placeholder="e.g. Surat Textile Mills Pvt Ltd" 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <input 
                  type="text" 
                  value={vendorForm.phone} 
                  onChange={e => setVendorForm(f => ({ ...f, phone: e.target.value }))} 
                  style={inputStyle} 
                  placeholder="e.g. 9876543210" 
                />
              </div>
              <div>
                <label style={labelStyle}>GSTIN Number</label>
                <input 
                  type="text" 
                  value={vendorForm.gstin} 
                  onChange={e => setVendorForm(f => ({ ...f, gstin: e.target.value }))} 
                  style={inputStyle} 
                  placeholder="e.g. 24AAAAA0000A1Z5" 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div>
                <label style={labelStyle}>Email Address</label>
                <input 
                  type="email" 
                  value={vendorForm.email} 
                  onChange={e => setVendorForm(f => ({ ...f, email: e.target.value }))} 
                  style={inputStyle} 
                  placeholder="vendor@company.com" 
                />
              </div>
              <div>
                <label style={labelStyle}>Vendor Category</label>
                <select 
                  value={vendorForm.vendorType} 
                  onChange={e => setVendorForm(f => ({ ...f, vendorType: e.target.value }))} 
                  style={inputStyle}
                >
                  <option value="Fabric">Fabric Supplier</option>
                  <option value="Inks & Chemicals">Inks & Chemicals</option>
                  <option value="Packaging & Accessories">Packaging & Accessories</option>
                  <option value="Machinery & Spares">Machinery & Spares</option>
                  <option value="General Supplier">General Supplier</option>
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Billing / Factory Address</label>
              <textarea 
                rows={2} 
                value={vendorForm.billingAddress} 
                onChange={e => setVendorForm(f => ({ ...f, billingAddress: e.target.value }))} 
                style={inputStyle} 
                placeholder="Plot no, GIDC, Ring Road, Surat..." 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div>
                <label style={labelStyle}>State</label>
                <input 
                  type="text" 
                  value={vendorForm.state} 
                  onChange={e => setVendorForm(f => ({ ...f, state: e.target.value }))} 
                  style={inputStyle} 
                />
              </div>
              <div>
                <label style={labelStyle}>State Code</label>
                <input 
                  type="text" 
                  value={vendorForm.stateCode} 
                  onChange={e => setVendorForm(f => ({ ...f, stateCode: e.target.value }))} 
                  style={inputStyle} 
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button className="btn-secondary" onClick={() => setShowVendorModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveVendor}>
                {editingVendorId ? 'Update Vendor' : 'Save Vendor'}
              </button>
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
                  <option value="KG">KG</option>
                  <option value="Kg">Kg</option>
                  <option value="Pcs">Pcs</option>
                  <option value="Rolls">Rolls</option>
                  <option value="Ltr">Ltr</option>
                  <option value="Boxes">Boxes</option>
                  <option value="Bags">Bags</option>
                  <option value="Set">Set</option>
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

      {/* ── DOWNLOAD ACCOUNTS & PARTY LEDGER MODAL (WHITE & BLUE THEME) ─────────────── */}
      {showLedgerModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1050, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#ffffff', border: '1.5px solid #bfdbfe', borderRadius: '16px', width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)', color: '#0f172a', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                  <BookOpen size={22} color="#0284c7" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Ledger Export &amp; Accounts Statement</h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Download Party Account Statements &amp; Global Master Ledgers</span>
                </div>
              </div>
              <button onClick={() => setShowLedgerModal(false)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#64748b', cursor: 'pointer', padding: '0.35rem 0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            {/* Mode Selector Tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '0.35rem', borderRadius: '10px' }}>
              <button
                onClick={() => setLedgerMode('party')}
                style={{
                  padding: '0.65rem',
                  borderRadius: '7px',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  background: ledgerMode === 'party' ? 'linear-gradient(135deg, #0284c7, #2563eb)' : 'transparent',
                  color: ledgerMode === 'party' ? '#ffffff' : '#64748b',
                  boxShadow: ledgerMode === 'party' ? '0 4px 12px rgba(37, 99, 235, 0.25)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                👤 Mode A: Party-Wise Detailed Ledger
              </button>
              <button
                onClick={() => setLedgerMode('master')}
                style={{
                  padding: '0.65rem',
                  borderRadius: '7px',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  background: ledgerMode === 'master' ? 'linear-gradient(135deg, #0284c7, #2563eb)' : 'transparent',
                  color: ledgerMode === 'master' ? '#ffffff' : '#64748b',
                  boxShadow: ledgerMode === 'master' ? '0 4px 12px rgba(37, 99, 235, 0.25)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                🌐 Mode B: All-Parties Master Ledger
              </button>
            </div>

            {/* Mode A: Select Party */}
            {ledgerMode === 'party' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>Select Customer / Party Account</label>
                <select
                  value={selectedPartyId}
                  onChange={e => setSelectedPartyId(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '8px', color: '#0f172a', fontSize: '0.85rem', fontWeight: 600, outline: 'none' }}
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
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>Date Range Filter</label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'this_month', label: 'This Month' },
                  { id: 'last_quarter', label: 'Last Quarter' },
                  { id: 'fy_ytd', label: 'Financial Year (YTD)' },
                  { id: 'all_time', label: 'All Time' },
                  { id: 'custom', label: 'Custom Date' }
                ].map(preset => {
                  const isSel = ledgerPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => setLedgerPreset(preset.id)}
                      style={{
                        padding: '0.4rem 0.85rem',
                        borderRadius: '6px',
                        border: '1.5px solid',
                        borderColor: isSel ? '#0284c7' : '#cbd5e1',
                        background: isSel ? '#eff6ff' : '#ffffff',
                        color: isSel ? '#0284c7' : '#64748b',
                        fontSize: '0.78rem',
                        fontWeight: isSel ? 800 : 600,
                        cursor: 'pointer'
                      }}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {ledgerPreset === 'custom' && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.85rem',
                  marginTop: '0.4rem',
                  padding: '0.85rem 1rem',
                  background: 'rgba(2, 132, 199, 0.04)',
                  borderRadius: '10px',
                  border: '1px solid rgba(2, 132, 199, 0.2)'
                }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: '#0369a1', fontWeight: 700, marginBottom: '0.3rem' }}>
                      <Calendar size={13} /> FROM DATE
                    </label>
                    <input
                      type="date"
                      value={ledgerDateStart}
                      onChange={e => setLedgerDateStart(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.65rem',
                        background: '#ffffff',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '6px',
                        color: '#0f172a',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: '#0369a1', fontWeight: 700, marginBottom: '0.3rem' }}>
                      <Calendar size={13} /> TO DATE
                    </label>
                    <input
                      type="date"
                      value={ledgerDateEnd}
                      onChange={e => setLedgerDateEnd(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.65rem',
                        background: '#ffffff',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '6px',
                        color: '#0f172a',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Export Format Selector — 5 Formats (Excel, PDF, CSV, Tally XML, Quick Print) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>Select Export Format</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
                {[
                  { id: 'excel', label: '📊 Excel (.xlsx)', icon: FileSpreadsheet },
                  { id: 'pdf', label: '📄 PDF Document', icon: FileText },
                  { id: 'csv', label: '📁 CSV File', icon: Download },
                  { id: 'tally', label: '🏛️ Tally (XML)', icon: FileCode },
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
                        justifyContent: 'center',
                        gap: '0.35rem',
                        padding: '0.75rem 0.4rem',
                        borderRadius: '10px',
                        border: isSel ? '2px solid #0284c7' : '1px solid #cbd5e1',
                        background: isSel ? '#eff6ff' : '#ffffff',
                        color: isSel ? '#0284c7' : '#475569',
                        fontWeight: isSel ? 800 : 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        boxShadow: isSel ? '0 4px 12px rgba(2, 132, 199, 0.15)' : 'none',
                        transition: 'all 0.15s'
                      }}
                    >
                      <Icon size={20} color={isSel ? '#0284c7' : '#64748b'} />
                      <span style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{fmt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Calculated Summary Box (White & Blue) */}
            {(() => {
              const { startD, endD } = getLedgerDateRange();
              if (ledgerMode === 'party') {
                const ledger = computePartyLedger(selectedPartyId, startD, endD);
                return (
                  <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1rem', border: '1.5px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Opening Balance</div>
                      <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a', marginTop: 2 }}>{fmtINR(ledger.openingBalance)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Total Debit (Billed)</div>
                      <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0284c7', marginTop: 2 }}>{fmtINR(ledger.totalDebit)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Total Credit (Paid)</div>
                      <div style={{ fontSize: '1rem', fontWeight: 900, color: '#16a34a', marginTop: 2 }}>{fmtINR(ledger.totalCredit)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Closing Balance</div>
                      <div style={{ fontSize: '1rem', fontWeight: 900, color: ledger.closingBalance > 0 ? '#ea580c' : '#16a34a', marginTop: 2 }}>{fmtINR(ledger.closingBalance)} ({ledger.closingBalance >= 0 ? 'Dr' : 'Cr'})</div>
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
                  <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1rem', border: '1.5px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Parties Count</div>
                      <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a', marginTop: 2 }}>{customers.length} Accounts</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Period Billed</div>
                      <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0284c7', marginTop: 2 }}>{fmtINR(grandBilled)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Period Collected</div>
                      <div style={{ fontSize: '1rem', fontWeight: 900, color: '#16a34a', marginTop: 2 }}>{fmtINR(grandPaid)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Total Outstanding</div>
                      <div style={{ fontSize: '1rem', fontWeight: 900, color: '#ea580c', marginTop: 2 }}>{fmtINR(grandBal)}</div>
                    </div>
                  </div>
                );
              }
            })()}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
              <button onClick={() => setShowLedgerModal(false)} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={handleGenerateLedgerExport}
                style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)', border: 'none', color: '#ffffff', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)' }}
              >
                <Download size={16} /> Generate &amp; Download Ledger
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Tax Invoice Staff Audit History Modal */}
      {selectedInvoiceHistory && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            width: '100%', maxWidth: '600px', background: '#ffffff', border: '1px solid #e2e8f0',
            borderRadius: '14px', padding: '1.25rem', color: '#0f172a', boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0284c7', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} /> Tax Invoice #{selectedInvoiceHistory.invoiceNo} — Staff Audit Log
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Staff member attribution for invoice generation and billing history.
                </p>
              </div>
              <button className="btn-icon" onClick={() => setSelectedInvoiceHistory(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>Generated By (Staff):</span>
                <span style={{ padding: '3px 10px', borderRadius: '6px', background: '#eff6ff', color: '#2563eb', fontWeight: 800, fontSize: '0.85rem', border: '1px solid #bfdbfe' }}>
                  {selectedInvoiceHistory.createdByName || selectedInvoiceHistory.createdBy || 'HASI'}
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '0.75rem' }}>
                <div>Customer: <strong style={{ color: '#0f172a' }}>{selectedInvoiceHistory.customer?.businessName || selectedInvoiceHistory.customer?.name || 'Client'}</strong></div>
                <div>Grand Total: <strong style={{ color: '#16a34a' }}>{fmtINR(selectedInvoiceHistory.grandTotal)}</strong></div>
                <div>Invoice Date: <strong style={{ color: '#0f172a' }}>{formatDateDDMMYYYY(selectedInvoiceHistory.invoiceDate)}</strong></div>
                <div>Payment Status: <strong style={{ color: selectedInvoiceHistory.paymentStatus === 'PAID' ? '#16a34a' : '#ef4444' }}>{selectedInvoiceHistory.paymentStatus}</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {signedUploadTarget && (
        <SignedDocumentUploadModal
          isOpen={!!signedUploadTarget}
          onClose={() => setSignedUploadTarget(null)}
          docType={signedUploadTarget.docType || "invoice"}
          docId={signedUploadTarget.id}
          docNumber={signedUploadTarget.docNumber}
          partyName={signedUploadTarget.partyName}
          existingSignedCopy={signedUploadTarget.existingSignedCopy}
          onSuccess={() => { loadData(); fetchDigitalChallans(); }}
        />
      )}

      {signedPreviewTarget && (
        <SignedDocumentPreviewModal
          isOpen={!!signedPreviewTarget}
          onClose={() => setSignedPreviewTarget(null)}
          documentData={signedPreviewTarget}
          isAdmin={currentUser?.role === 'admin' || currentUser?.isMainAdmin}
          onStatusUpdated={() => { loadData(); fetchDigitalChallans(); }}
          onReupload={(docData) => {
            setSignedPreviewTarget(null);
            setSignedUploadTarget({
              id: docData._id,
              docType: docData.docType || 'invoice',
              docNumber: docData.docNumber,
              partyName: docData.partyName,
              existingSignedCopy: docData.signedCopy
            });
          }}
        />
      )}

      {previewImageModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.78)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            padding: '1.5rem',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => setPreviewImageModal(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: '1.25rem',
              maxWidth: '92vw',
              maxHeight: '92vh',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>{previewImageModal.title || 'Design Artwork Preview'}</h4>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 4 }}>
                  {previewImageModal.jobNo && <span style={{ fontSize: '0.75rem', color: '#7c3aed', background: '#f3e8ff', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>Job: {previewImageModal.jobNo}</span>}
                  {previewImageModal.fabric && <span style={{ fontSize: '0.75rem', color: '#0284c7', background: '#e0f2fe', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>Fabric: {previewImageModal.fabric}</span>}
                </div>
              </div>
              <button
                onClick={() => setPreviewImageModal(null)}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, padding: '0.45rem 0.85rem', fontWeight: 700, cursor: 'pointer', color: '#475569' }}
              >
                ✕ Close
              </button>
            </div>
            <img
              src={previewImageModal.url}
              alt="Design Preview"
              style={{ maxWidth: '82vw', maxHeight: '70vh', objectFit: 'contain', borderRadius: 10, border: '1px solid #e2e8f0' }}
            />
          </div>
        </div>
      )}

      {/* ── NON-BLOCKING VALIDATION PILL DOCK ── */}
      <ValidationDock errors={validationErrors} onDismiss={clearValidationErrors} />

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
