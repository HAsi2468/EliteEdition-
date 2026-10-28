import React, { useState, useRef, useEffect } from 'react';
import { 
  PackageCheck, 
  Barcode, 
  Scan, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Boxes, 
  Layers, 
  Clock, 
  Truck, 
  Maximize2,
  RefreshCw,
  Printer,
  RotateCcw,
  Check,
  AlertTriangle,
  X,
  FileSpreadsheet,
  Calendar,
  ExternalLink,
  MapPin,
  Tag,
  Undo2,
  Camera,
  Image as ImageIcon,
  Upload,
  FileText,
  ShieldAlert,
  UserCheck,
  Eye,
  CheckCheck,
  FileDown,
  Scale,
  TrendingUp,
  BarChart2,
  Sliders,
  Copy,
  Phone,
  CreditCard,
  User,
  Hash,
  Info,
  Zap,
  Filter,
  ChevronDown,
  ChevronUp,
  Trash2
} from 'lucide-react';
import { api } from '../services/api';
import EntityBrandBadge from './common/EntityBrandBadge';
import { useHardwareBarcodeSniffer } from '../hooks/useHardwareBarcodeSniffer';
import DateRangePicker, { getDatePresetRange } from './DateRangePicker';
import UnifiedFilterPopover from './common/UnifiedFilterPopover';

const fmtINR = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getLocalDateString = (dateObj = new Date()) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDateRangeForPreset = (preset) => {
  const today = new Date();
  const todayStr = getLocalDateString(today);

  if (preset === 'TODAY') {
    return { startDate: todayStr, endDate: todayStr };
  } else if (preset === 'YESTERDAY') {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yStr = getLocalDateString(y);
    return { startDate: yStr, endDate: yStr };
  } else if (preset === '7DAYS') {
    const past = new Date();
    past.setDate(past.getDate() - 6);
    return { startDate: getLocalDateString(past), endDate: todayStr };
  } else if (preset === '30DAYS') {
    const past = new Date();
    past.setDate(past.getDate() - 29);
    return { startDate: getLocalDateString(past), endDate: todayStr };
  } else if (preset === 'ALL') {
    return { startDate: '', endDate: '' };
  }
  return { startDate: '', endDate: '' };
};

export default function ScanAndPackScreen({ currentUser }) {
  // Operational Screens: 'ALL' (1st: Data Collection Hub), 'PACK' (2nd: Dispatch), 'RETURN' (3rd: Return QC)
  const [scanMode, setScanMode] = useState('ALL');
  
  // Screen 1 Direct Storage Action Mode: 'AUTO_CLASSIFY' (default: API auto-detects Dispatch vs Return and auto-sets both screens), 'REVIEW'
  const [screen1TargetMode, setScreen1TargetMode] = useState('AUTO_CLASSIFY');
  const [sessionDispatchCount, setSessionDispatchCount] = useState(0);
  const [sessionReturnCount, setSessionReturnCount] = useState(0);
  
  // 🔽 Expandable Table Row Accordion State
  const [expandedRowAwb, setExpandedRowAwb] = useState(null);
  
  // ⚡ Hands-Free Continuous Scanning State (Zero-Click Mode)
  const [handsFreeMode, setHandsFreeMode] = useState(() => {
    try {
      const saved = localStorage.getItem('elite_hands_free_mode');
      return saved !== null ? saved === 'true' : true; // Default ON for rapid continuous scanning
    } catch {
      return true;
    }
  });
  const [sessionScanCount, setSessionScanCount] = useState(0);
  const [recentScanFeed, setRecentScanFeed] = useState([]);
  
  const [scanInput, setScanInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [storingActionLoading, setStoringActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Currently Active Scanned Order
  const [activeOrder, setActiveOrder] = useState(null);

  // ── ⚖️ Digital Weighing Scale & Weight Discrepancy Guard ────────────────
  const [parcelWeight, setParcelWeight] = useState('350'); // in grams
  const [returnWeight, setReturnWeight] = useState('');

  // ── 📸 Return Processing & SPF Claim Evidence ──────────────────────────
  const [returnCondition, setReturnCondition] = useState('INTACT');
  const [returnType, setReturnType] = useState('RTO');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnImages, setReturnImages] = useState([]);
  const [claimAmount, setClaimAmount] = useState(0);
  const [claimId, setClaimId] = useState('');
  const [claimNotes, setClaimNotes] = useState('');
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);

  // Return Claim Detail Modal
  const [selectedClaimRecord, setSelectedClaimRecord] = useState(null);
  const [savingClaim, setSavingClaim] = useState(false);

  // ── 📋 Daily Courier Pickup Manifest Generator ──────────────────────────
  const [showManifestModal, setShowManifestModal] = useState(false);
  const [manifestDatePreset, setManifestDatePreset] = useState('TODAY');
  const [manifestStartDate, setManifestStartDate] = useState(() => getLocalDateString());
  const [manifestEndDate, setManifestEndDate] = useState(() => getLocalDateString());
  const [manifestDate, setManifestDate] = useState(() => getLocalDateString());
  const [manifestCourier, setManifestCourier] = useState('ALL');
  const [manifestChannel, setManifestChannel] = useState('ALL');
  const [manifestPendingData, setManifestPendingData] = useState(null);
  const [manifestDriverName, setManifestDriverName] = useState('');
  const [manifestDriverPhone, setManifestDriverPhone] = useState('');
  const [manifestVehicleNumber, setManifestVehicleNumber] = useState('');
  const [manifestTab, setManifestTab] = useState('PENDING'); // 'PENDING' | 'HISTORY'
  const [manifestLoading, setManifestLoading] = useState(false);
  const [pastManifests, setPastManifests] = useState([]);
  const [activePrintManifest, setActivePrintManifest] = useState(null);

  // ── 📊 Bulk Delivery / Return / Dispatch Universal MIS Importer ────────
  const [showBulkDeliveryModal, setShowBulkDeliveryModal] = useState(false);
  const [bulkActionType, setBulkActionType] = useState('DELIVERY'); // 'DELIVERY' | 'RETURN' | 'DISPATCH'
  const [bulkAwbText, setBulkAwbText] = useState('');
  const [bulkDeliveryDate, setBulkDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  // ── 📈 Courier Analytics Dashboard Modal ───────────────────────────────
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [analyticsDatePreset, setAnalyticsDatePreset] = useState('30DAYS');
  const [analyticsStartDate, setAnalyticsStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return getLocalDateString(d);
  });
  const [analyticsEndDate, setAnalyticsEndDate] = useState(() => getLocalDateString());
  const [analyticsCourier, setAnalyticsCourier] = useState('ALL');
  const [analyticsChannel, setAnalyticsChannel] = useState('ALL');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // ── 🏷️ Barcode Thermal Label Printing Modal ────────────────────────────
  const [showBarcodeTagModal, setShowBarcodeTagModal] = useState(false);
  const [barcodeTagData, setBarcodeTagData] = useState({
    sku: 'AC22111_M',
    brand: '',
    itemName: 'Designer Kurta Set',
    size: 'M',
    color: 'Teal Green',
    mrp: 1499,
    barcode: 'MYSC1359190430'
  });

  // ── 🔍 Complete Record Detail Dossier Modal ──────────────────────────────
  const [selectedRecordDetails, setSelectedRecordDetails] = useState(null);
  const [recordDetailsLoading, setRecordDetailsLoading] = useState(false);
  const [fullOrderDetails, setFullOrderDetails] = useState(null);
  const [copiedRecordField, setCopiedRecordField] = useState(null);

  // Persistent Scanned history list & Stats (loaded from MongoDB + localStorage cache)
  const [scanHistory, setScanHistory] = useState(() => {
    try {
      const cached = localStorage.getItem('elite_scan_history_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          const seen = new Set();
          return parsed.filter(item => {
            const k = String(item.awb || '').trim().toUpperCase();
            if (!k || k === 'UNDEFINED' || k === 'NULL' || k.length < 4 || seen.has(k)) return false;
            seen.add(k);
            return true;
          });
        }
      }
      return [];
    } catch {
      return [];
    }
  });
  const [stats, setStats] = useState({
    dispatchedToday: 0,
    deliveredToday: 0,
    returnedToday: 0,
    totalScansToday: 0
  });

  const [historyFilterMode, setHistoryFilterMode] = useState('ALL'); // 'ALL' | 'PACK' | 'DELIVERY' | 'RETURN'
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── 🎯 Multi-Dimension & Date Range Filters for Scan Registers & Operations ──
  const [historyDatePreset, setHistoryDatePreset] = useState('all');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [historyCourier, setHistoryCourier] = useState('ALL');
  const [historyChannel, setHistoryChannel] = useState('ALL');
  const [historyOperationStatus, setHistoryOperationStatus] = useState('ALL');
  const [historyFilters, setHistoryFilters] = useState({});
  const [manifestFilters, setManifestFilters] = useState({});
  const [analyticsFilters, setAnalyticsFilters] = useState({});
  const historyReqSeqRef = useRef(0);

  const historyFilterCategories = React.useMemo(() => [
    {
      id: 'courier',
      name: 'Logistics Partner',
      multi: true,
      options: [
        { value: 'Flipkart', label: 'Flipkart / Ekart' },
        { value: 'Delhivery', label: 'Delhivery' },
        { value: 'Shadowfax', label: 'Shadowfax' },
        { value: 'Blue Dart', label: 'Blue Dart' },
        { value: 'Xpressbees', label: 'Xpressbees' },
        { value: 'Ecom Express', label: 'Ecom Express' },
        { value: 'Amazon', label: 'Amazon Shipping' }
      ]
    },
    {
      id: 'channel',
      name: 'Sales Channel',
      multi: true,
      options: [
        { value: 'Myntra', label: 'Myntra' },
        { value: 'Flipkart', label: 'Flipkart' },
        { value: 'Amazon', label: 'Amazon' },
        { value: 'Meesho', label: 'Meesho' }
      ]
    },
    {
      id: 'status',
      name: 'Operation Status',
      multi: true,
      options: [
        { value: 'DISPATCHED', label: 'Dispatched / Packed' },
        { value: 'RETURN_VERIFIED', label: 'Return Verified / Accepted' },
        { value: 'SCANNED', label: 'Scanned / Recorded' },
        { value: 'SUCCESS', label: 'Success / Verified' },
        { value: 'ALREADY_PACKED', label: 'Already Packed' },
        { value: 'CANCELLED', label: 'Cancelled / Hold' },
        { value: 'DUPLICATE', label: 'Duplicate Scan' },
        { value: 'NOT_FOUND', label: 'Not Found / Error' }
      ]
    }
  ], []);

  // 🎯 Client-side filtered displayedHistory for instant, accurate view updates
  const displayedHistory = React.useMemo(() => {
    return scanHistory.filter((item) => {
      // 1. Mode check
      const upperAwb = String(item.awb || '').toUpperCase();
      const isReturnRow = item.mode === 'RETURN' ||
        item.mode === 'RTO' ||
        item.isReturn ||
        upperAwb.startsWith('MYSR') ||
        upperAwb.startsWith('RPC') ||
        upperAwb.startsWith('RP') ||
        upperAwb.startsWith('FMPR') ||
        upperAwb.startsWith('RET');

      if (scanMode === 'PACK') {
        if (isReturnRow || (item.mode && item.mode !== 'PACK' && item.mode !== 'DISPATCH')) return false;
      } else if (scanMode === 'RETURN') {
        if (!isReturnRow) return false;
      }

      // 2. Date Range Filter
      if (historyStartDate || historyEndDate) {
        const rawDate = item.createdAt || item.updatedAt || item.date;
        if (rawDate) {
          const itemTime = new Date(rawDate).getTime();
          if (!isNaN(itemTime)) {
            if (historyStartDate) {
              const startObj = new Date(historyStartDate);
              startObj.setHours(0, 0, 0, 0);
              if (itemTime < startObj.getTime()) return false;
            }
            if (historyEndDate) {
              const endObj = new Date(historyEndDate);
              endObj.setHours(23, 59, 59, 999);
              if (itemTime > endObj.getTime()) return false;
            }
          }
        }
      }

      // 3. Courier Filter
      const activeCouriers = historyFilters.courier || [];
      if (activeCouriers.length > 0) {
        const itemCourier = String(item.courier || '').toLowerCase();
        const matchesCourier = activeCouriers.some(c => itemCourier.includes(String(c).toLowerCase()));
        if (!matchesCourier) return false;
      }

      // 4. Channel Filter
      const activeChannels = historyFilters.channel || [];
      if (activeChannels.length > 0) {
        const itemChannel = String(item.channel || '').toLowerCase();
        const matchesChannel = activeChannels.some(ch => itemChannel.includes(String(ch).toLowerCase()));
        if (!matchesChannel) return false;
      }

      // 5. Status Filter
      const activeStatuses = historyFilters.status || [];
      if (activeStatuses.length > 0) {
        const itemStatus = String(item.status || '').toLowerCase();
        const matchesStatus = activeStatuses.some(st => itemStatus.includes(String(st).toLowerCase()));
        if (!matchesStatus) return false;
      }

      // 6. Search Query Filter
      if (historySearchQuery && historySearchQuery.trim()) {
        const q = historySearchQuery.trim().toLowerCase();
        const awb = String(item.awb || '').toLowerCase();
        const pkg = String(item.shippingPackageCode || '').toLowerCase();
        const ord = String(item.orderCode || '').toLowerCase();
        const sku = String(item.sku || '').toLowerCase();
        const name = String(item.itemName || '').toLowerCase();
        const courier = String(item.courier || '').toLowerCase();
        const cust = String(item.customerName || '').toLowerCase();
        const city = String(item.city || '').toLowerCase();
        if (!awb.includes(q) && !pkg.includes(q) && !ord.includes(q) && !sku.includes(q) && !name.includes(q) && !courier.includes(q) && !cust.includes(q) && !city.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [scanHistory, scanMode, historyStartDate, historyEndDate, historyFilters, historySearchQuery]);

  const manifestFilterCategories = React.useMemo(() => [
    {
      id: 'courier',
      name: 'Logistics Partner',
      multi: true,
      options: [
        { value: 'Flipkart Logistics / Ekart', label: 'Flipkart / Ekart' },
        { value: 'Delhivery', label: 'Delhivery' },
        { value: 'Shadowfax', label: 'Shadowfax' },
        { value: 'Blue Dart', label: 'Blue Dart' },
        { value: 'Xpressbees', label: 'Xpressbees' },
        { value: 'Ecom Express', label: 'Ecom Express' },
        { value: 'Amazon Shipping', label: 'Amazon Shipping' }
      ]
    },
    {
      id: 'channel',
      name: 'Marketplace',
      multi: true,
      options: [
        { value: 'Myntra', label: 'Myntra' },
        { value: 'Flipkart', label: 'Flipkart' },
        { value: 'Amazon', label: 'Amazon' },
        { value: 'Meesho', label: 'Meesho' }
      ]
    }
  ], []);

  const analyticsFilterCategories = React.useMemo(() => [
    {
      id: 'courier',
      name: 'Logistics Partner',
      multi: true,
      options: [
        { value: 'Flipkart Logistics / Ekart', label: 'Flipkart Logistics / Ekart' },
        { value: 'Delhivery', label: 'Delhivery' },
        { value: 'Shadowfax', label: 'Shadowfax' },
        { value: 'Blue Dart', label: 'Blue Dart' },
        { value: 'Xpressbees', label: 'Xpressbees' },
        { value: 'Ecom Express', label: 'Ecom Express' },
        { value: 'Amazon Shipping', label: 'Amazon Shipping' }
      ]
    },
    {
      id: 'channel',
      name: 'Marketplace',
      multi: true,
      options: [
        { value: 'Myntra', label: 'Myntra' },
        { value: 'Flipkart', label: 'Flipkart' },
        { value: 'Amazon', label: 'Amazon' },
        { value: 'Meesho', label: 'Meesho' }
      ]
    }
  ], []);

  const [hardwareDetected, setHardwareDetected] = useState(false);
  const inputRef = useRef(null);
  const autoSubmitTimerRef = useRef(null);
  const isScanProcessingRef = useRef(false);

  // Focus input automatically
  const focusInput = () => {
    if (inputRef.current) inputRef.current.focus();
  };

  const handleUpdateTargetMode = (mode) => {
    setScreen1TargetMode(mode);
    try {
      localStorage.setItem('elite_scan1_target_mode', mode);
    } catch (e) {}
  };

  const handleToggleHandsFree = (val) => {
    setHandsFreeMode(val);
    try {
      localStorage.setItem('elite_hands_free_mode', String(val));
    } catch (e) {}
  };

  const fetchHistoryAndStats = async (mode = scanMode, search = historySearchQuery, overrideFilters = {}) => {
    const currentSeq = ++historyReqSeqRef.current;
    setHistoryLoading(true);
    try {
      const activeStartDate = overrideFilters.startDate !== undefined ? overrideFilters.startDate : historyStartDate;
      const activeEndDate = overrideFilters.endDate !== undefined ? overrideFilters.endDate : historyEndDate;
      const activeCourier = overrideFilters.courier !== undefined ? overrideFilters.courier : (historyFilters.courier || []).join(',');
      const activeChannel = overrideFilters.channel !== undefined ? overrideFilters.channel : (historyFilters.channel || []).join(',');
      const activeStatus = overrideFilters.status !== undefined ? overrideFilters.status : (historyFilters.status || []).join(',');

      const res = await api.getScanPackHistory({
        mode: mode !== 'ALL' ? mode : undefined,
        search: search ? search.trim() : undefined,
        startDate: activeStartDate || undefined,
        endDate: activeEndDate || undefined,
        courier: activeCourier && activeCourier !== 'ALL' ? activeCourier : undefined,
        channel: activeChannel && activeChannel !== 'ALL' ? activeChannel : undefined,
        status: activeStatus && activeStatus !== 'ALL' ? activeStatus : undefined,
        limit: 100
      });

      if (currentSeq !== historyReqSeqRef.current) return;

      if (res && res.success) {
        if (res.stats) setStats(res.stats);
        if (Array.isArray(res.history)) {
          const seen = new Set();
          const uniqueList = [];
          for (const item of res.history) {
            const k = String(item.awb || '').trim().toUpperCase();
            if (!k || k === 'UNDEFINED' || k === 'NULL' || k.length < 4 || seen.has(k)) continue;
            seen.add(k);
            uniqueList.push({ ...item, awb: k });
          }
          setScanHistory(uniqueList);
          try {
            if (uniqueList.length === 0) {
              localStorage.removeItem('elite_scan_history_cache');
            } else {
              localStorage.setItem('elite_scan_history_cache', JSON.stringify(uniqueList.slice(0, 100)));
            }
          } catch (e) {
            // ignore localStorage quota errors
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch scan pack history & stats:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleResetHistoryFilters = () => {
    setHistoryDatePreset('all');
    setHistoryStartDate('');
    setHistoryEndDate('');
    setHistoryFilters({});
    setHistoryCourier('ALL');
    setHistoryChannel('ALL');
    setHistoryOperationStatus('ALL');
    setHistorySearchQuery('');
    fetchHistoryAndStats(scanMode, '', {
      startDate: '',
      endDate: '',
      courier: '',
      channel: '',
      status: ''
    });
  };

  const fetchStats = () => fetchHistoryAndStats(scanMode, historySearchQuery);

  const handleClearHistory = async () => {
    if (!window.confirm('Clear all scan history and start a fresh scanning session?')) return;
    try {
      if (api.clearScanHistory) {
        await api.clearScanHistory(0);
      }
    } catch (err) {
      console.warn('Failed to clear scan history on server:', err);
    }
    try {
      localStorage.removeItem('elite_scan_history_cache');
    } catch (e) {}
    setScanHistory([]);
    setExpandedRowAwb(null);
    setActiveOrder(null);
    setSessionDispatchCount(0);
    setSessionReturnCount(0);
    setErrorMsg('');
    setSuccessMsg('✨ Session cleared! Ready to scan fresh items.');
    setStats({
      dispatchedToday: 0,
      deliveredToday: 0,
      returnedToday: 0,
      totalScansToday: 0
    });
    focusInput();
  };

  const recordScanToHistory = (entry) => {
    if (!entry || !entry.awb) return;
    const cleanAwb = String(entry.awb).trim().toUpperCase();
    if (!cleanAwb || cleanAwb === 'UNDEFINED' || cleanAwb === 'NULL' || cleanAwb.length < 4) return;

    const normalizedEntry = { ...entry, awb: cleanAwb };

    setScanHistory(prev => {
      // Strictly enforce UNIQUE AWB code - removes any past row matching this awb
      const filtered = prev.filter(p => {
        const pAwb = String(p.awb || '').trim().toUpperCase();
        return pAwb !== cleanAwb && (p.id || p._id) !== (entry.id || entry._id);
      });
      const updated = [normalizedEntry, ...filtered].slice(0, 150);
      try {
        localStorage.setItem('elite_scan_history_cache', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    // Also post to backend ScanLog API in the background with complete data fields
    api.logScan({
      awb: entry.awb,
      shippingPackageCode: entry.shippingPackageCode || '',
      orderCode: entry.orderCode || '',
      sku: entry.sku || '',
      itemName: entry.itemName || '',
      brand: entry.brand || '',
      productImage: entry.productImage || '',
      channel: entry.channel || '',
      customerName: entry.customerName || '',
      city: entry.city || '',
      size: entry.size || '',
      color: entry.color || '',
      courier: entry.courier || '',
      mode: entry.mode || 'PACK',
      status: entry.status || 'SCANNED',
      weightGrams: entry.weightGrams || 0,
      price: entry.price || 0,
      paymentMode: entry.paymentMode || 'PREPAID',
      paymentStatus: entry.paymentStatus || 'PAID',
      codAmount: entry.codAmount || 0,
      notes: entry.notes || ''
    }).catch(e => console.warn('ScanLog background write warning:', e));
  };

  useEffect(() => {
    focusInput();
    fetchHistoryAndStats();
  }, [scanMode]);

  // Hook up hardware barcode sniffer (e.g. USB or wireless laser scanner)
  useHardwareBarcodeSniffer((event) => {
    if (event?.code) {
      setHardwareDetected(true);
      handleProcessScan(event.code, 'Hardware Laser Scanner');
    }
  });

  // ⚡ Debounce auto-submit for rapid barcode gun scanning (Zero-Click trigger)
  // Even if scanner does NOT emit 'Enter', 220ms after typing/scanning completes, auto-process!
  useEffect(() => {
    if (!handsFreeMode) return;
    const trimmed = (scanInput || '').trim();
    if (trimmed.length >= 7 && !loading && !isScanProcessingRef.current) {
      if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = setTimeout(() => {
        if (!isScanProcessingRef.current && (scanInput || '').trim().length >= 7) {
          handleProcessScan(scanInput.trim(), 'Hands-Free Rapid Auto-Scan');
        }
      }, 220);
    }
    return () => {
      if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    };
  }, [scanInput, handsFreeMode, loading]);

  // Keep input focused automatically so operator never needs mouse while standing at packing table
  useEffect(() => {
    if (!handsFreeMode) return;
    const handleDocumentClick = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (['input', 'textarea', 'button', 'select', 'a'].includes(tag)) return;
      if (e.target?.closest('.modal-backdrop') || e.target?.closest('.glass-panel-modal')) return;
      focusInput();
    };

    window.addEventListener('click', handleDocumentClick);
    return () => window.removeEventListener('click', handleDocumentClick);
  }, [handsFreeMode]);

  // Play audio feedback for fast factory floor verification
  const playAudioCue = (type = 'success') => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === 'step') {
        osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else {
        // High alert buzzer for wrong item mismatch or suspicious empty box
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.setValueAtTime(100, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
      }
    } catch (err) {
      // AudioContext may be restricted by browser policy if no interaction
    }
  };

  // ── 🚚 Mandatory Action 1: Store in Delivery & Auto-Update ─────────────────
  const handleStoreDelivery = async (order) => {
    if (!order || !order.awb) return;
    setStoringActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const nowIso = new Date().toISOString();
      const res = await api.markAwbDelivered({ 
        awb: order.awb,
        deliveryDate: nowIso 
      });

      if (res && res.success) {
        playAudioCue('success');
        setSuccessMsg(`✅ [DELIVERED] AWB ${order.awb} successfully STORED IN DELIVERY! Delivery timestamp & payment marked PAID.`);
        
        // Auto-update activeOrder in state
        setActiveOrder(prev => prev ? {
          ...prev,
          isDelivered: true,
          deliveryTime: nowIso,
          orderClassification: 'DELIVERED',
          orderClassificationLabel: 'DELIVERED TO CUSTOMER',
          paymentStatus: 'PAID',
          paymentStatusLabel: 'Payment Done (Delivered & Settled)',
          currentStage: 'DELIVERED'
        } : null);

        // Record scan log
        const deliveryEntry = {
          id: Date.now(),
          awb: order.awb,
          shippingPackageCode: order.shippingPackageCode || '',
          orderCode: order.displayOrderCode,
          sku: order.itemSKUCode || order.sku,
          itemName: order.itemName || '',
          brand: order.brand || '',
          productImage: order.productImage || '',
          channel: order.channel || '',
          customerName: order.customerName || '',
          city: order.city || '',
          size: order.size || '',
          color: order.color || '',
          courier: order.courier,
          weightGrams: order.weightGrams || 0,
          price: order.price || 0,
          paymentMode: order.paymentMode || 'PREPAID',
          paymentStatus: 'PAID',
          codAmount: order.codAmount || 0,
          mode: 'DELIVERY',
          status: 'DELIVERED',
          time: new Date().toLocaleTimeString('en-IN'),
          date: new Date().toLocaleDateString('en-IN')
        };
        recordScanToHistory(deliveryEntry);
        setSessionScanCount(c => c + 1);
        setRecentScanFeed(prev => [{
          id: Date.now(),
          awb: order.awb,
          orderCode: order.displayOrderCode,
          sku: order.itemSKUCode || order.sku,
          courier: order.courier,
          status: 'DELIVERED',
          label: 'DELIVERED (PAID)',
          time: new Date().toLocaleTimeString('en-IN')
        }, ...prev.slice(0, 4)]);
        fetchStats();
        fetchHistoryAndStats(scanMode);
      } else {
        throw new Error(res?.error || 'Failed to mark as delivered');
      }
    } catch (err) {
      playAudioCue('error');
      setErrorMsg(`Failed to store delivery: ${err.message}`);
      setRecentScanFeed(prev => [{
        id: Date.now(),
        awb: order.awb,
        status: 'ERROR',
        label: 'DELIVERY FAILED',
        error: err.message,
        time: new Date().toLocaleTimeString('en-IN')
      }, ...prev.slice(0, 4)]);
    } finally {
      setStoringActionLoading(false);
    }
  };

  // ── 🔄 Mandatory Action 2: Store in Return / RTO & Auto-Update ────────────
  const handleStoreReturn = async (order, rType = 'RTO', condition = 'INTACT') => {
    if (!order || !order.awb) return;
    setStoringActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const numericReturnWeight = Number(returnWeight) || order.weightGrams || 0;
      const res = await api.processAwbReturn({
        awb: order.awb,
        displayOrderId: order.displayOrderCode,
        sku: order.itemSKUCode || order.sku,
        returnType: rType || (order.orderClassification === 'RETURN_RTO' ? 'RTO' : 'CUSTOMER_RETURN'),
        condition: condition || 'INTACT',
        notes: 'Direct Return Inward from Screen 1 Operations',
        quantity: 1,
        images: returnImages,
        weightGrams: numericReturnWeight
      });

      if (res && res.success) {
        playAudioCue('success');
        setSuccessMsg(`🔄 [RETURNED] AWB ${order.awb} successfully STORED IN RETURN / RTO! ${res.stockUpdated ? 'Inventory stock auto-incremented (+1).' : ''}`);
        
        const nowIso = new Date().toISOString();
        setActiveOrder(prev => prev ? {
          ...prev,
          isReturn: true,
          returnDate: nowIso,
          orderClassification: rType === 'RTO' ? 'RETURN_RTO' : 'RETURN_CUSTOMER',
          orderClassificationLabel: rType === 'RTO' ? 'COURIER RTO (UNDELIVERED RETURN)' : 'CUSTOMER RETURN (CIR)',
          paymentStatus: prev.paymentMode === 'COD' ? 'NOT_COLLECTED' : 'REFUND_PENDING',
          paymentStatusLabel: prev.paymentMode === 'COD' ? 'Not Collected (RTO)' : 'Refund Under Process',
          currentStage: 'RETURNED'
        } : null);

        const returnEntry = {
          id: Date.now(),
          awb: order.awb,
          shippingPackageCode: order.shippingPackageCode || '',
          orderCode: order.displayOrderCode,
          sku: order.itemSKUCode || order.sku,
          itemName: order.itemName || '',
          brand: order.brand || '',
          productImage: order.productImage || '',
          channel: order.channel || '',
          customerName: order.customerName || '',
          city: order.city || '',
          size: order.size || '',
          color: order.color || '',
          courier: order.courier,
          weightGrams: numericReturnWeight,
          price: order.price || 0,
          paymentMode: order.paymentMode || 'PREPAID',
          paymentStatus: order.paymentMode === 'COD' ? 'NOT_COLLECTED' : 'REFUND_PENDING',
          codAmount: 0,
          mode: 'RETURN',
          status: condition === 'INTACT' ? 'RESTOCKED (+1)' : 'RETURN_VERIFIED',
          hasPhotos: returnImages.length > 0,
          returnDoc: res.data,
          time: new Date().toLocaleTimeString('en-IN'),
          date: new Date().toLocaleDateString('en-IN')
        };
        recordScanToHistory(returnEntry);
        setSessionScanCount(c => c + 1);
        setRecentScanFeed(prev => [{
          id: Date.now(),
          awb: order.awb,
          orderCode: order.displayOrderCode,
          sku: order.itemSKUCode || order.sku,
          courier: order.courier,
          status: 'RETURN',
          label: 'RETURN / RTO (+1 STOCK)',
          time: new Date().toLocaleTimeString('en-IN')
        }, ...prev.slice(0, 4)]);
        fetchStats();
        fetchHistoryAndStats(scanMode);
      } else {
        throw new Error(res?.error || 'Failed to record return');
      }
    } catch (err) {
      playAudioCue('error');
      setErrorMsg(`Failed to store return: ${err.message}`);
      setRecentScanFeed(prev => [{
        id: Date.now(),
        awb: order.awb,
        status: 'ERROR',
        label: 'RETURN FAILED',
        error: err.message,
        time: new Date().toLocaleTimeString('en-IN')
      }, ...prev.slice(0, 4)]);
    } finally {
      setStoringActionLoading(false);
    }
  };

  // ── 📦 Mandatory Action 3: Store in Dispatch & Auto-Update ───────────────
  const handleStoreDispatch = async (order) => {
    if (!order || !order.awb) return;
    const cleanAwb = String(order.awb).trim().toUpperCase();
    const isReturnAwb = order.isReturn ||
      cleanAwb.startsWith('MYSR') ||
      cleanAwb.startsWith('RPC') ||
      cleanAwb.startsWith('RP') ||
      cleanAwb.startsWith('RET') ||
      cleanAwb.startsWith('RMA') ||
      cleanAwb.startsWith('FMPR') ||
      cleanAwb.startsWith('RTO');

    if (isReturnAwb) {
      return await handleStoreReturn(order, order.orderClassification === 'RETURN_RTO' ? 'RTO' : 'CUSTOMER_RETURN');
    }

    setStoringActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const numericWeight = Number(parcelWeight) || order.weightGrams || 0;
      const res = await api.packAwbOrder({
        awb: order.awb,
        displayOrderCode: order.displayOrderCode,
        sku: order.itemSKUCode || order.sku,
        courier: order.courier,
        weightGrams: numericWeight
      });

      if (res && res.success) {
        playAudioCue('success');
        setSuccessMsg(`📦 [DISPATCHED] AWB ${order.awb} successfully STORED IN DISPATCH! Auto-dated and weight stamped (${numericWeight > 0 ? `${numericWeight}g` : 'Standard Weight'}).`);
        
        const nowIso = new Date().toISOString();
        setActiveOrder(prev => prev ? {
          ...prev,
          dispatchDate: nowIso,
          orderClassification: 'IN_TRANSIT',
          orderClassificationLabel: 'IN-TRANSIT (DISPATCHED)',
          currentStage: 'IN_TRANSIT'
        } : null);

        const dispatchEntry = {
          id: Date.now(),
          awb: order.awb,
          shippingPackageCode: order.shippingPackageCode || '',
          orderCode: order.displayOrderCode,
          sku: order.itemSKUCode || order.sku,
          itemName: order.itemName || '',
          brand: order.brand || '',
          productImage: order.productImage || '',
          channel: order.channel || '',
          customerName: order.customerName || '',
          city: order.city || '',
          size: order.size || '',
          color: order.color || '',
          courier: order.courier,
          weightGrams: numericWeight,
          price: order.price || 0,
          paymentMode: order.paymentMode || 'PREPAID',
          paymentStatus: order.paymentStatus || 'PAID',
          codAmount: order.codAmount || 0,
          mode: 'PACK',
          status: 'DISPATCHED',
          time: new Date().toLocaleTimeString('en-IN'),
          date: new Date().toLocaleDateString('en-IN')
        };
        recordScanToHistory(dispatchEntry);
        setSessionScanCount(c => c + 1);
        setRecentScanFeed(prev => [{
          id: Date.now(),
          awb: order.awb,
          orderCode: order.displayOrderCode,
          sku: order.itemSKUCode || order.sku,
          courier: order.courier,
          status: 'DISPATCH',
          label: 'DISPATCHED',
          time: new Date().toLocaleTimeString('en-IN')
        }, ...prev.slice(0, 4)]);
        fetchStats();
        fetchHistoryAndStats(scanMode);
      } else {
        throw new Error(res?.error || 'Failed to dispatch order');
      }
    } catch (err) {
      playAudioCue('error');
      setErrorMsg(`Failed to store dispatch: ${err.message}`);
      setRecentScanFeed(prev => [{
        id: Date.now(),
        awb: order.awb,
        status: 'ERROR',
        label: 'DISPATCH FAILED',
        error: err.message,
        time: new Date().toLocaleTimeString('en-IN')
      }, ...prev.slice(0, 4)]);
    } finally {
      setStoringActionLoading(false);
    }
  };

  // ── Main Processing Pipeline (Single AWB Direct Scan) ──────────────────────
  const handleProcessScan = async (codeToProcess, source = 'Manual Input') => {
    const trimmed = (codeToProcess || '').trim();
    if (!trimmed || isScanProcessingRef.current) return;

    if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    isScanProcessingRef.current = true;

    setErrorMsg('');
    setSuccessMsg('');

    // ──────────────────────────────────────────────────────────────────────────
    // Direct AWB Scan Processing Pipeline
    // Screen 1: ALL (All Data) | Screen 2: PACK (Dispatch) | Screen 3: RETURN (Return Only)
    // ──────────────────────────────────────────────────────────────────────────
    setLoading(true);
    try {
      const lookupRes = await api.lookupAwb(trimmed);
      if (!lookupRes || !lookupRes.success) {
        throw new Error(lookupRes?.error || 'Failed to lookup AWB code');
      }

      const orderData = lookupRes.data || {};
      const upperTrimmed = trimmed.toUpperCase();
      const isReturnPrefix = upperTrimmed.startsWith('MYSR') ||
        upperTrimmed.startsWith('RPC') ||
        upperTrimmed.startsWith('RP') ||
        upperTrimmed.startsWith('RET') ||
        upperTrimmed.startsWith('RMA') ||
        upperTrimmed.startsWith('FMPR') ||
        upperTrimmed.startsWith('RTO');

      if (isReturnPrefix) {
        orderData.isReturn = true;
        if (!orderData.orderClassification || orderData.orderClassification === 'NEW_DISPATCH') {
          orderData.orderClassification = upperTrimmed.startsWith('RTO') ? 'RETURN_RTO' : 'RETURN_CUSTOMER';
          orderData.orderClassificationLabel = upperTrimmed.startsWith('RTO') ? 'COURIER RTO (UNDELIVERED RETURN)' : 'CUSTOMER RETURN (CIR)';
        }
      }

      // ── SCREEN 3: RETURN / RTO INWARD (STRICT RETURN CHECK) ──────────────────
      if (scanMode === 'RETURN') {
        if (!orderData.isReturn) {
          // Auto-route forward parcels to Screen 2 (Dispatch) seamlessly
          await handleStoreDispatch(orderData);
          setSessionDispatchCount(c => c + 1);
          playAudioCue('success');
          setSuccessMsg(`📦 [AUTO-ROUTED TO DISPATCH] AWB "${trimmed}" is a Forward Order! Automatically redirected and packed into Screen 2 (Dispatch).`);
          return;
        }

        // Authentic Return / RTO parcel -> Show data and open Return QC form
        setActiveOrder(orderData);
        setClaimAmount(orderData.price || 0);
        setBarcodeTagData({
          sku: orderData.itemSKUCode,
          brand: orderData.brand || '',
          itemName: orderData.itemName,
          size: orderData.size || 'M',
          color: orderData.color || '',
          mrp: orderData.mrp || 1499,
          barcode: trimmed
        });
        playAudioCue('success');
        setSuccessMsg(`🔄 Return / RTO parcel verified: Order #${orderData.displayOrderCode} (${orderData.itemSKUCode}). Select condition & confirm inward below.`);

        // Record verified return immediately to Screen 3 & All Data table
        const returnVerifyEntry = {
          id: Date.now(),
          awb: trimmed,
          shippingPackageCode: orderData.shippingPackageCode || '',
          orderCode: orderData.displayOrderCode,
          sku: orderData.itemSKUCode,
          itemName: orderData.itemName || '',
          brand: orderData.brand || '',
          productImage: orderData.productImage || '',
          channel: orderData.channel || '',
          customerName: orderData.customerName || '',
          city: orderData.city || '',
          size: orderData.size || '',
          color: orderData.color || '',
          courier: orderData.courier,
          weightGrams: Number(returnWeight) || orderData.weightGrams || 0,
          price: orderData.price || 0,
          paymentMode: orderData.paymentMode || 'PREPAID',
          paymentStatus: orderData.paymentStatus || (orderData.paymentMode === 'COD' ? 'NOT_COLLECTED' : 'REFUND_PENDING'),
          codAmount: 0,
          mode: 'RETURN',
          status: 'RETURN_VERIFIED',
          time: new Date().toLocaleTimeString('en-IN'),
          date: new Date().toLocaleDateString('en-IN')
        };
        recordScanToHistory(returnVerifyEntry);
        fetchStats();
        return;
      }

      // ── SCREEN 2: DISPATCH (PACK & SHIP) ────────────────────────────────────
      if (scanMode === 'PACK') {
        if (orderData.isReturn) {
          // Auto-route return parcels to Screen 3 (Return) seamlessly
          await handleStoreReturn(orderData, orderData.orderClassification === 'RETURN_RTO' ? 'RTO' : 'CUSTOMER_RETURN');
          setSessionReturnCount(c => c + 1);
          playAudioCue('success');
          setSuccessMsg(`🔄 [AUTO-ROUTED TO RETURN] AWB "${trimmed}" is a ${orderData.orderClassificationLabel}! Automatically redirected and stored into Screen 3 (Return QC).`);
          return;
        }

        setActiveOrder(orderData);
        setClaimAmount(orderData.price || 0);
        setBarcodeTagData({
          sku: orderData.itemSKUCode,
          brand: orderData.brand || '',
          itemName: orderData.itemName,
          size: orderData.size || 'M',
          color: orderData.color || '',
          mrp: orderData.mrp || 1499,
          barcode: trimmed
        });

        const numericWeight = Number(parcelWeight) || 0;
        await api.packAwbOrder({
          awb: trimmed,
          displayOrderCode: orderData.displayOrderCode,
          sku: orderData.itemSKUCode,
          courier: orderData.courier,
          weightGrams: numericWeight
        });

        playAudioCue('success');
        setSuccessMsg(`✅ [DISPATCHED] AWB ${trimmed} verified & packed! Dispatched date automatically stamped (${numericWeight > 0 ? `${numericWeight}g` : 'Standard Weight'}).`);
        
        const historyEntry = {
          id: Date.now(),
          awb: trimmed,
          shippingPackageCode: orderData.shippingPackageCode || '',
          orderCode: orderData.displayOrderCode,
          sku: orderData.itemSKUCode,
          itemName: orderData.itemName || '',
          brand: orderData.brand || '',
          productImage: orderData.productImage || '',
          channel: orderData.channel || '',
          customerName: orderData.customerName || '',
          city: orderData.city || '',
          size: orderData.size || '',
          color: orderData.color || '',
          courier: orderData.courier,
          weightGrams: numericWeight,
          price: orderData.price || 0,
          paymentMode: orderData.paymentMode || 'PREPAID',
          paymentStatus: orderData.paymentStatus || 'PAID',
          codAmount: orderData.codAmount || 0,
          mode: 'PACK',
          status: 'DISPATCHED',
          time: new Date().toLocaleTimeString('en-IN'),
          date: new Date().toLocaleDateString('en-IN')
        };
        recordScanToHistory(historyEntry);
        setActiveOrder(null);
        fetchStats();
        return;
      }

      // ── SCREEN 1: DATA COLLECTION HUB & INTELLIGENT AUTO-ROUTER ─────────────
      // One-by-one scan: API determines whether AWB is Dispatch or Return,
      // and automatically sets both Screen 2 (Dispatch) and Screen 3 (Return)!
      setActiveOrder(orderData);
      setClaimAmount(orderData.price || 0);
      setBarcodeTagData({
        sku: orderData.itemSKUCode,
        brand: orderData.brand || '',
        itemName: orderData.itemName,
        size: orderData.size || 'M',
        color: orderData.color || '',
        mrp: orderData.mrp || 1499,
        barcode: trimmed
      });

      // ⚡ Smart Auto-Routing Pipeline (Default behavior)
      if (screen1TargetMode === 'AUTO_CLASSIFY') {
        const isReturnOrder = orderData.isReturn ||
          upperTrimmed.startsWith('MYSR') ||
          upperTrimmed.startsWith('RPC') ||
          upperTrimmed.startsWith('RP') ||
          upperTrimmed.startsWith('RET') ||
          upperTrimmed.startsWith('RMA') ||
          upperTrimmed.startsWith('FMPR') ||
          upperTrimmed.startsWith('RTO');

        if (isReturnOrder) {
          // AUTO-SET TO SCREEN 3 (RETURN QC / INWARD)
          await handleStoreReturn(orderData, orderData.orderClassification === 'RETURN_RTO' ? 'RTO' : 'CUSTOMER_RETURN');
          setSessionReturnCount(c => c + 1);
          setExpandedRowAwb(trimmed.toUpperCase());
          setActiveOrder(null);
          playAudioCue('success');
          setSuccessMsg(`🔄 [AUTO-SET TO RETURN SCREEN] AWB "${trimmed}" identified as ${orderData.orderClassificationLabel || 'Return Parcel'} & automatically stored into Screen 3 (Return QC)!`);
          return;
        } else {
          // AUTO-SET TO SCREEN 2 (DISPATCH / PACK)
          await handleStoreDispatch(orderData);
          setSessionDispatchCount(c => c + 1);
          setExpandedRowAwb(trimmed.toUpperCase());
          setActiveOrder(null);
          playAudioCue('success');
          setSuccessMsg(`📦 [AUTO-SET TO DISPATCH SCREEN] AWB "${trimmed}" identified as Forward Order & automatically packed to Screen 2 (Dispatch)!`);
          return;
        }
      }

      // Manual Quick-Store overrides if explicitly switched
      if (screen1TargetMode === 'AUTO_DELIVERY') {
        await handleStoreDelivery(orderData);
        return;
      }
      if (screen1TargetMode === 'AUTO_RETURN') {
        await handleStoreReturn(orderData, orderData.orderClassification === 'RETURN_RTO' ? 'RTO' : 'CUSTOMER_RETURN');
        return;
      }
      if (screen1TargetMode === 'AUTO_DISPATCH') {
        await handleStoreDispatch(orderData);
        return;
      }

      playAudioCue('success');
      setSuccessMsg(`🔍 [${orderData.orderClassificationLabel}] Order #${orderData.displayOrderCode} loaded. Choose Store in Delivery, Return, or Dispatch below.`);

      const historyEntry = {
        id: Date.now(),
        awb: trimmed,
        shippingPackageCode: orderData.shippingPackageCode || '',
        orderCode: orderData.displayOrderCode,
        sku: orderData.itemSKUCode,
        itemName: orderData.itemName || '',
        brand: orderData.brand || '',
        productImage: orderData.productImage || '',
        channel: orderData.channel || '',
        customerName: orderData.customerName || '',
        city: orderData.city || '',
        size: orderData.size || '',
        color: orderData.color || '',
        courier: orderData.courier,
        weightGrams: orderData.weightGrams || 0,
        price: orderData.price || 0,
        paymentMode: orderData.paymentMode || 'PREPAID',
        paymentStatus: orderData.paymentStatus || 'PAID',
        codAmount: orderData.codAmount || 0,
        mode: orderData.isReturn ? 'RETURN' : 'PACK',
        status: orderData.isReturn ? 'RETURN_VERIFIED' : (orderData.currentStage || orderData.orderClassification || 'LOOKUP_VERIFIED'),
        time: new Date().toLocaleTimeString('en-IN'),
        date: new Date().toLocaleDateString('en-IN')
      };
      recordScanToHistory(historyEntry);
      fetchStats();

    } catch (err) {
      playAudioCue('error');
      setErrorMsg(err.message || 'Error processing AWB scan');
      setRecentScanFeed(prev => [{
        id: Date.now(),
        awb: trimmed,
        status: 'ERROR',
        label: 'SCAN FAILED',
        error: err.message,
        time: new Date().toLocaleTimeString('en-IN')
      }, ...prev.slice(0, 4)]);
    } finally {
      setLoading(false);
      isScanProcessingRef.current = false;
      setScanInput('');
      focusInput();
    }
  };

  // ── 📸 Webcam Capture Helpers ─────────────────────────────────────────────
  const startCamera = async () => {
    setShowCameraModal(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      alert('Unable to access station camera: ' + err.message);
      setShowCameraModal(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCameraModal(false);
  };

  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setReturnImages(prev => [...prev, dataUrl]);
    stopCamera();
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setReturnImages(prev => [...prev, ev.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  // ── Submit Return Process with Photos & SPF Claims ────────────────────────
  const handleConfirmReturn = async () => {
    if (!activeOrder?.awb) return;

    setLoading(true);
    try {
      const isDamagedOrWrong = returnCondition === 'DAMAGED' || returnCondition === 'WRONG_ITEM';
      const numericReturnWeight = Number(returnWeight) || 0;

      const res = await api.processAwbReturn({
        awb: activeOrder.awb,
        displayOrderId: activeOrder.displayOrderCode,
        sku: activeOrder.itemSKUCode,
        returnType,
        condition: returnCondition,
        notes: returnNotes,
        quantity: 1,
        images: returnImages,
        claimStatus: isDamagedOrWrong ? 'CLAIM_PENDING' : 'NOT_APPLICABLE',
        claimAmount: isDamagedOrWrong ? (Number(claimAmount) || activeOrder.price || 0) : 0,
        claimId: claimId || '',
        claimNotes: claimNotes || '',
        weightGrams: numericReturnWeight
      });

      if (res && res.success) {
        playAudioCue('success');
        setSuccessMsg(`🔄 Return processed for ${activeOrder.awb}! ${res.stockUpdated ? 'Stock automatically incremented (+1).' : ''}`);
        
        const historyEntry = {
          id: Date.now(),
          awb: activeOrder.awb,
          shippingPackageCode: activeOrder.shippingPackageCode || '',
          orderCode: activeOrder.displayOrderCode,
          sku: activeOrder.itemSKUCode,
          itemName: activeOrder.itemName || '',
          brand: activeOrder.brand || '',
          channel: activeOrder.channel || '',
          customerName: activeOrder.customerName || '',
          city: activeOrder.city || '',
          size: activeOrder.size || '',
          color: activeOrder.color || '',
          courier: activeOrder.courier,
          mode: 'RETURN',
          status: returnCondition === 'INTACT' ? 'RESTOCKED (+1)' : 'RETURN_DISPUTE',
          hasPhotos: returnImages.length > 0,
          weightGrams: numericReturnWeight,
          price: activeOrder.price || 0,
          paymentMode: activeOrder.paymentMode || 'PREPAID',
          paymentStatus: activeOrder.paymentStatus || (activeOrder.isCod ? 'NOT_COLLECTED' : 'REFUND_PENDING'),
          codAmount: 0,
          returnDoc: res.data,
          time: new Date().toLocaleTimeString('en-IN'),
          date: new Date().toLocaleDateString('en-IN')
        };
        recordScanToHistory(historyEntry);
        setActiveOrder(null);
        setReturnNotes('');
        setReturnImages([]);
        setClaimId('');
        setClaimNotes('');
        setReturnWeight('');
        fetchStats();
      } else {
        alert(res?.error || 'Failed to process return');
      }
    } catch (e) {
      alert(e.message || 'Error processing return');
    } finally {
      setLoading(false);
      focusInput();
    }
  };

  // ── 📋 Courier Manifest Handover Helpers ──────────────────────────────────
  const openManifestModal = async () => {
    setShowManifestModal(true);
    setManifestTab('PENDING');
    fetchManifestPending();
  };

  const fetchManifestPending = async (customParams = {}) => {
    setManifestLoading(true);
    try {
      const activeStartDate = customParams.startDate !== undefined ? customParams.startDate : manifestStartDate;
      const activeEndDate = customParams.endDate !== undefined ? customParams.endDate : manifestEndDate;
      const activeCourier = customParams.courier !== undefined ? customParams.courier : (manifestFilters.courier || []).join(',');
      const activeChannel = customParams.channel !== undefined ? customParams.channel : (manifestFilters.channel || []).join(',');

      const res = await api.getManifestPending({
        startDate: activeStartDate || undefined,
        endDate: activeEndDate || undefined,
        courier: activeCourier && activeCourier !== 'ALL' ? activeCourier : undefined,
        channel: activeChannel && activeChannel !== 'ALL' ? activeChannel : undefined
      });
      if (res && res.success) {
        setManifestPendingData(res);
      }
    } catch (e) {
      console.warn('Error fetching pending manifest:', e);
    } finally {
      setManifestLoading(false);
    }
  };

  const handleManifestDatePreset = (preset) => {
    setManifestDatePreset(preset);
    const range = getDateRangeForPreset(preset);
    setManifestStartDate(range.startDate);
    setManifestEndDate(range.endDate);
    fetchManifestPending({
      startDate: range.startDate,
      endDate: range.endDate
    });
  };

  const fetchPastManifests = async () => {
    try {
      const res = await api.getManifestList();
      if (res && res.success) {
        setPastManifests(res.data || []);
      }
    } catch (e) {
      console.warn('Error fetching past manifests:', e);
    }
  };

  const handleGenerateManifest = async (courierName, packages) => {
    if (!packages || !packages.length) {
      alert('No packages available for this courier');
      return;
    }
    if (!manifestDriverName.trim()) {
      alert('Please enter Pickup Driver Name for handover authorization');
      return;
    }

    try {
      const res = await api.generateManifest({
        courier: courierName,
        driverName: manifestDriverName,
        driverPhone: manifestDriverPhone,
        vehicleNumber: manifestVehicleNumber,
        packages
      });

      if (res && res.success) {
        alert(`✅ Handover Manifest ${res.data.manifestId} created! Opening print preview...`);
        setActivePrintManifest(res.data);
        fetchManifestPending();
      } else {
        alert(res?.error || 'Failed to generate manifest');
      }
    } catch (e) {
      alert(e.message || 'Error generating manifest');
    }
  };

  // ── 📊 Bulk Delivery / Return / Dispatch Universal MIS Importer ──────────
  const handleBulkDeliverSubmit = async () => {
    const rawLines = bulkAwbText.split(/[\r\n,;]+/).map(s => s.trim()).filter(Boolean);
    const blacklist = new Set(['AWB', 'AWB_NUMBER', 'AWB NUMBER', 'AWB NO', 'TRACKING', 'TRACKING_NUMBER', 'TRACKING NUMBER', 'WAYBILL', 'SR NO', 'SRNO', 'ORDER ID', 'ORDER_ID', 'BARCODE', 'STATUS', 'DATE']);
    const uniqueAwbs = Array.from(new Set(rawLines.map(s => s.trim().toUpperCase()))).filter(s => s.length >= 4 && !blacklist.has(s));

    if (!uniqueAwbs.length) {
      alert('Please paste at least one AWB code');
      return;
    }

    setBulkProcessing(true);
    setBulkResult(null);
    try {
      if (bulkActionType === 'DELIVERY') {
        const res = await api.bulkMarkAwbDelivered({
          awbs: uniqueAwbs,
          deliveryDate: bulkDeliveryDate
        });

        if (res && res.success) {
          playAudioCue('success');
          setBulkResult(res);
          fetchStats();
          fetchHistoryAndStats(scanMode);
        } else {
          alert(res?.error || 'Failed to process bulk delivery');
        }
      } else if (bulkActionType === 'RETURN') {
        let successCount = 0;
        let failCount = 0;
        for (const awb of uniqueAwbs) {
          try {
            await api.processAwbReturn({
              awb,
              returnType: 'RTO',
              condition: 'INTACT',
              notes: 'Batch Bulk Return Inward'
            });
            successCount++;
          } catch (e) {
            failCount++;
          }
        }
        playAudioCue('success');
        setBulkResult({
          success: true,
          message: `✅ Bulk Return complete! ${successCount} marked as RETURN / RTO & restocked (${failCount} failed/not found).`
        });
        fetchStats();
        fetchHistoryAndStats(scanMode);
      } else if (bulkActionType === 'DISPATCH') {
        let successCount = 0;
        let failCount = 0;
        for (const awb of uniqueAwbs) {
          try {
            await api.packAwbOrder({
              awb,
              courier: 'Bulk Courier Handover',
              weightGrams: 350
            });
            successCount++;
          } catch (e) {
            failCount++;
          }
        }
        playAudioCue('success');
        setBulkResult({
          success: true,
          message: `📦 Bulk Dispatch complete! ${successCount} marked as DISPATCHED & stamped (${failCount} failed/not found).`
        });
        fetchStats();
        fetchHistoryAndStats(scanMode);
      }
    } catch (e) {
      alert(e.message || 'Error processing bulk update');
    } finally {
      setBulkProcessing(false);
    }
  };

  // ── 📈 Fetch Courier Analytics ────────────────────────────────────────────
  const openAnalytics = async (customParams = {}) => {
    setShowAnalyticsModal(true);
    setAnalyticsLoading(true);
    try {
      const activeStartDate = customParams.startDate !== undefined ? customParams.startDate : analyticsStartDate;
      const activeEndDate = customParams.endDate !== undefined ? customParams.endDate : analyticsEndDate;
      const activeCourier = customParams.courier !== undefined ? customParams.courier : (analyticsFilters.courier || []).join(',');
      const activeChannel = customParams.channel !== undefined ? customParams.channel : (analyticsFilters.channel || []).join(',');

      const res = await api.getCourierAnalytics({
        startDate: activeStartDate || undefined,
        endDate: activeEndDate || undefined,
        courier: activeCourier && activeCourier !== 'ALL' ? activeCourier : undefined,
        channel: activeChannel && activeChannel !== 'ALL' ? activeChannel : undefined
      });
      if (res && res.success) {
        setAnalyticsData(res);
      }
    } catch (e) {
      console.warn('Failed to fetch courier analytics:', e);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleAnalyticsDatePreset = (preset) => {
    setAnalyticsDatePreset(preset);
    const range = getDateRangeForPreset(preset);
    setAnalyticsStartDate(range.startDate);
    setAnalyticsEndDate(range.endDate);
    openAnalytics({
      startDate: range.startDate,
      endDate: range.endDate
    });
  };

  // ── Save Claim Details Update ─────────────────────────────────────────────
  const handleSaveClaimDetails = async () => {
    if (!selectedClaimRecord?._id) return;
    setSavingClaim(true);
    try {
      const res = await api.updateReturnClaim(selectedClaimRecord._id, {
        claimStatus: selectedClaimRecord.claimStatus,
        claimId: selectedClaimRecord.claimId,
        claimAmount: selectedClaimRecord.claimAmount,
        claimNotes: selectedClaimRecord.claimNotes
      });
      if (res && res.success) {
        alert('✅ SPF Claim details updated successfully!');
        setSelectedClaimRecord(null);
      }
    } catch (e) {
      alert(e.message || 'Failed to update claim');
    } finally {
      setSavingClaim(false);
    }
  };

  // Handle Manual Form Submit
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    handleProcessScan(scanInput, 'Manual Entry');
  };

  // ── 🔍 Complete Record Detail Dossier Modal Handler ──────────────────────
  const handleOpenRecordDetails = async (item) => {
    if (!item) return;
    setSelectedRecordDetails(item);
    setFullOrderDetails(null);
    setRecordDetailsLoading(true);
    try {
      const code = item.awb || item.shippingPackageCode || item.orderCode;
      if (code) {
        const res = await api.get(`/scan-pack/lookup?barcode=${encodeURIComponent(code)}`);
        if (res.data && res.data.success && res.data.data) {
          setFullOrderDetails(res.data.data);
        }
      }
    } catch (err) {
      console.warn('Could not fetch extra live lookup details for row:', err);
    } finally {
      setRecordDetailsLoading(false);
    }
  };

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard?.writeText(String(text));
    setCopiedRecordField(fieldName);
    setTimeout(() => setCopiedRecordField(null), 2000);
  };

  return (
    <div className="scan-and-pack-screen" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', minHeight: '100%', paddingBottom: '4.5rem' }}>
      
      {/* 👑 Top Header Banner */}
      <div style={{
        padding: '1.25rem 1.75rem',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0284c7'
          }}>
            <PackageCheck size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>
                Scan & Pack Hub
              </h2>
              <EntityBrandBadge entityId="elite_online" />
            </div>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#475569', fontWeight: 500 }}>
              AWB Tracking, Double-Scan Zero Error Check, Weight Scale Guard & Courier Manifest Handover
            </p>
          </div>
        </div>

        {/* Action Buttons: Manifest, Analytics, Barcode Tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>

          {/* Courier Handover Manifest Button */}
          <button
            type="button"
            onClick={openManifestModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(2,132,199,0.25)'
            }}
          >
            <FileSpreadsheet size={15} />
            <span>Daily Manifest</span>
          </button>

          {/* Courier Performance Analytics */}
          <button
            type="button"
            onClick={openAnalytics}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              background: '#f5f3ff',
              border: '1px solid #ddd6fe',
              color: '#7c3aed',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <BarChart2 size={15} />
            <span>Courier Analytics</span>
          </button>

          {/* Bulk Delivery MIS Importer */}
          <button
            type="button"
            onClick={() => { setShowBulkDeliveryModal(true); setBulkResult(null); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#047857',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <CheckCheck size={15} />
            <span>Bulk Delivery</span>
          </button>

          {/* Barcode Tag Print */}
          <button
            type="button"
            onClick={() => setShowBarcodeTagModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#1e293b',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Tag size={15} />
            <span>Tag Printer</span>
          </button>

          {/* Hardware Scanner Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.45rem 0.9rem',
            borderRadius: '999px',
            background: hardwareDetected ? '#ecfdf5' : '#eff6ff',
            border: `1px solid ${hardwareDetected ? '#86efac' : '#bfdbfe'}`,
            fontSize: '0.78rem',
            fontWeight: 700,
            color: hardwareDetected ? '#15803d' : '#0284c7'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: hardwareDetected ? '#16a34a' : '#0284c7',
              boxShadow: hardwareDetected ? '0 0 10px #16a34a' : '0 0 8px #0284c7'
            }} />
            <span>{hardwareDetected ? 'Laser Active' : 'Ready'}</span>
          </div>
        </div>
      </div>

      {/* ── 🎯 Top Level Filter Bar (DateRangePicker + UnifiedFilterPopover + Clear/Reset) ── */}
      <div style={{
        padding: '0.65rem 1rem',
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(15,23,42,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={15} color="#0284c7" />
              <span>Filter KPI & Register:</span>
            </span>

            <DateRangePicker
              preset={historyDatePreset}
              onChange={({ preset: p, dateStart: ds, dateEnd: de }) => {
                setHistoryDatePreset(p);
                setHistoryStartDate(ds || '');
                setHistoryEndDate(de || '');
                fetchHistoryAndStats(scanMode, historySearchQuery, { startDate: ds, endDate: de });
              }}
              customStart={historyStartDate}
              customEnd={historyEndDate}
              onCustomChange={(s, e) => {
                setHistoryStartDate(s);
                setHistoryEndDate(e);
              }}
            />

            <UnifiedFilterPopover
              categories={historyFilterCategories}
              activeFilters={historyFilters}
              onChange={(newFilters) => {
                setHistoryFilters(newFilters);
                fetchHistoryAndStats(scanMode, historySearchQuery, {
                  courier: (newFilters.courier || []).join(','),
                  channel: (newFilters.channel || []).join(','),
                  status: (newFilters.status || []).join(',')
                });
              }}
              onClear={() => {
                setHistoryFilters({});
                fetchHistoryAndStats(scanMode, historySearchQuery, { courier: '', channel: '', status: '' });
              }}
              placeholder="Logistics / Channel / Status"
              showChips={true}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {(Object.keys(historyFilters).some(k => historyFilters[k]?.length > 0) || (historyDatePreset && historyDatePreset !== 'all') || historyStartDate || historyEndDate) && (
              <button
                type="button"
                onClick={handleResetHistoryFilters}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#dc2626',
                  cursor: 'pointer'
                }}
              >
                <X size={12} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 📊 3 KPI Stat Counters */}
      {(() => {
        const periodText = (historyDatePreset === 'TODAY' || historyDatePreset === 'today')
          ? 'Today' 
          : (historyDatePreset === 'YESTERDAY' || historyDatePreset === 'yesterday')
          ? 'Yesterday' 
          : (historyDatePreset === '7DAYS' || historyDatePreset === 'last_7_days')
          ? '(Last 7D)' 
          : (historyDatePreset === '30DAYS' || historyDatePreset === 'last_30_days')
          ? '(Last 30D)' 
          : (historyDatePreset === 'CUSTOM' || historyDatePreset === 'custom')
          ? `(${historyStartDate || '...'} to ${historyEndDate || '...'})`
          : '(All Scans)';

        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
            
            {/* Metric 1: Dispatched Today */}
            <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #0ea5e9', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Packed & Dispatched {periodText}
                </span>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#0ea5e915', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Truck size={15} color="#0ea5e9" />
                </div>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0ea5e9' }}>
                {stats.dispatchedToday}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Auto-Dated & Weight Stamped</span>
            </div>

            {/* Metric 2: Delivered Today */}
            <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #10b981', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Delivered Shipments {periodText}
                </span>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#10b98115', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={15} color="#10b981" />
                </div>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981' }}>
                {stats.deliveredToday}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>Confirmed Deliveries</span>
            </div>

            {/* Metric 3: Returns Processed */}
            <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #f43f5e', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Returns / RTOs Inward {periodText}
                </span>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f43f5e15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RotateCcw size={15} color="#f43f5e" />
                </div>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f43f5e' }}>
                {stats.returnedToday}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#f43f5e', fontWeight: 600 }}>QC & Empty Box Guarded</span>
            </div>

          </div>
        );
      })()}

      {/* 🚀 Mode Switcher & Scanner Terminal */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(15,23,42,0.04)' }}>
        
        {/* Mode Selector Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Select Operational Mode
            </span>
            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
              Choose whether you are dispatching new orders, tracking deliveries, or processing incoming return parcels.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
            
            {/* Screen 1: Central Department Dashboard & Auto-Router */}
            <button
              type="button"
              onClick={() => { setScanMode('ALL'); setActiveOrder(null); setErrorMsg(''); setSuccessMsg(''); focusInput(); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.55rem 1.15rem',
                borderRadius: '8px',
                border: 'none',
                background: scanMode === 'ALL' ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'transparent',
                color: scanMode === 'ALL' ? '#ffffff' : '#475569',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: scanMode === 'ALL' ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Zap size={15} />
              <span>1. Central Dashboard</span>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 800,
                padding: '1px 6px',
                borderRadius: '999px',
                background: scanMode === 'ALL' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                color: scanMode === 'ALL' ? '#ffffff' : '#475569'
              }}>
                Auto-Router
              </span>
            </button>

            {/* Screen 2: Dispatch (Pack Outward) */}
            <button
              type="button"
              onClick={() => {
                setScanMode('PACK');
                setErrorMsg('');
                setSuccessMsg('');
                if (activeOrder && activeOrder.isReturn) setActiveOrder(null);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.55rem 1.15rem',
                borderRadius: '8px',
                border: 'none',
                background: scanMode === 'PACK' ? 'linear-gradient(135deg, #0ea5e9, #0284c7)' : 'transparent',
                color: scanMode === 'PACK' ? '#ffffff' : '#475569',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: scanMode === 'PACK' ? '0 2px 8px rgba(14,165,233,0.3)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Truck size={15} />
              <span>2. Dispatch</span>
              {stats.dispatchedToday > 0 && (
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background: scanMode === 'PACK' ? 'rgba(255,255,255,0.25)' : '#0ea5e920',
                  color: scanMode === 'PACK' ? '#ffffff' : '#0284c7'
                }}>
                  {stats.dispatchedToday}
                </span>
              )}
            </button>

            {/* Screen 3: Return (Strict Return / RTO Inward) */}
            <button
              type="button"
              onClick={() => {
                setScanMode('RETURN');
                setErrorMsg('');
                setSuccessMsg('');
                if (activeOrder && !activeOrder.isReturn) setActiveOrder(null);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.55rem 1.15rem',
                borderRadius: '8px',
                border: 'none',
                background: scanMode === 'RETURN' ? 'linear-gradient(135deg, #f43f5e, #be123c)' : 'transparent',
                color: scanMode === 'RETURN' ? '#ffffff' : '#475569',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: scanMode === 'RETURN' ? '0 2px 8px rgba(244,63,94,0.3)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <RotateCcw size={15} />
              <span>3. Return</span>
              {stats.returnedToday > 0 && (
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background: scanMode === 'RETURN' ? 'rgba(255,255,255,0.25)' : '#f43f5e20',
                  color: scanMode === 'RETURN' ? '#ffffff' : '#be123c'
                }}>
                  {stats.returnedToday}
                </span>
              )}
            </button>

          </div>
        </div>

        {/* ⚖️ Weighing Scale Check Widget (Only on Screen 2 Dispatch) */}
        {scanMode === 'PACK' && (
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Scale size={18} color="#0ea5e9" />
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>
                Parcel Weight (Grams):
              </span>
              <input
                type="number"
                placeholder="350"
                value={parcelWeight}
                onChange={(e) => setParcelWeight(e.target.value)}
                style={{
                  width: '90px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: Number(parcelWeight) > 0 && Number(parcelWeight) < 120 ? '2px solid #f59e0b' : '1px solid #cbd5e1',
                  fontWeight: 800,
                  fontSize: '0.85rem'
                }}
              />
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>g</span>

              {Number(parcelWeight) > 0 && Number(parcelWeight) < 120 && (
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '4px' }}>
                  ⚠️ Low weight (&lt;120g). Check if all items are inside box!
                </span>
              )}
            </div>

            {/* Quick Presets */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Presets:</span>
              {['300', '380', '500', '1000'].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setParcelWeight(w)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: parcelWeight === w ? '#0ea5e9' : '#fff',
                    color: parcelWeight === w ? '#fff' : '#475569',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {w}g
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 🎯 High-Visibility AWB Scan Input Box - Active across all Operational Modes (Screen 1, Screen 2, and Screen 3) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', width: '100%' }}>
          
          {/* Mode-specific Top Guidance & Live Counters Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '0.85rem 1.25rem',
            borderRadius: '12px',
            background: scanMode === 'PACK' 
              ? 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)'
              : scanMode === 'RETURN'
              ? 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)'
              : 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)',
            border: `1.5px solid ${scanMode === 'PACK' ? '#7dd3fc' : scanMode === 'RETURN' ? '#fecdd3' : '#c7d2fe'}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: scanMode === 'PACK'
                  ? 'linear-gradient(135deg, #0ea5e9, #0284c7)'
                  : scanMode === 'RETURN'
                  ? 'linear-gradient(135deg, #f43f5e, #e11d48)'
                  : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: scanMode === 'PACK' 
                  ? '0 2px 8px rgba(14,165,233,0.3)' 
                  : scanMode === 'RETURN'
                  ? '0 2px 8px rgba(244,63,94,0.3)'
                  : '0 2px 8px rgba(99,102,241,0.3)'
              }}>
                {scanMode === 'PACK' ? <Truck size={20} /> : scanMode === 'RETURN' ? <RotateCcw size={20} /> : <Zap size={20} />}
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 900, color: scanMode === 'PACK' ? '#0369a1' : scanMode === 'RETURN' ? '#9f1239' : '#312e81', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>
                    {scanMode === 'PACK' 
                      ? 'Screen 2: Dispatch Desk & Forward Shipping' 
                      : scanMode === 'RETURN' 
                      ? 'Screen 3: Return & RTO Inward Station' 
                      : 'Screen 1: Department Central Dashboard & Auto-Router'}
                  </span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '1px 7px', borderRadius: '999px', background: scanMode === 'PACK' ? '#0ea5e9' : scanMode === 'RETURN' ? '#e11d48' : '#22c55e', color: '#ffffff' }}>
                    {scanMode === 'PACK' ? 'PACK DESK' : scanMode === 'RETURN' ? 'RETURN QC' : 'CENTRAL SCANNER'}
                  </span>
                </div>
                <div style={{ fontSize: '0.74rem', color: scanMode === 'PACK' ? '#0284c7' : scanMode === 'RETURN' ? '#be123c' : '#6366f1', marginTop: '2px' }}>
                  {scanMode === 'PACK'
                    ? `Dispatch Desk: Displays forward dispatched parcels (${parcelWeight || 350}g). Tip: Scan new parcels in Screen 1 (Central Dashboard) for auto-routing!`
                    : scanMode === 'RETURN'
                    ? 'Return Station: Displays returned & RTO parcels. Tip: Scan new parcels in Screen 1 (Central Dashboard) for auto-routing!'
                    : 'Central Scan Desk: Scan any barcode here. The system automatically inspects the code, classifies Dispatch vs Return, and routes it into Screen 2 or Screen 3!'}
                </div>
              </div>
            </div>

            {/* Session Live Counters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                padding: '4px 10px',
                borderRadius: '8px',
                background: '#ffffff',
                border: '1px solid #c7d2fe',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Session Scans</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#4338ca' }}>
                  {sessionDispatchCount + sessionReturnCount}
                </div>
              </div>

              <div 
                onClick={() => { setScanMode('PACK'); focusInput(); }}
                title="Click to view Screen 2 (Dispatch Desk)"
                style={{
                  padding: '4px 10px',
                  borderRadius: '8px',
                  background: scanMode === 'PACK' ? '#0ea5e9' : '#f0f9ff',
                  border: '1px solid #7dd3fc',
                  textAlign: 'center',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: scanMode === 'PACK' ? '#ffffff' : '#0369a1', textTransform: 'uppercase' }}>→ To Dispatch</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: scanMode === 'PACK' ? '#ffffff' : '#0284c7' }}>
                  {sessionDispatchCount}
                </div>
              </div>

              <div 
                onClick={() => { setScanMode('RETURN'); focusInput(); }}
                title="Click to view Screen 3 (Return Desk)"
                style={{
                  padding: '4px 10px',
                  borderRadius: '8px',
                  background: scanMode === 'RETURN' ? '#e11d48' : '#fff1f2',
                  border: '1px solid #fecdd3',
                  textAlign: 'center',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: scanMode === 'RETURN' ? '#ffffff' : '#be123c', textTransform: 'uppercase' }}>→ To Return</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: scanMode === 'RETURN' ? '#ffffff' : '#e11d48' }}>
                  {sessionReturnCount}
                </div>
              </div>
            </div>
          </div>

          {/* Scan input form */}
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Scan size={22} style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: scanMode === 'PACK' ? '#0ea5e9' : scanMode === 'RETURN' ? '#e11d48' : '#6366f1'
              }} />
              <input
                ref={inputRef}
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder={
                  scanMode === 'PACK'
                    ? `Scan forward AWB code to pack & dispatch immediately (${parcelWeight || 350}g)...`
                    : scanMode === 'RETURN'
                    ? "Scan return / RTO AWB code for QC inspection & inwarding..."
                    : "Scan AWB code one-by-one (Barcode gun ready) — Auto-sets to Dispatch or Return instantly..."
                }
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.9rem 1rem 0.9rem 3rem',
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  borderRadius: '12px',
                  border: `2px solid ${scanMode === 'PACK' ? '#0ea5e9' : scanMode === 'RETURN' ? '#e11d48' : '#6366f1'}`,
                  background: '#f8fafc',
                  color: '#0f172a',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  outline: 'none',
                  letterSpacing: '0.02em'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !scanInput.trim()}
              style={{
                background: scanMode === 'PACK' ? '#0ea5e9' : scanMode === 'RETURN' ? '#e11d48' : '#6366f1',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '0 1.75rem',
                fontSize: '0.95rem',
                fontWeight: 800,
                cursor: loading || !scanInput.trim() ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                whiteSpace: 'nowrap'
              }}
            >
              {loading ? <RefreshCw size={18} className="spin-loader" /> : <Barcode size={18} />}
              <span>
                {scanMode === 'PACK' ? 'Dispatch & Pack Scan' : scanMode === 'RETURN' ? 'Return QC Scan' : 'Auto-Route Scan'}
              </span>
            </button>
          </form>
        </div>

        {/* Notifications & Feedback */}
        {successMsg && (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="#10b981" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} color="#ef4444" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 📦 Active Order Inspection Card (Only for manual work desks Screen 2 & Screen 3 - hidden on Screen 1) */}
        {activeOrder && scanMode !== 'ALL' && (
          <div style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            {/* 🏷️ Smart AWB Order Classification Banner */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '0.65rem 1rem',
              borderRadius: '10px',
              background: activeOrder.isReturn 
                ? (activeOrder.orderClassification === 'RETURN_RTO' ? '#fff7ed' : '#fff1f2')
                : activeOrder.orderClassification === 'DELIVERED' 
                ? '#ecfdf5' 
                : activeOrder.orderClassification === 'IN_TRANSIT'
                ? '#eff6ff'
                : '#f0fdf4',
              border: `1.5px solid ${
                activeOrder.isReturn
                  ? (activeOrder.orderClassification === 'RETURN_RTO' ? '#fdba74' : '#fecdd3')
                  : activeOrder.orderClassification === 'DELIVERED'
                  ? '#a7f3d0'
                  : activeOrder.orderClassification === 'IN_TRANSIT'
                  ? '#bfdbfe'
                  : '#86efac'
              }`,
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeOrder.isReturn ? (
                  <RotateCcw size={18} color={activeOrder.orderClassification === 'RETURN_RTO' ? '#ea580c' : '#e11d48'} />
                ) : activeOrder.orderClassification === 'DELIVERED' ? (
                  <CheckCircle2 size={18} color="#059669" />
                ) : activeOrder.orderClassification === 'IN_TRANSIT' ? (
                  <Truck size={18} color="#2563eb" />
                ) : (
                  <PackageCheck size={18} color="#16a34a" />
                )}
                <span style={{
                  fontSize: '0.85rem',
                  fontWeight: 900,
                  letterSpacing: '0.02em',
                  color: activeOrder.isReturn 
                    ? (activeOrder.orderClassification === 'RETURN_RTO' ? '#c2410c' : '#be123c')
                    : activeOrder.orderClassification === 'DELIVERED'
                    ? '#047857'
                    : activeOrder.orderClassification === 'IN_TRANSIT'
                    ? '#1d4ed8'
                    : '#15803d'
                }}>
                  {activeOrder.orderClassification === 'RETURN_CUSTOMER' && '🔴 INCOMING CUSTOMER RETURN (CIR)'}
                  {activeOrder.orderClassification === 'RETURN_RTO' && '🟠 COURIER RTO (UNDELIVERED RETURN)'}
                  {activeOrder.orderClassification === 'NEW_DISPATCH' && '🟢 NEW FORWARD ORDER — READY TO PACK & DISPATCH'}
                  {activeOrder.orderClassification === 'IN_TRANSIT' && '🚚 IN-TRANSIT — DISPATCHED FORWARD SHIPMENT'}
                  {activeOrder.orderClassification === 'DELIVERED' && '✅ CONFIRMED DELIVERED SHIPMENT'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '999px',
                  background: '#ffffff',
                  color: '#475569',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                }}>
                  Uniware Type: {activeOrder.orderClassificationLabel || activeOrder.currentStage}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveOrder(null)}
                  title="Close Inspection Card"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '999px',
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    color: '#64748b',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}
                >
                  ✕ Close
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {activeOrder.productImage ? (
                  <img
                    src={activeOrder.productImage}
                    alt={activeOrder.itemSKUCode}
                    style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', border: '1px solid #e2e8f0' }}
                  />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: 8, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                    <Boxes size={28} />
                  </div>
                )}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                      AWB: {activeOrder.awb}
                    </span>
                    {activeOrder.channel && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: '#fdf2f8', color: '#db2777', border: '1px solid #fbcfe8', textTransform: 'uppercase' }}>
                        {activeOrder.channel}
                      </span>
                    )}
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                      {activeOrder.courier}
                    </span>
                    {/* Payment Mode Badge */}
                    {activeOrder.paymentMode && (
                      <span style={{ 
                        fontSize: '0.72rem', 
                        fontWeight: 800, 
                        padding: '2px 8px', 
                        borderRadius: '6px', 
                        background: activeOrder.paymentMode === 'COD' ? '#fef3c7' : '#ecfdf5', 
                        color: activeOrder.paymentMode === 'COD' ? '#b45309' : '#047857', 
                        border: `1px solid ${activeOrder.paymentMode === 'COD' ? '#fde68a' : '#a7f3d0'}` 
                      }}>
                        {activeOrder.paymentMode === 'COD' ? '💵 COD' : '💳 PREPAID'}
                      </span>
                    )}

                    {/* Payment Status Badge (Done / Pending / Refund / Cancelled) */}
                    {(() => {
                      const pStatus = String(activeOrder.paymentStatus || (activeOrder.isCod ? 'PENDING' : 'PAID')).toUpperCase();
                      const isPaid = pStatus === 'PAID' || (!activeOrder.isCod && !activeOrder.isReturn);
                      const isPending = pStatus === 'PENDING' || (activeOrder.isCod && !activeOrder.isDelivered && !activeOrder.isReturn);
                      const isRefund = pStatus.includes('REFUND') || (activeOrder.isReturn && !activeOrder.isCod);
                      const isCancelled = pStatus === 'CANCELLED';

                      if (isPaid) {
                        return (
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <span>✓</span>
                            <span>Payment Done</span>
                          </span>
                        );
                      }
                      if (isPending) {
                        const amt = activeOrder.codAmount || activeOrder.price || 0;
                        return (
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <span>⏳</span>
                            <span>Payment Pending {amt > 0 ? `(Collect ${fmtINR(amt)})` : ''}</span>
                          </span>
                        );
                      }
                      if (isRefund) {
                        return (
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: '#f3e8ff', color: '#7e22ce', border: '1px solid #d8b4fe', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <span>↺</span>
                            <span>Refund Under Process</span>
                          </span>
                        );
                      }
                      if (isCancelled) {
                        return (
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>
                            ✕ Cancelled
                          </span>
                        );
                      }
                      return (
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
                          {activeOrder.paymentStatusLabel || pStatus}
                        </span>
                      );
                    })()}
                    {activeOrder.brand && activeOrder.brand.trim() && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1' }}>
                        {activeOrder.brand}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowBarcodeTagModal(true)}
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Tag size={12} />
                      <span>Print Garment Tag</span>
                    </button>
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginTop: '2px' }}>
                    {activeOrder.itemName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '12px', marginTop: '3px', flexWrap: 'wrap' }}>
                    <span>SKU: <strong>{activeOrder.itemSKUCode}</strong></span>
                    {activeOrder.size && <span>Size: <strong>{activeOrder.size}</strong></span>}
                    {activeOrder.color && <span>Color: <strong>{activeOrder.color}</strong></span>}
                    {activeOrder.price > 0 && <span>Value: <strong>{fmtINR(activeOrder.price)}</strong></span>}
                    {activeOrder.weightGrams > 0 && <span>Weight: <strong>{activeOrder.weightGrams}g</strong></span>}
                    {activeOrder.invoiceCode && <span>Invoice: <strong>#{activeOrder.invoiceCode}</strong></span>}
                    {activeOrder.shippingPackageCode && <span>Pkg: <strong>{activeOrder.shippingPackageCode}</strong></span>}
                  </div>
                </div>
              </div>

              {/* Destination & Order Tag */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                  Order: #{activeOrder.displayOrderCode}
                </div>
                {activeOrder.customerName && (
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>
                    👤 {activeOrder.customerName}
                  </div>
                )}
                {activeOrder.city && (
                  <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px', marginTop: '3px' }}>
                    <MapPin size={12} /> {activeOrder.city}, {activeOrder.state} ({activeOrder.pincode})
                  </div>
                )}
              </div>
            </div>

            {/* Uniware Return / RTO Reason Banner (if order was returned/RTO) */}
            {activeOrder.returnReason && (
              <div style={{
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                padding: '0.6rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                color: '#c2410c',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600
              }}>
                <AlertCircle size={16} color="#ea580c" />
                <span>Uniware Return Reason: <strong>{activeOrder.returnReason}</strong></span>
                {activeOrder.reversePickupCode && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#9a3412', background: '#ffedd5', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                    Reverse AWB: {activeOrder.reversePickupCode}
                  </span>
                )}
              </div>
            )}

            {/* Lifecycle Auto-Date Timestamps */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', background: '#ffffff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.75rem' }}>
              <div>
                <span style={{ color: '#64748b', display: 'block' }}>Order Date:</span>
                <strong style={{ color: '#0f172a' }}>
                  {activeOrder.orderDate ? new Date(activeOrder.orderDate).toLocaleString('en-IN') : 'N/A'}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block' }}>Dispatch Date:</span>
                <strong style={{ color: '#0ea5e9' }}>
                  {activeOrder.dispatchDate ? new Date(activeOrder.dispatchDate).toLocaleString('en-IN') : 'Stamped on Scan'}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block' }}>Delivery Date:</span>
                <strong style={{ color: '#10b981' }}>
                  {activeOrder.deliveryTime ? new Date(activeOrder.deliveryTime).toLocaleString('en-IN') : 'In-Transit'}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block' }}>Return Date:</span>
                <strong style={{ color: '#f43f5e' }}>
                  {activeOrder.returnDate ? new Date(activeOrder.returnDate).toLocaleString('en-IN') : 'Not Returned'}
                </strong>
              </div>
            </div>

            {/* 💰 Dedicated Payment & Commercial Financial Details Strip */}
            <div style={{
              background: activeOrder.paymentMode === 'COD' 
                ? (activeOrder.isDelivered ? '#f0fdf4' : '#fffbeb') 
                : '#f0fdf4',
              border: `1px solid ${activeOrder.paymentMode === 'COD' 
                ? (activeOrder.isDelivered ? '#bbf7d0' : '#fde68a') 
                : '#bbf7d0'}`,
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '8px',
                  background: activeOrder.paymentMode === 'COD' 
                    ? (activeOrder.isDelivered ? '#dcfce7' : '#fef3c7') 
                    : '#dcfce7',
                  color: activeOrder.paymentMode === 'COD' 
                    ? (activeOrder.isDelivered ? '#15803d' : '#b45309') 
                    : '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '16px'
                }}>
                  {activeOrder.paymentMode === 'COD' ? (activeOrder.isDelivered ? '✓' : '₹') : '✓'}
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span>Payment Mode: <strong>{activeOrder.paymentMode === 'COD' ? '💵 Cash On Delivery (COD)' : '💳 Prepaid Online'}</strong></span>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '5px',
                      background: (activeOrder.paymentStatus === 'PAID' || (!activeOrder.isCod && !activeOrder.isReturn)) ? '#dcfce7' : '#fef3c7',
                      color: (activeOrder.paymentStatus === 'PAID' || (!activeOrder.isCod && !activeOrder.isReturn)) ? '#15803d' : '#b45309',
                      border: `1px solid ${(activeOrder.paymentStatus === 'PAID' || (!activeOrder.isCod && !activeOrder.isReturn)) ? '#86efac' : '#fcd34d'}`
                    }}>
                      {(activeOrder.paymentStatus === 'PAID' || (!activeOrder.isCod && !activeOrder.isReturn)) 
                        ? 'STATUS: PAYMENT DONE / SETTLED' 
                        : (activeOrder.isReturn ? 'STATUS: NOT APPLICABLE (RETURNED)' : 'STATUS: PAYMENT PENDING (COLLECT AT DELIVERY)')}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: '3px' }}>
                    {activeOrder.paymentMode === 'COD' ? (
                      activeOrder.isDelivered ? (
                        <span style={{ color: '#15803d', fontWeight: 600 }}>
                          ✓ Cash collection completed by courier boy on delivery. Payment is Settled.
                        </span>
                      ) : activeOrder.isReturn ? (
                        <span>Order returned/undelivered — zero cash collected.</span>
                      ) : (
                        <span style={{ color: '#b45309', fontWeight: 700 }}>
                          ⚠️ Collect <strong>{fmtINR(activeOrder.codAmount || activeOrder.price || 0)}</strong> in cash or UPI from customer before handing over the parcel.
                        </span>
                      )
                    ) : (
                      <span style={{ color: '#15803d', fontWeight: 600 }}>
                        ✓ Paid online upfront via {activeOrder.channel || 'Channel'} Payment Gateway. Zero cash to collect from customer.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Amount Badges */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  {activeOrder.paymentMode === 'COD' ? 'Collectable Amount' : 'Amount Paid'}
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: activeOrder.paymentMode === 'COD' ? '#b45309' : '#047857' }}>
                  {fmtINR(activeOrder.codAmount || activeOrder.price || 0)}
                </div>
              </div>
            </div>

            {/* ⚡ Intelligent Auto-Router Confirmation & Screen Navigation Bar for Screen 1 */}
            {scanMode === 'ALL' && (
              <div style={{
                background: activeOrder.isReturn
                  ? 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)'
                  : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                border: `1.5px solid ${activeOrder.isReturn ? '#fecdd3' : '#bae6fd'}`,
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: activeOrder.isReturn ? '#f43f5e' : '#0ea5e9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff'
                    }}>
                      {activeOrder.isReturn ? <RotateCcw size={15} /> : <Truck size={15} />}
                    </div>
                    <div>
                      <div style={{
                        fontSize: '0.88rem',
                        fontWeight: 900,
                        color: activeOrder.isReturn ? '#9f1239' : '#0369a1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span>
                          {activeOrder.isReturn ? '⚡ Auto-Set to Screen 3 (Return Desk)' : '⚡ Auto-Set to Screen 2 (Dispatch Desk)'}
                        </span>
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: activeOrder.isReturn ? '#ffe4e6' : '#e0f2fe',
                          color: activeOrder.isReturn ? '#be123c' : '#0284c7',
                          border: `1px solid ${activeOrder.isReturn ? '#fecdd3' : '#7dd3fc'}`
                        }}>
                          {activeOrder.isReturn ? 'RETURN RECORDED' : 'DISPATCH PACKED'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: activeOrder.isReturn ? '#be123c' : '#0284c7', marginTop: '2px' }}>
                        {activeOrder.isReturn
                          ? `Identified as ${activeOrder.orderClassificationLabel}. Inwarded to inventory and visible in Screen 3 (Return).`
                          : `Identified as Forward Order. Dispatched date stamped and visible in Screen 2 (Dispatch).`}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {activeOrder.isReturn ? (
                      <button
                        type="button"
                        onClick={() => setScanMode('RETURN')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '0.45rem 0.9rem',
                          borderRadius: '8px',
                          background: '#be123c',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(190,18,60,0.25)'
                        }}
                      >
                        <RotateCcw size={13} />
                        <span>View in Screen 3 (Return)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setScanMode('PACK')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '0.45rem 0.9rem',
                          borderRadius: '8px',
                          background: '#0284c7',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(2,132,199,0.25)'
                        }}
                      >
                        <Truck size={13} />
                        <span>View in Screen 2 (Dispatch)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Screen 2: Dispatch Desk Execution Bar */}
            {scanMode === 'PACK' && !activeOrder.isReturn && (
              <div style={{
                background: (activeOrder.dispatchDate || activeOrder.orderClassification === 'IN_TRANSIT') ? '#ecfdf5' : '#eff6ff',
                border: `1.5px solid ${(activeOrder.dispatchDate || activeOrder.orderClassification === 'IN_TRANSIT') ? '#a7f3d0' : '#93c5fd'}`,
                borderRadius: '8px',
                padding: '0.85rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: (activeOrder.dispatchDate || activeOrder.orderClassification === 'IN_TRANSIT') ? '#047857' : '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Truck size={17} color={(activeOrder.dispatchDate || activeOrder.orderClassification === 'IN_TRANSIT') ? '#059669' : '#2563eb'} />
                    <span>{(activeOrder.dispatchDate || activeOrder.orderClassification === 'IN_TRANSIT') ? 'Shipment Already Dispatched & In-Transit' : `Dispatch Forward Order #${activeOrder.displayOrderCode}`} ({activeOrder.itemSKUCode})</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                    Courier: <strong>{activeOrder.courier}</strong> • Parcel Weight: <strong>{activeOrder.weightGrams || parcelWeight || 350}g</strong>
                    {activeOrder.dispatchDate && ` • Dispatched: ${new Date(activeOrder.dispatchDate).toLocaleTimeString('en-IN')}`}
                  </div>
                </div>

                {!(activeOrder.dispatchDate || activeOrder.orderClassification === 'IN_TRANSIT') ? (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setLoading(true);
                        const numericWeight = Number(parcelWeight) || activeOrder.weightGrams || 350;
                        await api.packAwbOrder({
                          awb: activeOrder.awb,
                          displayOrderCode: activeOrder.displayOrderCode,
                          sku: activeOrder.itemSKUCode,
                          courier: activeOrder.courier,
                          weightGrams: numericWeight
                        });
                        playAudioCue('success');
                        setSuccessMsg(`✅ [DISPATCHED] AWB ${activeOrder.awb} verified & packed! Dispatched date automatically stamped (${numericWeight}g).`);
                        const historyEntry = {
                          id: Date.now(),
                          awb: activeOrder.awb,
                          shippingPackageCode: activeOrder.shippingPackageCode || '',
                          orderCode: activeOrder.displayOrderCode,
                          sku: activeOrder.itemSKUCode,
                          itemName: activeOrder.itemName || '',
                          brand: activeOrder.brand || '',
                          productImage: activeOrder.productImage || '',
                          channel: activeOrder.channel || '',
                          customerName: activeOrder.customerName || '',
                          city: activeOrder.city || '',
                          size: activeOrder.size || '',
                          color: activeOrder.color || '',
                          courier: activeOrder.courier,
                          weightGrams: numericWeight,
                          price: activeOrder.price || 0,
                          paymentMode: activeOrder.paymentMode || 'PREPAID',
                          paymentStatus: activeOrder.paymentStatus || 'PAID',
                          codAmount: activeOrder.codAmount || 0,
                          mode: 'PACK',
                          status: 'DISPATCHED',
                          time: new Date().toLocaleTimeString('en-IN'),
                          date: new Date().toLocaleDateString('en-IN')
                        };
                        recordScanToHistory(historyEntry);
                        setActiveOrder(null);
                        fetchStats();
                      } catch (err) {
                        playAudioCue('error');
                        setErrorMsg(err.message || 'Error packing order');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    style={{
                      padding: '0.6rem 1.4rem',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 12px rgba(14,165,233,0.3)'
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>Execute Dispatch ({parcelWeight || 350}g)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveOrder(null)}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#334155',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Dismiss
                  </button>
                )}
              </div>
            )}

            {/* Return QC Controls & Photo Evidence (If Mode === RETURN and is verified return) */}
            {scanMode === 'RETURN' && activeOrder.isReturn && (
              <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#be123c', textTransform: 'uppercase' }}>
                  Return Quality Control & Inward Restock
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                  
                  <button
                    type="button"
                    onClick={() => setReturnCondition('INTACT')}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      border: returnCondition === 'INTACT' ? '2px solid #10b981' : '1px solid #cbd5e1',
                      background: returnCondition === 'INTACT' ? '#ecfdf5' : '#ffffff',
                      color: returnCondition === 'INTACT' ? '#065f46' : '#334155',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                  >
                    🟢 Intact (Restock +1)
                  </button>

                  <button
                    type="button"
                    onClick={() => setReturnCondition('NEEDS_REFINISHING')}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      border: returnCondition === 'NEEDS_REFINISHING' ? '2px solid #f59e0b' : '1px solid #cbd5e1',
                      background: returnCondition === 'NEEDS_REFINISHING' ? '#fef3c7' : '#ffffff',
                      color: returnCondition === 'NEEDS_REFINISHING' ? '#92400e' : '#334155',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                  >
                    🟡 Needs Refinishing
                  </button>

                  <button
                    type="button"
                    onClick={() => setReturnCondition('DAMAGED')}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      border: returnCondition === 'DAMAGED' ? '2px solid #ef4444' : '1px solid #cbd5e1',
                      background: returnCondition === 'DAMAGED' ? '#fee2e2' : '#ffffff',
                      color: returnCondition === 'DAMAGED' ? '#991b1b' : '#334155',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                  >
                    🔴 Damaged / SPF Claim
                  </button>

                  <button
                    type="button"
                    onClick={() => setReturnCondition('WRONG_ITEM')}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      border: returnCondition === 'WRONG_ITEM' ? '2px solid #ef4444' : '1px solid #cbd5e1',
                      background: returnCondition === 'WRONG_ITEM' ? '#fee2e2' : '#ffffff',
                      color: returnCondition === 'WRONG_ITEM' ? '#991b1b' : '#334155',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                  >
                    ❌ Wrong Item Return
                  </button>
                </div>

                {/* ⚖️ Return Weight Scale Inspection & Empty Box Guard */}
                <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #fecaca', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <Scale size={16} color="#be123c" />
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#991b1b' }}>
                      Weigh Returned Box (Grams):
                    </span>
                    <input
                      type="number"
                      placeholder="e.g. 350"
                      value={returnWeight}
                      onChange={(e) => setReturnWeight(e.target.value)}
                      style={{ width: '80px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>g</span>

                    {activeOrder.weightGrams > 0 && (
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        (Dispatched at: <strong>{activeOrder.weightGrams}g</strong>)
                      </span>
                    )}

                    {/* Empty Box Discrepancy Alert */}
                    {Number(returnWeight) > 0 && activeOrder.weightGrams > 200 && Number(returnWeight) < 120 && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#ffffff', background: '#ef4444', padding: '2px 8px', borderRadius: '4px' }}>
                        🚨 EMPTY BOX SUSPECTED! Weight is under 120g! File SPF Claim!
                      </span>
                    )}
                  </div>
                </div>

                {/* 📸 Photo Proof Capture for Damaged / Wrong Items */}
                {(returnCondition === 'DAMAGED' || returnCondition === 'WRONG_ITEM' || returnCondition === 'NEEDS_REFINISHING') && (
                  <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #fecaca', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#991b1b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Camera size={14} /> Photo Proof for SPF Claim ({returnImages.length} attached)
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={startCamera}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: '#0ea5e9',
                            color: '#fff',
                            border: 'none',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <Camera size={12} />
                          <span>Webcam Snapshot</span>
                        </button>

                        <label style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background: '#475569',
                          color: '#fff',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}>
                          <Upload size={12} />
                          <span>Upload File</span>
                          <input type="file" accept="image/*" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
                        </label>
                      </div>
                    </div>

                    {/* Image Preview Thumbnails */}
                    {returnImages.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '4px 0' }}>
                        {returnImages.map((img, idx) => (
                          <div key={idx} style={{ position: 'relative', width: 50, height: 50, flexShrink: 0 }}>
                            <img src={img} alt={`Proof ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                            <button
                              type="button"
                              onClick={() => setReturnImages(prev => prev.filter((_, i) => i !== idx))}
                              style={{
                                position: 'absolute',
                                top: -4,
                                right: -4,
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                background: '#ef4444',
                                color: '#fff',
                                border: 'none',
                                fontSize: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Claim Details Input */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '6px', marginTop: '2px' }}>
                      <input
                        type="number"
                        placeholder="Claim Amount (₹)"
                        value={claimAmount}
                        onChange={(e) => setClaimAmount(e.target.value)}
                        style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                      />
                      <input
                        type="text"
                        placeholder="Myntra / Portal Claim Ticket ID (optional)"
                        value={claimId}
                        onChange={(e) => setClaimId(e.target.value)}
                        style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                      />
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Inspection remarks / cloth defect description..."
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    style={{ flex: 1, padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  />

                  <button
                    type="button"
                    onClick={handleConfirmReturn}
                    disabled={loading}
                    style={{
                      background: '#be123c',
                      color: '#ffffff',
                      border: 'none',
                      padding: '0.5rem 1.25rem',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Confirm Return & Restock
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* 📋 Live & Persistent Scans Activity History Register */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileSpreadsheet size={18} color="#0ea5e9" />
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Operations Scan Register</span>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '12px', background: '#ecfdf5', color: '#059669', border: '1px solid #bbf7d0', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                  MongoDB Data Store Active
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px' }}>
                Persistent history saved across all terminals • Click any row or cell to expand/collapse complete details • {displayedHistory.length}{displayedHistory.length !== scanHistory.length ? ` of ${scanHistory.length}` : ''} records loaded
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Quick search */}
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Filter by AWB / Pkg / SKU..."
                value={historySearchQuery}
                onChange={(e) => {
                  setHistorySearchQuery(e.target.value);
                  fetchHistoryAndStats(scanMode, e.target.value);
                }}
                style={{
                  padding: '5px 10px 5px 28px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.76rem',
                  outline: 'none',
                  width: '180px'
                }}
              />
            </div>

            {/* Refresh button */}
            <button
              type="button"
              onClick={() => fetchHistoryAndStats()}
              disabled={historyLoading}
              title="Refresh history from server"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 10px',
                borderRadius: '6px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={12} className={historyLoading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>

            {/* Export CSV button */}
            <button
              type="button"
              onClick={() => {
                if (!displayedHistory.length) return alert('No history records to export.');
                const headers = [
                  'Time', 'Date', 'AWB Code', 'Package Code', 'Order ID', 'Channel',
                  'SKU', 'Product Name', 'Brand', 'Size', 'Color',
                  'Customer Name', 'City', 'Payment Mode', 'Payment Status', 'Amount (INR)',
                  'Weight (g)', 'Courier', 'Screen / Mode', 'Operation Status', 'Operator'
                ];
                const rows = displayedHistory.map(h => [
                  `"${h.time || ''}"`,
                  `"${h.date || ''}"`,
                  `"${h.awb || ''}"`,
                  `"${h.shippingPackageCode || ''}"`,
                  `"${h.orderCode || ''}"`,
                  `"${h.channel || ''}"`,
                  `"${h.sku || ''}"`,
                  `"${(h.itemName || '').replace(/"/g, '""')}"`,
                  `"${h.brand || ''}"`,
                  `"${h.size || ''}"`,
                  `"${h.color || ''}"`,
                  `"${(h.customerName || '').replace(/"/g, '""')}"`,
                  `"${h.city || ''}"`,
                  `"${h.paymentMode || 'PREPAID'}"`,
                  `"${h.paymentStatus || 'PAID'}"`,
                  h.paymentMode === 'COD' ? (h.codAmount || h.price || 0) : (h.price || 0),
                  h.weightGrams || 0,
                  `"${h.courier || ''}"`,
                  `"${h.mode || ''}"`,
                  `"${h.status || ''}"`,
                  `"${h.operator || ''}"`
                ]);
                const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement('a');
                link.setAttribute('href', encodedUri);
                link.setAttribute('download', `Elite_Edition_Complete_3Screens_Scan_History_${new Date().toISOString().split('T')[0]}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              title="Download scan history as CSV with complete data"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 10px',
                borderRadius: '6px',
                background: '#0ea5e9',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#ffffff',
                cursor: 'pointer'
              }}
            >
              <FileDown size={12} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.73rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Timestamp</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>AWB & Package Code</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Order & Channel</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Product / SKU Details</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Customer & City</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Payment & Value</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Weight</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Courier</th>
                <th style={{ padding: '10px 12px', fontWeight: 800 }}>Screen / Mode</th>
                <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>Operation Status</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                if (displayedHistory.length === 0) {
                  return (
                    <tr>
                      <td colSpan={10} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                        <Scan size={24} style={{ margin: '0 auto 6px', color: '#cbd5e1' }} />
                        <div style={{ fontWeight: 600 }}>No scan operations match this filter.</div>
                        <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Scan or type an AWB like <strong>MYSC1359190430</strong> above to record live operations.</div>
                      </td>
                    </tr>
                  );
                }

                return displayedHistory.map((item) => {
                  const rowKey = String(item.awb || item.shippingPackageCode || item.orderCode || item.id || item._id || '').toUpperCase();
                  const isExpanded = expandedRowAwb === rowKey;
                  const isCod = item.paymentMode === 'COD' || item.isCod === true;
                  const itemImg = item.productImage || item.image || item.rawOrder?.productImage;

                  return (
                    <React.Fragment key={rowKey}>
                      <tr 
                        onClick={() => setExpandedRowAwb(prev => prev === rowKey ? null : rowKey)}
                        title="Click to expand / collapse full order details"
                        style={{ 
                          borderBottom: isExpanded ? 'none' : '1px solid #f1f5f9',
                          cursor: 'pointer',
                          backgroundColor: isExpanded ? '#f0f9ff' : 'transparent',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                        onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        {/* Timestamp + Expand Toggle */}
                        <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedRowAwb(prev => prev === rowKey ? null : rowKey);
                              }}
                              title={isExpanded ? "Collapse row" : "Expand row details"}
                              style={{
                                background: isExpanded ? '#0ea5e9' : '#f1f5f9',
                                border: `1px solid ${isExpanded ? '#0ea5e9' : '#cbd5e1'}`,
                                color: isExpanded ? '#ffffff' : '#64748b',
                                borderRadius: '4px',
                                width: '22px',
                                height: '22px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                padding: 0,
                                flexShrink: 0
                              }}
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            <div>
                              <div style={{ fontWeight: 600, color: '#334155' }}>{item.time}</div>
                              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{item.date}</div>
                            </div>
                          </div>
                        </td>

                        {/* AWB & Package Code */}
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 800, color: '#0ea5e9', fontFamily: 'monospace' }}>{item.awb}</div>
                          {item.shippingPackageCode && (
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569', marginTop: '2px', display: 'inline-block', background: '#f1f5f9', padding: '1px 5px', borderRadius: '3px', border: '1px solid #e2e8f0' }}>
                              Pkg: <strong style={{ color: '#0f172a' }}>{item.shippingPackageCode}</strong>
                            </div>
                          )}
                        </td>

                        {/* Order & Channel */}
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.78rem' }}>#{item.orderCode}</div>
                          {item.channel && (
                            <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: '#fdf2f8', color: '#db2777', border: '1px solid #fbcfe8', textTransform: 'uppercase', display: 'inline-block', marginTop: '2px' }}>
                              {item.channel}
                            </span>
                          )}
                        </td>

                        {/* Product / SKU Details */}
                        <td style={{ padding: '10px 12px', maxWidth: '220px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.8rem' }}>{item.sku}</span>
                            {item.brand && (
                              <span style={{ fontSize: '0.66rem', fontWeight: 800, padding: '1px 5px', borderRadius: '3px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
                                {item.brand}
                              </span>
                            )}
                          </div>
                          {item.itemName && (
                            <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.itemName}>
                              {item.itemName}
                            </div>
                          )}
                          {(item.size || item.color) && (
                            <div style={{ fontSize: '0.68rem', color: '#64748b', display: 'flex', gap: '6px', marginTop: '2px' }}>
                              {item.size && <span>Size: <strong>{item.size}</strong></span>}
                              {item.color && <span>Color: <strong>{item.color}</strong></span>}
                            </div>
                          )}
                        </td>

                        {/* Customer & City */}
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          {item.customerName ? (
                            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.76rem' }}>
                              👤 {item.customerName}
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>—</span>
                          )}
                          {item.city && (
                            <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '2px', marginTop: '2px' }}>
                              <MapPin size={11} color="#94a3b8" />
                              <span>{item.city}</span>
                            </div>
                          )}
                        </td>
                        
                        {/* Payment Column */}
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: isCod ? '#fef3c7' : '#ecfdf5',
                              color: isCod ? '#b45309' : '#047857',
                              border: `1px solid ${isCod ? '#fde68a' : '#a7f3d0'}`
                            }}>
                              {isCod ? '💵 COD' : '💳 PREPAID'}
                            </span>
                            {item.paymentStatus === 'PAID' ? (
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                <span>✓</span> Paid {item.price > 0 ? `(${fmtINR(item.price)})` : ''}
                              </span>
                            ) : item.paymentStatus === 'PENDING' ? (
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                <span>⏳</span> Pending {item.codAmount > 0 ? `(${fmtINR(item.codAmount)})` : (item.price > 0 ? `(${fmtINR(item.price)})` : '')}
                              </span>
                            ) : item.paymentStatus?.includes('REFUND') ? (
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7e22ce' }}>
                                ↺ Refund Pending
                              </span>
                            ) : item.paymentStatus === 'NOT_COLLECTED' ? (
                              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>
                                ✕ Not Collected (RTO)
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                {item.paymentStatus || 'Settled'}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Weight */}
                        <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
                          {item.weightGrams ? `${item.weightGrams}g` : '—'}
                        </td>

                        {/* Courier */}
                        <td style={{ padding: '10px 12px', color: '#475569', fontSize: '0.76rem' }}>
                          {item.courier || 'Logistics'}
                        </td>

                        {/* Screen / Mode */}
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          {(() => {
                            const upperAwb = String(item.awb || '').toUpperCase();
                            const isReturnRow = item.mode === 'RETURN' ||
                              item.mode === 'RTO' ||
                              item.isReturn ||
                              upperAwb.startsWith('MYSR') ||
                              upperAwb.startsWith('RPC') ||
                              upperAwb.startsWith('RP') ||
                              upperAwb.startsWith('FMPR') ||
                              upperAwb.startsWith('RET');

                            if (isReturnRow) {
                              return (
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: '#ffe4e6', color: '#be123c', border: '1px solid #fecdd3' }}>
                                  🔄 Screen 3: Return
                                </span>
                              );
                            }
                            if (item.mode === 'LOOKUP' || item.mode === 'ALL') {
                              return (
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                                  🔍 Screen 1: Auto
                                </span>
                              );
                            }
                            if (item.mode === 'PACK' || item.mode === 'DISPATCH') {
                              return (
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd' }}>
                                  📦 Screen 2: Dispatch
                                </span>
                              );
                            }
                            if (item.mode === 'DELIVERY') {
                              return (
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                                  🚚 Delivery
                                </span>
                              );
                            }
                            return (
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: '#f1f5f9', color: '#475569' }}>
                                {item.mode}
                              </span>
                            );
                          })()}
                        </td>

                        {/* Operation Status */}
                        <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: item.status?.includes('RESTOCK')
                              ? '#ecfdf5'
                              : item.status?.includes('PACK') || item.status?.includes('DISPATCH')
                              ? '#eff6ff'
                              : item.status?.includes('DELIVER')
                              ? '#f0fdf4'
                              : item.status?.includes('RETURN') || item.status?.includes('RTO')
                              ? '#fff1f2'
                              : '#f8fafc',
                            color: item.status?.includes('RESTOCK')
                              ? '#059669'
                              : item.status?.includes('PACK') || item.status?.includes('DISPATCH')
                              ? '#0284c7'
                              : item.status?.includes('DELIVER')
                              ? '#16a34a'
                              : item.status?.includes('RETURN') || item.status?.includes('RTO')
                              ? '#be123c'
                              : '#475569',
                            border: '1px solid rgba(0,0,0,0.06)'
                          }}>
                            {item.status}
                          </span>
                        </td>
                      </tr>

                      {/* 🔽 INLINE EXPANDED ACCORDION ROW */}
                      {isExpanded && (
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                          <td colSpan={10} style={{ padding: '1rem 1.25rem' }}>
                            <div style={{
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '12px',
                              padding: '1.25rem',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '1rem'
                            }}>
                              {/* Top Bar of Expanded Dossier */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0ea5e9', background: '#e0f2fe', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>
                                    AWB: {item.awb}
                                  </span>
                                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a' }}>
                                    Order #{item.orderCode}
                                  </span>
                                  {item.channel && (
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 7px', borderRadius: '4px', background: '#fdf2f8', color: '#db2777', border: '1px solid #fbcfe8' }}>
                                      {item.channel}
                                    </span>
                                  )}
                                  {item.brand && (
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 7px', borderRadius: '4px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
                                      {item.brand}
                                    </span>
                                  )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenRecordDetails(item);
                                    }}
                                    style={{
                                      background: '#f8fafc',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '6px',
                                      padding: '4px 10px',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      color: '#475569',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    <FileText size={12} color="#0ea5e9" />
                                    <span>Full Audit Modal</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedRowAwb(null);
                                    }}
                                    style={{
                                      background: '#f1f5f9',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '6px',
                                      padding: '4px 10px',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      color: '#64748b',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    <ChevronUp size={13} />
                                    <span>Collapse</span>
                                  </button>
                                </div>
                              </div>

                              {/* Item & Product Details Strip */}
                              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                {itemImg ? (
                                  <div style={{ width: 68, height: 68, borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1', flexShrink: 0 }}>
                                    <img src={itemImg} alt={item.sku} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  </div>
                                ) : (
                                  <div style={{ width: 68, height: 68, borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', flexShrink: 0, border: '1px solid #e2e8f0' }}>
                                    <Boxes size={26} />
                                  </div>
                                )}

                                <div style={{ flex: 1, minWidth: '220px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                                      {item.sku}
                                    </span>
                                    {item.size && (
                                      <span style={{ fontSize: '0.72rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                        Size: <strong style={{ color: '#0f172a' }}>{item.size}</strong>
                                      </span>
                                    )}
                                    {item.color && (
                                      <span style={{ fontSize: '0.72rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                        Color: <strong style={{ color: '#0f172a' }}>{item.color}</strong>
                                      </span>
                                    )}
                                    {item.shippingPackageCode && (
                                      <span style={{ fontSize: '0.72rem', background: '#f8fafc', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                        Package: <strong style={{ fontFamily: 'monospace', color: '#0284c7' }}>{item.shippingPackageCode}</strong>
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginTop: '3px' }}>
                                    {item.itemName || 'Garment / Apparel Item'}
                                  </div>
                                  <div style={{ fontSize: '0.73rem', color: '#64748b', display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                                    <span>Courier: <strong>{item.courier || 'Logistics'}</strong></span>
                                    <span>Weight: <strong>{item.weightGrams ? `${item.weightGrams}g` : 'Standard'}</strong></span>
                                    {item.customerName && <span>Recipient: <strong>{item.customerName}</strong></span>}
                                    {item.city && <span>Destination: <strong>{item.city}{item.state ? `, ${item.state}` : ''}</strong></span>}
                                  </div>
                                </div>
                              </div>

                              {/* 📅 4 Lifecycle Auto-Date Timestamps */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.74rem' }}>
                                <div>
                                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>Order Date:</span>
                                  <strong style={{ color: '#0f172a' }}>
                                    {item.orderDate ? new Date(item.orderDate).toLocaleString('en-IN') : (item.date ? `${item.date} ${item.time}` : 'Recorded')}
                                  </strong>
                                </div>
                                <div>
                                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>Dispatch Date:</span>
                                  <strong style={{ color: '#0ea5e9' }}>
                                    {item.dispatchDate ? new Date(item.dispatchDate).toLocaleString('en-IN') : (item.mode === 'PACK' || item.mode === 'DISPATCH' ? `${item.date} ${item.time}` : 'Stamped on Dispatch')}
                                  </strong>
                                </div>
                                <div>
                                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>Delivery Date:</span>
                                  <strong style={{ color: '#10b981' }}>
                                    {item.deliveryDate || item.deliveryTime ? new Date(item.deliveryDate || item.deliveryTime).toLocaleString('en-IN') : (item.status?.includes('DELIVER') ? `${item.date} ${item.time}` : 'In-Transit')}
                                  </strong>
                                </div>
                                <div>
                                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>Return Date:</span>
                                  <strong style={{ color: '#f43f5e' }}>
                                    {item.returnDate ? new Date(item.returnDate).toLocaleString('en-IN') : (item.mode === 'RETURN' || item.isReturn ? `${item.date} ${item.time}` : 'Not Returned')}
                                  </strong>
                                </div>
                              </div>

                              {/* 💰 Dedicated Payment & Financial Details Strip */}
                              <div style={{
                                background: isCod ? '#fffbeb' : '#f0fdf4',
                                border: `1px solid ${isCod ? '#fde68a' : '#bbf7d0'}`,
                                borderRadius: '8px',
                                padding: '0.65rem 0.9rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '10px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '6px',
                                    background: isCod ? '#fef3c7' : '#dcfce7',
                                    color: isCod ? '#b45309' : '#15803d',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 900,
                                    fontSize: '0.85rem'
                                  }}>
                                    {isCod ? '₹' : '✓'}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: isCod ? '#b45309' : '#15803d', textTransform: 'uppercase' }}>
                                      {isCod ? 'Cash on Delivery (COD)' : 'Prepaid Order (Online Paid)'}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#475569' }}>
                                      Status: <strong style={{ color: item.paymentStatus === 'PAID' ? '#15803d' : '#b45309' }}>
                                        {item.paymentStatus === 'PAID' ? 'Collected / Paid' : (isCod ? 'Pending Collection on Delivery' : (item.paymentStatus || 'Settled'))}
                                      </strong>
                                    </div>
                                  </div>
                                </div>

                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: '0.66rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                                    {isCod ? 'COD Collectable Amount' : 'Order Total Value'}
                                  </div>
                                  <div style={{ fontSize: '1.05rem', fontWeight: 900, color: isCod ? '#b45309' : '#15803d' }}>
                                    {item.price > 0 ? fmtINR(item.price) : (item.codAmount > 0 ? fmtINR(item.codAmount) : '—')}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>


      {/* ────────────────────────────────────────────────────────────────────────
          MODAL 2: 📸 Station Webcam Shutter
      ──────────────────────────────────────────────────────────────────────── */}
      {showCameraModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{ background: '#1e293b', borderRadius: '16px', overflow: 'hidden', maxWidth: '640px', width: '100%', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.9rem' }}>
                Station Camera — Snap Return Defect / Wrong Item
              </span>
              <button type="button" onClick={stopCamera} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ position: 'relative', width: '100%', height: '360px', background: '#000' }}>
              <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{ padding: '1rem', display: 'flex', justifyContent: 'center', gap: '1rem', background: '#0f172a' }}>
              <button
                type="button"
                onClick={captureSnapshot}
                style={{
                  background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '0.65rem 1.75rem',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <Camera size={18} />
                <span>Capture Shutter</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          MODAL 3: 📋 Daily Courier Handover Manifest
      ──────────────────────────────────────────────────────────────────────── */}
      {showManifestModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '850px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#0ea5e915', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9' }}>
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                    Daily Courier Pickup Handover Manifest
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Official run-sheet for Ekart, Delhivery, Blue Dart & Shadowfax pickup vans
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setShowManifestModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '0.85rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => { setManifestTab('PENDING'); fetchManifestPending(); }}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: manifestTab === 'PENDING' ? '#0ea5e9' : '#e2e8f0',
                    color: manifestTab === 'PENDING' ? '#fff' : '#475569',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Ready for Handover
                </button>
                <button
                  type="button"
                  onClick={() => { setManifestTab('HISTORY'); fetchPastManifests(); }}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: manifestTab === 'HISTORY' ? '#0ea5e9' : '#e2e8f0',
                    color: manifestTab === 'HISTORY' ? '#fff' : '#475569',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Past Generated Manifests
                </button>
              </div>

              {manifestTab === 'PENDING' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <DateRangePicker
                    preset={manifestDatePreset}
                    onChange={({ preset: p, dateStart: ds, dateEnd: de }) => {
                      setManifestDatePreset(p);
                      setManifestStartDate(ds || '');
                      setManifestEndDate(de || '');
                      fetchManifestPending({ startDate: ds, endDate: de });
                    }}
                    customStart={manifestStartDate}
                    customEnd={manifestEndDate}
                    onCustomChange={(s, e) => {
                      setManifestStartDate(s);
                      setManifestEndDate(e);
                    }}
                  />

                  <UnifiedFilterPopover
                    categories={manifestFilterCategories}
                    activeFilters={manifestFilters}
                    onChange={(newFilters) => {
                      setManifestFilters(newFilters);
                      fetchManifestPending({
                        courier: (newFilters.courier || []).join(','),
                        channel: (newFilters.channel || []).join(',')
                      });
                    }}
                    onClear={() => {
                      setManifestFilters({});
                      fetchManifestPending({ courier: '', channel: '' });
                    }}
                    placeholder="Filters"
                    showChips={false}
                  />

                  <button
                    type="button"
                    onClick={() => fetchManifestPending()}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      background: '#0ea5e9',
                      color: '#fff',
                      border: 'none',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <RefreshCw size={12} className={manifestLoading ? 'spin' : ''} />
                    <span>Apply</span>
                  </button>
                </div>
              )}
            </div>

            <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {manifestTab === 'PENDING' ? (
                <>
                  <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '2px' }}>
                        Pickup Driver Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Ramesh Kumar"
                        value={manifestDriverName}
                        onChange={(e) => setManifestDriverName(e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '2px' }}>
                        Driver Mobile No
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 9876543210"
                        value={manifestDriverPhone}
                        onChange={(e) => setManifestDriverPhone(e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '2px' }}>
                        Vehicle / Van Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. GJ-05-XX-1234"
                        value={manifestVehicleNumber}
                        onChange={(e) => setManifestVehicleNumber(e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                      />
                    </div>
                  </div>

                  {!manifestPendingData || manifestPendingData.groups?.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                      No dispatched packages found for handover on this date.
                    </div>
                  ) : (
                    manifestPendingData.groups.map((grp, idx) => (
                      <div key={idx} style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                              {grp.courier}
                            </span>
                            <span style={{ marginLeft: '10px', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#eff6ff', color: '#2563eb' }}>
                              {grp.count} Parcels Ready
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleGenerateManifest(grp.courier, grp.orders)}
                            style={{
                              background: '#0ea5e9',
                              color: '#fff',
                              border: 'none',
                              padding: '6px 14px',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Printer size={13} />
                            <span>Generate & Print Run-Sheet</span>
                          </button>
                        </div>

                        <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '6px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', color: '#64748b' }}>
                                <th style={{ padding: '6px 8px', textAlign: 'left' }}>AWB Code</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Order ID</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left' }}>SKU</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left' }}>City</th>
                              </tr>
                            </thead>
                            <tbody>
                              {grp.orders.map((o, oIdx) => (
                                <tr key={oIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0ea5e9' }}>{o.awb}</td>
                                  <td style={{ padding: '6px 8px' }}>#{o.displayOrderCode}</td>
                                  <td style={{ padding: '6px 8px' }}>{o.sku}</td>
                                  <td style={{ padding: '6px 8px', color: '#64748b' }}>{o.city || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))
                  )}
                </>
              ) : (
                pastManifests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    No past manifests saved yet.
                  </div>
                ) : (
                  pastManifests.map((mnf) => (
                    <div key={mnf._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0ea5e9' }}>
                          {mnf.manifestId} — {mnf.courier}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                          Driver: {mnf.pickupDriverName || 'N/A'} ({mnf.pickupDriverPhone || 'No Phone'}) | Packages: {mnf.totalPackages} | Date: {new Date(mnf.createdAt).toLocaleString('en-IN')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActivePrintManifest(mnf)}
                        style={{ padding: '4px 10px', borderRadius: '4px', background: '#0ea5e9', color: '#fff', border: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Printer size={12} />
                        <span>Print</span>
                      </button>
                    </div>
                  ))
                )
              )}

            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          MODAL 4: 📊 Bulk Delivery MIS Excel Importer
      ──────────────────────────────────────────────────────────────────────── */}
      {showBulkDeliveryModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '560px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: bulkActionType === 'RETURN' ? '#f43f5e15' : bulkActionType === 'DISPATCH' ? '#0ea5e915' : '#10b98115',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: bulkActionType === 'RETURN' ? '#f43f5e' : bulkActionType === 'DISPATCH' ? '#0ea5e9' : '#10b981'
                }}>
                  <CheckCheck size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                    Multi-AWB Batch Operations (50–500 Parcels)
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Process hundreds of AWBs simultaneously in 1 second from Excel or Courier MIS
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setShowBulkDeliveryModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Batch Action Selector */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>
                  Select Batch Operation Action
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setBulkActionType('DELIVERY')}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      border: '1.5px solid',
                      borderColor: bulkActionType === 'DELIVERY' ? '#10b981' : '#cbd5e1',
                      background: bulkActionType === 'DELIVERY' ? '#ecfdf5' : '#ffffff',
                      color: bulkActionType === 'DELIVERY' ? '#065f46' : '#475569',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    🚚 Mark DELIVERED
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkActionType('RETURN')}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      border: '1.5px solid',
                      borderColor: bulkActionType === 'RETURN' ? '#f43f5e' : '#cbd5e1',
                      background: bulkActionType === 'RETURN' ? '#fff1f2' : '#ffffff',
                      color: bulkActionType === 'RETURN' ? '#9f1239' : '#475569',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    🔄 Mark RETURN / RTO
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkActionType('DISPATCH')}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      border: '1.5px solid',
                      borderColor: bulkActionType === 'DISPATCH' ? '#0ea5e9' : '#cbd5e1',
                      background: bulkActionType === 'DISPATCH' ? '#f0f9ff' : '#ffffff',
                      color: bulkActionType === 'DISPATCH' ? '#075985' : '#475569',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    📦 Mark DISPATCHED
                  </button>
                </div>
              </div>

              {bulkActionType === 'DELIVERY' && (
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Delivery Date to Stamp
                  </label>
                  <input
                    type="date"
                    value={bulkDeliveryDate}
                    onChange={(e) => setBulkDeliveryDate(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Paste AWB Codes (One per line, comma or space-separated)
                </label>
                <textarea
                  rows={8}
                  placeholder="Paste list of 50-500 AWBs from Excel or manifest:&#10;14324832049&#10;14324832050&#10;14324832051&#10;MYSC1359190430&#10;..."
                  value={bulkAwbText}
                  onChange={(e) => setBulkAwbText(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontFamily: 'monospace' }}
                />
                <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: '2px' }}>
                  {bulkAwbText.split(/[\r\n,;]+/).filter(s => s.trim()).length} unique codes detected
                </span>
              </div>

              {bulkResult && (
                <div style={{
                  background: bulkResult.success ? '#ecfdf5' : '#fef2f2',
                  border: `1px solid ${bulkResult.success ? '#a7f3d0' : '#fecaca'}`,
                  padding: '0.75rem',
                  borderRadius: '8px',
                  color: bulkResult.success ? '#065f46' : '#991b1b',
                  fontSize: '0.82rem',
                  fontWeight: 700
                }}>
                  {bulkResult.message || (bulkResult.success ? 'Batch processed successfully!' : 'Error processing batch')}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowBulkDeliveryModal(false)}
                  style={{ padding: '0.6rem 1rem', borderRadius: '8px', background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkDeliverSubmit}
                  disabled={bulkProcessing || !bulkAwbText.trim()}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    background: bulkActionType === 'RETURN' ? '#f43f5e' : bulkActionType === 'DISPATCH' ? '#0ea5e9' : '#10b981',
                    color: '#fff',
                    border: 'none',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: bulkProcessing || !bulkAwbText.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {bulkProcessing ? <RefreshCw size={14} className="spin-loader" /> : <CheckCheck size={14} />}
                  <span>
                    {bulkProcessing
                      ? 'Processing Batch...'
                      : `Execute Bulk ${bulkActionType === 'RETURN' ? 'Return Inward' : bulkActionType === 'DISPATCH' ? 'Dispatch' : 'Delivery'}`}
                  </span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          MODAL 5: 📈 Courier Performance & RTO Rate Analytics Modal
      ──────────────────────────────────────────────────────────────────────── */}
      {showAnalyticsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '750px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#a855f715', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7' }}>
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                    Courier SLA & RTO Performance Analytics
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Compare transit success, RTO percentages & SPF Claim recovery
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setShowAnalyticsModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* ── 🎯 Courier Analytics Multi-Filter Bar ── */}
            <div style={{
              padding: '0.85rem 1.5rem',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              {/* Row: DateRangePicker, Multi-Filters & Update Analytics */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <DateRangePicker
                    preset={analyticsDatePreset}
                    onChange={({ preset: p, dateStart: ds, dateEnd: de }) => {
                      setAnalyticsDatePreset(p);
                      setAnalyticsStartDate(ds || '');
                      setAnalyticsEndDate(de || '');
                      openAnalytics({ startDate: ds, endDate: de });
                    }}
                    customStart={analyticsStartDate}
                    customEnd={analyticsEndDate}
                    onCustomChange={(s, e) => {
                      setAnalyticsStartDate(s);
                      setAnalyticsEndDate(e);
                    }}
                  />

                  <UnifiedFilterPopover
                    categories={analyticsFilterCategories}
                    activeFilters={analyticsFilters}
                    onChange={(newFilters) => {
                      setAnalyticsFilters(newFilters);
                      openAnalytics({
                        courier: (newFilters.courier || []).join(','),
                        channel: (newFilters.channel || []).join(',')
                      });
                    }}
                    onClear={() => {
                      setAnalyticsFilters({});
                      openAnalytics({ courier: '', channel: '' });
                    }}
                    placeholder="Filters"
                    showChips={false}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => openAnalytics()}
                  disabled={analyticsLoading}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                    color: '#fff',
                    border: 'none',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <RefreshCw size={12} className={analyticsLoading ? 'spin' : ''} />
                  <span>Update Analytics</span>
                </button>
              </div>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {analyticsLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  <RefreshCw size={24} className="spin-loader" style={{ margin: '0 auto 8px' }} />
                  <div>Loading courier metrics...</div>
                </div>
              ) : analyticsData?.overview ? (
                <>
                  {/* Top Overview Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                    <div style={{ background: '#eff6ff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Total Dispatched</span>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#2563eb', marginTop: '2px' }}>{analyticsData.overview.totalDispatched}</div>
                    </div>
                    <div style={{ background: '#ecfdf5', padding: '0.85rem', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#065f46', textTransform: 'uppercase' }}>Delivered</span>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#10b981', marginTop: '2px' }}>{analyticsData.overview.totalDelivered}</div>
                    </div>
                    <div style={{ background: '#fff1f2', padding: '0.85rem', borderRadius: '8px', border: '1px solid #fecdd3' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#be123c', textTransform: 'uppercase' }}>Overall RTO Rate</span>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#f43f5e', marginTop: '2px' }}>{analyticsData.overview.overallRtoRate}%</div>
                    </div>
                    <div style={{ background: '#faf5ff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6b21a8', textTransform: 'uppercase' }}>SPF Claims Value</span>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#a855f7', marginTop: '2px' }}>{fmtINR(analyticsData.overview.totalClaimAmount)}</div>
                    </div>
                  </div>

                  {/* Courier Breakdown Table */}
                  <div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      Partner SLA & Delivery Efficiency
                    </span>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Courier Partner</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Dispatched</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Delivered</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Returned</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Success Rate</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>RTO %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyticsData.couriers?.map((c, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>{c.courier}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{c.dispatched}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', color: '#10b981', fontWeight: 700 }}>{c.delivered}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', color: '#ef4444', fontWeight: 700 }}>{c.returned}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: '#ecfdf5', color: '#059669' }}>
                                {c.deliveryRate}%
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: c.rtoRate > 20 ? '#fee2e2' : '#f8fafc', color: c.rtoRate > 20 ? '#dc2626' : '#475569' }}>
                                {c.rtoRate}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          MODAL 6: 🏷️ Thermal Barcode Tag Sticker Printer (50x25mm)
      ──────────────────────────────────────────────────────────────────────── */}
      {showBarcodeTagModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '460px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tag size={18} color="#0ea5e9" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                  Thermal Barcode Sticker Tag
                </h3>
              </div>
              <button type="button" onClick={() => setShowBarcodeTagModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
              
              {/* Thermal Label Preview (50x25mm / 2x1 inch ratio) */}
              <div id="thermal-barcode-tag" style={{
                width: '280px',
                height: '140px',
                border: '2px dashed #000',
                borderRadius: '6px',
                padding: '10px 12px',
                background: '#ffffff',
                color: '#000000',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.05em' }}>
                    {barcodeTagData.brand || ''}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 700, border: '1px solid #000', padding: '1px 4px', borderRadius: '2px' }}>
                    SIZE: {barcodeTagData.size || 'M'}
                  </span>
                </div>

                <div style={{ textAlign: 'center', margin: '2px 0' }}>
                  {/* High Contrast Barcode Representation */}
                  <div style={{
                    height: '34px',
                    background: 'repeating-linear-gradient(90deg, #000 0px, #000 2px, #fff 2px, #fff 4px, #000 4px, #000 7px, #fff 7px, #fff 9px)',
                    margin: '0 auto',
                    width: '85%'
                  }} />
                  <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.15em', fontFamily: 'monospace' }}>
                    {barcodeTagData.barcode || barcodeTagData.sku}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '9.5px', borderTop: '1px solid #000', paddingTop: '3px' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>SKU: {barcodeTagData.sku}</div>
                    {barcodeTagData.color && <div style={{ fontSize: '8.5px', color: '#444' }}>Color: {barcodeTagData.color}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', fontWeight: 900 }}>MRP: ₹ {barcodeTagData.mrp}</div>
                    <div style={{ fontSize: '7px', color: '#666' }}>Inc. of all taxes</div>
                  </div>
                </div>
              </div>

              {/* Tag Controls */}
              <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>Brand / Entity</label>
                  <input
                    type="text"
                    value={barcodeTagData.brand}
                    onChange={(e) => setBarcodeTagData({ ...barcodeTagData, brand: e.target.value })}
                    style={{ width: '100%', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>SKU Code</label>
                  <input
                    type="text"
                    value={barcodeTagData.sku}
                    onChange={(e) => setBarcodeTagData({ ...barcodeTagData, sku: e.target.value })}
                    style={{ width: '100%', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>Size</label>
                  <input
                    type="text"
                    value={barcodeTagData.size}
                    onChange={(e) => setBarcodeTagData({ ...barcodeTagData, size: e.target.value })}
                    style={{ width: '100%', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>MRP (₹)</label>
                  <input
                    type="number"
                    value={barcodeTagData.mrp}
                    onChange={(e) => setBarcodeTagData({ ...barcodeTagData, mrp: e.target.value })}
                    style={{ width: '100%', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowBarcodeTagModal(false)}
                  style={{ padding: '6px 12px', borderRadius: '6px', background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{ padding: '6px 16px', borderRadius: '6px', background: '#000000', color: '#ffffff', border: 'none', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Printer size={14} />
                  <span>Print to Thermal Printer</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          MODAL 7: 📄 SPF Return Claim Dossier Viewer & Editor
      ──────────────────────────────────────────────────────────────────────── */}
      {selectedClaimRecord && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '620px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f43f5e15', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f43f5e' }}>
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                    SPF Claim Evidence & Dispute Dossier
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    AWB: {selectedClaimRecord.referenceId} | Order #{selectedClaimRecord.displayOrderId}
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedClaimRecord(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Photo Evidence Gallery */}
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>
                  Damaged / Wrong Item Photos ({selectedClaimRecord.images?.length || 0})
                </span>
                {selectedClaimRecord.images?.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
                    {selectedClaimRecord.images.map((img, i) => (
                      <a key={i} href={img} target="_blank" rel="noreferrer" style={{ display: 'block', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                        <img src={img} alt={`Proof ${i}`} style={{ width: '100%', height: '80px', objectFit: 'cover' }} />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '6px', textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>
                    No photos were attached during scan.
                  </div>
                )}
              </div>

              {/* Status and Claim ID */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '2px' }}>
                    Claim Status
                  </label>
                  <select
                    value={selectedClaimRecord.claimStatus || 'CLAIM_PENDING'}
                    onChange={(e) => setSelectedClaimRecord({ ...selectedClaimRecord, claimStatus: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  >
                    <option value="CLAIM_PENDING">Pending Submission</option>
                    <option value="CLAIM_SUBMITTED">Submitted to Marketplace</option>
                    <option value="CLAIM_APPROVED">Approved & Reimbursed</option>
                    <option value="CLAIM_REJECTED">Rejected by Courier/Platform</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '2px' }}>
                    Claim Ticket / Case ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SPF-MYNTRA-98421"
                    value={selectedClaimRecord.claimId || ''}
                    onChange={(e) => setSelectedClaimRecord({ ...selectedClaimRecord, claimId: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '2px' }}>
                  Claim Amount (₹)
                </label>
                <input
                  type="number"
                  value={selectedClaimRecord.claimAmount || 0}
                  onChange={(e) => setSelectedClaimRecord({ ...selectedClaimRecord, claimAmount: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '2px' }}>
                  Dispute & Investigation Notes
                </label>
                <textarea
                  rows={3}
                  value={selectedClaimRecord.claimNotes || ''}
                  onChange={(e) => setSelectedClaimRecord({ ...selectedClaimRecord, claimNotes: e.target.value })}
                  placeholder="Record communication with Flipkart/Myntra SPF manager..."
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectedClaimRecord(null)}
                  style={{ padding: '0.5rem 1rem', borderRadius: '6px', background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveClaimDetails}
                  disabled={savingClaim}
                  style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', background: '#0ea5e9', color: '#fff', border: 'none', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  {savingClaim ? 'Saving...' : 'Save Claim Updates'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          PRINT TEMPLATE: 🖨️ Official Printable Handover Manifest
      ──────────────────────────────────────────────────────────────────────── */}
      {activePrintManifest && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          zIndex: 99999,
          overflowY: 'auto',
          padding: '2rem 1rem',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <div style={{ background: '#fff', maxWidth: '800px', width: '100%', padding: '2.5rem', borderRadius: '8px', color: '#000', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase' }}>
                COURIER PICKUP HANDOVER MANIFEST
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{ background: '#000', color: '#fff', padding: '6px 14px', borderRadius: '4px', border: 'none', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Printer size={14} />
                  <span>Print Manifest</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePrintManifest(null)}
                  style={{ background: '#e2e8f0', color: '#000', padding: '6px 14px', borderRadius: '4px', border: 'none', fontWeight: 800, cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
              <div>
                <div><strong>Manifest ID:</strong> {activePrintManifest.manifestId}</div>
                <div><strong>Date & Time:</strong> {new Date(activePrintManifest.createdAt).toLocaleString('en-IN')}</div>
                <div><strong>Transporter / Courier:</strong> {activePrintManifest.courier}</div>
                <div><strong>Fulfillment Warehouse:</strong> {activePrintManifest.facility || 'WH-MAIN (Surat)'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div><strong>Pickup Driver:</strong> {activePrintManifest.pickupDriverName || 'N/A'}</div>
                <div><strong>Driver Phone:</strong> {activePrintManifest.pickupDriverPhone || 'N/A'}</div>
                <div><strong>Vehicle Number:</strong> {activePrintManifest.vehicleNumber || 'N/A'}</div>
                <div><strong>Total Package Count:</strong> <span style={{ fontSize: '1.1rem', fontWeight: 900 }}>{activePrintManifest.totalPackages}</span></div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', border: '1px solid #000', marginTop: '0.5rem' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #000' }}>
                  <th style={{ padding: '6px 8px', borderRight: '1px solid #000', textAlign: 'center', width: '35px' }}>#</th>
                  <th style={{ padding: '6px 8px', borderRight: '1px solid #000', textAlign: 'left' }}>AWB Tracking Number</th>
                  <th style={{ padding: '6px 8px', borderRight: '1px solid #000', textAlign: 'left' }}>Order ID</th>
                  <th style={{ padding: '6px 8px', borderRight: '1px solid #000', textAlign: 'left' }}>SKU Code</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Destination City</th>
                </tr>
              </thead>
              <tbody>
                {activePrintManifest.packages?.map((pkg, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #ccc' }}>
                    <td style={{ padding: '6px 8px', borderRight: '1px solid #ccc', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ padding: '6px 8px', borderRight: '1px solid #ccc', fontFamily: 'monospace', fontWeight: 800 }}>{pkg.awb}</td>
                    <td style={{ padding: '6px 8px', borderRight: '1px solid #ccc' }}>#{pkg.displayOrderCode}</td>
                    <td style={{ padding: '6px 8px', borderRight: '1px solid #ccc' }}>{pkg.sku}</td>
                    <td style={{ padding: '6px 8px' }}>{pkg.city || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: '2.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', fontSize: '0.85rem' }}>
              <div style={{ borderTop: '1px solid #000', paddingTop: '0.5rem', textAlign: 'center' }}>
                <strong>Warehouse Dispatch Supervisor</strong>
                <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '2px' }}>Signature & Stamp</div>
              </div>
              <div style={{ borderTop: '1px solid #000', paddingTop: '0.5rem', textAlign: 'center' }}>
                <strong>Courier Pickup Driver Acknowledgment</strong>
                <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '2px' }}>
                  "I confirm receipt of {activePrintManifest.totalPackages} sealed packets in good condition"
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          MODAL 8: 🔍 Complete Order & Operation Dossier Modal
      ──────────────────────────────────────────────────────────────────────── */}
      {selectedRecordDetails && (() => {
        const rec = { ...selectedRecordDetails, ...(fullOrderDetails || {}) };
        const isCod = rec.paymentMode === 'COD' || rec.isCod === true;
        const displayCode = rec.displayOrderCode || rec.orderCode || '—';
        const awbCode = rec.awb || '—';
        const skuCode = rec.sku || rec.itemSKUCode || '—';
        const pkgCode = rec.shippingPackageCode || '—';
        const invoiceCode = rec.invoiceCode || '—';
        const hasPhotos = (rec.returnRecord?.images?.length || rec.images?.length || 0) > 0;
        const photoList = rec.returnRecord?.images || rec.images || [];

        return (
          <div
            onClick={() => setSelectedRecordDetails(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(5px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1.25rem'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                maxWidth: '840px',
                width: '100%',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                overflow: 'hidden',
                border: '1px solid #cbd5e1'
              }}
            >
              {/* Modal Header */}
              <div style={{
                padding: '1.2rem 1.5rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: '#0ea5e91a',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <PackageCheck size={22} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                        Complete Record Dossier
                      </h3>
                      {rec.channel && (
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: '#fdf2f8', color: '#db2777', border: '1px solid #fbcfe8', textTransform: 'uppercase' }}>
                          {rec.channel}
                        </span>
                      )}
                      {rec.orderClassificationLabel ? (
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '1px 7px', borderRadius: '4px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                          {rec.orderClassificationLabel}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '1px 7px', borderRadius: '4px', background: '#f1f5f9', color: '#475569' }}>
                          {rec.mode || 'OPERATIONS'}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>Order: <strong style={{ color: '#0f172a' }}>#{displayCode}</strong></span>
                      <span>•</span>
                      <span>AWB: <strong style={{ color: '#0ea5e9', fontFamily: 'monospace' }}>{awbCode}</strong></span>
                      {recordDetailsLoading && (
                        <span style={{ fontSize: '0.68rem', color: '#0284c7', background: '#e0f2fe', padding: '1px 6px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <RefreshCw size={10} className="spin" /> Fetching live OMS details...
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedRecordDetails(null)}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body - Scrollable */}
              <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: 'calc(90vh - 140px)' }}>

                {/* 4 Summary Highlight Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  
                  {/* Card 1: Payment & Pricing */}
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Payment & Value</span>
                      <span style={{
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        background: isCod ? '#fef3c7' : '#ecfdf5',
                        color: isCod ? '#b45309' : '#047857',
                        border: `1px solid ${isCod ? '#fde68a' : '#a7f3d0'}`
                      }}>
                        {isCod ? '💵 COD' : '💳 PREPAID'}
                      </span>
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>
                      {fmtINR(rec.price || 0)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div>Status: <strong style={{ color: rec.paymentStatus === 'PAID' ? '#15803d' : '#b45309' }}>{rec.paymentStatusLabel || rec.paymentStatus || (isCod ? 'Pending Collection' : 'Paid')}</strong></div>
                      {isCod && <div>COD Collect: <strong>{fmtINR(rec.codAmount || rec.price || 0)}</strong></div>}
                      {rec.mrp > 0 && <div style={{ color: '#94a3b8' }}>MRP: <s>{fmtINR(rec.mrp)}</s></div>}
                    </div>
                  </div>

                  {/* Card 2: Courier & Logistics */}
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Logistics & 3PL</span>
                      <Truck size={14} color="#0284c7" />
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                      {rec.courier || 'Logistics Partner'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div>Weight: <strong>{rec.weightGrams ? `${rec.weightGrams}g` : 'Standard'}</strong></div>
                      {rec.returnWeightGrams > 0 && <div>Return Weight: <strong>{rec.returnWeightGrams}g</strong></div>}
                      <div>Pkg Code: <strong style={{ fontFamily: 'monospace' }}>{pkgCode}</strong></div>
                      {invoiceCode !== '—' && <div>Invoice: <strong style={{ fontFamily: 'monospace' }}>{invoiceCode}</strong></div>}
                    </div>
                  </div>

                  {/* Card 3: Milestone & Stage */}
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Status & Stage</span>
                      <Clock size={14} color="#6366f1" />
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#4338ca' }}>
                      {rec.status || rec.currentStage || 'DISPATCHED'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div>Scan Mode: <strong>{rec.mode || 'PACK'}</strong></div>
                      <div>Scan Time: <strong>{rec.time} {rec.date}</strong></div>
                      {rec.dispatchDate && <div>Dispatched: <strong>{new Date(rec.dispatchDate).toLocaleDateString('en-IN')}</strong></div>}
                      {rec.deliveryTime && <div>Delivered: <strong>{new Date(rec.deliveryTime).toLocaleDateString('en-IN')}</strong></div>}
                    </div>
                  </div>

                  {/* Card 4: Destination & Customer */}
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Destination</span>
                      <MapPin size={14} color="#e11d48" />
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                      {rec.city || 'Domestic'} {rec.state ? `, ${rec.state}` : ''}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div>Recipient: <strong>{rec.customerName || 'Customer'}</strong></div>
                      {rec.customerPhone && <div>Phone: <strong>{rec.customerPhone}</strong></div>}
                      {rec.pincode && <div>Pincode: <strong>{rec.pincode}</strong></div>}
                    </div>
                  </div>

                </div>

                {/* Product & SKU Details Section */}
                <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e293b', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Tag size={15} color="#0ea5e9" />
                    <span>Product & SKU Item Information</span>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {rec.productImage ? (
                      <div style={{ width: 72, height: 72, borderRadius: 8, overflow: 'hidden', border: '1px solid #cbd5e1', flexShrink: 0 }}>
                        <img src={rec.productImage} alt={skuCode} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ) : (
                      <div style={{ width: 72, height: 72, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', flexShrink: 0, border: '1px solid #e2e8f0' }}>
                        <Boxes size={28} />
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>
                          {skuCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(skuCode, 'sku')}
                          style={{ background: 'transparent', border: 'none', color: '#0ea5e9', cursor: 'pointer', padding: '2px', display: 'inline-flex', alignItems: 'center' }}
                          title="Copy SKU Code"
                        >
                          {copiedRecordField === 'sku' ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                        </button>
                        {rec.brand && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1' }}>
                            {rec.brand}
                          </span>
                        )}
                        {rec.category && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#475569' }}>
                            {rec.category}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginTop: '4px' }}>
                        {rec.itemName || 'Garment / Apparel Item'}
                      </div>

                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                        {rec.size && (
                          <div style={{ fontSize: '0.74rem', background: '#f8fafc', padding: '3px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                            Size: <strong style={{ color: '#0f172a' }}>{rec.size}</strong>
                          </div>
                        )}
                        {rec.color && (
                          <div style={{ fontSize: '0.74rem', background: '#f8fafc', padding: '3px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                            Color: <strong style={{ color: '#0f172a' }}>{rec.color}</strong>
                          </div>
                        )}
                        {rec.channel && (
                          <div style={{ fontSize: '0.74rem', background: '#f8fafc', padding: '3px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                            Channel: <strong style={{ color: '#db2777' }}>{rec.channel}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Complete Address & Tracking Codes Section */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                  
                  {/* Delivery Address Box */}
                  <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e293b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={15} color="#e11d48" />
                      <span>Shipping & Delivery Address</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#334155', lineHeight: '1.5' }}>
                      <div><strong>Recipient:</strong> {rec.customerName || '—'}</div>
                      {rec.customerPhone && <div><strong>Phone:</strong> {rec.customerPhone}</div>}
                      {rec.addressLine && <div><strong>Street:</strong> {rec.addressLine}</div>}
                      <div><strong>City / State:</strong> {rec.city || '—'} {rec.state ? `, ${rec.state}` : ''}</div>
                      <div><strong>Pincode:</strong> {rec.pincode || '—'}</div>
                    </div>
                  </div>

                  {/* Audit & System Meta Box */}
                  <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e293b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileText size={15} color="#6366f1" />
                      <span>Operational Audit & Tracking Identifiers</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#334155', lineHeight: '1.5' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span><strong>AWB Number:</strong> {awbCode}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(awbCode, 'awb')}
                          style={{ background: 'transparent', border: 'none', color: '#0ea5e9', cursor: 'pointer', fontSize: '0.7rem' }}
                        >
                          {copiedRecordField === 'awb' ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span><strong>Order Code:</strong> #{displayCode}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(displayCode, 'order')}
                          style={{ background: 'transparent', border: 'none', color: '#0ea5e9', cursor: 'pointer', fontSize: '0.7rem' }}
                        >
                          {copiedRecordField === 'order' ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                      <div><strong>Operator:</strong> {rec.operator || 'Warehouse Operator'}</div>
                      <div><strong>Facility:</strong> {rec.facility || 'eliteedition'}</div>
                      <div><strong>Record ID:</strong> <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#64748b' }}>{rec.id || rec._id || 'N/A'}</span></div>
                      {rec.notes && <div><strong>Notes:</strong> {rec.notes}</div>}
                    </div>
                  </div>

                </div>

                {/* Return & Claim Section if applicable */}
                {(rec.isReturn || rec.reversePickupCode || rec.returnReason || hasPhotos) && (
                  <div style={{ background: '#fff1f2', borderRadius: '12px', border: '1px solid #fecdd3', padding: '1rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#be123c', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldAlert size={15} color="#be123c" />
                      <span>Return & RTO Inspection Record</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '0.76rem', color: '#4c0519' }}>
                      {rec.reversePickupCode && <div><strong>Reverse Pickup Code:</strong> {rec.reversePickupCode}</div>}
                      {rec.returnReason && <div><strong>Return Reason:</strong> {rec.returnReason}</div>}
                      {rec.returnRecord?.claimStatus && <div><strong>SPF Claim Status:</strong> {rec.returnRecord.claimStatus}</div>}
                      {rec.returnRecord?.claimId && <div><strong>Claim Ticket:</strong> {rec.returnRecord.claimId}</div>}
                      {rec.returnRecord?.claimAmount > 0 && <div><strong>Claim Amount:</strong> {fmtINR(rec.returnRecord.claimAmount)}</div>}
                    </div>

                    {hasPhotos && (
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#9f1239', marginBottom: '6px' }}>
                          Attached Photo Evidence ({photoList.length})
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {photoList.map((img, i) => (
                            <a key={i} href={img} target="_blank" rel="noreferrer" style={{ borderRadius: '6px', overflow: 'hidden', border: '1px solid #f43f5e', width: '80px', height: '60px', display: 'block' }}>
                              <img src={img} alt={`Proof ${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {/* Load in Screen 1 */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRecordDetails(null);
                      setScanMode('ALL');
                      setScanInput(awbCode);
                      handleProcessScan(awbCode, 'Record Modal Load');
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: '#0ea5e9',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Eye size={13} />
                    <span>Load in Screen 1 Station</span>
                  </button>

                  {/* Print Barcode Sticker */}
                  <button
                    type="button"
                    onClick={() => {
                      setBarcodeTagData({
                        sku: skuCode,
                        brand: rec.brand || '',
                        itemName: rec.itemName || 'Garment / Apparel',
                        size: rec.size || 'M',
                        color: rec.color || '',
                        mrp: rec.mrp || 1499,
                        barcode: awbCode
                      });
                      setSelectedRecordDetails(null);
                      setShowBarcodeTagModal(true);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: '#ffffff',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Tag size={13} />
                    <span>Print 50x25mm Label</span>
                  </button>

                  {/* Copy JSON data */}
                  <button
                    type="button"
                    onClick={() => copyToClipboard(JSON.stringify(rec, null, 2), 'json')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: '#ffffff',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {copiedRecordField === 'json' ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                    <span>{copiedRecordField === 'json' ? 'JSON Copied!' : 'Copy JSON'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedRecordDetails(null)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '6px',
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Close Dossier
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
