import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import {
  Layers, Zap, CheckCircle2, X, Save, Trash2, ShieldCheck, RefreshCw, Search
} from 'lucide-react';
import { triggerEliteAlert, triggerEliteConfirm } from './EliteModalDialog';
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
  // Shared Data State
  const [whiteFabricLogs, setWhiteFabricLogs] = useState([]);
  const [inwardLots, setInwardLots] = useState([]);
  const [selectedInwardBadge, setSelectedInwardBadge] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // User details
  const [accountFullName] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user_info') || '{}');
      return u.name || u.username || 'QA Inspector';
    } catch (e) {
      return 'QA Inspector';
    }
  });

  // White Fabric Checking Form State
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
      if (!e || !e.detail || e.detail === 'qa' || e.detail === 'fabric') {
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
      // 1. Fetch Inward Fabric Transactions for Auto-fill in White Fabric QA
      try {
        const inwRes = await api.getFabricTransactions({ type: 'INWARD', limit: 300 });
        const list = inwRes?.data?.transactions || inwRes?.transactions || inwRes?.data || inwRes || [];
        if (Array.isArray(list)) {
          setInwardLots(list);
        }
      } catch (e) {
        console.warn('Failed to load inward transactions:', e);
      }

      // 2. Fetch White Fabric Inspection records from MongoDB / API
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

  // Filtered White Fabric Logs
  const filteredLogs = useMemo(() => {
    return whiteFabricLogs.filter(l => {
      if (statusFilter !== 'All' && l.status !== statusFilter) return false;
      if (historySearch) {
        const s = historySearch.toLowerCase();
        const vName = (l.vendorName || '').toLowerCase();
        const cNo = (l.challanNo || '').toLowerCase();
        const fQual = (l.fabricQuality || '').toLowerCase();
        const lNo = (l.lotNo || '').toLowerCase();
        if (!vName.includes(s) && !cNo.includes(s) && !fQual.includes(s) && !lNo.includes(s)) {
          return false;
        }
      }
      return true;
    });
  }, [whiteFabricLogs, statusFilter, historySearch]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* ── Top Header Banner ── */}
      <div className="glass-panel" style={{
        padding: '1.25rem 1.5rem',
        borderRadius: '16px',
        background: '#ffffff',
        border: '1px solid #e0e7ff',
        boxShadow: '0 10px 30px -10px rgba(79, 70, 229, 0.12)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)'
            }}>
              <ShieldCheck size={24} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1e1b4b', margin: 0, letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                QA DEPARTMENT <span style={{ fontSize: '0.72rem', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>Elite Digital Prints</span>
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0 0', fontWeight: 500 }}>
                White Fabric Inward Inspection, Defect Audit &amp; Quality Verification
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              type="button"
              onClick={fetchData}
              title="Refresh Inward & QA Data"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#334155',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} className={loading ? 'spin-loader' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '0.75rem 1rem', borderRadius: '8px', color: '#991b1b', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* ── WHITE FABRIC INWARD CHECKING & DEFECT LOG ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* White Fabric Inspection Form Card */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              White Fabric Inspection History ({filteredLogs.length})
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '200px' }}>
                <Search size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="text"
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  placeholder="Search Vendor, Lot, Fabric..."
                  style={{ width: '100%', padding: '0.4rem 0.6rem 0.4rem 28px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                />
              </div>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}
              >
                <option value="All">All Status</option>
                <option value="Passed">Passed</option>
                <option value="Conditionally Accepted">Conditionally Accepted</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          {filteredLogs.length === 0 ? (
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
                  {filteredLogs.map((l, idx) => (
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
    </div>
  );
}
