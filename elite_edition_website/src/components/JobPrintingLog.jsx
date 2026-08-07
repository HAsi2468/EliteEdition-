import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Printer, PlusCircle, Search, RefreshCw, Trash2, Edit2, CheckCircle2,
  AlertCircle, Cpu, Calendar, Clock, User, Layers, ArrowUpRight, Check,
  X, Download, Eye, Layers3, Activity, Tag, Sparkles
} from 'lucide-react';
import { triggerPushNotification, triggerGlobalDataRefresh } from './NotificationToast';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../utils/dateUtils';
import JobCardTooltip from './JobCardTooltip';

// Automatic Shift Calculator:
// Morning Shift: 9:00 AM (09:00) to 8:59 PM (20:59)
// Night Shift:   9:00 PM (21:00) to 8:59 AM (08:59)
function getAutoShift() {
  const hours = new Date().getHours();
  return (hours >= 9 && hours < 21) ? 'Morning' : 'Night';
}

const DEFAULT_MACHINES = [
  'Machine 1 (Grando)',
  'Machine 2 (Printdot)',
  'Homer 1',
  'Homer 2',
  'Kyocera 1',
  'Kyocera 2',
  'DGI 1',
  'Reggiani'
];

const PASS_OPTIONS = [
  '1 PASS',
  '2 PASS',
  '3 PASS',
  '4 PASS',
  '6 PASS',
  '8 PASS',
  '12 PASS'
];

export default function JobPrintingLog() {
  // Main Data States
  const [logs, setLogs] = useState([]);
  const [jobCards, setJobCards] = useState([]);
  const [machinesList, setMachinesList] = useState(DEFAULT_MACHINES);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Filters State
  const [searchJob, setSearchJob] = useState('');
  const [filterMachine, setFilterMachine] = useState('');
  const [dateStart, setDateStart] = useState(() => new Date().toISOString().split('T')[0]);
  const [dateEnd, setDateEnd] = useState(() => new Date().toISOString().split('T')[0]);

  // Edit Mode state
  const [editingLogId, setEditingLogId] = useState(null);

  const user = api.getCurrentUser();
  const accountFullName = user ? (user.name || user.fullName || user.username || '') : '';

  // Form State
  const [selectedJob, setSelectedJob] = useState(null);
  const [form, setForm] = useState({
    jobNo: '',
    jobCardId: '',
    machineName: '',
    pass: '4 PASS',
    meters: '',
    date: new Date().toISOString().split('T')[0],
    operatorName: accountFullName, // BY DEFAULT PRE-FILLED WITH ACCOUNT FULL NAME
    shift: getAutoShift(), // AUTOMATICALLY SET BASED ON TIME (Morning/Night)
    notes: ''
  });

  // Selected Job Card History Drawer / Details State
  const [viewingJobHistory, setViewingJobHistory] = useState(null);
  const [jobHistoryData, setJobHistoryData] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Dedicated Digital Operator Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportStartDate, setReportStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportMachine, setReportMachine] = useState('');
  const [reportShift, setReportShift] = useState('');
  const [reportOperator, setReportOperator] = useState('');
  const [reportPass, setReportPass] = useState('');
  const [reportSearchJob, setReportSearchJob] = useState('');
  const [reportLoadingPdf, setReportLoadingPdf] = useState(false);

  // Load Machines from Print Settings Config
  const fetchPrintConfig = async () => {
    try {
      const res = await api.getPrintConfig();
      if (res && res.machines && Array.isArray(res.machines)) {
        const mNames = res.machines.map(m => (typeof m === 'object' ? m.name : m)).filter(Boolean);
        if (mNames.length > 0) {
          setMachinesList(mNames);
          if (!form.machineName) {
            setForm(prev => ({ ...prev, machineName: mNames[0] }));
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load machine list from Print Settings:', err);
    }
  };

  // Load Job Cards for Selection
  const fetchJobCards = async () => {
    try {
      const res = await api.getJobCards({ limit: 1000 });
      if (res.data) setJobCards(res.data);
    } catch (err) {
      console.error('Failed to load job cards:', err);
    }
  };

  // Load Print Logs List
  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getJobPrintLogs({
        jobNo: searchJob,
        machineName: filterMachine,
        dateStart,
        dateEnd,
        limit: 200
      });
      if (res.data) setLogs(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load printing logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrintConfig();
    fetchJobCards();

    const handleDataRefresh = () => {
      fetchJobCards();
      fetchLogs();
    };
    window.addEventListener('elite-data-refresh', handleDataRefresh);
    return () => window.removeEventListener('elite-data-refresh', handleDataRefresh);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [searchJob, filterMachine, dateStart, dateEnd]);

  // Recalculate auto shift every minute or when date changes
  useEffect(() => {
    setForm(prev => ({ ...prev, shift: getAutoShift() }));
  }, [form.date]);

  // Find matching Job Card helper
  const findMatchingJob = (val) => {
    if (!val) return null;
    const clean = String(val).trim().toUpperCase();
    const digitsOnly = clean.replace(/[^\d]/g, '');

    return jobCards.find(c => {
      if (c._id === val) return true;
      const jNo = String(c.jobNo || '').trim().toUpperCase();
      const jDigits = jNo.replace(/[^\d]/g, '');

      if (jNo === clean) return true;
      if (digitsOnly && jDigits === digitsOnly) return true;
      if (jNo.includes(clean)) return true;
      return false;
    });
  };

  // Calculate completion & pending meters for any job card
  const getJobProgressStats = (job) => {
    if (!job) return { targetMtr: 0, printedMtr: 0, remainingMtr: 0, progressPct: 0, statusText: 'Pending', statusColor: '#f59e0b' };

    const targetMatch = String(job.totalMtr || job.consumption || '0').match(/[\d.]+/);
    const targetMtr = targetMatch ? parseFloat(targetMatch[0]) : 0;

    const printedMatch = String(job.printMtr || '0').match(/[\d.]+/);
    let printedMtr = printedMatch ? parseFloat(printedMatch[0]) : 0;

    // Calculate from current logs if present
    const cardLogs = logs.filter(l => l.jobCardId === job._id || l.jobNo === job.jobNo);
    if (cardLogs.length > 0) {
      printedMtr = cardLogs.reduce((sum, l) => sum + (Number(l.meters) || 0), 0);
    }

    const remainingMtr = Math.max(0, targetMtr - printedMtr);
    const progressPct = targetMtr > 0 ? Math.min(100, Math.round((printedMtr / targetMtr) * 100)) : 0;

    let statusText = 'Pending';
    let statusColor = '#f59e0b'; // Amber

    if (progressPct >= 100) {
      statusText = 'Completed (100%)';
      statusColor = '#10b981'; // Green
    } else if (printedMtr > 0) {
      statusText = `In Progress (${progressPct}% Done • ${remainingMtr.toFixed(2)}m Pending)`;
      statusColor = '#38bdf8'; // Blue
    } else {
      statusText = `Pending (0% Printed • ${targetMtr.toFixed(2)}m Target)`;
      statusColor = '#f59e0b';
    }

    return { targetMtr, printedMtr, remainingMtr, progressPct, statusText, statusColor };
  };

  // Handle Job Selection Change (like Challan form)
  const handleJobSelect = (val) => {
    const matched = findMatchingJob(val);

    if (matched) {
      setSelectedJob(matched);
      setForm(prev => ({
        ...prev,
        jobNo: matched.jobNo,
        jobCardId: matched._id,
        machineName: matched.machineName ? (machinesList.find(m => m.toLowerCase().includes(matched.machineName.toLowerCase())) || matched.machineName) : (prev.machineName || machinesList[0] || 'Machine 1'),
        pass: matched.pass ? (PASS_OPTIONS.find(p => p.toUpperCase() === matched.pass.toUpperCase()) || matched.pass) : prev.pass
      }));
    } else {
      setSelectedJob(null);
      setForm(prev => ({
        ...prev,
        jobNo: val,
        jobCardId: ''
      }));
    }
  };

  // Submit Print Entry
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.jobNo) {
      alert('Please select or enter a Job Card Number.');
      return;
    }
    if (!form.machineName) {
      alert('Please select a Printing Machine.');
      return;
    }
    if (!form.meters || parseFloat(form.meters) <= 0) {
      alert('Please enter a valid meter quantity.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        meters: parseFloat(form.meters)
      };

      if (editingLogId) {
        await api.updateJobPrintLog(editingLogId, payload);
        triggerPushNotification('✏️ Print Log Updated', `Updated print log for Job #${form.jobNo} (${form.meters} mtr)`, 'success');
        setEditingLogId(null);
      } else {
        await api.createJobPrintLog(payload);
        triggerPushNotification('🖨️ Print Run Logged', `Logged ${form.meters} mtr for Job #${form.jobNo} on ${form.machineName} (${form.shift} Shift)`, 'success');
      }

      // Clear meters & notes for next log entry, but keep selected job card & machine
      setForm(prev => ({
        ...prev,
        meters: '',
        notes: ''
      }));

      await fetchLogs();
      await fetchJobCards();
      triggerGlobalDataRefresh('jobcards');

      if (viewingJobHistory && viewingJobHistory.jobNo === form.jobNo) {
        loadJobCardHistory(form.jobNo);
      }
    } catch (err) {
      alert(err.message || 'Failed to save print entry.');
    } finally {
      setSubmitting(false);
    }
  };

  // Start Editing a Log Entry
  const handleStartEdit = (log) => {
    setEditingLogId(log._id);
    const matched = findMatchingJob(log.jobNo) || findMatchingJob(log.jobCardId);
    if (matched) setSelectedJob(matched);

    let parsedDate = new Date().toISOString().split('T')[0];
    if (log.date) {
      const d = new Date(log.date);
      if (!isNaN(d.getTime())) {
        parsedDate = d.toISOString().split('T')[0];
      }
    }

    setForm({
      jobNo: log.jobNo || '',
      jobCardId: log.jobCardId || (matched ? matched._id : ''),
      machineName: log.machineName || machinesList[0] || 'Machine 1',
      pass: log.pass || '4 PASS',
      meters: log.meters ? String(log.meters) : '',
      date: parsedDate,
      shift: log.shift || getAutoShift(),
      operatorName: log.operatorName || '',
      notes: log.notes || ''
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Cancel Editing
  const handleCancelEdit = () => {
    setEditingLogId(null);
    setSelectedJob(null);
    setForm({
      jobNo: '',
      jobCardId: '',
      machineName: machinesList[0] || 'Machine 1',
      pass: '4 PASS',
      meters: '',
      date: new Date().toISOString().split('T')[0],
      shift: getAutoShift(),
      operatorName: accountFullName,
      notes: ''
    });
  };

  // Delete Log Entry
  const handleDeleteLog = async (logId, jobNo) => {
    if (!window.confirm(`Are you sure you want to delete this print log for Job #${jobNo}?`)) return;
    try {
      await api.deleteJobPrintLog(logId);
      triggerPushNotification('🗑️ Print Log Deleted', `Removed entry for Job #${jobNo}`, 'info');
      await fetchLogs();
      await fetchJobCards();
      triggerGlobalDataRefresh('jobcards');
      if (viewingJobHistory && viewingJobHistory.jobNo === jobNo) {
        loadJobCardHistory(jobNo);
      }
    } catch (err) {
      alert(err.message || 'Failed to delete log entry.');
    }
  };

  // Load Job Card History Detail
  const loadJobCardHistory = async (jobNoOrId) => {
    setLoadingHistory(true);
    try {
      const res = await api.getJobCardPrintLogs(jobNoOrId);
      if (res.data) {
        setJobHistoryData(res);
        setViewingJobHistory(res.jobCard);
      }
    } catch (err) {
      alert(err.message || 'Failed to load Job Card history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['Date', 'Job No', 'Machine Name', 'Pass', 'Meters Printed', 'Operator', 'Shift', 'Notes'];
    const rows = logs.map(l => [
      formatDateDDMMYYYY(l.date),
      l.jobNo,
      `"${l.machineName}"`,
      `"${l.pass}"`,
      l.meters,
      `"${l.operatorName || ''}"`,
      l.shift,
      `"${l.notes || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Printing_Logs_${dateStart}_to_${dateEnd}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compute Dashboard Stats
  const totalMetersLogged = logs.reduce((s, l) => s + (l.meters || 0), 0);
  const activeMachinesCount = new Set(logs.map(l => l.machineName)).size;
  const uniqueJobCardsCount = new Set(logs.map(l => l.jobNo)).size;

  // Filter out Job Cards that have completed printing for entry selection
  const activeJobCards = jobCards.filter(c => {
    if (c.printStatus === 'Printing Done') return false;
    const stats = getJobProgressStats(c);
    return stats.progressPct < 100;
  });

  // Selected Job Progress Stats
  const selectedJobStats = selectedJob ? getJobProgressStats(selectedJob) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '2rem' }}>
      
      {/* ── 1. HEADER BANNER ── */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#38bdf8,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(56,189,248,0.3)' }}>
            <Printer size={22} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Printing Entry & Logs</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>
              Log multiple machine runs per Job Card, monitor shifts, and track completion progress.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {/* Export CSV */}
          <button onClick={handleExportCSV} className="btn-secondary" style={{ padding: '0.55rem 1.1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={15} /> Export CSV Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #38bdf8', background: 'rgba(56,189,248,0.03)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>TOTAL METERS LOGGED</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: 2 }}>{totalMetersLogged.toLocaleString('en-IN', { minimumFractionDigits: 2 })} mtr</div>
          <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: 2 }}>{logs.length} Total Print Runs Logged</div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #8b5cf6', background: 'rgba(139,92,246,0.03)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>CONFIGURED MACHINES</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: 2 }}>{machinesList.length} Machines</div>
          <div style={{ fontSize: '0.72rem', color: '#a78bfa', marginTop: 2 }}>Loaded from Print Settings</div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #10b981', background: 'rgba(16,185,129,0.03)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>ACTIVE JOB CARDS</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: 2 }}>{uniqueJobCardsCount} Job Cards</div>
          <div style={{ fontSize: '0.72rem', color: '#34d399', marginTop: 2 }}>With Printing Runs</div>
        </div>
      </div>

      {/* ── 2. NEW PRINTING ENTRY FORM ── */}
      <div className="responsive-form-grid" style={{ display: 'grid', gridTemplateColumns: selectedJob ? 'minmax(0, 1.4fr) minmax(0, 1fr)' : '1fr', gap: '1.25rem' }}>
        
        {/* Entry Form */}
        <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: `4px solid ${editingLogId ? '#f59e0b' : '#38bdf8'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: editingLogId ? '#f59e0b' : '#38bdf8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {editingLogId ? <Edit2 size={16} /> : <PlusCircle size={16} />}
              {editingLogId ? 'Edit Printing Log' : 'New Printing Entry'}
            </div>

            {/* Right-aligned Buttons in Form Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {/* Button 1: Report */}
              <button
                type="button"
                onClick={() => setShowReportModal(true)}
                className="btn-primary"
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  boxShadow: '0 2px 8px rgba(124, 58, 237, 0.25)',
                  cursor: 'pointer'
                }}
              >
                <Activity size={14} /> Report
              </button>

              {/* Button 2: Raw Material Usage */}
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('elite-navigate-tab', { detail: 'jobcards_raw_materials' }));
                }}
                className="btn-primary"
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
                  cursor: 'pointer'
                }}
              >
                <Sparkles size={14} /> Raw Material Usage
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            
            {/* ── LINE 1: DATE, JOBCARD TYPE, SHIFT ── */}
            <div className="responsive-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2.2fr 1fr', gap: '0.75rem' }}>
              
              {/* Date */}
              <div>
                <label style={labelStyle}>DATE <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  style={inputStyle}
                  required
                />
              </div>

              {/* Jobcard Type / Selection (Direct Input) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <label style={labelStyle}>JOBCARD TYPE <span style={{ color: '#ef4444' }}>*</span></label>
                  {selectedJobStats && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: selectedJobStats.statusColor }}>
                      ⚡ {selectedJobStats.statusText}
                    </span>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="Type Job Card No. (e.g. 1001)"
                  value={form.jobNo}
                  onChange={e => handleJobSelect(e.target.value)}
                  style={{ ...inputStyle, width: '100%', fontWeight: 700, fontSize: '0.9rem' }}
                  required
                />
              </div>

              {/* Shift */}
              <div>
                <label style={labelStyle}>SHIFT <span style={{ color: '#ef4444' }}>*</span></label>
                <select value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))} style={inputStyle}>
                  <option value="Morning">Morning</option>
                  <option value="Night">Night</option>
                </select>
              </div>
            </div>

            {/* ── LINE 2: PRINTING MACHINE, PASS, METERS PRINTED ── */}
            <div className="responsive-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>PRINTING MACHINE <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  value={form.machineName}
                  onChange={e => setForm(f => ({ ...f, machineName: e.target.value }))}
                  style={inputStyle}
                  required
                >
                  <option value="">-- Select Machine --</option>
                  {machinesList.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>PASS</label>
                <select
                  value={form.pass}
                  onChange={e => setForm(f => ({ ...f, pass: e.target.value }))}
                  style={inputStyle}
                >
                  {PASS_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>METERS PRINTED (MTR) <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.meters}
                  onChange={e => setForm(f => ({ ...f, meters: e.target.value }))}
                  placeholder="e.g. 150.50"
                  style={{ ...inputStyle, fontSize: '0.95rem', fontWeight: 800, color: '#38bdf8' }}
                  required
                />
              </div>
            </div>

            {/* ── LINE 3: OPERATOR NAME & REMARKS ── */}
            <div className="responsive-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>OPERATOR NAME</label>
                <input
                  type="text"
                  value={form.operatorName}
                  onChange={e => setForm(f => ({ ...f, operatorName: e.target.value }))}
                  placeholder="Operator Name"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>REMARKS / NOTES</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional notes e.g. Roll #2..."
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Submit Button */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
              <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', background: editingLogId ? 'linear-gradient(135deg, #f59e0b, #d97706)' : undefined }}>
                {editingLogId ? <Edit2 size={16} /> : <PlusCircle size={16} />}
                {submitting ? (editingLogId ? 'Updating Entry...' : 'Saving Entry...') : (editingLogId ? 'Update Print Log Entry' : 'Submit Print Entry Log')}
              </button>

              {editingLogId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="btn-secondary"
                  style={{ padding: '0.65rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <X size={15} /> Cancel Edit
                </button>
              )}

              {selectedJob && !editingLogId && (
                <button
                  type="button"
                  onClick={() => loadJobCardHistory(selectedJob.jobNo)}
                  className="btn-secondary"
                  style={{ padding: '0.65rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Eye size={15} /> View All Runs for Job #{selectedJob.jobNo}
                </button>
              )}
            </div>

          </form>
        </div>

        {/* Selected Job Card Status Card (Completion & Pending Indicator) */}
        {selectedJob && selectedJobStats && (
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', background: 'rgba(56,189,248,0.02)', borderLeft: `4px solid ${selectedJobStats.statusColor}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: selectedJobStats.statusColor, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={16} /> Completion Status
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>#{selectedJob.jobNo}</span>
            </div>

            {/* Large Progress Indicator Badge */}
            <div style={{ padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.4rem', fontWeight: 700 }}>
                <span style={{ color: 'var(--text-muted)' }}>Progress: <strong style={{ color: 'var(--text-primary)' }}>{selectedJobStats.progressPct}%</strong></span>
                <span style={{ color: selectedJobStats.statusColor }}>{selectedJobStats.statusText}</span>
              </div>

              {/* Progress Line */}
              <div style={{ width: '100%', height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${selectedJobStats.progressPct}%`,
                    height: '100%',
                    background: selectedJobStats.statusColor,
                    borderRadius: 5,
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
            </div>

            {/* Field Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.82rem' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Party:</span> <strong style={{ color: 'var(--text-primary)' }}>{selectedJob.party || 'Standard Client'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Fabric:</span> <strong style={{ color: 'var(--text-primary)' }}>{selectedJob.fabric || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Design:</span> <strong style={{ color: 'var(--primary)' }}>{selectedJob.designName || selectedJob.designNo || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Panna:</span> <strong style={{ color: 'var(--text-primary)' }}>{selectedJob.panna || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Target Mtr:</span> <strong style={{ color: '#f59e0b' }}>{selectedJobStats.targetMtr.toFixed(2)} mtr</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Total Printed:</span> <strong style={{ color: '#38bdf8' }}>{selectedJobStats.printedMtr.toFixed(2)} mtr</strong></div>
              <div style={{ gridColumn: 'span 2' }}><span style={{ color: 'var(--text-muted)' }}>Pending Remaining:</span> <strong style={{ color: selectedJobStats.remainingMtr > 0 ? '#ef4444' : '#10b981' }}>{selectedJobStats.remainingMtr.toFixed(2)} mtr</strong></div>
            </div>

            {/* Action button */}
            <button
              onClick={() => loadJobCardHistory(selectedJob.jobNo)}
              className="btn-secondary"
              style={{ marginTop: 'auto', width: '100%', padding: '0.55rem', fontSize: '0.8rem', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Eye size={14} /> Inspect Full Multi-Run History
            </button>
          </div>
        )}

      </div>

      {/* ── 3. PRINT RUNS AUDIT LOG TABLE & FILTERS ── */}
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Filter controls */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchJob}
              onChange={e => setSearchJob(e.target.value)}
              placeholder="Search Job No..."
              style={{ paddingLeft: 32, width: '100%', fontSize: '0.85rem' }}
            />
          </div>

          <select
            value={filterMachine}
            onChange={e => setFilterMachine(e.target.value)}
            style={{ padding: '0.45rem 0.75rem', fontSize: '0.82rem', background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: 6, color: 'var(--text-primary)' }}
          >
            <option value="">All Machines</option>
            {machinesList.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>From:</span>
            <input
              type="date"
              value={dateStart}
              onChange={e => setDateStart(e.target.value)}
              style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem', borderRadius: 4, border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>To:</span>
            <input
              type="date"
              value={dateEnd}
              onChange={e => setDateEnd(e.target.value)}
              style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem', borderRadius: 4, border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
            />
          </div>

          <button onClick={fetchLogs} className="btn-icon" title="Refresh Logs">
            <RefreshCw size={15} className={loading ? 'spin-loader' : ''} />
          </button>
        </div>

        {/* Logs Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.02)' }}>
                <th style={thStyle}>Date & Time</th>
                <th style={thStyle}>Job No</th>
                <th style={thStyle}>Machine Name</th>
                <th style={thStyle}>Pass</th>
                <th style={thStyle}>Meters Printed</th>
                <th style={thStyle}>Operator</th>
                <th style={thStyle}>Shift</th>
                <th style={thStyle}>Remarks</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No machine print logs found for the selected date range.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={tdStyle}>{formatDateTimeDDMMYYYY(log.date || log.created_date_time)}</td>
                    <td style={{ ...tdStyle, fontWeight: 800, color: 'var(--text-primary)' }}>
                      <button
                        onClick={() => loadJobCardHistory(log.jobNo)}
                        style={{ background: 'none', border: 'none', color: '#38bdf8', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        #{log.jobNo}
                      </button>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{log.machineName}</td>
                    <td style={tdStyle}>{log.pass}</td>
                    <td style={{ ...tdStyle, fontWeight: 900, color: '#34d399' }}>{Number(log.meters).toFixed(2)} mtr</td>
                    <td style={tdStyle}>{log.operatorName || '—'}</td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: log.shift === 'Morning' ? 'rgba(56,189,248,0.1)' : 'rgba(167,139,250,0.1)', color: log.shift === 'Morning' ? '#38bdf8' : '#a78bfa' }}>
                        {log.shift || 'Morning'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{log.notes || '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleStartEdit(log)}
                          style={{ padding: '0.3rem', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', borderRadius: 4, cursor: 'pointer' }}
                          title="Edit Print Log Entry"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => loadJobCardHistory(log.jobNo)}
                          className="btn-icon"
                          title="View Job Card Run History"
                          style={{ padding: '0.3rem' }}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteLog(log._id, log.jobNo)}
                          style={{ padding: '0.3rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 4, cursor: 'pointer' }}
                          title="Delete Log Entry"
                        >
                          <Trash2 size={14} />
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

      {/* ── 4. JOB CARD MULTI-RUN HISTORY MODAL ── */}
      {jobHistoryData && viewingJobHistory && (
        <div className="modal-overlay" onClick={() => setJobHistoryData(null)}>
          <div className="modal-content" style={{ maxWidth: 700, padding: '1.5rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Multi-Run Printing Audit History — Job #{viewingJobHistory.jobNo}
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  Party: {viewingJobHistory.party || 'Client'} • Design: {viewingJobHistory.designName || viewingJobHistory.designNo || 'Custom'}
                </p>
              </div>
              <button onClick={() => setJobHistoryData(null)} className="btn-icon"><X size={16} /></button>
            </div>

            {/* Visual Progress Bar */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', borderRadius: 10, padding: '1rem', marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Target: <strong style={{ color: 'var(--text-primary)' }}>{jobHistoryData.summary.targetMtr} mtr</strong></span>
                <span style={{ color: '#38bdf8' }}>Printed: <strong>{jobHistoryData.summary.totalPrintedMtr.toFixed(2)} mtr</strong> ({jobHistoryData.summary.progressPct}%)</span>
                <span style={{ color: '#f59e0b' }}>Remaining: <strong>{jobHistoryData.summary.remainingMtr.toFixed(2)} mtr</strong></span>
              </div>

              {/* Progress bar line */}
              <div style={{ width: '100%', height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${jobHistoryData.summary.progressPct}%`,
                    height: '100%',
                    background: jobHistoryData.summary.progressPct >= 100 ? '#10b981' : 'linear-gradient(90deg, #38bdf8, #8b5cf6)',
                    borderRadius: 5,
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
            </div>

            {/* Run Logs Table */}
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.02)' }}>
                    <th style={thStyle}>Run #</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Machine</th>
                    <th style={thStyle}>Pass</th>
                    <th style={thStyle}>Meters</th>
                    <th style={thStyle}>Shift</th>
                    <th style={thStyle}>Operator</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {jobHistoryData.data.map((l, idx) => (
                    <tr key={l._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={tdStyle}>Run #{jobHistoryData.data.length - idx}</td>
                      <td style={tdStyle}>{formatDateDDMMYYYY(l.date)}</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{l.machineName}</td>
                      <td style={tdStyle}>{l.pass}</td>
                      <td style={{ ...tdStyle, fontWeight: 800, color: '#34d399' }}>{Number(l.meters).toFixed(2)} mtr</td>
                      <td style={tdStyle}>{l.shift}</td>
                      <td style={tdStyle}>{l.operatorName || '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteLog(l._id, l.jobNo)}
                          style={{ padding: '0.2rem 0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem' }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
              <button onClick={() => setJobHistoryData(null)} className="btn-secondary" style={{ padding: '0.5rem 1.25rem' }}>
                Close History Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. DEDICATED DIGITAL OPERATOR PRINTING REPORT MODAL ── */}
      {showReportModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '1100px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-card, #131722)',
            borderRadius: '16px',
            border: '1px solid var(--border-light, #2a324b)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(56,189,248,0.05) 100%)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #7c3aed, #4c1d95)',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'center',
                  boxShadow: '0 4px 14px rgba(124,58,237,0.35)'
                }}>
                  <Activity size={22} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Digital Operator Printing Production Report
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2, margin: 0 }}>
                    Filter date range, machine & shift to preview complete printing details and generate official PDF.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowReportModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-muted)',
                  borderRadius: '50%',
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body - Scrollable Content */}
            <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
              
              {/* ── FILTER CONTROLS BAR ── */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-light)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '0.75rem',
                alignItems: 'end'
              }}>
                <div>
                  <label style={labelStyle}>FROM DATE</label>
                  <input
                    type="date"
                    value={reportStartDate}
                    onChange={e => setReportStartDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>TO DATE</label>
                  <input
                    type="date"
                    value={reportEndDate}
                    onChange={e => setReportEndDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>MACHINE</label>
                  <select
                    value={reportMachine}
                    onChange={e => setReportMachine(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">All Machines</option>
                    {machinesList.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>SHIFT</label>
                  <select
                    value={reportShift}
                    onChange={e => setReportShift(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">All Shifts</option>
                    <option value="Morning">Morning Shift</option>
                    <option value="Night">Night Shift</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>PASS</label>
                  <select
                    value={reportPass}
                    onChange={e => setReportPass(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">All Passes</option>
                    {PASS_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>OPERATOR</label>
                  <input
                    type="text"
                    placeholder="Operator Name"
                    value={reportOperator}
                    onChange={e => setReportOperator(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>JOB CARD #</label>
                  <input
                    type="text"
                    placeholder="Job #"
                    value={reportSearchJob}
                    onChange={e => setReportSearchJob(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setReportStartDate(new Date().toISOString().split('T')[0]);
                      setReportEndDate(new Date().toISOString().split('T')[0]);
                      setReportMachine('');
                      setReportShift('');
                      setReportOperator('');
                      setReportPass('');
                      setReportSearchJob('');
                    }}
                    className="btn-secondary"
                    style={{ width: '100%', padding: '0.48rem', fontSize: '0.78rem', justifyContent: 'center' }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* ── LIVE ANALYTICS & DETAILED SUMMARY ── */}
              {(() => {
                const repLogs = logs.filter(l => {
                  if (reportMachine && !String(l.machineName || '').toLowerCase().includes(reportMachine.toLowerCase())) return false;
                  if (reportShift && l.shift !== reportShift) return false;
                  if (reportPass && l.pass !== reportPass) return false;
                  if (reportOperator && !String(l.operatorName || '').toLowerCase().includes(reportOperator.toLowerCase())) return false;
                  if (reportSearchJob && !String(l.jobNo || '').toLowerCase().includes(reportSearchJob.toLowerCase())) return false;
                  if (reportStartDate || reportEndDate) {
                    if (!l.date) return true;
                    const dStr = new Date(l.date).toISOString().split('T')[0];
                    if (reportStartDate && dStr < reportStartDate) return false;
                    if (reportEndDate && dStr > reportEndDate) return false;
                  }
                  return true;
                });

                const repTotalMeters = repLogs.reduce((s, l) => s + (Number(l.meters) || 0), 0);
                const repUniqueJobCount = new Set(repLogs.map(l => l.jobNo)).size;
                const repMorningMeters = repLogs.filter(l => l.shift === 'Morning').reduce((s, l) => s + (Number(l.meters) || 0), 0);
                const repNightMeters = repLogs.filter(l => l.shift === 'Night').reduce((s, l) => s + (Number(l.meters) || 0), 0);

                return (
                  <>
                    {/* Live KPI Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                      <div style={{ padding: '0.9rem 1.1rem', borderRadius: 10, background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.2)' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>TOTAL PRINTED METERS</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#38bdf8', marginTop: 2 }}>
                          {repTotalMeters.toLocaleString('en-IN', { minimumFractionDigits: 2 })} mtr
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{repLogs.length} Logged Runs</div>
                      </div>

                      <div style={{ padding: '0.9rem 1.1rem', borderRadius: 10, background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>JOB CARDS PROCESSED</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#a78bfa', marginTop: 2 }}>
                          {repUniqueJobCount} Job Cards
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>Distinct Active Jobs</div>
                      </div>

                      <div style={{ padding: '0.9rem 1.1rem', borderRadius: 10, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>MORNING SHIFT</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#34d399', marginTop: 2 }}>
                          {repMorningMeters.toLocaleString('en-IN', { minimumFractionDigits: 2 })} mtr
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>9:00 AM – 9:00 PM</div>
                      </div>

                      <div style={{ padding: '0.9rem 1.1rem', borderRadius: 10, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>NIGHT SHIFT</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fbbf24', marginTop: 2 }}>
                          {repNightMeters.toLocaleString('en-IN', { minimumFractionDigits: 2 })} mtr
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>9:00 PM – 9:00 AM</div>
                      </div>
                    </div>

                    {/* ── COMPLETE PRINTING DETAILS TABLE ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                          Complete Printing Details ({repLogs.length} Log Entries)
                        </div>
                      </div>

                      <div style={{ overflowX: 'auto', border: '1px solid var(--border-light)', borderRadius: 10 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                          <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-light)' }}>
                              <th style={{ ...thStyle, textAlign: 'left' }}>Date & Shift</th>
                              <th style={{ ...thStyle, textAlign: 'left' }}>Job Card #</th>
                              <th style={{ ...thStyle, textAlign: 'left' }}>Machine & Pass</th>
                              <th style={{ ...thStyle, textAlign: 'right' }}>Meters Printed</th>
                              <th style={{ ...thStyle, textAlign: 'left' }}>Operator</th>
                              <th style={{ ...thStyle, textAlign: 'left' }}>Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {repLogs.length === 0 ? (
                              <tr>
                                <td colSpan="6" style={{ ...tdStyle, textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                                  No printing logs found for selected filters. Try adjusting date range or machine filters.
                                </td>
                              </tr>
                            ) : (
                              repLogs.map(l => {
                                const matched = jobCards.find(c => c._id === l.jobCardId || c.jobNo === l.jobNo);
                                return (
                                  <tr key={l._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                    <td style={tdStyle}>
                                      <div style={{ fontWeight: 700 }}>{formatDateDDMMYYYY(l.date)}</div>
                                      <span style={{ fontSize: '0.68rem', color: l.shift === 'Morning' ? '#38bdf8' : '#a78bfa', fontWeight: 700 }}>
                                        {l.shift || 'General'}
                                      </span>
                                    </td>
                                    <td style={{ ...tdStyle, fontWeight: 800, color: '#38bdf8' }}>
                                      #{l.jobNo}
                                      {matched && (
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                          {matched.party || ''} {matched.designName ? `| ${matched.designName}` : ''}
                                        </div>
                                      )}
                                    </td>
                                    <td style={tdStyle}>
                                      <div style={{ fontWeight: 700 }}>{l.machineName}</div>
                                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{l.pass}</span>
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800, color: '#34d399', fontSize: '0.92rem' }}>
                                      {Number(l.meters).toFixed(2)} mtr
                                    </td>
                                    <td style={tdStyle}>{l.operatorName || '—'}</td>
                                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{l.notes || '—'}</td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                );
              })()}

            </div>

            {/* Modal Footer Actions */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-light)',
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              background: 'rgba(0,0,0,0.2)',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="btn-secondary"
                style={{ padding: '0.55rem 1.1rem', fontSize: '0.82rem' }}
              >
                Close Window
              </button>

              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="btn-secondary"
                  style={{ padding: '0.55rem 1.1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={15} /> Export CSV
                </button>

                <button
                  type="button"
                  disabled={reportLoadingPdf}
                  onClick={async () => {
                    setReportLoadingPdf(true);
                    try {
                      await api.downloadFabricCombinedReportPdf(
                        reportStartDate,
                        reportEndDate,
                        ['machine'],
                        `Digital_Operator_Printing_Report_${reportStartDate}_to_${reportEndDate}.pdf`,
                        {
                          machineName: reportMachine,
                          shift: reportShift,
                          operatorName: reportOperator,
                          pass: reportPass
                        }
                      );
                    } catch (err) {
                      alert(err.message || 'Failed to download PDF report.');
                    } finally {
                      setReportLoadingPdf(false);
                    }
                  }}
                  className="btn-primary"
                  style={{
                    padding: '0.55rem 1.25rem',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)',
                    color: '#ffffff',
                    border: 'none',
                    boxShadow: '0 2px 10px rgba(124, 58, 237, 0.35)',
                    cursor: 'pointer'
                  }}
                >
                  <FileText size={15} /> {reportLoadingPdf ? 'Generating PDF Report...' : 'Download PDF Report'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

const labelStyle = {
  fontSize: '0.68rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  marginBottom: '0.25rem',
  display: 'block'
};

const inputStyle = {
  width: '100%',
  padding: '0.48rem 0.65rem',
  fontSize: '0.82rem',
  background: 'var(--bg-input, #161b26)',
  border: '1px solid var(--border-light, #2d3748)',
  borderRadius: '6px',
  color: 'var(--text-primary, #f7fafc)',
  boxSizing: 'border-box'
};

const thStyle = {
  padding: '0.65rem 0.85rem',
  fontSize: '0.72rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase'
};

const tdStyle = {
  padding: '0.65rem 0.85rem',
  fontSize: '0.8rem',
  color: 'var(--text-primary)'
};
