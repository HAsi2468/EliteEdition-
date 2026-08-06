import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Printer, PlusCircle, Search, RefreshCw, Trash2, Edit2, CheckCircle2,
  AlertCircle, Cpu, Calendar, Clock, User, Layers, ArrowUpRight, Check,
  X, Download, Eye, Layers3, Activity
} from 'lucide-react';
import { triggerPushNotification } from './NotificationToast';

const COMMON_MACHINES = [
  'Machine 1 (Grando)',
  'Machine 2 (Printdot)',
  'Homer 1',
  'Homer 2',
  'Kyocera 1',
  'Kyocera 2',
  'DGI 1',
  'Reggiani',
  'Custom Machine'
];

const PASS_OPTIONS = [
  '1 Pass (Draft)',
  '2 Pass (Standard)',
  '4 Pass (High Quality)',
  '6 Pass (Fine Detail)',
  '8 Pass (Ultra HD)',
  '12 Pass (Maximum)'
];

export default function JobPrintingLog() {
  const currentUser = api.getCurrentUser() || { name: 'Operator' };

  // Main Data States
  const [logs, setLogs] = useState([]);
  const [jobCards, setJobCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Filters State
  const [searchJob, setSearchJob] = useState('');
  const [filterMachine, setFilterMachine] = useState('');
  const [dateStart, setDateStart] = useState(() => new Date().toISOString().split('T')[0]);
  const [dateEnd, setDateEnd] = useState(() => new Date().toISOString().split('T')[0]);

  // Form State
  const [selectedJob, setSelectedJob] = useState(null);
  const [form, setForm] = useState({
    jobNo: '',
    jobCardId: '',
    machineName: 'Machine 1 (Grando)',
    pass: '4 Pass (High Quality)',
    meters: '',
    date: new Date().toISOString().split('T')[0],
    operatorName: currentUser.name || currentUser.username || '',
    shift: 'General',
    notes: ''
  });

  // Selected Job Card History Drawer / Details State
  const [viewingJobHistory, setViewingJobHistory] = useState(null);
  const [jobHistoryData, setJobHistoryData] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Edit Modal State
  const [editingLog, setEditingLog] = useState(null);

  // Load Job Cards for Dropdown Select
  const fetchJobCards = async () => {
    try {
      const res = await api.getJobCards({ limit: 200 });
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
      setError(err.message || 'Failed to load machine print logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobCards();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [searchJob, filterMachine, dateStart, dateEnd]);

  // Handle Job Card Selection in Form
  const handleJobSelect = (jobIdOrNo) => {
    const matched = jobCards.find(c => c._id === jobIdOrNo || c.jobNo === jobIdOrNo);
    if (matched) {
      setSelectedJob(matched);
      setForm(prev => ({
        ...prev,
        jobNo: matched.jobNo,
        jobCardId: matched._id,
        machineName: matched.machineName ? (COMMON_MACHINES.find(m => m.toLowerCase().includes(matched.machineName.toLowerCase())) || matched.machineName) : prev.machineName,
        pass: matched.pass ? (PASS_OPTIONS.find(p => p.toLowerCase().includes(matched.pass.toLowerCase())) || matched.pass) : prev.pass
      }));
    } else {
      setSelectedJob(null);
      setForm(prev => ({ ...prev, jobNo: jobIdOrNo, jobCardId: '' }));
    }
  };

  // Submit Print Entry
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.jobNo) {
      alert('Please select or enter a Job Card Number.');
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
      const res = await api.createJobPrintLog(payload);
      triggerPushNotification('Print Run Logged 🖨️', `Logged ${form.meters} mtr for Job #${form.jobNo} on ${form.machineName}`, 'success');

      // Reset form meters & notes but keep machine & operator for fast continuous entry
      setForm(prev => ({
        ...prev,
        meters: '',
        notes: ''
      }));

      await fetchLogs();
      await fetchJobCards();

      // If viewing history for this card, refresh history
      if (viewingJobHistory && viewingJobHistory.jobNo === form.jobNo) {
        loadJobCardHistory(form.jobNo);
      }
    } catch (err) {
      alert(err.message || 'Failed to submit print entry.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Log Entry
  const handleDeleteLog = async (logId, jobNo) => {
    if (!window.confirm(`Are you sure you want to delete this print log for Job #${jobNo}?`)) return;
    try {
      await api.deleteJobPrintLog(logId);
      triggerPushNotification('Print Log Deleted 🗑️', `Removed entry for Job #${jobNo}`, 'info');
      await fetchLogs();
      await fetchJobCards();
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
      new Date(l.date).toLocaleDateString('en-IN'),
      l.jobNo,
      `"${l.machineName}"`,
      `"${l.pass}"`,
      l.meters,
      `"${l.operatorName}"`,
      l.shift,
      `"${l.notes || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Machine_Printing_Logs_${dateStart}_to_${dateEnd}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compute Dashboard Stats
  const totalMetersLogged = logs.reduce((s, l) => s + (l.meters || 0), 0);
  const activeMachinesCount = new Set(logs.map(l => l.machineName)).size;
  const uniqueJobCardsCount = new Set(logs.map(l => l.jobNo)).size;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '2rem' }}>
      
      {/* ── 1. HEADER & KPI STATS BANNER ── */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#38bdf8,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(56,189,248,0.3)' }}>
            <Printer size={22} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Machine Printing Entry & Logs</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>
              Log multiple machine printing runs per Job Card, track pass counts, and monitor meterage completion.
            </p>
          </div>
        </div>

        <button onClick={handleExportCSV} className="btn-secondary" style={{ padding: '0.55rem 1.1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Download size={15} /> Export CSV Report
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #38bdf8', background: 'rgba(56,189,248,0.03)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>TOTAL METERS LOGGED</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: 2 }}>{totalMetersLogged.toLocaleString('en-IN', { minimumFractionDigits: 2 })} mtr</div>
          <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: 2 }}>{logs.length} Total Print Runs Logged</div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #8b5cf6', background: 'rgba(139,92,246,0.03)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>ACTIVE MACHINES</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: 2 }}>{activeMachinesCount} Machines</div>
          <div style={{ fontSize: '0.72rem', color: '#a78bfa', marginTop: 2 }}>In Active Production Run</div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #10b981', background: 'rgba(16,185,129,0.03)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>JOB CARDS TRACKED</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: 2 }}>{uniqueJobCardsCount} Job Cards</div>
          <div style={{ fontSize: '0.72rem', color: '#34d399', marginTop: 2 }}>With Multi-Run Printing Logs</div>
        </div>
      </div>

      {/* ── 2. NEW PRINT ENTRY FORM & JOB CARD PREVIEW split grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedJob ? 'minmax(0, 1.4fr) minmax(0, 1fr)' : '1fr', gap: '1.25rem' }}>
        
        {/* Entry Form */}
        <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid #38bdf8' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <PlusCircle size={16} /> New Machine Print Entry
            </div>
            {selectedJob && (
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(16,185,129,0.2)' }}>
                Target: {selectedJob.totalMtr || 'N/A'} | Print Status: {selectedJob.printStatus || 'Pending'}
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            
            {/* Row 1: Job Card Select */}
            <div>
              <label style={labelStyle}>SELECT JOB CARD <span style={{ color: '#ef4444' }}>*</span></label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  value={form.jobCardId || form.jobNo}
                  onChange={e => handleJobSelect(e.target.value)}
                  style={{ ...inputStyle, flex: 1, fontWeight: 700 }}
                  required
                >
                  <option value="">-- Choose Job Card --</option>
                  {jobCards.map(c => (
                    <option key={c._id} value={c._id}>
                      #{c.jobNo} — {c.party || 'Client'} | Design: {c.designName || c.designNo || 'Custom'} ({c.totalMtr || '0 mtr'})
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Or enter Job #"
                  value={form.jobNo}
                  onChange={e => handleJobSelect(e.target.value)}
                  style={{ ...inputStyle, width: '130px', fontWeight: 700 }}
                />
              </div>
            </div>

            {/* Row 2: Machine Name & Pass Count */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>PRINTING MACHINE <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  list="machine-list"
                  value={form.machineName}
                  onChange={e => setForm(f => ({ ...f, machineName: e.target.value }))}
                  placeholder="Select or type machine..."
                  style={inputStyle}
                  required
                />
                <datalist id="machine-list">
                  {COMMON_MACHINES.map(m => <option key={m} value={m} />)}
                </datalist>
              </div>

              <div>
                <label style={labelStyle}>PASS COUNT / RESOLUTION</label>
                <input
                  type="text"
                  list="pass-list"
                  value={form.pass}
                  onChange={e => setForm(f => ({ ...f, pass: e.target.value }))}
                  placeholder="Select or type pass..."
                  style={inputStyle}
                />
                <datalist id="pass-list">
                  {PASS_OPTIONS.map(p => <option key={p} value={p} />)}
                </datalist>
              </div>
            </div>

            {/* Row 3: Meters Printed, Date, Shift */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>METERS PRINTED IN THIS RUN (MTR) <span style={{ color: '#ef4444' }}>*</span></label>
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

              <div>
                <label style={labelStyle}>ENTRY DATE</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>SHIFT</label>
                <select value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))} style={inputStyle}>
                  <option value="General">General Shift</option>
                  <option value="Morning">Morning Shift</option>
                  <option value="Evening">Evening Shift</option>
                  <option value="Night">Night Shift</option>
                </select>
              </div>
            </div>

            {/* Row 4: Operator & Notes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
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
                  placeholder="Optional remarks e.g. First 50m done, roll change..."
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Submit Button */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem' }}>
              <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PlusCircle size={16} /> {submitting ? 'Saving Entry...' : 'Submit Print Entry Log'}
              </button>

              {selectedJob && (
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

        {/* Selected Job Card Overview & Live Progress Panel */}
        {selectedJob && (
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', background: 'rgba(56,189,248,0.02)', borderLeft: '4px solid #10b981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#34d399', textTransform: 'uppercase' }}>
                📊 Job Card Progress Overview
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8' }}>#{selectedJob.jobNo}</span>
            </div>

            {/* Field Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.82rem' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Party:</span> <strong style={{ color: 'var(--text-primary)' }}>{selectedJob.party || 'Standard Client'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Fabric:</span> <strong style={{ color: 'var(--text-primary)' }}>{selectedJob.fabric || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Design:</span> <strong style={{ color: 'var(--primary)' }}>{selectedJob.designName || selectedJob.designNo || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Panna:</span> <strong style={{ color: 'var(--text-primary)' }}>{selectedJob.panna || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Target Mtr:</span> <strong style={{ color: '#f59e0b' }}>{selectedJob.totalMtr || '0 mtr'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Logged Print Mtr:</span> <strong style={{ color: '#38bdf8' }}>{selectedJob.printMtr || '0 mtr'}</strong></div>
            </div>

            {/* Quick action button to inspect full history */}
            <button
              onClick={() => loadJobCardHistory(selectedJob.jobNo)}
              className="btn-secondary"
              style={{ marginTop: 'auto', width: '100%', padding: '0.55rem', fontSize: '0.8rem', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Eye size={14} /> Inspect Full Multi-Run Audit History
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
            {COMMON_MACHINES.map(m => <option key={m} value={m}>{m}</option>)}
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
                    <td style={tdStyle}>{new Date(log.date || log.created_date_time).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
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
                    <td style={tdStyle}>{log.shift || 'General'}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{log.notes || '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
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
                    <th style={thStyle}>Operator</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {jobHistoryData.data.map((l, idx) => (
                    <tr key={l._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={tdStyle}>Run #{jobHistoryData.data.length - idx}</td>
                      <td style={tdStyle}>{new Date(l.date).toLocaleDateString('en-IN')}</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{l.machineName}</td>
                      <td style={tdStyle}>{l.pass}</td>
                      <td style={{ ...tdStyle, fontWeight: 800, color: '#34d399' }}>{Number(l.meters).toFixed(2)} mtr</td>
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
