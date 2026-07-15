import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import CatalogManagerModal from './CatalogManagerModal';
import {
  RefreshCw, PlusCircle, ArrowDownToLine, ArrowUpFromLine,
  Layers, Database, Settings, Trash2, FileDown, Search, X,
  AlertTriangle, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Edit, FileText,
  Check, Plus
} from 'lucide-react';

export default function FabricInventoryPanel() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const currentUser = api.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const [stock, setStock] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [fabricsList, setFabricsList] = useState([]);
  const [vendorsList, setVendorsList] = useState([]);
  const [partiesList, setPartiesList] = useState([]);
  const [widthsList, setWidthsList] = useState([]);
  const [inProgressJobCards, setInProgressJobCards] = useState([]);
  const [lotList, setLotList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lotLoading, setLotLoading] = useState(false);

  // Challan state
  const [challans, setChallans] = useState([]);
  const [challanSearch, setChallanSearch] = useState('');
  const [challanDateStart, setChallanDateStart] = useState('');
  const [challanDateEnd, setChallanDateEnd] = useState('');
  const [isChallanOpen, setIsChallanOpen] = useState(false);
  const [editingChallan, setEditingChallan] = useState(null);
  const [challanLotLoading, setChallanLotLoading] = useState(false);
  const [challanDeleteTarget, setChallanDeleteTarget] = useState(null);
  const [availableLots, setAvailableLots] = useState([]);
  const emptyTpRows = () => [{ tpNo: 1, tpMeter: '' }];
  const [challanForm, setChallanForm] = useState({
    date: new Date().toISOString().split('T')[0],
    partyName: '',
    lotNo: '',
    vendorChallanNo: '',
    fabricName: '',
    shortagePct: '',
    jobNo: '',
    designNo: '',
    colour: '',
    panna: '',
    tpDetails: emptyTpRows(),
    notes: '',
  });

  const fileInputRef = useRef(null);

  const handleExportCsv = () => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const itemsMap = new Map();

    // 1. Gather combinations from transactions
    transactions.forEach(t => {
      const fName = String(t.fabricQuality || '').trim().toUpperCase();
      const pVal = String(t.panna || '').trim();
      if (!fName) return;

      const key = `${fName}|||${pVal}`;
      if (!itemsMap.has(key)) {
        itemsMap.set(key, { fabricQuality: fName, panna: pVal, openingStock: 0, inwardQty: 0, outwardQty: 0, currentStock: 0 });
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

    // 2. Add configured fabrics from fabricsList if not present
    fabricsList.forEach(f => {
      const fName = String(f || '').trim().toUpperCase();
      if (!fName) return;
      const widths = widthsList.length > 0 ? widthsList : [''];
      widths.forEach(w => {
        const pVal = String(w || '').trim();
        const key = `${fName}|||${pVal}`;
        if (!itemsMap.has(key)) {
          itemsMap.set(key, { fabricQuality: fName, panna: pVal, openingStock: 0, inwardQty: 0, outwardQty: 0, currentStock: 0 });
        }
      });
    });

    // 3. Compute final currentStock and format as CSV
    const rows = [];
    itemsMap.forEach(item => {
      let totalIn = 0;
      let totalOut = 0;
      transactions.forEach(t => {
        if (String(t.fabricQuality || '').trim().toUpperCase() === item.fabricQuality &&
            String(t.panna || '').trim() === item.panna) {
          if (t.type === 'INWARD') totalIn += Number(t.qty || 0);
          else totalOut += Number(t.qty || 0);
        }
      });
      item.currentStock = totalIn - totalOut;
      rows.push(item);
    });

    // Generate CSV string
    const headers = ['Fabric Quality', 'Panna', 'Opening Stock', 'Inward Qty', 'Outward Qty', 'Current Stock', 'Date', 'Challan No', 'Vendor Name', 'Job No', 'Party Name', 'Notes'];
    const csvContent = [
      headers.join(','),
      ...rows.map(r => [
        `"${r.fabricQuality}"`,
        `"${r.panna}"`,
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
    link.setAttribute('download', `fabric-stock-${new Date().toISOString().split('T')[0]}.csv`);
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

          const fabricQuality = cols[0];
          const panna = cols[1];
          const openingStock = cols[2];
          const inwardQty = cols[3];
          const outwardQty = cols[4];
          const currentStock = cols[5];
          const date = cols[6];
          const challanNo = cols[7];
          const vendorName = cols[8];
          const jobNo = cols[9];
          const partyName = cols[10];
          const notes = cols[11];

          if (!fabricQuality) continue;

          rows.push({
            fabricQuality,
            panna,
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
        const res = await api.importFabricStock(rows);
        if (res.success) {
          alert(res.message || 'Fabric stock imported successfully.');
          fetchData();
        } else {
          alert(res.error || 'Failed to import fabric stock.');
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

  // Panna-wise stock & requirement
  const [pannaStock, setPannaStock] = useState([]);
  const [requirement, setRequirement] = useState([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [expandedFabric, setExpandedFabric] = useState(null);

  // Search / filter state
  const [inwardSearch, setInwardSearch] = useState('');
  const [outwardSearch, setOutwardSearch] = useState('');

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
    fabricQuality: ''
  });
  const [isPdfFilterOpen, setIsPdfFilterOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, type, label }

  // Editing transaction
  const [editingTransaction, setEditingTransaction] = useState(null);

  // Modals
  const [isInwardOpen, setIsInwardOpen] = useState(false);
  const [isOutwardOpen, setIsOutwardOpen] = useState(false);
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  // Form states
  const [inwardForm, setInwardForm] = useState({
    challanNo: '', vendorName: '', fabricQuality: '', panna: '', qty: '', shortagePct: '', date: new Date().toISOString().split('T')[0], notes: ''
  });
  const [outwardForm, setOutwardForm] = useState({
    jobNo: '', challanNo: '', partyName: '', fabricQuality: '', panna: '', lotNo: '', qty: '', date: new Date().toISOString().split('T')[0], notes: ''
  });

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const cfg = await api.getPrintConfig();
      if (cfg && Array.isArray(cfg.fabrics)) {
        setFabricsList(cfg.fabrics);
      } else if (cfg && cfg.fabrics) {
        setFabricsList(Object.keys(cfg.fabrics));
      }

      try {
        const vRes = await api.getFabricVendors();
        if (vRes) setVendorsList(vRes);
      } catch (e) {
        console.warn('Failed to fetch fabric vendors', e);
      }

      if (cfg && cfg.parties) setPartiesList(cfg.parties);
      if (cfg && cfg.widths) setWidthsList(cfg.widths);

      try {
        const jRes = await api.getJobCards({ status: 'In Progress', limit: 200 });
        if (jRes && jRes.data) setInProgressJobCards(jRes.data);
      } catch (e) {
        console.warn('Failed to fetch in-progress job cards', e);
      }

      const stockRes = await api.getFabricStock();
      if (stockRes.success) setStock(stockRes.data);

      const transRes = await api.getFabricTransactions();
      if (transRes.success) setTransactions(transRes.data);

      // Panna-wise stock
      try {
        const pRes = await api.getFabricStockByPanna();
        if (pRes && pRes.success) setPannaStock(pRes.data || []);
      } catch (e) { console.warn('Failed to fetch panna stock', e); }

    } catch (err) {
      setError(err.message || 'Failed to load fabric inventory data.');
    } finally {
      setLoading(false);
    }
  };

  // fetch requirement from job cards
  const fetchRequirement = async () => {
    setReqLoading(true);
    try {
      const res = await api.getFabricRequirement();
      if (res && res.success) setRequirement(res.data || []);
    } catch (e) {
      console.warn('Failed to fetch requirement', e);
    } finally {
      setReqLoading(false);
    }
  };

  useEffect(() => { fetchData(); fetchRequirement(); }, []);

  // ─── Fetch ALL lots (no filter) — client side will filter by fabric ───
  const fetchAllLots = async () => {
    setLotLoading(true);
    try {
      const res = await api.getFabricLotStock({});
      if (res && res.success) setLotList(res.data || []);
    } catch (e) {
      console.warn('Failed to fetch lot stock', e);
    } finally {
      setLotLoading(false);
    }
  };

  // Re-fetch lots whenever outward modal opens
  useEffect(() => {
    if (isOutwardOpen) fetchAllLots();
  }, [isOutwardOpen]);

  const handleJobNoChange = async (e) => {
    const val = e.target.value;
    const job = inProgressJobCards.find(j => j.jobNo === val);
    setOutwardForm(prev => {
      const updated = { ...prev, jobNo: val, lotNo: '' };
      if (job) {
        updated.partyName = job.party || '';
        updated.fabricQuality = job.fabric || '';
        updated.panna = job.panna || '';
      }
      return updated;
    });
    // Always refresh all lots when job changes
    fetchAllLots();
  };

  const handleLotNoChange = (e) => {
    const val = e.target.value;
    setOutwardForm(prev => {
      const updated = { ...prev, lotNo: val };
      const lot = lotList.find(l => String(l.lotNo) === String(val));
      if (lot && lot.panna) updated.panna = lot.panna;
      return updated;
    });
  };

  const handleInwardSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingTransaction) {
        await api.updateFabricTransaction(editingTransaction._id, inwardForm);
      } else {
        await api.createFabricInward(inwardForm);
      }
      setIsInwardOpen(false);
      setEditingTransaction(null);
      setInwardForm({ challanNo: '', vendorName: '', fabricQuality: '', panna: '', qty: '', shortagePct: '', date: new Date().toISOString().split('T')[0], notes: '' });
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
      await api.createFabricOutward(outwardForm);
      setIsOutwardOpen(false);
      setOutwardForm({ jobNo: '', partyName: '', fabricQuality: '', panna: '', lotNo: '', qty: '', date: new Date().toISOString().split('T')[0], notes: '' });
      fetchData();
    } catch (err) {
      alert(err.message);
      setLoading(false);
    }
  };

  const startEditInward = (t) => {
    setEditingTransaction(t);
    setInwardForm({
      challanNo: t.challanNo || '',
      vendorName: t.vendorName || '',
      fabricQuality: t.fabricQuality || '',
      panna: t.panna || '',
      qty: t.qty || '',
      shortagePct: t.shortagePct != null ? t.shortagePct : '',
      date: t.date ? new Date(t.date).toISOString().split('T')[0] : '',
      notes: t.notes || ''
    });
    setIsInwardOpen(true);
  };

  const closeInwardModal = () => {
    setIsInwardOpen(false);
    setEditingTransaction(null);
    setInwardForm({ challanNo: '', vendorName: '', fabricQuality: '', panna: '', qty: '', shortagePct: '', date: new Date().toISOString().split('T')[0], notes: '' });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteFabricTransaction(deleteTarget.id);
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      await api.downloadFabricLedgerPdf(pdfFilter);
      setIsPdfFilterOpen(false);
    } catch (err) {
      alert('Failed to generate PDF: ' + err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  // ── Challan helpers ────────────────────────────────────────────────────
  const resetChallanForm = () => {
    setAvailableLots([]);
    setChallanForm({
      date: new Date().toISOString().split('T')[0],
      partyName: '', lotNo: '', vendorChallanNo: '', fabricName: '', shortagePct: '',
      jobNo: '', designNo: '', colour: '', panna: '',
      tpDetails: emptyTpRows(), notes: '',
    });
  };

  const fetchChallans = async () => {
    try {
      const res = await api.getFabricChallans({
        dateStart: challanDateStart,
        dateEnd: challanDateEnd,
        search: challanSearch,
      });
      if (res.success) setChallans(res.data || []);
    } catch (e) {
      console.warn('Failed to fetch challans', e);
    }
  };

  useEffect(() => { fetchChallans(); }, [challanDateStart, challanDateEnd, challanSearch]);

  // When Lot No changes — auto-fill vendor challans, fabric, shortage, panna
  const handleChallanLotChange = async (val) => {
    setChallanForm(prev => ({ ...prev, lotNo: val }));
    if (!val) return;

    // Parse list of lot numbers
    const lotsList = String(val)
      .split(/[,\s&]+/)
      .map(x => x.trim())
      .filter(Boolean);

    if (lotsList.length === 0) return;

    setChallanLotLoading(true);
    try {
      // Fetch details for all selected lots concurrently
      const promises = lotsList.map(lot => api.getFabricLotInfo(lot).catch(() => null));
      const results = await Promise.all(promises);

      const validResults = results.filter(r => r && r.success && r.data);
      if (validResults.length > 0) {
        // Collect all vendor challans
        const vendorChallans = validResults
          .map(r => r.data.vendorChallanNo)
          .filter(Boolean);
        
        // Remove duplicates and join with commas
        const uniqueChallans = [...new Set(vendorChallans)].join(', ');

        // Collect fabricName, shortage, panna from first valid response
        const first = validResults[0].data;

        setChallanForm(prev => ({
          ...prev,
          vendorChallanNo: uniqueChallans || prev.vendorChallanNo,
          fabricName: first.fabricName || prev.fabricName,
          shortagePct: first.shortagePct != null ? String(first.shortagePct) : prev.shortagePct,
          panna: prev.panna || first.panna || '',
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch multiple lot info', e);
    } finally {
      setChallanLotLoading(false);
    }
  };

  // When Job No changes — auto-fill design, colour, panna, fabric, party
  const handleChallanJobChange = async (val) => {
    setChallanForm(prev => ({ ...prev, jobNo: val }));
    const job = inProgressJobCards.find(j => j.jobNo === val);
    if (job) {
      setChallanForm(prev => ({
        ...prev,
        jobNo: val,
        designNo: job.designNo || prev.designNo,
        colour: job.colors || prev.colour,
        panna: job.panna || prev.panna,
        fabricName: job.fabric || prev.fabricName,
        partyName: job.party || prev.partyName,
      }));

      // Fetch lot numbers that have this fabric
      if (job.fabric) {
        try {
          const res = await api.getFabricLotStock({ fabricQuality: job.fabric });
          if (res.success && res.data) {
            setAvailableLots(res.data);
          }
        } catch (e) {
          console.warn('Failed to fetch lot stock for fabric', e);
        }
      }
    } else {
      setAvailableLots([]);
    }
  };

  // TP detail update
  const updateTpRow = (index, field, value) => {
    setChallanForm(prev => {
      const tpDetails = [...prev.tpDetails];
      tpDetails[index] = { ...tpDetails[index], [field]: value };
      return { ...prev, tpDetails };
    });
  };

  const addTpRow = () => {
    setChallanForm(prev => {
      if (prev.tpDetails.length >= 30) return prev;
      const nextNo = prev.tpDetails.length + 1;
      return { ...prev, tpDetails: [...prev.tpDetails, { tpNo: nextNo, tpMeter: '' }] };
    });
  };

  const removeTpRow = (index) => {
    setChallanForm(prev => {
      const tpDetails = prev.tpDetails.filter((_, i) => i !== index);
      return { ...prev, tpDetails };
    });
  };

  // Computed totals from tpDetails
  const challanTotalMtr = challanForm.tpDetails.reduce((sum, r) => sum + (parseFloat(r.tpMeter) || 0), 0);
  const challanTotalTp = challanForm.tpDetails.filter(r => parseFloat(r.tpMeter) > 0).length;

  const handleChallanSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...challanForm,
        totalMtr: challanTotalMtr,
        totalTp: challanTotalTp,
        tpDetails: challanForm.tpDetails
          .filter(r => r.tpMeter !== '' && r.tpMeter != null)
          .map(r => ({ tpNo: Number(r.tpNo), tpMeter: parseFloat(r.tpMeter) || 0 })),
      };
      if (editingChallan) {
        await api.updateFabricChallan(editingChallan._id, payload);
      } else {
        await api.createFabricChallan(payload);
      }
      setIsChallanOpen(false);
      setEditingChallan(null);
      resetChallanForm();
      fetchChallans();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startEditChallan = (c) => {
    setEditingChallan(c);
    const tpRows = c.tpDetails && c.tpDetails.length > 0
      ? c.tpDetails.map(r => ({ tpNo: r.tpNo, tpMeter: String(r.tpMeter) }))
      : emptyTpRows();
    setChallanForm({
      date: c.date ? new Date(c.date).toISOString().split('T')[0] : '',
      partyName: c.partyName || '',
      lotNo: c.lotNo != null ? String(c.lotNo) : '',
      vendorChallanNo: c.vendorChallanNo || '',
      fabricName: c.fabricName || '',
      shortagePct: c.shortagePct != null ? String(c.shortagePct) : '',
      jobNo: c.jobNo || '',
      designNo: c.designNo || '',
      colour: c.colour || '',
      panna: c.panna || '',
      tpDetails: tpRows,
      notes: c.notes || '',
    });

    if (c.fabricName) {
      api.getFabricLotStock({ fabricQuality: c.fabricName }).then(res => {
        if (res.success && res.data) setAvailableLots(res.data);
      }).catch(() => {});
    } else {
      setAvailableLots([]);
    }

    setIsChallanOpen(true);
  };

  const handleChallanDelete = async () => {
    if (!challanDeleteTarget) return;
    try {
      await api.deleteFabricChallan(challanDeleteTarget.id);
      setChallanDeleteTarget(null);
      fetchChallans();
    } catch (err) {
      alert('Failed to delete challan: ' + err.message);
    }
  };

  const handleDownloadChallanPdf = async (id, challanNo) => {
    try {
      await api.downloadFabricChallanPdf(id, challanNo);
    } catch (err) {
      alert('Failed to download PDF: ' + err.message);
    }
  };

  // Filtered transaction lists
  const inwardTx = transactions.filter(t => {
    if (t.type !== 'INWARD') return false;
    if (inwardDateStart && t.date < inwardDateStart) return false;
    if (inwardDateEnd && t.date > inwardDateEnd + 'T23:59:59') return false;
    if (!inwardSearch) return true;
    const s = inwardSearch.toLowerCase();
    return (t.fabricQuality || '').toLowerCase().includes(s)
      || (t.vendorName || '').toLowerCase().includes(s)
      || (t.challanNo || '').toLowerCase().includes(s)
      || String(t.lotNo || '').includes(s);
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
    return (t.fabricQuality || '').toLowerCase().includes(s)
      || (t.partyName || '').toLowerCase().includes(s)
      || (t.jobNo || '').toLowerCase().includes(s)
      || String(t.lotNo || '').includes(s);
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
    ...(isAdmin ? [{ id: 'outward', label: 'Outward Register', icon: ArrowUpFromLine }] : []),
    { id: 'challan', label: 'Challan', icon: FileText },
    { id: 'requirement', label: 'Fabric Requirement', icon: AlertTriangle },
  ];

  // Parse lot numbers from the comma-separated lotNo field
  const parseSelectedLots = (lotNoStr) => {
    if (!lotNoStr) return [];
    return String(lotNoStr)
      .split(/[,\s&]+/)
      .map(x => x.trim())
      .filter(Boolean);
  };

  const selectedLotsList = parseSelectedLots(challanForm.lotNo);

  // Calculate sum of available meters from the selected lots
  const selectedLotsTotalStock = selectedLotsList.reduce((sum, lotNo) => {
    const lotStockItem = availableLots.find(l => String(l.lotNo) === lotNo);
    return sum + (lotStockItem ? lotStockItem.currentStock : 0);
  }, 0);

  const activeJob = inProgressJobCards.find(j => j.jobNo === challanForm.jobNo);
  const jobMtrNeeded = activeJob ? parseFloat(activeJob.totalMtr) || 0 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      {/* Header & Navigation */}
      <div className="glass-panel" style={{ display: 'flex', gap: '1rem', padding: '0.75rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'nowrap', overflowX: 'auto' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.5rem 1.1rem', fontSize: '0.85rem', flexShrink: 0 }}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={handleExportCsv} className="btn-secondary" title="Download Fabric Stock CSV" style={{ gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.85rem', flexShrink: 0 }}>
            <FileDown size={16} /> Export CSV
          </button>
          <button onClick={() => fileInputRef.current && fileInputRef.current.click()} className="btn-secondary" title="Upload Fabric Stock CSV" style={{ gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.85rem', flexShrink: 0 }}>
            <ArrowDownToLine size={16} /> Import CSV
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportCsv}
            accept=".csv"
            style={{ display: 'none' }}
          />
          <button onClick={() => setIsPdfFilterOpen(true)} className="btn-secondary" title="Download Ledger PDF" style={{ gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.85rem', flexShrink: 0 }}>
            <FileDown size={16} /> PDF Report
          </button>
          <button onClick={fetchData} className="btn-icon" title="Refresh Data" style={{ padding: '0.5rem', flexShrink: 0 }}>
            <RefreshCw size={18} className={loading ? 'spin-loader' : ''} />
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'red', padding: '1rem', background: '#ffebeb', borderRadius: '8px' }}>{error}</div>}

      {/* Main Content Area */}
      <div className="glass-panel" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div>
            <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Layers size={20} /> Current Fabric Stock</h2>

            {/* Summary Bar */}
            {stock.length > 0 && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total Fabrics</span><br /><strong>{stock.length}</strong></div>
                <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total Received</span><br /><strong style={{ color: 'var(--success)' }}>{stock.reduce((a, i) => a + i.totalInward, 0)} mtr</strong></div>
                <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total Used</span><br /><strong style={{ color: 'var(--danger)' }}>{stock.reduce((a, i) => a + i.totalOutward, 0)} mtr</strong></div>
                <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Net Available</span><br /><strong style={{ color: 'var(--primary)' }}>{stock.reduce((a, i) => a + i.currentStock, 0)} mtr</strong></div>
                <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Low Stock</span><br /><strong style={{ color: '#f59e0b' }}>{stock.filter(i => i.currentStock > 0 && i.currentStock <= 50).length}</strong></div>
              </div>
            )}

            {/* Fabric Quality Cards with Panna breakdown */}
            {stock.length === 0 && !loading && <p>No stock data found.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {stock.map((item, idx) => {
                const isLow = item.currentStock <= 50;
                const isEmpty = item.currentStock <= 0;
                const isExpanded = expandedFabric === item.fabricQuality;
                // Get panna-wise rows for this fabric
                const pannaRows = pannaStock.filter(p =>
                  p.fabricQuality.toLowerCase().trim() === item.fabricQuality.toLowerCase().trim()
                );
                return (
                  <div key={idx} style={{
                    background: isEmpty ? 'rgba(239,68,68,0.05)' : isLow ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isEmpty ? 'var(--danger)' : isLow ? '#f59e0b' : 'var(--border-light)'}`,
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden'
                  }}>
                    {/* Header row */}
                    <div
                      onClick={() => setExpandedFabric(isExpanded ? null : item.fabricQuality)}
                      style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.2rem', cursor: 'pointer', gap: '1rem' }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '1rem' }}>{item.fabricQuality}</span>
                          {isLow && !isEmpty && (
                            <span style={{ fontSize: '0.65rem', background: '#f59e0b', color: '#000', borderRadius: '4px', padding: '2px 6px', fontWeight: 700 }}>LOW</span>
                          )}
                          {isEmpty && (
                            <span style={{ fontSize: '0.65rem', background: 'var(--danger)', color: '#fff', borderRadius: '4px', padding: '2px 6px', fontWeight: 700 }}>EMPTY</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          <span>In: <strong style={{ color: 'var(--success)' }}>{item.totalInward} mtr</strong></span>
                          <span>Out: <strong style={{ color: 'var(--danger)' }}>{item.totalOutward} mtr</strong></span>
                          <span>{pannaRows.length} panna variant{pannaRows.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: isEmpty ? 'var(--danger)' : isLow ? '#f59e0b' : 'var(--primary)' }}>
                          {item.currentStock}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '-4px' }}>mtr available</div>
                      </div>
                      <div style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>

                    {/* Panna-wise breakdown (collapsible) */}
                    {isExpanded && pannaRows.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--border-light)', padding: '0 1.2rem 1rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                              <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Panna (Width)</th>
                              <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Inward (mtr)</th>
                              <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Outward (mtr)</th>
                              <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Available (mtr)</th>
                              <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Lots</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pannaRows.map((p, pi) => {
                              const rowIsLow = p.currentStock <= 50;
                              const rowIsEmpty = p.currentStock <= 0;
                              return (
                                <tr key={pi} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                  <td style={{ padding: '0.5rem 0.5rem', fontWeight: 600 }}>
                                    <span style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '4px', padding: '2px 8px', fontSize: '0.8rem' }}>
                                      {p.panna && p.panna !== 'Unknown' ? `${p.panna}"` : '—'}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right', padding: '0.5rem', color: 'var(--success)' }}>+{p.totalInward}</td>
                                  <td style={{ textAlign: 'right', padding: '0.5rem', color: 'var(--danger)' }}>-{p.totalOutward}</td>
                                  <td style={{ textAlign: 'right', padding: '0.5rem', fontWeight: 700, color: rowIsEmpty ? 'var(--danger)' : rowIsLow ? '#f59e0b' : 'var(--text-primary)' }}>
                                    {p.currentStock}
                                  </td>
                                  <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                                    <span style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '20px', padding: '2px 8px', fontSize: '0.75rem' }}>{p.lotCount}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {isExpanded && pannaRows.length === 0 && (
                      <div style={{ padding: '0.75rem 1.2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem', borderTop: '1px solid var(--border-light)' }}>
                        No panna-wise breakdown available. Set Panna when adding Inward.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Inward Tab */}
        {activeTab === 'inward' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2>Inward Transactions</h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search fabric, vendor, lot..."
                    value={inwardSearch}
                    onChange={e => setInwardSearch(e.target.value)}
                    style={{ ...inputStyle, width: '200px', paddingLeft: '1.8rem' }}
                  />
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

                <button className="btn-primary" onClick={() => { fetchData(); setEditingTransaction(null); setInwardForm({ challanNo: '', vendorName: '', fabricQuality: '', panna: '', qty: '', shortagePct: '', date: new Date().toISOString().split('T')[0], notes: '' }); setIsInwardOpen(true); }}>
                  <PlusCircle size={16} /> New Inward
                </button>
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
                        if (inwardSortBy === 'lotNo') {
                          setInwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setInwardSortBy('lotNo');
                          setInwardSortOrder('desc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Lot No {inwardSortBy === 'lotNo' ? (inwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
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
                        if (inwardSortBy === 'vendorName') {
                          setInwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setInwardSortBy('vendorName');
                          setInwardSortOrder('asc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Vendor {inwardSortBy === 'vendorName' ? (inwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th 
                      onClick={() => {
                        if (inwardSortBy === 'fabricQuality') {
                          setInwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setInwardSortBy('fabricQuality');
                          setInwardSortOrder('asc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Fabric Quality {inwardSortBy === 'fabricQuality' ? (inwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th>Panna</th>
                    <th 
                      onClick={() => {
                        if (inwardSortBy === 'qty') {
                          setInwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setInwardSortBy('qty');
                          setInwardSortOrder('desc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Qty (mtr) {inwardSortBy === 'qty' ? (inwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th>Shortage %</th>
                    <th>Notes</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {inwardTx.map(t => (
                    <tr key={t._id}>
                      <td>{new Date(t.date).toLocaleDateString()}</td>
                      <td><span style={{ fontWeight: 600 }}>#{t.lotNo}</span></td>
                      <td>{t.challanNo}</td>
                      <td>{t.vendorName}</td>
                      <td>{t.fabricQuality}</td>
                      <td>{t.panna || '-'}</td>
                      <td style={{ color: 'var(--success)', fontWeight: 600 }}>+{t.qty}</td>
                      <td>{t.shortagePct != null ? `${t.shortagePct}%` : '-'}</td>
                      <td>{t.notes}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {isAdmin && (
                          <button
                            className="btn-icon"
                            title="Edit"
                            style={{ color: 'var(--primary)', marginRight: '0.5rem' }}
                            onClick={() => startEditInward(t)}
                          >
                            <Edit size={15} />
                          </button>
                        )}
                        <button
                          className="btn-icon"
                          title="Delete"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => setDeleteTarget({ id: t._id, type: 'INWARD', label: `Lot #${t.lotNo} — ${t.fabricQuality} (${t.qty} mtr)` })}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {inwardTx.length === 0 && (
                    <tr><td colSpan="9" style={{ textAlign: 'center' }}>No inward transactions found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Showing {inwardTx.length} of {transactions.filter(t => t.type === 'INWARD').length} inward records
            </div>
          </div>
        )}

        {/* Outward Tab */}
        {activeTab === 'outward' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2>Outward Transactions</h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search fabric, party, job, lot..."
                    value={outwardSearch}
                    onChange={e => setOutwardSearch(e.target.value)}
                    style={{ ...inputStyle, width: '200px', paddingLeft: '1.8rem' }}
                  />
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

                <button className="btn-primary" onClick={() => { fetchData(); setIsOutwardOpen(true); }} style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}>
                  <PlusCircle size={16} /> New Outward
                </button>
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
                      Job Card No {outwardSortBy === 'jobNo' ? (outwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th 
                      onClick={() => {
                        if (outwardSortBy === 'challanNo') {
                          setOutwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setOutwardSortBy('challanNo');
                          setOutwardSortOrder('asc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Challan No {outwardSortBy === 'challanNo' ? (outwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
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
                      Party {outwardSortBy === 'partyName' ? (outwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th 
                      onClick={() => {
                        if (outwardSortBy === 'fabricQuality') {
                          setOutwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setOutwardSortBy('fabricQuality');
                          setOutwardSortOrder('asc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Fabric Quality {outwardSortBy === 'fabricQuality' ? (outwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th 
                      onClick={() => {
                        if (outwardSortBy === 'lotNo') {
                          setOutwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setOutwardSortBy('lotNo');
                          setOutwardSortOrder('desc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Lot No {outwardSortBy === 'lotNo' ? (outwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th>Panna</th>
                    <th 
                      onClick={() => {
                        if (outwardSortBy === 'qty') {
                          setOutwardSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setOutwardSortBy('qty');
                          setOutwardSortOrder('desc');
                        }
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Qty (mtr) {outwardSortBy === 'qty' ? (outwardSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th>Notes</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {outwardTx.map(t => (
                    <tr key={t._id}>
                      <td>{new Date(t.date).toLocaleDateString()}</td>
                      <td>{t.jobNo}</td>
                      <td>{t.challanNo || '-'}</td>
                      <td>{t.partyName}</td>
                      <td>{t.fabricQuality}</td>
                      <td>{t.lotNo ? `#${t.lotNo}` : '-'}</td>
                      <td>{t.panna || '-'}</td>
                      <td style={{ color: 'var(--danger)', fontWeight: 600 }}>-{t.qty}</td>
                      <td>{t.notes}</td>
                      <td>
                        <button
                          className="btn-icon"
                          title="Delete"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => setDeleteTarget({ id: t._id, type: 'OUTWARD', label: `Job ${t.jobNo} — ${t.fabricQuality} (${t.qty} mtr)` })}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {outwardTx.length === 0 && (
                    <tr><td colSpan="10" style={{ textAlign: 'center' }}>No outward transactions found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Showing {outwardTx.length} of {transactions.filter(t => t.type === 'OUTWARD').length} outward records
            </div>
          </div>
        )}

        {/* ── Requirement Tab ── */}
        {activeTab === 'requirement' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                  <AlertTriangle size={20} color="#f59e0b" /> Fabric Requirement
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                  Calculated from all <strong>In Progress</strong> job cards. Click a row to see job-wise breakdown.
                </p>
              </div>
              <button className="btn-secondary" onClick={fetchRequirement} disabled={reqLoading}>
                <RefreshCw size={15} className={reqLoading ? 'spin-loader' : ''} />
                {reqLoading ? 'Calculating...' : 'Refresh'}
              </button>
            </div>

            {/* Summary chips */}
            {requirement.length > 0 && (
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ padding: '0.5rem 1rem', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '6px', fontSize: '0.85rem' }}>
                  <CheckCircle size={13} style={{ color: 'var(--success)', marginRight: '4px', verticalAlign: 'middle' }} />
                  <strong>{requirement.filter(r => r.status === 'Sufficient').length}</strong> Sufficient
                </div>
                <div style={{ padding: '0.5rem 1rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', fontSize: '0.85rem' }}>
                  <AlertCircle size={13} style={{ color: '#f59e0b', marginRight: '4px', verticalAlign: 'middle' }} />
                  <strong>{requirement.filter(r => r.status === 'Short').length}</strong> Short
                </div>
                <div style={{ padding: '0.5rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', fontSize: '0.85rem' }}>
                  <AlertTriangle size={13} style={{ color: 'var(--danger)', marginRight: '4px', verticalAlign: 'middle' }} />
                  <strong>{requirement.filter(r => r.status === 'No Stock').length}</strong> No Stock
                </div>
                <div style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '0.85rem' }}>
                  Total Needed: <strong>{requirement.reduce((a, r) => a + r.totalMtrRequired, 0).toFixed(1)} mtr</strong>
                </div>
                <div style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '0.85rem' }}>
                  Total Shortfall: <strong style={{ color: 'var(--danger)' }}>{requirement.reduce((a, r) => a + r.shortfall, 0).toFixed(1)} mtr</strong>
                </div>
              </div>
            )}

            {reqLoading && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <RefreshCw size={24} className="spin-loader" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                Calculating requirement from job cards...
              </div>
            )}

            {!reqLoading && requirement.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <AlertTriangle size={40} style={{ opacity: 0.3, display: 'block', margin: '0 auto 1rem' }} />
                <p>No fabric requirement found.</p>
                <p style={{ fontSize: '0.85rem' }}>Add Job Cards with "In Progress" status and set the Fabric + Total Meters fields.</p>
              </div>
            )}

            {!reqLoading && requirement.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {requirement.map((req, idx) => {
                  const isExpanded = expandedFabric === `req_${idx}`;
                  const statusColor = req.status === 'Sufficient' ? 'var(--success)' : req.status === 'Short' ? '#f59e0b' : 'var(--danger)';
                  const statusBg = req.status === 'Sufficient' ? 'rgba(34,197,94,0.08)' : req.status === 'Short' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)';
                  const StatusIcon = req.status === 'Sufficient' ? CheckCircle : req.status === 'Short' ? AlertCircle : AlertTriangle;

                  return (
                    <div key={idx} style={{ background: statusBg, border: `1px solid ${statusColor}40`, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      {/* Main row */}
                      <div
                        onClick={() => setExpandedFabric(isExpanded ? null : `req_${idx}`)}
                        style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.2rem', cursor: 'pointer', gap: '1rem' }}
                      >
                        <StatusIcon size={20} style={{ color: statusColor, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{req.fabricQuality}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <span>Panna: <strong>{req.panna !== 'Unknown' ? `${req.panna}"` : '—'}</strong></span>
                            <span>{req.jobs.length} job card{req.jobs.length !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', textAlign: 'center' }}>
                          <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>REQUIRED</div>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{req.totalMtrRequired.toFixed(1)} <span style={{ fontSize: '0.7rem' }}>mtr</span></div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>IN STOCK</div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: req.currentStock > 0 ? 'var(--success)' : 'var(--danger)' }}>
                              {req.currentStock.toFixed(1)} <span style={{ fontSize: '0.7rem' }}>mtr</span>
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>SHORTFALL</div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: req.shortfall > 0 ? 'var(--danger)' : 'var(--success)' }}>
                              {req.shortfall > 0 ? `-${req.shortfall.toFixed(1)}` : '✓'} <span style={{ fontSize: '0.7rem' }}>{req.shortfall > 0 ? 'mtr' : ''}</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)' }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(100, req.totalMtrRequired > 0 ? (req.currentStock / req.totalMtrRequired) * 100 : 0)}%`,
                          background: statusColor,
                          transition: 'width 0.5s ease'
                        }} />
                      </div>

                      {/* Job breakdown (collapsible) */}
                      {isExpanded && (
                        <div style={{ borderTop: '1px solid var(--border-light)', padding: '0 1.2rem 1rem' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem', fontSize: '0.82rem' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                                <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Job No</th>
                                <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Party</th>
                                <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Date</th>
                                <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Meters</th>
                              </tr>
                            </thead>
                            <tbody>
                              {req.jobs.map((job, ji) => (
                                <tr key={ji} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                  <td style={{ padding: '0.45rem 0.5rem', fontWeight: 600, color: 'var(--primary)' }}>{job.jobNo}</td>
                                  <td style={{ padding: '0.45rem 0.5rem' }}>{job.party || '—'}</td>
                                  <td style={{ padding: '0.45rem 0.5rem', color: 'var(--text-muted)' }}>{job.date || '—'}</td>
                                  <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>{job.totalMtr > 0 ? `${job.totalMtr} mtr` : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Challan Tab ── */}
      {activeTab === 'challan' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2>Fabric Challans</h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="text" placeholder="Search party, fabric, job..." value={challanSearch} onChange={e => setChallanSearch(e.target.value)} style={{ ...inputStyle, width: '200px', paddingLeft: '1.8rem' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>From:</span>
                <input type="date" value={challanDateStart} onChange={e => setChallanDateStart(e.target.value)} style={{ ...inputStyle, width: '130px', padding: '0.3rem' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>To:</span>
                <input type="date" value={challanDateEnd} onChange={e => setChallanDateEnd(e.target.value)} style={{ ...inputStyle, width: '130px', padding: '0.3rem' }} />
              </div>
              <button className="btn-primary" onClick={() => { resetChallanForm(); setEditingChallan(null); setIsChallanOpen(true); }}>
                <PlusCircle size={16} /> New Challan
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Challan No</th>
                  <th>Date</th>
                  <th>Party</th>
                  <th>Lot No</th>
                  <th>Fabric</th>
                  <th>Job No</th>
                  <th>Panna</th>
                  <th>Total TP</th>
                  <th>Total Mtr</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {challans.length === 0 && (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No challans found. Click "New Challan" to create one.</td></tr>
                )}
                {challans.map(ch => (
                  <tr key={ch._id}>
                    <td><span style={{ fontWeight: 700, color: 'var(--primary)' }}>EDP-{ch.challanNo}</span></td>
                    <td>{new Date(ch.date).toLocaleDateString()}</td>
                    <td>{ch.partyName || '—'}</td>
                    <td>{ch.lotNo != null ? `#${ch.lotNo}` : '—'}</td>
                    <td>{ch.fabricName || '—'}</td>
                    <td style={{ color: 'var(--primary)' }}>{ch.jobNo || '—'}</td>
                    <td>{ch.panna || '—'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{ch.totalTp}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>{ch.totalMtr} mtr</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn-icon" title="Download PDF" style={{ color: 'var(--success)', marginRight: '0.5rem' }} onClick={() => handleDownloadChallanPdf(ch._id, ch.challanNo)}>
                        <FileDown size={15} />
                      </button>
                      <button className="btn-icon" title="Edit" style={{ color: 'var(--primary)', marginRight: '0.5rem' }} onClick={() => startEditChallan(ch)}>
                        <Edit size={15} />
                      </button>
                      {isAdmin && (
                        <button className="btn-icon" title="Delete" style={{ color: 'var(--danger)' }} onClick={() => setChallanDeleteTarget({ id: ch._id, label: `Challan EDP-${ch.challanNo}` })}>
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Challan Delete Confirm ── */}
      {challanDeleteTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '380px', padding: '2rem', textAlign: 'center' }}>
            <AlertTriangle size={36} style={{ color: 'var(--danger)', marginBottom: '1rem' }} />
            <p style={{ marginBottom: '1.5rem' }}>Delete <strong>{challanDeleteTarget.label}</strong>?</p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setChallanDeleteTarget(null)}>Cancel</button>
              <button className="btn-danger" style={{ flex: 1 }} onClick={handleChallanDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Challan Form Modal ── */}
      {isChallanOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '640px', padding: '2rem', maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingChallan ? `Edit Challan EDP-${editingChallan.challanNo}` : 'New Fabric Challan'}</h2>
            <form onSubmit={handleChallanSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Row 1: Date + Party */}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Date</label>
                  <input type="date" required value={challanForm.date} onChange={e => setChallanForm({ ...challanForm, date: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Party Name</label>
                  <input type="text" list="challan-parties" value={challanForm.partyName} onChange={e => setChallanForm({ ...challanForm, partyName: e.target.value })} style={inputStyle} placeholder="Select or type..." />
                  <datalist id="challan-parties">
                    {partiesList.map((p, i) => <option key={i} value={typeof p === 'string' ? p : p.name} />)}
                  </datalist>
                </div>
              </div>

              {/* Divider: Job Details */}
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Job Details</span>
              </div>

              {/* Row 2: Job No */}
              <div>
                <label style={labelStyle}>Job No <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>(auto-fills design, colour, panna, fabric)</span></label>
                <input type="text" list="challan-jobs" value={challanForm.jobNo} onChange={e => handleChallanJobChange(e.target.value)} style={inputStyle} placeholder="Select or type job no…" />
                <datalist id="challan-jobs">
                  {inProgressJobCards.map(j => <option key={j._id} value={j.jobNo}>{j.jobNo} — {j.party}</option>)}
                </datalist>
              </div>

              {/* Row 3: Design + Colour + Panna */}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Design No <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>(auto-filled)</span></label>
                  <input type="text" value={challanForm.designNo} onChange={e => setChallanForm({ ...challanForm, designNo: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Colour <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>(auto-filled)</span></label>
                  <input type="text" value={challanForm.colour} onChange={e => setChallanForm({ ...challanForm, colour: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Panna</label>
                  <input type="text" list="challan-widths" value={challanForm.panna} onChange={e => setChallanForm({ ...challanForm, panna: e.target.value })} style={inputStyle} placeholder="Auto-filled" />
                  <datalist id="challan-widths">
                    {widthsList.map((w, i) => <option key={i} value={w} />)}
                  </datalist>
                </div>
              </div>

              {/* Divider: Lot Details */}
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lot Details</span>
              </div>

              {/* Row 4: Lot No + Vendor Challan No */}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Lot No {challanLotLoading && <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Loading…</span>}</label>
                  <input
                    type="text"
                    value={challanForm.lotNo}
                    onChange={e => handleChallanLotChange(e.target.value)}
                    style={inputStyle}
                    placeholder="e.g. 320, 321"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Vendor Challan No <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>(auto-filled)</span></label>
                  <input type="text" value={challanForm.vendorChallanNo} onChange={e => setChallanForm({ ...challanForm, vendorChallanNo: e.target.value })} style={inputStyle} placeholder="Auto-filled from lot…" />
                </div>
              </div>

              {/* Row 5: Fabric Name + Shortage */}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 2 }}>
                  <label style={labelStyle}>Fabric Name <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>(auto-filled)</span></label>
                  <input type="text" list="challan-fabrics" value={challanForm.fabricName} onChange={e => setChallanForm({ ...challanForm, fabricName: e.target.value })} style={inputStyle} placeholder="Auto-filled from lot…" />
                  <datalist id="challan-fabrics">
                    {fabricsList.map((f, i) => <option key={i} value={f} />)}
                  </datalist>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Shortage %</label>
                  <input type="number" step="0.01" min="0" max="100" value={challanForm.shortagePct} onChange={e => setChallanForm({ ...challanForm, shortagePct: e.target.value })} style={inputStyle} placeholder="e.g. 3.5" />
                </div>
              </div>

              {/* Smart Lot Selection & Stock Tracker */}
              {challanForm.jobNo && (
                <div style={{
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  marginTop: '0.25rem'
                }}>
                  {/* Job Requirement Info */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Job Requirement: <strong>{jobMtrNeeded > 0 ? `${jobMtrNeeded} mtr` : 'Not specified'}</strong>
                    </span>
                    {jobMtrNeeded > 0 && (
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        background: selectedLotsTotalStock >= jobMtrNeeded ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: selectedLotsTotalStock >= jobMtrNeeded ? '#10b981' : '#f87171'
                      }}>
                        {selectedLotsTotalStock >= jobMtrNeeded ? '✓ Stock Sufficient' : '⚠️ Need More Stock'}
                      </span>
                    )}
                  </div>

                  {/* Stock Progress Bar */}
                  {jobMtrNeeded > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(100, (selectedLotsTotalStock / jobMtrNeeded) * 100)}%`,
                          background: selectedLotsTotalStock >= jobMtrNeeded ? 'var(--success)' : 'var(--primary)',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <span>Selected Lot Stock: {selectedLotsTotalStock.toFixed(2)} mtr</span>
                        <span>{((selectedLotsTotalStock / jobMtrNeeded) * 100).toFixed(0)}% of required</span>
                      </div>
                    </div>
                  )}

                  {/* Available Lot Buttons Grid */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.6rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      Available Inward Lots for "{challanForm.fabricName}":
                    </div>
                    {availableLots.length === 0 ? (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No inward stock found with this fabric.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {availableLots.map((lot, idx) => {
                          const isSelected = selectedLotsList.includes(String(lot.lotNo));
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                let newLots;
                                if (isSelected) {
                                  // Remove the lot
                                  newLots = selectedLotsList.filter(l => l !== String(lot.lotNo)).join(', ');
                                } else {
                                  // Add the lot
                                  newLots = [...selectedLotsList, String(lot.lotNo)].join(', ');
                                }
                                handleChallanLotChange(newLots);
                              }}
                              className={isSelected ? "btn-primary" : "btn-secondary"}
                              style={{
                                padding: '0.3rem 0.6rem',
                                fontSize: '0.74rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                borderRadius: '4px',
                                border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                                background: isSelected ? 'rgba(14, 165, 233, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                                transition: 'all 0.2s'
                              }}
                              title={isSelected ? "Click to deselect lot" : "Click to select lot"}
                            >
                              {isSelected ? <Check size={12} /> : <Plus size={12} />}
                              <span>Lot #{lot.lotNo}</span>
                              <span style={{ opacity: 0.6, fontSize: '0.68rem' }}>({lot.panna} Panna)</span>
                              <span style={{ color: isSelected ? 'inherit' : 'var(--success)', fontWeight: 700 }}>
                                {lot.currentStock}m
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    * Click the lot buttons above to toggle selections and verify stock sufficiency.
                  </div>
                </div>
              )}

              {/* Divider: TP Details */}
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TP Details</span>
                <button type="button" className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.78rem' }} onClick={addTpRow} disabled={challanForm.tpDetails.length >= 30}>
                  <PlusCircle size={13} /> Add TP Row
                </button>
              </div>

              {/* TP Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 32px', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, paddingLeft: '0.25rem' }}>
                  <span>TP No.</span><span>TP Meter (mtr)</span><span></span>
                </div>
                {challanForm.tpDetails.map((row, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 32px', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ ...inputStyle, textAlign: 'center', fontWeight: 700, color: 'var(--primary)', cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {row.tpNo}
                    </div>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={row.tpMeter}
                      onChange={e => updateTpRow(idx, 'tpMeter', e.target.value)}
                      style={inputStyle}
                      placeholder="0.000"
                    />
                    <button type="button" onClick={() => removeTpRow(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '0.2rem', display: 'flex', alignItems: 'center' }}>
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Totals summary */}
              <div style={{ display: 'flex', gap: '1rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total TP Machines</span>
                  <div style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--primary)' }}>{challanTotalTp}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Meters</span>
                  <div style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--success)' }}>{challanTotalMtr.toFixed(3)} mtr</div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={labelStyle}>Notes</label>
                <input type="text" value={challanForm.notes} onChange={e => setChallanForm({ ...challanForm, notes: e.target.value })} style={inputStyle} placeholder="Optional notes…" />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => { setIsChallanOpen(false); setEditingChallan(null); resetChallanForm(); }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>{editingChallan ? 'Save Changes' : 'Save Challan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Inward Modal ── */}
      {isInwardOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '500px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingTransaction ? 'Edit Fabric Inward' : 'Add Fabric Inward'}</h2>
            <form onSubmit={handleInwardSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Date</label>
                  <input type="date" required value={inwardForm.date} onChange={e => setInwardForm({ ...inwardForm, date: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Lot No</label>
                  <input type="text" disabled value={editingTransaction ? `#${editingTransaction.lotNo}` : "Auto Generated"} style={{ ...inputStyle, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Challan No</label>
                  <input type="text" value={inwardForm.challanNo} onChange={e => setInwardForm({ ...inwardForm, challanNo: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Vendor Name</label>
                  <input type="text" list="inward-vendors" value={inwardForm.vendorName} onChange={e => setInwardForm({ ...inwardForm, vendorName: e.target.value })} style={inputStyle} placeholder="Select or type vendor..." />
                  <datalist id="inward-vendors">
                    {vendorsList.map(v => <option key={v._id} value={v.name} />)}
                  </datalist>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Fabric Quality *</label>
                <input type="text" required list="inward-fabrics" value={inwardForm.fabricQuality} onChange={e => setInwardForm({ ...inwardForm, fabricQuality: e.target.value })} style={inputStyle} placeholder="Select or type fabric..." />
                <datalist id="inward-fabrics">
                  {fabricsList.map(f => <option key={f} value={f} />)}
                </datalist>
              </div>

              <div>
                <label style={labelStyle}>Fabric Panna (Width)</label>
                <input type="text" list="inward-widths" value={inwardForm.panna} onChange={e => setInwardForm({ ...inwardForm, panna: e.target.value })} style={inputStyle} placeholder="Select or type panna..." />
                <datalist id="inward-widths">
                  {widthsList.map(w => <option key={w} value={w} />)}
                </datalist>
              </div>

              <div>
                <label style={labelStyle}>Quantity (mtr) *</label>
                <input type="number" step="0.01" required min="0.1" value={inwardForm.qty} onChange={e => setInwardForm({ ...inwardForm, qty: e.target.value })} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Shortage % (Fusing Loss)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={inwardForm.shortagePct}
                  onChange={e => setInwardForm({ ...inwardForm, shortagePct: e.target.value })}
                  style={inputStyle}
                  placeholder="e.g. 3.5 (optional)"
                />
              </div>

              <div>
                <label style={labelStyle}>Notes</label>
                <input type="text" value={inwardForm.notes} onChange={e => setInwardForm({ ...inwardForm, notes: e.target.value })} style={inputStyle} placeholder="Optional notes..." />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={closeInwardModal}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>{editingTransaction ? 'Save Changes' : 'Save Inward'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Outward Modal ── */}
      {isOutwardOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '500px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Add Fabric Outward</h2>
            <form onSubmit={handleOutwardSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Date</label>
                  <input type="date" required value={outwardForm.date} onChange={e => setOutwardForm({ ...outwardForm, date: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Job Card No *</label>
                  <input type="text" required list="outward-jobs" value={outwardForm.jobNo} onChange={handleJobNoChange} style={inputStyle} placeholder="Select or type Job No..." />
                  <datalist id="outward-jobs">
                    {inProgressJobCards.map(j => <option key={j._id} value={j.jobNo} />)}
                  </datalist>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Challan No</label>
                <input type="text" value={outwardForm.challanNo} onChange={e => setOutwardForm({ ...outwardForm, challanNo: e.target.value })} style={inputStyle} placeholder="Outward challan number..." />
              </div>

              <div>
                <label style={labelStyle}>Party Name</label>
                <input type="text" list="outward-parties" value={outwardForm.partyName} onChange={e => setOutwardForm({ ...outwardForm, partyName: e.target.value })} style={inputStyle} placeholder="Auto-filled from job card..." />
                <datalist id="outward-parties">
                  {partiesList.map((p, idx) => <option key={idx} value={p} />)}
                </datalist>
              </div>

              <div>
                <label style={labelStyle}>Fabric Quality *</label>
                <input type="text" required list="outward-fabrics" value={outwardForm.fabricQuality} onChange={e => setOutwardForm({ ...outwardForm, fabricQuality: e.target.value })} style={inputStyle} placeholder="Auto-filled from job card..." />
                <datalist id="outward-fabrics">
                  {fabricsList.map(f => <option key={f} value={f} />)}
                </datalist>
              </div>

              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Lot No *</span>
                  <button
                    type="button"
                    onClick={fetchAllLots}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0 }}
                  >
                    <RefreshCw size={11} className={lotLoading ? 'spin-loader' : ''} /> {lotLoading ? 'Loading...' : 'Reload'}
                  </button>
                </label>
                <select
                  required
                  value={outwardForm.lotNo}
                  onChange={handleLotNoChange}
                  style={inputStyle}
                  disabled={lotLoading}
                >
                  <option value="">
                    {lotLoading ? 'Loading lots...' : '-- Select Active Lot --'}
                  </option>
                  {(() => {
                    // Client-side filter by fabricQuality (case-insensitive match)
                    const filtered = outwardForm.fabricQuality
                      ? lotList.filter(l => l.fabricQuality.toLowerCase().trim() === outwardForm.fabricQuality.toLowerCase().trim())
                      : lotList;
                    return filtered.map(lot => (
                      <option key={lot.lotNo} value={lot.lotNo}>
                        Lot #{lot.lotNo} — {lot.fabricQuality} | Stock: {lot.currentStock} mtr{lot.panna ? ` | Panna: ${lot.panna}` : ''}
                      </option>
                    ));
                  })()}
                </select>
                {/* Status messages */}
                {!lotLoading && lotList.length === 0 && (
                  <span style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.3rem', display: 'block' }}>
                    ⚠️ No lots with available stock found. Please add Inward first.
                  </span>
                )}
                {!lotLoading && lotList.length > 0 && outwardForm.fabricQuality &&
                  lotList.filter(l => l.fabricQuality.toLowerCase().trim() === outwardForm.fabricQuality.toLowerCase().trim()).length === 0 && (
                  <span style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.3rem', display: 'block' }}>
                    ⚠️ No lots found for "{outwardForm.fabricQuality}". Check fabric name spelling or add Inward first.
                  </span>
                )}
                {outwardForm.lotNo && lotList.find(l => String(l.lotNo) === String(outwardForm.lotNo)) && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '0.25rem', display: 'block' }}>
                    ✓ Available stock: {lotList.find(l => String(l.lotNo) === String(outwardForm.lotNo)).currentStock} mtr
                  </span>
                )}
              </div>


              <div>
                <label style={labelStyle}>Fabric Panna (Width)</label>
                <input type="text" list="outward-widths" value={outwardForm.panna} onChange={e => setOutwardForm({ ...outwardForm, panna: e.target.value })} style={inputStyle} placeholder="Auto-filled from lot..." />
                <datalist id="outward-widths">
                  {widthsList.map(w => <option key={w} value={w} />)}
                </datalist>
              </div>

              <div>
                <label style={labelStyle}>Quantity (mtr) *</label>
                <input type="number" step="0.01" required min="0.1" value={outwardForm.qty} onChange={e => setOutwardForm({ ...outwardForm, qty: e.target.value })} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Notes</label>
                <input type="text" value={outwardForm.notes} onChange={e => setOutwardForm({ ...outwardForm, notes: e.target.value })} style={inputStyle} placeholder="Optional notes..." />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsOutwardOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, background: 'var(--danger)', borderColor: 'var(--danger)' }}>Save Outward</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '400px', padding: '2rem', textAlign: 'center' }}>
            <Trash2 size={36} style={{ color: 'var(--danger)', margin: '0 auto 1rem' }} />
            <h3 style={{ marginBottom: '0.5rem' }}>Delete Transaction?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              This will permanently delete:<br />
              <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget.label}</strong>
            </p>
            <p style={{ color: '#f59e0b', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
              ⚠️ Stock levels will be recalculated after deletion.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setDeleteTarget(null)}>
                <X size={15} /> Cancel
              </button>
              <button className="btn-primary" style={{ flex: 1, background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={handleDelete}>
                <Trash2 size={15} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PDF Report Filter Modal ── */}
      {isPdfFilterOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '440px', padding: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileDown size={20} /> Download Fabric Ledger PDF
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Date From</label>
                  <input type="date" value={pdfFilter.dateStart} onChange={e => setPdfFilter({ ...pdfFilter, dateStart: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Date To</label>
                  <input type="date" value={pdfFilter.dateEnd} onChange={e => setPdfFilter({ ...pdfFilter, dateEnd: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Fabric Quality (optional — leave blank for all)</label>
                <input type="text" list="pdf-fabrics" value={pdfFilter.fabricQuality} onChange={e => setPdfFilter({ ...pdfFilter, fabricQuality: e.target.value })} style={inputStyle} placeholder="All fabrics..." />
                <datalist id="pdf-fabrics">
                  {fabricsList.map(f => <option key={f} value={f} />)}
                </datalist>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Leave date fields blank to include all transactions.</p>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsPdfFilterOpen(false)}>Cancel</button>
                <button className="btn-primary" style={{ flex: 1 }} onClick={handleDownloadPdf} disabled={pdfLoading}>
                  {pdfLoading ? <RefreshCw size={15} className="spin-loader" /> : <FileDown size={15} />}
                  {pdfLoading ? 'Generating...' : 'Download PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Catalog Manager Modal */}
      {isManagerOpen && (
        <CatalogManagerModal
          initialTab="vendors"
          context="elite_print"
          onClose={() => {
            setIsManagerOpen(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
