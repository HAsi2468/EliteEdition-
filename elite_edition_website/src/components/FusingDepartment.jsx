import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import {
  Flame, PlusCircle, Search, RefreshCw, Trash2, Edit2, Edit, CheckCircle2,
  AlertCircle, Cpu, Calendar, Clock, User, Layers, ArrowUpRight, Check,
  X, Download, Eye, Layers3, Activity, Tag, Sparkles, FileText, FileSpreadsheet,
  AlertTriangle, Gauge, Thermometer, Zap, Scale, Settings
} from 'lucide-react';
import { triggerPushNotification, triggerGlobalDataRefresh } from './NotificationToast';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY, toLocalYMD } from '../utils/dateUtils';
import { matchSearchQuery } from '../utils/searchUtils';
import { triggerEliteAlert } from './EliteModalDialog';
import DateRangePicker from './DateRangePicker';

function getAutoShift() {
  const hours = new Date().getHours();
  return (hours >= 9 && hours < 21) ? 'Morning' : 'Night';
}

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
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Fusing Pending', 'Fusing Done'
  const [filterMachine, setFilterMachine] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');

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

  // ── TOP FORM STATE (New Fusing Entry) ───────────────────────────────────
  const [topForm, setTopForm] = useState({
    date: toLocalYMD(),
    shift: getAutoShift(),
    onTime: '09:00',
    offTime: '19:00',
    jobCardId: '',
    jobNo: '',
    fusingMachine: DEFAULT_FUSING_MACHINES[0],
    panna: '58"',
    useButterPaper: 'Yes',
    butterPaperWeightKg: '',
    rollCompleted: 'Yes',
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
    fusingSpeed: '18 m/min',
    fusingMachine: DEFAULT_FUSING_MACHINES[0],
    fusingOperator: accountFullName,
    shift: getAutoShift(),
    useButterPaper: 'Yes',
    butterPaperWeightKg: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
    api.getPrintConfig().then(res => setPrintConfig(res)).catch(() => {});
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
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

  // Handle Selection of Job Card in Top Form
  const handleTopJobCardSelect = (e) => {
    const jId = e.target.value;
    const card = cards.find(c => String(c._id) === String(jId) || String(c.id) === String(jId));
    if (card) {
      const pMtr = card.printedMtr || card.freshMtr || card.fusingMtr || card.totalMtr || '';
      const defaultMtr = card.fusingMtr || pMtr || '';
      const cardPanna = card.panna ? (String(card.panna).includes('"') ? card.panna : `${card.panna}"`) : '58"';
      setTopForm(prev => ({
        ...prev,
        jobCardId: card._id || card.id,
        jobNo: card.jobNo || '',
        panna: cardPanna,
        printedMtr: pMtr,
        fusingMtr: defaultMtr,
        butterPaperWeightKg: card.butterPaperWeightKg || ''
      }));
    } else {
      setTopForm(prev => ({
        ...prev,
        jobCardId: '',
        jobNo: '',
        printedMtr: '',
        fusingMtr: '',
        butterPaperWeightKg: ''
      }));
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
    const isRollDone = topForm.rollCompleted === 'Yes';

    setSubmitting(true);
    try {
      // 1. Find or update job card
      const targetId = topForm.jobCardId || cards.find(c => String(c.jobNo).toLowerCase() === String(topForm.jobNo).toLowerCase())?._id;

      if (targetId) {
        const payload = {
          fusingStatus: isRollDone ? 'Fusing Done' : 'Fusing In Progress',
          fusingDate: topForm.date,
          shift: topForm.shift,
          fusingMachine: topForm.fusingMachine,
          panna: topForm.panna,
          butterPaperWeightKg: String(topForm.butterPaperWeightKg || 0),
          fusingMtr: String(fusingMtrVal),
          freshMtr: String(fusingMtrVal),
          fusingOperator: topForm.fusingOperator,
          emergencyNotes: `Roll Status: ${isRollDone ? 'Completed' : 'In Progress'}${topForm.notes ? ' | ' + topForm.notes : ''}`
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
            notes: `Fusing Entry — Machine: ${topForm.fusingMachine} | Operator: ${topForm.fusingOperator} | Roll Status: ${topForm.rollCompleted}`
          });
        } catch (rmErr) {
          console.warn('Raw material log failed:', rmErr.message);
        }
      }

      triggerPushNotification(
        '🔥 Fusing Entry Submitted',
        `Job #${topForm.jobNo}: ${fusingMtrVal}m Fused | Roll: ${isRollDone ? 'Completed' : 'In Progress'} | ${topForm.useButterPaper === 'Yes' ? (topForm.butterPaperWeightKg || 0) + 'kg Butter Paper' : 'No Butter Paper'} logged!`,
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
        panna: '58"',
        useButterPaper: 'Yes',
        butterPaperWeightKg: '',
        rollCompleted: 'Yes',
        printedMtr: '',
        fusingMtr: '',
        fusingOperator: accountFullName,
        notes: ''
      });

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

  // Open Edit Modal for a card
  const openFusingModal = (card) => {
    setSelectedCard(card);
    const defaultFresh = card.freshMtr || card.fusingMtr || card.printedMtr || card.totalMtr || '';

    setForm({
      jobCardId: card._id,
      jobNo: card.jobNo || '',
      fusingStatus: card.fusingStatus || 'Fusing Done',
      fusingDate: card.fusingDate || toLocalYMD(),
      
      freshMtr: defaultFresh,
      fabricFaultMtr: card.fabricFaultMtr !== undefined && card.fabricFaultMtr !== '' ? String(card.fabricFaultMtr) : '0',
      fusingFaultMtr: card.fusingFaultMtr !== undefined && card.fusingFaultMtr !== '' ? String(card.fusingFaultMtr) : '0',
      printFaultMtr: card.printFaultMtr !== undefined && card.printFaultMtr !== '' ? String(card.printFaultMtr) : '0',
      genuineFaultMtr: card.genuineFaultMtr !== undefined && card.genuineFaultMtr !== '' ? String(card.genuineFaultMtr) : '0',
      
      fusingTemp: card.fusingTemp || card.temperature || '210°C',
      fusingSpeed: card.fusingSpeed || card.speed || '18 m/min',
      fusingMachine: card.fusingMachine || DEFAULT_FUSING_MACHINES[0],
      fusingOperator: card.fusingOperator || accountFullName,
      shift: card.shift || getAutoShift(),
      butterPaperWeightKg: card.butterPaperWeightKg || '',
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
    if (form.freshMtr === '' || isNaN(form.freshMtr) || Number(form.freshMtr) < 0) {
      triggerEliteAlert('Please enter valid Fresh Meters (0 or positive number).');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        fusingStatus: form.fusingStatus,
        fusingDate: form.fusingDate,
        shift: form.shift,
        freshMtr: String(form.freshMtr),
        fabricFaultMtr: String(form.fabricFaultMtr || 0),
        fusingFaultMtr: String(form.fusingFaultMtr || 0),
        printFaultMtr: String(form.printFaultMtr || 0),
        genuineFaultMtr: String(form.genuineFaultMtr || 0),
        totalWastageMtr: String(calculatedWastageMtr),
        fusingMtr: String(form.freshMtr),
        fusingTemp: form.fusingTemp,
        fusingSpeed: form.fusingSpeed,
        fusingMachine: form.fusingMachine,
        fusingOperator: form.fusingOperator,
        butterPaperWeightKg: String(form.butterPaperWeightKg || 0)
      };

      await api.updateJobCard(form.jobCardId, payload);
      triggerPushNotification('🔥 Fusing Record Updated', `Job #${form.jobNo}: ${form.freshMtr}m Fresh | ${calculatedWastageMtr}m Wastage updated.`, 'success');
      triggerGlobalDataRefresh('fusing');
      setShowFormModal(false);
      fetchData();
    } catch (err) {
      triggerEliteAlert('Save Error', err.message || 'Failed to save fusing record.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Cards
  const filteredCards = useMemo(() => {
    return cards.filter(c => {
      if (searchQuery && !matchSearchQuery(c, searchQuery, ['jobNo', 'party', 'designName', 'fabric', 'fusingOperator', 'fusingMachine'])) {
        return false;
      }
      if (statusFilter !== 'All') {
        const curStatus = c.fusingStatus || 'Fusing Pending';
        if (statusFilter === 'Fusing Pending' && curStatus !== 'Fusing Pending') return false;
        if (statusFilter === 'Fusing Done' && curStatus !== 'Fusing Done') return false;
      }
      if (filterMachine && (c.fusingMachine || '') !== filterMachine) {
        return false;
      }
      if (dateStart && c.fusingDate && c.fusingDate < dateStart) return false;
      if (dateEnd && c.fusingDate && c.fusingDate > dateEnd) return false;

      return true;
    });
  }, [cards, searchQuery, statusFilter, filterMachine, dateStart, dateEnd]);

  // Statistics calculation
  const stats = useMemo(() => {
    let totalFreshMtr = 0;
    let totalWastageMtr = 0;
    let totalButterPaperKg = 0;
    let pendingCount = 0;
    let doneCount = 0;
    const todayStr = toLocalYMD();
    let todayFreshMtr = 0;
    const pannaButterKgMap = {};

    cards.forEach(c => {
      const isDone = c.fusingStatus === 'Fusing Done';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

      {/* ── TOP SECTION: NEW FUSING ENTRY FORM CARD (Matches User Reference Image) ── */}
      <div className="glass-panel" style={{
        padding: '1.35rem 1.5rem',
        borderRadius: '16px',
        boxShadow: '0 10px 30px -10px rgba(2, 132, 199, 0.12)',
        background: '#ffffff',
        border: '1px solid #e0f2fe'
      }}>
        {/* Form Card Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.8rem' }}>
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

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              style={{
                background: '#059669', color: '#ffffff', border: 'none',
                padding: '0.5rem 1.1rem', borderRadius: '8px', fontWeight: 800,
                fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                boxShadow: '0 3px 10px rgba(5, 150, 105, 0.25)'
              }}
            >
              <Zap size={15} /> GENERATE REPORT
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              style={{
                background: '#6d28d9', color: '#ffffff', border: 'none',
                padding: '0.5rem 1.1rem', borderRadius: '8px', fontWeight: 800,
                fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                boxShadow: '0 3px 10px rgba(109, 40, 217, 0.25)'
              }}
            >
              <Download size={15} /> Download Report
            </button>
          </div>
        </div>

        {/* Entry Form Grid */}
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
                <Clock size={12} color="#16a34a" /> ON TIME
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
                <Clock size={12} color="#dc2626" /> OFF TIME
              </label>
              <input
                type="time"
                value={topForm.offTime}
                onChange={e => setTopForm(f => ({ ...f, offTime: e.target.value }))}
                style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 700, background: '#ffffff', color: '#0f172a' }}
              />
            </div>
          </div>

          {/* Primary Required Fields: JOB CARD NO, PRINTED METERS, BUTTER PAPER USED?, ROLL COMPLETED? */}
            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
              
              {/* 1. JOB TYPE / JOBCARD NO. */}
              <div style={{ gridColumn: 'span 2 / span 2' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#0284c7', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                  JOB TYPE / JOBCARD NO. *
                </label>
                <select
                  required
                  value={topForm.jobCardId}
                  onChange={handleTopJobCardSelect}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '2px solid #38bdf8', fontSize: '0.92rem', fontWeight: 800, background: '#ffffff', color: '#0369a1', cursor: 'pointer' }}
                >
                  <option value="">Select Job Card No. (e.g. 1001)</option>
                  {cards.map(c => (
                    <option key={c._id || c.id} value={c._id || c.id}>
                      {c.jobNo || 'JOB'} — {c.party || 'Party'} | {c.designName || 'Design'} ({c.fabric || 'Fabric'} {c.panna ? `${c.panna}"` : ''}) {c.printedMtr ? `| ${c.printedMtr}m Printed` : ''} {c.fusingStatus === 'Fusing Done' ? '✓ Done' : '⏳ Pending'}
                    </option>
                  ))}
                </select>
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

              {/* 3. IS BUTTER PAPER USED? */}
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
                  <option value="Yes">✓ YES (Used Butter Paper)</option>
                  <option value="No">✕ NO (No Butter Paper)</option>
                </select>
              </div>

              {/* 4. WAS ROLL COMPLETED? */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 800, color: topForm.rollCompleted === 'Yes' ? '#16a34a' : '#ea580c', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                  <CheckCircle2 size={14} color={topForm.rollCompleted === 'Yes' ? '#16a34a' : '#ea580c'} /> WAS ROLL COMPLETED? *
                </label>
                <select
                  value={topForm.rollCompleted}
                  onChange={e => setTopForm(f => ({ ...f, rollCompleted: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: `2px solid ${topForm.rollCompleted === 'Yes' ? '#4ade80' : '#fb923c'}`,
                    fontSize: '0.92rem',
                    fontWeight: 800,
                    background: topForm.rollCompleted === 'Yes' ? '#f0fdf4' : '#fff7ed',
                    color: topForm.rollCompleted === 'Yes' ? '#15803d' : '#c2410c',
                    cursor: 'pointer'
                  }}
                >
                  <option value="Yes">✓ YES (Roll Completed)</option>
                  <option value="No">⏳ NO (Partial / In Progress)</option>
                </select>
              </div>
            </div>

            {/* Secondary Parameters (Date, Shift, Fusing Machine, Panna, Operator, Meters Fused) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>




              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 800, color: '#0284c7', margin: 0, textTransform: 'uppercase' }}>
                    <Gauge size={13} /> PANNA *
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
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 800, background: '#ffffff', color: '#0369a1', cursor: 'pointer' }}
                >
                  {pannaOptions.map(p => (
                    <option key={p} value={p}>{p} Panna</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                  METERS FUSED (MTR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={topForm.printedMtr ? `Auto (${topForm.printedMtr} mtr)` : 'e.g. 150.50'}
                  value={topForm.fusingMtr}
                  onChange={e => setTopForm(f => ({ ...f, fusingMtr: e.target.value }))}
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 700, background: '#ffffff', color: '#0f172a' }}
                />
              </div>
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
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                REMARKS / NOTES
              </label>
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
      </div>

      {/* Summary KPI Statistics Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
        {/* Today Fresh Output */}
        <div className="glass-panel" style={{ padding: '0.85rem 1.1rem', borderLeft: '4px solid #2563eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Today Fresh Output</span>
            <Flame size={18} color="#2563eb" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#2563eb', marginTop: 4 }}>
            {stats.todayFreshMtr.toLocaleString('en-IN')} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>meters</span>
          </div>
        </div>

        {/* Total Butter Paper Consumed */}
        <div className="glass-panel" style={{ padding: '0.85rem 1.1rem', borderLeft: '4px solid #6d28d9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Butter Paper Consumed</span>
            <Scale size={18} color="#6d28d9" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#6d28d9', marginTop: 4 }}>
            {stats.totalButterPaperKg.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>kg</span>
          </div>
        </div>

        {/* Fusing Completed */}
        <div className="glass-panel" style={{ padding: '0.85rem 1.1rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Completed Jobs</span>
            <CheckCircle2 size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10b981', marginTop: 4 }}>
            {stats.doneCount} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>cards</span>
          </div>
        </div>

        {/* Pending Jobs */}
        <div className="glass-panel" style={{ padding: '0.85rem 1.1rem', borderLeft: '4px solid #fbbf24' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Pending Fusing</span>
            <Clock size={18} color="#fbbf24" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f59e0b', marginTop: 4 }}>
            {stats.pendingCount} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>cards</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel" style={{ padding: '0.75rem 1.1rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Job No, Party, Design, Fabric, Operator..."
              style={{ paddingLeft: 30, width: '100%', fontSize: '0.82rem', height: '34px' }}
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

          {/* Status Buttons Filter */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-light)', height: '34px', alignItems: 'center' }}>
            {['All', 'Fusing Pending', 'Fusing Done'].map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '0.2rem 0.7rem', fontSize: '0.76rem', fontWeight: 800, borderRadius: '4px', border: 'none',
                  background: statusFilter === st ? (st === 'Fusing Done' ? '#10b981' : st === 'Fusing Pending' ? '#f59e0b' : '#2563eb') : 'transparent',
                  color: statusFilter === st ? '#ffffff' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s', height: '28px'
                }}
              >
                {st}
              </button>
            ))}
          </div>



          <button
            type="button"
            onClick={fetchData}
            title="Reload Data"
            style={{ padding: '0.35rem 0.65rem', height: '34px', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'transparent', cursor: 'pointer' }}
          >
            <RefreshCw size={14} className={loading ? 'spin-loader' : ''} />
          </button>
        </div>
      </div>

      {/* Main Fusing Job Cards Table */}
      <div className="glass-panel" style={{ padding: '1rem', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Flame size={18} color="#2563eb" /> Fusing Production Ledger ({filteredCards.length})
          </h3>
        </div>

        {loading && cards.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="spin-loader" />
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Loading Fusing Ledger...</p>
          </div>
        ) : filteredCards.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
            <Flame size={28} color="#94a3b8" />
            <p style={{ marginTop: '0.5rem', fontSize: '0.88rem', fontWeight: 600 }}>No job cards matching selected filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Job Card #</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Party Name</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Design &amp; Fabric</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Speed &amp; Temp</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Butter Paper</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Fresh Output</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Wastage</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCards.map((c) => {
                  const isDone = c.fusingStatus === 'Fusing Done';
                  const fresh = parseFloat(c.freshMtr || c.fusingMtr || c.printedMtr || c.totalMtr) || 0;
                  const waste = parseFloat(c.totalWastageMtr) || 0;
                  const butterKg = parseFloat(c.butterPaperWeightKg) || 0;

                  return (
                    <tr key={c._id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}>
                      
                      {/* Job Card No */}
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: '#1e293b' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{c.jobNo || 'JOB'}</span>
                          {c.pass && (
                            <span style={{ fontSize: '0.65rem', background: '#eff6ff', color: '#2563eb', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                              {c.pass}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500, marginTop: 2 }}>
                          {c.fusingDate || c.date || '—'}
                        </div>
                      </td>

                      {/* Party Name */}
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>
                        {c.party || '—'}
                      </td>

                      {/* Design & Fabric */}
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 800, color: '#0284c7' }}>{c.designName || c.designNo || '—'}</div>
                        <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: 2 }}>
                          {c.fabric || 'Fabric'} {c.panna ? `(${c.panna}")` : ''}
                        </div>
                      </td>

                      {/* Speed & Temp */}
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', background: '#fef3c7', color: '#92400e', padding: '2px 7px', borderRadius: '4px', fontWeight: 800 }}>
                            <Thermometer size={10} style={{ display: 'inline', marginRight: 2 }} />
                            {c.fusingTemp || c.temperature || '210°C'}
                          </span>
                          <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#475569', padding: '2px 7px', borderRadius: '4px', fontWeight: 700 }}>
                            <Gauge size={10} style={{ display: 'inline', marginRight: 2 }} />
                            {c.fusingSpeed || c.speed || '18 m/min'}
                          </span>
                        </div>
                      </td>

                      {/* Butter Paper Weight */}
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {butterKg > 0 ? (
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6d28d9', background: '#f3e8ff', padding: '3px 8px', borderRadius: '6px', border: '1px solid #d8b4fe' }}>
                            <Scale size={11} style={{ display: 'inline', marginRight: 3 }} />
                            {butterKg.toFixed(2)} kg
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleQuickToggleStatus(c)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            background: isDone ? '#d1fae5' : '#fef3c7',
                            color: isDone ? '#047857' : '#b45309',
                            border: `1px solid ${isDone ? '#6ee7b7' : '#fde68a'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {isDone ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                          <span>{isDone ? 'Fusing Done' : 'Pending'}</span>
                        </button>
                      </td>

                      {/* Fresh Output */}
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: '#059669', fontSize: '0.9rem' }}>
                        {fresh > 0 ? `${fresh.toLocaleString('en-IN')} m` : '—'}
                      </td>

                      {/* Total Wastage */}
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: waste > 0 ? '#dc2626' : '#94a3b8' }}>
                        {waste > 0 ? `${waste} m` : '0 m'}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => openFusingModal(c)}
                          style={{
                            padding: '0.35rem 0.75rem',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#2563eb',
                            borderRadius: '6px',
                            fontWeight: 800,
                            fontSize: '0.76rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
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
        )}
      </div>

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
                <Flame size={20} color="#2563eb" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                    Edit Fusing Production Entry — Job #{form.jobNo}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Enter Fresh Meters output, Butter Paper weight &amp; 4 Wastage fault breakdown</span>
                </div>
              </div>
              <button type="button" onClick={() => setShowFormModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleFormSubmit} style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Fresh Mtr & Butter Paper Weight */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#059669', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                    Fresh Output (Net Usable MTR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.freshMtr}
                    onChange={e => setForm(f => ({ ...f, freshMtr: e.target.value }))}
                    placeholder="e.g. 150.00"
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '2px solid #10b981', fontWeight: 800, fontSize: '0.95rem', background: '#ecfdf5', color: '#047857' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#6d28d9', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                    Butter Paper Weight (KG)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.butterPaperWeightKg}
                    onChange={e => setForm(f => ({ ...f, butterPaperWeightKg: e.target.value }))}
                    placeholder="e.g. 12.50 kg"
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 700, fontSize: '0.9rem', background: '#ffffff', color: '#0f172a' }}
                  />
                </div>
              </div>

              {/* 4 Wastage Fault Breakdown */}
              <div style={{ background: '#fff1f2', padding: '0.85rem', borderRadius: '8px', border: '1px solid #fecdd3' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#be123c', textTransform: 'uppercase', marginBottom: '0.6rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Wastage Breakdown (4 Fault Types)</span>
                  <span>Total Wastage: <b>{calculatedWastageMtr} Mtr</b></span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9f1239' }}>1. Fabric Fault (Mtr)</label>
                    <input
                      type="number" step="0.01"
                      value={form.fabricFaultMtr}
                      onChange={e => setForm(f => ({ ...f, fabricFaultMtr: e.target.value }))}
                      style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #fda4af', fontSize: '0.85rem', fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9f1239' }}>2. Fusing Fault (Mtr)</label>
                    <input
                      type="number" step="0.01"
                      value={form.fusingFaultMtr}
                      onChange={e => setForm(f => ({ ...f, fusingFaultMtr: e.target.value }))}
                      style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #fda4af', fontSize: '0.85rem', fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9f1239' }}>3. Print Fault (Mtr)</label>
                    <input
                      type="number" step="0.01"
                      value={form.printFaultMtr}
                      onChange={e => setForm(f => ({ ...f, printFaultMtr: e.target.value }))}
                      style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #fda4af', fontSize: '0.85rem', fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9f1239' }}>4. Genuine Fault (Mtr)</label>
                    <input
                      type="number" step="0.01"
                      value={form.genuineFaultMtr}
                      onChange={e => setForm(f => ({ ...f, genuineFaultMtr: e.target.value }))}
                      style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #fda4af', fontSize: '0.85rem', fontWeight: 700 }}
                    />
                  </div>
                </div>
              </div>

              {/* Machine & Specs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: '0.2rem' }}>Fusing Machine</label>
                  <select
                    value={form.fusingMachine}
                    onChange={e => setForm(f => ({ ...f, fusingMachine: e.target.value }))}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700 }}
                  >
                    {DEFAULT_FUSING_MACHINES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: '0.2rem' }}>Fusing Status</label>
                  <select
                    value={form.fusingStatus}
                    onChange={e => setForm(f => ({ ...f, fusingStatus: e.target.value }))}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700 }}
                  >
                    <option value="Fusing Pending">Fusing Pending</option>
                    <option value="Fusing Done">Fusing Done</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: '0.2rem' }}>Operator Name</label>
                  <input
                    type="text"
                    value={form.fusingOperator}
                    onChange={e => setForm(f => ({ ...f, fusingOperator: e.target.value }))}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowFormModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary" style={{ background: '#2563eb' }}>
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

    </div>
  );
}
