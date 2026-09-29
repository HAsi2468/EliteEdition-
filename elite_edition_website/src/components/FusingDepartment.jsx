import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import {
  Flame, PlusCircle, Search, RefreshCw, Trash2, Edit2, Edit, CheckCircle2,
  AlertCircle, Cpu, Calendar, Clock, User, Layers, ArrowUpRight, Check,
  X, Download, Eye, Layers3, Activity, Tag, FileText, FileSpreadsheet,
  AlertTriangle, Gauge, Thermometer, Zap, Scale, Settings, XCircle, ChevronDown,
  ChevronUp, PlayCircle, Filter, ArrowRight
} from 'lucide-react';
import { triggerPushNotification, triggerGlobalDataRefresh } from './NotificationToast';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY, toLocalYMD } from '../utils/dateUtils';
import { matchSearchQuery } from '../utils/searchUtils';
import { triggerEliteAlert, triggerEliteConfirm } from './EliteModalDialog';
import DateRangePicker, { getDatePresetRange } from './DateRangePicker';
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

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Ready for Fusing', 'Fusing Pending', 'Fusing In Progress', 'Fusing Done', 'Rejected'
  const [filterMachine, setFilterMachine] = useState('');
  const [filterOperator, setFilterOperator] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');

  // Pagination State for INP & Fast Instant Chunking
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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
  const [activeFusingTab, setActiveFusingTab] = useState('entry'); // 'entry' | 'queue'
  const [isFormExpanded, setIsFormExpanded] = useState(true);
  const [queueFabricFilter, setQueueFabricFilter] = useState('All');
  const [queueSearchQuery, setQueueSearchQuery] = useState('');

  // Top Form Job Search & Eligibility State
  const [jobSearchText, setJobSearchText] = useState('');
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

  // ── TOP FORM STATE (New Fusing Entry) ───────────────────────────────────
  const [topForm, setTopForm] = useState({
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
    fusingMtr: '',
    fusingOperator: accountFullName,
    notes: ''
  });

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
    const interval = setInterval(fetchData, 30000);
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
      const res = await api.getJobCards({ limit: 5000, department: 'digital_print' });
      const allCards = res?.data || (Array.isArray(res) ? res : []);
      setCards(allCards);

      try {
        const rawRes = await api.getRawMaterialTransactions();
        const txns = rawRes?.transactions || (Array.isArray(rawRes) ? rawRes : []);
        setRawMatTxns(txns);
      } catch (rmErr) {
        console.warn('Failed to load raw material transactions:', rmErr);
      }
    } catch (err) {
      setError(err.message || 'Failed to load fusing job cards data.');
    } finally {
      setLoading(false);
    }
  };

  // Filter only cards that are Done for Printing and Pending for Fusing
  const eligibleFusingCards = useMemo(() => {
    return cards.filter(c => {
      if (showAllCardsFilter) return true;
      if (topForm.jobCardId && (String(c._id) === String(topForm.jobCardId) || String(c.id) === String(topForm.jobCardId))) {
        return true;
      }
      const pStatus = String(c.printStatus || '').toLowerCase();
      const isPrintDone = pStatus === 'printing done' || (pStatus.includes('done') && !pStatus.includes('pending'));
      const fStatus = String(c.fusingStatus || 'fusing pending').toLowerCase();
      const isFusingPending = fStatus !== 'fusing done';
      return isPrintDone && isFusingPending;
    });
  }, [cards, topForm.jobCardId, showAllCardsFilter]);

  const searchMatchingCards = useMemo(() => {
    const list = eligibleFusingCards;
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
  }, [eligibleFusingCards, jobSearchText]);

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

  // Handle Selection of Job Card in Top Form
  const handleTopJobCardSelect = (cardOrId) => {
    if (!cardOrId) {
      setTopForm(prev => ({
        ...prev,
        jobCardId: '',
        jobNo: '',
        printedMtr: '',
        fusingMtr: '',
        butterPaperWeightKg: ''
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
        const defaultMtr = pMtr || (c.fusingMtr ? String(c.fusingMtr).match(/[\d.]+/)?.[0] : '') || '';
        const cardPanna = c.panna ? (String(c.panna).includes('"') ? c.panna : `${c.panna}"`) : '58"';
        const preset = getFabricFusingPreset(c.fabric);
        const jobDisplay = formatJobCardNo(c.jobNo);
        setTopForm(prev => ({
          ...prev,
          jobCardId: c._id || c.id,
          jobNo: c.jobNo || '',
          panna: cardPanna,
          printedMtr: pMtr,
          fusingMtr: defaultMtr,
          fusingTemp: c.fusingTemp || c.temperature || preset.temp,
          fusingSpeed: c.fusingSpeed || c.speed || preset.speed || '80',
          fusingMachine: c.fusingMachine || prev.fusingMachine,
          butterPaperWeightKg: c.butterPaperWeightKg || '',
          rollCompleted: c.fusingStatus === 'Fusing Done' ? 'Complete' : ((c.fusingStatus === 'Fusing In Progress' || c.fusingStatus === 'Partial Complete') ? 'Partial Complete' : prev.rollCompleted || 'Complete')
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
        fusingMtr: '',
        butterPaperWeightKg: ''
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

    const fusingMtrVal = topForm.fusingMtr || topForm.printedMtr || '0';
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
        const payload = {
          fusingStatus: fusingStatusToSave,
          fusingDate: topForm.date,
          shift: topForm.shift,
          fusingMachine: topForm.fusingMachine,
          fusingTemp: topForm.fusingTemp,
          temperature: topForm.fusingTemp,
          fusingSpeed: topForm.fusingSpeed,
          speed: topForm.fusingSpeed,
          panna: topForm.panna,
          butterPaperWeightKg: String(topForm.butterPaperWeightKg || 0),
          fusingMtr: String(fusingMtrVal),
          freshMtr: String(fusingMtrVal),
          fusingOperator: topForm.fusingOperator,
          emergencyNotes: `Roll Status: ${rollStatus}${topForm.notes ? ' | ' + topForm.notes : ''}`
        };
        await api.updateJobCard(targetId, payload);
      }

      // 2. Log Raw Material Consumption for Butter Paper (Weight in KG)
      if (topForm.useButterPaper === 'Yes' && topForm.butterPaperWeightKg && Number(topForm.butterPaperWeightKg) > 0) {
        try {
          await api.createRawMaterialTransaction({
            type: 'OUTWARD',
            date: topForm.date,
            materialName: 'Butter Paper',
            qty: Number(topForm.butterPaperWeightKg),
            unit: 'Kg',
            panna: topForm.panna,
            jobNo: topForm.jobNo,
            notes: `Fusing Entry — Machine: ${topForm.fusingMachine} | Operator: ${topForm.fusingOperator} | Roll Status: ${rollStatus}`
          });
        } catch (rmErr) {
          console.warn('Raw material log failed:', rmErr.message);
        }
      }

      triggerPushNotification(
        '🔥 Fusing Entry Submitted',
        `Job #${topForm.jobNo}: ${fusingMtrVal}m Fused | Roll: ${rollStatus} | ${topForm.useButterPaper === 'Yes' ? (topForm.butterPaperWeightKg || 0) + 'kg Butter Paper' : 'No Butter Paper'} logged!`,
        'success'
      );

      triggerGlobalDataRefresh('fusing');
      
      // Reset form
      setTopForm({
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

  // Open Edit Modal for a card
  const openFusingModal = (card) => {
    setSelectedCard(card);
    const printedM = getCardPrintedMeters(card);
    const defaultFresh = card.freshMtr || card.fusingMtr || printedM || card.totalMtr || '';
    const cardPanna = card.panna ? (String(card.panna).includes('"') ? card.panna : `${card.panna}"`) : '58"';
    const cardButterUsed = card.useButterPaper || (parseFloat(card.butterPaperWeightKg) > 0 ? 'Yes' : 'No');

    setForm({
      jobCardId: card._id || card.id,
      jobNo: card.jobNo || '',
      fusingStatus: card.fusingStatus || 'Fusing Done',
      fusingDate: card.fusingDate || toLocalYMD(),
      panna: cardPanna,
      useButterPaper: cardButterUsed,
      
      freshMtr: defaultFresh,
      fabricFaultMtr: card.fabricFaultMtr !== undefined && card.fabricFaultMtr !== '' ? String(card.fabricFaultMtr) : '0',
      fusingFaultMtr: card.fusingFaultMtr !== undefined && card.fusingFaultMtr !== '' ? String(card.fusingFaultMtr) : '0',
      printFaultMtr: card.printFaultMtr !== undefined && card.printFaultMtr !== '' ? String(card.printFaultMtr) : '0',
      genuineFaultMtr: card.genuineFaultMtr !== undefined && card.genuineFaultMtr !== '' ? String(card.genuineFaultMtr) : '0',
      
      fusingTemp: card.fusingTemp || card.temperature || '210°C',
      fusingSpeed: card.fusingSpeed || card.speed || '80',
      fusingMachine: card.fusingMachine || DEFAULT_FUSING_MACHINES[0],
      fusingOperator: card.fusingOperator || accountFullName,
      shift: card.shift || getAutoShift(),
      butterPaperWeightKg: card.butterPaperWeightKg || '',
      notes: card.emergencyNotes || card.note1 || ''
    });

    // Populate top form so user can view and edit values directly in top form as well!
    setTopForm({
      date: card.fusingDate || toLocalYMD(),
      shift: card.shift || getAutoShift(),
      onTime: '09:00',
      offTime: '19:00',
      jobCardId: card._id || card.id,
      jobNo: card.jobNo || '',
      fusingMachine: card.fusingMachine || DEFAULT_FUSING_MACHINES[0],
      fusingTemp: card.fusingTemp || card.temperature || '210°C',
      fusingSpeed: card.fusingSpeed || card.speed || '80',
      panna: cardPanna,
      useButterPaper: cardButterUsed,
      butterPaperWeightKg: card.butterPaperWeightKg || '',
      rollCompleted: card.fusingStatus === 'Fusing Done' ? 'Complete' : ((card.fusingStatus === 'Fusing In Progress' || card.fusingStatus === 'Partial Complete') ? 'Partial Complete' : 'Pending'),
      printedMtr: printedM || defaultFresh,
      fusingMtr: defaultFresh,
      fusingOperator: card.fusingOperator || accountFullName,
      notes: card.emergencyNotes || card.note1 || ''
    });

    setShowFormModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!form.jobCardId) {
      triggerEliteAlert('Please select a valid Job Card.');
      return;
    }

    const freshMtrVal = parseFloat(form.freshMtr) || 0;
    const wasteMtr = parseFloat(calculatedWastageMtr) || 0;
    const totalFabricUsed = (freshMtrVal + wasteMtr).toFixed(2);
    const finalButterKg = form.useButterPaper === 'No' ? '0' : String(form.butterPaperWeightKg || 0);

    setSubmitting(true);
    try {
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
        fusingSpeed: String(form.fusingSpeed),
        fusingMachine: form.fusingMachine,
        fusingOperator: form.fusingOperator,
        emergencyNotes: form.notes,
        notes: form.notes
      };

      await api.updateJobCard(form.jobCardId, payload);
      triggerPushNotification('🔥 Fusing Record Updated', `Job #${form.jobNo}: ${freshMtrVal}m Fresh | ${wasteMtr}m Wastage updated.`, 'success');
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
      return { start: customDateStart, end: customDateEnd };
    }
    if (datePreset && datePreset !== 'all') {
      try {
        return getDatePresetRange(datePreset) || { start: '', end: '' };
      } catch (e) {
        return { start: '', end: '' };
      }
    }
    return { start: dateStart || '', end: dateEnd || '' };
  }, [datePreset, customDateStart, customDateEnd, dateStart, dateEnd]);

  // Filtered Cards with full debouncing & enterprise status filters
  const filteredCards = useMemo(() => {
    return cards.filter(c => {
      if (debouncedSearch && !matchSearchQuery(c, debouncedSearch, ['jobNo', 'party', 'designName', 'fabric', 'fusingOperator', 'fusingMachine'])) {
        return false;
      }
      if (statusFilter !== 'All') {
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
      if (filterMachine && (c.fusingMachine || '') !== filterMachine) {
        return false;
      }
      if (filterOperator && (c.fusingOperator || '') !== filterOperator) {
        return false;
      }
      const cDate = c.fusingDate || c.date;
      if (activeDateRange.start && cDate && cDate < activeDateRange.start) return false;
      if (activeDateRange.end && cDate && cDate > activeDateRange.end) return false;

      return true;
    });
  }, [cards, debouncedSearch, statusFilter, filterMachine, filterOperator, activeDateRange]);

  // Paginated Chunking for INP < 100ms
  const paginatedCards = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredCards.slice(startIdx, startIdx + pageSize);
  }, [filteredCards, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / pageSize));

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
      const isDone = c.fusingStatus === 'Fusing Done';
      if (c.printStatus === 'Printing Done' && c.fusingStatus !== 'Fusing Done') {
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
      'Butter Paper (kg)', 'Fresh Mtr', 'Fabric Fault (m)', 'Fusing Fault (m)',
      'Print Fault (m)', 'Genuine Fault (m)', 'Total Wastage (m)', 'Machine', 'Operator'
    ];
    
    const rows = filteredCards.map(c => [
      c.jobNo || '',
      c.fusingDate || '',
      c.shift || 'Morning',
      `"${(c.party || '').replace(/"/g, '""')}"`,
      `"${(c.designName || '').replace(/"/g, '""')}"`,
      `"${(c.fabric || '').replace(/"/g, '""')}"`,
      c.panna || '',
      c.butterPaperWeightKg || 0,
      c.freshMtr || c.fusingMtr || 0,
      c.fabricFaultMtr || 0,
      c.fusingFaultMtr || 0,
      c.printFaultMtr || 0,
      c.genuineFaultMtr || 0,
      c.totalWastageMtr || 0,
      `"${(c.fusingMachine || '').replace(/"/g, '""')}"`,
      `"${(c.fusingOperator || '').replace(/"/g, '""')}"`
    ]);

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

      {/* ── SCREEN HEADER (Clean & Minimal) ── */}
      <header className="fusing-header-section">
        <div className="fusing-title-row">
          <div className="fusing-title-group">
            <div className="fusing-title-icon" aria-hidden="true">
              <Flame size={20} />
            </div>
            <div>
              <h1 className="fusing-main-title">Jobcards Fusing Log</h1>
            </div>
          </div>

          <div className="fusing-header-actions">
            <button
              type="button"
              className="fusing-btn-secondary"
              onClick={fetchData}
              disabled={loading}
              aria-label="Refresh fusing records"
              title="Refresh fusing logs data"
            >
              <RefreshCw size={14} className={loading ? 'spin-loader' : ''} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              className="fusing-btn-accent"
              onClick={() => setShowButterPaperInwardModal(true)}
              aria-label="Inward Butter Paper rolls"
            >
              <PlusCircle size={14} />
              <span>Inward Butter Paper</span>
            </button>
            <button
              type="button"
              className="fusing-btn-secondary"
              onClick={() => setShowReportModal(true)}
              aria-label="Generate comprehensive fusing report"
            >
              <Zap size={14} />
              <span>Report</span>
            </button>
            <button
              type="button"
              className="fusing-btn-primary"
              onClick={handleExportCSV}
              aria-label="Download CSV report"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── NAVIGATION SUBTABS ── */}
      <div className="fusing-subnav-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeFusingTab === 'entry'}
          className={`fusing-subnav-btn ${activeFusingTab === 'entry' ? 'active' : ''}`}
          onClick={() => setActiveFusingTab('entry')}
          aria-label="Production Logs tab"
        >
          <Flame size={15} />
          <span>Production Logs</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeFusingTab === 'queue'}
          className={`fusing-subnav-btn ${activeFusingTab === 'queue' ? 'active' : ''}`}
          onClick={() => setActiveFusingTab('queue')}
          aria-label="Ready for Fusing Queue tab"
        >
          <Clock size={15} />
          <span>Ready Queue</span>
          <span className="fusing-count-badge">
            {eligibleFusingCards.length}
          </span>
        </button>
      </div>

      {/* ── TAB 1: PRODUCTION ENTRY & LOGS ── */}
      {activeFusingTab === 'entry' && (
      <>
      {/* ── TOP SECTION: NEW FUSING ENTRY FORM CARD (Matches User Reference Image) ── */}
      <div className="glass-panel" style={{
        padding: '1.35rem 1.5rem',
        borderRadius: '16px',
        boxShadow: '0 10px 30px -10px rgba(2, 132, 199, 0.12)',
        background: '#ffffff',
        border: '1px solid #e0f2fe'
      }}>
        {/* Form Card Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isFormExpanded ? '1.25rem' : '0.5rem', flexWrap: 'wrap', gap: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: '#e0f2fe',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7'
            }}>
              <PlusCircle size={18} />
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0284c7', margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              NEW FUSING ENTRY
            </h3>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>

            <button
              type="button"
              onClick={() => setIsFormExpanded(prev => !prev)}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '0.78rem',
                fontWeight: 800,
                color: '#0369a1',
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
            background: '#f8fafc',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            border: '1px dashed #94a3b8'
          }}>
            <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 700 }}>
              {topForm.jobCardId ? `Active Selection: ${formatJobCardNo(topForm.jobNo)} (${topForm.printedMtr || 0} mtr)` : 'Fusing Entry Form is minimized. Click expand to enter production log.'}
            </span>
            <button
              type="button"
              onClick={() => setIsFormExpanded(true)}
              style={{
                background: '#0284c7',
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
          <form onSubmit={handleTopFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Row 1: DATE, SHIFT, ON TIME, OFF TIME */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                DATE *
              </label>
              <input
                type="date"
                required
                value={topForm.date}
                onChange={e => setTopForm(f => ({ ...f, date: e.target.value }))}
                style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 700, background: '#ffffff', color: '#0f172a' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                SHIFT *
              </label>
              <select
                required
                value={topForm.shift}
                onChange={e => setTopForm(f => ({ ...f, shift: e.target.value }))}
                style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 700, background: '#ffffff', color: '#0f172a', cursor: 'pointer' }}
              >
                <option value="Morning">Morning</option>
                <option value="Night">Night</option>
                <option value="Shift 1">Shift 1</option>
                <option value="Shift 2">Shift 2</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 800, color: '#16a34a', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                <Clock size={12} color="#16a34a" /> START TIME
              </label>
              <input
                type="time"
                value={topForm.onTime}
                onChange={e => setTopForm(f => ({ ...f, onTime: e.target.value }))}
                style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 700, background: '#ffffff', color: '#0f172a' }}
              />
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 800, color: '#dc2626', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                <Clock size={12} color="#dc2626" /> END TIME
              </label>
              <input
                type="time"
                value={topForm.offTime}
                onChange={e => setTopForm(f => ({ ...f, offTime: e.target.value }))}
                style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 700, background: '#ffffff', color: '#0f172a' }}
              />
            </div>
          </div>

          {/* Primary Required Fields: JOB CARD NO, PRINTED METERS, FUSING TEMP, FUSING SPEED, BUTTER PAPER USED?, ROLL COMPLETED?, PANNA */}
            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
              
              {/* 1. JOB TYPE / JOBCARD NO. - Searchable & Filtered to Printing Done & Fusing Pending */}
              <div ref={jobDropdownRef} style={{ gridColumn: 'span 2 / span 2', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', flexWrap: 'wrap', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase' }}>
                    JOB TYPE / JOBCARD NO. *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAllCardsFilter(prev => !prev)}
                    style={{
                      background: showAllCardsFilter ? '#e0f2fe' : '#f0fdf4',
                      color: showAllCardsFilter ? '#0369a1' : '#15803d',
                      border: `1px solid ${showAllCardsFilter ? '#7dd3fc' : '#86efac'}`,
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
                    <span style={{ textDecoration: 'underline', opacity: 0.8 }}>({showAllCardsFilter ? 'Show Ready' : 'Show All'})</span>
                  </button>
                </div>

                {/* Search Input Box with Clear & Dropdown Caret */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={16} color="#0284c7" style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }} />
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
                    style={{
                      width: '100%',
                      padding: '0.65rem 2.8rem 0.65rem 2.2rem',
                      borderRadius: '8px',
                      border: '2px solid #38bdf8',
                      fontSize: '0.92rem',
                      fontWeight: 800,
                      background: '#ffffff',
                      color: '#0369a1',
                      boxSizing: 'border-box'
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
                          background: '#fee2e2',
                          color: '#dc2626',
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
                        color: '#0284c7',
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
                    background: '#ffffff',
                    border: '2px solid #38bdf8',
                    borderRadius: '10px',
                    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.2)',
                    zIndex: 1000,
                    marginTop: '4px'
                  }}>
                    <div style={{
                      padding: '6px 12px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      color: '#64748b',
                      background: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>
                        {showAllCardsFilter ? 'ALL JOBCARDS' : 'PRINTING DONE & FUSING PENDING'} ({searchMatchingCards.length})
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#0284c7' }}>
                        Click card to select
                      </span>
                    </div>

                    {searchMatchingCards.length === 0 ? (
                      <div style={{ padding: '1.25rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                        <p style={{ margin: 0, fontWeight: 700 }}>No matching job cards found.</p>
                        {!showAllCardsFilter && (
                          <button
                            type="button"
                            onClick={() => setShowAllCardsFilter(true)}
                            style={{
                              marginTop: '0.5rem',
                              background: '#eff6ff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe',
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
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              background: isSelected ? '#e0f2fe' : '#ffffff',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f0fdf4'; }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '#ffffff'; }}
                          >
                            <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                <span style={{ fontWeight: 900, color: '#0369a1', fontSize: '0.9rem' }}>
                                  {formatJobCardNo(c.jobNo)}
                                </span>
                                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>
                                  {c.party || 'Party'}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.74rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                Design: <strong style={{ color: '#475569' }}>{c.designName || '—'}</strong> • Fabric: <strong>{c.fabric || '—'} ({cardPanna})</strong>
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
                              <span style={{
                                padding: '1px 7px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                background: '#dcfce7',
                                color: '#15803d',
                                border: '1px solid #bbf7d0'
                              }}>
                                🖨️ {getCardPrintedMeters(c) || 0}m Printed
                              </span>
                              <span style={{
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                background: c.fusingStatus === 'Fusing Done' ? '#f1f5f9' : (c.fusingStatus === 'Fusing In Progress' ? '#e0f2fe' : '#fef3c7'),
                                color: c.fusingStatus === 'Fusing Done' ? '#64748b' : (c.fusingStatus === 'Fusing In Progress' ? '#0369a1' : '#b45309')
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

              {/* 2. PRINTED METERS (DISPLAYED) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#059669', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                  🖨️ PRINTED METERS (MTR)
                </label>
                <input
                  type="text"
                  readOnly
                  placeholder="Select Job Card to view"
                  value={topForm.printedMtr ? `${topForm.printedMtr} mtr` : ''}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #a7f3d0', fontSize: '0.92rem', fontWeight: 900, background: '#ecfdf5', color: '#047857' }}
                />
              </div>

              {/* 3. FUSING TEMPERATURE */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 800, color: '#d97706', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                  <Thermometer size={14} color="#d97706" /> FUSING TEMP (°C) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 210°C"
                  value={topForm.fusingTemp}
                  onChange={e => setTopForm(f => ({ ...f, fusingTemp: e.target.value }))}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '2px solid #fde68a', fontSize: '0.92rem', fontWeight: 900, background: '#fffbe6', color: '#92400e' }}
                />
              </div>

              {/* 4. FUSING MACHINE SPEED - Dropdown with 50, 52, 54 ... up to 80 */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 800, color: '#2563eb', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                  <Gauge size={14} color="#2563eb" /> FUSING SPEED (m/min) *
                </label>
                <select
                  required
                  value={topForm.fusingSpeed || '80'}
                  onChange={e => setTopForm(f => ({ ...f, fusingSpeed: e.target.value }))}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '2px solid #bfdbfe', fontSize: '0.92rem', fontWeight: 900, background: '#eff6ff', color: '#1e40af', cursor: 'pointer' }}
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

              {/* 6. IS BUTTER PAPER USED? */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 800, color: topForm.useButterPaper === 'Yes' ? '#6d28d9' : '#64748b', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                  <Scale size={14} color={topForm.useButterPaper === 'Yes' ? '#6d28d9' : '#64748b'} /> BUTTER PAPER USED? *
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
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: `2px solid ${topForm.useButterPaper === 'Yes' ? '#8b5cf6' : '#cbd5e1'}`,
                    fontSize: '0.92rem',
                    fontWeight: 800,
                    background: topForm.useButterPaper === 'Yes' ? '#f5f3ff' : '#ffffff',
                    color: topForm.useButterPaper === 'Yes' ? '#6d28d9' : '#475569',
                    cursor: 'pointer'
                  }}
                >
                  <option value="Yes">✓ Yes</option>
                  <option value="No">✕ No</option>
                </select>
              </div>

              {/* 7. ROLL COMPLETED? */}
              <div>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: (topForm.rollCompleted === 'Complete' || topForm.rollCompleted === 'Yes') ? '#16a34a' : (topForm.rollCompleted === 'Partial Complete' ? '#0284c7' : '#ea580c'),
                  marginBottom: '0.3rem',
                  textTransform: 'uppercase'
                }}>
                  {(topForm.rollCompleted === 'Complete' || topForm.rollCompleted === 'Yes') ? (
                    <CheckCircle2 size={14} color="#16a34a" />
                  ) : topForm.rollCompleted === 'Partial Complete' ? (
                    <Clock size={14} color="#0284c7" />
                  ) : (
                    <AlertCircle size={14} color="#ea580c" />
                  )}
                  ROLL COMPLETED? *
                </label>
                <select
                  value={topForm.rollCompleted === 'Yes' ? 'Complete' : (topForm.rollCompleted === 'No' ? 'Partial Complete' : (topForm.rollCompleted || 'Complete'))}
                  onChange={e => setTopForm(f => ({ ...f, rollCompleted: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: `2px solid ${
                      (topForm.rollCompleted === 'Complete' || topForm.rollCompleted === 'Yes') ? '#4ade80' : (topForm.rollCompleted === 'Partial Complete' ? '#38bdf8' : '#fb923c')
                    }`,
                    fontSize: '0.92rem',
                    fontWeight: 800,
                    background: (topForm.rollCompleted === 'Complete' || topForm.rollCompleted === 'Yes') ? '#f0fdf4' : (topForm.rollCompleted === 'Partial Complete' ? '#f0f9ff' : '#fff7ed'),
                    color: (topForm.rollCompleted === 'Complete' || topForm.rollCompleted === 'Yes') ? '#15803d' : (topForm.rollCompleted === 'Partial Complete' ? '#0369a1' : '#c2410c'),
                    cursor: 'pointer'
                  }}
                >
                  <option value="Complete">✓ Complete</option>
                  <option value="Partial Complete">⏳ Partial Complete</option>
                  <option value="Pending">⏸️ Pending</option>
                </select>
              </div>

              {/* 8. PANNA */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 800, color: '#0284c7', margin: 0, textTransform: 'uppercase' }}>
                    <Layers size={14} color="#0284c7" /> PANNA *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPannaManagerModal(true)}
                    style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.7rem', fontWeight: 800 }}
                  >
                    <Settings size={12} /> Edit
                  </button>
                </div>
                <select
                  required
                  value={topForm.panna}
                  onChange={e => setTopForm(f => ({ ...f, panna: e.target.value }))}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.92rem', fontWeight: 800, background: '#ffffff', color: '#0369a1', cursor: 'pointer' }}
                >
                  {pannaOptions.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Smart Heat & Speed Guard Indicator Banner */}
              {activeFabricPreset && (
                <div style={{
                  gridColumn: '1 / -1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                  padding: '0.6rem 0.95rem',
                  borderRadius: '8px',
                  background: isHeatWarning ? '#fff1f2' : '#f0fdf4',
                  border: `1.5px solid ${isHeatWarning ? '#fda4af' : '#86efac'}`,
                  fontSize: '0.82rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Thermometer size={16} color={isHeatWarning ? '#e11d48' : '#16a34a'} />
                    <span style={{ color: isHeatWarning ? '#9f1239' : '#166534', fontWeight: 800 }}>
                      {activeSelectedCard?.fabric || 'Fabric'} Thermal Guard: Recommended {activeFabricPreset.temp} @ {activeFabricPreset.speed} m/min ({activeFabricPreset.note})
                    </span>
                  </div>
                  {isHeatWarning ? (
                    <span style={{ color: '#e11d48', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}>
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
                        background: '#dcfce7',
                        color: '#15803d',
                        border: '1px solid #86efac',
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                OPERATOR NAME
              </label>
              <input
                type="text"
                value={topForm.fusingOperator}
                onChange={e => setTopForm(f => ({ ...f, fusingOperator: e.target.value }))}
                placeholder="Operator Name..."
                style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 600, background: '#ffffff', color: '#0f172a' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', flexWrap: 'wrap', gap: '4px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  REMARKS / NOTES
                </label>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {['Heat Crease', 'Fabric Shrinkage', 'Paper Jam', 'Color Bleed', 'Roller Mark'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTopForm(f => ({ ...f, notes: f.notes ? `${f.notes}, [${tag}]` : `[${tag}]` }))}
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '1px 6px', fontSize: '0.68rem', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
                    >
                      +{tag}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="text"
                value={topForm.notes}
                onChange={e => setTopForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes e.g. Butter Paper Roll #2..."
                style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 500, background: '#ffffff', color: '#0f172a' }}
              />
            </div>
          </div>

          {/* Submit Action Button */}
          <div style={{ marginTop: '0.4rem' }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '0.75rem 1.8rem',
                borderRadius: '10px',
                fontSize: '0.92rem',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
                transition: 'all 0.15s'
              }}
            >
              {submitting ? <RefreshCw size={18} className="spin-loader" /> : <PlusCircle size={18} />}
              <span>Submit Fusing Entry Log</span>
            </button>
          </div>
        </form>
        )}
      </div>

      {/* ── ENTERPRISE SUMMARY KPI METRICS GRID ── */}
      <section className="fusing-metrics-grid" aria-label="Fusing production KPI metrics">
        {/* Today Fresh Output */}
        <div className="fusing-metric-card">
          <div className="fusing-metric-top">
            <span className="fusing-metric-label">Today Fresh Output</span>
            <Flame size={18} color="#1E40AF" />
          </div>
          <div className="fusing-metric-val" style={{ color: '#1E40AF' }}>
            {stats.todayFreshMtr.toLocaleString('en-IN')}
            <span className="fusing-metric-unit">meters</span>
          </div>
          <div className="fusing-metric-subtitle">Fused & ready for dispatch</div>
        </div>

        {/* Total Butter Paper Consumed */}
        <div className="fusing-metric-card accent-purple">
          <div className="fusing-metric-top">
            <span className="fusing-metric-label">Butter Paper Used</span>
            <Scale size={18} color="#7C3AED" />
          </div>
          <div className="fusing-metric-val" style={{ color: '#7C3AED' }}>
            {stats.totalButterPaperKg.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
            <span className="fusing-metric-unit">kg</span>
          </div>
          <div className="fusing-metric-subtitle">
            Stock Balance: {stats.butterPaperBalanceKg >= 0 ? `${stats.butterPaperBalanceKg.toFixed(1)} kg available` : 'Low / Reorder'}
          </div>
        </div>

        {/* Paper Yield Efficiency */}
        <div className="fusing-metric-card accent-teal">
          <div className="fusing-metric-top">
            <span className="fusing-metric-label">Paper Yield Ratio</span>
            <Zap size={18} color="#0D9488" />
          </div>
          <div className="fusing-metric-val" style={{ color: '#0D9488' }}>
            {stats.yieldRatio}
            <span className="fusing-metric-unit">m/kg</span>
          </div>
          <div className="fusing-metric-subtitle" style={{ color: Number(stats.yieldRatio) >= 12 ? '#059669' : '#D97706' }}>
            {Number(stats.yieldRatio) >= 12 ? '✓ Optimal Paper Yield' : Number(stats.yieldRatio) > 0 ? '⚠️ High Paper Usage' : 'Awaiting Output'}
          </div>
        </div>

        {/* Completed Jobs */}
        <div className="fusing-metric-card accent-emerald">
          <div className="fusing-metric-top">
            <span className="fusing-metric-label">Completed Jobs</span>
            <CheckCircle2 size={18} color="#059669" />
          </div>
          <div className="fusing-metric-val" style={{ color: '#059669' }}>
            {stats.doneCount}
            <span className="fusing-metric-unit">cards</span>
          </div>
          <div className="fusing-metric-subtitle">
            {stats.totalFreshMtr.toLocaleString('en-IN')} total meters fused
          </div>
        </div>

        {/* Pending Fusing */}
        <div className="fusing-metric-card accent-amber">
          <div className="fusing-metric-top">
            <span className="fusing-metric-label">Pending Fusing</span>
            <Clock size={18} color="#D97706" />
          </div>
          <div className="fusing-metric-val" style={{ color: '#D97706' }}>
            {stats.pendingCount}
            <span className="fusing-metric-unit">cards</span>
          </div>
          <div className="fusing-metric-subtitle">Awaiting heat press run</div>
        </div>
      </section>

      {/* ── QUICK FILTERS & SEARCH TOOLBAR ── */}
      <section className="fusing-filters-wrapper" aria-label="Job card filtering controls">
        <div className="fusing-filters-main-row">
          
          {/* Debounced Search */}
          <div className="fusing-search-box">
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

          {/* Machine Filter Dropdown */}
          <select
            className="fusing-filter-select"
            value={filterMachine}
            onChange={e => { setFilterMachine(e.target.value); setCurrentPage(1); }}
            aria-label="Filter by Fusing Machine"
          >
            <option value="">All Machines ({uniqueMachines.length})</option>
            {uniqueMachines.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Operator Filter Dropdown */}
          <select
            className="fusing-filter-select"
            value={filterOperator}
            onChange={e => { setFilterOperator(e.target.value); setCurrentPage(1); }}
            aria-label="Filter by Operator"
          >
            <option value="">All Operators ({uniqueOperators.length})</option>
            {uniqueOperators.map(op => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
        </div>

        {/* Fast Filter Status Tags */}
        <div className="fusing-status-tags" role="group" aria-label="Status filter tags">
          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--ee-fusing-text-muted)', textTransform: 'uppercase', marginRight: '4px' }}>
            Status:
          </span>

          {[
            { id: 'All', label: 'All Jobs', count: cards.length },
            { id: 'Ready for Fusing', label: 'Ready for Fusing', count: stats.readyForFusingCount, badgeClass: 'active-amber' },
            { id: 'Pending', label: 'Pending', count: stats.pendingCount },
            { id: 'In-Process', label: 'In-Process' },
            { id: 'Completed', label: 'Completed', count: stats.doneCount, badgeClass: 'active-emerald' },
            { id: 'Rejected', label: 'Has Wastage / Rejections' }
          ].map(tag => {
            const isActive = statusFilter === tag.id || (tag.id === 'Pending' && statusFilter === 'Fusing Pending') || (tag.id === 'In-Process' && statusFilter === 'Fusing In Progress') || (tag.id === 'Completed' && statusFilter === 'Fusing Done');
            return (
              <button
                key={tag.id}
                type="button"
                className={`fusing-tag-pill ${isActive ? (tag.badgeClass || 'active') : ''}`}
                onClick={() => { setStatusFilter(tag.id); setCurrentPage(1); }}
                aria-pressed={isActive}
              >
                {tag.id === 'Ready for Fusing' && <Flame size={13} />}
                {tag.id === 'Completed' && <CheckCircle2 size={13} />}
                {tag.id === 'Pending' && <Clock size={13} />}
                <span>{tag.label}</span>
                {tag.count !== undefined && (
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: isActive ? 'rgba(255,255,255,0.25)' : '#F1F5F9',
                    color: isActive ? '#FFFFFF' : '#475569',
                    fontWeight: 800
                  }}>
                    {tag.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── MAIN FUSING PRODUCTION LEDGER (DUAL VIEW: DESKTOP TABLE & MOBILE CARDS) ── */}
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
          <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: '#FFFFFF', borderRadius: '12px', border: '1px solid var(--ee-fusing-border)' }}>
            <Flame size={32} color="#94A3B8" style={{ margin: '0 auto 8px', display: 'block' }} />
            <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 800, color: 'var(--ee-fusing-text-primary)' }}>No Fusing Records Found</h3>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--ee-fusing-text-muted)' }}>
              No job cards match the current search keyword or filter selection. Try clearing filters.
            </p>
          </div>
        ) : (
          <>
            {/* 1. DESKTOP HIGH-DENSITY DATA TABLE (>= 1024px) */}
            <div className="fusing-desktop-table-wrapper">
              <div className="fusing-table-scroll">
                <table className="fusing-table" role="table">
                  <thead>
                    <tr>
                      <th scope="col">Job Card #</th>
                      <th scope="col">Party Name</th>
                      <th scope="col">Design &amp; Fabric</th>
                      <th scope="col" style={{ textAlign: 'center' }}>Speed &amp; Temp</th>
                      <th scope="col" style={{ textAlign: 'center' }}>Butter Paper</th>
                      <th scope="col" style={{ textAlign: 'center' }}>Status</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Fresh Output</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Total Wastage</th>
                      <th scope="col" className="fusing-sticky-col-header">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCards.map((c) => {
                      const isDone = c.fusingStatus === 'Fusing Done';
                      const isPartial = c.fusingStatus === 'Fusing In Progress' || c.fusingStatus === 'Partial Complete';
                      const fresh = parseFloat(c.freshMtr || c.fusingMtr) || 0;
                      const waste = parseFloat(c.totalWastageMtr) || 0;
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
                                <span style={{ fontSize: '0.88rem', fontWeight: 900, color: 'var(--ee-fusing-brand-navy)', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                                  {c.jobNo || 'JOB'}
                                </span>
                                <Gauge size={12} color="#1E40AF" />
                                {c.pass && (
                                  <span style={{ fontSize: '0.65rem', background: '#EFF6FF', color: '#1E40AF', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
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
                                <span style={{ padding: '1px 5px', borderRadius: 4, background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', fontSize: '0.68rem', fontWeight: 800 }}>
                                  ⚡ Print Ready
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--ee-fusing-text-secondary)', marginTop: 2 }}>
                              {c.fabric || 'Fabric'} {c.panna ? `(${c.panna}")` : ''}
                            </div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: 3, padding: '1px 6px', borderRadius: 4, background: '#FEF3C7', border: '1px solid #FDE68A', fontSize: '0.68rem', color: '#92400E', fontWeight: 700 }}>
                              <Flame size={10} /> Preset: {preset.temp} @ {preset.speed}
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

                          {/* Fresh Output */}
                          <td style={{ textAlign: 'right', fontWeight: 900, color: '#059669', fontSize: '0.92rem' }}>
                            {fresh > 0 ? `${fresh.toLocaleString('en-IN')} m` : '—'}
                          </td>

                          {/* Total Wastage */}
                          <td style={{ textAlign: 'right', fontWeight: 800, color: waste > 0 ? '#DC2626' : '#94A3B8' }}>
                            {waste > 0 ? `${waste} m` : '0 m'}
                          </td>

                          {/* Actions (Sticky Column) */}
                          <td className="fusing-sticky-col-cell">
                            <button
                              type="button"
                              onClick={() => openFusingModal(c)}
                              className="fusing-btn-primary"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', minHeight: '32px' }}
                              aria-label={`Edit fusing production entry for Job ${c.jobNo}`}
                            >
                              <Edit2 size={13} /> Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. MOBILE SCANNABLE SHOP-FLOOR CARDS (< 1024px) */}
            <div className="fusing-mobile-cards-wrapper" role="feed" aria-label="Job cards mobile feed">
              {paginatedCards.map((c) => {
                const isDone = c.fusingStatus === 'Fusing Done';
                const isPartial = c.fusingStatus === 'Fusing In Progress' || c.fusingStatus === 'Partial Complete';
                const fresh = parseFloat(c.freshMtr || c.fusingMtr) || 0;
                const waste = parseFloat(c.totalWastageMtr) || 0;
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
                          <div
                            style={{
                              width: '56px',
                              height: '56px',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              flexShrink: 0,
                              background: '#f8fafc',
                              border: '1px solid var(--ee-fusing-border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <img
                              src={c.imageUrl || c.designImage || c.image1 || c.sampleImage || c.photo}
                              alt={c.designName || 'Design'}
                              loading="lazy"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                aspectRatio: '1 / 1',
                                display: 'block'
                              }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          </div>
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

                      {/* Fresh Output vs Wastage Grid */}
                      <div className="fusing-card-stats-row">
                        <div className="fusing-card-stat-item">
                          <span className="fusing-card-stat-label">Fresh Output</span>
                          <span className="fusing-card-stat-val fresh">
                            {fresh > 0 ? `${fresh.toLocaleString('en-IN')} m` : '—'}
                          </span>
                        </div>
                        <div className="fusing-card-stat-item">
                          <span className="fusing-card-stat-label">Total Wastage</span>
                          <span className={`fusing-card-stat-val ${waste > 0 ? 'waste' : ''}`}>
                            {waste > 0 ? `${waste} m` : '0 m'}
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
                        onClick={() => openFusingModal(c)}
                        className="fusing-touch-btn fusing-btn-primary"
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

            {/* 3. PAGINATION & CHUNKING CONTROLS */}
            <nav className="fusing-pagination-bar" aria-label="Job cards pagination">
              <div className="fusing-pagination-info">
                Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> – <strong>{Math.min(currentPage * pageSize, filteredCards.length)}</strong> of <strong>{filteredCards.length}</strong> Job Cards
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                {/* Page Size Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--ee-fusing-text-muted)' }}>
                  <span>Show:</span>
                  <select
                    className="fusing-filter-select"
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    style={{ minHeight: '34px', padding: '0.2rem 0.5rem' }}
                    aria-label="Items per page"
                  >
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                  </select>
                </div>

                {/* Page Navigation Buttons */}
                <div className="fusing-pagination-controls">
                  <button
                    type="button"
                    className="fusing-page-btn"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    aria-label="Go to first page"
                  >
                    «
                  </button>
                  <button
                    type="button"
                    className="fusing-page-btn"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    aria-label="Go to previous page"
                  >
                    ‹
                  </button>

                  <span style={{ fontSize: '0.84rem', fontWeight: 800, padding: '0 8px', color: 'var(--ee-fusing-text-primary)' }}>
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    className="fusing-page-btn"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    aria-label="Go to next page"
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    className="fusing-page-btn"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    aria-label="Go to last page"
                  >
                    »
                  </button>
                </div>
              </div>
            </nav>
          </>
        )}
      </section>
      </>
      )}

      {/* ── TAB 2: READY FOR FUSING QUEUE ── */}
      {activeFusingTab === 'queue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Queue Header & Filters Banner */}
          <div className="fusing-header-section" style={{ borderLeft: '4px solid var(--ee-fusing-brand-navy)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: 'var(--ee-fusing-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={20} color="#1E40AF" />
                  Ready for Fusing Queue (Handoff from Printing)
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--ee-fusing-text-muted)', fontWeight: 500 }}>
                  Jobs that completed printing and are ready for heat press sublimation. Batch identical fabrics to optimize temperature stability.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="fusing-badge done" style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
                  🔥 <strong>{eligibleFusingCards.length}</strong> Jobs In Queue
                </span>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.75rem' }}>
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
            </div>
          </div>

          {/* Dual Layout for Queue */}
          {filteredQueueCards.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: '#FFFFFF', borderRadius: '12px', border: '1px solid var(--ee-fusing-border)' }}>
              <Flame size={32} color="#94A3B8" style={{ margin: '0 auto 8px', display: 'block' }} />
              <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 800, color: 'var(--ee-fusing-text-primary)' }}>No Jobs Waiting in Fusing Queue</h3>
              <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--ee-fusing-text-muted)' }}>
                Completed prints will automatically flow into this queue for heat press processing.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table for Queue (>= 1024px) */}
              <div className="fusing-desktop-table-wrapper">
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
                            <td style={{ fontWeight: 900, color: 'var(--ee-fusing-brand-navy)' }}>
                              {formatJobCardNo(c.jobNo)}
                            </td>
                            <td style={{ fontWeight: 700, color: 'var(--ee-fusing-text-primary)' }}>
                              {c.party || c.clientName || '—'}
                            </td>
                            <td style={{ color: 'var(--ee-fusing-text-secondary)', fontWeight: 600 }}>
                              {c.designName || c.designNo || '—'}
                            </td>
                            <td>
                              <span style={{ fontWeight: 800, color: 'var(--ee-fusing-text-primary)' }}>{c.fabric || '—'}</span>
                              <span style={{ marginLeft: 6, fontSize: '0.75rem', color: 'var(--ee-fusing-text-muted)', background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px' }}>
                                {c.panna ? (String(c.panna).includes('"') ? c.panna : `${c.panna}"`) : '58"'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="fusing-chip temp">
                                <Thermometer size={12} /> {preset.temp} @ {preset.speed} m/min
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 900, color: '#059669', fontSize: '0.92rem' }}>
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

              {/* Mobile Cards for Queue (< 1024px) */}
              <div className="fusing-mobile-cards-wrapper" role="feed" aria-label="Ready for fusing queue mobile cards">
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
                            <div
                              style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                flexShrink: 0,
                                background: '#f8fafc',
                                border: '1px solid var(--ee-fusing-border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <img
                                src={c.imageUrl || c.designImage || c.image1 || c.sampleImage || c.photo}
                                alt={c.designName || 'Design'}
                                loading="lazy"
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  aspectRatio: '1 / 1',
                                  display: 'block'
                                }}
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            </div>
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

      {/* ── MODAL 1: EDIT FUSING ENTRY & WASTAGE MODAL ── */}
      {showFormModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', width: '100%', maxWidth: '640px', maxHeight: '90vh',
            borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #cbd5e1', overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Flame size={22} color="#2563eb" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>
                    Edit Fusing Production Entry — {formatJobCardNo(form.jobNo)}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Verify Fresh Output, 4-Fault Wastage breakdown &amp; calculate Total Fabric Used
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setShowFormModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleFormSubmit} style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              
              {/* Fresh Output MTR & Total Fabric Used formula box */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                
                {/* 1. Fresh Output (Net Usable MTR) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#059669', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                    Fresh Output (Net Usable MTR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.freshMtr}
                    onChange={e => setForm(f => ({ ...f, freshMtr: e.target.value }))}
                    placeholder="e.g. 138.00"
                    style={{
                      width: '100%', padding: '0.55rem', borderRadius: '8px',
                      border: '2px solid #10b981', fontWeight: 900, fontSize: '0.95rem',
                      background: '#ecfdf5', color: '#047857'
                    }}
                  />
                </div>

                {/* 2. Total Fabric Used (Fresh MTR + Total Wastage) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 900, color: '#0284c7', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                    Total Fabric Used (MTR)
                  </label>
                  <div style={{
                    width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '2px solid #0284c7',
                    fontWeight: 900, fontSize: '1rem', background: '#f0f9ff', color: '#0369a1',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}>
                    <span>{calculatedTotalFabricUsedMtr} Mtr</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0284c7', background: '#e0f2fe', padding: '2px 6px', borderRadius: '4px' }}>
                      Total = Fresh MTR + Total Wastage
                    </span>
                  </div>
                </div>
              </div>

              {/* 4 Wastage Fault Breakdown */}
              <div style={{ background: '#fff1f2', padding: '0.9rem 1rem', borderRadius: '10px', border: '1px solid #fecdd3' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 900, color: '#be123c', textTransform: 'uppercase', marginBottom: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Wastage Breakdown (4 Fault Types)</span>
                  <span style={{ background: '#ffe4e6', padding: '2px 8px', borderRadius: '6px' }}>Total Wastage: <b>{calculatedWastageMtr} Mtr</b></span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#9f1239', marginBottom: '0.2rem', display: 'block' }}>1. Fabric Fault (Mtr)</label>
                    <input
                      type="number" step="0.01" min="0"
                      value={form.fabricFaultMtr}
                      onChange={e => setForm(f => ({ ...f, fabricFaultMtr: e.target.value }))}
                      style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #fda4af', fontSize: '0.9rem', fontWeight: 800, background: '#ffffff', color: '#0f172a' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#9f1239', marginBottom: '0.2rem', display: 'block' }}>2. Fusing Fault (Mtr)</label>
                    <input
                      type="number" step="0.01" min="0"
                      value={form.fusingFaultMtr}
                      onChange={e => setForm(f => ({ ...f, fusingFaultMtr: e.target.value }))}
                      style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #fda4af', fontSize: '0.9rem', fontWeight: 800, background: '#ffffff', color: '#0f172a' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#9f1239', marginBottom: '0.2rem', display: 'block' }}>3. Print Fault (Mtr)</label>
                    <input
                      type="number" step="0.01" min="0"
                      value={form.printFaultMtr}
                      onChange={e => setForm(f => ({ ...f, printFaultMtr: e.target.value }))}
                      style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #fda4af', fontSize: '0.9rem', fontWeight: 800, background: '#ffffff', color: '#0f172a' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#9f1239', marginBottom: '0.2rem', display: 'block' }}>4. Genuine Fault (Mtr)</label>
                    <input
                      type="number" step="0.01" min="0"
                      value={form.genuineFaultMtr}
                      onChange={e => setForm(f => ({ ...f, genuineFaultMtr: e.target.value }))}
                      style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #fda4af', fontSize: '0.9rem', fontWeight: 800, background: '#ffffff', color: '#0f172a' }}
                    />
                  </div>
                </div>
              </div>

              {/* Butter Paper Specs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#6d28d9', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                    Butter Paper Used?
                  </label>
                  <select
                    value={form.useButterPaper}
                    onChange={e => {
                      const val = e.target.value;
                      setForm(f => ({ ...f, useButterPaper: val, butterPaperWeightKg: val === 'No' ? '0' : f.butterPaperWeightKg }));
                    }}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #d8b4fe', fontWeight: 800, fontSize: '0.88rem', background: '#f5f3ff', color: '#6d28d9' }}
                  >
                    <option value="Yes">✓ YES (Used Butter Paper)</option>
                    <option value="No">✕ NO (No Butter Paper)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#6d28d9', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                    Butter Paper Weight (KG)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    disabled={form.useButterPaper === 'No'}
                    value={form.butterPaperWeightKg}
                    onChange={e => setForm(f => ({ ...f, butterPaperWeightKg: e.target.value }))}
                    placeholder="e.g. 12.50 kg"
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700, fontSize: '0.88rem', background: form.useButterPaper === 'No' ? '#f1f5f9' : '#ffffff', color: '#0f172a' }}
                  />
                </div>
              </div>

              {/* Machine Specs: Panna, Temp, Speed, Status */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Panna</label>
                  <select
                    value={form.panna}
                    onChange={e => setForm(f => ({ ...f, panna: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 700 }}
                  >
                    {pannaOptions.map(p => <option key={p} value={p}>{p} Panna</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#d97706', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Fusing Temp (°C)</label>
                  <input
                    type="text"
                    value={form.fusingTemp}
                    onChange={e => setForm(f => ({ ...f, fusingTemp: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '0.85rem', fontWeight: 800, background: '#fffbe6', color: '#92400e' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#2563eb', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Fusing Speed</label>
                  <select
                    value={form.fusingSpeed}
                    onChange={e => setForm(f => ({ ...f, fusingSpeed: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '0.85rem', fontWeight: 800, background: '#eff6ff', color: '#1e40af', cursor: 'pointer' }}
                  >
                    {FUSING_SPEED_OPTIONS.map(spd => (
                      <option key={spd} value={spd}>{spd} m/min</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Fusing Status</label>
                  <select
                    value={form.fusingStatus}
                    onChange={e => setForm(f => ({ ...f, fusingStatus: e.target.value }))}
                    style={{
                      width: '100%', padding: '0.5rem', borderRadius: '8px',
                      border: form.fusingStatus === 'Fusing Done' ? '2px solid #10b981' : (form.fusingStatus === 'Fusing In Progress' ? '2px solid #38bdf8' : '2px solid #f59e0b'),
                      fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer',
                      background: form.fusingStatus === 'Fusing Done' ? '#f0fdf4' : (form.fusingStatus === 'Fusing In Progress' ? '#f0f9ff' : '#fffbe5'),
                      color: form.fusingStatus === 'Fusing Done' ? '#15803d' : (form.fusingStatus === 'Fusing In Progress' ? '#0369a1' : '#b45309')
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
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Operator Name</label>
                  <input
                    type="text"
                    value={form.fusingOperator}
                    onChange={e => setForm(f => ({ ...f, fusingOperator: e.target.value }))}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '4px' }}>
                    <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Fusing Remarks / Notes</label>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {['Heat Crease', 'Fabric Shrinkage', 'Paper Jam', 'Color Bleed', 'Roller Mark'].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, notes: f.notes ? `${f.notes}, [${tag}]` : `[${tag}]` }))}
                          style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '1px 5px', fontSize: '0.66rem', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
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
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '0.6rem 1.35rem', borderRadius: '8px', background: '#2563eb', color: '#ffffff', fontWeight: 800, fontSize: '0.9rem', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)' }}
                >
                  {submitting ? 'Saving...' : 'Update Fusing Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: GENERATE REPORT MODAL ── */}
      {showReportModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', width: '100%', maxWidth: '840px', maxHeight: '90vh',
            borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #cbd5e1', overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={20} color="#059669" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
                  Fusing Production &amp; Butter Paper Report
                </h3>
              </div>
              <button type="button" onClick={() => setShowReportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              
              {/* Machine ON & OFF Timing Header Bar */}
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '0.75rem 1rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: '#0369a1', fontSize: '0.85rem' }}>
                  <Clock size={16} color="#0284c7" /> Machine Shift Running Time
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#15803d' }}>🟢 ON TIME:</span>
                    <input
                      type="time"
                      value={reportForm.onTime}
                      onChange={e => setReportForm(rf => ({ ...rf, onTime: e.target.value }))}
                      style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #86efac', fontWeight: 800, fontSize: '0.82rem', background: '#ffffff', color: '#14532d' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#b91c1c' }}>🔴 OFF TIME:</span>
                    <input
                      type="time"
                      value={reportForm.offTime}
                      onChange={e => setReportForm(rf => ({ ...rf, offTime: e.target.value }))}
                      style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #fca5a5', fontWeight: 800, fontSize: '0.82rem', background: '#ffffff', color: '#7f1d1d' }}
                    />
                  </div>
                </div>
              </div>

              {/* Row 1 KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '0.85rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>Total Meters Fused</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#059669', marginTop: 2 }}>
                    {stats.totalFreshMtr.toLocaleString('en-IN')} m
                  </div>
                </div>

                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.85rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase' }}>Butter Paper IN (Stock Inward)</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#2563eb', marginTop: 2 }}>
                    {stats.butterPaperInwardKg.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg
                  </div>
                </div>

                <div style={{ background: '#f3e8ff', border: '1px solid #d8b4fe', padding: '0.85rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase' }}>Butter Paper OUT (Fusing Consumed)</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#7c3aed', marginTop: 2 }}>
                    {stats.butterPaperOutwardKg.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg
                  </div>
                </div>

                <div style={{ background: stats.butterPaperBalanceKg >= 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${stats.butterPaperBalanceKg >= 0 ? '#bbf7d0' : '#fecaca'}`, padding: '0.85rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: stats.butterPaperBalanceKg >= 0 ? '#15803d' : '#b91c1c', textTransform: 'uppercase' }}>Butter Paper Stock Balance</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: stats.butterPaperBalanceKg >= 0 ? '#16a34a' : '#dc2626', marginTop: 2 }}>
                    {stats.butterPaperBalanceKg.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg
                  </div>
                </div>
              </div>

              {/* ── SIDE-BY-SIDE BUTTER PAPER INWARD & USAGE TABLES ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
                
                {/* Table 1: PAPER INWARD (STOCK IN) */}
                <div style={{ background: '#ffffff', border: '2px solid #3b82f6', borderRadius: '12px', padding: '0.85rem', boxShadow: '0 4px 12px rgba(59,130,246,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', borderBottom: '1px solid #eff6ff', paddingBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 900, color: '#1d4ed8', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      📜 PAPER INWARD (STOCK IN)
                    </span>
                    <button
                      type="button"
                      onClick={handleAddInwardRow}
                      className="btn-secondary"
                      style={{ padding: '0.25rem 0.65rem', fontSize: '0.74rem', color: '#2563eb', border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: '6px', fontWeight: 800 }}
                    >
                      + Add Row
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {reportForm.inwardRows.map((row, idx) => (
                      <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '26px 1fr 65px 75px 24px', gap: '0.4rem', alignItems: 'center', background: '#f8fafc', padding: '4px 6px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#3b82f6' }}>#{idx + 1}</span>
                        
                        {/* Panna Selector */}
                        <select
                          value={row.panna}
                          onChange={e => handleInwardRowChange(row.id, 'panna', e.target.value)}
                          style={{ padding: '0.35rem 0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 800, color: '#0369a1', background: '#ffffff' }}
                        >
                          {pannaOptions.map(p => <option key={p} value={p}>{p} Panna</option>)}
                        </select>

                        {/* Rolls Qty */}
                        <input
                          type="number"
                          min="1"
                          placeholder="Rolls"
                          value={row.rolls}
                          onChange={e => handleInwardRowChange(row.id, 'rolls', e.target.value)}
                          style={{ padding: '0.35rem 0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 700, width: '100%', background: '#ffffff' }}
                        />

                        {/* Roll Weight (KG) */}
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Weight Kg"
                          value={row.weightKg}
                          onChange={e => handleInwardRowChange(row.id, 'weightKg', e.target.value)}
                          style={{ padding: '0.35rem 0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 800, width: '100%', color: '#1d4ed8', background: '#ffffff' }}
                        />

                        {/* Remove Row Button */}
                        {reportForm.inwardRows.length > 1 ? (
                          <Trash2 size={13} style={{ cursor: 'pointer', color: '#ef4444' }} onClick={() => handleRemoveInwardRow(row.id)} />
                        ) : <span />}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Table 2: PAPER USAGE (CONSUMPTION) */}
                <div style={{ background: '#ffffff', border: '2px solid #8b5cf6', borderRadius: '12px', padding: '0.85rem', boxShadow: '0 4px 12px rgba(139,92,246,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', borderBottom: '1px solid #f5f3ff', paddingBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 900, color: '#6d28d9', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      📜 PAPER USAGE (CONSUMPTION)
                    </span>
                    <button
                      type="button"
                      onClick={handleAddUsageRow}
                      className="btn-secondary"
                      style={{ padding: '0.25rem 0.65rem', fontSize: '0.74rem', color: '#7c3aed', border: '1px solid #ddd6fe', background: '#f5f3ff', borderRadius: '6px', fontWeight: 800 }}
                    >
                      + Add Row
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {reportForm.usageRows.map((row, idx) => (
                      <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '26px 1fr 65px 75px 24px', gap: '0.4rem', alignItems: 'center', background: '#fcfaff', padding: '4px 6px', borderRadius: '6px', border: '1px solid #ede9fe' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#7c3aed' }}>#{idx + 1}</span>
                        
                        {/* Panna Selector */}
                        <select
                          value={row.panna}
                          onChange={e => handleUsageRowChange(row.id, 'panna', e.target.value)}
                          style={{ padding: '0.35rem 0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 800, color: '#5b21b6', background: '#ffffff' }}
                        >
                          {pannaOptions.map(p => <option key={p} value={p}>{p} Panna</option>)}
                        </select>

                        {/* Rolls Qty */}
                        <input
                          type="number"
                          min="1"
                          placeholder="Rolls"
                          value={row.rolls}
                          onChange={e => handleUsageRowChange(row.id, 'rolls', e.target.value)}
                          style={{ padding: '0.35rem 0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 700, width: '100%', background: '#ffffff' }}
                        />

                        {/* Roll Weight (KG) */}
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Weight Kg"
                          value={row.weightKg}
                          onChange={e => handleUsageRowChange(row.id, 'weightKg', e.target.value)}
                          style={{ padding: '0.35rem 0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 800, width: '100%', color: '#6d28d9', background: '#ffffff' }}
                        />

                        {/* Remove Row Button */}
                        {reportForm.usageRows.length > 1 ? (
                          <Trash2 size={13} style={{ cursor: 'pointer', color: '#ef4444' }} onClick={() => handleRemoveUsageRow(row.id)} />
                        ) : <span />}
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Butter Paper Panna-wise Consumption Summary */}
              <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
                <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>🧈 Butter Paper Consumption Summary by Panna</span>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Weight in KG</span>
                </div>
                {Object.keys(stats.pannaButterKgMap).length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>No Panna-wise Butter Paper consumption logged yet.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem' }}>
                    {Object.entries(stats.pannaButterKgMap).map(([pannaName, kgVal]) => (
                      <div key={pannaName} style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '6px 10px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, color: '#0284c7' }}>{pannaName}</span>
                        <span style={{ fontWeight: 900, color: '#6d28d9' }}>{kgVal.toFixed(2)} kg</span>
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
                    // Log raw material transactions for inward & usage rows
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

      {/* ── MODAL 3: INLINE QUICK PANNA DROPDOWN MANAGER ── */}
      {showPannaManagerModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)',
          zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', width: '100%', maxWidth: '480px',
            borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #cbd5e1', overflow: 'hidden', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Gauge size={18} color="#0284c7" /> Manage Panna / Paper Width Dropdown
              </h3>
              <button type="button" onClick={() => setShowPannaManagerModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginBottom: '0.35rem' }}>
                Add New Panna Width (e.g. 72" or 38")
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder='e.g. 72"'
                  value={newPannaInput}
                  onChange={e => setNewPannaInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddPannaOption())}
                  style={{ flex: 1, padding: '0.5rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 700 }}
                />
                <button type="button" onClick={handleAddPannaOption} className="btn-primary" style={{ padding: '0.5rem 1rem', background: '#0284c7', borderColor: '#0284c7' }}>
                  + Add Panna
                </button>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem' }}>
                Currently Active Panna Width Options ({pannaOptions.length}):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', maxHeight: '180px', overflowY: 'auto' }}>
                {pannaOptions.map(p => (
                  <span key={p} style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', padding: '4px 12px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    {p}
                    <Trash2 size={13} style={{ cursor: 'pointer', color: '#ef4444' }} onClick={() => handleRemovePannaOption(p)} title={`Remove ${p} Panna`} />
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
              <button type="button" onClick={() => setShowPannaManagerModal(false)} className="btn-primary" style={{ padding: '0.5rem 1.25rem' }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 4: INWARD BUTTER PAPER ROLL ENTRY MODAL ── */}
      {showButterPaperInwardModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)',
          zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <form onSubmit={handleButterPaperInwardSubmit} style={{
            background: '#ffffff', width: '100%', maxWidth: '500px',
            borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #cbd5e1', overflow: 'hidden', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0284c7', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PlusCircle size={20} color="#0284c7" /> 📦 Butter Paper Roll Inward Entry
              </h3>
              <button type="button" onClick={() => setShowButterPaperInwardModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '0.3rem' }}>INWARD DATE *</label>
                <input
                  type="date"
                  required
                  value={inwardButterForm.date}
                  onChange={e => setInwardButterForm(f => ({ ...f, date: e.target.value }))}
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '0.3rem' }}>PANNA WIDTH *</label>
                <select
                  value={inwardButterForm.panna}
                  onChange={e => setInwardButterForm(f => ({ ...f, panna: e.target.value }))}
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 800, color: '#0369a1' }}
                >
                  {pannaOptions.map(p => <option key={p} value={p}>{p} Panna</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '0.3rem' }}>NO. OF ROLLS *</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 2"
                  value={inwardButterForm.rolls}
                  onChange={e => setInwardButterForm(f => ({ ...f, rolls: e.target.value }))}
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 800 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#6d28d9', marginBottom: '0.3rem' }}>TOTAL WEIGHT (KG) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  required
                  placeholder="e.g. 45.5"
                  value={inwardButterForm.weightKg}
                  onChange={e => setInwardButterForm(f => ({ ...f, weightKg: e.target.value }))}
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '2px solid #8b5cf6', fontSize: '0.92rem', fontWeight: 900, color: '#6d28d9', background: '#f5f3ff' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '0.3rem' }}>SUPPLIER / VENDOR NAME</label>
              <input
                type="text"
                placeholder="e.g. Paramount Papers / Self Purchase"
                value={inwardButterForm.vendorName}
                onChange={e => setInwardButterForm(f => ({ ...f, vendorName: e.target.value }))}
                style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 600 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '0.3rem' }}>REMARKS / NOTES</label>
              <input
                type="text"
                placeholder="Optional notes..."
                value={inwardButterForm.notes}
                onChange={e => setInwardButterForm(f => ({ ...f, notes: e.target.value }))}
                style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 500 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
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

      {/* ── MODAL: QUICK FUSING SPEED & TEMPERATURE UPDATE ── */}
      {showSpeedTempModal && speedTempCard && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)',
          zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', width: '100%', maxWidth: '520px',
            borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #bae6fd', overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '1.1rem 1.35rem', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Gauge size={20} color="#ffffff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#ffffff' }}>
                    Job #{speedTempCard.jobNo || 'JOB'} — Fusing Specs
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: '#e0f2fe', fontWeight: 600 }}>
                    Change Fusing Machine Temperature &amp; Speed
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setShowSpeedTempModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ffffff' }}>
                <X size={20} />
              </button>
            </div>

            {/* Card Information Summary Badge */}
            <div style={{ padding: '0.85rem 1.35rem', background: '#f0f9ff', borderBottom: '1px solid #e0f2fe', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, display: 'block' }}>PARTY</span>
                <strong style={{ color: '#0f172a', fontWeight: 800 }}>{speedTempCard.party || '—'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, display: 'block' }}>DESIGN</span>
                <strong style={{ color: '#0284c7', fontWeight: 800 }}>{speedTempCard.designName || speedTempCard.designNo || '—'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, display: 'block' }}>FABRIC &amp; PANNA</span>
                <strong style={{ color: '#0f172a', fontWeight: 700 }}>{speedTempCard.fabric || 'Fabric'} {speedTempCard.panna ? `(${speedTempCard.panna}")` : ''}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, display: 'block' }}>PRINTED METERS</span>
                <strong style={{ color: '#059669', fontWeight: 800 }}>{getCardPrintedMeters(speedTempCard) || '0'} mtr</strong>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveSpeedTemp} style={{ padding: '1.25rem 1.35rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              
              {/* 1. Fusing Machine */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 800, color: '#0284c7', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  <Cpu size={14} /> FUSING MACHINE *
                </label>
                <select
                  value={speedTempForm.fusingMachine}
                  onChange={e => setSpeedTempForm(f => ({ ...f, fusingMachine: e.target.value }))}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 800, background: '#ffffff', color: '#0369a1', cursor: 'pointer' }}
                >
                  {DEFAULT_FUSING_MACHINES.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* 2. Fusing Temperature */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 800, color: '#d97706', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  <Thermometer size={14} /> FUSING TEMPERATURE (°C) *
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <input
                    type="text"
                    required
                    value={speedTempForm.fusingTemp}
                    onChange={e => setSpeedTempForm(f => ({ ...f, fusingTemp: e.target.value }))}
                    placeholder="e.g. 210°C"
                    style={{ flex: 1, padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1.5px solid #fde68a', fontSize: '0.92rem', fontWeight: 800, background: '#fffbe6', color: '#92400e' }}
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
                        background: speedTempForm.fusingTemp === temp ? '#d97706' : '#fef3c7',
                        color: speedTempForm.fusingTemp === temp ? '#ffffff' : '#92400e',
                        border: '1px solid #fde68a', transition: 'all 0.1s'
                      }}
                    >
                      {temp}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Fusing Speed */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 800, color: '#2563eb', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  <Gauge size={14} /> FUSING MACHINE SPEED (m/min) *
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <select
                    required
                    value={speedTempForm.fusingSpeed || '80'}
                    onChange={e => setSpeedTempForm(f => ({ ...f, fusingSpeed: e.target.value }))}
                    style={{ flex: 1, padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1.5px solid #bfdbfe', fontSize: '0.92rem', fontWeight: 800, background: '#eff6ff', color: '#1e40af', cursor: 'pointer' }}
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
                        background: String(speedTempForm.fusingSpeed) === String(spd) ? '#2563eb' : '#dbeafe',
                        color: String(speedTempForm.fusingSpeed) === String(spd) ? '#ffffff' : '#1e40af',
                        border: '1px solid #bfdbfe', transition: 'all 0.1s'
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
                  style={{ padding: '0.6rem 1.1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '0.6rem 1.4rem', borderRadius: '8px', border: 'none',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff', fontWeight: 900, fontSize: '0.88rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
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

    </div>
  );
}
