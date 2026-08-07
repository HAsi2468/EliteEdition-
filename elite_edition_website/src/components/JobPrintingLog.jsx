import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Printer, PlusCircle, Search, RefreshCw, Trash2, Edit2, Edit, CheckCircle2,
  AlertCircle, Cpu, Calendar, Clock, User, Layers, ArrowUpRight, Check,
  X, Download, Eye, Layers3, Activity, Tag, Sparkles, FileText
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
    pass: '1 PASS',
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

  // Dedicated Raw Material Usage Form Modal State
  const [showRawMaterialModal, setShowRawMaterialModal] = useState(false);
  const [rawMaterialSubmitting, setRawMaterialSubmitting] = useState(false);

  const [rawDate, setRawDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [rawShift, setRawShift] = useState(() => getAutoShift());
  const [rawStartTime, setRawStartTime] = useState('');
  const [rawStopTime, setRawStopTime] = useState('');
  const [rawOperator, setRawOperator] = useState(() => accountFullName || '');
  const [rawNotes, setRawNotes] = useState('');

  // Section 1: INK CONSUMPTION (LITERS)
  // Grando Machine Ink (C, M, Y, K in Liters)
  const [grandoInkC, setGrandoInkC] = useState('');
  const [grandoInkM, setGrandoInkM] = useState('');
  const [grandoInkY, setGrandoInkY] = useState('');
  const [grandoInkK, setGrandoInkK] = useState('');

  // Printdot Machine Ink (C, M, Y, K in Liters)
  const [printdotInkC, setPrintdotInkC] = useState('');
  const [printdotInkM, setPrintdotInkM] = useState('');
  const [printdotInkY, setPrintdotInkY] = useState('');
  const [printdotInkK, setPrintdotInkK] = useState('');

  // Section 2: PAPER CONSUMPTION (PANNA WISE ROLL CONSUMPTION)
  const [pannaOptionsList, setPannaOptionsList] = useState([]);
  const [paperTypesList, setPaperTypesList] = useState(['Sublimation Paper', 'Butter Paper', 'Tissue Paper']);
  const [paperEntries, setPaperEntries] = useState([
    { id: 1, paperType: 'Sublimation Paper', paperPanna: '44" Panna', paperCustomPanna: '', paperRollsQty: '' }
  ]);

  // Raw Material Summary State for Displaying on Screen & Reports
  const [rawMaterialSummary, setRawMaterialSummary] = useState({
    grandoInk: { C: 0, M: 0, Y: 0, K: 0 },
    printdotInk: { C: 0, M: 0, Y: 0, K: 0 },
    paperPanna: {}
  });

  const fetchRawMaterialSummary = async () => {
    try {
      const res = await api.getRawMaterialTransactions();
      if (res && res.data && Array.isArray(res.data)) {
        const outwardLogs = res.data.filter(t => t.type === 'OUTWARD');
        
        const filtered = outwardLogs.filter(t => {
          if (!t.date) return true;
          const dStr = new Date(t.date).toISOString().split('T')[0];
          if (dateStart && dStr < dateStart) return false;
          if (dateEnd && dStr > dateEnd) return false;
          return true;
        });

        const grando = { C: 0, M: 0, Y: 0, K: 0 };
        const printdot = { C: 0, M: 0, Y: 0, K: 0 };
        const pannaMap = {};
        const paperList = [];

        filtered.forEach(t => {
          const mName = (t.materialName || '').toLowerCase();
          const q = Number(t.qty) || 0;

          if (mName.includes('grando')) {
            if (mName.includes('cyan') || t.color === 'Cyan') grando.C += q;
            else if (mName.includes('magenta') || t.color === 'Magenta') grando.M += q;
            else if (mName.includes('yellow') || t.color === 'Yellow') grando.Y += q;
            else if (mName.includes('black') || t.color === 'Black') grando.K += q;
          } else if (mName.includes('printdot')) {
            if (mName.includes('cyan') || t.color === 'Cyan') printdot.C += q;
            else if (mName.includes('magenta') || t.color === 'Magenta') printdot.M += q;
            else if (mName.includes('yellow') || t.color === 'Yellow') printdot.Y += q;
            else if (mName.includes('black') || t.color === 'Black') printdot.K += q;
          } else if (mName.includes('paper') || t.panna) {
            const pKey = t.panna ? (t.panna.toLowerCase().includes('panna') || t.panna.includes('"') ? t.panna : `${t.panna} Panna`) : 'Paper Roll';
            pannaMap[pKey] = (pannaMap[pKey] || 0) + q;
            paperList.push({
              id: paperList.length + 1,
              paperType: t.materialName || 'Sublimation Paper',
              paperPanna: t.panna ? (t.panna.toLowerCase().includes('panna') || t.panna.includes('"') ? t.panna : `${t.panna} Panna`) : '44" Panna',
              paperCustomPanna: '',
              paperRollsQty: q ? q.toString() : ''
            });
          }
        });

        setRawMaterialSummary({
          grandoInk: grando,
          printdotInk: printdot,
          paperPanna: pannaMap
        });

        // Sync input state for editable summary table when Date Filter changes
        setGrandoInkC(grando.C > 0 ? grando.C.toString() : '');
        setGrandoInkM(grando.M > 0 ? grando.M.toString() : '');
        setGrandoInkY(grando.Y > 0 ? grando.Y.toString() : '');
        setGrandoInkK(grando.K > 0 ? grando.K.toString() : '');

        setPrintdotInkC(printdot.C > 0 ? printdot.C.toString() : '');
        setPrintdotInkM(printdot.M > 0 ? printdot.M.toString() : '');
        setPrintdotInkY(printdot.Y > 0 ? printdot.Y.toString() : '');
        setPrintdotInkK(printdot.K > 0 ? printdot.K.toString() : '');

        if (paperList.length > 0) {
          while (paperList.length < 2) {
            paperList.push({
              id: paperList.length + 1,
              paperType: 'Sublimation Paper',
              paperPanna: '44" Panna',
              paperCustomPanna: '',
              paperRollsQty: ''
            });
          }
          setPaperEntries(paperList);
        } else {
          setPaperEntries([
            { id: 1, paperType: 'Sublimation Paper', paperPanna: '44" Panna', paperCustomPanna: '', paperRollsQty: '' },
            { id: 2, paperType: 'Sublimation Paper', paperPanna: '58" Panna', paperCustomPanna: '', paperRollsQty: '' }
          ]);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch raw material summary:', err);
    }
  };

  // Save Raw Material Outward Usage
  const handleSaveRawMaterialUsage = async (e) => {
    if (e) e.preventDefault();
    setRawMaterialSubmitting(true);
    try {
      const payload = [];
      const timeInfo = (rawStartTime || rawStopTime) ? ` | Time: ${rawStartTime || '—'} to ${rawStopTime || '—'}` : '';

      // 1. Grando Ink entries (C, M, Y, K in Liters)
      if (grandoInkC && Number(grandoInkC) > 0) {
        payload.push({
          materialName: 'Grando Ink - Cyan (C)',
          color: 'Cyan',
          qty: Number(grandoInkC),
          unit: 'Liters',
          canSize: 1,
          date: rawDate,
          notes: `[Machine: Grando | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim()
        });
      }
      if (grandoInkM && Number(grandoInkM) > 0) {
        payload.push({
          materialName: 'Grando Ink - Magenta (M)',
          color: 'Magenta',
          qty: Number(grandoInkM),
          unit: 'Liters',
          canSize: 1,
          date: rawDate,
          notes: `[Machine: Grando | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim()
        });
      }
      if (grandoInkY && Number(grandoInkY) > 0) {
        payload.push({
          materialName: 'Grando Ink - Yellow (Y)',
          color: 'Yellow',
          qty: Number(grandoInkY),
          unit: 'Liters',
          canSize: 1,
          date: rawDate,
          notes: `[Machine: Grando | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim()
        });
      }
      if (grandoInkK && Number(grandoInkK) > 0) {
        payload.push({
          materialName: 'Grando Ink - Black (K)',
          color: 'Black',
          qty: Number(grandoInkK),
          unit: 'Liters',
          canSize: 1,
          date: rawDate,
          notes: `[Machine: Grando | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim()
        });
      }

      // 2. Printdot Ink entries (C, M, Y, K in Liters)
      if (printdotInkC && Number(printdotInkC) > 0) {
        payload.push({
          materialName: 'Printdot Ink - Cyan (C)',
          color: 'Cyan',
          qty: Number(printdotInkC),
          unit: 'Liters',
          canSize: 1,
          date: rawDate,
          notes: `[Machine: Printdot | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim()
        });
      }
      if (printdotInkM && Number(printdotInkM) > 0) {
        payload.push({
          materialName: 'Printdot Ink - Magenta (M)',
          color: 'Magenta',
          qty: Number(printdotInkM),
          unit: 'Liters',
          canSize: 1,
          date: rawDate,
          notes: `[Machine: Printdot | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim()
        });
      }
      if (printdotInkY && Number(printdotInkY) > 0) {
        payload.push({
          materialName: 'Printdot Ink - Yellow (Y)',
          color: 'Yellow',
          qty: Number(printdotInkY),
          unit: 'Liters',
          canSize: 1,
          date: rawDate,
          notes: `[Machine: Printdot | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim()
        });
      }
      if (printdotInkK && Number(printdotInkK) > 0) {
        payload.push({
          materialName: 'Printdot Ink - Black (K)',
          color: 'Black',
          qty: Number(printdotInkK),
          unit: 'Liters',
          canSize: 1,
          date: rawDate,
          notes: `[Machine: Printdot | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim()
        });
      }

      // 3. Dynamic Paper Consumption Entries
      paperEntries.forEach(entry => {
        if (entry.paperRollsQty && Number(entry.paperRollsQty) > 0) {
          const selPanna = entry.paperPanna === 'Custom' ? (entry.paperCustomPanna || '44" Panna') : entry.paperPanna;
          payload.push({
            materialName: entry.paperType || 'Sublimation Paper',
            panna: selPanna,
            qty: Number(entry.paperRollsQty),
            unit: 'Rolls',
            date: rawDate,
            notes: `[Panna: ${selPanna} | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim()
          });
        }
      });

      if (payload.length === 0) {
        alert('Please enter at least one Ink quantity (in Liters) or Paper Roll quantity.');
        return;
      }

      await api.createRawMaterialOutward(payload);
      triggerPushNotification('📦 Raw Material Logged', `Recorded ${payload.length} material consumption entries successfully!`, 'success');

      // Clear fields
      setGrandoInkC(''); setGrandoInkM(''); setGrandoInkY(''); setGrandoInkK('');
      setPrintdotInkC(''); setPrintdotInkM(''); setPrintdotInkY(''); setPrintdotInkK('');
      setRawStartTime(''); setRawStopTime(''); setRawNotes('');
      setPaperEntries([
        { id: 1, paperType: paperTypesList[0] || 'Sublimation Paper', paperPanna: pannaOptionsList[0] || '44" Panna', paperCustomPanna: '', paperRollsQty: '' }
      ]);
      setShowRawMaterialModal(false);
    } catch (err) {
      alert(err.message || 'Failed to save raw material usage.');
    } finally {
      setRawMaterialSubmitting(false);
    }
  };

  // ⚡ INSTANT OPERATOR REPORT PRINT / PDF GENERATOR (0.02s SPEED)
  const handlePrintOperatorReport = (repLogs) => {
    if (!repLogs || repLogs.length === 0) {
      alert('No printing log entries found for the selected filter criteria.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to view/print report.');
      return;
    }

    const totalMtr = repLogs.reduce((s, l) => s + (Number(l.meters) || 0), 0);
    const uniqueJobs = new Set(repLogs.map(l => l.jobNo)).size;
    const morningMtr = repLogs.filter(l => l.shift === 'Morning').reduce((s, l) => s + (Number(l.meters) || 0), 0);
    const nightMtr = repLogs.filter(l => l.shift === 'Night').reduce((s, l) => s + (Number(l.meters) || 0), 0);

    const machinePassSummary = {};
    repLogs.forEach(l => {
      const mName = l.machineName || 'Machine';
      const pName = l.pass || '1 PASS';
      const key = `${mName.toUpperCase()} __ ${pName.toUpperCase()}`;
      if (!machinePassSummary[key]) {
        machinePassSummary[key] = { machine: mName, pass: pName, mtr: 0, count: 0, jobs: new Set() };
      }
      machinePassSummary[key].mtr += Number(l.meters) || 0;
      machinePassSummary[key].count += 1;
      if (l.jobNo) machinePassSummary[key].jobs.add(l.jobNo);
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Digital_Operator_Printing_Report_${reportStartDate}_to_${reportEndDate}</title>
        <style>
          @page { size: A4 portrait; margin: 8mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #fff; margin: 0; padding: 12px; font-size: 11px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #4f46e5; padding-bottom: 10px; margin-bottom: 10px; }
          .title { font-size: 16.5px; font-weight: 900; color: #312e81; text-transform: uppercase; letter-spacing: 0.5px; }
          .subtitle { font-size: 10px; color: #64748b; margin-top: 2px; font-weight: 600; }
          .meta { text-align: right; font-size: 9px; color: #475569; line-height: 1.4; }
          .time-strip { display: flex; gap: 12px; justify-content: space-between; align-items: center; background: #f8fafc; border: 1.5px solid #e2e8f0; padding: 7px 12px; border-radius: 6px; margin-bottom: 10px; font-size: 9.5px; }
          .time-item span { color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 8.5px; }
          .badge-start { background: #e0e7ff; color: #3730a3; padding: 2px 7px; border-radius: 4px; font-weight: 800; }
          .badge-stop { background: #fee2e2; color: #991b1b; padding: 2px 7px; border-radius: 4px; font-weight: 800; }
          .kpi-row { display: flex; gap: 8px; margin-bottom: 10px; }
          .kpi-card { flex: 1; padding: 7px 10px; border-radius: 6px; background: #f8fafc; border: 1px solid #e2e8f0; }
          .kpi-label { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; }
          .kpi-val { font-size: 14.5px; font-weight: 900; color: #0f172a; margin-top: 2px; }
          .section-title { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #1e1b4b; background: #eeef2a; background: linear-gradient(90deg, #e0e7ff, #f1f5f9); padding: 5px 8px; border-left: 4px solid #4338ca; margin: 10px 0 5px 0; border-radius: 2px; }
          table { width: 100%; border-collapse: collapse; margin-top: 4px; }
          th { background: #0f172a; color: #fff; font-size: 8.5px; text-transform: uppercase; padding: 6px 7px; text-align: left; font-weight: 700; }
          td { padding: 5px 7px; border-bottom: 1px solid #e2e8f0; font-size: 9.5px; color: #334155; }
          tr:nth-child(even) td { background: #f8fafc; }
          .bold { font-weight: 800; color: #0f172a; }
          .text-right { text-align: right; }
          .shift-badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 8.5px; font-weight: 800; }
          .morning { background: #e0f2fe; color: #0369a1; }
          .night { background: #fef3c7; color: #b45309; }
          .total-row { background: #cbd5e1 !important; font-weight: 900 !important; color: #0f172a !important; }
          .footer { margin-top: 15px; border-top: 1px solid #cbd5e1; padding-top: 6px; font-size: 8.5px; color: #94a3b8; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">ELITE DIGITAL PRINTS — PRINTING PRODUCTION REPORT</div>
            <div class="subtitle">Complete Printing Log & Raw Material Usage Summary</div>
          </div>
          <div class="meta">
            <div><strong>Generated:</strong> ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
            <div><strong>Filters:</strong> ${reportMachine || 'All Machines'} | ${reportShift || 'All Shifts'} | ${reportPass || 'All Passes'}</div>
          </div>
        </div>

        {/* TIME & OPERATOR METADATA STRIP */}
        <div class="time-strip">
          <div class="time-item"><span>OPERATOR:</span> <strong>${rawOperator || 'All Operators'}</strong></div>
          <div class="time-item"><span>SHIFT:</span> <strong>${reportShift || rawShift || 'All Shifts'}</strong></div>
          <div class="time-item"><span>START TIME:</span> <strong class="badge-start">${rawStartTime || '—'}</strong></div>
          <div class="time-item"><span>STOP TIME:</span> <strong class="badge-stop">${rawStopTime || '—'}</strong></div>
          <div class="time-item"><span>DATE PERIOD:</span> <strong>${formatDateDDMMYYYY(reportStartDate)} to ${formatDateDDMMYYYY(reportEndDate)}</strong></div>
        </div>

        <div class="kpi-row">
          <div class="kpi-card" style="border-left: 4px solid #0284c7;">
            <div class="kpi-label">Total Printed Meters</div>
            <div class="kpi-val">${totalMtr.toFixed(2)} mtr</div>
          </div>
          <div class="kpi-card" style="border-left: 4px solid #7c3aed;">
            <div class="kpi-label">Job Cards Processed</div>
            <div class="kpi-val">${uniqueJobs} Cards</div>
          </div>
          <div class="kpi-card" style="border-left: 4px solid #059669;">
            <div class="kpi-label">Morning Shift Meters</div>
            <div class="kpi-val">${morningMtr.toFixed(2)} mtr</div>
          </div>
          <div class="kpi-card" style="border-left: 4px solid #d97706;">
            <div class="kpi-label">Night Shift Meters</div>
            <div class="kpi-val">${nightMtr.toFixed(2)} mtr</div>
          </div>
        </div>

        <div class="section-title">1. Machine & Pass Wise Summary</div>
        <table>
          <thead>
            <tr>
              <th>Machine Name</th>
              <th>Pass</th>
              <th class="text-right">Job Cards Count</th>
              <th class="text-right">Run Entries</th>
              <th class="text-right">Total Printed Meters</th>
            </tr>
          </thead>
          <tbody>
            ${Object.values(machinePassSummary).map(m => `
              <tr>
                <td class="bold">${m.machine}</td>
                <td>${m.pass}</td>
                <td class="text-right">${m.jobs.size}</td>
                <td class="text-right">${m.count}</td>
                <td class="text-right bold" style="color:#047857;">${m.mtr.toFixed(2)} mtr</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="4" class="bold" style="font-size:10px;">TOTAL MACHINE PRODUCTION SUMMARY</td>
              <td class="text-right bold" style="font-size:10.5px; color:#047857;">${totalMtr.toFixed(2)} mtr</td>
            </tr>
          </tbody>
        </table>

        <div class="section-title" style="margin-top:10px;">2. Raw Material Consumption Summary</div>
        <table>
          <thead>
            <tr>
              <th style="font-weight: 800;">MACHIN NAME</th>
              <th class="text-right" style="font-weight: 800; width: 55px;">C</th>
              <th class="text-right" style="font-weight: 800; width: 55px;">M</th>
              <th class="text-right" style="font-weight: 800; width: 55px;">Y</th>
              <th class="text-right" style="font-weight: 800; width: 55px;">K</th>
              <th style="font-weight: 800;">PAPER TYPE</th>
              <th style="font-weight: 800;">PANNO</th>
              <th class="text-right" style="font-weight: 800; width: 65px;">QTY</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              const grandoC = grandoInkC ? Number(grandoInkC).toFixed(2) : (rawMaterialSummary.grandoInk.C ? rawMaterialSummary.grandoInk.C.toFixed(2) : '');
              const grandoM = grandoInkM ? Number(grandoInkM).toFixed(2) : (rawMaterialSummary.grandoInk.M ? rawMaterialSummary.grandoInk.M.toFixed(2) : '');
              const grandoY = grandoInkY ? Number(grandoInkY).toFixed(2) : (rawMaterialSummary.grandoInk.Y ? rawMaterialSummary.grandoInk.Y.toFixed(2) : '');
              const grandoK = grandoInkK ? Number(grandoInkK).toFixed(2) : (rawMaterialSummary.grandoInk.K ? rawMaterialSummary.grandoInk.K.toFixed(2) : '');

              const printdotC = printdotInkC ? Number(printdotInkC).toFixed(2) : (rawMaterialSummary.printdotInk.C ? rawMaterialSummary.printdotInk.C.toFixed(2) : '');
              const printdotM = printdotInkM ? Number(printdotInkM).toFixed(2) : (rawMaterialSummary.printdotInk.M ? rawMaterialSummary.printdotInk.M.toFixed(2) : '');
              const printdotY = printdotInkY ? Number(printdotInkY).toFixed(2) : (rawMaterialSummary.printdotInk.Y ? rawMaterialSummary.printdotInk.Y.toFixed(2) : '');
              const printdotK = printdotInkK ? Number(printdotInkK).toFixed(2) : (rawMaterialSummary.printdotInk.K ? rawMaterialSummary.printdotInk.K.toFixed(2) : '');

              const row1Paper = paperEntries[0] || {};
              const row2Paper = paperEntries[1] || {};
              const extraPapers = paperEntries.slice(2);

              const row1Panno = row1Paper.paperPanna === 'Custom' ? (row1Paper.paperCustomPanna || '') : (row1Paper.paperPanna || '');
              const row2Panno = row2Paper.paperPanna === 'Custom' ? (row2Paper.paperCustomPanna || '') : (row2Paper.paperPanna || '');

              return `
                <tr>
                  <td class="bold">GRANDO</td>
                  <td class="text-right bold" style="color:#0284c7;">${grandoC}</td>
                  <td class="text-right bold" style="color:#ec4899;">${grandoM}</td>
                  <td class="text-right bold" style="color:#ca8a04;">${grandoY}</td>
                  <td class="text-right bold" style="color:#334155;">${grandoK}</td>
                  <td>${row1Paper.paperType || ''}</td>
                  <td>${row1Panno}</td>
                  <td class="text-right bold">${row1Paper.paperRollsQty ? `${row1Paper.paperRollsQty} Rolls` : ''}</td>
                </tr>
                <tr>
                  <td class="bold">PRINTDOT</td>
                  <td class="text-right bold" style="color:#0284c7;">${printdotC}</td>
                  <td class="text-right bold" style="color:#ec4899;">${printdotM}</td>
                  <td class="text-right bold" style="color:#ca8a04;">${printdotY}</td>
                  <td class="text-right bold" style="color:#334155;">${printdotK}</td>
                  <td>${row2Paper.paperType || ''}</td>
                  <td>${row2Panno}</td>
                  <td class="text-right bold">${row2Paper.paperRollsQty ? `${row2Paper.paperRollsQty} Rolls` : ''}</td>
                </tr>
                ${extraPapers.map(p => `
                  <tr>
                    <td class="bold"></td>
                    <td></td><td></td><td></td><td></td>
                    <td>${p.paperType || ''}</td>
                    <td>${p.paperPanna === 'Custom' ? p.paperCustomPanna : (p.paperPanna || '')}</td>
                    <td class="text-right bold">${p.paperRollsQty ? `${p.paperRollsQty} Rolls` : ''}</td>
                  </tr>
                `).join('')}
              `;
            })()}
          </tbody>
        </table>

        <div class="section-title" style="margin-top:10px;">3. Complete Printing Entry & Run Logs</div>
        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">SHIFT</th>
              <th style="width: 70px;">JOB CARD #</th>
              <th style="width: 140px;">PARTY / CLIENT NAME</th>
              <th style="width: 80px;">DESIGN NAME</th>
              <th style="width: 50px; text-align: center;">MACHINE</th>
              <th style="width: 40px; text-align: center;">PASS</th>
              <th class="text-right" style="width: 90px;">METERS PRINTED</th>
              <th style="width: 85px;">OPERATOR</th>
            </tr>
          </thead>
          <tbody>
            ${repLogs.map(l => {
              const matched = jobCards.find(c => c._id === l.jobCardId || c.jobNo === l.jobNo);
              const cleanJobNo = String(l.jobNo || '').replace(/[^\d]/g, '') || l.jobNo || '—';
              const shiftShort = String(l.shift || '').toLowerCase().includes('morn') ? 'M' :
                                String(l.shift || '').toLowerCase().includes('night') ? 'N' :
                                (l.shift ? l.shift.charAt(0).toUpperCase() : '—');
              const machineShort = String(l.machineName || '').toUpperCase().includes('GRANDO') ? 'G' :
                                   String(l.machineName || '').toUpperCase().includes('PRINTDOT') ? 'P' :
                                   (l.machineName ? l.machineName.charAt(0).toUpperCase() : '—');
              const passNum = (String(l.pass || '').match(/\d+/) || [l.pass || '1'])[0];

              return `
                <tr>
                  <td style="text-align: center;" class="bold">
                    <span class="shift-badge ${l.shift === 'Morning' ? 'morning' : 'night'}">${shiftShort}</span>
                  </td>
                  <td class="bold" style="color:#0284c7;">${cleanJobNo}</td>
                  <td>${matched ? (matched.party || '—') : '—'}</td>
                  <td>${matched ? (matched.designName || matched.designNo || '—') : '—'}</td>
                  <td style="text-align: center;" class="bold">${machineShort}</td>
                  <td style="text-align: center;" class="bold">${passNum}</td>
                  <td class="text-right bold" style="color:#059669; font-size:10px;">${Number(l.meters).toFixed(2)} mtr</td>
                  <td>${l.operatorName || '—'}</td>
                </tr>
              `;
            }).join('')}
            <tr class="total-row">
              <td colSpan="6" class="bold" style="font-size:10.5px;">GRAND TOTAL PRINTED METERS (${repLogs.length} LOG ENTRIES)</td>
              <td class="text-right bold" style="font-size:11px; color:#047857;">${totalMtr.toFixed(2)} mtr</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <div>Elite Edition ERP — Digital Printing Operator Production Report</div>
          <div>Printed On: ${new Date().toLocaleDateString('en-IN')}</div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 200);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Paper Entry Handlers for Multiple Paper Rows
  const handleAddPaperEntry = () => {
    setPaperEntries(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        paperType: paperTypesList[0] || 'Sublimation Paper',
        paperPanna: pannaOptionsList[0] || '44" Panna',
        paperCustomPanna: '',
        paperRollsQty: ''
      }
    ]);
  };

  const handleRemovePaperEntry = (id) => {
    if (paperEntries.length === 1) return;
    setPaperEntries(prev => prev.filter(p => p.id !== id));
  };

  const handlePaperEntryChange = (id, field, value) => {
    setPaperEntries(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  // Load Machines, Widths (Panna) & Paper Types from Print Settings Config
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
      if (res && res.widths && Array.isArray(res.widths) && res.widths.length > 0) {
        setPannaOptionsList(res.widths);
      }
      if (res && res.paperTypes && Array.isArray(res.paperTypes) && res.paperTypes.length > 0) {
        setPaperTypesList(res.paperTypes);
      }
    } catch (err) {
      console.warn('Failed to load print config options from Print Settings:', err);
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
      await fetchRawMaterialSummary();
    } catch (err) {
      setError(err.message || 'Failed to load printing logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrintConfig();
    fetchJobCards();
    fetchRawMaterialSummary();

    const handleDataRefresh = () => {
      fetchJobCards();
      fetchLogs();
      fetchRawMaterialSummary();
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

              {/* Button 2: GENERATE REPORT */}
              <button
                type="button"
                onClick={() => setShowRawMaterialModal(true)}
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
                <Sparkles size={14} /> GENERATE REPORT
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            
            {/* ── LINE 1: DATE, SHIFT, JOB TYPE ── */}
            <div className="responsive-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2.2fr', gap: '0.75rem' }}>
              
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

              {/* Shift */}
              <div>
                <label style={labelStyle}>SHIFT <span style={{ color: '#ef4444' }}>*</span></label>
                <select value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))} style={inputStyle}>
                  <option value="Morning">Morning</option>
                  <option value="Night">Night</option>
                </select>
              </div>

              {/* Jobcard Type / Selection (Direct Input) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <label style={labelStyle}>JOB TYPE / JOBCARD NO. <span style={{ color: '#ef4444' }}>*</span></label>
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

      {/* ── 3B. RAW MATERIAL CONSUMPTION SUMMARY CARD (READ-ONLY DISPLAY TABLE ON SCREEN) ── */}
      <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#34d399', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={16} /> Raw Material Consumption Summary
          </div>
          <button
            type="button"
            onClick={() => setShowRawMaterialModal(true)}
            className="btn-primary"
            style={{
              padding: '0.4rem 0.9rem',
              fontSize: '0.78rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              boxShadow: '0 3px 10px rgba(16, 185, 129, 0.3)',
              cursor: 'pointer'
            }}
          >
            <Edit size={14} /> Edit Data
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1.5px solid var(--border-light)' }}>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 800, width: 120 }}>MACHIN NAME</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#0284c7', width: 85 }}>C</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#ec4899', width: 85 }}>M</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#eab308', width: 85 }}>Y</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#94a3b8', width: 85 }}>K</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 800 }}>PAPER TYPE</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 800 }}>PANNO</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 800, width: 110 }}>QTY</th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1: GRANDO */}
              <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '0.65rem 0.75rem', fontWeight: 800, color: '#38bdf8' }}>GRANDO</td>
                <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#38bdf8' }}>
                  {rawMaterialSummary.grandoInk.C > 0 ? `${rawMaterialSummary.grandoInk.C.toFixed(2)} L` : '—'}
                </td>
                <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#f472b6' }}>
                  {rawMaterialSummary.grandoInk.M > 0 ? `${rawMaterialSummary.grandoInk.M.toFixed(2)} L` : '—'}
                </td>
                <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#facc15' }}>
                  {rawMaterialSummary.grandoInk.Y > 0 ? `${rawMaterialSummary.grandoInk.Y.toFixed(2)} L` : '—'}
                </td>
                <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#94a3b8' }}>
                  {rawMaterialSummary.grandoInk.K > 0 ? `${rawMaterialSummary.grandoInk.K.toFixed(2)} L` : '—'}
                </td>
                <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>
                  {paperEntries[0]?.paperType || '—'}
                </td>
                <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>
                  {paperEntries[0]?.paperPanna === 'Custom' ? (paperEntries[0]?.paperCustomPanna || '—') : (paperEntries[0]?.paperPanna || '—')}
                </td>
                <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#34d399' }}>
                  {paperEntries[0]?.paperRollsQty ? `${paperEntries[0].paperRollsQty} Rolls` : '—'}
                </td>
              </tr>

              {/* Row 2: PRINTDOT */}
              <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '0.65rem 0.75rem', fontWeight: 800, color: '#f87171' }}>PRINTDOT</td>
                <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#38bdf8' }}>
                  {rawMaterialSummary.printdotInk.C > 0 ? `${rawMaterialSummary.printdotInk.C.toFixed(2)} L` : '—'}
                </td>
                <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#f472b6' }}>
                  {rawMaterialSummary.printdotInk.M > 0 ? `${rawMaterialSummary.printdotInk.M.toFixed(2)} L` : '—'}
                </td>
                <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#facc15' }}>
                  {rawMaterialSummary.printdotInk.Y > 0 ? `${rawMaterialSummary.printdotInk.Y.toFixed(2)} L` : '—'}
                </td>
                <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#94a3b8' }}>
                  {rawMaterialSummary.printdotInk.K > 0 ? `${rawMaterialSummary.printdotInk.K.toFixed(2)} L` : '—'}
                </td>
                <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>
                  {paperEntries[1]?.paperType || '—'}
                </td>
                <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>
                  {paperEntries[1]?.paperPanna === 'Custom' ? (paperEntries[1]?.paperCustomPanna || '—') : (paperEntries[1]?.paperPanna || '—')}
                </td>
                <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#34d399' }}>
                  {paperEntries[1]?.paperRollsQty ? `${paperEntries[1].paperRollsQty} Rolls` : '—'}
                </td>
              </tr>

              {/* Extra Paper Rows if any */}
              {paperEntries.slice(2).map((entry, idx) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>—</td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                  <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>
                    {entry.paperType || '—'}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>
                    {entry.paperPanna === 'Custom' ? (entry.paperCustomPanna || '—') : (entry.paperPanna || '—')}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#34d399' }}>
                    {entry.paperRollsQty ? `${entry.paperRollsQty} Rolls` : '—'}
                  </td>
                </tr>
              ))}
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
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal-content" style={{
            maxWidth: '480px',
            width: '90%',
            background: 'var(--bg-card, #131722)',
            borderRadius: '16px',
            border: '1px solid var(--border-light, #2a324b)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }} onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #7c3aed, #4c1d95)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FileText size={20} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Download Printing Production Report
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2, margin: 0 }}>
                    Select date range to download complete production report PDF.
                  </p>
                </div>
              </div>
              <button onClick={() => setShowReportModal(false)} className="btn-icon"><X size={18} /></button>
            </div>

            {/* Modal Body: ONLY 2 DATES (NO PREVIEW TABLE OR OTHER DISPLAY) */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-light)',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div>
                <label style={{ ...labelStyle, fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8' }}>FROM DATE</label>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={e => setReportStartDate(e.target.value)}
                  style={{ ...inputStyle, fontSize: '0.9rem', padding: '0.6rem 0.75rem', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ ...labelStyle, fontSize: '0.75rem', fontWeight: 800, color: '#a78bfa' }}>TO DATE</label>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={e => setReportEndDate(e.target.value)}
                  style={{ ...inputStyle, fontSize: '0.9rem', padding: '0.6rem 0.75rem', fontWeight: 700 }}
                />
              </div>
            </div>

            {/* Modal Footer: EXACTLY 2 BUTTONS (DOWNLOAD REPORT & CLOSE WINDOW) */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="btn-secondary"
                style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 700 }}
              >
                Close Window
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
                      `Printing_Production_Report_${reportStartDate}_to_${reportEndDate}.pdf`
                    );
                    setShowReportModal(false);
                  } catch (err) {
                    alert(err.message || 'Failed to download PDF report.');
                  } finally {
                    setReportLoadingPdf(false);
                  }
                }}
                className="btn-primary"
                style={{
                  padding: '0.6rem 1.4rem',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  boxShadow: '0 4px 14px rgba(124, 58, 237, 0.4)',
                  cursor: 'pointer'
                }}
              >
                <Download size={16} /> {reportLoadingPdf ? 'Generating PDF...' : 'Download Report'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── 6. GENERATE REPORT / RAW MATERIAL USAGE FORM MODAL ── */}
      {showRawMaterialModal && (
        <div className="modal-overlay" onClick={() => setShowRawMaterialModal(false)}>
          <div className="modal-content" style={{
            maxWidth: '820px',
            width: '95%',
            maxHeight: '92vh',
            background: 'var(--bg-card, #131722)',
            borderRadius: '16px',
            border: '1px solid var(--border-light, #2a324b)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.2rem',
            overflowY: 'auto'
          }} onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #059669, #047857)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Sparkles size={20} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    GENERATE REPORT / RAW MATERIAL USAGE
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2, margin: 0 }}>
                    Log Ink Consumption (Liters) & Sublimation/Butter Paper Roll Consumption (Panna Wise)
                  </p>
                </div>
              </div>
              <button onClick={() => setShowRawMaterialModal(false)} className="btn-icon"><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveRawMaterialUsage} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              
              {/* Header Info: Date, Shift, Start Time, Stop Time, Operator */}
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-light)',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '0.75rem'
              }}>
                <div>
                  <label style={labelStyle}>ENTRY DATE <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="date"
                    value={rawDate}
                    onChange={e => setRawDate(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle}>SHIFT <span style={{ color: '#ef4444' }}>*</span></label>
                  <select
                    value={rawShift}
                    onChange={e => setRawShift(e.target.value)}
                    style={inputStyle}
                    required
                  >
                    <option value="Morning">Morning Shift (9 AM - 9 PM)</option>
                    <option value="Night">Night Shift (9 PM - 9 AM)</option>
                  </select>
                </div>

                <div>
                  <label style={{ ...labelStyle, color: '#38bdf8' }}>START TIME</label>
                  <input
                    type="time"
                    value={rawStartTime}
                    onChange={e => setRawStartTime(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={{ ...labelStyle, color: '#a78bfa' }}>STOP TIME</label>
                  <input
                    type="time"
                    value={rawStopTime}
                    onChange={e => setRawStopTime(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>OPERATOR NAME</label>
                  <input
                    type="text"
                    placeholder="Operator Name"
                    value={rawOperator}
                    onChange={e => setRawOperator(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* ── DIV 1: INK CONSUMPTION (BACKGROUND COLOUR: WHITE) ── */}
              <div style={{
                background: '#ffffff',
                color: '#0f172a',
                border: '1.5px solid #cbd5e1',
                borderRadius: '12px',
                padding: '1.1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#0284c7', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.4rem' }}>
                  💧 INK CONSUMPTION
                </div>

                {/* Sub-Section 1: GRANDO MACHINE INK */}
                <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginBottom: '0.6rem', textTransform: 'uppercase' }}>
                    🖨️ GRANDO C, M, Y, K INK (IN LITERS)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0284c7', display: 'block', marginBottom: '0.2rem' }}>CYAN (C) - LITERS</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00 L"
                        value={grandoInkC}
                        onChange={e => setGrandoInkC(e.target.value)}
                        style={{ width: '100%', padding: '0.45rem', fontSize: '0.82rem', background: '#ffffff', border: '1.5px solid #0284c7', borderRadius: '6px', color: '#0f172a', fontWeight: 700 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.68rem', fontWeight: 800, color: '#db2777', display: 'block', marginBottom: '0.2rem' }}>MAGENTA (M) - LITERS</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00 L"
                        value={grandoInkM}
                        onChange={e => setGrandoInkM(e.target.value)}
                        style={{ width: '100%', padding: '0.45rem', fontSize: '0.82rem', background: '#ffffff', border: '1.5px solid #db2777', borderRadius: '6px', color: '#0f172a', fontWeight: 700 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.68rem', fontWeight: 800, color: '#ca8a04', display: 'block', marginBottom: '0.2rem' }}>YELLOW (Y) - LITERS</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00 L"
                        value={grandoInkY}
                        onChange={e => setGrandoInkY(e.target.value)}
                        style={{ width: '100%', padding: '0.45rem', fontSize: '0.82rem', background: '#ffffff', border: '1.5px solid #ca8a04', borderRadius: '6px', color: '#0f172a', fontWeight: 700 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.68rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>BLACK (K) - LITERS</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00 L"
                        value={grandoInkK}
                        onChange={e => setGrandoInkK(e.target.value)}
                        style={{ width: '100%', padding: '0.45rem', fontSize: '0.82rem', background: '#ffffff', border: '1.5px solid #334155', borderRadius: '6px', color: '#0f172a', fontWeight: 700 }}
                      />
                    </div>
                  </div>
                </div>

                {/* Sub-Section 2: PRINTDOT MACHINE INK */}
                <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginBottom: '0.6rem', textTransform: 'uppercase' }}>
                    🖨️ PRINTDOT C, M, Y, K INK (IN LITERS)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0284c7', display: 'block', marginBottom: '0.2rem' }}>CYAN (C) - LITERS</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00 L"
                        value={printdotInkC}
                        onChange={e => setPrintdotInkC(e.target.value)}
                        style={{ width: '100%', padding: '0.45rem', fontSize: '0.82rem', background: '#ffffff', border: '1.5px solid #0284c7', borderRadius: '6px', color: '#0f172a', fontWeight: 700 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.68rem', fontWeight: 800, color: '#db2777', display: 'block', marginBottom: '0.2rem' }}>MAGENTA (M) - LITERS</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00 L"
                        value={printdotInkM}
                        onChange={e => setPrintdotInkM(e.target.value)}
                        style={{ width: '100%', padding: '0.45rem', fontSize: '0.82rem', background: '#ffffff', border: '1.5px solid #db2777', borderRadius: '6px', color: '#0f172a', fontWeight: 700 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.68rem', fontWeight: 800, color: '#ca8a04', display: 'block', marginBottom: '0.2rem' }}>YELLOW (Y) - LITERS</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00 L"
                        value={printdotInkY}
                        onChange={e => setPrintdotInkY(e.target.value)}
                        style={{ width: '100%', padding: '0.45rem', fontSize: '0.82rem', background: '#ffffff', border: '1.5px solid #ca8a04', borderRadius: '6px', color: '#0f172a', fontWeight: 700 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.68rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>BLACK (K) - LITERS</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00 L"
                        value={printdotInkK}
                        onChange={e => setPrintdotInkK(e.target.value)}
                        style={{ width: '100%', padding: '0.45rem', fontSize: '0.82rem', background: '#ffffff', border: '1.5px solid #334155', borderRadius: '6px', color: '#0f172a', fontWeight: 700 }}
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* ── DIV 2: PAPER CONSUMPTION (MULTIPLE ENTRIES SUPPORTED) ── */}
              <div style={{
                background: 'rgba(16, 185, 129, 0.03)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '12px',
                padding: '1.1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#34d399', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    📜 PAPER CONSUMPTION
                  </div>
                  <button
                    type="button"
                    onClick={handleAddPaperEntry}
                    style={{
                      padding: '0.35rem 0.85rem',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#34d399',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <PlusCircle size={14} /> + Add More Paper Entry
                  </button>
                </div>

                {/* Render Dynamic Paper Entries */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {paperEntries.map((entry, index) => (
                    <div
                      key={entry.id}
                      style={{
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '8px',
                        padding: '0.85rem',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#34d399' }}>
                          Paper Entry #{index + 1}
                        </span>
                        {paperEntries.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePaperEntry(entry.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#f87171',
                              cursor: 'pointer',
                              padding: '0.2rem',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            title="Remove Paper Entry"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                        <div>
                          <label style={labelStyle}>PAPER TYPE</label>
                          <select
                            value={entry.paperType}
                            onChange={e => handlePaperEntryChange(entry.id, 'paperType', e.target.value)}
                            style={inputStyle}
                          >
                            {(paperTypesList.length > 0 ? paperTypesList : ['Sublimation Paper', 'Butter Paper', 'Tissue Paper']).map((p, pIdx) => (
                              <option key={pIdx} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={labelStyle}>PAPER PANNA (WIDTH)</label>
                          <select
                            value={(() => {
                              if (!entry.paperPanna) return (pannaOptionsList[0] || '44" Panna');
                              if (entry.paperPanna === 'Custom') return 'Custom';
                              const match = pannaOptionsList.find(w => {
                                const normOpt = String(w).toLowerCase().replace(/panna/g, '').replace(/[^0-9a-z]/g, '');
                                const normEntry = String(entry.paperPanna).toLowerCase().replace(/panna/g, '').replace(/[^0-9a-z]/g, '');
                                return normOpt === normEntry;
                              });
                              return match || entry.paperPanna;
                            })()}
                            onChange={e => handlePaperEntryChange(entry.id, 'paperPanna', e.target.value)}
                            style={inputStyle}
                          >
                            {(pannaOptionsList.length > 0 ? pannaOptionsList : ['44" Panna', '54" Panna', '60" Panna', '64" Panna', '72" Panna']).map((w, wIdx) => (
                              <option key={wIdx} value={w}>{w.toLowerCase().includes('panna') || w.includes('"') ? w : `${w} Panna`}</option>
                            ))}
                            <option value="Custom">Custom Panna Width</option>
                          </select>
                        </div>

                        {entry.paperPanna === 'Custom' && (
                          <div>
                            <label style={labelStyle}>CUSTOM PANNA WIDTH</label>
                            <input
                              type="text"
                              placeholder="e.g. 50 inch"
                              value={entry.paperCustomPanna}
                              onChange={e => handlePaperEntryChange(entry.id, 'paperCustomPanna', e.target.value)}
                              style={inputStyle}
                            />
                          </div>
                        )}

                        <div>
                          <label style={labelStyle}>ROLLS USED (QTY)</label>
                          <input
                            type="number"
                            step="1"
                            placeholder="Number of Rolls"
                            value={entry.paperRollsQty}
                            onChange={e => handlePaperEntryChange(entry.id, 'paperRollsQty', e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Remarks / Notes */}
              <div>
                <label style={labelStyle}>REMARKS / NOTES</label>
                <input
                  type="text"
                  placeholder="Additional notes, batch info or job card reference..."
                  value={rawNotes}
                  onChange={e => setRawNotes(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Modal Footer Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowRawMaterialModal(false)}
                  className="btn-secondary"
                  style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  Close Window
                </button>

                <button
                  type="submit"
                  disabled={rawMaterialSubmitting}
                  className="btn-primary"
                  style={{
                    padding: '0.6rem 1.4rem',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    boxShadow: '0 4px 14px rgba(5, 150, 105, 0.4)',
                    cursor: 'pointer'
                  }}
                >
                  <Sparkles size={16} /> {rawMaterialSubmitting ? 'Saving Usage...' : 'Save Raw Material Usage'}
                </button>
              </div>

            </form>

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
