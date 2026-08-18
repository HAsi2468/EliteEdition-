import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import {
  Flame, PlusCircle, Search, RefreshCw, Trash2, Edit2, Edit, CheckCircle2,
  AlertCircle, Cpu, Calendar, Clock, User, Layers, ArrowUpRight, Check,
  X, Download, Eye, Layers3, Activity, Tag, Sparkles, FileText, FileSpreadsheet,
  AlertTriangle, Gauge, Thermometer, Zap, Scale
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

  // Dynamic Panna Options from PrintConfig or fallback
  const pannaOptions = useMemo(() => {
    if (printConfig && Array.isArray(printConfig.widths) && printConfig.widths.length > 0) {
      return printConfig.widths.map(w => String(w).includes('"') ? String(w) : `${w}"`);
    }
    return ['36"', '38"', '44"', '48"', '52"', '54"', '58"', '60"', '64"', '72"'];
  }, [printConfig]);

  // ── TOP FORM STATE (New Fusing Entry) ───────────────────────────────────
  const [topForm, setTopForm] = useState({
    date: toLocalYMD(),
    shift: getAutoShift(),
    jobCardId: '',
    jobNo: '',
    fusingMachine: DEFAULT_FUSING_MACHINES[0],
    panna: '58"',
    butterPaperWeightKg: '',
    fusingMtr: '',
    fusingOperator: accountFullName,
    notes: ''
  });

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
      const defaultMtr = card.printedMtr || card.freshMtr || card.fusingMtr || card.totalMtr || '';
      const cardPanna = card.panna ? (String(card.panna).includes('"') ? card.panna : `${card.panna}"`) : '58"';
      setTopForm(prev => ({
        ...prev,
        jobCardId: card._id || card.id,
        jobNo: card.jobNo || '',
        panna: cardPanna,
        fusingMtr: defaultMtr,
        butterPaperWeightKg: card.butterPaperWeightKg || ''
      }));
    } else {
      setTopForm(prev => ({
        ...prev,
        jobCardId: '',
        jobNo: '',
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
    if (!topForm.fusingMtr || isNaN(topForm.fusingMtr) || Number(topForm.fusingMtr) <= 0) {
      triggerEliteAlert('Please enter valid Meters Fused (positive number).');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Find or update job card
      const targetId = topForm.jobCardId || cards.find(c => String(c.jobNo).toLowerCase() === String(topForm.jobNo).toLowerCase())?._id;

      if (targetId) {
        const payload = {
          fusingStatus: 'Fusing Done',
          fusingDate: topForm.date,
          shift: topForm.shift,
          fusingMachine: topForm.fusingMachine,
          panna: topForm.panna,
          butterPaperWeightKg: String(topForm.butterPaperWeightKg || 0),
          fusingMtr: String(topForm.fusingMtr),
          freshMtr: String(topForm.fusingMtr),
          fusingOperator: topForm.fusingOperator,
          emergencyNotes: topForm.notes
        };
        await api.updateJobCard(targetId, payload);
      }

      // 2. Log Raw Material Consumption for Butter Paper (Weight in KG)
      if (topForm.butterPaperWeightKg && Number(topForm.butterPaperWeightKg) > 0) {
        try {
          await api.createRawMaterialTransaction({
            type: 'OUTWARD',
            date: topForm.date,
            materialName: 'Butter Paper',
            qty: Number(topForm.butterPaperWeightKg),
            unit: 'Kg',
            panna: topForm.panna,
            jobNo: topForm.jobNo,
            notes: `Fusing Entry — Machine: ${topForm.fusingMachine} | Operator: ${topForm.fusingOperator}`
          });
        } catch (rmErr) {
          console.warn('Raw material log failed:', rmErr.message);
        }
      }

      triggerPushNotification(
        '🔥 Fusing Entry Submitted',
        `Job #${topForm.jobNo}: ${topForm.fusingMtr}m Fused | ${topForm.butterPaperWeightKg || 0}kg Butter Paper (${topForm.panna} Panna) logged successfully!`,
        'success'
      );

      triggerGlobalDataRefresh('fusing');
      
      // Reset form
      setTopForm({
        date: toLocalYMD(),
        shift: getAutoShift(),
        jobCardId: '',
        jobNo: '',
        fusingMachine: DEFAULT_FUSING_MACHINES[0],
        panna: '58"',
        butterPaperWeightKg: '',
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
        if (c.fusingDate === todayStr) {
          todayFreshMtr += fresh;
        }
      } else {
        pendingCount++;
      }
    });

    return { totalFreshMtr, totalWastageMtr, totalButterPaperKg, pendingCount, doneCount, todayFreshMtr };
  }, [cards]);

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
          
          {/* Row 1: DATE, SHIFT, JOB TYPE / JOBCARD NO. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
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

            <div style={{ gridColumn: 'span 2 / span 2' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                JOB TYPE / JOBCARD NO. *
              </label>
              <select
                required
                value={topForm.jobCardId}
                onChange={handleTopJobCardSelect}
                style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 700, background: '#ffffff', color: '#0f172a', cursor: 'pointer' }}
              >
                <option value="">Type or select Job Card No. (e.g. 1001)</option>
                {cards.map(c => (
                  <option key={c._id || c.id} value={c._id || c.id}>
                    {c.jobNo || 'JOB'} — {c.party || 'Party'} | {c.designName || 'Design'} ({c.fabric || 'Fabric'} {c.panna ? `${c.panna}"` : ''}) {c.fusingStatus === 'Fusing Done' ? '✓ Done' : '⏳ Pending'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: FUSING MACHINE, PANNA (DYNAMIC DROPDOWN), BUTTER PAPER CONSUMPTION (KG), METERS FUSED */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                FUSING MACHINE *
              </label>
              <select
                required
                value={topForm.fusingMachine}
                onChange={e => setTopForm(f => ({ ...f, fusingMachine: e.target.value }))}
                style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 700, background: '#ffffff', color: '#0f172a', cursor: 'pointer' }}
              >
                {DEFAULT_FUSING_MACHINES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* DYNAMIC DROPDOWN IN PANNA / PAPER WIDTH */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 800, color: '#0284c7', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                <Gauge size={13} /> PANNA / PAPER WIDTH (DYNAMIC) *
              </label>
              <select
                required
                value={topForm.panna}
                onChange={e => setTopForm(f => ({ ...f, panna: e.target.value }))}
                style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '2px solid #38bdf8', fontSize: '0.88rem', fontWeight: 800, background: '#f0f9ff', color: '#0369a1', cursor: 'pointer' }}
              >
                {pannaOptions.map(p => (
                  <option key={p} value={p}>{p} Panna / Width</option>
                ))}
              </select>
            </div>

            {/* BUTTER PAPER CONSUMPTION IN WEIGHT (KG) */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                <Scale size={13} color="#6d28d9" /> BUTTER PAPER CONSUMPTION (KG) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 12.50 kg"
                value={topForm.butterPaperWeightKg}
                onChange={e => setTopForm(f => ({ ...f, butterPaperWeightKg: e.target.value }))}
                style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 700, background: '#ffffff', color: '#0f172a' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                METERS FUSED (MTR) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="e.g. 150.50"
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

          {/* Machine Select Filter */}
          <select
            value={filterMachine}
            onChange={e => setFilterMachine(e.target.value)}
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem', height: '34px', borderRadius: '6px', border: '1px solid var(--border-light)' }}
          >
            <option value="">All Fusing Machines</option>
            {DEFAULT_FUSING_MACHINES.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

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
            background: '#ffffff', width: '100%', maxWidth: '620px', maxHeight: '90vh',
            borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #cbd5e1', overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={20} color="#059669" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
                  Fusing Production &amp; Butter Paper Consumption Report
                </h3>
              </div>
              <button type="button" onClick={() => setShowReportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem' }}>
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>Total Meters Fused</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#059669', marginTop: 4 }}>
                    {stats.totalFreshMtr.toLocaleString('en-IN')} m
                  </div>
                </div>

                <div style={{ background: '#f3e8ff', border: '1px solid #d8b4fe', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase' }}>Total Butter Paper (KG)</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#7c3aed', marginTop: 4 }}>
                    {stats.totalButterPaperKg.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg
                  </div>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
                <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Production Summary Breakdown</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e2e8f0' }}>
                  <span>Completed Job Cards:</span>
                  <b>{stats.doneCount} Cards</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e2e8f0' }}>
                  <span>Pending Job Cards:</span>
                  <b>{stats.pendingCount} Cards</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>Total Recorded Wastage (4 Faults):</span>
                  <b style={{ color: '#dc2626' }}>{stats.totalWastageMtr} m</b>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button type="button" onClick={() => setShowReportModal(false)} className="btn-secondary">Close</button>
                <button
                  type="button"
                  onClick={() => {
                    handleExportCSV();
                    setShowReportModal(false);
                  }}
                  className="btn-primary"
                  style={{ background: '#059669' }}
                >
                  <Download size={15} /> Export Report CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
