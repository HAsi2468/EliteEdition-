import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Edit2, Trash2, Printer, Search, Plus, Minus, SlidersHorizontal, 
  TrendingDown, MoreVertical, Sparkles, Package, AlertTriangle, 
  CheckCircle2, XCircle, DollarSign, Download, Filter, Calendar,
  RefreshCw, FileText, TrendingUp, Layers3, IndianRupee, ArrowDownRight, ArrowUpRight, Building2, BookOpen, Eye, X,
  ChevronDown, ChevronUp, Camera, Tag
} from 'lucide-react';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import { matchSearchQuery } from '../utils/searchUtils';
import { api } from '../services/api';
import DateRangePicker from './DateRangePicker';
import VendorPartyManagerModal from './VendorPartyManagerModal';
import ProductCatalogGrid from './ProductCatalogGrid';

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

export default function InventoryGrid({ 
  items = [], 
  catalogItems = [],
  onEdit, 
  onDelete, 
  onAdd, 
  onStockOut, 
  onOpenManager, 
  onBulkInward, 
  onQuickStockUpdate,
  onSyncCatalog,
  initialSubTab = 'overview'
}) {
  const safeItems = Array.isArray(items) ? items : [];

  // 4 Primary Sub-Screens: 'overview' (Stock Overview), 'inward' (Inward Stock), 'outward' (Outward Stock), 'catalog' (Product Catalog)
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab);

  // Modals for Vendor & Party Managers
  const [showVendorManager, setShowVendorManager] = useState(false);
  const [showPartyManager, setShowPartyManager] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);

  // --- Sub-Screen 1: Stock Overview State ---
  const [searchTerm, setSearchTerm] = useState('');
  const [sizeFilter, setSizeFilter] = useState('All');
  const [overviewDateStart, setOverviewDateStart] = useState('');
  const [overviewDateEnd, setOverviewDateEnd] = useState('');
  const [overviewPreset, setOverviewPreset] = useState('all');
  const [customOverviewStart, setCustomOverviewStart] = useState('');
  const [customOverviewEnd, setCustomOverviewEnd] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('all'); // 'all', 'instock', 'lowstock', 'outofstock'
  const [sortField, setSortField] = useState('itemName');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
  const [updatingStockId, setUpdatingStockId] = useState(null);

  // --- Sub-Screen 2: Inward Stock State ---
  const [inwardDateStart, setInwardDateStart] = useState('');
  const [inwardDateEnd, setInwardDateEnd] = useState('');
  const [inwardPreset, setInwardPreset] = useState('all'); // 'today', '7days', 'thisMonth', 'all', 'custom'
  const [customInwardStart, setCustomInwardStart] = useState('');
  const [customInwardEnd, setCustomInwardEnd] = useState('');
  const [inwardSearchTerm, setInwardSearchTerm] = useState('');
  const [inwardSortField, setInwardSortField] = useState('created_date_time');
  const [inwardSortOrder, setInwardSortOrder] = useState('desc');
  const [inwardData, setInwardData] = useState({ items: [], totalQty: 0, totalPurchase: 0 });
  const [totalInwardCount, setTotalInwardCount] = useState(null);
  const [inwardLoading, setInwardLoading] = useState(false);
  const [inwardError, setInwardError] = useState('');
  const [downloadingInwardPdf, setDownloadingInwardPdf] = useState(false);

  // Challan-Wise Inward View States
  const [inwardViewMode, setInwardViewMode] = useState('challan'); // 'challan' (default) | 'items'
  const [selectedChallan, setSelectedChallan] = useState(null);
  const [expandedChallanId, setExpandedChallanId] = useState(null);
  const [inwardChallanSortField, setInwardChallanSortField] = useState('date');
  const [inwardChallanSortOrder, setInwardChallanSortOrder] = useState('desc');
  const [editingChallan, setEditingChallan] = useState(null);
  const [editChallanNo, setEditChallanNo] = useState('');
  const [editParty, setEditParty] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editItems, setEditItems] = useState([]);
  const [isUpdatingChallan, setIsUpdatingChallan] = useState(false);

  // --- Sub-Screen 3: Outward Stock State ---
  const [outwardDateStart, setOutwardDateStart] = useState('');
  const [outwardDateEnd, setOutwardDateEnd] = useState('');
  const [outwardSortField, setOutwardSortField] = useState('created_date_time');
  const [outwardSortOrder, setOutwardSortOrder] = useState('desc');
  const [outwardPreset, setOutwardPreset] = useState('all'); // 'today', '7days', 'thisMonth', 'all', 'custom'
  const [customOutwardStart, setCustomOutwardStart] = useState('');
  const [customOutwardEnd, setCustomOutwardEnd] = useState('');
  const [outwardSearchTerm, setOutwardSearchTerm] = useState('');
  const [outwardData, setOutwardData] = useState({ items: [], totalQty: 0, totalPurchase: 0, totalSell: 0, totalProfit: 0 });
  const [totalOutwardCount, setTotalOutwardCount] = useState(null);
  const [outwardLoading, setOutwardLoading] = useState(false);
  const [outwardError, setOutwardError] = useState('');
  const [downloadingOutwardPdf, setDownloadingOutwardPdf] = useState(false);

  // Managed custom brands in localStorage + Event Listener for real-time updates from Manage Brands
  const [customBrands, setCustomBrands] = useState(() => {
    try {
      const saved = localStorage.getItem('elite_managed_brands');
      return saved ? JSON.parse(saved) : ['ANOUK', 'ELITE EDITION', 'HERA', 'MYNTRA'];
    } catch (err) {
      return ['ANOUK', 'ELITE EDITION', 'HERA', 'MYNTRA'];
    }
  });

  useEffect(() => {
    const handleBrandsUpdated = () => {
      try {
        const saved = localStorage.getItem('elite_managed_brands');
        if (saved) setCustomBrands(JSON.parse(saved));
      } catch (e) {}
    };

    window.addEventListener('storage', handleBrandsUpdated);
    window.addEventListener('elite_brands_updated', handleBrandsUpdated);
    return () => {
      window.removeEventListener('storage', handleBrandsUpdated);
      window.removeEventListener('elite_brands_updated', handleBrandsUpdated);
    };
  }, []);

  // Unique sizes & vendors/brands for Overview dropdowns
  const sizes = ['All', ...new Set(safeItems.map(item => item.size).filter(Boolean))];
  
  const brandSet = new Set();
  const addBrandCandidate = (val) => {
    if (!val || typeof val !== 'string') return;
    const trimmed = val.trim().toUpperCase();
    if (!trimmed || trimmed === 'ALL') return;
    brandSet.add(trimmed);
  };

  safeItems.forEach(item => {
    if (item.brand) addBrandCandidate(item.brand);
    if (Array.isArray(item.brandCodes)) {
      item.brandCodes.forEach(bc => {
        const b = typeof bc === 'object' ? bc.brand : bc;
        addBrandCandidate(b);
      });
    }
  });
  (customBrands || []).forEach(b => addBrandCandidate(b));

  const sortedVendors = Array.from(brandSet).sort((a, b) => a.localeCompare(b));
  const vendors = ['All', ...sortedVendors];

  // Overview Metrics
  const totalSkus = safeItems.length;
  const totalAvailableStock = safeItems.reduce((acc, item) => acc + (Number(item.currentlyAvailableStock) || 0), 0);
  const lowStockCount = safeItems.filter(item => (Number(item.currentlyAvailableStock) || 0) > 0 && (Number(item.currentlyAvailableStock) || 0) <= 5).length;
  const outOfStockCount = safeItems.filter(item => (Number(item.currentlyAvailableStock) || 0) === 0).length;
  const totalBuyValuation = safeItems.reduce((acc, item) => acc + ((Number(item.purchasePrice) || 0) * (Number(item.currentlyAvailableStock) || 0)), 0);

  // --- Data Fetching for Inward & Outward Screens ---
  const fetchInwardData = useCallback(async (start = inwardDateStart, end = inwardDateEnd) => {
    setInwardLoading(true);
    setInwardError('');
    try {
      const combinedStart = start ? `${start}T00:00:00` : '';
      const combinedEnd = end ? `${end}T23:59:59` : '';
      const res = await api.getStockInwardReportData(combinedStart, combinedEnd);
      setInwardData(res || { items: [], totalQty: 0, totalPurchase: 0 });
      if (!start && !end) {
        setTotalInwardCount(res?.items?.length || 0);
      }
    } catch (err) {
      console.error('Failed to fetch inward stock data:', err);
      setInwardError(err.message || 'Failed to load inward stock records.');
    } finally {
      setInwardLoading(false);
    }
  }, [inwardDateStart, inwardDateEnd]);

  const fetchOutwardData = useCallback(async (start = outwardDateStart, end = outwardDateEnd) => {
    setOutwardLoading(true);
    setOutwardError('');
    try {
      const combinedStart = start ? `${start}T00:00:00` : '';
      const combinedEnd = end ? `${end}T23:59:59` : '';
      const res = await api.getStockOutwardReportData(combinedStart, combinedEnd);
      setOutwardData(res || { items: [], totalQty: 0, totalPurchase: 0, totalSell: 0, totalProfit: 0 });
      if (!start && !end) {
        setTotalOutwardCount(res?.items?.length || 0);
      }
    } catch (err) {
      console.error('Failed to fetch outward stock data:', err);
      setOutwardError(err.message || 'Failed to load outward stock records.');
    } finally {
      setOutwardLoading(false);
    }
  }, [outwardDateStart, outwardDateEnd]);

  // Initial load on mount so Inward & Outward counts are populated immediately without clicking tabs
  useEffect(() => {
    fetchInwardData('', '');
    fetchOutwardData('', '');
  }, []);

  // Trigger data fetch when switching tabs
  useEffect(() => {
    if (activeSubTab === 'inward') {
      fetchInwardData();
    } else if (activeSubTab === 'outward') {
      fetchOutwardData();
    }
  }, [activeSubTab, fetchInwardData, fetchOutwardData]);

  // Auto-refresh without page reload: listen to global event dispatched on inward, outward, or inventory transactions
  const refreshAllStockLogs = useCallback(async () => {
    fetchInwardData();
    fetchOutwardData();
    if (inwardDateStart || inwardDateEnd) {
      api.getStockInwardReportData('', '')
        .then(res => setTotalInwardCount(res?.items?.length || 0))
        .catch(() => {});
    }
    if (outwardDateStart || outwardDateEnd) {
      api.getStockOutwardReportData('', '')
        .then(res => setTotalOutwardCount(res?.items?.length || 0))
        .catch(() => {});
    }
  }, [fetchInwardData, fetchOutwardData, inwardDateStart, inwardDateEnd, outwardDateStart, outwardDateEnd]);

  useEffect(() => {
    const handleRefresh = () => {
      refreshAllStockLogs();
    };
    window.addEventListener('elite-data-refresh', handleRefresh);
    return () => window.removeEventListener('elite-data-refresh', handleRefresh);
  }, [refreshAllStockLogs]);

  // Quick Date Preset Handler matching regular ERP date filter
  const handleQuickDatePreset = (tab, preset) => {
    const today = new Date();
    const formatDate = (d) => d.toISOString().split('T')[0];

    let start = '';
    let end = formatDate(today);

    if (preset === 'today') {
      start = formatDate(today);
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(today.getDate() - 7);
      start = formatDate(past);
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      start = formatDate(firstDay);
    } else if (preset === 'all') {
      start = '';
      end = '';
    }

    if (tab === 'inward') {
      setInwardPreset(preset);
      setInwardDateStart(start);
      setInwardDateEnd(end);
      fetchInwardData(start, end);
    } else if (tab === 'outward') {
      setOutwardPreset(preset);
      setOutwardDateStart(start);
      setOutwardDateEnd(end);
      fetchOutwardData(start, end);
    }
  };

  // --- Sort Handler for Overview ---
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Overview Filtered Items
  const filteredOverviewItems = safeItems
    .filter(item => {
      const stock = Number(item.currentlyAvailableStock) || 0;
      const matchSearch = matchSearchQuery(item, searchTerm, ['itemName', 'party', 'skuCode', 'category', 'notes']);
      const matchSize = sizeFilter === 'All' || item.size === sizeFilter;
      
      const matchDate = (() => {
        if (!overviewDateStart && !overviewDateEnd) return true;
        const itemDate = new Date(item.created_date_time || item.createdAt || item.date || 0);
        if (isNaN(itemDate.getTime())) return true;
        if (overviewDateStart) {
          const sDate = new Date(`${overviewDateStart}T00:00:00`);
          if (itemDate < sDate) return false;
        }
        if (overviewDateEnd) {
          const eDate = new Date(`${overviewDateEnd}T23:59:59`);
          if (itemDate > eDate) return false;
        }
        return true;
      })();
      
      let matchStatus = true;
      if (stockStatusFilter === 'instock') matchStatus = stock > 0;
      else if (stockStatusFilter === 'lowstock') matchStatus = stock > 0 && stock <= 5;
      else if (stockStatusFilter === 'outofstock') matchStatus = stock === 0;

      return matchSearch && matchSize && matchDate && matchStatus;
    })
    .sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  // Filtered Inward Log Items
  const handleInwardSort = (field) => {
    if (inwardSortField === field) {
      setInwardSortOrder(inwardSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setInwardSortField(field);
      setInwardSortOrder('asc');
    }
  };

  const filteredInwardItems = (inwardData.items || [])
    .filter(item => {
      if (!inwardSearchTerm.trim()) return true;
      return matchSearchQuery(item, inwardSearchTerm, ['itemName', 'party', 'skuCode', 'sku']);
    })
    .sort((a, b) => {
      let aVal = a[inwardSortField];
      let bVal = b[inwardSortField];

      if (inwardSortField === 'created_date_time' || inwardSortField === 'date') {
        aVal = new Date(a.created_date_time || a.date || 0).getTime();
        bVal = new Date(b.created_date_time || b.date || 0).getTime();
      } else if (inwardSortField === 'qty' || inwardSortField === 'total') {
        aVal = Number(a.qty || a.total || 0);
        bVal = Number(b.qty || b.total || 0);
      } else if (inwardSortField === 'purchasePrice') {
        aVal = Number(a.purchasePrice || 0);
        bVal = Number(b.purchasePrice || 0);
      } else if (inwardSortField === 'totalPurchaseAmount') {
        aVal = Number(a.totalPurchaseAmount || (Number(a.purchasePrice || 0) * Number(a.qty || a.total || 0)));
        bVal = Number(b.totalPurchaseAmount || (Number(b.purchasePrice || 0) * Number(b.qty || b.total || 0)));
      } else {
        aVal = (aVal || '').toString().toLowerCase();
        bVal = (bVal || '').toString().toLowerCase();
      }

      if (aVal < bVal) return inwardSortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return inwardSortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  // Sort Handler for Inward Challans
  const handleInwardChallanSort = (field) => {
    if (inwardChallanSortField === field) {
      setInwardChallanSortOrder(inwardChallanSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setInwardChallanSortField(field);
      setInwardChallanSortOrder('asc');
    }
  };

  // Group Inward Items into Challan Batches
  const inwardChallans = useMemo(() => {
    const rawItems = inwardData.items || [];
    if (!rawItems.length) return [];

    // Sort chronologically descending
    const sorted = [...rawItems].sort((a, b) => {
      const tA = new Date(a.created_date_time || a.date || a.createdAt || 0).getTime();
      const tB = new Date(b.created_date_time || b.date || b.createdAt || 0).getTime();
      return tB - tA;
    });

    const groups = [];
    let curGroup = null;

    sorted.forEach((item, idx) => {
      const rawDt = item.created_date_time || item.date || item.createdAt;
      const timeMs = new Date(rawDt).getTime();
      const challanNo = (item.challanNo || '').trim();
      const party = (item.party || 'Vendor').trim();

      if (curGroup) {
        const sameExplicitChallan = challanNo && curGroup.challanNo && challanNo.toLowerCase() === curGroup.challanNo.toLowerCase();
        const sameParty = (party || '').toLowerCase() === (curGroup.party || '').toLowerCase();
        const timeDiff = Math.abs(curGroup.earliestTimeMs - timeMs);
        const sameTimeBatch = (!challanNo || !curGroup.challanNo) && sameParty && (timeDiff <= 300000 || Math.abs(curGroup.latestTimeMs - timeMs) <= 90000);

        if (sameExplicitChallan || sameTimeBatch) {
          curGroup.items.push(item);
          const itemQty = Number(item.qty || item.total || item.currentlyAvailableStock || 0);
          const itemPrice = Number(item.purchasePrice || 0);
          curGroup.totalQty += itemQty;
          curGroup.totalAmount += Number(item.totalPurchaseAmount || (itemQty * itemPrice));
          curGroup.skuCodes.add(item.skuCode || item.sku || `ITEM-${idx}`);
          curGroup.latestTimeMs = Math.max(curGroup.latestTimeMs, timeMs);
          curGroup.earliestTimeMs = Math.min(curGroup.earliestTimeMs, timeMs);
          if (!curGroup.sampleImage && item.imageUrl) {
            curGroup.sampleImage = item.imageUrl;
          }
          return;
        }
      }

      const itemQty = Number(item.qty || item.total || item.currentlyAvailableStock || 0);
      const itemPrice = Number(item.purchasePrice || 0);

      curGroup = {
        id: challanNo ? `CH-${challanNo}-${timeMs}` : `BATCH-${item._id || item.id || idx}`,
        challanNo: challanNo,
        party: party,
        date: rawDt,
        latestTimeMs: timeMs,
        earliestTimeMs: timeMs,
        items: [item],
        totalQty: itemQty,
        totalAmount: Number(item.totalPurchaseAmount || (itemQty * itemPrice)),
        skuCodes: new Set([item.skuCode || item.sku || `ITEM-${idx}`]),
        sampleImage: item.imageUrl || ''
      };
      groups.push(curGroup);
    });

    // Assign proper daily sequential Challan No (CH-DDMM-01, CH-DDMM-02...) if not entered by user
    const dayCounters = {};
    const reversed = [...groups].reverse();
    reversed.forEach((g) => {
      const dt = new Date(g.date);
      const dayStr = String(dt.getDate()).padStart(2, '0') + String(dt.getMonth() + 1).padStart(2, '0');
      if (!dayCounters[dayStr]) dayCounters[dayStr] = 0;
      dayCounters[dayStr]++;

      if (!g.challanNo) {
        const seqStr = String(dayCounters[dayStr]).padStart(2, '0');
        g.displayChallanNo = `CH-${dayStr}-${seqStr}`;
        g.isAutoChallan = true;
      } else {
        g.displayChallanNo = g.challanNo.startsWith('CH-') || g.challanNo.startsWith('INW-') ? g.challanNo : `CH-${g.challanNo}`;
        g.isAutoChallan = false;
      }
    });

    return groups;
  }, [inwardData.items]);

  // Filtered & Sorted Inward Challans
  const filteredInwardChallans = useMemo(() => {
    let list = inwardChallans;
    if (inwardSearchTerm.trim()) {
      const q = inwardSearchTerm.trim().toLowerCase();
      list = list.filter(ch => {
        if (ch.displayChallanNo.toLowerCase().includes(q)) return true;
        if (ch.party.toLowerCase().includes(q)) return true;
        return ch.items.some(it => 
          (it.skuCode && it.skuCode.toLowerCase().includes(q)) ||
          (it.itemName && it.itemName.toLowerCase().includes(q)) ||
          (it.size && it.size.toLowerCase().includes(q))
        );
      });
    }

    return [...list].sort((a, b) => {
      let aVal = a[inwardChallanSortField];
      let bVal = b[inwardChallanSortField];

      if (inwardChallanSortField === 'date') {
        aVal = new Date(a.date || 0).getTime();
        bVal = new Date(b.date || 0).getTime();
      } else if (inwardChallanSortField === 'totalQty') {
        aVal = Number(a.totalQty || 0);
        bVal = Number(b.totalQty || 0);
      } else if (inwardChallanSortField === 'totalSkus') {
        aVal = a.skuCodes.size;
        bVal = b.skuCodes.size;
      } else if (inwardChallanSortField === 'totalAmount') {
        aVal = Number(a.totalAmount || 0);
        bVal = Number(b.totalAmount || 0);
      } else if (inwardChallanSortField === 'party') {
        aVal = (a.party || '').toLowerCase();
        bVal = (b.party || '').toLowerCase();
      } else if (inwardChallanSortField === 'challanNo') {
        aVal = (a.displayChallanNo || '').toLowerCase();
        bVal = (b.displayChallanNo || '').toLowerCase();
      }

      if (aVal < bVal) return inwardChallanSortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return inwardChallanSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [inwardChallans, inwardSearchTerm, inwardChallanSortField, inwardChallanSortOrder]);

  // Total unique SKUs across inward items
  const totalUniqueInwardSkus = useMemo(() => {
    const set = new Set();
    (inwardData.items || []).forEach(it => {
      const code = it.skuCode || it.sku;
      if (code) set.add(code);
    });
    return set.size;
  }, [inwardData.items]);

  // Printable Challan Receiving Slip
  const handlePrintChallan = (challan) => {
    if (!challan) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print Challan');
      return;
    }
    const dtObj = new Date(challan.date);
    const dateFormatted = !isNaN(dtObj.getTime())
      ? dtObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'N/A';
    const timeFormatted = !isNaN(dtObj.getTime())
      ? dtObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      : '';

    const rowsHtml = (challan.items || []).map((item, index) => {
      const itemQty = Number(item.qty || item.total || item.currentlyAvailableStock || 0);
      const buyPrice = Number(item.purchasePrice || 0);
      const totalAmount = Number(item.totalPurchaseAmount || (itemQty * buyPrice));
      const sizeStr = item.sizes && item.sizes.length > 0
        ? item.sizes.map(s => `${s.size}: ${s.qty}`).join(', ')
        : (item.size || 'Free Size');

      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 10px; font-size: 12px; text-align: center;">${index + 1}</td>
          <td style="padding: 8px 10px; font-size: 12px; font-weight: 600;">${item.skuCode || item.sku || '-'}</td>
          <td style="padding: 8px 10px; font-size: 12px;">${item.itemName || '-'}</td>
          <td style="padding: 8px 10px; font-size: 11px; color: #475569;">${sizeStr}</td>
          <td style="padding: 8px 10px; font-size: 12px; font-weight: 700; text-align: center;">${itemQty} Pcs</td>
          <td style="padding: 8px 10px; font-size: 12px; text-align: right;">₹${buyPrice.toFixed(2)}</td>
          <td style="padding: 8px 10px; font-size: 12px; font-weight: 700; text-align: right;">₹${totalAmount.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Inward Challan - ${challan.displayChallanNo}</title>
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { margin: 12mm; }
            }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 14px; margin-bottom: 16px; }
            .title { font-size: 20px; font-weight: 800; color: #0369a1; text-transform: uppercase; letter-spacing: 0.5px; }
            .subtitle { font-size: 12px; color: #64748b; margin-top: 2px; }
            .badge { background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 14px; border: 1px solid #bae6fd; }
            .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; background: #f8fafc; padding: 12px 14px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 16px; font-size: 12px; }
            .info-label { font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 2px; }
            .info-val { font-size: 13px; font-weight: 700; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th { background: #0369a1; color: #ffffff; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; text-align: left; }
            .summary-box { margin-top: 16px; display: flex; justify-content: flex-end; }
            .summary-table { width: 280px; border-collapse: collapse; }
            .summary-table td { padding: 6px 10px; font-size: 13px; }
            .signatures { margin-top: 48px; display: flex; justify-content: space-between; padding: 0 24px; }
            .sig-line { border-top: 1px dashed #94a3b8; width: 180px; text-align: center; padding-top: 6px; font-size: 11px; color: #475569; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">ELITE EDITION - GOODS INWARD CHALLAN</div>
              <div class="subtitle">Official Inventory Receiving Slip & Verification Voucher</div>
            </div>
            <div class="badge">${challan.displayChallanNo}</div>
          </div>

          <div class="info-grid">
            <div>
              <div class="info-label">Challan / Ref No</div>
              <div class="info-val">${challan.displayChallanNo}</div>
            </div>
            <div>
              <div class="info-label">Vendor / Supplier</div>
              <div class="info-val">${challan.party || 'Vendor'}</div>
            </div>
            <div>
              <div class="info-label">Received Date & Time</div>
              <div class="info-val">${dateFormatted} ${timeFormatted}</div>
            </div>
            <div>
              <div class="info-label">Total SKUs & Items</div>
              <div class="info-val">${challan.skuCodes ? challan.skuCodes.size : (challan.items || []).length} SKUs (${(challan.items || []).length} items)</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">#</th>
                <th>SKU Code</th>
                <th>Product Description</th>
                <th>Sizes Breakdown</th>
                <th style="text-align: center;">Received Qty</th>
                <th style="text-align: right;">Buy Price</th>
                <th style="text-align: right;">Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="summary-box">
            <table class="summary-table">
              <tr style="border-top: 2px solid #0369a1; border-bottom: 2px solid #0369a1; background: #f0fdf4;">
                <td style="font-weight: 800; color: #166534;">TOTAL PCS RECEIVED:</td>
                <td style="font-weight: 800; color: #166534; text-align: right; font-size: 15px;">${challan.totalQty} Pcs</td>
              </tr>
              <tr style="border-bottom: 2px solid #0369a1;">
                <td style="font-weight: 800; color: #0369a1;">TOTAL VALUE (₹):</td>
                <td style="font-weight: 800; color: #0369a1; text-align: right; font-size: 15px;">₹${(challan.totalAmount || 0).toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <div class="signatures">
            <div class="sig-line">Received By (Store Incharge)</div>
            <div class="sig-line">Checked & Verified By</div>
            <div class="sig-line">Supplier / Courier Sign</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Edit Inward Challan / Stock Form Handler
  const handleEditChallan = (challan) => {
    if (!challan) return;
    setEditChallanNo(challan.challanNo || challan.displayChallanNo || '');
    setEditParty(challan.party || '');

    // Extract date from first item or challan date
    const firstItem = (challan.items && challan.items[0]) || {};
    const rawDate = firstItem.inwardDate || firstItem.createdAt || challan.date;
    if (rawDate) {
      try {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          setEditDate(d.toISOString().slice(0, 10));
        } else {
          setEditDate('');
        }
      } catch {
        setEditDate('');
      }
    } else {
      setEditDate('');
    }

    setEditItems(
      (challan.items || []).map(item => ({
        _id: item._id || item.id,
        skuCode: item.skuCode || item.sku || '',
        itemName: item.itemName || item.description || item.name || '',
        imageUrl: item.imageUrl || '',
        size: item.size || '',
        sizes: Array.isArray(item.sizes) ? JSON.parse(JSON.stringify(item.sizes)) : [],
        qty: Number(item.qty ?? item.total ?? item.currentlyAvailableStock ?? 0),
        purchasePrice: Number(item.purchasePrice ?? item.basePrice ?? 0),
        salePrice: Number(item.salePrice ?? item.price ?? 0),
      }))
    );
    setEditingChallan(challan);
  };

  const handleEditItemField = (idx, field, value) => {
    setEditItems(prev => {
      const next = [...prev];
      if (field === 'qty') {
        next[idx] = { ...next[idx], qty: Math.max(0, parseInt(value, 10) || 0) };
      } else if (field === 'purchasePrice' || field === 'salePrice') {
        next[idx] = { ...next[idx], [field]: Math.max(0, parseFloat(value) || 0) };
      } else {
        next[idx] = { ...next[idx], [field]: value };
      }
      return next;
    });
  };

  const handleRemoveEditItem = (idx) => {
    if (editItems.length <= 1) {
      alert('An inward challan must contain at least one item.');
      return;
    }
    if (window.confirm('Remove this SKU row from this inward challan?')) {
      setEditItems(prev => prev.filter((_, i) => i !== idx));
    }
  };

  // Save Inward Form (Updates Challan No, Party, Inward Date, and all items' Qty, Rate, Size)
  const handleSaveChallanMeta = async () => {
    if (!editingChallan || !editItems || !editItems.length) return;
    try {
      setIsUpdatingChallan(true);
      await Promise.all(
        editItems.map(item => {
          const itemId = item._id;
          if (!itemId) return Promise.resolve();
          const payload = {
            challanNo: (editChallanNo || '').trim(),
            party: (editParty || '').trim(),
            qty: Number(item.qty) || 0,
            currentlyAvailableStock: Number(item.qty) || 0,
            purchasePrice: Number(item.purchasePrice) || 0,
            salePrice: Number(item.salePrice) || 0,
            size: (item.size || '').trim()
          };
          if (editDate) {
            payload.inwardDate = new Date(editDate);
          }
          return api.updateInventory(itemId, payload);
        })
      );
      setEditingChallan(null);
      await fetchInwardData();
    } catch (err) {
      alert('Failed to update Inward details: ' + (err.message || err));
    } finally {
      setIsUpdatingChallan(false);
    }
  };

  // Filtered Outward Log Items
  const handleOutwardSort = (field) => {
    if (outwardSortField === field) {
      setOutwardSortOrder(outwardSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setOutwardSortField(field);
      setOutwardSortOrder('asc');
    }
  };

  const filteredOutwardItems = (outwardData.items || [])
    .filter(item => {
      if (!outwardSearchTerm.trim()) return true;
      return matchSearchQuery(item, outwardSearchTerm, ['itemName', 'party', 'skuCode', 'sku']);
    })
    .sort((a, b) => {
      let aVal = a[outwardSortField];
      let bVal = b[outwardSortField];

      if (outwardSortField === 'created_date_time' || outwardSortField === 'createdAt' || outwardSortField === 'date') {
        aVal = new Date(a.created_date_time || a.createdAt || a.date || 0).getTime();
        bVal = new Date(b.created_date_time || b.createdAt || b.date || 0).getTime();
      } else if (outwardSortField === 'total' || outwardSortField === 'qty') {
        aVal = Number(a.total || a.qty || 0);
        bVal = Number(b.total || b.qty || 0);
      } else if (outwardSortField === 'purchasePrice') {
        aVal = Number(a.purchasePrice || 0);
        bVal = Number(b.purchasePrice || 0);
      } else if (outwardSortField === 'salePrice') {
        aVal = Number(a.salePrice || 0);
        bVal = Number(b.salePrice || 0);
      } else if (outwardSortField === 'totalPurchaseAmount') {
        aVal = Number(a.totalPurchaseAmount || (Number(a.purchasePrice || 0) * Number(a.total || a.qty || 0)));
        bVal = Number(b.totalPurchaseAmount || (Number(b.purchasePrice || 0) * Number(b.total || b.qty || 0)));
      } else if (outwardSortField === 'totalSellableAmount') {
        aVal = Number(a.totalSellableAmount || (Number(a.salePrice || 0) * Number(a.total || a.qty || 0)));
        bVal = Number(b.totalSellableAmount || (Number(a.salePrice || 0) * Number(a.total || a.qty || 0)));
      } else if (outwardSortField === 'profit') {
        const aBuy = Number(a.totalPurchaseAmount || (Number(a.purchasePrice || 0) * Number(a.total || a.qty || 0)));
        const aSell = Number(a.totalSellableAmount || (Number(a.salePrice || 0) * Number(a.total || a.qty || 0)));
        aVal = aSell - aBuy;
        const bBuy = Number(b.totalPurchaseAmount || (Number(b.purchasePrice || 0) * Number(b.total || b.qty || 0)));
        const bSell = Number(b.totalSellableAmount || (Number(b.salePrice || 0) * Number(b.total || b.qty || 0)));
        bVal = bSell - bBuy;
      } else {
        aVal = (aVal || '').toString().toLowerCase();
        bVal = (bVal || '').toString().toLowerCase();
      }

      if (aVal < bVal) return outwardSortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return outwardSortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  // Thermal Barcode Printing
  const printBarcode = (item) => {
    const sku = item.skuCode || 'NO-SKU';
    const size = item.size || 'N/A';
    const companyTitle = (item.brand && item.brand.toUpperCase() !== 'ELITE ONLINE' && item.brand.toUpperCase() !== 'ALL') ? item.brand.toUpperCase() : 'EON';

    const countStr = window.prompt(`How many barcode stickers to print for SKU "${sku}"?`, "1");
    if (countStr === null) return;

    const count = parseInt(countStr, 10);
    if (isNaN(count) || count <= 0) {
      alert("Please enter a valid positive number.");
      return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    const totalSheets = Math.ceil(count / 2);
    let sheetsHtml = '';
    
    for (let i = 0; i < totalSheets; i++) {
      const idx1 = i * 2;
      const idx2 = i * 2 + 1;
      
      const sticker1Html = `
        <div class="sticker">
          <div class="title">${companyTitle}</div>
          <div class="barcode-container">
            <svg class="barcode-img" id="barcode_${idx1}"></svg>
          </div>
          <div class="footer-row">
            <span class="sku-text">${sku}</span>
            <span class="size-text">Size: ${size}</span>
          </div>
        </div>
      `;
      
      const sticker2Html = idx2 < count 
        ? `
          <div class="sticker">
            <div class="title">${companyTitle}</div>
            <div class="barcode-container">
              <svg class="barcode-img" id="barcode_${idx2}"></svg>
            </div>
            <div class="footer-row">
              <span class="sku-text">${sku}</span>
              <span class="size-text">Size: ${size}</span>
            </div>
          </div>
        `
        : `<div class="sticker" style="visibility: hidden;"></div>`;
        
      sheetsHtml += `
        <div class="sheet">
          ${sticker1Html}
          ${sticker2Html}
        </div>
      `;
    }

    let barcodeScripts = '';
    for (let j = 0; j < count; j++) {
      barcodeScripts += `
        JsBarcode("#barcode_${j}", "${sku}", {
          format: "CODE128",
          displayValue: false,
          margin: 0,
          background: "transparent",
          lineColor: "#000",
          width: 2,
          height: 40
        });
      `;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Barcodes - ${sku}</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
          @page { size: 100mm 25mm; margin: 0; }
          body { margin: 0; padding: 0; font-family: sans-serif; background: white; color: black; }
          .sheet { display: flex; width: 100mm; height: 25mm; box-sizing: border-box; overflow: hidden; page-break-after: always; }
          .sheet:last-child { page-break-after: avoid; }
          .sticker { flex: 1; width: 50mm; height: 25mm; box-sizing: border-box; padding: 2.2mm 3.5mm 1.5mm 3.5mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; overflow: hidden; }
          .title { font-size: 8.5pt; font-weight: bold; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; }
          .barcode-container { display: flex; align-items: center; justify-content: center; height: 12.5mm; width: 100%; }
          .barcode-img { max-width: 44mm; height: 11mm; }
          .footer-row { display: flex; justify-content: space-between; width: 100%; font-size: 7.5pt; font-weight: 500; }
          .sku-text { font-family: monospace; font-weight: bold; }
          .size-text { font-weight: bold; }
        </style>
      </head>
      <body>
        ${sheetsHtml}
        <script>
          try { ${barcodeScripts} } catch(e) { console.error(e); }
          window.onload = function() {
            setTimeout(function() { window.print(); window.close(); }, 300);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // CSV Exports
  const handleExportOverviewCSV = () => {
    if (filteredOverviewItems.length === 0) {
      alert("No inventory records available to export.");
      return;
    }

    let csv = `ELITE ONLINE — STORE INVENTORY OVERVIEW STATEMENT\n`;
    csv += `Generated: ${new Date().toLocaleDateString()}\n\n`;
    csv += `SKU Code,Item Name,Vendor,Size,Available Stock,Purchase Price (INR),Sale Price (INR),Total Buy Value (INR),Total Sell Value (INR)\n`;

    filteredOverviewItems.forEach(i => {
      const stock = Number(i.currentlyAvailableStock) || 0;
      const buyPrice = Number(i.purchasePrice) || 0;
      const sellPrice = Number(i.salePrice) || 0;
      csv += `"${i.skuCode || ''}","${(i.itemName || '').replace(/"/g, '""')}","${(i.party || '').replace(/"/g, '""')}","${i.size || ''}",${stock},${buyPrice.toFixed(2)},${sellPrice.toFixed(2)},${(buyPrice * stock).toFixed(2)},${(sellPrice * stock).toFixed(2)}\n`;
    });

    downloadCsvBlob(csv, `EliteOnline_Stock_Overview_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportInwardCSV = () => {
    if (filteredInwardItems.length === 0) {
      alert("No inward records to export.");
      return;
    }
    let csv = `ELITE ONLINE — INWARD STOCK TRANSACTION LOG\n`;
    csv += `Date Range: ${inwardDateStart || 'All'} to ${inwardDateEnd || 'Today'}\n\n`;
    csv += `Date & Time,SKU Code,Item Name,Vendor,Total Qty Received,Unit Purchase Price (INR),Total Purchase Amount (INR)\n`;

    filteredInwardItems.forEach(item => {
      const dt = (item.created_date_time || item.date) ? new Date(item.created_date_time || item.date).toLocaleString('en-IN') : 'N/A';
      csv += `"${dt}","${item.skuCode || item.sku || ''}","${(item.itemName || '').replace(/"/g, '""')}","${(item.party || '').replace(/"/g, '""')}",${item.qty || item.total || 0},${Number(item.purchasePrice || 0).toFixed(2)},${Number(item.totalPurchaseAmount || 0).toFixed(2)}\n`;
    });

    downloadCsvBlob(csv, `EliteOnline_Inward_Stock_Log_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportOutwardCSV = () => {
    if (filteredOutwardItems.length === 0) {
      alert("No outward records to export.");
      return;
    }
    let csv = `ELITE ONLINE — OUTWARD STOCK TRANSACTION LOG\n`;
    csv += `Date Range: ${outwardDateStart || 'All'} to ${outwardDateEnd || 'Today'}\n\n`;
    csv += `Date & Time,SKU Code,Item Name,Vendor,Total Qty Dispatched,Unit Buy Price (INR),Total Buy Cost (INR),Unit Sell Price (INR),Total Sale Revenue (INR),Gross Profit (INR)\n`;

    filteredOutwardItems.forEach(item => {
      const dt = (item.created_date_time || item.createdAt || item.date) ? new Date(item.created_date_time || item.createdAt || item.date).toLocaleString('en-IN') : 'N/A';
      const profit = (item.totalSellableAmount || 0) - (item.totalPurchaseAmount || 0);
      csv += `"${dt}","${item.sku || item.skuCode || ''}","${(item.itemName || '').replace(/"/g, '""')}","${(item.party || '').replace(/"/g, '""')}",${item.total || 0},${Number(item.purchasePrice || 0).toFixed(2)},${Number(item.totalPurchaseAmount || 0).toFixed(2)},${Number(item.salePrice || 0).toFixed(2)},${Number(item.totalSellableAmount || 0).toFixed(2)},${profit.toFixed(2)}\n`;
    });

    downloadCsvBlob(csv, `EliteOnline_Outward_Stock_Log_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const downloadCsvBlob = (content, fileName) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF Exports via Backend API
  const handleDownloadInwardPdf = async () => {
    setDownloadingInwardPdf(true);
    try {
      const combinedStart = inwardDateStart ? `${inwardDateStart}T00:00:00` : '';
      const combinedEnd = inwardDateEnd ? `${inwardDateEnd}T23:59:59` : '';
      await api.downloadInventoryReport('stock-inward', combinedStart, combinedEnd, `Stock_Inward_Report_${inwardDateStart || 'All'}_to_${inwardDateEnd || 'Today'}.pdf`);
    } catch (err) {
      console.error('Failed to download Inward PDF:', err);
      alert(err.message || 'Failed to download Inward PDF report.');
    } finally {
      setDownloadingInwardPdf(false);
    }
  };

  const handleDownloadOutwardPdf = async () => {
    setDownloadingOutwardPdf(true);
    try {
      const combinedStart = outwardDateStart ? `${outwardDateStart}T00:00:00` : '';
      const combinedEnd = outwardDateEnd ? `${outwardDateEnd}T23:59:59` : '';
      await api.downloadInventoryReport('stock-outward', combinedStart, combinedEnd, `Stock_Outward_Report_${outwardDateStart || 'All'}_to_${outwardDateEnd || 'Today'}.pdf`);
    } catch (err) {
      console.error('Failed to download Outward PDF:', err);
      alert(err.message || 'Failed to download Outward PDF report.');
    } finally {
      setDownloadingOutwardPdf(false);
    }
  };

  return (
    <div style={styles.container}>
      
      {/* ========================================================================= */}
      {/* MAIN TOP NAVIGATION SUB-TAB BAR (3 Dedicated Screens)                      */}
      {/* ========================================================================= */}
      <div className="inv-sub-tab-bar-container" style={styles.subTabBarContainer}>
        <div className="inv-sub-tab-bar" style={styles.subTabBar}>
          {/* Tab 1: Stock Overview */}
          <button
            onClick={() => setActiveSubTab('overview')}
            style={styles.subTabButton(activeSubTab === 'overview', 'overview')}
          >
            <Package size={17} />
            <span>Stock Overview</span>
            <span style={styles.tabBadge(activeSubTab === 'overview', '#3b82f6')}>
              {totalSkus}
            </span>
          </button>

          {/* Tab 2: Inward Stock */}
          <button
            onClick={() => setActiveSubTab('inward')}
            style={styles.subTabButton(activeSubTab === 'inward', 'inward')}
          >
            <ArrowDownRight size={17} />
            <span>Inward Stock</span>
            <span style={styles.tabBadge(activeSubTab === 'inward', '#10b981')}>
              {totalInwardCount !== null ? totalInwardCount : (inwardData.items?.length || 0)}
            </span>
          </button>

          {/* Tab 3: Outward Stock */}
          <button
            onClick={() => setActiveSubTab('outward')}
            style={styles.subTabButton(activeSubTab === 'outward', 'outward')}
          >
            <ArrowUpRight size={17} />
            <span>Outward Stock</span>
            <span style={styles.tabBadge(activeSubTab === 'outward', '#f59e0b')}>
              {totalOutwardCount !== null ? totalOutwardCount : (outwardData.items?.length || 0)}
            </span>
          </button>

          {/* Tab 4: Product Catalog */}
          <button
            onClick={() => setActiveSubTab('catalog')}
            style={styles.subTabButton(activeSubTab === 'catalog', 'catalog')}
          >
            <BookOpen size={17} />
            <span>Product Catalog</span>
            <span style={styles.tabBadge(activeSubTab === 'catalog', '#8b5cf6')}>
              {catalogItems.length}
            </span>
          </button>
        </div>
      </div>


      {/* ========================================================================= */}
      {/* SCREEN 1: STOCK OVERVIEW                                                   */}
      {/* ========================================================================= */}
      {activeSubTab === 'overview' && (
        <>
          {/* Summary Metric Cards */}
          <div className="inv-stats-grid" style={styles.statsGrid}>
            <div style={{ ...styles.statCard, borderLeft: '4px solid #3b82f6' }}>
              <div style={styles.statIconWrap('#3b82f6', '#eff6ff')}>
                <Package size={22} color="#3b82f6" />
              </div>
              <div>
                <div style={styles.statLabel}>TOTAL SKUS / PRODUCTS</div>
                <div style={{ ...styles.statVal, color: '#1e293b' }}>
                  {totalSkus} <span style={styles.statSubText}>items</span>
                </div>
              </div>
            </div>

            <div style={{ ...styles.statCard, borderLeft: '4px solid #6366f1' }}>
              <div style={styles.statIconWrap('#6366f1', '#eef2ff')}>
                <CheckCircle2 size={22} color="#6366f1" />
              </div>
              <div>
                <div style={styles.statLabel}>TOTAL AVAILABLE STOCK</div>
                <div style={{ ...styles.statVal, color: '#1e293b' }}>
                  {totalAvailableStock.toLocaleString()} <span style={styles.statSubText}>units</span>
                </div>
              </div>
            </div>

            <div 
              onClick={() => setStockStatusFilter('lowstock')}
              style={{ ...styles.statCard, borderLeft: '4px solid #f59e0b', cursor: 'pointer' }}
              title="Click to filter Low Stock items"
            >
              <div style={styles.statIconWrap('#f59e0b', '#fffbeb')}>
                <AlertTriangle size={22} color="#f59e0b" />
              </div>
              <div>
                <div style={styles.statLabel}>LOW STOCK ALERT (≤ 5)</div>
                <div style={{ ...styles.statVal, color: '#d97706' }}>
                  {lowStockCount} <span style={styles.statSubText}>SKUs</span>
                </div>
              </div>
            </div>

            <div 
              onClick={() => setStockStatusFilter('outofstock')}
              style={{ ...styles.statCard, borderLeft: '4px solid #ef4444', cursor: 'pointer' }}
              title="Click to filter Out of Stock items"
            >
              <div style={styles.statIconWrap('#ef4444', '#fef2f2')}>
                <XCircle size={22} color="#ef4444" />
              </div>
              <div>
                <div style={styles.statLabel}>OUT OF STOCK</div>
                <div style={{ ...styles.statVal, color: '#dc2626' }}>
                  {outOfStockCount} <span style={styles.statSubText}>SKUs</span>
                </div>
              </div>
            </div>
          </div>

          {/* Search, Filters & Action Toolbar */}
          <div className="inv-control-header" style={{
            ...styles.controlHeader,
            flexDirection: 'row',
            flexWrap: 'nowrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            overflowX: 'auto',
            whiteSpace: 'nowrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <div className="inv-search-box" style={{ ...styles.searchBox, minWidth: '180px', maxWidth: '240px', padding: '0.35rem 0.65rem' }}>
                <Search size={14} color="#64748b" style={{ flexShrink: 0 }} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search SKU, item..."
                  style={styles.searchInput}
                />
              </div>

              <div className="inv-pill-container" style={styles.pillContainer}>
                {[
                  { id: 'all', label: `All (${items.length})` },
                  { id: 'instock', label: `In Stock (${items.length - outOfStockCount})` },
                  { id: 'lowstock', label: `Low Stock (${lowStockCount})` },
                  { id: 'outofstock', label: `Out of Stock (${outOfStockCount})` }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setStockStatusFilter(tab.id)}
                    style={styles.statusPill(stockStatusFilter === tab.id, tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
              <div style={styles.filterBox}>
                <SlidersHorizontal size={14} color="#64748b" />
                <select
                  value={sizeFilter}
                  onChange={(e) => setSizeFilter(e.target.value)}
                  style={styles.selectInput}
                >
                  {sizes.map((s, idx) => (
                    <option key={idx} value={s}>{s === 'All' ? 'All Sizes' : `Size: ${s}`}</option>
                  ))}
                </select>
              </div>

              <DateRangePicker
                preset={overviewPreset}
                onChange={({ preset: p, dateStart: ds, dateEnd: de }) => {
                  setOverviewPreset(p);
                  setOverviewDateStart(ds);
                  setOverviewDateEnd(de);
                }}
                customStart={customOverviewStart}
                customEnd={customOverviewEnd}
                onCustomChange={(s, e) => {
                  setCustomOverviewStart(s);
                  setCustomOverviewEnd(e);
                }}
              />

            </div>
          </div>

          {/* Main Inventory Overview Data Table */}
          <div style={styles.tablePanel}>
            <div style={{ overflowX: 'auto' }}>
              {filteredOverviewItems.length === 0 ? (
                <div style={styles.emptyState}>
                  <span style={{ fontSize: '2.8rem' }}>📦</span>
                  <h4 style={{ margin: '0.5rem 0 0.2rem 0', color: '#1e293b', fontSize: '1.1rem' }}>No inventory items matching filter</h4>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>Try adjusting your search query or filters.</p>
                </div>
              ) : (
                <table style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse', background: '#ffffff' }}>
                  <thead>
                    <tr style={styles.tableHeaderRow}>
                      <th onClick={() => handleSort('itemName')} style={styles.thSort} title="Sort by Item Details">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>ITEM DETAILS</span>
                          <span style={{ fontSize: '0.75rem', color: sortField === 'itemName' ? '#38bdf8' : '#94a3b8' }}>
                            {sortField === 'itemName' ? (sortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                          </span>
                        </div>
                      </th>
                      <th onClick={() => handleSort('skuCode')} style={styles.thSort} title="Sort by SKU Code">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>SKU CODE</span>
                          <span style={{ fontSize: '0.75rem', color: sortField === 'skuCode' ? '#38bdf8' : '#94a3b8' }}>
                            {sortField === 'skuCode' ? (sortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                          </span>
                        </div>
                      </th>
                      <th onClick={() => handleSort('party')} style={styles.thSort} title="Sort by Vendor / Brand">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>VENDOR / BRAND</span>
                          <span style={{ fontSize: '0.75rem', color: sortField === 'party' ? '#38bdf8' : '#94a3b8' }}>
                            {sortField === 'party' ? (sortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                          </span>
                        </div>
                      </th>
                      <th onClick={() => handleSort('size')} style={styles.thSort} title="Sort by Size">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>SIZE</span>
                          <span style={{ fontSize: '0.75rem', color: sortField === 'size' ? '#38bdf8' : '#94a3b8' }}>
                            {sortField === 'size' ? (sortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                          </span>
                        </div>
                      </th>
                      <th onClick={() => handleSort('purchasePrice')} style={{ ...styles.thSort, textAlign: 'right' }} title="Sort by Buy Price">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'flex-end' }}>
                          <span>BUY PRICE</span>
                          <span style={{ fontSize: '0.75rem', color: sortField === 'purchasePrice' ? '#38bdf8' : '#94a3b8' }}>
                            {sortField === 'purchasePrice' ? (sortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                          </span>
                        </div>
                      </th>
                      <th onClick={() => handleSort('currentlyAvailableStock')} style={{ ...styles.thSort, textAlign: 'center' }} title="Sort by Available Stock">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center' }}>
                          <span>AVAILABLE STOCK</span>
                          <span style={{ fontSize: '0.75rem', color: sortField === 'currentlyAvailableStock' ? '#38bdf8' : '#94a3b8' }}>
                            {sortField === 'currentlyAvailableStock' ? (sortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                          </span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOverviewItems.map((item, idx) => {
                      const stock = Number(item.currentlyAvailableStock) || 0;

                      let stockBadgeBg = '#ecfdf5';
                      let stockBadgeColor = '#059669';
                      let stockBadgeBorder = '#a7f3d0';
                      let stockLabel = `${stock} Units`;

                      if (stock === 0) {
                        stockBadgeBg = '#fef2f2';
                        stockBadgeColor = '#dc2626';
                        stockBadgeBorder = '#fecaca';
                        stockLabel = 'Out of Stock';
                      } else if (stock <= 5) {
                        stockBadgeBg = '#fffbeb';
                        stockBadgeColor = '#d97706';
                        stockBadgeBorder = '#fde68a';
                        stockLabel = `${stock} Units (Low)`;
                      }

                      return (
                        <tr key={item._id} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={styles.itemCell}>
                              <div style={styles.itemImgWrapper}>
                                {item.imageUrl ? (
                                  <img 
                                    src={item.imageUrl} 
                                    alt={item.itemName} 
                                    style={styles.itemImg}
                                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                  />
                                ) : null}
                                <div style={{ ...styles.imgPlaceholder, display: item.imageUrl ? 'none' : 'flex' }}>
                                  {item.itemName ? item.itemName[0].toUpperCase() : 'E'}
                                </div>
                              </div>
                              <div>
                                <div style={styles.itemName}>{item.itemName}</div>
                                <div style={styles.itemMeta}>Created: {formatDateDDMMYYYY(item.created_date_time)}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={styles.skuText}>{item.skuCode || 'N/A'}</span>
                            {Array.isArray(item.brandCodes) && item.brandCodes.length > 0 && (
                              <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '4px' }}>
                                {item.brandCodes.map((bc, bIdx) => (
                                  <span key={bIdx} style={{ fontSize: '0.68rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '1px 5px', fontWeight: 600 }}>
                                    {typeof bc === 'string' ? bc : `${bc.brand ? bc.brand + ': ' : ''}${bc.code}`}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#334155', fontWeight: 600 }}>
                            {item.party}
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={styles.sizeBadge}>{item.size}</span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                            ₹ {Number(item.purchasePrice || 0).toFixed(2)}
                          </td>

                          <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '5px 14px',
                              borderRadius: '20px',
                              fontSize: '0.82rem',
                              fontWeight: 800,
                              backgroundColor: stockBadgeBg,
                              color: stockBadgeColor,
                              border: `1.5px solid ${stockBadgeBorder}`,
                              textAlign: 'center',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                            }}>
                              {stockLabel}
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
        </>
      )}


      {/* ========================================================================= */}
      {/* SCREEN 2: INWARD STOCK                                                    */}
      {/* ========================================================================= */}
      {activeSubTab === 'inward' && (
        <>
          {/* Summary Metric Cards for Inward Stock */}
          <div style={styles.statsGrid}>
            <div style={{ ...styles.statCard, borderLeft: '4px solid #0284c7' }}>
              <div style={styles.statIconWrap('#0284c7', '#eff6ff')}>
                <FileText size={22} color="#0284c7" />
              </div>
              <div>
                <div style={styles.statLabel}>TOTAL INWARD CHALLANS</div>
                <div style={{ ...styles.statVal, color: '#0369a1' }}>
                  {inwardChallans.length} <span style={styles.statSubText}>challans</span>
                </div>
              </div>
            </div>

            <div style={{ ...styles.statCard, borderLeft: '4px solid #10b981' }}>
              <div style={styles.statIconWrap('#10b981', '#ecfdf5')}>
                <ArrowDownRight size={22} color="#10b981" />
              </div>
              <div>
                <div style={styles.statLabel}>TOTAL PIECES RECEIVED</div>
                <div style={{ ...styles.statVal, color: '#047857' }}>
                  {(inwardData.totalQty || 0).toLocaleString()} <span style={styles.statSubText}>pcs</span>
                </div>
              </div>
            </div>

            <div style={{ ...styles.statCard, borderLeft: '4px solid #8b5cf6' }}>
              <div style={styles.statIconWrap('#8b5cf6', '#f5f3ff')}>
                <Layers3 size={22} color="#8b5cf6" />
              </div>
              <div>
                <div style={styles.statLabel}>TOTAL SKUs LOGGED</div>
                <div style={{ ...styles.statVal, color: '#6d28d9' }}>
                  {totalUniqueInwardSkus} <span style={styles.statSubText}>SKUs</span>
                </div>
              </div>
            </div>
          </div>

          {/* Date Filter & Control Header */}
          <div style={{
            ...styles.controlHeader,
            padding: '0.45rem 0.85rem',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'nowrap',
            gap: '0.5rem',
            overflowX: 'auto',
            whiteSpace: 'nowrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              {/* Search Box */}
              <div style={{ ...styles.searchBox, minWidth: '180px', maxWidth: '240px', padding: '0.35rem 0.65rem' }}>
                <Search size={14} color="#64748b" style={{ flexShrink: 0 }} />
                <input
                  type="text"
                  value={inwardSearchTerm}
                  onChange={(e) => setInwardSearchTerm(e.target.value)}
                  placeholder="Search Challan, SKU, Vendor..."
                  style={styles.searchInput}
                />
              </div>

              {/* Standard Regular DateRangePicker Component */}
              <DateRangePicker
                preset={inwardPreset}
                onChange={({ preset: p, dateStart: ds, dateEnd: de }) => {
                  setInwardPreset(p);
                  setInwardDateStart(ds);
                  setInwardDateEnd(de);
                  fetchInwardData(ds, de);
                }}
                customStart={customInwardStart}
                customEnd={customInwardEnd}
                onCustomChange={(s, e) => {
                  setCustomInwardStart(s);
                  setCustomInwardEnd(e);
                }}
              />

              {/* View Switcher: Challan Wise (Default) vs Individual SKUs */}
              <div style={{
                display: 'flex',
                background: '#f1f5f9',
                padding: '3px',
                borderRadius: '9px',
                border: '1px solid #cbd5e1',
                gap: '3px'
              }}>
                <button
                  type="button"
                  onClick={() => setInwardViewMode('challan')}
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: '7px',
                    border: 'none',
                    background: inwardViewMode === 'challan' ? '#0284c7' : 'transparent',
                    color: inwardViewMode === 'challan' ? '#ffffff' : '#475569',
                    fontWeight: inwardViewMode === 'challan' ? 700 : 500,
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'all 0.15s ease',
                    boxShadow: inwardViewMode === 'challan' ? '0 2px 6px rgba(2, 132, 199, 0.3)' : 'none'
                  }}
                  title="View Inward Stock grouped by Challan"
                >
                  <FileText size={13} />
                  <span>Challan Wise</span>
                  <span style={{
                    fontSize: '0.68rem',
                    padding: '1px 5px',
                    borderRadius: '10px',
                    background: inwardViewMode === 'challan' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                    color: inwardViewMode === 'challan' ? '#ffffff' : '#64748b',
                    fontWeight: 700
                  }}>
                    {filteredInwardChallans.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setInwardViewMode('items')}
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: '7px',
                    border: 'none',
                    background: inwardViewMode === 'items' ? '#0284c7' : 'transparent',
                    color: inwardViewMode === 'items' ? '#ffffff' : '#475569',
                    fontWeight: inwardViewMode === 'items' ? 700 : 500,
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'all 0.15s ease',
                    boxShadow: inwardViewMode === 'items' ? '0 2px 6px rgba(2, 132, 199, 0.3)' : 'none'
                  }}
                  title="View flattened individual SKU log"
                >
                  <Layers3 size={13} />
                  <span>Individual SKUs</span>
                  <span style={{
                    fontSize: '0.68rem',
                    padding: '1px 5px',
                    borderRadius: '10px',
                    background: inwardViewMode === 'items' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                    color: inwardViewMode === 'items' ? '#ffffff' : '#64748b',
                    fontWeight: 700
                  }}>
                    {filteredInwardItems.length}
                  </span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
              <button onClick={() => fetchInwardData()} style={{ ...styles.refreshBtn, padding: '0.45rem 0.75rem' }} title="Refresh Inward Log">
                <RefreshCw size={14} className={inwardLoading ? 'spin' : ''} />
                <span>Refresh</span>
              </button>
              <button onClick={() => setShowVendorManager(true)} style={{ ...styles.vendorBtn, padding: '0.45rem 0.75rem' }} title="Manage Vendors & Suppliers">
                <Building2 size={14} />
                <span>Manage Vendors</span>
              </button>
              <button 
                onClick={handleDownloadInwardPdf} 
                disabled={downloadingInwardPdf} 
                style={{ ...styles.pdfBtn, padding: '0.45rem 0.75rem' }}
                title="Download Official Inward PDF Report"
              >
                <FileText size={14} />
                <span>{downloadingInwardPdf ? 'PDF...' : 'Download PDF'}</span>
              </button>
              <button onClick={onBulkInward} style={{ ...styles.addInwardStockBtn, padding: '0.45rem 0.85rem' }} title="Add Inward Stock">
                <Sparkles size={14} />
                <span>+ Add Inward Stock</span>
              </button>
            </div>
          </div>

          {/* Inward Stock History Table */}
          <div style={styles.tablePanel}>
            {inwardLoading ? (
              <div style={styles.loadingBox}>
                <RefreshCw size={28} color="#0284c7" style={{ animation: 'spin 1s linear infinite' }} />
                <p style={{ color: '#475569', fontWeight: 600, marginTop: '0.8rem' }}>Loading Inward Stock History...</p>
              </div>
            ) : inwardError ? (
              <div style={styles.errorBox}>
                <AlertTriangle size={24} color="#dc2626" />
                <span>{inwardError}</span>
                <button onClick={() => fetchInwardData()} style={styles.retryBtn}>Retry</button>
              </div>
            ) : inwardViewMode === 'challan' ? (
              /* ================= CHALLAN-WISE VIEW ================= */
              filteredInwardChallans.length === 0 ? (
                <div style={styles.emptyState}>
                  <span style={{ fontSize: '2.8rem' }}>📋</span>
                  <h4 style={{ margin: '0.5rem 0 0.2rem 0', color: '#1e293b', fontSize: '1.1rem' }}>No inward challans found</h4>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>Try clearing date filters or add inward stock.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', borderRadius: '8px' }}>
                  <table style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse', background: '#ffffff', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: '#0369a1', color: '#ffffff' }}>
                        <th style={{ width: '45px', padding: '0.65rem 0.4rem', textAlign: 'center', color: '#bae6fd', fontWeight: 800 }}>#</th>
                        <th onClick={() => handleInwardChallanSort('date')} style={{ ...styles.thSort, padding: '0.65rem 0.5rem', color: '#ffffff', whiteSpace: 'nowrap' }} title="Sort by Date & Time">
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span>DATE & TIME</span>
                            <span style={{ fontSize: '0.7rem', color: inwardChallanSortField === 'date' ? '#bae6fd' : 'rgba(255,255,255,0.6)' }}>
                              {inwardChallanSortField === 'date' ? (inwardChallanSortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                            </span>
                          </div>
                        </th>
                        <th onClick={() => handleInwardChallanSort('challanNo')} style={{ ...styles.thSort, padding: '0.65rem 0.5rem', color: '#ffffff', whiteSpace: 'nowrap' }} title="Sort by Challan No">
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span>CHALLAN NO</span>
                            <span style={{ fontSize: '0.7rem', color: inwardChallanSortField === 'challanNo' ? '#bae6fd' : 'rgba(255,255,255,0.6)' }}>
                              {inwardChallanSortField === 'challanNo' ? (inwardChallanSortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                            </span>
                          </div>
                        </th>
                        <th onClick={() => handleInwardChallanSort('party')} style={{ ...styles.thSort, padding: '0.65rem 0.5rem', color: '#ffffff', whiteSpace: 'nowrap' }} title="Sort by Vendor / Supplier">
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span>VENDOR / SUPPLIER</span>
                            <span style={{ fontSize: '0.7rem', color: inwardChallanSortField === 'party' ? '#bae6fd' : 'rgba(255,255,255,0.6)' }}>
                              {inwardChallanSortField === 'party' ? (inwardChallanSortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                            </span>
                          </div>
                        </th>
                        <th onClick={() => handleInwardChallanSort('totalSkus')} style={{ ...styles.thSort, padding: '0.65rem 0.5rem', textAlign: 'center', color: '#ffffff', whiteSpace: 'nowrap' }} title="Sort by Total SKUs">
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                            <span>TOTAL SKUs</span>
                            <span style={{ fontSize: '0.7rem', color: inwardChallanSortField === 'totalSkus' ? '#bae6fd' : 'rgba(255,255,255,0.6)' }}>
                              {inwardChallanSortField === 'totalSkus' ? (inwardChallanSortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                            </span>
                          </div>
                        </th>
                        <th onClick={() => handleInwardChallanSort('totalQty')} style={{ ...styles.thSort, padding: '0.65rem 0.5rem', textAlign: 'center', color: '#ffffff', whiteSpace: 'nowrap' }} title="Sort by Total Pieces (Qty)">
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                            <span>TOTAL PIECES (QTY)</span>
                            <span style={{ fontSize: '0.7rem', color: inwardChallanSortField === 'totalQty' ? '#bae6fd' : 'rgba(255,255,255,0.6)' }}>
                              {inwardChallanSortField === 'totalQty' ? (inwardChallanSortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                            </span>
                          </div>
                        </th>
                        <th style={{ ...styles.thStatic, padding: '0.65rem 0.5rem', color: '#ffffff', whiteSpace: 'nowrap' }}>ITEMS PREVIEW</th>
                        <th onClick={() => handleInwardChallanSort('totalAmount')} style={{ ...styles.thSort, padding: '0.65rem 0.5rem', textAlign: 'right', color: '#ffffff', whiteSpace: 'nowrap' }} title="Sort by Total Value">
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                            <span>TOTAL VALUE</span>
                            <span style={{ fontSize: '0.7rem', color: inwardChallanSortField === 'totalAmount' ? '#bae6fd' : 'rgba(255,255,255,0.6)' }}>
                              {inwardChallanSortField === 'totalAmount' ? (inwardChallanSortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                            </span>
                          </div>
                        </th>
                        <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.03em', color: '#ffffff', whiteSpace: 'nowrap' }}>
                          ACTIONS
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInwardChallans.map((ch, idx) => {
                        const dtObj = ch.date ? new Date(ch.date) : null;
                        const dateStr = dtObj && !isNaN(dtObj.getTime())
                          ? dtObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : 'N/A';
                        const timeStr = dtObj && !isNaN(dtObj.getTime())
                          ? dtObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                          : '';

                        const isExpanded = expandedChallanId === ch.id;
                        const skuList = Array.from(ch.skuCodes || []);
                        const visibleSkus = skuList.slice(0, 2);
                        const extraSkusCount = skuList.length - visibleSkus.length;

                        return (
                          <React.Fragment key={ch.id || idx}>
                            <tr style={{
                              borderBottom: isExpanded ? 'none' : '1px solid #e2e8f0',
                              background: isExpanded ? '#f0f9ff' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc'),
                              transition: 'background 0.15s ease'
                            }}>
                              {/* Row Index # */}
                              <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center', color: '#64748b', fontWeight: 700, fontSize: '0.78rem' }}>
                                {idx + 1}
                              </td>

                              {/* Date & Time */}
                              <td style={{ padding: '0.6rem 0.5rem', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
                                <div style={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>{dateStr}</div>
                                {timeStr && <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px', lineHeight: 1.2 }}>{timeStr}</div>}
                              </td>

                              {/* Challan No */}
                              <td style={{ padding: '0.6rem 0.5rem', whiteSpace: 'nowrap' }}>
                                <span style={{
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  border: '1px solid #bfdbfe',
                                  padding: '0.25rem 0.55rem',
                                  borderRadius: '6px',
                                  fontWeight: 800,
                                  fontSize: '0.78rem',
                                  letterSpacing: '0.02em',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem'
                                }}>
                                  <FileText size={12} color="#2563eb" />
                                  {ch.displayChallanNo}
                                </span>
                              </td>

                              {/* Vendor */}
                              <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700, color: '#1e293b', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                                {ch.party || 'Vendor'}
                              </td>

                              {/* Total SKUs */}
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <span style={{
                                  background: '#f5f3ff',
                                  color: '#6d28d9',
                                  border: '1px solid #ddd6fe',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontWeight: 800,
                                  fontSize: '0.76rem'
                                }}>
                                  {ch.skuCodes ? ch.skuCodes.size : ch.items.length} SKUs
                                </span>
                              </td>

                              {/* Total Pieces */}
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <span style={{
                                  background: '#ecfdf5',
                                  color: '#047857',
                                  border: '1px solid #a7f3d0',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontWeight: 800,
                                  fontSize: '0.82rem'
                                }}>
                                  +{ch.totalQty} Pcs
                                </span>
                              </td>

                              {/* Items Preview */}
                              <td style={{ padding: '0.6rem 0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                  {ch.sampleImage && (
                                    <img
                                      src={ch.sampleImage}
                                      alt="preview"
                                      style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #e2e8f0' }}
                                    />
                                  )}
                                  {visibleSkus.map((sku, sIdx) => (
                                    <span key={sIdx} style={{
                                      background: '#f1f5f9',
                                      color: '#334155',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '0.7rem',
                                      fontWeight: 600,
                                      border: '1px solid #cbd5e1'
                                    }}>
                                      {sku}
                                    </span>
                                  ))}
                                  {extraSkusCount > 0 && (
                                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
                                      +{extraSkusCount} more
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Total Value */}
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                {ch.totalAmount > 0 ? (
                                  <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0369a1' }}>
                                    ₹{ch.totalAmount.toFixed(2)}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>
                                    ₹0.00
                                  </span>
                                )}
                              </td>

                              {/* Actions */}
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center' }}>
                                  {/* View Challan Details Modal */}
                                  <button
                                    type="button"
                                    onClick={() => setSelectedChallan(ch)}
                                    style={{
                                      width: '30px',
                                      height: '30px',
                                      padding: 0,
                                      background: '#eff6ff',
                                      border: '1px solid #bfdbfe',
                                      color: '#0284c7',
                                      borderRadius: '7px',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                      transition: 'all 0.15s ease'
                                    }}
                                    title="View Full Challan Breakdown"
                                  >
                                    <Eye size={15} />
                                  </button>

                                  {/* Edit Challan / Stock Items */}
                                  <button
                                    type="button"
                                    onClick={() => handleEditChallan(ch)}
                                    style={{
                                      width: '30px',
                                      height: '30px',
                                      padding: 0,
                                      background: '#fef3c7',
                                      border: '1px solid #fde68a',
                                      color: '#b45309',
                                      borderRadius: '7px',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                      transition: 'all 0.15s ease'
                                    }}
                                    title="Edit Challan / Stock Items"
                                  >
                                    <Edit2 size={14} />
                                  </button>

                                  {/* Print Challan Slip */}
                                  <button
                                    type="button"
                                    onClick={() => handlePrintChallan(ch)}
                                    style={{
                                      width: '30px',
                                      height: '30px',
                                      padding: 0,
                                      background: '#f0fdf4',
                                      border: '1px solid #bbf7d0',
                                      color: '#16a34a',
                                      borderRadius: '7px',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                      transition: 'all 0.15s ease'
                                    }}
                                    title="Print Challan Slip"
                                  >
                                    <Printer size={15} />
                                  </button>

                                  {/* Expand / Collapse Button */}
                                  <button
                                    type="button"
                                    onClick={() => setExpandedChallanId(isExpanded ? null : ch.id)}
                                    style={{
                                      padding: '0 0.5rem',
                                      height: '30px',
                                      background: isExpanded ? '#0284c7' : '#f8fafc',
                                      border: isExpanded ? '1px solid #0284c7' : '1px solid #cbd5e1',
                                      color: isExpanded ? '#ffffff' : '#475569',
                                      borderRadius: '7px',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.2rem',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                      transition: 'all 0.15s ease'
                                    }}
                                    title={isExpanded ? 'Hide Items' : 'Show All Items'}
                                  >
                                    <span>{isExpanded ? 'Hide' : 'Items'}</span>
                                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Inline Expandable Subtable */}
                            {isExpanded && (
                              <tr style={{ background: '#f0f9ff', borderBottom: '2px solid #bae6fd' }}>
                                <td colSpan="9" style={{ padding: '0.85rem 1.25rem' }}>
                                  <div style={{
                                    background: '#ffffff',
                                    borderRadius: '10px',
                                    border: '1px solid #bae6fd',
                                    overflow: 'hidden',
                                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.08)'
                                  }}>
                                    <div style={{
                                      padding: '0.55rem 0.85rem',
                                      background: '#e0f2fe',
                                      borderBottom: '1px solid #bae6fd',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center'
                                    }}>
                                      <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <Layers3 size={14} />
                                        <span>Items Breakdown in Challan {ch.displayChallanNo} ({ch.items.length} items logged)</span>
                                      </div>
                                      <div style={{ fontSize: '0.74rem', color: '#0284c7', fontWeight: 700 }}>
                                        Total: {ch.totalQty} Pcs | ₹{(ch.totalAmount || 0).toFixed(2)}
                                      </div>
                                    </div>

                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                                      <thead>
                                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                                          <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 700, width: '30px' }}>#</th>
                                          <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 700, width: '40px' }}>PHOTO</th>
                                          <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>SKU CODE</th>
                                          <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 700 }}>PRODUCT NAME</th>
                                          <th style={{ padding: '0.45rem 0.6rem', textAlign: 'center', fontWeight: 700 }}>SIZES</th>
                                          <th style={{ padding: '0.45rem 0.6rem', textAlign: 'center', fontWeight: 700 }}>QTY (PCS)</th>
                                          <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', fontWeight: 700 }}>BUY PRICE</th>
                                          <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', fontWeight: 700 }}>TOTAL VALUE</th>
                                          <th style={{ padding: '0.45rem 0.6rem', textAlign: 'center', fontWeight: 700, width: '70px' }}>ACTIONS</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {ch.items.map((subItem, sIdx) => {
                                          const subQty = Number(subItem.qty || subItem.total || subItem.currentlyAvailableStock || 0);
                                          const subBuyPrice = Number(subItem.purchasePrice || 0);
                                          const subTotal = Number(subItem.totalPurchaseAmount || (subQty * subBuyPrice));

                                          return (
                                            <tr key={subItem._id || subItem.id || sIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                              <td style={{ padding: '0.45rem 0.6rem', color: '#94a3b8' }}>{sIdx + 1}</td>
                                              <td style={{ padding: '0.45rem 0.6rem' }}>
                                                <div style={{ width: '28px', height: '28px', borderRadius: '4px', overflow: 'hidden', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                  {subItem.imageUrl ? (
                                                    <img src={subItem.imageUrl} alt={subItem.sku} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                  ) : (
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8' }}>{subItem.itemName ? subItem.itemName[0] : 'E'}</span>
                                                  )}
                                                </div>
                                              </td>
                                              <td style={{ padding: '0.45rem 0.6rem', fontWeight: 700, color: '#0369a1' }}>
                                                {subItem.skuCode || subItem.sku || '-'}
                                              </td>
                                              <td style={{ padding: '0.45rem 0.6rem', fontWeight: 600, color: '#0f172a' }}>
                                                {subItem.itemName || '-'}
                                              </td>
                                              <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                                  {subItem.sizes && subItem.sizes.length > 0 ? (
                                                    subItem.sizes.map((sz, szIdx) => (
                                                      <span key={szIdx} style={{ background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700 }}>
                                                        {sz.size}: {sz.qty}
                                                      </span>
                                                    ))
                                                  ) : (
                                                    <span style={{ color: '#64748b', fontSize: '0.7rem' }}>{subItem.size || '-'}</span>
                                                  )}
                                                </div>
                                              </td>
                                              <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center' }}>
                                                <span style={{ background: '#ecfdf5', color: '#047857', padding: '2px 6px', borderRadius: '4px', fontWeight: 800, fontSize: '0.72rem' }}>
                                                  +{subQty} Pcs
                                                </span>
                                              </td>
                                              <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                                                ₹{subBuyPrice.toFixed(2)}
                                              </td>
                                              <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', fontWeight: 800, color: '#0369a1' }}>
                                                ₹{subTotal.toFixed(2)}
                                              </td>
                                              <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center' }}>
                                                <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                                                  <button
                                                    type="button"
                                                    onClick={() => setViewingItem(subItem)}
                                                    style={{ border: 'none', background: '#eff6ff', color: '#0284c7', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer' }}
                                                    title="View item"
                                                  >
                                                    <Eye size={12} />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleEditChallan(ch)}
                                                    style={{ border: 'none', background: '#fef3c7', color: '#b45309', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer' }}
                                                    title="Edit Inward Challan / Stock"
                                                  >
                                                    <Edit2 size={12} />
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              /* ================= INDIVIDUAL SKUs VIEW ================= */
              filteredInwardItems.length === 0 ? (
                <div style={styles.emptyState}>
                  <span style={{ fontSize: '2.8rem' }}>📥</span>
                  <h4 style={{ margin: '0.5rem 0 0.2rem 0', color: '#1e293b', fontSize: '1.1rem' }}>No inward stock records found</h4>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>Try clearing date filters or add inward stock.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', borderRadius: '8px' }}>
                  <table style={{ width: '100%', minWidth: '920px', borderCollapse: 'collapse', background: '#ffffff', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: '#0369a1', color: '#ffffff' }}>
                        <th onClick={() => handleInwardSort('created_date_time')} style={{ ...styles.thSort, padding: '0.65rem 0.5rem', color: '#ffffff', whiteSpace: 'nowrap' }} title="Sort by Date & Time">
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span>DATE & TIME</span>
                            <span style={{ fontSize: '0.7rem', color: inwardSortField === 'created_date_time' ? '#bae6fd' : 'rgba(255,255,255,0.6)' }}>
                              {inwardSortField === 'created_date_time' ? (inwardSortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                            </span>
                          </div>
                        </th>
                        <th style={{ ...styles.thStatic, padding: '0.65rem 0.5rem', color: '#ffffff', whiteSpace: 'nowrap' }}>PHOTO</th>
                        <th onClick={() => handleInwardSort('skuCode')} style={{ ...styles.thSort, padding: '0.65rem 0.5rem', color: '#ffffff', whiteSpace: 'nowrap' }} title="Sort by SKU Code">
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span>SKU CODE</span>
                            <span style={{ fontSize: '0.7rem', color: inwardSortField === 'skuCode' ? '#bae6fd' : 'rgba(255,255,255,0.6)' }}>
                              {inwardSortField === 'skuCode' ? (inwardSortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                            </span>
                          </div>
                        </th>
                        <th onClick={() => handleInwardSort('itemName')} style={{ ...styles.thSort, padding: '0.65rem 0.5rem', color: '#ffffff' }} title="Sort by Product Name">
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span>PRODUCT NAME</span>
                            <span style={{ fontSize: '0.7rem', color: inwardSortField === 'itemName' ? '#bae6fd' : 'rgba(255,255,255,0.6)' }}>
                              {inwardSortField === 'itemName' ? (inwardSortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                            </span>
                          </div>
                        </th>
                        <th onClick={() => handleInwardSort('party')} style={{ ...styles.thSort, padding: '0.65rem 0.5rem', color: '#ffffff', whiteSpace: 'nowrap' }} title="Sort by Vendor / Supplier">
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span>VENDOR</span>
                            <span style={{ fontSize: '0.7rem', color: inwardSortField === 'party' ? '#bae6fd' : 'rgba(255,255,255,0.6)' }}>
                              {inwardSortField === 'party' ? (inwardSortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                            </span>
                          </div>
                        </th>
                        <th style={{ ...styles.thStatic, padding: '0.65rem 0.5rem', textAlign: 'center', color: '#ffffff', whiteSpace: 'nowrap' }}>SIZES & QTY</th>
                        <th onClick={() => handleInwardSort('qty')} style={{ ...styles.thSort, padding: '0.65rem 0.5rem', textAlign: 'center', color: '#ffffff', whiteSpace: 'nowrap' }} title="Sort by Quantity Inwarded">
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                            <span>QTY IN</span>
                            <span style={{ fontSize: '0.7rem', color: inwardSortField === 'qty' ? '#bae6fd' : 'rgba(255,255,255,0.6)' }}>
                              {inwardSortField === 'qty' ? (inwardSortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                            </span>
                          </div>
                        </th>
                        <th onClick={() => handleInwardSort('purchasePrice')} style={{ ...styles.thSort, padding: '0.65rem 0.5rem', textAlign: 'right', color: '#ffffff', whiteSpace: 'nowrap' }} title="Sort by Buy Price Unit">
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                            <span>BUY PRICE</span>
                            <span style={{ fontSize: '0.7rem', color: inwardSortField === 'purchasePrice' ? '#bae6fd' : 'rgba(255,255,255,0.6)' }}>
                              {inwardSortField === 'purchasePrice' ? (inwardSortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                            </span>
                          </div>
                        </th>
                        <th onClick={() => handleInwardSort('totalPurchaseAmount')} style={{ ...styles.thSort, padding: '0.65rem 0.5rem', textAlign: 'right', color: '#ffffff', whiteSpace: 'nowrap' }} title="Sort by Total Purchase Value">
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                            <span>TOTAL VALUE</span>
                            <span style={{ fontSize: '0.7rem', color: inwardSortField === 'totalPurchaseAmount' ? '#bae6fd' : 'rgba(255,255,255,0.6)' }}>
                              {inwardSortField === 'totalPurchaseAmount' ? (inwardSortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                            </span>
                          </div>
                        </th>
                        <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.03em', color: '#ffffff', whiteSpace: 'nowrap' }}>
                          ACTIONS
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInwardItems.map((item, idx) => {
                        const rawDt = item.created_date_time || item.date;
                        const dtObj = rawDt ? new Date(rawDt) : null;
                        const dateStr = dtObj
                          ? dtObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : 'N/A';
                        const timeStr = dtObj
                          ? dtObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                          : '';

                        const totalQty = item.qty || item.total || 0;
                        const buyPrice = Number(item.purchasePrice || 0);
                        const totalPurchase = Number(item.totalPurchaseAmount || (buyPrice * totalQty));

                        return (
                          <tr key={item.id || item._id || idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                            <td style={{ padding: '0.55rem 0.5rem', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>{dateStr}</div>
                              {timeStr && <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px', lineHeight: 1.2 }}>{timeStr}</div>}
                            </td>
                            <td style={{ padding: '0.55rem 0.5rem' }}>
                              <div style={{ ...styles.itemImgWrapper, width: '36px', height: '36px', borderRadius: '8px' }}>
                                {item.imageUrl ? (
                                  <img 
                                    src={item.imageUrl} 
                                    alt={item.sku} 
                                    style={styles.itemImg}
                                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                  />
                                ) : null}
                                <div style={{ ...styles.imgPlaceholder, display: item.imageUrl ? 'none' : 'flex', fontSize: '0.85rem' }}>
                                  {item.itemName ? item.itemName[0].toUpperCase() : 'E'}
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '0.55rem 0.5rem', whiteSpace: 'nowrap' }}>
                              <span style={{ ...styles.skuText, padding: '0.2rem 0.45rem', fontSize: '0.76rem' }}>{item.skuCode || item.sku || 'N/A'}</span>
                            </td>
                            <td style={{ padding: '0.55rem 0.5rem', fontWeight: 700, color: '#0f172a', fontSize: '0.82rem' }}>
                              {item.itemName}
                            </td>
                            <td style={{ padding: '0.55rem 0.5rem', fontSize: '0.8rem', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {item.party || 'N/A'}
                            </td>
                            <td style={{ padding: '0.55rem 0.5rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                {item.sizes?.map((s, sIdx) => (
                                  <span key={sIdx} style={{ ...styles.sizeTagBadge, padding: '2px 6px', fontSize: '0.7rem' }}>
                                    {s.size}: <strong>{s.qty}</strong>
                                  </span>
                                )) || (
                                  <span style={{ ...styles.sizeTagBadge, padding: '2px 6px', fontSize: '0.7rem' }}>Size: {item.size || 'N/A'}</span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '0.55rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <span style={{ ...styles.qtyInwardBadge, padding: '3px 8px', fontSize: '0.74rem' }}>
                                +{totalQty} Units
                              </span>
                            </td>
                            <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>
                              ₹ {buyPrice.toFixed(2)}
                            </td>
                            <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontSize: '0.82rem', fontWeight: 800, color: '#d97706', whiteSpace: 'nowrap' }}>
                              ₹ {totalPurchase.toFixed(2)}
                            </td>
                            <td style={{ padding: '0.55rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center' }}>
                                {/* Display / View Item Button */}
                                <button
                                  type="button"
                                  onClick={() => setViewingItem(item)}
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    padding: 0,
                                    background: '#eff6ff',
                                    border: '1px solid #bfdbfe',
                                    color: '#2563eb',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                    transition: 'all 0.15s ease'
                                  }}
                                  title="Display Item Details"
                                >
                                  <Eye size={15} />
                                </button>

                                {/* Edit Button */}
                                <button
                                  type="button"
                                  onClick={() => onEdit(item)}
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    padding: 0,
                                    background: '#f0fdf4',
                                    border: '1px solid #bbf7d0',
                                    color: '#16a34a',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                    transition: 'all 0.15s ease'
                                  }}
                                  title="Edit Item Details"
                                >
                                  <Edit2 size={15} />
                                </button>

                                {/* Delete Button */}
                                {onDelete && (
                                  <button
                                    type="button"
                                    onClick={() => onDelete(item._id || item.id)}
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      padding: 0,
                                      background: '#fef2f2',
                                      border: '1px solid #fecaca',
                                      color: '#dc2626',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                      transition: 'all 0.15s ease'
                                    }}
                                    title="Delete Item"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 3: OUTWARD STOCK                                                   */}
      {/* ========================================================================= */}
      {activeSubTab === 'outward' && (
        <>
          {/* Summary Metric Cards for Outward Stock */}
          <div style={styles.statsGrid}>
            <div style={{ ...styles.statCard, borderLeft: '4px solid #f59e0b' }}>
              <div style={styles.statIconWrap('#f59e0b', '#fffbeb')}>
                <Layers3 size={22} color="#f59e0b" />
              </div>
              <div>
                <div style={styles.statLabel}>DISPATCH TRANSACTIONS</div>
                <div style={{ ...styles.statVal, color: '#b45309' }}>
                  {outwardData.items?.length || 0} <span style={styles.statSubText}>records</span>
                </div>
              </div>
            </div>

            <div style={{ ...styles.statCard, borderLeft: '4px solid #ef4444' }}>
              <div style={styles.statIconWrap('#ef4444', '#fef2f2')}>
                <ArrowUpRight size={22} color="#ef4444" />
              </div>
              <div>
                <div style={styles.statLabel}>TOTAL UNITS DISPATCHED</div>
                <div style={{ ...styles.statVal, color: '#dc2626' }}>
                  {(outwardData.totalQty || 0).toLocaleString()} <span style={styles.statSubText}>units</span>
                </div>
              </div>
            </div>
          </div>

          {/* Date Filter & Control Header */}
          <div style={{
            ...styles.controlHeader,
            padding: '0.45rem 0.85rem',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justify: 'space-between',
            flexWrap: 'nowrap',
            gap: '0.5rem',
            overflowX: 'auto',
            whiteSpace: 'nowrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              {/* Search Box */}
              <div style={{ ...styles.searchBox, minWidth: '180px', maxWidth: '240px', padding: '0.35rem 0.65rem' }}>
                <Search size={14} color="#64748b" style={{ flexShrink: 0 }} />
                <input
                  type="text"
                  value={outwardSearchTerm}
                  onChange={(e) => setOutwardSearchTerm(e.target.value)}
                  placeholder="Search outward SKU, item..."
                  style={styles.searchInput}
                />
              </div>

              {/* Standard Regular DateRangePicker Component */}
              <DateRangePicker
                preset={outwardPreset}
                onChange={({ preset: p, dateStart: ds, dateEnd: de }) => {
                  setOutwardPreset(p);
                  setOutwardDateStart(ds);
                  setOutwardDateEnd(de);
                  fetchOutwardData(ds, de);
                }}
                customStart={customOutwardStart}
                customEnd={customOutwardEnd}
                onCustomChange={(s, e) => {
                  setCustomOutwardStart(s);
                  setCustomOutwardEnd(e);
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
              <button onClick={() => fetchOutwardData()} style={{ ...styles.refreshBtn, padding: '0.45rem 0.75rem' }} title="Refresh Outward Log">
                <RefreshCw size={14} className={outwardLoading ? 'spin' : ''} />
                <span>Refresh</span>
              </button>
              <button onClick={() => setShowPartyManager(true)} style={{ ...styles.partyBtn, padding: '0.45rem 0.75rem' }} title="Manage Recipient Parties">
                <Building2 size={14} />
                <span>Manage Parties</span>
              </button>
              <button 
                onClick={handleDownloadOutwardPdf} 
                disabled={downloadingOutwardPdf} 
                style={{ ...styles.pdfBtn, padding: '0.45rem 0.75rem' }}
                title="Download Official Outward PDF Report"
              >
                <FileText size={14} />
                <span>{downloadingOutwardPdf ? 'PDF...' : 'Download PDF'}</span>
              </button>
              <button onClick={() => onStockOut(null)} style={{ ...styles.outwardHeaderBtn, padding: '0.45rem 0.85rem' }}>
                <TrendingDown size={14} />
                <span>+ Dispatch Stock Out</span>
              </button>
            </div>
          </div>

          {/* Outward Stock History Table */}
          <div style={styles.tablePanel}>
            {outwardLoading ? (
              <div style={styles.loadingBox}>
                <RefreshCw size={28} color="#f59e0b" style={{ animation: 'spin 1s linear infinite' }} />
                <p style={{ color: '#475569', fontWeight: 600, marginTop: '0.8rem' }}>Loading Outward Stock History...</p>
              </div>
            ) : outwardError ? (
              <div style={styles.errorBox}>
                <AlertTriangle size={24} color="#dc2626" />
                <span>{outwardError}</span>
                <button onClick={() => fetchOutwardData()} style={styles.retryBtn}>Retry</button>
              </div>
            ) : filteredOutwardItems.length === 0 ? (
              <div style={styles.emptyState}>
                <span style={{ fontSize: '2.8rem' }}>📤</span>
                <h4 style={{ margin: '0.5rem 0 0.2rem 0', color: '#1e293b', fontSize: '1.1rem' }}>No outward stock dispatches found</h4>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>Try adjusting date filters or record a stock dispatch.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: '8px' }}>
                <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', background: '#ffffff', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: '#7c2d12', color: '#ffffff' }}>
                      <th onClick={() => handleOutwardSort('created_date_time')} style={{ ...styles.thSort, padding: '0.65rem 0.5rem', color: '#ffffff', whiteSpace: 'nowrap' }} title="Sort by Date & Time">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span>DATE & TIME</span>
                          <span style={{ fontSize: '0.7rem', color: outwardSortField === 'created_date_time' ? '#fca5a5' : 'rgba(255,255,255,0.6)' }}>
                            {outwardSortField === 'created_date_time' ? (outwardSortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                          </span>
                        </div>
                      </th>
                      <th style={{ ...styles.thStatic, padding: '0.65rem 0.5rem', color: '#ffffff', whiteSpace: 'nowrap' }}>PHOTO</th>
                      <th onClick={() => handleOutwardSort('skuCode')} style={{ ...styles.thSort, padding: '0.65rem 0.5rem', color: '#ffffff', whiteSpace: 'nowrap' }} title="Sort by SKU Code">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span>SKU CODE</span>
                          <span style={{ fontSize: '0.7rem', color: outwardSortField === 'skuCode' ? '#fca5a5' : 'rgba(255,255,255,0.6)' }}>
                            {outwardSortField === 'skuCode' ? (outwardSortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                          </span>
                        </div>
                      </th>
                      <th onClick={() => handleOutwardSort('itemName')} style={{ ...styles.thSort, padding: '0.65rem 0.5rem', color: '#ffffff' }} title="Sort by Product Name">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span>PRODUCT NAME</span>
                          <span style={{ fontSize: '0.7rem', color: outwardSortField === 'itemName' ? '#fca5a5' : 'rgba(255,255,255,0.6)' }}>
                            {outwardSortField === 'itemName' ? (outwardSortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                          </span>
                        </div>
                      </th>
                      <th onClick={() => handleOutwardSort('party')} style={{ ...styles.thSort, padding: '0.65rem 0.5rem', color: '#ffffff', whiteSpace: 'nowrap' }} title="Sort by Vendor / Brand">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span>VENDOR</span>
                          <span style={{ fontSize: '0.7rem', color: outwardSortField === 'party' ? '#fca5a5' : 'rgba(255,255,255,0.6)' }}>
                            {outwardSortField === 'party' ? (outwardSortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                          </span>
                        </div>
                      </th>
                      <th style={{ ...styles.thStatic, padding: '0.65rem 0.5rem', textAlign: 'center', color: '#ffffff', whiteSpace: 'nowrap' }}>SIZES & QTY</th>
                      <th onClick={() => handleOutwardSort('total')} style={{ ...styles.thSort, padding: '0.65rem 0.5rem', textAlign: 'center', color: '#ffffff', whiteSpace: 'nowrap' }} title="Sort by Total Qty Out">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                          <span>QTY OUT</span>
                          <span style={{ fontSize: '0.7rem', color: outwardSortField === 'total' ? '#fca5a5' : 'rgba(255,255,255,0.6)' }}>
                            {outwardSortField === 'total' ? (outwardSortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                          </span>
                        </div>
                      </th>
                      <th onClick={() => handleOutwardSort('purchasePrice')} style={{ ...styles.thSort, padding: '0.65rem 0.5rem', textAlign: 'right', color: '#ffffff', whiteSpace: 'nowrap' }} title="Sort by Buy Price Unit">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                          <span>BUY PRICE</span>
                          <span style={{ fontSize: '0.7rem', color: outwardSortField === 'purchasePrice' ? '#fca5a5' : 'rgba(255,255,255,0.6)' }}>
                            {outwardSortField === 'purchasePrice' ? (outwardSortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                          </span>
                        </div>
                      </th>
                      <th onClick={() => handleOutwardSort('totalPurchaseAmount')} style={{ ...styles.thSort, padding: '0.65rem 0.5rem', textAlign: 'right', color: '#ffffff', whiteSpace: 'nowrap' }} title="Sort by Buy Value Total">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                          <span>TOTAL BUY</span>
                          <span style={{ fontSize: '0.7rem', color: outwardSortField === 'totalPurchaseAmount' ? '#fca5a5' : 'rgba(255,255,255,0.6)' }}>
                            {outwardSortField === 'totalPurchaseAmount' ? (outwardSortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                          </span>
                        </div>
                      </th>
                      <th onClick={() => handleOutwardSort('salePrice')} style={{ ...styles.thSort, padding: '0.65rem 0.5rem', textAlign: 'right', color: '#ffffff', whiteSpace: 'nowrap' }} title="Sort by Sale Price Unit">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                          <span>SALE PRICE</span>
                          <span style={{ fontSize: '0.7rem', color: outwardSortField === 'salePrice' ? '#fca5a5' : 'rgba(255,255,255,0.6)' }}>
                            {outwardSortField === 'salePrice' ? (outwardSortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                          </span>
                        </div>
                      </th>
                      <th onClick={() => handleOutwardSort('totalSellableAmount')} style={{ ...styles.thSort, padding: '0.65rem 0.5rem', textAlign: 'right', color: '#ffffff', whiteSpace: 'nowrap' }} title="Sort by Sale Revenue">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                          <span>SALE REVENUE</span>
                          <span style={{ fontSize: '0.7rem', color: outwardSortField === 'totalSellableAmount' ? '#fca5a5' : 'rgba(255,255,255,0.6)' }}>
                            {outwardSortField === 'totalSellableAmount' ? (outwardSortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                          </span>
                        </div>
                      </th>
                      <th onClick={() => handleOutwardSort('profit')} style={{ ...styles.thSort, padding: '0.65rem 0.5rem', textAlign: 'right', color: '#ffffff', whiteSpace: 'nowrap' }} title="Sort by Gross Profit">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                          <span>PROFIT</span>
                          <span style={{ fontSize: '0.7rem', color: outwardSortField === 'profit' ? '#fca5a5' : 'rgba(255,255,255,0.6)' }}>
                            {outwardSortField === 'profit' ? (outwardSortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
                          </span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOutwardItems.map((item, idx) => {
                      const rawDt = item.created_date_time || item.createdAt || item.date;
                      const dtObj = rawDt ? new Date(rawDt) : null;
                      const dateStr = dtObj
                        ? dtObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : 'N/A';
                      const timeStr = dtObj
                        ? dtObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                        : '';

                      const totalQty = item.total || item.qty || 0;
                      const buyPrice = Number(item.purchasePrice || 0);
                      const sellPrice = Number(item.salePrice || 0);
                      const totalBuy = Number(item.totalPurchaseAmount || (buyPrice * totalQty));
                      const totalSell = Number(item.totalSellableAmount || (sellPrice * totalQty));
                      const profit = totalSell - totalBuy;

                      return (
                        <tr key={item.sku || item.id || idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#fffbfb' }}>
                          <td style={{ padding: '0.55rem 0.5rem', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>{dateStr}</div>
                            {timeStr && <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px', lineHeight: 1.2 }}>{timeStr}</div>}
                          </td>
                          <td style={{ padding: '0.55rem 0.5rem' }}>
                            <div style={{ ...styles.itemImgWrapper, width: '36px', height: '36px', borderRadius: '8px' }}>
                              {item.imageUrl ? (
                                <img 
                                  src={item.imageUrl} 
                                  alt={item.sku} 
                                  style={styles.itemImg}
                                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                />
                              ) : null}
                              <div style={{ ...styles.imgPlaceholder, display: item.imageUrl ? 'none' : 'flex', fontSize: '0.85rem' }}>
                                {item.itemName ? item.itemName[0].toUpperCase() : 'E'}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '0.55rem 0.5rem', whiteSpace: 'nowrap' }}>
                            <span style={{ ...styles.skuText, padding: '0.2rem 0.45rem', fontSize: '0.76rem' }}>{item.sku || item.skuCode || 'N/A'}</span>
                          </td>
                          <td style={{ padding: '0.55rem 0.5rem', fontWeight: 700, color: '#0f172a', fontSize: '0.82rem' }}>
                            {item.itemName}
                          </td>
                          <td style={{ padding: '0.55rem 0.5rem', fontSize: '0.8rem', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {item.party || 'N/A'}
                          </td>
                          <td style={{ padding: '0.55rem 0.5rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', justifyContent: 'center' }}>
                              {item.sizes?.map((s, sIdx) => (
                                <span key={sIdx} style={{ ...styles.sizeTagBadgeOutward, padding: '2px 6px', fontSize: '0.7rem' }}>
                                  {s.size}: <strong>{s.qty}</strong>
                                </span>
                              )) || (
                                <span style={{ ...styles.sizeTagBadgeOutward, padding: '2px 6px', fontSize: '0.7rem' }}>Size: {item.size || 'N/A'}</span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '0.55rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{ ...styles.qtyOutwardBadge, padding: '3px 8px', fontSize: '0.74rem' }}>
                              -{totalQty} Units
                            </span>
                          </td>
                          <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>
                            ₹ {buyPrice.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>
                            ₹ {totalBuy.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: '#0284c7', whiteSpace: 'nowrap' }}>
                            ₹ {sellPrice.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontSize: '0.82rem', fontWeight: 800, color: '#0284c7', whiteSpace: 'nowrap' }}>
                            ₹ {totalSell.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontSize: '0.82rem', fontWeight: 800, color: profit >= 0 ? '#059669' : '#dc2626', whiteSpace: 'nowrap' }}>
                            ₹ {profit.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 4: PRODUCT CATALOG                                                  */}
      {/* ========================================================================= */}
      {activeSubTab === 'catalog' && (
        <ProductCatalogGrid
          items={catalogItems}
          onAdd={() => onAdd && onAdd('catalog')}
          onEdit={onEdit}
          onDelete={onDelete}
          onSync={onSyncCatalog}
          onOpenManager={onOpenManager}
        />
      )}

      {showVendorManager && (
        <VendorPartyManagerModal
          mode="vendors"
          onClose={() => setShowVendorManager(false)}
        />
      )}

      {showPartyManager && (
        <VendorPartyManagerModal
          mode="parties"
          onClose={() => setShowPartyManager(false)}
        />
      )}

      {/* Display Item Modal */}
      {viewingItem && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            boxSizing: 'border-box'
          }}
          onClick={() => setViewingItem(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Package size={20} color="#2563eb" />
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Item Details Display</h4>
              </div>
              <button onClick={() => setViewingItem(null)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', borderRadius: '50%', width: '32px', height: '32px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Close">
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {viewingItem.imageUrl ? (
                  <img src={convertDriveUrl(viewingItem.imageUrl, viewingItem.skuCode || viewingItem.sku)} alt={viewingItem.itemName} style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover', border: '1px solid #cbd5e1' }} />
                ) : (
                  <div style={{ width: '80px', height: '80px', borderRadius: '12px', background: '#f1f5f9', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', fontWeight: 800, color: '#94a3b8' }}>
                    {viewingItem.itemName ? viewingItem.itemName[0].toUpperCase() : 'E'}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{viewingItem.itemName || 'Unnamed Item'}</h3>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '0.2rem 0.6rem', borderRadius: '6px', display: 'inline-block', marginTop: '0.35rem' }}>
                    SKU: {viewingItem.skuCode || viewingItem.sku || 'N/A'}
                  </span>
                </div>
              </div>

              <div style={{ gridTemplateColumns: '1fr 1fr', display: 'grid', gap: '0.85rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, display: 'block' }}>VENDOR / SUPPLIER</span>
                  <strong style={{ color: '#0f172a' }}>{viewingItem.party || 'N/A'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, display: 'block' }}>UNIT BUY PRICE</span>
                  <strong style={{ color: '#059669' }}>₹ {Number(viewingItem.purchasePrice || 0).toFixed(2)}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, display: 'block' }}>TOTAL QUANTITY</span>
                  <strong style={{ color: '#2563eb' }}>{viewingItem.qty || viewingItem.total || viewingItem.currentlyAvailableStock || 0} Units</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, display: 'block' }}>RECORDED DATE</span>
                  <strong style={{ color: '#475569' }}>
                    {(viewingItem.created_date_time || viewingItem.date) 
                      ? formatDateDDMMYYYY(viewingItem.created_date_time || viewingItem.date) 
                      : 'N/A'}
                  </strong>
                </div>
              </div>

              {Array.isArray(viewingItem.sizes) && viewingItem.sizes.length > 0 && (
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>SIZE BREAKDOWN</span>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {viewingItem.sizes.map((s, sIdx) => (
                      <span key={sIdx} style={{ background: '#e2e8f0', color: '#1e293b', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700 }}>
                        {s.size}: {s.qty}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setViewingItem(null)} style={{ padding: '0.5rem 1.2rem', background: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Challan Details Modal */}
      {selectedChallan && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
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
            width: '100%',
            maxWidth: '900px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #bfdbfe',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1rem 1.5rem',
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>Challan {selectedChallan.displayChallanNo}</span>
                  <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                    {selectedChallan.party || 'Vendor'}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#e0f2fe', marginTop: '2px' }}>
                  Received on {new Date(selectedChallan.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at {new Date(selectedChallan.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedChallan(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  width: '32px',
                  height: '32px',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Metrics Ribbon */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '0.75rem',
              padding: '0.85rem 1.5rem',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <div style={{ background: '#ffffff', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b' }}>TOTAL PIECES</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#047857', marginTop: '2px' }}>{selectedChallan.totalQty} Pcs</div>
              </div>
              <div style={{ background: '#ffffff', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b' }}>TOTAL SKUs</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#6d28d9', marginTop: '2px' }}>{selectedChallan.skuCodes ? selectedChallan.skuCodes.size : selectedChallan.items.length} SKUs</div>
              </div>
              <div style={{ background: '#ffffff', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b' }}>TOTAL VALUE</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0369a1', marginTop: '2px' }}>₹{(selectedChallan.totalAmount || 0).toFixed(2)}</div>
              </div>
              <div style={{ background: '#ffffff', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b' }}>TOTAL ITEMS</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#1e293b', marginTop: '2px' }}>{(selectedChallan.items || []).length} Entries</div>
              </div>
            </div>

            {/* Items Table */}
            <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 800, color: '#475569' }}>#</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 800, color: '#475569' }}>PHOTO</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 800, color: '#475569' }}>SKU CODE</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 800, color: '#475569' }}>PRODUCT NAME</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 800, color: '#475569' }}>SIZES</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 800, color: '#475569' }}>QTY</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#475569' }}>BUY PRICE</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#475569' }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedChallan.items || []).map((item, idx) => {
                    const itemQty = Number(item.qty || item.total || item.currentlyAvailableStock || 0);
                    const buyPrice = Number(item.purchasePrice || 0);
                    const totalPurchase = Number(item.totalPurchaseAmount || (buyPrice * itemQty));

                    return (
                      <tr key={item._id || item.id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '0.6rem 0.75rem', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '6px', overflow: 'hidden', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.sku} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>{item.itemName ? item.itemName[0] : 'E'}</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#0369a1' }}>{item.skuCode || item.sku || '-'}</td>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600, color: '#0f172a' }}>{item.itemName || '-'}</td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            {item.sizes && item.sizes.length > 0 ? (
                              item.sizes.map((s, sIdx) => (
                                <span key={sIdx} style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>
                                  {s.size}: {s.qty}
                                </span>
                              ))
                            ) : (
                              <span style={{ color: '#64748b', fontSize: '0.72rem' }}>{item.size || '-'}</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                          <span style={{ background: '#ecfdf5', color: '#047857', padding: '3px 8px', borderRadius: '6px', fontWeight: 800, fontSize: '0.78rem' }}>
                            +{itemQty} Pcs
                          </span>
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                          ₹{buyPrice.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#0369a1' }}>
                          ₹{totalPurchase.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '0.85rem 1.5rem',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Total Received Value: <strong style={{ color: '#0369a1', fontSize: '0.95rem' }}>₹{(selectedChallan.totalAmount || 0).toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handlePrintChallan(selectedChallan)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Printer size={15} />
                  <span>Print Challan Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedChallan(null)}
                  style={{
                    padding: '0.5rem 1.2rem',
                    background: '#64748b',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.82rem'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Inward Challan / Stock Form Modal */}
      {editingChallan && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '960px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #bfdbfe',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.1rem 1.5rem',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Package size={20} color="#ffffff" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>Edit Inward Form</span>
                    <span style={{ background: 'rgba(255,255,255,0.25)', padding: '2px 9px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.3px' }}>
                      {editingChallan.displayChallanNo}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#e0f2fe', marginTop: '2px' }}>
                    Modify inward challan details, supplier, date, quantities, and purchase rates
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingChallan(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  width: '34px',
                  height: '34px',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                title="Close"
              >
                <X size={18} color="#ffffff" strokeWidth={2.5} />
              </button>
            </div>

            {/* Challan Header Fields (Challan No, Vendor, Date) */}
            <div style={{
              padding: '1.1rem 1.5rem',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              alignItems: 'flex-end'
            }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 800, color: '#334155', marginBottom: '5px', textTransform: 'uppercase' }}>
                  <FileText size={13} color="#0284c7" />
                  Challan / Ref No
                </label>
                <input
                  type="text"
                  value={editChallanNo}
                  onChange={(e) => setEditChallanNo(e.target.value)}
                  placeholder="e.g. CH-2109-01 or INW-102"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.8rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    background: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0284c7'}
                  onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 800, color: '#334155', marginBottom: '5px', textTransform: 'uppercase' }}>
                  <Building2 size={13} color="#0284c7" />
                  Vendor / Supplier Party
                </label>
                <input
                  type="text"
                  list="inwardVendorList"
                  value={editParty}
                  onChange={(e) => setEditParty(e.target.value)}
                  placeholder="e.g. pramukh park"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.8rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    background: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0284c7'}
                  onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                />
                <datalist id="inwardVendorList">
                  {sortedVendors.map((v, i) => (
                    <option key={i} value={v} />
                  ))}
                </datalist>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 800, color: '#334155', marginBottom: '5px', textTransform: 'uppercase' }}>
                  <Calendar size={13} color="#0284c7" />
                  Inward Date
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.8rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    background: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0284c7'}
                  onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                />
              </div>
            </div>

            {/* Quick Challan Summary Metrics */}
            <div style={{
              padding: '0.65rem 1.5rem',
              background: '#eff6ff',
              borderBottom: '1px solid #dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '0.78rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Package size={14} color="#0284c7" />
                  <span>Total Items: <strong style={{ color: '#0369a1', fontSize: '0.85rem' }}>{editItems.length} SKUs</strong></span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <TrendingUp size={14} color="#047857" />
                  <span>Total Inward Quantity: <strong style={{ color: '#047857', fontSize: '0.85rem' }}>
                    +{editItems.reduce((sum, it) => sum + (Number(it.qty) || 0), 0)} Pcs
                  </strong></span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <IndianRupee size={14} color="#0f172a" />
                  <span>Challan Value: <strong style={{ color: '#0f172a', fontSize: '0.85rem' }}>
                    ₹{editItems.reduce((sum, it) => sum + ((Number(it.qty) || 0) * (Number(it.purchasePrice) || 0)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong></span>
                </div>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                * Directly edit Inward Qty or Buy Price in rows below
              </div>
            </div>

            {/* Editable Inward Items Table */}
            <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '0.6rem 0.65rem', textAlign: 'left', fontWeight: 800, width: '30px' }}>#</th>
                    <th style={{ padding: '0.6rem 0.65rem', textAlign: 'left', fontWeight: 800, width: '45px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Camera size={13} color="#64748b" /> PHOTO</span>
                    </th>
                    <th style={{ padding: '0.6rem 0.65rem', textAlign: 'left', fontWeight: 800 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Tag size={13} color="#64748b" /> SKU CODE & PRODUCT</span>
                    </th>
                    <th style={{ padding: '0.6rem 0.65rem', textAlign: 'center', fontWeight: 800, width: '90px' }}>SIZE</th>
                    <th style={{ padding: '0.6rem 0.65rem', textAlign: 'center', fontWeight: 800, width: '130px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Layers3 size={13} color="#64748b" /> INWARD QTY</span>
                    </th>
                    <th style={{ padding: '0.6rem 0.65rem', textAlign: 'center', fontWeight: 800, width: '130px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><IndianRupee size={13} color="#64748b" /> BUY PRICE (₹)</span>
                    </th>
                    <th style={{ padding: '0.6rem 0.65rem', textAlign: 'right', fontWeight: 800, width: '110px' }}>TOTAL (₹)</th>
                    <th style={{ padding: '0.6rem 0.65rem', textAlign: 'center', fontWeight: 800, width: '60px' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {editItems.map((item, idx) => {
                    const itemQty = Number(item.qty || 0);
                    const buyPrice = Number(item.purchasePrice || 0);
                    const lineTotal = itemQty * buyPrice;

                    return (
                      <tr key={item._id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem 0.65rem', color: '#64748b', fontWeight: 600 }}>{idx + 1}</td>
                        <td style={{ padding: '0.65rem 0.65rem' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '7px', overflow: 'hidden', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {item.imageUrl ? (
                              <img src={convertDriveUrl(item.imageUrl)} alt={item.skuCode} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0284c7' }}>{item.itemName ? item.itemName[0] : 'E'}</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.65rem' }}>
                          <div style={{ fontWeight: 800, color: '#0369a1', fontSize: '0.82rem' }}>{item.skuCode || '-'}</div>
                          <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
                            {item.itemName || '-'}
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.65rem', textAlign: 'center' }}>
                          <input
                            type="text"
                            value={item.size || ''}
                            onChange={(e) => handleEditItemField(idx, 'size', e.target.value)}
                            placeholder="Size"
                            style={{
                              width: '70px',
                              padding: '0.35rem 0.45rem',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              textAlign: 'center',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              color: '#0f172a'
                            }}
                          />
                        </td>
                        <td style={{ padding: '0.65rem 0.65rem', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <button
                              type="button"
                              onClick={() => handleEditItemField(idx, 'qty', Math.max(0, itemQty - 1))}
                              style={{
                                width: '26px',
                                height: '26px',
                                padding: 0,
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#475569',
                                flexShrink: 0
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                              title="Decrease Qty"
                            >
                              <Minus size={13} color="#475569" strokeWidth={2.5} />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={item.qty}
                              onChange={(e) => handleEditItemField(idx, 'qty', e.target.value)}
                              style={{
                                width: '56px',
                                padding: '0.35rem 0.4rem',
                                borderRadius: '6px',
                                border: '1px solid #93c5fd',
                                background: '#f0f9ff',
                                textAlign: 'center',
                                fontSize: '0.82rem',
                                fontWeight: 800,
                                color: '#0369a1',
                                outline: 'none'
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleEditItemField(idx, 'qty', itemQty + 1)}
                              style={{
                                width: '26px',
                                height: '26px',
                                padding: 0,
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#475569',
                                flexShrink: 0
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                              title="Increase Qty"
                            >
                              <Plus size={13} color="#475569" strokeWidth={2.5} />
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.65rem', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>₹</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.purchasePrice}
                              onChange={(e) => handleEditItemField(idx, 'purchasePrice', e.target.value)}
                              style={{
                                width: '74px',
                                padding: '0.35rem 0.45rem',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                textAlign: 'right',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                color: '#0f172a',
                                outline: 'none'
                              }}
                            />
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.65rem', textAlign: 'right', fontWeight: 800, color: '#0284c7' }}>
                          ₹{lineTotal.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.65rem 0.65rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveEditItem(idx)}
                            style={{
                              border: '1px solid #fecaca',
                              background: '#fee2e2',
                              color: '#dc2626',
                              width: '28px',
                              height: '28px',
                              padding: 0,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#fca5a5'; e.currentTarget.style.color = '#b91c1c'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626'; }}
                            title="Remove SKU from Challan"
                          >
                            <Trash2 size={14} color="#dc2626" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <button
                type="button"
                onClick={() => setEditingChallan(null)}
                style={{
                  padding: '0.55rem 1.25rem',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
              >
                <X size={15} color="#64748b" />
                <span>Cancel</span>
              </button>

              <button
                type="button"
                onClick={handleSaveChallanMeta}
                disabled={isUpdatingChallan}
                style={{
                  padding: '0.6rem 1.6rem',
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '0.84rem',
                  cursor: isUpdatingChallan ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.28)',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => { if (!isUpdatingChallan) e.currentTarget.style.background = '#0369a1'; }}
                onMouseLeave={(e) => { if (!isUpdatingChallan) e.currentTarget.style.background = '#0284c7'; }}
              >
                <Sparkles size={16} />
                <span>{isUpdatingChallan ? 'Saving Changes...' : 'Save Inward Details'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    width: '100%',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },

  // SUB-TAB TOP BAR STYLES
  subTabBarContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    background: '#ffffff',
    padding: '0.75rem 1rem',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
    flexWrap: 'wrap',
  },
  subTabBar: {
    display: 'flex',
    gap: '0.4rem',
    alignItems: 'center',
    background: '#f1f5f9',
    padding: '5px',
    borderRadius: '12px',
    border: '1px solid #cbd5e1',
  },
  subTabButton: (active, type) => {
    let activeBg = 'linear-gradient(135deg, #1e293b, #0f172a)';
    let activeColor = '#ffffff';
    let activeShadow = '0 4px 12px rgba(15, 23, 42, 0.25)';

    if (type === 'inward') {
      activeBg = 'linear-gradient(135deg, #10b981, #059669)';
      activeShadow = '0 4px 12px rgba(16, 185, 129, 0.25)';
    } else if (type === 'outward') {
      activeBg = 'linear-gradient(135deg, #f59e0b, #d97706)';
      activeShadow = '0 4px 12px rgba(245, 158, 11, 0.25)';
    } else if (type === 'catalog') {
      activeBg = 'linear-gradient(135deg, #8b5cf6, #6d28d9)';
      activeShadow = '0 4px 12px rgba(139, 92, 246, 0.25)';
    }

    return {
      display: 'flex',
      alignItems: 'center',
      gap: '0.6rem',
      padding: '0.65rem 1.25rem',
      borderRadius: '9px',
      border: 'none',
      background: active ? activeBg : 'transparent',
      color: active ? activeColor : '#475569',
      fontSize: '0.85rem',
      fontWeight: active ? 800 : 600,
      cursor: 'pointer',
      boxShadow: active ? activeShadow : 'none',
      transition: 'all 0.2s ease',
    };
  },
  tabBadge: (active, color) => ({
    fontSize: '0.72rem',
    fontWeight: 800,
    padding: '2px 8px',
    borderRadius: '12px',
    background: active ? 'rgba(255, 255, 255, 0.25)' : '#e2e8f0',
    color: active ? '#ffffff' : color,
    lineHeight: 1.3,
  }),

  bulkInwardHeaderBtn: {
    padding: '0.6rem 1.2rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    borderRadius: '9px',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #10b981, #047857)',
    color: '#ffffff',
    border: 'none',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
  },
  addSkuHeaderBtn: {
    padding: '0.6rem 1.2rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    borderRadius: '9px',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    color: '#ffffff',
    border: 'none',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
  },
  outwardHeaderBtn: {
    padding: '0.6rem 1.2rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    borderRadius: '9px',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #f59e0b, #b45309)',
    color: '#ffffff',
    border: 'none',
    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)',
  },

  // STATS GRID STYLES
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: '1rem',
  },
  statCard: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '1.15rem 1.3rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
    transition: 'all 0.2s ease',
  },
  statIconWrap: (color, bg) => ({
    width: '46px',
    height: '46px',
    borderRadius: '12px',
    background: bg || `${color}15`,
    border: `1px solid ${color}30`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: `0 4px 10px ${color}15`,
  }),
  statLabel: {
    fontSize: '0.7rem',
    fontWeight: 800,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  statSubText: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    fontWeight: 500,
  },
  statVal: {
    fontSize: '1.4rem',
    fontWeight: 900,
    color: '#0f172a',
    marginTop: '3px',
  },

  // TOOLBAR & CONTROL STYLES
  controlHeader: {
    padding: '0.45rem 0.85rem',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
    overflowX: 'auto',
    whiteSpace: 'nowrap',
  },
  rowOne: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
    width: '100%',
  },
  rowTwo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    width: '100%',
    paddingTop: '0.75rem',
    borderTop: '1px solid #f1f5f9',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    padding: '0.6rem 0.9rem',
    minWidth: '260px',
    flex: 1,
    maxWidth: '380px',
  },
  searchInput: {
    border: 'none',
    background: 'none',
    color: '#0f172a',
    fontSize: '0.85rem',
    outline: 'none',
    width: '100%',
    fontWeight: 500,
  },
  pillContainer: {
    display: 'flex',
    gap: '0.4rem',
    background: '#f1f5f9',
    padding: '4px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
  },
  statusPill: (active, type) => {
    let activeBg = '#4f46e5';
    if (type === 'lowstock') activeBg = '#f59e0b';
    if (type === 'outofstock') activeBg = '#ef4444';
    if (type === 'instock') activeBg = '#10b981';

    return {
      padding: '0.45rem 0.95rem',
      borderRadius: '8px',
      border: 'none',
      background: active ? activeBg : 'transparent',
      color: active ? '#ffffff' : '#475569',
      fontSize: '0.78rem',
      fontWeight: active ? 800 : 600,
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    };
  },
  filterBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    padding: '0 0.65rem',
    borderRadius: '9px',
  },
  selectInput: {
    border: 'none',
    background: 'none',
    padding: '0.6rem 0.4rem',
    fontSize: '0.82rem',
    color: '#0f172a',
    outline: 'none',
    cursor: 'pointer',
    fontWeight: 600,
  },

  // EXACT STANDARD ERP DATE FILTER COMPONENT MATCHING SCREENSHOT
  dateFilterContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    padding: '0.45rem 0.85rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
    flexWrap: 'wrap',
  },
  dateInput: {
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '0.4rem 0.65rem',
    fontSize: '0.83rem',
    color: '#0f172a',
    fontWeight: 600,
    outline: 'none',
    background: '#ffffff',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    cursor: 'pointer',
  },
  presetGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: '#eef2ff',
    padding: '4px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    marginLeft: '0.4rem',
  },
  presetBtn: (active) => ({
    padding: '0.4rem 0.85rem',
    fontSize: '0.8rem',
    fontWeight: active ? 800 : 700,
    borderRadius: '8px',
    border: 'none',
    background: active ? '#ffffff' : 'transparent',
    color: active ? '#1e293b' : '#475569',
    cursor: 'pointer',
    boxShadow: active ? '0 2px 6px rgba(0, 0, 0, 0.08)' : 'none',
    transition: 'all 0.15s ease',
  }),

  // BUTTON STYLES
  refreshBtn: {
    padding: '0.6rem 1.1rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    borderRadius: '9px',
    cursor: 'pointer',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    color: '#475569',
  },
  exportBtn: {
    padding: '0.6rem 1.15rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    borderRadius: '9px',
    cursor: 'pointer',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    color: '#334155',
  },
  vendorBtn: {
    padding: '0.6rem 1.15rem',
    fontSize: '0.82rem',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    borderRadius: '9px',
    cursor: 'pointer',
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    color: '#047857',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  partyBtn: {
    padding: '0.6rem 1.15rem',
    fontSize: '0.82rem',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    borderRadius: '9px',
    cursor: 'pointer',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    color: '#1d4ed8',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  pdfBtn: {
    padding: '0.6rem 1.15rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    borderRadius: '9px',
    cursor: 'pointer',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    color: '#1d4ed8',
  },
  addInwardStockBtn: {
    padding: '0.6rem 1.15rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    borderRadius: '9px',
    cursor: 'pointer',
    background: '#10b981',
    color: '#ffffff',
    border: 'none',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
  },
  outwardBtn: {
    padding: '0.6rem 1.15rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    borderRadius: '9px',
    cursor: 'pointer',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
  },
  bulkInwardBtn: {
    padding: '0.6rem 1.15rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    borderRadius: '9px',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #4f46e5, #4338ca)',
    color: '#ffffff',
    border: 'none',
    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)',
  },
  addSkuBtn: {
    padding: '0.6rem 1.15rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    borderRadius: '9px',
    cursor: 'pointer',
    background: '#10b981',
    color: '#ffffff',
    border: 'none',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
  },
  moreBtn: {
    padding: '0.6rem 0.8rem',
    borderRadius: '9px',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#475569',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },

  // TABLE CONTAINER STYLES
  tablePanel: {
    borderRadius: '14px',
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
  },
  tableHeaderRow: {
    background: '#0f172a',
    color: '#ffffff',
  },
  emptyState: {
    padding: '4rem 1rem',
    textAlign: 'center',
  },
  loadingBox: {
    padding: '4rem 1rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    padding: '2rem',
    textAlign: 'center',
    background: '#fef2f2',
    color: '#dc2626',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    fontWeight: 600,
  },
  retryBtn: {
    padding: '0.45rem 1rem',
    borderRadius: '7px',
    background: '#dc2626',
    color: '#ffffff',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 700,
  },
  thSort: {
    padding: '0.9rem 1rem',
    textAlign: 'left',
    fontSize: '0.75rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    cursor: 'pointer',
    userSelect: 'none',
  },
  thStatic: {
    padding: '0.9rem 1rem',
    textAlign: 'left',
    fontSize: '0.75rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
  },
  itemCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.8rem',
  },
  itemImgWrapper: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    overflow: 'hidden',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    flexShrink: 0,
    position: 'relative',
    boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
  },
  itemImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  imgPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
    fontWeight: 800,
    color: '#0284c7',
    background: '#f0f9ff',
  },
  itemName: {
    fontWeight: 700,
    color: '#0f172a',
    fontSize: '0.88rem',
  },
  itemMeta: {
    fontSize: '0.7rem',
    color: '#64748b',
    marginTop: '2px',
  },
  skuText: {
    fontFamily: 'monospace',
    fontSize: '0.82rem',
    color: '#0284c7',
    background: '#f0f9ff',
    padding: '0.25rem 0.6rem',
    borderRadius: '6px',
    border: '1px solid #bae6fd',
    fontWeight: 700,
  },
  sizeBadge: {
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#334155',
    background: '#f8fafc',
    padding: '0.25rem 0.6rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
  },
  sizeTagBadge: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#047857',
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    padding: '3px 9px',
    borderRadius: '12px',
  },
  sizeTagBadgeOutward: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#b45309',
    background: '#fffbeb',
    border: '1px solid #fde68a',
    padding: '3px 9px',
    borderRadius: '12px',
  },
  qtyInwardBadge: {
    display: 'inline-block',
    padding: '5px 14px',
    borderRadius: '20px',
    fontSize: '0.82rem',
    fontWeight: 800,
    backgroundColor: '#ecfdf5',
    color: '#059669',
    border: '1.5px solid #a7f3d0',
  },
  qtyOutwardBadge: {
    display: 'inline-block',
    padding: '5px 14px',
    borderRadius: '20px',
    fontSize: '0.82rem',
    fontWeight: 800,
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    border: '1.5px solid #fecaca',
  },
  actionsCell: {
    display: 'flex',
    gap: '0.45rem',
    justifyContent: 'center',
  },
  tblActionBtn: (color, bg, border) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    minWidth: '36px',
    minHeight: '36px',
    borderRadius: '9px',
    border: `2px solid ${border}`,
    background: bg,
    color: color,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
    transition: 'all 0.15s ease',
    flexShrink: 0,
  }),
};

// Inject Responsive Mobile CSS Styles for Store Inventory
if (typeof document !== 'undefined') {
  const styleElId = 'inventory-grid-responsive-style';
  if (!document.getElementById(styleElId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleElId;
    styleEl.innerHTML = `
      @media (max-width: 768px) {
        .inv-sub-tab-bar-container {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          width: 100% !important;
          overflow: visible !important;
        }
        .inv-sub-tab-bar {
          display: grid !important;
          grid-template-columns: repeat(3, 1fr) !important;
          width: 100% !important;
          gap: 4px !important;
          padding: 4px !important;
          box-sizing: border-box !important;
          border-radius: 12px !important;
          background: #f1f5f9 !important;
          border: 1px solid #cbd5e1 !important;
        }
        .inv-sub-tab-bar button {
          width: 100% !important;
          justify-content: center !important;
          text-align: center !important;
          padding: 0.55rem 0.2rem !important;
          font-size: 0.72rem !important;
          gap: 0.25rem !important;
          flex-direction: column !important;
          box-sizing: border-box !important;
        }
        .inv-row-two-actions {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          width: 100% !important;
          gap: 0.5rem !important;
        }
        .inv-row-two-actions button {
          width: 100% !important;
          justify-content: center !important;
          padding: 0.6rem 0.4rem !important;
          font-size: 0.78rem !important;
          box-sizing: border-box !important;
        }
        .inv-stats-grid {
          grid-template-columns: repeat(2, 1fr) !important;
          gap: 0.5rem !important;
        }
        .inv-control-header {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 0.65rem !important;
          padding: 0.85rem !important;
        }
        .inv-row-one {
          flex-direction: column !important;
          width: 100% !important;
          gap: 0.65rem !important;
        }
        .inv-search-box {
          width: 100% !important;
        }
        .inv-pill-container {
          width: 100% !important;
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch !important;
          display: flex !important;
          flex-wrap: nowrap !important;
          padding-bottom: 3px !important;
        }
        .inv-dropdown-group {
          width: 100% !important;
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 0.5rem !important;
        }
        .inv-dropdown-group > div {
          width: 100% !important;
        }
        .inv-dropdown-group select {
          width: 100% !important;
        }
      }

      @media (max-width: 480px) {
        .inv-stats-grid {
          grid-template-columns: 1fr 1fr !important;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }
}
