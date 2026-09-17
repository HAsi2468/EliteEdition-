import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../services/api';
import { 
  Printer, 
  Flame, 
  Truck, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  RefreshCw, 
  Download, 
  Layers, 
  ArrowRight,
  TrendingUp,
  ChevronRight,
  Calendar
} from 'lucide-react';
import DateRangePicker, { getDatePresetRange } from './DateRangePicker';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

export default function JobCardStatusDashboard({ onSelectCard, department = 'digital_print' }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Date range & Filter states - Default to 'all' so no pending job cards are hidden by date filters
  const [datePreset, setDatePreset] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');

  const [search, setSearch] = useState('');
  const [activeStageTab, setActiveStageTab] = useState('all_pending'); // 'all_pending' | 'print_pending' | 'fusing_pending' | 'delivery_pending'

  const fetchCards = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError('');
    try {
      const res = await api.getJobCards({
        dateStart,
        dateEnd,
        department,
        limit: 5000,
        sortBy: 'jobNo',
        sortOrder: 'desc'
      });
      if (res && res.data) {
        setCards(res.data);
      }
    } catch (err) {
      console.error('Error loading status dashboard data:', err);
      setError(err.message || 'Failed to fetch status dashboard metrics.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [dateStart, dateEnd, department]);

  useEffect(() => {
    fetchCards(false);
    const interval = setInterval(() => fetchCards(true), 30000);
    const handleRefresh = () => fetchCards(true);
    window.addEventListener('elite-data-refresh', handleRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('elite-data-refresh', handleRefresh);
    };
  }, [fetchCards]);

  // Compute status analytics metrics
  const analytics = useMemo(() => {
    let totalCards = cards.length;
    let totalTargetMtr = 0;
    let totalPrintedMtr = 0;
    let totalFusedMtr = 0;

    let printPendingCount = 0;
    let printDoneCount = 0;
    let printPendingMtrSum = 0;

    let fusingPendingCount = 0;
    let fusingDoneCount = 0;
    let fusingPendingMtrSum = 0;

    let deliveryPendingCount = 0;
    let deliveryDoneCount = 0;

    const printPendingList = [];
    const fusingPendingList = [];
    const deliveryPendingList = [];

    cards.forEach(c => {
      const targetMtr = parseFloat(String(c.totalMtr || c.consumption || '0').replace(/[^\d.]/g, '')) || 0;
      const printedMtr = parseFloat(String(c.printMtr || '0').replace(/[^\d.]/g, '')) || 0;
      const fusedMtr = parseFloat(String(c.fusingMtr || '0').replace(/[^\d.]/g, '')) || 0;

      totalTargetMtr += targetMtr;
      totalPrintedMtr += printedMtr;
      totalFusedMtr += fusedMtr;

      const pStatus = (c.printStatus || '').toLowerCase().includes('done') ? 'Printing Done' : 'Printing Pending';
      const fStatus = (c.fusingStatus || '').toLowerCase().includes('done') ? 'Fusing Done' : 'Fusing Pending';
      const dStatus = (c.deliveryStatus || '').toLowerCase().includes('done') ? 'Delivery Done' : 'Delivery Pending';

      // Printing Stage
      if (pStatus === 'Printing Pending') {
        printPendingCount++;
        const pPendingMtr = Math.max(0, targetMtr - printedMtr);
        printPendingMtrSum += pPendingMtr;
        printPendingList.push({ ...c, pendingMtr: pPendingMtr });
      } else {
        printDoneCount++;
      }

      // Fusing Stage
      if (fStatus === 'Fusing Pending') {
        fusingPendingCount++;
        const fPendingMtr = Math.max(0, printedMtr - fusedMtr);
        fusingPendingMtrSum += fPendingMtr;
        fusingPendingList.push({ ...c, pendingMtr: fPendingMtr });
      } else {
        fusingDoneCount++;
      }

      // Delivery Stage
      if (dStatus === 'Delivery Pending') {
        deliveryPendingCount++;
        deliveryPendingList.push(c);
      } else {
        deliveryDoneCount++;
      }
    });

    const printProgressPct = totalTargetMtr > 0 ? Math.min(100, Math.round((totalPrintedMtr / totalTargetMtr) * 100)) : 0;
    const fusingProgressPct = totalPrintedMtr > 0 ? Math.min(100, Math.round((totalFusedMtr / totalPrintedMtr) * 100)) : 0;
    const deliveryProgressPct = totalCards > 0 ? Math.round((deliveryDoneCount / totalCards) * 100) : 0;

    return {
      totalCards,
      totalTargetMtr,
      totalPrintedMtr,
      totalFusedMtr,
      printPendingCount,
      printDoneCount,
      printPendingMtrSum,
      fusingPendingCount,
      fusingDoneCount,
      fusingPendingMtrSum,
      deliveryPendingCount,
      deliveryDoneCount,
      printProgressPct,
      fusingProgressPct,
      deliveryProgressPct,
      printPendingList,
      fusingPendingList,
      deliveryPendingList
    };
  }, [cards]);

  // Filtered Cards List based on activeStageTab & search query
  const displayedCards = useMemo(() => {
    let list = [];
    if (activeStageTab === 'print_pending') {
      list = analytics.printPendingList;
    } else if (activeStageTab === 'fusing_pending') {
      list = analytics.fusingPendingList;
    } else if (activeStageTab === 'delivery_pending') {
      list = analytics.deliveryPendingList;
    } else {
      // 'all_pending': cards pending in at least one stage
      list = cards.filter(c => 
        !(c.printStatus || '').toLowerCase().includes('done') ||
        !(c.fusingStatus || '').toLowerCase().includes('done') ||
        !(c.deliveryStatus || '').toLowerCase().includes('done')
      );
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(c => 
        (c.jobNo && String(c.jobNo).toLowerCase().includes(q)) ||
        (c.party && String(c.party).toLowerCase().includes(q)) ||
        (c.billNo && String(c.billNo).toLowerCase().includes(q)) ||
        (c.designName && String(c.designName).toLowerCase().includes(q)) ||
        (c.fabric && String(c.fabric).toLowerCase().includes(q))
      );
    }
    return list;
  }, [cards, activeStageTab, search, analytics]);

  // PDF Report Download Generator
  const handleDownloadPdfReport = () => {
    if (!cards || cards.length === 0) {
      alert('No job card records found for generating status report.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to view/print the Pending Status PDF report.');
      return;
    }

    const activeRangeText = dateStart && dateEnd ? `${formatDateDDMMYYYY(dateStart)} to ${formatDateDDMMYYYY(dateEnd)}` : 'All Time';
    const nowStr = `${formatDateDDMMYYYY(new Date())} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>JobCards_Pending_Status_Report_${new Date().toISOString().split('T')[0]}</title>
        <style>
          @page { size: A4 landscape; margin: 8mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #fff; margin: 0; padding: 12px; font-size: 10.5px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #2563eb; padding-bottom: 10px; margin-bottom: 10px; }
          .title { font-size: 17px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; }
          .subtitle { font-size: 10px; color: #64748b; margin-top: 2px; font-weight: 600; }
          .meta { text-align: right; font-size: 9px; color: #475569; line-height: 1.4; }
          
          .kpi-row { display: flex; gap: 8px; margin-bottom: 12px; }
          .kpi-card { flex: 1; padding: 8px 10px; border-radius: 6px; background: #f8fafc; border: 1px solid #cbd5e1; }
          .kpi-label { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; }
          .kpi-val { font-size: 14.5px; font-weight: 900; color: #0f172a; margin-top: 2px; }

          table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 9.5px; }
          th { background: #0f172a; color: #fff; font-size: 8px; text-transform: uppercase; padding: 6px 6px; text-align: left; font-weight: 800; }
          td { padding: 5px 6px; border-bottom: 1px solid #e2e8f0; color: #334155; vertical-align: middle; }
          tr:nth-child(even) td { background: #f8fafc; }
          .bold { font-weight: 800; }
          .text-center { text-align: center; }
          
          .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: 800; text-align: center; }
          .badge-done { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
          .badge-pending { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }

          .footer { margin-top: 15px; border-top: 1px solid #cbd5e1; padding-top: 6px; font-size: 8.5px; color: #94a3b8; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">ELITE DIGITAL PRINTS — PENDING JOBCARD STATUS REPORT</div>
            <div class="subtitle">Real-time Stage Summary for Printing, Fusing, & Delivery Operations</div>
          </div>
          <div class="meta">
            <div><strong>Generated:</strong> ${nowStr}</div>
            <div><strong>Period:</strong> ${activeRangeText}</div>
          </div>
        </div>

        <div class="kpi-row">
          <div class="kpi-card" style="border-left: 4px solid #3b82f6;">
            <div class="kpi-label">Printing Pending</div>
            <div class="kpi-val" style="color: #1d4ed8;">${analytics.printPendingCount} Cards (${analytics.printPendingMtrSum.toFixed(1)} mtr)</div>
          </div>
          <div class="kpi-card" style="border-left: 4px solid #f59e0b;">
            <div class="kpi-label">Fusing Pending</div>
            <div class="kpi-val" style="color: #b45309;">${analytics.fusingPendingCount} Cards (${analytics.fusingPendingMtrSum.toFixed(1)} mtr)</div>
          </div>
          <div class="kpi-card" style="border-left: 4px solid #10b981;">
            <div class="kpi-label">Delivery Pending</div>
            <div class="kpi-val" style="color: #047857;">${analytics.deliveryPendingCount} Cards</div>
          </div>
          <div class="kpi-card" style="border-left: 4px solid #8b5cf6;">
            <div class="kpi-label">Total Active Pipeline Cards</div>
            <div class="kpi-val" style="color: #6d28d9;">${analytics.totalCards} Cards</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 25px; text-align: center;">#</th>
              <th style="width: 75px;">JOB NO</th>
              <th>PARTY / CLIENT NAME</th>
              <th style="width: 70px; text-align: center;">JOB MTR</th>
              <th style="width: 80px; text-align: center;">PRINT STATUS</th>
              <th style="width: 75px; text-align: center;">PRINT MTR</th>
              <th style="width: 80px; text-align: center;">FUSING STATUS</th>
              <th style="width: 75px; text-align: center;">FUSING MTR</th>
              <th style="width: 80px; text-align: center;">DELIVERY STATUS</th>
            </tr>
          </thead>
          <tbody>
            ${displayedCards.map((c, i) => {
              const pDone = (c.printStatus || '').toLowerCase().includes('done');
              const fDone = (c.fusingStatus || '').toLowerCase().includes('done');
              const dDone = (c.deliveryStatus || '').toLowerCase().includes('done');

              const jMtr = c.totalMtr ? `${c.totalMtr} mtr` : (c.consumption ? `${c.consumption} mtr` : '—');

              return `
                <tr>
                  <td class="text-center bold" style="color: #64748b;">${i + 1}</td>
                  <td class="bold" style="color: #1d4ed8;">${c.jobNo || '—'}</td>
                  <td class="bold" style="color: #0f172a;">${c.party || '—'}</td>
                  <td class="text-center bold" style="color: #6d28d9;">${jMtr}</td>
                  <td class="text-center">
                    <span class="badge ${pDone ? 'badge-done' : 'badge-pending'}">${pDone ? 'PD (Done)' : 'PP (Pending)'}</span>
                  </td>
                  <td class="text-center bold" style="color: #0284c7;">${c.printMtr || '—'}</td>
                  <td class="text-center">
                    <span class="badge ${fDone ? 'badge-done' : 'badge-pending'}">${fDone ? 'FD (Done)' : 'FP (Pending)'}</span>
                  </td>
                  <td class="text-center bold" style="color: #059669;">${c.fusingMtr ? `${c.fusingMtr} mtr` : '—'}</td>
                  <td class="text-center">
                    <span class="badge ${dDone ? 'badge-done' : 'badge-pending'}">${dDone ? 'DD (Done)' : 'DP (Pending)'}</span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          <div>Elite Digital Prints — Job Card Current Pending Status Audit</div>
          <div>Total Listed Cards: ${displayedCards.length}</div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 250);
          };
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
      
      {/* ── TOP BANNER ────────────────────────────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', background: '#ffffff', borderRadius: '14px', border: '1px solid #cbd5e1', boxShadow: '0 4px 14px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(59,130,246,0.3)', color: '#ffffff' }}>
              <TrendingUp size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
                  Job Card Status Overview
                </h2>
                <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px' }}>
                  Elite Digital Prints
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0', fontWeight: 600 }}>
                Live Pending Summary across Printing, Fusing &amp; Delivery stages — <strong>{analytics.totalCards}</strong> Total Job Cards
              </p>
            </div>
          </div>

          {/* PDF Export Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              onClick={handleDownloadPdfReport}
              title="Download Pending Status PDF Report"
              style={{ padding: '0.45rem 0.95rem', fontSize: '0.82rem', fontWeight: 800, background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: 'none', borderRadius: '8px', color: '#ffffff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 3px 10px rgba(124,58,237,0.3)' }}
            >
              <Download size={15} />
              <span>Export PDF Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 3 STAGE SUMMARY CARDS (PRINTING, FUSING, DELIVERY) ────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        
        {/* 1. PRINTING STAGE CARD */}
        <div 
          onClick={() => setActiveStageTab('print_pending')}
          style={{
            background: activeStageTab === 'print_pending' ? '#eff6ff' : '#ffffff',
            border: activeStageTab === 'print_pending' ? '2px solid #3b82f6' : '1px solid #cbd5e1',
            borderRadius: '12px',
            padding: '1.1rem 1.25rem',
            cursor: 'pointer',
            boxShadow: '0 3px 12px rgba(0,0,0,0.03)',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: '#1d4ed8', fontSize: '0.92rem' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Printer size={17} />
              </div>
              <span>1. Printing Department</span>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '10px', background: analytics.printPendingCount > 0 ? '#fef3c7' : '#dcfce7', color: analytics.printPendingCount > 0 ? '#b45309' : '#15803d' }}>
              {analytics.printPendingCount > 0 ? `${analytics.printPendingCount} Pending` : 'All Printed'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a' }}>
                {analytics.printPendingCount} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Cards Pending</span>
              </div>
              <div style={{ fontSize: '0.76rem', color: '#0284c7', fontWeight: 700, marginTop: '2px' }}>
                Pending Mtr: <strong>{analytics.printPendingMtrSum.toFixed(1)} mtr</strong>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#15803d' }}>
                {analytics.printDoneCount}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Printing Done</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ marginTop: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
              <span>Printing Completion</span>
              <span>{analytics.printProgressPct}% ({analytics.totalPrintedMtr.toFixed(1)} / {analytics.totalTargetMtr.toFixed(1)} mtr)</span>
            </div>
            <div style={{ height: '6px', width: '100%', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${analytics.printProgressPct}%`, background: 'linear-gradient(90deg, #3b82f6, #0284c7)', borderRadius: '3px', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>

        {/* 2. FUSING STAGE CARD */}
        <div 
          onClick={() => setActiveStageTab('fusing_pending')}
          style={{
            background: activeStageTab === 'fusing_pending' ? '#fffbe6' : '#ffffff',
            border: activeStageTab === 'fusing_pending' ? '2px solid #d97706' : '1px solid #cbd5e1',
            borderRadius: '12px',
            padding: '1.1rem 1.25rem',
            cursor: 'pointer',
            boxShadow: '0 3px 12px rgba(0,0,0,0.03)',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: '#b45309', fontSize: '0.92rem' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Flame size={17} />
              </div>
              <span>2. Fusing Department</span>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '10px', background: analytics.fusingPendingCount > 0 ? '#fef3c7' : '#dcfce7', color: analytics.fusingPendingCount > 0 ? '#b45309' : '#15803d' }}>
              {analytics.fusingPendingCount > 0 ? `${analytics.fusingPendingCount} Pending` : 'All Fused'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a' }}>
                {analytics.fusingPendingCount} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Cards Pending</span>
              </div>
              <div style={{ fontSize: '0.76rem', color: '#d97706', fontWeight: 700, marginTop: '2px' }}>
                Pending Fusing: <strong>{analytics.fusingPendingMtrSum.toFixed(1)} mtr</strong>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#15803d' }}>
                {analytics.fusingDoneCount}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Fusing Done</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ marginTop: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
              <span>Fusing Completion</span>
              <span>{analytics.fusingProgressPct}% ({analytics.totalFusedMtr.toFixed(1)} / {analytics.totalPrintedMtr.toFixed(1)} mtr)</span>
            </div>
            <div style={{ height: '6px', width: '100%', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${analytics.fusingProgressPct}%`, background: 'linear-gradient(90deg, #f59e0b, #d97706)', borderRadius: '3px', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>

        {/* 3. DELIVERY STAGE CARD */}
        <div 
          onClick={() => setActiveStageTab('delivery_pending')}
          style={{
            background: activeStageTab === 'delivery_pending' ? '#f0fdf4' : '#ffffff',
            border: activeStageTab === 'delivery_pending' ? '2px solid #10b981' : '1px solid #cbd5e1',
            borderRadius: '12px',
            padding: '1.1rem 1.25rem',
            cursor: 'pointer',
            boxShadow: '0 3px 12px rgba(0,0,0,0.03)',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: '#047857', fontSize: '0.92rem' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#d1fae5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Truck size={17} />
              </div>
              <span>3. Delivery Dispatch</span>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '10px', background: analytics.deliveryPendingCount > 0 ? '#fef3c7' : '#dcfce7', color: analytics.deliveryPendingCount > 0 ? '#b45309' : '#15803d' }}>
              {analytics.deliveryPendingCount > 0 ? `${analytics.deliveryPendingCount} Pending` : 'All Delivered'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a' }}>
                {analytics.deliveryPendingCount} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Cards Pending</span>
              </div>
              <div style={{ fontSize: '0.76rem', color: '#059669', fontWeight: 700, marginTop: '2px' }}>
                Awaiting Delivery to Client
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#15803d' }}>
                {analytics.deliveryDoneCount}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Delivered Done</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ marginTop: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
              <span>Delivery Dispatch Rate</span>
              <span>{analytics.deliveryProgressPct}% ({analytics.deliveryDoneCount} / {analytics.totalCards} Cards)</span>
            </div>
            <div style={{ height: '6px', width: '100%', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${analytics.deliveryProgressPct}%`, background: 'linear-gradient(90deg, #10b981, #059669)', borderRadius: '3px', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>

      </div>

      {/* ── FILTER TOOLBAR & TAB SWITCHER ────────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Job No, Party, Bill No, Fabric..."
              style={{ paddingLeft: 32, width: '100%', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0.45rem 0.75rem 0.45rem 32px' }}
            />
          </div>

          {/* Date Range Picker */}
          <DateRangePicker
            preset={datePreset}
            onChange={({ preset: p, dateStart: ds, dateEnd: de }) => {
              setDatePreset(p);
              setDateStart(ds);
              setDateEnd(de);
            }}
            customStart={customDateStart}
            customEnd={customDateEnd}
            onCustomChange={(s, e) => {
              setCustomDateStart(s);
              setCustomDateEnd(e);
            }}
          />

          {/* Stage Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginLeft: 'auto' }}>
            {[
              { id: 'all_pending', label: '⚠️ All Pending Cards', count: cards.filter(c => !(c.printStatus||'').includes('Done') || !(c.fusingStatus||'').includes('Done') || !(c.deliveryStatus||'').includes('Done')).length },
              { id: 'print_pending', label: '🖨️ Print Pending (PP)', count: analytics.printPendingCount },
              { id: 'fusing_pending', label: '🔥 Fusing Pending (FP)', count: analytics.fusingPendingCount },
              { id: 'delivery_pending', label: '🚚 Delivery Pending (DP)', count: analytics.deliveryPendingCount }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveStageTab(t.id)}
                style={{
                  padding: '0.45rem 0.8rem',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  borderRadius: '8px',
                  border: activeStageTab === t.id ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                  background: activeStageTab === t.id ? '#eff6ff' : '#ffffff',
                  color: activeStageTab === t.id ? '#1d4ed8' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── PENDING CARDS DETAILED TABLE ──────────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: 0, overflowX: 'auto', background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={28} className="spin-loader" style={{ marginBottom: '0.5rem', color: '#3b82f6' }} />
            <div style={{ fontWeight: 700 }}>Calculating Pending Job Card Analytics...</div>
          </div>
        ) : displayedCards.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <CheckCircle2 size={36} color="#10b981" style={{ marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>All Clear! No Pending Cards in Selected View</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
              Every job card in this stage has been processed completely.
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#ffffff', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.03em' }}>
                <th style={{ padding: '0.65rem 0.85rem' }}>Job Card #</th>
                <th style={{ padding: '0.65rem 0.85rem' }}>Party / Client Name</th>
                <th style={{ padding: '0.65rem 0.85rem' }}>Fabric &amp; Design</th>
                <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Job Target Mtr</th>
                <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Printing (PD / PP)</th>
                <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Pending Print Mtr</th>
                <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Fusing (FD / FP)</th>
                <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Delivery (DD / DP)</th>
                <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {displayedCards.map((c, idx) => {
                const pDone = (c.printStatus || '').toLowerCase().includes('done');
                const fDone = (c.fusingStatus || '').toLowerCase().includes('done');
                const dDone = (c.deliveryStatus || '').toLowerCase().includes('done');

                const jMtr = c.totalMtr ? `${c.totalMtr} mtr` : (c.consumption ? `${c.consumption} mtr` : '—');
                const pMtr = c.printMtr || '0 mtr';
                const fMtr = c.fusingMtr ? `${c.fusingMtr} mtr` : '0 mtr';

                return (
                  <tr key={c._id || idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    
                    {/* Job Card No */}
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 800, color: '#1d4ed8' }}>
                      <span>#{c.jobNo}</span>
                      {c.urgency === 'Urgent' && (
                        <span style={{ fontSize: '0.65rem', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', padding: '1px 5px', borderRadius: '4px', marginLeft: '6px', fontWeight: 800 }}>
                          URGENT
                        </span>
                      )}
                    </td>

                    {/* Party */}
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>
                      {c.party || '—'}
                    </td>

                    {/* Fabric & Design */}
                    <td style={{ padding: '0.65rem 0.85rem', color: '#334155' }}>
                      <div style={{ fontWeight: 700 }}>{c.fabric || '—'}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{c.designName || c.designNo || ''}</div>
                    </td>

                    {/* Target Job Meters */}
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontWeight: 900, color: '#6d28d9' }}>
                      {jMtr}
                    </td>

                    {/* Printing Status Badge & Mtr */}
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, background: pDone ? '#dcfce7' : '#fef3c7', color: pDone ? '#15803d' : '#b45309', border: pDone ? '1px solid #86efac' : '1px solid #fde68a' }}>
                        {pDone ? 'PD (Done)' : 'PP (Pending)'}
                      </span>
                      <div style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 700, marginTop: '2px' }}>
                        Printed: {pMtr}
                      </div>
                    </td>

                    {/* Pending Print Mtr */}
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontWeight: 800 }}>
                      {(() => {
                        const targetM = parseFloat(String(c.totalMtr || c.consumption || '0').replace(/[^\d.]/g, '')) || 0;
                        const printM = parseFloat(String(c.printMtr || '0').replace(/[^\d.]/g, '')) || 0;
                        const pendM = pDone ? 0 : Math.max(0, targetM - printM);

                        return pendM > 0 ? (
                          <span style={{ color: '#b45309', background: '#fef3c7', padding: '3px 8px', borderRadius: '6px', border: '1px solid #fde68a', fontWeight: 900 }}>
                            {pendM.toFixed(1)} mtr
                          </span>
                        ) : (
                          <span style={{ color: '#15803d', fontWeight: 700 }}>0 mtr</span>
                        );
                      })()}
                    </td>

                    {/* Fusing Status Badge & Mtr */}
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, background: fDone ? '#dcfce7' : '#fef3c7', color: fDone ? '#15803d' : '#b45309', border: fDone ? '1px solid #86efac' : '1px solid #fde68a' }}>
                        {fDone ? 'FD (Done)' : 'FP (Pending)'}
                      </span>
                      <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700, marginTop: '2px' }}>
                        Fused: {fMtr}
                      </div>
                    </td>

                    {/* Delivery Status Badge */}
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, background: dDone ? '#dcfce7' : '#fef3c7', color: dDone ? '#15803d' : '#b45309', border: dDone ? '1px solid #86efac' : '1px solid #fde68a' }}>
                        {dDone ? 'DD (Done)' : 'DP (Pending)'}
                      </span>
                      {c.deliveryDate && (
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                          {formatDateDDMMYYYY(c.deliveryDate)}
                        </div>
                      )}
                    </td>

                    {/* Action button */}
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                      <button
                        onClick={() => onSelectCard && onSelectCard(c)}
                        title="View / Edit Job Card Details"
                        style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 800, borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer' }}
                      >
                        Details
                      </button>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
