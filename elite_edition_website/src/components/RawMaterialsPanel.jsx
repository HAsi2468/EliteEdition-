import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import {
  Layers, Database, Settings, Trash2, Search, X, FileDown,
  Plus, Edit, ArrowDownToLine, ArrowUpFromLine, RefreshCw, FileSpreadsheet, AlertCircle,
  FileText, Droplet, Printer, CheckCircle2, ChevronRight
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

export default function RawMaterialsPanel({ companyEntity = 'Elite Digital Print' } = {}) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const currentUser = api.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const [stock, setStock] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [materialsList, setMaterialsList] = useState([
    'Sublimation Paper', 'Butter Paper', 'Grando Ink', 'Printdot Ink'
  ]);
  const [vendorsList, setVendorsList] = useState([]);
  const [partiesList, setPartiesList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);

  const downloadCsvFile = (csvContent, fileName) => {
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
  const [inwardTab, setInwardTab] = useState('Sublimation Paper');
  const [outwardTab, setOutwardTab] = useState('Sublimation Paper');

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

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch PrintConfig to get custom list of raw materials if saved
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

      // 2. Fetch vendors list
      try {
        const vRes = await api.getFabricVendors();
        if (vRes) setVendorsList(vRes);
      } catch (e) {
        console.warn('Failed to fetch vendors:', e);
      }

      // 3. Fetch Stock Overview
      const stockRes = await api.getRawMaterialStock();
      if (stockRes.success) setStock(stockRes.data);

      // 4. Fetch Transactions
      const transRes = await api.getRawMaterialTransactions();
      if (transRes.success) setTransactions(transRes.data);

    } catch (err) {
      setError(err.message || 'Failed to load raw materials inventory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const fetchStock = async () => {
      try {
        const stockParams = {};
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
  }, [stockPreset, stockDateStart, stockDateEnd, customStockStart, customStockEnd]);

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
        panna: configData?.widths?.[0] || '44',
        paperQuality: configData?.paperTypes?.[0] || '70 GSM',
        metersPerRoll: 100,
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
    
    let canSize = 5;
    let unit = 'Cans';
    
    if (isGrando) {
      if (colorValue === 'C.S.') {
        canSize = 1;
        unit = 'Bottles';
      } else {
        canSize = 5;
        unit = 'Cans';
      }
    } else if (isPrintdot) {
      canSize = 10;
      unit = 'Cans';
    }
    
    if (type === 'inward') {
      setInwardForm(prev => ({ ...prev, color: colorValue, canSize, unit }));
    } else {
      setOutwardForm(prev => ({ ...prev, color: colorValue, canSize, unit }));
    }
  };

  const validateItem = (tabName, qty, metersPerRoll, canSize) => {
    if (!qty || Number(qty) <= 0) {
      return 'Please enter a valid quantity.';
    }
    const isPaperGrade = ['a++', 'a+', 'a'].includes((tabName || '').toLowerCase());
    const isSublimation = tabName.toLowerCase().includes('sublimation') || isPaperGrade;
    const isButter = tabName.toLowerCase().includes('butter');
    const isGrando = tabName.toLowerCase().includes('grando');
    const isPrintdot = tabName.toLowerCase().includes('printdot');

    if ((isSublimation || isButter) && (!metersPerRoll || Number(metersPerRoll) <= 0)) {
      return 'Please enter a valid meters per roll.';
    }
    if ((isGrando || isPrintdot) && (!canSize || parseCanSize(canSize) <= 0)) {
      return 'Please enter a valid can/bottle size.';
    }
    return null;
  };

  const addInwardItemToList = () => {
    if (!inwardForm.vendorName) {
      alert('Please select or enter a Vendor / Supplier Name.');
      return;
    }
    const err = validateItem(inwardTab, inwardForm.qty, inwardForm.metersPerRoll, inwardForm.canSize);
    if (err) {
      alert(err);
      return;
    }

    const itemToAdd = {
      materialName: inwardTab,
      qty: Number(inwardForm.qty),
      unit: inwardForm.unit || 'Rolls',
      panna: inwardForm.panna || '',
      paperQuality: inwardForm.paperQuality || '',
      color: inwardForm.color || '',
      canSize: inwardForm.canSize ? parseCanSize(inwardForm.canSize) : '',
      metersPerRoll: inwardForm.metersPerRoll ? Number(inwardForm.metersPerRoll) : '',
      challanNo: inwardForm.challanNo,
      vendorName: inwardForm.vendorName,
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

    const itemToAdd = {
      materialName: outwardTab,
      qty: Number(outwardForm.qty),
      unit: outwardForm.unit || 'Rolls',
      panna: outwardForm.panna || '',
      paperQuality: outwardForm.paperQuality || '',
      color: outwardForm.color || '',
      canSize: outwardForm.canSize ? parseCanSize(outwardForm.canSize) : '',
      metersPerRoll: outwardForm.metersPerRoll ? Number(outwardForm.metersPerRoll) : '',
      jobNo: outwardForm.jobNo,
      partyName: outwardForm.partyName,
      date: outwardForm.date,
      notes: outwardForm.notes,
    };
    setOutwardItems(prev => [...prev, itemToAdd]);
    // Clear qty
    setOutwardForm(prev => ({ ...prev, qty: '' }));
  };

  const handleInwardSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let payload = [...inwardItems];
      if (payload.length === 0) {
        if (!inwardForm.vendorName) {
          alert('Please select or enter a Vendor / Supplier Name.');
          setLoading(false);
          return;
        }
        const err = validateItem(inwardTab, inwardForm.qty, inwardForm.metersPerRoll, inwardForm.canSize);
        if (err) {
          alert(err);
          setLoading(false);
          return;
        }
        payload = [{
          materialName: inwardTab,
          qty: Number(inwardForm.qty),
          unit: inwardForm.unit || 'Rolls',
          panna: inwardForm.panna || '',
          paperQuality: inwardForm.paperQuality || '',
          color: inwardForm.color || '',
          canSize: inwardForm.canSize ? parseCanSize(inwardForm.canSize) : '',
          metersPerRoll: inwardForm.metersPerRoll ? Number(inwardForm.metersPerRoll) : '',
          challanNo: inwardForm.challanNo,
          vendorName: inwardForm.vendorName,
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
      let payload = [...outwardItems];
      if (payload.length === 0) {
        const err = validateItem(outwardTab, outwardForm.qty, outwardForm.metersPerRoll, outwardForm.canSize);
        if (err) {
          alert(err);
          setLoading(false);
          return;
        }
        payload = [{
          materialName: outwardTab,
          qty: Number(outwardForm.qty),
          unit: outwardForm.unit || 'Rolls',
          panna: outwardForm.panna || '',
          paperQuality: outwardForm.paperQuality || '',
          color: outwardForm.color || '',
          canSize: outwardForm.canSize ? parseCanSize(outwardForm.canSize) : '',
          metersPerRoll: outwardForm.metersPerRoll ? Number(outwardForm.metersPerRoll) : '',
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

  const filteredStock = stock.filter(item => matchesMaterialType(item.materialName, stockMaterialType));

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
    { id: 'inward', label: 'Inward Register', icon: ArrowDownToLine },
    { id: 'outward', label: 'Outward Register', icon: ArrowUpFromLine },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      {/* Header & Navigation */}
      <div className="glass-panel" style={{ display: 'flex', gap: '1rem', padding: '0.75rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={20} /> Current Raw Material Stock
              </h2>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Material Type / Category Filter */}
                <select
                  style={{ ...inputStyle, width: '180px', fontWeight: 700 }}
                  value={stockMaterialType}
                  onChange={e => setStockMaterialType(e.target.value)}
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

                <button onClick={() => { setEditingTransaction(null); setIsInwardOpen(true); handleInwardTabChange('Sublimation Paper'); setInwardItems([]); }} className="btn-primary" style={{ gap: '0.4rem' }}>
                  <ArrowDownToLine size={16} /> Stock Inward
                </button>
                <button onClick={() => { setIsOutwardOpen(true); handleOutwardTabChange('Sublimation Paper'); setOutwardItems([]); }} className="btn-secondary" style={{ gap: '0.4rem' }}>
                  <ArrowUpFromLine size={16} /> Stock Outward
                </button>
              </div>
            </div>

            {/* Summary Bar */}
            {stock.length > 0 && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Items Configured</span><br /><strong>{materialsList.length}</strong></div>
                <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Active Stock Profiles</span><br /><strong>{filteredStock.length} / {stock.length}</strong></div>
                <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Inward Transactions</span><br /><strong style={{ color: 'var(--success)' }}>{stockFilteredTx.filter(t => t.type === 'INWARD').length}</strong></div>
                <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Outward Transactions</span><br /><strong style={{ color: 'var(--danger)' }}>{stockFilteredTx.filter(t => t.type === 'OUTWARD').length}</strong></div>
              </div>
            )}

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

              const showPaper = stockMaterialType === 'All' || matchesMaterialType('Sublimation Paper', stockMaterialType) || matchesMaterialType('Butter Paper', stockMaterialType);
              const showGrando = stockMaterialType === 'All' || stockMaterialType === 'Ink' || stockMaterialType === 'All Inks' || stockMaterialType === 'Grando Ink';
              const showPrintdot = stockMaterialType === 'All' || stockMaterialType === 'Ink' || stockMaterialType === 'All Inks' || stockMaterialType === 'Printdot Ink';
              const showOther = stockMaterialType === 'All' || (!showPaper && !showGrando && !showPrintdot);

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

              const handleQuickInward = (matName, panna = '', color = '', canSize = null) => {
                setEditingTransaction(null);
                setIsInwardOpen(true);
                handleInwardTabChange(matName || 'Sublimation Paper');
                setInwardForm(prev => ({
                  ...prev,
                  materialName: matName,
                  panna: panna ? panna.replace(/"/g, '').replace(/panna/i, '').trim() : prev.panna,
                  color: color || prev.color,
                  canSize: canSize || prev.canSize
                }));
                setInwardItems([]);
              };

              const handleQuickOutward = (matName, panna = '', color = '', canSize = null) => {
                setIsOutwardOpen(true);
                handleOutwardTabChange(matName || 'Sublimation Paper');
                setOutwardForm(prev => ({
                  ...prev,
                  materialName: matName,
                  panna: panna ? panna.replace(/"/g, '').replace(/panna/i, '').trim() : prev.panna,
                  color: color || prev.color,
                  canSize: canSize || prev.canSize
                }));
                setOutwardItems([]);
              };

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
                background: '#1e293b',
                color: '#ffffff',
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
                                          onClick={() => handleQuickInward(item.materialName, item.panna)}
                                          className="btn-primary" 
                                          title="Quick Inward for this paper & panna"
                                          style={{ padding: '3px 8px', fontSize: '0.72rem', gap: '3px' }}
                                        >
                                          <Plus size={11} /> In
                                        </button>
                                        <button 
                                          onClick={() => handleQuickOutward(item.materialName, item.panna)}
                                          className="btn-secondary" 
                                          title="Quick Outward for this paper & panna"
                                          style={{ padding: '3px 8px', fontSize: '0.72rem', gap: '3px' }}
                                        >
                                          <ArrowUpFromLine size={11} /> Out
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
                              const matched = grandoItems.find(it => {
                                const cLower = (it.color || '').toLowerCase();
                                const mLower = (it.materialName || '').toLowerCase();
                                if (spec.key === 'Cyan') return cLower === 'cyan' || mLower.includes('cyan') || it.color === 'C';
                                if (spec.key === 'Magenta') return cLower === 'magenta' || mLower.includes('magenta') || it.color === 'M';
                                if (spec.key === 'Yellow') return cLower === 'yellow' || mLower.includes('yellow') || it.color === 'Y';
                                if (spec.key === 'Black') return cLower === 'black' || mLower.includes('black') || it.color === 'K';
                                if (spec.key === 'Cleaning') return cLower.includes('clean') || mLower.includes('clean') || it.color === 'C.S.';
                                return false;
                              });

                              const inward = matched ? (matched.totalInward || 0) : 0;
                              const outward = matched ? (matched.totalOutward || 0) : 0;
                              const currentStock = matched ? (matched.currentStock || 0) : 0;
                              const canSize = matched?.canSize || 1;
                              const matName = matched?.materialName || `Grando Ink - ${spec.name}`;

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
                                      {canSize} Liter Bottle
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
                                        style={{ padding: '3px 8px', fontSize: '0.72rem', gap: '3px' }}
                                      >
                                        <Plus size={11} /> In
                                      </button>
                                      <button 
                                        onClick={() => handleQuickOutward('Grando Ink', '', spec.key, canSize)}
                                        className="btn-secondary" 
                                        title={`Quick Outward for Grando ${spec.name}`}
                                        style={{ padding: '3px 8px', fontSize: '0.72rem', gap: '3px' }}
                                      >
                                        <ArrowUpFromLine size={11} /> Out
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
                              const matched = printdotItems.find(it => {
                                const cLower = (it.color || '').toLowerCase();
                                const mLower = (it.materialName || '').toLowerCase();
                                if (spec.key === 'Cyan') return cLower === 'cyan' || mLower.includes('cyan') || it.color === 'C';
                                if (spec.key === 'Magenta') return cLower === 'magenta' || mLower.includes('magenta') || it.color === 'M';
                                if (spec.key === 'Yellow') return cLower === 'yellow' || mLower.includes('yellow') || it.color === 'Y';
                                if (spec.key === 'Black') return cLower === 'black' || mLower.includes('black') || it.color === 'K';
                                return false;
                              });

                              const inward = matched ? (matched.totalInward || 0) : 0;
                              const outward = matched ? (matched.totalOutward || 0) : 0;
                              const currentStock = matched ? (matched.currentStock || 0) : 0;
                              const canSize = matched?.canSize || 1;

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
                                        style={{ padding: '3px 8px', fontSize: '0.72rem', gap: '3px' }}
                                      >
                                        <Plus size={11} /> In
                                      </button>
                                      <button 
                                        onClick={() => handleQuickOutward('Printdot Ink', '', spec.key, canSize)}
                                        className="btn-secondary" 
                                        title={`Quick Outward for Printdot ${spec.name}`}
                                        style={{ padding: '3px 8px', fontSize: '0.72rem', gap: '3px' }}
                                      >
                                        <ArrowUpFromLine size={11} /> Out
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

                  {/* 4. OTHER MATERIALS TABLE (If any) */}
                  {showOther && otherItems.length > 0 && (
                    <div style={tableCardStyle}>
                      <div style={tableHeaderBarStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Layers size={18} />
                          </div>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Other Raw Materials</h3>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Additional configured accessories & raw materials</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                          <thead>
                            <tr>
                              <th style={thStyle}>Material Name</th>
                              <th style={{ ...thStyle, textAlign: 'center' }}>Total Inward</th>
                              <th style={{ ...thStyle, textAlign: 'center' }}>Total Outward</th>
                              <th style={{ ...thStyle, textAlign: 'right' }}>Available Stock</th>
                              <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                              <th style={{ ...thStyle, textAlign: 'center' }}>Quick Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {otherItems.map((item, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                <td style={tdStyle}>
                                  <strong style={{ color: 'var(--text-primary)' }}>{item.materialName}</strong>
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--success)', fontWeight: 700 }}>
                                  {item.totalInward || 0} {item.unit || 'Units'}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--danger)', fontWeight: 700 }}>
                                  {item.totalOutward || 0} {item.unit || 'Units'}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'right' }}>
                                  <strong style={{ fontSize: '1.05rem', fontWeight: 800, color: (item.currentStock || 0) <= 0 ? 'var(--danger)' : 'var(--primary)' }}>
                                    {item.currentStock || 0}
                                  </strong>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '4px' }}>{item.unit || 'Units'}</span>
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                  {renderStockStatusBadge(item.currentStock || 0)}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                    <button 
                                      onClick={() => handleQuickInward(item.materialName)}
                                      className="btn-primary" 
                                      style={{ padding: '3px 8px', fontSize: '0.72rem', gap: '3px' }}
                                    >
                                      <Plus size={11} /> In
                                    </button>
                                    <button 
                                      onClick={() => handleQuickOutward(item.materialName)}
                                      className="btn-secondary" 
                                      style={{ padding: '3px 8px', fontSize: '0.72rem', gap: '3px' }}
                                    >
                                      <ArrowUpFromLine size={11} /> Out
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
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
                      <select style={inputStyle} value={inwardForm.panna} onChange={e => setInwardForm(p => ({ ...p, panna: e.target.value }))}>
                        {printConfig?.widths?.map(p => <option key={p} value={p}>{p}"</option>) || <option value="44">44"</option>}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Paper Quality</label>
                      <select style={inputStyle} value={inwardForm.paperQuality} onChange={e => setInwardForm(p => ({ ...p, paperQuality: e.target.value }))}>
                        {printConfig?.paperTypes?.map(q => <option key={q} value={q}>{q}</option>) || <option value="70 GSM">70 GSM</option>}
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
                      <input type="number" min="0" style={inputStyle} value={inwardForm.metersPerRoll} onChange={e => setInwardForm(p => ({ ...p, metersPerRoll: e.target.value }))} placeholder="e.g. 100" required={inwardItems.length === 0} />
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
                      <select style={inputStyle} value={inwardForm.color} onChange={e => handleColorChange('inward', inwardTab, e.target.value)}>
                        {(printConfig?.inkColors || ['C', 'M', 'Y', 'K', 'C.S.']).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Qty ({inwardForm.unit || 'Cans'})</label>
                      <input type="number" min="0" step="any" style={inputStyle} value={inwardForm.qty} onChange={e => setInwardForm(p => ({ ...p, qty: e.target.value }))} placeholder="e.g. 2" required={inwardItems.length === 0} />
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
                      <select style={inputStyle} value={inwardForm.color} onChange={e => handleColorChange('inward', inwardTab, e.target.value)}>
                        {['C', 'M', 'Y', 'K'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Qty (Cans)</label>
                      <input type="number" min="0" step="any" style={inputStyle} value={inwardForm.qty} onChange={e => setInwardForm(p => ({ ...p, qty: e.target.value }))} placeholder="e.g. 2" required={inwardItems.length === 0} />
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
                      <select style={inputStyle} value={outwardForm.panna} onChange={e => setOutwardForm(p => ({ ...p, panna: e.target.value }))}>
                        {printConfig?.widths?.map(p => <option key={p} value={p}>{p}"</option>) || <option value="44">44"</option>}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Paper Quality</label>
                      <select style={inputStyle} value={outwardForm.paperQuality} onChange={e => setOutwardForm(p => ({ ...p, paperQuality: e.target.value }))}>
                        {printConfig?.paperTypes?.map(q => <option key={q} value={q}>{q}</option>) || <option value="70 GSM">70 GSM</option>}
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
                      <input type="number" min="0" style={inputStyle} value={outwardForm.metersPerRoll} onChange={e => setOutwardForm(p => ({ ...p, metersPerRoll: e.target.value }))} placeholder="e.g. 100" required={outwardItems.length === 0} />
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
                      <select style={inputStyle} value={outwardForm.color} onChange={e => handleColorChange('outward', outwardTab, e.target.value)}>
                        {(printConfig?.inkColors || ['C', 'M', 'Y', 'K', 'C.S.']).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Qty ({outwardForm.unit || 'Cans'})</label>
                      <input type="number" min="0" step="any" style={inputStyle} value={outwardForm.qty} onChange={e => setOutwardForm(p => ({ ...p, qty: e.target.value }))} placeholder="e.g. 2" required={outwardItems.length === 0} />
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
                      <select style={inputStyle} value={outwardForm.color} onChange={e => handleColorChange('outward', outwardTab, e.target.value)}>
                        {['C', 'M', 'Y', 'K'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Qty (Cans)</label>
                      <input type="number" min="0" step="any" style={inputStyle} value={outwardForm.qty} onChange={e => setOutwardForm(p => ({ ...p, qty: e.target.value }))} placeholder="e.g. 2" required={outwardItems.length === 0} />
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

    </div>
  );
}
