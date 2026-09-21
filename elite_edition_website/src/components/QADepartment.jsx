import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import {
  CheckSquare, Search, RefreshCw, Edit2, Trash2, X, Save,
  CheckCircle2, ShieldAlert, Download, Filter, Eye, AlertCircle, Clock,
  User, FileText, ArrowRight, Calendar, ShieldCheck, Flame, Layers, Box, AlertTriangle, Layers3, Zap
} from 'lucide-react';
import { triggerEliteAlert, triggerEliteConfirm } from './EliteModalDialog';
import DateRangePicker from './DateRangePicker';
import { triggerGlobalDataRefresh, triggerPushNotification } from './NotificationToast';

function toLocalYMD(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const formatDateDDMMYYYY = (d) => {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const year = dt.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return String(d);
  }
};

export default function QADepartment({ department = 'digital_print' }) {
  // Main Sub-Tab: 'printed' (Printed Fabric Checking) or 'white' (White Fabric Checking)
  const [activeSubTab, setActiveSubTab] = useState('printed');

  // Shared Data State
  const [cards, setCards] = useState([]);
  const [whiteFabricLogs, setWhiteFabricLogs] = useState([]);
  const [inwardLots, setInwardLots] = useState([]);
  const [selectedInwardBadge, setSelectedInwardBadge] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // User details
  const [accountFullName] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user_info') || '{}');
      return u.name || u.username || 'QA Inspector';
    } catch (e) {
      return 'QA Inspector';
    }
  });

  // Filters for Printed Fabric Checking
  const [printedSearch, setPrintedSearch] = useState('');
  const [printedQaStatusFilter, setPrintedQaStatusFilter] = useState('All'); // 'All', 'QA Pending', 'QA Passed', 'QA Rejected'
  const [datePreset, setDatePreset] = useState('this_month');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');

  // Modals for Printed Fabric QA
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  // Form State for Printed Fabric QA Modal
  const [form, setForm] = useState({
    jobCardId: '',
    jobNo: '',
    freshMtr: '0',
    fabricFaultMtr: '0',
    fusingFaultMtr: '0',
    printFaultMtr: '0',
    genuineFaultMtr: '0',
    qaStatus: 'QA Passed',
    qaInspector: '',
    qaDate: toLocalYMD(),
    qaNotes: ''
  });

  // Filters for White Fabric Checking
  const [whiteSearch, setWhiteSearch] = useState('');
  const [whiteStatusFilter, setWhiteStatusFilter] = useState('All');

  // New White Fabric Checking Form State
  const [whiteForm, setWhiteForm] = useState({
    date: toLocalYMD(),
    challanNo: '',
    vendorName: '',
    fabricQuality: '',
    panna: '58"',
    lotNo: '',
    totalMtr: '',
    weavingFaultMtr: '0',
    stainFaultMtr: '0',
    shadingFaultMtr: '0',
    widthShortageMtr: '0',
    status: 'Passed',
    inspectorName: accountFullName,
    notes: ''
  });

  useEffect(() => {
    fetchData();
    const handleDataRefresh = (e) => {
      if (!e || !e.detail || e.detail === 'fusing' || e.detail === 'qa' || e.detail === 'jobcards' || e.detail === 'fabric') {
        fetchData();
      }
    };
    window.addEventListener('elite-data-refresh', handleDataRefresh);
    return () => window.removeEventListener('elite-data-refresh', handleDataRefresh);
  }, [department]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch Job Cards for Printed Fabric Checking
      const res = await api.getJobCards({ limit: 1000, department });
      if (res && res.data) {
        setCards(Array.isArray(res.data) ? res.data : []);
      }

      // 2. Fetch Inward Fabric Transactions for Auto-fill in White Fabric QA
      try {
        const inwRes = await api.getFabricTransactions({ type: 'INWARD', limit: 300 });
        const list = inwRes?.data?.transactions || inwRes?.transactions || inwRes?.data || inwRes || [];
        if (Array.isArray(list)) {
          setInwardLots(list);
        }
      } catch (e) {
        console.warn('Failed to load inward transactions:', e);
      }

      // 3. Fetch White Fabric Inspection records from MongoDB / API
      try {
        const wfRes = await api.getWhiteFabricLogs({ department });
        const logs = wfRes?.data || wfRes || [];
        if (Array.isArray(logs) && logs.length > 0) {
          setWhiteFabricLogs(logs);
          localStorage.setItem(`qa_white_fabric_logs_${department}`, JSON.stringify(logs));
        } else {
          const savedWhiteLogs = localStorage.getItem(`qa_white_fabric_logs_${department}`);
          if (savedWhiteLogs) {
            try { setWhiteFabricLogs(JSON.parse(savedWhiteLogs)); } catch (e) {}
          }
        }
      } catch (e) {
        const savedWhiteLogs = localStorage.getItem(`qa_white_fabric_logs_${department}`);
        if (savedWhiteLogs) {
          try { setWhiteFabricLogs(JSON.parse(savedWhiteLogs)); } catch (e) {}
        }
      }
    } catch (err) {
      console.error('Failed to load QA data:', err);
      setError(err.message || 'Failed to load QA records.');
    } finally {
      setLoading(false);
    }
  };

  // ── Calculate Total Wastage Dynamically in Printed QA Modal ──
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
    const wastage = parseFloat(calculatedWastageMtr) || 0;
    return (fresh + wastage).toFixed(2);
  }, [form.freshMtr, calculatedWastageMtr]);

  // Open Edit QA Modal for a Job Card
  const openQaModal = (card) => {
    setSelectedCard(card);
    const pMtr = parseFloat(card.printedMtr || card.totalMtr) || 0;
    const fabFault = card.fabricFaultMtr !== undefined && card.fabricFaultMtr !== '' ? String(card.fabricFaultMtr) : '0';
    const fusFault = card.fusingFaultMtr !== undefined && card.fusingFaultMtr !== '' ? String(card.fusingFaultMtr) : '0';
    const prtFault = card.printFaultMtr !== undefined && card.printFaultMtr !== '' ? String(card.printFaultMtr) : '0';
    const genFault = card.genuineFaultMtr !== undefined && card.genuineFaultMtr !== '' ? String(card.genuineFaultMtr) : '0';
    const totalWastage = (parseFloat(fabFault) + parseFloat(fusFault) + parseFloat(prtFault) + parseFloat(genFault)) || 0;

    const fresh = card.freshMtr || card.fusingMtr || Math.max(0, pMtr - totalWastage).toString();

    setForm({
      jobCardId: card._id,
      jobNo: card.jobNo || '',
      freshMtr: String(fresh),
      fabricFaultMtr: fabFault,
      fusingFaultMtr: fusFault,
      printFaultMtr: prtFault,
      genuineFaultMtr: genFault,
      qaStatus: card.qaStatus || 'QA Passed',
      qaInspector: card.qaInspector || accountFullName,
      qaDate: card.qaDate || toLocalYMD(),
      qaNotes: card.qaNotes || ''
    });
    setShowFormModal(true);
  };

  // Submit Printed Fabric QA Inspection Record
  const handleQaFormSubmit = async (e) => {
    e.preventDefault();
    if (!form.jobCardId) {
      triggerEliteAlert('Please select a valid Job Card.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        freshMtr: String(form.freshMtr),
        fabricFaultMtr: String(form.fabricFaultMtr || 0),
        fusingFaultMtr: String(form.fusingFaultMtr || 0),
        printFaultMtr: String(form.printFaultMtr || 0),
        genuineFaultMtr: String(form.genuineFaultMtr || 0),
        totalWastageMtr: String(calculatedWastageMtr),
        totalFabricUsedMtr: String(calculatedTotalFabricUsedMtr),
        qaStatus: form.qaStatus,
        qaDate: form.qaDate,
        qaInspector: form.qaInspector,
        qaNotes: form.qaNotes
      };

      await api.updateJobCard(form.jobCardId, payload);
      triggerPushNotification(
        '🛡️ QA Inspection Logged',
        `Job #${form.jobNo}: ${form.qaStatus} | ${form.freshMtr}m Fresh | Total Used: ${calculatedTotalFabricUsedMtr}m`,
        'success'
      );
      triggerGlobalDataRefresh('qa');
      setShowFormModal(false);
      fetchData();
    } catch (err) {
      triggerEliteAlert('Save Error', err.message || 'Failed to save QA record.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Auto-Fill Helpers for White Fabric Inward Checking ──
  const normalizePanna = (val) => {
    if (!val) return '58"';
    const clean = String(val).replace(/["'\s]/g, '');
    if (['44', '54', '58', '64'].includes(clean)) return `${clean}"`;
    return String(val).includes('"') ? String(val) : `${val}"`;
  };

  const applyInwardDataToWhiteForm = (tx) => {
    if (!tx) return;
    let formattedDate = toLocalYMD();
    if (tx.date) {
      try {
        const d = new Date(tx.date);
        if (!isNaN(d.getTime())) {
          formattedDate = toLocalYMD(d);
        }
      } catch (e) {}
    }

    setWhiteForm(prev => ({
      ...prev,
      date: formattedDate,
      vendorName: tx.vendorName || tx.vendor || prev.vendorName,
      challanNo: tx.challanNo || prev.challanNo,
      fabricQuality: tx.fabricQuality || tx.fabricName || prev.fabricQuality,
      panna: tx.panna ? normalizePanna(tx.panna) : prev.panna,
      lotNo: tx.lotNo ? String(tx.lotNo) : prev.lotNo,
      totalMtr: tx.qty !== undefined && tx.qty !== null ? String(tx.qty) : (tx.totalMtr ? String(tx.totalMtr) : prev.totalMtr)
    }));
    setSelectedInwardBadge(`Lot #${tx.lotNo || 'N/A'} - ${tx.fabricQuality || ''} (${tx.qty || tx.totalMtr || ''}m)`);
    triggerPushNotification('⚡ Inward Data Auto-Filled', `Imported Lot #${tx.lotNo || 'N/A'}: ${tx.fabricQuality || ''} (${tx.qty || tx.totalMtr || ''}m) from ${tx.vendorName || 'Inward'}`, 'info');
  };

  const handleSelectInwardLot = (lotVal) => {
    if (!lotVal) {
      setSelectedInwardBadge('');
      return;
    }
    const found = inwardLots.find(tx => String(tx.lotNo) === String(lotVal) || String(tx._id) === String(lotVal));
    if (found) {
      applyInwardDataToWhiteForm(found);
    }
  };

  const handleLotNoBlur = async (val) => {
    if (!val || !val.trim()) return;
    const clean = val.trim();
    // 1. Check loaded inward lots
    const match = inwardLots.find(tx => String(tx.lotNo) === clean || String(tx.lotNo) === clean.replace(/^LOT-?/i, ''));
    if (match) {
      applyInwardDataToWhiteForm(match);
      return;
    }
    // 2. Fallback to API lookup
    try {
      const numOnly = clean.replace(/[^0-9]/g, '');
      if (numOnly) {
        const res = await api.getFabricLotInfo(numOnly);
        if (res && res.data && res.data.lotNo) {
          applyInwardDataToWhiteForm({
            lotNo: res.data.lotNo,
            vendorName: res.data.vendor,
            fabricQuality: res.data.fabricQuality || res.data.fabricName,
            panna: res.data.panna,
            qty: res.data.qty || res.data.totalMtr,
            challanNo: res.data.challanNo,
            date: res.data.date
          });
        }
      }
    } catch (e) {
      // quiet fallback
    }
  };

  const handleChallanBlur = (val) => {
    if (!val || !val.trim()) return;
    const clean = val.trim().toLowerCase();
    const match = inwardLots.find(tx => (tx.challanNo || '').toLowerCase() === clean);
    if (match) {
      applyInwardDataToWhiteForm(match);
    }
  };

  // Submit White Fabric Inspection Log
  const handleWhiteFormSubmit = async (e) => {
    e.preventDefault();
    if (!whiteForm.fabricQuality || !whiteForm.totalMtr) {
      triggerEliteAlert('Please fill in Fabric Quality and Total Roll Meters.');
      return;
    }

    const totMtr = parseFloat(whiteForm.totalMtr) || 0;
    const wF = parseFloat(whiteForm.weavingFaultMtr) || 0;
    const sF = parseFloat(whiteForm.stainFaultMtr) || 0;
    const shF = parseFloat(whiteForm.shadingFaultMtr) || 0;
    const wdF = parseFloat(whiteForm.widthShortageMtr) || 0;
    const totDefect = wF + sF + shF + wdF;
    const usableFresh = Math.max(0, totMtr - totDefect);

    const logPayload = {
      department,
      date: whiteForm.date,
      challanNo: whiteForm.challanNo,
      vendorName: whiteForm.vendorName,
      fabricQuality: whiteForm.fabricQuality,
      panna: whiteForm.panna,
      lotNo: whiteForm.lotNo,
      totalMtr: totMtr,
      weavingFaultMtr: wF,
      stainFaultMtr: sF,
      shadingFaultMtr: shF,
      widthShortageMtr: wdF,
      totalDefectMtr: parseFloat(totDefect.toFixed(2)),
      usableFreshMtr: parseFloat(usableFresh.toFixed(2)),
      status: whiteForm.status,
      inspectorName: whiteForm.inspectorName || accountFullName,
      notes: whiteForm.notes || ''
    };

    try {
      const res = await api.createWhiteFabricLog(logPayload);
      const savedDoc = res?.data || { ...logPayload, _id: `WF-${Date.now()}` };
      const updatedLogs = [savedDoc, ...whiteFabricLogs];
      setWhiteFabricLogs(updatedLogs);
      localStorage.setItem(`qa_white_fabric_logs_${department}`, JSON.stringify(updatedLogs));
    } catch (err) {
      console.warn('API save failed, falling back to local storage:', err);
      const fallbackDoc = { ...logPayload, _id: `WF-${Date.now()}` };
      const updatedLogs = [fallbackDoc, ...whiteFabricLogs];
      setWhiteFabricLogs(updatedLogs);
      localStorage.setItem(`qa_white_fabric_logs_${department}`, JSON.stringify(updatedLogs));
    }

    triggerPushNotification('🥼 White Fabric Inspected', `Lot #${whiteForm.lotNo || 'N/A'}: ${usableFresh.toFixed(2)}m Usable | ${totDefect.toFixed(2)}m Defect`, 'success');
    setSelectedInwardBadge('');
    
    // Reset form
    setWhiteForm({
      date: toLocalYMD(),
      challanNo: '',
      vendorName: '',
      fabricQuality: '',
      panna: '58"',
      lotNo: '',
      totalMtr: '',
      weavingFaultMtr: '0',
      stainFaultMtr: '0',
      shadingFaultMtr: '0',
      widthShortageMtr: '0',
      status: 'Passed',
      inspectorName: accountFullName,
      notes: ''
    });
  };

  // Delete White Fabric Log
  const handleDeleteWhiteLog = async (logItem) => {
    const confirm = await triggerEliteConfirm('Are you sure you want to delete this white fabric inspection log?');
    if (!confirm) return;

    const id = typeof logItem === 'object' ? (logItem._id || logItem.id) : logItem;
    try {
      if (id && !String(id).startsWith('WF-QA-') && !String(id).startsWith('WF-')) {
        await api.deleteWhiteFabricLog(id);
      }
    } catch (err) {
      console.warn('API delete error, deleting locally:', err);
    }
    const updated = whiteFabricLogs.filter(l => (l._id || l.id) !== id);
    setWhiteFabricLogs(updated);
    localStorage.setItem(`qa_white_fabric_logs_${department}`, JSON.stringify(updated));
    triggerPushNotification('Deleted', 'Inspection log removed.', 'info');
  };

  // Filtered Printed Job Cards
  const filteredPrintedCards = useMemo(() => {
    return cards.filter(c => {
      // Must be at least printed or fused
      const isPrintedOrFused = c.printStatus === 'Printing Done' || c.fusingStatus === 'Fusing Done' || c.freshMtr;
      if (!isPrintedOrFused) return false;

      if (printedSearch) {
        const s = printedSearch.toLowerCase();
        const jNo = (c.jobNo || '').toLowerCase();
        const pty = (c.party || '').toLowerCase();
        const dNo = (c.designName || c.designNo || '').toLowerCase();
        const fab = (c.fabric || '').toLowerCase();
        const insp = (c.qaInspector || '').toLowerCase();
        if (!jNo.includes(s) && !pty.includes(s) && !dNo.includes(s) && !fab.includes(s) && !insp.includes(s)) {
          return false;
        }
      }

      if (printedQaStatusFilter !== 'All') {
        const status = c.qaStatus || 'QA Pending';
        if (printedQaStatusFilter === 'QA Pending' && status !== 'QA Pending') return false;
        if (printedQaStatusFilter === 'QA Passed' && status !== 'QA Passed') return false;
        if (printedQaStatusFilter === 'QA Rejected' && status !== 'QA Rejected') return false;
      }

      if (customDateStart || customDateEnd) {
        const cardDate = (c.qaDate || c.fusingDate || c.date || '').slice(0, 10);
        if (customDateStart && cardDate < customDateStart) return false;
        if (customDateEnd && cardDate > customDateEnd) return false;
      }

      return true;
    });
  }, [cards, printedSearch, printedQaStatusFilter, customDateStart, customDateEnd]);

  // Summary Statistics for Printed Fabric QA
  const printedStats = useMemo(() => {
    let totalFreshMtr = 0;
    let totalWastageMtr = 0;
    let totalFabricUsedMtr = 0;
    let passedCount = 0;
    let pendingCount = 0;
    let rejectedCount = 0;

    filteredPrintedCards.forEach(c => {
      const fresh = parseFloat(c.freshMtr || c.fusingMtr || c.printedMtr) || 0;
      const waste = parseFloat(c.totalWastageMtr) || 0;
      const used = parseFloat(c.totalFabricUsedMtr) || (fresh + waste);

      totalFreshMtr += fresh;
      totalWastageMtr += waste;
      totalFabricUsedMtr += used;

      const st = c.qaStatus || 'QA Pending';
      if (st === 'QA Passed') passedCount++;
      else if (st === 'QA Rejected') rejectedCount++;
      else pendingCount++;
    });

    const totalCards = filteredPrintedCards.length;
    const passRate = totalCards > 0 ? ((passedCount / totalCards) * 100).toFixed(1) : '100.0';

    return {
      totalCards,
      totalFreshMtr,
      totalWastageMtr,
      totalFabricUsedMtr,
      passedCount,
      pendingCount,
      rejectedCount,
      passRate
    };
  }, [filteredPrintedCards]);

  // Export CSV Report for Printed QA
  const handleExportPrintedCSV = () => {
    if (!filteredPrintedCards.length) {
      triggerEliteAlert('No records available to export.');
      return;
    }

    const headers = [
      'Job No', 'Date', 'Party Name', 'Design Name', 'Fabric', 'Panna',
      'Fresh MTR', 'Fabric Fault (m)', 'Fusing Fault (m)', 'Print Fault (m)', 'Genuine Fault (m)',
      'Total Wastage (m)', 'Total Fabric Used (m)', 'QA Status', 'Inspector', 'QA Notes'
    ];

    const rows = filteredPrintedCards.map(c => {
      const fresh = parseFloat(c.freshMtr || c.fusingMtr || c.printedMtr) || 0;
      const waste = parseFloat(c.totalWastageMtr) || 0;
      const used = parseFloat(c.totalFabricUsedMtr) || (fresh + waste);

      return [
        c.jobNo || '',
        c.qaDate || c.fusingDate || c.date || '',
        `"${(c.party || '').replace(/"/g, '""')}"`,
        `"${(c.designName || c.designNo || '').replace(/"/g, '""')}"`,
        `"${(c.fabric || '').replace(/"/g, '""')}"`,
        c.panna || '',
        fresh.toFixed(2),
        c.fabricFaultMtr || 0,
        c.fusingFaultMtr || 0,
        c.printFaultMtr || 0,
        c.genuineFaultMtr || 0,
        waste.toFixed(2),
        used.toFixed(2),
        c.qaStatus || 'QA Pending',
        `"${(c.qaInspector || '').replace(/"/g, '""')}"`,
        `"${(c.qaNotes || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Printed_Fabric_QA_Report_${toLocalYMD()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerPushNotification('📥 QA Report Downloaded', 'Printed fabric QA report exported to CSV successfully.', 'success');
  };

  // Export PDF Report for Printed QA & Total Fabric Used
  const handleExportPrintedPDF = () => {
    if (!filteredPrintedCards.length) {
      triggerEliteAlert('No records available to export.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) {
      triggerEliteAlert('Pop-up blocked. Please allow pop-ups to download PDF.');
      return;
    }

    const dateRangeStr = customDateStart && customDateEnd
      ? `${customDateStart} to ${customDateEnd}`
      : customDateStart
      ? `From ${customDateStart}`
      : 'All Time';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Printed Fabric QA & Consumption Report - Elite Digital Prints</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 24px; color: #1e293b; background: #ffffff; }
          .header { text-align: center; border-bottom: 3px solid #4f46e5; padding-bottom: 14px; margin-bottom: 20px; }
          .company { font-size: 24px; font-weight: 900; color: #1e1b4b; text-transform: uppercase; letter-spacing: 1px; }
          .subtitle { font-size: 15px; font-weight: 800; color: #4f46e5; margin-top: 4px; }
          .meta { font-size: 11px; color: #64748b; margin-top: 6px; font-weight: 600; }
          .summary-bar { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 20px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 16px; }
          .kpi { flex: 1; text-align: center; }
          .kpi-title { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 800; }
          .kpi-value { font-size: 16px; font-weight: 900; margin-top: 4px; }
          .green { color: #047857; }
          .red { color: #b91c1c; }
          .blue { color: #0369a1; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; border: 1px solid #cbd5e1; }
          th { background: #1e293b; color: #ffffff; text-align: left; padding: 8px 10px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; }
          td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #f8fafc; }
          .status-badge { padding: 2px 8px; border-radius: 12px; font-size: 9px; font-weight: 800; display: inline-block; }
          .badge-passed { background: #d1fae5; color: #047857; border: 1px solid #a7f3d0; }
          .badge-rejected { background: #ffe4e6; color: #be123c; border: 1px solid #fecdd3; }
          .badge-pending { background: #fffbe5; color: #b45309; border: 1px solid #fde68a; }
          .footer { margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company">Elite Digital Prints</div>
          <div class="subtitle">Printed Fabric QA & Total Fabric Consumption Report</div>
          <div class="meta">Generated: ${new Date().toLocaleString('en-IN')} | Date Filter: ${dateRangeStr}</div>
        </div>

        <div class="summary-bar">
          <div class="kpi"><div class="kpi-title">Inspected Cards</div><div class="kpi-value">${printedStats.totalCards}</div></div>
          <div class="kpi"><div class="kpi-title">Fresh Usable Output</div><div class="kpi-value green">${printedStats.totalFreshMtr.toFixed(2)} mtr</div></div>
          <div class="kpi"><div class="kpi-title">Total Wastage</div><div class="kpi-value red">${printedStats.totalWastageMtr.toFixed(2)} mtr</div></div>
          <div class="kpi"><div class="kpi-title">Total Fabric Used (Fresh + Wastage)</div><div class="kpi-value blue">${printedStats.totalFabricUsedMtr.toFixed(2)} mtr</div></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Job Card #</th>
              <th>Date</th>
              <th>Party Name</th>
              <th>Design & Fabric</th>
              <th style="text-align: right;">Fresh MTR</th>
              <th style="text-align: center;">Faults (Fab/Fus/Prt/Gen)</th>
              <th style="text-align: right;">Total Wastage</th>
              <th style="text-align: right; background: #0f172a; color: #38bdf8;">Total Fabric Used</th>
              <th style="text-align: center;">QA Status</th>
            </tr>
          </thead>
          <tbody>
            ${filteredPrintedCards.map((c, index) => {
              const fresh = parseFloat(c.freshMtr || c.fusingMtr || c.printedMtr) || 0;
              const waste = parseFloat(c.totalWastageMtr) || 0;
              const used = parseFloat(c.totalFabricUsedMtr) || (fresh + waste);
              const qaSt = c.qaStatus || 'QA Pending';
              const badgeClass = qaSt === 'QA Passed' ? 'badge-passed' : qaSt === 'QA Rejected' ? 'badge-rejected' : 'badge-pending';
              const cleanPanna = c.panna ? String(c.panna).replace(/"/g, '') : '';

              return `
                <tr>
                  <td>${index + 1}</td>
                  <td style="font-weight: 800; color: #4f46e5;">${c.jobNo || 'JOB'}</td>
                  <td>${c.qaDate || c.fusingDate || c.date || '—'}</td>
                  <td style="font-weight: 700;">${c.party || '—'}</td>
                  <td style="font-weight: 700; color: #0284c7;">${c.designName || c.designNo || '—'}<br/><span style="font-size: 9px; color: #64748b;">${c.fabric || ''} ${cleanPanna ? `(${cleanPanna}")` : ''}</span></td>
                  <td style="text-align: right; font-weight: 800; color: #047857;">${fresh.toFixed(2)} m</td>
                  <td style="text-align: center; font-size: 9px;">${c.fabricFaultMtr || 0}/${c.fusingFaultMtr || 0}/${c.printFaultMtr || 0}/${c.genuineFaultMtr || 0}m</td>
                  <td style="text-align: right; font-weight: 700; color: ${waste > 0 ? '#b91c1c' : '#64748b'};">${waste.toFixed(2)} m</td>
                  <td style="text-align: right; font-weight: 900; color: #0369a1; background: #f0f9ff;">${used.toFixed(2)} m</td>
                  <td style="text-align: center;"><span class="status-badge ${badgeClass}">${qaSt}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          Formula: Total Fabric Used = Fresh Output MTR + Total Wastage MTR | Computer-generated report by Elite Digital Prints
        </div>

        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── TOP DEPARTMENT HEADER BAR ── */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', borderRadius: '16px', background: '#ffffff', border: '1px solid #e0e7ff', boxShadow: '0 10px 30px -10px rgba(79, 70, 229, 0.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)' }}>
              <ShieldCheck size={24} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1e1b4b', margin: 0, letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                QA DEPARTMENT <span style={{ fontSize: '0.72rem', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>Elite Digital Prints</span>
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0 0', fontWeight: 500 }}>
                Quality Assurance, Fabric Defect Audit, Fresh Output Verification &amp; Wastage Control
              </p>
            </div>
          </div>

          {/* Sub-Tab Selector Buttons */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
            <button
              type="button"
              onClick={() => setActiveSubTab('printed')}
              style={{
                padding: '0.5rem 1.25rem',
                fontSize: '0.85rem',
                fontWeight: 800,
                borderRadius: '8px',
                border: 'none',
                background: activeSubTab === 'printed' ? '#4f46e5' : 'transparent',
                color: activeSubTab === 'printed' ? '#ffffff' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: activeSubTab === 'printed' ? '0 3px 10px rgba(79, 70, 229, 0.3)' : 'none'
              }}
            >
              <Flame size={16} /> PRINTED FABRIC CHECKING
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('white')}
              style={{
                padding: '0.5rem 1.25rem',
                fontSize: '0.85rem',
                fontWeight: 800,
                borderRadius: '8px',
                border: 'none',
                background: activeSubTab === 'white' ? '#4f46e5' : 'transparent',
                color: activeSubTab === 'white' ? '#ffffff' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: activeSubTab === 'white' ? '0 3px 10px rgba(79, 70, 229, 0.3)' : 'none'
              }}
            >
              <Layers size={16} /> WHITE FABRIC CHECKING
            </button>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── PART 1: PRINTED FABRIC CHECKING (Job Cards Inspection) ── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'printed' && (
        <>
          {/* Summary KPI Statistics Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.85rem' }}>
            
            {/* Total Checked Jobs */}
            <div className="glass-panel" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid #4f46e5', background: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Inspected Job Cards</span>
                <CheckSquare size={18} color="#4f46e5" />
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1e1b4b', marginTop: 4 }}>
                {printedStats.totalCards} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>cards</span>
              </div>
            </div>

            {/* Fresh Usable Output */}
            <div className="glass-panel" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid #10b981', background: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Fresh Usable Output</span>
                <CheckCircle2 size={18} color="#10b981" />
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#047857', marginTop: 4 }}>
                {printedStats.totalFreshMtr.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>mtr</span>
              </div>
            </div>

            {/* Total Wastage */}
            <div className="glass-panel" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid #ef4444', background: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Total Wastage</span>
                <AlertTriangle size={18} color="#ef4444" />
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#b91c1c', marginTop: 4 }}>
                {printedStats.totalWastageMtr.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>mtr</span>
              </div>
            </div>

            {/* Total Fabric Used (Fresh Mtr + Wastage) */}
            <div className="glass-panel" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid #0284c7', background: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Total Fabric Used</span>
                <Layers3 size={18} color="#0284c7" />
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0369a1', marginTop: 4 }}>
                {printedStats.totalFabricUsedMtr.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>mtr</span>
              </div>
            </div>

            {/* QA Pass Rate */}
            <div className="glass-panel" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid #8b5cf6', background: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>QA Pass Rate</span>
                <ShieldCheck size={18} color="#8b5cf6" />
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#6d28d9', marginTop: 4 }}>
                {printedStats.passRate}% <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>({printedStats.passedCount} passed)</span>
              </div>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="glass-panel" style={{ padding: '0.85rem 1.25rem', background: '#ffffff', borderRadius: '12px' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              
              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                {/* Search */}
                <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 220px' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    type="text"
                    value={printedSearch}
                    onChange={e => setPrintedSearch(e.target.value)}
                    placeholder="Search Job No, Party, Design..."
                    style={{ paddingLeft: 32, width: '100%', fontSize: '0.85rem', height: '36px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                {/* Date Range Picker */}
                <DateRangePicker
                  preset={datePreset}
                  onChange={({ preset: p, dateStart: ds, dateEnd: de }) => {
                    setDatePreset(p);
                    setCustomDateStart(ds || '');
                    setCustomDateEnd(de || '');
                  }}
                  customStart={customDateStart}
                  customEnd={customDateEnd}
                  onCustomChange={(s, e) => {
                    setCustomDateStart(s);
                    setCustomDateEnd(e);
                  }}
                />

                {/* Status Selector */}
                <div style={{ display: 'flex', background: '#f8fafc', padding: '3px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  {['All', 'QA Pending', 'QA Passed', 'QA Rejected'].map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setPrintedQaStatusFilter(st)}
                      style={{
                        padding: '0.25rem 0.75rem', fontSize: '0.78rem', fontWeight: 800, borderRadius: '6px', border: 'none',
                        background: printedQaStatusFilter === st ? (st === 'QA Passed' ? '#10b981' : st === 'QA Rejected' ? '#ef4444' : st === 'QA Pending' ? '#f59e0b' : '#4f46e5') : 'transparent',
                        color: printedQaStatusFilter === st ? '#ffffff' : '#64748b', cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleExportPrintedPDF}
                  style={{
                    background: '#059669', color: '#ffffff', border: 'none',
                    padding: '0.45rem 1rem', borderRadius: '8px', fontWeight: 800,
                    fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                    boxShadow: '0 3px 10px rgba(5, 150, 105, 0.25)'
                  }}
                >
                  <Download size={15} /> Download PDF
                </button>

                <button
                  type="button"
                  onClick={handleExportPrintedCSV}
                  title="Export to CSV"
                  style={{
                    background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1',
                    padding: '0.45rem 0.85rem', borderRadius: '8px', fontWeight: 800,
                    fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem'
                  }}
                >
                  <Download size={15} /> CSV
                </button>

                <button
                  type="button"
                  onClick={fetchData}
                  title="Reload QA Data"
                  style={{ padding: '0.45rem 0.75rem', height: '36px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer' }}
                >
                  <RefreshCw size={15} className={loading ? 'spin-loader' : ''} />
                </button>
              </div>
            </div>
          </div>

          {/* Printed Fabric QA Ledger Table */}
          <div className="glass-panel" style={{ padding: '1rem', borderRadius: '12px', background: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} color="#4f46e5" /> Printed &amp; Fused Job Cards Inspection Ledger ({filteredPrintedCards.length})
              </h3>
            </div>

            {loading && cards.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                <RefreshCw size={24} className="spin-loader" />
                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Loading QA Inspection Ledger...</p>
              </div>
            ) : filteredPrintedCards.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                <ShieldAlert size={28} color="#94a3b8" />
                <p style={{ marginTop: '0.5rem', fontSize: '0.88rem', fontWeight: 600 }}>No job cards matching selected QA filters.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#1e293b', color: '#ffffff', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                      <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 800 }}>Job Card #</th>
                      <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 800 }}>Party Name</th>
                      <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 800 }}>Design &amp; Fabric</th>
                      <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800 }}>Fusing Status</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#6ee7b7' }}>Fresh MTR</th>
                      <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800 }}>Wastage Breakdown (4 Faults)</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#fca5a5' }}>Total Wastage</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 900, color: '#38bdf8', background: '#0f172a' }}>Total Fabric Used</th>
                      <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800 }}>QA Status</th>
                      <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPrintedCards.map((c, idx) => {
                      const fresh = parseFloat(c.freshMtr || c.fusingMtr || c.printedMtr) || 0;
                      const waste = parseFloat(c.totalWastageMtr) || 0;
                      const totalUsed = parseFloat(c.totalFabricUsedMtr) || (fresh + waste);
                      const qaSt = c.qaStatus || 'QA Pending';
                      const cleanPanna = c.panna ? String(c.panna).replace(/"/g, '') : '';

                      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

                      return (
                        <tr key={c._id} style={{ borderBottom: '1px solid #e2e8f0', background: rowBg, transition: 'background 0.15s' }}>
                          
                          {/* Job Card No */}
                          <td style={{ padding: '12px 14px', fontWeight: 800 }}>
                            <div style={{ fontSize: '0.92rem', color: '#4f46e5', fontWeight: 900 }}>{c.jobNo || 'JOB'}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500, marginTop: 2 }}>
                              {c.qaDate || c.fusingDate || c.date || '—'}
                            </div>
                          </td>

                          {/* Party Name */}
                          <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0f172a', fontSize: '0.88rem' }}>
                            {c.party || '—'}
                          </td>

                          {/* Design & Fabric */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 900, color: '#0284c7', fontSize: '0.88rem' }}>{c.designName || c.designNo || '—'}</div>
                            <div style={{ fontSize: '0.74rem', color: '#475569', fontWeight: 600, marginTop: 2 }}>
                              {c.fabric || 'Fabric'} {cleanPanna ? `(${cleanPanna}")` : ''}
                            </div>
                          </td>

                          {/* Fusing Status */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span style={{
                              padding: '4px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800,
                              background: c.fusingStatus === 'Fusing Done' ? '#d1fae5' : '#fef3c7',
                              color: c.fusingStatus === 'Fusing Done' ? '#047857' : '#b45309',
                              border: `1px solid ${c.fusingStatus === 'Fusing Done' ? '#a7f3d0' : '#fde68a'}`
                            }}>
                              {c.fusingStatus || 'Pending'}
                            </span>
                          </td>

                          {/* Fresh Mtr */}
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 900, color: '#059669', fontSize: '0.92rem' }}>
                            {fresh > 0 ? `${fresh.toFixed(2)} m` : '0 m'}
                          </td>

                          {/* 4-Fault Wastage Breakdown */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '5px', fontSize: '0.7rem', fontWeight: 800, flexWrap: 'wrap', justifyContent: 'center' }}>
                              <span title="Fabric Fault" style={{ background: '#ffe4e6', color: '#be123c', padding: '2px 6px', borderRadius: '5px', border: '1px solid #fecdd3' }}>Fab: {c.fabricFaultMtr || 0}m</span>
                              <span title="Fusing Fault" style={{ background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '5px', border: '1px solid #fde68a' }}>Fus: {c.fusingFaultMtr || 0}m</span>
                              <span title="Print Fault" style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 6px', borderRadius: '5px', border: '1px solid #c7d2fe' }}>Prt: {c.printFaultMtr || 0}m</span>
                              <span title="Genuine Fault" style={{ background: '#f3e8ff', color: '#6b21a8', padding: '2px 6px', borderRadius: '5px', border: '1px solid #e9d5ff' }}>Gen: {c.genuineFaultMtr || 0}m</span>
                            </div>
                          </td>

                          {/* Total Wastage */}
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: waste > 0 ? '#dc2626' : '#94a3b8', fontSize: '0.88rem' }}>
                            {waste > 0 ? `${waste.toFixed(2)} m` : '0 m'}
                          </td>

                          {/* Total Fabric Used (Fresh Mtr + Wastage) */}
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 900, color: '#0369a1', background: '#f0f9ff', fontSize: '0.95rem' }}>
                            {totalUsed.toFixed(2)} m
                          </td>

                          {/* QA Status Badge */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span style={{
                              padding: '5px 12px', borderRadius: '20px', fontSize: '0.74rem', fontWeight: 800,
                              background: qaSt === 'QA Passed' ? '#d1fae5' : qaSt === 'QA Rejected' ? '#ffe4e6' : '#fffbe5',
                              color: qaSt === 'QA Passed' ? '#047857' : qaSt === 'QA Rejected' ? '#be123c' : '#b45309',
                              border: `1px solid ${qaSt === 'QA Passed' ? '#6ee7b7' : qaSt === 'QA Rejected' ? '#fca5a5' : '#fde68a'}`,
                              display: 'inline-flex', alignItems: 'center', gap: '5px'
                            }}>
                              {qaSt === 'QA Passed' ? <CheckCircle2 size={13} /> : qaSt === 'QA Rejected' ? <ShieldAlert size={13} /> : <Clock size={13} />}
                              <span>{qaSt === 'QA Passed' ? 'Passed' : qaSt === 'QA Rejected' ? 'Rejected' : 'Pending'}</span>
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => openQaModal(c)}
                              style={{
                                padding: '0.45rem 0.9rem',
                                background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                                border: 'none',
                                color: '#ffffff',
                                borderRadius: '8px',
                                fontWeight: 800,
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                boxShadow: '0 3px 8px rgba(79, 70, 229, 0.25)',
                                transition: 'all 0.15s'
                              }}
                            >
                              <Edit2 size={13} /> QA Check
                            </button>
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

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── PART 2: WHITE FABRIC CHECKING (Raw Unprinted Lot QA)  ── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'white' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* New White Fabric Inspection Form Card */}
          <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', borderRadius: '16px', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '1.25rem' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                <Layers size={18} />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#1e1b4b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                WHITE FABRIC INWARD CHECKING &amp; DEFECT LOG
              </h3>
            </div>

            {/* Auto-Fill from Fabric Inward Banner (White Fabric Only) */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              padding: '0.85rem 1rem',
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              border: '1px solid #86efac',
              borderRadius: '12px',
              marginBottom: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  background: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)'
                }}>
                  <Zap size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#14532d', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    AUTO-FILL FROM FABRIC INWARD
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, background: '#bbf7d0', color: '#15803d', padding: '1px 6px', borderRadius: '6px' }}>
                      White Fabric Only
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#166534' }}>
                    Select an inward lot to automatically populate Date, Vendor, Challan, Fabric, Panna &amp; Roll Meters.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: '1 1 300px', maxWidth: '440px' }}>
                <select
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1.5px solid #22c55e',
                    background: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                  onChange={e => handleSelectInwardLot(e.target.value)}
                  defaultValue=""
                >
                  <option value="">⚡ Select Recent Inward Lot to Auto-Fill...</option>
                  {inwardLots.map((tx, idx) => (
                    <option key={tx._id || idx} value={tx.lotNo || tx._id}>
                      Lot #{tx.lotNo || 'N/A'} — {tx.fabricQuality || 'Fabric'} ({tx.qty || 0}m) | Challan: {tx.challanNo || '—'} | {tx.vendorName || '—'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected Inward Lot Active Badge */}
            {selectedInwardBadge && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.74rem',
                fontWeight: 700,
                color: '#15803d',
                background: '#dcfce7',
                border: '1px solid #86efac',
                padding: '0.3rem 0.65rem',
                borderRadius: '8px',
                marginBottom: '1rem'
              }}>
                <CheckCircle2 size={14} color="#16a34a" />
                <span>Linked Inward: <strong>{selectedInwardBadge}</strong></span>
                <button
                  type="button"
                  onClick={() => setSelectedInwardBadge('')}
                  style={{ background: 'none', border: 'none', color: '#15803d', cursor: 'pointer', padding: 0, marginLeft: '0.3rem' }}
                >
                  <X size={13} />
                </button>
              </div>
            )}

            <form onSubmit={handleWhiteFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Row 1: Date, Vendor Name, Challan No, Fabric Quality, Panna */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Date *</label>
                  <input type="date" required value={whiteForm.date} onChange={e => setWhiteForm(f => ({ ...f, date: e.target.value }))} style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Vendor Name</label>
                  <input type="text" placeholder="e.g. Surat Weaving Mills" value={whiteForm.vendorName} onChange={e => setWhiteForm(f => ({ ...f, vendorName: e.target.value }))} style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 600 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Challan No.</label>
                  <input
                    type="text"
                    placeholder="CH-1002"
                    value={whiteForm.challanNo}
                    onChange={e => setWhiteForm(f => ({ ...f, challanNo: e.target.value }))}
                    onBlur={e => handleChallanBlur(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#4f46e5', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Fabric Quality *</label>
                  <input type="text" required placeholder="e.g. Heavy Rayon 14kg" value={whiteForm.fabricQuality} onChange={e => setWhiteForm(f => ({ ...f, fabricQuality: e.target.value }))} style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #818cf8', fontWeight: 800, color: '#3730a3' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Panna *</label>
                  <select value={whiteForm.panna} onChange={e => setWhiteForm(f => ({ ...f, panna: e.target.value }))} style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 800 }}>
                    <option value='44"'>44" Panna</option>
                    <option value='54"'>54" Panna</option>
                    <option value='58"'>58" Panna</option>
                    <option value='64"'>64" Panna</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Lot/Roll No, Total Meters & 4 White Fabric Defect Categories */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Lot / Roll No.</label>
                    <input
                      type="text"
                      placeholder="LOT-88"
                      value={whiteForm.lotNo}
                      onChange={e => setWhiteForm(f => ({ ...f, lotNo: e.target.value }))}
                      onBlur={e => handleLotNoBlur(e.target.value)}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 800 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#059669', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Total Roll Meters (Mtr) *</label>
                    <input type="number" step="0.01" required placeholder="e.g. 500.00" value={whiteForm.totalMtr} onChange={e => setWhiteForm(f => ({ ...f, totalMtr: e.target.value }))} style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '2px solid #10b981', fontWeight: 900, background: '#ecfdf5', color: '#047857' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#4f46e5', marginBottom: '0.3rem', textTransform: 'uppercase' }}>QA Decision</label>
                    <select value={whiteForm.status} onChange={e => setWhiteForm(f => ({ ...f, status: e.target.value }))} style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 800, color: whiteForm.status === 'Passed' ? '#047857' : '#b91c1c' }}>
                      <option value="Passed">✓ Passed (Ready for Printing)</option>
                      <option value="Conditionally Accepted">⚠️ Conditionally Accepted</option>
                      <option value="Rejected">✕ Rejected (Return to Vendor)</option>
                    </select>
                  </div>
                </div>

                {/* 4 White Defect Categories */}
                <div style={{ background: '#fff1f2', padding: '0.85rem', borderRadius: '8px', border: '1px solid #fecdd3' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#be123c', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    White Fabric Defect Breakdown (Meters)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9f1239' }}>1. Weaving Fault (m)</label>
                      <input type="number" step="0.01" value={whiteForm.weavingFaultMtr} onChange={e => setWhiteForm(f => ({ ...f, weavingFaultMtr: e.target.value }))} style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #fda4af', fontWeight: 700 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9f1239' }}>2. Stain / Oil Fault (m)</label>
                      <input type="number" step="0.01" value={whiteForm.stainFaultMtr} onChange={e => setWhiteForm(f => ({ ...f, stainFaultMtr: e.target.value }))} style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #fda4af', fontWeight: 700 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9f1239' }}>3. Shading Fault (m)</label>
                      <input type="number" step="0.01" value={whiteForm.shadingFaultMtr} onChange={e => setWhiteForm(f => ({ ...f, shadingFaultMtr: e.target.value }))} style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #fda4af', fontWeight: 700 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9f1239' }}>4. Width Shortage (m)</label>
                      <input type="number" step="0.01" value={whiteForm.widthShortageMtr} onChange={e => setWhiteForm(f => ({ ...f, widthShortageMtr: e.target.value }))} style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #fda4af', fontWeight: 700 }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div>
                <button type="submit" style={{ background: '#4f46e5', color: '#ffffff', border: 'none', padding: '0.65rem 1.6rem', borderRadius: '8px', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}>
                  <Save size={16} /> Save White Fabric QA Entry
                </button>
              </div>
            </form>
          </div>

          {/* White Fabric QA Inspection History Table */}
          <div className="glass-panel" style={{ padding: '1rem', borderRadius: '12px', background: '#ffffff' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.8rem' }}>
              White Fabric Inspection History ({whiteFabricLogs.length})
            </h3>
            {whiteFabricLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                No white fabric inspection logs recorded yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Vendor / Challan</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Fabric &amp; Lot</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total Roll Mtr</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Defect Mtr</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Usable Fresh Mtr</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>QA Status</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {whiteFabricLogs.map((l, idx) => (
                      <tr key={l._id || l.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700 }}>{formatDateDDMMYYYY(l.date)}</td>
                        <td style={{ padding: '8px 10px' }}>{l.vendorName || '—'} {l.challanNo ? `(${l.challanNo})` : ''}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 800, color: '#4f46e5' }}>{l.fabricQuality} ({l.panna}) {l.lotNo ? `| Lot: ${l.lotNo}` : ''}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>{l.totalMtr} m</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#be123c', fontWeight: 800 }}>{l.totalDefectMtr} m</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#047857', fontWeight: 900 }}>{l.usableFreshMtr} m</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 800, background: l.status === 'Passed' ? '#d1fae5' : '#ffe4e6', color: l.status === 'Passed' ? '#047857' : '#be123c' }}>
                            {l.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <button type="button" onClick={() => handleDeleteWhiteLog(l)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── MODAL: EDIT PRINTED FABRIC QA INSPECTION MODAL ──────────── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showFormModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', width: '100%', maxWidth: '680px', maxHeight: '92vh',
            borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #cbd5e1', overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <ShieldCheck size={22} color="#4f46e5" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>
                    Edit QA Inspection Entry — Job #{form.jobNo}
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
            <form onSubmit={handleQaFormSubmit} style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              
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
                    placeholder="e.g. 291.25"
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

              {/* QA Decision, Inspector Name & Notes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#4f46e5', marginBottom: '0.25rem', textTransform: 'uppercase' }}>QA Decision *</label>
                  <select
                    value={form.qaStatus}
                    onChange={e => setForm(f => ({ ...f, qaStatus: e.target.value }))}
                    style={{
                      width: '100%', padding: '0.55rem', borderRadius: '8px', border: '2px solid #6366f1',
                      fontSize: '0.88rem', fontWeight: 800, cursor: 'pointer',
                      background: form.qaStatus === 'QA Passed' ? '#f0fdf4' : form.qaStatus === 'QA Rejected' ? '#fff1f2' : '#fffbe5',
                      color: form.qaStatus === 'QA Passed' ? '#15803d' : form.qaStatus === 'QA Rejected' ? '#b91c1c' : '#b45309'
                    }}
                  >
                    <option value="QA Passed">✓ QA Passed (Approved)</option>
                    <option value="QA Pending">⏳ QA Pending (Under Audit)</option>
                    <option value="QA Rejected">✕ QA Rejected (Rework Required)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Inspector Name</label>
                  <input
                    type="text"
                    value={form.qaInspector}
                    onChange={e => setForm(f => ({ ...f, qaInspector: e.target.value }))}
                    placeholder="Inspector Name..."
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 700 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>QA Remarks / Notes</label>
                <textarea
                  rows={2}
                  value={form.qaNotes}
                  onChange={e => setForm(f => ({ ...f, qaNotes: e.target.value }))}
                  placeholder="Optional QA remarks e.g. minor fabric shading observed..."
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.4rem' }}>
                <button type="button" onClick={() => setShowFormModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)' }}>
                  {submitting ? 'Saving QA Record...' : 'Save QA Inspection Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
