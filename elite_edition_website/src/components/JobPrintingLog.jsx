import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../services/api';
import {
  Printer, PlusCircle, Search, RefreshCw, Trash2, Edit2, Edit, CheckCircle2,
  AlertCircle, Cpu, Calendar, Clock, User, Layers, ArrowUpRight, Check,
  X, Download, Eye, Layers3, Activity, Tag, Sparkles, FileText, ArrowUpFromLine, ArrowDownToLine,
  Zap, Droplets, TrendingUp, BarChart3, ListFilter, PlayCircle,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ArrowUpDown, History, Filter, FileSpreadsheet
} from 'lucide-react';
import { triggerPushNotification, triggerGlobalDataRefresh } from './NotificationToast';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY, toLocalYMD, formatForInputDate } from '../utils/dateUtils';
import { matchSearchQuery } from '../utils/searchUtils';
import { cleanDesignNameString } from '../utils/designUtils';
import { triggerEliteAlert, triggerEliteConfirm } from './EliteModalDialog';
import { openPrintOptionsDialog } from '../utils/printService';
import JobCardTooltip from './JobCardTooltip';
import DateRangePicker, { getDatePresetRange } from './DateRangePicker';
import UnifiedFilterPopover from './common/UnifiedFilterPopover';

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
  'GRANDO',
  'PRINTDOT',
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
  const [printFilters, setPrintFilters] = useState({ machine: [], operator: [], shift: [], pass: [] });
  const [datePreset, setDatePreset] = useState('today');
  const [dateStart, setDateStart] = useState(() => toLocalYMD());
  const [dateEnd, setDateEnd] = useState(() => toLocalYMD());
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');

  // Server-side Pagination & Sorting State (D-P1 & D-P2 Fix)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [serverKpis, setServerKpis] = useState({ totalMeters: 0, morningMeters: 0, nightMeters: 0, uniqueJobsCount: 0, totalLogs: 0 });
  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Edit Mode state
  const [editingLogId, setEditingLogId] = useState(null);
  const [editModalLog, setEditModalLog] = useState(null);
  const [activeView, setActiveView] = useState('log'); // 'log' | 'queue'
  const [queueFabricFilter, setQueueFabricFilter] = useState('All');
  const [queueSearch, setQueueSearch] = useState('');

  // Form Collapse & Consolidated Reports Dropdown State
  const [isFormCollapsed, setIsFormCollapsed] = useState(false);
  const [showReportsDropdown, setShowReportsDropdown] = useState(false);
  const reportsDropdownRef = useRef(null);

  useEffect(() => {
    const handleReportsOutsideClick = (e) => {
      if (reportsDropdownRef.current && !reportsDropdownRef.current.contains(e.target)) {
        setShowReportsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleReportsOutsideClick);
    return () => document.removeEventListener('mousedown', handleReportsOutsideClick);
  }, []);

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
    date: toLocalYMD(),
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
  const [reportStartDate, setReportStartDate] = useState(() => toLocalYMD());
  const [reportEndDate, setReportEndDate] = useState(() => toLocalYMD());
  const [reportStartTime, setReportStartTime] = useState('');
  const [reportEndTime, setReportEndTime] = useState('');
  const [reportMachine, setReportMachine] = useState('');
  const [reportShift, setReportShift] = useState('');
  const [isNightReport, setIsNightReport] = useState(false);
  const [reportOperator, setReportOperator] = useState('');
  const [reportPass, setReportPass] = useState('');
  const [reportSearchJob, setReportSearchJob] = useState('');
  const [reportLoadingPdf, setReportLoadingPdf] = useState(false);

  // ── PREVIOUS REPORTS ARCHIVE & PREVIEW MODAL STATES ──
  const [archivePreset, setArchivePreset] = useState('last_7_days');
  const [archiveDateStart, setArchiveDateStart] = useState(() => {
    const { dateStart: ds } = getDatePresetRange('last_7_days');
    return ds || toLocalYMD();
  });
  const [archiveDateEnd, setArchiveDateEnd] = useState(() => {
    const { dateEnd: de } = getDatePresetRange('last_7_days');
    return de || toLocalYMD();
  });
  const [archiveCustomStart, setArchiveCustomStart] = useState('');
  const [archiveCustomEnd, setArchiveCustomEnd] = useState('');
  const [archiveShift, setArchiveShift] = useState('All');
  const [archiveMachine, setArchiveMachine] = useState('All');
  const [archiveOperator, setArchiveOperator] = useState('All');
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveLogs, setArchiveLogs] = useState([]);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [archiveGroupBy, setArchiveGroupBy] = useState('shift'); // 'shift' | 'date'
  const [expandedArchiveKey, setExpandedArchiveKey] = useState(null);

  // Dedicated Interactive Preview Report Modal State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewReportConfig, setPreviewReportConfig] = useState(null);
  const [previewLoadingPdf, setPreviewLoadingPdf] = useState(false);

  // Dedicated Raw Material Usage Form Modal State
  const [showRawMaterialModal, setShowRawMaterialModal] = useState(false);
  const [rawMaterialSubmitting, setRawMaterialSubmitting] = useState(false);
  const [rawEntryType, setRawEntryType] = useState('OUTWARD');

  const [rawDate, setRawDate] = useState(() => toLocalYMD());
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
    { id: 1, paperType: 'A++', paperPanna: '44" Panna', paperCustomPanna: '', paperRollsQty: '', paperMtrQty: '' }
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
    { id: 1, paperType: 'A++', paperPanna: '44" Panna', paperCustomPanna: '', paperRollsQty: '', paperMtrQty: '' }
  ]);

  const [pannaOptionsList, setPannaOptionsList] = useState([]);
  const [paperTypesList, setPaperTypesList] = useState(['A++', 'A+', 'A']);

  // Paper Entry Helper Handlers for INWARD
  const handleAddInwardPaperEntry = () => {
    setInwardPaperEntries(prev => [
      ...prev,
      { id: prev.length + 1, paperType: paperTypesList[0] || 'A++', paperPanna: pannaOptionsList[0] || '44" Panna', paperCustomPanna: '', paperRollsQty: '', paperMtrQty: '' }
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
      { id: prev.length + 1, paperType: paperTypesList[0] || 'A++', paperPanna: pannaOptionsList[0] || '44" Panna', paperCustomPanna: '', paperRollsQty: '', paperMtrQty: '' }
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

  const parseRawTransactionsForSummary = (rawList = [], activeStart, activeEnd) => {
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

    rawList.forEach(t => {
      if (!t.date) return;
      const dObj = new Date(t.date);
      const yyyy = dObj.getFullYear();
      const mm = String(dObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dObj.getDate()).padStart(2, '0');
      const dStr = `${yyyy}-${mm}-${dd}`;

      if (activeStart && dStr < activeStart) return;
      if (activeEnd && dStr > activeEnd) return;

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
        const mtrVal = t.metersPerRoll || (t.notes ? (t.notes.match(/Mtr:\s*([\d.]+)/i) || [])[1] : '');
        targetPaperList.push({
          id: targetPaperList.length + 1,
          paperType: t.materialName || 'A++',
          paperPanna: t.panna ? (t.panna.toLowerCase().includes('panna') || t.panna.includes('"') ? t.panna : `${t.panna} Panna`) : '44" Panna',
          paperCustomPanna: '',
          paperRollsQty: q ? q.toString() : '',
          paperMtrQty: mtrVal ? mtrVal.toString() : ''
        });
      }
    });

    return {
      inward: { grando: inGrando, printdot: inPrintdot, paper: inPaperList },
      outward: { grando: outGrando, printdot: outPrintdot, paper: outPaperList },
      foundStart,
      foundStop,
      foundShift,
      foundOperator
    };
  };

  const fetchRawMaterialSummary = async (overrideStart, overrideEnd) => {
    try {
      const activeStart = overrideStart !== undefined ? overrideStart : (dateStart || rawDate);
      const activeEnd = overrideEnd !== undefined ? overrideEnd : (dateEnd || rawDate);
      const params = {};
      if (activeStart) params.dateStart = activeStart;
      if (activeEnd) params.dateEnd = activeEnd;

      const res = await api.getRawMaterialTransactions(params);
      if (res && res.data && Array.isArray(res.data)) {
        const parsed = parseRawTransactionsForSummary(res.data, activeStart, activeEnd);

        if (parsed.foundStart) setRawStartTime(parsed.foundStart);
        if (parsed.foundStop) setRawStopTime(parsed.foundStop);
        if (parsed.foundShift) setRawShift(parsed.foundShift);
        if (parsed.foundOperator) setRawOperator(parsed.foundOperator);

        // Populate Inward Inputs
        setGrandoInC(parsed.inward.grando.C > 0 ? parsed.inward.grando.C.toString() : '');
        setGrandoInM(parsed.inward.grando.M > 0 ? parsed.inward.grando.M.toString() : '');
        setGrandoInY(parsed.inward.grando.Y > 0 ? parsed.inward.grando.Y.toString() : '');
        setGrandoInK(parsed.inward.grando.K > 0 ? parsed.inward.grando.K.toString() : '');

        setPrintdotInC(parsed.inward.printdot.C > 0 ? parsed.inward.printdot.C.toString() : '');
        setPrintdotInM(parsed.inward.printdot.M > 0 ? parsed.inward.printdot.M.toString() : '');
        setPrintdotInY(parsed.inward.printdot.Y > 0 ? parsed.inward.printdot.Y.toString() : '');
        setPrintdotInK(parsed.inward.printdot.K > 0 ? parsed.inward.printdot.K.toString() : '');

        setInwardPaperEntries(parsed.inward.paper.length > 0 ? parsed.inward.paper : [
          { id: 1, paperType: 'A++', paperPanna: '44" Panna', paperCustomPanna: '', paperRollsQty: '', paperMtrQty: '' }
        ]);

        // Populate Outward Inputs
        setGrandoOutC(parsed.outward.grando.C > 0 ? parsed.outward.grando.C.toString() : '');
        setGrandoOutM(parsed.outward.grando.M > 0 ? parsed.outward.grando.M.toString() : '');
        setGrandoOutY(parsed.outward.grando.Y > 0 ? parsed.outward.grando.Y.toString() : '');
        setGrandoOutK(parsed.outward.grando.K > 0 ? parsed.outward.grando.K.toString() : '');

        setPrintdotOutC(parsed.outward.printdot.C > 0 ? parsed.outward.printdot.C.toString() : '');
        setPrintdotOutM(parsed.outward.printdot.M > 0 ? parsed.outward.printdot.M.toString() : '');
        setPrintdotOutY(parsed.outward.printdot.Y > 0 ? parsed.outward.printdot.Y.toString() : '');
        setPrintdotOutK(parsed.outward.printdot.K > 0 ? parsed.outward.printdot.K.toString() : '');

        setOutwardPaperEntries(parsed.outward.paper.length > 0 ? parsed.outward.paper : [
          { id: 1, paperType: 'A++', paperPanna: '44" Panna', paperCustomPanna: '', paperRollsQty: '', paperMtrQty: '' }
        ]);

        setRawMaterialSummary({
          inward: parsed.inward,
          outward: parsed.outward
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
        const rolls = Number(entry.paperRollsQty) || 0;
        const mtr = Number(entry.paperMtrQty) || 0;
        if (rolls > 0 || mtr > 0) {
          const selPanna = entry.paperPanna === 'Custom' ? (entry.paperCustomPanna || '44" Panna') : entry.paperPanna;
          inwardPayload.push({
            materialName: entry.paperType || 'A++', panna: selPanna, qty: rolls, metersPerRoll: mtr, unit: 'Rolls', date: rawDate,
            notes: `[Panna: ${selPanna} | Rolls: ${rolls} | Mtr: ${mtr}m | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim()
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
        const rolls = Number(entry.paperRollsQty) || 0;
        const mtr = Number(entry.paperMtrQty) || 0;
        if (rolls > 0 || mtr > 0) {
          const selPanna = entry.paperPanna === 'Custom' ? (entry.paperCustomPanna || '44" Panna') : entry.paperPanna;
          outwardPayload.push({
            materialName: entry.paperType || 'A++', panna: selPanna, qty: rolls, metersPerRoll: mtr, unit: 'Rolls', date: rawDate,
            notes: `[Panna: ${selPanna} | Rolls: ${rolls} | Mtr: ${mtr}m | Shift: ${rawShift}${timeInfo} | Operator: ${rawOperator || '—'}] ${rawNotes}`.trim()
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

  // ⚡ INSTANT OPERATOR REPORT PRINT / PDF GENERATOR
  const handlePrintOperatorReport = async (repLogs) => {
    if (!repLogs || repLogs.length === 0) {
      triggerEliteAlert('No Entries', 'No printing log entries found for the selected filter criteria.', 'warning');
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
        const outG = rawMaterialSummary?.outward?.grando || { C: 0, M: 0, Y: 0, K: 0 };
        const outP = rawMaterialSummary?.outward?.printdot || { C: 0, M: 0, Y: 0, K: 0 };
        const outPapers = rawMaterialSummary?.outward?.paper || [];

        const grandoC = (Number(grandoOutC) > 0) ? Number(grandoOutC).toFixed(2) : (outG.C > 0 ? outG.C.toFixed(2) : '');
        const grandoM = (Number(grandoOutM) > 0) ? Number(grandoOutM).toFixed(2) : (outG.M > 0 ? outG.M.toFixed(2) : '');
        const grandoY = (Number(grandoOutY) > 0) ? Number(grandoOutY).toFixed(2) : (outG.Y > 0 ? outG.Y.toFixed(2) : '');
        const grandoK = (Number(grandoOutK) > 0) ? Number(grandoOutK).toFixed(2) : (outG.K > 0 ? outG.K.toFixed(2) : '');

        const printdotC = (Number(printdotOutC) > 0) ? Number(printdotOutC).toFixed(2) : (outP.C > 0 ? outP.C.toFixed(2) : '');
        const printdotM = (Number(printdotOutM) > 0) ? Number(printdotOutM).toFixed(2) : (outP.M > 0 ? outP.M.toFixed(2) : '');
        const printdotY = (Number(printdotOutY) > 0) ? Number(printdotOutY).toFixed(2) : (outP.Y > 0 ? outP.Y.toFixed(2) : '');
        const printdotK = (Number(printdotOutK) > 0) ? Number(printdotOutK).toFixed(2) : (outP.K > 0 ? outP.K.toFixed(2) : '');

        const row1Paper = outPapers[0] || {};
        const row2Paper = outPapers[1] || {};
        const extraPapers = outPapers.slice(2);

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
      </div>
    `;

    await openPrintOptionsDialog({
      title: `Digital Operator Printing Report (${reportStartDate} to ${reportEndDate})`,
      content: htmlContent,
      defaultSettings: {
        paperSize: 'A4',
        orientation: 'portrait',
        margin: 'default'
      }
    });
  };

  // Paper Entry Handlers for Multiple Paper Rows
  const handleAddPaperEntry = () => {
    setPaperEntries(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        paperType: paperTypesList[0] || 'A++',
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

  // Load Print Logs List (D-P1 & D-P2 Fix: Server-side pagination, sorting, and aggregate KPIs)
  const fetchLogs = async (overrideDateStart, overrideDateEnd) => {
    setLoading(true);
    setError('');
    const ds = overrideDateStart !== undefined ? overrideDateStart : dateStart;
    const de = overrideDateEnd !== undefined ? overrideDateEnd : dateEnd;
    try {
      const res = await api.getJobPrintLogs({
        jobNo: searchJob,
        search: searchJob,
        machineName: printFilters.machine && printFilters.machine.length > 0 ? printFilters.machine.join(',') : undefined,
        operatorName: printFilters.operator && printFilters.operator.length > 0 ? printFilters.operator.join(',') : undefined,
        shift: printFilters.shift && printFilters.shift.length > 0 ? printFilters.shift.join(',') : undefined,
        dateStart: ds,
        dateEnd: de,
        page: currentPage,
        limit: pageSize,
        sortField,
        sortOrder
      });
      if (res && res.data) {
        let fetchedLogs = res.data;
        if (printFilters.pass && printFilters.pass.length > 0) {
          fetchedLogs = fetchedLogs.filter(l => printFilters.pass.includes(l.pass));
        }
        setLogs(fetchedLogs);
        if (res.kpis) {
          setServerKpis(res.kpis);
        } else if (res.totalMeters !== undefined) {
          setServerKpis(prev => ({
            ...prev,
            totalMeters: res.totalMeters || 0,
            totalLogs: res.total || res.data.length
          }));
        }
        if (res.pages !== undefined) setTotalPages(res.pages);
        if (res.total !== undefined) setTotalCount(res.total);
      }
      await fetchRawMaterialSummary(ds, de);
    } catch (err) {
      setError(err.message || 'Failed to load printing logs.');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'meters' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  const renderSortHeader = (label, field, align = 'left') => {
    const isSorted = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        style={{
          ...thStyle,
          textAlign: align,
          cursor: 'pointer',
          userSelect: 'none',
          color: isSorted ? '#38bdf8' : 'var(--text-muted)',
          transition: 'color 0.2s ease'
        }}
        title={`Sort by ${label} (${isSorted && sortOrder === 'asc' ? 'Descending' : 'Ascending'})`}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
          <span>{label}</span>
          {isSorted ? (
            sortOrder === 'asc' ? <ChevronUp size={13} color="#38bdf8" /> : <ChevronDown size={13} color="#38bdf8" />
          ) : (
            <ArrowUpDown size={11} style={{ opacity: 0.35 }} />
          )}
        </div>
      </th>
    );
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

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchJob, printFilters, dateStart, dateEnd]);

  useEffect(() => {
    fetchLogs();
  }, [searchJob, printFilters, dateStart, dateEnd, currentPage, pageSize, sortField, sortOrder]);

  // ── ARCHIVE LOGS FETCHER ──
  const fetchArchiveLogs = async (overrideStart, overrideEnd) => {
    setLoadingArchive(true);
    try {
      const s = overrideStart !== undefined ? overrideStart : archiveDateStart;
      const e = overrideEnd !== undefined ? overrideEnd : archiveDateEnd;
      const res = await api.getJobPrintLogs({
        dateStart: s,
        dateEnd: e,
        limit: 2000
      });
      if (res && res.data) {
        setArchiveLogs(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.warn('Failed to load archive logs:', err);
    } finally {
      setLoadingArchive(false);
    }
  };

  useEffect(() => {
    if (activeView === 'reports') {
      fetchArchiveLogs(archiveDateStart, archiveDateEnd);
    }
  }, [activeView, archiveDateStart, archiveDateEnd]);

  // Group Archive logs by Shift or Full Day
  const archiveGroups = useMemo(() => {
    if (!archiveLogs || archiveLogs.length === 0) return [];

    let filtered = archiveLogs;
    if (archiveShift && archiveShift !== 'All') {
      filtered = filtered.filter(l => (l.shift || 'Morning').toLowerCase() === archiveShift.toLowerCase());
    }
    if (archiveMachine && archiveMachine !== 'All') {
      filtered = filtered.filter(l => (l.machineName || '').toLowerCase() === archiveMachine.toLowerCase());
    }
    if (archiveOperator && archiveOperator !== 'All') {
      filtered = filtered.filter(l => (l.operatorName || '').toLowerCase() === archiveOperator.toLowerCase());
    }
    if (archiveSearch && archiveSearch.trim()) {
      filtered = filtered.filter(l => matchSearchQuery(l, archiveSearch, ['jobNo', 'machineName', 'operatorName', 'notes', 'pass', 'shift']));
    }

    const groupsMap = {};
    filtered.forEach(log => {
      let dStr = '';
      if (log.date) {
        dStr = toLocalYMD(log.date);
      } else if (log.created_date_time || log.createdAt) {
        dStr = toLocalYMD(log.created_date_time || log.createdAt);
      } else {
        dStr = toLocalYMD();
      }

      const shiftStr = log.shift || 'Morning';
      const key = archiveGroupBy === 'shift' ? `${dStr}__${shiftStr}` : dStr;

      if (!groupsMap[key]) {
        groupsMap[key] = {
          key,
          date: dStr,
          shift: archiveGroupBy === 'shift' ? shiftStr : 'All Shifts',
          logs: [],
          totalMeters: 0,
          uniqueJobs: new Set(),
          machines: new Set(),
          operators: new Set(),
          passes: new Set()
        };
      }

      groupsMap[key].logs.push(log);
      groupsMap[key].totalMeters += Number(log.meters) || 0;
      if (log.jobNo) groupsMap[key].uniqueJobs.add(log.jobNo);
      if (log.machineName) groupsMap[key].machines.add(log.machineName);
      if (log.operatorName) groupsMap[key].operators.add(log.operatorName);
      if (log.pass) groupsMap[key].passes.add(log.pass);
    });

    return Object.values(groupsMap).sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      if (a.shift === 'Night' && b.shift === 'Morning') return -1;
      if (a.shift === 'Morning' && b.shift === 'Night') return 1;
      return 0;
    });
  }, [archiveLogs, archiveShift, archiveMachine, archiveOperator, archiveSearch, archiveGroupBy]);

  // Aggregate KPI stats for archive
  const archiveKpis = useMemo(() => {
    let totalMeters = 0;
    const uniqueJobs = new Set();
    const activeMachines = new Set();
    const activeOperators = new Set();
    let morningMtr = 0;
    let nightMtr = 0;

    archiveGroups.forEach(g => {
      totalMeters += g.totalMeters;
      g.uniqueJobs.forEach(j => uniqueJobs.add(j));
      g.machines.forEach(m => activeMachines.add(m));
      g.operators.forEach(o => activeOperators.add(o));
      if (g.shift === 'Morning') morningMtr += g.totalMeters;
      else if (g.shift === 'Night') nightMtr += g.totalMeters;
    });

    return {
      totalMeters,
      totalGroups: archiveGroups.length,
      jobCount: uniqueJobs.size,
      machineCount: activeMachines.size,
      operatorCount: activeOperators.size,
      morningMtr,
      nightMtr
    };
  }, [archiveGroups]);

  // Open Interactive Preview Report Modal
  const handleOpenPreviewReport = async (cfg = {}) => {
    const targetStart = cfg.dateStart || dateStart;
    const targetEnd = cfg.dateEnd || dateEnd;
    const targetShift = cfg.shift || 'All Shifts';

    let repLogs = cfg.logs;
    if (!repLogs || repLogs.length === 0) {
      try {
        const queryParams = {
          dateStart: targetStart,
          dateEnd: targetEnd,
          limit: 1000
        };
        if (targetShift && targetShift !== 'All' && targetShift !== 'All Shifts') {
          queryParams.shift = targetShift;
        }
        if (cfg.machine && cfg.machine !== 'All' && cfg.machine !== 'All Machines') {
          queryParams.machineName = cfg.machine;
        }
        if (cfg.operator && cfg.operator !== 'All' && cfg.operator !== 'All Operators') {
          queryParams.operatorName = cfg.operator;
        }
        const res = await api.getJobPrintLogs(queryParams);
        repLogs = (res && res.data && Array.isArray(res.data)) ? res.data : logs;
      } catch (e) {
        repLogs = logs;
      }
    }

    // Fetch raw material summary for target range
    let rawSumm = null;
    try {
      const rmRes = await api.getRawMaterialTransactions({
        dateStart: targetStart,
        dateEnd: targetEnd
      });
      if (rmRes && rmRes.data && Array.isArray(rmRes.data)) {
        rawSumm = parseRawTransactionsForSummary(rmRes.data, targetStart, targetEnd);
      }
    } catch (e) {
      rawSumm = rawMaterialSummary;
    }

    setPreviewReportConfig({
      dateStart: targetStart,
      dateEnd: targetEnd,
      shift: targetShift,
      machine: cfg.machine || 'All Machines',
      operator: cfg.operator || 'All Operators',
      pass: cfg.pass || 'All Passes',
      logs: repLogs || [],
      rawSummary: rawSumm || rawMaterialSummary
    });
    setShowPreviewModal(true);
  };

  // Export specific group logs to CSV
  const handleExportGroupCSV = (groupLogs, fileName) => {
    if (!groupLogs || groupLogs.length === 0) return;
    const headers = ['Date', 'Job No', 'Machine Name', 'Pass', 'Meters Printed', 'Operator', 'Shift', 'Notes'];
    const rows = groupLogs.map(l => [
      formatDateDDMMYYYY(l.date || l.created_date_time),
      l.jobNo,
      `"${l.machineName || ''}"`,
      `"${l.pass || ''}"`,
      l.meters || 0,
      `"${l.operatorName || ''}"`,
      l.shift || '',
      `"${l.notes || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', fileName || `Printing_Report_${toLocalYMD()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printFilterCategories = useMemo(() => [
    {
      id: 'machine',
      name: 'Machine Name',
      multi: true,
      options: (machinesList || []).map(m => ({ value: m, label: m }))
    },
    {
      id: 'operator',
      name: 'Operator',
      multi: true,
      options: (operatorsList && operatorsList.length > 0
        ? operatorsList
        : Array.from(new Set(logs.map(l => l.operatorName).filter(Boolean)))
      ).map(o => ({ value: o, label: o }))
    },
    {
      id: 'shift',
      name: 'Shift',
      multi: true,
      options: [
        { value: 'Morning', label: 'Morning Shift' },
        { value: 'Night', label: 'Night Shift' },
        { value: 'Day', label: 'Day Shift' }
      ]
    },
    {
      id: 'pass',
      name: 'Print Pass',
      multi: true,
      options: [
        { value: '2 Pass', label: '2 Pass' },
        { value: '4 Pass', label: '4 Pass' },
        { value: '6 Pass', label: '6 Pass' },
        { value: '8 Pass', label: '8 Pass' }
      ]
    }
  ], [machinesList, operatorsList, logs]);

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
        await fetchLogs();
        await fetchJobCards();
        triggerGlobalDataRefresh('jobcards');
      } else {
        await api.createJobPrintLog(payload);
        triggerPushNotification('🖨️ Print Run Logged', `Logged ${form.meters} mtr for Job #${form.jobNo} on ${form.machineName} (${form.shift} Shift)`, 'success');
        const targetDate = form.date || toLocalYMD();
        setDateStart(targetDate);
        setDateEnd(targetDate);
        await fetchLogs(targetDate, targetDate);
        await fetchJobCards();
        triggerGlobalDataRefresh('jobcards');
      }

      // Clear meters & notes for next log entry, but keep selected job card & machine
      setForm(prev => ({
        ...prev,
        meters: '',
        notes: ''
      }));

      if (viewingJobHistory && viewingJobHistory.jobNo === form.jobNo) {
        loadJobCardHistory(form.jobNo);
      }
    } catch (err) {
      alert(err.message || 'Failed to save print entry.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Dedicated Edit Modal for table row
  const handleOpenEditModal = (log) => {
    const matched = findMatchingJob(log.jobNo) || findMatchingJob(log.jobCardId);
    setEditModalLog({
      _id: log._id,
      jobNo: log.jobNo || '',
      jobCardId: log.jobCardId || (matched ? matched._id : ''),
      machineName: log.machineName || machinesList[0] || 'GRANDO',
      pass: log.pass || '1 PASS',
      meters: log.meters !== undefined && log.meters !== null ? String(log.meters) : '',
      date: formatForInputDate(log.date || log.created_date_time) || toLocalYMD(),
      shift: log.shift || 'Morning',
      operatorName: log.operatorName || '',
      notes: log.notes || '',
      matchedJob: matched
    });
  };

  // Save changes from Dedicated Edit Modal
  const handleSaveEditModal = async (e) => {
    e.preventDefault();
    if (!editModalLog) return;
    if (!editModalLog.meters || parseFloat(editModalLog.meters) <= 0) {
      triggerEliteAlert('Validation Error', 'Please enter a valid meter quantity greater than 0.', 'warning');
      return;
    }
    if (!editModalLog.machineName) {
      triggerEliteAlert('Validation Error', 'Please select or enter a printing machine.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...editModalLog,
        meters: parseFloat(editModalLog.meters)
      };

      await api.updateJobPrintLog(editModalLog._id, payload);
      triggerPushNotification('✏️ Print Log Updated', `Updated Job #${editModalLog.jobNo} (${editModalLog.meters} mtr) on ${editModalLog.machineName}`, 'success');

      const updatedJobNo = editModalLog.jobNo;
      const updatedCardId = editModalLog.jobCardId;
      setEditModalLog(null);

      // Preserve active filters & reload data in-place
      await fetchLogs();
      await fetchJobCards();
      triggerGlobalDataRefresh('jobcards');

      if (viewingJobHistory && (viewingJobHistory.jobNo === updatedJobNo || viewingJobHistory._id === updatedCardId)) {
        loadJobCardHistory(updatedJobNo);
      }
    } catch (err) {
      triggerEliteAlert('Update Failed', err.message || 'Failed to update print log entry.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Start Editing a Log Entry in top form
  const handleStartEdit = (log) => {
    setActiveView('log');
    setEditingLogId(log._id);
    const matched = findMatchingJob(log.jobNo) || findMatchingJob(log.jobCardId);
    if (matched) setSelectedJob(matched);

    const parsedDate = formatForInputDate(log.date || log.created_date_time) || toLocalYMD();

    setForm({
      jobNo: log.jobNo || '',
      jobCardId: log.jobCardId || (matched ? matched._id : ''),
      machineName: log.machineName || machinesList[0] || 'GRANDO',
      pass: log.pass || '1 PASS',
      meters: log.meters !== undefined && log.meters !== null ? String(log.meters) : '',
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
      machineName: machinesList[0] || 'GRANDO',
      pass: '1 PASS',
      meters: '',
      date: toLocalYMD(),
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

  // ── Print Efficiency & Consumable Consumption Metrics ──
  const printMetrics = useMemo(() => {
    let totalMtr = 0;
    let morningMtr = 0;
    let nightMtr = 0;
    const operatorMap = {};
    const machineMap = {};

    logs.forEach(l => {
      const m = Number(l.meters) || 0;
      totalMtr += m;
      if (l.shift === 'Morning') morningMtr += m;
      else if (l.shift === 'Night') nightMtr += m;

      const op = l.operatorName || 'Standard Operator';
      operatorMap[op] = (operatorMap[op] || 0) + m;

      const mach = l.machineName || 'Machine 1';
      machineMap[mach] = (machineMap[mach] || 0) + m;
    });

    // Sublimation Ink consumption: industry standard 16 ml / meter
    const effectiveTotalMtr = (serverKpis && serverKpis.totalMeters !== undefined && serverKpis.totalMeters > 0)
      ? serverKpis.totalMeters
      : totalMtr;
    const effectiveMorningMtr = (serverKpis && serverKpis.morningMeters !== undefined && serverKpis.morningMeters > 0)
      ? serverKpis.morningMeters
      : morningMtr;
    const effectiveNightMtr = (serverKpis && serverKpis.nightMeters !== undefined && serverKpis.nightMeters > 0)
      ? serverKpis.nightMeters
      : nightMtr;

    const estimatedInkLiters = (effectiveTotalMtr * 0.016).toFixed(1);
    // Sublimation Paper: approx 1.45 sq. meters per running meter (58" width)
    const estimatedPaperSqM = (effectiveTotalMtr * 1.45).toFixed(1);

    const topOperator = Object.entries(operatorMap).sort((a, b) => b[1] - a[1])[0] || ['—', 0];
    const topMachine = Object.entries(machineMap).sort((a, b) => b[1] - a[1])[0] || ['—', 0];

    return {
      totalMtr: effectiveTotalMtr,
      morningMtr: effectiveMorningMtr,
      nightMtr: effectiveNightMtr,
      estimatedInkLiters,
      estimatedPaperSqM,
      topOperator: { name: topOperator[0], mtr: topOperator[1] },
      topMachine: { name: topMachine[0], mtr: topMachine[1] }
    };
  }, [logs, serverKpis]);

  // ── Live Machine Fleet Output & Status ──
  const machineFleetStats = useMemo(() => {
    const today = toLocalYMD();
    const stats = {};
    machinesList.forEach(m => {
      stats[m] = { totalMtr: 0, todayMtr: 0, morningMtr: 0, nightMtr: 0, lastJob: null, count: 0 };
    });

    logs.forEach(l => {
      const mach = l.machineName || 'Machine 1';
      if (!stats[mach]) {
        stats[mach] = { totalMtr: 0, todayMtr: 0, morningMtr: 0, nightMtr: 0, lastJob: null, count: 0 };
      }
      const m = Number(l.meters) || 0;
      stats[mach].totalMtr += m;
      stats[mach].count += 1;
      if (l.date === today) {
        stats[mach].todayMtr += m;
      }
      if (l.shift === 'Morning') stats[mach].morningMtr += m;
      else if (l.shift === 'Night') stats[mach].nightMtr += m;
      if (!stats[mach].lastJob && l.jobNo) {
        stats[mach].lastJob = l.jobNo;
      }
    });

    return stats;
  }, [logs, machinesList]);

  // ── Pending Job Cards for Machine Queue & Batch Scheduling ──
  const printQueueJobs = useMemo(() => {
    return jobCards.filter(jc => {
      // Must not be fully printed
      const isPrinted = jc.printStatus === 'Printing Done';
      if (isPrinted) return false;

      if (queueFabricFilter !== 'All' && (jc.fabric || '') !== queueFabricFilter) return false;
      if (queueSearch) {
        const q = queueSearch.toLowerCase();
        const jNo = String(jc.jobNo || '').toLowerCase();
        const dName = String(jc.designName || jc.designNo || '').toLowerCase();
        const party = String(jc.party || '').toLowerCase();
        if (!jNo.includes(q) && !dName.includes(q) && !party.includes(q)) return false;
      }
      return true;
    });
  }, [jobCards, queueFabricFilter, queueSearch]);

  const queueFabricsList = useMemo(() => {
    const set = new Set();
    jobCards.forEach(jc => {
      if (jc.printStatus !== 'Printing Done' && jc.fabric) set.add(jc.fabric);
    });
    return Array.from(set).sort();
  }, [jobCards]);

  // One-Click Quick Print Action
  const handleQuickLogJob = async (job) => {
    const targetStr = job.totalMtr || job.consumption || '0';
    const targetMatch = String(targetStr).match(/[\d.]+/);
    const targetMtr = targetMatch ? parseFloat(targetMatch[0]) : 0;
    const printedMtr = parseFloat(String(job.printMtr || '0').replace(/[^\d.]/g, '')) || 0;
    const remainingMtr = Math.max(0, targetMtr - printedMtr) || targetMtr || 10;

    const confirmed = window.confirm(`Quick Complete Printing for Job #${job.jobNo}?\n\nTarget: ${targetMtr} mtr\nRemaining to Log: ${remainingMtr.toFixed(2)} mtr\nMachine: ${machinesList[0] || 'Machine 1 (Grando)'}\nOperator: ${accountFullName || 'Operator'}`);
    if (!confirmed) return;

    setSubmitting(true);
    try {
      await api.createJobPrintLog({
        jobCardId: job._id,
        jobNo: job.jobNo,
        machineName: machinesList[0] || 'Machine 1 (Grando)',
        pass: job.pass || '4 PASS',
        meters: remainingMtr,
        date: toLocalYMD(),
        operatorName: accountFullName || 'Operator',
        shift: getAutoShift(),
        notes: 'Quick Completed via Print Queue Dashboard'
      });

      triggerPushNotification('⚡ Quick Print Completed', `Job #${job.jobNo} (${remainingMtr.toFixed(2)} mtr) logged and marked Printing Done!`, 'success');
      await fetchJobCards();
      await fetchLogs(dateStart, dateEnd);
      triggerGlobalDataRefresh('jobcards');
    } catch (err) {
      alert(err.message || 'Failed to quick log job.');
    } finally {
      setSubmitting(false);
    }
  };

  // Switch to Entry Form with Selected Queued Job
  const handleSelectJobForForm = (job) => {
    setSelectedJob(job);
    const targetStr = job.totalMtr || job.consumption || '0';
    const targetMatch = String(targetStr).match(/[\d.]+/);
    const targetMtr = targetMatch ? parseFloat(targetMatch[0]) : 0;
    const printedMtr = parseFloat(String(job.printMtr || '0').replace(/[^\d.]/g, '')) || 0;
    const remainingMtr = Math.max(0, targetMtr - printedMtr) || targetMtr || '';

    setForm(prev => ({
      ...prev,
      jobNo: job.jobNo || '',
      jobCardId: job._id || '',
      meters: remainingMtr ? String(remainingMtr) : '',
      pass: job.pass || prev.pass
    }));
    setActiveView('log');
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

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
          <button
            type="button"
            onClick={() => {
              setActiveView('reports');
              fetchArchiveLogs(archiveDateStart, archiveDateEnd);
            }}
            className="btn-secondary"
            style={{
              padding: '0.55rem 1.1rem',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: '1px solid rgba(168,85,247,0.4)',
              background: 'rgba(168,85,247,0.1)',
              color: '#c084fc',
              fontWeight: 700
            }}
          >
            <History size={15} /> Previous Reports
          </button>

          <button
            type="button"
            onClick={() => {
              setReportStartDate(dateStart);
              setReportEndDate(dateEnd);
              setShowReportModal(true);
            }}
            className="btn-primary"
            style={{
              padding: '0.55rem 1.1rem',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)',
              fontWeight: 700
            }}
          >
            <FileText size={15} /> Download Report
          </button>

          {/* Export CSV */}
          <button onClick={handleExportCSV} className="btn-secondary" style={{ padding: '0.55rem 1.1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* ── 1.1 CONSUMABLES & SHIFT EFFICIENCY BAR ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
        {/* Metric 1: Total Meters & Shift Ratio */}
        <div className="glass-panel" style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '4px solid #38bdf8' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(56,189,248,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={18} color="#38bdf8" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Output (Logged)</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>{printMetrics.totalMtr.toFixed(1)} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>mtr</span></div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
              ☀️ Day: <strong style={{ color: '#38bdf8' }}>{printMetrics.morningMtr.toFixed(0)}m</strong> | 🌙 Night: <strong style={{ color: '#a78bfa' }}>{printMetrics.nightMtr.toFixed(0)}m</strong>
            </div>
          </div>
        </div>

        {/* Metric 2: Sublimation Ink Consumption Estimate */}
        <div className="glass-panel" style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '4px solid #ec4899' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(236,72,153,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Droplets size={18} color="#ec4899" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Est. Ink Consumed</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ec4899' }}>{printMetrics.estimatedInkLiters} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Liters</span></div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
              Avg. 16 ml / printed meter
            </div>
          </div>
        </div>

        {/* Metric 3: Sublimation Paper Consumption Estimate */}
        <div className="glass-panel" style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers3 size={18} color="#f59e0b" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Est. Paper Used</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f59e0b' }}>{printMetrics.estimatedPaperSqM} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>sq. mtr</span></div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
              Approx. {(Number(printMetrics.estimatedPaperSqM) / 100).toFixed(1)} rolls used
            </div>
          </div>
        </div>

        {/* Metric 4: Top Machine & Operator */}
        <div className="glass-panel" style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={18} color="#10b981" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Top Machine</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
              {printMetrics.topMachine.name}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#10b981', marginTop: 2 }}>
              {printMetrics.topMachine.mtr.toFixed(0)}m logged • {printMetrics.topOperator.name}
            </div>
          </div>
        </div>
      </div>

      {/* ── 1.2 VIEW SWITCHER NAVIGATION TABS ── */}
      <div style={{ display: 'flex', gap: '0.6rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.4rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setActiveView('log')}
          style={{
            padding: '0.55rem 1.1rem',
            borderRadius: '8px',
            fontSize: '0.84rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: activeView === 'log' ? '1px solid #38bdf8' : '1px solid transparent',
            background: activeView === 'log' ? 'rgba(56,189,248,0.15)' : 'transparent',
            color: activeView === 'log' ? '#38bdf8' : 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <Printer size={15} /> Print Runs Log
        </button>

        <button
          type="button"
          onClick={() => setActiveView('queue')}
          style={{
            padding: '0.55rem 1.1rem',
            borderRadius: '8px',
            fontSize: '0.84rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: activeView === 'queue' ? '1px solid #f59e0b' : '1px solid transparent',
            background: activeView === 'queue' ? 'rgba(245,158,11,0.15)' : 'transparent',
            color: activeView === 'queue' ? '#f59e0b' : 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <Zap size={15} /> Machine Queue & Batch Scheduling
          <span style={{
            marginLeft: 4,
            padding: '0.1rem 0.45rem',
            borderRadius: '999px',
            background: activeView === 'queue' ? '#f59e0b' : 'rgba(255,255,255,0.1)',
            color: activeView === 'queue' ? '#000' : 'var(--text-muted)',
            fontSize: '0.72rem',
            fontWeight: 800
          }}>
            {printQueueJobs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('fleet')}
          style={{
            padding: '0.55rem 1.1rem',
            borderRadius: '8px',
            fontSize: '0.84rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: activeView === 'fleet' ? '1px solid #10b981' : '1px solid transparent',
            background: activeView === 'fleet' ? 'rgba(16,185,129,0.15)' : 'transparent',
            color: activeView === 'fleet' ? '#10b981' : 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <Cpu size={15} /> Live Machine Fleet Monitor
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveView('reports');
            fetchArchiveLogs(archiveDateStart, archiveDateEnd);
          }}
          style={{
            padding: '0.55rem 1.1rem',
            borderRadius: '8px',
            fontSize: '0.84rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: activeView === 'reports' ? '1px solid #a855f7' : '1px solid transparent',
            background: activeView === 'reports' ? 'rgba(168,85,247,0.18)' : 'transparent',
            color: activeView === 'reports' ? '#c084fc' : 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <History size={15} /> Previous Reports & Archives
          <span style={{
            marginLeft: 4,
            padding: '0.1rem 0.45rem',
            borderRadius: '999px',
            background: activeView === 'reports' ? '#a855f7' : 'rgba(255,255,255,0.1)',
            color: activeView === 'reports' ? '#fff' : 'var(--text-muted)',
            fontSize: '0.72rem',
            fontWeight: 800
          }}>
            {archiveGroups.length}
          </span>
        </button>
      </div>

      {/* ── FLEET VIEW (When activeView === 'fleet') ── */}
      {activeView === 'fleet' && (
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 900, color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={20} /> Digital Printer Fleet Performance Monitor
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Live daily status, shift output, and quick print log assignment for all active printing machinery.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '4px 10px', borderRadius: '6px' }}>
                🟢 {machinesList.filter(m => (machineFleetStats[m]?.todayMtr || 0) > 0).length} of {machinesList.length} Active Today
              </span>
            </div>
          </div>

          {/* Fleet Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {machinesList.map(mach => {
              const mStats = machineFleetStats[mach] || { totalMtr: 0, todayMtr: 0, morningMtr: 0, nightMtr: 0, lastJob: null, count: 0 };
              const isActiveToday = mStats.todayMtr > 0;
              return (
                <div
                  key={mach}
                  className="glass-panel"
                  style={{
                    padding: '1.1rem',
                    borderRadius: '12px',
                    border: isActiveToday ? '2px solid rgba(16,185,129,0.4)' : '1px solid var(--border-light)',
                    background: isActiveToday ? 'rgba(16,185,129,0.04)' : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.85rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '0.98rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Printer size={16} color={isActiveToday ? '#10b981' : '#94a3b8'} />
                        {mach}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {mStats.count} total print runs recorded
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: isActiveToday ? '#dcfce7' : 'rgba(255,255,255,0.08)',
                      color: isActiveToday ? '#15803d' : 'var(--text-muted)',
                      border: isActiveToday ? '1px solid #86efac' : '1px solid transparent'
                    }}>
                      {isActiveToday ? '🟢 Running Today' : '⚪ Standby / Idle'}
                    </span>
                  </div>

                  {/* Output KPIs */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Today Output</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 900, color: isActiveToday ? '#10b981' : 'var(--text-muted)', marginTop: 2 }}>
                        {mStats.todayMtr.toFixed(1)} <span style={{ fontSize: '0.7rem' }}>m</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Period</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#38bdf8', marginTop: 2 }}>
                        {mStats.totalMtr.toFixed(1)} <span style={{ fontSize: '0.7rem' }}>m</span>
                      </div>
                    </div>
                  </div>

                  {/* Shift split & Last job */}
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>☀️ Day: <strong style={{ color: '#38bdf8' }}>{mStats.morningMtr.toFixed(0)}m</strong> | 🌙 Night: <strong style={{ color: '#a78bfa' }}>{mStats.nightMtr.toFixed(0)}m</strong></span>
                    {mStats.lastJob && <span>Last: <strong>#{mStats.lastJob}</strong></span>}
                  </div>

                  {/* Quick actions */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setForm(f => ({ ...f, machineName: mach }));
                        setActiveView('log');
                        window.scrollTo({ top: 120, behavior: 'smooth' });
                      }}
                      style={{
                        flex: 1,
                        padding: '0.4rem',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        borderRadius: '6px',
                        border: '1px solid rgba(56,189,248,0.3)',
                        background: 'rgba(56,189,248,0.1)',
                        color: '#38bdf8',
                        cursor: 'pointer'
                      }}
                    >
                      ⚡ Assign in Form
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterMachine(mach);
                        setActiveView('log');
                      }}
                      style={{
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        borderRadius: '6px',
                        border: '1px solid var(--border-light)',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      Filter
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── BATCH QUEUE VIEW (When activeView === 'queue') ── */}
      {activeView === 'queue' && (
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={18} /> Digital Print Batch Queue & Roll Optimization
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Batch identical fabrics together to prevent roll change downtime. Use Quick Complete for fast 1-click execution.
              </p>
            </div>

            {/* Queue Filter Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: 220 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={queueSearch}
                  onChange={e => setQueueSearch(e.target.value)}
                  placeholder="Filter queue by job/party..."
                  style={{ paddingLeft: 30, width: '100%', fontSize: '0.82rem', borderRadius: 6 }}
                />
              </div>

              <select
                value={queueFabricFilter}
                onChange={e => setQueueFabricFilter(e.target.value)}
                style={{ padding: '0.45rem 0.75rem', fontSize: '0.82rem', background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: 6, color: 'var(--text-primary)' }}
              >
                <option value="All">All Fabrics ({printQueueJobs.length})</option>
                {queueFabricsList.map(fab => (
                  <option key={fab} value={fab}>{fab}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Queue Table */}
          <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border-light)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-light)' }}>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Priority</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Job No.</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Party</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Design</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Fabric (Batching)</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Panna & Pass</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>Target</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>Printed</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>Remaining</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {printQueueJobs.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      🎉 Great job! No pending printing jobs in this queue filter.
                    </td>
                  </tr>
                ) : (
                  printQueueJobs.map(job => {
                    const targetStr = job.totalMtr || job.consumption || '0';
                    const targetMatch = String(targetStr).match(/[\d.]+/);
                    const targetMtr = targetMatch ? parseFloat(targetMatch[0]) : 0;
                    const printedMtr = parseFloat(String(job.printMtr || '0').replace(/[^\d.]/g, '')) || 0;
                    const remainingMtr = Math.max(0, targetMtr - printedMtr);
                    const isClientOrder = String(job.createdBy || job.createdByName || '').toLowerCase().includes('client');

                    return (
                      <tr key={job._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        {/* Priority Badge */}
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          {isClientOrder ? (
                            <span style={{ padding: '0.15rem 0.45rem', borderRadius: 4, background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.72rem', fontWeight: 800 }}>
                              ⚡ Online Urgent
                            </span>
                          ) : (
                            <span style={{ padding: '0.15rem 0.45rem', borderRadius: 4, background: 'rgba(148,163,184,0.12)', color: '#94a3b8', fontSize: '0.72rem' }}>
                              Normal
                            </span>
                          )}
                        </td>

                        {/* Job No */}
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 800, color: '#38bdf8' }}>
                          #{job.jobNo}
                        </td>

                        {/* Party */}
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {job.party || 'Standard Client'}
                        </td>

                        {/* Design */}
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                            {cleanDesignNameString(job.designName || job.designNo || '—')}
                          </span>
                        </td>

                        {/* Fabric (Batch tag) */}
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ padding: '0.2rem 0.55rem', borderRadius: 6, background: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.25)', fontWeight: 700, fontSize: '0.76rem' }}>
                            {job.fabric || 'FRENCH CREP'}
                          </span>
                        </td>

                        {/* Panna & Pass */}
                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-muted)' }}>
                          {job.panna || '58"'} • {job.pass || '4 PASS'}
                        </td>

                        {/* Target Mtr */}
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 600 }}>
                          {targetMtr.toFixed(1)}m
                        </td>

                        {/* Printed Mtr */}
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: '#38bdf8' }}>
                          {printedMtr.toFixed(1)}m
                        </td>

                        {/* Remaining Mtr */}
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 800, color: remainingMtr > 0 ? '#ef4444' : '#10b981' }}>
                          {remainingMtr.toFixed(1)}m
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                            <button
                              type="button"
                              onClick={() => handleQuickLogJob(job)}
                              disabled={submitting}
                              style={{
                                padding: '0.3rem 0.65rem',
                                borderRadius: 6,
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: '#ffffff',
                                border: 'none',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                                boxShadow: '0 2px 6px rgba(16,185,129,0.25)'
                              }}
                              title="Quick Log full remaining meters as printed"
                            >
                              <Zap size={13} /> Quick Done
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSelectJobForForm(job)}
                              style={{
                                padding: '0.3rem 0.6rem',
                                borderRadius: 6,
                                background: 'rgba(56,189,248,0.1)',
                                color: '#38bdf8',
                                border: '1px solid rgba(56,189,248,0.25)',
                                fontSize: '0.74rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                              title="Load job into custom print run form"
                            >
                              Custom
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 2. NEW PRINTING ENTRY FORM (Visible when activeView === 'log') ── */}
      {activeView === 'log' && (
        <>
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
              {/* Consolidated Reports & Actions Dropdown */}
              <div ref={reportsDropdownRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowReportsDropdown(prev => !prev)}
                  className="btn-primary"
                  style={{
                    padding: '0.4rem 0.85rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)',
                    cursor: 'pointer'
                  }}
                  title="Reports & Actions"
                >
                  <FileText size={14} />
                  <span>Reports & Actions</span>
                  <ChevronDown size={13} style={{ transform: showReportsDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>

                {showReportsDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 4px)',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                      zIndex: 100,
                      minWidth: '220px',
                      padding: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setShowReportsDropdown(false);
                        setShowRawMaterialModal(true);
                      }}
                      style={{
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#059669',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f0fdf4'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <Sparkles size={14} /> Generate Consumption Report
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowReportsDropdown(false);
                        setActiveView('reports');
                        fetchArchiveLogs(archiveDateStart, archiveDateEnd);
                      }}
                      style={{
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#7c3aed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f3ff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <History size={14} /> Previous Reports & Archives
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowReportsDropdown(false);
                        setReportStartDate(dateStart);
                        setReportEndDate(dateEnd);
                        setShowReportModal(true);
                      }}
                      style={{
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <Download size={14} /> Download Operator Report
                    </button>
                  </div>
                )}
              </div>

              {/* Form Collapse / Expand Toggle */}
              <button
                type="button"
                onClick={() => setIsFormCollapsed(prev => !prev)}
                className="btn-secondary"
                style={{
                  padding: '0.4rem 0.65rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
                title={isFormCollapsed ? 'Expand Form' : 'Collapse Form'}
              >
                {isFormCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                <span>{isFormCollapsed ? 'Expand Entry Form' : 'Collapse'}</span>
              </button>
            </div>
          </div>

          {!isFormCollapsed && (
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
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                      zIndex: 1000,
                      marginTop: '4px'
                    }}
                  >
                    <div style={{ padding: '6px 12px', fontSize: '0.68rem', fontWeight: 800, color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
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
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            display: 'flex',
                            justify: 'space-between',
                            alignItems: 'center',
                            transition: 'background 0.15s ease'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div>
                            <div style={{ fontWeight: 800, color: '#0284c7', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>JobCard #{c.jobNo}</span>
                              {c.partyName && <span style={{ color: '#64748b', fontWeight: 500, fontSize: '0.78rem' }}>({c.partyName})</span>}
                            </div>
                            {c.designName && (
                              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: 1 }}>
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
                  {Array.from(new Set([...machinesList, form.machineName, 'GRANDO', 'PRINTDOT'])).filter(Boolean).map(m => (
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '4px' }}>
                  <label style={labelStyle}>REMARKS / NOTES</label>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {['Nozzle Banding', 'Head Strike', 'Paper Wrinkle', 'Ink Drop', 'Color Mismatch'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, notes: f.notes ? `${f.notes}, [${tag}]` : `[${tag}]` }))}
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-light)', borderRadius: '4px', padding: '1px 5px', fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer' }}
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
          )}

          {isFormCollapsed && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
              Form collapsed. Click <strong style={{ color: 'var(--text-primary)' }}>Expand Entry Form</strong> above to record a new print run.
            </div>
          )}
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
                <span style={{ color: 'var(--text-muted)' }}>Progress: <strong style={{ color: 'var(--text-primary)' }}>{selectedJobStats?.progressPct || 0}%</strong></span>
                <span style={{ color: selectedJobStats?.statusColor || 'var(--text-primary)' }}>{selectedJobStats?.statusText || ''}</span>
              </div>

              {/* Progress Line */}
              <div style={{ width: '100%', height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${selectedJobStats?.progressPct || 0}%`,
                    height: '100%',
                    background: selectedJobStats?.statusColor || '#38bdf8',
                    borderRadius: 5,
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
            </div>

            {/* Field Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.82rem' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Party:</span> <strong style={{ color: 'var(--text-primary)' }}>{selectedJob?.party || 'Standard Client'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Fabric:</span> <strong style={{ color: 'var(--text-primary)' }}>{selectedJob?.fabric || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Design:</span> <strong style={{ color: 'var(--primary)' }}>{cleanDesignNameString(selectedJob?.designName || selectedJob?.designNo || '') || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Panna:</span> <strong style={{ color: 'var(--text-primary)' }}>{selectedJob?.panna || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Target Mtr:</span> <strong style={{ color: '#f59e0b' }}>{(selectedJobStats?.targetMtr || 0).toFixed(2)} mtr</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Total Printed:</span> <strong style={{ color: '#38bdf8' }}>{(selectedJobStats?.printedMtr || 0).toFixed(2)} mtr</strong></div>
              <div style={{ gridColumn: 'span 2' }}><span style={{ color: 'var(--text-muted)' }}>Pending Remaining:</span> <strong style={{ color: (selectedJobStats?.remainingMtr || 0) > 0 ? '#ef4444' : '#10b981' }}>{(selectedJobStats?.remainingMtr || 0).toFixed(2)} mtr</strong></div>
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

          <UnifiedFilterPopover
            categories={printFilterCategories}
            activeFilters={printFilters}
            onChange={setPrintFilters}
            placeholder="Filters"
          />

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
        </div>

        {/* Logs Table (Desktop) or Card List (Mobile) */}
        {isMobileScreen ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {logs.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No machine print logs found for the selected date range.
              </div>
            ) : (
              logs
                .filter(log => matchSearchQuery(log, searchJob, ['jobNo', 'machineName', 'pass', 'operatorName', 'notes', 'shift']))
                .map(log => {
                  const jc = jobCards.find(c => String(c.jobNo) === String(log.jobNo));
                  const isReadyFusing = jc && (jc.printStatus === 'Printing Done' || jc.fusingStatus === 'Fusing Pending');
                  return (
                    <div
                      key={log._id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '8px',
                        padding: '0.85rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}
                    >
                      {/* Card Header: Job No, Ready badge, Action buttons */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            onClick={() => loadJobCardHistory(log.jobNo)}
                            style={{ background: 'none', border: 'none', color: '#38bdf8', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                          >
                            #{log.jobNo}
                          </button>
                          {isReadyFusing && (
                            <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                              🔥 Ready for Fusing
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          {!isOlderThan36Hours(log.created_date_time || log.createdAt || log.date) && (
                            <button
                              onClick={() => handleOpenEditModal(log)}
                              style={{ padding: '0.3rem', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', borderRadius: 4, cursor: 'pointer' }}
                              title="Edit"
                            >
                              <Edit2 size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => loadJobCardHistory(log.jobNo)}
                            style={{ padding: '0.3rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', borderRadius: 4, cursor: 'pointer' }}
                            title="History"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteLog(log._id, log.jobNo)}
                            style={{ padding: '0.3rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 4, cursor: 'pointer' }}
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Card Meta: Date & Shift */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>{formatDateTimeDDMMYYYY(log.date || log.created_date_time)}</span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: log.shift === 'Morning' ? 'rgba(56,189,248,0.1)' : 'rgba(167,139,250,0.1)', color: log.shift === 'Morning' ? '#38bdf8' : '#a78bfa' }}>
                          {log.shift || 'Morning'}
                        </span>
                      </div>

                      {/* Card Details: Machine, Pass, Meters, Operator */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: 'rgba(0,0,0,0.1)', padding: '0.5rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Machine / Pass</div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{log.machineName} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({log.pass})</span></div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Meters Printed</div>
                          <div style={{ fontWeight: 900, color: '#34d399', fontSize: '0.92rem' }}>{Number(log.meters).toFixed(2)} mtr</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Operator</div>
                          <div style={{ color: 'var(--text-primary)' }}>{log.operatorName || '—'}</div>
                        </div>
                        {log.notes && (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Remarks</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.notes}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.02)' }}>
                  {renderSortHeader('Date & Time', 'date')}
                  {renderSortHeader('Job No', 'jobNo')}
                  {renderSortHeader('Machine Name', 'machineName')}
                  <th style={thStyle}>Pass</th>
                  {renderSortHeader('Meters Printed', 'meters')}
                  {renderSortHeader('Operator', 'operatorName')}
                  {renderSortHeader('Shift', 'shift')}
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => loadJobCardHistory(log.jobNo)}
                              style={{ background: 'none', border: 'none', color: '#38bdf8', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              #{log.jobNo}
                            </button>
                            {(() => {
                              const jc = jobCards.find(c => String(c.jobNo) === String(log.jobNo));
                              if (jc && (jc.printStatus === 'Printing Done' || jc.fusingStatus === 'Fusing Pending')) {
                                return (
                                  <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }} title="Completed printing - ready for heat press">
                                    🔥 Ready for Fusing
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
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
                                onClick={() => handleOpenEditModal(log)}
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
        )}

        {/* Pagination Controls (D-P1 Fix) */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border-light)',
          fontSize: '0.8rem',
          color: 'var(--text-muted)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span>
              Showing {totalCount > 0 ? (currentPage - 1) * pageSize + 1 : (logs.length > 0 ? 1 : 0)} - {Math.min(currentPage * pageSize, totalCount || logs.length)} of {totalCount || logs.length} logs
            </span>
            {serverKpis && serverKpis.totalMeters > 0 && (
              <span style={{ fontWeight: 800, color: '#34d399', background: 'rgba(52,211,153,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                Total: {serverKpis.totalMeters.toFixed(2)} mtr
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.75rem' }}>Per Page:</label>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  background: 'var(--bg-input, #1e293b)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 4,
                  color: 'var(--text-primary)'
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1 || loading}
                style={{
                  padding: '0.3rem 0.55rem',
                  fontSize: '0.75rem',
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-light)',
                  color: currentPage <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
                }}
                title="First Page"
              >
                «
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage <= 1 || loading}
                style={{
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.75rem',
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-light)',
                  color: currentPage <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
                title="Previous Page"
              >
                <ChevronLeft size={13} /> Prev
              </button>

              <span style={{ padding: '0 0.5rem', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.78rem' }}>
                Page {currentPage} of {Math.max(1, totalPages)}
              </span>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages || loading}
                style={{
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.75rem',
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-light)',
                  color: currentPage >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
                title="Next Page"
              >
                Next <ChevronRight size={13} />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages || loading}
                style={{
                  padding: '0.3rem 0.55rem',
                  fontSize: '0.75rem',
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-light)',
                  color: currentPage >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                }}
                title="Last Page"
              >
                »
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ── 3B. RAW MATERIAL SUMMARY CARD (READ-ONLY DISPLAY TABLE ON SCREEN) ── */}
      <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: rawEntryType === 'INWARD' ? '4px solid #10b981' : '4px solid #f59e0b', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: rawEntryType === 'INWARD' ? '#34d399' : '#f59e0b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} /> Raw Material {rawEntryType === 'INWARD' ? 'Inward (Stock Received)' : 'Outward (Usage)'} Summary
            </div>

            <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(255,255,255,0.04)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
              <button
                type="button"
                onClick={() => setRawEntryType('OUTWARD')}
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
                onClick={() => setRawEntryType('INWARD')}
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
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                boxShadow: '0 3px 10px rgba(16, 185, 129, 0.3)',
                cursor: 'pointer'
              }}
            >
              <Edit size={14} /> Open Raw Material Entry Modal
            </button>
          )}
        </div>

        {(() => {
          const curSummary = rawEntryType === 'INWARD' ? rawMaterialSummary.inward : rawMaterialSummary.outward;
          const isOutward = rawEntryType === 'OUTWARD';
          const gInk = curSummary.grando || { C: 0, M: 0, Y: 0, K: 0 };
          const pInk = curSummary.printdot || { C: 0, M: 0, Y: 0, K: 0 };
          const dayG = curSummary.dayGrando || gInk;
          const dayP = curSummary.dayPrintdot || pInk;
          const nightG = curSummary.nightGrando || { C: 0, M: 0, Y: 0, K: 0 };
          const nightP = curSummary.nightPrintdot || { C: 0, M: 0, Y: 0, K: 0 };
          const paperList = curSummary.paper || [];

          const inkRows = isOutward ? [
            { label: 'GRANDO (DAY SHIFT)', color: '#38bdf8', data: dayG },
            { label: 'PRINTDOT (DAY SHIFT)', color: '#f87171', data: dayP },
            { label: 'GRANDO (NIGHT SHIFT)', color: '#818cf8', data: nightG },
            { label: 'PRINTDOT (NIGHT SHIFT)', color: '#fb7185', data: nightP },
          ] : [
            { label: 'GRANDO (INWARD)', color: '#38bdf8', data: gInk },
            { label: 'PRINTDOT (INWARD)', color: '#f87171', data: pInk },
          ];

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* ── Table 1: INK CONSUMPTION ── */}
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 900, color: '#38bdf8', letterSpacing: '0.04em', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  💧 {isOutward ? 'INK CONSUMPTION SUMMARY (LITERS)' : 'INK INWARD STOCK RECEIVED (LITERS)'}
                </div>
                <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1.5px solid var(--border-light)' }}>
                        <th style={{ padding: '0.55rem 0.75rem', textAlign: 'left', fontWeight: 800 }}>MACHINE / SHIFT</th>
                        <th style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#0284c7', width: 90 }}>C</th>
                        <th style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#ec4899', width: 90 }}>M</th>
                        <th style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#eab308', width: 90 }}>Y</th>
                        <th style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#94a3b8', width: 90 }}>K</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inkRows.map((row, rIdx) => (
                        <tr key={rIdx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '0.6rem 0.75rem', fontWeight: 800, color: row.color, fontSize: '0.78rem' }}>{row.label}</td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#38bdf8' }}>
                            {Number(row.data.C) > 0 ? `${Number(row.data.C).toFixed(2)} L` : '—'}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#f472b6' }}>
                            {Number(row.data.M) > 0 ? `${Number(row.data.M).toFixed(2)} L` : '—'}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#facc15' }}>
                            {Number(row.data.Y) > 0 ? `${Number(row.data.Y).toFixed(2)} L` : '—'}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#94a3b8' }}>
                            {Number(row.data.K) > 0 ? `${Number(row.data.K).toFixed(2)} L` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Table 2: PAPER CONSUMPTION ── */}
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 900, color: '#a78bfa', letterSpacing: '0.04em', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📜 {isOutward ? 'PAPER CONSUMPTION SUMMARY (ROLLS & METERS)' : 'PAPER INWARD STOCK RECEIVED (ROLLS & METERS)'}
                </div>
                <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1.5px solid var(--border-light)' }}>
                        <th style={{ padding: '0.55rem 0.75rem', textAlign: 'left', fontWeight: 800, width: 60 }}>#</th>
                        <th style={{ padding: '0.55rem 0.75rem', textAlign: 'left', fontWeight: 800 }}>PAPER TYPE</th>
                        <th style={{ padding: '0.55rem 0.75rem', textAlign: 'left', fontWeight: 800 }}>PANNA</th>
                        <th style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 800, width: 140 }}>ROLLS QTY</th>
                        <th style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 800, width: 140 }}>METERS (MTR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paperList.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: '0.8rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No paper entries recorded for this date range.
                          </td>
                        </tr>
                      ) : (
                        paperList.map((entry, idx) => (
                          <tr key={entry.id || idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '0.6rem 0.75rem', fontWeight: 800, color: '#a78bfa' }}>#{idx + 1}</td>
                            <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {entry.paperType || 'A++'}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {entry.paperPanna === 'Custom' ? (entry.paperCustomPanna || '—') : (entry.paperPanna || '—')}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 800, color: isOutward ? '#34d399' : '#10b981' }}>
                              {entry.paperRollsQty ? `${entry.paperRollsQty} Rolls` : '—'}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#38bdf8' }}>
                              {entry.paperMtrQty ? `${entry.paperMtrQty} m` : '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

        </div>
        );
      })()}
      </div>
      </>
      )}

      {/* ── 3. PREVIOUS REPORTS ARCHIVE VIEW (When activeView === 'reports') ── */}
      {activeView === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Section 1: Previous Reports Header Banner */}
          <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderLeft: '4px solid #a855f7' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(168,85,247,0.3)' }}>
                <History size={22} color="#fff" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Previous Production Reports & Historical Shift Archive
                </h2>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2, margin: 0 }}>
                  Browse, review, and print past shift reports, inspect operator meterage, and download official PDF statements.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setActiveView('log')}
                className="btn-secondary"
                style={{ padding: '0.55rem 1.1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={15} /> Back to Print Log
              </button>

              <button
                type="button"
                onClick={() => fetchArchiveLogs(archiveDateStart, archiveDateEnd)}
                className="btn-primary"
                style={{
                  padding: '0.55rem 1.1rem',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                  fontWeight: 700
                }}
              >
                <RefreshCw size={15} className={loadingArchive ? 'animate-spin' : ''} /> {loadingArchive ? 'Refreshing...' : 'Refresh Archive'}
              </button>
            </div>
          </div>

          {/* Section 2: Historical Archive KPI Highlights */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
            <div className="glass-panel" style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '4px solid #a855f7' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(168,85,247,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={18} color="#c084fc" />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Period Output</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#c084fc' }}>
                  {archiveKpis.totalMeters.toFixed(1)} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>mtr</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
                  ☀️ Day: <strong style={{ color: '#38bdf8' }}>{archiveKpis.morningMtr.toFixed(0)}m</strong> | 🌙 Night: <strong style={{ color: '#a78bfa' }}>{archiveKpis.nightMtr.toFixed(0)}m</strong>
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '4px solid #38bdf8' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(56,189,248,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={18} color="#38bdf8" />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Shifts / Reports Logged</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                  {archiveKpis.totalGroups} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>recorded shifts</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
                  Selected historical period
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '4px solid #10b981' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(16,185,129,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={18} color="#10b981" />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Unique Job Cards Processed</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981' }}>
                  {archiveKpis.jobCount} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Cards</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
                  Across all active shifts
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(245,158,11,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Cpu size={18} color="#f59e0b" />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Active Machinery & Crew</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                  {archiveKpis.machineCount} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Machines</span> • {archiveKpis.operatorCount} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Operators</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
                  Total active production crew
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Comprehensive Filter Toolbar */}
          <div className="glass-panel" style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
              {/* Presets */}
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#c084fc', textTransform: 'uppercase', marginRight: 4 }}>
                  QUICK PRESETS:
                </span>
                {[
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: 'today', label: 'Today' },
                  { id: 'last_3_days', label: 'Last 3 Days' },
                  { id: 'last_7_days', label: 'Last 7 Days' },
                  { id: 'this_month', label: 'This Month' },
                  { id: 'all', label: 'All Time' }
                ].map(p => {
                  const isActive = archivePreset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setArchivePreset(p.id);
                        if (p.id === 'last_3_days') {
                          const now = new Date();
                          const end = toLocalYMD(now);
                          const st = new Date(now);
                          st.setDate(st.getDate() - 2);
                          const start = toLocalYMD(st);
                          setArchiveDateStart(start);
                          setArchiveDateEnd(end);
                          fetchArchiveLogs(start, end);
                        } else {
                          const { dateStart: ds, dateEnd: de } = getDatePresetRange(p.id);
                          setArchiveDateStart(ds || '');
                          setArchiveDateEnd(de || '');
                          fetchArchiveLogs(ds || '', de || '');
                        }
                      }}
                      style={{
                        padding: '0.32rem 0.75rem',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        borderRadius: '6px',
                        border: isActive ? '1px solid #a855f7' : '1px solid var(--border-light)',
                        background: isActive ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.04)',
                        color: isActive ? '#c084fc' : 'var(--text-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Group By Selector */}
              <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(255,255,255,0.04)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                <button
                  type="button"
                  onClick={() => setArchiveGroupBy('shift')}
                  style={{
                    padding: '0.3rem 0.65rem',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    borderRadius: '5px',
                    border: 'none',
                    background: archiveGroupBy === 'shift' ? '#a855f7' : 'transparent',
                    color: archiveGroupBy === 'shift' ? '#ffffff' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  🌅 By Shift (Morning / Night)
                </button>
                <button
                  type="button"
                  onClick={() => setArchiveGroupBy('date')}
                  style={{
                    padding: '0.3rem 0.65rem',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    borderRadius: '5px',
                    border: 'none',
                    background: archiveGroupBy === 'date' ? '#38bdf8' : 'transparent',
                    color: archiveGroupBy === 'date' ? '#ffffff' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  📅 By Full Day
                </button>
              </div>
            </div>

            {/* Filter Dropdowns Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div>
                <label style={{ ...labelStyle, fontSize: '0.7rem', fontWeight: 800, color: '#38bdf8' }}>FROM DATE</label>
                <input
                  type="date"
                  value={archiveDateStart}
                  onChange={e => {
                    setArchiveDateStart(e.target.value);
                    setArchivePreset('custom');
                    fetchArchiveLogs(e.target.value, archiveDateEnd);
                  }}
                  style={{ ...inputStyle, padding: '0.5rem 0.7rem', fontSize: '0.8rem', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ ...labelStyle, fontSize: '0.7rem', fontWeight: 800, color: '#a78bfa' }}>TO DATE</label>
                <input
                  type="date"
                  value={archiveDateEnd}
                  onChange={e => {
                    setArchiveDateEnd(e.target.value);
                    setArchivePreset('custom');
                    fetchArchiveLogs(archiveDateStart, e.target.value);
                  }}
                  style={{ ...inputStyle, padding: '0.5rem 0.7rem', fontSize: '0.8rem', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ ...labelStyle, fontSize: '0.7rem', fontWeight: 800, color: '#f59e0b' }}>SHIFT FILTER</label>
                <select
                  value={archiveShift}
                  onChange={e => setArchiveShift(e.target.value)}
                  style={{ ...inputStyle, padding: '0.5rem 0.7rem', fontSize: '0.8rem', fontWeight: 700 }}
                >
                  <option value="All">All Shifts (Day & Night)</option>
                  <option value="Morning">Morning Shift Only</option>
                  <option value="Night">Night Shift Only</option>
                </select>
              </div>

              <div>
                <label style={{ ...labelStyle, fontSize: '0.7rem', fontWeight: 800, color: '#10b981' }}>MACHINE</label>
                <select
                  value={archiveMachine}
                  onChange={e => setArchiveMachine(e.target.value)}
                  style={{ ...inputStyle, padding: '0.5rem 0.7rem', fontSize: '0.8rem', fontWeight: 700 }}
                >
                  <option value="All">All Machines</option>
                  {machinesList.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ ...labelStyle, fontSize: '0.7rem', fontWeight: 800, color: '#ec4899' }}>OPERATOR</label>
                <select
                  value={archiveOperator}
                  onChange={e => setArchiveOperator(e.target.value)}
                  style={{ ...inputStyle, padding: '0.5rem 0.7rem', fontSize: '0.8rem', fontWeight: 700 }}
                >
                  <option value="All">All Operators</option>
                  {operatorsList.map(op => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ ...labelStyle, fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)' }}>SEARCH</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={archiveSearch}
                    onChange={e => setArchiveSearch(e.target.value)}
                    placeholder="Search Job No, operator..."
                    style={{ ...inputStyle, paddingLeft: 28, padding: '0.5rem 0.7rem 0.5rem 28px', fontSize: '0.8rem' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Previous Reports List / Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <History size={16} color="#a855f7" />
                Previous Reports ({archiveGroups.length} Shift Statements Available)
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Click <strong>Preview Report</strong> to review full details or <strong>Download PDF</strong> to save official statement.
              </span>
            </div>

            {loadingArchive ? (
              <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={26} className="animate-spin" style={{ margin: '0 auto 10px', color: '#a855f7' }} />
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Loading Historical Production Reports...</div>
                <div style={{ fontSize: '0.78rem', marginTop: 4 }}>Retrieving past machine logs and shift summaries</div>
              </div>
            ) : archiveGroups.length === 0 ? (
              <div className="glass-panel" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(168,85,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                  <History size={28} color="#c084fc" />
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  No Previous Reports Found
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: 440, margin: '0.5rem auto 1.25rem' }}>
                  No print run records match your selected date range ({archiveDateStart || 'all'} to {archiveDateEnd || 'all'}) and filter criteria.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const { dateStart: ds, dateEnd: de } = getDatePresetRange('last_30_days');
                      setArchivePreset('last_30_days');
                      setArchiveDateStart(ds || '');
                      setArchiveDateEnd(de || '');
                      fetchArchiveLogs(ds || '', de || '');
                    }}
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.45rem 1rem' }}
                  >
                    View Last 30 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setArchivePreset('all');
                      setArchiveDateStart('');
                      setArchiveDateEnd('');
                      fetchArchiveLogs('', '');
                    }}
                    className="btn-primary"
                    style={{ fontSize: '0.8rem', padding: '0.45rem 1rem', background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}
                  >
                    View All Historical Records
                  </button>
                </div>
              </div>
            ) : (
              archiveGroups.map(group => {
                const isExpanded = expandedArchiveKey === group.key;
                const isMorning = group.shift === 'Morning';
                const isNight = group.shift === 'Night';
                const accentColor = isMorning ? '#0284c7' : isNight ? '#a855f7' : '#10b981';

                return (
                  <div
                    key={group.key}
                    className="glass-panel"
                    style={{
                      padding: '1.15rem 1.25rem',
                      borderLeft: `5px solid ${accentColor}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem',
                      transition: 'all 0.2s ease',
                      background: isExpanded ? 'rgba(255,255,255,0.03)' : undefined
                    }}
                  >
                    {/* Top Row: Date, Shift, Output & Main Actions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                        {/* Calendar Day Icon */}
                        <div style={{
                          padding: '0.4rem 0.75rem',
                          borderRadius: '8px',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border-light)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <Calendar size={15} color={accentColor} />
                          <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {formatDateDDMMYYYY(group.date)}
                          </span>
                        </div>

                        {/* Shift Badge */}
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            padding: '3px 9px',
                            borderRadius: '6px',
                            background: isMorning ? 'rgba(2, 132, 199, 0.15)' : isNight ? 'rgba(168, 85, 247, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: isMorning ? '#38bdf8' : isNight ? '#c084fc' : '#34d399',
                            border: `1px solid ${isMorning ? 'rgba(2, 132, 199, 0.3)' : isNight ? 'rgba(168, 85, 247, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                          }}
                        >
                          {isMorning ? '☀️ Morning Shift (09:00 AM – 08:59 PM)' : isNight ? '🌙 Night Shift (09:00 PM – 08:59 AM)' : '📅 Full Day Summary'}
                        </span>
                      </div>

                      {/* Right: Large Output Badge & Action Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {/* Output Meter Badge */}
                        <div style={{
                          padding: '0.35rem 0.85rem',
                          borderRadius: '8px',
                          background: 'rgba(16, 185, 129, 0.12)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: '4px',
                          marginRight: 6
                        }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Printed:</span>
                          <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#10b981' }}>
                            {group.totalMeters.toFixed(2)}
                          </span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981' }}>mtr</span>
                        </div>

                        {/* 1. PREVIEW REPORT BUTTON */}
                        <button
                          type="button"
                          onClick={() => handleOpenPreviewReport({
                            dateStart: group.date,
                            dateEnd: group.date,
                            shift: group.shift,
                            logs: group.logs
                          })}
                          className="btn-primary"
                          style={{
                            padding: '0.45rem 0.95rem',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)',
                            cursor: 'pointer'
                          }}
                          title="Open Interactive On-Screen Report Preview"
                        >
                          <Eye size={14} /> Preview Report
                        </button>

                        {/* 2. PRINT DIALOG BUTTON */}
                        <button
                          type="button"
                          onClick={() => handlePrintOperatorReport(group.logs)}
                          className="btn-secondary"
                          style={{
                            padding: '0.45rem 0.85rem',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            cursor: 'pointer'
                          }}
                          title="Open Printable Layout in Browser"
                        >
                          <Printer size={14} /> Print
                        </button>

                        {/* 3. DOWNLOAD PDF BUTTON */}
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              let shiftTag = 'All_Shifts';
                              if (group.shift === 'Morning') shiftTag = 'Morning_Shift';
                              else if (group.shift === 'Night') shiftTag = 'Night_Shift';
                              const fileName = `Printing_Report_${shiftTag}_${group.date}.pdf`;

                              await api.downloadFabricCombinedReportPdf(
                                group.date,
                                group.date,
                                ['machine'],
                                fileName,
                                {
                                  shift: group.shift === 'All Shifts' ? '' : group.shift
                                }
                              );
                            } catch (err) {
                              alert(err.message || 'Failed to download report PDF.');
                            }
                          }}
                          className="btn-secondary"
                          style={{
                            padding: '0.45rem 0.85rem',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: 'rgba(168,85,247,0.1)',
                            border: '1px solid rgba(168,85,247,0.3)',
                            color: '#c084fc',
                            cursor: 'pointer'
                          }}
                          title="Download Official PDF Report"
                        >
                          <Download size={14} /> PDF
                        </button>

                        {/* 4. EXPORT CSV BUTTON */}
                        <button
                          type="button"
                          onClick={() => handleExportGroupCSV(group.logs, `Printing_Report_${group.date}_${group.shift || 'shift'}.csv`)}
                          className="btn-secondary"
                          style={{
                            padding: '0.45rem 0.75rem',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer'
                          }}
                          title="Export CSV data for this shift"
                        >
                          <FileSpreadsheet size={14} /> CSV
                        </button>

                        {/* 5. TOGGLE INLINE RUNS ACCORDION */}
                        <button
                          type="button"
                          onClick={() => setExpandedArchiveKey(isExpanded ? null : group.key)}
                          className="btn-icon"
                          style={{
                            padding: '0.45rem',
                            borderRadius: '6px',
                            background: isExpanded ? 'rgba(255,255,255,0.1)' : 'transparent',
                            color: isExpanded ? '#38bdf8' : 'var(--text-muted)'
                          }}
                          title={isExpanded ? 'Collapse Run Logs' : 'Expand Run Logs'}
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Middle Row: Quick Summary Stats Tags */}
                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.03)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                        <FileText size={13} color="#38bdf8" />
                        <strong>{group.uniqueJobs.size}</strong> Job Cards
                      </span>

                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.03)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                        <Cpu size={13} color="#10b981" />
                        Machines: <strong style={{ color: 'var(--text-primary)' }}>{Array.from(group.machines).join(', ') || 'Standard'}</strong>
                      </span>

                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.03)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                        <User size={13} color="#f59e0b" />
                        Operators: <strong style={{ color: 'var(--text-primary)' }}>{Array.from(group.operators).join(', ') || 'Operator'}</strong>
                      </span>

                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.03)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                        <Layers size={13} color="#a855f7" />
                        Passes: <strong style={{ color: 'var(--text-primary)' }}>{Array.from(group.passes).join(', ') || '1 PASS'}</strong>
                      </span>

                      <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {group.logs.length} individual run log entries recorded
                      </span>
                    </div>

                    {/* Expandable Inline Runs Table */}
                    {isExpanded && (
                      <div style={{ marginTop: '0.4rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', animation: 'fadeIn 0.15s ease' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Activity size={13} /> Complete Machine Run Entries for {formatDateDDMMYYYY(group.date)} ({group.shift})
                        </div>
                        <div style={{ overflowX: 'auto', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                            <thead>
                              <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-light)' }}>
                                <th style={{ padding: '6px 10px', fontWeight: 800, color: 'var(--text-muted)' }}>Time / Date</th>
                                <th style={{ padding: '6px 10px', fontWeight: 800, color: 'var(--text-muted)' }}>Job No</th>
                                <th style={{ padding: '6px 10px', fontWeight: 800, color: 'var(--text-muted)' }}>Party</th>
                                <th style={{ padding: '6px 10px', fontWeight: 800, color: 'var(--text-muted)' }}>Design</th>
                                <th style={{ padding: '6px 10px', fontWeight: 800, color: 'var(--text-muted)' }}>Machine</th>
                                <th style={{ padding: '6px 10px', fontWeight: 800, color: 'var(--text-muted)' }}>Pass</th>
                                <th style={{ padding: '6px 10px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'right' }}>Meters</th>
                                <th style={{ padding: '6px 10px', fontWeight: 800, color: 'var(--text-muted)' }}>Operator</th>
                                <th style={{ padding: '6px 10px', fontWeight: 800, color: 'var(--text-muted)' }}>Remarks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.logs.map((l, lIdx) => {
                                const matchedJob = jobCards.find(c => String(c.jobNo) === String(l.jobNo) || c._id === l.jobCardId);
                                return (
                                  <tr key={l._id || lIdx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                    <td style={{ padding: '6px 10px' }}>{formatDateTimeDDMMYYYY(l.date || l.created_date_time)}</td>
                                    <td style={{ padding: '6px 10px', fontWeight: 800, color: '#38bdf8' }}>
                                      <button
                                        type="button"
                                        onClick={() => loadJobCardHistory(l.jobNo)}
                                        style={{ background: 'none', border: 'none', color: '#38bdf8', fontWeight: 800, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                                      >
                                        #{l.jobNo}
                                      </button>
                                    </td>
                                    <td style={{ padding: '6px 10px' }}>{matchedJob ? (matchedJob.party || '—') : '—'}</td>
                                    <td style={{ padding: '6px 10px' }}>{matchedJob ? (matchedJob.designName || matchedJob.designNo || '—') : '—'}</td>
                                    <td style={{ padding: '6px 10px', fontWeight: 700 }}>{l.machineName}</td>
                                    <td style={{ padding: '6px 10px' }}>{l.pass}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 900, color: '#34d399' }}>
                                      {Number(l.meters).toFixed(2)} mtr
                                    </td>
                                    <td style={{ padding: '6px 10px' }}>{l.operatorName || '—'}</td>
                                    <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{l.notes || '—'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}


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
                <span style={{ color: 'var(--text-muted)' }}>Target: <strong style={{ color: 'var(--text-primary)' }}>{jobHistoryData?.summary?.targetMtr || 0} mtr</strong></span>
                <span style={{ color: '#38bdf8' }}>Printed: <strong>{(jobHistoryData?.summary?.totalPrintedMtr || 0).toFixed(2)} mtr</strong> ({jobHistoryData?.summary?.progressPct || 0}%)</span>
                <span style={{ color: '#f59e0b' }}>Remaining: <strong>{(jobHistoryData?.summary?.remainingMtr || 0).toFixed(2)} mtr</strong></span>
              </div>

              {/* Progress bar line */}
              <div style={{ width: '100%', height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${jobHistoryData?.summary?.progressPct || 0}%`,
                    height: '100%',
                    background: (jobHistoryData?.summary?.progressPct || 0) >= 100 ? '#10b981' : 'linear-gradient(90deg, #38bdf8, #8b5cf6)',
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
                  {Array.isArray(jobHistoryData?.data) && jobHistoryData.data.map((l, idx) => (
                    <tr key={l._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={tdStyle}>Run #{(jobHistoryData.data?.length || 0) - idx}</td>
                      <td style={tdStyle}>{formatDateDDMMYYYY(l.date)}</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{l.machineName}</td>
                      <td style={tdStyle}>{l.pass}</td>
                      <td style={{ ...tdStyle, fontWeight: 800, color: '#34d399' }}>{Number(l.meters).toFixed(2)} mtr</td>
                      <td style={tdStyle}>{l.shift}</td>
                      <td style={tdStyle}>{l.operatorName || '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleOpenEditModal(l)}
                            style={{ padding: '0.2rem 0.5rem', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', color: '#38bdf8', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem' }}
                            title="Edit this run"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteLog(l._id, l.jobNo)}
                            style={{ padding: '0.2rem 0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem' }}
                            title="Delete this run"
                          >
                            Delete
                          </button>
                        </div>
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
              <div>
                <label style={{ ...labelStyle, fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8', marginBottom: '0.4rem' }}>QUICK RANGE PRESET</label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  {[
                    { id: 'today', label: 'Today' },
                    { id: 'yesterday', label: 'Yesterday' },
                    { id: 'this_week', label: 'This Week' },
                    { id: 'this_month', label: 'This Month' },
                    { id: 'last_30_days', label: 'Last 30 Days' },
                    { id: 'all', label: 'All Time' }
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        const { dateStart: ds, dateEnd: de } = getDatePresetRange(p.id);
                        setReportStartDate(ds || '');
                        setReportEndDate(de || '');
                        setDateStart(ds || '');
                        setDateEnd(de || '');
                      }}
                      style={{
                        padding: '0.28rem 0.65rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        borderRadius: '6px',
                        border: '1px solid var(--border-light, #334155)',
                        background: 'rgba(255,255,255,0.05)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer'
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '0.72rem', fontWeight: 800, color: '#38bdf8' }}>FROM DATE <span style={{ color: '#ef4444' }}>*</span></label>
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
                    <label style={{ ...labelStyle, fontSize: '0.72rem', fontWeight: 800, color: '#a78bfa' }}>TO DATE <span style={{ color: '#ef4444' }}>*</span></label>
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

            {/* Modal Footer: PREVIEW REPORT, DOWNLOAD REPORT & CLOSE WINDOW */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
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
                onClick={async () => {
                  setShowReportModal(false);
                  await handleOpenPreviewReport({
                    dateStart: reportStartDate,
                    dateEnd: reportEndDate,
                    shift: reportShift || 'All Shifts',
                    machine: reportMachine || 'All',
                    pass: reportPass || 'All'
                  });
                }}
                className="btn-secondary"
                style={{
                  padding: '0.6rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  background: 'rgba(56,189,248,0.12)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56,189,248,0.35)',
                  cursor: 'pointer'
                }}
              >
                <Eye size={15} /> Preview Report
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

                    const fileName = `Printing_Production_Report_${shiftTag}_${reportStartDate || 'all'}_to_${reportEndDate || 'all'}.pdf`;

                    await api.downloadFabricCombinedReportPdf(
                      reportStartDate,
                      reportEndDate,
                      ['machine'],
                      fileName,
                      {
                        startTime: rawStartTime || '',
                        stopTime: rawStopTime || '',
                        operator: rawOperator || '',
                        shift: reportShift || '',
                        machineName: reportMachine || '',
                        pass: reportPass || ''
                      }
                    );
                    setShowReportModal(false);
                  } catch (err) {
                    alert(err.message || 'Failed to download report.');
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
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                  cursor: 'pointer',
                  opacity: 1
                }}
              >
                <Download size={16} /> {reportLoadingPdf ? 'Generating PDF...' : 'Download Report'}
              </button>
            </div>

          </div>
        </div>
      )}


      {/* ── 5B. DEDICATED INTERACTIVE PREVIEW REPORT MODAL ── */}
      {showPreviewModal && previewReportConfig && (() => {
        const pLogs = previewReportConfig.logs || [];
        const totalMtr = pLogs.reduce((s, l) => s + (Number(l.meters) || 0), 0);
        const uniqueJobs = new Set(pLogs.map(l => l.jobNo)).size;
        const morningMtr = pLogs.filter(l => l.shift === 'Morning').reduce((s, l) => s + (Number(l.meters) || 0), 0);
        const nightMtr = pLogs.filter(l => l.shift === 'Night').reduce((s, l) => s + (Number(l.meters) || 0), 0);

        // Machine & Pass aggregations
        const machPassMap = {};
        pLogs.forEach(l => {
          const m = l.machineName || 'Standard Machine';
          const p = l.pass || '1 PASS';
          const k = `${m}__${p}`;
          if (!machPassMap[k]) {
            machPassMap[k] = { machine: m, pass: p, totalMtr: 0, count: 0, jobs: new Set() };
          }
          machPassMap[k].totalMtr += Number(l.meters) || 0;
          machPassMap[k].count += 1;
          if (l.jobNo) machPassMap[k].jobs.add(l.jobNo);
        });
        const machPassList = Object.values(machPassMap);

        const rawSumm = previewReportConfig.rawSummary || rawMaterialSummary;
        const outG = rawSumm?.outward?.grando || { C: 0, M: 0, Y: 0, K: 0 };
        const outP = rawSumm?.outward?.printdot || { C: 0, M: 0, Y: 0, K: 0 };
        const outPapers = rawSumm?.outward?.paper || [];

        return (
          <div
            className="modal-overlay"
            onClick={() => setShowPreviewModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              animation: 'fadeIn 0.15s ease-out'
            }}
          >
            <div
              className="modal-content"
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 1040,
                maxHeight: '92vh',
                background: 'var(--bg-card, #131722)',
                borderRadius: '16px',
                border: '1px solid var(--border-light, #2a324b)',
                boxShadow: '0 25px 70px rgba(0,0,0,0.85)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                animation: 'scaleUp 0.18s ease-out'
              }}
            >
              {/* Modal Header */}
              <div style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1.5px solid var(--border-light)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(255,255,255,0.02)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)'
                  }}>
                    <FileText size={22} color="#fff" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                      ELITE DIGITAL PRINTS — PRINTING PRODUCTION REPORT PREVIEW
                    </h3>
                    <div style={{ display: 'flex', gap: '0.6rem', marginTop: 4, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      <span>
                        Period: <strong style={{ color: '#38bdf8' }}>{formatDateDDMMYYYY(previewReportConfig.dateStart)}</strong> to <strong style={{ color: '#38bdf8' }}>{formatDateDDMMYYYY(previewReportConfig.dateEnd)}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Shift: <strong style={{ color: '#c084fc' }}>{previewReportConfig.shift}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Total Entries: <strong style={{ color: 'var(--text-primary)' }}>{pLogs.length}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="btn-icon"
                  style={{ borderRadius: 8, padding: 6 }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Modal Content */}
              <div style={{
                overflowY: 'auto',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem'
              }}>
                {/* 1. Top KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
                  <div className="glass-panel" style={{ padding: '0.85rem 1rem', borderLeft: '4px solid #0284c7' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Printed Output</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0284c7', marginTop: 2 }}>
                      {totalMtr.toFixed(2)} <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>mtr</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
                      ☀️ Day: <strong style={{ color: '#38bdf8' }}>{morningMtr.toFixed(1)}m</strong> | 🌙 Night: <strong style={{ color: '#a78bfa' }}>{nightMtr.toFixed(1)}m</strong>
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '0.85rem 1rem', borderLeft: '4px solid #7c3aed' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Job Cards Processed</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#a78bfa', marginTop: 2 }}>
                      {uniqueJobs} <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Cards</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
                      {pLogs.length} total run entries logged
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '0.85rem 1rem', borderLeft: '4px solid #ec4899' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Estimated Ink Consumption</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#ec4899', marginTop: 2 }}>
                      {(totalMtr * 0.016).toFixed(1)} <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Liters</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
                      Avg. 16 ml / meter across colors
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '0.85rem 1rem', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Estimated Paper Used</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#f59e0b', marginTop: 2 }}>
                      {(totalMtr * 1.15).toFixed(0)} <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>sq. mtr</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
                      Approx. {((totalMtr * 1.15) / 100).toFixed(1)} paper rolls
                    </div>
                  </div>
                </div>

                {/* 2. Machine & Pass Output Breakdown Table */}
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Cpu size={15} /> Machine & Pass Speed Breakdown
                  </div>
                  <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-light)' }}>
                          <th style={{ padding: '7px 10px', fontWeight: 800, color: 'var(--text-muted)' }}>Machine</th>
                          <th style={{ padding: '7px 10px', fontWeight: 800, color: 'var(--text-muted)' }}>Pass</th>
                          <th style={{ padding: '7px 10px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'right' }}>Total Meters</th>
                          <th style={{ padding: '7px 10px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'right' }}>Run Entries</th>
                          <th style={{ padding: '7px 10px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'right' }}>Job Cards</th>
                        </tr>
                      </thead>
                      <tbody>
                        {machPassList.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ padding: '0.8rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                              No machine breakdown data available.
                            </td>
                          </tr>
                        ) : (
                          machPassList.map((mp, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                              <td style={{ padding: '7px 10px', fontWeight: 700, color: 'var(--text-primary)' }}>{mp.machine}</td>
                              <td style={{ padding: '7px 10px' }}>
                                <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(56,189,248,0.1)', color: '#38bdf8', fontWeight: 800, fontSize: '0.72rem' }}>
                                  {mp.pass}
                                </span>
                              </td>
                              <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 900, color: '#10b981' }}>
                                {mp.totalMtr.toFixed(2)} mtr
                              </td>
                              <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>{mp.count} runs</td>
                              <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>{mp.jobs.size} jobs</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. Raw Material Usage Section (if recorded) */}
                {(outG.C > 0 || outG.M > 0 || outG.Y > 0 || outG.K > 0 || outP.C > 0 || outP.M > 0 || outP.Y > 0 || outP.K > 0 || outPapers.length > 0) && (
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={15} /> Raw Material Consumption Summary
                    </div>
                    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-light)' }}>
                            <th style={{ padding: '7px 10px', fontWeight: 800 }}>Machine Name</th>
                            <th style={{ padding: '7px 10px', fontWeight: 800, textAlign: 'right', color: '#0284c7' }}>Cyan (C)</th>
                            <th style={{ padding: '7px 10px', fontWeight: 800, textAlign: 'right', color: '#ec4899' }}>Magenta (M)</th>
                            <th style={{ padding: '7px 10px', fontWeight: 800, textAlign: 'right', color: '#ca8a04' }}>Yellow (Y)</th>
                            <th style={{ padding: '7px 10px', fontWeight: 800, textAlign: 'right', color: '#94a3b8' }}>Black (K)</th>
                            <th style={{ padding: '7px 10px', fontWeight: 800 }}>Paper Types Consumed</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '7px 10px', fontWeight: 800, color: '#38bdf8' }}>GRANDO</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 800, color: '#0284c7' }}>{outG.C ? `${outG.C.toFixed(2)} L` : '—'}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 800, color: '#ec4899' }}>{outG.M ? `${outG.M.toFixed(2)} L` : '—'}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 800, color: '#ca8a04' }}>{outG.Y ? `${outG.Y.toFixed(2)} L` : '—'}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 800, color: '#94a3b8' }}>{outG.K ? `${outG.K.toFixed(2)} L` : '—'}</td>
                            <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>
                              {outPapers.map(p => `${p.paperType || 'A++'} (${p.paperPanna || ''}) : ${p.paperRollsQty || 0} Rolls`).join(', ') || 'Standard paper'}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '7px 10px', fontWeight: 800, color: '#a78bfa' }}>PRINTDOT</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 800, color: '#0284c7' }}>{outP.C ? `${outP.C.toFixed(2)} L` : '—'}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 800, color: '#ec4899' }}>{outP.M ? `${outP.M.toFixed(2)} L` : '—'}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 800, color: '#ca8a04' }}>{outP.Y ? `${outP.Y.toFixed(2)} L` : '—'}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 800, color: '#94a3b8' }}>{outP.K ? `${outP.K.toFixed(2)} L` : '—'}</td>
                            <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>—</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 4. Complete Printing Run Entries Table */}
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Printer size={15} /> Detailed Print Run Logs ({pLogs.length} Records)
                  </div>
                  <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-light)' }}>
                          <th style={{ padding: '7px 10px', fontWeight: 800, color: 'var(--text-muted)' }}>Time / Date</th>
                          <th style={{ padding: '7px 10px', fontWeight: 800, color: 'var(--text-muted)' }}>Shift</th>
                          <th style={{ padding: '7px 10px', fontWeight: 800, color: 'var(--text-muted)' }}>Job No</th>
                          <th style={{ padding: '7px 10px', fontWeight: 800, color: 'var(--text-muted)' }}>Party / Client</th>
                          <th style={{ padding: '7px 10px', fontWeight: 800, color: 'var(--text-muted)' }}>Design</th>
                          <th style={{ padding: '7px 10px', fontWeight: 800, color: 'var(--text-muted)' }}>Machine</th>
                          <th style={{ padding: '7px 10px', fontWeight: 800, color: 'var(--text-muted)' }}>Pass</th>
                          <th style={{ padding: '7px 10px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'right' }}>Meters</th>
                          <th style={{ padding: '7px 10px', fontWeight: 800, color: 'var(--text-muted)' }}>Operator</th>
                          <th style={{ padding: '7px 10px', fontWeight: 800, color: 'var(--text-muted)' }}>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pLogs.length === 0 ? (
                          <tr>
                            <td colSpan={10} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                              No print entries logged for this period.
                            </td>
                          </tr>
                        ) : (
                          pLogs.map((l, idx) => {
                            const matched = jobCards.find(c => c._id === l.jobCardId || String(c.jobNo) === String(l.jobNo));
                            const isMorn = l.shift === 'Morning';
                            return (
                              <tr key={l._id || idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{formatDateTimeDDMMYYYY(l.date || l.created_date_time)}</td>
                                <td style={{ padding: '6px 10px' }}>
                                  <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: isMorn ? 'rgba(56,189,248,0.1)' : 'rgba(167,139,250,0.1)', color: isMorn ? '#38bdf8' : '#a78bfa' }}>
                                    {l.shift || 'General'}
                                  </span>
                                </td>
                                <td style={{ padding: '6px 10px', fontWeight: 800, color: '#38bdf8' }}>
                                  #{l.jobNo}
                                </td>
                                <td style={{ padding: '6px 10px' }}>{matched ? (matched.party || '—') : '—'}</td>
                                <td style={{ padding: '6px 10px' }}>{matched ? (matched.designName || matched.designNo || '—') : '—'}</td>
                                <td style={{ padding: '6px 10px', fontWeight: 700 }}>{l.machineName}</td>
                                <td style={{ padding: '6px 10px' }}>{l.pass}</td>
                                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 900, color: '#34d399' }}>
                                  {Number(l.meters).toFixed(2)} mtr
                                </td>
                                <td style={{ padding: '6px 10px' }}>{l.operatorName || '—'}</td>
                                <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{l.notes || '—'}</td>
                              </tr>
                            );
                          })
                        )}
                        <tr style={{ background: 'rgba(255,255,255,0.04)', fontWeight: 900 }}>
                          <td colSpan={7} style={{ padding: '8px 10px', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            GRAND TOTAL PRINTED METERS ({pLogs.length} LOG ENTRIES)
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '0.95rem', color: '#10b981' }}>
                            {totalMtr.toFixed(2)} mtr
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Modal Footer Actions */}
              <div style={{
                padding: '1rem 1.5rem',
                borderTop: '1.5px solid var(--border-light)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                background: 'rgba(255,255,255,0.02)'
              }}>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="btn-secondary"
                  style={{ padding: '0.6rem 1.25rem', fontSize: '0.84rem', fontWeight: 700 }}
                >
                  Close Preview
                </button>

                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  {/* Export CSV */}
                  <button
                    type="button"
                    onClick={() => handleExportGroupCSV(pLogs, `Printing_Report_Preview_${previewReportConfig.dateStart}_to_${previewReportConfig.dateEnd}.csv`)}
                    className="btn-secondary"
                    style={{ padding: '0.6rem 1.1rem', fontSize: '0.84rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <FileSpreadsheet size={15} /> Export CSV
                  </button>

                  {/* Print / Format Options */}
                  <button
                    type="button"
                    onClick={() => handlePrintOperatorReport(pLogs)}
                    className="btn-secondary"
                    style={{
                      padding: '0.6rem 1.15rem',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(56,189,248,0.1)',
                      border: '1px solid rgba(56,189,248,0.3)',
                      color: '#38bdf8'
                    }}
                  >
                    <Printer size={15} /> Print / Thermal Dialog
                  </button>

                  {/* Download Official PDF */}
                  <button
                    type="button"
                    disabled={previewLoadingPdf}
                    onClick={async () => {
                      setPreviewLoadingPdf(true);
                      try {
                        let shiftTag = 'All_Shifts';
                        if (previewReportConfig.shift === 'Morning') shiftTag = 'Morning_Shift';
                        else if (previewReportConfig.shift === 'Night') shiftTag = 'Night_Shift';

                        const fileName = `Printing_Production_Report_${shiftTag}_${previewReportConfig.dateStart}_to_${previewReportConfig.dateEnd}.pdf`;

                        await api.downloadFabricCombinedReportPdf(
                          previewReportConfig.dateStart,
                          previewReportConfig.dateEnd,
                          ['machine'],
                          fileName,
                          {
                            startTime: rawStartTime || '',
                            stopTime: rawStopTime || '',
                            operator: rawOperator || '',
                            shift: previewReportConfig.shift === 'All Shifts' ? '' : previewReportConfig.shift,
                            machineName: previewReportConfig.machine === 'All Machines' ? '' : previewReportConfig.machine,
                            pass: previewReportConfig.pass === 'All Passes' ? '' : previewReportConfig.pass
                          }
                        );
                      } catch (err) {
                        alert(err.message || 'Failed to download report PDF.');
                      } finally {
                        setPreviewLoadingPdf(false);
                      }
                    }}
                    className="btn-primary"
                    style={{
                      padding: '0.6rem 1.35rem',
                      fontSize: '0.84rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                      cursor: 'pointer'
                    }}
                  >
                    <Download size={16} /> {previewLoadingPdf ? 'Generating PDF...' : 'Download Official PDF'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}


      {/* ── 6. RAW MATERIAL FORM MODAL — PREMIUM REDESIGN (50% INWARD | 50% OUTWARD SPLIT VIEW) ── */}
      {showRawMaterialModal && (
        <div
          onClick={() => setShowRawMaterialModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
            animation: 'fadeIn 0.18s ease-out'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 1020,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              boxShadow: '0 20px 60px rgba(15,23,42,0.14), 0 4px 16px rgba(37,99,235,0.06)',
              display: 'flex', flexDirection: 'column', gap: 0,
              overflow: 'hidden',
              animation: 'scaleUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >

            {/* ── MODAL HEADER ── */}
            <div style={{
              background: '#f8fafc',
              borderBottom: '1.5px solid #e2e8f0',
              padding: '0.85rem 1.1rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {/* Dual-gradient icon */}
                <div style={{
                  width: 38, height: 38, borderRadius: '10px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
                  flexShrink: 0
                }}>
                  <Sparkles size={18} color="#fff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 900, color: '#0f172a', letterSpacing: '0.25px' }}>
                    RAW MATERIAL ENTRY
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginTop: '1px' }}>
                    📥 Inward (Stock Received) &nbsp;&amp;&nbsp; 📤 Outward (Usage / Consumption)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRawMaterialModal(false)}
                style={{
                  background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.1)',
                  color: '#64748b', borderRadius: '8px', width: 30, height: 30,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.2s ease', flexShrink: 0
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'; }}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveRawMaterialUsage} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.9rem 1.1rem 1rem' }}>

              {/* ── INFO BAR: Date / Shift / Start / Stop / Operator ── */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1.15fr 0.85fr 0.85fr 1.1fr',
                gap: '0.6rem',
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                borderRadius: '10px',
                padding: '0.6rem 0.75rem',
              }}>
                {[
                  { label: 'DATE *', color: 'rgba(255,255,255,0.5)', type: 'date', value: rawDate, setter: setRawDate, required: true },
                  null, // shift handled separately
                  { label: 'START', color: '#38bdf8', type: 'time', value: rawStartTime, setter: setRawStartTime },
                  { label: 'STOP', color: '#a78bfa', type: 'time', value: rawStopTime, setter: setRawStopTime },
                ].map((f, i) => {
                  if (f === null) return (
                    <div key="shift">
                      <label style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>SHIFT *</label>
                      <select
                        value={rawShift}
                        onChange={e => setRawShift(e.target.value)}
                        required
                        style={{ width: '100%', padding: '0.28rem 0.45rem', fontSize: '0.76rem', height: '30px', background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontWeight: 700 }}
                      >
                        <option value="Morning">Morning (9 AM – 9 PM)</option>
                        <option value="Night">Night (9 PM – 9 AM)</option>
                      </select>
                    </div>
                  );
                  return (
                    <div key={i}>
                      <label style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f.label}</label>
                      <input
                        type={f.type} value={f.value} onChange={e => f.setter(e.target.value)} required={f.required}
                        style={{ width: '100%', padding: '0.28rem 0.45rem', fontSize: '0.76rem', height: '30px', background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontWeight: 700, boxSizing: 'border-box' }}
                      />
                    </div>
                  );
                })}
                <div>
                  <label style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>OPERATOR</label>
                  <input
                    type="text" list="print-operators-list" placeholder="Operator name..." value={rawOperator} onChange={e => setRawOperator(e.target.value)}
                    style={{ width: '100%', padding: '0.28rem 0.45rem', fontSize: '0.76rem', height: '30px', background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* ── SPLIT COLUMNS: LEFT = INWARD | RIGHT = OUTWARD ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>

                {/* ════ LEFT: INWARD ════ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

                  {/* Inward Badge */}
                  <div style={{
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    borderRadius: '8px', padding: '0.4rem 0.7rem',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    boxShadow: '0 4px 14px rgba(37,99,235,0.25)'
                  }}>
                    <ArrowDownToLine size={14} color="#fff" />
                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#fff', letterSpacing: '0.3px' }}>📥 50% INWARD (STOCK RECEIVED / IN)</span>
                  </div>

                  {/* Ink Inward Card */}
                  <div style={{ background: '#fff', borderRadius: '10px', border: '1.5px solid #2563eb', padding: '0.6rem 0.65rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', boxShadow: '0 4px 16px rgba(37,99,235,0.08)' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>💧 INK INWARD (LITERS)</div>

                    {/* Grando Ink — Inward */}
                    <div style={{ background: '#eff6ff', borderRadius: '7px', border: '1px solid #bfdbfe', padding: '0.4rem 0.5rem' }}>
                      <div style={{ fontSize: '0.66rem', fontWeight: 800, color: '#1d4ed8', marginBottom: '5px' }}>🖨️ GRANDO INK</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.3rem' }}>
                        {[['C', '#0284c7', grandoInC, setGrandoInC], ['M', '#db2777', grandoInM, setGrandoInM], ['Y', '#ca8a04', grandoInY, setGrandoInY], ['K', '#334155', grandoInK, setGrandoInK]].map(([ch, col, val, set]) => (
                          <div key={ch}>
                            <label style={{ fontSize: '0.6rem', fontWeight: 900, color: col, display: 'block', textAlign: 'center', marginBottom: '2px' }}>{ch}</label>
                            <input type="number" step="0.01" placeholder="0.00" value={val} onChange={e => set(e.target.value)}
                              style={{ width: '100%', padding: '0.15rem', fontSize: '0.78rem', height: '27px', textAlign: 'center', background: '#fff', border: `1.5px solid ${col}`, borderRadius: '5px', color: '#0f172a', fontWeight: 700, boxSizing: 'border-box', transition: 'box-shadow 0.15s' }} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* PrintDot Ink — Inward */}
                    <div style={{ background: '#eff6ff', borderRadius: '7px', border: '1px solid #bfdbfe', padding: '0.4rem 0.5rem' }}>
                      <div style={{ fontSize: '0.66rem', fontWeight: 800, color: '#1d4ed8', marginBottom: '5px' }}>🖨️ PRINTDOT INK</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.3rem' }}>
                        {[['C', '#0284c7', printdotInC, setPrintdotInC], ['M', '#db2777', printdotInM, setPrintdotInM], ['Y', '#ca8a04', printdotInY, setPrintdotInY], ['K', '#334155', printdotInK, setPrintdotInK]].map(([ch, col, val, set]) => (
                          <div key={ch}>
                            <label style={{ fontSize: '0.6rem', fontWeight: 900, color: col, display: 'block', textAlign: 'center', marginBottom: '2px' }}>{ch}</label>
                            <input type="number" step="0.01" placeholder="0.00" value={val} onChange={e => set(e.target.value)}
                              style={{ width: '100%', padding: '0.15rem', fontSize: '0.78rem', height: '27px', textAlign: 'center', background: '#fff', border: `1.5px solid ${col}`, borderRadius: '5px', color: '#0f172a', fontWeight: 700, boxSizing: 'border-box', transition: 'box-shadow 0.15s' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Paper Inward Card */}
                  <div style={{ background: '#fff', borderRadius: '10px', border: '1.5px solid #2563eb', padding: '0.6rem 0.65rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', boxShadow: '0 4px 16px rgba(37,99,235,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📜 PAPER INWARD (STOCK IN)</div>
                      <button type="button" onClick={handleAddInwardPaperEntry}
                        style={{ padding: '0.15rem 0.5rem', fontSize: '0.67rem', fontWeight: 800, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '5px', cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#dbeafe'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff'; }}
                      >+ Add Row</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {inwardPaperEntries.map((entry, index) => (
                        <div key={entry.id} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', background: '#f8fafc', padding: '0.2rem 0.4rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '0.64rem', fontWeight: 900, color: '#2563eb', minWidth: 18 }}>#{index + 1}</span>
                          <div style={{ flex: 1 }}>
                            <select
                              value={(() => {
                                const currentType = entry.paperType || 'A++';
                                const types = (paperTypesList.length > 0 ? paperTypesList : ['A++', 'A+', 'A']);
                                return types.includes(currentType) ? currentType : currentType;
                              })()}
                              onChange={e => handleInwardPaperEntryChange(entry.id, 'paperType', e.target.value)}
                              style={{ width: '100%', padding: '0.15rem 0.3rem', fontSize: '0.74rem', height: '26px', background: '#fff', border: '1px solid #2563eb', borderRadius: '4px', color: '#0f172a', fontWeight: 700 }}
                            >
                              {(() => {
                                const currentType = entry.paperType || 'A++';
                                const types = (paperTypesList.length > 0 ? paperTypesList : ['A++', 'A+', 'A']);
                                const list = types.includes(currentType) ? types : [currentType, ...types].filter(Boolean);
                                return Array.from(new Set(list)).map((p, pIdx) => <option key={pIdx} value={p}>{p}</option>);
                              })()}
                            </select>
                          </div>
                          <div style={{ flex: 1 }}>
                            <select
                              value={(() => {
                                const currentPanna = entry.paperPanna || '';
                                const baseOpts = (pannaOptionsList.length > 0 ? pannaOptionsList : ['36 Panna', '44" Panna', '54" Panna', '58 Panna', '60" Panna', '64" Panna', '72" Panna'])
                                  .map(w => w.toLowerCase().includes('panna') || w.includes('"') ? w : `${w} Panna`);
                                const matched = baseOpts.find(opt => opt === currentPanna || opt.replace(/["'\s]/g, '').toLowerCase() === currentPanna.replace(/["'\s]/g, '').toLowerCase());
                                return matched || currentPanna;
                              })()}
                              onChange={e => handleInwardPaperEntryChange(entry.id, 'paperPanna', e.target.value)}
                              style={{ width: '100%', padding: '0.15rem 0.3rem', fontSize: '0.74rem', height: '26px', background: '#fff', border: '1px solid #2563eb', borderRadius: '4px', color: '#0f172a', fontWeight: 700 }}
                            >
                              {(() => {
                                const currentPanna = entry.paperPanna || '';
                                const baseOpts = (pannaOptionsList.length > 0 ? pannaOptionsList : ['36 Panna', '44" Panna', '54" Panna', '58 Panna', '60" Panna', '64" Panna', '72" Panna'])
                                  .map(w => w.toLowerCase().includes('panna') || w.includes('"') ? w : `${w} Panna`);
                                const hasExact = baseOpts.includes(currentPanna);
                                const list = hasExact ? baseOpts : [currentPanna, ...baseOpts].filter(Boolean);
                                return Array.from(new Set(list)).map((w, wIdx) => <option key={wIdx} value={w}>{w}</option>);
                              })()}
                            </select>
                          </div>
                          <div style={{ width: '54px' }}>
                            <input type="number" step="1" placeholder="Rolls" value={entry.paperRollsQty} onChange={e => handleInwardPaperEntryChange(entry.id, 'paperRollsQty', e.target.value)} style={{ width: '100%', padding: '0.15rem 0.2rem', fontSize: '0.74rem', height: '26px', textAlign: 'center', background: '#fff', border: '1px solid #2563eb', borderRadius: '4px', color: '#0f172a', fontWeight: 800, boxSizing: 'border-box' }} title="Rolls Quantity" />
                          </div>
                          <div style={{ width: '54px' }}>
                            <input type="number" step="0.1" placeholder="Mtr" value={entry.paperMtrQty} onChange={e => handleInwardPaperEntryChange(entry.id, 'paperMtrQty', e.target.value)} style={{ width: '100%', padding: '0.15rem 0.2rem', fontSize: '0.74rem', height: '26px', textAlign: 'center', background: '#fff', border: '1px solid #2563eb', borderRadius: '4px', color: '#0f172a', fontWeight: 800, boxSizing: 'border-box' }} title="Meters Quantity" />
                          </div>
                          {inwardPaperEntries.length > 1 && (
                            <button type="button" onClick={() => handleRemoveInwardPaperEntry(entry.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.1rem', display: 'flex', alignItems: 'center' }}><Trash2 size={13} /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* ════ RIGHT: OUTWARD ════ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

                  {/* Outward Badge */}
                  <div style={{
                    background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                    borderRadius: '8px', padding: '0.4rem 0.7rem',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    boxShadow: '0 4px 14px rgba(30,64,175,0.25)'
                  }}>
                    <ArrowUpFromLine size={14} color="#fff" />
                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#fff', letterSpacing: '0.3px' }}>📤 50% OUTWARD (USAGE / CONSUMPTION)</span>
                  </div>

                  {/* Ink Outward Card */}
                  <div style={{ background: '#fff', borderRadius: '10px', border: '1.5px solid #1e40af', padding: '0.6rem 0.65rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', boxShadow: '0 4px 16px rgba(30,64,175,0.08)' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>💧 INK USAGE (LITERS)</div>

                    {/* Grando Ink — Outward */}
                    <div style={{ background: '#f0f7ff', borderRadius: '7px', border: '1px solid #93c5fd', padding: '0.4rem 0.5rem' }}>
                      <div style={{ fontSize: '0.66rem', fontWeight: 800, color: '#1e3a8a', marginBottom: '5px' }}>🖨️ GRANDO INK</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.3rem' }}>
                        {[['C', '#0284c7', grandoOutC, setGrandoOutC], ['M', '#db2777', grandoOutM, setGrandoOutM], ['Y', '#ca8a04', grandoOutY, setGrandoOutY], ['K', '#334155', grandoOutK, setGrandoOutK]].map(([ch, col, val, set]) => (
                          <div key={ch}>
                            <label style={{ fontSize: '0.6rem', fontWeight: 900, color: col, display: 'block', textAlign: 'center', marginBottom: '2px' }}>{ch}</label>
                            <input type="number" step="0.01" placeholder="0.00" value={val} onChange={e => set(e.target.value)}
                              style={{ width: '100%', padding: '0.15rem', fontSize: '0.78rem', height: '27px', textAlign: 'center', background: '#fff', border: `1.5px solid ${col}`, borderRadius: '5px', color: '#0f172a', fontWeight: 700, boxSizing: 'border-box' }} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* PrintDot Ink — Outward */}
                    <div style={{ background: '#f0f7ff', borderRadius: '7px', border: '1px solid #93c5fd', padding: '0.4rem 0.5rem' }}>
                      <div style={{ fontSize: '0.66rem', fontWeight: 800, color: '#1e3a8a', marginBottom: '5px' }}>🖨️ PRINTDOT INK</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.3rem' }}>
                        {[['C', '#0284c7', printdotOutC, setPrintdotOutC], ['M', '#db2777', printdotOutM, setPrintdotOutM], ['Y', '#ca8a04', printdotOutY, setPrintdotOutY], ['K', '#334155', printdotOutK, setPrintdotOutK]].map(([ch, col, val, set]) => (
                          <div key={ch}>
                            <label style={{ fontSize: '0.6rem', fontWeight: 900, color: col, display: 'block', textAlign: 'center', marginBottom: '2px' }}>{ch}</label>
                            <input type="number" step="0.01" placeholder="0.00" value={val} onChange={e => set(e.target.value)}
                              style={{ width: '100%', padding: '0.15rem', fontSize: '0.78rem', height: '27px', textAlign: 'center', background: '#fff', border: `1.5px solid ${col}`, borderRadius: '5px', color: '#0f172a', fontWeight: 700, boxSizing: 'border-box' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Paper Outward Card */}
                  <div style={{ background: '#fff', borderRadius: '10px', border: '1.5px solid #1e40af', padding: '0.6rem 0.65rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', boxShadow: '0 4px 16px rgba(30,64,175,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📜 PAPER USAGE (CONSUMPTION)</div>
                      <button type="button" onClick={handleAddOutwardPaperEntry}
                        style={{ padding: '0.15rem 0.5rem', fontSize: '0.67rem', fontWeight: 800, background: '#f0f7ff', color: '#1e40af', border: '1px solid #93c5fd', borderRadius: '5px', cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#dbeafe'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#f0f7ff'; }}
                      >+ Add Row</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {outwardPaperEntries.map((entry, index) => (
                        <div key={entry.id} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', background: '#f8fafc', padding: '0.2rem 0.4rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '0.64rem', fontWeight: 900, color: '#1e40af', minWidth: 18 }}>#{index + 1}</span>
                          <div style={{ flex: 1 }}>
                            <select
                              value={(() => {
                                const currentType = entry.paperType || 'A++';
                                const types = (paperTypesList.length > 0 ? paperTypesList : ['A++', 'A+', 'A']);
                                return types.includes(currentType) ? currentType : currentType;
                              })()}
                              onChange={e => handleOutwardPaperEntryChange(entry.id, 'paperType', e.target.value)}
                              style={{ width: '100%', padding: '0.15rem 0.3rem', fontSize: '0.74rem', height: '26px', background: '#fff', border: '1px solid #1e40af', borderRadius: '4px', color: '#0f172a', fontWeight: 700 }}
                            >
                              {(() => {
                                const currentType = entry.paperType || 'A++';
                                const types = (paperTypesList.length > 0 ? paperTypesList : ['A++', 'A+', 'A']);
                                const list = types.includes(currentType) ? types : [currentType, ...types].filter(Boolean);
                                return Array.from(new Set(list)).map((p, pIdx) => <option key={pIdx} value={p}>{p}</option>);
                              })()}
                            </select>
                          </div>
                          <div style={{ flex: 1 }}>
                            <select
                              value={(() => {
                                const currentPanna = entry.paperPanna || '';
                                const baseOpts = (pannaOptionsList.length > 0 ? pannaOptionsList : ['36 Panna', '44" Panna', '54" Panna', '58 Panna', '60" Panna', '64" Panna', '72" Panna'])
                                  .map(w => w.toLowerCase().includes('panna') || w.includes('"') ? w : `${w} Panna`);
                                const matched = baseOpts.find(opt => opt === currentPanna || opt.replace(/["'\s]/g, '').toLowerCase() === currentPanna.replace(/["'\s]/g, '').toLowerCase());
                                return matched || currentPanna;
                              })()}
                              onChange={e => handleOutwardPaperEntryChange(entry.id, 'paperPanna', e.target.value)}
                              style={{ width: '100%', padding: '0.15rem 0.3rem', fontSize: '0.74rem', height: '26px', background: '#fff', border: '1px solid #1e40af', borderRadius: '4px', color: '#0f172a', fontWeight: 700 }}
                            >
                              {(() => {
                                const currentPanna = entry.paperPanna || '';
                                const baseOpts = (pannaOptionsList.length > 0 ? pannaOptionsList : ['36 Panna', '44" Panna', '54" Panna', '58 Panna', '60" Panna', '64" Panna', '72" Panna'])
                                  .map(w => w.toLowerCase().includes('panna') || w.includes('"') ? w : `${w} Panna`);
                                const hasExact = baseOpts.includes(currentPanna);
                                const list = hasExact ? baseOpts : [currentPanna, ...baseOpts].filter(Boolean);
                                return Array.from(new Set(list)).map((w, wIdx) => <option key={wIdx} value={w}>{w}</option>);
                              })()}
                            </select>
                          </div>
                          <div style={{ width: '54px' }}>
                            <input type="number" step="1" placeholder="Rolls" value={entry.paperRollsQty} onChange={e => handleOutwardPaperEntryChange(entry.id, 'paperRollsQty', e.target.value)} style={{ width: '100%', padding: '0.15rem 0.2rem', fontSize: '0.74rem', height: '26px', textAlign: 'center', background: '#fff', border: '1px solid #1e40af', borderRadius: '4px', color: '#0f172a', fontWeight: 800, boxSizing: 'border-box' }} title="Rolls Quantity" />
                          </div>
                          <div style={{ width: '54px' }}>
                            <input type="number" step="0.1" placeholder="Mtr" value={entry.paperMtrQty} onChange={e => handleOutwardPaperEntryChange(entry.id, 'paperMtrQty', e.target.value)} style={{ width: '100%', padding: '0.15rem 0.2rem', fontSize: '0.74rem', height: '26px', textAlign: 'center', background: '#fff', border: '1px solid #1e40af', borderRadius: '4px', color: '#0f172a', fontWeight: 800, boxSizing: 'border-box' }} title="Meters Quantity" />
                          </div>
                          {outwardPaperEntries.length > 1 && (
                            <button type="button" onClick={() => handleRemoveOutwardPaperEntry(entry.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.1rem', display: 'flex', alignItems: 'center' }}><Trash2 size={13} /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              {/* ── FOOTER: Remarks + Actions ── */}
              <div style={{
                display: 'flex', gap: '0.65rem', alignItems: 'center',
                borderTop: '1.5px solid #e2e8f0',
                paddingTop: '0.75rem', marginTop: '0.1rem'
              }}>
                <input
                  type="text"
                  placeholder="Remarks / Optional notes..."
                  value={rawNotes}
                  onChange={e => setRawNotes(e.target.value)}
                  style={{
                    flex: 1, padding: '0.42rem 0.7rem', fontSize: '0.8rem', height: '34px',
                    background: '#f8fafc', border: '1.5px solid #e2e8f0',
                    borderRadius: '8px', color: '#0f172a', boxSizing: 'border-box', fontWeight: 500
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowRawMaterialModal(false)}
                  style={{
                    padding: '0 1.1rem', fontSize: '0.82rem', fontWeight: 700, height: '34px',
                    background: '#f1f5f9', border: '1.5px solid #e2e8f0',
                    borderRadius: '8px', color: '#475569', cursor: 'pointer',
                    whiteSpace: 'nowrap', transition: 'all 0.18s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#1e293b'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#475569'; }}
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={rawMaterialSubmitting}
                  style={{
                    padding: '0 1.4rem', fontSize: '0.84rem', fontWeight: 700, height: '34px',
                    background: rawMaterialSubmitting ? '#f1f5f9' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    border: 'none', borderRadius: '8px', color: rawMaterialSubmitting ? '#94a3b8' : '#fff',
                    cursor: rawMaterialSubmitting ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
                    boxShadow: rawMaterialSubmitting ? 'none' : '0 4px 14px rgba(37,99,235,0.3)',
                    transition: 'all 0.2s ease', opacity: rawMaterialSubmitting ? 0.6 : 1
                  }}
                  onMouseEnter={e => { if (!rawMaterialSubmitting) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(37,99,235,0.4)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = rawMaterialSubmitting ? 'none' : '0 4px 14px rgba(37,99,235,0.3)'; }}
                >
                  <Sparkles size={14} />
                  {rawMaterialSubmitting ? 'Saving...' : 'Save Inward & Outward Stock'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── 7. DEDICATED EDIT PRINT LOG ENTRY MODAL ── */}
      {editModalLog && (
        <div className="modal-overlay" onClick={() => setEditModalLog(null)}>
          <div
            className="modal-content"
            style={{
              maxWidth: 620,
              padding: '1.5rem',
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              boxShadow: '0 20px 50px rgba(0,0,0,0.15)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.85rem', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                  <Edit2 size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Edit Print Log Entry
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                      #{editModalLog.jobNo}
                    </span>
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 3 }}>
                    {editModalLog.matchedJob?.party ? `Client: ${editModalLog.matchedJob.party} • ` : ''}
                    {editModalLog.matchedJob?.designName ? `Design: ${editModalLog.matchedJob.designName} • ` : ''}
                    Total Job Mtr: {editModalLog.matchedJob?.totalMtr || editModalLog.matchedJob?.consumption || '—'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditModalLog(null)}
                className="btn-icon"
                style={{ padding: '0.4rem', borderRadius: 6 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditModal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Row 1: Date, Shift, Pass */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>DATE <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="date"
                    value={editModalLog.date}
                    onChange={e => setEditModalLog(prev => ({ ...prev, date: e.target.value }))}
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>SHIFT <span style={{ color: '#ef4444' }}>*</span></label>
                  <select
                    value={editModalLog.shift}
                    onChange={e => setEditModalLog(prev => ({ ...prev, shift: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="Morning">Morning</option>
                    <option value="Night">Night</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>PASS</label>
                  <select
                    value={editModalLog.pass}
                    onChange={e => setEditModalLog(prev => ({ ...prev, pass: e.target.value }))}
                    style={inputStyle}
                  >
                    {Array.from(new Set([...PASS_OPTIONS, editModalLog.pass])).filter(Boolean).map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Job Card No, Machine, Meters Printed */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.1fr 1.2fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>JOB CARD NO. <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    value={editModalLog.jobNo}
                    onChange={e => {
                      const val = e.target.value;
                      const matched = findMatchingJob(val);
                      setEditModalLog(prev => ({
                        ...prev,
                        jobNo: val,
                        jobCardId: matched ? matched._id : prev.jobCardId,
                        matchedJob: matched || prev.matchedJob
                      }));
                    }}
                    style={{ ...inputStyle, fontWeight: 700 }}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>PRINTING MACHINE <span style={{ color: '#ef4444' }}>*</span></label>
                  <select
                    value={editModalLog.machineName}
                    onChange={e => setEditModalLog(prev => ({ ...prev, machineName: e.target.value }))}
                    style={inputStyle}
                    required
                  >
                    {Array.from(new Set([
                      editModalLog.machineName,
                      'GRANDO',
                      'PRINTDOT',
                      ...machinesList
                    ])).filter(Boolean).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>METERS PRINTED (MTR) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editModalLog.meters}
                    onChange={e => setEditModalLog(prev => ({ ...prev, meters: e.target.value }))}
                    style={{ ...inputStyle, fontSize: '0.95rem', fontWeight: 800, color: '#34d399' }}
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Row 3: Operator Name & Remarks */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>OPERATOR NAME</label>
                  <input
                    type="text"
                    list="edit-modal-operators-list"
                    value={editModalLog.operatorName}
                    onChange={e => setEditModalLog(prev => ({ ...prev, operatorName: e.target.value }))}
                    placeholder="Operator name..."
                    style={{ ...inputStyle, fontWeight: 600 }}
                  />
                  <datalist id="edit-modal-operators-list">
                    {operatorsList.map(op => <option key={op} value={op} />)}
                  </datalist>
                </div>
                <div>
                  <label style={labelStyle}>REMARKS / NOTES</label>
                  <input
                    type="text"
                    value={editModalLog.notes}
                    onChange={e => setEditModalLog(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Optional notes or roll info..."
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  type="button"
                  onClick={() => setEditModalLog(null)}
                  className="btn-secondary"
                  style={{ padding: '0.55rem 1.1rem', fontSize: '0.82rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                  style={{
                    padding: '0.55rem 1.35rem',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    boxShadow: '0 2px 10px rgba(2, 132, 199, 0.4)'
                  }}
                >
                  <Check size={16} />
                  {submitting ? 'Updating...' : 'Update Print Log Entry'}
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
  background: 'var(--bg-input, #ffffff)',
  border: '1px solid var(--border-light, #cbd5e1)',
  borderRadius: '6px',
  color: 'var(--text-primary, #0f172a)',
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
