import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import {
  Printer, PlusCircle, Search, RefreshCw, Trash2, Edit2, Edit, CheckCircle2,
  AlertCircle, Cpu, Calendar, Clock, User, Layers, ArrowUpRight, Check,
  X, Download, Eye, Layers3, Activity, Tag, Sparkles, FileText, ArrowUpFromLine, ArrowDownToLine
} from 'lucide-react';
import { triggerPushNotification, triggerGlobalDataRefresh } from './NotificationToast';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../utils/dateUtils';
import { matchSearchQuery } from '../utils/searchUtils';
import { triggerEliteAlert, triggerEliteConfirm } from './EliteModalDialog';
import JobCardTooltip from './JobCardTooltip';

// Automatic Shift Calculator:
// Morning Shift: 9:00 AM (09:00) to 8:59 PM (20:59)
// Night Shift:   9:00 PM (21:00) to 8:59 AM (08:59)
function getAutoShift() {
  const hours = new Date().getHours();
  return (hours >= 9 && hours < 21) ? 'Morning' : 'Night';
}

function isOlderThan36Hours(dateVal) {
  return false; // 36-hour editing restriction stopped / disabled
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
  const [operatorsList, setOperatorsList] = useState([]);
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
  const [showJobSuggestions, setShowJobSuggestions] = useState(false);
  const [viewingJobHistory, setViewingJobHistory] = useState(null);
  const [jobHistoryData, setJobHistoryData] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Dedicated Digital Operator Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportStartDate, setReportStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportStartTime, setReportStartTime] = useState('');
  const [reportEndTime, setReportEndTime] = useState('');
  const [reportMachine, setReportMachine] = useState('');
  const [reportShift, setReportShift] = useState('');
  const [isNightReport, setIsNightReport] = useState(false);
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
  // ── INWARD STATE (Stock Received) ──
  const [grandoInC, setGrandoInC] = useState('');
  const [grandoInM, setGrandoInM] = useState('');
  const [grandoInY, setGrandoInY] = useState('');
  const [grandoInK, setGrandoInK] = useState('');

  const [printdotInC, setPrintdotInC] = useState('');
  const [printdotInM, setPrintdotInM] = useState('');
  const [printdotInY, setPrintdotInY] = useState('');
  const [printdotInK, setPrintdotInK] = useState('');

  const [inwardPaperEntries, setInwardPaperEntries] = useState([
    { id: 1, paperType: 'A++', paperPanna: '44" Panna', paperCustomPanna: '', paperRollsQty: '' }
  ]);

  // ── OUTWARD STATE (Usage / Consumption) ──
  const [grandoOutC, setGrandoOutC] = useState('');
  const [grandoOutM, setGrandoOutM] = useState('');
  const [grandoOutY, setGrandoOutY] = useState('');
  const [grandoOutK, setGrandoOutK] = useState('');

  const [printdotOutC, setPrintdotOutC] = useState('');
  const [printdotOutM, setPrintdotOutM] = useState('');
  const [printdotOutY, setPrintdotOutY] = useState('');
  const [printdotOutK, setPrintdotOutK] = useState('');

  const [outwardPaperEntries, setOutwardPaperEntries] = useState([
    { id: 1, paperType: 'A++', paperPanna: '44" Panna', paperCustomPanna: '', paperRollsQty: '' }
  ]);

  const [pannaOptionsList, setPannaOptionsList] = useState([]);
  const [paperTypesList, setPaperTypesList] = useState(['A++', 'A+', 'A']);

  // Paper Entry Helper Handlers for INWARD
  const handleAddInwardPaperEntry = () => {
    setInwardPaperEntries(prev => [
      ...prev,
      { id: prev.length + 1, paperType: paperTypesList[0] || 'A++', paperPanna: pannaOptionsList[0] || '44" Panna', paperCustomPanna: '', paperRollsQty: '' }
    ]);
  };
  const handleRemoveInwardPaperEntry = (id) => {
    setInwardPaperEntries(prev => prev.filter(e => e.id !== id));
  };
  const handleInwardPaperEntryChange = (id, field, val) => {
    setInwardPaperEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: val } : e));
  };

  // Paper Entry Helper Handlers for OUTWARD
  const handleAddOutwardPaperEntry = () => {
    setOutwardPaperEntries(prev => [
      ...prev,
      { id: prev.length + 1, paperType: paperTypesList[0] || 'A++', paperPanna: pannaOptionsList[0] || '44" Panna', paperCustomPanna: '', paperRollsQty: '' }
    ]);
  };
  const handleRemoveOutwardPaperEntry = (id) => {
    setOutwardPaperEntries(prev => prev.filter(e => e.id !== id));
  };
  const handleOutwardPaperEntryChange = (id, field, val) => {
    setOutwardPaperEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: val } : e));
  };

  // Raw Material Summary State for Displaying on Screen
  const [rawMaterialSummary, setRawMaterialSummary] = useState({
    inward: { grando: { C: 0, M: 0, Y: 0, K: 0 }, printdot: { C: 0, M: 0, Y: 0, K: 0 }, paper: [] },
    outward: { grando: { C: 0, M: 0, Y: 0, K: 0 }, printdot: { C: 0, M: 0, Y: 0, K: 0 }, paper: [] }
  });

  const fetchRawMaterialSummary = async () => {
    try {
      const res = await api.getRawMaterialTransactions();
      if (res && res.data && Array.isArray(res.data)) {
        const inGrando = { C: 0, M: 0, Y: 0, K: 0 };
        const inPrintdot = { C: 0, M: 0, Y: 0, K: 0 };
        const inPaperList = [];

        const outGrando = { C: 0, M: 0, Y: 0, K: 0 };
        const outPrintdot = { C: 0, M: 0, Y: 0, K: 0 };
        const outPaperList = [];

        let foundStart = '';
        let foundStop = '';
        let foundShift = '';
        let foundOperator = '';

        res.data.forEach(t => {
          if (!t.date) return;
          const dStr = new Date(t.date).toISOString().split('T')[0];
          if (rawDate && dStr !== rawDate) return;

          if (t.notes) {
            const tm = t.notes.match(/Time:\s*([^\s|]+(?:\s*[AP]M)?)\s*(?:to|-)\s*([^\s|]+(?:\s*[AP]M)?)/i) ||
                       t.notes.match(/(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*(?:to|-)\s*(\d{1,2}:\d{2}(?:\s*[AP]M)?)/i);
            if (tm) {
              if (!foundStart) foundStart = tm[1];
              if (!foundStop) foundStop = tm[2];
            }
            const sh = t.notes.match(/Shift:\s*([^|\]]+)/i);
            if (sh && !foundShift) foundShift = sh[1].trim();

            const op = t.notes.match(/Operator:\s*([^|\]]+)/i);
            if (op && !foundOperator && op[1].trim() !== '—') foundOperator = op[1].trim();
          }

          const mName = (t.materialName || '').toLowerCase();
          const q = Number(t.qty) || 0;
          const isIn = t.type === 'INWARD';
          const targetG = isIn ? inGrando : outGrando;
          const targetP = isIn ? inPrintdot : outPrintdot;
          const targetPaperList = isIn ? inPaperList : outPaperList;

          if (mName.includes('grando')) {
            if (mName.includes('cyan') || t.color === 'Cyan') targetG.C += q;
            else if (mName.includes('magenta') || t.color === 'Magenta') targetG.M += q;
            else if (mName.includes('yellow') || t.color === 'Yellow') targetG.Y += q;
            else if (mName.includes('black') || t.color === 'Black') targetG.K += q;
          } else if (mName.includes('printdot')) {
            if (mName.includes('cyan') || t.color === 'Cyan') targetP.C += q;
            else if (mName.includes('magenta') || t.color === 'Magenta') targetP.M += q;
            else if (mName.includes('yellow') || t.color === 'Yellow') targetP.Y += q;
            else if (mName.includes('black') || t.color === 'Black') targetP.K += q;
          } else if (mName.includes('paper') || t.panna) {
            targetPaperList.push({
              id: targetPaperList.length + 1,
              paperType: t.materialName || 'A++',
              paperPanna: t.panna ? (t.panna.toLowerCase().includes('panna') || t.panna.includes('"') ? t.panna : `${t.panna} Panna`) : '44" Panna',
              paperCustomPanna: '',
              paperRollsQty: q ? q.toString() : ''
            });
          }
        });

        if (foundStart) setRawStartTime(foundStart);
        if (foundStop) setRawStopTime(foundStop);
        if (foundShift) setRawShift(foundShift);
        if (foundOperator) setRawOperator(foundOperator);

        // Populate Inward Inputs
        setGrandoInC(inGrando.C > 0 ? inGrando.C.toString() : '');
        setGrandoInM(inGrando.M > 0 ? inGrando.M.toString() : '');
        setGrandoInY(inGrando.Y > 0 ? inGrando.Y.toString() : '');
        setGrandoInK(inGrando.K > 0 ? inGrando.K.toString() : '');

        setPrintdotInC(inPrintdot.C > 0 ? inPrintdot.C.toString() : '');
        setPrintdotInM(inPrintdot.M > 0 ? inPrintdot.M.toString() : '');
        setPrintdotInY(inPrintdot.Y > 0 ? inPrintdot.Y.toString() : '');
        setPrintdotInK(inPrintdot.K > 0 ? inPrintdot.K.toString() : '');

        setInwardPaperEntries(inPaperList.length > 0 ? inPaperList : [
          { id: 1, paperType: 'A++', paperPanna: '44" Panna', paperCustomPanna: '', paperRollsQty: '' }
        ]);

        // Populate Outward Inputs
        setGrandoOutC(outGrando.C > 0 ? outGrando.C.toString() : '');
        setGrandoOutM(outGrando.M > 0 ? outGrando.M.toString() : '');
        setGrandoOutY(outGrando.Y > 0 ? outGrando.Y.toString() : '');
        setGrandoOutK(outGrando.K > 0 ? outGrando.K.toString() : '');

        setPrintdotOutC(outPrintdot.C > 0 ? outPrintdot.C.toString() : '');
        setPrintdotOutM(outPrintdot.M > 0 ? outPrintdot.M.toString() : '');
        setPrintdotOutY(outPrintdot.Y > 0 ? outPrintdot.Y.toString() : '');
        setPrintdotOutK(outPrintdot.K > 0 ? outPrintdot.K.toString() : '');

        setOutwardPaperEntries(outPaperList.length > 0 ? outPaperList : [
          { id: 1, paperType: 'A++', paperPanna: '44" Panna', paperCustomPanna: '', paperRollsQty: '' }
        ]);

        setRawMaterialSummary({
          inward: { grando: inGrando, printdot: inPrintdot, paper: inPaperList },
          outward: { grando: outGrando, printdot: outPrintdot, paper: outPaperList }
        });
      }
    } catch (err) {
      console.warn('Failed to fetch raw material summary:', err);
    }
  };

  // Save Raw Material Inward & Outward Entries simultaneously
  const handleSaveRawMaterialUsage = async (e) => {
    if (e) e.preventDefault();
    setRawMaterialSubmitting(true);
    try {
      const timeInfo = (rawStartTime || rawStopTime) ? ` | Time: ${rawStartTime || '—'} to ${rawStopTime || '—'}` : '';

      const inwardPayload = [];
      const outwardPayload = [];

      // ── INWARD INKS ──
      if (grandoInC && Number(grandoInC) > 0) inwardPayload.push({ materialName: 'Grando Ink - Cyan (C)', color: 'Cyan', qty: Number(grandoInC), unit: 'Liters', canSize: 1, date: rawDate, notes: `[Machine: Grando | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim() });
      if (grandoInM && Number(grandoInM) > 0) inwardPayload.push({ materialName: 'Grando Ink - Magenta (M)', color: 'Magenta', qty: Number(grandoInM), unit: 'Liters', canSize: 1, date: rawDate, notes: `[Machine: Grando | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim() });
      if (grandoInY && Number(grandoInY) > 0) inwardPayload.push({ materialName: 'Grando Ink - Yellow (Y)', color: 'Yellow', qty: Number(grandoInY), unit: 'Liters', canSize: 1, date: rawDate, notes: `[Machine: Grando | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim() });
      if (grandoInK && Number(grandoInK) > 0) inwardPayload.push({ materialName: 'Grando Ink - Black (K)', color: 'Black', qty: Number(grandoInK), unit: 'Liters', canSize: 1, date: rawDate, notes: `[Machine: Grando | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim() });

      if (printdotInC && Number(printdotInC) > 0) inwardPayload.push({ materialName: 'Printdot Ink - Cyan (C)', color: 'Cyan', qty: Number(printdotInC), unit: 'Liters', canSize: 1, date: rawDate, notes: `[Machine: Printdot | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim() });
      if (printdotInM && Number(printdotInM) > 0) inwardPayload.push({ materialName: 'Printdot Ink - Magenta (M)', color: 'Magenta', qty: Number(printdotInM), unit: 'Liters', canSize: 1, date: rawDate, notes: `[Machine: Printdot | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim() });
      if (printdotInY && Number(printdotInY) > 0) inwardPayload.push({ materialName: 'Printdot Ink - Yellow (Y)', color: 'Yellow', qty: Number(printdotInY), unit: 'Liters', canSize: 1, date: rawDate, notes: `[Machine: Printdot | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim() });
      if (printdotInK && Number(printdotInK) > 0) inwardPayload.push({ materialName: 'Printdot Ink - Black (K)', color: 'Black', qty: Number(printdotInK), unit: 'Liters', canSize: 1, date: rawDate, notes: `[Machine: Printdot | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim() });

      inwardPaperEntries.forEach(entry => {
        if (entry.paperRollsQty && Number(entry.paperRollsQty) > 0) {
          const selPanna = entry.paperPanna === 'Custom' ? (entry.paperCustomPanna || '44" Panna') : entry.paperPanna;
          inwardPayload.push({
            materialName: entry.paperType || 'A++', panna: selPanna, qty: Number(entry.paperRollsQty), unit: 'Rolls', date: rawDate,
            notes: `[Panna: ${selPanna} | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim()
          });
        }
      });

      // ── OUTWARD INKS ──
      if (grandoOutC && Number(grandoOutC) > 0) outwardPayload.push({ materialName: 'Grando Ink - Cyan (C)', color: 'Cyan', qty: Number(grandoOutC), unit: 'Liters', canSize: 1, date: rawDate, notes: `[Machine: Grando | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim() });
      if (grandoOutM && Number(grandoOutM) > 0) outwardPayload.push({ materialName: 'Grando Ink - Magenta (M)', color: 'Magenta', qty: Number(grandoOutM), unit: 'Liters', canSize: 1, date: rawDate, notes: `[Machine: Grando | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim() });
      if (grandoOutY && Number(grandoOutY) > 0) outwardPayload.push({ materialName: 'Grando Ink - Yellow (Y)', color: 'Yellow', qty: Number(grandoOutY), unit: 'Liters', canSize: 1, date: rawDate, notes: `[Machine: Grando | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim() });
      if (grandoOutK && Number(grandoOutK) > 0) outwardPayload.push({ materialName: 'Grando Ink - Black (K)', color: 'Black', qty: Number(grandoOutK), unit: 'Liters', canSize: 1, date: rawDate, notes: `[Machine: Grando | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim() });

      if (printdotOutC && Number(printdotOutC) > 0) outwardPayload.push({ materialName: 'Printdot Ink - Cyan (C)', color: 'Cyan', qty: Number(printdotOutC), unit: 'Liters', canSize: 1, date: rawDate, notes: `[Machine: Printdot | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim() });
      if (printdotOutM && Number(printdotOutM) > 0) outwardPayload.push({ materialName: 'Printdot Ink - Magenta (M)', color: 'Magenta', qty: Number(printdotOutM), unit: 'Liters', canSize: 1, date: rawDate, notes: `[Machine: Printdot | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim() });
      if (printdotOutY && Number(printdotOutY) > 0) outwardPayload.push({ materialName: 'Printdot Ink - Yellow (Y)', color: 'Yellow', qty: Number(printdotOutY), unit: 'Liters', canSize: 1, date: rawDate, notes: `[Machine: Printdot | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim() });
      if (printdotOutK && Number(printdotOutK) > 0) outwardPayload.push({ materialName: 'Printdot Ink - Black (K)', color: 'Black', qty: Number(printdotOutK), unit: 'Liters', canSize: 1, date: rawDate, notes: `[Machine: Printdot | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim() });

      outwardPaperEntries.forEach(entry => {
        if (entry.paperRollsQty && Number(entry.paperRollsQty) > 0) {
          const selPanna = entry.paperPanna === 'Custom' ? (entry.paperCustomPanna || '44" Panna') : entry.paperPanna;
          outwardPayload.push({
            materialName: entry.paperType || 'A++', panna: selPanna, qty: Number(entry.paperRollsQty), unit: 'Rolls', date: rawDate,
            notes: `[Panna: ${selPanna} | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim()
          });
        }
      });

      if (inwardPayload.length === 0 && outwardPayload.length === 0) {
        alert('Please enter at least one Inward or Outward Ink (in Liters) or Paper Roll quantity.');
        return;
      }

      // Clean old entries for this date
      try {
        const existingRes = await api.getRawMaterialTransactions();
        if (existingRes && existingRes.data && Array.isArray(existingRes.data)) {
          const oldLogs = existingRes.data.filter(t => {
            if (!t.date) return false;
            const tDate = new Date(t.date).toISOString().split('T')[0];
            return tDate === rawDate;
          });
          for (const oldLog of oldLogs) {
            if (oldLog._id) {
              await api.deleteRawMaterialTransaction(oldLog._id);
            }
          }
        }
      } catch (cleanErr) {
        console.warn('Could not clean previous entries:', cleanErr);
      }

      if (inwardPayload.length > 0) {
        await api.createRawMaterialInward(inwardPayload);
      }
      if (outwardPayload.length > 0) {
        await api.createRawMaterialOutward(outwardPayload);
      }

      triggerPushNotification('📦 Raw Material Logs Saved', `Successfully updated raw material entries for ${rawDate}!`, 'success');
      await fetchRawMaterialSummary();

      setShowRawMaterialModal(false);
    } catch (err) {
      alert(err.message || 'Failed to save raw material entry.');
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
            <div><strong>Generated:</strong> ${formatDateDDMMYYYY(new Date())} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
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

        <div class="section-title" style="margin-top:10px;">1. Raw Material Consumption Summary</div>
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
              const grandoC = (grandoInkC && Number(grandoInkC) > 0) ? Number(grandoInkC).toFixed(2) : (rawMaterialSummary.grandoInk.C > 0 ? rawMaterialSummary.grandoInk.C.toFixed(2) : '');
              const grandoM = (grandoInkM && Number(grandoInkM) > 0) ? Number(grandoInkM).toFixed(2) : (rawMaterialSummary.grandoInk.M > 0 ? rawMaterialSummary.grandoInk.M.toFixed(2) : '');
              const grandoY = (grandoInkY && Number(grandoInkY) > 0) ? Number(grandoInkY).toFixed(2) : (rawMaterialSummary.grandoInk.Y > 0 ? rawMaterialSummary.grandoInk.Y.toFixed(2) : '');
              const grandoK = (grandoInkK && Number(grandoInkK) > 0) ? Number(grandoInkK).toFixed(2) : (rawMaterialSummary.grandoInk.K > 0 ? rawMaterialSummary.grandoInk.K.toFixed(2) : '');

              const printdotC = (printdotInkC && Number(printdotInkC) > 0) ? Number(printdotInkC).toFixed(2) : (rawMaterialSummary.printdotInk.C > 0 ? rawMaterialSummary.printdotInk.C.toFixed(2) : '');
              const printdotM = (printdotInkM && Number(printdotInkM) > 0) ? Number(printdotInkM).toFixed(2) : (rawMaterialSummary.printdotInk.M > 0 ? rawMaterialSummary.printdotInk.M.toFixed(2) : '');
              const printdotY = (printdotInkY && Number(printdotInkY) > 0) ? Number(printdotInkY).toFixed(2) : (rawMaterialSummary.printdotInk.Y > 0 ? rawMaterialSummary.printdotInk.Y.toFixed(2) : '');
              const printdotK = (printdotInkK && Number(printdotInkK) > 0) ? Number(printdotInkK).toFixed(2) : (rawMaterialSummary.printdotInk.K > 0 ? rawMaterialSummary.printdotInk.K.toFixed(2) : '');

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
                ${extraPapers.map(p => {
                  const pPanno = p.paperPanna === 'Custom' ? (p.paperCustomPanna || '') : (p.paperPanna || '');
                  return `
                    <tr>
                      <td class="bold"></td>
                      <td></td><td></td><td></td><td></td>
                      <td>${p.paperType || ''}</td>
                      <td>${pPanno}</td>
                      <td class="text-right bold">${p.paperRollsQty ? `${p.paperRollsQty} Rolls` : ''}</td>
                    </tr>
                  `;
                }).join('')}
              `;
            })()}
          </tbody>
        </table>

        <div class="section-title" style="margin-top:10px;">2. Complete Printing Entry & Run Logs</div>
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
          <div>Printed On: ${formatDateDDMMYYYY(new Date())}</div>
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
      if (res && res.operators && Array.isArray(res.operators) && res.operators.length > 0) {
        setOperatorsList(res.operators);
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

  // Handle Job Selection Change
  const handleJobSelect = (val) => {
    const matched = findMatchingJob(val);

    if (matched) {
      setSelectedJob(matched);
      setForm(prev => ({
        ...prev,
        jobNo: val,
        jobCardId: matched._id
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
      triggerEliteAlert('Validation Error', 'Please select or enter a Job Card Number.', 'warning');
      return;
    }
    if (!form.machineName) {
      triggerEliteAlert('Validation Error', 'Please select a Printing Machine.', 'warning');
      return;
    }
    if (!form.meters || parseFloat(form.meters) <= 0) {
      triggerEliteAlert('Validation Error', 'Please enter a valid meter quantity.', 'warning');
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

      if (form.date) {
        setDateStart(form.date);
        setDateEnd(form.date);
      }

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
    if (isOlderThan36Hours(log.created_date_time || log.createdAt || log.date)) {
      alert("This log entry is older than 36 hours and can no longer be edited.");
      return;
    }
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
    const confirmed = await triggerEliteConfirm({
      title: 'Delete Print Log',
      message: `Are you sure you want to delete this print log entry for Job #${jobNo}?`,
      confirmText: 'Delete Entry',
      type: 'danger'
    });
    if (!confirmed) return;
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
      triggerEliteAlert('Delete Failed', err.message || 'Failed to delete log entry.', 'error');
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

  // Filter suggestions based on input or show all available job cards
  const filteredJobSuggestions = useMemo(() => {
    if (!jobCards || jobCards.length === 0) return [];
    if (!form.jobNo || !form.jobNo.trim()) return jobCards.slice(0, 25);

    const q = form.jobNo.toLowerCase().trim();
    const digits = q.replace(/[^\d]/g, '');

    return jobCards.filter(c => {
      const jNo = String(c.jobNo || '').toLowerCase();
      const jDigits = jNo.replace(/[^\d]/g, '');
      const party = String(c.partyName || c.clientName || '').toLowerCase();
      const design = String(c.designName || c.designNo || '').toLowerCase();
      return jNo.includes(q) || (digits && jDigits.includes(digits)) || party.includes(q) || design.includes(q);
    }).slice(0, 25);
  }, [form.jobNo, jobCards]);

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
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Printing Department</h2>
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
              {/* Button 1: GENERATE REPORT */}
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

              {/* Button 2: Download Report */}
              <button
                type="button"
                onClick={() => {
                  setReportStartDate(dateStart);
                  setReportEndDate(dateEnd);
                  setShowReportModal(true);
                }}
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
                <Download size={14} /> Download Report
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

              {/* Jobcard Type / Selection (Input with Live Suggestions Dropdown & Datalist) */}
              <div style={{ position: 'relative' }}>
                <div style={{ marginBottom: '0.3rem' }}>
                  <label style={labelStyle}>JOB TYPE / JOBCARD NO. <span style={{ color: '#ef4444' }}>*</span></label>
                </div>

                <input
                  type="text"
                  list="active-jobcards-list"
                  placeholder="Type or select Job Card No. (e.g. 1001)"
                  value={form.jobNo}
                  onFocus={() => setShowJobSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowJobSuggestions(false), 200)}
                  onChange={e => {
                    handleJobSelect(e.target.value);
                    setShowJobSuggestions(true);
                  }}
                  style={{ ...inputStyle, width: '100%', fontWeight: 700, fontSize: '0.9rem' }}
                  required
                />

                {/* Native HTML5 Datalist Fallback */}
                <datalist id="active-jobcards-list">
                  {jobCards.map(c => (
                    <option key={c._id || c.jobNo} value={c.jobNo}>
                      {c.jobNo} {c.partyName ? `(${c.partyName})` : ''} {c.designName ? `- ${c.designName}` : ''}
                    </option>
                  ))}
                </datalist>

                {/* Custom Interactive Floating Auto-complete Dropdown */}
                {showJobSuggestions && filteredJobSuggestions.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      maxHeight: '230px',
                      overflowY: 'auto',
                      background: 'var(--panel-bg, #1e293b)',
                      border: '1px solid var(--border-color, #334155)',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                      zIndex: 1000,
                      marginTop: '4px'
                    }}
                  >
                    <div style={{ padding: '4px 10px', fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid #334155' }}>
                      SELECT FROM ACTIVE JOBCARDS ({filteredJobSuggestions.length}):
                    </div>
                    {filteredJobSuggestions.map(c => {
                      const stats = getJobProgressStats(c);
                      return (
                        <div
                          key={c._id || c.jobNo}
                          onMouseDown={() => {
                            handleJobSelect(c.jobNo);
                            setShowJobSuggestions(false);
                          }}
                          style={{
                            padding: '8px 12px',
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                            cursor: 'pointer',
                            display: 'flex',
                            justify: 'space-between',
                            alignItems: 'center',
                            transition: 'background 0.15s ease'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.12)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div>
                            <div style={{ fontWeight: 800, color: '#38bdf8', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>JobCard #{c.jobNo}</span>
                              {c.partyName && <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: '0.78rem' }}>({c.partyName})</span>}
                            </div>
                            {c.designName && (
                              <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: 1 }}>
                                Design: {c.designName}
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: stats.statusColor }}>
                              {stats.printedMtr}/{stats.targetMtr} mtr
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                              {c.machineName || 'Any Machine'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                  list="print-operators-list"
                  value={form.operatorName}
                  onChange={e => setForm(f => ({ ...f, operatorName: e.target.value }))}
                  placeholder="Select or Type Operator Name..."
                  style={{ ...inputStyle, fontWeight: 600 }}
                />
                <datalist id="print-operators-list">
                  {operatorsList.map(op => (
                    <option key={op} value={op} />
                  ))}
                </datalist>
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
                logs
                  .filter(log => matchSearchQuery(log, searchJob, ['jobNo', 'machineName', 'pass', 'operatorName', 'notes', 'shift']))
                  .map(log => (
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
                        {!isOlderThan36Hours(log.created_date_time || log.createdAt || log.date) && (
                          <button
                            onClick={() => handleStartEdit(log)}
                            style={{ padding: '0.3rem', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', borderRadius: 4, cursor: 'pointer' }}
                            title="Edit Print Log Entry"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
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

      {/* ── 3B. RAW MATERIAL SUMMARY CARD (OUTWARD CONSUMPTION / INWARD STOCK IN) ── */}
      <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: rawEntryType === 'INWARD' ? '4px solid #10b981' : '4px solid #f59e0b', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: rawEntryType === 'INWARD' ? '#34d399' : '#f59e0b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} /> Raw Material {rawEntryType === 'INWARD' ? 'Inward (Stock Received)' : 'Consumption (Outward)'} Summary
            </div>

            <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(255,255,255,0.04)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
              <button
                type="button"
                onClick={() => {
                  setRawEntryType('OUTWARD');
                  fetchRawMaterialSummary('OUTWARD');
                }}
                style={{
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  borderRadius: '5px',
                  border: 'none',
                  background: rawEntryType === 'OUTWARD' ? '#f59e0b' : 'transparent',
                  color: rawEntryType === 'OUTWARD' ? '#ffffff' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                📤 Outward (Usage)
              </button>

              <button
                type="button"
                onClick={() => {
                  setRawEntryType('INWARD');
                  fetchRawMaterialSummary('INWARD');
                }}
                style={{
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  borderRadius: '5px',
                  border: 'none',
                  background: rawEntryType === 'INWARD' ? '#10b981' : 'transparent',
                  color: rawEntryType === 'INWARD' ? '#ffffff' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                📥 Inward (Stock IN)
              </button>
            </div>
          </div>

          {!isOlderThan36Hours(dateEnd || dateStart) && (
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
                background: rawEntryType === 'INWARD' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                boxShadow: rawEntryType === 'INWARD' ? '0 3px 10px rgba(16, 185, 129, 0.3)' : '0 3px 10px rgba(245, 158, 11, 0.3)',
                cursor: 'pointer'
              }}
            >
              <Edit size={14} /> Log / Edit Raw Material
            </button>
          )}
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

            {/* Modal Body: DATES ONLY */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-light)',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8' }}>FROM DATE <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="date"
                    value={reportStartDate}
                    onChange={e => {
                      const val = e.target.value;
                      setReportStartDate(val);
                      setDateStart(val);
                    }}
                    style={{ ...inputStyle, fontSize: '0.85rem', padding: '0.55rem 0.75rem', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ ...labelStyle, fontSize: '0.75rem', fontWeight: 800, color: '#a78bfa' }}>TO DATE <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="date"
                    value={reportEndDate}
                    onChange={e => {
                      const val = e.target.value;
                      setReportEndDate(val);
                      setDateEnd(val);
                    }}
                    style={{ ...inputStyle, fontSize: '0.85rem', padding: '0.55rem 0.75rem', fontWeight: 700 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ ...labelStyle, fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b' }}>SHIFT REPORT</label>
                <select
                  value={reportShift}
                  onChange={e => setReportShift(e.target.value)}
                  style={{ ...inputStyle, fontSize: '0.85rem', padding: '0.55rem 0.75rem', fontWeight: 700, width: '100%' }}
                >
                  <option value="">All Shifts (Morning & Night)</option>
                  <option value="Morning">Morning Shift Only</option>
                  <option value="Night">Night Shift Only</option>
                </select>
              </div>
            </div>

            {/* Modal Footer: DOWNLOAD REPORT & CLOSE WINDOW */}
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
                    let shiftTag = 'All_Shifts';
                    if (reportShift === 'Morning') shiftTag = 'Morning_Shift';
                    else if (reportShift === 'Night') shiftTag = 'Night_Shift';

                    const fileName = `Printing_Production_Report_${shiftTag}_${reportStartDate}_to_${reportEndDate}.pdf`;

                    await api.downloadFabricCombinedReportPdf(
                      reportStartDate,
                      reportEndDate,
                      ['machine'],
                      fileName,
                      {
                        startTime: rawStartTime,
                        stopTime: rawStopTime,
                        operator: rawOperator,
                        shift: reportShift,
                        machineName: reportMachine,
                        pass: reportPass
                      }
                    );
                    setShowReportModal(false);
                  } catch (err) {
                    alert(err.message || 'Please enter Start Time and Stop Time on this date in Generate Report first.');
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
                  background: ((!reportStartTime && !rawStartTime) || (!reportEndTime && !rawStopTime))
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  boxShadow: ((!reportStartTime && !rawStartTime) || (!reportEndTime && !rawStopTime))
                    ? 'none'
                    : '0 4px 14px rgba(124, 58, 237, 0.4)',
                  cursor: ((!reportStartTime && !rawStartTime) || (!reportEndTime && !rawStopTime)) ? 'not-allowed' : 'pointer',
                  opacity: ((!reportStartTime && !rawStartTime) || (!reportEndTime && !rawStopTime)) ? 0.5 : 1
                }}
              >
                <Download size={16} /> {reportLoadingPdf ? 'Generating PDF...' : 'Download Report'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── 6. GENERATE REPORT / RAW MATERIAL FORM MODAL (50% INWARD | 50% OUTWARD SPLIT VIEW) ── */}
      {showRawMaterialModal && (
        <div className="modal-overlay" onClick={() => setShowRawMaterialModal(false)}>
          <div className="modal-content" style={{
            maxWidth: '1240px',
            width: '96%',
            maxHeight: '94vh',
            background: 'var(--bg-card, #131722)',
            borderRadius: '14px',
            border: '1px solid var(--border-light, #2a324b)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem'
          }} onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'linear-gradient(135deg, #10b981, #d97706)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Sparkles size={16} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    RAW MATERIAL ENTRY — 📥 INWARD (STOCK RECEIVED) & 📤 OUTWARD (USAGE)
                  </h3>
                </div>
              </div>
              <button onClick={() => setShowRawMaterialModal(false)} className="btn-icon"><X size={16} /></button>
            </div>

            <form onSubmit={handleSaveRawMaterialUsage} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              
              {/* Header Info Grid: Date, Shift, Start Time, Stop Time, Operator */}
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-light)',
                borderRadius: '8px',
                padding: '0.45rem 0.75rem',
                display: 'grid',
                gridTemplateColumns: '1fr 1.2fr 0.9fr 0.9fr 1.2fr',
                gap: '0.6rem',
                alignItems: 'center'
              }}>
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>DATE *</label>
                  <input type="date" value={rawDate} onChange={e => setRawDate(e.target.value)} style={{ ...inputStyle, padding: '0.3rem 0.5rem', fontSize: '0.78rem' }} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>SHIFT *</label>
                  <select value={rawShift} onChange={e => setRawShift(e.target.value)} style={{ ...inputStyle, padding: '0.3rem 0.5rem', fontSize: '0.78rem' }} required>
                    <option value="Morning">Morning (9 AM - 9 PM)</option>
                    <option value="Night">Night (9 PM - 9 AM)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#38bdf8', display: 'block', marginBottom: '2px' }}>START</label>
                  <input type="time" value={rawStartTime} onChange={e => setRawStartTime(e.target.value)} style={{ ...inputStyle, padding: '0.3rem 0.4rem', fontSize: '0.78rem' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#a78bfa', display: 'block', marginBottom: '2px' }}>STOP</label>
                  <input type="time" value={rawStopTime} onChange={e => setRawStopTime(e.target.value)} style={{ ...inputStyle, padding: '0.3rem 0.4rem', fontSize: '0.78rem' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>OPERATOR</label>
                  <input type="text" list="print-operators-list" placeholder="Operator..." value={rawOperator} onChange={e => setRawOperator(e.target.value)} style={{ ...inputStyle, padding: '0.3rem 0.5rem', fontSize: '0.78rem', fontWeight: 600 }} />
                </div>
              </div>

              {/* ── 50% | 50% SPLIT COLUMNS (LEFT: INWARD | RIGHT: OUTWARD) ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                
                {/* ── LEFT COLUMN (50%): 📥 INWARD (STOCK RECEIVED) ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  
                  {/* INWARD HEADER BADGE */}
                  <div style={{
                    background: 'linear-gradient(135deg, #059669, #047857)',
                    color: '#ffffff',
                    padding: '0.35rem 0.65rem',
                    borderRadius: '7px',
                    fontSize: '0.78rem',
                    fontWeight: 900,
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <ArrowDownToLine size={15} /> 📥 50% INWARD (STOCK RECEIVED / IN)
                  </div>

                  {/* INK INWARD CARD */}
                  <div style={{ background: '#ffffff', color: '#0f172a', border: '2px solid #10b981', borderRadius: '8px', padding: '0.55rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#059669', textTransform: 'uppercase' }}>💧 INK INWARD (LITERS)</div>
                    
                    {/* Grando Ink Inward */}
                    <div style={{ background: '#ecfdf5', padding: '0.35rem 0.5rem', borderRadius: '5px', border: '1px solid #a7f3d0' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#047857', marginBottom: '2px' }}>🖨️ GRANDO INK</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.25rem' }}>
                        <div>
                          <label style={{ fontSize: '0.62rem', fontWeight: 900, color: '#0284c7', display: 'block', textAlign: 'center' }}>C</label>
                          <input type="number" step="0.01" placeholder="0.00" value={grandoInC} onChange={e => setGrandoInC(e.target.value)} style={{ width: '100%', padding: '0.25rem', fontSize: '0.78rem', textAlign: 'center', background: '#ffffff', border: '1.5px solid #0284c7', borderRadius: '4px', color: '#0f172a', fontWeight: 700, boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.62rem', fontWeight: 900, color: '#db2777', display: 'block', textAlign: 'center' }}>M</label>
                          <input type="number" step="0.01" placeholder="0.00" value={grandoInM} onChange={e => setGrandoInM(e.target.value)} style={{ width: '100%', padding: '0.25rem', fontSize: '0.78rem', textAlign: 'center', background: '#ffffff', border: '1.5px solid #db2777', borderRadius: '4px', color: '#0f172a', fontWeight: 700, boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.62rem', fontWeight: 900, color: '#ca8a04', display: 'block', textAlign: 'center' }}>Y</label>
                          <input type="number" step="0.01" placeholder="0.00" value={grandoInY} onChange={e => setGrandoInY(e.target.value)} style={{ width: '100%', padding: '0.25rem', fontSize: '0.78rem', textAlign: 'center', background: '#ffffff', border: '1.5px solid #ca8a04', borderRadius: '4px', color: '#0f172a', fontWeight: 700, boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.62rem', fontWeight: 900, color: '#334155', display: 'block', textAlign: 'center' }}>K</label>
                          <input type="number" step="0.01" placeholder="0.00" value={grandoInK} onChange={e => setGrandoInK(e.target.value)} style={{ width: '100%', padding: '0.25rem', fontSize: '0.78rem', textAlign: 'center', background: '#ffffff', border: '1.5px solid #334155', borderRadius: '4px', color: '#0f172a', fontWeight: 700, boxSizing: 'border-box' }} />
                        </div>
                      </div>
                    </div>

                    {/* PrintDot Ink Inward */}
                    <div style={{ background: '#ecfdf5', padding: '0.35rem 0.5rem', borderRadius: '5px', border: '1px solid #a7f3d0' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#047857', marginBottom: '2px' }}>🖨️ PRINTDOT INK</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.25rem' }}>
                        <div>
                          <label style={{ fontSize: '0.62rem', fontWeight: 900, color: '#0284c7', display: 'block', textAlign: 'center' }}>C</label>
                          <input type="number" step="0.01" placeholder="0.00" value={printdotInC} onChange={e => setPrintdotInC(e.target.value)} style={{ width: '100%', padding: '0.25rem', fontSize: '0.78rem', textAlign: 'center', background: '#ffffff', border: '1.5px solid #0284c7', borderRadius: '4px', color: '#0f172a', fontWeight: 700, boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.62rem', fontWeight: 900, color: '#db2777', display: 'block', textAlign: 'center' }}>M</label>
                          <input type="number" step="0.01" placeholder="0.00" value={printdotInM} onChange={e => setPrintdotInM(e.target.value)} style={{ width: '100%', padding: '0.25rem', fontSize: '0.78rem', textAlign: 'center', background: '#ffffff', border: '1.5px solid #db2777', borderRadius: '4px', color: '#0f172a', fontWeight: 700, boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.62rem', fontWeight: 900, color: '#ca8a04', display: 'block', textAlign: 'center' }}>Y</label>
                          <input type="number" step="0.01" placeholder="0.00" value={printdotInY} onChange={e => setPrintdotInY(e.target.value)} style={{ width: '100%', padding: '0.25rem', fontSize: '0.78rem', textAlign: 'center', background: '#ffffff', border: '1.5px solid #ca8a04', borderRadius: '4px', color: '#0f172a', fontWeight: 700, boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.62rem', fontWeight: 900, color: '#334155', display: 'block', textAlign: 'center' }}>K</label>
                          <input type="number" step="0.01" placeholder="0.00" value={printdotInK} onChange={e => setPrintdotInK(e.target.value)} style={{ width: '100%', padding: '0.25rem', fontSize: '0.78rem', textAlign: 'center', background: '#ffffff', border: '1.5px solid #334155', borderRadius: '4px', color: '#0f172a', fontWeight: 700, boxSizing: 'border-box' }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PAPER INWARD CARD */}
                  <div style={{ background: '#ffffff', color: '#0f172a', border: '2px solid #10b981', borderRadius: '8px', padding: '0.55rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#059669', textTransform: 'uppercase' }}>📜 PAPER INWARD (STOCK IN)</div>
                      <button type="button" onClick={handleAddInwardPaperEntry} style={{ padding: '0.15rem 0.45rem', fontSize: '0.68rem', fontWeight: 800, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', borderRadius: '4px', cursor: 'pointer' }}>+ Add Row</button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {inwardPaperEntries.map((entry, index) => (
                        <div key={entry.id} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', background: '#f8fafc', padding: '0.25rem 0.45rem', borderRadius: '5px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#059669' }}>#{index + 1}</span>
                          <div style={{ flex: 1 }}>
                            <select value={entry.paperType} onChange={e => handleInwardPaperEntryChange(entry.id, 'paperType', e.target.value)} style={{ width: '100%', padding: '0.25rem', fontSize: '0.75rem', background: '#ffffff', border: '1px solid #059669', borderRadius: '4px', color: '#0f172a', fontWeight: 700 }}>
                              {(paperTypesList.length > 0 ? paperTypesList : ['A++', 'A+', 'A']).map((p, pIdx) => (
                                <option key={pIdx} value={p}>{p}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ flex: 1 }}>
                            <select value={entry.paperPanna} onChange={e => handleInwardPaperEntryChange(entry.id, 'paperPanna', e.target.value)} style={{ width: '100%', padding: '0.25rem', fontSize: '0.75rem', background: '#ffffff', border: '1px solid #059669', borderRadius: '4px', color: '#0f172a', fontWeight: 700 }}>
                              {(pannaOptionsList.length > 0 ? pannaOptionsList : ['44" Panna', '54" Panna', '60" Panna', '64" Panna', '72" Panna']).map((w, wIdx) => (
                                <option key={wIdx} value={w}>{w.toLowerCase().includes('panna') || w.includes('"') ? w : `${w} Panna`}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ width: '70px' }}>
                            <input type="number" step="1" placeholder="Rolls" value={entry.paperRollsQty} onChange={e => handleInwardPaperEntryChange(entry.id, 'paperRollsQty', e.target.value)} style={{ width: '100%', padding: '0.25rem', fontSize: '0.75rem', textAlign: 'center', background: '#ffffff', border: '1.5px solid #059669', borderRadius: '4px', color: '#0f172a', fontWeight: 800, boxSizing: 'border-box' }} />
                          </div>
                          {inwardPaperEntries.length > 1 && (
                            <button type="button" onClick={() => handleRemoveInwardPaperEntry(entry.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.1rem' }}><Trash2 size={13} /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* ── RIGHT COLUMN (50%): 📤 OUTWARD (USAGE / CONSUMPTION) ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  
                  {/* OUTWARD HEADER BADGE */}
                  <div style={{
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#ffffff',
                    padding: '0.35rem 0.65rem',
                    borderRadius: '7px',
                    fontSize: '0.78rem',
                    fontWeight: 900,
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <ArrowUpFromLine size={15} /> 📤 50% OUTWARD (USAGE / CONSUMPTION)
                  </div>

                  {/* INK OUTWARD CARD */}
                  <div style={{ background: '#ffffff', color: '#0f172a', border: '2px solid #f59e0b', borderRadius: '8px', padding: '0.55rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#d97706', textTransform: 'uppercase' }}>💧 INK USAGE (LITERS)</div>
                    
                    {/* Grando Ink Outward */}
                    <div style={{ background: '#fffbeb', padding: '0.35rem 0.5rem', borderRadius: '5px', border: '1px solid #fde68a' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#b45309', marginBottom: '2px' }}>🖨️ GRANDO INK</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.25rem' }}>
                        <div>
                          <label style={{ fontSize: '0.62rem', fontWeight: 900, color: '#0284c7', display: 'block', textAlign: 'center' }}>C</label>
                          <input type="number" step="0.01" placeholder="0.00" value={grandoOutC} onChange={e => setGrandoOutC(e.target.value)} style={{ width: '100%', padding: '0.25rem', fontSize: '0.78rem', textAlign: 'center', background: '#ffffff', border: '1.5px solid #0284c7', borderRadius: '4px', color: '#0f172a', fontWeight: 700, boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.62rem', fontWeight: 900, color: '#db2777', display: 'block', textAlign: 'center' }}>M</label>
                          <input type="number" step="0.01" placeholder="0.00" value={grandoOutM} onChange={e => setGrandoOutM(e.target.value)} style={{ width: '100%', padding: '0.25rem', fontSize: '0.78rem', textAlign: 'center', background: '#ffffff', border: '1.5px solid #db2777', borderRadius: '4px', color: '#0f172a', fontWeight: 700, boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.62rem', fontWeight: 900, color: '#ca8a04', display: 'block', textAlign: 'center' }}>Y</label>
                          <input type="number" step="0.01" placeholder="0.00" value={grandoOutY} onChange={e => setGrandoOutY(e.target.value)} style={{ width: '100%', padding: '0.25rem', fontSize: '0.78rem', textAlign: 'center', background: '#ffffff', border: '1.5px solid #ca8a04', borderRadius: '4px', color: '#0f172a', fontWeight: 700, boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.62rem', fontWeight: 900, color: '#334155', display: 'block', textAlign: 'center' }}>K</label>
                          <input type="number" step="0.01" placeholder="0.00" value={grandoOutK} onChange={e => setGrandoOutK(e.target.value)} style={{ width: '100%', padding: '0.25rem', fontSize: '0.78rem', textAlign: 'center', background: '#ffffff', border: '1.5px solid #334155', borderRadius: '4px', color: '#0f172a', fontWeight: 700, boxSizing: 'border-box' }} />
                        </div>
                      </div>
                    </div>

                    {/* PrintDot Ink Outward */}
                    <div style={{ background: '#fffbeb', padding: '0.35rem 0.5rem', borderRadius: '5px', border: '1px solid #fde68a' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#b45309', marginBottom: '2px' }}>🖨️ PRINTDOT INK</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.25rem' }}>
                        <div>
                          <label style={{ fontSize: '0.62rem', fontWeight: 900, color: '#0284c7', display: 'block', textAlign: 'center' }}>C</label>
                          <input type="number" step="0.01" placeholder="0.00" value={printdotOutC} onChange={e => setPrintdotOutC(e.target.value)} style={{ width: '100%', padding: '0.25rem', fontSize: '0.78rem', textAlign: 'center', background: '#ffffff', border: '1.5px solid #0284c7', borderRadius: '4px', color: '#0f172a', fontWeight: 700, boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.62rem', fontWeight: 900, color: '#db2777', display: 'block', textAlign: 'center' }}>M</label>
                          <input type="number" step="0.01" placeholder="0.00" value={printdotOutM} onChange={e => setPrintdotOutM(e.target.value)} style={{ width: '100%', padding: '0.25rem', fontSize: '0.78rem', textAlign: 'center', background: '#ffffff', border: '1.5px solid #db2777', borderRadius: '4px', color: '#0f172a', fontWeight: 700, boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.62rem', fontWeight: 900, color: '#ca8a04', display: 'block', textAlign: 'center' }}>Y</label>
                          <input type="number" step="0.01" placeholder="0.00" value={printdotOutY} onChange={e => setPrintdotOutY(e.target.value)} style={{ width: '100%', padding: '0.25rem', fontSize: '0.78rem', textAlign: 'center', background: '#ffffff', border: '1.5px solid #ca8a04', borderRadius: '4px', color: '#0f172a', fontWeight: 700, boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.62rem', fontWeight: 900, color: '#334155', display: 'block', textAlign: 'center' }}>K</label>
                          <input type="number" step="0.01" placeholder="0.00" value={printdotOutK} onChange={e => setPrintdotOutK(e.target.value)} style={{ width: '100%', padding: '0.25rem', fontSize: '0.78rem', textAlign: 'center', background: '#ffffff', border: '1.5px solid #334155', borderRadius: '4px', color: '#0f172a', fontWeight: 700, boxSizing: 'border-box' }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PAPER OUTWARD CARD */}
                  <div style={{ background: '#ffffff', color: '#0f172a', border: '2px solid #f59e0b', borderRadius: '8px', padding: '0.55rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#d97706', textTransform: 'uppercase' }}>📜 PAPER USAGE (CONSUMPTION)</div>
                      <button type="button" onClick={handleAddOutwardPaperEntry} style={{ padding: '0.15rem 0.45rem', fontSize: '0.68rem', fontWeight: 800, background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', borderRadius: '4px', cursor: 'pointer' }}>+ Add Row</button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {outwardPaperEntries.map((entry, index) => (
                        <div key={entry.id} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', background: '#f8fafc', padding: '0.25rem 0.45rem', borderRadius: '5px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#d97706' }}>#{index + 1}</span>
                          <div style={{ flex: 1 }}>
                            <select value={entry.paperType} onChange={e => handleOutwardPaperEntryChange(entry.id, 'paperType', e.target.value)} style={{ width: '100%', padding: '0.25rem', fontSize: '0.75rem', background: '#ffffff', border: '1px solid #d97706', borderRadius: '4px', color: '#0f172a', fontWeight: 700 }}>
                              {(paperTypesList.length > 0 ? paperTypesList : ['A++', 'A+', 'A']).map((p, pIdx) => (
                                <option key={pIdx} value={p}>{p}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ flex: 1 }}>
                            <select value={entry.paperPanna} onChange={e => handleOutwardPaperEntryChange(entry.id, 'paperPanna', e.target.value)} style={{ width: '100%', padding: '0.25rem', fontSize: '0.75rem', background: '#ffffff', border: '1px solid #d97706', borderRadius: '4px', color: '#0f172a', fontWeight: 700 }}>
                              {(pannaOptionsList.length > 0 ? pannaOptionsList : ['44" Panna', '54" Panna', '60" Panna', '64" Panna', '72" Panna']).map((w, wIdx) => (
                                <option key={wIdx} value={w}>{w.toLowerCase().includes('panna') || w.includes('"') ? w : `${w} Panna`}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ width: '70px' }}>
                            <input type="number" step="1" placeholder="Rolls" value={entry.paperRollsQty} onChange={e => handleOutwardPaperEntryChange(entry.id, 'paperRollsQty', e.target.value)} style={{ width: '100%', padding: '0.25rem', fontSize: '0.75rem', textAlign: 'center', background: '#ffffff', border: '1.5px solid #d97706', borderRadius: '4px', color: '#0f172a', fontWeight: 800, boxSizing: 'border-box' }} />
                          </div>
                          {outwardPaperEntries.length > 1 && (
                            <button type="button" onClick={() => handleRemoveOutwardPaperEntry(entry.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.1rem' }}><Trash2 size={13} /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>

              {/* Remarks / Notes & Action Buttons */}
              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', marginTop: '0.2rem' }}>
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    placeholder="Remarks / Optional notes..."
                    value={rawNotes}
                    onChange={e => setRawNotes(e.target.value)}
                    style={{ ...inputStyle, padding: '0.35rem 0.6rem', fontSize: '0.78rem' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowRawMaterialModal(false)}
                  className="btn-secondary"
                  style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', fontWeight: 700 }}
                >
                  Close
                </button>

                <button
                  type="submit"
                  disabled={rawMaterialSubmitting}
                  className="btn-primary"
                  style={{
                    padding: '0.45rem 1.4rem',
                    fontSize: '0.85rem',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'linear-gradient(135deg, #10b981 0%, #d97706 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                    cursor: 'pointer'
                  }}
                >
                  <Sparkles size={15} /> {rawMaterialSubmitting ? 'Saving Entries...' : 'Save Inward & Outward Stock'}
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
