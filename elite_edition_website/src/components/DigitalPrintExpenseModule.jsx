import React, { useState, useEffect } from 'react';
import { api, getBaseUrl } from '../services/api';
import {
  PlusCircle, Search, RefreshCw, Edit2, Trash2, X, Save, Image as ImageIcon,
  CheckCircle, ShieldAlert, Download, Filter, Eye, AlertCircle, Clock, CheckCircle2,
  User, FileText, ArrowRight, Calendar, Wallet, TrendingUp, TrendingDown, DollarSign, CreditCard,
  Users, Building2, CheckSquare, Square, ShoppingBag, Settings, Landmark, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { triggerEliteAlert, triggerEliteConfirm } from './EliteModalDialog';
import DateRangePicker from './DateRangePicker';
import UnifiedFilterPopover from './common/UnifiedFilterPopover';
import { triggerGlobalDataRefresh } from './NotificationToast';
import { SmartThumbnail } from './common/SmartThumbnail';
import { StandardNumericInput } from './common/StandardNumericInput';

const DEFAULT_IN_CATEGORIES = [
  'Petty Cash Top-up',
  'Client Payment / Advance',
  'Scrap / Waste Sale',
  'Refund / Cashback',
  'Other Receipt'
];

const DEFAULT_OUT_CATEGORIES = [
  'Machine Maintenance & Service',
  'Ink & Consumables',
  'Spare Parts & Repairs',
  'Paper & Transfer Film',
  'Tea & Refreshments',
  'Carriage & Freight',
  'Salary / Daily Wages',
  'Electricity & Utility',
  'Stationery & Office',
  'Other Expense'
];

const DEFAULT_PAYMENT_MODES = ['Cash', 'UPI / GPay / PhonePe', 'Bank Transfer (NEFT/RTGS)', 'Cheque', 'Credit / Debit Card', 'Other'];

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
    default: {
      start = null;
      end = null;
      labelText = 'All Time Ledger';
      break;
    }
  }

  return { start, end, labelText };
}

function formatDateISO(d) {
  if (!d) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function DigitalPrintExpenseModule({ autoOpenCreate = false, onModalOpened = null, companyEntity = 'Elite Digital Print' }) {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({ totalIn: 0, totalOut: 0, netBalance: 0, totalVouchers: 0 });
  const [loading, setLoading] = useState(false);

  // ── Chartered Ledger Balances State (Cash/Bank Opening, Movements & Closing) ──
  const [ledgerBalances, setLedgerBalances] = useState({
    cashOpening: 0,
    bankOpening: 0,
    cashIn: 0,
    cashExpense: 0,
    cashClosing: 0,
    bankIn: 0,
    bankExpense: 0,
    bankClosing: 0,
    totalTransactions: 0,
    bankAccountName: 'KOTAK EDP',
    effectiveDate: ''
  });

  // Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    businessUnit: 'EDP',
    companyEntity: companyEntity || 'Elite Digital Print',
    initialCashOpening: 0,
    initialBankOpening: 0,
    effectiveDate: '2024-04-01',
    bankAccountName: 'KOTAK EDP',
    notes: ''
  });

  // Dynamic Categories from PrintConfig
  const [inCategories, setInCategories] = useState(DEFAULT_IN_CATEGORIES);
  const [outCategories, setOutCategories] = useState(DEFAULT_OUT_CATEGORIES);
  const [paymentModes, setPaymentModes] = useState(DEFAULT_PAYMENT_MODES);

  // Load Print Config & Ledger Settings
  useEffect(() => {
    loadLedgerSettings();
    api.getPrintConfig(companyEntity)
      .then(cfg => {
        if (cfg) {
          if (Array.isArray(cfg.expenseInCategories) && cfg.expenseInCategories.length > 0) {
            setInCategories(cfg.expenseInCategories);
          }
          if (Array.isArray(cfg.expenseOutCategories) && cfg.expenseOutCategories.length > 0) {
            setOutCategories(cfg.expenseOutCategories);
          }
          if (Array.isArray(cfg.expensePaymentModes) && cfg.expensePaymentModes.length > 0) {
            setPaymentModes(cfg.expensePaymentModes);
          }
        }
      })
      .catch(err => console.warn('Failed to load print config for expense categories:', err));
  }, [companyEntity]);

  const loadLedgerSettings = async () => {
    try {
      const res = await api.getLedgerSettings({ companyEntity });
      if (res && res.settings) {
        setSettingsForm({
          businessUnit: res.settings.businessUnit || 'EDP',
          companyEntity: res.settings.companyEntity || companyEntity,
          initialCashOpening: res.settings.initialCashOpening || 0,
          initialBankOpening: res.settings.initialBankOpening || 0,
          effectiveDate: res.settings.effectiveDate || '2024-04-01',
          bankAccountName: res.settings.bankAccountName || 'KOTAK EDP',
          notes: res.settings.notes || ''
        });
      }
    } catch (err) {
      console.warn('Failed to load ledger settings:', err);
    }
  };

  const handleSaveLedgerSettings = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSavingSettings(true);
    try {
      await api.saveLedgerSettings({
        ...settingsForm,
        companyEntity,
        initialCashOpening: Number(settingsForm.initialCashOpening) || 0,
        initialBankOpening: Number(settingsForm.initialBankOpening) || 0
      });
      triggerEliteAlert('✅ Initial Opening Balances configured successfully!');
      setShowSettingsModal(false);
      triggerGlobalDataRefresh('expenses');
      fetchExpenses();
    } catch (err) {
      console.error('Failed to save ledger settings:', err);
      triggerEliteAlert(`Failed to save initial balances: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  // Trigger modal auto open if requested
  useEffect(() => {
    if (autoOpenCreate) {
      handleOpenCreate('OUT');
      if (onModalOpened) onModalOpened();
    }
  }, [autoOpenCreate]);

  // Filters
  const [search, setSearch] = useState('');
  const [expenseFilters, setExpenseFilters] = useState({ type: [], category: [], paymentMode: [] });
  const [datePreset, setDatePreset] = useState('this_month');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);

  const activeRange = getDatePresetRange(datePreset, customDateStart, customDateEnd);
  const dateStart = activeRange.start ? formatDateISO(activeRange.start) : '';
  const dateEnd = activeRange.end ? formatDateISO(activeRange.end) : '';

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // null = create
  const [showViewModal, setShowViewModal] = useState(null);
  const [zoomImg, setZoomImg] = useState(null);

  // Form State
  const [transactionMode, setTransactionMode] = useState('OUT'); // 'IN' | 'OUT' | 'PARTY' | 'VENDOR'
  const [partiesList, setPartiesList] = useState([]);
  const [allInvoices, setAllInvoices] = useState([]);
  const [vendorsList, setVendorsList] = useState([]);
  const [selectedParty, setSelectedParty] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedInvoicesMap, setSelectedInvoicesMap] = useState({});
  const [loadingPartiesData, setLoadingPartiesData] = useState(false);
  const [showAllPartyInvoices, setShowAllPartyInvoices] = useState(false);
  const [partySearchTerm, setPartySearchTerm] = useState('');
  const [allPurchases, setAllPurchases] = useState([]);
  const [selectedPurchasesMap, setSelectedPurchasesMap] = useState({});
  const [showAllVendorPurchases, setShowAllVendorPurchases] = useState(false);

  const [formVal, setFormVal] = useState({
    companyEntity,
    voucherNo: '',
    date: formatDateISO(new Date()),
    type: 'OUT',
    category: 'Ink & Consumables',
    title: '',
    amount: '',
    paymentMode: 'Cash',
    bankAccount: 'Cash in Hand',
    paidToOrReceivedFrom: '',
    billNo: '',
    description: '',
    receiptUrls: []
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchExpenses();
    const handleDataRefresh = (e) => {
      if (!e || !e.detail || e.detail === 'expenses') {
        fetchExpenses();
      }
    };
    window.addEventListener('elite-data-refresh', handleDataRefresh);
    return () => window.removeEventListener('elite-data-refresh', handleDataRefresh);
  }, [search, expenseFilters, dateStart, dateEnd, companyEntity]);

  const loadPartiesAndVendors = async () => {
    setLoadingPartiesData(true);
    try {
      const [cRes, iRes, vRes, fvRes] = await Promise.allSettled([
        api.getBillingCustomers(companyEntity),
        api.getBillingInvoices({ companyEntity, limit: 3000 }),
        api.getVendors(),
        api.getFabricVendors()
      ]);

      const customers = cRes.status === 'fulfilled' && cRes.value ? (cRes.value.data || cRes.value || []) : [];
      const invoices = iRes.status === 'fulfilled' && iRes.value ? (iRes.value.data || iRes.value || []) : [];
      const vendors = vRes.status === 'fulfilled' && vRes.value ? (Array.isArray(vRes.value) ? vRes.value : (vRes.value.data || [])) : [];
      const fabricVendors = fvRes.status === 'fulfilled' && fvRes.value ? (Array.isArray(fvRes.value) ? fvRes.value : (fvRes.value.data || [])) : [];

      const invList = Array.isArray(invoices) ? invoices : [];
      setAllInvoices(invList);

      // Build consolidated party list
      const partyMap = new Map();
      (customers || []).forEach(c => {
        const name = (c.name || c.businessName || '').trim();
        if (name && !partyMap.has(name.toLowerCase())) {
          partyMap.set(name.toLowerCase(), {
            name,
            businessName: c.businessName || '',
            phone: c.phone || '',
            pendingCount: 0,
            pendingAmount: 0
          });
        }
      });

      invList.forEach(inv => {
        const cName = (inv.customer?.name || '').trim();
        if (cName) {
          const key = cName.toLowerCase();
          if (!partyMap.has(key)) {
            partyMap.set(key, {
              name: cName,
              businessName: inv.customer?.businessName || '',
              phone: inv.customer?.phone || '',
              pendingCount: 0,
              pendingAmount: 0
            });
          }
          const due = inv.balanceDue != null ? Number(inv.balanceDue) : Math.max(0, Number(inv.grandTotal || 0) - Number(inv.paidAmount || 0));
          if (inv.paymentStatus !== 'PAID' && due > 0) {
            const entry = partyMap.get(key);
            entry.pendingCount = (entry.pendingCount || 0) + 1;
            entry.pendingAmount = (entry.pendingAmount || 0) + due;
          }
        }
      });

      const sortedParties = Array.from(partyMap.values()).sort((a, b) => {
        if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount;
        return a.name.localeCompare(b.name);
      });
      setPartiesList(sortedParties);

      // Load purchases from localStorage
      const loadedPurchases = [];
      const seenPurchaseIds = new Set();
      try {
        const pKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('elite_purchases_')) pKeys.push(k);
        }
        if (pKeys.length === 0) {
          pKeys.push(`elite_purchases_${companyEntity || 'edp'}`);
        }
        pKeys.forEach(k => {
          try {
            const raw = localStorage.getItem(k);
            if (raw) {
              const arr = JSON.parse(raw);
              if (Array.isArray(arr)) {
                arr.forEach(p => {
                  const id = p.id || p.purchaseNo || `${p.vendorName}_${p.date}_${p.totalAmount}`;
                  if (!seenPurchaseIds.has(id)) {
                    seenPurchaseIds.add(id);
                    loadedPurchases.push({ ...p, id, _storageKey: k });
                  }
                });
              }
            }
          } catch (e) {}
        });
      } catch (err) {
        console.warn('Failed reading purchases from storage', err);
      }
      setAllPurchases(loadedPurchases);

      // Build vendor list with purchase aggregates
      const vendorMap = new Map();
      [...vendors, ...fabricVendors].forEach(v => {
        const vName = (v.name || v.vendorName || '').trim();
        if (vName && !vendorMap.has(vName.toLowerCase())) {
          vendorMap.set(vName.toLowerCase(), {
            name: vName,
            category: v.category || v.fabricType || 'Vendor / Supplier',
            pendingCount: 0,
            pendingAmount: 0,
            totalPurchaseCount: 0,
            totalPurchaseAmount: 0
          });
        }
      });

      // Integrate purchases with vendors
      loadedPurchases.forEach(p => {
        const vName = (p.vendorName || '').trim();
        if (vName) {
          const key = vName.toLowerCase();
          if (!vendorMap.has(key)) {
            vendorMap.set(key, {
              name: vName,
              category: 'Material / Fabric Supplier',
              pendingCount: 0,
              pendingAmount: 0,
              totalPurchaseCount: 0,
              totalPurchaseAmount: 0
            });
          }
          const vEntry = vendorMap.get(key);
          const totalAmt = Number(p.totalAmount) || 0;
          const paidAmt = Number(p.paidAmount) || 0;
          const due = p.balanceDue != null ? Number(p.balanceDue) : Math.max(0, totalAmt - paidAmt);
          vEntry.totalPurchaseCount = (vEntry.totalPurchaseCount || 0) + 1;
          vEntry.totalPurchaseAmount = (vEntry.totalPurchaseAmount || 0) + totalAmt;

          if (p.paymentStatus !== 'PAID' && due > 0) {
            vEntry.pendingCount = (vEntry.pendingCount || 0) + 1;
            vEntry.pendingAmount = (vEntry.pendingAmount || 0) + due;
          }
        }
      });

      const sortedVendors = Array.from(vendorMap.values()).sort((a, b) => {
        if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount;
        return a.name.localeCompare(b.name);
      });
      setVendorsList(sortedVendors);
    } catch (err) {
      console.warn('Error loading parties and vendors:', err);
    } finally {
      setLoadingPartiesData(false);
    }
  };

  const currentPartyInvoices = React.useMemo(() => {
    if (!selectedParty) return [];
    const partyNameLower = selectedParty.trim().toLowerCase();
    const invs = (allInvoices || []).filter(inv => {
      const cName = (inv.customer?.name || '').trim().toLowerCase();
      return cName === partyNameLower;
    });

    const filtered = showAllPartyInvoices 
      ? invs 
      : invs.filter(inv => {
          const isSelected = !!selectedInvoicesMap[inv._id]?.selected;
          const due = inv.balanceDue != null ? Number(inv.balanceDue) : Math.max(0, Number(inv.grandTotal || 0) - Number(inv.paidAmount || 0));
          return isSelected || (inv.paymentStatus !== 'PAID' && due > 0);
        });

    // Show oldest invoices first (ascending by invoiceDate / createdAt / invoiceNo)
    return [...filtered].sort((a, b) => {
      const timeA = a.invoiceDate ? new Date(a.invoiceDate).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.invoiceDate ? new Date(b.invoiceDate).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      if (timeA !== timeB) return timeA - timeB;
      return String(a.invoiceNo || '').localeCompare(String(b.invoiceNo || ''), undefined, { numeric: true });
    });
  }, [allInvoices, selectedParty, showAllPartyInvoices, selectedInvoicesMap]);

  const syncFormWithSelectedInvoices = (map, partyName, explicitAmount = null) => {
    const selectedEntries = Object.values(map).filter(e => e && e.selected && Number(e.payingAmount) > 0);
    const totalAmount = selectedEntries.reduce((sum, e) => sum + (Number(e.payingAmount) || 0), 0);
    const invoiceNos = selectedEntries.map(e => e.invoice?.invoiceNo).filter(Boolean);

    const billNoStr = invoiceNos.join(', ');
    const titleStr = partyName 
      ? `Bill Payment - ${partyName}${invoiceNos.length ? ` (${billNoStr})` : ''}`
      : `Bill Payment${invoiceNos.length ? ` (${billNoStr})` : ''}`;

    setFormVal(prev => {
      const finalAmount = explicitAmount != null 
        ? (Number(explicitAmount) > 0 ? Number(explicitAmount).toFixed(2) : '')
        : (totalAmount > 0 ? totalAmount.toFixed(2) : prev.amount);

      return {
        ...prev,
        type: 'IN', // Strictly Cash IN for Party Bill Payment
        category: inCategories.find(c => c.toLowerCase().includes('client') || c.toLowerCase().includes('payment')) || inCategories[0] || 'Client Payment / Advance',
        paidToOrReceivedFrom: partyName || prev.paidToOrReceivedFrom,
        amount: finalAmount,
        billNo: billNoStr,
        title: titleStr
      };
    });
  };

  const autoMatchInvoicesToAmount = (targetAmt, partyName) => {
    const pName = partyName || selectedParty;
    if (!pName) return;
    const numAmt = parseFloat(targetAmt);
    if (!numAmt || numAmt <= 0) return;

    const partyNameLower = pName.trim().toLowerCase();
    // Get all unpaid invoices for this party sorted oldest first
    const pendingInvs = (allInvoices || [])
      .filter(inv => {
        const cName = (inv.customer?.name || '').trim().toLowerCase();
        const due = inv.balanceDue != null ? Number(inv.balanceDue) : Math.max(0, Number(inv.grandTotal || 0) - Number(inv.paidAmount || 0));
        return cName === partyNameLower && inv.paymentStatus !== 'PAID' && due > 0;
      })
      .sort((a, b) => {
        const timeA = a.invoiceDate ? new Date(a.invoiceDate).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.invoiceDate ? new Date(b.invoiceDate).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        if (timeA !== timeB) return timeA - timeB; // Oldest first
        return String(a.invoiceNo || '').localeCompare(String(b.invoiceNo || ''), undefined, { numeric: true });
      });

    if (pendingInvs.length === 0) return;

    let remaining = Math.round(numAmt * 100) / 100;
    const newMap = {};
    const unallocatedInvs = [...pendingInvs];

    while (remaining > 0.001 && unallocatedInvs.length > 0) {
      // 1. Check if any single remaining invoice has due exactly equal to remaining
      const exactMatchIdx = unallocatedInvs.findIndex(inv => {
        const due = Math.round((inv.balanceDue != null ? Number(inv.balanceDue) : Math.max(0, Number(inv.grandTotal || 0) - Number(inv.paidAmount || 0))) * 100) / 100;
        return Math.abs(due - remaining) < 0.01;
      });

      if (exactMatchIdx !== -1) {
        const matchedInv = unallocatedInvs.splice(exactMatchIdx, 1)[0];
        const due = Math.round((matchedInv.balanceDue != null ? Number(matchedInv.balanceDue) : Math.max(0, Number(matchedInv.grandTotal || 0) - Number(matchedInv.paidAmount || 0))) * 100) / 100;
        newMap[matchedInv._id] = {
          selected: true,
          payingAmount: due,
          invoice: matchedInv
        };
        remaining = 0;
        break;
      }

      // 2. Otherwise take the oldest unallocated invoice
      const oldestInv = unallocatedInvs.shift();
      const due = Math.round((oldestInv.balanceDue != null ? Number(oldestInv.balanceDue) : Math.max(0, Number(oldestInv.grandTotal || 0) - Number(oldestInv.paidAmount || 0))) * 100) / 100;
      if (due <= 0) continue;

      if (remaining >= due) {
        newMap[oldestInv._id] = {
          selected: true,
          payingAmount: due,
          invoice: oldestInv
        };
        remaining = Math.round((remaining - due) * 100) / 100;
      } else {
        // Partial allocation for the remaining amount
        newMap[oldestInv._id] = {
          selected: true,
          payingAmount: remaining,
          invoice: oldestInv
        };
        remaining = 0;
        break;
      }
    }

    setSelectedInvoicesMap(newMap);
    syncFormWithSelectedInvoices(newMap, pName, numAmt);
  };

  const handlePartyChange = (partyName) => {
    setSelectedParty(partyName);
    if (!partyName) {
      setSelectedInvoicesMap({});
      setFormVal(prev => ({
        ...prev,
        paidToOrReceivedFrom: '',
        title: 'Bill Payment',
        billNo: ''
      }));
      return;
    }

    const currentAmount = parseFloat(formVal.amount);
    if (currentAmount > 0) {
      // Auto-match oldest invoices to entered amount immediately
      autoMatchInvoicesToAmount(currentAmount, partyName);
    } else {
      setSelectedInvoicesMap({});
      setFormVal(prev => ({
        ...prev,
        type: 'IN', // Always stored as Cash IN
        category: inCategories.find(c => c.toLowerCase().includes('client') || c.toLowerCase().includes('payment')) || inCategories[0] || 'Client Payment / Advance',
        paidToOrReceivedFrom: partyName,
        title: `Bill Payment - ${partyName}`,
        billNo: ''
      }));
    }
  };

  const handleToggleInvoice = (inv) => {
    const invId = inv._id;
    const isCurrentlySelected = !!selectedInvoicesMap[invId]?.selected;
    const newSelected = !isCurrentlySelected;
    const due = inv.balanceDue != null ? Number(inv.balanceDue) : Math.max(0, Number(inv.grandTotal || 0) - Number(inv.paidAmount || 0));

    const updatedMap = {
      ...selectedInvoicesMap,
      [invId]: {
        selected: newSelected,
        payingAmount: newSelected ? due : 0,
        invoice: inv
      }
    };
    if (!newSelected) {
      delete updatedMap[invId];
    }
    setSelectedInvoicesMap(updatedMap);
    syncFormWithSelectedInvoices(updatedMap, selectedParty);
  };

  const handleInvoicePayingAmountChange = (inv, val) => {
    const invId = inv._id;
    const numVal = Math.max(0, parseFloat(val) || 0);
    const updatedMap = {
      ...selectedInvoicesMap,
      [invId]: {
        selected: true,
        payingAmount: numVal,
        invoice: inv
      }
    };
    setSelectedInvoicesMap(updatedMap);
    syncFormWithSelectedInvoices(updatedMap, selectedParty);
  };

  const handleSelectAllPending = () => {
    if (!selectedParty) return;
    const partyNameLower = selectedParty.trim().toLowerCase();
    const pendingInvs = (allInvoices || [])
      .filter(inv => {
        const cName = (inv.customer?.name || '').trim().toLowerCase();
        const due = inv.balanceDue != null ? Number(inv.balanceDue) : Math.max(0, Number(inv.grandTotal || 0) - Number(inv.paidAmount || 0));
        return cName === partyNameLower && inv.paymentStatus !== 'PAID' && due > 0;
      })
      .sort((a, b) => {
        const timeA = a.invoiceDate ? new Date(a.invoiceDate).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.invoiceDate ? new Date(b.invoiceDate).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        if (timeA !== timeB) return timeA - timeB; // Oldest first
        return String(a.invoiceNo || '').localeCompare(String(b.invoiceNo || ''), undefined, { numeric: true });
      });

    const newMap = {};
    pendingInvs.forEach(inv => {
      const due = inv.balanceDue != null ? Number(inv.balanceDue) : Math.max(0, Number(inv.grandTotal || 0) - Number(inv.paidAmount || 0));
      newMap[inv._id] = {
        selected: true,
        payingAmount: due,
        invoice: inv
      };
    });
    setSelectedInvoicesMap(newMap);
    syncFormWithSelectedInvoices(newMap, selectedParty);
  };

  const handleDeselectAllInvoices = () => {
    setSelectedInvoicesMap({});
    syncFormWithSelectedInvoices({}, selectedParty);
  };

  const currentVendorPurchases = React.useMemo(() => {
    if (!selectedVendor) return [];
    const vendorNameLower = selectedVendor.trim().toLowerCase();
    const purs = (allPurchases || []).filter(p => {
      const vName = (p.vendorName || '').trim().toLowerCase();
      return vName === vendorNameLower;
    });

    const filtered = showAllVendorPurchases
      ? purs
      : purs.filter(p => {
          const purKey = p.id || p.purchaseNo;
          const isSelected = !!selectedPurchasesMap[purKey]?.selected;
          const totalAmt = Number(p.totalAmount) || 0;
          const paidAmt = Number(p.paidAmount) || 0;
          const due = p.balanceDue != null ? Number(p.balanceDue) : Math.max(0, totalAmt - paidAmt);
          return isSelected || (p.paymentStatus !== 'PAID' && (due > 0 || totalAmt > 0));
        });

    // Show oldest purchases first
    return [...filtered].sort((a, b) => {
      const dateA = a.billDate || a.purchaseDate || a.date || a.createdAt;
      const dateB = b.billDate || b.purchaseDate || b.date || b.createdAt;
      const timeA = dateA ? new Date(dateA).getTime() : 0;
      const timeB = dateB ? new Date(dateB).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;
      return String(a.purchaseNo || a.billNo || '').localeCompare(String(b.purchaseNo || b.billNo || ''), undefined, { numeric: true });
    });
  }, [allPurchases, selectedVendor, showAllVendorPurchases, selectedPurchasesMap]);

  const syncFormWithSelectedPurchases = (map, vendorName, explicitAmount = null) => {
    const selectedEntries = Object.values(map).filter(e => e && e.selected && Number(e.payingAmount) > 0);
    const totalAmount = selectedEntries.reduce((sum, e) => sum + (Number(e.payingAmount) || 0), 0);
    const billNos = selectedEntries.map(e => e.purchase?.purchaseNo).filter(Boolean);

    const billNoStr = billNos.join(', ');
    const titleStr = vendorName 
      ? `Vendor Payment - ${vendorName}${billNos.length ? ` (${billNoStr})` : ''}`
      : `Vendor Payment${billNos.length ? ` (${billNoStr})` : ''}`;

    setFormVal(prev => {
      const finalAmount = explicitAmount != null 
        ? (Number(explicitAmount) > 0 ? Number(explicitAmount).toFixed(2) : '')
        : (totalAmount > 0 ? totalAmount.toFixed(2) : prev.amount);

      return {
        ...prev,
        type: 'OUT', // Strictly Cash OUT for Vendor Purchase Payment
        category: outCategories.find(c => c.toLowerCase().includes('ink') || c.toLowerCase().includes('maintenance') || c.toLowerCase().includes('paper') || c.toLowerCase().includes('expense')) || outCategories[0] || 'Ink & Consumables',
        paidToOrReceivedFrom: vendorName || prev.paidToOrReceivedFrom,
        amount: finalAmount,
        billNo: billNoStr,
        title: titleStr
      };
    });
  };

  const autoMatchPurchasesToAmount = (targetAmt, vendorName) => {
    const vName = vendorName || selectedVendor;
    if (!vName) return;
    const numAmt = parseFloat(targetAmt);
    if (!numAmt || numAmt <= 0) return;

    const vendorNameLower = vName.trim().toLowerCase();
    const pendingPurs = (allPurchases || [])
      .filter(p => {
        const name = (p.vendorName || '').trim().toLowerCase();
        const totalAmt = Number(p.totalAmount) || 0;
        const paidAmt = Number(p.paidAmount) || 0;
        const due = p.balanceDue != null ? Number(p.balanceDue) : Math.max(0, totalAmt - paidAmt);
        return name === vendorNameLower && p.paymentStatus !== 'PAID' && due > 0;
      })
      .sort((a, b) => {
        const dateA = a.billDate || a.purchaseDate || a.date || a.createdAt;
        const dateB = b.billDate || b.purchaseDate || b.date || b.createdAt;
        const timeA = dateA ? new Date(dateA).getTime() : 0;
        const timeB = dateB ? new Date(dateB).getTime() : 0;
        if (timeA !== timeB) return timeA - timeB; // Oldest first
        return String(a.purchaseNo || a.billNo || '').localeCompare(String(b.purchaseNo || b.billNo || ''), undefined, { numeric: true });
      });

    if (pendingPurs.length === 0) return;

    let remaining = Math.round(numAmt * 100) / 100;
    const newMap = {};
    const unallocatedPurs = [...pendingPurs];

    while (remaining > 0.001 && unallocatedPurs.length > 0) {
      // 1. Check if any single remaining purchase bill has due exactly equal to remaining
      const exactMatchIdx = unallocatedPurs.findIndex(p => {
        const totalAmt = Number(p.totalAmount) || 0;
        const paidAmt = Number(p.paidAmount) || 0;
        const due = Math.round((p.balanceDue != null ? Number(p.balanceDue) : Math.max(0, totalAmt - paidAmt)) * 100) / 100;
        return Math.abs(due - remaining) < 0.01;
      });

      if (exactMatchIdx !== -1) {
        const matchedPur = unallocatedPurs.splice(exactMatchIdx, 1)[0];
        const purKey = matchedPur.id || matchedPur.purchaseNo;
        const totalAmt = Number(matchedPur.totalAmount) || 0;
        const paidAmt = Number(matchedPur.paidAmount) || 0;
        const due = Math.round((matchedPur.balanceDue != null ? Number(matchedPur.balanceDue) : Math.max(0, totalAmt - paidAmt)) * 100) / 100;
        newMap[purKey] = {
          selected: true,
          payingAmount: due > 0 ? due : totalAmt,
          purchase: matchedPur
        };
        remaining = 0;
        break;
      }

      // 2. Otherwise take the oldest unallocated purchase bill
      const oldestPur = unallocatedPurs.shift();
      const purKey = oldestPur.id || oldestPur.purchaseNo;
      const totalAmt = Number(oldestPur.totalAmount) || 0;
      const paidAmt = Number(oldestPur.paidAmount) || 0;
      const due = Math.round((oldestPur.balanceDue != null ? Number(oldestPur.balanceDue) : Math.max(0, totalAmt - paidAmt)) * 100) / 100;
      if (due <= 0 && totalAmt <= 0) continue;
      const effectiveDue = due > 0 ? due : totalAmt;

      if (remaining >= effectiveDue) {
        newMap[purKey] = {
          selected: true,
          payingAmount: effectiveDue,
          purchase: oldestPur
        };
        remaining = Math.round((remaining - effectiveDue) * 100) / 100;
      } else {
        // Partial allocation for the remaining amount
        newMap[purKey] = {
          selected: true,
          payingAmount: remaining,
          purchase: oldestPur
        };
        remaining = 0;
        break;
      }
    }

    setSelectedPurchasesMap(newMap);
    syncFormWithSelectedPurchases(newMap, vName, numAmt);
  };

  const handleVendorChange = (vendorName) => {
    setSelectedVendor(vendorName);
    if (!vendorName) {
      setSelectedPurchasesMap({});
      setFormVal(prev => ({
        ...prev,
        paidToOrReceivedFrom: '',
        title: 'Vendor Payment',
        billNo: ''
      }));
      return;
    }

    const currentAmount = parseFloat(formVal.amount);
    if (currentAmount > 0) {
      // Auto-match oldest purchases to entered amount immediately
      autoMatchPurchasesToAmount(currentAmount, vendorName);
    } else {
      setSelectedPurchasesMap({});
      setFormVal(prev => ({
        ...prev,
        type: 'OUT', // Stored as Cash OUT
        category: outCategories.find(c => c.toLowerCase().includes('ink') || c.toLowerCase().includes('maintenance') || c.toLowerCase().includes('paper') || c.toLowerCase().includes('expense')) || outCategories[0] || 'Ink & Consumables',
        paidToOrReceivedFrom: vendorName,
        title: `Vendor Payment - ${vendorName}`,
        billNo: ''
      }));
    }
  };

  const handleTogglePurchase = (pur) => {
    const purKey = pur.id || pur.purchaseNo;
    const isCurrentlySelected = !!selectedPurchasesMap[purKey]?.selected;
    const newSelected = !isCurrentlySelected;
    const totalAmt = Number(pur.totalAmount) || 0;
    const paidAmt = Number(pur.paidAmount) || 0;
    const due = pur.balanceDue != null ? Number(pur.balanceDue) : Math.max(0, totalAmt - paidAmt);

    const updatedMap = {
      ...selectedPurchasesMap,
      [purKey]: {
        selected: newSelected,
        payingAmount: newSelected ? (due > 0 ? due : totalAmt) : 0,
        purchase: pur
      }
    };
    if (!newSelected) {
      delete updatedMap[purKey];
    }
    setSelectedPurchasesMap(updatedMap);
    syncFormWithSelectedPurchases(updatedMap, selectedVendor);
  };

  const handlePurchasePayingAmountChange = (pur, val) => {
    const purKey = pur.id || pur.purchaseNo;
    const numVal = Math.max(0, parseFloat(val) || 0);
    const updatedMap = {
      ...selectedPurchasesMap,
      [purKey]: {
        selected: true,
        payingAmount: numVal,
        purchase: pur
      }
    };
    setSelectedPurchasesMap(updatedMap);
    syncFormWithSelectedPurchases(updatedMap, selectedVendor);
  };

  const handleSelectAllPendingPurchases = () => {
    if (!selectedVendor) return;
    const vendorNameLower = selectedVendor.trim().toLowerCase();
    const pendingPurs = (allPurchases || []).filter(p => {
      const vName = (p.vendorName || '').trim().toLowerCase();
      const totalAmt = Number(p.totalAmount) || 0;
      const paidAmt = Number(p.paidAmount) || 0;
      const due = p.balanceDue != null ? Number(p.balanceDue) : Math.max(0, totalAmt - paidAmt);
      return vName === vendorNameLower && p.paymentStatus !== 'PAID' && (due > 0 || totalAmt > 0);
    }).sort((a, b) => {
      const dateA = a.billDate || a.purchaseDate || a.date || a.createdAt;
      const dateB = b.billDate || b.purchaseDate || b.date || b.createdAt;
      const timeA = dateA ? new Date(dateA).getTime() : 0;
      const timeB = dateB ? new Date(dateB).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB; // Oldest first
      return String(a.purchaseNo || a.billNo || '').localeCompare(String(b.purchaseNo || b.billNo || ''), undefined, { numeric: true });
    });

    const newMap = {};
    pendingPurs.forEach(p => {
      const totalAmt = Number(p.totalAmount) || 0;
      const paidAmt = Number(p.paidAmount) || 0;
      const due = p.balanceDue != null ? Number(p.balanceDue) : Math.max(0, totalAmt - paidAmt);
      const purKey = p.id || p.purchaseNo;
      newMap[purKey] = {
        selected: true,
        payingAmount: due > 0 ? due : totalAmt,
        purchase: p
      };
    });
    setSelectedPurchasesMap(newMap);
    syncFormWithSelectedPurchases(newMap, selectedVendor);
  };

  const handleDeselectAllPurchases = () => {
    setSelectedPurchasesMap({});
    syncFormWithSelectedPurchases({}, selectedVendor);
  };

  const handleModeSelect = (mode) => {
    setTransactionMode(mode);
    if (mode === 'PARTY') {
      setFormVal(prev => ({
        ...prev,
        type: 'IN', // STORED AS CASH IN
        category: inCategories.find(c => c.toLowerCase().includes('client') || c.toLowerCase().includes('payment')) || inCategories[0] || 'Client Payment / Advance',
        title: selectedParty ? `Bill Payment - ${selectedParty}` : 'Bill Payment'
      }));
      loadPartiesAndVendors();
    } else if (mode === 'VENDOR') {
      setFormVal(prev => ({
        ...prev,
        type: 'OUT', // STORED AS CASH OUT
        category: outCategories.find(c => c.toLowerCase().includes('ink') || c.toLowerCase().includes('maintenance') || c.toLowerCase().includes('expense')) || outCategories[0] || 'Ink & Consumables',
        title: selectedVendor ? `Vendor Payment - ${selectedVendor}` : 'Vendor Payment'
      }));
      loadPartiesAndVendors();
    } else if (mode === 'IN') {
      setFormVal(prev => ({
        ...prev,
        type: 'IN',
        category: inCategories?.[0] || DEFAULT_IN_CATEGORIES[0]
      }));
    } else if (mode === 'OUT') {
      setFormVal(prev => ({
        ...prev,
        type: 'OUT',
        category: outCategories?.[0] || DEFAULT_OUT_CATEGORIES[0]
      }));
    }
  };

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const effectiveType = expenseFilters.type && expenseFilters.type.length > 0 ? expenseFilters.type.join(',') : 'All';
      const effectiveCategory = expenseFilters.category && expenseFilters.category.length > 0 ? expenseFilters.category.join(',') : 'All';
      const effectivePaymentMode = expenseFilters.paymentMode && expenseFilters.paymentMode.length > 0 ? expenseFilters.paymentMode.join(',') : undefined;

      const params = {
        companyEntity,
        search,
        type: effectiveType,
        category: effectiveCategory,
        paymentMode: effectivePaymentMode,
        dateStart,
        dateEnd,
        limit: 500
      };
      const res = await api.getExpenses(params);
      if (res && res.data) {
        setExpenses(Array.isArray(res.data) ? res.data : []);
        setSummary({
          totalIn: res.totalIn || 0,
          totalOut: res.totalOut || 0,
          netBalance: res.netBalance || 0,
          totalVouchers: res.total || (Array.isArray(res.data) ? res.data.length : 0)
        });
        if (res.ledgerSummary) {
          setLedgerBalances(res.ledgerSummary);
        }
      }

      // If ledgerSummary wasn't returned in getExpenses, fetch directly via dedicated endpoint
      if (!res?.ledgerSummary) {
        try {
          const lRes = await api.getLedgerSummary({
            companyEntity,
            dateStart,
            dateEnd
          });
          if (lRes && lRes.cashClosing !== undefined) {
            setLedgerBalances(lRes);
          }
        } catch (e) {
          console.warn('Failed to load standalone ledger summary:', e);
        }
      }
    } catch (err) {
      console.error('Failed to fetch expense records:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = async (defaultType = 'OUT', defaultMode = null) => {
    setEditingItem(null);
    setSelectedParty('');
    setSelectedVendor('');
    setSelectedInvoicesMap({});
    setShowAllPartyInvoices(false);
    setPartySearchTerm('');
    setSelectedPurchasesMap({});
    setShowAllVendorPurchases(false);

    const initialMode = defaultMode || (defaultType === 'IN' ? 'IN' : 'OUT');
    setTransactionMode(initialMode);

    const defaultCat = (defaultType === 'IN' || initialMode === 'PARTY') 
      ? (inCategories && inCategories[0] ? inCategories[0] : DEFAULT_IN_CATEGORIES[0]) 
      : (outCategories && outCategories[0] ? outCategories[0] : DEFAULT_OUT_CATEGORIES[0]);

    setFormVal({
      companyEntity,
      voucherNo: 'EXP-...',
      date: formatDateISO(new Date()),
      type: (defaultType === 'IN' || initialMode === 'PARTY') ? 'IN' : 'OUT',
      category: defaultCat,
      title: '',
      amount: '',
      paymentMode: 'Cash',
      bankAccount: 'Cash in Hand',
      paidToOrReceivedFrom: '',
      billNo: '',
      description: '',
      receiptUrls: []
    });
    setShowModal(true);
    loadPartiesAndVendors();

    try {
      const numRes = await api.getNextExpenseVoucherNo(companyEntity);
      if (numRes && numRes.nextVoucherNo) {
        setFormVal(prev => ({ ...prev, voucherNo: numRes.nextVoucherNo }));
      } else {
        setFormVal(prev => ({ ...prev, voucherNo: `EXP-${Date.now().toString().slice(-4)}` }));
      }
    } catch (e) {
      console.error('Failed to fetch next voucher number:', e);
      setFormVal(prev => ({ ...prev, voucherNo: `EXP-${Date.now().toString().slice(-4)}` }));
    }
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    let detectedMode = item.type === 'IN' ? 'IN' : 'OUT';
    if (item.type === 'IN' && (item.category === 'Client Payment / Advance' || item.title?.toLowerCase().includes('bill payment') || item.title?.toLowerCase().includes('party'))) {
      detectedMode = 'PARTY';
    } else if (item.type === 'OUT' && (item.title?.toLowerCase().includes('vendor payment') || item.category?.toLowerCase().includes('vendor'))) {
      detectedMode = 'VENDOR';
    }
    setTransactionMode(detectedMode);
    setSelectedParty(item.paidToOrReceivedFrom || '');
    setSelectedVendor(item.paidToOrReceivedFrom || '');
    setSelectedInvoicesMap({});
    setSelectedPurchasesMap({});
    setShowAllVendorPurchases(false);
    loadPartiesAndVendors();

    const defaultCat = item.type === 'IN' 
      ? (inCategories && inCategories[0] ? inCategories[0] : DEFAULT_IN_CATEGORIES[0]) 
      : (outCategories && outCategories[0] ? outCategories[0] : DEFAULT_OUT_CATEGORIES[0]);

    setFormVal({
      companyEntity: item.companyEntity || companyEntity,
      voucherNo: item.voucherNo || '',
      date: item.date || formatDateISO(new Date()),
      type: item.type || 'OUT',
      category: item.category || defaultCat,
      title: item.title || '',
      amount: item.amount || '',
      paymentMode: item.paymentMode || 'Cash',
      bankAccount: item.bankAccount || (item.paymentMode === 'Cash' ? 'Cash in Hand' : (ledgerBalances.settings?.bankAccountName || 'KOTAK EDP')),
      paidToOrReceivedFrom: item.paidToOrReceivedFrom || '',
      billNo: item.billNo || '',
      description: item.description || '',
      receiptUrls: item.receiptUrls || []
    });
    setShowModal(true);
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    for (let file of files) {
      if (file.name && (file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff'))) {
        triggerEliteAlert('TIFF images are not supported. Please upload JPG, PNG, or WEBP.');
        return;
      }
    }

    setUploading(true);
    const uploadedUrls = [...(formVal.receiptUrls || [])];

    for (let file of files) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const options = { maxSizeMB: 1.5, maxWidthOrHeight: 2048, useWebWorker: true };
        const compressedFile = await imageCompression(file, options);
        const formData = new FormData();
        formData.append('image', compressedFile, file.name);

        const uploadRes = await api.uploadImage(formData);
        if (uploadRes && (uploadRes.url || uploadRes.imageUrl)) {
          uploadedUrls.push(uploadRes.url || uploadRes.imageUrl);
        }
      } catch (err) {
        console.error('Image compression/upload failed:', err);
      }
    }

    setFormVal(prev => ({ ...prev, receiptUrls: uploadedUrls }));
    setUploading(false);
  };

  const handleRemovePhoto = (idx) => {
    setFormVal(prev => ({
      ...prev,
      receiptUrls: (prev.receiptUrls || []).filter((_, i) => i !== idx)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formVal.title.trim()) {
      triggerEliteAlert('Please enter Title / Purpose of this transaction.');
      return;
    }
    if (!formVal.amount || isNaN(formVal.amount) || Number(formVal.amount) <= 0) {
      triggerEliteAlert('Please enter a valid positive Amount (₹).');
      return;
    }

    setSaving(true);
    try {
      const effectiveType = (transactionMode === 'PARTY' || formVal.type === 'IN') ? 'IN' : 'OUT';
      const payload = {
        ...formVal,
        type: effectiveType,
        amount: Number(formVal.amount)
      };

      if (editingItem) {
        await api.updateExpense(editingItem._id, payload);
        triggerEliteAlert('✨ Expense entry updated successfully!');
      } else {
        await api.createExpense(payload);
      }

      // If Party mode with selected invoices, apply payments to each selected invoice in Billing system
      if (transactionMode === 'PARTY') {
        const selectedEntries = Object.values(selectedInvoicesMap).filter(
          e => e && e.selected && Number(e.payingAmount) > 0
        );
        if (selectedEntries.length > 0) {
          let updatedCount = 0;
          for (const entry of selectedEntries) {
            try {
              await api.recordInvoicePayment(entry.invoice._id, {
                amount: Number(entry.payingAmount),
                method: formVal.paymentMode || 'Cash',
                referenceNo: formVal.voucherNo,
                notes: `Payment received via Cash IN Voucher #${formVal.voucherNo}`
              });
              updatedCount++;
            } catch (payErr) {
              console.error(`Failed to record payment for invoice ${entry.invoice?.invoiceNo}:`, payErr);
            }
          }
          triggerGlobalDataRefresh('billing');
          triggerEliteAlert(`✨ Transaction saved as Cash IN and payment applied to ${updatedCount} invoice(s)!`);
        } else if (!editingItem) {
          triggerEliteAlert('✨ Transaction logged as Cash IN successfully!');
        }
      } else if (transactionMode === 'VENDOR') {
        const selectedEntries = Object.values(selectedPurchasesMap).filter(
          e => e && e.selected && Number(e.payingAmount) > 0
        );
        if (selectedEntries.length > 0) {
          try {
            const pKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && k.startsWith('elite_purchases_')) pKeys.push(k);
            }
            if (pKeys.length === 0) {
              pKeys.push(`elite_purchases_${companyEntity || 'edp'}`);
            }

            let updatedCount = 0;
            pKeys.forEach(k => {
              try {
                const raw = localStorage.getItem(k);
                if (raw) {
                  let arr = JSON.parse(raw);
                  if (Array.isArray(arr)) {
                    let changed = false;
                    arr = arr.map(p => {
                      const purKey = p.id || p.purchaseNo;
                      const entry = selectedPurchasesMap[purKey];
                      if (entry && entry.selected && Number(entry.payingAmount) > 0) {
                        const paying = Number(entry.payingAmount);
                        const prevPaid = Number(p.paidAmount) || 0;
                        const total = Number(p.totalAmount) || 0;
                        const newPaid = prevPaid + paying;
                        const newDue = Math.max(0, total - newPaid);
                        changed = true;
                        updatedCount++;
                        return {
                          ...p,
                          paidAmount: Number(newPaid.toFixed(2)),
                          balanceDue: Number(newDue.toFixed(2)),
                          paymentStatus: newDue <= 0 ? 'PAID' : (newPaid > 0 ? 'PARTIAL' : 'UNPAID'),
                          lastPaymentDate: formVal.date,
                          lastPaymentVoucher: formVal.voucherNo
                        };
                      }
                      return p;
                    });
                    if (changed) {
                      localStorage.setItem(k, JSON.stringify(arr));
                    }
                  }
                }
              } catch (e) {}
            });

            window.dispatchEvent(new CustomEvent('elite-data-refresh', { detail: 'billing' }));
            triggerGlobalDataRefresh('billing');
            triggerEliteAlert(`✨ Transaction saved as Cash OUT and payment applied to ${selectedEntries.length} purchase bill(s)!`);
          } catch (pErr) {
            console.error('Failed to update purchase records:', pErr);
          }
        } else if (!editingItem) {
          triggerEliteAlert('✨ Transaction logged as Cash OUT successfully!');
        }
      } else if (!editingItem) {
        triggerEliteAlert('✨ Transaction logged successfully!');
      }

      setShowModal(false);
      triggerGlobalDataRefresh('expenses');
      fetchExpenses();
    } catch (err) {
      console.error('Failed to save expense entry:', err);
      triggerEliteAlert(`Failed to save expense record: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, voucherNo) => {
    const confirmDelete = await triggerEliteConfirm(
      `Are you sure you want to delete expense record ${voucherNo}? This action cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      await api.deleteExpense(id);
      triggerEliteAlert('Expense record deleted successfully.');
      triggerGlobalDataRefresh('expenses');
      fetchExpenses();
    } catch (err) {
      console.error('Failed to delete expense record:', err);
      triggerEliteAlert('Failed to delete expense entry.');
    }
  };

  const exportToPDF = () => {
    if (!expenses.length) {
      triggerEliteAlert('No expense records available for the selected filters to export.');
      return;
    }

    const printWin = window.open('', '_blank');
    if (!printWin) {
      triggerEliteAlert('Please allow popups in your browser to view and download the PDF report.');
      return;
    }

    // Compute PDF summary strictly from current filtered expenses
    const pdfTotalIn = expenses.filter(e => e.type === 'IN').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const pdfTotalOut = expenses.filter(e => e.type === 'OUT').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const pdfNetBalance = pdfTotalIn - pdfTotalOut;

    const typeLabel = (expenseFilters.type && expenseFilters.type.length > 0)
      ? expenseFilters.type.join(', ')
      : 'All Ledger (IN & OUT)';

    const categoryLabel = (expenseFilters.category && expenseFilters.category.length > 0)
      ? expenseFilters.category.join(', ')
      : 'All Categories';

    const paymentModeLabel = (expenseFilters.paymentMode && expenseFilters.paymentMode.length > 0)
      ? expenseFilters.paymentMode.join(', ')
      : 'All Modes';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Department Expense Ledger Report - Elite Digital Prints</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 25px; color: #1e293b; background: #fff; margin: 0; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
          .company-title { font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: 0.5px; }
          .report-title { font-size: 13px; font-weight: 700; color: #0284c7; text-transform: uppercase; margin-top: 4px; }
          .meta-info { font-size: 11px; color: #475569; text-align: right; line-height: 1.5; }
          
          .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 22px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
          .card-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; }
          .card-val { font-size: 16px; font-weight: 900; margin-top: 3px; }
          .in-val { color: #059669; }
          .out-val { color: #dc2626; }
          .bal-val { color: #0284c7; }

          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          th { background: #0f172a; color: #fff; text-transform: uppercase; font-size: 10px; font-weight: 800; padding: 8px 10px; text-align: left; }
          td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; color: #334155; }
          tr:nth-child(even) { background: #f8fafc; }
          .badge-in { background: #d1fae5; color: #065f46; font-weight: 800; padding: 2px 6px; border-radius: 4px; font-size: 9px; }
          .badge-out { background: #fee2e2; color: #991b1b; font-weight: 800; padding: 2px 6px; border-radius: 4px; font-size: 9px; }
          .amt-in { color: #059669; font-weight: 800; text-align: right; }
          .amt-out { color: #dc2626; font-weight: 800; text-align: right; }
          
          .footer { margin-top: 25px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="company-title">ELITE DIGITAL PRINTS</div>
            <div class="report-title">DEPARTMENT EXPENSE & CASH LEDGER REPORT</div>
          </div>
          <div class="meta-info">
            <div><strong>Date Range:</strong> ${activeRange.labelText}</div>
            <div><strong>Ledger Filter:</strong> ${typeLabel}</div>
            <div><strong>Category:</strong> ${categoryLabel}</div>
            <div><strong>Payment Mode:</strong> ${paymentModeLabel}</div>
            ${search ? `<div><strong>Search Filter:</strong> "${search}"</div>` : ''}
            <div><strong>Generated On:</strong> ${new Date().toLocaleString('en-IN')}</div>
          </div>
        </div>

        <div class="summary-cards">
          <div class="card">
            <div class="card-label">Filtered Cash IN</div>
            <div class="card-val in-val">₹${pdfTotalIn.toLocaleString('en-IN')}</div>
          </div>
          <div class="card">
            <div class="card-label">Filtered Cash OUT</div>
            <div class="card-val out-val">₹${pdfTotalOut.toLocaleString('en-IN')}</div>
          </div>
          <div class="card">
            <div class="card-label">Filtered Balance</div>
            <div class="card-val bal-val">₹${pdfNetBalance.toLocaleString('en-IN')}</div>
          </div>
          <div class="card">
            <div class="card-label">Total Records</div>
            <div class="card-val">${expenses.length}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Voucher No</th>
              <th>Date</th>
              <th>Type</th>
              <th>Title / Purpose</th>
              <th>Category</th>
              <th>Payment Mode</th>
              <th>Paid To / Received From</th>
              <th style="text-align: right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${expenses.map(e => {
              const isIN = e.type === 'IN';
              return `
                <tr>
                  <td><strong>${e.voucherNo || ''}</strong></td>
                  <td>${e.date ? new Date(e.date).toLocaleDateString('en-IN') : ''}</td>
                  <td><span class="${isIN ? 'badge-in' : 'badge-out'}">${isIN ? 'IN' : 'OUT'}</span></td>
                  <td>${e.title || ''}${e.billNo ? `<br><small style="color:#64748b">Bill: ${e.billNo}</small>` : ''}</td>
                  <td>${e.category || ''}</td>
                  <td>${e.paymentMode || 'Cash'}</td>
                  <td>${e.paidToOrReceivedFrom || '-'}</td>
                  <td class="${isIN ? 'amt-in' : 'amt-out'}">${isIN ? '+' : '-'} ₹${(e.amount || 0).toLocaleString('en-IN')}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          <div>Elite Edition ERP System &bull; Confidential Department Ledger</div>
          <div>Report Generated (${expenses.length} records)</div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
  };

  const currentUser = api.getCurrentUser();
  const perms = currentUser?.permissions || [];
  const isAdmin = !currentUser || currentUser.role === 'admin';

  const canViewDashboard = isAdmin || perms.includes('expense_dashboard') || perms.includes('jobcards');
  const canCreateExpense = isAdmin || perms.includes('expense_create') || perms.includes('jobcards');

  const categories = formVal.type === 'IN' ? inCategories : outCategories;

  const expenseFilterCategories = React.useMemo(() => [
    {
      id: 'type',
      label: 'Ledger Type',
      name: 'Ledger Type',
      multi: true,
      options: [
        { value: 'IN', label: '🟢 Cash IN (Receipt)' },
        { value: 'OUT', label: '🔴 Cash OUT (Expense)' }
      ]
    },
    {
      id: 'category',
      label: 'Category',
      name: 'Category',
      multi: true,
      options: [
        ...inCategories.map(c => ({ value: c, label: `🟢 ${c}` })),
        ...outCategories.map(c => ({ value: c, label: `🔴 ${c}` }))
      ]
    },
    {
      id: 'paymentMode',
      label: 'Payment Mode',
      name: 'Payment Mode',
      multi: true,
      options: (paymentModes || []).map(m => ({ value: m, label: m }))
    }
  ], [inCategories, outCategories, paymentModes]);

  // Calculate Cash IN vs Bank IN & Cash OUT vs Bank OUT breakdowns
  const cashInAmount = expenses
    .filter(e => e.type === 'IN' && (e.paymentMode || '').toLowerCase() === 'cash')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const bankInAmount = expenses
    .filter(e => e.type === 'IN' && (e.paymentMode || '').toLowerCase() !== 'cash')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const cashOutAmount = expenses
    .filter(e => e.type === 'OUT' && (e.paymentMode || '').toLowerCase() === 'cash')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const bankOutAmount = expenses
    .filter(e => e.type === 'OUT' && (e.paymentMode || '').toLowerCase() !== 'cash')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {canViewDashboard ? (
        <>
          {/* Summary KPI Cards - Standard Enterprise Grid */}
          {/* ── Structured Balance Cards (Cash & Bank Ledger Groups) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '0.85rem', marginBottom: '0.25rem' }}>
            {/* 1. Cash Ledger Group */}
            <div className="glass-panel" style={{ padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid var(--border-light, #e2e8f0)', background: 'var(--bg-card, #ffffff)', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light, #f1f5f9)', paddingBottom: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '10px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', border: '1px solid #a7f3d0' }}>
                    <Wallet size={18} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-primary, #0f172a)' }}>
                        Cash in Hand Ledger
                      </h4>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
                        Opening: ₹{Number(ledgerBalances.cashOpening || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 500 }}>
                      Physical Cash Flow &amp; Petty Cash Movement
                    </span>
                  </div>
                </div>
              </div>

              {/* 4 Cash Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.55rem' }}>
                {/* Cash Opening */}
                <div style={{ padding: '0.6rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Opening</span>
                  <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#1e293b', margin: '4px 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`₹${Number(ledgerBalances.cashOpening || 0).toLocaleString('en-IN')}`}>
                    ₹{Number(ledgerBalances.cashOpening || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <span style={{ fontSize: '0.62rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Pre-Period Bal</span>
                </div>

                {/* Cash In */}
                <div style={{ padding: '0.6rem', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Cash IN</span>
                    <TrendingUp size={13} color="#16a34a" />
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#16a34a', margin: '4px 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    +₹{Number(ledgerBalances.cashIn || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <span style={{ fontSize: '0.62rem', color: '#15803d', fontWeight: 600 }}>Receipts</span>
                </div>

                {/* Cash Out */}
                <div style={{ padding: '0.6rem', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Cash OUT</span>
                    <TrendingDown size={13} color="#dc2626" />
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#dc2626', margin: '4px 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    -₹{Number(ledgerBalances.cashExpense || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <span style={{ fontSize: '0.62rem', color: '#b91c1c', fontWeight: 600 }}>Outflows</span>
                </div>

                {/* Cash Closing */}
                <div style={{
                  padding: '0.6rem',
                  borderRadius: '8px',
                  background: Number(ledgerBalances.cashClosing || 0) >= 0 ? '#ecfdf5' : '#fef2f2',
                  border: Number(ledgerBalances.cashClosing || 0) >= 0 ? '1.5px solid #86efac' : '1.5px solid #fca5a5',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.03em', color: Number(ledgerBalances.cashClosing || 0) >= 0 ? '#15803d' : '#b91c1c' }}>Closing</span>
                    <Wallet size={13} color={Number(ledgerBalances.cashClosing || 0) >= 0 ? '#16a34a' : '#dc2626'} />
                  </div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 900, color: Number(ledgerBalances.cashClosing || 0) >= 0 ? '#15803d' : '#b91c1c', margin: '4px 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    ₹{Number(ledgerBalances.cashClosing || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, color: Number(ledgerBalances.cashClosing || 0) >= 0 ? '#166534' : '#991b1b' }}>Net Cash</span>
                </div>
              </div>
            </div>

            {/* 2. Bank Ledger Group */}
            <div className="glass-panel" style={{ padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid var(--border-light, #e2e8f0)', background: 'var(--bg-card, #ffffff)', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light, #f1f5f9)', paddingBottom: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '10px', background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7', border: '1px solid #bae6fd' }}>
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-primary, #0f172a)' }}>
                        Bank Ledger
                      </h4>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: '6px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>
                        {ledgerBalances.settings?.bankAccountName || 'KOTAK EDP'}
                      </span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
                        Opening: ₹{Number(ledgerBalances.bankOpening || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 500 }}>
                      NEFT / RTGS / UPI / Online Settlements
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    loadLedgerSettings();
                    setShowSettingsModal(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.3rem 0.65rem',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    color: '#334155',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                  }}
                  title="Configure Initial Opening Balances & Bank Account"
                >
                  <Settings size={13} color="#64748b" />
                  <span>Setup Openings</span>
                </button>
              </div>

              {/* 4 Bank Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.55rem' }}>
                {/* Bank Opening */}
                <div style={{ padding: '0.6rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Opening</span>
                  <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#1e293b', margin: '4px 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`₹${Number(ledgerBalances.bankOpening || 0).toLocaleString('en-IN')}`}>
                    ₹{Number(ledgerBalances.bankOpening || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <span style={{ fontSize: '0.62rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Pre-Period Bal</span>
                </div>

                {/* Bank In */}
                <div style={{ padding: '0.6rem', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Bank IN</span>
                    <TrendingUp size={13} color="#16a34a" />
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#16a34a', margin: '4px 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    +₹{Number(ledgerBalances.bankIn || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <span style={{ fontSize: '0.62rem', color: '#15803d', fontWeight: 600 }}>Deposits</span>
                </div>

                {/* Bank Out */}
                <div style={{ padding: '0.6rem', borderRadius: '8px', background: '#eef2ff', border: '1px solid #c7d2fe', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Bank OUT</span>
                    <TrendingDown size={13} color="#4f46e5" />
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#4f46e5', margin: '4px 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    -₹{Number(ledgerBalances.bankExpense || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <span style={{ fontSize: '0.62rem', color: '#4338ca', fontWeight: 600 }}>Transfers</span>
                </div>

                {/* Bank Closing */}
                <div style={{
                  padding: '0.6rem',
                  borderRadius: '8px',
                  background: Number(ledgerBalances.bankClosing || 0) >= 0 ? '#f0f9ff' : '#fffbeb',
                  border: Number(ledgerBalances.bankClosing || 0) >= 0 ? '1.5px solid #7dd3fc' : '1.5px solid #fcd34d',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.03em', color: Number(ledgerBalances.bankClosing || 0) >= 0 ? '#0369a1' : '#b45309' }}>Closing</span>
                    <CreditCard size={13} color={Number(ledgerBalances.bankClosing || 0) >= 0 ? '#0284c7' : '#d97706'} />
                  </div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 900, color: Number(ledgerBalances.bankClosing || 0) >= 0 ? '#0369a1' : '#b45309', margin: '4px 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    ₹{Number(ledgerBalances.bankClosing || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, color: Number(ledgerBalances.bankClosing || 0) >= 0 ? '#075985' : '#92400e' }}>Net Bank</span>
                </div>
              </div>
            </div>
          </div>

          {/* Toolbar & Filters */}
          <div className="glass-panel" style={{ padding: '0.5rem 0.85rem', overflow: 'visible', position: 'relative', zIndex: 100 }}>
            <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Search Bar */}
              <div style={{ position: 'relative', flex: '1 1 160px' }}>
                <Search size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search Voucher, Title, Category, Vendor, Bill No..."
                  style={{ paddingLeft: 28, paddingRight: 8, paddingTop: 4, paddingBottom: 4, width: '100%', fontSize: '0.78rem', height: '32px', boxSizing: 'border-box' }}
                />
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

              {/* Unified Filters Popover */}
              <UnifiedFilterPopover
                categories={expenseFilterCategories}
                activeFilters={expenseFilters}
                onChange={setExpenseFilters}
                placeholder="Filters"
              />

              {/* PDF Download Button (Icon with tooltip) */}
              <button
                type="button"
                onClick={exportToPDF}
                className="glass-button"
                style={{ padding: '0.25rem 0.65rem', height: '32px', width: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                title="Download Filtered Ledger PDF"
              >
                <FileText size={15} color="#38bdf8" />
              </button>

              {/* Action Button: Single + New Entry */}
              {canCreateExpense && (
                <button
                  type="button"
                  onClick={() => handleOpenCreate('OUT')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.76rem', fontWeight: 800,
                    padding: '0.25rem 0.75rem', height: '32px', borderRadius: '6px', border: 'none',
                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#ffffff',
                    cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.3)', whiteSpace: 'nowrap', marginLeft: 'auto'
                  }}
                >
                  <PlusCircle size={14} /> + New Entry
                </button>
              )}
            </div>
          </div>

          {/* Transactions Ledger Table / Cards */}
          {loading ? (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
              <RefreshCw size={30} className="spin-loader" color="var(--primary)" />
              <p style={{ marginTop: '0.75rem', color: 'var(--text-muted)' }}>Loading expense transactions...</p>
            </div>
          ) : expenses.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
              <Wallet size={48} color="#60a5fa" style={{ opacity: 0.5 }} />
              <h3 style={{ marginTop: '1rem', color: 'var(--text-primary)' }}>No Expense Entries Found</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>Log your first department income or expense record to start tracking.</p>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800 }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Voucher No</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Type</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Title / Purpose</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Amount (₹)</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Payment Mode</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Vendor / Person</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Logged By</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((item, idx) => {
                      const isIN = item.type === 'IN';

                      return (
                        <tr
                          key={item._id}
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'
                          }}
                        >
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: 'var(--primary)' }}>
                            {item.voucherNo}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                            {item.date ? new Date(item.date).toLocaleDateString('en-IN') : ''}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{
                              fontSize: '0.68rem', fontWeight: 900, padding: '2px 8px', borderRadius: '12px',
                              background: isIN ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                              color: isIN ? '#34d399' : '#f87171',
                              border: `1px solid ${isIN ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                              display: 'inline-flex', alignItems: 'center', gap: '0.2rem'
                            }}>
                              {isIN ? '↙ IN' : '↗ OUT'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {item.receiptUrls && item.receiptUrls.length > 0 && (
                                <SmartThumbnail
                                  src={getBaseUrl() + item.receiptUrls[0]}
                                  alt={item.title || 'Receipt'}
                                  title={item.title || 'Receipt Proof'}
                                  size="sm"
                                  aspectRatio="1:1"
                                  category="invoice"
                                  metadata={{
                                    Voucher: item.voucherNo,
                                    BillNo: item.billNo || 'N/A',
                                    Amount: `₹${(item.amount || 0).toLocaleString('en-IN')}`,
                                    Party: item.paidToOrReceivedFrom || 'N/A'
                                  }}
                                  onClick={() => setZoomImg(getBaseUrl() + item.receiptUrls[0])}
                                />
                              )}
                              <div>
                                <div>{item.title}</div>
                                {item.billNo && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Bill No: {item.billNo}</span>}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                            {item.category}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 900, fontSize: '0.9rem', color: isIN ? '#34d399' : '#f87171' }}>
                            {isIN ? '+' : '-'} ₹{(item.amount || 0).toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                              <span style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem' }}>
                                {item.paymentMode || 'Cash'}
                              </span>
                              {item.bankAccount && (
                                <span style={{
                                  fontSize: '0.64rem', fontWeight: 800, padding: '1px 5px', borderRadius: '4px',
                                  background: item.bankAccount === 'Cash in Hand' ? 'rgba(16,185,129,0.1)' : 'rgba(2,132,199,0.1)',
                                  color: item.bankAccount === 'Cash in Hand' ? '#10b981' : '#0284c7',
                                  border: `1px solid ${item.bankAccount === 'Cash in Hand' ? 'rgba(16,185,129,0.3)' : 'rgba(2,132,199,0.3)'}`
                                }}>
                                  {item.bankAccount === 'Cash in Hand' ? '💵 Cash in Hand' : `🏦 ${item.bankAccount}`}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>
                            {item.paidToOrReceivedFrom || 'N/A'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0284c7', background: '#e0f2fe', padding: '2px 7px', borderRadius: '4px', border: '1px solid #bae6fd' }}>
                              👤 {item.createdByName || item.createdBy || 'Staff User'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                              <button
                                type="button"
                                onClick={() => setShowViewModal(item)}
                                style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: '2px' }}
                                title="View Details"
                              >
                                <Eye size={15} />
                              </button>

                              {canCreateExpense && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEdit(item)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                                    title="Edit Entry"
                                  >
                                    <Edit2 size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(item._id, item.voucherNo)}
                                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px' }}
                                    title="Delete Entry"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <ShieldAlert size={48} color="#f43f5e" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ color: 'var(--text-primary)' }}>Access Restricted</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            You do not have permission to view the Department Expense Dashboard. Contact Administrator.
          </p>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: transactionMode === 'PARTY' ? '680px' : '600px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', borderRadius: '12px', transition: 'max-width 0.2s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Wallet size={20} color={formVal.type === 'IN' ? '#34d399' : '#f87171'} />
                {editingItem ? 'Edit Expense Entry' : 'New Transaction'} ({formVal.voucherNo})
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Type Switcher (4 Buttons: Cash IN, Cash OUT, Party, Vendor) */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Transaction Type *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.45rem' }}>
                  {/* 1. Cash IN */}
                  <button
                    type="button"
                    onClick={() => handleModeSelect('IN')}
                    style={{
                      padding: '0.6rem 0.3rem', fontSize: '0.78rem', fontWeight: 800, borderRadius: '8px',
                      border: transactionMode === 'IN' ? '2px solid #10b981' : '1px solid var(--border-light)',
                      background: transactionMode === 'IN' ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.03)',
                      color: transactionMode === 'IN' ? '#34d399' : 'var(--text-muted)', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                      boxShadow: transactionMode === 'IN' ? '0 0 10px rgba(16,185,129,0.2)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>🟢 Cash IN</span>
                    <span style={{ fontSize: '0.62rem', opacity: 0.8, fontWeight: 600 }}>Income / Receipt</span>
                  </button>

                  {/* 2. Cash OUT */}
                  <button
                    type="button"
                    onClick={() => handleModeSelect('OUT')}
                    style={{
                      padding: '0.6rem 0.3rem', fontSize: '0.78rem', fontWeight: 800, borderRadius: '8px',
                      border: transactionMode === 'OUT' ? '2px solid #ef4444' : '1px solid var(--border-light)',
                      background: transactionMode === 'OUT' ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.03)',
                      color: transactionMode === 'OUT' ? '#f87171' : 'var(--text-muted)', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                      boxShadow: transactionMode === 'OUT' ? '0 0 10px rgba(239,68,68,0.2)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>🔴 Cash OUT</span>
                    <span style={{ fontSize: '0.62rem', opacity: 0.8, fontWeight: 600 }}>Expense / Pmt</span>
                  </button>

                  {/* 3. Party */}
                  <button
                    type="button"
                    onClick={() => handleModeSelect('PARTY')}
                    style={{
                      padding: '0.6rem 0.3rem', fontSize: '0.78rem', fontWeight: 800, borderRadius: '8px',
                      border: transactionMode === 'PARTY' ? '2px solid #2563eb' : '1px solid var(--border-light)',
                      background: transactionMode === 'PARTY' ? '#eff6ff' : 'rgba(255,255,255,0.03)',
                      color: transactionMode === 'PARTY' ? '#1d4ed8' : 'var(--text-muted)', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                      boxShadow: transactionMode === 'PARTY' ? '0 0 10px rgba(37,99,235,0.2)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>👥 Party</span>
                    <span style={{ fontSize: '0.62rem', opacity: 0.85, fontWeight: 600 }}>Bill Payment (IN)</span>
                  </button>

                  {/* 4. Vendor */}
                  <button
                    type="button"
                    onClick={() => handleModeSelect('VENDOR')}
                    style={{
                      padding: '0.6rem 0.3rem', fontSize: '0.78rem', fontWeight: 800, borderRadius: '8px',
                      border: transactionMode === 'VENDOR' ? '2px solid #2563eb' : '1px solid var(--border-light)',
                      background: transactionMode === 'VENDOR' ? '#eff6ff' : 'rgba(255,255,255,0.03)',
                      color: transactionMode === 'VENDOR' ? '#1d4ed8' : 'var(--text-muted)', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                      boxShadow: transactionMode === 'VENDOR' ? '0 0 10px rgba(37,99,235,0.2)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>🏢 Vendor</span>
                    <span style={{ fontSize: '0.62rem', opacity: 0.85, fontWeight: 600 }}>Supplier (OUT)</span>
                  </button>
                </div>
              </div>

              {/* PARTY MODE: PARTY SELECTOR & INVOICE PAYMENT PICKER (WHITE & BLUE THEME) */}
              {transactionMode === 'PARTY' && (
                <div style={{ background: '#ffffff', border: '1.5px solid #bfdbfe', borderRadius: '10px', padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', boxShadow: '0 2px 10px rgba(37,99,235,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                      <Users size={16} color="#1d4ed8" /> Select Party Name *
                    </label>
                    {loadingPartiesData && (
                      <span style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 600 }}>Loading parties & invoices...</span>
                    )}
                  </div>

                  <div>
                    <select
                      value={selectedParty}
                      onChange={e => handlePartyChange(e.target.value)}
                      style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', fontSize: '0.88rem', fontWeight: 700, background: '#ffffff', color: '#0f172a', border: '1.5px solid #bfdbfe' }}
                    >
                      <option value="">-- Select Party / Client --</option>
                      {partiesList.map((p, idx) => (
                        <option key={idx} value={p.name}>
                          {p.name} {p.pendingCount > 0 ? `(${p.pendingCount} unpaid bills • Due: ₹${p.pendingAmount.toLocaleString('en-IN')})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Party Invoices List */}
                  {selectedParty && (
                    <div style={{ borderTop: '1px solid #bfdbfe', paddingTop: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e3a8a' }}>
                            Select Invoices for Payment ({currentPartyInvoices.length} found):
                          </span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', background: '#dbeafe', color: '#1e40af', borderRadius: '12px' }}>
                            Oldest First ⏳
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          {Number(formVal.amount) > 0 && (
                            <button
                              type="button"
                              onClick={() => autoMatchInvoicesToAmount(formVal.amount, selectedParty)}
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                padding: '3px 10px',
                                borderRadius: '5px',
                                border: '1px solid #1d4ed8',
                                background: '#2563eb',
                                color: '#ffffff',
                                cursor: 'pointer',
                                boxShadow: '0 1px 3px rgba(37,99,235,0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                              title="Auto-select oldest invoices matching the entered amount"
                            >
                              ⚡ Auto-Match ₹{Number(formVal.amount).toLocaleString('en-IN')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleSelectAllPending}
                            style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: '5px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer' }}
                          >
                            Select All Unpaid
                          </button>
                          <button
                            type="button"
                            onClick={handleDeselectAllInvoices}
                            style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: '5px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', cursor: 'pointer' }}
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAllPartyInvoices(prev => !prev)}
                            style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: '5px', border: '1px solid #bfdbfe', background: showAllPartyInvoices ? '#eff6ff' : '#ffffff', color: showAllPartyInvoices ? '#1d4ed8' : '#2563eb', cursor: 'pointer' }}
                          >
                            {showAllPartyInvoices ? 'Showing All' : 'Show All'}
                          </button>
                        </div>
                      </div>

                      {currentPartyInvoices.length === 0 ? (
                        <div style={{ padding: '0.85rem', textAlign: 'center', fontSize: '0.78rem', color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                          No unpaid invoices found for {selectedParty}. (You can still record an advance or click "Show All" to view paid invoices)
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                          {currentPartyInvoices.map((inv, idx) => {
                            const isSelected = !!selectedInvoicesMap[inv._id]?.selected;
                            const due = inv.balanceDue != null ? Number(inv.balanceDue) : Math.max(0, Number(inv.grandTotal || 0) - Number(inv.paidAmount || 0));
                            const isPaid = inv.paymentStatus === 'PAID' || due <= 0;
                            const payingAmt = selectedInvoicesMap[inv._id]?.payingAmount ?? (isSelected ? due : '');
                            const invDate = inv.invoiceDate ? new Date(inv.invoiceDate) : (inv.createdAt ? new Date(inv.createdAt) : null);
                            const formattedDate = invDate ? invDate.toLocaleDateString('en-IN') : 'No Date';

                            return (
                              <div
                                key={inv._id}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '0.55rem 0.75rem', borderRadius: '8px',
                                  background: isSelected ? '#eff6ff' : '#ffffff',
                                  border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                                  boxShadow: isSelected ? '0 2px 6px rgba(37, 99, 235, 0.1)' : 'none',
                                  gap: '0.5rem'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: '1 1 auto', minWidth: 0 }}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleInvoice(inv)}
                                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2563eb' }}
                                  />
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                      <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0f172a' }}>
                                        {inv.invoiceNo}
                                      </span>
                                      {idx === 0 && !isPaid && (
                                        <span style={{
                                          fontSize: '0.62rem', fontWeight: 800, padding: '1px 6px', borderRadius: '4px',
                                          background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5'
                                        }}>
                                          Oldest Bill
                                        </span>
                                      )}
                                      <span style={{
                                        fontSize: '0.65rem', fontWeight: 800, padding: '1px 6px', borderRadius: '6px',
                                        background: '#eff6ff',
                                        color: '#1d4ed8',
                                        border: '1px solid #bfdbfe'
                                      }}>
                                        {inv.paymentStatus || (isPaid ? 'PAID' : 'UNPAID')}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2 }}>
                                      <span style={{ fontWeight: 600, color: '#334155' }}>📅 {formattedDate}</span> • Total: ₹{inv.grandTotal?.toLocaleString('en-IN')} • Due: <strong style={{ color: '#1d4ed8' }}>₹{due.toLocaleString('en-IN')}</strong>
                                    </div>
                                  </div>
                                </div>

                                <div style={{ width: '115px', flexShrink: 0 }}>
                                  <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#1e40af', display: 'block', marginBottom: 2 }}>
                                    Paying (₹)
                                  </label>
                                  <StandardNumericInput
                                    mode="currency"
                                    decimals={2}
                                    prefix="₹"
                                    disabled={!isSelected}
                                    value={payingAmt}
                                    onChange={e => handleInvoicePayingAmountChange(inv, e.target.value)}
                                    placeholder="0.00"
                                    size="sm"
                                    style={{
                                      width: '100%',
                                      fontSize: '0.88rem',
                                      fontWeight: 800,
                                      color: isSelected ? '#1d4ed8' : '#64748b',
                                      border: isSelected ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                                      background: '#ffffff',
                                      borderRadius: '6px',
                                      boxShadow: isSelected ? '0 1px 3px rgba(37,99,235,0.15)' : 'none'
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Selected Summary & Match Tracker (Pure White & Blue) */}
                      {(() => {
                        const selectedEntries = Object.values(selectedInvoicesMap).filter(e => e?.selected);
                        const totalAllocated = selectedEntries.reduce((sum, e) => sum + (Number(e.payingAmount) || 0), 0);
                        const targetAmt = Number(formVal.amount || 0);
                        const diff = Math.round((targetAmt - totalAllocated) * 100) / 100;
                        const isMatch = targetAmt > 0 && Math.abs(diff) < 0.01;

                        if (selectedEntries.length === 0 && targetAmt <= 0) return null;

                        return (
                          <div style={{
                            marginTop: '0.65rem', padding: '0.6rem 0.85rem',
                            background: isMatch ? '#f0fdf4' : (diff > 0.01 ? '#eff6ff' : '#fffbeb'),
                            border: isMatch ? '1.5px solid #86efac' : (diff > 0.01 ? '1.5px solid #93c5fd' : '1.5px solid #fde047'),
                            borderRadius: '8px',
                            display: 'flex', flexDirection: 'column', gap: '0.25rem'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isMatch ? '#15803d' : '#1e40af' }}>
                                ✓ {selectedEntries.length} Invoice(s) Selected • Total Paying: ₹{totalAllocated.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              {isMatch ? (
                                <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  ✅ Exact Match to Entered Amount!
                                </span>
                              ) : targetAmt > 0 && diff > 0.01 ? (
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#2563eb' }}>
                                  Target: ₹{targetAmt.toLocaleString('en-IN')} (₹{diff.toLocaleString('en-IN')} unallocated / advance)
                                </span>
                              ) : targetAmt > 0 && diff < -0.01 ? (
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#b45309' }}>
                                  Target: ₹{targetAmt.toLocaleString('en-IN')} (Exceeds target by ₹{Math.abs(diff).toLocaleString('en-IN')})
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* VENDOR MODE: VENDOR SELECTOR & PURCHASE BILL PAYMENT PICKER (WHITE & BLUE THEME) */}
              {transactionMode === 'VENDOR' && (
                <div style={{ background: '#ffffff', border: '1.5px solid #bfdbfe', borderRadius: '10px', padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', boxShadow: '0 2px 10px rgba(37,99,235,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                      <Building2 size={16} color="#1d4ed8" /> Select Vendor (Supplier / Inward) *
                    </label>
                    {loadingPartiesData && (
                      <span style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 600 }}>Loading vendors & purchases...</span>
                    )}
                  </div>

                  <div>
                    <select
                      value={selectedVendor}
                      onChange={e => handleVendorChange(e.target.value)}
                      style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', fontSize: '0.88rem', fontWeight: 700, background: '#ffffff', color: '#0f172a', border: '1.5px solid #bfdbfe' }}
                    >
                      <option value="">-- Choose Vendor / Supplier --</option>
                      {vendorsList.map((v, idx) => (
                        <option key={idx} value={v.name}>
                          {v.name} {v.pendingCount > 0 ? `(${v.pendingCount} unpaid bills • Due: ₹${v.pendingAmount.toLocaleString('en-IN')})` : (v.totalPurchaseCount > 0 ? `(${v.totalPurchaseCount} bills)` : `(${v.category})`)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Vendor Purchases List */}
                  {selectedVendor && (
                    <div style={{ borderTop: '1px solid #bfdbfe', paddingTop: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e3a8a' }}>
                            Select Purchase Bills for Payment ({currentVendorPurchases.length} found):
                          </span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', background: '#dbeafe', color: '#1e40af', borderRadius: '12px' }}>
                            Oldest First ⏳
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          {Number(formVal.amount) > 0 && (
                            <button
                              type="button"
                              onClick={() => autoMatchPurchasesToAmount(formVal.amount, selectedVendor)}
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                padding: '3px 10px',
                                borderRadius: '5px',
                                border: '1px solid #1d4ed8',
                                background: '#2563eb',
                                color: '#ffffff',
                                cursor: 'pointer',
                                boxShadow: '0 1px 3px rgba(37,99,235,0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                              title="Auto-select oldest purchase bills matching the entered amount"
                            >
                              ⚡ Auto-Match ₹{Number(formVal.amount).toLocaleString('en-IN')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleSelectAllPendingPurchases}
                            style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: '5px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer' }}
                          >
                            Select All Unpaid
                          </button>
                          <button
                            type="button"
                            onClick={handleDeselectAllPurchases}
                            style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: '5px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', cursor: 'pointer' }}
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAllVendorPurchases(prev => !prev)}
                            style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: '5px', border: '1px solid #bfdbfe', background: showAllVendorPurchases ? '#eff6ff' : '#ffffff', color: showAllVendorPurchases ? '#1d4ed8' : '#2563eb', cursor: 'pointer' }}
                          >
                            {showAllVendorPurchases ? 'Showing All' : 'Show All'}
                          </button>
                        </div>
                      </div>

                      {currentVendorPurchases.length === 0 ? (
                        <div style={{ padding: '0.85rem', textAlign: 'center', fontSize: '0.78rem', color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                          No unpaid purchase bills found for {selectedVendor}. (You can still record a manual payment/advance or click "Show All" to view paid bills)
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                          {currentVendorPurchases.map((pur, idx) => {
                            const purKey = pur.id || pur.purchaseNo;
                            const isSelected = !!selectedPurchasesMap[purKey]?.selected;
                            const totalAmt = Number(pur.totalAmount) || 0;
                            const paidAmt = Number(pur.paidAmount) || 0;
                            const due = pur.balanceDue != null ? Number(pur.balanceDue) : Math.max(0, totalAmt - paidAmt);
                            const isPaid = pur.paymentStatus === 'PAID' || due <= 0;
                            const payingAmt = selectedPurchasesMap[purKey]?.payingAmount ?? (isSelected ? (due > 0 ? due : totalAmt) : '');

                            // Item summary text
                            const itemsSummary = Array.isArray(pur.items) && pur.items.length > 0
                              ? pur.items.map(it => `${it.itemName || 'Item'} (${it.quantity || 0} ${it.unit || 'Mtr'})`).join(', ')
                              : (pur.itemName || 'Material Inward');

                            const purDate = pur.billDate || pur.purchaseDate || pur.date || pur.createdAt;
                            const formattedDate = purDate ? new Date(purDate).toLocaleDateString('en-IN') : 'No Date';

                            return (
                              <div
                                key={purKey}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '0.55rem 0.75rem', borderRadius: '8px',
                                  background: isSelected ? '#eff6ff' : '#ffffff',
                                  border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                                  boxShadow: isSelected ? '0 2px 6px rgba(37, 99, 235, 0.1)' : 'none',
                                  gap: '0.5rem'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: '1 1 auto', minWidth: 0 }}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleTogglePurchase(pur)}
                                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2563eb' }}
                                  />
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                      <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0f172a' }}>
                                        {pur.purchaseNo}
                                      </span>
                                      {idx === 0 && !isPaid && (
                                        <span style={{
                                          fontSize: '0.62rem', fontWeight: 800, padding: '1px 6px', borderRadius: '4px',
                                          background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5'
                                        }}>
                                          Oldest Bill
                                        </span>
                                      )}
                                      <span style={{
                                        fontSize: '0.65rem', fontWeight: 800, padding: '1px 6px', borderRadius: '6px',
                                        background: '#eff6ff',
                                        color: '#1d4ed8',
                                        border: '1px solid #bfdbfe'
                                      }}>
                                        {pur.paymentStatus || (isPaid ? 'PAID' : 'UNPAID')}
                                      </span>
                                      {pur.gstRate > 0 && (
                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '1px 6px', borderRadius: '6px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                                          {pur.gstRate}% GST
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                                      {itemsSummary}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 1 }}>
                                      <span style={{ fontWeight: 600, color: '#334155' }}>📅 {formattedDate}</span> • Bill Total: ₹{totalAmt.toLocaleString('en-IN')} • Due: <strong style={{ color: '#1d4ed8' }}>₹{due.toLocaleString('en-IN')}</strong>
                                    </div>
                                  </div>
                                </div>

                                <div style={{ width: '115px', flexShrink: 0 }}>
                                  <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#1e40af', display: 'block', marginBottom: 2 }}>
                                    Paying (₹)
                                  </label>
                                  <StandardNumericInput
                                    mode="currency"
                                    decimals={2}
                                    prefix="₹"
                                    disabled={!isSelected}
                                    value={payingAmt}
                                    onChange={e => handlePurchasePayingAmountChange(pur, e.target.value)}
                                    placeholder="0.00"
                                    size="sm"
                                    style={{
                                      width: '100%',
                                      fontSize: '0.88rem',
                                      fontWeight: 800,
                                      color: isSelected ? '#1d4ed8' : '#64748b',
                                      border: isSelected ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                                      background: '#ffffff',
                                      borderRadius: '6px',
                                      boxShadow: isSelected ? '0 1px 3px rgba(37,99,235,0.15)' : 'none'
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Selected Purchases Summary & Match Tracker (Pure White & Blue) */}
                      {(() => {
                        const selectedEntries = Object.values(selectedPurchasesMap).filter(e => e?.selected);
                        const totalAllocated = selectedEntries.reduce((sum, e) => sum + (Number(e.payingAmount) || 0), 0);
                        const targetAmt = Number(formVal.amount || 0);
                        const diff = Math.round((targetAmt - totalAllocated) * 100) / 100;
                        const isMatch = targetAmt > 0 && Math.abs(diff) < 0.01;

                        if (selectedEntries.length === 0 && targetAmt <= 0) return null;

                        return (
                          <div style={{
                            marginTop: '0.65rem', padding: '0.6rem 0.85rem',
                            background: isMatch ? '#f0fdf4' : (diff > 0.01 ? '#eff6ff' : '#fffbeb'),
                            border: isMatch ? '1.5px solid #86efac' : (diff > 0.01 ? '1.5px solid #93c5fd' : '1.5px solid #fde047'),
                            borderRadius: '8px',
                            display: 'flex', flexDirection: 'column', gap: '0.25rem'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isMatch ? '#15803d' : '#1e40af' }}>
                                ✓ {selectedEntries.length} Purchase Bill(s) Selected • Total Paying: ₹{totalAllocated.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              {isMatch ? (
                                <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  ✅ Exact Match to Entered Amount!
                                </span>
                              ) : targetAmt > 0 && diff > 0.01 ? (
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#2563eb' }}>
                                  Target: ₹{targetAmt.toLocaleString('en-IN')} (₹{diff.toLocaleString('en-IN')} unallocated)
                                </span>
                              ) : targetAmt > 0 && diff < -0.01 ? (
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#b45309' }}>
                                  Target: ₹{targetAmt.toLocaleString('en-IN')} (Exceeds target by ₹{Math.abs(diff).toLocaleString('en-IN')})
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Date & Amount */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date *</label>
                  <input
                    type="date"
                    required
                    value={formVal.date}
                    onChange={e => setFormVal(prev => ({ ...prev, date: e.target.value }))}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: formVal.type === 'IN' ? '#34d399' : '#f87171', textTransform: 'uppercase' }}>
                    Amount (₹) *
                  </label>
                  <StandardNumericInput
                    mode="currency"
                    decimals={2}
                    prefix="₹"
                    required
                    placeholder="0.00"
                    value={formVal.amount}
                    onChange={e => setFormVal(prev => ({ ...prev, amount: e.target.value }))}
                    onBlur={() => {
                      const num = parseFloat(formVal.amount);
                      if (num > 0) {
                        if (transactionMode === 'PARTY' && selectedParty) {
                          autoMatchInvoicesToAmount(num, selectedParty);
                        } else if (transactionMode === 'VENDOR' && selectedVendor) {
                          autoMatchPurchasesToAmount(num, selectedVendor);
                        }
                      }
                    }}
                    style={{ width: '100%', marginTop: 4, fontWeight: 900, fontSize: '1rem', color: formVal.type === 'IN' ? '#34d399' : '#f87171' }}
                  />
                  {((transactionMode === 'PARTY' && selectedParty) || (transactionMode === 'VENDOR' && selectedVendor)) && Number(formVal.amount) > 0 && (
                    <div style={{ marginTop: '4px', fontSize: '0.68rem', color: '#2563eb', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>⚡ Auto-allocates across oldest bills (FIFO)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Title / Purpose */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Title / Purpose *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grando Machine Belt Repair / Cyan Ink Bucket Purchase"
                  value={formVal.title}
                  onChange={e => setFormVal(prev => ({ ...prev, title: e.target.value }))}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </div>

              {/* Category & Payment Mode */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Category *</label>
                  <select
                    value={formVal.category}
                    onChange={e => setFormVal(prev => ({ ...prev, category: e.target.value }))}
                    style={{ width: '100%', marginTop: 4 }}
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Payment Mode</label>
                  <select
                    value={formVal.paymentMode}
                    onChange={e => {
                      const newMode = e.target.value;
                      const isCash = newMode === 'Cash';
                      setFormVal(prev => ({
                        ...prev,
                        paymentMode: newMode,
                        bankAccount: isCash ? 'Cash in Hand' : (prev.bankAccount === 'Cash in Hand' ? (ledgerBalances.settings?.bankAccountName || 'KOTAK EDP') : prev.bankAccount)
                      }));
                    }}
                    style={{ width: '100%', marginTop: 4 }}
                  >
                    {(paymentModes && paymentModes.length > 0 ? paymentModes : DEFAULT_PAYMENT_MODES).map(pm => <option key={pm} value={pm}>{pm}</option>)}
                  </select>
                </div>
              </div>

              {/* Target Ledger / Bank Account Routing */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Landmark size={13} color="#38bdf8" /> Target Ledger / Bank Account *
                  </label>
                  {Number(formVal.amount) > 0 && (
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: formVal.bankAccount === 'Cash in Hand' ? '#10b981' : '#0284c7' }}>
                      Routes to: {formVal.bankAccount === 'Cash in Hand' ? '💵 Cash Balance' : `🏦 ${formVal.bankAccount}`}
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={() => setFormVal(prev => ({ ...prev, bankAccount: 'Cash in Hand', paymentMode: prev.paymentMode === 'Cash' ? prev.paymentMode : 'Cash' }))}
                    style={{
                      padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 800,
                      border: formVal.bankAccount === 'Cash in Hand' ? '2px solid #10b981' : '1px solid var(--border-light)',
                      background: formVal.bankAccount === 'Cash in Hand' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.02)',
                      color: formVal.bankAccount === 'Cash in Hand' ? '#10b981' : 'var(--text-muted)',
                      cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <span style={{ fontSize: '1.1rem' }}>💵</span>
                    <div>
                      <div>Cash in Hand</div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 500, opacity: 0.8 }}>Physical Cash / Petty Cash</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormVal(prev => ({
                      ...prev,
                      bankAccount: ledgerBalances.settings?.bankAccountName || 'KOTAK EDP',
                      paymentMode: prev.paymentMode === 'Cash' ? 'UPI / GPay / PhonePe' : prev.paymentMode
                    }))}
                    style={{
                      padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 800,
                      border: formVal.bankAccount !== 'Cash in Hand' ? '2px solid #0284c7' : '1px solid var(--border-light)',
                      background: formVal.bankAccount !== 'Cash in Hand' ? 'rgba(2,132,199,0.15)' : 'rgba(255,255,255,0.02)',
                      color: formVal.bankAccount !== 'Cash in Hand' ? '#0284c7' : 'var(--text-muted)',
                      cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <span style={{ fontSize: '1.1rem' }}>🏦</span>
                    <div>
                      <div>{ledgerBalances.settings?.bankAccountName || 'KOTAK EDP'}</div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 500, opacity: 0.8 }}>Primary Business Bank</div>
                    </div>
                  </button>
                </div>

                {/* Real-Time Live Projected Closing Balance Impact */}
                {Number(formVal.amount) > 0 && (
                  <div style={{ fontSize: '0.68rem', padding: '5px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>
                      Current {formVal.bankAccount === 'Cash in Hand' ? 'Cash' : 'Bank'} Closing: ₹{(formVal.bankAccount === 'Cash in Hand' ? Number(ledgerBalances.cashClosing || 0) : Number(ledgerBalances.bankClosing || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                      Projected Closing: ₹{(
                        (formVal.bankAccount === 'Cash in Hand' ? Number(ledgerBalances.cashClosing || 0) : Number(ledgerBalances.bankClosing || 0)) +
                        ((formVal.type === 'IN' || transactionMode === 'PARTY') ? Number(formVal.amount) : -Number(formVal.amount))
                      ).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>

              {/* Paid To / Received From & Bill No */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {formVal.type === 'IN' ? 'Received From' : 'Paid To (Vendor / Person)'}
                  </label>
                  <input
                    type="text"
                    placeholder={formVal.type === 'IN' ? 'Admin Advance / Client Name' : 'Hardware Store / Mechanic Name'}
                    value={formVal.paidToOrReceivedFrom}
                    onChange={e => setFormVal(prev => ({ ...prev, paidToOrReceivedFrom: e.target.value }))}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Bill / Invoice No</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-9901 / Cash Memo #12"
                    value={formVal.billNo}
                    onChange={e => setFormVal(prev => ({ ...prev, billNo: e.target.value }))}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Remarks / Description</label>
                <textarea
                  rows={2}
                  placeholder="Additional notes..."
                  value={formVal.description}
                  onChange={e => setFormVal(prev => ({ ...prev, description: e.target.value }))}
                  style={{ width: '100%', marginTop: 4, resize: 'vertical' }}
                />
              </div>

              {/* Photo Proof Upload */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>📸 Bill / Receipt Photo Proof</span>
                  {uploading && <span style={{ color: '#38bdf8', fontSize: '0.7rem' }}>Compressing & Uploading...</span>}
                </label>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: 4 }}>
                  {(formVal.receiptUrls || []).map((url, idx) => (
                    <div key={idx} style={{ position: 'relative', width: 60, height: 60, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-light)' }}>
                      <img src={getBaseUrl() + url} alt="Proof" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', color: '#f87171', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}

                  <label style={{ width: 60, height: 60, borderRadius: 6, border: '1px dashed var(--border-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.03)' }}>
                    <ImageIcon size={18} color="var(--text-muted)" />
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2 }}>Upload</span>
                    <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
                <button type="button" onClick={() => setShowModal(false)} className="glass-button">Cancel</button>
                <button
                  type="submit"
                  disabled={saving || uploading}
                  style={{
                    padding: '0.55rem 1.25rem', fontSize: '0.82rem', fontWeight: 800, borderRadius: '8px', border: 'none',
                    background: (transactionMode === 'PARTY' || transactionMode === 'VENDOR')
                      ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                      : formVal.type === 'IN' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: '#fff', cursor: saving || uploading ? 'not-allowed' : 'pointer', opacity: saving || uploading ? 0.6 : 1
                  }}
                >
                  {saving ? 'Saving...' : editingItem ? 'Update Entry' : transactionMode === 'PARTY' ? 'Receive Payment & Save Cash IN' : transactionMode === 'VENDOR' ? 'Pay Vendor & Save Cash OUT' : formVal.type === 'IN' ? 'Save Cash IN' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {showViewModal && (
        <div className="modal-backdrop" onClick={() => setShowViewModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: 900, color: showViewModal.type === 'IN' ? '#34d399' : '#f87171', background: showViewModal.type === 'IN' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', padding: '2px 8px', borderRadius: '10px' }}>
                  {showViewModal.type === 'IN' ? '🟢 CASH IN (INCOME)' : '🔴 CASH OUT (EXPENSE)'}
                </span>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                  {showViewModal.title}
                </h3>
              </div>
              <button onClick={() => setShowViewModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'rgba(255,255,255,0.03)', padding: '0.85rem', borderRadius: '8px' }}>
                <div><strong>Voucher No:</strong> {showViewModal.voucherNo}</div>
                <div><strong>Date:</strong> {showViewModal.date}</div>
                <div><strong>Category:</strong> {showViewModal.category}</div>
                <div><strong>Payment Mode:</strong> {showViewModal.paymentMode}</div>
                <div><strong>Target Account:</strong> <span style={{ color: (showViewModal.bankAccount === 'Cash in Hand' || showViewModal.paymentMode === 'Cash') ? '#10b981' : '#0284c7', fontWeight: 700 }}>{showViewModal.bankAccount || (showViewModal.paymentMode === 'Cash' ? 'Cash in Hand' : 'Bank Account')}</span></div>
                <div><strong>{showViewModal.type === 'IN' ? 'Received From:' : 'Paid To:'}</strong> {showViewModal.paidToOrReceivedFrom || 'N/A'}</div>
                <div><strong>Bill/Invoice No:</strong> {showViewModal.billNo || 'N/A'}</div>
              </div>

              <div style={{ background: showViewModal.type === 'IN' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding: '1rem', borderRadius: '8px', border: `1px solid ${showViewModal.type === 'IN' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)' }}>TRANSACTION AMOUNT:</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: showViewModal.type === 'IN' ? '#34d399' : '#f87171' }}>
                  ₹{(showViewModal.amount || 0).toLocaleString('en-IN')}
                </span>
              </div>

              {showViewModal.description && (
                <div>
                  <strong>Remarks / Description:</strong>
                  <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{showViewModal.description}</p>
                </div>
              )}

              {showViewModal.receiptUrls && showViewModal.receiptUrls.length > 0 && (
                <div>
                  <strong>Bill / Receipt Proof:</strong>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: 8, flexWrap: 'wrap' }}>
                    {showViewModal.receiptUrls.map((url, idx) => (
                      <SmartThumbnail
                        key={idx}
                        src={getBaseUrl() + url}
                        alt={`Receipt #${idx + 1}`}
                        title={`Receipt #${idx + 1}`}
                        size="lg"
                        aspectRatio="3:4"
                        category="invoice"
                        metadata={{
                          Voucher: showViewModal.voucherNo,
                          BillNo: showViewModal.billNo || 'N/A',
                          Amount: `₹${(showViewModal.amount || 0).toLocaleString('en-IN')}`,
                          Party: showViewModal.paidToOrReceivedFrom || 'N/A'
                        }}
                        onClick={() => setZoomImg(getBaseUrl() + url)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SET INITIAL OPENING BALANCE MODAL (BUSINESS UNIT ONBOARDING) ── */}
      {showSettingsModal && (
        <div className="modal-backdrop" onClick={() => setShowSettingsModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '520px', padding: '1.5rem', borderRadius: '14px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Settings size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                    Set Initial Opening Balances
                  </h3>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Baseline Ledger Onboarding for {companyEntity}
                  </span>
                </div>
              </div>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveLedgerSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Business Unit</label>
                  <input
                    type="text"
                    readOnly
                    value={companyEntity}
                    style={{ width: '100%', marginTop: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Primary Bank Account Name *</label>
                  <input
                    type="text"
                    required
                    value={settingsForm.bankAccountName}
                    onChange={e => setSettingsForm(prev => ({ ...prev, bankAccountName: e.target.value }))}
                    placeholder="e.g. KOTAK EDP"
                    style={{ width: '100%', marginTop: 4, fontWeight: 700 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Effective Opening Date *</label>
                <input
                  type="date"
                  required
                  value={settingsForm.effectiveDate}
                  onChange={e => setSettingsForm(prev => ({ ...prev, effectiveDate: e.target.value }))}
                  style={{ width: '100%', marginTop: 4 }}
                />
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginTop: 3 }}>
                  All historical vouchers logged after this date will adjust from this baseline opening.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase' }}>
                    💵 Initial Cash Opening (₹) *
                  </label>
                  <StandardNumericInput
                    mode="currency"
                    decimals={2}
                    prefix="₹"
                    value={settingsForm.initialCashOpening}
                    onChange={e => setSettingsForm(prev => ({ ...prev, initialCashOpening: e.target.value }))}
                    placeholder="0.00"
                    style={{ width: '100%', marginTop: 4, fontWeight: 800 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase' }}>
                    🏦 Initial Bank Opening (₹) *
                  </label>
                  <StandardNumericInput
                    mode="currency"
                    decimals={2}
                    prefix="₹"
                    value={settingsForm.initialBankOpening}
                    onChange={e => setSettingsForm(prev => ({ ...prev, initialBankOpening: e.target.value }))}
                    placeholder="0.00"
                    style={{ width: '100%', marginTop: 4, fontWeight: 800 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Notes / CA Reference</label>
                <textarea
                  rows={2}
                  value={settingsForm.notes}
                  onChange={e => setSettingsForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. Audited balance sheet baseline verified by CA..."
                  style={{ width: '100%', marginTop: 4, fontSize: '0.8rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="btn-secondary"
                  style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="btn-primary"
                  style={{ padding: '0.45rem 1.2rem', fontSize: '0.8rem', fontWeight: 800 }}
                >
                  {savingSettings ? 'Saving...' : '💾 Save Opening Balances'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ZOOM IMAGE LIGHTBOX */}
      {zoomImg && (
        <div onClick={() => setZoomImg(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={zoomImg} alt="Zoomed" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }} />
        </div>
      )}
    </div>
  );
}
