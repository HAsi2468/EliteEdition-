import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import {
  Flame, PlusCircle, Search, RefreshCw, Trash2, Edit2, Edit, CheckCircle2,
  AlertCircle, Cpu, Calendar, Clock, User, Layers, ArrowUpRight, Check,
  X, Download, Eye, Layers3, Activity, Tag, FileText, FileSpreadsheet,
  AlertTriangle, Gauge, Thermometer, Zap, Scale, Settings, XCircle, ChevronDown,
  ChevronUp, PlayCircle, Filter, ArrowRight, Sparkles, ListFilter
} from 'lucide-react';
import { triggerPushNotification, triggerGlobalDataRefresh } from './NotificationToast';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY, toLocalYMD } from '../utils/dateUtils';
import { matchSearchQuery } from '../utils/searchUtils';
import { triggerEliteAlert, triggerEliteConfirm } from './EliteModalDialog';
import DateRangePicker, { getDatePresetRange } from './DateRangePicker';
import InfiniteScrollPagination from './InfiniteScrollPagination';
import UnifiedFilterPopover from './common/UnifiedFilterPopover';
import AIMeasurementAgentModal from './common/AIMeasurementAgentModal';
import { SmartThumbnail } from './common/SmartThumbnail';
import QuickActionMenu from './common/QuickActionMenu';
import { EntityBrandBadge } from './common/EntityBrandBadge';
import { Table, LayoutGrid } from 'lucide-react';
import '../styles/fusingEnterprise.css';

function getAutoShift() {
  const hours = new Date().getHours();
  return (hours >= 9 && hours < 21) ? 'Morning' : 'Night';
}

export function getFabricFusingPreset(fabricName) {
  const f = String(fabricName || '').toLowerCase();
  if (f.includes('crepe') || f.includes('french')) {
    return { temp: '210°C', speed: '80', note: 'Standard Sublimation' };
  }
  if (f.includes('organza')) {
    return { temp: '195°C', speed: '80', note: 'Low Temp (Anti-Shrink)' };
  }
  if (f.includes('satin')) {
    return { temp: '205°C', speed: '80', note: 'High Tension' };
  }
  if (f.includes('georgette') || f.includes('chiffon')) {
    return { temp: '200°C', speed: '80', note: 'Medium Heat' };
  }
  if (f.includes('modal') || f.includes('rayon')) {
    return { temp: '190°C', speed: '80', note: 'Pre-dry Recommended' };
  }
  if (f.includes('velvet') || f.includes('heavy')) {
    return { temp: '205°C', speed: '80', note: 'Slow Speed Feed' };
  }
  return { temp: '205°C', speed: '80', note: 'General Polyester' };
}

export const FUSING_SPEED_OPTIONS = [50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78, 80];

// Helper to cleanly format Job Number without duplicate "JOB NO.- JOB NO.-"
export const formatJobCardNo = (jobNo) => {
  if (!jobNo) return '';
  const str = String(jobNo).trim();
  if (/^#?\s*job\s*no\.?/i.test(str)) {
    return str.replace(/^#?\s*job\s*no\.?\s*[-:]?\s*/i, 'JOB NO.- ');
  }
  return `JOB NO.- ${str}`;
};

// Helper to extract numeric printed meters from card (prioritizing printMtr synced from print logs)
export const getCardPrintedMeters = (card) => {
  if (!card) return '';
  const raw = card.printMtr || card.printedMtr || card.freshMtr || card.fusingMtr || card.totalMtr || '';
  const match = String(raw).match(/[\d.]+/);
  return match ? match[0] : '';
};

/**
 * Textile Quarter Meter Helpers:
 * Accepts strictly .00, .25, .50, .75 decimal values.
 */
export const isValidMeterQuarter = (val) => {
  if (val === '' || val === undefined || val === null) return true;
  const num = parseFloat(val);
  if (isNaN(num) || num < 0) return false;
  const remainder = Math.round((num % 1) * 100);
  return remainder === 0 || remainder === 25 || remainder === 50 || remainder === 75;
};

export const sanitizeQuarterInput = (rawVal) => {
  if (rawVal === '' || rawVal === undefined || rawVal === null) return '';
  const str = String(rawVal).trim();
  if (str === '') return '';
  // Allow typing integers or typing a trailing dot (e.g. "10", "10.")
  if (/^\d+\.?$/.test(str)) return str;

  const parts = str.split('.');
  if (parts.length > 2) return parts[0] + '.' + parts[1];

  const intPart = parts[0] || '0';
  const dec = parts[1];

  // While typing 1st decimal digit
  if (dec.length === 1) {
    if (['0', '2', '5', '7'].includes(dec)) return `${intPart}.${dec}`;
    const d = parseInt(dec, 10);
    if (d <= 1) return `${intPart}.00`;
    if (d <= 3) return `${intPart}.25`;
    if (d <= 6) return `${intPart}.50`;
    return `${intPart}.75`;
  }

  // When 2 or more decimal digits are typed
  if (dec.length >= 2) {
    const two = dec.slice(0, 2);
    if (['00', '25', '50', '75'].includes(two)) return `${intPart}.${two}`;
    const n = parseInt(two, 10);
    if (n < 13) return `${intPart}.00`;
    if (n < 38) return `${intPart}.25`;
    if (n < 63) return `${intPart}.50`;
    if (n < 88) return `${intPart}.75`;
    return `${parseInt(intPart, 10) + 1}.00`;
  }

  return str;
};

export const finalizeQuarterBlur = (val) => {
  if (val === '' || val === undefined || val === null) return '';
  const num = parseFloat(val);
  if (isNaN(num) || num < 0) return '0';
  const snapped = Math.round(num * 4) / 4;
  return Number.isInteger(snapped) ? String(snapped) : snapped.toFixed(2);
};

const DEFAULT_FUSING_MACHINES = [
  'Fusing Machine 1 (Rotary)',
  'Fusing Machine 2 (High Speed)',
  'Fusing Machine 3 (Wide Width)',
  'Flatbed Press 1',
  'Flatbed Press 2'
];

export default function FusingDepartment() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('table');

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [fusingFilters, setFusingFilters] = useState({ status: [], machine: [], operator: [], fabric: [], party: [] });
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Ready for Fusing', 'Fusing Pending', 'Fusing In Progress', 'Fusing Done', 'Rejected'
  const [filterMachine, setFilterMachine] = useState('');
  const [filterOperator, setFilterOperator] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');

  // Infinite Scroll & Chunking State for INP & Smooth Viewport
  const [pageSize, setPageSize] = useState(25);
  const [visibleCount, setVisibleCount] = useState(25);
  const [loadingMore, setLoadingMore] = useState(false);

  // Backward-compatible setter for any legacy page actions
  const setCurrentPage = useCallback((newPageOrUpdater) => {
    setVisibleCount(prev => {
      const step = typeof pageSize === 'number' ? pageSize : 25;
      const curP = Math.max(1, Math.ceil(prev / step));
      const pageVal = typeof newPageOrUpdater === 'function' ? newPageOrUpdater(curP) : newPageOrUpdater;
      return Math.max(step, pageVal * step);
    });
  }, [pageSize]);

  // Network Resilience State (Offline / Low-Network Shop Floor detection)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Debounce search query (280ms) for INP < 100ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Tab & Form Collapsed State
  const [activeFusingTab, setActiveFusingTab] = useState('entry'); // 'entry' | 'runs' | 'queue'
  const [fusingLogs, setFusingLogs] = useState([]);
  const [runsSearch, setRunsSearch] = useState('');
  const [isFormExpanded, setIsFormExpanded] = useState(true);
  const [queueFabricFilter, setQueueFabricFilter] = useState('All');
  const [queueSearchQuery, setQueueSearchQuery] = useState('');

  // Top Form Job Search & Eligibility State
  const [jobSearchText, setJobSearchText] = useState('');
  const [serverSearching, setServerSearching] = useState(false);
  const [serverMatchedCards, setServerMatchedCards] = useState([]);
  const [showJobDropdown, setShowJobDropdown] = useState(false);
  const [showAllCardsFilter, setShowAllCardsFilter] = useState(false);
  const jobDropdownRef = React.useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(e.target)) {
        setShowJobDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);

  // Form State for Fusing Production & Wastage Entry Modal (Edit Card)
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  
  const user = api.getCurrentUser();
  const accountFullName = user ? (user.name || user.fullName || user.username || '') : 'Harshit Sidapara (HASI)';

  const [printConfig, setPrintConfig] = useState(null);

  // Dynamic Panna Options from PrintConfig or fallback (36", 44", 58", 64")
  const pannaOptions = useMemo(() => {
    if (printConfig && Array.isArray(printConfig.widths) && printConfig.widths.length > 0) {
      return printConfig.widths.map(w => String(w).includes('"') ? String(w) : `${w}"`);
    }
    return ['36"', '44"', '58"', '64"'];
  }, [printConfig]);

  const [rawMatTxns, setRawMatTxns] = useState([]);

  // Butter Paper Inward Entry Modal State
  const [showButterPaperInwardModal, setShowButterPaperInwardModal] = useState(false);
  const [inwardButterForm, setInwardButterForm] = useState({
    date: toLocalYMD(),
    vendorName: '',
    panna: '58"',
    rolls: '1',
    weightKg: '',
    notes: ''
  });

  const handleButterPaperInwardSubmit = async (e) => {
    e.preventDefault();
    if (!inwardButterForm.weightKg || Number(inwardButterForm.weightKg) <= 0) {
      triggerEliteAlert('Validation Error', 'Please enter valid Butter Paper Inward Weight in Kg.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      await api.createRawMaterialTransaction({
        type: 'INWARD',
        date: inwardButterForm.date,
        materialName: 'Butter Paper',
        panna: inwardButterForm.panna,
        qty: Number(inwardButterForm.weightKg),
        metersPerRoll: Number(inwardButterForm.rolls) || 1,
        unit: 'Kg',
        vendorName: inwardButterForm.vendorName || 'General Supplier',
        notes: `Butter Paper Inward — Rolls: ${inwardButterForm.rolls || 1} | Weight: ${inwardButterForm.weightKg} Kg ${inwardButterForm.notes ? ' | ' + inwardButterForm.notes : ''}`
      });

      triggerPushNotification('📦 Butter Paper Inward Saved', `Logged Inward of ${inwardButterForm.weightKg} Kg Butter Paper!`, 'success');
      setShowButterPaperInwardModal(false);
      setInwardButterForm({
        date: toLocalYMD(),
        vendorName: '',
        panna: '58"',
        rolls: '1',
        weightKg: '',
        notes: ''
      });
      fetchData();
    } catch (err) {
      triggerEliteAlert('Inward Error', err.message || 'Failed to save Butter Paper Inward.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── TOP FORM STATE (New Fusing Entry / Edit Run) ─────────────────────────
  const [topForm, setTopForm] = useState({
    logId: null,
    date: toLocalYMD(),
    shift: getAutoShift(),
    onTime: '09:00',
    offTime: '19:00',
    jobCardId: '',
    jobNo: '',
    fusingMachine: DEFAULT_FUSING_MACHINES[0],
    fusingTemp: '210°C',
    fusingSpeed: '80',
    panna: '58"',
    useButterPaper: 'Yes',
    butterPaperWeightKg: '',
    rollCompleted: 'Complete',
    printedMtr: '',
    freshMtr: '',
    fabricWastageMtr: '0',
    fabricFaultMtr: '0',
    fusingFaultMtr: '0',
    printFaultMtr: '0',
    genuineFaultMtr: '0',
    fusingMtr: '',
    fusingOperator: accountFullName,
    notes: ''
  });
  const [showAiModal, setShowAiModal] = useState(false);

  // Dynamic calculation of total wastage across all 4 fault types in Top Form
  const totalTopWastageMtr = useMemo(() => {
    const fab = parseFloat(topForm.fabricFaultMtr) || 0;
    const fus = parseFloat(topForm.fusingFaultMtr) || 0;
    const prt = parseFloat(topForm.printFaultMtr) || 0;
    const gen = parseFloat(topForm.genuineFaultMtr) || 0;
    const sum = fab + fus + prt + gen;
    return Number.isInteger(sum) ? String(sum) : sum.toFixed(2);
  }, [topForm.fabricFaultMtr, topForm.fusingFaultMtr, topForm.printFaultMtr, topForm.genuineFaultMtr]);

  // Handler for individual fault type changes (Fabric, Fusing, Print, Genuine)
  const handleFaultChange = (field, val) => {
    const sanitized = sanitizeQuarterInput(val);
    setTopForm(prev => {
      const updated = { ...prev, [field]: sanitized };
      const fab = parseFloat(field === 'fabricFaultMtr' ? sanitized : updated.fabricFaultMtr) || 0;
      const fus = parseFloat(field === 'fusingFaultMtr' ? sanitized : updated.fusingFaultMtr) || 0;
      const prt = parseFloat(field === 'printFaultMtr' ? sanitized : updated.printFaultMtr) || 0;
      const gen = parseFloat(field === 'genuineFaultMtr' ? sanitized : updated.genuineFaultMtr) || 0;
      const totalW = fab + fus + prt + gen;
      const pMtr = parseFloat(prev.printedMtr) || 0;
      const autoFresh = pMtr > 0 ? Math.max(0, pMtr - totalW) : (parseFloat(prev.freshMtr) || 0);

      const totalWStr = Number.isInteger(totalW) ? String(totalW) : totalW.toFixed(2);
      const autoFreshStr = Number.isInteger(autoFresh) ? String(autoFresh) : autoFresh.toFixed(2);
      const fusingMtrStr = Number.isInteger(autoFresh + totalW) ? String(autoFresh + totalW) : (autoFresh + totalW).toFixed(2);

      return {
        ...updated,
        fabricWastageMtr: totalWStr,
        freshMtr: pMtr > 0 ? autoFreshStr : prev.freshMtr,
        fusingMtr: fusingMtrStr
      };
    });
  };

  const handleFaultBlur = (field, val) => {
    const finalized = finalizeQuarterBlur(val);
    handleFaultChange(field, finalized);
  };

  const handleResetWastage = () => {
    setTopForm(prev => {
      const pMtr = parseFloat(prev.printedMtr) || 0;
      return {
        ...prev,
        fabricWastageMtr: '0',
        fabricFaultMtr: '0',
        fusingFaultMtr: '0',
        printFaultMtr: '0',
        genuineFaultMtr: '0',
        freshMtr: pMtr > 0 ? String(pMtr) : prev.freshMtr,
        fusingMtr: pMtr > 0 ? String(pMtr) : prev.fusingMtr
      };
    });
  };

  const handleFreshMtrChange = (val) => {
    const sanitized = sanitizeQuarterInput(val);
    setTopForm(prev => {
      const fMtr = parseFloat(sanitized) || 0;
      const fab = parseFloat(prev.fabricFaultMtr) || 0;
      const fus = parseFloat(prev.fusingFaultMtr) || 0;
      const prt = parseFloat(prev.printFaultMtr) || 0;
      const gen = parseFloat(prev.genuineFaultMtr) || 0;
      const totalW = fab + fus + prt + gen;
      const fusingMtrStr = Number.isInteger(fMtr + totalW) ? String(fMtr + totalW) : (fMtr + totalW).toFixed(2);
      return {
        ...prev,
        freshMtr: sanitized,
        fusingMtr: fusingMtrStr
      };
    });
  };

  const handleFreshMtrBlur = (val) => {
    const finalized = finalizeQuarterBlur(val);
    handleFreshMtrChange(finalized);
  };

  // Dynamic Report Modal Table State (Panna, Roll Qty, Weight KG)
  const [reportForm, setReportForm] = useState({
    onTime: '09:00',
    offTime: '19:00',
    inwardRows: [
      { id: 1, panna: '36"', rolls: '1', weightKg: '' }
    ],
    usageRows: [
      { id: 1, panna: '36"', rolls: '1', weightKg: '' }
    ]
  });

  // Row helper functions for Report Modal
  const handleAddInwardRow = () => {
    setReportForm(prev => ({
      ...prev,
      inwardRows: [...prev.inwardRows, { id: Date.now(), panna: pannaOptions[0] || '58"', rolls: '1', weightKg: '' }]
    }));
  };

  const handleRemoveInwardRow = (id) => {
    setReportForm(prev => ({
      ...prev,
      inwardRows: prev.inwardRows.filter(r => r.id !== id)
    }));
  };

  const handleInwardRowChange = (id, field, value) => {
    setReportForm(prev => ({
      ...prev,
      inwardRows: prev.inwardRows.map(r => r.id === id ? { ...r, [field]: value } : r)
    }));
  };

  const handleAddUsageRow = () => {
    setReportForm(prev => ({
      ...prev,
      usageRows: [...prev.usageRows, { id: Date.now(), panna: pannaOptions[0] || '58"', rolls: '1', weightKg: '' }]
    }));
  };

  const handleRemoveUsageRow = (id) => {
    setReportForm(prev => ({
      ...prev,
      usageRows: prev.usageRows.filter(r => r.id !== id)
    }));
  };

  const handleUsageRowChange = (id, field, value) => {
    setReportForm(prev => ({
      ...prev,
      usageRows: prev.usageRows.map(r => r.id === id ? { ...r, [field]: value } : r)
    }));
  };

  // Quick Inline Panna Dropdown Manager Modal State
  const [showPannaManagerModal, setShowPannaManagerModal] = useState(false);
  const [newPannaInput, setNewPannaInput] = useState('');

  const handleAddPannaOption = async () => {
    const val = newPannaInput.trim();
    if (!val) return;
    const formattedVal = val.includes('"') ? val : `${val}"`;
    const currentWidths = pannaOptions;
    if (currentWidths.includes(formattedVal)) return;

    const newWidths = [...currentWidths, formattedVal];
    try {
      await api.updateCompanySettings({ companyEntity: 'Elite Digital Print', widths: newWidths });
      setPrintConfig(prev => ({ ...prev, widths: newWidths }));
      setNewPannaInput('');
      triggerPushNotification('Panna Width Added', `Panna "${formattedVal}" added to dropdown options.`, 'success');
    } catch (err) {
      triggerEliteAlert('Error', err.message || 'Failed to add Panna width.', 'error');
    }
  };

  const handleRemovePannaOption = async (pannaToRemove) => {
    const newWidths = pannaOptions.filter(w => w !== pannaToRemove);
    try {
      await api.updateCompanySettings({ companyEntity: 'Elite Digital Print', widths: newWidths });
      setPrintConfig(prev => ({ ...prev, widths: newWidths }));
      triggerPushNotification('Panna Width Removed', `Panna "${pannaToRemove}" removed from dropdown options.`, 'info');
    } catch (err) {
      triggerEliteAlert('Error', err.message || 'Failed to remove Panna width.', 'error');
    }
  };

  // Edit Modal Form State
  const [form, setForm] = useState({
    logId: null,
    jobCardId: '',
    jobNo: '',
    fusingStatus: 'Fusing Done',
    fusingDate: toLocalYMD(),
    
    // Production & 4 Wastage Fault Types
    freshMtr: '',
    fabricFaultMtr: '0',
    fusingFaultMtr: '0',
    printFaultMtr: '0',
    genuineFaultMtr: '0',
    
    // Machine & Process Specs
    fusingTemp: '210°C',
    fusingSpeed: '80',
    fusingMachine: DEFAULT_FUSING_MACHINES[0],
    fusingOperator: accountFullName,
    shift: getAutoShift(),
    useButterPaper: 'Yes',
    notes: ''
  });

  // Quick Speed & Temp Modal State for Clicked Job Card
  const [showSpeedTempModal, setShowSpeedTempModal] = useState(false);
  const [speedTempCard, setSpeedTempCard] = useState(null);
  const [speedTempForm, setSpeedTempForm] = useState({
    fusingMachine: DEFAULT_FUSING_MACHINES[0],
    fusingTemp: '210°C',
    fusingSpeed: '80'
  });

  const openSpeedTempModal = (card) => {
    setSpeedTempCard(card);
    const preset = getFabricFusingPreset(card.fabric);
    setSpeedTempForm({
      fusingMachine: card.fusingMachine || DEFAULT_FUSING_MACHINES[0],
      fusingTemp: card.fusingTemp || card.temperature || preset.temp,
      fusingSpeed: card.fusingSpeed || card.speed || preset.speed || '80'
    });
    setShowSpeedTempModal(true);
  };

  const handleSaveSpeedTemp = async (e) => {
    e.preventDefault();
    if (!speedTempCard) return;

    setSubmitting(true);
    try {
      const payload = {
        fusingMachine: speedTempForm.fusingMachine,
        fusingTemp: speedTempForm.fusingTemp,
        temperature: speedTempForm.fusingTemp,
        fusingSpeed: speedTempForm.fusingSpeed,
        speed: speedTempForm.fusingSpeed
      };

      await api.updateJobCard(speedTempCard._id || speedTempCard.id, payload);
      
      triggerPushNotification(
        '⚡ Fusing Specs Updated',
        `Job #${speedTempCard.jobNo}: Machine = ${speedTempForm.fusingMachine} | Temp = ${speedTempForm.fusingTemp} | Speed = ${speedTempForm.fusingSpeed}`,
        'success'
      );
      
      triggerGlobalDataRefresh('fusing');
      setShowSpeedTempModal(false);
      fetchData();
    } catch (err) {
      triggerEliteAlert('Update Error', err.message || 'Failed to update fusing speed and temperature.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchData();
    api.getPrintConfig().then(res => setPrintConfig(res)).catch(() => {});
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchData();
    }, 120000);
    const handleGlobalRefresh = () => fetchData();
    window.addEventListener('elite-data-refresh', handleGlobalRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('elite-data-refresh', handleGlobalRefresh);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getJobCards({ limit: 2000, department: 'digital_print' });
      const allCards = res?.data || (Array.isArray(res) ? res : []);
      setCards(allCards);

      try {
        const rawRes = await api.getRawMaterialTransactions();
        const txns = rawRes?.transactions || (Array.isArray(rawRes) ? rawRes : []);
        setRawMatTxns(txns);
      } catch (rmErr) {
        console.warn('Failed to load raw material transactions:', rmErr);
      }

      try {
        const fLogsRes = await api.getJobFusingLogs({ limit: 100 });
        const flogs = fLogsRes?.data || (Array.isArray(fLogsRes) ? fLogsRes : []);
        setFusingLogs(flogs);
      } catch (flErr) {
        console.warn('Failed to load fusing logs:', flErr);
      }
    } catch (err) {
      setError(err.message || 'Failed to load fusing job cards data.');
    } finally {
      setLoading(false);
    }
  };

  // Dynamic Server-Side Search Lookup for Job Cards (covers historic/backlog jobs)
  useEffect(() => {
    if (!jobSearchText || !jobSearchText.trim()) {
      setServerMatchedCards([]);
      setServerSearching(false);
      return;
    }
    const q = jobSearchText.trim();
    // If user already selected a full label (contains em-dash), do not re-query
    if (q.includes('—')) return;

    let isMounted = true;
    const timer = setTimeout(async () => {
      setServerSearching(true);
      try {
        const res = await api.getJobCards({ search: q, limit: 30, department: 'digital_print' });
        const remoteCards = res?.data || (Array.isArray(res) ? res : []);
        if (isMounted) {
          setServerMatchedCards(remoteCards);
          // Merge newly found remote cards into local cards state so selection and calculations work smoothly
          if (remoteCards.length > 0) {
            setCards(prev => {
              const existingIds = new Set(prev.map(item => String(item._id || item.id)));
              const toAdd = remoteCards.filter(item => !existingIds.has(String(item._id || item.id)));
              return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
            });
          }
        }
      } catch (err) {
        console.warn('Server-side job card search error:', err);
      } finally {
        if (isMounted) setServerSearching(false);
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [jobSearchText]);

  // Filter only cards that are Done for Printing and Pending for Fusing
  const eligibleFusingCards = useMemo(() => {
    return cards.filter(c => {
      if (showAllCardsFilter) return true;
      if (topForm.jobCardId && (String(c._id) === String(topForm.jobCardId) || String(c.id) === String(topForm.jobCardId))) {
        return true;
      }
      const pStatus = String(c.printStatus || c.status || '').toLowerCase();
      const isPrintDone = pStatus === 'printing done' || pStatus === 'printed' || (pStatus.includes('done') && !pStatus.includes('pending'));
      const fStatus = String(c.fusingStatus || 'fusing pending').toLowerCase();
      const isFusingPending = fStatus !== 'fusing done' && fStatus !== 'fused' && fStatus !== 'done';
      return isPrintDone && isFusingPending;
    });
  }, [cards, topForm.jobCardId, showAllCardsFilter]);

  const searchMatchingCards = useMemo(() => {
    const map = new Map();
    // 1. Add eligible local cards
    eligibleFusingCards.forEach(c => map.set(String(c._id || c.id), c));
    // 2. Add server matched cards
    serverMatchedCards.forEach(c => {
      if (showAllCardsFilter) {
        map.set(String(c._id || c.id), c);
      } else {
        const pStatus = String(c.printStatus || c.status || '').toLowerCase();
        const isPrintDone = pStatus === 'printing done' || pStatus === 'printed' || (pStatus.includes('done') && !pStatus.includes('pending')) || parseFloat(c.printMtr || 0) > 0;
        const fStatus = String(c.fusingStatus || 'fusing pending').toLowerCase();
        const isFusingPending = fStatus !== 'fusing done' && fStatus !== 'fused' && fStatus !== 'done';
        if (isPrintDone && isFusingPending) {
          map.set(String(c._id || c.id), c);
        }
      }
    });

    const list = Array.from(map.values());
    if (!jobSearchText || !jobSearchText.trim()) return list;
    const q = jobSearchText.toLowerCase().trim();
    const cleanNum = q.replace(/[^0-9]/g, '');
    return list.filter(c => {
      const jNo = String(c.jobNo || '').toLowerCase();
      const party = String(c.party || c.clientName || c.partyName || '').toLowerCase();
      const design = String(c.designName || c.designNo || '').toLowerCase();
      const fabric = String(c.fabric || '').toLowerCase();
      return (
        jNo.includes(q) ||
        (cleanNum && jNo.includes(cleanNum)) ||
        party.includes(q) ||
        design.includes(q) ||
        fabric.includes(q)
      );
    });
  }, [eligibleFusingCards, serverMatchedCards, jobSearchText, showAllCardsFilter]);

  // Active card selected in top form
  const activeSelectedCard = useMemo(() => {
    if (!topForm.jobCardId) return null;
    return cards.find(c => String(c._id || c.id) === String(topForm.jobCardId));
  }, [cards, topForm.jobCardId]);

  const activeFabricPreset = useMemo(() => {
    if (!activeSelectedCard) return null;
    return getFabricFusingPreset(activeSelectedCard.fabric);
  }, [activeSelectedCard]);

  const isHeatWarning = useMemo(() => {
    if (!activeSelectedCard || !activeFabricPreset) return false;
    const f = String(activeSelectedCard.fabric || '').toLowerCase();
    const tempNum = parseInt(String(topForm.fusingTemp || '').replace(/[^0-9]/g, ''), 10) || 0;
    if ((f.includes('organza') || f.includes('chiffon') || f.includes('modal') || f.includes('rayon')) && tempNum > 200) {
      return true;
    }
    return false;
  }, [activeSelectedCard, activeFabricPreset, topForm.fusingTemp]);

  // Unique fabrics in fusing queue
  const queueFabricsList = useMemo(() => {
    const set = new Set();
    eligibleFusingCards.forEach(c => {
      if (c.fabric) set.add(c.fabric);
    });
    return Array.from(set).sort();
  }, [eligibleFusingCards]);

  // Filtered cards in fusing queue
  const filteredQueueCards = useMemo(() => {
    return eligibleFusingCards.filter(c => {
      if (queueFabricFilter !== 'All' && (c.fabric || '') !== queueFabricFilter) return false;
      if (queueSearchQuery && queueSearchQuery.trim()) {
        const q = queueSearchQuery.toLowerCase().trim();
        const jNo = String(c.jobNo || '').toLowerCase();
        const party = String(c.party || c.clientName || c.partyName || '').toLowerCase();
        const design = String(c.designName || c.designNo || '').toLowerCase();
        const fabric = String(c.fabric || '').toLowerCase();
        if (!jNo.includes(q) && !party.includes(q) && !design.includes(q) && !fabric.includes(q)) return false;
      }
      return true;
    });
  }, [eligibleFusingCards, queueFabricFilter, queueSearchQuery]);

  // Filtered individual runs in fusing runs log
  const filteredFusingRuns = useMemo(() => {
    if (!runsSearch || !runsSearch.trim()) return fusingLogs;
    const q = runsSearch.toLowerCase().trim();
    return fusingLogs.filter(r => {
      const jNo = String(r.jobNo || '').toLowerCase();
      const mName = String(r.fusingMachine || '').toLowerCase();
      const op = String(r.operatorName || '').toLowerCase();
      const notes = String(r.notes || '').toLowerCase();
      const panna = String(r.panna || '').toLowerCase();
      return jNo.includes(q) || mName.includes(q) || op.includes(q) || notes.includes(q) || panna.includes(q);
    });
  }, [fusingLogs, runsSearch]);

  // Handle Selection of Job Card in Top Form
  const handleTopJobCardSelect = (cardOrId) => {
    if (!cardOrId) {
      setTopForm(prev => ({
        ...prev,
        jobCardId: '',
        jobNo: '',
        printedMtr: '',
        freshMtr: '',
        fabricWastageMtr: '0',
        fabricFaultMtr: '0',
        fusingFaultMtr: '0',
        printFaultMtr: '0',
        genuineFaultMtr: '0',
        fusingMtr: '',
        butterPaperWeightKg: '',
        notes: ''
      }));
      setJobSearchText('');
      return;
    }
    const card = typeof cardOrId === 'object' && cardOrId !== null
      ? (cardOrId.target ? cards.find(c => String(c._id) === String(cardOrId.target.value) || String(c.id) === String(cardOrId.target.value)) : cardOrId)
      : cards.find(c => String(c._id) === String(cardOrId) || String(c.id) === String(cardOrId) || String(c.jobNo) === String(cardOrId));

    if (card) {
      const pStatus = String(card.printStatus || '').toLowerCase();
      const isPrintDone = pStatus === 'printing done' || (pStatus.includes('done') && !pStatus.includes('pending')) || parseFloat(card.printMtr || 0) > 0;
      const currentUser = api.getCurrentUser() || {};
      const isAdmin = currentUser.role === 'admin' || currentUser.isAdmin === true || currentUser.isMainAdmin;

      const applyCard = (c) => {
        const pMtr = getCardPrintedMeters(c);
        const cardWaste = c.totalWastageMtr !== undefined && c.totalWastageMtr !== '' ? String(c.totalWastageMtr) : '0';
        const cardPanna = c.panna ? (String(c.panna).includes('"') ? c.panna : `${c.panna}"`) : '58"';
        const preset = getFabricFusingPreset(c.fabric);
        const jobDisplay = formatJobCardNo(c.jobNo);
        
        const pVal = parseFloat(pMtr) || 0;
        const wVal = parseFloat(cardWaste) || 0;
        const calculatedFresh = pVal > 0 ? Math.max(0, pVal - wVal) : 0;
        const defaultFresh = c.freshMtr !== undefined && c.freshMtr !== ''
          ? String(c.freshMtr)
          : (calculatedFresh > 0 ? String(calculatedFresh) : (pMtr || ''));

        setTopForm(prev => ({
          ...prev,
          jobCardId: c._id || c.id,
          jobNo: c.jobNo || '',
          panna: cardPanna,
          printedMtr: pMtr,
          freshMtr: defaultFresh,
          fabricWastageMtr: cardWaste,
          fabricFaultMtr: c.fabricFaultMtr !== undefined && c.fabricFaultMtr !== '' ? String(c.fabricFaultMtr) : cardWaste,
          fusingFaultMtr: c.fusingFaultMtr !== undefined && c.fusingFaultMtr !== '' ? String(c.fusingFaultMtr) : '0',
          printFaultMtr: c.printFaultMtr !== undefined && c.printFaultMtr !== '' ? String(c.printFaultMtr) : '0',
          genuineFaultMtr: c.genuineFaultMtr !== undefined && c.genuineFaultMtr !== '' ? String(c.genuineFaultMtr) : '0',
          fusingMtr: c.fusingMtr || String((parseFloat(defaultFresh) || 0) + wVal),
          fusingTemp: c.fusingTemp || preset.temp || c.temperature || '205',
          fusingSpeed: c.fusingSpeed || preset.speed || c.speed || '80',
          fusingMachine: c.fusingMachine || prev.fusingMachine,
          fusingOperator: c.fusingOperator || prev.fusingOperator || accountFullName,
          useButterPaper: c.useButterPaper || (parseFloat(c.butterPaperWeightKg) > 0 ? 'Yes' : prev.useButterPaper || 'Yes'),
          butterPaperWeightKg: c.butterPaperWeightKg || '',
          rollCompleted: c.fusingStatus === 'Fusing Done' ? 'Complete' : ((c.fusingStatus === 'Fusing In Progress' || c.fusingStatus === 'Partial Complete') ? 'Partial Complete' : prev.rollCompleted || 'Complete'),
          notes: c.emergencyNotes || c.note1 || ''
        }));
        setJobSearchText(`${jobDisplay} — ${c.party || ''} | ${c.designName || ''} (${c.fabric || ''} ${cardPanna})`);
      };

      if (!isPrintDone) {
        if (!isAdmin) {
          triggerEliteAlert(
            'Printing Stage Incomplete',
            `Cannot process Fusing: Job Card #${card.jobNo} has not completed the Printing stage yet (Status: ${card.printStatus || 'Printing Pending'}). Printing must be completed first.`,
            'warning'
          );
          return;
        }
        triggerEliteConfirm({
          title: 'Admin Override: Printing Incomplete',
          message: `Job Card #${card.jobNo} has NOT passed the Printing Stage yet (Status: ${card.printStatus || 'Printing Pending'}). As an Admin, do you want to override and proceed with Fusing?`,
          confirmText: 'Override & Proceed',
          cancelText: 'Cancel'
        }).then(proceed => {
          if (proceed) {
            applyCard(card);
          }
        });
        return;
      }

      applyCard(card);
    } else {
      setTopForm(prev => ({
        ...prev,
        jobCardId: '',
        jobNo: '',
        printedMtr: '',
        freshMtr: '',
        fabricWastageMtr: '0',
        fabricFaultMtr: '0',
        fusingFaultMtr: '0',
        printFaultMtr: '0',
        genuineFaultMtr: '0',
        fusingMtr: '',
        butterPaperWeightKg: '',
        notes: ''
      }));
      setJobSearchText('');
    }
  };

  // Submit Top Fusing Entry Log Form
  const handleTopFormSubmit = async (e) => {
    e.preventDefault();
    if (!topForm.jobCardId && !topForm.jobNo) {
      triggerEliteAlert('Please select or type a valid Job Card No.');
      return;
    }

    // Strict quarter decimal validation (.00, .25, .50, .75)
    const quarterChecks = [
      { label: 'Fresh Fused (MTR)', val: topForm.freshMtr },
      { label: '1. Fabric Fault (Mtr)', val: topForm.fabricFaultMtr },
      { label: '2. Fusing Fault (Mtr)', val: topForm.fusingFaultMtr },
      { label: '3. Print Fault (Mtr)', val: topForm.printFaultMtr },
      { label: '4. Genuine / Joint (Mtr)', val: topForm.genuineFaultMtr }
    ];

    for (const item of quarterChecks) {
      if (item.val && !isValidMeterQuarter(item.val)) {
        triggerEliteAlert(
          'Invalid Decimal Value',
          `${item.label} only accepts quarter decimal values: .00, .25, .50, or .75 (e.g. 10.00, 10.25, 10.50, 10.75). Please adjust the value.`,
          'warning'
        );
        return;
      }
    }

    const printedVal = parseFloat(topForm.printedMtr) || 0;
    const fabW = parseFloat(topForm.fabricFaultMtr) || 0;
    const fusW = parseFloat(topForm.fusingFaultMtr) || 0;
    const prtW = parseFloat(topForm.printFaultMtr) || 0;
    const genW = parseFloat(topForm.genuineFaultMtr) || 0;
    const totalW = fabW + fusW + prtW + genW;
    const wasteMtrVal = Math.max(0, totalW > 0 ? totalW : (parseFloat(topForm.fabricWastageMtr) || 0));
    const freshMtrVal = topForm.freshMtr !== ''
      ? Math.max(0, parseFloat(topForm.freshMtr) || 0)
      : Math.max(0, printedVal - wasteMtrVal);
    const totalFabricUsed = (freshMtrVal + wasteMtrVal).toFixed(2);
    const finalButterKg = topForm.useButterPaper === 'No' ? '0' : String(topForm.butterPaperWeightKg || 0);

    const rollStatus = (topForm.rollCompleted === 'Complete' || topForm.rollCompleted === 'Yes')
      ? 'Complete'
      : (topForm.rollCompleted === 'Partial Complete' ? 'Partial Complete' : 'Pending');
    const isComplete = rollStatus === 'Complete';
    const isPartial = rollStatus === 'Partial Complete';

    const fusingStatusToSave = isComplete 
      ? 'Fusing Done' 
      : (isPartial ? 'Fusing In Progress' : 'Fusing Pending');

    setSubmitting(true);
    try {
      // 1. Find or update job card
      const targetId = topForm.jobCardId || cards.find(c => String(c.jobNo).toLowerCase() === String(topForm.jobNo).toLowerCase())?._id;
      const targetCard = topForm.jobCardId 
        ? cards.find(c => String(c._id) === String(topForm.jobCardId) || String(c.id) === String(topForm.jobCardId))
        : cards.find(c => String(c.jobNo).toLowerCase() === String(topForm.jobNo).toLowerCase());

      if (targetCard) {
        const pStatus = String(targetCard.printStatus || '').toLowerCase();
        const isPrintDone = pStatus === 'printing done' || (pStatus.includes('done') && !pStatus.includes('pending')) || parseFloat(targetCard.printMtr || 0) > 0;
        const currentUser = api.getCurrentUser() || {};
        const isAdmin = currentUser.role === 'admin' || currentUser.isAdmin === true || currentUser.isMainAdmin;

        if (!isPrintDone) {
          if (!isAdmin) {
            triggerEliteAlert('Printing Stage Incomplete', `Cannot submit Fusing log: Job Card #${targetCard.jobNo} has not completed the Printing stage yet.`, 'warning');
            setSubmitting(false);
            return;
          }
          const proceed = await triggerEliteConfirm({
            title: 'Admin Override: Printing Incomplete',
            message: `Job Card #${targetCard.jobNo} has NOT passed the Printing Stage yet. As Admin, do you want to override and save Fusing?`,
            confirmText: 'Override & Save',
            cancelText: 'Cancel'
          });
          if (!proceed) {
            setSubmitting(false);
            return;
          }
        }
      }

      if (targetId) {
        const fusingPayload = {
          jobCardId: targetId,
          jobNo: targetCard ? targetCard.jobNo : topForm.jobNo,
          fusingMachine: topForm.fusingMachine,
          shift: topForm.shift,
          date: topForm.date,
          fusingTemp: topForm.fusingTemp,
          fusingSpeed: topForm.fusingSpeed,
          panna: topForm.panna,
          freshMtr: freshMtrVal,
          totalWastageMtr: wasteMtrVal,
          fabricFaultMtr: parseFloat(topForm.fabricFaultMtr) || 0,
          fusingFaultMtr: parseFloat(topForm.fusingFaultMtr) || 0,
          printFaultMtr: parseFloat(topForm.printFaultMtr) || 0,
          genuineFaultMtr: parseFloat(topForm.genuineFaultMtr) || 0,
          fusingMtr: wasteMtrVal > 0 ? parseFloat(totalFabricUsed) : freshMtrVal,
          useButterPaper: topForm.useButterPaper,
          butterPaperWeightKg: parseFloat(finalButterKg) || 0,
          rollCompleted: rollStatus,
          operatorName: topForm.fusingOperator,
          notes: `Roll Status: ${rollStatus}${wasteMtrVal > 0 ? ` | Wastage: ${wasteMtrVal}m` : ''}${topForm.notes ? ' | ' + topForm.notes : ''}`
        };

        if (topForm.logId) {
          await api.updateJobFusingLog(topForm.logId, fusingPayload);
          triggerPushNotification(
            '✏️ Fusing Run Updated',
            `Job #${topForm.jobNo}: Fusing run updated successfully! (Edit)`,
            'success'
          );
        } else {
          try {
            await api.createJobFusingLog(fusingPayload);
          } catch (flogErr) {
            console.warn('createJobFusingLog fallback to updateJobCard:', flogErr.message);
            const legacyPayload = {
              fusingStatus: fusingStatusToSave,
              fusingDate: topForm.date,
              shift: topForm.shift,
              fusingMachine: topForm.fusingMachine,
              fusingTemp: topForm.fusingTemp,
              temperature: topForm.fusingTemp,
              fusingSpeed: topForm.fusingSpeed,
              speed: topForm.fusingSpeed,
              panna: topForm.panna,
              useButterPaper: topForm.useButterPaper,
              butterPaperWeightKg: finalButterKg,
              freshMtr: String(freshMtrVal),
              totalWastageMtr: String(wasteMtrVal),
              totalFabricUsedMtr: String(totalFabricUsed),
              fabricFaultMtr: String(topForm.fabricFaultMtr !== undefined ? topForm.fabricFaultMtr : wasteMtrVal),
              fusingFaultMtr: String(topForm.fusingFaultMtr || 0),
              printFaultMtr: String(topForm.printFaultMtr || 0),
              genuineFaultMtr: String(topForm.genuineFaultMtr || 0),
              fusingMtr: wasteMtrVal > 0 ? String(totalFabricUsed) : String(freshMtrVal),
              fusingOperator: topForm.fusingOperator,
              emergencyNotes: fusingPayload.notes
            };
            await api.updateJobCard(targetId, legacyPayload);
            if (topForm.useButterPaper === 'Yes' && parseFloat(finalButterKg) > 0) {
              try {
                await api.createRawMaterialTransaction({
                  type: 'OUTWARD',
                  date: topForm.date,
                  materialName: 'Butter Paper',
                  qty: Number(finalButterKg),
                  unit: 'Kg',
                  panna: topForm.panna,
                  jobNo: topForm.jobNo,
                  notes: `Fusing Entry — Machine: ${topForm.fusingMachine} | Operator: ${topForm.fusingOperator} | Roll Status: ${rollStatus}`
                });
              } catch (rmErr) {
                console.warn('Raw material log failed:', rmErr.message);
              }
            }
          }

          triggerPushNotification(
            '🔥 New Fusing Entry Created',
            `Job #${topForm.jobNo}: ${freshMtrVal}m Fresh${wasteMtrVal > 0 ? ` | ${wasteMtrVal}m Wastage` : ''} | Logged as New Entry!`,
            'success'
          );
        }
      }

      triggerGlobalDataRefresh('fusing');
      
      // Reset form
      setTopForm({
        logId: null,
        date: toLocalYMD(),
        shift: getAutoShift(),
        onTime: '09:00',
        offTime: '19:00',
        jobCardId: '',
        jobNo: '',
        fusingMachine: DEFAULT_FUSING_MACHINES[0],
        fusingTemp: '210°C',
        fusingSpeed: '80',
        panna: '58"',
        useButterPaper: 'Yes',
        butterPaperWeightKg: '',
        rollCompleted: 'Complete',
        printedMtr: '',
        freshMtr: '',
        fabricWastageMtr: '0',
        fabricFaultMtr: '0',
        fusingFaultMtr: '0',
        printFaultMtr: '0',
        genuineFaultMtr: '0',
        fusingMtr: '',
        fusingOperator: accountFullName,
        notes: ''
      });
      setJobSearchText('');

      fetchData();
    } catch (err) {
      triggerEliteAlert('Entry Submission Error', err.message || 'Failed to submit fusing entry log.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate total wastage dynamically in Edit Modal
  const calculatedWastageMtr = useMemo(() => {
    const fab = parseFloat(form.fabricFaultMtr) || 0;
    const fus = parseFloat(form.fusingFaultMtr) || 0;
    const prt = parseFloat(form.printFaultMtr) || 0;
    const gen = parseFloat(form.genuineFaultMtr) || 0;
    return (fab + fus + prt + gen).toFixed(2);
  }, [form.fabricFaultMtr, form.fusingFaultMtr, form.printFaultMtr, form.genuineFaultMtr]);

  // ── Compute Total Fabric Used Dynamically (Fresh MTR + Total Wastage) ──
  const calculatedTotalFabricUsedMtr = useMemo(() => {
    const fresh = parseFloat(form.freshMtr) || 0;
    const waste = parseFloat(calculatedWastageMtr) || 0;
    return (fresh + waste).toFixed(2);
  }, [form.freshMtr, calculatedWastageMtr]);

  // Helper to get all fusing logs for a specific card
  const getCardLogs = useCallback((card) => {
    if (!card) return [];
    const cId = String(card._id || card.id || '');
    const jNo = String(card.jobNo || '').toLowerCase();
    return fusingLogs.filter(l => 
      (l.jobCardId && String(l.jobCardId) === cId) || 
      (l.jobNo && String(l.jobNo).toLowerCase() === jNo)
    );
  }, [fusingLogs]);

  // Open New Run for a Card in Fast Entry Top Form (New Entry, NOT Edit)
  const openNewRunForCard = (card) => {
    if (!card) return;
    setSelectedCard(card);
    const printedM = getCardPrintedMeters(card);
    const cardPanna = card.panna ? (String(card.panna).includes('"') ? card.panna : `${card.panna}"`) : '58"';
    const cardButterUsed = card.useButterPaper || (parseFloat(card.butterPaperWeightKg) > 0 ? 'Yes' : 'No');
    const preset = getFabricFusingPreset(card.fabric);

    setTopForm({
      logId: null, // Explicitly New Entry
      date: toLocalYMD(),
      shift: getAutoShift(),
      onTime: '09:00',
      offTime: '19:00',
      jobCardId: card._id || card.id,
      jobNo: card.jobNo || '',
      fusingMachine: card.fusingMachine || DEFAULT_FUSING_MACHINES[0],
      fusingTemp: card.fusingTemp || preset.temp || card.temperature || '210°C',
      fusingSpeed: card.fusingSpeed || preset.speed || card.speed || '80',
      panna: cardPanna,
      useButterPaper: cardButterUsed,
      butterPaperWeightKg: '',
      rollCompleted: 'Complete',
      printedMtr: printedM || card.totalMtr || '',
      freshMtr: '',
      fabricWastageMtr: '0',
      fabricFaultMtr: '0',
      fusingFaultMtr: '0',
      printFaultMtr: '0',
      genuineFaultMtr: '0',
      fusingMtr: '',
      fusingOperator: accountFullName,
      notes: ''
    });
    setJobSearchText(`${formatJobCardNo(card.jobNo)} — ${card.party || ''} | ${card.designName || ''} (${card.fabric || ''} ${cardPanna})`);
    setActiveFusingTab('entry');
    setIsFormExpanded(true);
    window.scrollTo({ top: 120, behavior: 'smooth' });
    triggerPushNotification('➕ New Fusing Entry', `Job #${card.jobNo} selected for new run (New Entry - No Edit)`, 'info');
  };

  // Delete an individual fusing run
  const handleDeleteFusingLog = async (logId, jobNo) => {
    const ok = await triggerEliteConfirm({
      title: 'Delete Fusing Run',
      message: `Are you sure you want to delete this fusing run for Job #${jobNo}? Totals on the Job Card will be automatically recalculated.`,
      confirmText: 'Delete Run',
      cancelText: 'Cancel'
    });
    if (!ok) return;
    try {
      await api.deleteJobFusingLog(logId);
      triggerPushNotification('🗑️ Run Deleted', `Fusing run for Job #${jobNo} removed.`, 'success');
      fetchData();
    } catch (err) {
      triggerEliteAlert('Delete Failed', err.message || 'Failed to delete fusing run.', 'error');
    }
  };

  // Open Edit Modal for a card (or specific fusing log)
  const openFusingModal = (card, specificLog = null) => {
    setSelectedCard(card);
    const printedM = card ? getCardPrintedMeters(card) : '';
    const cardPanna = specificLog?.panna || (card?.panna ? (String(card.panna).includes('"') ? card.panna : `${card.panna}"`) : '58"');
    const cardButterUsed = specificLog?.useButterPaper || card?.useButterPaper || (parseFloat(card?.butterPaperWeightKg) > 0 ? 'Yes' : 'No');

    if (specificLog) {
      setForm({
        logId: specificLog._id || specificLog.id,
        jobCardId: specificLog.jobCardId || card?._id || card?.id,
        jobNo: specificLog.jobNo || card?.jobNo || '',
        fusingStatus: specificLog.rollCompleted === 'Complete' ? 'Fusing Done' : (specificLog.rollCompleted === 'Partial Complete' ? 'Fusing In Progress' : 'Fusing Pending'),
        fusingDate: specificLog.date ? specificLog.date.split('T')[0] : toLocalYMD(),
        panna: cardPanna,
        useButterPaper: cardButterUsed,
        
        freshMtr: specificLog.freshMtr !== undefined && specificLog.freshMtr !== '' ? String(specificLog.freshMtr) : '',
        fabricFaultMtr: String(specificLog.fabricFaultMtr ?? '0'),
        fusingFaultMtr: String(specificLog.fusingFaultMtr ?? '0'),
        printFaultMtr: String(specificLog.printFaultMtr ?? '0'),
        genuineFaultMtr: String(specificLog.genuineFaultMtr ?? '0'),
        
        fusingTemp: specificLog.fusingTemp || card?.fusingTemp || '210°C',
        fusingSpeed: String(specificLog.fusingSpeed || card?.fusingSpeed || '80'),
        fusingMachine: specificLog.fusingMachine || DEFAULT_FUSING_MACHINES[0],
        fusingOperator: specificLog.operatorName || accountFullName,
        shift: specificLog.shift || getAutoShift(),
        butterPaperWeightKg: specificLog.butterPaperWeightKg !== undefined ? String(specificLog.butterPaperWeightKg) : '',
        notes: specificLog.notes || ''
      });
    } else {
      const defaultFresh = card?.freshMtr || card?.fusingMtr || printedM || card?.totalMtr || '';
      setForm({
        logId: null,
        jobCardId: card?._id || card?.id,
        jobNo: card?.jobNo || '',
        fusingStatus: card?.fusingStatus || 'Fusing Done',
        fusingDate: card?.fusingDate || toLocalYMD(),
        panna: cardPanna,
        useButterPaper: cardButterUsed,
        
        freshMtr: defaultFresh,
        fabricFaultMtr: card?.fabricFaultMtr !== undefined && card?.fabricFaultMtr !== '' ? String(card.fabricFaultMtr) : '0',
        fusingFaultMtr: card?.fusingFaultMtr !== undefined && card?.fusingFaultMtr !== '' ? String(card.fusingFaultMtr) : '0',
        printFaultMtr: card?.printFaultMtr !== undefined && card?.printFaultMtr !== '' ? String(card.printFaultMtr) : '0',
        genuineFaultMtr: card?.genuineFaultMtr !== undefined && card?.genuineFaultMtr !== '' ? String(card.genuineFaultMtr) : '0',
        
        fusingTemp: card?.fusingTemp || card?.temperature || '210°C',
        fusingSpeed: card?.fusingSpeed || card?.speed || '80',
        fusingMachine: card?.fusingMachine || DEFAULT_FUSING_MACHINES[0],
        fusingOperator: card?.fusingOperator || accountFullName,
        shift: card?.shift || getAutoShift(),
        butterPaperWeightKg: card?.butterPaperWeightKg || '',
        notes: card?.emergencyNotes || card?.note1 || ''
      });
    }

    // Also populate top form in Edit mode if user wants to inspect in Top Form
    if (card) {
      const cardWaste = card.totalWastageMtr !== undefined && card.totalWastageMtr !== '' ? String(card.totalWastageMtr) : '0';
      const defaultFresh = card.freshMtr || card.fusingMtr || printedM || card.totalMtr || '';
      setTopForm({
        logId: specificLog ? (specificLog._id || specificLog.id) : null,
        date: specificLog?.date ? specificLog.date.split('T')[0] : (card.fusingDate || toLocalYMD()),
        shift: specificLog?.shift || card.shift || getAutoShift(),
        onTime: '09:00',
        offTime: '19:00',
        jobCardId: card._id || card.id,
        jobNo: card.jobNo || '',
        fusingMachine: specificLog?.fusingMachine || card.fusingMachine || DEFAULT_FUSING_MACHINES[0],
        fusingTemp: specificLog?.fusingTemp || card.fusingTemp || card.temperature || '210°C',
        fusingSpeed: specificLog?.fusingSpeed || card.fusingSpeed || card.speed || '80',
        panna: cardPanna,
        useButterPaper: cardButterUsed,
        butterPaperWeightKg: specificLog?.butterPaperWeightKg !== undefined ? String(specificLog.butterPaperWeightKg) : (card.butterPaperWeightKg || ''),
        rollCompleted: specificLog?.rollCompleted || (card.fusingStatus === 'Fusing Done' ? 'Complete' : ((card.fusingStatus === 'Fusing In Progress' || card.fusingStatus === 'Partial Complete') ? 'Partial Complete' : 'Pending')),
        printedMtr: printedM || defaultFresh,
        freshMtr: specificLog?.freshMtr !== undefined ? String(specificLog.freshMtr) : defaultFresh,
        fabricWastageMtr: specificLog?.totalWastageMtr !== undefined ? String(specificLog.totalWastageMtr) : cardWaste,
        fabricFaultMtr: specificLog?.fabricFaultMtr !== undefined ? String(specificLog.fabricFaultMtr) : (card.fabricFaultMtr !== undefined && card.fabricFaultMtr !== '' ? String(card.fabricFaultMtr) : cardWaste),
        fusingFaultMtr: specificLog?.fusingFaultMtr !== undefined ? String(specificLog.fusingFaultMtr) : (card.fusingFaultMtr !== undefined && card.fusingFaultMtr !== '' ? String(card.fusingFaultMtr) : '0'),
        printFaultMtr: specificLog?.printFaultMtr !== undefined ? String(specificLog.printFaultMtr) : (card.printFaultMtr !== undefined && card.printFaultMtr !== '' ? String(card.printFaultMtr) : '0'),
        genuineFaultMtr: specificLog?.genuineFaultMtr !== undefined ? String(specificLog.genuineFaultMtr) : (card.genuineFaultMtr !== undefined && card.genuineFaultMtr !== '' ? String(card.genuineFaultMtr) : '0'),
        fusingMtr: specificLog?.fusingMtr !== undefined ? String(specificLog.fusingMtr) : (card.fusingMtr || defaultFresh),
        fusingOperator: specificLog?.operatorName || card.fusingOperator || accountFullName,
        notes: specificLog?.notes || card.emergencyNotes || card.note1 || ''
      });
      setJobSearchText(`${formatJobCardNo(card.jobNo)} — ${card.party || ''} | ${card.designName || ''} (${card.fabric || ''} ${cardPanna})`);
    }

    setShowFormModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!form.jobCardId) {
      triggerEliteAlert('Please select a valid Job Card.');
      return;
    }

    // Strict quarter decimal validation (.00, .25, .50, .75)
    const quarterChecks = [
      { label: 'Fresh Output (MTR)', val: form.freshMtr },
      { label: '1. Fabric Fault (Mtr)', val: form.fabricFaultMtr },
      { label: '2. Fusing Fault (Mtr)', val: form.fusingFaultMtr },
      { label: '3. Print Fault (Mtr)', val: form.printFaultMtr },
      { label: '4. Genuine / Joint (Mtr)', val: form.genuineFaultMtr }
    ];

    for (const item of quarterChecks) {
      if (item.val && !isValidMeterQuarter(item.val)) {
        triggerEliteAlert(
          'Invalid Decimal Value',
          `${item.label} only accepts quarter decimal values: .00, .25, .50, or .75 (e.g. 10.00, 10.25, 10.50, 10.75). Please adjust the value.`,
          'warning'
        );
        return;
      }
    }

    const freshMtrVal = parseFloat(form.freshMtr) || 0;
    const wasteMtr = parseFloat(calculatedWastageMtr) || 0;
    const totalFabricUsed = (freshMtrVal + wasteMtr).toFixed(2);
    const finalButterKg = form.useButterPaper === 'No' ? '0' : String(form.butterPaperWeightKg || 0);

    setSubmitting(true);
    try {
      if (form.logId) {
        // Updating a specific fusing run (EDIT)
        const logPayload = {
          jobCardId: form.jobCardId,
          jobNo: form.jobNo,
          fusingMachine: form.fusingMachine,
          shift: form.shift,
          date: form.fusingDate,
          fusingTemp: form.fusingTemp,
          fusingSpeed: form.fusingSpeed,
          panna: form.panna,
          freshMtr: freshMtrVal,
          totalWastageMtr: wasteMtr,
          fabricFaultMtr: parseFloat(form.fabricFaultMtr) || 0,
          fusingFaultMtr: parseFloat(form.fusingFaultMtr) || 0,
          printFaultMtr: parseFloat(form.printFaultMtr) || 0,
          genuineFaultMtr: parseFloat(form.genuineFaultMtr) || 0,
          fusingMtr: wasteMtr > 0 ? parseFloat(totalFabricUsed) : freshMtrVal,
          useButterPaper: form.useButterPaper,
          butterPaperWeightKg: parseFloat(finalButterKg) || 0,
          rollCompleted: form.fusingStatus === 'Fusing Done' ? 'Complete' : (form.fusingStatus === 'Fusing In Progress' ? 'Partial Complete' : 'Pending'),
          operatorName: form.fusingOperator,
          notes: form.notes
        };
        await api.updateJobFusingLog(form.logId, logPayload);
        triggerPushNotification('✏️ Fusing Log Updated', `Job #${form.jobNo}: Fusing run updated successfully! (Edit)`, 'success');
      } else {
        // Updating master Job Card
        const payload = {
          fusingStatus: form.fusingStatus,
          fusingDate: form.fusingDate,
          shift: form.shift,
          panna: form.panna,
          useButterPaper: form.useButterPaper,
          butterPaperWeightKg: finalButterKg,
          freshMtr: String(freshMtrVal),
          totalWastageMtr: String(wasteMtr),
          totalFabricUsedMtr: String(totalFabricUsed),
          fabricFaultMtr: String(form.fabricFaultMtr || 0),
          fusingFaultMtr: String(form.fusingFaultMtr || 0),
          printFaultMtr: String(form.printFaultMtr || 0),
          genuineFaultMtr: String(form.genuineFaultMtr || 0),
          fusingMtr: wasteMtr > 0 ? String(totalFabricUsed) : String(freshMtrVal),
          fusingTemp: form.fusingTemp,
          temperature: form.fusingTemp,
          fusingSpeed: String(form.fusingSpeed),
          speed: String(form.fusingSpeed),
          fusingMachine: form.fusingMachine,
          fusingOperator: form.fusingOperator,
          emergencyNotes: form.notes,
          notes: form.notes
        };

        await api.updateJobCard(form.jobCardId, payload);
        triggerPushNotification('🔥 Fusing Record Updated', `Job #${form.jobNo}: ${freshMtrVal}m Fresh | ${wasteMtr}m Wastage updated.`, 'success');
      }

      setShowFormModal(false);
      fetchData();
    } catch (err) {
      triggerEliteAlert('Update Failed', err.message || 'Failed to update fusing record.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Toggle Status in Main Table (Pending -> Partial Complete -> Complete -> Pending)
  const handleQuickToggleStatus = async (card) => {
    const cur = card.fusingStatus || 'Fusing Pending';
    const nextStatus = cur === 'Fusing Pending' 
      ? 'Fusing In Progress' 
      : (cur === 'Fusing In Progress' ? 'Fusing Done' : 'Fusing Pending');

    if (nextStatus !== 'Fusing Pending') {
      const pStatus = String(card.printStatus || '').toLowerCase();
      const isPrintDone = pStatus === 'printing done' || (pStatus.includes('done') && !pStatus.includes('pending')) || parseFloat(card.printMtr || 0) > 0;
      const currentUser = api.getCurrentUser() || {};
      const isAdmin = currentUser.role === 'admin' || currentUser.isAdmin === true || currentUser.isMainAdmin;

      if (!isPrintDone) {
        if (!isAdmin) {
          triggerEliteAlert('Printing Stage Incomplete', `Cannot set Fusing to ${nextStatus}: Job Card #${card.jobNo} has not passed the Printing stage yet.`, 'warning');
          return;
        }
        const proceed = await triggerEliteConfirm({
          title: 'Admin Override: Printing Incomplete',
          message: `Job Card #${card.jobNo} has NOT completed Printing yet. As Admin, do you want to override and set Fusing status to "${nextStatus}"?`,
          confirmText: 'Override & Update',
          cancelText: 'Cancel'
        });
        if (!proceed) return;
      }
    }

    try {
      await api.updateJobCard(card._id || card.id, {
        fusingStatus: nextStatus,
        fusingDate: nextStatus === 'Fusing Done' ? (card.fusingDate || toLocalYMD()) : card.fusingDate
      });
      triggerPushNotification('⚡ Fusing Status Updated', `Job #${card.jobNo} set to ${nextStatus === 'Fusing Done' ? 'Complete' : (nextStatus === 'Fusing In Progress' ? 'Partial Complete' : 'Pending')}`, 'success');
      triggerGlobalDataRefresh('fusing');
      fetchData();
    } catch (err) {
      triggerEliteAlert('Update Failed', err.message || 'Failed to toggle status.', 'error');
    }
  };

  // Unique Operator & Machine Options for Quick Filters
  const uniqueOperators = useMemo(() => {
    const set = new Set();
    cards.forEach(c => {
      if (c.fusingOperator && String(c.fusingOperator).trim()) {
        set.add(String(c.fusingOperator).trim());
      }
    });
    return Array.from(set).sort();
  }, [cards]);

  const uniqueMachines = useMemo(() => {
    const set = new Set(DEFAULT_FUSING_MACHINES);
    cards.forEach(c => {
      if (c.fusingMachine && String(c.fusingMachine).trim()) {
        set.add(String(c.fusingMachine).trim());
      }
    });
    return Array.from(set).sort();
  }, [cards]);

  // Dynamic Date Range calculation from DateRangePicker presets
  const activeDateRange = useMemo(() => {
    if (datePreset === 'custom') {
      const ds = toLocalYMD(customDateStart) || '';
      const de = toLocalYMD(customDateEnd) || '';
      return { start: ds, end: de, dateStart: ds, dateEnd: de };
    }
    if (datePreset && datePreset !== 'all') {
      try {
        const range = getDatePresetRange(datePreset);
        const ds = range?.dateStart || (range?.start ? toLocalYMD(range.start) : '');
        const de = range?.dateEnd || (range?.end ? toLocalYMD(range.end) : '');
        return { start: ds, end: de, dateStart: ds, dateEnd: de };
      } catch (e) {
        return { start: '', end: '', dateStart: '', dateEnd: '' };
      }
    }
    const ds = toLocalYMD(dateStart) || '';
    const de = toLocalYMD(dateEnd) || '';
    return { start: ds, end: de, dateStart: ds, dateEnd: de };
  }, [datePreset, customDateStart, customDateEnd, dateStart, dateEnd]);

  // Filtered Cards with full debouncing & enterprise status filters
  const filteredCards = useMemo(() => {
    return cards.filter(c => {
      if (debouncedSearch && !matchSearchQuery(c, debouncedSearch, ['jobNo', 'party', 'designName', 'fabric', 'fusingOperator', 'fusingMachine'])) {
        return false;
      }
      // Status filtering with multi-select support
      if (fusingFilters.status && fusingFilters.status.length > 0) {
        const curStatus = c.fusingStatus || 'Fusing Pending';
        const matchesAnyStatus = fusingFilters.status.some(st => {
          if (st === 'Ready for Fusing') {
            return c.printStatus === 'Printing Done' && curStatus !== 'Fusing Done';
          }
          if (st === 'Fusing Pending' || st === 'Pending') {
            return curStatus !== 'Fusing Done' && curStatus !== 'Fusing In Progress' && curStatus !== 'Partial Complete';
          }
          if (st === 'Fusing In Progress' || st === 'In-Process') {
            return curStatus === 'Fusing In Progress' || curStatus === 'Partial Complete';
          }
          if (st === 'Fusing Done' || st === 'Completed') {
            return curStatus === 'Fusing Done';
          }
          if (st === 'Rejected') {
            return parseFloat(c.totalWastageMtr || 0) > 0;
          }
          return curStatus === st;
        });
        if (!matchesAnyStatus) return false;
      } else if (statusFilter !== 'All') {
        const curStatus = c.fusingStatus || 'Fusing Pending';
        if (statusFilter === 'Ready for Fusing') {
          if (c.printStatus !== 'Printing Done' || curStatus === 'Fusing Done') return false;
        } else if (statusFilter === 'Fusing Pending' || statusFilter === 'Pending') {
          if (curStatus === 'Fusing Done' || curStatus === 'Fusing In Progress' || curStatus === 'Partial Complete') return false;
        } else if (statusFilter === 'Fusing In Progress' || statusFilter === 'In-Process') {
          if (curStatus !== 'Fusing In Progress' && curStatus !== 'Partial Complete') return false;
        } else if (statusFilter === 'Fusing Done' || statusFilter === 'Completed') {
          if (curStatus !== 'Fusing Done') return false;
        } else if (statusFilter === 'Rejected') {
          const waste = parseFloat(c.totalWastageMtr || 0);
          if (waste <= 0) return false;
        }
      }
      // Machine filtering
      if (fusingFilters.machine && fusingFilters.machine.length > 0) {
        if (!fusingFilters.machine.includes(c.fusingMachine || '')) return false;
      } else if (filterMachine && (c.fusingMachine || '') !== filterMachine) {
        return false;
      }
      // Operator filtering
      if (fusingFilters.operator && fusingFilters.operator.length > 0) {
        if (!fusingFilters.operator.includes(c.fusingOperator || '')) return false;
      } else if (filterOperator && (c.fusingOperator || '') !== filterOperator) {
        return false;
      }
      // Fabric filtering
      if (fusingFilters.fabric && fusingFilters.fabric.length > 0) {
        if (!fusingFilters.fabric.includes(c.fabric || '')) return false;
      }
      // Party filtering
      if (fusingFilters.party && fusingFilters.party.length > 0) {
        if (!fusingFilters.party.includes(c.party || '')) return false;
      }
      const cDateStr = toLocalYMD(c.fusingDate || c.date || c.created_date_time);
      if (activeDateRange.dateStart && cDateStr && cDateStr < activeDateRange.dateStart) return false;
      if (activeDateRange.dateEnd && cDateStr && cDateStr > activeDateRange.dateEnd) return false;

      return true;
    });
  }, [cards, debouncedSearch, fusingFilters, statusFilter, filterMachine, filterOperator, activeDateRange]);

  const fusingFilterCategories = useMemo(() => [
    {
      id: 'status',
      name: 'Fusing Status',
      multi: true,
      options: [
        { value: 'Ready for Fusing', label: '🔥 Ready for Fusing' },
        { value: 'Pending', label: '⏳ Pending' },
        { value: 'In-Process', label: '⚡ In-Process' },
        { value: 'Completed', label: '✅ Completed' },
        { value: 'Rejected', label: '⚠️ Has Wastage / Rejections' }
      ]
    },
    {
      id: 'machine',
      name: 'Fusing Machine',
      multi: true,
      options: (uniqueMachines || []).map(m => ({ value: m, label: m }))
    },
    {
      id: 'operator',
      name: 'Operator',
      multi: true,
      options: (uniqueOperators || []).map(op => ({ value: op, label: op }))
    },
    {
      id: 'fabric',
      name: 'Fabric',
      multi: true,
      options: Array.from(new Set(cards.map(c => c.fabric).filter(Boolean))).sort().map(f => ({ value: f, label: f }))
    },
    {
      id: 'party',
      name: 'Party / Customer',
      multi: true,
      options: Array.from(new Set(cards.map(c => c.party).filter(Boolean))).sort().map(p => ({ value: p, label: p }))
    }
  ], [uniqueMachines, uniqueOperators, cards]);

  // Paginated Chunking / Infinite Accumulation for INP < 100ms
  const paginatedCards = useMemo(() => {
    if (pageSize === 'all') return filteredCards;
    return filteredCards.slice(0, visibleCount);
  }, [filteredCards, visibleCount, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / (pageSize === 'all' ? Math.max(1, filteredCards.length) : (typeof pageSize === 'number' ? pageSize : 25))));
  const currentPage = Math.min(totalPages, Math.max(1, Math.ceil(paginatedCards.length / (pageSize === 'all' ? Math.max(1, filteredCards.length) : (typeof pageSize === 'number' ? pageSize : 25)))));

  const handleLoadMore = useCallback(() => {
    if (paginatedCards.length >= filteredCards.length || loadingMore) return;
    setLoadingMore(true);
    setTimeout(() => {
      setVisibleCount(v => Math.min(filteredCards.length, v + (typeof pageSize === 'number' ? pageSize : 25)));
      setLoadingMore(false);
    }, 120);
  }, [paginatedCards.length, filteredCards.length, loadingMore, pageSize]);

  // Auto-reset visible chunk when filters or search change
  useEffect(() => {
    setVisibleCount(pageSize === 'all' ? filteredCards.length : (typeof pageSize === 'number' ? pageSize : 25));
  }, [debouncedSearch, statusFilter, filterMachine, filterOperator, activeDateRange, pageSize]);

  // Statistics calculation
  const stats = useMemo(() => {
    let totalFreshMtr = 0;
    let totalWastageMtr = 0;
    let totalButterPaperKg = 0;
    let pendingCount = 0;
    let doneCount = 0;
    let readyForFusingCount = 0;
    const todayStr = toLocalYMD();
    let todayFreshMtr = 0;
    const pannaButterKgMap = {};

    cards.forEach(c => {
      const pStatus = String(c.printStatus || c.status || '').toLowerCase();
      const isPrintDone = pStatus === 'printing done' || pStatus === 'printed' || (pStatus.includes('done') && !pStatus.includes('pending'));
      const fStatus = String(c.fusingStatus || 'fusing pending').toLowerCase();
      const isDone = fStatus === 'fusing done' || fStatus === 'fused' || fStatus === 'done' || c.fusingStatus === 'Fusing Done';

      if (isPrintDone && !isDone) {
        readyForFusingCount++;
      }
      if (isDone) {
        doneCount++;
        const fresh = parseFloat(c.freshMtr || c.fusingMtr) || 0;
        const waste = parseFloat(c.totalWastageMtr) || 0;
        const butterKg = parseFloat(c.butterPaperWeightKg) || 0;
        totalFreshMtr += fresh;
        totalWastageMtr += waste;
        totalButterPaperKg += butterKg;

        const cardPanna = c.panna ? (String(c.panna).includes('"') ? String(c.panna) : `${c.panna}"`) : 'General';
        pannaButterKgMap[cardPanna] = (pannaButterKgMap[cardPanna] || 0) + butterKg;

        if (c.fusingDate === todayStr) {
          todayFreshMtr += fresh;
        }
      } else {
        pendingCount++;
      }
    });

    // Calculate Raw Material Butter Paper INWARD vs OUTWARD
    let butterPaperInwardKg = 0;
    let butterPaperRawOutwardKg = 0;

    rawMatTxns.forEach(t => {
      const name = (t.materialName || '').toLowerCase();
      if (name.includes('butter') || name.includes('paper')) {
        const qty = parseFloat(t.qty) || 0;
        if (t.type === 'INWARD') {
          butterPaperInwardKg += qty;
        } else if (t.type === 'OUTWARD') {
          butterPaperRawOutwardKg += qty;
        }
      }
    });

    const butterPaperOutwardKg = Math.max(totalButterPaperKg, butterPaperRawOutwardKg);
    const butterPaperBalanceKg = butterPaperInwardKg - butterPaperOutwardKg;
    const yieldRatio = totalButterPaperKg > 0 ? (totalFreshMtr / totalButterPaperKg).toFixed(1) : '—';

    return {
      totalFreshMtr,
      totalWastageMtr,
      totalButterPaperKg,
      butterPaperInwardKg,
      butterPaperOutwardKg,
      butterPaperBalanceKg,
      pannaButterKgMap,
      pendingCount,
      doneCount,
      readyForFusingCount,
      yieldRatio,
      todayFreshMtr
    };
  }, [cards, rawMatTxns]);

  // Export CSV
  const handleExportCSV = () => {
    if (!filteredCards.length) {
      triggerEliteAlert('No records available to export.');
      return;
    }

    const headers = [
      'Job No', 'Date', 'Shift', 'Party Name', 'Design Name', 'Fabric', 'Panna',
      'Printed Mtr', 'Fresh Mtr', 'Yield %', 'Total Wastage (m)', 'Fabric Fault (m)',
      'Fusing Fault (m)', 'Print Fault (m)', 'Genuine Fault (m)', 'Butter Paper (kg)',
      'Speed (m/min)', 'Temp (°C)', 'Status', 'Machine', 'Operator'
    ];
    
    const rows = filteredCards.map(c => {
      const printed = parseFloat(getCardPrintedMeters(c)) || 0;
      const waste = parseFloat(c.totalWastageMtr) || 0;
      const rawFresh = c.freshMtr !== undefined && c.freshMtr !== '' 
        ? parseFloat(c.freshMtr) 
        : (parseFloat(c.fusingMtr) ? Math.max(0, parseFloat(c.fusingMtr) - waste) : 0);
      const fresh = isNaN(rawFresh) ? 0 : rawFresh;
      const yieldPct = printed > 0 && fresh > 0 ? ((fresh / printed) * 100).toFixed(1) : (fresh + waste > 0 ? ((fresh / (fresh + waste)) * 100).toFixed(1) : '—');
      const preset = getFabricFusingPreset(c.fabric);

      return [
        c.jobNo || '',
        c.fusingDate || c.date || '',
        c.shift || 'Morning',
        `"${(c.party || c.clientName || '').replace(/"/g, '""')}"`,
        `"${(c.designName || c.designNo || '').replace(/"/g, '""')}"`,
        `"${(c.fabric || '').replace(/"/g, '""')}"`,
        c.panna || '',
        printed,
        fresh,
        yieldPct,
        waste,
        c.fabricFaultMtr || 0,
        c.fusingFaultMtr || 0,
        c.printFaultMtr || 0,
        c.genuineFaultMtr || 0,
        c.butterPaperWeightKg || 0,
        c.fusingSpeed || preset.speed,
        c.fusingTemp || preset.temp,
        c.fusingStatus || 'Pending',
        `"${(c.fusingMachine || '').replace(/"/g, '""')}"`,
        `"${(c.fusingOperator || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Fusing_Department_Production_Report_${toLocalYMD()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerPushNotification('📥 Report Downloaded', 'Fusing production report exported to CSV successfully.', 'success');
  };

  return (
    <div className="fusing-module-container">

      {/* ── FACTORY NETWORK RESILIENCE BANNER ── */}
      {!isOnline && (
        <div className="fusing-network-banner" role="alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} />
            <span>Factory Low-Network / Offline Mode: Displaying cached local fusing records.</span>
          </div>
          <button
            type="button"
            className="fusing-network-retry-btn"
            onClick={fetchData}
            aria-label="Retry network connection and sync data"
          >
            <RefreshCw size={14} /> Retry Connection
          </button>
        </div>
      )}

      {/* ── TIER 1: UNIFIED GLASS SCREEN HEADER (Rule 5 & Rule 3 Blueprint) ── */}
      <div className="glass-screen-header">
        <div className="glass-title-capsule">
          <div className="glass-title-icon">
            <Flame size={16} color="#fff" />
          </div>
          <span className="glass-screen-title">Fusing Department</span>
          <EntityBrandBadge entityId="digital_print" />
        </div>

        {/* Quick Action Menu */}
        <div className="ent-header-actions">
          <QuickActionMenu
            buttonText="+ Quick Action"
            items={[
              {
                id: 'new_entry',
                icon: PlusCircle,
                label: 'New Fusing Entry',
                subtitle: 'Record batch or single job heat press log',
                iconColor: '#38bdf8',
                iconBg: 'rgba(56, 189, 248, 0.16)',
                action: () => {
                  setActiveFusingTab('entry');
                  setIsFormExpanded(true);
                }
              },
              {
                id: 'inward_butter',
                icon: Layers,
                label: 'Inward Butter Paper',
                subtitle: 'Log raw roll weight and shipment details',
                iconColor: '#34d399',
                iconBg: 'rgba(52, 211, 153, 0.16)',
                action: () => setShowButterPaperInwardModal(true)
              },
              {
                id: 'report',
                icon: Zap,
                label: 'Fusing Analytics Report',
                subtitle: 'Shift yield and plant utilization stats',
                iconColor: '#fbbf24',
                iconBg: 'rgba(251, 191, 36, 0.16)',
                action: () => setShowReportModal(true)
              },
              {
                id: 'export',
                icon: Download,
                label: 'Export CSV',
                subtitle: 'Download complete dataset to spreadsheet',
                iconColor: '#c084fc',
                iconBg: 'rgba(192, 132, 252, 0.16)',
                action: handleExportCSV
              },
              {
                id: 'refresh',
                icon: RefreshCw,
                label: 'Refresh Records',
                subtitle: 'Synchronize production database in real time',
                iconColor: '#38bdf8',
                iconBg: 'rgba(56, 189, 248, 0.16)',
                action: fetchData
              }
            ]}
          />
        </div>
      </div>

      {/* ── TIER 2: SUB-SCREEN NAVIGATION BUTTONS ── */}
      <div className="glass-subtabs-bar" role="tablist" style={{ marginBottom: '0.85rem' }}>
        {[
          { id: 'queue', label: 'Ready Queue', count: eligibleFusingCards.length, icon: Clock },
          { id: 'runs', label: 'Fusing Runs History', count: fusingLogs.length, icon: Zap },
          { id: 'entry', label: 'New Fusing Entry', icon: Flame }
        ].map(t => {
          const isActive = activeFusingTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`glass-subtab-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveFusingTab(t.id)}
            >
              <t.icon size={13} style={{ marginRight: 5 }} />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span style={{ marginLeft: 5, opacity: 0.85, fontSize: '0.72rem' }}>
                  ({t.count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── TIER 3: SIDE SCROLLING CALCULATION / KPI CARDS TRACK ── */}
      <div className="glass-scroll-track" style={{ marginBottom: '1rem', display: 'flex', gap: '0.85rem', overflowX: 'auto', paddingBottom: '6px' }}>
        <div className="ent-stat-card" style={{
          minWidth: '220px', flex: '0 0 auto',
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderLeft: '4px solid #38bdf8',
          borderRadius: 10, padding: '0.9rem 1rem',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
          backdropFilter: 'blur(12px)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.72)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Fused Fresh</span>
            <span style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', fontSize: '0.75rem' }}>🔥</span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', marginTop: 4 }}>
            {stats.totalFreshMtr.toLocaleString('en-IN')} <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#38bdf8' }}>Mtr</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: 4, fontWeight: 700 }}>
            {stats.todayFreshMtr > 0 ? `${stats.todayFreshMtr} Mtr fused today` : 'Factory heat-press yield'}
          </div>
        </div>

        <div className="ent-stat-card" style={{
          minWidth: '220px', flex: '0 0 auto',
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderLeft: '4px solid #34d399',
          borderRadius: 10, padding: '0.9rem 1rem',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
          backdropFilter: 'blur(12px)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.72)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Completed Jobs</span>
            <span style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(52, 211, 153, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399', fontSize: '0.75rem' }}>✓</span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#34d399', marginTop: 4 }}>
            {stats.doneCount} <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#34d399' }}>cards</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#34d399', marginTop: 4, fontWeight: 700 }}>
            Fusing batch completed
          </div>
        </div>

        <div className="ent-stat-card" style={{
          minWidth: '220px', flex: '0 0 auto',
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderLeft: '4px solid #fbbf24',
          borderRadius: 10, padding: '0.9rem 1rem',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
          backdropFilter: 'blur(12px)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.72)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ready for Fusing</span>
            <span style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(251, 191, 36, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24', fontSize: '0.75rem' }}>⏳</span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fbbf24', marginTop: 4 }}>
            {stats.readyForFusingCount} <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#fbbf24' }}>cards</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#fbbf24', marginTop: 4, fontWeight: 700 }}>
            Printed &amp; awaiting press
          </div>
        </div>

        <div className="ent-stat-card" style={{
          minWidth: '220px', flex: '0 0 auto',
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderLeft: '4px solid #2dd4bf',
          borderRadius: 10, padding: '0.9rem 1rem',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
          backdropFilter: 'blur(12px)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.72)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Paper Yield Ratio</span>
            <span style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(45, 212, 191, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2dd4bf', fontSize: '0.75rem' }}>⚡</span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#2dd4bf', marginTop: 4 }}>
            {stats.yieldRatio || '14.2'} <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#2dd4bf' }}>m/kg</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#2dd4bf', marginTop: 4, fontWeight: 700 }}>
            Optimal sublimation efficiency
          </div>
        </div>

        <div className="ent-stat-card" style={{
          minWidth: '220px', flex: '0 0 auto',
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderLeft: '4px solid #f87171',
          borderRadius: 10, padding: '0.9rem 1rem',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
          backdropFilter: 'blur(12px)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.72)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Plant Wastage Loss</span>
            <span style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(248, 113, 113, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontSize: '0.75rem' }}>🚨</span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f87171', marginTop: 4 }}>
            {stats.totalWastageMtr.toLocaleString('en-IN')} <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#f87171' }}>Mtr</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: stats.totalWastageMtr > 0 ? '#f87171' : '#34d399', marginTop: 4, fontWeight: 700 }}>
            {stats.totalWastageMtr > 0 ? `${((stats.totalWastageMtr / (stats.totalFreshMtr + stats.totalWastageMtr || 1)) * 100).toFixed(1)}% plant loss` : '✓ Zero wastage recorded'}
          </div>
        </div>
      </div>

      {/* ── TAB 1: PRODUCTION ENTRY & LOGS ── */}
      {activeFusingTab === 'entry' && (
      <>
      {/* ── TOP SECTION: NEW FUSING ENTRY FORM CARD (Dark Frosted Glass) ── */}
      <div className="glass-panel fusing-entry-card">
        {/* Form Card Header */}
        <div className="fusing-entry-header-row" style={{ marginBottom: isFormExpanded ? '1rem' : '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: topForm.logId ? 'rgba(245, 158, 11, 0.18)' : 'rgba(56, 189, 248, 0.18)',
              border: `1px solid ${topForm.logId ? 'rgba(245, 158, 11, 0.4)' : 'rgba(56, 189, 248, 0.4)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: topForm.logId ? '#fbbf24' : '#38bdf8'
            }}>
              {topForm.logId ? <Edit2 size={16} /> : <PlusCircle size={18} />}
            </div>
            <h3 style={{
              fontSize: '1rem', fontWeight: 900,
              color: topForm.logId ? '#fbbf24' : '#38bdf8',
              margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em'
            }}>
              {topForm.logId ? `EDIT FUSING RUN #${String(topForm.logId).slice(-6)}` : 'NEW FUSING ENTRY'}
            </h3>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {topForm.logId && (
              <button
                type="button"
                onClick={() => {
                  setTopForm(prev => ({ ...prev, logId: null }));
                  triggerPushNotification('Switched to New Entry', 'Now in New Entry mode.', 'info');
                }}
                style={{
                  background: 'rgba(245, 158, 11, 0.16)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  color: '#fbbf24',
                  borderRadius: '6px',
                  padding: '5px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                ✕ Switch to New Entry
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsFormExpanded(prev => !prev)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '0.78rem',
                fontWeight: 800,
                color: '#38bdf8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {isFormExpanded ? (
                <>
                  <ChevronUp size={15} /> Minimize Form
                </>
              ) : (
                <>
                  <ChevronDown size={15} /> Expand Entry Form
                </>
              )}
            </button>
          </div>
        </div>

        {!isFormExpanded ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(11, 17, 32, 0.65)',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            border: '1px dashed rgba(255, 255, 255, 0.22)'
          }}>
            <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 700 }}>
              {topForm.jobCardId ? `Active Selection: ${formatJobCardNo(topForm.jobNo)} (${topForm.printedMtr || 0} mtr)` : 'Fusing Entry Form is minimized.'}
            </span>
            <button
              type="button"
              onClick={() => setIsFormExpanded(true)}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '0.35rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              ⚡ Expand Form
            </button>
          </div>
        ) : (
          <form onSubmit={handleTopFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', boxSizing: 'border-box' }}>
          
          {/* Row 1: DATE, SHIFT, ON TIME, OFF TIME */}
          <div className="fusing-entry-row-time">
            <div className="fusing-field-col">
              <label className="fusing-field-label" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                DATE *
              </label>
              <input
                type="date"
                required
                value={topForm.date}
                onChange={e => setTopForm(f => ({ ...f, date: e.target.value }))}
                className="fusing-field-input"
              />
            </div>

            <div className="fusing-field-col">
              <label className="fusing-field-label" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                SHIFT *
              </label>
              <select
                required
                value={topForm.shift}
                onChange={e => setTopForm(f => ({ ...f, shift: e.target.value }))}
                className="fusing-field-input"
                style={{ cursor: 'pointer' }}
              >
                <option value="Morning">Morning</option>
                <option value="Night">Night</option>
              </select>
            </div>

            <div className="fusing-field-col">
              <label className="fusing-field-label" style={{ color: '#34d399' }}>
                <Clock size={13} color="#34d399" /> START TIME
              </label>
              <input
                type="time"
                value={topForm.onTime}
                onChange={e => setTopForm(f => ({ ...f, onTime: e.target.value }))}
                className="fusing-field-input"
              />
            </div>

            <div className="fusing-field-col">
              <label className="fusing-field-label" style={{ color: '#f87171' }}>
                <Clock size={13} color="#f87171" /> END TIME
              </label>
              <input
                type="time"
                value={topForm.offTime}
                onChange={e => setTopForm(f => ({ ...f, offTime: e.target.value }))}
                className="fusing-field-input"
              />
            </div>
          </div>

          {/* Primary Required Fields: JOB CARD NO, PRINTED METERS, WASTAGE MATRIX, FRESH OUTPUT, FUSING TEMP, SPEED, BUTTER PAPER, PANNA */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              background: 'rgba(11, 17, 32, 0.65)',
              padding: '1.15rem 1.25rem',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              
              {/* TIER 1: Job Card Selection, Printed Meters & Fresh Fused Output */}
              <div className="fusing-entry-tier1">
                {/* 1. JOB TYPE / JOBCARD NO. - Searchable & Filtered to Printing Done & Fusing Pending */}
                <div ref={jobDropdownRef} className="fusing-field-col" style={{ position: 'relative' }}>
                  <div className="fusing-field-label-between">
                    <label className="fusing-field-label" style={{ color: '#38bdf8', margin: 0 }}>
                      JOB TYPE / JOBCARD NO. *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAllCardsFilter(prev => !prev)}
                      style={{
                        background: showAllCardsFilter ? 'rgba(56, 189, 248, 0.16)' : 'rgba(16, 185, 129, 0.16)',
                        color: showAllCardsFilter ? '#38bdf8' : '#34d399',
                        border: `1px solid ${showAllCardsFilter ? 'rgba(56, 189, 248, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Toggle between only Ready for Fusing jobs vs All Job Cards"
                    >
                      <span>{showAllCardsFilter ? '🔍 Showing All Cards' : `⚡ Ready Queue (${eligibleFusingCards.length})`}</span>
                      <span style={{ textDecoration: 'underline', opacity: 0.85 }}>({showAllCardsFilter ? 'Show Ready' : 'Show All'})</span>
                    </button>
                  </div>

                  {/* Search Input Box with Clear & Dropdown Caret */}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={16} color="#38bdf8" style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      required
                      placeholder="Search Job No, Party, Design..."
                      value={jobSearchText}
                      onFocus={() => setShowJobDropdown(true)}
                      onChange={e => {
                        setJobSearchText(e.target.value);
                        setShowJobDropdown(true);
                        if (!e.target.value) {
                          handleTopJobCardSelect('');
                        }
                      }}
                      className="fusing-field-input"
                      style={{
                        paddingLeft: '2.2rem',
                        paddingRight: '2.8rem',
                        border: '1.5px solid #38bdf8',
                        color: '#ffffff',
                        fontWeight: 800
                      }}
                    />
                    {/* Clear / Dropdown Toggle Button */}
                    <div style={{ position: 'absolute', right: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {topForm.jobCardId ? (
                        <button
                          type="button"
                          onClick={() => {
                            handleTopJobCardSelect('');
                            setJobSearchText('');
                            setShowJobDropdown(true);
                          }}
                          style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#f87171',
                            border: 'none',
                            borderRadius: '4px',
                            width: '22px',
                            height: '22px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontWeight: 900,
                            fontSize: '0.75rem'
                          }}
                          title="Clear Selection"
                        >
                          ✕
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setShowJobDropdown(prev => !prev)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#38bdf8',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Open List"
                      >
                        <ChevronDown size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Floating Interactive Dropdown Menu */}
                  {showJobDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      maxHeight: '280px',
                      overflowY: 'auto',
                      background: 'rgba(11, 17, 32, 0.96)',
                      backdropFilter: 'blur(24px)',
                      border: '1.5px solid #38bdf8',
                      borderRadius: '10px',
                      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)',
                      zIndex: 1000,
                      marginTop: '4px'
                    }}>
                      <div style={{
                        padding: '6px 12px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        color: 'rgba(255, 255, 255, 0.75)',
                        background: 'rgba(15, 23, 42, 0.95)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>
                          {showAllCardsFilter ? 'ALL JOBCARDS' : 'PRINTING DONE & FUSING PENDING'} ({searchMatchingCards.length})
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {serverSearching ? <span style={{ color: '#facc15' }}>⚡ Searching server...</span> : 'Click card to select'}
                        </span>
                      </div>

                      {searchMatchingCards.length === 0 ? (
                        <div style={{ padding: '1.25rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem' }}>
                          <p style={{ margin: 0, fontWeight: 700 }}>No matching job cards found.</p>
                          {!showAllCardsFilter && (
                            <button
                              type="button"
                              onClick={() => setShowAllCardsFilter(true)}
                              style={{
                                marginTop: '0.5rem',
                                background: 'rgba(56, 189, 248, 0.16)',
                                color: '#38bdf8',
                                border: '1px solid rgba(56, 189, 248, 0.35)',
                                borderRadius: '6px',
                                padding: '0.3rem 0.75rem',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                cursor: 'pointer'
                              }}
                            >
                              Click to Search All Job Cards
                            </button>
                          )}
                        </div>
                      ) : (
                        searchMatchingCards.map(c => {
                          const isSelected = String(topForm.jobCardId) === String(c._id || c.id);
                          const cardPanna = c.panna ? (String(c.panna).includes('"') ? c.panna : `${c.panna}"`) : '58"';
                          return (
                            <div
                              key={c._id || c.id}
                              onMouseDown={() => {
                                handleTopJobCardSelect(c);
                                setShowJobDropdown(false);
                              }}
                              style={{
                                padding: '8px 12px',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                                transition: 'background 0.15s ease'
                              }}
                              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
                              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                            >
                              <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                  <span style={{ fontWeight: 900, color: '#38bdf8', fontSize: '0.9rem' }}>
                                    {formatJobCardNo(c.jobNo)}
                                  </span>
                                  <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.85rem' }}>
                                    {c.party || 'Party'}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.72)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  Design: <strong style={{ color: '#ffffff' }}>{c.designName || '—'}</strong> • Fabric: <strong>{c.fabric || '—'} ({cardPanna})</strong>
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
                                <span style={{
                                  padding: '1px 7px',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  background: 'rgba(16, 185, 129, 0.18)',
                                  color: '#34d399',
                                  border: '1px solid rgba(16, 185, 129, 0.35)'
                                }}>
                                  🖨️ {getCardPrintedMeters(c) || 0}m Printed
                                </span>
                                <span style={{
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  background: c.fusingStatus === 'Fusing Done' ? 'rgba(255, 255, 255, 0.1)' : (c.fusingStatus === 'Fusing In Progress' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(245, 158, 11, 0.18)'),
                                  color: c.fusingStatus === 'Fusing Done' ? 'rgba(255, 255, 255, 0.7)' : (c.fusingStatus === 'Fusing In Progress' ? '#38bdf8' : '#fbbf24')
                                }}>
                                  {c.fusingStatus === 'Fusing Done' ? '✓ Complete' : (c.fusingStatus === 'Fusing In Progress' ? '⏳ Partial' : '⏸️ Pending')}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* 2. PRINTED METERS (DISPLAYED REFERENCE) */}
                <div className="fusing-field-col">
                  <label className="fusing-field-label" style={{ color: '#38bdf8' }}>
                    🖨️ PRINTED METERS
                  </label>
                  <div className="fusing-field-input" style={{
                    border: '1.5px solid rgba(56, 189, 248, 0.35)',
                    background: 'rgba(56, 189, 248, 0.12)',
                    color: '#38bdf8',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span>{topForm.printedMtr ? `${topForm.printedMtr} mtr` : <span style={{ color: 'rgba(255, 255, 255, 0.55)', fontSize: '0.82rem', fontWeight: 600 }}>Select Job Card</span>}</span>
                    {topForm.printedMtr && (
                      <span style={{ fontSize: '0.68rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.18)', padding: '1px 6px', borderRadius: '4px' }}>
                        Base Roll
                      </span>
                    )}
                  </div>
                </div>

                {/* 3. FRESH FUSED OUTPUT (MTR) — Auto-Calculated as (Printed - Total Wastage) & Editable */}
                <div className="fusing-field-col">
                  <div className="fusing-field-label-between">
                    <label className="fusing-field-label" style={{ color: '#34d399', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={13} color="#34d399" /> FRESH FUSED (MTR) *
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setShowAiModal(true)}
                        title="Calculate expected fresh meters using AI fabric shrinkage"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          background: 'rgba(56, 189, 248, 0.16)',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          color: '#38bdf8',
                          borderRadius: '4px',
                          padding: '2px 7px',
                          fontSize: '0.67rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <Sparkles size={11} /> AI Yield
                      </button>
                      {parseFloat(topForm.printedMtr) > 0 && (
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#34d399', background: 'rgba(16, 185, 129, 0.18)', padding: '1px 6px', borderRadius: '4px' }}>
                          {(((parseFloat(topForm.freshMtr) || 0) / parseFloat(topForm.printedMtr)) * 100).toFixed(0)}% yield
                        </span>
                      )}
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    required
                    placeholder="Fresh mtr..."
                    value={topForm.freshMtr}
                    onChange={e => handleFreshMtrChange(e.target.value)}
                    onBlur={e => handleFreshMtrBlur(e.target.value)}
                    className="fusing-field-input"
                    style={{
                      border: '1.5px solid #34d399',
                      background: 'rgba(16, 185, 129, 0.12)',
                      color: '#34d399',
                      fontWeight: 900,
                      fontSize: '0.95rem'
                    }}
                  />
                  <div style={{ fontSize: '0.64rem', color: '#34d399', marginTop: '3px', fontWeight: 700 }}>
                    Accepted decimals: .00, .25, .50, .75 only
                  </div>
                </div>
              </div>

              {/* TIER 1.5: DEDICATED WASTAGE BREAKDOWN MATRIX (ALL 4 FAULT TYPES) */}
              <div className="fusing-wastage-matrix">
                {/* Wastage Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(244, 63, 94, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
                      <Trash2 size={16} />
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Wastage Breakdown</span>
                      <span style={{ fontSize: '0.7rem', color: '#f87171', background: 'rgba(244, 63, 94, 0.18)', border: '1px solid rgba(244, 63, 94, 0.35)', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>4 Fault Categories</span>
                    </div>
                  </div>

                  {/* Badges & Reset Button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{
                      background: parseFloat(totalTopWastageMtr) > 0 ? 'rgba(239, 68, 68, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                      border: `1px solid ${parseFloat(totalTopWastageMtr) > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.16)'}`,
                      borderRadius: '8px',
                      padding: '4px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.75)', textTransform: 'uppercase' }}>Total Wastage:</span>
                      <strong style={{ fontSize: '0.9rem', color: parseFloat(totalTopWastageMtr) > 0 ? '#f87171' : '#ffffff' }}>
                        {totalTopWastageMtr} mtr
                      </strong>
                    </div>

                    {parseFloat(totalTopWastageMtr) > 0 && (
                      <button
                        type="button"
                        onClick={handleResetWastage}
                        style={{
                          background: 'rgba(244, 63, 94, 0.18)',
                          border: '1px solid rgba(244, 63, 94, 0.4)',
                          color: '#f87171',
                          borderRadius: '6px',
                          padding: '4px 9px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Reset all wastage categories to 0m"
                      >
                        <RefreshCw size={11} /> Reset to 0
                      </button>
                    )}
                  </div>
                </div>

                {/* 4 Wastage Inputs Grid */}
                <div className="fusing-wastage-grid">
                  {/* 1. Fabric Fault (Mtr) */}
                  <div className="fusing-wastage-card" style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.32)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#f87171' }}>
                        🧵 1. Fabric Fault
                      </span>
                      <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                        {['0', '0.25', '0.5', '0.75', '1', '2', '5'].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleFaultChange('fabricFaultMtr', val)}
                            style={{
                              background: String(topForm.fabricFaultMtr) === val ? 'rgba(239, 68, 68, 0.35)' : 'rgba(255, 255, 255, 0.08)',
                              border: `1px solid ${String(topForm.fabricFaultMtr) === val ? '#f87171' : 'rgba(255, 255, 255, 0.18)'}`,
                              borderRadius: '3px',
                              padding: '0 3px',
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              color: '#ffffff',
                              cursor: 'pointer'
                            }}
                          >
                            {val === '0.25' ? '.25' : val === '0.5' ? '.50' : val === '0.75' ? '.75' : (val === '0' ? '0m' : `${val}m`)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      placeholder="0.00"
                      value={topForm.fabricFaultMtr}
                      onChange={e => handleFaultChange('fabricFaultMtr', e.target.value)}
                      onBlur={e => handleFaultBlur('fabricFaultMtr', e.target.value)}
                      className="fusing-field-input"
                      style={{
                        height: '38px',
                        padding: '0.45rem 0.65rem',
                        border: '1.5px solid rgba(239, 68, 68, 0.45)',
                        fontSize: '0.92rem',
                        fontWeight: 900,
                        color: '#ffffff'
                      }}
                    />
                  </div>

                  {/* 2. Fusing Fault (Mtr) */}
                  <div className="fusing-wastage-card" style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.32)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#fbbf24' }}>
                        🔥 2. Fusing Fault
                      </span>
                      <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                        {['0', '0.25', '0.5', '0.75', '1', '2', '5'].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleFaultChange('fusingFaultMtr', val)}
                            style={{
                              background: String(topForm.fusingFaultMtr) === val ? 'rgba(245, 158, 11, 0.35)' : 'rgba(255, 255, 255, 0.08)',
                              border: `1px solid ${String(topForm.fusingFaultMtr) === val ? '#fbbf24' : 'rgba(255, 255, 255, 0.18)'}`,
                              borderRadius: '3px',
                              padding: '0 3px',
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              color: '#ffffff',
                              cursor: 'pointer'
                            }}
                          >
                            {val === '0.25' ? '.25' : val === '0.5' ? '.50' : val === '0.75' ? '.75' : (val === '0' ? '0m' : `${val}m`)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      placeholder="0.00"
                      value={topForm.fusingFaultMtr}
                      onChange={e => handleFaultChange('fusingFaultMtr', e.target.value)}
                      onBlur={e => handleFaultBlur('fusingFaultMtr', e.target.value)}
                      className="fusing-field-input"
                      style={{
                        height: '38px',
                        padding: '0.45rem 0.65rem',
                        border: '1.5px solid rgba(245, 158, 11, 0.45)',
                        fontSize: '0.92rem',
                        fontWeight: 900,
                        color: '#ffffff'
                      }}
                    />
                  </div>

                  {/* 3. Print Fault (Mtr) */}
                  <div className="fusing-wastage-card" style={{ background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.32)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#38bdf8' }}>
                        🖨️ 3. Print Fault
                      </span>
                      <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                        {['0', '0.25', '0.5', '0.75', '1', '2', '5'].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleFaultChange('printFaultMtr', val)}
                            style={{
                              background: String(topForm.printFaultMtr) === val ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255, 255, 255, 0.08)',
                              border: `1px solid ${String(topForm.printFaultMtr) === val ? '#38bdf8' : 'rgba(255, 255, 255, 0.18)'}`,
                              borderRadius: '3px',
                              padding: '0 3px',
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              color: '#ffffff',
                              cursor: 'pointer'
                            }}
                          >
                            {val === '0.25' ? '.25' : val === '0.5' ? '.50' : val === '0.75' ? '.75' : (val === '0' ? '0m' : `${val}m`)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      placeholder="0.00"
                      value={topForm.printFaultMtr}
                      onChange={e => handleFaultChange('printFaultMtr', e.target.value)}
                      onBlur={e => handleFaultBlur('printFaultMtr', e.target.value)}
                      className="fusing-field-input"
                      style={{
                        height: '38px',
                        padding: '0.45rem 0.65rem',
                        border: '1.5px solid rgba(56, 189, 248, 0.45)',
                        fontSize: '0.92rem',
                        fontWeight: 900,
                        color: '#ffffff'
                      }}
                    />
                  </div>

                  {/* 4. Genuine Fault / Joint (Mtr) */}
                  <div className="fusing-wastage-card" style={{ background: 'rgba(168, 85, 247, 0.12)', border: '1px solid rgba(168, 85, 247, 0.32)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#c084fc' }}>
                        ✂️ 4. Genuine / Joint
                      </span>
                      <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                        {['0', '0.25', '0.5', '0.75', '1', '2', '5'].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleFaultChange('genuineFaultMtr', val)}
                            style={{
                              background: String(topForm.genuineFaultMtr) === val ? 'rgba(168, 85, 247, 0.35)' : 'rgba(255, 255, 255, 0.08)',
                              border: `1px solid ${String(topForm.genuineFaultMtr) === val ? '#c084fc' : 'rgba(255, 255, 255, 0.18)'}`,
                              borderRadius: '3px',
                              padding: '0 3px',
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              color: '#ffffff',
                              cursor: 'pointer'
                            }}
                          >
                            {val === '0.25' ? '.25' : val === '0.5' ? '.50' : val === '0.75' ? '.75' : (val === '0' ? '0m' : `${val}m`)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      placeholder="0.00"
                      value={topForm.genuineFaultMtr}
                      onChange={e => handleFaultChange('genuineFaultMtr', e.target.value)}
                      onBlur={e => handleFaultBlur('genuineFaultMtr', e.target.value)}
                      className="fusing-field-input"
                      style={{
                        height: '38px',
                        padding: '0.45rem 0.65rem',
                        border: '1.5px solid rgba(168, 85, 247, 0.45)',
                        fontSize: '0.92rem',
                        fontWeight: 900,
                        color: '#ffffff'
                      }}
                    />
                  </div>
                </div>

                {/* Realtime Reconciliation Balance Strip */}
                {topForm.jobCardId && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                    padding: '0.55rem 0.85rem',
                    borderRadius: '8px',
                    background: 'rgba(11, 17, 32, 0.65)',
                    border: '1px dashed rgba(255, 255, 255, 0.22)',
                    fontSize: '0.78rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ color: 'rgba(255, 255, 255, 0.72)', fontWeight: 700 }}>Meter Balance:</span>
                      <span style={{ color: '#38bdf8', fontWeight: 800 }}>🖨️ {topForm.printedMtr || 0}m Printed</span>
                      <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>=</span>
                      <span style={{ color: '#34d399', fontWeight: 900 }}>✨ {topForm.freshMtr || 0}m Fresh Output</span>
                      <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>+</span>
                      <span style={{ color: '#f87171', fontWeight: 900 }}>🗑️ {totalTopWastageMtr}m Total Wastage</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {parseFloat(totalTopWastageMtr) > 0 ? (
                        <span style={{
                          color: '#f87171',
                          background: 'rgba(239, 68, 68, 0.18)',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 800,
                          fontSize: '0.72rem'
                        }}>
                          ⚠️ {(((parseFloat(totalTopWastageMtr) || 0) / (parseFloat(topForm.printedMtr) || 1)) * 100).toFixed(1)}% Wastage Loss
                        </span>
                      ) : (
                        <span style={{
                          color: '#34d399',
                          background: 'rgba(16, 185, 129, 0.18)',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 800,
                          fontSize: '0.72rem'
                        }}>
                          ✓ 100% Zero-Loss Output
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* TIER 2: Machine & Operating Parameters (Temperature, Speed, Panna, Butter Paper, Roll Completed) */}
              <div className="fusing-params-grid">
                {/* 5. FUSING TEMPERATURE */}
                <div className="fusing-field-col">
                  <label className="fusing-field-label" style={{ color: '#fbbf24' }}>
                    <Thermometer size={14} color="#fbbf24" /> FUSING TEMP (°C) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 210°C"
                    value={topForm.fusingTemp}
                    onChange={e => setTopForm(f => ({ ...f, fusingTemp: e.target.value }))}
                    className="fusing-field-input"
                    style={{ border: '1.5px solid rgba(245, 158, 11, 0.45)', color: '#fbbf24', fontWeight: 900 }}
                  />
                </div>

                {/* 6. FUSING SPEED */}
                <div className="fusing-field-col">
                  <label className="fusing-field-label" style={{ color: '#38bdf8' }}>
                    <Gauge size={14} color="#38bdf8" /> FUSING SPEED (m/min) *
                  </label>
                  <select
                    required
                    value={topForm.fusingSpeed || '80'}
                    onChange={e => setTopForm(f => ({ ...f, fusingSpeed: e.target.value }))}
                    className="fusing-field-input"
                    style={{ border: '1.5px solid rgba(56, 189, 248, 0.45)', color: '#38bdf8', cursor: 'pointer', fontWeight: 900 }}
                  >
                    {topForm.fusingSpeed && !FUSING_SPEED_OPTIONS.map(String).includes(String(topForm.fusingSpeed).replace(/[^0-9]/g, '')) && (
                      <option value={topForm.fusingSpeed}>{topForm.fusingSpeed}</option>
                    )}
                    {FUSING_SPEED_OPTIONS.map(spd => (
                      <option key={spd} value={String(spd)}>
                        {spd}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 7. PANNA */}
                <div className="fusing-field-col">
                  <div className="fusing-field-label-between">
                    <label className="fusing-field-label" style={{ color: '#38bdf8', margin: 0 }}>
                      <Layers size={14} color="#38bdf8" /> PANNA *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPannaManagerModal(true)}
                      style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.7rem', fontWeight: 800 }}
                    >
                      <Settings size={12} /> Edit
                    </button>
                  </div>
                  <select
                    required
                    value={topForm.panna}
                    onChange={e => setTopForm(f => ({ ...f, panna: e.target.value }))}
                    className="fusing-field-input"
                    style={{ cursor: 'pointer', fontWeight: 800 }}
                  >
                    {pannaOptions.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* 8. BUTTER PAPER USED? */}
                <div className="fusing-field-col">
                  <label className="fusing-field-label" style={{ color: topForm.useButterPaper === 'Yes' ? '#c084fc' : 'rgba(255, 255, 255, 0.7)' }}>
                    <Scale size={14} color={topForm.useButterPaper === 'Yes' ? '#c084fc' : '#94a3b8'} /> BUTTER PAPER USED? *
                  </label>
                  <select
                    value={topForm.useButterPaper}
                    onChange={e => {
                      const val = e.target.value;
                      setTopForm(f => ({
                        ...f,
                        useButterPaper: val,
                        butterPaperWeightKg: val === 'No' ? '0' : f.butterPaperWeightKg
                      }));
                    }}
                    className="fusing-field-input"
                    style={{
                      border: `1.5px solid ${topForm.useButterPaper === 'Yes' ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255, 255, 255, 0.18)'}`,
                      color: topForm.useButterPaper === 'Yes' ? '#c084fc' : '#ffffff',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    <option value="Yes">✓ Yes</option>
                    <option value="No">✕ No</option>
                  </select>
                </div>

                {/* 9. BUTTER PAPER WEIGHT (KG) - Shown when Yes */}
                {topForm.useButterPaper === 'Yes' ? (
                  <div className="fusing-field-col">
                    <label className="fusing-field-label" style={{ color: '#c084fc' }}>
                      <Scale size={14} color="#c084fc" /> BUTTER PAPER (KG)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="Weight kg..."
                      value={topForm.butterPaperWeightKg}
                      onChange={e => setTopForm(f => ({ ...f, butterPaperWeightKg: e.target.value }))}
                      className="fusing-field-input"
                      style={{
                        border: '1.5px solid rgba(168, 85, 247, 0.5)',
                        color: '#c084fc',
                        fontWeight: 800
                      }}
                    />
                  </div>
                ) : null}

                {/* 10. ROLL COMPLETED? */}
                <div className="fusing-field-col">
                  <label className="fusing-field-label" style={{
                    color: (topForm.rollCompleted === 'Complete' || topForm.rollCompleted === 'Yes') ? '#34d399' : (topForm.rollCompleted === 'Partial Complete' ? '#38bdf8' : '#fbbf24')
                  }}>
                    {(topForm.rollCompleted === 'Complete' || topForm.rollCompleted === 'Yes') ? (
                      <CheckCircle2 size={14} color="#34d399" />
                    ) : topForm.rollCompleted === 'Partial Complete' ? (
                      <Clock size={14} color="#38bdf8" />
                    ) : (
                      <AlertCircle size={14} color="#fbbf24" />
                    )}
                    ROLL COMPLETED? *
                  </label>
                  <select
                    value={topForm.rollCompleted === 'Yes' ? 'Complete' : (topForm.rollCompleted === 'No' ? 'Partial Complete' : (topForm.rollCompleted || 'Complete'))}
                    onChange={e => setTopForm(f => ({ ...f, rollCompleted: e.target.value }))}
                    className="fusing-field-input"
                    style={{
                      border: `1.5px solid ${
                        (topForm.rollCompleted === 'Complete' || topForm.rollCompleted === 'Yes') ? '#34d399' : (topForm.rollCompleted === 'Partial Complete' ? '#38bdf8' : '#fbbf24')
                      }`,
                      color: (topForm.rollCompleted === 'Complete' || topForm.rollCompleted === 'Yes') ? '#34d399' : (topForm.rollCompleted === 'Partial Complete' ? '#38bdf8' : '#fbbf24'),
                      cursor: 'pointer',
                      fontWeight: 800
                    }}
                  >
                    <option value="Complete">✓ Complete</option>
                    <option value="Partial Complete">⏳ Partial Complete</option>
                    <option value="Pending">⏸️ Pending</option>
                  </select>
                </div>
              </div>

              {/* Smart Heat & Speed Guard Indicator Banner */}
              {activeFabricPreset && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                  padding: '0.6rem 0.95rem',
                  borderRadius: '8px',
                  background: isHeatWarning ? 'rgba(239, 68, 68, 0.16)' : 'rgba(16, 185, 129, 0.14)',
                  border: `1.5px solid ${isHeatWarning ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.38)'}`,
                  fontSize: '0.82rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Thermometer size={16} color={isHeatWarning ? '#f87171' : '#34d399'} />
                    <span style={{ color: isHeatWarning ? '#f87171' : '#34d399', fontWeight: 800 }}>
                      {activeSelectedCard?.fabric || 'Fabric'} Thermal Guard: Recommended {activeFabricPreset.temp} @ {activeFabricPreset.speed} m/min ({activeFabricPreset.note})
                    </span>
                  </div>
                  {isHeatWarning ? (
                    <span style={{ color: '#f87171', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}>
                      <AlertTriangle size={15} /> ⚠️ High Temperature Warning! Delicate fabric risk.
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setTopForm(f => ({
                          ...f,
                          fusingTemp: activeFabricPreset.temp,
                          fusingSpeed: activeFabricPreset.speed
                        }));
                      }}
                      style={{
                        background: 'rgba(16, 185, 129, 0.2)',
                        color: '#34d399',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        padding: '3px 10px',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      ⚡ Auto-Sync Preset
                    </button>
                  )}
                </div>
              )}
            </div>

          {/* Row 3: OPERATOR NAME, REMARKS / NOTES */}
          <div className="fusing-remarks-grid">
            <div className="fusing-field-col">
              <label className="fusing-field-label" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                OPERATOR NAME *
              </label>
              <input
                type="text"
                required
                value={topForm.fusingOperator}
                onChange={e => setTopForm(f => ({ ...f, fusingOperator: e.target.value }))}
                placeholder="Operator Name..."
                className="fusing-field-input"
              />
            </div>

            <div className="fusing-field-col">
              <label className="fusing-field-label" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                REMARKS / NOTES
              </label>
              <input
                type="text"
                value={topForm.notes}
                onChange={e => setTopForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes e.g. Butter Paper Roll #2..."
                className="fusing-field-input"
                style={{ fontWeight: 500 }}
              />
              <div className="fusing-chips-tray">
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.65)', textTransform: 'uppercase' }}>Quick Tag:</span>
                {['Heat Crease', 'Fabric Shrinkage', 'Paper Jam', 'Color Bleed', 'Roller Mark'].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setTopForm(f => ({ ...f, notes: f.notes ? `${f.notes}, [${tag}]` : `[${tag}]` }))}
                    className="fusing-chip-btn"
                  >
                    +{tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Submit Action Button */}
          <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="submit"
              disabled={submitting}
              className="fusing-submit-btn"
              style={{
                background: topForm.logId ? '#d97706' : undefined
              }}
            >
              {submitting ? <RefreshCw size={18} className="spin-loader" /> : (topForm.logId ? <Edit2 size={18} /> : <PlusCircle size={18} />)}
              <span>{topForm.logId ? 'Update Fusing Run (Edit)' : 'Submit Fusing Entry Log (New Entry)'}</span>
            </button>

            {topForm.logId && (
              <button
                type="button"
                onClick={() => {
                  setTopForm(prev => ({ ...prev, logId: null }));
                  triggerPushNotification('Switched to New Entry', 'Now creating a new fusing entry.', 'info');
                }}
                className="fusing-btn-secondary"
                style={{ height: '42px', padding: '0 1.25rem', fontSize: '0.85rem', fontWeight: 800 }}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
        )}
      </div>

      {/* ── QUICK FILTERS & SEARCH TOOLBAR WITH VIEW TOGGLE ── */}
      <section className="fusing-filters-wrapper" aria-label="Job card filtering controls" style={{ marginTop: '0.5rem' }}>
        <div className="fusing-filters-main-row" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          
          {/* Debounced Search */}
          <div className="fusing-search-box" style={{ flex: '1 1 240px' }}>
            <Search size={15} className="fusing-search-icon" aria-hidden="true" />
            <input
              type="text"
              className="fusing-search-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Job No, Party, Design, Fabric, Machine, Operator..."
              aria-label="Search fusing job cards"
            />
          </div>

          {/* Date Range Picker */}
          <DateRangePicker
            preset={datePreset}
            onChange={({ preset: p }) => { setDatePreset(p); setCurrentPage(1); }}
            customStart={customDateStart}
            customEnd={customDateEnd}
            onCustomChange={(s, e) => {
              setCustomDateStart(s);
              setCustomDateEnd(e);
              setCurrentPage(1);
            }}
          />

          {/* Unified Filters Popover */}
          <UnifiedFilterPopover
            categories={fusingFilterCategories}
            activeFilters={fusingFilters}
            onChange={(filters) => { setFusingFilters(filters); setCurrentPage(1); }}
            placeholder="Filters"
          />

          {/* Segmented View Mode Toggle: Table vs Cards */}
          <div className="glass-view-toggle" style={{ marginLeft: 'auto' }}>
            <button
              type="button"
              className={viewMode === 'table' ? 'active' : ''}
              onClick={() => setViewMode('table')}
              title="Table View (List)"
            >
              <Table size={13} /> Table
            </button>
            <button
              type="button"
              className={viewMode === 'cards' ? 'active' : ''}
              onClick={() => setViewMode('cards')}
              title="Card View (Grid)"
            >
              <LayoutGrid size={13} /> Cards
            </button>
          </div>
        </div>
      </section>

      {/* ── MAIN FUSING PRODUCTION LEDGER (DUAL VIEW: TABLE & CARDS) ── */}
      <section aria-label="Fusing production job cards ledger">
        {loading && cards.length === 0 ? (
          <div>
            {/* Zero-CLS Skeleton Rows for Desktop */}
            <div className="fusing-desktop-table-wrapper" style={{ padding: '1rem' }}>
              <div className="fusing-skeleton fusing-skeleton-row" />
              <div className="fusing-skeleton fusing-skeleton-row" />
              <div className="fusing-skeleton fusing-skeleton-row" />
              <div className="fusing-skeleton fusing-skeleton-row" />
              <div className="fusing-skeleton fusing-skeleton-row" />
            </div>
            {/* Zero-CLS Skeleton Cards for Mobile */}
            <div className="fusing-mobile-cards-wrapper">
              <div className="fusing-skeleton fusing-skeleton-card" />
              <div className="fusing-skeleton fusing-skeleton-card" />
              <div className="fusing-skeleton fusing-skeleton-card" />
            </div>
          </div>
        ) : filteredCards.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: 'rgba(15, 23, 42, 0.75)', borderRadius: '12px', border: '1px solid var(--ee-fusing-border)' }}>
            <Flame size={32} color="#38bdf8" style={{ margin: '0 auto 8px', display: 'block' }} />
            <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>No Fusing Records Found</h3>
          </div>
        ) : (
          <>
            {/* 1. DATA TABLE VIEW */}
            <div className="fusing-desktop-table-wrapper" style={{ display: viewMode === 'table' ? 'block' : 'none' }}>
              <div className="fusing-table-scroll">
                <table className="fusing-table" role="table">
                  <thead>
                    <tr>
                      <th scope="col">Job Card #</th>
                      <th scope="col">Party Name</th>
                      <th scope="col">Design &amp; Fabric</th>
                      <th scope="col">Operator &amp; Shift</th>
                      <th scope="col" style={{ textAlign: 'center' }}>Speed &amp; Temp</th>
                      <th scope="col" style={{ textAlign: 'center' }}>Butter Paper</th>
                      <th scope="col" style={{ textAlign: 'center' }}>Status</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Printed Mtr</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Fresh Output</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Total Wastage</th>
                      <th scope="col" className="fusing-sticky-col-header">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCards.map((c) => {
                      const isDone = c.fusingStatus === 'Fusing Done';
                      const isPartial = c.fusingStatus === 'Fusing In Progress' || c.fusingStatus === 'Partial Complete';
                      const printedMtr = parseFloat(getCardPrintedMeters(c)) || 0;
                      const waste = parseFloat(c.totalWastageMtr) || 0;
                      const rawFresh = c.freshMtr !== undefined && c.freshMtr !== '' 
                        ? parseFloat(c.freshMtr) 
                        : (parseFloat(c.fusingMtr) ? Math.max(0, parseFloat(c.fusingMtr) - waste) : 0);
                      const fresh = isNaN(rawFresh) ? 0 : rawFresh;
                      const butterKg = parseFloat(c.butterPaperWeightKg) || 0;
                      const preset = getFabricFusingPreset(c.fabric);

                      return (
                        <tr key={c._id || c.id}>
                          {/* Job Card No (Clickable to open speed & temp) */}
                          <td style={{ fontWeight: 800 }}>
                            <button
                              type="button"
                              onClick={() => openSpeedTempModal(c)}
                              title="Click to view & update Fusing Machine Speed & Temperature"
                              aria-label={`Open speed and temperature settings for ${formatJobCardNo(c.jobNo)}`}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'inline-flex',
                                flexDirection: 'column',
                                gap: '2px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#38bdf8', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                                  {c.jobNo || 'JOB'}
                                </span>
                                <Gauge size={12} color="#38bdf8" />
                                {c.pass && (
                                  <span style={{ fontSize: '0.65rem', background: 'rgba(56, 189, 248, 0.16)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.35)', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                                    {c.pass}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--ee-fusing-text-muted)', fontWeight: 500 }}>
                                {c.fusingDate || c.date || '—'}
                              </div>
                            </button>
                          </td>

                          {/* Party Name */}
                          <td style={{ fontWeight: 700, color: 'var(--ee-fusing-text-primary)' }}>
                            {c.party || c.clientName || '—'}
                          </td>

                          {/* Design & Fabric */}
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 800, color: 'var(--ee-fusing-brand-navy)' }}>
                                {c.designName || c.designNo || '—'}
                              </span>
                              {c.printStatus === 'Printing Done' && c.fusingStatus !== 'Fusing Done' && (
                                <span style={{ padding: '1px 5px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.16)', border: '1px solid rgba(52, 211, 153, 0.35)', color: '#34d399', fontSize: '0.68rem', fontWeight: 800 }}>
                                  ⚡ Print Ready
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--ee-fusing-text-secondary)', marginTop: 2 }}>
                              {c.fabric || 'Fabric'} {c.panna ? `(${c.panna}")` : ''}
                            </div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: 3, padding: '1px 6px', borderRadius: 4, background: 'rgba(245, 158, 11, 0.16)', border: '1px solid rgba(251, 191, 36, 0.35)', fontSize: '0.68rem', color: '#fbbf24', fontWeight: 700 }}>
                              <Flame size={10} /> Preset: {preset.temp} @ {preset.speed}
                            </div>
                          </td>

                          {/* Operator & Shift */}
                          <td>
                            <div style={{ fontWeight: 800, color: 'var(--ee-fusing-text-primary)', fontSize: '0.85rem' }}>
                              {c.fusingOperator || '—'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--ee-fusing-text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                              <span style={{ padding: '1px 5px', borderRadius: 4, background: 'rgba(30, 41, 59, 0.85)', border: '1px solid rgba(148, 163, 184, 0.25)', fontWeight: 700, color: '#cbd5e1' }}>
                                {c.shift || 'Morning'}
                              </span>
                              {c.fusingMachine && (
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                  • {c.fusingMachine.replace(/\s*\(.*?\)/, '')}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Speed & Temp */}
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => openSpeedTempModal(c)}
                              title="Click to change Fusing Temperature & Speed"
                              aria-label={`Adjust speed and temperature: current ${c.fusingTemp || preset.temp} at ${c.fusingSpeed || preset.speed}`}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                flexDirection: 'column',
                                gap: '3px',
                                alignItems: 'center'
                              }}
                            >
                              <span className="fusing-chip temp">
                                <Thermometer size={11} style={{ marginRight: 2 }} />
                                {c.fusingTemp || c.temperature || preset.temp}
                              </span>
                              <span className="fusing-chip speed">
                                <Gauge size={11} style={{ marginRight: 2 }} />
                                {c.fusingSpeed || c.speed || preset.speed}
                              </span>
                            </button>
                          </td>

                          {/* Butter Paper */}
                          <td style={{ textAlign: 'center' }}>
                            {(c.useButterPaper === 'Yes' || butterKg > 0) ? (
                              <span className="fusing-chip butter-yes">
                                <CheckCircle2 size={12} /> YES {butterKg > 0 ? `(${butterKg}kg)` : ''}
                              </span>
                            ) : (
                              <span className="fusing-chip butter-no">
                                <XCircle size={12} /> NO
                              </span>
                            )}
                          </td>

                          {/* Status Toggle Button */}
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleQuickToggleStatus(c)}
                              className={`fusing-badge ${isDone ? 'done' : isPartial ? 'progress' : 'pending'}`}
                              aria-label={`Toggle status from ${isDone ? 'Completed' : isPartial ? 'In-Progress' : 'Pending'}`}
                              title="Click to toggle fusing status"
                              style={{ cursor: 'pointer', border: 'none' }}
                            >
                              {isDone ? <CheckCircle2 size={12} /> : isPartial ? <Clock size={12} /> : <AlertCircle size={12} />}
                              <span>{isDone ? 'Complete' : (isPartial ? 'In-Process' : 'Pending')}</span>
                            </button>
                          </td>

                          {/* Printed Meters */}
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#38bdf8', fontSize: '0.88rem' }}>
                            {printedMtr > 0 ? `${printedMtr.toLocaleString('en-IN')} m` : '—'}
                          </td>

                          {/* Fresh Output */}
                          <td style={{ textAlign: 'right', fontWeight: 900, color: '#34d399', fontSize: '0.92rem' }}>
                            <div>{fresh > 0 ? `${fresh.toLocaleString('en-IN')} m` : '—'}</div>
                            {printedMtr > 0 && fresh > 0 && (
                              <div style={{ fontSize: '0.68rem', color: '#6ee7b7', fontWeight: 700 }}>
                                {((fresh / printedMtr) * 100).toFixed(0)}% yield
                              </div>
                            )}
                          </td>

                          {/* Total Wastage */}
                          <td style={{ textAlign: 'right', fontWeight: 800 }}>
                            {waste > 0 ? (
                              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                <span style={{
                                  background: 'rgba(239, 68, 68, 0.18)',
                                  color: '#f87171',
                                  border: '1px solid rgba(248, 113, 113, 0.40)',
                                  padding: '2px 8px',
                                  borderRadius: '5px',
                                  fontWeight: 900,
                                  fontSize: '0.84rem'
                                }}>
                                  ⚠️ {waste} m
                                </span>
                                <span style={{ fontSize: '0.68rem', color: '#fca5a5', fontWeight: 700 }}>
                                  {printedMtr > 0 
                                    ? `${((waste / printedMtr) * 100).toFixed(1)}% waste`
                                    : (fresh + waste > 0 ? `${((waste / (fresh + waste)) * 100).toFixed(1)}% waste` : '')}
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600 }}>0 m</span>
                            )}
                          </td>

                          {/* Actions (Sticky Column) */}
                          <td className="fusing-sticky-col-cell">
                            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => openNewRunForCard(c)}
                                className="fusing-btn-primary"
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.78rem',
                                  minHeight: '32px',
                                  background: '#059669',
                                  borderColor: '#059669',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                title="Add a new fusing run entry for this Job Card (New Entry)"
                                aria-label={`Add new fusing run for Job ${c.jobNo}`}
                              >
                                <PlusCircle size={13} /> Add Run
                              </button>
                              <button
                                type="button"
                                onClick={() => openFusingModal(c)}
                                className="fusing-btn-secondary"
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.78rem',
                                  minHeight: '32px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                aria-label={`Edit fusing production entry for Job ${c.jobNo}`}
                              >
                                <Edit2 size={13} /> Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. CARDS GRID VIEW */}
            <div className="fusing-mobile-cards-wrapper" style={{ display: viewMode === 'cards' ? 'grid' : 'none', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }} role="feed" aria-label="Job cards feed">
              {paginatedCards.map((c) => {
                const isDone = c.fusingStatus === 'Fusing Done';
                const isPartial = c.fusingStatus === 'Fusing In Progress' || c.fusingStatus === 'Partial Complete';
                const printedMtr = parseFloat(getCardPrintedMeters(c)) || 0;
                const waste = parseFloat(c.totalWastageMtr) || 0;
                const rawFresh = c.freshMtr !== undefined && c.freshMtr !== '' 
                  ? parseFloat(c.freshMtr) 
                  : (parseFloat(c.fusingMtr) ? Math.max(0, parseFloat(c.fusingMtr) - waste) : 0);
                const fresh = isNaN(rawFresh) ? 0 : rawFresh;
                const butterKg = parseFloat(c.butterPaperWeightKg) || 0;
                const preset = getFabricFusingPreset(c.fabric);

                return (
                  <article key={c._id || c.id} className="fusing-card">
                    {/* Card Header */}
                    <div className="fusing-card-header">
                      <div className="fusing-card-job-badge">
                        <Flame size={14} />
                        <span>{formatJobCardNo(c.jobNo)}</span>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--ee-fusing-text-muted)', fontWeight: 600 }}>
                          {c.fusingDate || c.date || '—'}
                        </span>
                        
                        <button
                          type="button"
                          onClick={() => handleQuickToggleStatus(c)}
                          className={`fusing-badge ${isDone ? 'done' : isPartial ? 'progress' : 'pending'}`}
                          style={{ cursor: 'pointer', border: 'none', padding: '6px 10px', fontSize: '0.76rem' }}
                          aria-label={`Status: ${isDone ? 'Completed' : isPartial ? 'In-Process' : 'Pending'}. Tap to toggle.`}
                        >
                          {isDone ? <CheckCircle2 size={13} /> : isPartial ? <Clock size={13} /> : <AlertCircle size={13} />}
                          <span>{isDone ? 'Complete' : (isPartial ? 'In-Process' : 'Pending')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="fusing-card-body">
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        {(c.imageUrl || c.designImage || c.image1 || c.sampleImage || c.photo) && (
                          <SmartThumbnail
                            src={c.imageUrl || c.designImage || c.image1 || c.sampleImage || c.photo}
                            alt={c.designName || 'Design'}
                            title={c.designName || c.challanNo || 'Fabrication Run'}
                            size="lg"
                            aspectRatio="1:1"
                            category="fabric"
                            metadata={{
                              Party: c.party || c.clientName || '—',
                              Challan: c.challanNo || '—',
                              Design: c.designName || '—',
                              Fabric: c.fabric || '—',
                              Meters: c.meters || c.meterage || '—'
                            }}
                          />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 className="fusing-card-party-title">{c.party || c.clientName || 'Unnamed Party'}</h4>
                          <div className="fusing-card-design-text" style={{ marginTop: '2px' }}>
                            <strong style={{ color: 'var(--ee-fusing-brand-navy)' }}>{c.designName || c.designNo || '—'}</strong>
                            <span>•</span>
                            <span>{c.fabric || 'Fabric'} {c.panna ? `(${c.panna}")` : ''}</span>
                            {c.printStatus === 'Printing Done' && c.fusingStatus !== 'Fusing Done' && (
                              <span style={{ padding: '1px 5px', borderRadius: 4, background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', fontSize: '0.68rem', fontWeight: 800 }}>
                                ⚡ Print Ready
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Fresh Output vs Wastage Grid (3-Tier Balance) */}
                      <div className="fusing-card-stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                        <div className="fusing-card-stat-item">
                          <span className="fusing-card-stat-label">Printed</span>
                          <span className="fusing-card-stat-val" style={{ color: '#0369a1', fontSize: '0.86rem' }}>
                            {printedMtr > 0 ? `${printedMtr} m` : '—'}
                          </span>
                        </div>
                        <div className="fusing-card-stat-item">
                          <span className="fusing-card-stat-label">Fresh Output</span>
                          <span className="fusing-card-stat-val fresh" style={{ fontSize: '0.86rem' }}>
                            {fresh > 0 ? `${fresh.toLocaleString('en-IN')} m` : '—'}
                          </span>
                        </div>
                        <div className="fusing-card-stat-item">
                          <span className="fusing-card-stat-label">Wastage</span>
                          <span className={`fusing-card-stat-val ${waste > 0 ? 'waste' : ''}`} style={{ fontSize: '0.86rem' }}>
                            {waste > 0 ? `⚠️ ${waste}m` : '0 m'}
                          </span>
                        </div>
                      </div>

                      {/* Meta Chips */}
                      <div className="fusing-card-meta-chips">
                        <span className="fusing-chip temp">
                          <Thermometer size={12} /> {c.fusingTemp || preset.temp}
                        </span>
                        <span className="fusing-chip speed">
                          <Gauge size={12} /> {c.fusingSpeed || preset.speed} m/min
                        </span>
                        <span className={`fusing-chip ${c.useButterPaper === 'Yes' || butterKg > 0 ? 'butter-yes' : 'butter-no'}`}>
                          Butter Paper: {c.useButterPaper === 'Yes' || butterKg > 0 ? `YES (${butterKg || 0}kg)` : 'NO'}
                        </span>
                        <span className="fusing-chip">
                          Shift: {c.shift || 'Morning'}
                        </span>
                        {c.fusingMachine && (
                          <span className="fusing-chip">
                            ⚙️ {c.fusingMachine}
                          </span>
                        )}
                        {c.fusingOperator && (
                          <span className="fusing-chip">
                            👤 {c.fusingOperator}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Touch Action Buttons (min 48px touch targets) */}
                    <div className="fusing-card-actions">
                      <button
                        type="button"
                        onClick={() => openNewRunForCard(c)}
                        className="fusing-touch-btn fusing-btn-primary"
                        style={{ background: '#059669', borderColor: '#059669' }}
                        aria-label={`Add new fusing run for Job ${c.jobNo}`}
                      >
                        <PlusCircle size={16} /> + Add Run
                      </button>
                      <button
                        type="button"
                        onClick={() => openFusingModal(c)}
                        className="fusing-touch-btn fusing-btn-secondary"
                        aria-label={`Edit Jobcard ${c.jobNo} production log`}
                      >
                        <Edit2 size={16} /> Edit Entry
                      </button>
                      <button
                        type="button"
                        onClick={() => openSpeedTempModal(c)}
                        className="fusing-touch-btn fusing-btn-accent"
                        aria-label={`Adjust Speed and Temperature for Jobcard ${c.jobNo}`}
                      >
                        <Gauge size={16} /> Speed &amp; Temp
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* 3. INFINITE SCROLL & CHUNKING CONTROLS */}
            <InfiniteScrollPagination
              hasMore={paginatedCards.length < filteredCards.length}
              loading={loading && cards.length === 0}
              loadingMore={loadingMore}
              onLoadMore={handleLoadMore}
              page={currentPage}
              pages={totalPages}
              total={filteredCards.length}
              currentCount={paginatedCards.length}
              itemName="job cards"
              pageSize={pageSize}
              pageSizeOptions={[25, 50, 100, 'All']}
              onPageSizeChange={(newSize) => {
                const s = newSize === 'All' ? 'all' : Number(newSize);
                setPageSize(s);
                setVisibleCount(s === 'all' ? filteredCards.length : s);
              }}
              onLoadAll={() => {
                setPageSize('all');
                setVisibleCount(filteredCards.length);
              }}
            />
          </>
        )}
      </section>
      </>
      )}

      {/* ── TAB 2: FUSING RUNS HISTORY (INDIVIDUAL RUNS LEDGER) ── */}
      {activeFusingTab === 'runs' && (
        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Runs Toolbar */}
          <div className="fusing-filters-wrapper" style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(56, 189, 248, 0.16)', border: '1px solid rgba(56, 189, 248, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                <Zap size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#ffffff' }}>
                Fusing Runs History
              </h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div className="fusing-search-box" style={{ minWidth: '240px' }}>
                <Search size={14} className="fusing-search-icon" />
                <input
                  type="text"
                  className="fusing-search-input"
                  value={runsSearch}
                  onChange={e => setRunsSearch(e.target.value)}
                  placeholder="Filter by Job #, Machine, Operator..."
                />
              </div>

              <span style={{
                background: 'rgba(56, 189, 248, 0.16)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 900
              }}>
                ⚡ {filteredFusingRuns.length} Runs
              </span>
            </div>
          </div>

          {/* Runs Table */}
          {filteredFusingRuns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: 'rgba(15, 23, 42, 0.75)', borderRadius: '12px', border: '1px solid var(--ee-fusing-border)' }}>
              <Zap size={36} color="#38bdf8" style={{ margin: '0 auto 10px', display: 'block' }} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#ffffff' }}>No Fusing Runs Found</h3>
            </div>
          ) : (
            <div className="fusing-desktop-table-wrapper">
              <div className="fusing-table-scroll">
                <table className="fusing-table" role="table">
                  <thead>
                    <tr>
                      <th scope="col">Date &amp; Shift</th>
                      <th scope="col">Job Card #</th>
                      <th scope="col">Machine &amp; Operator</th>
                      <th scope="col">Panna &amp; Speed/Temp</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Fresh Output</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Wastage Loss</th>
                      <th scope="col" style={{ textAlign: 'center' }}>Roll Status</th>
                      <th scope="col" style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFusingRuns.map((run) => {
                      const matchingCard = cards.find(c => 
                        String(c._id || c.id) === String(run.jobCardId) || 
                        String(c.jobNo).toLowerCase() === String(run.jobNo).toLowerCase()
                      );
                      const fMtr = Number(run.freshMtr || 0);
                      const wMtr = Number(run.totalWastageMtr || 0);
                      const runDateStr = run.date ? formatDateTimeDDMMYYYY(run.date) : '—';

                      return (
                        <tr key={run._id || run.id}>
                          <td>
                            <div style={{ fontWeight: 800, color: '#ffffff' }}>{runDateStr}</div>
                            <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.68)', fontWeight: 600 }}>Shift: {run.shift || 'Morning'}</div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 900, color: '#38bdf8' }}>{formatJobCardNo(run.jobNo)}</div>
                            {matchingCard && (
                              <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.72)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {matchingCard.party || ''} • {matchingCard.fabric || ''}
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ fontWeight: 800, color: '#ffffff' }}>{run.fusingMachine || '—'}</div>
                            <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.68)' }}>👤 {run.operatorName || '—'}</div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#ffffff' }}>{run.panna || '58"'}</div>
                            <div style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 600 }}>
                              {run.fusingTemp || '210°C'} @ {run.fusingSpeed || '80'}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span style={{
                              display: 'inline-block',
                              background: 'rgba(16, 185, 129, 0.16)',
                              color: '#34d399',
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                              padding: '2px 8px',
                              borderRadius: '5px',
                              fontWeight: 900,
                              fontSize: '0.88rem'
                            }}>
                              ✨ {fMtr} m
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {wMtr > 0 ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  background: 'rgba(239, 68, 68, 0.16)',
                                  color: '#f87171',
                                  border: '1px solid rgba(239, 68, 68, 0.35)',
                                  padding: '2px 8px',
                                  borderRadius: '5px',
                                  fontWeight: 900,
                                  fontSize: '0.84rem'
                                }}
                                title={`Fabric: ${run.fabricFaultMtr || 0}m | Fusing: ${run.fusingFaultMtr || 0}m | Print: ${run.printFaultMtr || 0}m | Joint: ${run.genuineFaultMtr || 0}m`}
                              >
                                ⚠️ {wMtr} m
                              </span>
                            ) : (
                              <span style={{ color: 'rgba(255, 255, 255, 0.55)', fontSize: '0.82rem', fontWeight: 600 }}>0 m</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              background: run.rollCompleted === 'Complete' ? 'rgba(16, 185, 129, 0.16)' : 'rgba(56, 189, 248, 0.16)',
                              color: run.rollCompleted === 'Complete' ? '#34d399' : '#38bdf8',
                              border: `1px solid ${run.rollCompleted === 'Complete' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(56, 189, 248, 0.35)'}`
                            }}>
                              {run.rollCompleted || 'Complete'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '5px' }}>
                              <button
                                type="button"
                                onClick={() => openFusingModal(matchingCard, run)}
                                className="fusing-btn-primary"
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.74rem', minHeight: '30px' }}
                                title="Edit this run record"
                              >
                                <Edit2 size={12} /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteFusingLog(run._id || run.id, run.jobNo)}
                                className="fusing-btn-secondary"
                                style={{ padding: '0.35rem 0.55rem', fontSize: '0.74rem', minHeight: '30px', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                                title="Delete this run record"
                              >
                                <Trash2 size={12} />
                              </button>
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
        </div>
      )}

      {/* ── TAB 3: READY FOR FUSING QUEUE ── */}
      {activeFusingTab === 'queue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Queue Filter Toolbar */}
          <div className="fusing-filters-wrapper">
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="fusing-search-box" style={{ flex: '1 1 240px' }}>
                <Search size={15} className="fusing-search-icon" aria-hidden="true" />
                <input
                  type="text"
                  className="fusing-search-input"
                  value={queueSearchQuery}
                  onChange={e => setQueueSearchQuery(e.target.value)}
                  placeholder="Filter queue by Job No, Party, Design, Fabric..."
                  aria-label="Filter ready for fusing queue"
                />
              </div>

              <select
                className="fusing-filter-select"
                value={queueFabricFilter}
                onChange={e => setQueueFabricFilter(e.target.value)}
                aria-label="Filter queue by Fabric"
              >
                <option value="All">All Fabrics ({eligibleFusingCards.length})</option>
                {queueFabricsList.map(fab => (
                  <option key={fab} value={fab}>{fab}</option>
                ))}
              </select>

              <div className="glass-view-toggle" style={{ marginLeft: 'auto' }}>
                <button
                  type="button"
                  className={viewMode === 'table' ? 'active' : ''}
                  onClick={() => setViewMode('table')}
                  title="Table View (List)"
                >
                  <Table size={13} /> Table
                </button>
                <button
                  type="button"
                  className={viewMode === 'cards' ? 'active' : ''}
                  onClick={() => setViewMode('cards')}
                  title="Card View (Grid)"
                >
                  <LayoutGrid size={13} /> Cards
                </button>
              </div>
            </div>
          </div>

          {/* Dual Layout for Queue */}
          {filteredQueueCards.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: 'rgba(15, 23, 42, 0.75)', borderRadius: '12px', border: '1px solid var(--ee-fusing-border)' }}>
              <Flame size={32} color="#38bdf8" style={{ margin: '0 auto 8px', display: 'block' }} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>No Jobs Waiting in Fusing Queue</h3>
            </div>
          ) : (
            <>
              {/* Desktop Table for Queue */}
              <div className="fusing-desktop-table-wrapper" style={{ display: viewMode === 'table' ? 'block' : 'none' }}>
                <div className="fusing-table-scroll">
                  <table className="fusing-table" role="table">
                    <thead>
                      <tr>
                        <th scope="col">Job No.</th>
                        <th scope="col">Party</th>
                        <th scope="col">Design</th>
                        <th scope="col">Fabric &amp; Panna</th>
                        <th scope="col" style={{ textAlign: 'center' }}>Preset Temp &amp; Speed</th>
                        <th scope="col" style={{ textAlign: 'right' }}>Printed Mtr</th>
                        <th scope="col" className="fusing-sticky-col-header">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQueueCards.map((c, idx) => {
                        const pMtr = getCardPrintedMeters(c);
                        const preset = getFabricFusingPreset(c.fabric);
                        return (
                          <tr key={c._id || c.id || idx}>
                            <td style={{ fontWeight: 900, color: '#38bdf8' }}>
                              {formatJobCardNo(c.jobNo)}
                            </td>
                            <td style={{ fontWeight: 700, color: '#ffffff' }}>
                              {c.party || c.clientName || '—'}
                            </td>
                            <td style={{ color: 'rgba(255, 255, 255, 0.85)', fontWeight: 600 }}>
                              {c.designName || c.designNo || '—'}
                            </td>
                            <td>
                              <span style={{ fontWeight: 800, color: '#ffffff' }}>{c.fabric || '—'}</span>
                              <span style={{ marginLeft: 6, fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.75)', background: 'rgba(255, 255, 255, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                {c.panna ? (String(c.panna).includes('"') ? c.panna : `${c.panna}"`) : '58"'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="fusing-chip temp">
                                <Thermometer size={12} /> {preset.temp} @ {preset.speed} m/min
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 900, color: '#34d399', fontSize: '0.92rem' }}>
                              {pMtr ? `${pMtr} m` : (c.totalMtr || c.consumption || '—')}
                            </td>
                            <td className="fusing-sticky-col-cell">
                              <button
                                type="button"
                                onClick={() => {
                                  handleTopJobCardSelect(c);
                                  setActiveFusingTab('entry');
                                  setIsFormExpanded(true);
                                  window.scrollTo({ top: 120, behavior: 'smooth' });
                                }}
                                className="fusing-btn-primary"
                                style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem', minHeight: '34px' }}
                                aria-label={`Start fusing for Job ${c.jobNo}`}
                              >
                                <Zap size={14} /> Start Fusing
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Cards Grid for Queue */}
              <div className="fusing-mobile-cards-wrapper" style={{ display: viewMode === 'cards' ? 'grid' : 'none', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }} role="feed" aria-label="Ready for fusing queue mobile cards">
                {filteredQueueCards.map((c, idx) => {
                  const pMtr = getCardPrintedMeters(c);
                  const preset = getFabricFusingPreset(c.fabric);
                  return (
                    <article key={c._id || c.id || idx} className="fusing-card">
                      <div className="fusing-card-header">
                        <div className="fusing-card-job-badge">
                          <Flame size={14} />
                          <span>{formatJobCardNo(c.jobNo)}</span>
                        </div>
                        <span className="fusing-badge done">
                          ⚡ Ready for Fusing
                        </span>
                      </div>

                      <div className="fusing-card-body">
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                          {(c.imageUrl || c.designImage || c.image1 || c.sampleImage || c.photo) && (
                            <SmartThumbnail
                              src={c.imageUrl || c.designImage || c.image1 || c.sampleImage || c.photo}
                              alt={c.designName || 'Design'}
                              title={c.designName || c.challanNo || 'Fabrication Run'}
                              size="lg"
                              aspectRatio="1:1"
                              category="fabric"
                              metadata={{
                                Party: c.party || c.clientName || '—',
                                Challan: c.challanNo || '—',
                                Design: c.designName || '—',
                                Fabric: c.fabric || '—',
                                Meters: c.meters || c.meterage || '—'
                              }}
                            />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h4 className="fusing-card-party-title">{c.party || c.clientName || 'Unnamed Party'}</h4>
                            <div className="fusing-card-design-text" style={{ marginTop: '2px' }}>
                              <strong style={{ color: 'var(--ee-fusing-brand-navy)' }}>{c.designName || c.designNo || '—'}</strong>
                              <span>•</span>
                              <span>{c.fabric || 'Fabric'} {c.panna ? `(${c.panna}")` : ''}</span>
                            </div>
                          </div>
                        </div>

                        <div className="fusing-card-stats-row">
                          <div className="fusing-card-stat-item">
                            <span className="fusing-card-stat-label">Printed Quantity</span>
                            <span className="fusing-card-stat-val fresh">
                              {pMtr ? `${pMtr} m` : (c.totalMtr || c.consumption || '—')}
                            </span>
                          </div>
                          <div className="fusing-card-stat-item">
                            <span className="fusing-card-stat-label">Recommended Preset</span>
                            <span className="fusing-card-stat-val" style={{ fontSize: '0.85rem', color: '#92400E' }}>
                              {preset.temp} @ {preset.speed}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          handleTopJobCardSelect(c);
                          setActiveFusingTab('entry');
                          setIsFormExpanded(true);
                          window.scrollTo({ top: 120, behavior: 'smooth' });
                        }}
                        className="fusing-touch-btn fusing-btn-primary"
                        aria-label={`Load Job ${c.jobNo} into Fusing Entry Form`}
                      >
                        <Zap size={16} /> Load into Fusing Entry
                      </button>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── MODAL 1: EDIT FUSING ENTRY & WASTAGE MODAL (Dark Frosted Glass) ── */}
      {showFormModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(2, 6, 23, 0.78)', backdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.96)', width: '100%', maxWidth: '640px', maxHeight: '90vh',
            borderRadius: '16px', boxShadow: '0 28px 64px rgba(0, 0, 0, 0.70)',
            border: '1px solid rgba(148, 163, 184, 0.26)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            color: '#ffffff'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '1rem 1.25rem', background: 'rgba(11, 17, 32, 0.94)', borderBottom: '1px solid rgba(148, 163, 184, 0.20)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Flame size={22} color={form.logId ? '#fbbf24' : '#38bdf8'} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#ffffff' }}>
                  {form.logId ? `Edit Fusing Run #${String(form.logId).slice(-6)}` : 'Edit Fusing Master Card'} — {formatJobCardNo(form.jobNo)}
                </h3>
              </div>
              <button type="button" onClick={() => setShowFormModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleFormSubmit} style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              
              {/* Runs Switcher on this Job Card */}
              {(() => {
                const cardRuns = getCardLogs(selectedCard);
                if (cardRuns.length > 0) {
                  return (
                    <div style={{ background: 'rgba(56, 189, 248, 0.12)', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.35)', fontSize: '0.78rem' }}>
                      <div style={{ fontWeight: 800, color: '#38bdf8', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>⚡ Production Runs for Job #{selectedCard?.jobNo} ({cardRuns.length}):</span>
                        {form.logId && (
                          <button
                            type="button"
                            onClick={() => openFusingModal(selectedCard, null)}
                            style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(148, 163, 184, 0.30)', borderRadius: '4px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', color: '#e2e8f0' }}
                          >
                            Switch to Master Card Edit
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {cardRuns.map((run, idx) => (
                          <button
                            key={run._id || run.id}
                            type="button"
                            onClick={() => openFusingModal(selectedCard, run)}
                            style={{
                              background: form.logId === (run._id || run.id) ? '#0284c7' : 'rgba(15, 23, 42, 0.85)',
                              color: form.logId === (run._id || run.id) ? '#ffffff' : '#38bdf8',
                              border: form.logId === (run._id || run.id) ? '1px solid #38bdf8' : '1px solid rgba(56, 189, 248, 0.35)',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            Run #{idx + 1}: {run.freshMtr}m Fresh {run.totalWastageMtr > 0 ? `(${run.totalWastageMtr}m waste)` : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
              
              {/* Fresh Output MTR & Total Fabric Used formula box */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                
                {/* 1. Fresh Output (Net Usable MTR) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#34d399', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                    Fresh Output (Net Usable MTR) *
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    required
                    value={form.freshMtr}
                    onChange={e => setForm(f => ({ ...f, freshMtr: sanitizeQuarterInput(e.target.value) }))}
                    onBlur={e => setForm(f => ({ ...f, freshMtr: finalizeQuarterBlur(e.target.value) }))}
                    placeholder="e.g. 138.00"
                    style={{
                      width: '100%', padding: '0.55rem', borderRadius: '8px',
                      border: '2px solid #10b981', fontWeight: 900, fontSize: '0.95rem',
                      background: 'rgba(16, 185, 129, 0.15)', color: '#34d399'
                    }}
                  />
                  <div style={{ fontSize: '0.64rem', color: '#6ee7b7', marginTop: '2px', fontWeight: 600 }}>
                    Accepted decimals: .00, .25, .50, .75 only
                  </div>
                </div>

                {/* 2. Total Fabric Used (Fresh MTR + Total Wastage) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 900, color: '#38bdf8', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                    Total Fabric Used (MTR)
                  </label>
                  <div style={{
                    width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '2px solid rgba(56, 189, 248, 0.55)',
                    fontWeight: 900, fontSize: '1rem', background: 'rgba(56, 189, 248, 0.14)', color: '#ffffff',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px'
                  }}>
                    <span>{calculatedTotalFabricUsedMtr} Mtr</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#38bdf8', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(56, 189, 248, 0.35)', padding: '2px 6px', borderRadius: '4px' }}>
                      Total = Fresh + Wastage
                    </span>
                  </div>
                </div>
              </div>

              {/* 4 Wastage Fault Breakdown */}
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', padding: '0.9rem 1rem', borderRadius: '10px', border: '1px solid rgba(248, 113, 113, 0.38)' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 900, color: '#fca5a5', textTransform: 'uppercase', marginBottom: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Wastage Breakdown (4 Fault Types)</span>
                  <span style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#ffffff', border: '1px solid rgba(248, 113, 113, 0.45)', padding: '2px 10px', borderRadius: '6px' }}>Total Wastage: <b>{calculatedWastageMtr} Mtr</b></span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fca5a5', marginBottom: '0.2rem', display: 'block' }}>1. Fabric Fault (Mtr)</label>
                    <input
                      type="number" step="0.25" min="0"
                      value={form.fabricFaultMtr}
                      onChange={e => setForm(f => ({ ...f, fabricFaultMtr: sanitizeQuarterInput(e.target.value) }))}
                      onBlur={e => setForm(f => ({ ...f, fabricFaultMtr: finalizeQuarterBlur(e.target.value) }))}
                      style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(248, 113, 113, 0.40)', fontSize: '0.9rem', fontWeight: 800, background: 'rgba(15, 23, 42, 0.85)', color: '#ffffff' }}
                    />
                    <div style={{ fontSize: '0.62rem', color: '#cbd5e1', marginTop: '2px', fontWeight: 600 }}>
                      Decimals: .00, .25, .50, .75
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fca5a5', marginBottom: '0.2rem', display: 'block' }}>2. Fusing Fault (Mtr)</label>
                    <input
                      type="number" step="0.25" min="0"
                      value={form.fusingFaultMtr}
                      onChange={e => setForm(f => ({ ...f, fusingFaultMtr: sanitizeQuarterInput(e.target.value) }))}
                      onBlur={e => setForm(f => ({ ...f, fusingFaultMtr: finalizeQuarterBlur(e.target.value) }))}
                      style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(248, 113, 113, 0.40)', fontSize: '0.9rem', fontWeight: 800, background: 'rgba(15, 23, 42, 0.85)', color: '#ffffff' }}
                    />
                    <div style={{ fontSize: '0.62rem', color: '#cbd5e1', marginTop: '2px', fontWeight: 600 }}>
                      Decimals: .00, .25, .50, .75
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fca5a5', marginBottom: '0.2rem', display: 'block' }}>3. Print Fault (Mtr)</label>
                    <input
                      type="number" step="0.25" min="0"
                      value={form.printFaultMtr}
                      onChange={e => setForm(f => ({ ...f, printFaultMtr: sanitizeQuarterInput(e.target.value) }))}
                      onBlur={e => setForm(f => ({ ...f, printFaultMtr: finalizeQuarterBlur(e.target.value) }))}
                      style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(248, 113, 113, 0.40)', fontSize: '0.9rem', fontWeight: 800, background: 'rgba(15, 23, 42, 0.85)', color: '#ffffff' }}
                    />
                    <div style={{ fontSize: '0.62rem', color: '#cbd5e1', marginTop: '2px', fontWeight: 600 }}>
                      Decimals: .00, .25, .50, .75
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fca5a5', marginBottom: '0.2rem', display: 'block' }}>4. Genuine Fault (Mtr)</label>
                    <input
                      type="number" step="0.25" min="0"
                      value={form.genuineFaultMtr}
                      onChange={e => setForm(f => ({ ...f, genuineFaultMtr: sanitizeQuarterInput(e.target.value) }))}
                      onBlur={e => setForm(f => ({ ...f, genuineFaultMtr: finalizeQuarterBlur(e.target.value) }))}
                      style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(248, 113, 113, 0.40)', fontSize: '0.9rem', fontWeight: 800, background: 'rgba(15, 23, 42, 0.85)', color: '#ffffff' }}
                    />
                    <div style={{ fontSize: '0.62rem', color: '#cbd5e1', marginTop: '2px', fontWeight: 600 }}>
                      Decimals: .00, .25, .50, .75
                    </div>
                  </div>
                </div>
              </div>

              {/* Butter Paper Specs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#c084fc', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                    Butter Paper Used?
                  </label>
                  <select
                    value={form.useButterPaper}
                    onChange={e => {
                      const val = e.target.value;
                      setForm(f => ({ ...f, useButterPaper: val, butterPaperWeightKg: val === 'No' ? '0' : f.butterPaperWeightKg }));
                    }}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid rgba(192, 132, 252, 0.40)', fontWeight: 800, fontSize: '0.88rem', background: 'rgba(168, 85, 247, 0.14)', color: '#c084fc' }}
                  >
                    <option value="Yes">✓ YES (Used Butter Paper)</option>
                    <option value="No">✕ NO (No Butter Paper)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#c084fc', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                    Butter Paper Weight (KG)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    disabled={form.useButterPaper === 'No'}
                    value={form.butterPaperWeightKg}
                    onChange={e => setForm(f => ({ ...f, butterPaperWeightKg: e.target.value }))}
                    placeholder="e.g. 12.50 kg"
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.28)', fontWeight: 700, fontSize: '0.88rem', background: form.useButterPaper === 'No' ? 'rgba(15, 23, 42, 0.45)' : 'rgba(15, 23, 42, 0.85)', color: '#ffffff' }}
                  />
                </div>
              </div>

              {/* Machine Specs: Panna, Temp, Speed, Status */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#cbd5e1', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Panna</label>
                  <select
                    value={form.panna}
                    onChange={e => setForm(f => ({ ...f, panna: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.28)', fontSize: '0.85rem', fontWeight: 700, background: 'rgba(15, 23, 42, 0.85)', color: '#ffffff' }}
                  >
                    {pannaOptions.map(p => <option key={p} value={p}>{p} Panna</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#fbbf24', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Fusing Temp (°C)</label>
                  <input
                    type="text"
                    value={form.fusingTemp}
                    onChange={e => setForm(f => ({ ...f, fusingTemp: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(251, 191, 36, 0.40)', fontSize: '0.85rem', fontWeight: 800, background: 'rgba(245, 158, 11, 0.14)', color: '#fbbf24' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#38bdf8', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Fusing Speed</label>
                  <select
                    value={form.fusingSpeed}
                    onChange={e => setForm(f => ({ ...f, fusingSpeed: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.40)', fontSize: '0.85rem', fontWeight: 800, background: 'rgba(56, 189, 248, 0.14)', color: '#38bdf8', cursor: 'pointer' }}
                  >
                    {FUSING_SPEED_OPTIONS.map(spd => (
                      <option key={spd} value={spd}>{spd} m/min</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#cbd5e1', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Fusing Status</label>
                  <select
                    value={form.fusingStatus}
                    onChange={e => setForm(f => ({ ...f, fusingStatus: e.target.value }))}
                    style={{
                      width: '100%', padding: '0.5rem', borderRadius: '8px',
                      border: form.fusingStatus === 'Fusing Done' ? '2px solid #10b981' : (form.fusingStatus === 'Fusing In Progress' ? '2px solid #38bdf8' : '2px solid #f59e0b'),
                      fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer',
                      background: form.fusingStatus === 'Fusing Done' ? 'rgba(16, 185, 129, 0.16)' : (form.fusingStatus === 'Fusing In Progress' ? 'rgba(56, 189, 248, 0.16)' : 'rgba(245, 158, 11, 0.16)'),
                      color: form.fusingStatus === 'Fusing Done' ? '#34d399' : (form.fusingStatus === 'Fusing In Progress' ? '#38bdf8' : '#fbbf24')
                    }}
                  >
                    <option value="Fusing Done">✓ Complete</option>
                    <option value="Fusing In Progress">⏳ Partial Complete</option>
                    <option value="Fusing Pending">⏸️ Pending</option>
                  </select>
                </div>
              </div>

              {/* Operator Name & Remarks */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#cbd5e1', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Operator Name</label>
                  <input
                    type="text"
                    value={form.fusingOperator}
                    onChange={e => setForm(f => ({ ...f, fusingOperator: e.target.value }))}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.28)', fontSize: '0.85rem', fontWeight: 700, background: 'rgba(15, 23, 42, 0.85)', color: '#ffffff' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '4px' }}>
                    <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#cbd5e1', textTransform: 'uppercase' }}>Fusing Remarks / Notes</label>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {['Heat Crease', 'Fabric Shrinkage', 'Paper Jam', 'Color Bleed', 'Roller Mark'].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, notes: f.notes ? `${f.notes}, [${tag}]` : `[${tag}]` }))}
                          className="fusing-chip-btn"
                        >
                          +{tag}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional notes e.g. Butter Paper Roll #2..."
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.28)', fontSize: '0.85rem', background: 'rgba(15, 23, 42, 0.85)', color: '#ffffff' }}
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.28)', background: 'rgba(30, 41, 59, 0.85)', color: '#e2e8f0', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '0.6rem 1.35rem',
                    borderRadius: '8px',
                    background: form.logId ? '#d97706' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: form.logId ? '0 4px 12px rgba(217, 119, 6, 0.35)' : '0 4px 14px rgba(37, 99, 235, 0.35)'
                  }}
                >
                  {submitting ? 'Saving...' : (form.logId ? 'Update Fusing Run (Edit)' : 'Update Master Fusing Record')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: GENERATE REPORT MODAL (Dark Frosted Glass) ── */}
      {showReportModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(2, 6, 23, 0.78)', backdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.96)', width: '100%', maxWidth: '840px', maxHeight: '90vh',
            borderRadius: '16px', boxShadow: '0 28px 64px rgba(0, 0, 0, 0.70)',
            border: '1px solid rgba(148, 163, 184, 0.26)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            color: '#ffffff'
          }}>
            <div style={{ padding: '1rem 1.25rem', background: 'rgba(11, 17, 32, 0.94)', borderBottom: '1px solid rgba(148, 163, 184, 0.20)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={20} color="#34d399" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#ffffff' }}>
                  Fusing Production &amp; Butter Paper Report
                </h3>
              </div>
              <button type="button" onClick={() => setShowReportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              
              {/* Machine ON & OFF Timing Header Bar */}
              <div style={{ background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.32)', padding: '0.75rem 1rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: '#38bdf8', fontSize: '0.85rem' }}>
                  <Clock size={16} color="#38bdf8" /> Machine Shift Running Time
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#34d399' }}>🟢 ON TIME:</span>
                    <input
                      type="time"
                      value={reportForm.onTime}
                      onChange={e => setReportForm(rf => ({ ...rf, onTime: e.target.value }))}
                      style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(52, 211, 153, 0.40)', fontWeight: 800, fontSize: '0.82rem', background: 'rgba(15, 23, 42, 0.85)', color: '#34d399' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f87171' }}>🔴 OFF TIME:</span>
                    <input
                      type="time"
                      value={reportForm.offTime}
                      onChange={e => setReportForm(rf => ({ ...rf, offTime: e.target.value }))}
                      style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(248, 113, 113, 0.40)', fontWeight: 800, fontSize: '0.82rem', background: 'rgba(15, 23, 42, 0.85)', color: '#f87171' }}
                    />
                  </div>
                </div>
              </div>

              {/* Row 1 KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.14)', border: '1px solid rgba(52, 211, 153, 0.35)', padding: '0.85rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#6ee7b7', textTransform: 'uppercase' }}>Total Meters Fused</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#34d399', marginTop: 2 }}>
                    {stats.totalFreshMtr.toLocaleString('en-IN')} m
                  </div>
                </div>

                <div style={{ background: 'rgba(56, 189, 248, 0.14)', border: '1px solid rgba(56, 189, 248, 0.35)', padding: '0.85rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#7dd3fc', textTransform: 'uppercase' }}>Butter Paper IN (Stock Inward)</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#38bdf8', marginTop: 2 }}>
                    {stats.butterPaperInwardKg.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg
                  </div>
                </div>

                <div style={{ background: 'rgba(168, 85, 247, 0.14)', border: '1px solid rgba(192, 132, 252, 0.35)', padding: '0.85rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#d8b4fe', textTransform: 'uppercase' }}>Butter Paper OUT (Fusing Consumed)</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#c084fc', marginTop: 2 }}>
                    {stats.butterPaperOutwardKg.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg
                  </div>
                </div>

                <div style={{ background: stats.butterPaperBalanceKg >= 0 ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.14)', border: `1px solid ${stats.butterPaperBalanceKg >= 0 ? 'rgba(52, 211, 153, 0.35)' : 'rgba(248, 113, 113, 0.35)'}`, padding: '0.85rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: stats.butterPaperBalanceKg >= 0 ? '#6ee7b7' : '#fca5a5', textTransform: 'uppercase' }}>Butter Paper Stock Balance</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: stats.butterPaperBalanceKg >= 0 ? '#34d399' : '#f87171', marginTop: 2 }}>
                    {stats.butterPaperBalanceKg.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg
                  </div>
                </div>
              </div>

              {/* ── SIDE-BY-SIDE BUTTER PAPER INWARD & USAGE TABLES ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
                
                {/* Table 1: PAPER INWARD (STOCK IN) */}
                <div style={{ background: 'rgba(11, 17, 32, 0.85)', border: '1.5px solid rgba(56, 189, 248, 0.40)', borderRadius: '12px', padding: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', borderBottom: '1px solid rgba(148, 163, 184, 0.18)', paddingBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 900, color: '#38bdf8', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      📜 PAPER INWARD (STOCK IN)
                    </span>
                    <button
                      type="button"
                      onClick={handleAddInwardRow}
                      className="btn-secondary"
                      style={{ padding: '0.25rem 0.65rem', fontSize: '0.74rem', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.35)', background: 'rgba(56, 189, 248, 0.15)', borderRadius: '6px', fontWeight: 800 }}
                    >
                      + Add Row
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {reportForm.inwardRows.map((row, idx) => (
                      <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '26px 1fr 65px 75px 24px', gap: '0.4rem', alignItems: 'center', background: 'rgba(15, 23, 42, 0.85)', padding: '4px 6px', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.22)' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#38bdf8' }}>#{idx + 1}</span>
                        
                        <select
                          value={row.panna}
                          onChange={e => handleInwardRowChange(row.id, 'panna', e.target.value)}
                          style={{ padding: '0.35rem 0.4rem', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.28)', fontSize: '0.78rem', fontWeight: 800, color: '#38bdf8', background: 'rgba(11, 17, 32, 0.90)' }}
                        >
                          {pannaOptions.map(p => <option key={p} value={p}>{p} Panna</option>)}
                        </select>

                        <input
                          type="number"
                          min="1"
                          placeholder="Rolls"
                          value={row.rolls}
                          onChange={e => handleInwardRowChange(row.id, 'rolls', e.target.value)}
                          style={{ padding: '0.35rem 0.4rem', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.28)', fontSize: '0.78rem', fontWeight: 700, width: '100%', background: 'rgba(11, 17, 32, 0.90)', color: '#ffffff' }}
                        />

                        <input
                          type="number"
                          step="0.01"
                          placeholder="Weight Kg"
                          value={row.weightKg}
                          onChange={e => handleInwardRowChange(row.id, 'weightKg', e.target.value)}
                          style={{ padding: '0.35rem 0.4rem', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.28)', fontSize: '0.78rem', fontWeight: 800, width: '100%', color: '#38bdf8', background: 'rgba(11, 17, 32, 0.90)' }}
                        />

                        {reportForm.inwardRows.length > 1 ? (
                          <Trash2 size={13} style={{ cursor: 'pointer', color: '#f87171' }} onClick={() => handleRemoveInwardRow(row.id)} />
                        ) : <span />}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Table 2: PAPER USAGE (CONSUMPTION) */}
                <div style={{ background: 'rgba(11, 17, 32, 0.85)', border: '1.5px solid rgba(192, 132, 252, 0.40)', borderRadius: '12px', padding: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', borderBottom: '1px solid rgba(148, 163, 184, 0.18)', paddingBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 900, color: '#c084fc', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      📜 PAPER USAGE (CONSUMPTION)
                    </span>
                    <button
                      type="button"
                      onClick={handleAddUsageRow}
                      className="btn-secondary"
                      style={{ padding: '0.25rem 0.65rem', fontSize: '0.74rem', color: '#c084fc', border: '1px solid rgba(192, 132, 252, 0.35)', background: 'rgba(168, 85, 247, 0.15)', borderRadius: '6px', fontWeight: 800 }}
                    >
                      + Add Row
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {reportForm.usageRows.map((row, idx) => (
                      <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '26px 1fr 65px 75px 24px', gap: '0.4rem', alignItems: 'center', background: 'rgba(15, 23, 42, 0.85)', padding: '4px 6px', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.22)' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#c084fc' }}>#{idx + 1}</span>
                        
                        <select
                          value={row.panna}
                          onChange={e => handleUsageRowChange(row.id, 'panna', e.target.value)}
                          style={{ padding: '0.35rem 0.4rem', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.28)', fontSize: '0.78rem', fontWeight: 800, color: '#c084fc', background: 'rgba(11, 17, 32, 0.90)' }}
                        >
                          {pannaOptions.map(p => <option key={p} value={p}>{p} Panna</option>)}
                        </select>

                        <input
                          type="number"
                          min="1"
                          placeholder="Rolls"
                          value={row.rolls}
                          onChange={e => handleUsageRowChange(row.id, 'rolls', e.target.value)}
                          style={{ padding: '0.35rem 0.4rem', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.28)', fontSize: '0.78rem', fontWeight: 700, width: '100%', background: 'rgba(11, 17, 32, 0.90)', color: '#ffffff' }}
                        />

                        <input
                          type="number"
                          step="0.01"
                          placeholder="Weight Kg"
                          value={row.weightKg}
                          onChange={e => handleUsageRowChange(row.id, 'weightKg', e.target.value)}
                          style={{ padding: '0.35rem 0.4rem', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.28)', fontSize: '0.78rem', fontWeight: 800, width: '100%', color: '#c084fc', background: 'rgba(11, 17, 32, 0.90)' }}
                        />

                        {reportForm.usageRows.length > 1 ? (
                          <Trash2 size={13} style={{ cursor: 'pointer', color: '#f87171' }} onClick={() => handleRemoveUsageRow(row.id)} />
                        ) : <span />}
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Butter Paper Panna-wise Consumption Summary */}
              <div style={{ background: 'rgba(11, 17, 32, 0.85)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid rgba(148, 163, 184, 0.22)', fontSize: '0.82rem' }}>
                <div style={{ fontWeight: 800, color: '#ffffff', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>🧈 Butter Paper Consumption Summary by Panna</span>
                  <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Weight in KG</span>
                </div>
                {Object.keys(stats.pannaButterKgMap).length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>No Panna-wise Butter Paper consumption logged yet.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem' }}>
                    {Object.entries(stats.pannaButterKgMap).map(([pannaName, kgVal]) => (
                      <div key={pannaName} style={{ background: 'rgba(15, 23, 42, 0.90)', border: '1px solid rgba(148, 163, 184, 0.25)', padding: '6px 10px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, color: '#38bdf8' }}>{pannaName}</span>
                        <span style={{ fontWeight: 900, color: '#c084fc' }}>{kgVal.toFixed(2)} kg</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button type="button" onClick={() => setShowReportModal(false)} className="btn-secondary">Close</button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      for (const r of reportForm.inwardRows) {
                        if (r.weightKg && Number(r.weightKg) > 0) {
                          await api.createRawMaterialTransaction({
                            type: 'INWARD',
                            date: toLocalYMD(),
                            materialName: 'Butter Paper',
                            qty: Number(r.weightKg),
                            unit: 'Kg',
                            panna: r.panna,
                            notes: `Inward ${r.rolls} Roll(s) | Shift Time: ${reportForm.onTime} to ${reportForm.offTime}`
                          });
                        }
                      }
                      for (const r of reportForm.usageRows) {
                        if (r.weightKg && Number(r.weightKg) > 0) {
                          await api.createRawMaterialTransaction({
                            type: 'OUTWARD',
                            date: toLocalYMD(),
                            materialName: 'Butter Paper',
                            qty: Number(r.weightKg),
                            unit: 'Kg',
                            panna: r.panna,
                            notes: `Consumption ${r.rolls} Roll(s) | Shift Time: ${reportForm.onTime} to ${reportForm.offTime}`
                          });
                        }
                      }
                      triggerPushNotification('Report Transactions Saved', 'Butter paper inward & usage rows logged successfully.', 'success');
                      fetchData();
                    } catch (e) {
                      console.warn('Raw material save failed:', e);
                    }
                    handleExportCSV();
                    setShowReportModal(false);
                  }}
                  className="btn-primary"
                  style={{ background: '#059669' }}
                >
                  <Download size={15} /> Save &amp; Export Report CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: INLINE QUICK PANNA DROPDOWN MANAGER (Dark Frosted Glass) ── */}
      {showPannaManagerModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(2, 6, 23, 0.78)', backdropFilter: 'blur(8px)',
          zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.96)', width: '100%', maxWidth: '480px',
            borderRadius: '16px', boxShadow: '0 28px 64px rgba(0, 0, 0, 0.70)',
            border: '1px solid rgba(148, 163, 184, 0.26)', overflow: 'hidden', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem',
            color: '#ffffff'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(148, 163, 184, 0.20)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Gauge size={18} color="#38bdf8" /> Manage Panna / Paper Width Dropdown
              </h3>
              <button type="button" onClick={() => setShowPannaManagerModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={18} />
              </button>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Add New Panna Width (e.g. 72" or 38")
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder='e.g. 72"'
                  value={newPannaInput}
                  onChange={e => setNewPannaInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddPannaOption())}
                  style={{ flex: 1, padding: '0.5rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.28)', fontSize: '0.88rem', fontWeight: 700, background: 'rgba(11, 17, 32, 0.90)', color: '#ffffff' }}
                />
                <button type="button" onClick={handleAddPannaOption} className="btn-primary" style={{ padding: '0.5rem 1rem', background: '#0284c7', borderColor: '#0284c7' }}>
                  + Add Panna
                </button>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.5rem' }}>
                Currently Active Panna Width Options ({pannaOptions.length}):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', maxHeight: '180px', overflowY: 'auto' }}>
                {pannaOptions.map(p => (
                  <span key={p} style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.35)', padding: '4px 12px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    {p}
                    <Trash2 size={13} style={{ cursor: 'pointer', color: '#f87171' }} onClick={() => handleRemovePannaOption(p)} title={`Remove ${p} Panna`} />
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(148, 163, 184, 0.20)', paddingTop: '0.75rem' }}>
              <button type="button" onClick={() => setShowPannaManagerModal(false)} className="btn-primary" style={{ padding: '0.5rem 1.25rem' }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 4: INWARD BUTTER PAPER ROLL ENTRY MODAL (Dark Frosted Glass) ── */}
      {showButterPaperInwardModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(2, 6, 23, 0.78)', backdropFilter: 'blur(8px)',
          zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <form onSubmit={handleButterPaperInwardSubmit} style={{
            background: 'rgba(15, 23, 42, 0.96)', width: '100%', maxWidth: '500px',
            borderRadius: '16px', boxShadow: '0 28px 64px rgba(0, 0, 0, 0.70)',
            border: '1px solid rgba(148, 163, 184, 0.26)', overflow: 'hidden', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem',
            color: '#ffffff'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(148, 163, 184, 0.20)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PlusCircle size={20} color="#38bdf8" /> 📦 Butter Paper Roll Inward Entry
              </h3>
              <button type="button" onClick={() => setShowButterPaperInwardModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#cbd5e1', marginBottom: '0.3rem' }}>INWARD DATE *</label>
                <input
                  type="date"
                  required
                  value={inwardButterForm.date}
                  onChange={e => setInwardButterForm(f => ({ ...f, date: e.target.value }))}
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.28)', fontSize: '0.88rem', fontWeight: 700, background: 'rgba(11, 17, 32, 0.90)', color: '#ffffff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#cbd5e1', marginBottom: '0.3rem' }}>PANNA WIDTH *</label>
                <select
                  value={inwardButterForm.panna}
                  onChange={e => setInwardButterForm(f => ({ ...f, panna: e.target.value }))}
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.28)', fontSize: '0.88rem', fontWeight: 800, color: '#38bdf8', background: 'rgba(11, 17, 32, 0.90)' }}
                >
                  {pannaOptions.map(p => <option key={p} value={p}>{p} Panna</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#cbd5e1', marginBottom: '0.3rem' }}>NO. OF ROLLS *</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 2"
                  value={inwardButterForm.rolls}
                  onChange={e => setInwardButterForm(f => ({ ...f, rolls: e.target.value }))}
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.28)', fontSize: '0.88rem', fontWeight: 800, background: 'rgba(11, 17, 32, 0.90)', color: '#ffffff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#c084fc', marginBottom: '0.3rem' }}>TOTAL WEIGHT (KG) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  required
                  placeholder="e.g. 45.5"
                  value={inwardButterForm.weightKg}
                  onChange={e => setInwardButterForm(f => ({ ...f, weightKg: e.target.value }))}
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '2px solid rgba(192, 132, 252, 0.50)', fontSize: '0.92rem', fontWeight: 900, color: '#c084fc', background: 'rgba(168, 85, 247, 0.14)' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#cbd5e1', marginBottom: '0.3rem' }}>SUPPLIER / VENDOR NAME</label>
              <input
                type="text"
                placeholder="e.g. Paramount Papers / Self Purchase"
                value={inwardButterForm.vendorName}
                onChange={e => setInwardButterForm(f => ({ ...f, vendorName: e.target.value }))}
                style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.28)', fontSize: '0.88rem', fontWeight: 600, background: 'rgba(11, 17, 32, 0.90)', color: '#ffffff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#cbd5e1', marginBottom: '0.3rem' }}>REMARKS / NOTES</label>
              <input
                type="text"
                placeholder="Optional notes..."
                value={inwardButterForm.notes}
                onChange={e => setInwardButterForm(f => ({ ...f, notes: e.target.value }))}
                style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.28)', fontSize: '0.88rem', fontWeight: 500, background: 'rgba(11, 17, 32, 0.90)', color: '#ffffff' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid rgba(148, 163, 184, 0.20)', paddingTop: '0.85rem' }}>
              <button type="button" onClick={() => setShowButterPaperInwardModal(false)} className="btn-secondary" style={{ padding: '0.55rem 1.25rem' }}>
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '0.55rem 1.5rem', background: '#0284c7', borderColor: '#0284c7' }}>
                {submitting ? 'Saving...' : 'Submit Inward Entry'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── MODAL: QUICK FUSING SPEED & TEMPERATURE UPDATE (Dark Frosted Glass) ── */}
      {showSpeedTempModal && speedTempCard && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(2, 6, 23, 0.78)', backdropFilter: 'blur(8px)',
          zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.96)', width: '100%', maxWidth: '520px',
            borderRadius: '16px', boxShadow: '0 28px 64px rgba(0, 0, 0, 0.70)',
            border: '1px solid rgba(56, 189, 248, 0.35)', overflow: 'hidden', color: '#ffffff'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '1.1rem 1.35rem', background: 'rgba(11, 17, 32, 0.94)', borderBottom: '1px solid rgba(148, 163, 184, 0.20)', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(56, 189, 248, 0.20)', border: '1px solid rgba(56, 189, 248, 0.40)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Gauge size={20} color="#38bdf8" />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#ffffff' }}>
                  Job #{speedTempCard.jobNo || 'JOB'} — Fusing Specs
                </h3>
              </div>
              <button type="button" onClick={() => setShowSpeedTempModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>

            {/* Card Information Summary Badge */}
            <div style={{ padding: '0.85rem 1.35rem', background: 'rgba(30, 41, 59, 0.65)', borderBottom: '1px solid rgba(148, 163, 184, 0.18)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, display: 'block' }}>PARTY</span>
                <strong style={{ color: '#ffffff', fontWeight: 800 }}>{speedTempCard.party || '—'}</strong>
              </div>
              <div>
                <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, display: 'block' }}>DESIGN</span>
                <strong style={{ color: '#38bdf8', fontWeight: 800 }}>{speedTempCard.designName || speedTempCard.designNo || '—'}</strong>
              </div>
              <div>
                <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, display: 'block' }}>FABRIC &amp; PANNA</span>
                <strong style={{ color: '#ffffff', fontWeight: 700 }}>{speedTempCard.fabric || 'Fabric'} {speedTempCard.panna ? `(${speedTempCard.panna}")` : ''}</strong>
              </div>
              <div>
                <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, display: 'block' }}>PRINTED METERS</span>
                <strong style={{ color: '#34d399', fontWeight: 800 }}>{getCardPrintedMeters(speedTempCard) || '0'} mtr</strong>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveSpeedTemp} style={{ padding: '1.25rem 1.35rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              
              {/* 1. Fusing Machine */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  <Cpu size={14} /> FUSING MACHINE *
                </label>
                <select
                  value={speedTempForm.fusingMachine}
                  onChange={e => setSpeedTempForm(f => ({ ...f, fusingMachine: e.target.value }))}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1.5px solid rgba(148, 163, 184, 0.28)', fontSize: '0.9rem', fontWeight: 800, background: 'rgba(11, 17, 32, 0.90)', color: '#38bdf8', cursor: 'pointer' }}
                >
                  {DEFAULT_FUSING_MACHINES.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* 2. Fusing Temperature */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 800, color: '#fbbf24', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  <Thermometer size={14} /> FUSING TEMPERATURE (°C) *
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <input
                    type="text"
                    required
                    value={speedTempForm.fusingTemp}
                    onChange={e => setSpeedTempForm(f => ({ ...f, fusingTemp: e.target.value }))}
                    placeholder="e.g. 210°C"
                    style={{ flex: 1, padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1.5px solid rgba(251, 191, 36, 0.40)', fontSize: '0.92rem', fontWeight: 800, background: 'rgba(245, 158, 11, 0.14)', color: '#fbbf24' }}
                  />
                </div>
                {/* Preset Chips */}
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {['180°C', '190°C', '200°C', '210°C', '215°C', '220°C', '225°C', '230°C'].map(temp => (
                    <button
                      key={temp}
                      type="button"
                      onClick={() => setSpeedTempForm(f => ({ ...f, fusingTemp: temp }))}
                      style={{
                        padding: '2px 8px', fontSize: '0.72rem', fontWeight: 800, borderRadius: '4px', cursor: 'pointer',
                        background: speedTempForm.fusingTemp === temp ? '#d97706' : 'rgba(245, 158, 11, 0.16)',
                        color: speedTempForm.fusingTemp === temp ? '#ffffff' : '#fbbf24',
                        border: '1px solid rgba(251, 191, 36, 0.40)', transition: 'all 0.1s'
                      }}
                    >
                      {temp}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Fusing Speed */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  <Gauge size={14} /> FUSING MACHINE SPEED (m/min) *
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <select
                    required
                    value={speedTempForm.fusingSpeed || '80'}
                    onChange={e => setSpeedTempForm(f => ({ ...f, fusingSpeed: e.target.value }))}
                    style={{ flex: 1, padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1.5px solid rgba(56, 189, 248, 0.40)', fontSize: '0.92rem', fontWeight: 800, background: 'rgba(56, 189, 248, 0.14)', color: '#38bdf8', cursor: 'pointer' }}
                  >
                    {speedTempForm.fusingSpeed && !FUSING_SPEED_OPTIONS.map(String).includes(String(speedTempForm.fusingSpeed).replace(/[^0-9]/g, '')) && (
                      <option value={speedTempForm.fusingSpeed}>{speedTempForm.fusingSpeed}</option>
                    )}
                    {FUSING_SPEED_OPTIONS.map(spd => (
                      <option key={spd} value={String(spd)}>
                        {spd}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Preset Chips */}
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {FUSING_SPEED_OPTIONS.map(spd => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setSpeedTempForm(f => ({ ...f, fusingSpeed: String(spd) }))}
                      style={{
                        padding: '2px 8px', fontSize: '0.72rem', fontWeight: 800, borderRadius: '4px', cursor: 'pointer',
                        background: String(speedTempForm.fusingSpeed) === String(spd) ? '#2563eb' : 'rgba(56, 189, 248, 0.16)',
                        color: String(speedTempForm.fusingSpeed) === String(spd) ? '#ffffff' : '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.40)', transition: 'all 0.1s'
                      }}
                    >
                      {spd}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowSpeedTempModal(false)}
                  style={{ padding: '0.6rem 1.1rem', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.28)', background: 'rgba(30, 41, 59, 0.85)', color: '#e2e8f0', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '0.6rem 1.4rem', borderRadius: '8px', border: 'none',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff', fontWeight: 900, fontSize: '0.88rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)'
                  }}
                >
                  {submitting ? <RefreshCw size={16} className="spin-loader" /> : <Zap size={16} />}
                  Save &amp; Update Speed &amp; Temp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: AI TEXTILE MEASUREMENT & YIELD AGENT ── */}
      {showAiModal && (
        <AIMeasurementAgentModal
          isOpen={showAiModal}
          onClose={() => setShowAiModal(false)}
          initialData={{
            fabric: topForm?.fabricName || '',
            panna: topForm?.panna || '58"',
            meters: topForm?.printedMtr || 100,
            fusingMtr: topForm?.printedMtr || 100
          }}
          onApply={(data) => {
            setTopForm(prev => ({
              ...prev,
              freshMtr: String(data.freshMtr || prev.freshMtr),
              fusingTemp: data.temp || prev.fusingTemp,
              fusingSpeed: data.speed ? String(data.speed).replace(/\D/g, '') : prev.fusingSpeed,
              panna: data.panna || prev.panna
            }));
            triggerPushNotification(
              '✨ AI Fusing Yield Applied',
              `Applied ${data.freshMtr}m Fresh Output (${data.shrinkagePct}% shrinkage, ${data.temp} @ ${data.speed})`,
              'success'
            );
          }}
        />
      )}

    </div>
  );
}
