import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import CatalogManagerModal from './CatalogManagerModal';
import { triggerPushNotification, triggerGlobalDataRefresh } from './NotificationToast';
import ScreenGroupRoster from './ScreenGroupRoster';
import { dispatchScreenGroupEvent } from '../services/screenGroupService';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import { matchSearchQuery } from '../utils/searchUtils';
import { cleanDesignNameString } from '../utils/designUtils';
import { triggerEliteAlert, triggerEliteConfirm } from './EliteModalDialog';
import DateRangePicker from './DateRangePicker';
import {
  RefreshCw, PlusCircle, ArrowDownToLine, ArrowUpFromLine,
  Layers, Database, Settings, Trash2, FileDown, Search, X,
  AlertTriangle, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Edit, FileText,
  Check, Plus, ArrowRightLeft, Download, Eye, Receipt, Clock, Truck
} from 'lucide-react';

export default function FabricInventoryPanel({ department, onNavigateToBilling, initialTab = 'dashboard', onlyChallan = false }) {
  const [activeTab, setActiveTab] = useState(onlyChallan ? 'challan' : initialTab);
  const currentUser = api.getCurrentUser();

  const renderJobNoBadge = (jobNoRaw) => {
    if (!jobNoRaw) return '—';
    const cleanStr = String(jobNoRaw).replace(/^#?JOB\s*NO\.?\s*-\s*/i, '').trim();
    if (!cleanStr) return '—';

    const parts = cleanStr.split(/[,/]+/).map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) return '—';

    if (parts.length === 1) {
      const num = parts[0].replace(/^#?JOB-?/i, '');
      return (
        <span style={{
          display: 'inline-block',
          whiteSpace: 'nowrap',
          padding: '0.2rem 0.5rem',
          borderRadius: 4,
          fontWeight: 800,
          color: '#38bdf8',
          background: 'rgba(56,189,248,0.12)',
          border: '1px solid rgba(56,189,248,0.25)',
          fontSize: '0.78rem'
        }}>
          #{num}
        </span>
      );
    }

    const firstTwo = parts.slice(0, 2).map(p => `#${p.replace(/^#?JOB-?/i, '')}`).join(', ');
    const remainingCount = parts.length - 2;
    const fullTooltip = parts.map(p => `#${p.replace(/^#?JOB-?/i, '')}`).join(', ');

    return (
      <span
        title={`Linked Job Cards (${parts.length}): ${fullTooltip}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          whiteSpace: 'nowrap',
          padding: '0.2rem 0.5rem',
          borderRadius: 4,
          fontWeight: 800,
          color: '#38bdf8',
          background: 'rgba(56,189,248,0.12)',
          border: '1px solid rgba(56,189,248,0.25)',
          fontSize: '0.78rem',
          cursor: 'help'
        }}
      >
        <span>{firstTwo}</span>
        {remainingCount > 0 && (
          <span style={{
            background: 'rgba(56,189,248,0.25)',
            color: '#38bdf8',
            fontSize: '0.68rem',
            padding: '1px 5px',
            borderRadius: 4,
            fontWeight: 900
          }}>
            +{remainingCount}
          </span>
        )}
      </span>
    );
  };

  const normalizeFabricName = (val, pannaVal = '') => {
    if (!val) return '';
    let str = String(val).trim().toUpperCase();

    let extractedPanna = '';
    const pannaMatches = str.match(/(?:\s+(\d+))+\s*$/);
    if (pannaMatches) {
      const digits = pannaMatches[0].trim().split(/\s+/);
      extractedPanna = digits[digits.length - 1];
      str = str.replace(/(?:\s+(\d+))+\s*$/, '').trim();
    }

    let base = str;
    if (base === 'LINEN' || base === 'KOINUR LINEN' || base === 'KOHINUR LINEN' || base === 'KOHINOOR LINEN' || base.includes('KOINUR') || base.includes('KOHINOOR') || base.includes('KOHINUR')) {
      base = 'KOHINOOR LINEN';
    } else if (base === 'REYON' || base === 'RAYON' || base === 'POLY REYON' || base === 'POLY RAYON' || base.includes('REYON') || base.includes('RAYON')) {
      if (base.includes('30 SPN')) {
        base = 'POLY REYON 30 SPN';
      } else {
        base = 'POLY REYON';
      }
    } else if (base === 'CREPE' || base === 'CRAPE' || base === 'FRANCH CREPE' || base === 'FRENCH CREP' || base.includes('CREPE') || base.includes('CRAPE') || base.includes('CREP')) {
      base = 'FRENCH CREPE';
    } else if (base === 'CAMRIK' || base === 'CEMBRIC' || base === 'CEMBRIK' || base === 'CAMBRIK' || base.includes('CAMRIK') || base.includes('CEMBRIK')) {
      base = 'CAMBRIC';
    } else if (base === 'MAL' || base === 'POLY MAL' || base === 'POLYMALL' || base === 'POLY MLL' || base === 'POLLY MAL') {
      base = 'POLLY MAL';
    }

    let finalPanna = extractedPanna || (pannaVal ? String(pannaVal).trim().replace(/['"]/g, '') : '');
    if (finalPanna === '38' || finalPanna === '46' || finalPanna === '56') finalPanna = '58';
    if (!finalPanna || finalPanna.toUpperCase() === 'UNKNOWN' || isNaN(parseInt(finalPanna, 10))) {
      if (base.includes('ARMANI')) finalPanna = '44';
      else finalPanna = '58';
    }

    return `${base} ${finalPanna}`;
  };

  const getDefaultPannaForFabric = (fabricName, currentPanna = '') => {
    let clean = currentPanna ? String(currentPanna).trim().replace(/['"]/g, '') : '';
    if (clean === '46' || clean === '56') return '58';
    if (!clean || clean.toUpperCase() === 'UNKNOWN') {
      const fabUpper = String(fabricName || '').trim().toUpperCase();
      if (fabUpper.includes('ARMANI')) {
        return '44';
      }
      return '58';
    }
    return clean;
  };
  const isAdmin = currentUser?.role === 'admin';
  const [stock, setStock] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [fabricsList, setFabricsList] = useState([]);
  const [vendorsList, setVendorsList] = useState([]);
  const [partiesList, setPartiesList] = useState([]);
  const [widthsList, setWidthsList] = useState([]);
  const [inProgressJobCards, setInProgressJobCards] = useState([]);
  const [lotList, setLotList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lotLoading, setLotLoading] = useState(false);

  // Challan state
  const [challans, setChallans] = useState([]);
  const [challanSearch, setChallanSearch] = useState('');
  const [challanStatusFilter, setChallanStatusFilter] = useState('All');
  // Ref to always hold latest challan filter values — prevents stale closure in setInterval
  const challanFiltersRef = useRef({ search: '', dateStart: '', dateEnd: '', status: 'All' });
  const [challanDatePreset, setChallanDatePreset] = useState('all');
  const [challanDateStart, setChallanDateStart] = useState('');
  const [challanDateEnd, setChallanDateEnd] = useState('');
  const [customChallanDateStart, setCustomChallanDateStart] = useState('');
  const [customChallanDateEnd, setCustomChallanDateEnd] = useState('');
  const [isChallanOpen, setIsChallanOpen] = useState(false);
  const [editingChallan, setEditingChallan] = useState(null);
  const [challanLotLoading, setChallanLotLoading] = useState(false);
  const [challanDeleteTarget, setChallanDeleteTarget] = useState(null);
  const [viewChallanModal, setViewChallanModal] = useState(null);
  const [selectedChallanMap, setSelectedChallanMap] = useState({});
  const selectedChallanIds = Object.keys(selectedChallanMap);
  const [availableLots, setAvailableLots] = useState([]);
  const [billToOptions, setBillToOptions] = useState([]);
  const [shipToOptions, setShipToOptions] = useState([]);
  const [deliveryByOptions, setDeliveryByOptions] = useState([]);
  const [lotPartyMap, setLotPartyMap] = useState({});

  const emptyTpRows = () => [{ tpNo: 1, tpMeter: '' }];
  const [challanForm, setChallanForm] = useState({
    date: new Date().toISOString().split('T')[0],
    partyName: '',
    lotNo: '',
    vendorChallanNo: '',
    deliveryBy: '',
    fabricName: '',
    shortagePct: '',
    jobNo: '',
    designNo: '',
    colour: '',
    panna: '',
    pcs: '',
    billTo: '',
    shipTo: '',
    tpDetails: emptyTpRows(),
    notes: '',
  });

  // Stock Adjustment (SA) state
  const [stockAdjustments, setStockAdjustments] = useState([]);
  const [saSearch, setSaSearch] = useState('');
  const [saDateStart, setSaDateStart] = useState('');
  const [saDateEnd, setSaDateEnd] = useState('');
  const [isSaFormOpen, setIsSaFormOpen] = useState(false);
  const [saDeleteTarget, setSaDeleteTarget] = useState(null);
  const [saAvailableLots, setSaAvailableLots] = useState([]);
  const [editingSa, setEditingSa] = useState(null);
  const [saForm, setSaForm] = useState({
    date: new Date().toISOString().split('T')[0],
    partyName: '',
    vendorChallanNo: '',
    adjustmentType: 'RETURN_REJECTED',
    fabricQuality: '',
    panna: '',
    lotNo: '',
    reason: 'Fabric Return / Rejection',
    notes: '',
    tpDetails: [{ tpNo: 1, tpMeter: '', lotNo: '' }]
  });

  // Lot Transfer state
  const [selectedChallanHistory, setSelectedChallanHistory] = useState(null);
  const [lotTransfers, setLotTransfers] = useState([]);
  const [transferSearch, setTransferSearch] = useState('');
  const [transferDateStart, setTransferDateStart] = useState('');
  const [transferDateEnd, setTransferDateEnd] = useState('');
  const [isTransferFormOpen, setIsTransferFormOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    date: new Date().toISOString().split('T')[0],
    fabricQuality: '',
    panna: '58',
    sourceLotNo: '',
    destLotNo: '',
    qty: '',
    notes: '',
  });

  const openQuickTransfer = (targetLot) => {
    const rawDeficit = Math.abs(targetLot.currentStock || 0);
    setTransferForm({
      date: new Date().toISOString().split('T')[0],
      fabricQuality: targetLot.fabricQuality || '',
      panna: targetLot.panna || '58',
      sourceLotNo: '',
      destLotNo: String(targetLot.lotNo),
      qty: rawDeficit > 0 ? String(rawDeficit.toFixed(2)) : '',
      notes: `Deficit Clearance for Lot #${targetLot.lotNo}`
    });
    setIsTransferFormOpen(true);
    setActiveTab('lotTransfer');
  };

  const fileInputRef = useRef(null);

  const handleExportCsv = () => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const itemsMap = new Map();

    // 1. Gather combinations from transactions
    transactions.forEach(t => {
      const fName = String(t.fabricQuality || '').trim().toUpperCase();
      const pVal = String(t.panna || '').trim();
      if (!fName) return;

      const key = `${fName}|||${pVal}`;
      if (!itemsMap.has(key)) {
        itemsMap.set(key, { fabricQuality: fName, panna: pVal, openingStock: 0, inwardQty: 0, outwardQty: 0, currentStock: 0 });
      }

      const item = itemsMap.get(key);
      const qty = Number(t.qty || 0);
      const tDate = new Date(t.date);
      const isPrev = tDate < startOfMonth;
      const isAdj = t.notes && t.notes.includes('Adjustment');

      if (isPrev) {
        if (t.type === 'INWARD') {
          item.openingStock += qty;
        } else {
          item.openingStock -= qty;
        }
      } else {
        if (t.type === 'INWARD') {
          if (!isAdj) item.inwardQty += qty;
        } else {
          if (!isAdj) item.outwardQty += qty;
        }
      }
    });

    // 2. Add configured fabrics from fabricsList if not present
    fabricsList.forEach(f => {
      const fName = String(f || '').trim().toUpperCase();
      if (!fName) return;
      const widths = widthsList.length > 0 ? widthsList : [''];
      widths.forEach(w => {
        const pVal = String(w || '').trim();
        const key = `${fName}|||${pVal}`;
        if (!itemsMap.has(key)) {
          itemsMap.set(key, { fabricQuality: fName, panna: pVal, openingStock: 0, inwardQty: 0, outwardQty: 0, currentStock: 0 });
        }
      });
    });

    // 3. Compute final currentStock and format as CSV
    const rows = [];
    itemsMap.forEach(item => {
      let totalIn = 0;
      let totalOut = 0;
      transactions.forEach(t => {
        if (String(t.fabricQuality || '').trim().toUpperCase() === item.fabricQuality &&
          String(t.panna || '').trim() === item.panna) {
          if (t.type === 'INWARD') totalIn += Number(t.qty || 0);
          else totalOut += Number(t.qty || 0);
        }
      });
      item.currentStock = totalIn - totalOut;
      rows.push(item);
    });

    // Generate CSV string
    const headers = ['Fabric Quality', 'Panna', 'Opening Stock', 'Inward Qty', 'Outward Qty', 'Current Stock', 'Date', 'Challan No', 'Vendor Name', 'Job No', 'Party Name', 'Notes'];
    const csvContent = [
      headers.join(','),
      ...rows.map(r => [
        `"${r.fabricQuality}"`,
        `"${r.panna}"`,
        r.openingStock.toFixed(2),
        r.inwardQty.toFixed(2),
        r.outwardQty.toFixed(2),
        r.currentStock.toFixed(2),
        '""', // Date
        '""', // Challan No
        '""', // Vendor Name
        '""', // Job No
        '""', // Party Name
        '""'  // Notes
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `fabric-stock-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCsv = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) {
          alert('CSV file is empty.');
          return;
        }

        const rows = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const cols = [];
          let insideQuote = false;
          let currentWord = '';
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              insideQuote = !insideQuote;
            } else if (char === ',' && !insideQuote) {
              cols.push(currentWord.trim());
              currentWord = '';
            } else {
              currentWord += char;
            }
          }
          cols.push(currentWord.trim());

          const fabricQuality = cols[0];
          const panna = cols[1];
          const openingStock = cols[2];
          const inwardQty = cols[3];
          const outwardQty = cols[4];
          const currentStock = cols[5];
          const date = cols[6];
          const challanNo = cols[7];
          const vendorName = cols[8];
          const jobNo = cols[9];
          const partyName = cols[10];
          const notes = cols[11];

          if (!fabricQuality) continue;

          rows.push({
            fabricQuality,
            panna,
            openingStock: openingStock !== undefined && openingStock !== '' ? parseFloat(openingStock) : 0,
            inwardQty: inwardQty !== undefined && inwardQty !== '' ? parseFloat(inwardQty) : 0,
            outwardQty: outwardQty !== undefined && outwardQty !== '' ? parseFloat(outwardQty) : 0,
            currentStock: currentStock !== undefined && currentStock !== '' ? parseFloat(currentStock) : 0,
            date: date || '',
            challanNo: challanNo || '',
            vendorName: vendorName || '',
            jobNo: jobNo || '',
            partyName: partyName || '',
            notes: notes || ''
          });
        }

        if (rows.length === 0) {
          alert('No valid rows found in CSV.');
          return;
        }

        setLoading(true);
        const res = await api.importFabricStock(rows);
        if (res.success) {
          alert(res.message || 'Fabric stock imported successfully.');
          fetchData();
        } else {
          alert(res.error || 'Failed to import fabric stock.');
        }
      } catch (err) {
        alert('Error parsing CSV: ' + err.message);
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Panna-wise stock & requirement
  const [pannaStock, setPannaStock] = useState([]);
  const [requirement, setRequirement] = useState([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [expandedFabric, setExpandedFabric] = useState(null);
  const [stockSortOrder, setStockSortOrder] = useState('highToLow');

  // Search / filter state
  const [inwardSearch, setInwardSearch] = useState('');
  const [outwardSearch, setOutwardSearch] = useState('');

  const [inwardDateStart, setInwardDateStart] = useState('');
  const [inwardDateEnd, setInwardDateEnd] = useState('');
  const [inwardSortBy, setInwardSortBy] = useState('date');
  const [inwardSortOrder, setInwardSortOrder] = useState('desc');

  const [outwardDateStart, setOutwardDateStart] = useState('');
  const [outwardDateEnd, setOutwardDateEnd] = useState('');
  const [outwardSortBy, setOutwardSortBy] = useState('date');
  const [outwardSortOrder, setOutwardSortOrder] = useState('desc');

  // Lot-Wise Management state
  const [lotSearch, setLotSearch] = useState('');
  const [lotStatusFilter, setLotStatusFilter] = useState('All');
  const [expandedLotNo, setExpandedLotNo] = useState(null);
  const [lotPdfLoading, setLotPdfLoading] = useState(false);

  // PDF download filter state
  const [pdfFilter, setPdfFilter] = useState({
    dateStart: '',
    dateEnd: '',
    fabricQuality: ''
  });
  const [isPdfFilterOpen, setIsPdfFilterOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Combined Multi-Report Modal state
  const [isCombinedModalOpen, setIsCombinedModalOpen] = useState(false);
  const [combinedDateStart, setCombinedDateStart] = useState(() => new Date().toISOString().split('T')[0]);
  const [combinedDateEnd, setCombinedDateEnd] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedCombinedReports, setSelectedCombinedReports] = useState(['challan', 'inward', 'lotwise', 'stock', 'machine']);
  const [combinedLoading, setCombinedLoading] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, type, label }

  // Editing transaction
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editingOutwardTransaction, setEditingOutwardTransaction] = useState(null);

  // Modals
  const [isInwardOpen, setIsInwardOpen] = useState(false);
  const [isOutwardOpen, setIsOutwardOpen] = useState(false);
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  // Form states
  const [inwardForm, setInwardForm] = useState({
    challanNo: '', vendorName: '', fabricQuality: '', panna: '', qty: '', shortagePct: '', shortageMtr: '', shortageMode: 'pct', date: new Date().toISOString().split('T')[0], notes: ''
  });
  const [outwardForm, setOutwardForm] = useState({
    jobNo: '', challanNo: '', partyName: '', fabricQuality: '', panna: '', lotNo: '', qty: '', date: new Date().toISOString().split('T')[0], notes: ''
  });

  const fetchData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError('');
    try {
      const cfg = await api.getPrintConfig();
      if (cfg && Array.isArray(cfg.fabrics)) {
        setFabricsList(cfg.fabrics);
      } else if (cfg && cfg.fabrics) {
        setFabricsList(Object.keys(cfg.fabrics));
      }

      try {
        const vRes = await api.getFabricVendors();
        if (vRes) setVendorsList(vRes);
      } catch (e) {
        console.warn('Failed to fetch fabric vendors', e);
      }

      if (cfg && cfg.parties) setPartiesList(cfg.parties);
      if (cfg && cfg.widths) {
        const defaultWidths = ['58', '44', '36'];
        const cleanWidths = cfg.widths.map(w => String(w).replace(/['"]/g, '')).filter(Boolean);
        const combined = Array.from(new Set([...defaultWidths, ...cleanWidths]));
        setWidthsList(combined);
      } else {
        setWidthsList(['58', '44', '36']);
      }
      if (cfg && cfg.billToOptions) setBillToOptions(cfg.billToOptions);
      if (cfg && cfg.shipToOptions) setShipToOptions(cfg.shipToOptions);
      if (cfg && Array.isArray(cfg.deliveryOptions) && cfg.deliveryOptions.length > 0) {
        setDeliveryByOptions(cfg.deliveryOptions);
      }
      if (cfg && cfg.lotPartyMap) setLotPartyMap(cfg.lotPartyMap);

      try {
        const jRes = await api.getJobCards({ limit: 5000 });
        if (jRes && jRes.data) setInProgressJobCards(jRes.data);
      } catch (e) {
        console.warn('Failed to fetch job cards', e);
      }

      const stockRes = await api.getFabricStock({ department });
      if (stockRes.success) setStock(stockRes.data);

      const transRes = await api.getFabricTransactions({ department });
      if (transRes.success) setTransactions(transRes.data);

      // Panna-wise stock
      try {
        const pRes = await api.getFabricStockByPanna({ department });
        if (pRes && pRes.success) setPannaStock(pRes.data || []);
      } catch (e) { console.warn('Failed to fetch panna stock', e); }

      // Lot Transfers
      try {
        const ltRes = await api.getLotTransfers();
        if (ltRes && ltRes.success) setLotTransfers(ltRes.data || []);
      } catch (e) { console.warn('Failed to fetch lot transfers', e); }

    } catch (err) {
      if (!isSilent) setError(err.message || 'Failed to load fabric inventory data.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  // Flexible job card lookup helper
  const findMatchingJobCard = (val) => {
    if (!val) return null;
    const cleanVal = String(val).trim().toUpperCase();
    const numVal = cleanVal.replace(/\D/g, '');

    return inProgressJobCards.find(j => {
      if (!j.jobNo) return false;
      const jStr = String(j.jobNo).trim().toUpperCase();
      const jNum = jStr.replace(/\D/g, '');

      return (
        jStr === cleanVal ||
        (numVal && jNum === numVal) ||
        jStr === `JOB-${cleanVal}` ||
        jStr === `EDP-${cleanVal}` ||
        `JOB-${jStr}` === cleanVal ||
        `EDP-${jStr}` === cleanVal
      );
    });
  };

  // fetch requirement from job cards
  const fetchRequirement = async (isSilent = false) => {
    if (!isSilent) setReqLoading(true);
    try {
      const res = await api.getFabricRequirement();
      if (res && res.success) setRequirement(res.data || []);
    } catch (e) {
      console.warn('Failed to fetch requirement', e);
    } finally {
      if (!isSilent) setReqLoading(false);
    }
  };

  const fetchStockAdjustments = async () => {
    try {
      const res = await api.getStockAdjustments();
      if (res && res.success) setStockAdjustments(res.data || []);
    } catch (e) {
      console.warn('Failed to fetch stock adjustments', e);
    }
  };

  useEffect(() => {
    fetchData(false);
    fetchRequirement(false);
    fetchChallans();
    fetchStockAdjustments();
    const intervalId = setInterval(() => {
      fetchData(true);
      fetchRequirement(true);
      // NOTE: fetchChallans is intentionally excluded here.
      // It has its own useEffect that fires on challanSearch/date changes.
      // Including it here with a stale closure would reset search results every 5s.
      fetchStockAdjustments();
    }, 5000); // 5s real-time auto-sync

    const handleDataRefresh = () => {
      fetchData(true);
      fetchRequirement(true);
      fetchChallans(); // Uses ref — always reads current search/date values
      fetchStockAdjustments();
    };
    window.addEventListener('elite-data-refresh', handleDataRefresh);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('elite-data-refresh', handleDataRefresh);
    };
  }, []);

  // ─── Fetch ALL lots (no filter) — client side will filter by fabric ───
  const fetchAllLots = async () => {
    setLotLoading(true);
    try {
      const res = await api.getFabricLotStock({});
      if (res && res.success) setLotList(res.data || []);
    } catch (e) {
      console.warn('Failed to fetch lot stock', e);
    } finally {
      setLotLoading(false);
    }
  };

  // Re-fetch lots whenever outward modal opens
  useEffect(() => {
    if (isOutwardOpen) fetchAllLots();
  }, [isOutwardOpen]);

  const handleLotNoChange = (e) => {
    const val = e.target.value;
    setOutwardForm(prev => {
      const updated = { ...prev, lotNo: val };
      const lot = lotList.find(l => String(l.lotNo) === String(val));
      if (lot && lot.panna) updated.panna = lot.panna;
      return updated;
    });
  };

  const handleInwardSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const cleanFabric = normalizeFabricName(inwardForm.fabricQuality, inwardForm.panna);
    const payload = { ...inwardForm, fabricQuality: cleanFabric || inwardForm.fabricQuality, department: department || 'digital_print' };
    try {
      if (editingTransaction) {
        await api.updateFabricTransaction(editingTransaction._id, payload);
        triggerPushNotification('🧵 Fabric Transaction Updated', 'Inward fabric transaction updated.', 'info');
      } else {
        await api.createFabricInward(payload);
        triggerPushNotification('🧵 Fabric Inward Added', `${inwardForm.qty || ''}M of ${cleanFabric || inwardForm.fabricQuality} inward recorded!`, 'success');
      }
      setIsInwardOpen(false);
      setEditingTransaction(null);
      setInwardForm({ challanNo: '', vendorName: '', fabricQuality: '', panna: '', qty: '', shortagePct: '', date: new Date().toISOString().split('T')[0], notes: '' });
      triggerGlobalDataRefresh('fabric');
      fetchData();
    } catch (err) {
      alert(err.message);
      setLoading(false);
    }
  };

  const handleOutwardSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const cleanFabric = normalizeFabricName(outwardForm.fabricQuality, outwardForm.panna);
    const payload = { ...outwardForm, fabricQuality: cleanFabric || outwardForm.fabricQuality, department: department || 'digital_print' };
    try {
      if (editingOutwardTransaction) {
        await api.updateFabricTransaction(editingOutwardTransaction._id, payload);
        triggerPushNotification('📦 Outward Transaction Updated', `Outward transaction for Job #${outwardForm.jobNo} updated.`, 'info');
      } else {
        await api.createFabricOutward(payload);
        triggerPushNotification('📦 Fabric Outward Recorded', `${outwardForm.qty || ''}M fabric outward recorded for Job #${outwardForm.jobNo}.`, 'success');
      }
      setIsOutwardOpen(false);
      setEditingOutwardTransaction(null);
      setOutwardForm({ jobNo: '', partyName: '', fabricQuality: '', panna: '', lotNo: '', qty: '', date: new Date().toISOString().split('T')[0], notes: '' });
      triggerGlobalDataRefresh('fabric');
      fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startEditOutward = (t) => {
    setEditingOutwardTransaction(t);
    setOutwardForm({
      jobNo: t.jobNo || '',
      partyName: t.partyName || '',
      fabricQuality: t.fabricQuality || '',
      panna: t.panna || '58',
      lotNo: t.lotNo ? String(t.lotNo) : '',
      qty: t.qty != null ? String(t.qty) : '',
      date: t.date ? new Date(t.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      notes: t.notes || ''
    });
    setIsOutwardOpen(true);
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!transferForm.fabricQuality || !transferForm.sourceLotNo || !transferForm.destLotNo || !transferForm.qty) {
      alert('Please fill in all required fields (Fabric Quality, Source Lot, Destination Lot, Quantity).');
      return;
    }
    setLoading(true);
    const cleanFabric = normalizeFabricName(transferForm.fabricQuality, transferForm.panna);
    const payload = { ...transferForm, fabricQuality: cleanFabric || transferForm.fabricQuality };
    try {
      const res = await api.createLotTransfer(payload);
      if (res.success) {
        triggerPushNotification('🔄 Lot Transfer Complete', res.message || `Transferred ${transferForm.qty}m to Lot #${transferForm.destLotNo}`, 'success');
        setIsTransferFormOpen(false);
        setTransferForm({
          date: new Date().toISOString().split('T')[0],
          fabricQuality: '',
          panna: '58',
          sourceLotNo: '',
          destLotNo: '',
          qty: '',
          notes: '',
        });
        triggerGlobalDataRefresh('fabric');
        fetchData();
      } else {
        alert(res.error || 'Failed to create lot transfer');
      }
    } catch (err) {
      alert('Error creating lot transfer: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const [autoTransferLoading, setAutoTransferLoading] = useState(false);

  const handleAutoLotTransfer = async () => {
    const negLots = lotRecords.filter(l => l.currentStock < 0);
    const negCount = negLots.length;
    if (negCount === 0) {
      triggerEliteAlert('Inventory Clean', 'No negative deficit lots found. Inventory stock balances are clean!', 'success');
      return;
    }

    const totalDeficit = negLots.reduce((sum, l) => sum + Math.abs(l.currentStock), 0);

    const confirmed = await triggerEliteConfirm({
      title: 'Auto Rebalance Lots',
      message: `Found ${negCount} negative stock lots with a total deficit of ${totalDeficit.toFixed(2)} mtr.\n\nDo you want to automatically transfer stock from matching positive lots to eliminate these deficits?`,
      confirmText: 'Run Auto Rebalance',
      type: 'warning'
    });
    if (!confirmed) return;

    setAutoTransferLoading(true);
    try {
      const res = await api.autoLotTransfer();
      if (res.success) {
        triggerPushNotification('⚡ Auto Lot Rebalance Complete', res.message || 'Deficit lots rebalanced successfully!', 'success');
        triggerGlobalDataRefresh('fabric');
        fetchData();
      } else {
        triggerEliteAlert('Rebalance Error', res.error || 'Failed to auto-rebalance lot stock.', 'error');
      }
    } catch (err) {
      triggerEliteAlert('Rebalance Error', 'Error running auto lot transfer: ' + err.message, 'error');
    } finally {
      setAutoTransferLoading(false);
    }
  };

  const startEditInward = (t) => {
    setEditingTransaction(t);
    setInwardForm({
      challanNo: t.challanNo || '',
      vendorName: t.vendorName || '',
      fabricQuality: t.fabricQuality || '',
      panna: t.panna || '',
      qty: t.qty || '',
      shortagePct: t.shortagePct != null ? String(t.shortagePct) : '',
      shortageMtr: t.shortageMtr != null ? String(t.shortageMtr) : '',
      shortageMode: t.shortageMode || (t.shortageMtr != null && !t.shortagePct ? 'mtr' : 'pct'),
      date: t.date ? new Date(t.date).toISOString().split('T')[0] : '',
      notes: t.notes || ''
    });
    setIsInwardOpen(true);
  };

  const closeInwardModal = () => {
    setIsInwardOpen(false);
    setEditingTransaction(null);
    setInwardForm({ challanNo: '', vendorName: '', fabricQuality: '', panna: '', qty: '', shortagePct: '', shortageMtr: '', shortageMode: 'pct', date: new Date().toISOString().split('T')[0], notes: '' });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteFabricTransaction(deleteTarget.id);
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      await api.downloadFabricLedgerPdf(pdfFilter);
      setIsPdfFilterOpen(false);
    } catch (err) {
      alert('Failed to generate PDF: ' + err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  // ── Modal scroll lock & smooth reset helper ──
  useEffect(() => {
    if (isChallanOpen || isInwardOpen || isOutwardOpen || isSaFormOpen || isTransferFormOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isChallanOpen, isInwardOpen, isOutwardOpen, isSaFormOpen, isTransferFormOpen]);

  useEffect(() => {
    const handleOpenModal = (event) => {
      resetChallanForm();
      setEditingChallan(null);
      if (event && event.detail) {
        const d = event.detail;
        const totalMtrVal = parseFloat(d.totalMtr) || parseFloat(d.pcs) || '';
        setChallanForm(prev => ({
          ...prev,
          date: d.date ? String(d.date).split('T')[0] : new Date().toISOString().split('T')[0],
          partyName: d.party || d.partyName || d.customerName || '',
          billTo: d.party || d.partyName || d.customerName || '',
          jobNo: d.jobNo || '',
          fabricName: d.fabric || d.fabricName || '',
          designNo: cleanDesignNameString(d.designNo || d.designName || ''),
          lotNo: d.lotNo || '',
          vendorChallanNo: d.partyChallan || d.vendorChallanNo || '',
          tpDetails: totalMtrVal ? [{ id: 1, tpNo: 1, tpMeter: String(totalMtrVal) }] : emptyTpRows()
        }));
      }
      setIsChallanOpen(true);
    };
    window.addEventListener('open-new-challan', handleOpenModal);
    return () => window.removeEventListener('open-new-challan', handleOpenModal);
  }, []);

  const closeChallanModal = () => {
    setIsChallanOpen(false);
    setEditingChallan(null);
    resetChallanForm();
    document.body.style.overflow = '';

    const executeScrollTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const selectors = '.main-content, .app-container, .content-area, .dashboard-container, .table-responsive, section, main, .panel-body';
      document.querySelectorAll(selectors).forEach(c => {
        if (c) {
          c.scrollTop = 0;
          if (typeof c.scrollTo === 'function') c.scrollTo(0, 0);
        }
      });
    };

    executeScrollTop();
    requestAnimationFrame(executeScrollTop);
    setTimeout(executeScrollTop, 50);
    setTimeout(executeScrollTop, 150);
  };

  // ── Challan helpers ────────────────────────────────────────────────────
  const resetChallanForm = () => {
    setChallanForm({
      date: new Date().toISOString().split('T')[0],
      partyName: '', lotNo: '', vendorChallanNo: '', deliveryBy: '', fabricName: '', shortagePct: '', shortageMtr: '', shortageMode: 'pct',
      jobNo: '', designNo: '', colour: '', panna: '', pcs: '', billTo: '', shipTo: '',
      tpDetails: emptyTpRows(), notes: '',
    });
    setAvailableLots([]);
  };

  const fetchChallans = async () => {
    try {
      // Always read from ref so stale closures (e.g. setInterval) get current filter values
      const { search, dateStart, dateEnd, status } = challanFiltersRef.current;
      const res = await api.getFabricChallans({
        dateStart,
        dateEnd,
        search,
        status
      });
      if (res.success) setChallans(res.data || []);
    } catch (e) {
      console.warn('Failed to fetch challans', e);
    }
  };

  // Keep ref in sync with state so fetchChallans always reads current values.
  // Debounce search input: wait 400ms after user stops typing before firing API.
  // Date changes fire immediately (no delay). Cleanup cancels stale requests.
  useEffect(() => {
    challanFiltersRef.current = { search: challanSearch, dateStart: challanDateStart, dateEnd: challanDateEnd, status: challanStatusFilter };
    // No debounce for date/status filter changes, only for text search
    const delay = challanSearch !== challanFiltersRef.current.search ? 400 : 0;
    const debounceTimer = setTimeout(() => {
      fetchChallans();
    }, challanSearch ? 400 : 0); // Instant clear when search is emptied, 400ms delay while typing
    return () => clearTimeout(debounceTimer); // Cancel previous timer on next keystroke
  }, [challanDateStart, challanDateEnd, challanSearch, challanStatusFilter]);

  const getVendorShortForm = (name) => {
    if (!name) return '';
    const u = name.toUpperCase().trim();
    if (u.includes('AVSAR')) return 'AV';
    if (u.includes('ELITE')) return 'EL';
    if (u.includes('FABTEX')) return 'FT';
    if (u.includes('MAHAGAURI')) return 'MG';
    if (u.includes('OEQUAL') || u.includes('OE')) return 'OE';
    if (u.includes('OZONE')) return 'OZ';
    if (u.includes('YAMUNAJI')) return 'YM';
    return u.substring(0, 2);
  };

  // When Lot No changes — auto-fill vendor challans, fabric, shortage, panna
  const handleChallanLotChange = async (val) => {
    const lotsList = String(val)
      .split(/[,\s&]+/)
      .map(x => x.trim())
      .filter(Boolean);
    const defaultLot = lotsList[0] || '';

    // Auto-fill partyName if mapped in lotPartyMap
    let mappedParty = '';
    for (const lotStr of lotsList) {
      if (lotPartyMap[lotStr]) {
        mappedParty = lotPartyMap[lotStr];
        break;
      }
    }

    setChallanForm(prev => {
      const updatedTps = prev.tpDetails.map(tp => {
        if (!tp.lotNo || !lotsList.includes(tp.lotNo)) {
          return { ...tp, lotNo: defaultLot };
        }
        return tp;
      });

      return {
        ...prev,
        lotNo: val,
        partyName: mappedParty || prev.partyName,
        tpDetails: updatedTps
      };
    });
    if (!val) return;

    if (lotsList.length === 0) return;

    setChallanLotLoading(true);
    try {
      // Fetch details for all selected lots concurrently
      const promises = lotsList.map(lot => api.getFabricLotInfo(lot).catch(() => null));
      const results = await Promise.all(promises);

      const validResults = results.filter(r => r && r.success && r.data);
      if (validResults.length > 0) {
        // Collect all vendor challans with their vendor short prefix
        const vendorChallans = validResults
          .map(r => {
            const shortName = getVendorShortForm(r.data.vendorName);
            const vNo = r.data.vendorChallanNo || '';
            if (shortName && vNo) {
              const cleanNo = vNo.replace(/^[A-Za-z0-9]{2,3}-/i, '');
              return `${shortName}-${cleanNo}`;
            }
            return vNo;
          })
          .filter(Boolean);

        // Remove duplicates and join with commas
        const uniqueChallans = [...new Set(vendorChallans)].join(', ');

        // Collect fabricName, shortage, panna from first valid response
        const first = validResults[0].data;

        setChallanForm(prev => ({
          ...prev,
          vendorChallanNo: uniqueChallans || prev.vendorChallanNo,
          fabricName: first.fabricName || prev.fabricName,
          shortagePct: first.shortagePct != null ? String(first.shortagePct) : prev.shortagePct,
          panna: prev.panna || first.panna || '',
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch multiple lot info', e);
    } finally {
      setChallanLotLoading(false);
    }
  };

  const handleJobNoChange = async (e) => {
    const val = e.target.value;
    const rawTokens = String(val || '').split(',').map(s => s.trim()).filter(Boolean);
    const matchedJobs = rawTokens.map(token => findMatchingJobCard(token)).filter(Boolean);

    if (matchedJobs.length > 0) {
      const primaryJob = matchedJobs[0];
      const combinedJobNo = Array.from(new Set(matchedJobs.map(j => j.jobNo))).join(', ');

      setOutwardForm(prev => ({
        ...prev,
        jobNo: val.includes(',') ? val : (combinedJobNo || val),
        partyName: primaryJob.party || prev.partyName,
        fabricQuality: primaryJob.fabric || prev.fabricQuality,
        panna: primaryJob.panna || prev.panna,
        lotNo: prev.lotNo
      }));
    } else {
      setOutwardForm(prev => ({ ...prev, jobNo: val }));
    }
    fetchAllLots();
  };

  const toggleOutwardJobPill = (jobNoToToggle) => {
    const currentTokens = String(outwardForm.jobNo || '').split(',').map(s => s.trim()).filter(Boolean);
    let updatedTokens;

    const existsIndex = currentTokens.findIndex(tok => {
      const j1 = findMatchingJobCard(tok);
      const j2 = findMatchingJobCard(jobNoToToggle);
      return (j1 && j2 && j1._id === j2._id) || tok.toUpperCase() === jobNoToToggle.toUpperCase();
    });

    if (existsIndex >= 0) {
      updatedTokens = currentTokens.filter((_, idx) => idx !== existsIndex);
    } else {
      updatedTokens = [...currentTokens, jobNoToToggle];
    }

    const newVal = updatedTokens.join(', ');
    handleJobNoChange({ target: { value: newVal } });
  };

  // When Job No changes — handles single or multiple comma-separated Job Nos
  const handleChallanJobChange = async (val) => {
    const rawTokens = String(val || '').split(',').map(s => s.trim()).filter(Boolean);
    const matchedJobs = rawTokens.map(token => findMatchingJobCard(token)).filter(Boolean);

    if (matchedJobs.length > 0) {
      const combinedJobNo = Array.from(new Set(matchedJobs.map(j => j.jobNo))).join(', ');
      const combinedDesigns = cleanDesignNameString(Array.from(new Set(matchedJobs.map(j => j.designNo).filter(Boolean))).join(', '));
      const combinedColors = Array.from(new Set(matchedJobs.map(j => j.colors).filter(Boolean))).join(', ');
      const primaryJob = matchedJobs[0];

      setChallanForm(prev => ({
        ...prev,
        jobNo: val.includes(',') ? val : (combinedJobNo || val),
        designNo: combinedDesigns || prev.designNo,
        colour: combinedColors || prev.colour,
        panna: primaryJob.panna || prev.panna,
        fabricName: primaryJob.fabric || prev.fabricName,
        partyName: primaryJob.party || prev.partyName,
        billTo: primaryJob.billTo || prev.billTo || '',
        shipTo: primaryJob.shipTo || prev.shipTo || '',
      }));

      // Fetch lot numbers that have this fabric
      if (primaryJob.fabric) {
        try {
          const res = await api.getFabricLotStock({ fabricQuality: primaryJob.fabric, panna: primaryJob.panna });
          if (res.success && res.data) {
            setAvailableLots(res.data);
          }
        } catch (e) {
          console.warn('Failed to fetch lot stock for fabric', e);
        }
      }
    } else {
      setChallanForm(prev => ({ ...prev, jobNo: val }));
      setAvailableLots([]);
    }
  };

  useEffect(() => {
    if (isChallanOpen && challanForm.fabricName) {
      api.getFabricLotStock({ fabricQuality: challanForm.fabricName, panna: challanForm.panna || undefined })
        .then(res => {
          if (res.success && res.data) setAvailableLots(res.data);
        }).catch(() => { });
    }
  }, [isChallanOpen, challanForm.fabricName, challanForm.panna]);

  // Toggle job card pill selection for Challan form
  const toggleChallanJobPill = (jobNoToToggle) => {
    const currentTokens = String(challanForm.jobNo || '').split(',').map(s => s.trim()).filter(Boolean);
    let updatedTokens;

    const existsIndex = currentTokens.findIndex(tok => {
      const j1 = findMatchingJobCard(tok);
      const j2 = findMatchingJobCard(jobNoToToggle);
      return (j1 && j2 && j1._id === j2._id) || tok.toUpperCase() === jobNoToToggle.toUpperCase();
    });

    if (existsIndex >= 0) {
      updatedTokens = currentTokens.filter((_, idx) => idx !== existsIndex);
    } else {
      updatedTokens = [...currentTokens, jobNoToToggle];
    }

    const newVal = updatedTokens.join(', ');
    handleChallanJobChange(newVal);
  };

  // TP detail update
  const updateTpRow = (index, field, value) => {
    setChallanForm(prev => {
      const tpDetails = [...prev.tpDetails];
      tpDetails[index] = { ...tpDetails[index], [field]: value };
      return { ...prev, tpDetails };
    });
  };

  const addTpRow = () => {
    setChallanForm(prev => {
      if (prev.tpDetails.length >= 30) return prev;
      const nextNo = prev.tpDetails.length + 1;
      const lots = String(prev.lotNo || '')
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      const defaultLot = lots[0] || '';
      return { ...prev, tpDetails: [...prev.tpDetails, { tpNo: nextNo, tpMeter: '', lotNo: defaultLot }] };
    });
  };

  const removeTpRow = (index) => {
    setChallanForm(prev => {
      const tpDetails = prev.tpDetails.filter((_, i) => i !== index);
      return { ...prev, tpDetails };
    });
  };

  // Computed totals from tpDetails
  const challanTotalMtr = challanForm.tpDetails.reduce((sum, r) => sum + (parseFloat(r.tpMeter) || 0), 0);
  const challanTotalTp = challanForm.tpDetails.filter(r => parseFloat(r.tpMeter) > 0).length;

  const handleChallanSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const cleanFabric = normalizeFabricName(challanForm.fabricName, challanForm.panna);
    try {
      const payload = {
        ...challanForm,
        fabricName: cleanFabric || challanForm.fabricName,
        totalMtr: challanTotalMtr,
        totalTp: challanTotalTp,
        tpDetails: challanForm.tpDetails
          .filter(r => r.tpMeter !== '' && r.tpMeter != null)
          .map(r => ({ tpNo: Number(r.tpNo), tpMeter: parseFloat(r.tpMeter) || 0, lotNo: r.lotNo || '' })),
      };
      if (editingChallan) {
        await api.updateFabricChallan(editingChallan._id, payload);
      } else {
        const createRes = await api.createFabricChallan(payload);
        const newNo = createRes?.data?.challanNo || createRes?.challanNo || 'EDP';
        dispatchScreenGroupEvent('jobcards_fabric', 'New Delivery Challan Created 🚚', `Delivery Challan EDP-${newNo} for ${challanForm.partyName || 'Party'} (${challanTotalMtr.toFixed(2)} mtr) was created and dispatched to Fabric Group.`, 'challan');
      }
      closeChallanModal();
      triggerGlobalDataRefresh('fabric');
      fetchData();
      fetchChallans();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startEditChallan = (c) => {
    setEditingChallan(c);
    const tpRows = c.tpDetails && c.tpDetails.length > 0
      ? c.tpDetails.map(r => ({ tpNo: r.tpNo, tpMeter: String(r.tpMeter) }))
      : emptyTpRows();
    setChallanForm({
      date: c.date ? new Date(c.date).toISOString().split('T')[0] : '',
      partyName: c.partyName || '',
      lotNo: c.lotNo != null ? String(c.lotNo) : '',
      vendorChallanNo: c.vendorChallanNo || '',
      deliveryBy: c.deliveryBy || '',
      fabricName: c.fabricName || '',
      shortagePct: c.shortagePct != null ? String(c.shortagePct) : '',
      shortageMtr: c.shortageMtr != null ? String(c.shortageMtr) : '',
      shortageMode: c.shortageMode || (c.shortageMtr != null && !c.shortagePct ? 'mtr' : 'pct'),
      jobNo: c.jobNo || '',
      designNo: c.designNo || '',
      colour: c.colour || '',
      panna: c.panna || '',
      pcs: c.pcs != null ? String(c.pcs) : '',
      billTo: c.billTo || '',
      shipTo: c.shipTo || '',
      tpDetails: tpRows,
      notes: c.notes || '',
    });

    if (c.fabricName) {
      api.getFabricLotStock({ fabricQuality: c.fabricName, panna: c.panna }).then(res => {
        if (res.success && res.data) setAvailableLots(res.data);
      }).catch(() => { });
    } else {
      setAvailableLots([]);
    }

    setIsChallanOpen(true);
  };

  const handleChallanDelete = async () => {
    if (!challanDeleteTarget) return;
    try {
      await api.deleteFabricChallan(challanDeleteTarget.id);
      setChallanDeleteTarget(null);
      triggerGlobalDataRefresh('fabric');
      fetchData();
      fetchChallans();
    } catch (err) {
      alert('Failed to delete challan: ' + err.message);
    }
  };

  const handleDownloadChallanPdf = async (id, challanNo) => {
    try {
      await api.downloadFabricChallanPdf(id, challanNo);
    } catch (err) {
      alert('Failed to download PDF: ' + err.message);
    }
  };

  // Create Bill / Tax Invoice directly from a Delivery Challan
  const handleCreateBillFromChallan = async (ch) => {
    if (onNavigateToBilling) {
      onNavigateToBilling(ch);
      return;
    }
    try {
      const mtr = parseFloat(ch.totalMtr || 0) || parseFloat(ch.pcs || 0) || 1;
      const party = ch.billTo || ch.partyName || 'Client';
      const defaultRate = '25';

      // Look up saved customer to map Contact Person Name, Business Name, Phone, GSTIN, Address
      let contactPersonName = party;
      let businessName = party;
      let phone = ch.phone || '';
      let gstin = ch.gstin || '';
      let billingAddress = ch.address || '';
      let customerId = null;

      try {
        const custRes = await api.getBillingCustomers();
        const customerList = (custRes && custRes.data && Array.isArray(custRes.data)) ? custRes.data : Array.isArray(custRes) ? custRes : [];
        const matched = customerList.find(c =>
          (c.businessName && c.businessName.trim().toLowerCase() === party.trim().toLowerCase()) ||
          (c.name && c.name.trim().toLowerCase() === party.trim().toLowerCase())
        );
        if (matched) {
          contactPersonName = matched.name || party;
          businessName = matched.businessName || party;
          phone = matched.phone || phone;
          gstin = matched.gstin || gstin;
          billingAddress = matched.billingAddress || billingAddress;
          customerId = matched._id;
        }
      } catch (e) {
        console.warn('Customer lookup warning:', e);
      }

      // Dynamic Item Name mapping based on Panna (36", 44", 58")
      const pannaStr = String(ch.panna || '').trim();
      let itemName = 'DIGITAL PRINT JOB WORK 58"';
      if (pannaStr.includes('36')) {
        itemName = 'DIGITAL PRINT JOB WORK 36"';
      } else if (pannaStr.includes('44')) {
        itemName = 'DIGITAL PRINT JOB WORK 44"';
      } else if (pannaStr.includes('58')) {
        itemName = 'DIGITAL PRINT JOB WORK 58"';
      } else if (pannaStr) {
        itemName = `DIGITAL PRINT JOB WORK ${pannaStr.replace(/['"]/g, '')}"`;
      }

      const rateInput = window.prompt(
        `🧾 CREATE BILL / INVOICE FROM CHALLAN #EDP-${ch.challanNo}\n\nParty (Billed To): ${businessName} ${contactPersonName !== businessName ? `(${contactPersonName})` : ''}\nItem: ${itemName}\nFabric: ${ch.fabricName || 'Fabric'}\nTotal Meters: ${mtr.toFixed(2)} mtr\n\nEnter Rate per Meter (₹):`,
        defaultRate
      );

      if (rateInput === null) return;
      const unitPrice = parseFloat(rateInput);
      if (isNaN(unitPrice) || unitPrice < 0) {
        alert('Please enter a valid numeric rate per meter.');
        return;
      }

      const taxableAmount = Math.round((mtr * unitPrice) * 100) / 100;
      const taxRate = 18;
      const taxAmount = Math.round((taxableAmount * 0.18) * 100) / 100;
      const grandTotal = Math.round(taxableAmount + taxAmount);

      const payload = {
        customer: {
          customerId: customerId || undefined,
          name: contactPersonName,
          businessName: businessName,
          phone: phone,
          gstin: gstin,
          billingAddress: billingAddress,
          state: 'Gujarat',
          stateCode: '24'
        },
        partyName: businessName || contactPersonName,
        challanNo: `EDP-${ch.challanNo}`,
        ourChallanNo: `EDP-${ch.challanNo}`,
        jobNo: ch.jobNo || '',
        date: new Date().toISOString().split('T')[0],
        items: [{
          itemName: itemName,
          description: `${ch.fabricName || 'Fabric'} Delivery Challan #EDP-${ch.challanNo}${ch.jobNo ? ` | Job #${ch.jobNo}` : ''}${ch.designNo ? ` | Design: ${ch.designNo}` : ''}`,
          hsnCode: '998821',
          qty: mtr,
          unit: 'Meters',
          unitPrice: unitPrice,
          taxRate: taxRate,
          taxableAmount: taxableAmount,
          taxAmount: taxAmount,
          totalAmount: grandTotal
        }],
        subtotal: taxableAmount,
        subTotal: taxableAmount,
        taxRate: taxRate,
        totalTax: taxAmount,
        grandTotal: grandTotal,
        status: 'Unpaid',
        paymentStatus: 'Unpaid',
        notes: `Auto-generated from Delivery Challan #EDP-${ch.challanNo}`
      };

      const res = await api.createBillingInvoice(payload);
      if (res && res.success) {
        const invNo = res.data?.invoiceNo || '';
        triggerPushNotification('🧾 Tax Bill Created', `Invoice ${invNo} generated for Challan #EDP-${ch.challanNo} (Total: ₹${grandTotal.toLocaleString('en-IN')})!`, 'success');
        triggerGlobalDataRefresh('billing');
        if (window.confirm(`✅ Tax Bill "${invNo}" created successfully for ₹${grandTotal.toLocaleString('en-IN')}!\n\nWould you like to open Billing & Invoicing to view/print it?`)) {
          window.dispatchEvent(new CustomEvent('elite-navigate-tab', { detail: 'billing' }));
        }
      } else {
        alert(res?.error || 'Failed to create bill');
      }
    } catch (err) {
      alert('Error creating bill: ' + (err.message || err));
    }
  };

  // Stock Adjustment (SA) Helpers
  const handleSaFabricChange = (e) => {
    const fName = e.target.value;
    setSaForm(prev => ({ ...prev, fabricQuality: fName, lotNo: '' }));
    if (fName) {
      api.getFabricLotStock({ fabricQuality: fName }).then(res => {
        if (res && res.success) setSaAvailableLots(res.data || []);
      }).catch(() => { });
    } else {
      setSaAvailableLots([]);
    }
  };

  const addSaTpRow = () => {
    setSaForm(prev => ({
      ...prev,
      tpDetails: [...prev.tpDetails, { tpNo: prev.tpDetails.length + 1, tpMeter: '', lotNo: prev.lotNo || '' }]
    }));
  };

  const removeSaTpRow = (idx) => {
    setSaForm(prev => ({
      ...prev,
      tpDetails: prev.tpDetails.filter((_, i) => i !== idx).map((r, i) => ({ ...r, tpNo: i + 1 }))
    }));
  };

  const updateSaTpRow = (idx, field, val) => {
    setSaForm(prev => {
      const updated = [...prev.tpDetails];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...prev, tpDetails: updated };
    });
  };

  const handleEditSa = (sa) => {
    setEditingSa(sa);
    setSaForm({
      date: sa.date ? new Date(sa.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      partyName: sa.partyName || '',
      vendorChallanNo: sa.vendorChallanNo || '',
      adjustmentType: sa.adjustmentType || 'RETURN_REJECTED',
      fabricQuality: sa.fabricQuality || '',
      panna: sa.panna || '',
      lotNo: sa.lotNo || '',
      reason: sa.reason || 'Fabric Return / Rejection',
      notes: sa.notes || '',
      tpDetails: sa.tpDetails && sa.tpDetails.length > 0 ? sa.tpDetails : [{ tpNo: 1, tpMeter: sa.totalMtr || '', lotNo: sa.lotNo || '' }]
    });
    if (sa.fabricQuality) {
      api.getFabricLotStock({ fabricQuality: sa.fabricQuality }).then(res => {
        if (res && res.success) setSaAvailableLots(res.data || []);
      }).catch(() => { });
    }
    setIsSaFormOpen(true);
  };

  const handleSaLotChange = (e) => {
    const selectedLotNo = e.target.value;
    const foundLot = saAvailableLots.find(l => String(l.lotNo) === String(selectedLotNo));

    let rawChallan = foundLot?.vendorChallanNo || '';
    const vName = foundLot?.vendorName || saForm.partyName || '';

    if (rawChallan && vName) {
      const shortName = getVendorShortForm(vName);
      if (shortName && !/^[A-Za-z0-9]{2,4}-/.test(rawChallan)) {
        rawChallan = `${shortName}-${rawChallan}`;
      }
    }

    setSaForm(prev => ({
      ...prev,
      lotNo: selectedLotNo,
      vendorChallanNo: rawChallan || prev.vendorChallanNo,
      partyName: prev.partyName || foundLot?.vendorName || ''
    }));
  };

  const handleCreateSaSubmit = async (e) => {
    e.preventDefault();
    if (!saForm.fabricQuality) {
      alert('Please select a Fabric Quality.');
      return;
    }
    const calculatedTotalMtr = saForm.tpDetails.reduce((sum, r) => sum + (parseFloat(r.tpMeter) || 0), 0);
    if (calculatedTotalMtr <= 0) {
      alert('Please enter return meters for at least one TP / Roll.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...saForm,
        totalMtr: calculatedTotalMtr,
        totalTp: saForm.tpDetails.length
      };

      let res;
      if (editingSa) {
        res = await api.updateStockAdjustment(editingSa._id, payload);
        triggerPushNotification('✏️ Stock Return Updated', `Stock Adjustment ${editingSa.saNo} updated successfully.`, 'success');
      } else {
        res = await api.createStockAdjustment(payload);
        triggerPushNotification('📦 Stock Return / Adjustment Saved', `Stock Adjustment ${res.data.saNo} recorded successfully.`, 'success');
      }

      setIsSaFormOpen(false);
      setEditingSa(null);
      setSaForm({
        date: new Date().toISOString().split('T')[0],
        partyName: '',
        vendorChallanNo: '',
        adjustmentType: 'RETURN_REJECTED',
        fabricQuality: '',
        panna: '',
        lotNo: '',
        reason: 'Fabric Return / Rejection',
        notes: '',
        tpDetails: [{ tpNo: 1, tpMeter: '', lotNo: '' }]
      });
      triggerGlobalDataRefresh('fabric');
      fetchData();
      fetchStockAdjustments();
    } catch (err) {
      alert('Failed to save Stock Adjustment: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSa = async () => {
    if (!saDeleteTarget) return;
    try {
      await api.deleteStockAdjustment(saDeleteTarget._id);
      setSaDeleteTarget(null);
      triggerGlobalDataRefresh('fabric');
      fetchData();
      fetchStockAdjustments();
    } catch (err) {
      alert('Failed to delete Stock Adjustment: ' + err.message);
    }
  };

  const handleDownloadSaPdf = async (id, saNo) => {
    try {
      await api.downloadStockAdjustmentPdf(id, saNo);
    } catch (err) {
      alert('Failed to download SA PDF: ' + err.message);
    }
  };

  const allInwardLots = transactions
    .filter(t => t.type === 'INWARD' && t.lotNo != null)
    .map(t => Number(t.lotNo))
    .filter(lot => !isNaN(lot));
  const maxLotNo = allInwardLots.length > 0 ? Math.max(...allInwardLots) : 0;
  const nextLotNo = maxLotNo + 1;

  // Filtered transaction lists
  const inwardTx = transactions.filter(t => {
    if (t.type !== 'INWARD') return false;
    if (inwardDateStart && t.date < inwardDateStart) return false;
    if (inwardDateEnd && t.date > inwardDateEnd + 'T23:59:59') return false;
    return matchSearchQuery(t, inwardSearch, ['fabricQuality', 'vendorName', 'challanNo', 'lotNo', 'notes']);
  }).sort((a, b) => {
    let valA = a[inwardSortBy];
    let valB = b[inwardSortBy];
    if (inwardSortBy === 'date') {
      valA = new Date(a.date);
      valB = new Date(b.date);
    }
    if (valA < valB) return inwardSortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return inwardSortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const outwardTx = transactions.filter(t => {
    if (t.type !== 'OUTWARD') return false;
    if (outwardDateStart && t.date < outwardDateStart) return false;
    if (outwardDateEnd && t.date > outwardDateEnd + 'T23:59:59') return false;
    return matchSearchQuery(t, outwardSearch, ['fabricQuality', 'partyName', 'jobNo', 'challanNo', 'lotNo', 'notes']);
  }).sort((a, b) => {
    let valA = a[outwardSortBy];
    let valB = b[outwardSortBy];
    if (outwardSortBy === 'date') {
      valA = new Date(a.date);
      valB = new Date(b.date);
    }
    if (valA < valB) return outwardSortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return outwardSortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const inputStyle = {
    width: '100%', padding: '0.5rem', borderRadius: '4px',
    border: '1px solid var(--border-light)', background: 'var(--nav-bg)',
    color: 'var(--text-primary)', boxSizing: 'border-box'
  };

  const labelStyle = {
    display: 'block', fontSize: '0.75rem', marginBottom: '0.3rem', fontWeight: 600
  };

  const tabs = [
    { id: 'dashboard', label: 'Stock Overview', icon: Database },
    { id: 'inward', label: 'Inward Register', icon: ArrowDownToLine },
    { id: 'lotwise', label: 'Lot Wise Details', icon: Layers },
    { id: 'lotTransfer', label: 'Lot Transfer', icon: ArrowRightLeft },
    { id: 'stockAdjustment', label: 'Stock Adjustment', icon: RefreshCw },
    { id: 'requirement', label: 'Fabric Requirements', icon: AlertTriangle },
  ];

  // Group all transactions by Lot No for Lot-Wise Management View
  const lotMap = new Map();
  transactions.forEach(t => {
    if (t.lotNo == null || t.lotNo === '') return;
    const lotNoKey = String(t.lotNo).trim();
    if (!lotMap.has(lotNoKey)) {
      lotMap.set(lotNoKey, {
        lotNo: lotNoKey,
        fabricQuality: t.fabricQuality || '',
        panna: t.panna || '58',
        vendorName: t.vendorName || '',
        vendorChallanNo: t.type === 'INWARD' ? (t.challanNo || '') : '',
        totalInward: 0,
        totalOutward: 0,
        inwardTxs: [],
        outwardTxs: [],
        firstDate: t.date
      });
    }
    const item = lotMap.get(lotNoKey);
    if (t.fabricQuality && !item.fabricQuality) item.fabricQuality = t.fabricQuality;
    if (t.panna && !item.panna) item.panna = t.panna;
    if (t.vendorName && !item.vendorName) item.vendorName = t.vendorName;

    const qty = Number(t.qty || 0);
    if (t.type === 'INWARD') {
      item.totalInward += qty;
      if (t.challanNo && !item.vendorChallanNo) item.vendorChallanNo = t.challanNo;
      item.inwardTxs.push(t);
    } else if (t.type === 'OUTWARD') {
      item.totalOutward += qty;
      item.outwardTxs.push(t);
    }
  });

  const lotRecords = Array.from(lotMap.values()).map(l => {
    const rawStock = l.totalInward - l.totalOutward;
    // Real-Time Safeguard: Only positive stock between 0 and 5m (0 < rawStock <= 5) converts to 0! Negative stock (< 0) is preserved as true deficit.
    const netStock = (rawStock > 0 && rawStock <= 5.0) ? 0 : rawStock;
    return {
      ...l,
      currentStock: netStock
    };
  }).sort((a, b) => {
    const numA = parseInt(a.lotNo, 10);
    const numB = parseInt(b.lotNo, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
    return b.lotNo.localeCompare(a.lotNo);
  });

  const filteredLots = lotRecords.filter(l => {
    if (lotStatusFilter === 'InStock' && l.currentStock <= 0) return false;
    if (lotStatusFilter === 'Exhausted' && l.currentStock > 0) return false;
    if (!lotSearch) return true;
    const s = lotSearch.toLowerCase();
    return String(l.lotNo).toLowerCase().includes(s) ||
      (l.fabricQuality || '').toLowerCase().includes(s) ||
      (l.vendorName || '').toLowerCase().includes(s) ||
      l.outwardTxs.some(ot => (ot.partyName || '').toLowerCase().includes(s) || (ot.jobNo || '').toLowerCase().includes(s));
  });

  // Parse lot numbers from the comma-separated lotNo field
  const parseSelectedLots = (lotNoStr) => {
    if (!lotNoStr) return [];
    return String(lotNoStr)
      .split(/[,\s&]+/)
      .map(x => x.trim())
      .filter(Boolean);
  };

  const selectedLotsList = parseSelectedLots(challanForm.lotNo);

  // Calculate sum of available meters from the selected lots (searching both lotRecords and availableLots)
  const selectedLotsTotalStock = selectedLotsList.reduce((sum, lotNo) => {
    const lotStockItem = lotRecords.find(l => String(l.lotNo) === lotNo) || availableLots.find(l => String(l.lotNo) === lotNo);
    return sum + (lotStockItem ? (lotStockItem.currentStock || 0) : 0);
  }, 0);

  const activeJob = findMatchingJobCard(challanForm.jobNo);
  const jobMtrNeeded = activeJob ? parseFloat(activeJob.totalMtr) || 0 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      {/* Minimal White Card Header with Entry Buttons Top Right & Sub-Tabs */}
      {!onlyChallan && (
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', background: '#ffffff', borderRadius: '14px', border: '1px solid var(--border-light, #e2e8f0)', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#0284c7,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Database size={20} color="#fff" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    {department === 'stitching' ? 'Elite Stitching Fabric' : 'Fabric Management'}
                  </h2>
                  <ScreenGroupRoster screenId={department === 'stitching' ? 'jobcards_stitching_challan' : 'jobcards_fabric'} />
                </div>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  Lot Stock Tracking & Rolls Management
                </p>
              </div>
            </div>

            {/* Entry Buttons Top in Header */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => setIsInwardOpen(true)}
                style={{ padding: '0.45rem 1rem', borderRadius: '8px', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontSize: '0.82rem', fontWeight: 800, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <PlusCircle size={15} /> Inward Roll Stock
              </button>
              <button
                onClick={() => setIsCombinedModalOpen(true)}
                style={{ padding: '0.45rem 1rem', borderRadius: '8px', background: 'linear-gradient(135deg,#7c3aed,#6366f1)', color: '#fff', fontSize: '0.82rem', fontWeight: 800, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <FileDown size={15} /> PDF Report
              </button>
            </div>
          </div>

          {/* Sub-Tabs Bar */}
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.85rem', borderTop: '1px solid var(--border-light, #e2e8f0)', paddingTop: '0.65rem', overflowX: 'auto' }}>
            {tabs.map(tab => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '0.42rem 0.9rem',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: activeTab === tab.id ? '#0284c7' : 'var(--border-light, #e2e8f0)',
                    background: activeTab === tab.id ? '#e0f2fe' : '#ffffff',
                    color: activeTab === tab.id ? '#0369a1' : 'var(--text-muted, #64748b)',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {TabIcon && <TabIcon size={15} />}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && <div style={{ color: 'red', padding: '1rem', background: '#ffebeb', borderRadius: '8px' }}>{error}</div>}

      {/* Main Content Area */}
      <div className={onlyChallan ? '' : 'glass-panel'} style={{ flex: 1, overflowY: 'auto', padding: onlyChallan ? 0 : '1.5rem' }}>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={20} color="var(--primary)" /> Current Fabric Stock
              </h2>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Sort Stock:</span>
                <button
                  type="button"
                  className={stockSortOrder === 'highToLow' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setStockSortOrder('highToLow')}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, borderRadius: '8px' }}
                >
                   High to Low (Mtr)
                </button>
                <button
                  type="button"
                  className={stockSortOrder === 'lowToHigh' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setStockSortOrder('lowToHigh')}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, borderRadius: '8px' }}
                >
                   Low to High (Mtr)
                </button>
                <button
                  type="button"
                  className={stockSortOrder === 'nameAsc' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setStockSortOrder('nameAsc')}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, borderRadius: '8px' }}
                >
                   Name (A-Z)
                </button>
              </div>
            </div>

            {/* Summary Bar */}
            {stock.length > 0 && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total Fabrics</span><br /><strong>{stock.length}</strong></div>
                <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total Received</span><br /><strong style={{ color: 'var(--success)' }}>{Number(stock.reduce((a, i) => a + (i.totalInward || 0), 0)).toFixed(2)} mtr</strong></div>
                <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total Used</span><br /><strong style={{ color: 'var(--danger)' }}>{Number(stock.reduce((a, i) => a + (i.totalOutward || 0), 0)).toFixed(2)} mtr</strong></div>
                <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Net Available</span><br /><strong style={{ color: 'var(--primary)' }}>{Number(stock.reduce((a, i) => a + (i.currentStock || 0), 0)).toFixed(2)} mtr</strong></div>
                <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Low Stock</span><br /><strong style={{ color: '#f59e0b' }}>{stock.filter(i => i.currentStock > 0 && i.currentStock <= 50).length}</strong></div>
              </div>
            )}

            {/* Fabric Quality Cards with Panna breakdown */}
            {stock.length === 0 && !loading && <p>No stock data found.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[...stock].sort((a, b) => {
                const stockA = Number(a.currentStock || 0);
                const stockB = Number(b.currentStock || 0);
                if (stockSortOrder === 'highToLow') return stockB - stockA;
                if (stockSortOrder === 'lowToHigh') return stockA - stockB;
                return String(a.fabricQuality || '').localeCompare(String(b.fabricQuality || ''));
              }).map((item, idx) => {
                const isLow = item.currentStock <= 50;
                const isEmpty = item.currentStock <= 0;
                const isExpanded = expandedFabric === item.fabricQuality;
                // Get panna-wise rows for this fabric
                const pannaRows = pannaStock.filter(p =>
                  p.fabricQuality.toLowerCase().trim() === item.fabricQuality.toLowerCase().trim()
                );
                return (
                  <div key={idx} style={{
                    background: isEmpty ? 'rgba(239,68,68,0.05)' : isLow ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isEmpty ? 'var(--danger)' : isLow ? '#f59e0b' : 'var(--border-light)'}`,
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden'
                  }}>
                    {/* Header row */}
                    <div
                      onClick={() => setExpandedFabric(isExpanded ? null : item.fabricQuality)}
                      style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.2rem', cursor: 'pointer', gap: '1rem' }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '1rem' }}>{item.fabricQuality}</span>
                          {isLow && !isEmpty && (
                            <span style={{ fontSize: '0.65rem', background: '#f59e0b', color: '#000', borderRadius: '4px', padding: '2px 6px', fontWeight: 700 }}>LOW</span>
                          )}
                          {isEmpty && (
                            <span style={{ fontSize: '0.65rem', background: 'var(--danger)', color: '#fff', borderRadius: '4px', padding: '2px 6px', fontWeight: 700 }}>EMPTY</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '1.2rem', marginTop: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                          <span>In: <strong style={{ color: 'var(--success)' }}>{Number(item.totalInward || 0).toFixed(2)} mtr</strong></span>
                          <span>Out: <strong style={{ color: '#f87171' }}>{Number(item.freshOutward || (item.totalOutward - (item.totalShortage || 0)) || item.totalOutward).toFixed(2)} mtr</strong></span>
                          {item.totalShortage > 0 && (
                            <span>Shortage: <strong style={{ color: '#fbbf24' }}>+{Number(item.totalShortage).toFixed(2)} mtr</strong></span>
                          )}
                          <span>Net Out: <strong style={{ color: '#ef4444' }}>{Number(item.totalOutward || 0).toFixed(2)} mtr</strong></span>
                          <span>{pannaRows.length} panna variant{pannaRows.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: isEmpty ? 'var(--danger)' : isLow ? '#f59e0b' : 'var(--primary)' }}>
                          {Number(item.currentStock || 0).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '-4px' }}>mtr available</div>
                      </div>
                      <div style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>

                    {/* Panna-wise breakdown (collapsible) */}
                    {isExpanded && pannaRows.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--border-light)', padding: '0 1.2rem 1rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                              <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Panna (Width)</th>
                              <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Inward (mtr)</th>
                              <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Outward (mtr)</th>
                              <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Available (mtr)</th>
                              <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Lots</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pannaRows.map((p, pi) => {
                              const rowIsLow = p.currentStock <= 50;
                              const rowIsEmpty = p.currentStock <= 0;
                              return (
                                <tr key={pi} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                  <td style={{ padding: '0.5rem 0.5rem', fontWeight: 600 }}>
                                    <span style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '4px', padding: '2px 8px', fontSize: '0.8rem' }}>
                                      {p.panna && p.panna !== 'Unknown' ? String(p.panna).replace(/['"]/g, '') : '—'}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right', padding: '0.5rem', color: 'var(--success)' }}>+{Number(p.totalInward || 0).toFixed(2)}</td>
                                  <td style={{ textAlign: 'right', padding: '0.5rem', color: 'var(--danger)' }}>-{Number(p.totalOutward || 0).toFixed(2)}</td>
                                  <td style={{ textAlign: 'right', padding: '0.5rem', fontWeight: 700, color: rowIsEmpty ? 'var(--danger)' : rowIsLow ? '#f59e0b' : 'var(--text-primary)' }}>
                                    {Number(p.currentStock || 0).toFixed(2)}
                                  </td>
                                  <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                                    <span style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '20px', padding: '2px 8px', fontSize: '0.75rem' }}>{p.lotCount}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {isExpanded && pannaRows.length === 0 && (
                      <div style={{ padding: '0.75rem 1.2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem', borderTop: '1px solid var(--border-light)' }}>
                        No panna-wise breakdown available. Set Panna when adding Inward.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Lot-Wise Management Tab */}
        {activeTab === 'lotwise' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
                  <Layers size={22} color="var(--primary)" />
                  Lot Wise Details
                </h2>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Track inward receipts, outward dispatches, and net available stock for every fabric lot.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={handleAutoLotTransfer}
                  disabled={autoTransferLoading}
                  className="btn-primary"
                  style={{ gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.85rem', background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', border: 'none' }}
                  title="Auto-rebalance negative lots using matching Fabric Quality, Panna, and Vendor"
                >
                  <RefreshCw size={16} className={autoTransferLoading ? 'spin-loader' : ''} />
                  {autoTransferLoading ? 'Rebalancing...' : '⚡ Auto-Rebalance All Deficits'}
                </button>

                <button
                  onClick={async () => {
                    try {
                      setLotPdfLoading(true);
                      await api.downloadFabricLotWisePdf('', '', `Fabric_LotWise_Management_Report_${new Date().toISOString().split('T')[0]}.pdf`);
                    } catch (err) {
                      alert('Failed to download Lot Report PDF: ' + err.message);
                    } finally {
                      setLotPdfLoading(false);
                    }
                  }}
                  disabled={lotPdfLoading}
                  className="btn-primary"
                  style={{ gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.85rem', background: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)', border: 'none' }}
                >
                  <FileDown size={16} className={lotPdfLoading ? 'spin-loader' : ''} />
                  {lotPdfLoading ? 'Generating PDF...' : 'Download Lot Report (PDF)'}
                </button>
              </div>
            </div>

            {/* Lot Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Lots Tracked</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.2rem', color: 'var(--text-primary)' }}>{lotRecords.length}</div>
              </div>
              <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.06)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <span style={{ color: 'var(--success)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>In-Stock Lots</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.2rem', color: 'var(--success)' }}>
                  {lotRecords.filter(l => l.currentStock > 0).length}
                </div>
              </div>
              <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.06)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <span style={{ color: '#f87171', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Exhausted / Deficit Lots</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.2rem', color: '#ef4444' }}>
                  {lotRecords.filter(l => l.currentStock <= 0).length}
                </div>
              </div>
              <div style={{ padding: '1rem', background: 'rgba(56, 189, 248, 0.06)', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                <span style={{ color: '#38bdf8', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Positive Lot Stock (Gross)</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.2rem', color: '#38bdf8' }}>
                  {Number(lotRecords.reduce((acc, l) => acc + Math.max(0, l.currentStock), 0)).toFixed(2)} <span style={{ fontSize: '0.75rem' }}>mtr</span>
                </div>
              </div>
              <div style={{ padding: '1rem', background: 'rgba(167, 139, 250, 0.06)', borderRadius: '8px', border: '1px solid rgba(167, 139, 250, 0.2)' }}>
                <span style={{ color: '#c4b5fd', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Net Available Stock</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.2rem', color: '#c4b5fd' }}>
                  {Number(lotRecords.reduce((acc, l) => acc + (l.currentStock || 0), 0)).toFixed(2)} <span style={{ fontSize: '0.75rem' }}>mtr</span>
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                  <Search size={15} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search Lot #, Fabric Quality, Vendor, or Party Name..."
                    value={lotSearch}
                    onChange={e => setLotSearch(e.target.value)}
                    style={{ width: '100%', paddingLeft: '2.2rem', paddingRight: '0.75rem', paddingTop: '0.5rem', paddingBottom: '0.5rem', fontSize: '0.85rem' }}
                  />
                  {lotSearch && (
                    <X size={14} onClick={() => setLotSearch('')} style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--text-muted)' }} />
                  )}
                </div>

                <select
                  value={lotStatusFilter}
                  onChange={e => setLotStatusFilter(e.target.value)}
                  style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem', minWidth: '150px' }}
                >
                  <option value="All">All Lot Statuses ({lotRecords.length})</option>
                  <option value="InStock">In-Stock Only ({lotRecords.filter(l => l.currentStock > 0).length})</option>
                  <option value="Exhausted">Exhausted Only ({lotRecords.filter(l => l.currentStock <= 0).length})</option>
                </select>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Showing <strong>{filteredLots.length}</strong> of <strong>{lotRecords.length}</strong> lots
              </div>
            </div>

            {/* Lot Cards List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {filteredLots.map(lot => {
                const isExpanded = expandedLotNo === lot.lotNo;
                const isLow = lot.currentStock <= 50 && lot.currentStock > 0;
                const isEmpty = lot.currentStock <= 0;
                const statusLabel = isEmpty ? 'EXHAUSTED' : isLow ? 'LOW STOCK' : 'IN STOCK';
                const statusBg = isEmpty ? 'rgba(239,68,68,0.12)' : isLow ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)';
                const statusBorder = isEmpty ? 'rgba(239,68,68,0.3)' : isLow ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)';
                const statusColor = isEmpty ? '#ef4444' : isLow ? '#f59e0b' : 'var(--success)';

                return (
                  <div
                    key={lot.lotNo}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: isExpanded ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Header Summary Row */}
                    <div
                      onClick={() => setExpandedLotNo(isExpanded ? null : lot.lotNo)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.9rem 1.25rem',
                        cursor: 'pointer',
                        background: isExpanded ? 'rgba(124, 58, 237, 0.05)' : 'transparent',
                        flexWrap: 'wrap',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '220px' }}>
                        <span style={{
                          background: 'linear-gradient(135deg, var(--primary) 0%, #4c1d95 100%)',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '0.9rem',
                          padding: '4px 12px',
                          borderRadius: '6px',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                        }}>
                          Lot #{lot.lotNo}
                        </span>

                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                            {lot.fabricQuality || 'Unspecified Fabric'}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', marginTop: '2px' }}>
                            <span>Panna: <strong>{lot.panna}"</strong></span>
                            {lot.vendorName && <span>Vendor: <strong>{lot.vendorName}</strong></span>}
                            {lot.vendorChallanNo && <span>Vendor Ch: <strong>{lot.vendorChallanNo}</strong></span>}
                          </div>
                        </div>
                      </div>

                      {/* Stock Totals & Status */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ textAlign: 'right', fontSize: '0.82rem' }}>
                          <div style={{ color: 'var(--success)', fontWeight: 600 }}>Inward: +{Number(lot.totalInward || 0).toFixed(2)} mtr</div>
                          <div style={{ color: 'var(--danger)', fontWeight: 600 }}>Outward: -{Number(lot.totalOutward || 0).toFixed(2)} mtr</div>
                        </div>

                        <div style={{ textAlign: 'right', minWidth: '130px' }}>
                          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: statusColor }}>
                            {Number(lot.currentStock || 0).toFixed(2)} <span style={{ fontSize: '0.75rem' }}>mtr</span>
                          </div>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: statusColor,
                            background: statusBg,
                            border: `1px solid ${statusBorder}`,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            display: 'inline-block',
                            marginTop: '2px'
                          }}>
                            {statusLabel}
                          </span>
                          {lot.totalInward > 0 && (() => {
                            const usagePct = Math.min(100, Math.round(((lot.totalOutward || 0) / lot.totalInward) * 100));
                            const pColor = usagePct >= 100 ? '#ef4444' : usagePct >= 85 ? '#f59e0b' : '#10b981';
                            return (
                              <div style={{ marginTop: '5px', width: '120px' }} title={`Dispatched: ${(lot.totalOutward || 0).toFixed(1)}m of ${lot.totalInward.toFixed(1)}m Inward (${usagePct}% used)`}>
                                <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ width: `${usagePct}%`, height: '100%', background: pColor, borderRadius: '3px', transition: 'width 0.3s ease' }} />
                                </div>
                                <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '1px', textAlign: 'center', fontWeight: 600 }}>
                                  {usagePct}% Dispatched
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {lot.currentStock < 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openQuickTransfer(lot);
                            }}
                            className="btn-primary"
                            style={{
                              background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                              color: '#ffffff',
                              fontSize: '0.78rem',
                              padding: '0.35rem 0.75rem',
                              gap: '0.35rem',
                              border: 'none',
                              boxShadow: '0 2px 6px rgba(220,38,38,0.3)',
                              flexShrink: 0
                            }}
                            title="Transfer stock from another lot to clear this negative deficit"
                          >
                            <ArrowRightLeft size={14} /> Clear Deficit ({Math.abs(lot.currentStock).toFixed(2)}m)
                          </button>
                        )}

                        <button
                          className="btn-icon"
                          style={{ padding: '0.35rem', color: 'var(--text-muted)' }}
                          title={isExpanded ? 'Collapse History' : 'View Inward & Outward Breakdown'}
                        >
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                      </div>
                    </div>

                    {/* Detailed History Breakdown Drawer */}
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid var(--border-light)', padding: '1.25rem', background: 'rgba(0,0,0,0.15)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>

                          {/* Inward Transactions Box */}
                          <div style={{ background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '8px', padding: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                              <h4 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <ArrowDownToLine size={16} /> Inward Receipts ({lot.inwardTxs.length})
                              </h4>
                              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--success)' }}>
                                Total: +{Number(lot.totalInward || 0).toFixed(2)} mtr
                              </span>
                            </div>

                            {lot.inwardTxs.length === 0 ? (
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No inward transactions logged.</div>
                            ) : (
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', textAlign: 'left' }}>
                                      <th style={{ padding: '0.35rem' }}>Date</th>
                                      <th style={{ padding: '0.35rem' }}>Vendor</th>
                                      <th style={{ padding: '0.35rem' }}>Challan</th>
                                      <th style={{ padding: '0.35rem', textAlign: 'right' }}>Qty (mtr)</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {lot.inwardTxs.map((inTx, iIdx) => (
                                      <tr key={inTx._id || iIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <td style={{ padding: '0.35rem' }}>{formatDateDDMMYYYY(inTx.date)}</td>
                                        <td style={{ padding: '0.35rem' }}>{inTx.vendorName || '—'}</td>
                                        <td style={{ padding: '0.35rem' }}>{inTx.challanNo || '—'}</td>
                                        <td style={{ padding: '0.35rem', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                                          +{Number(inTx.qty || 0).toFixed(2)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          {/* Outward Dispatches Box */}
                          <div style={{ background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '8px', padding: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                              <h4 style={{ margin: 0, fontSize: '0.88rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <ArrowUpFromLine size={16} /> Outward Dispatches ({lot.outwardTxs.length})
                              </h4>
                              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#ef4444' }}>
                                Total: -{Number(lot.totalOutward || 0).toFixed(2)} mtr
                              </span>
                            </div>

                            {lot.outwardTxs.length === 0 ? (
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No outward dispatches against this lot.</div>
                            ) : (
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', textAlign: 'left' }}>
                                      <th style={{ padding: '0.35rem' }}>Date</th>
                                      <th style={{ padding: '0.35rem' }}>Party Name</th>
                                      <th style={{ padding: '0.35rem' }}>Challan No.</th>
                                      <th style={{ padding: '0.35rem', textAlign: 'right' }}>Qty (mtr)</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {lot.outwardTxs.map((outTx, oIdx) => {
                                      const displayChallan = outTx.challanNo
                                        || (outTx.notes && outTx.notes.match(/(EDP-\d+|Challan\s*#?\s*\d+)/i)?.[0])
                                        || outTx.jobNo
                                        || '—';
                                      return (
                                        <tr key={outTx._id || oIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                          <td style={{ padding: '0.35rem' }}>{formatDateDDMMYYYY(outTx.date)}</td>
                                          <td style={{ padding: '0.35rem' }}>{outTx.partyName || '—'}</td>
                                          <td style={{ padding: '0.35rem', fontWeight: 600 }}>{displayChallan}</td>
                                          <td style={{ padding: '0.35rem', textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>
                                            -{Number(outTx.qty || 0).toFixed(2)}
                                            {(outTx.notes || '').includes('+2% French Crepe Applied') && (
                                              <span style={{ fontSize: '0.65rem', background: 'rgba(124, 58, 237, 0.15)', color: '#8b5cf6', padding: '1px 4px', borderRadius: '4px', marginLeft: '4px', border: '1px solid rgba(124, 58, 237, 0.3)' }}>+2%</span>
                                            )}
                                            {(outTx.notes || '').includes('Remnant Stock Auto-Clear') && (
                                              <span style={{ fontSize: '0.65rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '1px 4px', borderRadius: '4px', marginLeft: '4px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>Cleared (≤5m)</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredLots.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  No lot records found matching your filters.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Lot Transfer Tab */}
        {activeTab === 'lotTransfer' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
                  <ArrowRightLeft size={22} color="var(--primary)" />
                  Fabric Lot Transfer & Deficit Rebalancing
                </h2>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Transfer stock meters between lots to eliminate negative balances and keep lot stock clean.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={handleAutoLotTransfer}
                  disabled={autoTransferLoading}
                  className="btn-primary"
                  style={{ gap: '0.4rem', padding: '0.55rem 1.1rem', fontSize: '0.85rem', background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', border: 'none' }}
                  title="Auto-rebalance negative lots using matching Fabric Quality, Panna, and Vendor"
                >
                  <RefreshCw size={16} className={autoTransferLoading ? 'spin-loader' : ''} />
                  {autoTransferLoading ? 'Rebalancing...' : '⚡ Auto-Rebalance All Deficits'}
                </button>

                <button
                  onClick={() => {
                    setTransferForm({
                      date: new Date().toISOString().split('T')[0],
                      fabricQuality: fabricsList[0] || '',
                      panna: '58',
                      sourceLotNo: '',
                      destLotNo: '',
                      qty: '',
                      notes: '',
                    });
                    setIsTransferFormOpen(true);
                  }}
                  className="btn-primary"
                  style={{ gap: '0.4rem', padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}
                >
                  <PlusCircle size={16} /> New Lot Transfer
                </button>
              </div>
            </div>

            {/* Transfer Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Transfers Done</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.2rem', color: 'var(--text-primary)' }}>{lotTransfers.length}</div>
              </div>
              <div style={{ padding: '1rem', background: 'rgba(124, 58, 237, 0.06)', borderRadius: '8px', border: '1px solid rgba(124, 58, 237, 0.2)' }}>
                <span style={{ color: '#a78bfa', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Meters Transferred</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.2rem', color: '#c4b5fd' }}>
                  {lotTransfers.reduce((sum, t) => sum + (t.qty || 0), 0).toFixed(2)} mtr
                </div>
              </div>
              <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.06)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <span style={{ color: '#f87171', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Negative Lots Remaining</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.2rem', color: '#ef4444' }}>
                  {lotRecords.filter(l => l.currentStock < 0).length} Lots
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search by fabric, lot #, or notes..."
                  value={transferSearch}
                  onChange={e => setTransferSearch(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2.2rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>
              <input
                type="date"
                value={transferDateStart}
                onChange={e => setTransferDateStart(e.target.value)}
                style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                title="From Date"
              />
              <input
                type="date"
                value={transferDateEnd}
                onChange={e => setTransferDateEnd(e.target.value)}
                style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                title="To Date"
              />
            </div>

            {/* Transfers Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-light)' }}>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-muted)' }}>Date</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-muted)' }}>Fabric Quality</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>From Lot (Source)</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>To Lot (Destination)</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-muted)' }}>Transferred Qty</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-muted)' }}>Notes / Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {lotTransfers.filter(t => {
                    if (transferDateStart && new Date(t.date) < new Date(transferDateStart)) return false;
                    if (transferDateEnd && new Date(t.date) > new Date(transferDateEnd + 'T23:59:59')) return false;
                    if (!transferSearch) return true;
                    const s = transferSearch.toLowerCase();
                    return (t.fabricQuality || '').toLowerCase().includes(s) ||
                      String(t.sourceLotNo || '').includes(s) ||
                      String(t.destLotNo || '').includes(s) ||
                      (t.notes || '').toLowerCase().includes(s);
                  }).map((t, idx) => (
                    <tr key={t.transferRefId || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>{formatDateDDMMYYYY(t.date)}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{t.fabricQuality}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                          Lot #{t.sourceLotNo || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                          Lot #{t.destLotNo || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#a78bfa' }}>
                        {Number(t.qty || 0).toFixed(2)} mtr
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{t.notes || '—'}</td>
                    </tr>
                  ))}
                  {lotTransfers.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No lot transfers performed yet. Click "New Lot Transfer" to move stock between lots.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Inward Tab */}
        {activeTab === 'inward' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <h2>Inward Transactions</h2>
                {maxLotNo > 0 && (
                  <span style={{
                    fontSize: '0.85rem',
                    color: 'var(--success)',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.15)',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    marginLeft: '12px',
                    fontWeight: 600
                  }}>
                    Latest Lot: #{maxLotNo}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search fabric, vendor, lot..."
                    value={inwardSearch}
                    onChange={e => setInwardSearch(e.target.value)}
                    style={{ ...inputStyle, width: '200px', paddingLeft: '1.8rem' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>From:</span>
                  <input
                    type="date"
                    value={inwardDateStart}
                    onChange={e => setInwardDateStart(e.target.value)}
                    style={{ ...inputStyle, width: '130px', padding: '0.3rem' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>To:</span>
                  <input
                    type="date"
                    value={inwardDateEnd}
                    onChange={e => setInwardDateEnd(e.target.value)}
                    style={{ ...inputStyle, width: '130px', padding: '0.3rem' }}
                  />
                </div>

                <button className="btn-primary" onClick={() => { fetchData(); setEditingTransaction(null); setInwardForm({ challanNo: '', vendorName: '', fabricQuality: '', panna: '', qty: '', shortagePct: '', date: new Date().toISOString().split('T')[0], notes: '' }); setIsInwardOpen(true); }}>
                  <PlusCircle size={16} /> New Inward
                </button>
              </div>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th
                      onClick={() => {
                        if (inwardSortBy === 'date') {
                          setInwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setInwardSortBy('date');
                          setInwardSortOrder('desc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Date {inwardSortBy === 'date' ? (inwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th
                      onClick={() => {
                        if (inwardSortBy === 'lotNo') {
                          setInwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setInwardSortBy('lotNo');
                          setInwardSortOrder('desc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Lot No {inwardSortBy === 'lotNo' ? (inwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th
                      onClick={() => {
                        if (inwardSortBy === 'challanNo') {
                          setInwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setInwardSortBy('challanNo');
                          setInwardSortOrder('asc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Challan No {inwardSortBy === 'challanNo' ? (inwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th
                      onClick={() => {
                        if (inwardSortBy === 'vendorName') {
                          setInwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setInwardSortBy('vendorName');
                          setInwardSortOrder('asc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Vendor {inwardSortBy === 'vendorName' ? (inwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th
                      onClick={() => {
                        if (inwardSortBy === 'fabricQuality') {
                          setInwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setInwardSortBy('fabricQuality');
                          setInwardSortOrder('asc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Fabric Quality {inwardSortBy === 'fabricQuality' ? (inwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th>Panna</th>
                    <th
                      onClick={() => {
                        if (inwardSortBy === 'qty') {
                          setInwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setInwardSortBy('qty');
                          setInwardSortOrder('desc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Qty (mtr) {inwardSortBy === 'qty' ? (inwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th>Shortage %</th>
                    <th>Notes</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {inwardTx.map(t => (
                    <tr key={t._id}>
                      <td>{formatDateDDMMYYYY(t.date)}</td>
                      <td><span style={{ fontWeight: 600 }}>#{t.lotNo}</span></td>
                      <td>{t.challanNo}</td>
                      <td>{t.vendorName}</td>
                      <td>{t.fabricQuality}</td>
                      <td>{t.panna || '-'}</td>
                      <td style={{ color: 'var(--success)', fontWeight: 600 }}>+{Number(t.qty || 0).toFixed(2)}</td>
                      <td>{t.shortagePct != null ? `${t.shortagePct}%` : '-'}</td>
                      <td>{t.notes}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {isAdmin && (
                          <button
                            className="btn-icon"
                            title="Edit"
                            style={{ color: 'var(--primary)', marginRight: '0.5rem' }}
                            onClick={() => startEditInward(t)}
                          >
                            <Edit size={15} />
                          </button>
                        )}
                        <button
                          className="btn-icon"
                          title="Delete"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => setDeleteTarget({ id: t._id, type: 'INWARD', label: `Lot #${t.lotNo} — ${t.fabricQuality} (${t.qty} mtr)` })}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {inwardTx.length === 0 && (
                    <tr><td colSpan="9" style={{ textAlign: 'center' }}>No inward transactions found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Showing {inwardTx.length} of {transactions.filter(t => t.type === 'INWARD').length} inward records
            </div>
          </div>
        )}

        {/* Outward Tab */}
        {activeTab === 'outward' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2>Outward Transactions</h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search fabric, party, job, lot..."
                    value={outwardSearch}
                    onChange={e => setOutwardSearch(e.target.value)}
                    style={{ ...inputStyle, width: '200px', paddingLeft: '1.8rem' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>From:</span>
                  <input
                    type="date"
                    value={outwardDateStart}
                    onChange={e => setOutwardDateStart(e.target.value)}
                    style={{ ...inputStyle, width: '130px', padding: '0.3rem' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>To:</span>
                  <input
                    type="date"
                    value={outwardDateEnd}
                    onChange={e => setOutwardDateEnd(e.target.value)}
                    style={{ ...inputStyle, width: '130px', padding: '0.3rem' }}
                  />
                </div>

                <button className="btn-primary" onClick={() => { fetchData(); setOutwardForm({ jobNo: '', challanNo: '', partyName: '', fabricQuality: '', panna: '', lotNo: '', qty: '', date: new Date().toISOString().split('T')[0], notes: '' }); setIsOutwardOpen(true); }} style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}>
                  <PlusCircle size={16} /> New Outward
                </button>
              </div>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th
                      onClick={() => {
                        if (outwardSortBy === 'date') {
                          setOutwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setOutwardSortBy('date');
                          setOutwardSortOrder('desc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Date {outwardSortBy === 'date' ? (outwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th
                      onClick={() => {
                        if (outwardSortBy === 'jobNo') {
                          setOutwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setOutwardSortBy('jobNo');
                          setOutwardSortOrder('desc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Job Card No {outwardSortBy === 'jobNo' ? (outwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th
                      onClick={() => {
                        if (outwardSortBy === 'challanNo') {
                          setOutwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setOutwardSortBy('challanNo');
                          setOutwardSortOrder('asc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Challan No {outwardSortBy === 'challanNo' ? (outwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th
                      onClick={() => {
                        if (outwardSortBy === 'partyName') {
                          setOutwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setOutwardSortBy('partyName');
                          setOutwardSortOrder('asc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Party {outwardSortBy === 'partyName' ? (outwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th
                      onClick={() => {
                        if (outwardSortBy === 'fabricQuality') {
                          setOutwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setOutwardSortBy('fabricQuality');
                          setOutwardSortOrder('asc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Fabric Quality {outwardSortBy === 'fabricQuality' ? (outwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th
                      onClick={() => {
                        if (outwardSortBy === 'lotNo') {
                          setOutwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setOutwardSortBy('lotNo');
                          setOutwardSortOrder('desc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Lot No {outwardSortBy === 'lotNo' ? (outwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th>Panna</th>
                    <th
                      onClick={() => {
                        if (outwardSortBy === 'qty') {
                          setOutwardSortOrder(outwardSortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setOutwardSortBy('qty');
                          setOutwardSortOrder('asc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Qty (mtr) {outwardSortBy === 'qty' ? (outwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th>Notes</th>
                    <th>Logged By</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {outwardTx.map(t => (
                    <tr key={t._id}>
                      <td>{formatDateDDMMYYYY(t.date)}</td>
                      <td>{renderJobNoBadge(t.jobNo)}</td>
                      <td>{t.challanNo || '-'}</td>
                      <td>{t.partyName}</td>
                      <td>{t.fabricQuality}</td>
                      <td>{t.lotNo ? `#${t.lotNo}` : '-'}</td>
                      <td>{t.panna || '-'}</td>
                      <td style={{ color: 'var(--danger)', fontWeight: 600 }}>
                        -{Number(t.qty || 0).toFixed(2)}
                        {(t.notes || '').includes('+2% French Crepe Applied') && (
                          <span style={{ fontSize: '0.68rem', background: 'rgba(124, 58, 237, 0.15)', color: '#8b5cf6', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px', border: '1px solid rgba(124, 58, 237, 0.3)', display: 'inline-block' }}>+2%</span>
                        )}
                        {(t.notes || '').includes('Remnant Stock Auto-Clear') && (
                          <span style={{ fontSize: '0.68rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'inline-block' }}>Cleared (≤5m)</span>
                        )}
                      </td>
                      <td>
                        {(() => {
                          const notes = t.notes || '';
                          if (notes.startsWith('Auto: EDP-') || notes.startsWith('Auto: Job ')) {
                            const parts = notes.split('|');
                            if (parts.length >= 2) {
                              const header = parts[0].trim();
                              const badges = parts.slice(1).map(p => p.trim());
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                                  <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.8rem' }}>
                                    {header}
                                  </span>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {badges.map((badge, bIdx) => (
                                      <span key={bIdx} style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        color: bIdx === 0 ? '#38bdf8' : '#34d399',
                                        background: bIdx === 0 ? 'rgba(14, 165, 233, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                                        border: bIdx === 0 ? '1px solid rgba(14, 165, 233, 0.15)' : '1px solid rgba(16, 185, 129, 0.15)',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        display: 'inline-block',
                                        marginTop: '2px',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        {badge}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                          }
                          return t.notes || '—';
                        })()}
                      </td>
                      <td>
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', background: 'rgba(124, 58, 237, 0.12)', color: '#a78bfa', fontWeight: 700, fontSize: '0.75rem', border: '1px solid rgba(124, 58, 237, 0.25)' }}>
                          {t.createdByName || t.createdBy || 'HASI'}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          className="btn-icon"
                          title="View Audit History"
                          style={{ color: '#fbbf24', marginRight: '0.5rem' }}
                          onClick={() => setSelectedChallanHistory(t)}
                        >
                          <Clock size={15} />
                        </button>
                        <button
                          className="btn-icon"
                          title="Edit Outward Transaction"
                          style={{ color: 'var(--primary)', marginRight: '0.5rem' }}
                          onClick={() => startEditOutward(t)}
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          className="btn-icon"
                          title="Delete"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => setDeleteTarget({ id: t._id, type: 'OUTWARD', label: `Job ${t.jobNo} — ${t.fabricQuality} (${t.qty} mtr)` })}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {outwardTx.length === 0 && (
                    <tr><td colSpan="10" style={{ textAlign: 'center' }}>No outward transactions found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Showing {outwardTx.length} of {transactions.filter(t => t.type === 'OUTWARD').length} outward records
            </div>
          </div>
        )}

        {/* ── Requirement Tab ── */}
        {activeTab === 'requirement' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                  <AlertTriangle size={20} color="#f59e0b" /> Fabric Requirement
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                  Calculated from all <strong>In Progress</strong> job cards. Click a row to see job-wise breakdown.
                </p>
              </div>
              <button className="btn-secondary" onClick={fetchRequirement} disabled={reqLoading}>
                <RefreshCw size={15} className={reqLoading ? 'spin-loader' : ''} />
                {reqLoading ? 'Calculating...' : 'Refresh'}
              </button>
            </div>

            {/* Summary chips */}
            {requirement.length > 0 && (
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ padding: '0.5rem 1rem', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '6px', fontSize: '0.85rem' }}>
                  <CheckCircle size={13} style={{ color: 'var(--success)', marginRight: '4px', verticalAlign: 'middle' }} />
                  <strong>{requirement.filter(r => r.status === 'Sufficient').length}</strong> Sufficient
                </div>
                <div style={{ padding: '0.5rem 1rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', fontSize: '0.85rem' }}>
                  <AlertCircle size={13} style={{ color: '#f59e0b', marginRight: '4px', verticalAlign: 'middle' }} />
                  <strong>{requirement.filter(r => r.status === 'Short').length}</strong> Short
                </div>
                <div style={{ padding: '0.5rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', fontSize: '0.85rem' }}>
                  <AlertTriangle size={13} style={{ color: 'var(--danger)', marginRight: '4px', verticalAlign: 'middle' }} />
                  <strong>{requirement.filter(r => r.status === 'No Stock').length}</strong> No Stock
                </div>
                <div style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '0.85rem' }}>
                  Total Needed: <strong>{Number(requirement.reduce((a, r) => a + (r.totalMtrRequired || 0), 0)).toFixed(2)} mtr</strong>
                </div>
                <div style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '0.85rem' }}>
                  Total Shortfall: <strong style={{ color: 'var(--danger)' }}>{Number(requirement.reduce((a, r) => a + (r.shortfall || 0), 0)).toFixed(2)} mtr</strong>
                </div>
              </div>
            )}

            {reqLoading && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <RefreshCw size={24} className="spin-loader" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                Calculating requirement from job cards...
              </div>
            )}

            {!reqLoading && requirement.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <AlertTriangle size={40} style={{ opacity: 0.3, display: 'block', margin: '0 auto 1rem' }} />
                <p>No fabric requirement found.</p>
                <p style={{ fontSize: '0.85rem' }}>Add Job Cards with "In Progress" status and set the Fabric + Total Meters fields.</p>
              </div>
            )}

            {!reqLoading && requirement.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {requirement.map((req, idx) => {
                  const isExpanded = expandedFabric === `req_${idx}`;
                  const statusColor = req.status === 'Sufficient' ? 'var(--success)' : req.status === 'Short' ? '#f59e0b' : 'var(--danger)';
                  const statusBg = req.status === 'Sufficient' ? 'rgba(34,197,94,0.08)' : req.status === 'Short' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)';
                  const StatusIcon = req.status === 'Sufficient' ? CheckCircle : req.status === 'Short' ? AlertCircle : AlertTriangle;

                  return (
                    <div key={idx} style={{ background: statusBg, border: `1px solid ${statusColor}40`, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      {/* Main row */}
                      <div
                        onClick={() => setExpandedFabric(isExpanded ? null : `req_${idx}`)}
                        style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.2rem', cursor: 'pointer', gap: '1rem' }}
                      >
                        <StatusIcon size={20} style={{ color: statusColor, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{req.fabricQuality}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <span>Panna: <strong>{req.panna !== 'Unknown' ? String(req.panna).replace(/['"]/g, '') : '—'}</strong></span>
                            <span>{req.jobs.length} job card{req.jobs.length !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', textAlign: 'center' }}>
                          <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>REQUIRED</div>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{Number(req.totalMtrRequired || 0).toFixed(2)} <span style={{ fontSize: '0.7rem' }}>mtr</span></div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>IN STOCK</div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: req.currentStock > 0 ? 'var(--success)' : 'var(--danger)' }}>
                              {Number(req.currentStock || 0).toFixed(2)} <span style={{ fontSize: '0.7rem' }}>mtr</span>
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>SHORTFALL</div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: req.shortfall > 0 ? 'var(--danger)' : 'var(--success)' }}>
                              {req.shortfall > 0 ? `-${Number(req.shortfall || 0).toFixed(2)}` : '✓'} <span style={{ fontSize: '0.7rem' }}>{req.shortfall > 0 ? 'mtr' : ''}</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)' }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(100, req.totalMtrRequired > 0 ? (req.currentStock / req.totalMtrRequired) * 100 : 0)}%`,
                          background: statusColor,
                          transition: 'width 0.5s ease'
                        }} />
                      </div>

                      {/* Job breakdown (collapsible) */}
                      {isExpanded && (
                        <div style={{ borderTop: '1px solid var(--border-light)', padding: '0 1.2rem 1rem' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem', fontSize: '0.82rem' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                                <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Job No</th>
                                <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Party</th>
                                <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Date</th>
                                <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Net Required</th>
                              </tr>
                            </thead>
                            <tbody>
                              {req.jobs.map((job, ji) => (
                                <tr key={ji} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                  <td style={{ padding: '0.45rem 0.5rem', fontWeight: 600, color: 'var(--primary)' }}>{job.jobNo}</td>
                                  <td style={{ padding: '0.45rem 0.5rem' }}>{job.party || '—'}</td>
                                  <td style={{ padding: '0.45rem 0.5rem', color: 'var(--text-muted)' }}>{job.date || '—'}</td>
                                  <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                                    {job.remainingMtr > 0 ? `${Number(job.remainingMtr).toFixed(2)} mtr` : (job.totalMtr > 0 ? `${Number(job.totalMtr).toFixed(2)} mtr` : '—')}
                                    {job.printedMtr > 0 && (
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                        ({Number(job.printedMtr).toFixed(1)}m printed of {Number(job.totalMtr).toFixed(1)}m)
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Stock Adjustment (SA) Tab ── */}
      {activeTab === 'stockAdjustment' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RefreshCw size={20} className="text-purple-400" /> Stock Adjustment & Fabric Return (SA)
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Return rejected fabric to vendors & adjust stock with auto-assigned SA-01 voucher numbers.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {!isSaFormOpen && (
                <>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Search voucher, party, fabric, lot..."
                      value={saSearch}
                      onChange={e => setSaSearch(e.target.value)}
                      style={{ ...inputStyle, width: '220px', paddingLeft: '1.8rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>From:</span>
                    <input type="date" value={saDateStart} onChange={e => setSaDateStart(e.target.value)} style={{ ...inputStyle, width: '130px', padding: '0.3rem' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>To:</span>
                    <input type="date" value={saDateEnd} onChange={e => setSaDateEnd(e.target.value)} style={{ ...inputStyle, width: '130px', padding: '0.3rem' }} />
                  </div>
                </>
              )}

              <button
                className="btn-primary"
                onClick={() => {
                  if (isSaFormOpen) {
                    setIsSaFormOpen(false);
                    setEditingSa(null);
                  } else {
                    setEditingSa(null);
                    setSaForm({
                      date: new Date().toISOString().split('T')[0],
                      partyName: '',
                      vendorChallanNo: '',
                      adjustmentType: 'RETURN_REJECTED',
                      fabricQuality: '',
                      panna: '',
                      lotNo: '',
                      reason: 'Fabric Return / Rejection',
                      notes: '',
                      tpDetails: [{ tpNo: 1, tpMeter: '', lotNo: '' }]
                    });
                    setIsSaFormOpen(true);
                  }
                }}
                style={{ background: isSaFormOpen ? 'var(--secondary)' : 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)' }}
              >
                {isSaFormOpen ? <X size={16} /> : <PlusCircle size={16} />}
                {isSaFormOpen ? 'Back to SA Register' : 'New Fabric Return (SA)'}
              </button>
            </div>
          </div>

          {/* Form Mode */}
          {isSaFormOpen ? (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1.5rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {editingSa ? <Edit size={18} /> : <PlusCircle size={18} />}
                  {editingSa ? `Edit Stock Return Voucher (${(editingSa.saNo || '').replace(/^SA-/i, 'RE-')})` : 'Issue Stock Return Voucher (Auto Return #: RE-01...)'}
                </h3>
                <span style={{ fontSize: '0.78rem', background: 'rgba(124, 58, 237, 0.15)', color: '#8b5cf6', padding: '3px 10px', borderRadius: '6px', fontWeight: 700, border: '1px solid rgba(124, 58, 237, 0.3)' }}>
                  No Job Card Needed
                </span>
              </div>

              <form onSubmit={handleCreateSaSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.2rem' }}>
                  <div>
                    <label style={labelStyle}>Date *</label>
                    <input
                      type="date"
                      value={saForm.date}
                      onChange={e => setSaForm(prev => ({ ...prev, date: e.target.value }))}
                      style={inputStyle}
                      required
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Party / Vendor Name *</label>
                    <input
                      type="text"
                      list="saPartyOptions"
                      placeholder="Type or select Party / Vendor..."
                      value={saForm.partyName}
                      onChange={e => setSaForm(prev => ({ ...prev, partyName: e.target.value }))}
                      style={inputStyle}
                      required
                    />
                    <datalist id="saPartyOptions">
                      {Array.from(new Set([...partiesList, ...vendorsList.map(v => v.vendorName || v)])).map((p, idx) => (
                        <option key={idx} value={p} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label style={labelStyle}>Vendor Challan No (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. VC-10492 / Bill No..."
                      value={saForm.vendorChallanNo}
                      onChange={e => setSaForm(prev => ({ ...prev, vendorChallanNo: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Adjustment Type</label>
                    <select
                      value={saForm.adjustmentType}
                      onChange={e => setSaForm(prev => ({ ...prev, adjustmentType: e.target.value }))}
                      style={inputStyle}
                    >
                      <option value="RETURN_REJECTED">Fabric Return / Rejected Outward (Deducts Stock)</option>
                      <option value="STOCK_DEDUCTION">Stock Deduction / Loss (Deducts Stock)</option>
                      <option value="STOCK_ADDITION">Stock Addition / Adjustment (Adds Stock)</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Fabric Quality *</label>
                    <select
                      value={saForm.fabricQuality}
                      onChange={handleSaFabricChange}
                      style={inputStyle}
                      required
                    >
                      <option value="">Select Fabric Quality…</option>
                      {fabricsList.map((f, idx) => (
                        <option key={idx} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Panna (Width)</label>
                    <select
                      value={saForm.panna}
                      onChange={e => setSaForm(prev => ({ ...prev, panna: e.target.value }))}
                      style={inputStyle}
                    >
                      <option value="">Select Panna…</option>
                      {widthsList.map((w, idx) => (
                        <option key={idx} value={w}>{w}"</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Lot No *</label>
                    <select
                      value={saForm.lotNo}
                      onChange={handleSaLotChange}
                      style={inputStyle}
                    >
                      <option value="">Select Lot No…</option>
                      {saAvailableLots.map((l, idx) => (
                        <option key={idx} value={l.lotNo}>
                          Lot #{l.lotNo} ({l.currentStock} mtr avail)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Reason / Remark</label>
                    <input
                      type="text"
                      placeholder="e.g. Defective Fabric Return, Quality Rejection..."
                      value={saForm.reason}
                      onChange={e => setSaForm(prev => ({ ...prev, reason: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Additional Notes</label>
                    <input
                      type="text"
                      placeholder="Additional notes or remarks..."
                      value={saForm.notes}
                      onChange={e => setSaForm(prev => ({ ...prev, notes: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* TP / Rolls Entry Grid */}
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-light)', marginBottom: '1.2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      TP / Roll Details ({saForm.tpDetails.length} Rolls)
                    </span>
                    <button type="button" onClick={addSaTpRow} className="btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem' }}>
                      <Plus size={14} /> Add Roll Row
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {saForm.tpDetails.map((tp, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 40px', gap: '0.75rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>TP-{tp.tpNo}</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Return Meters (mtr)..."
                          value={tp.tpMeter}
                          onChange={e => updateSaTpRow(idx, 'tpMeter', e.target.value)}
                          style={inputStyle}
                          required
                        />
                        <input
                          type="text"
                          placeholder="Lot No (optional)..."
                          value={tp.lotNo || saForm.lotNo}
                          onChange={e => updateSaTpRow(idx, 'lotNo', e.target.value)}
                          style={inputStyle}
                        />
                        {saForm.tpDetails.length > 1 && (
                          <button type="button" onClick={() => removeSaTpRow(idx)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.3rem' }}>
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Total Rolls: <strong>{saForm.tpDetails.length}</strong>
                    </span>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
                      Total Return Meters: {saForm.tpDetails.reduce((sum, r) => sum + (parseFloat(r.tpMeter) || 0), 0).toFixed(2)} mtr
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" onClick={() => { setIsSaFormOpen(false); setEditingSa(null); }} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={loading} style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)' }}>
                    {loading ? 'Saving...' : editingSa ? 'Update SA Voucher' : 'Save & Issue SA Voucher'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Register Table Mode */
            <div className="table-responsive" style={{ marginTop: '1rem' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Voucher #</th>
                    <th>Date</th>
                    <th>Party / Vendor</th>
                    <th>Vendor Challan</th>
                    <th>Fabric Quality</th>
                    <th>Lot No(s)</th>
                    <th>Type</th>
                    <th style={{ textAlign: 'center' }}>TP / Rolls</th>
                    <th style={{ textAlign: 'right' }}>Total Return (mtr)</th>
                    <th>Reason</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filteredSa = stockAdjustments.filter(sa => {
                      if (saDateStart && new Date(sa.date) < new Date(saDateStart)) return false;
                      if (saDateEnd && new Date(sa.date) > new Date(saDateEnd + 'T23:59:59')) return false;
                      if (!saSearch) return true;
                      const s = saSearch.toLowerCase();
                      return (sa.saNo || '').toLowerCase().includes(s) ||
                        (sa.partyName || '').toLowerCase().includes(s) ||
                        (sa.vendorChallanNo || '').toLowerCase().includes(s) ||
                        (sa.fabricQuality || '').toLowerCase().includes(s) ||
                        (sa.lotNo || '').toLowerCase().includes(s) ||
                        (sa.reason || '').toLowerCase().includes(s);
                    });

                    if (filteredSa.length === 0) {
                      return (
                        <tr>
                          <td colSpan="11" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                            No stock adjustment / fabric return records found. Click <strong>"New Fabric Return (SA)"</strong> to create one.
                          </td>
                        </tr>
                      );
                    }

                    return filteredSa.map((sa, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{(sa.saNo || '').replace(/^SA-/i, 'RE-')}</td>
                        <td style={{ color: 'var(--text-muted)' }}>
                          {formatDateDDMMYYYY(sa.date)}
                        </td>
                        <td style={{ fontWeight: 600 }}>{sa.partyName || '—'}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{sa.vendorChallanNo || '—'}</td>
                        <td>{sa.fabricQuality}{sa.panna ? ` (${sa.panna}")` : ''}</td>
                        <td>{sa.lotNo ? `#${sa.lotNo}` : '—'}</td>
                        <td>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: sa.adjustmentType === 'STOCK_ADDITION' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: sa.adjustmentType === 'STOCK_ADDITION' ? '#10b981' : '#f87171',
                            border: `1px solid ${sa.adjustmentType === 'STOCK_ADDITION' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                          }}>
                            {sa.adjustmentType === 'RETURN_REJECTED' ? 'Return / Rejected' : sa.adjustmentType}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{sa.totalTp || (sa.tpDetails ? sa.tpDetails.length : 1)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: sa.adjustmentType === 'STOCK_ADDITION' ? 'var(--success)' : 'var(--danger)' }}>
                          {sa.adjustmentType === 'STOCK_ADDITION' ? '+' : '-'}{Number(sa.totalMtr || 0).toFixed(2)} mtr
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{sa.reason || '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleDownloadSaPdf(sa._id, sa.saNo)}
                              className="btn-icon"
                              title="Download Printable SA Voucher PDF"
                              style={{ color: '#8b5cf6' }}
                            >
                              <FileDown size={16} />
                            </button>
                            <button
                              onClick={() => handleEditSa(sa)}
                              className="btn-icon"
                              title="Edit Stock Adjustment Voucher"
                              style={{ color: 'var(--primary)' }}
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => setSaDeleteTarget(sa)}
                              className="btn-icon"
                              title="Delete SA Voucher & Restore Stock"
                              style={{ color: 'var(--danger)' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          )}

          {/* Delete SA Confirmation Modal */}
          {saDeleteTarget && (
            <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1.5rem', maxWidth: '420px', width: '90%' }}>
                <h3 style={{ margin: 0, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={20} /> Delete Stock Adjustment {saDeleteTarget.saNo}?
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.75rem 0 1.25rem' }}>
                  Deleting this Stock Adjustment voucher will revert all corresponding lot outward/inward dispatches and restore lot stock balances.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button className="btn-secondary" onClick={() => setSaDeleteTarget(null)}>Cancel</button>
                  <button className="btn-primary" style={{ background: 'var(--danger)' }} onClick={handleDeleteSa}>Confirm Delete</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Challan Tab ── */}
      {activeTab === 'challan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Header Banner & Metrics Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
            <div className="glass-panel" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid #38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Challans</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: 2 }}>{challans.length} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>records</span></div>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(56,189,248,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={18} color="#38bdf8" />
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid #34d399', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Invoiced & Billed</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#34d399', marginTop: 2 }}>
                  {challans.filter(c => c.status === 'INVOICED').length} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>billed</span>
                </div>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(52,211,153,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle size={18} color="#34d399" />
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid #fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Pending Invoice</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fbbf24', marginTop: 2 }}>
                  {challans.filter(c => c.status !== 'INVOICED').length} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>pending</span>
                </div>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(251,191,36,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={18} color="#fbbf24" />
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid #a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Dispatched Mtr</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#a78bfa', marginTop: 2 }}>
                  {challans.reduce((sum, c) => sum + (parseFloat(c.totalMtr) || 0), 0).toFixed(2)} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>mtr</span>
                </div>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(167,139,250,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Receipt size={18} color="#a78bfa" />
              </div>
            </div>
          </div>

          {/* Action Toolbar & Filters */}
          <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                📜 Fabric Dispatch Challans Register
              </h2>
              <ScreenGroupRoster screenId="jobcards_fabric" />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {selectedChallanIds.length > 0 && (
                <button
                  className="btn-primary"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#6366f1)', fontSize: '0.78rem', padding: '0.45rem 0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}
                  onClick={() => {
                    if (selectedChallanIds.length > 10) {
                      alert('Maximum 10 Challans can be merged into a single Invoice. Please deselect some and try again.');
                      return;
                    }
                    const selected = Object.values(selectedChallanMap);
                    const normalizeKey = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    const customerKeys = new Set(selected.map(c => normalizeKey(c.billTo || c.partyName)).filter(Boolean));
                    const partyNameKeys = new Set(selected.map(c => normalizeKey(c.partyName || c.billTo)).filter(Boolean));

                    if (customerKeys.size > 1 && partyNameKeys.size > 1) {
                      const partyList = [...new Set(selected.map(c => c.billTo || c.partyName).filter(Boolean))].join(', ');
                      alert(`Cannot merge Challans from different customers. Selected Challans belong to multiple customers: ${partyList}`);
                      return;
                    }
                    if (onNavigateToBilling) onNavigateToBilling(selected);
                  }}
                >
                  <Receipt size={14} /> Merge & Create Invoice ({selectedChallanIds.length}/10)
                </button>
              )}
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="text" placeholder="Search challan no, party, job, fabric..." value={challanSearch} onChange={e => setChallanSearch(e.target.value)} style={{ ...inputStyle, width: '230px', paddingLeft: '2rem' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Status:</span>
                <select
                  value={challanStatusFilter}
                  onChange={e => setChallanStatusFilter(e.target.value)}
                  style={{ ...inputStyle, width: '120px', padding: '0.35rem 0.5rem', cursor: 'pointer', fontWeight: 700, color: 'var(--text-primary)', background: 'var(--bg-input, rgba(15, 23, 42, 0.6))' }}
                >
                  <option value="All">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="INVOICED">Invoiced</option>
                </select>
              </div>
              <DateRangePicker
                preset={challanDatePreset}
                onChange={({ preset: p, dateStart: ds, dateEnd: de }) => {
                  setChallanDatePreset(p);
                  setChallanDateStart(ds);
                  setChallanDateEnd(de);
                }}
                customStart={customChallanDateStart}
                customEnd={customChallanDateEnd}
                onCustomChange={(s, e) => {
                  setCustomChallanDateStart(s);
                  setCustomChallanDateEnd(e);
                }}
              />
              <button className="btn-primary" onClick={() => { resetChallanForm(); setEditingChallan(null); setIsChallanOpen(true); }} style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', fontWeight: 800 }}>
                <PlusCircle size={16} /> New Challan
              </button>
            </div>
          </div>

          {/* Bulk Challans Selection Action Bar */}
          {Object.keys(selectedChallanMap).length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 1.1rem', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38bdf8', borderRadius: '10px', boxShadow: '0 4px 14px rgba(56, 189, 248, 0.2)', marginBottom: '0.8rem' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={16} color="#38bdf8" />
                <span>{Object.keys(selectedChallanMap).length} Delivery Challan{Object.keys(selectedChallanMap).length > 1 ? 's' : ''} Selected</span>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  onClick={async () => {
                    const ids = Object.keys(selectedChallanMap);
                    if (ids.length === 0) return;
                    try {
                      await api.downloadBulkFabricChallanPdf(ids, `Combined_Fabric_Challans_${ids.length}_Items.pdf`);
                      triggerPushNotification('📥 Combined Challans PDF Downloaded', `${ids.length} Fabric Challans merged into 1 single multi-page PDF document.`, 'success');
                    } catch (e) {
                      alert('Error downloading combined PDF: ' + e.message);
                    }
                  }}
                  className="btn-primary"
                  style={{ padding: '0.45rem 1.1rem', fontSize: '0.82rem', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <FileDown size={15} />
                  Download Combined PDF ({Object.keys(selectedChallanMap).length})
                </button>
                <button
                  onClick={() => handleCreateBillFromChallan(Object.values(selectedChallanMap))}
                  className="btn-primary"
                  style={{ padding: '0.45rem 1.1rem', fontSize: '0.82rem', background: 'linear-gradient(135deg, #7c3aed, #6366f1)', border: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Receipt size={15} />
                  Create Bill ({Object.keys(selectedChallanMap).length})
                </button>
                <button
                  onClick={() => setSelectedChallanMap({})}
                  className="btn-secondary"
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Table Container */}
          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-light)' }}>
            <div className="table-responsive" style={{ overflowX: 'auto', width: '100%' }}>
              <table className="data-table" style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.9))', borderBottom: '1px solid var(--border-light)' }}>
                    <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center', width: '38px' }}>
                      <input
                        type="checkbox"
                        checked={challans.length > 0 && challans.every(c => !!selectedChallanMap[c._id])}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedChallanMap(prev => {
                              const copy = { ...prev };
                              challans.forEach(c => { copy[c._id] = c; });
                              return copy;
                            });
                          } else {
                            setSelectedChallanMap({});
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap', width: '90px' }}>Ch. No</th>
                    <th style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap', width: '85px' }}>Status</th>
                    <th style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap', width: '90px' }}>Date</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Bill To / Party</th>
                    <th style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap', width: '75px' }}>Lot No</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Fabric</th>
                    <th style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap', width: '110px' }}>Job No</th>
                    <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap', width: '60px' }}>Panna</th>
                    <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap', width: '45px' }}>TP</th>
                    <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap', width: '100px' }}>Total Mtr</th>
                    <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap', width: '190px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {challans.length === 0 && (
                    <tr><td colSpan={12} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>No challans found. Click "New Challan" to create one.</td></tr>
                  )}
                  {challans.map(ch => (
                    <tr key={ch._id} style={{ borderBottom: '1px solid var(--border-light)', transition: 'background-color 0.15s' }}>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={!!selectedChallanMap[ch._id]}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedChallanMap(prev => ({ ...prev, [ch._id]: ch }));
                            } else {
                              setSelectedChallanMap(prev => {
                                const copy = { ...prev };
                                delete copy[ch._id];
                                return copy;
                              });
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', whiteSpace: 'nowrap' }}>
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: 4, fontWeight: 900, color: '#38bdf8', background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.25)', fontSize: '0.78rem' }}>
                          EDP-{ch.challanNo}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem' }}>
                        {ch.status === 'INVOICED' ? (
                          <span style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(52,211,153,0.3)' }}>
                            INVOICED
                          </span>
                        ) : (
                          <span style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(251,191,36,0.3)' }}>
                            PENDING
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{formatDateDDMMYYYY(ch.date)}</td>
                      <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700, color: '#a78bfa' }}>{ch.billTo || ch.partyName || '—'}</td>
                      <td style={{ padding: '0.6rem 0.5rem', maxWidth: '220px' }}>
                        {ch.lotNo != null && String(ch.lotNo).trim() !== '' ? (
                          <div>
                            <span
                              title={`#${ch.lotNo}`}
                              style={{
                                display: 'inline-block',
                                maxWidth: '200px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                verticalAlign: 'middle',
                                background: 'rgba(16,185,129,0.12)',
                                color: '#10b981',
                                padding: '2px 8px',
                                borderRadius: 6,
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                border: '1px solid rgba(16,185,129,0.25)'
                              }}
                            >
                              #{ch.lotNo}
                            </span>
                            {(() => {
                              const lotInfo = lotRecords.find(l => String(l.lotNo) === String(ch.lotNo));
                              if (!lotInfo || !lotInfo.totalInward) return null;
                              const totalIn = lotInfo.totalInward;
                              const totalOut = lotInfo.totalOutward;
                              const usagePct = Math.min(100, Math.round((totalOut / totalIn) * 100));
                              const pColor = usagePct >= 100 ? '#ef4444' : usagePct >= 85 ? '#f59e0b' : '#10b981';
                              return (
                                <div style={{ marginTop: '3px', width: '100%', maxWidth: '140px' }} title={`Lot #${ch.lotNo}: ${totalOut.toFixed(1)}m dispatched of ${totalIn.toFixed(1)}m inward (${usagePct}% used)`}>
                                  <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: `${usagePct}%`, height: '100%', background: pColor, borderRadius: '3px', transition: 'width 0.3s ease' }} />
                                  </div>
                                  <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '1px', fontWeight: 600 }}>
                                    {usagePct}% used ({lotInfo.currentStock.toFixed(0)}m left)
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{ch.fabricName || '—'}</td>
                      <td style={{ padding: '0.6rem 0.5rem', whiteSpace: 'nowrap' }}>
                        {renderJobNoBadge(ch.jobNo)}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>{ch.panna || '—'}</td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 800, color: 'var(--text-primary)' }}>{ch.totalTp}</td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 900, color: '#10b981', whiteSpace: 'nowrap', fontSize: '0.88rem' }}>{parseFloat(ch.totalMtr || 0).toFixed(2)} mtr</td>
                      <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center', alignItems: 'center' }}>
                          <button className="btn-icon" title="View Challan" style={{ color: '#38bdf8', padding: '0.3rem', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 6, cursor: 'pointer' }} onClick={() => setViewChallanModal(ch)}>
                            <Eye size={14} />
                          </button>
                          <button className="btn-icon" title="Download PDF" style={{ color: '#34d399', padding: '0.3rem', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 6, cursor: 'pointer' }} onClick={() => handleDownloadChallanPdf(ch._id, ch.challanNo)}>
                            <FileDown size={14} />
                          </button>
                          <button className="btn-secondary" title="Create Tax Bill" style={{ padding: '0.25rem 0.55rem', fontSize: '0.7rem', fontWeight: 800, background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(99,102,241,0.2))', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }} onClick={() => handleCreateBillFromChallan(ch)}>
                            <Receipt size={13} /> Bill
                          </button>
                          {ch.status !== 'INVOICED' && (
                            <>
                              <button className="btn-icon" title="Edit Challan" style={{ color: 'var(--primary)', padding: '0.3rem', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 6, cursor: 'pointer' }} onClick={() => startEditChallan(ch)}>
                                <Edit size={14} />
                              </button>
                              <button className="btn-icon" title="Delete Challan" style={{ color: '#f87171', padding: '0.3rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, cursor: 'pointer' }} onClick={() => setChallanDeleteTarget({ id: ch._id, label: `Challan EDP-${ch.challanNo}` })}>
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Challan Delete Confirm ── */}
      {challanDeleteTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '380px', padding: '2rem', textAlign: 'center' }}>
            <AlertTriangle size={36} style={{ color: 'var(--danger)', marginBottom: '1rem' }} />
            <p style={{ marginBottom: '1.5rem' }}>Delete <strong>{challanDeleteTarget.label}</strong>?</p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setChallanDeleteTarget(null)}>Cancel</button>
              <button className="btn-danger" style={{ flex: 1 }} onClick={handleChallanDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Challan View Modal ── */}
      {viewChallanModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', background: 'var(--card-bg)', border: '1px solid var(--border-light)', borderRadius: 12 }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--primary)', fontWeight: 800, fontSize: '1.1rem' }}>
                  📄 Delivery Challan EDP-{viewChallanModal.challanNo}
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Date: {formatDateDDMMYYYY(viewChallanModal.date)}
                </span>
              </div>
              <button className="btn-icon" onClick={() => setViewChallanModal(null)} style={{ padding: '0.35rem' }}>
                <X size={18} />
              </button>
            </div>

            {/* Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', fontSize: '0.85rem', marginBottom: '1.25rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border-light)' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Billed To:</span> <strong style={{ color: '#a78bfa', fontWeight: 800 }}>{viewChallanModal.billTo || viewChallanModal.partyName || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Party / Delivery:</span> <strong style={{ color: 'var(--text-primary)' }}>{viewChallanModal.partyName || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Job No:</span> <strong style={{ color: 'var(--primary)' }}>#{viewChallanModal.jobNo || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Design / Name:</span> <strong>{viewChallanModal.designNo || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Fabric Quality:</span> <strong>{viewChallanModal.fabricName || '—'}</strong> ({viewChallanModal.panna || '58'}")</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Lot No:</span> <strong>{viewChallanModal.lotNo ? `#${viewChallanModal.lotNo}` : '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Delivery By:</span> <strong>{viewChallanModal.deliveryBy || '—'}</strong></div>
              {viewChallanModal.vendorChallanNo && <div><span style={{ color: 'var(--text-muted)' }}>Vendor Ch:</span> <strong>{viewChallanModal.vendorChallanNo}</strong></div>}
              {viewChallanModal.pcs && <div><span style={{ color: 'var(--text-muted)' }}>PCS:</span> <strong>{viewChallanModal.pcs} pcs</strong></div>}
            </div>

            {/* TP Details List */}
            {viewChallanModal.tpDetails && viewChallanModal.tpDetails.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  TP / Roll Breakdown ({viewChallanModal.tpDetails.length} Rolls)
                </div>
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: 6 }}>
                  <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                        <th style={{ padding: '0.4rem 0.6rem' }}>TP #</th>
                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Meters (mtr)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewChallanModal.tpDetails.map((tp, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '0.35rem 0.6rem', fontWeight: 600 }}>TP-{tp.tpNo || (idx + 1)}</td>
                          <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{Number(tp.tpMeter || 0).toFixed(2)} mtr</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Summary Totals */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(16,185,129,0.06)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.2)', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>Total Outward Quantity:</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--success)' }}>
                {parseFloat(viewChallanModal.totalMtr || 0).toFixed(2)} mtr ({viewChallanModal.totalTp || 0} Rolls)
              </span>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button className="btn-secondary" onClick={() => setViewChallanModal(null)}>Close</button>
              <button className="btn-primary" style={{ background: 'linear-gradient(135deg,#7c3aed,#6366f1)', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => { setViewChallanModal(null); handleCreateBillFromChallan(viewChallanModal); }}>
                <Receipt size={15} /> Create Bill
              </button>
              <button className="btn-primary" style={{ background: 'linear-gradient(135deg,#10b981,#059669)', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => handleDownloadChallanPdf(viewChallanModal._id, viewChallanModal.challanNo)}>
                <FileDown size={15} /> Download PDF
              </button>
              <button className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => { setViewChallanModal(null); startEditChallan(viewChallanModal); }}>
                <Edit size={15} /> Edit Challan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Challan Form Modal (Wide Ergonomic 2-Column Layout — WHITE THEME) ── */}
      {isChallanOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ width: '1020px', maxWidth: '98vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0, borderRadius: '14px', background: '#ffffff', border: '1px solid #cbd5e1', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)' }}>
            
            {/* Modal Header Bar - White Theme */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(2, 132, 199, 0.1)', border: '1px solid rgba(2, 132, 199, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                  <FileText size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    {editingChallan ? `Edit Fabric Challan EDP-${editingChallan.challanNo}` : 'New Fabric Challan Dispatch'}
                  </h2>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Enter challan metadata & TP meter values</span>
                </div>
              </div>
              <button
                type="button"
                onClick={closeChallanModal}
                style={{ background: '#e2e8f0', border: 'none', color: '#475569', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form Body - 2 Columns */}
            <form onSubmit={handleChallanSubmit} style={{ display: 'flex', flex: 1, overflow: 'hidden', margin: 0 }}>
              
              {/* LEFT COLUMN: Metadata, Job & Lot Details (White Theme) */}
              <div style={{ flex: '1 1 480px', minWidth: '420px', padding: '1.25rem 1.5rem', overflowY: 'auto', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.9rem', background: '#f8fafc' }}>
                
                {/* Section Header: Basic & Party */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Date</label>
                    <input type="date" required value={challanForm.date} onChange={e => setChallanForm({ ...challanForm, date: e.target.value })} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontWeight: 600, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1.5 }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Party Name</label>
                    <input type="text" list="challan-parties" value={challanForm.partyName} onChange={e => setChallanForm({ ...challanForm, partyName: e.target.value })} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontWeight: 600, boxSizing: 'border-box' }} placeholder="Select or type party..." />
                    <datalist id="challan-parties">
                      {partiesList.map((p, i) => <option key={i} value={typeof p === 'string' ? p : p.name} />)}
                    </datalist>
                  </div>
                </div>

                {/* Job Selection & Interactive Pills */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Job No(s) <span style={{ color: '#64748b', fontSize: '0.7rem' }}>(select multiple or type)</span></label>
                    {challanForm.partyName && (
                      <span style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 700 }}>
                        Party: {challanForm.partyName}
                      </span>
                    )}
                  </div>
                  <input type="text" list="challan-jobs" value={challanForm.jobNo} onChange={e => handleChallanJobChange(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontWeight: 600, boxSizing: 'border-box' }} placeholder="e.g. JOB-2252, JOB-2253..." />
                  <datalist id="challan-jobs">
                    {inProgressJobCards.map(j => <option key={j._id} value={j.jobNo}>{j.jobNo} — {j.party} ({j.designNo || ''})</option>)}
                  </datalist>

                  {/* Interactive Job Pills */}
                  <div style={{ marginTop: '0.35rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem', maxHeight: '75px', overflowY: 'auto' }}>
                    {inProgressJobCards
                      .filter(j => !challanForm.partyName || (j.party && j.party.toLowerCase().trim() === challanForm.partyName.toLowerCase().trim()))
                      .slice(0, 20)
                      .map(j => {
                        const isSelected = String(challanForm.jobNo || '').toUpperCase().includes(String(j.jobNo).toUpperCase());
                        return (
                          <button
                            key={j._id}
                            type="button"
                            onClick={() => toggleChallanJobPill(j.jobNo)}
                            style={{
                              padding: '0.18rem 0.5rem',
                              fontSize: '0.7rem',
                              borderRadius: '10px',
                              border: isSelected ? '1px solid #0284c7' : '1px solid #cbd5e1',
                              background: isSelected ? '#0284c7' : '#ffffff',
                              color: isSelected ? '#ffffff' : '#475569',
                              cursor: 'pointer',
                              fontWeight: 700,
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {isSelected ? '✓ ' : '+ '} {j.jobNo}
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* Bill To & Ship To */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Bill To</label>
                    <select
                      value={challanForm.billTo}
                      onChange={e => setChallanForm({ ...challanForm, billTo: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontWeight: 600, boxSizing: 'border-box' }}
                    >
                      <option value="">-- Select Bill To --</option>
                      {billToOptions.map((opt, i) => (
                        <option key={i} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Ship To</label>
                    <select
                      value={challanForm.shipTo}
                      onChange={e => setChallanForm({ ...challanForm, shipTo: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontWeight: 600, boxSizing: 'border-box' }}
                    >
                      <option value="">-- Select Ship To --</option>
                      {shipToOptions.map((opt, i) => (
                        <option key={i} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Lot No & Available Lot Chips */}
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Lot No {challanLotLoading && <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Loading…</span>}</label>
                  <input
                    type="text"
                    list="challan-lot-options"
                    value={challanForm.lotNo}
                    onChange={e => handleChallanLotChange(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontWeight: 600, boxSizing: 'border-box' }}
                    placeholder="Select or type e.g. 252, 280, 291..."
                  />
                  <datalist id="challan-lot-options">
                    {(() => {
                      const sorted = [...availableLots].sort((a, b) => {
                        const numA = parseInt(a.lotNo, 10);
                        const numB = parseInt(b.lotNo, 10);
                        if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
                        return String(b.lotNo).localeCompare(String(a.lotNo));
                      });
                      return sorted.map((l, i) => (
                        <option key={i} value={String(l.lotNo)}>
                          Lot #{l.lotNo} — {l.fabricQuality} ({l.panna ? String(l.panna).replace(/['"]/g, '') : '58'}) [{l.currentStock ? `${parseFloat(l.currentStock).toFixed(2)}m` : ''}]
                        </option>
                      ));
                    })()}
                  </datalist>

                  {/* Available Lot Buttons Chips */}
                  {availableLots.length > 0 ? (
                    <div style={{ marginTop: '0.35rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxHeight: '90px', overflowY: 'auto' }}>
                      {(() => {
                        const sortedLots = [...availableLots].sort((a, b) => {
                          const numA = parseInt(a.lotNo, 10);
                          const numB = parseInt(b.lotNo, 10);
                          if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
                          return String(b.lotNo).localeCompare(String(a.lotNo));
                        });
                        return sortedLots.slice(0, 35).map((lot, idx) => {
                          const selectedList = String(challanForm.lotNo || '').split(/[,\s&]+/).map(s => s.trim()).filter(Boolean);
                          const isSelected = selectedList.includes(String(lot.lotNo));
                          const formattedStock = lot.currentStock != null ? parseFloat(lot.currentStock).toFixed(2) : '0.00';
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                let newLotStr;
                                if (isSelected) {
                                  newLotStr = selectedList.filter(x => x !== String(lot.lotNo)).join(', ');
                                } else {
                                  newLotStr = [...selectedList, String(lot.lotNo)].join(', ');
                                }
                                handleChallanLotChange(newLotStr);
                              }}
                              style={{
                                padding: '0.15rem 0.45rem',
                                fontSize: '0.68rem',
                                borderRadius: '10px',
                                border: isSelected ? '1px solid #0284c7' : '1px solid #cbd5e1',
                                background: isSelected ? '#0284c7' : '#ffffff',
                                color: isSelected ? '#ffffff' : '#475569',
                                cursor: 'pointer',
                                fontWeight: 700,
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {isSelected ? '✓ ' : '+ '} Lot #{lot.lotNo} ({formattedStock}m)
                            </button>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    challanForm.fabricName ? (
                      <div style={{ marginTop: '0.35rem', fontSize: '0.74rem', color: '#64748b', fontStyle: 'italic' }}>
                        No in-stock lots found for {challanForm.fabricName}
                      </div>
                    ) : null
                  )}

                  {/* DYNAMIC PROPER LOT STOCK PROGRESS BAR */}
                  {selectedLotsList.length > 0 && (
                    <div style={{
                      marginTop: '0.65rem',
                      padding: '0.75rem 0.9rem',
                      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                      border: challanTotalMtr > selectedLotsTotalStock ? '1px solid #fca5a5' : '1px solid #cbd5e1',
                      borderRadius: '10px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                    }}>
                      {/* Mathematical Progress Calculations (Including Shortage) */}
                      {(() => {
                        const rawMtr = challanTotalMtr > 0 ? challanTotalMtr : (parseFloat(challanForm.totalMtr) || 0);
                        let shortageMtrVal = 0;
                        if (challanForm.shortageMode === 'mtr') {
                          shortageMtrVal = parseFloat(challanForm.shortageMtr) || 0;
                        } else if (challanForm.shortagePct !== '' && challanForm.shortagePct != null) {
                          const p = parseFloat(challanForm.shortagePct) || 0;
                          shortageMtrVal = (rawMtr * p) / 100;
                        }
                        const effectiveTakenMtr = rawMtr + shortageMtrVal;

                        const hasStock = selectedLotsTotalStock > 0;
                        const realPct = hasStock ? Math.round((effectiveTakenMtr / selectedLotsTotalStock) * 100) : (effectiveTakenMtr > 0 ? 999 : 0);
                        const fillWidth = Math.min(100, realPct);
                        const isOver = effectiveTakenMtr > selectedLotsTotalStock + 0.01;
                        const isNearFull = realPct >= 85 && !isOver;

                        const barBg = isOver
                          ? 'linear-gradient(90deg, #ef4444 0%, #b91c1c 100%)'
                          : isNearFull
                          ? 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)'
                          : 'linear-gradient(90deg, #10b981 0%, #059669 100%)';

                        let balance = selectedLotsTotalStock - effectiveTakenMtr;
                        if (Math.abs(balance) < 0.01) balance = 0;

                        return (
                          <>
                            {/* Top Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '1rem' }}>📊</span>
                                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a' }}>
                                  Lot Stock Fulfillment ({selectedLotsList.length} {selectedLotsList.length === 1 ? 'Lot' : 'Lots'})
                                </span>
                                <span style={{
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  background: '#e2e8f0',
                                  color: '#334155'
                                }}>
                                  {selectedLotsList.length <= 3 ? `#${selectedLotsList.join(', #')}` : `#${selectedLotsList.slice(0, 3).join(', #')} +${selectedLotsList.length - 3} more`}
                                </span>
                              </div>

                              <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                                <span style={{ color: isOver ? '#dc2626' : '#0284c7' }}>
                                  {effectiveTakenMtr.toFixed(2)}m taken
                                </span>
                                {shortageMtrVal > 0 && (
                                  <span style={{ fontSize: '0.68rem', color: '#d97706', fontWeight: 600 }}> ({rawMtr.toFixed(2)}m + {shortageMtrVal.toFixed(2)}m short)</span>
                                )}
                                <span style={{ color: '#64748b' }}> / {selectedLotsTotalStock.toFixed(2)}m stock</span>
                              </div>
                            </div>

                            {/* Track Container */}
                            <div style={{
                              width: '100%',
                              height: '12px',
                              background: '#e2e8f0',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              position: 'relative',
                              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)'
                            }}>
                              <div style={{
                                width: `${fillWidth}%`,
                                height: '100%',
                                background: barBg,
                                borderRadius: '8px',
                                transition: 'width 0.35s ease'
                              }} />
                            </div>

                            {/* Status Footer Metrics */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', fontSize: '0.72rem', fontWeight: 700 }}>
                              <span style={{ color: isOver ? '#dc2626' : isNearFull ? '#d97706' : '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {isOver ? (
                                  <>⚠️ <span>{realPct}% Allocated — EXCEEDED AVAILABLE STOCK!</span></>
                                ) : (
                                  <>✅ <span>{realPct}% Stock Taken ({fillWidth}% of Lot Capacity)</span></>
                                )}
                              </span>

                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: isOver ? '#fee2e2' : '#dcfce7',
                                color: isOver ? '#991b1b' : '#166534',
                                border: isOver ? '1px solid #fca5a5' : '1px solid #86efac'
                              }}>
                                {isOver ? `Deficit: ${Math.abs(balance).toFixed(2)} mtr` : `Remaining: ${Math.abs(balance) < 0.01 ? '0.00' : balance.toFixed(2)} mtr`}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Vendor Challan, Delivery By, PCS */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ flex: 1.2 }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Vendor Challan</label>
                    <input type="text" value={challanForm.vendorChallanNo} onChange={e => setChallanForm({ ...challanForm, vendorChallanNo: e.target.value })} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontWeight: 600, boxSizing: 'border-box' }} placeholder="Vendor Challan #" />
                  </div>
                  <div style={{ flex: 1.2 }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Delivery By</label>
                    <input
                      type="text"
                      list="delivery-by-options"
                      value={challanForm.deliveryBy}
                      onChange={e => setChallanForm({ ...challanForm, deliveryBy: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontWeight: 600, boxSizing: 'border-box' }}
                      placeholder="Driver/person..."
                    />
                    <datalist id="delivery-by-options">
                      {deliveryByOptions.map((opt, i) => (
                        <option key={i} value={opt} />
                      ))}
                    </datalist>
                  </div>
                  <div style={{ flex: 0.8 }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>PCS</label>
                    <input type="number" min="0" value={challanForm.pcs} onChange={e => setChallanForm({ ...challanForm, pcs: e.target.value })} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontWeight: 600, boxSizing: 'border-box' }} placeholder="Pcs" />
                  </div>
                </div>

                {/* Fabric Name & Shortage */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ flex: 2 }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Fabric Quality</label>
                    <input
                      type="text"
                      list="challan-fabrics"
                      value={challanForm.fabricName}
                      onChange={e => {
                        setChallanForm({ ...challanForm, fabricName: e.target.value });
                      }}
                      onBlur={e => {
                        if (e.target.value) {
                          const normFab = normalizeFabricName(e.target.value);
                          const autoP = getDefaultPannaForFabric(normFab, challanForm.panna);
                          setChallanForm(prev => ({ ...prev, fabricName: normFab, panna: autoP }));
                        }
                      }}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontWeight: 600, boxSizing: 'border-box' }}
                      placeholder="Fabric quality..."
                    />
                    <datalist id="challan-fabrics">
                      {fabricsList.map((f, i) => <option key={i} value={f} />)}
                    </datalist>
                  </div>
                  <div style={{ flex: 1.2 }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>
                      Shortage ({challanForm.shortageMode === 'mtr' ? 'Meters' : '%'})
                    </label>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={challanForm.shortageMode === 'mtr' ? (challanForm.shortageMtr || '') : (challanForm.shortagePct || '')}
                        onChange={e => {
                          const val = e.target.value;
                          if (challanForm.shortageMode === 'mtr') {
                            setChallanForm({ ...challanForm, shortageMtr: val, shortagePct: '' });
                          } else {
                            setChallanForm({ ...challanForm, shortagePct: val, shortageMtr: '' });
                          }
                        }}
                        style={{ flex: 1, padding: '0.5rem 0.6rem', fontSize: '0.85rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontWeight: 600, boxSizing: 'border-box' }}
                        placeholder={challanForm.shortageMode === 'mtr' ? "e.g. 5 mtr" : "Shortage %"}
                      />
                      <select
                        value={challanForm.shortageMode || 'pct'}
                        onChange={e => {
                          const newMode = e.target.value;
                          setChallanForm(prev => ({ ...prev, shortageMode: newMode }));
                        }}
                        style={{ padding: '0.45rem 0.4rem', fontSize: '0.8rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontWeight: 800, cursor: 'pointer' }}
                      >
                        <option value="pct">%</option>
                        <option value="mtr">mtr</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Optional Notes */}
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>Notes</label>
                  <input type="text" value={challanForm.notes} onChange={e => setChallanForm({ ...challanForm, notes: e.target.value })} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontWeight: 600, boxSizing: 'border-box' }} placeholder="Optional challan notes…" />
                </div>
              </div>

              {/* RIGHT COLUMN: Dedicated TP Meters Entry & Immediate Action Bar (White Theme) */}
              <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
                
                {/* Right Top Header: TP Section Title & Summary Banner */}
                <div style={{ padding: '1rem 1.25rem', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TP METERS VALUES</span>
                    <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 700 }}>Lot No assigned automatically line-by-line</div>
                  </div>
                  <button type="button" className="btn-secondary" style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem', fontWeight: 700, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0284c7' }} onClick={addTpRow} disabled={challanForm.tpDetails.length >= 30}>
                    <PlusCircle size={14} /> Add TP Row
                  </button>
                </div>

                {/* TP Meters Entry Scrollable Area */}
                <div style={{ flex: 1, padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#ffffff' }}>
                  
                  {/* Table Column Headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: '65px 120px 1fr 36px', gap: '0.5rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', paddingLeft: '0.25rem', marginBottom: '0.2rem' }}>
                    <span>TP No</span>
                    <span>Assigned Lot</span>
                    <span>TP Meters (mtr)</span>
                    <span></span>
                  </div>

                  {(() => {
                    const currentLots = String(challanForm.lotNo || '')
                      .split(',')
                      .map(s => s.trim())
                      .filter(s => s.length > 0);
                    return challanForm.tpDetails.map((row, idx) => {
                      const assignedLot = row.lotNo || currentLots[0] || '';
                      return (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '65px 120px 1fr 36px', gap: '0.5rem', alignItems: 'center' }}>
                          <div style={{ width: '100%', padding: '0.5rem 0.4rem', fontSize: '0.85rem', background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: '6px', textAlign: 'center', fontWeight: 900, color: '#0369a1', cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            TP {row.tpNo}
                          </div>
                          <div style={{ width: '100%', padding: '0.5rem 0.4rem', fontSize: '0.78rem', background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: '6px', color: '#047857', fontWeight: 800, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Lot No is automatically zeroed out and assigned by program">
                            {assignedLot ? `#${assignedLot}` : 'Auto Lot'}
                          </div>
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            autoFocus={idx === 0}
                            value={row.tpMeter}
                            onChange={e => updateTpRow(idx, 'tpMeter', e.target.value)}
                            style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', background: '#ffffff', border: '2px solid #0284c7', borderRadius: '6px', boxSizing: 'border-box' }}
                            placeholder="Enter TP meters…"
                          />
                          <button type="button" onClick={() => removeTpRow(idx)} style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', color: '#dc2626', height: '36px', width: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Remove Row">
                            <X size={16} />
                          </button>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Right Bottom Footer: Live Total & STICKY SAVE / CANCEL BUTTONS (ALWAYS VISIBLE!) */}
                <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  
                  {/* Total Summary Row */}
                  <div style={{ display: 'flex', gap: '1rem', padding: '0.6rem 1rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Total TPs</span>
                      <div style={{ fontWeight: 900, fontSize: '1.3rem', color: '#0284c7' }}>{challanTotalTp} Rows</div>
                    </div>
                    <div style={{ flex: 1.5, textAlign: 'right' }}>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Total Meters</span>
                      <div style={{ fontWeight: 900, fontSize: '1.4rem', color: '#059669' }}>{challanTotalMtr.toFixed(2)} mtr</div>
                    </div>
                  </div>

                  {/* Action Buttons Bar */}
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="button" className="btn-secondary" style={{ flex: 1, padding: '0.65rem 1rem', fontSize: '0.9rem', fontWeight: 700, background: '#e2e8f0', color: '#334155', border: '1px solid #cbd5e1' }} onClick={closeChallanModal}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" style={{ flex: 1.8, padding: '0.65rem 1rem', fontSize: '0.95rem', fontWeight: 900, background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)', color: '#ffffff', border: 'none', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)' }}>
                      {editingChallan ? '💾 Save Changes' : '🚀 Save Challan'}
                    </button>
                  </div>
                </div>

              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Inward Modal ── */}
      {isInwardOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '500px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingTransaction ? 'Edit Fabric Inward' : 'Add Fabric Inward'}</h2>
            <form onSubmit={handleInwardSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Date</label>
                  <input type="date" required value={inwardForm.date} onChange={e => setInwardForm({ ...inwardForm, date: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Lot No</label>
                  <input type="text" disabled value={editingTransaction ? `#${editingTransaction.lotNo}` : `Auto (Next: #${nextLotNo})`} style={{ ...inputStyle, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Challan No</label>
                  <input type="text" value={inwardForm.challanNo} onChange={e => setInwardForm({ ...inwardForm, challanNo: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Vendor Name</label>
                  <input type="text" list="inward-vendors" value={inwardForm.vendorName} onChange={e => setInwardForm({ ...inwardForm, vendorName: e.target.value })} style={inputStyle} placeholder="Select or type vendor..." />
                  <datalist id="inward-vendors">
                    {vendorsList.map(v => <option key={v._id} value={v.name} />)}
                  </datalist>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Fabric Quality *</label>
                <input
                  type="text"
                  required
                  list="inward-fabrics"
                  value={inwardForm.fabricQuality}
                  onChange={e => {
                    const normFab = normalizeFabricName(e.target.value);
                    const autoP = getDefaultPannaForFabric(normFab, inwardForm.panna);
                    setInwardForm({ ...inwardForm, fabricQuality: normFab, panna: autoP });
                  }}
                  style={inputStyle}
                  placeholder="Select or type fabric..."
                />
                <datalist id="inward-fabrics">
                  {fabricsList.map(f => <option key={f} value={f} />)}
                </datalist>
              </div>

              <div>
                <label style={labelStyle}>Fabric Panna (Width)</label>
                <input type="text" list="inward-widths" value={inwardForm.panna} onChange={e => setInwardForm({ ...inwardForm, panna: e.target.value })} style={inputStyle} placeholder="Select or type panna..." />
                <datalist id="inward-widths">
                  {widthsList.map(w => <option key={w} value={w} />)}
                </datalist>
              </div>

              <div>
                <label style={labelStyle}>Quantity (mtr) *</label>
                <input type="number" step="0.01" required min="0.1" value={inwardForm.qty} onChange={e => setInwardForm({ ...inwardForm, qty: e.target.value })} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Shortage ({inwardForm.shortageMode === 'mtr' ? 'Meters' : 'Percentage %'})</label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={inwardForm.shortageMode === 'mtr' ? (inwardForm.shortageMtr || '') : (inwardForm.shortagePct || '')}
                    onChange={e => {
                      const val = e.target.value;
                      if (inwardForm.shortageMode === 'mtr') {
                        setInwardForm({ ...inwardForm, shortageMtr: val, shortagePct: '' });
                      } else {
                        setInwardForm({ ...inwardForm, shortagePct: val, shortageMtr: '' });
                      }
                    }}
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder={inwardForm.shortageMode === 'mtr' ? "e.g. 5 mtr" : "e.g. 3.5 %"}
                  />
                  <select
                    value={inwardForm.shortageMode || 'pct'}
                    onChange={e => {
                      const newMode = e.target.value;
                      setInwardForm(prev => ({ ...prev, shortageMode: newMode }));
                    }}
                    style={{ ...inputStyle, width: 'auto', fontWeight: 800, cursor: 'pointer' }}
                  >
                    <option value="pct">% (Pct)</option>
                    <option value="mtr">mtr (Meters)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Notes</label>
                <input type="text" value={inwardForm.notes} onChange={e => setInwardForm({ ...inwardForm, notes: e.target.value })} style={inputStyle} placeholder="Optional notes..." />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={closeInwardModal}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>{editingTransaction ? 'Save Changes' : 'Save Inward'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Outward Modal ── */}
      {isOutwardOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '500px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Add Fabric Outward</h2>
            <form onSubmit={handleOutwardSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Date</label>
                  <input type="date" required value={outwardForm.date} onChange={e => setOutwardForm({ ...outwardForm, date: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Job Card No *</label>
                  <input type="text" required list="outward-jobs" value={outwardForm.jobNo} onChange={handleJobNoChange} style={inputStyle} placeholder="Select or type Job No..." />
                  <datalist id="outward-jobs">
                    {inProgressJobCards.map(j => <option key={j._id} value={j.jobNo} />)}
                  </datalist>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Challan No</label>
                <input type="text" value={outwardForm.challanNo} onChange={e => setOutwardForm({ ...outwardForm, challanNo: e.target.value })} style={inputStyle} placeholder="Outward challan number..." />
              </div>

              <div>
                <label style={labelStyle}>Party Name</label>
                <input type="text" list="outward-parties" value={outwardForm.partyName} onChange={e => setOutwardForm({ ...outwardForm, partyName: e.target.value })} style={inputStyle} placeholder="Auto-filled from job card..." />
                <datalist id="outward-parties">
                  {partiesList.map((p, idx) => <option key={idx} value={p} />)}
                </datalist>
              </div>

              <div>
                <label style={labelStyle}>Fabric Quality *</label>
                <input type="text" required list="outward-fabrics" value={outwardForm.fabricQuality} onChange={e => setOutwardForm({ ...outwardForm, fabricQuality: e.target.value })} style={inputStyle} placeholder="Auto-filled from job card..." />
                <datalist id="outward-fabrics">
                  {fabricsList.map(f => <option key={f} value={f} />)}
                </datalist>
              </div>

              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Lot No *</span>
                  <button
                    type="button"
                    onClick={fetchAllLots}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0 }}
                  >
                    <RefreshCw size={11} className={lotLoading ? 'spin-loader' : ''} /> {lotLoading ? 'Loading...' : 'Reload'}
                  </button>
                </label>
                <select
                  required
                  value={outwardForm.lotNo}
                  onChange={handleLotNoChange}
                  style={inputStyle}
                  disabled={lotLoading}
                >
                  <option value="">
                    {lotLoading ? 'Loading lots...' : '-- Select Active Lot --'}
                  </option>
                  {(() => {
                    // Client-side filter by fabricQuality (case-insensitive match)
                    const filtered = outwardForm.fabricQuality
                      ? lotList.filter(l => l.fabricQuality.toLowerCase().trim() === outwardForm.fabricQuality.toLowerCase().trim())
                      : lotList;
                    return filtered.map(lot => (
                      <option key={lot.lotNo} value={lot.lotNo}>
                        Lot #{lot.lotNo} — {lot.fabricQuality} | Stock: {Number(lot.currentStock || 0).toFixed(2)} mtr{lot.panna ? ` | Panna: ${lot.panna}` : ''}
                      </option>
                    ));
                  })()}
                </select>
                {/* Status messages */}
                {!lotLoading && lotList.length === 0 && (
                  <span style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.3rem', display: 'block' }}>
                    ⚠️ No lots with available stock found. Please add Inward first.
                  </span>
                )}
                {!lotLoading && lotList.length > 0 && outwardForm.fabricQuality &&
                  lotList.filter(l => l.fabricQuality.toLowerCase().trim() === outwardForm.fabricQuality.toLowerCase().trim()).length === 0 && (
                    <span style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.3rem', display: 'block' }}>
                      ⚠️ No lots found for "{outwardForm.fabricQuality}". Check fabric name spelling or add Inward first.
                    </span>
                  )}
                {outwardForm.lotNo && lotList.find(l => String(l.lotNo) === String(outwardForm.lotNo)) && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '0.25rem', display: 'block' }}>
                    ✓ Available stock: {Number(lotList.find(l => String(l.lotNo) === String(outwardForm.lotNo)).currentStock || 0).toFixed(2)} mtr
                  </span>
                )}
              </div>


              <div>
                <label style={labelStyle}>Fabric Panna (Width)</label>
                <input type="text" list="outward-widths" value={outwardForm.panna} onChange={e => setOutwardForm({ ...outwardForm, panna: e.target.value })} style={inputStyle} placeholder="Auto-filled from lot..." />
                <datalist id="outward-widths">
                  {widthsList.map(w => <option key={w} value={w} />)}
                </datalist>
              </div>

              <div>
                <label style={labelStyle}>Quantity (mtr) *</label>
                <input type="number" step="0.01" required min="0.1" value={outwardForm.qty} onChange={e => setOutwardForm({ ...outwardForm, qty: e.target.value })} style={inputStyle} />
                {(outwardForm.fabricQuality || '').toUpperCase().includes('CREPE') && (
                  <span style={{ fontSize: '0.75rem', color: '#8b5cf6', marginTop: '0.3rem', display: 'block', fontWeight: 600 }}>
                    💡 +2% Auto-Added for French Crepe {outwardForm.qty && !isNaN(outwardForm.qty) ? `(${outwardForm.qty} mtr → ${(parseFloat(outwardForm.qty) * 1.02).toFixed(2)} mtr outward)` : '(e.g. 100 mtr → 102.00 mtr)'}
                  </span>
                )}
              </div>

              <div>
                <label style={labelStyle}>Notes</label>
                <input type="text" value={outwardForm.notes} onChange={e => setOutwardForm({ ...outwardForm, notes: e.target.value })} style={inputStyle} placeholder="Optional notes..." />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsOutwardOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, background: 'var(--danger)', borderColor: 'var(--danger)' }}>Save Outward</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '400px', padding: '2rem', textAlign: 'center' }}>
            <Trash2 size={36} style={{ color: 'var(--danger)', margin: '0 auto 1rem' }} />
            <h3 style={{ marginBottom: '0.5rem' }}>Delete Transaction?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              This will permanently delete:<br />
              <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget.label}</strong>
            </p>
            <p style={{ color: '#f59e0b', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
              ⚠️ Stock levels will be recalculated after deletion.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setDeleteTarget(null)}>
                <X size={15} /> Cancel
              </button>
              <button className="btn-primary" style={{ flex: 1, background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={handleDelete}>
                <Trash2 size={15} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PDF Report Filter Modal ── */}
      {isPdfFilterOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '440px', padding: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileDown size={20} /> Download Fabric Ledger PDF
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Date From</label>
                  <input type="date" value={pdfFilter.dateStart} onChange={e => setPdfFilter({ ...pdfFilter, dateStart: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Date To</label>
                  <input type="date" value={pdfFilter.dateEnd} onChange={e => setPdfFilter({ ...pdfFilter, dateEnd: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Fabric Quality (optional — leave blank for all)</label>
                <input type="text" list="pdf-fabrics" value={pdfFilter.fabricQuality} onChange={e => setPdfFilter({ ...pdfFilter, fabricQuality: e.target.value })} style={inputStyle} placeholder="All fabrics..." />
                <datalist id="pdf-fabrics">
                  {fabricsList.map(f => <option key={f} value={f} />)}
                </datalist>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Leave date fields blank to include all transactions.</p>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsPdfFilterOpen(false)}>Cancel</button>
                <button className="btn-primary" style={{ flex: 1 }} onClick={handleDownloadPdf} disabled={pdfLoading}>
                  {pdfLoading ? <RefreshCw size={15} className="spin-loader" /> : <FileDown size={15} />}
                  {pdfLoading ? 'Generating...' : 'Download PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Catalog Manager Modal */}
      {isManagerOpen && (
        <CatalogManagerModal
          initialTab="vendors"
          context="elite_print"
          onClose={() => {
            setIsManagerOpen(false);
            fetchData();
          }}
        />
      )}

      {/* COMBINED / INDIVIDUAL DEPARTMENT PDF REPORT MODAL */}
      {isCombinedModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }}>
          <div className="glass-panel" style={{ background: 'var(--panel-bg, #1e1b4b)', width: '100%', maxWidth: '560px', borderRadius: '14px', padding: '1.5rem', border: '1px solid var(--border-light, #4c1d95)', color: 'var(--text-primary, #ffffff)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <FileText size={22} color="#a78bfa" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Download PDF Reports (Elite Digital Prints)</h3>
              </div>
              <button onClick={() => setIsCombinedModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.2rem' }}><X size={20} /></button>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '1rem', lineHeight: '1.4' }}>
              Select the date period and choose individual department reports or combine them into a single report PDF.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#a78bfa', marginBottom: '0.3rem' }}>Date Start</label>
                  <input type="date" value={combinedDateStart} onChange={e => setCombinedDateStart(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#a78bfa', marginBottom: '0.3rem' }}>Date End</label>
                  <input type="date" value={combinedDateEnd} onChange={e => setCombinedDateEnd(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#a78bfa', margin: 0 }}>Select Department Reports:</label>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedCombinedReports(['stock', 'inward', 'lotwise', 'lotTransfer', 'stockAdjustment', 'requirement', 'challan'])}
                      style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(124, 58, 237, 0.2)', border: '1px solid rgba(124, 58, 237, 0.4)', color: '#c084fc', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const tabToReport = {
                          dashboard: 'stock',
                          inward: 'inward',
                          lotwise: 'lotwise',
                          lotTransfer: 'lotTransfer',
                          stockAdjustment: 'stockAdjustment',
                          requirement: 'requirement'
                        };
                        const targetRep = tabToReport[activeTab] || 'stock';
                        setSelectedCombinedReports([targetRep]);
                      }}
                      style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(56, 189, 248, 0.2)', border: '1px solid rgba(56, 189, 248, 0.4)', color: '#38bdf8', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}
                    >
                      Active Tab Only
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '240px', overflowY: 'auto' }}>
                  {[
                    { id: 'stock', label: 'Stock Overview', desc: 'Fabric quality stock levels, inward/outward totals & net available stock' },
                    { id: 'inward', label: 'Inward Register', desc: 'Supplier inward receipts, lot numbers, vendor names & inward meters' },
                    { id: 'lotwise', label: 'Lot Wise Details', desc: 'Lot-wise fabric stock balance, net remaining meters & vendor details' },
                    { id: 'lotTransfer', label: 'Lot Transfer Logs', desc: 'Lot-to-lot transfer transactions & fabric quality movements' },
                    { id: 'stockAdjustment', label: 'Stock Adjustment (SA)', desc: 'Physical audit adjustments, stock (+/-) entries & SA vouchers' },
                    { id: 'requirement', label: 'Fabric Requirements', desc: 'Required vs available fabric meters & shortage alerts' },
                    { id: 'challan', label: 'Delivery Challans Register', desc: 'Dispatched challans, party names, billing & TP rolls' }
                  ].map(rep => (
                    <label key={rep.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer', fontSize: '0.83rem' }}>
                      <input
                        type="checkbox"
                        checked={selectedCombinedReports.includes(rep.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedCombinedReports([...selectedCombinedReports, rep.id]);
                          } else {
                            if (selectedCombinedReports.length <= 1) {
                              alert('Please select at least 1 report.');
                              return;
                            }
                            setSelectedCombinedReports(selectedCombinedReports.filter(r => r !== rep.id));
                          }
                        }}
                        style={{ marginTop: '0.15rem', accentColor: '#7c3aed' }}
                      />
                      <div>
                        <strong style={{ color: '#f8fafc' }}>{rep.label}</strong>
                        <div style={{ fontSize: '0.73rem', color: '#94a3b8' }}>{rep.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setIsCombinedModalOpen(false)} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>Cancel</button>
              <button
                onClick={async () => {
                  setCombinedLoading(true);
                  try {
                    await api.downloadFabricCombinedReportPdf(combinedDateStart, combinedDateEnd, selectedCombinedReports, `Elite_Digital_Prints_Report_${combinedDateStart}_to_${combinedDateEnd}.pdf`);
                    setIsCombinedModalOpen(false);
                  } catch (err) {
                    alert(err.message);
                  } finally {
                    setCombinedLoading(false);
                  }
                }}
                disabled={combinedLoading}
                className="btn-primary"
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', background: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)', border: 'none', gap: '0.4rem', fontWeight: 700 }}
              >
                <Download size={16} /> {combinedLoading ? 'Generating Report PDF...' : 'Download Report PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lot Transfer Modal */}
      {isTransferFormOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '550px', padding: '1.5rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f8fafc' }}>
                <ArrowRightLeft size={20} color="#a78bfa" /> Perform Fabric Lot Transfer
              </h3>
              <X size={20} onClick={() => setIsTransferFormOpen(false)} style={{ cursor: 'pointer', color: '#94a3b8' }} />
            </div>

            <form onSubmit={handleTransferSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>Date</label>
                  <input
                    type="date"
                    required
                    value={transferForm.date}
                    onChange={e => setTransferForm({ ...transferForm, date: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#1e293b', border: '1px solid #475569', color: '#f8fafc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>Fabric Quality</label>
                  <select
                    required
                    value={transferForm.fabricQuality}
                    onChange={e => {
                      const fab = e.target.value;
                      setTransferForm({
                        ...transferForm,
                        fabricQuality: fab,
                        sourceLotNo: '',
                        destLotNo: '',
                        qty: ''
                      });
                    }}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#1e293b', border: '1px solid #475569', color: '#f8fafc' }}
                  >
                    <option value="">Select Fabric Quality</option>
                    {fabricsList.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Source Lot and Destination Lot */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#f87171', marginBottom: '0.3rem', fontWeight: 600 }}>
                    Source Lot # (From / Decreases Stock)
                  </label>
                  <select
                    required
                    value={transferForm.sourceLotNo}
                    onChange={e => setTransferForm({ ...transferForm, sourceLotNo: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#1e293b', border: '1px solid #475569', color: '#f8fafc' }}
                  >
                    <option value="">Select Source Lot</option>
                    {lotRecords
                      .filter(l => !transferForm.fabricQuality || l.fabricQuality.toUpperCase() === transferForm.fabricQuality.toUpperCase())
                      .filter(l => l.currentStock > 0)
                      .map(l => (
                        <option key={l.lotNo} value={l.lotNo}>
                          Lot #{l.lotNo} ({l.currentStock.toFixed(2)}m available)
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#34d399', marginBottom: '0.3rem', fontWeight: 600 }}>
                    Destination Lot # (To / Increases Stock)
                  </label>
                  <select
                    required
                    value={transferForm.destLotNo}
                    onChange={e => {
                      const dLotNo = e.target.value;
                      const matched = lotRecords.find(l => String(l.lotNo) === String(dLotNo));
                      let autoQty = transferForm.qty;
                      if (matched && matched.currentStock < 0) {
                        autoQty = String(Math.abs(matched.currentStock).toFixed(2));
                      }
                      setTransferForm({ ...transferForm, destLotNo: dLotNo, qty: autoQty });
                    }}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#1e293b', border: '1px solid #475569', color: '#f8fafc' }}
                  >
                    <option value="">Select Destination Lot</option>
                    {lotRecords
                      .filter(l => !transferForm.fabricQuality || l.fabricQuality.toUpperCase() === transferForm.fabricQuality.toUpperCase())
                      .filter(l => String(l.lotNo) !== String(transferForm.sourceLotNo))
                      .map(l => (
                        <option key={l.lotNo} value={l.lotNo}>
                          Lot #{l.lotNo} ({l.currentStock < 0 ? `DEFICIT: ${l.currentStock.toFixed(2)}m` : `${l.currentStock.toFixed(2)}m stock`})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Transfer Quantity (Meters)</label>
                  {transferForm.destLotNo && (() => {
                    const matched = lotRecords.find(l => String(l.lotNo) === String(transferForm.destLotNo));
                    if (matched && matched.currentStock < 0) {
                      const defVal = Math.abs(matched.currentStock);
                      return (
                        <button
                          type="button"
                          onClick={() => setTransferForm({ ...transferForm, qty: String(defVal.toFixed(2)) })}
                          style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          Auto-fill Deficit ({defVal.toFixed(2)}m)
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="e.g. 15.5"
                  value={transferForm.qty}
                  onChange={e => setTransferForm({ ...transferForm, qty: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#1e293b', border: '1px solid #475569', color: '#f8fafc', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>Notes / Reason (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Rebalance negative lot stock balance"
                  value={transferForm.notes}
                  onChange={e => setTransferForm({ ...transferForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: '#1e293b', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setIsTransferFormOpen(false)} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>Cancel</button>
                <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem', background: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)', border: 'none' }}>
                  {loading ? 'Processing Transfer...' : 'Execute Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delivery Challan Staff Audit History Modal */}
      {selectedChallanHistory && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            width: '100%', maxWidth: '600px', background: '#0f172a', border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '14px', padding: '1.25rem', color: '#f8fafc', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} /> Delivery Challan #{selectedChallanHistory.challanNo || selectedChallanHistory.jobNo} — Staff Audit Log
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                  Staff attribution for this fabric dispatch / delivery transaction.
                </p>
              </div>
              <button className="btn-icon" onClick={() => setSelectedChallanHistory(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', borderRadius: '10px', background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9' }}>Logged By (Staff):</span>
                <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(124, 58, 237, 0.18)', color: '#a78bfa', fontWeight: 800, fontSize: '0.85rem', border: '1px solid rgba(124, 58, 237, 0.3)' }}>
                  {selectedChallanHistory.createdByName || selectedChallanHistory.createdBy || 'HASI'}
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '0.75rem' }}>
                <div>Party: <strong style={{ color: '#f8fafc' }}>{selectedChallanHistory.partyName || 'Client'}</strong></div>
                <div>Fabric: <strong style={{ color: '#f8fafc' }}>{selectedChallanHistory.fabricQuality} ({selectedChallanHistory.qty} mtr)</strong></div>
                <div>Date Logged: <strong style={{ color: '#f8fafc' }}>{formatDateDDMMYYYY(selectedChallanHistory.date)}</strong></div>
                {selectedChallanHistory.notes && <div>Notes: <strong style={{ color: '#f8fafc' }}>{selectedChallanHistory.notes}</strong></div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
