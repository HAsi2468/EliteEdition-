import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import {
  RefreshCw, PlusCircle, ArrowDownToLine, ArrowUpFromLine,
  Layers, Database, Settings, Trash2, FileDown, Search, X,
  CheckCircle, AlertCircle, Calendar, Tag, User, Clipboard, Edit
} from 'lucide-react';

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

export default function RawMaterialsPanel() {
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

  const handleExportCsv = () => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const itemsMap = new Map();

    // 1. Gather combinations from transactions
    transactions.forEach(t => {
      const mName = String(t.materialName || '').trim();
      if (!mName) return;

      const panna = String(t.panna || '').trim();
      const paperQuality = String(t.paperQuality || '').trim();
      const color = String(t.color || '').trim();
      const canSize = t.canSize || '';
      const metersPerRoll = t.metersPerRoll || '';

      const key = `${mName}|||${panna}|||${paperQuality}|||${color}|||${canSize}|||${metersPerRoll}`;
      if (!itemsMap.has(key)) {
        itemsMap.set(key, { materialName: mName, panna, paperQuality, color, canSize, metersPerRoll, openingStock: 0, inwardQty: 0, outwardQty: 0, currentStock: 0 });
      }

      const item = itemsMap.get(key);
      const qty = Number(t.qty || 0);
      const tDate = new Date(t.date);
      const isPrev = tDate < startOfMonth;
      const isAdj = t.notes && t.notes.includes('Adjustment');

      if (isPrev) {
        if (t.type === 'INWARD') {
          item.openingStock += qty;
        } else {
          item.openingStock -= qty;
        }
      } else {
        if (t.type === 'INWARD') {
          if (!isAdj) item.inwardQty += qty;
        } else {
          if (!isAdj) item.outwardQty += qty;
        }
      }
    });

    // 2. Add configured base materials from materialsList if not present
    materialsList.forEach(m => {
      const mName = String(m || '').trim();
      if (!mName) return;
      
      const isSub = mName.toLowerCase().includes('sublimation');
      const isButter = mName.toLowerCase().includes('butter');
      const isInk = mName.toLowerCase().includes('ink');
      
      const pannas = (isSub || isButter) && printConfig?.widths?.length > 0 ? printConfig.widths : [''];
      const paperQualities = isSub && printConfig?.paperTypes?.length > 0 ? printConfig.paperTypes : [''];
      const colors = isInk && printConfig?.inkColors?.length > 0 ? printConfig.inkColors : [''];

      pannas.forEach(p => {
        paperQualities.forEach(pq => {
          colors.forEach(col => {
            const canSize = isInk ? (mName.toLowerCase().includes('grando') ? 5 : 10) : '';
            const metersPerRoll = (isSub || isButter) ? 100 : '';
            const key = `${mName}|||${p}|||${pq}|||${col}|||${canSize}|||${metersPerRoll}`;
            if (!itemsMap.has(key)) {
              itemsMap.set(key, { materialName: mName, panna: p, paperQuality: pq, color: col, canSize, metersPerRoll, openingStock: 0, inwardQty: 0, outwardQty: 0, currentStock: 0 });
            }
          });
        });
      });
    });

    // 3. Compute final currentStock and format as CSV
    const rows = [];
    itemsMap.forEach(item => {
      let totalIn = 0;
      let totalOut = 0;
      transactions.forEach(t => {
        if (String(t.materialName || '').trim().toLowerCase() === item.materialName.toLowerCase() &&
            String(t.panna || '').trim() === item.panna &&
            String(t.paperQuality || '').trim() === item.paperQuality &&
            String(t.color || '').trim() === item.color &&
            (t.canSize || '') == item.canSize &&
            (t.metersPerRoll || '') == item.metersPerRoll) {
          if (t.type === 'INWARD') totalIn += Number(t.qty || 0);
          else totalOut += Number(t.qty || 0);
        }
      });
      item.currentStock = totalIn - totalOut;
      rows.push(item);
    });

    // Generate CSV string
    const headers = ['Material Name', 'Panna', 'Paper Quality', 'Color', 'Can Size', 'Meters Per Roll', 'Opening Stock', 'Inward Qty', 'Outward Qty', 'Current Stock', 'Date', 'Challan No', 'Vendor Name', 'Job No', 'Party Name', 'Notes'];
    const csvContent = [
      headers.join(','),
      ...rows.map(r => [
        `"${r.materialName}"`,
        `"${r.panna}"`,
        `"${r.paperQuality}"`,
        `"${r.color}"`,
        r.canSize,
        r.metersPerRoll,
        r.openingStock.toFixed(2),
        r.inwardQty.toFixed(2),
        r.outwardQty.toFixed(2),
        r.currentStock.toFixed(2),
        '""', // Date
        '""', // Challan No
        '""', // Vendor Name
        '""', // Job No
        '""', // Party Name
        '""'  // Notes
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `raw-materials-stock-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

        const rows = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const cols = [];
          let insideQuote = false;
          let currentWord = '';
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              insideQuote = !insideQuote;
            } else if (char === ',' && !insideQuote) {
              cols.push(currentWord.trim());
              currentWord = '';
            } else {
              currentWord += char;
            }
          }
          cols.push(currentWord.trim());

          const materialName = cols[0];
          const panna = cols[1];
          const paperQuality = cols[2];
          const color = cols[3];
          const canSize = cols[4];
          const metersPerRoll = cols[5];
          const openingStock = cols[6];
          const inwardQty = cols[7];
          const outwardQty = cols[8];
          const currentStock = cols[9];
          const date = cols[10];
          const challanNo = cols[11];
          const vendorName = cols[12];
          const jobNo = cols[13];
          const partyName = cols[14];
          const notes = cols[15];

          if (!materialName) continue;

          rows.push({
            materialName,
            panna,
            paperQuality,
            color,
            canSize: canSize !== undefined && canSize !== '' ? parseFloat(canSize) : null,
            metersPerRoll: metersPerRoll !== undefined && metersPerRoll !== '' ? parseFloat(metersPerRoll) : null,
            openingStock: openingStock !== undefined && openingStock !== '' ? parseFloat(openingStock) : 0,
            inwardQty: inwardQty !== undefined && inwardQty !== '' ? parseFloat(inwardQty) : 0,
            outwardQty: outwardQty !== undefined && outwardQty !== '' ? parseFloat(outwardQty) : 0,
            currentStock: currentStock !== undefined && currentStock !== '' ? parseFloat(currentStock) : 0,
            date: date || '',
            challanNo: challanNo || '',
            vendorName: vendorName || '',
            jobNo: jobNo || '',
            partyName: partyName || '',
            notes: notes || ''
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
  const [inwardSortBy, setInwardSortBy] = useState('date');
  const [inwardSortOrder, setInwardSortOrder] = useState('desc');

  const [outwardDateStart, setOutwardDateStart] = useState('');
  const [outwardDateEnd, setOutwardDateEnd] = useState('');
  const [outwardSortBy, setOutwardSortBy] = useState('date');
  const [outwardSortOrder, setOutwardSortOrder] = useState('desc');

  // PDF download filter state
  const [pdfFilter, setPdfFilter] = useState({
    dateStart: '',
    dateEnd: '',
    materialName: ''
  });
  const [isPdfFilterOpen, setIsPdfFilterOpen] = useState(false);
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

  // Helper to get defaults for a material
  const getMaterialDefaults = (materialName, configData) => {
    const val = materialName || '';
    const isSublimation = val.toLowerCase().includes('sublimation');
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
    const isSublimation = tabName.toLowerCase().includes('sublimation');
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

  const handleDownloadPdf = async (e) => {
    e.preventDefault();
    try {
      setPdfLoading(true);
      await api.downloadRawMaterialLedgerPdf(pdfFilter);
      setIsPdfFilterOpen(false);
    } catch (err) {
      alert('Failed to download PDF: ' + err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  // Filter local registers
  const inwardTx = transactions.filter(t => {
    if (t.type !== 'INWARD') return false;
    if (inwardDateStart && t.date < inwardDateStart) return false;
    if (inwardDateEnd && t.date > inwardDateEnd + 'T23:59:59') return false;
    if (!inwardSearch) return true;
    const s = inwardSearch.toLowerCase();
    return (t.materialName || '').toLowerCase().includes(s)
      || (t.vendorName || '').toLowerCase().includes(s)
      || (t.challanNo || '').toLowerCase().includes(s)
      || (t.panna || '').toLowerCase().includes(s)
      || (t.paperQuality || '').toLowerCase().includes(s)
      || (t.color || '').toLowerCase().includes(s);
  }).sort((a, b) => {
    let valA = a[inwardSortBy];
    let valB = b[inwardSortBy];
    if (inwardSortBy === 'date') {
      valA = new Date(a.date);
      valB = new Date(b.date);
    }
    if (valA < valB) return inwardSortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return inwardSortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const outwardTx = transactions.filter(t => {
    if (t.type !== 'OUTWARD') return false;
    if (outwardDateStart && t.date < outwardDateStart) return false;
    if (outwardDateEnd && t.date > outwardDateEnd + 'T23:59:59') return false;
    if (!outwardSearch) return true;
    const s = outwardSearch.toLowerCase();
    return (t.materialName || '').toLowerCase().includes(s)
      || (t.partyName || '').toLowerCase().includes(s)
      || (t.jobNo || '').toLowerCase().includes(s)
      || (t.panna || '').toLowerCase().includes(s)
      || (t.paperQuality || '').toLowerCase().includes(s)
      || (t.color || '').toLowerCase().includes(s);
  }).sort((a, b) => {
    let valA = a[outwardSortBy];
    let valB = b[outwardSortBy];
    if (outwardSortBy === 'date') {
      valA = new Date(a.date);
      valB = new Date(b.date);
    }
    if (valA < valB) return outwardSortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return outwardSortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const renderMaterialCell = (t) => {
    const nameLower = (t.materialName || '').toLowerCase();
    const details = [];
    if (nameLower.includes('sublimation')) {
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
    
    return (
      <div>
        <div style={{ fontWeight: '700' }}>{t.materialName}</div>
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
    const isSublimation = val.toLowerCase().includes('sublimation');
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
        <button onClick={handleExportCsv} className="btn-secondary" title="Download Raw Materials Stock CSV" style={{ gap: '0.4rem' }}>
          <FileDown size={16} /> Export CSV
        </button>
        <button onClick={() => fileInputRef.current && fileInputRef.current.click()} className="btn-secondary" title="Upload Raw Materials Stock CSV" style={{ gap: '0.4rem' }}>
          <ArrowDownToLine size={16} /> Import CSV
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImportCsv}
          accept=".csv"
          style={{ display: 'none' }}
        />
        <button onClick={() => setIsPdfFilterOpen(true)} className="btn-secondary" title="Download Ledger PDF" style={{ gap: '0.4rem' }}>
          <FileDown size={16} /> PDF Report
        </button>
        <button onClick={fetchData} className="btn-icon" title="Refresh Data">
          <RefreshCw size={18} className={loading ? 'spin-loader' : ''} />
        </button>
      </div>

      {error && <div style={{ color: 'red', padding: '1rem', background: '#ffebeb', borderRadius: '8px' }}>{error}</div>}

      {/* Main Content Area */}
      <div className="glass-panel" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={20} /> Current Raw Material Stock
              </h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Active Stock Profiles</span><br /><strong>{stock.length}</strong></div>
                <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Inward Transactions</span><br /><strong style={{ color: 'var(--success)' }}>{transactions.filter(t => t.type === 'INWARD').length}</strong></div>
                <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Outward Transactions</span><br /><strong style={{ color: 'var(--danger)' }}>{transactions.filter(t => t.type === 'OUTWARD').length}</strong></div>
              </div>
            )}

            {/* Materials Stock Cards */}
            {stock.length === 0 && !loading && <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No stock data logged yet. Click Stock Inward to add items.</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.2rem' }}>
              {stock.map((item, idx) => {
                const isLow = item.currentStock <= 5;
                const isEmpty = item.currentStock <= 0;
                return (
                  <div key={idx} style={{
                    background: isEmpty ? 'rgba(239,68,68,0.05)' : isLow ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isEmpty ? 'var(--danger)' : isLow ? '#f59e0b' : 'var(--border-light)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '120px'
                  }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        {renderMaterialCell(item)}
                        {isEmpty ? (
                          <span style={{ fontSize: '0.65rem', background: 'var(--danger)', color: '#fff', borderRadius: '4px', padding: '2px 6px', fontWeight: 700 }}>EMPTY</span>
                        ) : isLow ? (
                          <span style={{ fontSize: '0.65rem', background: '#f59e0b', color: '#000', borderRadius: '4px', padding: '2px 6px', fontWeight: 700 }}>LOW STOCK</span>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>Total In: <strong style={{ color: 'var(--success)' }}>{item.totalInward}</strong></span>
                        <span>Total Out: <strong style={{ color: 'var(--danger)' }}>{item.totalOutward}</strong></span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '1rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {item.metersPerRoll ? (
                          <>Total: <strong>{item.currentStock * item.metersPerRoll}m</strong> ({item.currentStock} rolls)</>
                        ) : item.canSize ? (
                          <>Total: <strong>{item.currentStock * item.canSize} Ltr</strong> ({item.currentStock} {item.unit || 'Cans'})</>
                        ) : (
                          'Available Stock'
                        )}
                      </span>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '1.8rem', fontWeight: 800, color: isEmpty ? 'var(--danger)' : isLow ? '#f59e0b' : 'var(--primary)' }}>
                          {item.currentStock}
                        </strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginLeft: '0.3rem' }}>{item.unit || 'Rolls'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>From:</span>
                  <input
                    type="date"
                    value={inwardDateStart}
                    onChange={e => setInwardDateStart(e.target.value)}
                    style={{ ...inputStyle, width: '130px', padding: '0.3rem' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>To:</span>
                  <input
                    type="date"
                    value={inwardDateEnd}
                    onChange={e => setInwardDateEnd(e.target.value)}
                    style={{ ...inputStyle, width: '130px', padding: '0.3rem' }}
                  />
                </div>
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
                        <td>{new Date(t.date).toLocaleDateString('en-IN')}</td>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>From:</span>
                  <input
                    type="date"
                    value={outwardDateStart}
                    onChange={e => setOutwardDateStart(e.target.value)}
                    style={{ ...inputStyle, width: '130px', padding: '0.3rem' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>To:</span>
                  <input
                    type="date"
                    value={outwardDateEnd}
                    onChange={e => setOutwardDateEnd(e.target.value)}
                    style={{ ...inputStyle, width: '130px', padding: '0.3rem' }}
                  />
                </div>
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
                        <td>{new Date(t.date).toLocaleDateString('en-IN')}</td>
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
        <div className="modal-backdrop">
          <div className="modal-content glass-panel" style={{ maxWidth: '500px', padding: '2rem', position: 'relative' }}>
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
              {inwardTab.toLowerCase().includes('sublimation') && (
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
              {!inwardTab.toLowerCase().includes('sublimation') &&
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
        <div className="modal-backdrop">
          <div className="modal-content glass-panel" style={{ maxWidth: '500px', padding: '2rem', position: 'relative' }}>
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
              {outwardTab.toLowerCase().includes('sublimation') && (
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
              {!outwardTab.toLowerCase().includes('sublimation') &&
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

      {/* ─── LEDGER PDF DOWNLOAD FILTERS MODAL ─── */}
      {isPdfFilterOpen && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel" style={{ maxWidth: '400px', padding: '2rem', position: 'relative' }}>
            <button onClick={() => setIsPdfFilterOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileDown /> Raw Material Ledger Report
            </h3>
            <form onSubmit={handleDownloadPdf} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Material Item (Optional)</label>
                <select style={inputStyle} value={pdfFilter.materialName} onChange={e => setPdfFilter(p => ({ ...p, materialName: e.target.value }))}>
                  <option value="">-- All Materials --</option>
                  {materialsList.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Start Date (Optional)</label>
                  <input type="date" style={inputStyle} value={pdfFilter.dateStart} onChange={e => setPdfFilter(p => ({ ...p, dateStart: e.target.value }))} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>End Date (Optional)</label>
                  <input type="date" style={inputStyle} value={pdfFilter.dateEnd} onChange={e => setPdfFilter(p => ({ ...p, dateEnd: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setIsPdfFilterOpen(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={pdfLoading}>
                  {pdfLoading ? <RefreshCw className="spin-loader" /> : 'Download PDF'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE TRANSACTION CONFIRMATION MODAL ─── */}
      {deleteTarget && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel" style={{ maxWidth: '400px', padding: '2rem', textAlign: 'center' }}>
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
