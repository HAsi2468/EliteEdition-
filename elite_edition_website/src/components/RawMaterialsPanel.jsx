import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import {
  Layers, Database, Settings, Trash2, Search, X, FileDown,
  Plus, Edit, ArrowDownToLine, ArrowUpFromLine, RefreshCw, FileSpreadsheet, AlertCircle,
  FileText, Droplet, Printer, CheckCircle2, ChevronRight, PlusCircle,
  ShieldCheck, Check, Clock, AlertTriangle, Building2, Eye, ShieldAlert, CheckCheck, XCircle
} from 'lucide-react';
import DateRangePicker, { getDatePresetRange } from './DateRangePicker';

const parseCanSize = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  const num = parseFloat(String(val).replace(/[^\d.]/g, ''));
  return isNaN(num) ? 0 : num;
};

const getSelectedCanSize = (currentVal, options) => {
  if (!currentVal) return options[0] || '';
  const parsedCurrent = parseCanSize(currentVal);
  const match = options.find(opt => parseCanSize(opt) === parsedCurrent);
  return match || currentVal;
};

export const GARMENT_RAW_CATEGORIES = [
  'All',
  'Fabric',
  'Trims & Thread',
  'Buttons & Fasteners',
  'Elastics & Laces',
  'Interlining & Fusing',
  'Labels & Tags',
  'Packing Material',
  'Other'
];

export const RAW_MATERIAL_UNITS = [
  'Meters',
  'Pieces (Pcs)',
  'Cones / Spools',
  'Gross (144 pcs)',
  'Rolls',
  'Kgs',
  'Liters',
  'Boxes',
  'Packets',
  'Sets'
];

export default function RawMaterialsPanel({ companyEntity = 'Elite Digital Print', initialTab = null } = {}) {
  const isDigitalPrint = /^elite\s*digital\s*print/i.test(companyEntity) || companyEntity === 'digital_print';
  const [activeTab, setActiveTab] = useState(() => {
    if (initialTab) return initialTab;
    return 'dashboard';
  });
  const currentUser = api.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const [stock, setStock] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [materialsList, setMaterialsList] = useState(() => {
    if (isDigitalPrint) {
      return ['Sublimation Paper', 'Butter Paper', 'Grando Ink', 'Printdot Ink'];
    }
    const storageKey = `elite_custom_materials_${String(companyEntity || '').toLowerCase().replace(/\s+/g, '_')}`;
    let saved = [];
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch (e) {}
    const defaultGarment = [
      'Viscose Rayon Fabric',
      'Cotton Fabric',
      'Georgette Fabric',
      'Polyester Sewing Thread',
      'Buttons & Fasteners',
      'Zippers & Sliders',
      'Knitted / Woven Elastic',
      'Laces & Borders',
      'Fusing / Interlining',
      'Brand Labels & Tags',
      'Packaging Material'
    ];
    return [...new Set([...defaultGarment, ...saved])];
  });
  const [vendorsList, setVendorsList] = useState([]);
  const [partiesList, setPartiesList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Garment Category & Add New Material State ──
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [isNewMaterialModalOpen, setIsNewMaterialModalOpen] = useState(false);
  const [newMaterialSubmitting, setNewMaterialSubmitting] = useState(false);
  const [newMaterialForm, setNewMaterialForm] = useState({
    materialName: '',
    category: 'Fabric',
    unit: 'Meters',
    shade: '',
    panna: '',
    hsnCode: '',
    location: '',
    initialQty: '',
    unitRate: '',
    reorderLevel: '10',
    notes: ''
  });

  // ── Sister Company Inward & Verification State ──
  const [sisterTransfers, setSisterTransfers] = useState([]);
  const [sisterStats, setSisterStats] = useState({
    totalCount: 0,
    pendingCount: 0,
    verifiedCount: 0,
    rejectedCount: 0,
    pendingQty: 0
  });
  const [sisterLoading, setSisterLoading] = useState(false);
  const [sisterStatusFilter, setSisterStatusFilter] = useState('ALL');
  const [sisterSearch, setSisterSearch] = useState('');
  const [selectedSisterTx, setSelectedSisterTx] = useState(null);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyAction, setVerifyAction] = useState('VERIFY'); // 'VERIFY' or 'REJECT'
  const [verifyQty, setVerifyQty] = useState('');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [discrepancyReason, setDiscrepancyReason] = useState('');
  const [submittingVerify, setSubmittingVerify] = useState(false);

  const fileInputRef = useRef(null);

  const downloadCsvFile = (csvContent, fileName) => {
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (link.parentNode) document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 2000);
  };

  const formatMaterialDetailsString = (t) => {
    if (!t.materialName) return '-';
    const nameLower = t.materialName.toLowerCase();
    const isPaperGrade = ['a++', 'a+', 'a'].includes(nameLower);
    const details = [];
    if (nameLower.includes('sublimation') || isPaperGrade) {
      if (t.panna) details.push(`Panna: ${t.panna}`);
      if (t.paperQuality) details.push(`Qual: ${t.paperQuality}`);
      if (t.metersPerRoll) details.push(`${t.metersPerRoll}m`);
    } else if (nameLower.includes('butter')) {
      if (t.panna) details.push(`Panna: ${t.panna}`);
      if (t.metersPerRoll) details.push(`${t.metersPerRoll}m`);
    } else if (nameLower.includes('ink')) {
      if (t.color) details.push(t.color);
      if (t.canSize) details.push(`${t.canSize} Ltr`);
    }
    const displayName = isPaperGrade ? `Sublimation Paper (${t.materialName})` : t.materialName;
    return details.length > 0 ? `${displayName} (${details.join(', ')})` : displayName;
  };

  const handleExportCsv = () => {
    const todayStr = new Date().toISOString().split('T')[0];

    if (activeTab === 'inward') {
      if (inwardTx.length === 0) {
        alert('No inward transactions to export.');
        return;
      }
      const headers = ['Date', 'Challan No', 'Material Name', 'Vendor Name', 'Qty', 'Unit', 'Notes'];
      const csvLines = [
        headers.join(','),
        ...inwardTx.map(t => [
          `"${formatDateDDMMYYYY(t.date)}"`,
          `"${t.challanNo || ''}"`,
          `"${formatMaterialDetailsString(t)}"`,
          `"${t.vendorName || ''}"`,
          t.qty,
          `"${t.unit || 'Rolls'}"`,
          `"${(t.notes || '').replace(/"/g, '""')}"`
        ].join(','))
      ].join('\n');

      downloadCsvFile(csvLines, `Raw_Materials_Inward_Register_${todayStr}.csv`);
      return;
    }

    if (activeTab === 'outward') {
      if (outwardTx.length === 0) {
        alert('No outward transactions to export.');
        return;
      }
      const headers = ['Date', 'Job Card No', 'Material Name', 'Party Name', 'Qty', 'Unit', 'Notes'];
      const csvLines = [
        headers.join(','),
        ...outwardTx.map(t => [
          `"${formatDateDDMMYYYY(t.date)}"`,
          `"${t.jobNo || ''}"`,
          `"${formatMaterialDetailsString(t)}"`,
          `"${t.partyName || ''}"`,
          t.qty,
          `"${t.unit || 'Rolls'}"`,
          `"${(t.notes || '').replace(/"/g, '""')}"`
        ].join(','))
      ].join('\n');

      downloadCsvFile(csvLines, `Raw_Materials_Outward_Register_${todayStr}.csv`);
      return;
    }

    // Default / Dashboard tab: Export Stock Overview
    if (filteredStock.length === 0) {
      alert('No stock data to export.');
      return;
    }
    const headers = ['Material Name', 'Total Inward', 'Total Outward', 'Current Stock', 'Unit'];
    const csvLines = [
      headers.join(','),
      ...filteredStock.map(s => [
        `"${s.materialName}"`,
        s.totalInward,
        s.totalOutward,
        s.currentStock,
        `"${s.unit || ''}"`
      ].join(','))
    ].join('\n');

    downloadCsvFile(csvLines, `Raw_Materials_Stock_Overview_${todayStr}.csv`);
  };

  const handleImportCsv = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) {
          alert('CSV file is empty.');
          return;
        }

        const parseLine = (line) => {
          const cols = [];
          let insideQuote = false;
          let currentWord = '';
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              insideQuote = !insideQuote;
            } else if (char === ',' && !insideQuote) {
              cols.push(currentWord.trim().replace(/^"|"$/g, ''));
              currentWord = '';
            } else {
              currentWord += char;
            }
          }
          cols.push(currentWord.trim().replace(/^"|"$/g, ''));
          return cols;
        };

        const headers = parseLine(lines[0]).map(h => h.toLowerCase());
        const getIdx = (name) => headers.findIndex(h => h.includes(name));

        const matIdx = getIdx('material');
        const pannaIdx = getIdx('panna');
        const qualIdx = getIdx('paper quality') !== -1 ? getIdx('paper quality') : getIdx('quality');
        const colorIdx = getIdx('color');
        const canIdx = getIdx('can size') !== -1 ? getIdx('can size') : getIdx('can');
        const metersIdx = getIdx('meters') !== -1 ? getIdx('meters') : getIdx('mtr');
        const openIdx = getIdx('opening');
        const inIdx = getIdx('inward');
        const outIdx = getIdx('outward');
        const currIdx = getIdx('current');
        const dateIdx = getIdx('date');
        const challanIdx = getIdx('challan');
        const vendorIdx = getIdx('vendor');
        const jobIdx = getIdx('job');
        const partyIdx = getIdx('party');
        const notesIdx = getIdx('notes');

        const rows = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const cols = parseLine(line);
          const materialName = matIdx !== -1 ? cols[matIdx] : cols[0];
          if (!materialName) continue;

          rows.push({
            materialName,
            panna: pannaIdx !== -1 ? cols[pannaIdx] : cols[1] || '',
            paperQuality: qualIdx !== -1 ? cols[qualIdx] : cols[2] || '',
            color: colorIdx !== -1 ? cols[colorIdx] : cols[3] || '',
            canSize: canIdx !== -1 && cols[canIdx] ? parseFloat(cols[canIdx]) : (cols[4] ? parseFloat(cols[4]) : null),
            metersPerRoll: metersIdx !== -1 && cols[metersIdx] ? parseFloat(cols[metersIdx]) : (cols[5] ? parseFloat(cols[5]) : null),
            openingStock: openIdx !== -1 && cols[openIdx] ? parseFloat(cols[openIdx]) : (cols[6] ? parseFloat(cols[6]) : 0),
            inwardQty: inIdx !== -1 && cols[inIdx] ? parseFloat(cols[inIdx]) : (cols[7] ? parseFloat(cols[7]) : 0),
            outwardQty: outIdx !== -1 && cols[outIdx] ? parseFloat(cols[outIdx]) : (cols[8] ? parseFloat(cols[8]) : 0),
            currentStock: currIdx !== -1 && cols[currIdx] ? parseFloat(cols[currIdx]) : (cols[9] ? parseFloat(cols[9]) : 0),
            date: dateIdx !== -1 ? cols[dateIdx] : cols[10] || '',
            challanNo: challanIdx !== -1 ? cols[challanIdx] : cols[11] || '',
            vendorName: vendorIdx !== -1 ? cols[vendorIdx] : cols[12] || '',
            jobNo: jobIdx !== -1 ? cols[jobIdx] : cols[13] || '',
            partyName: partyIdx !== -1 ? cols[partyIdx] : cols[14] || '',
            notes: notesIdx !== -1 ? cols[notesIdx] : cols[15] || ''
          });
        }

        if (rows.length === 0) {
          alert('No valid rows found in CSV.');
          return;
        }

        setLoading(true);
        const res = await api.importRawMaterialStock(rows);
        if (res.success) {
          alert(res.message || 'Raw Materials stock imported successfully.');
          fetchData();
        } else {
          alert(res.error || 'Failed to import raw materials stock.');
        }
      } catch (err) {
        alert('Error parsing CSV: ' + err.message);
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Search / filter state
  const [inwardSearch, setInwardSearch] = useState('');
  const [outwardSearch, setOutwardSearch] = useState('');

  // Editing transaction
  const [editingTransaction, setEditingTransaction] = useState(null);

  const [inwardDateStart, setInwardDateStart] = useState('');
  const [inwardDateEnd, setInwardDateEnd] = useState('');
  const [inwardPreset, setInwardPreset] = useState('all');
  const [customInwardStart, setCustomInwardStart] = useState('');
  const [customInwardEnd, setCustomInwardEnd] = useState('');
  const [inwardMaterialType, setInwardMaterialType] = useState('All');
  const [inwardSortBy, setInwardSortBy] = useState('date');
  const [inwardSortOrder, setInwardSortOrder] = useState('desc');

  const [outwardDateStart, setOutwardDateStart] = useState('');
  const [outwardDateEnd, setOutwardDateEnd] = useState('');
  const [outwardPreset, setOutwardPreset] = useState('all');
  const [customOutwardStart, setCustomOutwardStart] = useState('');
  const [customOutwardEnd, setCustomOutwardEnd] = useState('');
  const [outwardMaterialType, setOutwardMaterialType] = useState('All');
  const [outwardSortBy, setOutwardSortBy] = useState('date');
  const [outwardSortOrder, setOutwardSortOrder] = useState('desc');

  const [stockMaterialType, setStockMaterialType] = useState('All');
  const [stockDateStart, setStockDateStart] = useState('');
  const [stockDateEnd, setStockDateEnd] = useState('');
  const [stockPreset, setStockPreset] = useState('all');
  const [customStockStart, setCustomStockStart] = useState('');
  const [customStockEnd, setCustomStockEnd] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, label }

  const [printConfig, setPrintConfig] = useState(null);
  const [inwardTab, setInwardTab] = useState(() => (
    isDigitalPrint ? 'Sublimation Paper' : 'Fabric Material'
  ));
  const [outwardTab, setOutwardTab] = useState(() => (
    isDigitalPrint ? 'Sublimation Paper' : 'Fabric Material'
  ));

  // Modals
  const [isInwardOpen, setIsInwardOpen] = useState(false);
  const [isOutwardOpen, setIsOutwardOpen] = useState(false);

  // Form states
  const [inwardForm, setInwardForm] = useState({
    challanNo: '', vendorName: '', materialName: 'Sublimation Paper', qty: '', unit: 'Rolls', date: new Date().toISOString().split('T')[0], notes: '',
    panna: '', paperQuality: '', metersPerRoll: '', color: '', canSize: ''
  });
  const [outwardForm, setOutwardForm] = useState({
    jobNo: '', partyName: '', materialName: 'Sublimation Paper', qty: '', unit: 'Rolls', date: new Date().toISOString().split('T')[0], notes: '',
    panna: '', paperQuality: '', metersPerRoll: '', color: '', canSize: ''
  });

  const [inwardItems, setInwardItems] = useState([]);
  const [outwardItems, setOutwardItems] = useState([]);


  const handleInwardTabChange = (tabName) => {
    setInwardTab(tabName);
    const defaults = getMaterialDefaults(tabName, printConfig);
    setInwardForm(prev => ({
      ...prev,
      materialName: tabName,
      qty: '',
      notes: '',
      ...defaults
    }));
  };

  const handleOutwardTabChange = (tabName) => {
    setOutwardTab(tabName);
    const defaults = getMaterialDefaults(tabName, printConfig);
    setOutwardForm(prev => ({
      ...prev,
      materialName: tabName,
      qty: '',
      notes: '',
      ...defaults
    }));
  };

  const resolveInkMaterialName = (tabName, colorVal) => {
    const isGrando = (tabName || '').toLowerCase().includes('grando');
    const isPrintdot = (tabName || '').toLowerCase().includes('printdot');
    if (!isGrando && !isPrintdot) return tabName;

    const brand = isGrando ? 'Grando Ink' : 'Printdot Ink';
    const cLower = String(colorVal || '').toLowerCase();

    if (cLower.includes('magenta') || colorVal === 'M') {
      return `${brand} - Magenta (M)`;
    }
    if (cLower.includes('yellow') || colorVal === 'Y') {
      return `${brand} - Yellow (Y)`;
    }
    if (cLower.includes('black') || colorVal === 'K') {
      return `${brand} - Black (K)`;
    }
    if (cLower.includes('clean') || colorVal === 'C.S.' || colorVal === 'CS') {
      return `${brand} - Cleaning Solution (C.S.)`;
    }
    return `${brand} - Cyan (C)`;
  };

  const resolveInkColorName = (colorVal) => {
    const cLower = String(colorVal || '').toLowerCase();
    if (cLower.includes('magenta') || colorVal === 'M') return 'Magenta';
    if (cLower.includes('yellow') || colorVal === 'Y') return 'Yellow';
    if (cLower.includes('black') || colorVal === 'K') return 'Black';
    if (cLower.includes('clean') || colorVal === 'C.S.' || colorVal === 'CS') return 'Cleaning Solution';
    return 'Cyan';
  };

  const resolveInkColorCode = (colorVal) => {
    const cLower = String(colorVal || '').toLowerCase();
    if (cLower.includes('magenta') || colorVal === 'M') return 'M';
    if (cLower.includes('yellow') || colorVal === 'Y') return 'Y';
    if (cLower.includes('black') || colorVal === 'K') return 'K';
    if (cLower.includes('clean') || colorVal === 'C.S.' || colorVal === 'CS') return 'C.S.';
    return 'C';
  };

  // ── Quick Inward: called from dashboard table action buttons ──
  const handleQuickInward = (materialName, pannaOrColor = '', colorKey = '', canSize = null, extraOpts = {}) => {
    setEditingTransaction(null);
    const mat = materialName || 'Sublimation Paper';
    const isGrando = mat.toLowerCase().includes('grando');
    const isPrintdot = mat.toLowerCase().includes('printdot');
    const isInk = isGrando || isPrintdot || mat.toLowerCase().includes('ink');

    let tab = mat;
    if (isGrando) tab = 'Grando Ink';
    else if (isPrintdot) tab = 'Printdot Ink';
    else if (isSublimationTab(mat)) tab = 'Sublimation Paper';
    else if (mat.toLowerCase().includes('butter')) tab = 'Butter Paper';

    setInwardTab(tab);
    const defaults = getMaterialDefaults(tab, printConfig);

    let rawColor = colorKey || (isInk ? pannaOrColor : '') || defaults.color || '';
    const resolvedColorName = isInk ? resolveInkColorName(rawColor) : rawColor;

    let resolvedCanSize = canSize || defaults.canSize || (isGrando ? 5 : isPrintdot ? 10 : '');
    let resolvedUnit = defaults.unit || (isInk ? 'Liters' : 'Rolls');
    if (isGrando && resolvedColorName === 'Cleaning Solution') {
      resolvedCanSize = 1;
      resolvedUnit = 'Bottles';
    }

    const cleanPanna = !isInk && pannaOrColor ? String(pannaOrColor).replace(/[^0-9]/g, '').trim() : '';

    let paperGrade = extraOpts.paperQuality || '';
    if (!isInk && !mat.toLowerCase().includes('butter')) {
      const comb = `${mat} ${extraOpts.paperQuality || ''}`.toLowerCase();
      if (comb.includes('a++')) paperGrade = 'A++';
      else if (comb.includes('a+')) paperGrade = 'A+';
      else if (/\ba\b/.test(comb) || comb.includes('(a)')) paperGrade = 'A';
      else paperGrade = paperGrade || 'A++';
    }

    const defaultVendor = (inwardForm.vendorName || '').trim() || (vendorsList?.[0]?.name) || 'ELITE EDITION';

    setInwardForm(prev => ({
      ...prev,
      ...defaults,
      materialName: tab,
      panna: cleanPanna || prev.panna || defaults.panna || '58',
      paperQuality: paperGrade || prev.paperQuality || defaults.paperQuality || 'A++',
      metersPerRoll: extraOpts.metersPerRoll || prev.metersPerRoll || defaults.metersPerRoll || (tab.toLowerCase().includes('butter') ? 100 : 1000),
      vendorName: prev.vendorName || defaultVendor,
      color: resolvedColorName,
      canSize: resolvedCanSize,
      unit: resolvedUnit,
      qty: '',
      notes: '',
      date: new Date().toISOString().split('T')[0]
    }));
    setInwardItems([]);
    setIsInwardOpen(true);
  };

  // ── Quick Outward: called from dashboard table action buttons ──
  const handleQuickOutward = (materialName, pannaOrColor = '', colorKey = '', canSize = null, extraOpts = {}) => {
    const mat = materialName || 'Sublimation Paper';
    const isGrando = mat.toLowerCase().includes('grando');
    const isPrintdot = mat.toLowerCase().includes('printdot');
    const isInk = isGrando || isPrintdot || mat.toLowerCase().includes('ink');

    let tab = mat;
    if (isGrando) tab = 'Grando Ink';
    else if (isPrintdot) tab = 'Printdot Ink';
    else if (isSublimationTab(mat)) tab = 'Sublimation Paper';
    else if (mat.toLowerCase().includes('butter')) tab = 'Butter Paper';

    setOutwardTab(tab);
    const defaults = getMaterialDefaults(tab, printConfig);

    let rawColor = colorKey || (isInk ? pannaOrColor : '') || defaults.color || '';
    const resolvedColorName = isInk ? resolveInkColorName(rawColor) : rawColor;

    let resolvedCanSize = canSize || defaults.canSize || (isGrando ? 5 : isPrintdot ? 10 : '');
    let resolvedUnit = defaults.unit || (isInk ? 'Liters' : 'Rolls');
    if (isGrando && resolvedColorName === 'Cleaning Solution') {
      resolvedCanSize = 1;
      resolvedUnit = 'Bottles';
    }

    const cleanPanna = !isInk && pannaOrColor ? String(pannaOrColor).replace(/[^0-9]/g, '').trim() : '';

    let paperGrade = extraOpts.paperQuality || '';
    if (!isInk && !mat.toLowerCase().includes('butter')) {
      const comb = `${mat} ${extraOpts.paperQuality || ''}`.toLowerCase();
      if (comb.includes('a++')) paperGrade = 'A++';
      else if (comb.includes('a+')) paperGrade = 'A+';
      else if (/\ba\b/.test(comb) || comb.includes('(a)')) paperGrade = 'A';
      else paperGrade = paperGrade || 'A++';
    }

    setOutwardForm(prev => ({
      ...prev,
      ...defaults,
      materialName: tab,
      panna: cleanPanna || prev.panna || defaults.panna || '58',
      paperQuality: paperGrade || prev.paperQuality || defaults.paperQuality || 'A++',
      metersPerRoll: extraOpts.metersPerRoll || prev.metersPerRoll || defaults.metersPerRoll || (tab.toLowerCase().includes('butter') ? 100 : 1000),
      color: resolvedColorName,
      canSize: resolvedCanSize,
      unit: resolvedUnit,
      qty: '',
      notes: '',
      date: new Date().toISOString().split('T')[0]
    }));
    setOutwardItems([]);
    setIsOutwardOpen(true);
  };



  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch PrintConfig to get custom list of raw materials if saved (digital print only)
      if (isDigitalPrint) {
        try {
          const cfg = await api.getPrintConfig();
          if (cfg) {
            setPrintConfig(cfg);
            if (Array.isArray(cfg.rawMaterials) && cfg.rawMaterials.length > 0) {
              setMaterialsList(cfg.rawMaterials);
            }
            if (cfg.parties) setPartiesList(cfg.parties);
          }
        } catch (e) {
          console.warn('Failed to fetch print config:', e);
        }
      }

      // 2. Fetch vendors list
      try {
        const vRes = await api.getFabricVendors();
        if (vRes) setVendorsList(vRes);
      } catch (e) {
        console.warn('Failed to fetch vendors:', e);
      }

      // 3. Fetch Stock Overview
      const stockRes = await api.getRawMaterialStock({ companyEntity });
      if (stockRes.success && Array.isArray(stockRes.data)) {
        setStock(stockRes.data);
        if (!isDigitalPrint) {
          const extraMaterials = [...new Set(stockRes.data.map(s => s.materialName).filter(Boolean))]
            .filter(name => !/(ink|sublimation|butter\s*paper|butterpaper|grando|printdot|cmyk)/i.test(name));
          if (extraMaterials.length > 0) {
            setMaterialsList(prev => [...new Set([...prev, ...extraMaterials])]);
          }
        }
      }

      // 4. Fetch Transactions
      const transRes = await api.getRawMaterialTransactions({ companyEntity });
      if (transRes.success) setTransactions(transRes.data);

    } catch (err) {
      setError(err.message || 'Failed to load raw materials inventory.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSisterTransfers = useCallback(async () => {
    try {
      setSisterLoading(true);
      const res = await api.getSisterTransfers({
        companyEntity,
        status: sisterStatusFilter,
        search: sisterSearch
      });
      if (res && res.success) {
        setSisterTransfers(res.data || []);
        if (res.stats) setSisterStats(res.stats);
      }
    } catch (err) {
      console.warn('Failed to fetch sister company transfers:', err);
    } finally {
      setSisterLoading(false);
    }
  }, [companyEntity, sisterStatusFilter, sisterSearch]);

  useEffect(() => {
    fetchSisterTransfers();
  }, [fetchSisterTransfers]);

  const openVerifyModal = (tx, action = 'VERIFY') => {
    setSelectedSisterTx(tx);
    setVerifyAction(action);
    setVerifyQty(tx.verifiedQty != null ? String(tx.verifiedQty) : String(tx.qty || ''));
    setVerifyNotes(tx.verificationNotes || '');
    setDiscrepancyReason(tx.discrepancyReason || '');
    setVerifyModalOpen(true);
  };

  const handleVerifySubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedSisterTx) return;

    if (verifyAction === 'REJECT' && !discrepancyReason.trim()) {
      alert('Please enter a discrepancy reason for rejecting this inward material.');
      return;
    }

    setSubmittingVerify(true);
    try {
      const res = await api.verifySisterTransfer(selectedSisterTx._id, {
        action: verifyAction,
        verifiedQty: parseFloat(verifyQty) >= 0 ? parseFloat(verifyQty) : selectedSisterTx.qty,
        verificationNotes: verifyNotes.trim(),
        discrepancyReason: discrepancyReason.trim(),
        verifiedBy: currentUser?.name || currentUser?.username || 'Staff'
      });

      if (res && res.success) {
        setVerifyModalOpen(false);
        setSelectedSisterTx(null);
        await fetchSisterTransfers();
        await fetchData();
      } else {
        alert(res?.error || 'Failed to update verification status.');
      }
    } catch (err) {
      alert('Verification error: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmittingVerify(false);
    }
  };

  useEffect(() => {
    // Clear previously cached stock and transactions when companyEntity changes
    setStock([]);
    setTransactions([]);
    if (isDigitalPrint) {
      setMaterialsList(['Sublimation Paper', 'Butter Paper', 'Grando Ink', 'Printdot Ink']);
    } else {
      const storageKey = `elite_custom_materials_${String(companyEntity || '').toLowerCase().replace(/\s+/g, '_')}`;
      let saved = [];
      try {
        saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      } catch (e) {}
      const defaultGarment = [
        'Viscose Rayon Fabric',
        'Cotton Fabric',
        'Georgette Fabric',
        'Polyester Sewing Thread',
        'Buttons & Fasteners',
        'Zippers & Sliders',
        'Knitted / Woven Elastic',
        'Laces & Borders',
        'Fusing / Interlining',
        'Brand Labels & Tags',
        'Packaging Material'
      ];
      setMaterialsList([...new Set([...defaultGarment, ...saved])]);
    }
    fetchData();
  }, [companyEntity]);

  useEffect(() => {
    const fetchStock = async () => {
      try {
        const stockParams = { companyEntity };
        if (stockPreset && stockPreset !== 'all') {
          const range = getDatePresetRange(stockPreset, customStockStart, customStockEnd);
          if (range.dateStart) stockParams.dateStart = range.dateStart;
          if (range.dateEnd) stockParams.dateEnd = range.dateEnd;
        } else {
          if (stockDateStart) stockParams.dateStart = stockDateStart;
          if (stockDateEnd) stockParams.dateEnd = stockDateEnd;
        }
        const stockRes = await api.getRawMaterialStock(stockParams);
        if (stockRes && stockRes.success) setStock(stockRes.data);
      } catch (e) {
        console.warn('Failed to fetch stock for date range:', e);
      }
    };
    fetchStock();
  }, [stockPreset, stockDateStart, stockDateEnd, customStockStart, customStockEnd, companyEntity]);

  const isSublimationTab = (tab) => {
    const t = String(tab || '').trim().toLowerCase();
    return t.includes('sublimation') || ['a++', 'a+', 'a'].includes(t);
  };

  // Helper to get defaults for a material
  const getMaterialDefaults = (materialName, configData) => {
    const val = materialName || '';
    const isSublimation = isSublimationTab(val);
    const isButter = val.toLowerCase().includes('butter');
    const isGrando = val.toLowerCase().includes('grando');
    const isPrintdot = val.toLowerCase().includes('printdot');

    let extra = {
      panna: '',
      paperQuality: '',
      metersPerRoll: '',
      color: '',
      canSize: '',
      unit: 'Rolls'
    };

    if (isSublimation) {
      extra = {
        panna: configData?.widths?.[0] ? String(configData.widths[0]).replace(/[^0-9]/g, '') : '58',
        paperQuality: configData?.paperTypes?.[0] || 'A++',
        metersPerRoll: 1000,
        color: '',
        canSize: '',
        unit: 'Rolls'
      };
    } else if (isButter) {
      extra = {
        panna: configData?.widths?.[0] || '44',
        paperQuality: '',
        metersPerRoll: 100,
        color: '',
        canSize: '',
        unit: 'Rolls'
      };
    } else if (isGrando) {
      extra = {
        panna: '',
        paperQuality: '',
        metersPerRoll: '',
        color: configData?.inkColors?.[0] || 'C',
        canSize: 5,
        unit: 'Cans'
      };
    } else if (isPrintdot) {
      extra = {
        panna: '',
        paperQuality: '',
        metersPerRoll: '',
        color: configData?.inkColors?.[0] || 'C',
        canSize: 10,
        unit: 'Cans'
      };
    } else {
      extra.unit = val.toLowerCase().includes('ink') ? 'Liters' : 'Rolls';
    }
    return extra;
  };

  // Setup default material in forms when list/config loads
  useEffect(() => {
    if (materialsList.length > 0) {
      const firstMat = materialsList[0];
      const defaults = getMaterialDefaults(firstMat, printConfig);
      setInwardForm(prev => ({ ...prev, materialName: firstMat, ...defaults }));
      setOutwardForm(prev => ({ ...prev, materialName: firstMat, ...defaults }));
    }
  }, [materialsList, printConfig]);

  // Autofill unit depending on selected raw material
  const handleMaterialChange = (type, value) => {
    const defaults = getMaterialDefaults(value, printConfig);
    if (type === 'inward') {
      setInwardForm(prev => ({ ...prev, materialName: value, ...defaults }));
    } else {
      setOutwardForm(prev => ({ ...prev, materialName: value, ...defaults }));
    }
  };

  const handleColorChange = (type, materialName, colorValue) => {
    const isGrando = materialName.toLowerCase().includes('grando');
    const isPrintdot = materialName.toLowerCase().includes('printdot');
    const colorName = resolveInkColorName(colorValue);

    let canSize = 5;
    let unit = 'Liters';

    if (isGrando) {
      if (colorName === 'Cleaning Solution' || colorValue === 'C.S.' || colorValue === 'CS') {
        canSize = 1;
        unit = 'Bottles';
      } else {
        canSize = 5;
        unit = 'Liters';
      }
    } else if (isPrintdot) {
      canSize = 10;
      unit = 'Liters';
    }

    if (type === 'inward') {
      setInwardForm(prev => ({ ...prev, color: colorName, canSize, unit }));
    } else {
      setOutwardForm(prev => ({ ...prev, color: colorName, canSize, unit }));
    }
  };

  const validateItem = (tabName, qty, metersPerRoll, canSize) => {
    if (!qty || Number(qty) <= 0) {
      return 'Please enter a valid quantity.';
    }
    const isGrando = (tabName || '').toLowerCase().includes('grando');
    const isPrintdot = (tabName || '').toLowerCase().includes('printdot');

    if ((isGrando || isPrintdot) && (!canSize || parseCanSize(canSize) <= 0)) {
      return 'Please enter a valid can/bottle size.';
    }
    return null;
  };

  const addInwardItemToList = () => {
    const err = validateItem(inwardTab, inwardForm.qty, inwardForm.metersPerRoll, inwardForm.canSize);
    if (err) {
      alert(err);
      return;
    }

    const isInkTab = inwardTab.toLowerCase().includes('grando') || inwardTab.toLowerCase().includes('printdot');
    const matName = isInkTab ? resolveInkMaterialName(inwardTab, inwardForm.color) : inwardTab;
    const colorVal = isInkTab ? resolveInkColorName(inwardForm.color) : (inwardForm.color || '');
    const isPaper = isSublimationTab(inwardTab) || inwardTab.toLowerCase().includes('paper');
    const cleanPanna = inwardForm.panna ? String(inwardForm.panna).replace(/[^0-9]/g, '').trim() : '';
    const paperQual = isPaper ? (inwardForm.paperQuality || 'A++') : '';
    const mtrRoll = inwardForm.metersPerRoll ? Number(inwardForm.metersPerRoll) : (isPaper ? 1000 : '');
    const vendorVal = (inwardForm.vendorName || '').trim() || 'ELITE EDITION';

    const itemToAdd = {
      materialName: matName,
      qty: Number(inwardForm.qty),
      unit: inwardForm.unit || (isInkTab ? 'Liters' : 'Rolls'),
      panna: cleanPanna || (isPaper ? '58' : ''),
      paperQuality: paperQual,
      color: colorVal,
      canSize: inwardForm.canSize ? parseCanSize(inwardForm.canSize) : (isInkTab ? (colorVal === 'Cleaning Solution' ? 1 : 5) : ''),
      metersPerRoll: mtrRoll,
      challanNo: inwardForm.challanNo,
      vendorName: vendorVal,
      date: inwardForm.date,
      notes: inwardForm.notes,
    };
    setInwardItems(prev => [...prev, itemToAdd]);
    // Clear qty
    setInwardForm(prev => ({ ...prev, qty: '' }));
  };

  const addOutwardItemToList = () => {
    const err = validateItem(outwardTab, outwardForm.qty, outwardForm.metersPerRoll, outwardForm.canSize);
    if (err) {
      alert(err);
      return;
    }

    const isInkTab = outwardTab.toLowerCase().includes('grando') || outwardTab.toLowerCase().includes('printdot');
    const matName = isInkTab ? resolveInkMaterialName(outwardTab, outwardForm.color) : outwardTab;
    const colorVal = isInkTab ? resolveInkColorName(outwardForm.color) : (outwardForm.color || '');
    const isPaper = isSublimationTab(outwardTab) || outwardTab.toLowerCase().includes('paper');
    const cleanPanna = outwardForm.panna ? String(outwardForm.panna).replace(/[^0-9]/g, '').trim() : '';
    const paperQual = isPaper ? (outwardForm.paperQuality || 'A++') : '';
    const mtrRoll = outwardForm.metersPerRoll ? Number(outwardForm.metersPerRoll) : (isPaper ? 1000 : '');

    const itemToAdd = {
      materialName: matName,
      qty: Number(outwardForm.qty),
      unit: outwardForm.unit || (isInkTab ? 'Liters' : 'Rolls'),
      panna: cleanPanna || (isPaper ? '58' : ''),
      paperQuality: paperQual,
      color: colorVal,
      canSize: outwardForm.canSize ? parseCanSize(outwardForm.canSize) : (isInkTab ? (colorVal === 'Cleaning Solution' ? 1 : 5) : ''),
      metersPerRoll: mtrRoll,
      jobNo: outwardForm.jobNo,
      partyName: outwardForm.partyName,
      date: outwardForm.date,
      notes: outwardForm.notes,
    };
    setOutwardItems(prev => [...prev, itemToAdd]);
    // Clear qty
    setOutwardForm(prev => ({ ...prev, qty: '' }));
  };

  // ── Create New Garment Raw Material Catalog Entry ──
  const handleCreateNewMaterial = async (e) => {
    e.preventDefault();
    if (!newMaterialForm.materialName || !newMaterialForm.materialName.trim()) {
      alert('Please enter a valid raw material name');
      return;
    }
    setNewMaterialSubmitting(true);
    try {
      const matName = newMaterialForm.materialName.trim();
      const initQty = parseFloat(newMaterialForm.initialQty) || 0;
      const rate = parseFloat(newMaterialForm.unitRate) || 0;
      const reorder = parseFloat(newMaterialForm.reorderLevel) || 10;

      const payload = {
        companyEntity: companyEntity || 'Elite Edition',
        materialName: matName,
        category: newMaterialForm.category || 'Fabric',
        unit: newMaterialForm.unit || 'Meters',
        shade: newMaterialForm.shade ? newMaterialForm.shade.trim() : '',
        panna: newMaterialForm.panna ? String(newMaterialForm.panna).trim() : '',
        hsnCode: newMaterialForm.hsnCode ? newMaterialForm.hsnCode.trim() : '',
        location: newMaterialForm.location ? newMaterialForm.location.trim() : '',
        reorderLevel: reorder,
        quantity: initQty,
        unitPrice: rate,
        totalAmount: initQty * rate,
        vendor: 'Opening Stock / Direct Entry',
        challanNo: 'OPENING-STOCK',
        billDate: new Date().toISOString().split('T')[0],
        date: new Date().toISOString().split('T')[0],
        remarks: newMaterialForm.notes || 'Opening stock & material catalog initialization'
      };

      await api.createRawMaterialInward(payload);

      // Persist in custom materials cache
      const storageKey = `elite_custom_materials_${String(companyEntity || '').toLowerCase().replace(/\s+/g, '_')}`;
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (!saved.includes(matName)) {
          saved.push(matName);
          localStorage.setItem(storageKey, JSON.stringify(saved));
        }
      } catch (err) {}

      setMaterialsList(prev => [...new Set([...prev, matName])]);
      setIsNewMaterialModalOpen(false);
      setNewMaterialForm({
        materialName: '',
        category: 'Fabric',
        unit: 'Meters',
        shade: '',
        panna: '',
        hsnCode: '',
        location: '',
        initialQty: '',
        unitRate: '',
        reorderLevel: '10',
        notes: ''
      });
      await fetchData();
    } catch (err) {
      alert('Failed to add raw material: ' + (err.message || 'Server error'));
    } finally {
      setNewMaterialSubmitting(false);
    }
  };

  const handleInwardSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let payload = [...inwardItems].map(item => ({
        companyEntity: item.companyEntity || companyEntity || 'Elite Digital Print',
        ...item
      }));
      if (payload.length === 0) {
        const err = validateItem(inwardTab, inwardForm.qty, inwardForm.metersPerRoll, inwardForm.canSize);
        if (err) {
          alert(err);
          setLoading(false);
          return;
        }

        const isInkTab = inwardTab.toLowerCase().includes('grando') || inwardTab.toLowerCase().includes('printdot');
        const matName = isInkTab ? resolveInkMaterialName(inwardTab, inwardForm.color) : inwardTab;
        const colorVal = isInkTab ? resolveInkColorName(inwardForm.color) : (inwardForm.color || '');
        const isPaper = isSublimationTab(inwardTab) || inwardTab.toLowerCase().includes('paper');
        const cleanPanna = inwardForm.panna ? String(inwardForm.panna).replace(/[^0-9]/g, '').trim() : '';
        const paperQual = isPaper ? (inwardForm.paperQuality || 'A++') : '';
        const mtrRoll = inwardForm.metersPerRoll ? Number(inwardForm.metersPerRoll) : (isPaper ? 1000 : '');
        const vendorVal = (inwardForm.vendorName || '').trim() || 'ELITE EDITION';

        payload = [{
          companyEntity: companyEntity || 'Elite Digital Print',
          materialName: matName,
          qty: Number(inwardForm.qty),
          unit: inwardForm.unit || (isInkTab ? 'Liters' : 'Rolls'),
          panna: cleanPanna || (isPaper ? '58' : ''),
          paperQuality: paperQual,
          color: colorVal,
          canSize: inwardForm.canSize ? parseCanSize(inwardForm.canSize) : (isInkTab ? (colorVal === 'Cleaning Solution' ? 1 : 5) : ''),
          metersPerRoll: mtrRoll,
          challanNo: inwardForm.challanNo,
          vendorName: vendorVal,
          date: inwardForm.date,
          notes: inwardForm.notes,
        }];
      }
      if (editingTransaction) {
        await api.updateRawMaterialTransaction(editingTransaction._id, payload[0]);
      } else {
        await api.createRawMaterialInward(payload);
      }
      setIsInwardOpen(false);
      setEditingTransaction(null);
      const firstMat = materialsList[0] || 'Sublimation Paper';
      const defaults = getMaterialDefaults(firstMat, printConfig);
      setInwardForm({
        challanNo: '', vendorName: '', materialName: firstMat, qty: '', date: new Date().toISOString().split('T')[0], notes: '', ...defaults
      });
      setInwardItems([]);
      fetchData();
    } catch (err) {
      alert(err.message);
      setLoading(false);
    }
  };

  const handleOutwardSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let payload = [...outwardItems].map(item => ({
        companyEntity: item.companyEntity || companyEntity || 'Elite Digital Print',
        ...item
      }));
      if (payload.length === 0) {
        const err = validateItem(outwardTab, outwardForm.qty, outwardForm.metersPerRoll, outwardForm.canSize);
        if (err) {
          alert(err);
          setLoading(false);
          return;
        }

        const isInkTab = outwardTab.toLowerCase().includes('grando') || outwardTab.toLowerCase().includes('printdot');
        const matName = isInkTab ? resolveInkMaterialName(outwardTab, outwardForm.color) : outwardTab;
        const colorVal = isInkTab ? resolveInkColorName(outwardForm.color) : (outwardForm.color || '');
        const isPaper = isSublimationTab(outwardTab) || outwardTab.toLowerCase().includes('paper');
        const cleanPanna = outwardForm.panna ? String(outwardForm.panna).replace(/[^0-9]/g, '').trim() : '';
        const paperQual = isPaper ? (outwardForm.paperQuality || 'A++') : '';
        const mtrRoll = outwardForm.metersPerRoll ? Number(outwardForm.metersPerRoll) : (isPaper ? 1000 : '');

        payload = [{
          companyEntity: companyEntity || 'Elite Digital Print',
          materialName: matName,
          qty: Number(outwardForm.qty),
          unit: outwardForm.unit || (isInkTab ? 'Liters' : 'Rolls'),
          panna: cleanPanna || (isPaper ? '58' : ''),
          paperQuality: paperQual,
          color: colorVal,
          canSize: outwardForm.canSize ? parseCanSize(outwardForm.canSize) : (isInkTab ? (colorVal === 'Cleaning Solution' ? 1 : 5) : ''),
          metersPerRoll: mtrRoll,
          jobNo: outwardForm.jobNo,
          partyName: outwardForm.partyName,
          date: outwardForm.date,
          notes: outwardForm.notes,
        }];
      }
      await api.createRawMaterialOutward(payload);
      setIsOutwardOpen(false);
      const firstMat = materialsList[0] || 'Sublimation Paper';
      const defaults = getMaterialDefaults(firstMat, printConfig);
      setOutwardForm({
        jobNo: '', partyName: '', materialName: firstMat, qty: '', date: new Date().toISOString().split('T')[0], notes: '', ...defaults
      });
      setOutwardItems([]);
      fetchData();
    } catch (err) {
      alert(err.message);
      setLoading(false);
    }
  };

  const startEditInward = (t) => {
    setEditingTransaction(t);
    setInwardTab(t.materialName || 'Sublimation Paper');
    setInwardForm({
      challanNo: t.challanNo || '',
      vendorName: t.vendorName || '',
      materialName: t.materialName || '',
      qty: t.qty || '',
      date: t.date ? new Date(t.date).toISOString().split('T')[0] : '',
      notes: t.notes || '',
      panna: t.panna || '',
      paperQuality: t.paperQuality || '',
      color: t.color || '',
      canSize: t.canSize || '',
      metersPerRoll: t.metersPerRoll || '',
      unit: t.unit || 'Rolls'
    });
    setIsInwardOpen(true);
  };

  const closeInwardModal = () => {
    setIsInwardOpen(false);
    setEditingTransaction(null);
    const firstMat = materialsList[0] || 'Sublimation Paper';
    const defaults = getMaterialDefaults(firstMat, printConfig);
    setInwardForm({
      challanNo: '', vendorName: '', materialName: firstMat, qty: '', date: new Date().toISOString().split('T')[0], notes: '', ...defaults
    });
    setInwardItems([]);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteRawMaterialTransaction(deleteTarget.id);
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const handleDownloadScreenPdf = async () => {
    try {
      setPdfLoading(true);
      let ds = '';
      let de = '';
      let mat = '';
      let typeVal = 'All';
      let searchVal = '';

      if (activeTab === 'inward') {
        typeVal = 'INWARD';
        if (inwardPreset && inwardPreset !== 'all') {
          const range = getDatePresetRange(inwardPreset, customInwardStart, customInwardEnd);
          ds = range.dateStart || '';
          de = range.dateEnd || '';
        } else {
          ds = inwardDateStart || '';
          de = inwardDateEnd || '';
        }
        mat = inwardMaterialType !== 'All' ? inwardMaterialType : '';
        searchVal = inwardSearch || '';
      } else if (activeTab === 'outward') {
        typeVal = 'OUTWARD';
        if (outwardPreset && outwardPreset !== 'all') {
          const range = getDatePresetRange(outwardPreset, customOutwardStart, customOutwardEnd);
          ds = range.dateStart || '';
          de = range.dateEnd || '';
        } else {
          ds = outwardDateStart || '';
          de = outwardDateEnd || '';
        }
        mat = outwardMaterialType !== 'All' ? outwardMaterialType : '';
        searchVal = outwardSearch || '';
      } else if (activeTab === 'dashboard') {
        typeVal = 'All';
        if (stockPreset && stockPreset !== 'all') {
          const range = getDatePresetRange(stockPreset, customStockStart, customStockEnd);
          ds = range.dateStart || '';
          de = range.dateEnd || '';
        } else {
          ds = stockDateStart || '';
          de = stockDateEnd || '';
        }
        mat = stockMaterialType !== 'All' ? stockMaterialType : '';
      }

      await api.downloadRawMaterialLedgerPdf({
        type: typeVal,
        materialName: mat,
        dateStart: ds,
        dateEnd: de,
        search: searchVal,
        companyEntity: companyEntity || 'Elite Digital Print'
      });
    } catch (err) {
      alert('Failed to download PDF report: ' + err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  // Filter local registers
  const toYYYYMMDD = (d) => {
    if (!d) return '';
    try {
      if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) return d.trim();
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return '';
      const yr = dt.getFullYear();
      const mo = String(dt.getMonth() + 1).padStart(2, '0');
      const dy = String(dt.getDate()).padStart(2, '0');
      return `${yr}-${mo}-${dy}`;
    } catch (e) {
      return '';
    }
  };

  const matchesMaterialType = (materialName, filterType) => {
    if (!filterType || filterType === 'All') return true;
    if (!materialName) return false;
    const name = String(materialName).trim().toLowerCase();
    const target = String(filterType).trim().toLowerCase();
    const isPaperGrade = ['a++', 'a+', 'a'].includes(name);
    if (target === 'ink' || target === 'all inks') return name.includes('ink');
    if (target === 'paper' || target === 'all papers') return name.includes('paper') || isPaperGrade;
    if (target === 'butter paper' || target === 'butter') return name.includes('butter');
    if (target === 'sublimation paper' || target === 'sublimation') return name.includes('sublimation') || isPaperGrade;
    return name.includes(target) || target.includes(name);
  };

  const inwardTx = transactions.filter(t => {
    if (t.type !== 'INWARD') return false;
    const tDateYMD = toYYYYMMDD(t.date);
    if (inwardDateStart && tDateYMD < inwardDateStart) return false;
    if (inwardDateEnd && tDateYMD > inwardDateEnd) return false;
    if (!matchesMaterialType(t.materialName, inwardMaterialType)) return false;
    if (!inwardSearch) return true;
    const s = inwardSearch.toLowerCase();
    return (t.materialName || '').toLowerCase().includes(s)
      || (t.vendorName || '').toLowerCase().includes(s)
      || (t.challanNo || '').toLowerCase().includes(s)
      || (t.panna || '').toLowerCase().includes(s)
      || (t.paperQuality || '').toLowerCase().includes(s)
      || (t.color || '').toLowerCase().includes(s)
      || (t.notes || '').toLowerCase().includes(s);
  }).sort((a, b) => {
    let valA = a[inwardSortBy];
    let valB = b[inwardSortBy];
    if (inwardSortBy === 'date') {
      valA = new Date(a.date).getTime();
      valB = new Date(b.date).getTime();
    }
    if (valA < valB) return inwardSortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return inwardSortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const outwardTx = transactions.filter(t => {
    if (t.type !== 'OUTWARD') return false;
    const tDateYMD = toYYYYMMDD(t.date);
    if (outwardDateStart && tDateYMD < outwardDateStart) return false;
    if (outwardDateEnd && tDateYMD > outwardDateEnd) return false;
    if (!matchesMaterialType(t.materialName, outwardMaterialType)) return false;
    if (!outwardSearch) return true;
    const s = outwardSearch.toLowerCase();
    return (t.materialName || '').toLowerCase().includes(s)
      || (t.partyName || '').toLowerCase().includes(s)
      || (t.jobNo || '').toLowerCase().includes(s)
      || (t.panna || '').toLowerCase().includes(s)
      || (t.paperQuality || '').toLowerCase().includes(s)
      || (t.color || '').toLowerCase().includes(s)
      || (t.notes || '').toLowerCase().includes(s);
  }).sort((a, b) => {
    let valA = a[outwardSortBy];
    let valB = b[outwardSortBy];
    if (outwardSortBy === 'date') {
      valA = new Date(a.date).getTime();
      valB = new Date(b.date).getTime();
    }
    if (valA < valB) return outwardSortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return outwardSortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const stockFilteredTx = transactions.filter(t => {
    let ds = stockDateStart;
    let de = stockDateEnd;
    if (stockPreset && stockPreset !== 'all') {
      const range = getDatePresetRange(stockPreset, customStockStart, customStockEnd);
      ds = range.dateStart || '';
      de = range.dateEnd || '';
    }
    const tDateYMD = toYYYYMMDD(t.date);
    if (ds && tDateYMD < ds) return false;
    if (de && tDateYMD > de) return false;
    return true;
  });

  const filteredStock = stock.filter(item => {
    // 1. Material dropdown filter
    if (stockMaterialType && stockMaterialType !== 'All' && !matchesMaterialType(item.materialName, stockMaterialType)) {
      return false;
    }
    // 2. Garment Category filter
    if (categoryFilter && categoryFilter !== 'All') {
      const itemCat = String(item.category || '').toLowerCase();
      const filterCat = String(categoryFilter).toLowerCase();
      if (filterCat === 'fabric') {
        if (!itemCat.includes('fabric')) return false;
      } else if (filterCat === 'trims & thread') {
        if (!itemCat.includes('trim') && !itemCat.includes('thread')) return false;
      } else if (filterCat === 'buttons & fasteners') {
        if (!itemCat.includes('button') && !itemCat.includes('fastener')) return false;
      } else if (filterCat === 'elastics & laces') {
        if (!itemCat.includes('elastic') && !itemCat.includes('lace')) return false;
      } else if (filterCat === 'interlining & fusing') {
        if (!itemCat.includes('interlining') && !itemCat.includes('fusing')) return false;
      } else if (filterCat === 'labels & tags') {
        if (!itemCat.includes('label') && !itemCat.includes('tag')) return false;
      } else if (filterCat === 'packing material') {
        if (!itemCat.includes('pack')) return false;
      } else if (itemCat !== filterCat) {
        return false;
      }
    }
    // 3. Search query filter
    if (stockSearchQuery && stockSearchQuery.trim()) {
      const q = stockSearchQuery.toLowerCase().trim();
      const matchesName = String(item.materialName || '').toLowerCase().includes(q);
      const matchesCat = String(item.category || '').toLowerCase().includes(q);
      const matchesShade = String(item.shade || '').toLowerCase().includes(q);
      const matchesLoc = String(item.location || '').toLowerCase().includes(q);
      const matchesHsn = String(item.hsnCode || '').toLowerCase().includes(q);
      if (!matchesName && !matchesCat && !matchesShade && !matchesLoc && !matchesHsn) return false;
    }
    return true;
  });

  const renderMaterialCell = (t) => {
    const nameLower = (t.materialName || '').toLowerCase();
    const isPaperGrade = ['a++', 'a+', 'a'].includes(nameLower);
    const details = [];
    if (nameLower.includes('sublimation') || isPaperGrade) {
      if (t.paperQuality) details.push(`Qual: ${t.paperQuality}`);
      if (t.metersPerRoll) details.push(`${t.metersPerRoll}m`);
    } else if (nameLower.includes('butter')) {
      if (t.metersPerRoll) details.push(`${t.metersPerRoll}m`);
    } else if (nameLower.includes('ink')) {
      if (t.color) details.push(t.color);
      if (t.canSize) details.push(`${t.canSize} Ltr`);
    }
    
    const title = isPaperGrade ? `Sublimation Paper (${t.materialName})` : t.materialName;

    return (
      <div>
        <div style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span>{title}</span>
          {t.panna && (
            <span style={{ fontSize: '0.72rem', background: 'rgba(59, 130, 246, 0.18)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.35)', borderRadius: '4px', padding: '1px 6px', fontWeight: 600 }}>
              📐 {t.panna}
            </span>
          )}
        </div>
        {details.length > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            {details.join(' • ')}
          </div>
        )}
      </div>
    );
  };

  const renderDynamicFormFields = (formType, formVal, setFormVal) => {
    const val = formVal.materialName || '';
    const isPaperGrade = ['a++', 'a+', 'a'].includes(val.toLowerCase());
    const isSublimation = val.toLowerCase().includes('sublimation') || isPaperGrade;
    const isButter = val.toLowerCase().includes('butter');
    const isInk = val.toLowerCase().includes('ink');
    const isGrando = val.toLowerCase().includes('grando');

    if (isSublimation) {
      return (
        <div style={{ display: 'flex', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-light)', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Panna (Width)</label>
              <select
                style={inputStyle}
                value={formVal.panna}
                onChange={e => setFormVal(p => ({ ...p, panna: e.target.value }))}
              >
                {printConfig?.widths?.map(p => <option key={p} value={p}>{p}"</option>) || <option value="44">44"</option>}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Paper Quality</label>
              <select
                style={inputStyle}
                value={formVal.paperQuality}
                onChange={e => setFormVal(p => ({ ...p, paperQuality: e.target.value }))}
              >
                {printConfig?.paperTypes?.map(q => <option key={q} value={q}>{q}</option>) || <option value="70 GSM">70 GSM</option>}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Mtr per Roll</label>
              <input
                type="number"
                style={inputStyle}
                value={formVal.metersPerRoll}
                onChange={e => setFormVal(p => ({ ...p, metersPerRoll: e.target.value }))}
                placeholder="e.g. 100"
              />
            </div>
          </div>
        </div>
      );
    }

    if (isButter) {
      return (
        <div style={{ display: 'flex', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Panna (Width)</label>
            <select
              style={inputStyle}
              value={formVal.panna}
              onChange={e => setFormVal(p => ({ ...p, panna: e.target.value }))}
            >
              {printConfig?.widths?.map(p => <option key={p} value={p}>{p}"</option>) || <option value="44">44"</option>}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Mtr per Roll</label>
            <input
              type="number"
              style={inputStyle}
              value={formVal.metersPerRoll}
              onChange={e => setFormVal(p => ({ ...p, metersPerRoll: e.target.value }))}
              placeholder="e.g. 100"
            />
          </div>
        </div>
      );
    }

    if (isInk) {
      const colors = isGrando ? (printConfig?.inkColors || ['C', 'M', 'Y', 'K', 'C.S.']) : ['C', 'M', 'Y', 'K'];
      return (
        <div style={{ display: 'flex', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Color</label>
            <select
              style={inputStyle}
              value={formVal.color}
              onChange={e => handleColorChange(formType, formVal.materialName, e.target.value)}
            >
              {colors.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Can/Bottle Size (Ltr)</label>
            <input
              type="number"
              style={inputStyle}
              value={formVal.canSize}
              onChange={e => setFormVal(p => ({ ...p, canSize: e.target.value }))}
              placeholder="e.g. 5"
            />
          </div>
        </div>
      );
    }

    return null;
  };

  const inputStyle = {
    width: '100%', padding: '0.5rem', borderRadius: '4px',
    border: '1px solid var(--border-light)', background: 'var(--nav-bg)',
    color: 'var(--text-primary)', boxSizing: 'border-box'
  };

  const labelStyle = {
    display: 'block', fontSize: '0.75rem', marginBottom: '0.3rem', fontWeight: 600
  };

  const tabs = [
    { id: 'dashboard', label: 'Stock Overview', icon: Database },
    {
      id: 'sister_inward',
      label: 'Sister Inward Check',
      icon: ShieldCheck,
      badge: sisterStats.pendingCount > 0 ? sisterStats.pendingCount : null,
      badgeColor: '#f59e0b'
    },
    { id: 'inward', label: 'Inward Register', icon: ArrowDownToLine },
    { id: 'outward', label: 'Outward Register', icon: ArrowUpFromLine },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      {/* Header & Navigation */}
      <div className="glass-panel" style={{ display: 'flex', gap: '1rem', padding: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={isActive ? 'btn-primary' : 'btn-secondary'}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  position: 'relative'
                }}
              >
                <tab.icon size={16} />
                <span>{tab.label}</span>
                {tab.badge != null && (
                  <span
                    style={{
                      background: tab.badgeColor || '#ef4444',
                      color: '#ffffff',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '10px',
                      marginLeft: '2px',
                      animation: 'pulse 2s infinite'
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={handleDownloadScreenPdf}
          className="btn-secondary"
          disabled={pdfLoading}
          title={`Download ${activeTab === 'inward' ? 'Inward Register' : activeTab === 'outward' ? 'Outward Register' : 'Stock Overview'} PDF Report`}
          style={{ gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
        >
          {pdfLoading ? <RefreshCw className="spin-loader" size={16} /> : <FileDown size={16} />}
          PDF Report
        </button>
      </div>

      {error && <div style={{ color: 'red', padding: '1rem', background: '#ffebeb', borderRadius: '8px' }}>{error}</div>}

      {/* Main Content Area */}
      <div className="glass-panel" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.25rem', fontWeight: 800 }}>
                  <Layers size={22} color="var(--primary)" /> Raw Materials Stock Overview
                </h2>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {companyEntity} · Garment Industry Materials Catalog & Inventory Tracking
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Standard ERP DateRangePicker */}
                <DateRangePicker
                  preset={stockPreset}
                  onChange={({ preset: p, dateStart: ds, dateEnd: de }) => {
                    setStockPreset(p);
                    setStockDateStart(ds);
                    setStockDateEnd(de);
                  }}
                  customStart={customStockStart}
                  customEnd={customStockEnd}
                  onCustomChange={(s, e) => {
                    setCustomStockStart(s);
                    setCustomStockEnd(e);
                  }}
                />

                <button
                  type="button"
                  onClick={() => setIsNewMaterialModalOpen(true)}
                  className="btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 700,
                    gap: '0.4rem',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                  }}
                  title="Add new raw material definition for this company"
                >
                  <Plus size={16} /> Add Raw Material
                </button>
                <button
                  onClick={() => { setEditingTransaction(null); setIsInwardOpen(true); handleInwardTabChange(isDigitalPrint ? 'Sublimation Paper' : (materialsList[0] || 'Fabric Material')); setInwardItems([]); }}
                  className="btn-primary"
                  style={{ gap: '0.4rem' }}
                >
                  <ArrowDownToLine size={16} /> Stock Inward
                </button>
                <button
                  onClick={() => { setIsOutwardOpen(true); handleOutwardTabChange(isDigitalPrint ? 'Sublimation Paper' : (materialsList[0] || 'Fabric Material')); setOutwardItems([]); }}
                  className="btn-secondary"
                  style={{ gap: '0.4rem' }}
                >
                  <ArrowUpFromLine size={16} /> Stock Outward
                </button>
              </div>
            </div>

            {/* Summary Bar */}
            <div style={{ marginBottom: '1.25rem', padding: '0.9rem 1.25rem', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div><span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Company Entity</span><br /><strong style={{ color: 'var(--primary)' }}>{companyEntity}</strong></div>
              <div><span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Catalog Items</span><br /><strong>{materialsList.length}</strong></div>
              <div><span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Active Stock Profiles</span><br /><strong>{filteredStock.length} / {stock.length}</strong></div>
              <div><span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Inward Transactions</span><br /><strong style={{ color: 'var(--success)' }}>{stockFilteredTx.filter(t => t.type === 'INWARD').length}</strong></div>
              <div><span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Outward Transactions</span><br /><strong style={{ color: 'var(--danger)' }}>{stockFilteredTx.filter(t => t.type === 'OUTWARD').length}</strong></div>
              {sisterStats.pendingCount > 0 && (
                <div style={{ marginLeft: 'auto' }}>
                  <button
                    onClick={() => setActiveTab('sister_inward')}
                    style={{
                      background: 'rgba(245, 158, 11, 0.15)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      color: '#f59e0b',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <AlertTriangle size={15} />
                    <span>{sisterStats.pendingCount} Sister Transfers Pending Check</span>
                  </button>
                </div>
              )}
            </div>

            {/* Garment Category Filter Pills & Instant Search */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {(isDigitalPrint ? ['All', 'Fabric', 'Paper', 'Inks & Consumables', 'Other'] : GARMENT_RAW_CATEGORIES).map(cat => {
                  const isSelected = categoryFilter === cat;
                  const count = cat === 'All'
                    ? stock.length
                    : stock.filter(s => {
                        const sc = String(s.category || '').toLowerCase();
                        const tc = cat.toLowerCase();
                        if (tc === 'fabric') return sc.includes('fabric');
                        if (tc === 'trims & thread') return sc.includes('trim') || sc.includes('thread');
                        if (tc === 'buttons & fasteners') return sc.includes('button') || sc.includes('fastener');
                        if (tc === 'elastics & laces') return sc.includes('elastic') || sc.includes('lace');
                        if (tc === 'interlining & fusing') return sc.includes('interlining') || sc.includes('fusing');
                        if (tc === 'labels & tags') return sc.includes('label') || sc.includes('tag');
                        if (tc === 'packing material') return sc.includes('pack');
                        if (tc === 'paper') return sc.includes('paper');
                        if (tc === 'inks & consumables') return sc.includes('ink') || sc.includes('consumable');
                        return sc === tc;
                      }).length;

                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      style={{
                        padding: '5px 12px',
                        fontSize: '0.78rem',
                        fontWeight: isSelected ? 700 : 500,
                        borderRadius: '20px',
                        border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-light, #e2e8f0)',
                        background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                        color: isSelected ? 'var(--primary)' : 'var(--text-light)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span>{cat}</span>
                      <span style={{
                        fontSize: '0.7rem',
                        background: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                        color: isSelected ? '#fff' : 'var(--text-muted)',
                        padding: '1px 6px',
                        borderRadius: '10px'
                      }}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div style={{ position: 'relative', width: '260px' }}>
                <input
                  style={{ ...inputStyle, paddingLeft: '2.1rem', height: '36px', fontSize: '0.82rem' }}
                  placeholder="Search material, shade, HSN..."
                  value={stockSearchQuery}
                  onChange={e => setStockSearchQuery(e.target.value)}
                />
                <Search size={15} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                {stockSearchQuery && (
                  <button
                    onClick={() => setStockSearchQuery('')}
                    style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* ─── STOCK OVERVIEW: PROPER UI TABLE VIEW ─── */}
            {(() => {
              const isPaperItem = (item) => {
                const name = String(item.materialName || '').toLowerCase();
                return ['a++', 'a+', 'a'].includes(name) || name.includes('paper') || name.includes('sublimation') || name.includes('butter');
              };
              const isGrandoItem = (item) => String(item.materialName || '').toLowerCase().includes('grando');
              const isPrintdotItem = (item) => String(item.materialName || '').toLowerCase().includes('printdot');

              const paperItems = stock.filter(item => isPaperItem(item)).sort((a, b) => {
                if (a.materialName !== b.materialName) return a.materialName.localeCompare(b.materialName);
                return (b.panna || '').localeCompare(a.panna || '');
              });

              const grandoItems = stock.filter(item => isGrandoItem(item));
              const printdotItems = stock.filter(item => isPrintdotItem(item));
              const otherItems = stock.filter(item => !isPaperItem(item) && !isGrandoItem(item) && !isPrintdotItem(item));

              const showPaper = isDigitalPrint && (stockMaterialType === 'All' || matchesMaterialType('Sublimation Paper', stockMaterialType) || matchesMaterialType('Butter Paper', stockMaterialType));
              const showGrando = isDigitalPrint && (stockMaterialType === 'All' || stockMaterialType === 'Ink' || stockMaterialType === 'All Inks' || stockMaterialType === 'Grando Ink');
              const showPrintdot = isDigitalPrint && (stockMaterialType === 'All' || stockMaterialType === 'Ink' || stockMaterialType === 'All Inks' || stockMaterialType === 'Printdot Ink');
              const showOther = !isDigitalPrint || stockMaterialType === 'All' || (!showPaper && !showGrando && !showPrintdot);

              const CMYK_SPECS = [
                { key: 'Cyan', code: 'C', name: 'Cyan (C)', colorVal: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.35)' },
                { key: 'Magenta', code: 'M', name: 'Magenta (M)', colorVal: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.35)' },
                { key: 'Yellow', code: 'Y', name: 'Yellow (Y)', colorVal: '#eab308', bg: 'rgba(234, 179, 8, 0.12)', border: 'rgba(234, 179, 8, 0.35)' },
                { key: 'Black', code: 'K', name: 'Black (K)', colorVal: '#1e293b', dotBorder: '#94a3b8', bg: 'rgba(30, 41, 59, 0.25)', border: 'rgba(148, 163, 184, 0.35)' }
              ];

              const GRANDO_CMYK_SPECS = [
                ...CMYK_SPECS,
                { key: 'Cleaning', code: 'C.S.', name: 'Cleaning Solution (C.S.)', colorVal: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.35)' }
              ];

              const renderStockStatusBadge = (stockQty) => {
                if (stockQty <= 0) {
                  return (
                    <span style={{ fontSize: '0.72rem', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', padding: '2px 8px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
                      {stockQty < 0 ? `Negative (${stockQty})` : 'Empty'}
                    </span>
                  );
                }
                if (stockQty <= 5) {
                  return (
                    <span style={{ fontSize: '0.72rem', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '6px', padding: '2px 8px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
                      Low Stock
                    </span>
                  );
                }
                return (
                  <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', padding: '2px 8px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                    In Stock
                  </span>
                );
              };

              const grandoTotalStock = grandoItems.reduce((acc, it) => acc + (it.currentStock || 0), 0);
              const printdotTotalStock = printdotItems.reduce((acc, it) => acc + (it.currentStock || 0), 0);

              const tableCardStyle = {
                marginBottom: '2rem',
                background: 'var(--bg-card, #ffffff)',
                border: '1px solid var(--border-light, #e2e8f0)',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 4px 20px -4px rgba(0,0,0,0.06)'
              };

              const tableHeaderBarStyle = {
                padding: '0.9rem 1.25rem',
                background: 'rgba(255,255,255,0.03)',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.8rem'
              };

              const thStyle = {
                padding: '0.75rem 1rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: '#f1f5f9',
                color: '#0f172a',
                borderBottom: '1px solid var(--border-light)'
              };

              const tdStyle = {
                padding: '0.85rem 1rem',
                fontSize: '0.85rem',
                borderBottom: '1px solid var(--border-light)',
                verticalAlign: 'middle'
              };

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  
                  {/* 1. PAPER INVENTORY TABLE */}
                  {showPaper && (
                    <div style={tableCardStyle}>
                      <div style={tableHeaderBarStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(79, 70, 229, 0.12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={18} />
                          </div>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Sublimation & Butter Paper Inventory</h3>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Stock tracked by Paper Grade and Panna (Width)</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.78rem', background: 'rgba(79, 70, 229, 0.08)', color: 'var(--primary)', border: '1px solid rgba(79, 70, 229, 0.25)', borderRadius: '6px', padding: '3px 10px', fontWeight: 700 }}>
                            {paperItems.length} Profiles
                          </span>
                          <span style={{ fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '6px', padding: '3px 10px', fontWeight: 700 }}>
                            Total {paperItems.reduce((acc, it) => acc + (it.currentStock || 0), 0)} Rolls
                          </span>
                        </div>
                      </div>

                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '780px' }}>
                          <thead>
                            <tr>
                              <th style={thStyle}>Paper Type / Grade</th>
                              <th style={thStyle}>Panna (Width)</th>
                              <th style={{ ...thStyle, textAlign: 'center' }}>Total Inward</th>
                              <th style={{ ...thStyle, textAlign: 'center' }}>Total Outward</th>
                              <th style={{ ...thStyle, textAlign: 'right' }}>Available Rolls</th>
                              <th style={{ ...thStyle, textAlign: 'right' }}>Total Available Mtr</th>
                              <th style={{ ...thStyle, textAlign: 'center' }}>Stock Status</th>
                              <th style={{ ...thStyle, textAlign: 'center' }}>Quick Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paperItems.length === 0 ? (
                              <tr>
                                <td colSpan="8" style={{ ...tdStyle, textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  No paper stock records found for this period. Click "Stock Inward" to record rolls.
                                </td>
                              </tr>
                            ) : (
                              paperItems.map((item, idx) => {
                                const nameLower = (item.materialName || '').toLowerCase();
                                const isPaperGrade = ['a++', 'a+', 'a'].includes(nameLower);
                                const displayName = isPaperGrade ? `Sublimation Paper (${item.materialName})` : item.materialName;
                                const isEmpty = (item.currentStock || 0) <= 0;
                                const isLow = (item.currentStock || 0) <= 5 && !isEmpty;

                                return (
                                  <tr 
                                    key={idx} 
                                    style={{ 
                                      background: isEmpty ? 'rgba(239, 68, 68, 0.02)' : isLow ? 'rgba(245, 158, 11, 0.02)' : idx % 2 === 1 ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                                      transition: 'background-color 0.15s'
                                    }}
                                  >
                                    <td style={tdStyle}>
                                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{displayName}</div>
                                      {item.paperQuality && (
                                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                          Quality: {item.paperQuality}
                                        </div>
                                      )}
                                    </td>
                                    <td style={tdStyle}>
                                      {item.panna ? (
                                        <span style={{ fontSize: '0.78rem', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '6px', padding: '2px 8px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                          📐 {item.panna}
                                        </span>
                                      ) : (
                                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                                      )}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                      <span style={{ fontWeight: 700, color: 'var(--success)' }}>
                                        {item.totalInward || 0} Rolls
                                      </span>
                                      {item.totalInwardMtr ? (
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                          {item.totalInwardMtr.toLocaleString()}m
                                        </div>
                                      ) : null}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                      <span style={{ fontWeight: 700, color: 'var(--danger)' }}>
                                        {item.totalOutward || 0} Rolls
                                      </span>
                                      {item.totalOutwardMtr ? (
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                          {item.totalOutwardMtr.toLocaleString()}m
                                        </div>
                                      ) : null}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                                      <strong style={{ fontSize: '1.05rem', fontWeight: 800, color: isEmpty ? 'var(--danger)' : isLow ? '#f59e0b' : 'var(--primary)' }}>
                                        {item.currentStock}
                                      </strong>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '4px' }}>Rolls</span>
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                                      {item.totalMeters !== undefined && item.totalMeters !== null ? (
                                        <strong style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.totalMeters.toLocaleString()}m</strong>
                                      ) : item.metersPerRoll ? (
                                        <strong style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{(item.currentStock * item.metersPerRoll).toLocaleString()}m</strong>
                                      ) : (
                                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                                      )}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                      {renderStockStatusBadge(item.currentStock || 0)}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                        <button 
                                          onClick={() => handleQuickInward(item.materialName, item.panna, '', null, { paperQuality: item.paperQuality, metersPerRoll: item.metersPerRoll })}
                                          className="btn-primary" 
                                          title={`Quick Inward for ${displayName} ${item.panna || ''}`}
                                          style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                                        >
                                          <Plus size={14} />
                                        </button>
                                        <button 
                                          onClick={() => handleQuickOutward(item.materialName, item.panna, '', null, { paperQuality: item.paperQuality, metersPerRoll: item.metersPerRoll })}
                                          className="btn-secondary" 
                                          title={`Quick Outward for ${displayName} ${item.panna || ''}`}
                                          style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                                        >
                                          <ArrowUpFromLine size={14} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                          {paperItems.length > 0 && (
                            <tfoot>
                              <tr style={{ background: 'rgba(255,255,255,0.03)', fontWeight: 700, borderTop: '2px solid var(--border-light)' }}>
                                <td colSpan="2" style={{ ...tdStyle, fontWeight: 700 }}>Total Paper Stock</td>
                                <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--success)', fontWeight: 700 }}>
                                  {paperItems.reduce((acc, it) => acc + (it.totalInward || 0), 0)} Rolls
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--danger)', fontWeight: 700 }}>
                                  {paperItems.reduce((acc, it) => acc + (it.totalOutward || 0), 0)} Rolls
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>
                                  {paperItems.reduce((acc, it) => acc + (it.currentStock || 0), 0)} Rolls
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800 }}>
                                  {paperItems.reduce((acc, it) => acc + (it.totalMeters !== undefined ? it.totalMeters : (it.currentStock * (it.metersPerRoll || 0))), 0).toLocaleString()}m
                                </td>
                                <td colSpan="2" style={tdStyle}></td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 2. GRANDO INK INVENTORY TABLE (CMYK) */}
                  {showGrando && (
                    <div style={tableCardStyle}>
                      <div style={tableHeaderBarStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Droplet size={18} />
                          </div>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Grando Sublimation Ink (C, M, Y, K)</h3>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>High-density sublimation ink inventory tracked by color</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.78rem', background: 'rgba(56, 189, 248, 0.08)', color: '#0284c7', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '6px', padding: '3px 10px', fontWeight: 700 }}>
                            Grando System
                          </span>
                          <span style={{ fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '6px', padding: '3px 10px', fontWeight: 700 }}>
                            Total {grandoTotalStock} Liters
                          </span>
                        </div>
                      </div>

                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '720px' }}>
                          <thead>
                            <tr>
                              <th style={thStyle}>Ink Color (CMYK)</th>
                              <th style={thStyle}>Can / Bottle Size</th>
                              <th style={{ ...thStyle, textAlign: 'center' }}>Total Inward</th>
                              <th style={{ ...thStyle, textAlign: 'center' }}>Total Outward</th>
                              <th style={{ ...thStyle, textAlign: 'right' }}>Available Stock</th>
                              <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                              <th style={{ ...thStyle, textAlign: 'center' }}>Quick Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {GRANDO_CMYK_SPECS.map(spec => {
                              const matching = grandoItems.filter(it => {
                                const cLower = (it.color || '').toLowerCase();
                                const mLower = (it.materialName || '').toLowerCase();
                                if (spec.key === 'Cyan') return cLower === 'cyan' || mLower.includes('cyan') || it.color === 'C';
                                if (spec.key === 'Magenta') return cLower === 'magenta' || mLower.includes('magenta') || it.color === 'M';
                                if (spec.key === 'Yellow') return cLower === 'yellow' || mLower.includes('yellow') || it.color === 'Y';
                                if (spec.key === 'Black') return cLower === 'black' || mLower.includes('black') || it.color === 'K';
                                if (spec.key === 'Cleaning') return cLower.includes('clean') || mLower.includes('clean') || it.color === 'C.S.' || it.color === 'CS';
                                return false;
                              });

                              const matched = matching[0];
                              const inward = matching.reduce((sum, it) => sum + (it.totalInward || 0), 0);
                              const outward = matching.reduce((sum, it) => sum + (it.totalOutward || 0), 0);
                              const currentStock = matching.reduce((sum, it) => sum + (it.currentStock || 0), 0);
                              const isCleaning = spec.key === 'Cleaning';
                              const canSize = matched?.canSize || (isCleaning ? 1 : 5);
                              const containerLabel = isCleaning ? `${canSize} Liter Bottle` : `${canSize} Liter Can`;

                              return (
                                <tr key={spec.code} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                  <td style={tdStyle}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                      <span 
                                        style={{ 
                                          display: 'inline-block', 
                                          width: '14px', 
                                          height: '14px', 
                                          borderRadius: '50%', 
                                          background: spec.colorVal,
                                          border: spec.dotBorder ? `1px solid ${spec.dotBorder}` : 'none',
                                          boxShadow: `0 0 6px ${spec.bg}`
                                        }} 
                                      />
                                      <div>
                                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{spec.name}</span>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Grando Sublimation</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td style={tdStyle}>
                                    <span style={{ fontSize: '0.76rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', padding: '2px 6px' }}>
                                      {containerLabel}
                                    </span>
                                  </td>
                                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    <span style={{ fontWeight: 700, color: 'var(--success)' }}>
                                      {inward} Liters
                                    </span>
                                  </td>
                                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    <span style={{ fontWeight: 700, color: 'var(--danger)' }}>
                                      {outward} Liters
                                    </span>
                                  </td>
                                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                                    <strong style={{ fontSize: '1.05rem', fontWeight: 800, color: currentStock <= 0 ? 'var(--danger)' : currentStock <= 5 ? '#f59e0b' : 'var(--primary)' }}>
                                      {currentStock}
                                    </strong>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '4px' }}>Liters</span>
                                  </td>
                                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    {renderStockStatusBadge(currentStock)}
                                  </td>
                                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                      <button 
                                        onClick={() => handleQuickInward('Grando Ink', '', spec.key, canSize)}
                                        className="btn-primary" 
                                        title={`Quick Inward for Grando ${spec.name}`}
                                        style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                                      >
                                        <Plus size={14} />
                                      </button>
                                      <button 
                                        onClick={() => handleQuickOutward('Grando Ink', '', spec.key, canSize)}
                                        className="btn-secondary" 
                                        title={`Quick Outward for Grando ${spec.name}`}
                                        style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                                      >
                                        <ArrowUpFromLine size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 3. PRINTDOT INK INVENTORY TABLE (CMYK) */}
                  {showPrintdot && (
                    <div style={tableCardStyle}>
                      <div style={tableHeaderBarStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(236, 72, 153, 0.12)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Printer size={18} />
                          </div>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Printdot Digital Ink (C, M, Y, K)</h3>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Printdot production printhead ink inventory tracked by color</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.78rem', background: 'rgba(236, 72, 153, 0.08)', color: '#db2777', border: '1px solid rgba(236, 72, 153, 0.25)', borderRadius: '6px', padding: '3px 10px', fontWeight: 700 }}>
                            Printdot System
                          </span>
                          <span style={{ fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '6px', padding: '3px 10px', fontWeight: 700 }}>
                            Total {printdotTotalStock} Liters
                          </span>
                        </div>
                      </div>

                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '720px' }}>
                          <thead>
                            <tr>
                              <th style={thStyle}>Ink Color (CMYK)</th>
                              <th style={thStyle}>Can / Bottle Size</th>
                              <th style={{ ...thStyle, textAlign: 'center' }}>Total Inward</th>
                              <th style={{ ...thStyle, textAlign: 'center' }}>Total Outward</th>
                              <th style={{ ...thStyle, textAlign: 'right' }}>Available Stock</th>
                              <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                              <th style={{ ...thStyle, textAlign: 'center' }}>Quick Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {CMYK_SPECS.map(spec => {
                              const matching = printdotItems.filter(it => {
                                const cLower = (it.color || '').toLowerCase();
                                const mLower = (it.materialName || '').toLowerCase();
                                if (spec.key === 'Cyan') return cLower === 'cyan' || mLower.includes('cyan') || it.color === 'C';
                                if (spec.key === 'Magenta') return cLower === 'magenta' || mLower.includes('magenta') || it.color === 'M';
                                if (spec.key === 'Yellow') return cLower === 'yellow' || mLower.includes('yellow') || it.color === 'Y';
                                if (spec.key === 'Black') return cLower === 'black' || mLower.includes('black') || it.color === 'K';
                                return false;
                              });

                              const matched = matching[0];
                              const inward = matching.reduce((sum, it) => sum + (it.totalInward || 0), 0);
                              const outward = matching.reduce((sum, it) => sum + (it.totalOutward || 0), 0);
                              const currentStock = matching.reduce((sum, it) => sum + (it.currentStock || 0), 0);
                              const canSize = matched?.canSize || 10;

                              return (
                                <tr key={spec.code} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                  <td style={tdStyle}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                      <span 
                                        style={{ 
                                          display: 'inline-block', 
                                          width: '14px', 
                                          height: '14px', 
                                          borderRadius: '50%', 
                                          background: spec.colorVal,
                                          border: spec.dotBorder ? `1px solid ${spec.dotBorder}` : 'none',
                                          boxShadow: `0 0 6px ${spec.bg}`
                                        }} 
                                      />
                                      <div>
                                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{spec.name}</span>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Printdot Inks</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td style={tdStyle}>
                                    <span style={{ fontSize: '0.76rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', padding: '2px 6px' }}>
                                      {canSize} Liter Can
                                    </span>
                                  </td>
                                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    <span style={{ fontWeight: 700, color: 'var(--success)' }}>
                                      {inward} Liters
                                    </span>
                                  </td>
                                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    <span style={{ fontWeight: 700, color: 'var(--danger)' }}>
                                      {outward} Liters
                                    </span>
                                  </td>
                                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                                    <strong style={{ fontSize: '1.05rem', fontWeight: 800, color: currentStock <= 0 ? 'var(--danger)' : currentStock <= 5 ? '#f59e0b' : 'var(--primary)' }}>
                                      {currentStock}
                                    </strong>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '4px' }}>Liters</span>
                                  </td>
                                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    {renderStockStatusBadge(currentStock)}
                                  </td>
                                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                      <button 
                                        onClick={() => handleQuickInward('Printdot Ink', '', spec.key, canSize)}
                                        className="btn-primary" 
                                        title={`Quick Inward for Printdot ${spec.name}`}
                                        style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                                      >
                                        <Plus size={14} />
                                      </button>
                                      <button 
                                        onClick={() => handleQuickOutward('Printdot Ink', '', spec.key, canSize)}
                                        className="btn-secondary" 
                                        title={`Quick Outward for Printdot ${spec.name}`}
                                        style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                                      >
                                        <ArrowUpFromLine size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 4. GARMENT RAW MATERIALS & FABRICS TABLE */}
                  {showOther && (
                    otherItems.length > 0 ? (
                      <div style={tableCardStyle}>
                        <div style={tableHeaderBarStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Layers size={18} />
                            </div>
                            <div>
                              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {isDigitalPrint ? 'Other Raw Materials' : `${companyEntity} Raw Material Catalog & Stock`}
                              </h3>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {isDigitalPrint ? 'Additional configured accessories & raw materials' : `Active stock of fabrics, trims, buttons, elastics, labels & packing materials`}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsNewMaterialModalOpen(true)}
                            className="btn-primary"
                            style={{
                              fontSize: '0.78rem',
                              padding: '5px 12px',
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              border: 'none',
                              gap: '4px'
                            }}
                          >
                            <Plus size={14} /> + Add Material
                          </button>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px' }}>
                            <thead>
                              <tr>
                                <th style={thStyle}>Category</th>
                                <th style={thStyle}>Material / Item Name & Specs</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>HSN</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Total Inward</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Total Outward</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Available Stock</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Quick Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {otherItems.map((item, idx) => {
                                const catBadge = (() => {
                                  const cat = String(item.category || 'Fabric').toLowerCase();
                                  if (cat.includes('fabric')) return { bg: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', label: 'Fabric' };
                                  if (cat.includes('thread') || cat.includes('trim')) return { bg: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', label: 'Trims & Thread' };
                                  if (cat.includes('button') || cat.includes('fastener')) return { bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', label: 'Buttons & Fasteners' };
                                  if (cat.includes('elastic') || cat.includes('lace')) return { bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', label: 'Elastics & Laces' };
                                  if (cat.includes('fusing') || cat.includes('interlining')) return { bg: 'rgba(236, 72, 153, 0.12)', color: '#ec4899', label: 'Interlining & Fusing' };
                                  if (cat.includes('label') || cat.includes('tag')) return { bg: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', label: 'Labels & Tags' };
                                  if (cat.includes('pack')) return { bg: 'rgba(14, 165, 233, 0.12)', color: '#0ea5e9', label: 'Packing Material' };
                                  return { bg: 'rgba(100, 116, 139, 0.12)', color: '#64748b', label: item.category || 'General' };
                                })();

                                const isLow = (item.currentStock || 0) <= (item.reorderLevel || 10);

                                return (
                                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                    <td style={tdStyle}>
                                      <span
                                        style={{
                                          fontSize: '0.72rem',
                                          fontWeight: 700,
                                          padding: '2px 8px',
                                          borderRadius: '6px',
                                          background: catBadge.bg,
                                          color: catBadge.color,
                                          whiteSpace: 'nowrap'
                                        }}
                                      >
                                        {catBadge.label}
                                      </span>
                                    </td>
                                    <td style={tdStyle}>
                                      <div>
                                        <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{item.materialName}</strong>
                                        <div style={{ display: 'flex', gap: '8px', fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '2px', flexWrap: 'wrap' }}>
                                          {item.shade && <span>Shade: <strong style={{ color: 'var(--text-light)' }}>{item.shade}</strong></span>}
                                          {item.panna && <span>Width: <strong style={{ color: 'var(--text-light)' }}>{item.panna}</strong></span>}
                                          {item.location && <span>Loc: <strong style={{ color: 'var(--text-light)' }}>{item.location}</strong></span>}
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                      {item.hsnCode || '-'}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--success)', fontWeight: 700 }}>
                                      {item.totalInward || 0} {item.unit || 'Meters'}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--danger)', fontWeight: 700 }}>
                                      {item.totalOutward || 0} {item.unit || 'Meters'}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                                      <strong style={{ fontSize: '1.05rem', fontWeight: 800, color: (item.currentStock || 0) <= 0 ? 'var(--danger)' : isLow ? '#f59e0b' : 'var(--primary)' }}>
                                        {item.currentStock || 0}
                                      </strong>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '4px' }}>{item.unit || 'Meters'}</span>
                                      {item.reorderLevel && (
                                        <div style={{ fontSize: '0.68rem', color: isLow ? '#f59e0b' : 'var(--text-muted)' }}>
                                          Min: {item.reorderLevel}
                                        </div>
                                      )}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                      {renderStockStatusBadge(item.currentStock || 0)}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                        <button 
                                          onClick={() => handleQuickInward(item.materialName, '', '', null, { unit: item.unit, category: item.category })}
                                          className="btn-primary" 
                                          title={`Quick Inward for ${item.materialName}`}
                                          style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                                        >
                                          <Plus size={14} />
                                        </button>
                                        <button 
                                          onClick={() => handleQuickOutward(item.materialName, '', '', null, { unit: item.unit, category: item.category })}
                                          className="btn-secondary" 
                                          title={`Quick Outward for ${item.materialName}`}
                                          style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                                        >
                                          <ArrowUpFromLine size={14} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      !isDigitalPrint && (
                        <div style={{ ...tableCardStyle, padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                            <Layers size={28} />
                          </div>
                          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>
                            No Raw Materials Found for {companyEntity}
                          </h3>
                          <p style={{ margin: '0 auto 1.5rem', color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '520px', lineHeight: 1.5 }}>
                            Add your fabrics, sewing threads, buttons, elastics, labels, or packing materials using the button below, or verify inbound shipments in <strong>Sister Inward Check</strong>.
                          </p>
                          <button
                            type="button"
                            onClick={() => setIsNewMaterialModalOpen(true)}
                            className="btn-primary"
                            style={{
                              padding: '0.65rem 1.6rem',
                              fontSize: '0.9rem',
                              fontWeight: 700,
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              border: 'none',
                              gap: '0.5rem',
                              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                            }}
                          >
                            <Plus size={18} /> + Add Your First Raw Material
                          </button>
                        </div>
                      )
                    )
                  )}

                </div>
              );
            })()}
          </div>
        )}

        {/* Inward Register Tab */}
        {activeTab === 'inward' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Raw Materials Inward Register</h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: '220px' }}>
                  <input
                    style={{ ...inputStyle, paddingLeft: '2rem' }}
                    placeholder="Search material, vendor, challan..."
                    value={inwardSearch}
                    onChange={e => setInwardSearch(e.target.value)}
                  />
                  <Search size={16} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>

                {/* Material Type / Category Filter */}
                <select
                  style={{ ...inputStyle, width: '180px', fontWeight: 700 }}
                  value={inwardMaterialType}
                  onChange={e => setInwardMaterialType(e.target.value)}
                >
                  <option value="All">All Material Types</option>
                  <option value="Ink">All Inks (Grando / Printdot)</option>
                  <option value="Paper">All Papers (Sublimation / Butter)</option>
                  <option value="Sublimation Paper">Sublimation Paper</option>
                  <option value="Butter Paper">Butter Paper</option>
                  <option value="Grando Ink">Grando Ink</option>
                  <option value="Printdot Ink">Printdot Ink</option>
                  {materialsList.filter(m => !['Sublimation Paper', 'Butter Paper', 'Grando Ink', 'Printdot Ink'].includes(m)).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>

                {/* Standard ERP DateRangePicker */}
                <DateRangePicker
                  preset={inwardPreset}
                  onChange={({ preset: p, dateStart: ds, dateEnd: de }) => {
                    setInwardPreset(p);
                    setInwardDateStart(ds);
                    setInwardDateEnd(de);
                  }}
                  customStart={customInwardStart}
                  customEnd={customInwardEnd}
                  onCustomChange={(s, e) => {
                    setCustomInwardStart(s);
                    setCustomInwardEnd(e);
                  }}
                />
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th 
                      onClick={() => {
                        if (inwardSortBy === 'date') {
                          setInwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setInwardSortBy('date');
                          setInwardSortOrder('desc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Date {inwardSortBy === 'date' ? (inwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th 
                      onClick={() => {
                        if (inwardSortBy === 'challanNo') {
                          setInwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setInwardSortBy('challanNo');
                          setInwardSortOrder('asc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Challan No {inwardSortBy === 'challanNo' ? (inwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th 
                      onClick={() => {
                        if (inwardSortBy === 'materialName') {
                          setInwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setInwardSortBy('materialName');
                          setInwardSortOrder('asc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Material Name {inwardSortBy === 'materialName' ? (inwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th 
                      onClick={() => {
                        if (inwardSortBy === 'vendorName') {
                          setInwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setInwardSortBy('vendorName');
                          setInwardSortOrder('asc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Vendor Name {inwardSortBy === 'vendorName' ? (inwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th 
                      onClick={() => {
                        if (inwardSortBy === 'qty') {
                          setInwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setInwardSortBy('qty');
                          setInwardSortOrder('desc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}
                    >
                      Qty {inwardSortBy === 'qty' ? (inwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th>Unit</th>
                    <th>Notes</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {inwardTx.length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No transactions found.</td></tr>
                  ) : (
                    inwardTx.map(t => (
                      <tr key={t._id}>
                        <td>{formatDateDDMMYYYY(t.date)}</td>
                        <td><strong>{t.challanNo || '-'}</strong></td>
                        <td>{renderMaterialCell(t)}</td>
                        <td>{t.vendorName || '-'}</td>
                        <td className="text-right" style={{ color: 'var(--success)', fontWeight: 'bold' }}>+{t.qty}</td>
                        <td>{t.unit || 'Rolls'}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.notes || '-'}</td>
                        <td className="text-center" style={{ whiteSpace: 'nowrap' }}>
                          {isAdmin && (
                            <button
                              className="btn-icon"
                              title="Edit"
                              style={{ color: 'var(--primary)', marginRight: '0.5rem' }}
                              onClick={() => startEditInward(t)}
                            >
                              <Edit size={16} />
                            </button>
                          )}
                          <button onClick={() => setDeleteTarget({ id: t._id, label: `Inward ${t.qty} ${t.unit} of ${t.materialName}` })} className="btn-icon" style={{ color: 'var(--danger)' }}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Sister Company Inward Check Tab */}
        {activeTab === 'sister_inward' && (
          <div>
            {/* Header / Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #3b82f6', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Inwards</span>
                  <Building2 size={16} color="#3b82f6" />
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)' }}>{sisterStats.totalCount}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>From All Sister Companies</div>
              </div>

              <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #f59e0b', display: 'flex', flexDirection: 'column', gap: '0.35rem', background: sisterStats.pendingCount > 0 ? 'rgba(245, 158, 11, 0.05)' : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase' }}>Pending Verification</span>
                  <Clock size={16} color="#d97706" />
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#d97706' }}>{sisterStats.pendingCount}</div>
                <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700 }}>
                  {sisterStats.pendingQty} Units Awaiting Inward Check
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #10b981', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Verified & In Stock</span>
                  <CheckCheck size={16} color="#10b981" />
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981' }}>{sisterStats.verifiedCount}</div>
                <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>Active in Raw Material Stock</div>
              </div>

              <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #ef4444', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Discrepancies / Rejected</span>
                  <AlertTriangle size={16} color="#ef4444" />
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ef4444' }}>{sisterStats.rejectedCount}</div>
                <div style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 600 }}>Flagged During Inspection</div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {[
                  { id: 'ALL', label: `All (${sisterStats.totalCount})` },
                  { id: 'PENDING_CHECK', label: `Pending Check (${sisterStats.pendingCount})` },
                  { id: 'VERIFIED', label: `Verified (${sisterStats.verifiedCount})` },
                  { id: 'REJECTED', label: `Rejected (${sisterStats.rejectedCount})` }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setSisterStatusFilter(f.id)}
                    className={sisterStatusFilter === f.id ? 'btn-primary' : 'btn-secondary'}
                    style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem', borderRadius: '20px' }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1, maxWidth: '400px', justifyContent: 'flex-end' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
                  <input
                    style={{ ...inputStyle, paddingLeft: '2rem' }}
                    placeholder="Search doc #, material, company..."
                    value={sisterSearch}
                    onChange={e => setSisterSearch(e.target.value)}
                  />
                  <Search size={15} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
                <button onClick={fetchSisterTransfers} className="btn-secondary" title="Refresh transfers" style={{ padding: '0.45rem 0.75rem' }}>
                  <RefreshCw size={15} className={sisterLoading ? 'spin-loader' : ''} />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="table-responsive" style={{ border: '1px solid var(--border-light)', borderRadius: '10px', overflow: 'hidden' }}>
              <table className="table" style={{ width: '100%', margin: 0 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', fontSize: '0.78rem' }}>
                    <th>Date</th>
                    <th>Sending Sister Company</th>
                    <th>Document Reference</th>
                    <th>Material / Fabric</th>
                    <th style={{ textAlign: 'right' }}>Challan Qty</th>
                    <th style={{ textAlign: 'right' }}>Confirmed Qty</th>
                    <th>Status</th>
                    <th>Inspection & Notes</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sisterLoading ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>
                        <RefreshCw className="spin-loader" size={24} style={{ margin: '0 auto' }} />
                        <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading sister company inward transfers...</div>
                      </td>
                    </tr>
                  ) : sisterTransfers.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        <ShieldCheck size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                        <div style={{ fontWeight: 700 }}>No Sister Company Inward Transfers Found</div>
                        <div style={{ fontSize: '0.78rem', marginTop: '0.2rem' }}>
                          When another sister company creates an invoice or delivery challan for {companyEntity}, it will automatically appear here for verification.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sisterTransfers.map(t => {
                      const isPending = t.verificationStatus === 'PENDING_CHECK';
                      const isVerified = t.verificationStatus === 'VERIFIED';
                      const isRejected = t.verificationStatus === 'REJECTED';

                      return (
                        <tr key={t._id} style={{ background: isPending ? 'rgba(245, 158, 11, 0.04)' : undefined, fontSize: '0.82rem' }}>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 700 }}>{formatDateDDMMYYYY(t.date)}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>
                          <td>
                            <span style={{ fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#e0e7ff', color: '#4338ca', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Building2 size={12} /> {t.sourceCompany || t.vendorName}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                              {t.sourceDocNo || t.challanNo}
                            </div>
                            <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'var(--border-light)', color: 'var(--text-muted)' }}>
                              {t.sourceDocType === 'INVOICE' ? 'Tax Invoice' : t.sourceDocType === 'DELIVERY_CHALLAN' ? 'Delivery Challan' : 'Fabric Challan'}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 700 }}>{t.materialName}</div>
                            {t.panna && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.panna} </span>}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800 }}>
                            {t.qty} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.unit || 'Rolls'}</span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: isVerified ? '#10b981' : 'var(--text-muted)' }}>
                            {t.verifiedQty != null ? `${t.verifiedQty} ${t.unit || 'Rolls'}` : '—'}
                          </td>
                          <td>
                            {isPending && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.5s infinite' }} />
                                Pending Check
                              </span>
                            )}
                            {isVerified && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800 }}>
                                <CheckCircle2 size={13} color="#16a34a" />
                                Verified & in Stock
                              </span>
                            )}
                            {isRejected && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fee2e2', color: '#b91c1c', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800 }}>
                                <XCircle size={13} color="#ef4444" />
                                Rejected
                              </span>
                            )}
                          </td>
                          <td style={{ maxWidth: '200px' }}>
                            {isVerified && (
                              <div style={{ fontSize: '0.72rem', color: '#047857' }}>
                                <div>Checked by: <strong>{t.verifiedBy || 'Staff'}</strong></div>
                                {t.verificationNotes && <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>"{t.verificationNotes}"</div>}
                              </div>
                            )}
                            {isRejected && (
                              <div style={{ fontSize: '0.72rem', color: '#dc2626' }}>
                                <div>Reason: <strong>{t.discrepancyReason}</strong></div>
                                <div>By: {t.verifiedBy || 'Staff'}</div>
                              </div>
                            )}
                            {isPending && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Awaiting physical inspection
                              </span>
                            )}
                          </td>
                          <td className="text-center" style={{ whiteSpace: 'nowrap' }}>
                            {isPending ? (
                              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                <button
                                  onClick={() => openVerifyModal(t, 'VERIFY')}
                                  className="btn-primary"
                                  style={{
                                    padding: '0.3rem 0.7rem',
                                    fontSize: '0.75rem',
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                  title="Check and verify details are correct"
                                >
                                  <Check size={13} /> Verify & Accept
                                </button>
                                <button
                                  onClick={() => openVerifyModal(t, 'REJECT')}
                                  style={{
                                    padding: '0.3rem 0.6rem',
                                    fontSize: '0.75rem',
                                    background: 'none',
                                    border: '1px solid #ef4444',
                                    color: '#ef4444',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                  title="Flag discrepancy / reject"
                                >
                                  <X size={13} /> Reject
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => openVerifyModal(t, t.verificationStatus)}
                                className="btn-secondary"
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                              >
                                <Eye size={13} /> View Check
                              </button>
                            )}
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

        {/* Outward Register Tab */}
        {activeTab === 'outward' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Raw Materials Outward Register</h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: '220px' }}>
                  <input
                    style={{ ...inputStyle, paddingLeft: '2rem' }}
                    placeholder="Search material, party, job card..."
                    value={outwardSearch}
                    onChange={e => setOutwardSearch(e.target.value)}
                  />
                  <Search size={16} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>

                {/* Material Type / Category Filter */}
                <select
                  style={{ ...inputStyle, width: '180px', fontWeight: 700 }}
                  value={outwardMaterialType}
                  onChange={e => setOutwardMaterialType(e.target.value)}
                >
                  <option value="All">All Material Types</option>
                  <option value="Ink">All Inks (Grando / Printdot)</option>
                  <option value="Paper">All Papers (Sublimation / Butter)</option>
                  <option value="Sublimation Paper">Sublimation Paper</option>
                  <option value="Butter Paper">Butter Paper</option>
                  <option value="Grando Ink">Grando Ink</option>
                  <option value="Printdot Ink">Printdot Ink</option>
                  {materialsList.filter(m => !['Sublimation Paper', 'Butter Paper', 'Grando Ink', 'Printdot Ink'].includes(m)).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>

                {/* Standard ERP DateRangePicker */}
                <DateRangePicker
                  preset={outwardPreset}
                  onChange={({ preset: p, dateStart: ds, dateEnd: de }) => {
                    setOutwardPreset(p);
                    setOutwardDateStart(ds);
                    setOutwardDateEnd(de);
                  }}
                  customStart={customOutwardStart}
                  customEnd={customOutwardEnd}
                  onCustomChange={(s, e) => {
                    setCustomOutwardStart(s);
                    setCustomOutwardEnd(e);
                  }}
                />
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th 
                      onClick={() => {
                        if (outwardSortBy === 'date') {
                          setOutwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setOutwardSortBy('date');
                          setOutwardSortOrder('desc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Date {outwardSortBy === 'date' ? (outwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th 
                      onClick={() => {
                        if (outwardSortBy === 'jobNo') {
                          setOutwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setOutwardSortBy('jobNo');
                          setOutwardSortOrder('desc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Job No {outwardSortBy === 'jobNo' ? (outwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th 
                      onClick={() => {
                        if (outwardSortBy === 'materialName') {
                          setOutwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setOutwardSortBy('materialName');
                          setOutwardSortOrder('asc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Material Name {outwardSortBy === 'materialName' ? (outwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th 
                      onClick={() => {
                        if (outwardSortBy === 'partyName') {
                          setOutwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setOutwardSortBy('partyName');
                          setOutwardSortOrder('asc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Party Name {outwardSortBy === 'partyName' ? (outwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th 
                      onClick={() => {
                        if (outwardSortBy === 'qty') {
                          setOutwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setOutwardSortBy('qty');
                          setOutwardSortOrder('desc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}
                    >
                      Qty {outwardSortBy === 'qty' ? (outwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th>Unit</th>
                    <th>Notes</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {outwardTx.length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No transactions found.</td></tr>
                  ) : (
                    outwardTx.map(t => (
                      <tr key={t._id}>
                        <td>{formatDateDDMMYYYY(t.date)}</td>
                        <td><span className="badge badge-info">{t.jobNo || '-'}</span></td>
                        <td>{renderMaterialCell(t)}</td>
                        <td>{t.partyName || '-'}</td>
                        <td className="text-right" style={{ color: 'var(--danger)', fontWeight: 'bold' }}>-{t.qty}</td>
                        <td>{t.unit || 'Rolls'}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.notes || '-'}</td>
                        <td className="text-center">
                          <button onClick={() => setDeleteTarget({ id: t._id, label: `Outward ${t.qty} ${t.unit} of ${t.materialName}` })} className="btn-icon" style={{ color: 'var(--danger)' }}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* ─── INWARD MODAL ─── */}
      {isInwardOpen && (
        <div
          className="modal-overlay modal-backdrop"
          onClick={closeInwardModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
            overflowY: 'auto'
          }}
        >
          <div
            className="modal-content glass-panel"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '540px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: '16px',
              border: '1.5px solid #bfdbfe',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              padding: '1.75rem',
              position: 'relative',
              margin: 'auto'
            }}
          >
            <button onClick={closeInwardModal} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ArrowDownToLine color="var(--success)" /> {editingTransaction ? 'Edit Raw Material Inward' : 'Raw Material Inward'}
            </h3>
            {/* Material Tabs */}
            {!editingTransaction && (
              <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
                {materialsList.map(tab => (
                  <button
                    type="button"
                    key={tab}
                    onClick={() => handleInwardTabChange(tab)}
                    style={{
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.75rem',
                      borderRadius: '4px',
                      border: 'none',
                      background: inwardTab === tab ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                      color: inwardTab === tab ? '#fff' : 'var(--text-light)',
                      cursor: 'pointer',
                      fontWeight: inwardTab === tab ? '700' : '500'
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleInwardSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Challan No</label>
                  <input style={inputStyle} value={inwardForm.challanNo} onChange={e => setInwardForm(p => ({ ...p, challanNo: e.target.value }))} placeholder="e.g. CH-2390" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Date</label>
                  <input type="date" style={inputStyle} value={inwardForm.date} onChange={e => setInwardForm(p => ({ ...p, date: e.target.value }))} required />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Vendor / Supplier Name</label>
                <input
                  list="vendor-datalist"
                  style={inputStyle}
                  value={inwardForm.vendorName}
                  onChange={e => setInwardForm(p => ({ ...p, vendorName: e.target.value }))}
                  placeholder="Select or type vendor..."
                  required={inwardItems.length === 0}
                />
                <datalist id="vendor-datalist">
                  {vendorsList.map(v => <option key={v._id || v.id} value={v.name} />)}
                </datalist>
              </div>

              {/* Sublimation Paper Form Fields */}
              {isSublimationTab(inwardTab) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Panna (Width)</label>
                      <select style={inputStyle} value={String(inwardForm.panna || '').replace(/[^0-9]/g, '') || '58'} onChange={e => setInwardForm(p => ({ ...p, panna: e.target.value }))}>
                        {((printConfig?.widths && printConfig.widths.length > 0) ? printConfig.widths : ['36', '38', '44', '48', '52', '54', '58', '60']).map(p => {
                          const pClean = String(p).replace(/[^0-9]/g, '');
                          return <option key={p} value={pClean}>{pClean}" Panna</option>;
                        })}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Paper Quality</label>
                      <select style={inputStyle} value={inwardForm.paperQuality || 'A++'} onChange={e => setInwardForm(p => ({ ...p, paperQuality: e.target.value }))}>
                        {((printConfig?.paperTypes && printConfig.paperTypes.length > 0) ? printConfig.paperTypes : ['A++', 'A+', 'A']).map(q => (
                          <option key={q} value={q}>{q}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Qty (Rolls)</label>
                      <input type="number" min="0" step="any" style={inputStyle} value={inwardForm.qty} onChange={e => setInwardForm(p => ({ ...p, qty: e.target.value }))} placeholder="e.g. 5" required={inwardItems.length === 0} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Meters per Roll</label>
                      <input type="number" min="0" style={inputStyle} value={inwardForm.metersPerRoll || 1000} onChange={e => setInwardForm(p => ({ ...p, metersPerRoll: e.target.value }))} placeholder="e.g. 1000" />
                    </div>
                  </div>
                </div>
              )}

              {/* Butter Paper Form Fields */}
              {inwardTab.toLowerCase().includes('butter') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Panna (Width)</label>
                      <select style={inputStyle} value={inwardForm.panna} onChange={e => setInwardForm(p => ({ ...p, panna: e.target.value }))}>
                        {printConfig?.widths?.map(p => <option key={p} value={p}>{p}"</option>) || <option value="44">44"</option>}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Qty (Rolls)</label>
                      <input type="number" min="0" step="any" style={inputStyle} value={inwardForm.qty} onChange={e => setInwardForm(p => ({ ...p, qty: e.target.value }))} placeholder="e.g. 5" required={inwardItems.length === 0} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Meters per Roll</label>
                    <input type="number" min="0" style={inputStyle} value={inwardForm.metersPerRoll} onChange={e => setInwardForm(p => ({ ...p, metersPerRoll: e.target.value }))} placeholder="e.g. 100" required={inwardItems.length === 0} />
                  </div>
                </div>
              )}

              {/* Grando Ink Form Fields */}
              {inwardTab.toLowerCase().includes('grando') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Color</label>
                      <select 
                        style={inputStyle} 
                        value={resolveInkColorCode(inwardForm.color)} 
                        onChange={e => handleColorChange('inward', inwardTab, e.target.value)}
                      >
                        <option value="C">Cyan (C)</option>
                        <option value="M">Magenta (M)</option>
                        <option value="Y">Yellow (Y)</option>
                        <option value="K">Black (K)</option>
                        <option value="C.S.">Cleaning Solution (C.S.)</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Qty ({inwardForm.unit || 'Liters'})</label>
                      <input type="number" min="0" step="any" style={inputStyle} value={inwardForm.qty} onChange={e => setInwardForm(p => ({ ...p, qty: e.target.value }))} placeholder="e.g. 10" required={inwardItems.length === 0} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Bottle / Can Size (Liters)</label>
                    <select
                      style={inputStyle}
                      value={getSelectedCanSize(inwardForm.canSize, printConfig?.inkCanSizes?.length > 0 ? printConfig.inkCanSizes : ['1 Ltr', '5 Ltr', '10 Ltr'])}
                      onChange={e => setInwardForm(p => ({ ...p, canSize: e.target.value }))}
                      required={inwardItems.length === 0}
                    >
                      {(printConfig?.inkCanSizes && printConfig.inkCanSizes.length > 0
                        ? printConfig.inkCanSizes
                        : ['1 Ltr', '5 Ltr', '10 Ltr']
                      ).map(sz => (
                        <option key={sz} value={sz}>{sz}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* PrintDot Ink Form Fields */}
              {inwardTab.toLowerCase().includes('printdot') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Color</label>
                      <select 
                        style={inputStyle} 
                        value={resolveInkColorCode(inwardForm.color)} 
                        onChange={e => handleColorChange('inward', inwardTab, e.target.value)}
                      >
                        <option value="C">Cyan (C)</option>
                        <option value="M">Magenta (M)</option>
                        <option value="Y">Yellow (Y)</option>
                        <option value="K">Black (K)</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Qty ({inwardForm.unit || 'Liters'})</label>
                      <input type="number" min="0" step="any" style={inputStyle} value={inwardForm.qty} onChange={e => setInwardForm(p => ({ ...p, qty: e.target.value }))} placeholder="e.g. 10" required={inwardItems.length === 0} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Can Size (Liters)</label>
                    <select
                      style={inputStyle}
                      value={getSelectedCanSize(inwardForm.canSize, printConfig?.inkCanSizes?.length > 0 ? printConfig.inkCanSizes : ['1 Ltr', '5 Ltr', '10 Ltr'])}
                      onChange={e => setInwardForm(p => ({ ...p, canSize: e.target.value }))}
                      required={inwardItems.length === 0}
                    >
                      {(printConfig?.inkCanSizes && printConfig.inkCanSizes.length > 0
                        ? printConfig.inkCanSizes
                        : ['1 Ltr', '5 Ltr', '10 Ltr']
                      ).map(sz => (
                        <option key={sz} value={sz}>{sz}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Other Custom Materials Form Fields */}
              {!isSublimationTab(inwardTab) &&
               !inwardTab.toLowerCase().includes('butter') &&
               !inwardTab.toLowerCase().includes('grando') &&
               !inwardTab.toLowerCase().includes('printdot') && (
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 2 }}>
                    <label style={labelStyle}>Qty</label>
                    <input type="number" min="0" step="any" style={inputStyle} value={inwardForm.qty} onChange={e => setInwardForm(p => ({ ...p, qty: e.target.value }))} required={inwardItems.length === 0} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Unit</label>
                    <select style={inputStyle} value={inwardForm.unit} onChange={e => setInwardForm(p => ({ ...p, unit: e.target.value }))}>
                      <option value="Rolls">Rolls</option>
                      <option value="Liters">Liters</option>
                      <option value="Kg">Kg</option>
                      <option value="Packets">Packets</option>
                      <option value="Meters">Meters</option>
                      <option value="Pcs">Pcs</option>
                    </select>
                  </div>
                </div>
              )}

              {!editingTransaction && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {inwardForm.qty && (inwardForm.metersPerRoll || inwardForm.canSize) ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '600' }}>
                      Calculated: {Number(inwardForm.qty) * (inwardForm.metersPerRoll ? Number(inwardForm.metersPerRoll) : parseCanSize(inwardForm.canSize))} {inwardForm.metersPerRoll ? 'meters' : 'Liters'}
                    </div>
                  ) : <div />}
                  <button
                    type="button"
                    onClick={addInwardItemToList}
                    className="btn-secondary"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <PlusCircle size={14} /> Add to List Queue
                  </button>
                </div>
              )}

              {!editingTransaction && inwardItems.length > 0 && (
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px dashed var(--border-light)',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-light)', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>QUEUED ITEMS ({inwardItems.length})</span>
                    <span style={{ color: 'var(--success)' }}>Bulk Inward Queue</span>
                  </div>
                  {inwardItems.map((item, idx) => {
                    const descParts = [];
                    if (item.panna) descParts.push(`Panna: ${item.panna}"`);
                    if (item.paperQuality) descParts.push(item.paperQuality);
                    if (item.color) descParts.push(item.color);
                    if (item.canSize) {
                      descParts.push(`Size: ${item.canSize}L`);
                      descParts.push(`Total: ${item.qty * item.canSize} Liters`);
                    }
                    if (item.metersPerRoll) {
                      descParts.push(`Roll Size: ${item.metersPerRoll}m`);
                      descParts.push(`Total: ${item.qty * item.metersPerRoll} meters`);
                    }
                    return (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255,255,255,0.03)',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '4px',
                        border: '1px solid rgba(255,255,255,0.05)'
                      }}>
                        <div style={{ fontSize: '0.8rem' }}>
                          <strong style={{ color: 'var(--primary)' }}>{item.materialName}</strong>
                          <span style={{ margin: '0 0.4rem', color: 'var(--text-muted)' }}>•</span>
                          <span style={{ fontWeight: '600' }}>{item.qty} {item.unit}</span>
                          {descParts.length > 0 && (
                            <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                              {descParts.join(' | ')}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setInwardItems(prev => prev.filter((_, i) => i !== idx))}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--danger)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '2px',
                            borderRadius: '4px'
                          }}
                          title="Remove item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, height: '70px', resize: 'none' }} value={inwardForm.notes} onChange={e => setInwardForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any other details..." />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={closeInwardModal} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={loading}>
                  {loading ? 'Submitting...' : editingTransaction ? 'Save Changes' : inwardItems.length > 0 ? `Save Inward (${inwardItems.length})` : 'Save Inward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── OUTWARD MODAL ─── */}
      {isOutwardOpen && (
        <div
          className="modal-overlay modal-backdrop"
          onClick={() => setIsOutwardOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
            overflowY: 'auto'
          }}
        >
          <div
            className="modal-content glass-panel"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '540px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: '16px',
              border: '1.5px solid #fecaca',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              padding: '1.75rem',
              position: 'relative',
              margin: 'auto'
            }}
          >
            <button onClick={() => setIsOutwardOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ArrowUpFromLine color="var(--danger)" /> Raw Material Outward
            </h3>
            {/* Material Tabs */}
            <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
              {materialsList.map(tab => (
                <button
                  type="button"
                  key={tab}
                  onClick={() => handleOutwardTabChange(tab)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    border: 'none',
                    background: outwardTab === tab ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                    color: outwardTab === tab ? '#fff' : 'var(--text-light)',
                    cursor: 'pointer',
                    fontWeight: outwardTab === tab ? '700' : '500'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            <form onSubmit={handleOutwardSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Job Card No (Optional)</label>
                  <input style={inputStyle} value={outwardForm.jobNo} onChange={e => setOutwardForm(p => ({ ...p, jobNo: e.target.value }))} placeholder="e.g. JOB-1004" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Date</label>
                  <input type="date" style={inputStyle} value={outwardForm.date} onChange={e => setOutwardForm(p => ({ ...p, date: e.target.value }))} required />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Party Name (Optional)</label>
                <input
                  list="party-datalist"
                  style={inputStyle}
                  value={outwardForm.partyName}
                  onChange={e => setOutwardForm(p => ({ ...p, partyName: e.target.value }))}
                  placeholder="Select or type party..."
                />
                <datalist id="party-datalist">
                  {partiesList.map(p => <option key={p} value={p} />)}
                </datalist>
              </div>

              {/* Sublimation Paper Form Fields */}
              {isSublimationTab(outwardTab) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Panna (Width)</label>
                      <select style={inputStyle} value={String(outwardForm.panna || '').replace(/[^0-9]/g, '') || '58'} onChange={e => setOutwardForm(p => ({ ...p, panna: e.target.value }))}>
                        {((printConfig?.widths && printConfig.widths.length > 0) ? printConfig.widths : ['36', '38', '44', '48', '52', '54', '58', '60']).map(p => {
                          const pClean = String(p).replace(/[^0-9]/g, '');
                          return <option key={p} value={pClean}>{pClean}" Panna</option>;
                        })}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Paper Quality</label>
                      <select style={inputStyle} value={outwardForm.paperQuality || 'A++'} onChange={e => setOutwardForm(p => ({ ...p, paperQuality: e.target.value }))}>
                        {((printConfig?.paperTypes && printConfig.paperTypes.length > 0) ? printConfig.paperTypes : ['A++', 'A+', 'A']).map(q => (
                          <option key={q} value={q}>{q}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Qty (Rolls)</label>
                      <input type="number" min="0" step="any" style={inputStyle} value={outwardForm.qty} onChange={e => setOutwardForm(p => ({ ...p, qty: e.target.value }))} placeholder="e.g. 5" required={outwardItems.length === 0} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Meters per Roll</label>
                      <input type="number" min="0" style={inputStyle} value={outwardForm.metersPerRoll || 1000} onChange={e => setOutwardForm(p => ({ ...p, metersPerRoll: e.target.value }))} placeholder="e.g. 1000" />
                    </div>
                  </div>
                </div>
              )}

              {/* Butter Paper Form Fields */}
              {outwardTab.toLowerCase().includes('butter') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Panna (Width)</label>
                      <select style={inputStyle} value={outwardForm.panna} onChange={e => setOutwardForm(p => ({ ...p, panna: e.target.value }))}>
                        {printConfig?.widths?.map(p => <option key={p} value={p}>{p}"</option>) || <option value="44">44"</option>}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Qty (Rolls)</label>
                      <input type="number" min="0" step="any" style={inputStyle} value={outwardForm.qty} onChange={e => setOutwardForm(p => ({ ...p, qty: e.target.value }))} placeholder="e.g. 5" required={outwardItems.length === 0} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Meters per Roll</label>
                    <input type="number" min="0" style={inputStyle} value={outwardForm.metersPerRoll} onChange={e => setOutwardForm(p => ({ ...p, metersPerRoll: e.target.value }))} placeholder="e.g. 100" required={outwardItems.length === 0} />
                  </div>
                </div>
              )}

              {/* Grando Ink Form Fields */}
              {outwardTab.toLowerCase().includes('grando') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Color</label>
                      <select 
                        style={inputStyle} 
                        value={resolveInkColorCode(outwardForm.color)} 
                        onChange={e => handleColorChange('outward', outwardTab, e.target.value)}
                      >
                        <option value="C">Cyan (C)</option>
                        <option value="M">Magenta (M)</option>
                        <option value="Y">Yellow (Y)</option>
                        <option value="K">Black (K)</option>
                        <option value="C.S.">Cleaning Solution (C.S.)</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Qty ({outwardForm.unit || 'Liters'})</label>
                      <input type="number" min="0" step="any" style={inputStyle} value={outwardForm.qty} onChange={e => setOutwardForm(p => ({ ...p, qty: e.target.value }))} placeholder="e.g. 10" required={outwardItems.length === 0} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Bottle / Can Size (Liters)</label>
                    <select
                      style={inputStyle}
                      value={getSelectedCanSize(outwardForm.canSize, printConfig?.inkCanSizes?.length > 0 ? printConfig.inkCanSizes : ['1 Ltr', '5 Ltr', '10 Ltr'])}
                      onChange={e => setOutwardForm(p => ({ ...p, canSize: e.target.value }))}
                      required={outwardItems.length === 0}
                    >
                      {(printConfig?.inkCanSizes && printConfig.inkCanSizes.length > 0
                        ? printConfig.inkCanSizes
                        : ['1 Ltr', '5 Ltr', '10 Ltr']
                      ).map(sz => (
                        <option key={sz} value={sz}>{sz}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* PrintDot Ink Form Fields */}
              {outwardTab.toLowerCase().includes('printdot') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Color</label>
                      <select 
                        style={inputStyle} 
                        value={resolveInkColorCode(outwardForm.color)} 
                        onChange={e => handleColorChange('outward', outwardTab, e.target.value)}
                      >
                        <option value="C">Cyan (C)</option>
                        <option value="M">Magenta (M)</option>
                        <option value="Y">Yellow (Y)</option>
                        <option value="K">Black (K)</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Qty ({outwardForm.unit || 'Liters'})</label>
                      <input type="number" min="0" step="any" style={inputStyle} value={outwardForm.qty} onChange={e => setOutwardForm(p => ({ ...p, qty: e.target.value }))} placeholder="e.g. 10" required={outwardItems.length === 0} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Can Size (Liters)</label>
                    <select
                      style={inputStyle}
                      value={getSelectedCanSize(outwardForm.canSize, printConfig?.inkCanSizes?.length > 0 ? printConfig.inkCanSizes : ['1 Ltr', '5 Ltr', '10 Ltr'])}
                      onChange={e => setOutwardForm(p => ({ ...p, canSize: e.target.value }))}
                      required={outwardItems.length === 0}
                    >
                      {(printConfig?.inkCanSizes && printConfig.inkCanSizes.length > 0
                        ? printConfig.inkCanSizes
                        : ['1 Ltr', '5 Ltr', '10 Ltr']
                      ).map(sz => (
                        <option key={sz} value={sz}>{sz}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Other Custom Materials Form Fields */}
              {!isSublimationTab(outwardTab) &&
               !outwardTab.toLowerCase().includes('butter') &&
               !outwardTab.toLowerCase().includes('grando') &&
               !outwardTab.toLowerCase().includes('printdot') && (
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 2 }}>
                    <label style={labelStyle}>Qty</label>
                    <input type="number" min="0" step="any" style={inputStyle} value={outwardForm.qty} onChange={e => setOutwardForm(p => ({ ...p, qty: e.target.value }))} required={outwardItems.length === 0} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Unit</label>
                    <select style={inputStyle} value={outwardForm.unit} onChange={e => setOutwardForm(p => ({ ...p, unit: e.target.value }))}>
                      <option value="Rolls">Rolls</option>
                      <option value="Liters">Liters</option>
                      <option value="Kg">Kg</option>
                      <option value="Packets">Packets</option>
                      <option value="Meters">Meters</option>
                      <option value="Pcs">Pcs</option>
                    </select>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {outwardForm.qty && (outwardForm.metersPerRoll || outwardForm.canSize) ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '600' }}>
                    Calculated: {Number(outwardForm.qty) * (outwardForm.metersPerRoll ? Number(outwardForm.metersPerRoll) : parseCanSize(outwardForm.canSize))} {outwardForm.metersPerRoll ? 'meters' : 'Liters'}
                  </div>
                ) : <div />}
                <button
                  type="button"
                  onClick={addOutwardItemToList}
                  className="btn-secondary"
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <PlusCircle size={14} /> Add to List Queue
                </button>
              </div>

              {outwardItems.length > 0 && (
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px dashed var(--border-light)',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-light)', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>QUEUED ITEMS ({outwardItems.length})</span>
                    <span style={{ color: 'var(--danger)' }}>Bulk Outward Queue</span>
                  </div>
                  {outwardItems.map((item, idx) => {
                    const descParts = [];
                    if (item.panna) descParts.push(`Panna: ${item.panna}"`);
                    if (item.paperQuality) descParts.push(item.paperQuality);
                    if (item.color) descParts.push(item.color);
                    if (item.canSize) {
                      descParts.push(`Size: ${item.canSize}L`);
                      descParts.push(`Total: ${item.qty * item.canSize} Liters`);
                    }
                    if (item.metersPerRoll) {
                      descParts.push(`Roll Size: ${item.metersPerRoll}m`);
                      descParts.push(`Total: ${item.qty * item.metersPerRoll} meters`);
                    }
                    return (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255,255,255,0.03)',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '4px',
                        border: '1px solid rgba(255,255,255,0.05)'
                      }}>
                        <div style={{ fontSize: '0.8rem' }}>
                          <strong style={{ color: 'var(--primary)' }}>{item.materialName}</strong>
                          <span style={{ margin: '0 0.4rem', color: 'var(--text-muted)' }}>•</span>
                          <span style={{ fontWeight: '600' }}>{item.qty} {item.unit}</span>
                          {descParts.length > 0 && (
                            <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                              {descParts.join(' | ')}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setOutwardItems(prev => prev.filter((_, i) => i !== idx))}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--danger)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '2px',
                            borderRadius: '4px'
                          }}
                          title="Remove item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, height: '70px', resize: 'none' }} value={outwardForm.notes} onChange={e => setOutwardForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any details..." />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setIsOutwardOpen(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={loading}>
                  {loading ? 'Submitting...' : outwardItems.length > 0 ? `Save Outward (${outwardItems.length})` : 'Save Outward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── SISTER COMPANY INWARD VERIFICATION & INSPECTION MODAL ─── */}
      {verifyModalOpen && selectedSisterTx && (
        <div
          className="modal-overlay modal-backdrop"
          onClick={() => setVerifyModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div
            className="modal-content glass-panel"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '520px',
              width: '100%',
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              padding: '1.75rem',
              position: 'relative',
              margin: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={20} color="#10b981" />
                  {selectedSisterTx.verificationStatus === 'VERIFIED' ? 'Verified Inward Inspection' : selectedSisterTx.verificationStatus === 'REJECTED' ? 'Rejected Inward Inspection' : 'Verify Sister Company Inward Material'}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Target Company: <strong>{companyEntity}</strong>
                </span>
              </div>
              <button onClick={() => setVerifyModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            {/* Document Details Card */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem', marginBottom: '1.25rem', fontSize: '0.82rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>Sending Sister Company</span>
                <strong style={{ color: '#4338ca' }}>{selectedSisterTx.sourceCompany || selectedSisterTx.vendorName}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>Document Reference</span>
                <strong>{selectedSisterTx.sourceDocNo || selectedSisterTx.challanNo}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>Material Name</span>
                <strong>{selectedSisterTx.materialName}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>Challan / Invoice Qty</span>
                <strong>{selectedSisterTx.qty} {selectedSisterTx.unit || 'Rolls'}</strong>
              </div>
            </div>

            <form onSubmit={handleVerifySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {selectedSisterTx.verificationStatus === 'PENDING_CHECK' ? (
                <>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <button
                      type="button"
                      onClick={() => setVerifyAction('VERIFY')}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        borderRadius: '8px',
                        border: verifyAction === 'VERIFY' ? '2px solid #10b981' : '1px solid #cbd5e1',
                        background: verifyAction === 'VERIFY' ? '#dcfce7' : '#ffffff',
                        color: verifyAction === 'VERIFY' ? '#15803d' : '#64748b',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <CheckCircle2 size={16} /> Details Correct (Accept)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVerifyAction('REJECT')}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        borderRadius: '8px',
                        border: verifyAction === 'REJECT' ? '2px solid #ef4444' : '1px solid #cbd5e1',
                        background: verifyAction === 'REJECT' ? '#fee2e2' : '#ffffff',
                        color: verifyAction === 'REJECT' ? '#b91c1c' : '#64748b',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <XCircle size={16} /> Report Discrepancy (Reject)
                    </button>
                  </div>

                  {verifyAction === 'VERIFY' ? (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                          Confirmed Received Quantity ({selectedSisterTx.unit || 'Rolls'}) *
                        </label>
                        <input
                          type="number"
                          step="any"
                          required
                          value={verifyQty}
                          onChange={e => setVerifyQty(e.target.value)}
                          style={{ ...inputStyle, width: '100%' }}
                          placeholder={`Expected: ${selectedSisterTx.qty}`}
                        />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                          Physical measurement check. Upon confirmation, this quantity will become active in {companyEntity}'s raw material stock.
                        </span>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                          Verification Notes / Quality Remarks (Optional)
                        </label>
                        <textarea
                          rows="2"
                          value={verifyNotes}
                          onChange={e => setVerifyNotes(e.target.value)}
                          style={{ ...inputStyle, width: '100%', resize: 'vertical' }}
                          placeholder="e.g. Received in sound condition. Rolls counted and tagged."
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.3rem', color: '#dc2626' }}>
                        Discrepancy / Rejection Reason *
                      </label>
                      <textarea
                        rows="3"
                        required
                        value={discrepancyReason}
                        onChange={e => setDiscrepancyReason(e.target.value)}
                        style={{ ...inputStyle, width: '100%', borderColor: '#fca5a5', resize: 'vertical' }}
                        placeholder="e.g. 10 meters short, damaged rolls, or incorrect fabric quality received."
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => setVerifyModalOpen(false)}
                      className="btn-secondary"
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingVerify}
                      className={verifyAction === 'VERIFY' ? 'btn-primary' : 'btn-danger'}
                      style={{
                        flex: 2,
                        background: verifyAction === 'VERIFY' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#ef4444',
                        border: 'none',
                        color: '#fff',
                        fontWeight: 800
                      }}
                    >
                      {submittingVerify
                        ? 'Saving...'
                        : verifyAction === 'VERIFY'
                          ? 'Confirm & Add to Stock'
                          : 'Reject Inward Material'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ padding: '0.85rem', background: selectedSisterTx.verificationStatus === 'VERIFIED' ? '#f0fdf4' : '#fef2f2', borderRadius: '8px', border: `1px solid ${selectedSisterTx.verificationStatus === 'VERIFIED' ? '#bbf7d0' : '#fecaca'}` }}>
                    <div style={{ fontWeight: 800, color: selectedSisterTx.verificationStatus === 'VERIFIED' ? '#15803d' : '#b91c1c', marginBottom: '0.4rem' }}>
                      {selectedSisterTx.verificationStatus === 'VERIFIED' ? '✅ Inward Verification Passed' : '❌ Inward Verification Rejected'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                      <div>Checked By: <strong>{selectedSisterTx.verifiedBy || 'Staff'}</strong></div>
                      <div>Verified Date: {formatDateDDMMYYYY(selectedSisterTx.verifiedAt || selectedSisterTx.updatedAt)}</div>
                      {selectedSisterTx.verifiedQty != null && <div>Confirmed Stock Qty: <strong>{selectedSisterTx.verifiedQty} {selectedSisterTx.unit}</strong></div>}
                      {selectedSisterTx.verificationNotes && <div style={{ marginTop: '0.4rem' }}>Notes: <em>{selectedSisterTx.verificationNotes}</em></div>}
                      {selectedSisterTx.discrepancyReason && <div style={{ marginTop: '0.4rem', color: '#dc2626' }}>Reason: <strong>{selectedSisterTx.discrepancyReason}</strong></div>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVerifyModalOpen(false)}
                    className="btn-secondary"
                    style={{ width: '100%', marginTop: '0.5rem' }}
                  >
                    Close
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE TRANSACTION CONFIRMATION MODAL ─── */}
      {deleteTarget && (
        <div
          className="modal-overlay modal-backdrop"
          onClick={() => setDeleteTarget(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div
            className="modal-content glass-panel"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '420px',
              width: '100%',
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              padding: '1.75rem',
              textAlign: 'center',
              position: 'relative',
              margin: 'auto'
            }}
          >
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--danger)' }}>Confirm Deletion</h3>
            <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Are you sure you want to delete this transaction record?
              <br />
              <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget.label}</strong>
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleDelete} className="btn-primary" style={{ flex: 1, background: 'var(--danger)', border: 'none' }}>
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD NEW RAW MATERIAL MODAL ─── */}
      {isNewMaterialModalOpen && (
        <div
          className="modal-overlay modal-backdrop"
          onClick={() => !newMaterialSubmitting && setIsNewMaterialModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
            overflowY: 'auto'
          }}
        >
          <div
            className="modal-content glass-panel"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '560px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: '16px',
              border: '1.5px solid #bfdbfe',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              padding: '1.75rem',
              position: 'relative',
              margin: 'auto'
            }}
          >
            <button
              onClick={() => setIsNewMaterialModalOpen(false)}
              disabled={newMaterialSubmitting}
              style={{ position: 'absolute', top: '1.1rem', right: '1.1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Add New Raw Material
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Company: <strong>{companyEntity}</strong> · Garment Industry Catalog Entry
                </span>
              </div>
            </div>

            <form onSubmit={handleCreateNewMaterial} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Category & Unit */}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <label style={labelStyle}>Garment Material Category *</label>
                  <select
                    style={{ ...inputStyle, fontWeight: 700 }}
                    value={newMaterialForm.category}
                    onChange={e => {
                      const cat = e.target.value;
                      let defaultUnit = 'Meters';
                      if (cat.includes('Thread')) defaultUnit = 'Cones / Spools';
                      else if (cat.includes('Button')) defaultUnit = 'Pieces (Pcs)';
                      else if (cat.includes('Elastic')) defaultUnit = 'Meters';
                      else if (cat.includes('Label')) defaultUnit = 'Pieces (Pcs)';
                      else if (cat.includes('Pack')) defaultUnit = 'Pieces (Pcs)';
                      else if (cat.includes('Fusing')) defaultUnit = 'Meters';
                      setNewMaterialForm(p => ({ ...p, category: cat, unit: defaultUnit }));
                    }}
                    required
                  >
                    {GARMENT_RAW_CATEGORIES.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    {isDigitalPrint && <option value="Inks & Consumables">Inks & Consumables</option>}
                  </select>
                </div>

                <div style={{ flex: 1, minWidth: '140px' }}>
                  <label style={labelStyle}>Unit of Measurement *</label>
                  <select
                    style={inputStyle}
                    value={newMaterialForm.unit}
                    onChange={e => setNewMaterialForm(p => ({ ...p, unit: e.target.value }))}
                    required
                  >
                    {RAW_MATERIAL_UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Material Name */}
              <div>
                <label style={labelStyle}>Raw Material Name *</label>
                <input
                  style={{ ...inputStyle, fontWeight: 600 }}
                  placeholder="e.g. Viscose Rayon 14kg, 40/2 Thread, 18L Resin Button..."
                  value={newMaterialForm.materialName}
                  onChange={e => setNewMaterialForm(p => ({ ...p, materialName: e.target.value }))}
                  required
                />
              </div>

              {/* Shade/Color & Width/Panna */}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Shade / Color / Design #</label>
                  <input
                    style={inputStyle}
                    placeholder="e.g. Off-White #01, Black, Navy"
                    value={newMaterialForm.shade}
                    onChange={e => setNewMaterialForm(p => ({ ...p, shade: e.target.value }))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Width / Panna / Size</label>
                  <input
                    style={inputStyle}
                    placeholder="e.g. 44 in, 58 in, 1.25 inch"
                    value={newMaterialForm.panna}
                    onChange={e => setNewMaterialForm(p => ({ ...p, panna: e.target.value }))}
                  />
                </div>
              </div>

              {/* HSN Code & Warehouse Location */}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>HSN Code</label>
                  <input
                    style={inputStyle}
                    placeholder="e.g. 5407, 5208, 9606"
                    value={newMaterialForm.hsnCode}
                    onChange={e => setNewMaterialForm(p => ({ ...p, hsnCode: e.target.value }))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Storage Location / Rack</label>
                  <input
                    style={inputStyle}
                    placeholder="e.g. Rack A-12, Store Bin 3"
                    value={newMaterialForm.location}
                    onChange={e => setNewMaterialForm(p => ({ ...p, location: e.target.value }))}
                  />
                </div>
              </div>

              {/* Opening Stock & Rate & Reorder */}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Opening / Initial Qty</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    style={inputStyle}
                    placeholder="0"
                    value={newMaterialForm.initialQty}
                    onChange={e => setNewMaterialForm(p => ({ ...p, initialQty: e.target.value }))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Est. Unit Rate (₹)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    style={inputStyle}
                    placeholder="0.00"
                    value={newMaterialForm.unitRate}
                    onChange={e => setNewMaterialForm(p => ({ ...p, unitRate: e.target.value }))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Reorder Min Level</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    style={inputStyle}
                    placeholder="10"
                    value={newMaterialForm.reorderLevel}
                    onChange={e => setNewMaterialForm(p => ({ ...p, reorderLevel: e.target.value }))}
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label style={labelStyle}>Remarks / Supplier Notes</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
                  placeholder="Optional notes, standard supplier, quality specs..."
                  value={newMaterialForm.notes}
                  onChange={e => setNewMaterialForm(p => ({ ...p, notes: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsNewMaterialModalOpen(false)}
                  disabled={newMaterialSubmitting}
                  className="btn-secondary"
                  style={{ padding: '0.6rem 1.25rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newMaterialSubmitting}
                  className="btn-primary"
                  style={{ padding: '0.6rem 1.5rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', fontWeight: 700 }}
                >
                  {newMaterialSubmitting ? 'Saving...' : 'Save Raw Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
