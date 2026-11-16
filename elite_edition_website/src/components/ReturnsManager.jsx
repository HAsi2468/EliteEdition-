import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../services/api';
import { 
  PackageMinus, 
  RotateCcw, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Zap,
  ListTodo,
  History,
  Download,
  Filter
} from 'lucide-react';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../utils/dateUtils';
import { getDatePresetRange } from './DateRangePicker';
import ErpUnifiedFilterBar from './common/ErpUnifiedFilterBar';
import EntityBrandBadge from './common/EntityBrandBadge';
import QuickActionMenu from './common/QuickActionMenu';

export default function ReturnsManager() {
  const [activeTab, setActiveTab] = useState('process');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [party, setParty] = useState('Myntra');
  const [returnType, setReturnType] = useState('RTO');
  const [referenceId, setReferenceId] = useState('');
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState('INTACT');
  const [notes, setNotes] = useState('');

  // Rapid Fire State
  const inputRef = useRef(null);

  // Data state
  const [refinishQueue, setRefinishQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState([]);

  // Unified Filter States for History
  const [historySearch, setHistorySearch] = useState('');
  const [historyDatePreset, setHistoryDatePreset] = useState('all');
  const [historyDateStart, setHistoryDateStart] = useState('');
  const [historyDateEnd, setHistoryDateEnd] = useState('');
  const [historyCustomStart, setHistoryCustomStart] = useState('');
  const [historyCustomEnd, setHistoryCustomEnd] = useState('');
  const [historyFilters, setHistoryFilters] = useState({});

  const returnsFilterCategories = useMemo(() => [
    {
      id: 'returnType',
      label: 'Return Type',
      multi: true,
      options: [
        { value: 'RTO', label: 'RTO' },
        { value: 'CUSTOMER_RETURN', label: 'Customer Return' }
      ]
    },
    {
      id: 'condition',
      label: 'Condition',
      multi: true,
      options: [
        { value: 'INTACT', label: 'Intact' },
        { value: 'DAMAGED', label: 'Damaged' },
        { value: 'DEFECTIVE', label: 'Defective' }
      ]
    },
    {
      id: 'status',
      label: 'Status',
      multi: true,
      options: [
        { value: 'STOCKED_IN', label: 'Stocked In' },
        { value: 'DISPUTED', label: 'Disputed' },
        { value: 'PENDING_REFINISH', label: 'Pending Refinish' }
      ]
    }
  ], []);

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const matchRef = (item.referenceId || '').toLowerCase().includes(q);
        const matchOrder = (item.displayOrderId || '').toLowerCase().includes(q);
        const matchSku = (item.sku || '').toLowerCase().includes(q);
        const matchNotes = (item.notes || '').toLowerCase().includes(q);
        if (!matchRef && !matchOrder && !matchSku && !matchNotes) return false;
      }

      if (historyDatePreset && historyDatePreset !== 'all') {
        const range = getDatePresetRange(historyDatePreset, historyCustomStart, historyCustomEnd);
        if (range && range.start && range.end) {
          const itemDate = new Date(item.createdAt);
          if (itemDate < range.start || itemDate > range.end) return false;
        }
      } else if (historyDateStart || historyDateEnd) {
        const itemDate = new Date(item.createdAt);
        if (historyDateStart && itemDate < new Date(`${historyDateStart}T00:00:00`)) return false;
        if (historyDateEnd && itemDate > new Date(`${historyDateEnd}T23:59:59`)) return false;
      }

      if (historyFilters.returnType?.length > 0) {
        if (!historyFilters.returnType.includes(item.returnType)) return false;
      }
      if (historyFilters.condition?.length > 0) {
        if (!historyFilters.condition.includes(item.condition)) return false;
      }
      if (historyFilters.status?.length > 0) {
        if (!historyFilters.status.includes(item.status)) return false;
      }

      return true;
    });
  }, [history, historySearch, historyDatePreset, historyCustomStart, historyCustomEnd, historyDateStart, historyDateEnd, historyFilters]);

  const toggleSelectHistory = (id) => {
    setSelectedHistoryIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllHistory = () => {
    if (selectedHistoryIds.length === history.length) {
      setSelectedHistoryIds([]);
    } else {
      setSelectedHistoryIds(history.map(item => item._id));
    }
  };

  const handleExportSelectedHistory = () => {
    const selected = history.filter(item => selectedHistoryIds.includes(item._id));
    if (selected.length === 0) return;
    const headers = ['Date', 'AWB/Reference', 'Display Order ID', 'SKU', 'Type', 'Condition', 'Status', 'Notes'];
    const rows = selected.map(item => [
      formatDateTimeDDMMYYYY(item.createdAt),
      item.referenceId,
      item.displayOrderId || '',
      item.sku,
      item.returnType,
      item.condition,
      item.status,
      (item.notes || '').replace(/,/g, ' ')
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Returns_History_${selected.length}_items.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const fetchData = () => {
      if (activeTab === 'refinish') fetchRefinishQueue();
      if (activeTab === 'history') fetchHistory();
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const fetchRefinishQueue = async () => {
    try {
      setLoading(true);
      const data = await api.getReturns('PENDING_REFINISH');
      setRefinishQueue(data);
    } catch (err) {
      setError('Failed to fetch refinishing queue');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await api.getReturns();
      setHistory(data);
    } catch (err) {
      setError('Failed to fetch returns history');
    } finally {
      setLoading(false);
    }
  };

  // Add inventory list
  const [inventorySkus, setInventorySkus] = useState([]);
  const [partiesList, setPartiesList] = useState([]);
  const [vendorsList, setVendorsList] = useState([]);
  const [stack, setStack] = useState([]);

  // Bulk Multi-Inward Paste State
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState('');

  const [displayOrderId, setDisplayOrderId] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupStatus, setLookupStatus] = useState('');

  // Auto-fetch party based on selected SKU
  useEffect(() => {
    if (sku) {
      api.getPartyBySku(sku)
        .then(data => {
          if (data && data.party) {
            handlePartySelect(data.party);
          }
        })
        .catch(err => console.error('Failed to fetch party for SKU', err));
    }
  }, [sku]);

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const data = await api.getInventory('');
        setInventorySkus(data.map(item => item.skuCode).filter(Boolean));
      } catch (err) {
        console.error('Failed to fetch SKUs', err);
      }
    };
    const fetchPartiesAndVendors = async () => {
      try {
        const [partiesData, vendorsData] = await Promise.all([
          api.getParties().catch(() => []),
          api.getVendors().catch(() => [])
        ]);
        setPartiesList(partiesData || []);
        setVendorsList(vendorsData || []);
        if (partiesData && partiesData.length > 0) {
          handlePartySelect(partiesData[0].name);
        }
      } catch (err) {
        console.error('Failed to fetch parties/vendors', err);
      }
    };
    fetchInventory();
    fetchPartiesAndVendors();
  }, []);

  const handlePartySelect = (selectedVal) => {
    if (!selectedVal || !selectedVal.trim()) {
      setParty('');
      return;
    }
    const matchedVendor = vendorsList.find(v => 
      (v.name && v.name.trim().toLowerCase() === selectedVal.trim().toLowerCase()) ||
      (v.businessName && v.businessName.trim().toLowerCase() === selectedVal.trim().toLowerCase())
    );
    const finalPartyName = matchedVendor && matchedVendor.businessName ? matchedVendor.businessName : selectedVal;
    setParty(finalPartyName);
  };

  const handleBulkPasteToStack = () => {
    if (!bulkPasteText.trim()) {
      setError('Please enter data to paste into stack.');
      return;
    }
    const lines = bulkPasteText.split(/\r?\n/);
    const newItems = [];
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const parts = trimmed.includes('\t') ? trimmed.split('\t') : trimmed.split(',');
      const refCode = parts[0] ? parts[0].trim() : '';
      const skuCode = parts[1] ? parts[1].trim() : '';
      const qtyNum = parts[2] ? parseInt(parts[2].trim(), 10) : 1;

      if (refCode || skuCode) {
        newItems.push({
          sku: skuCode || sku || 'GENERAL-SKU',
          displayOrderId: refCode,
          referenceId: refCode,
          quantity: isNaN(qtyNum) || qtyNum <= 0 ? 1 : qtyNum,
          condition: returnType === 'RTO' ? 'INTACT' : condition,
          notes
        });
      }
    });

    if (newItems.length > 0) {
      setStack(prev => [...prev, ...newItems]);
      setSuccess(`Added ${newItems.length} items to batch stack!`);
      setBulkPasteText('');
      setShowBulkPasteModal(false);
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError('Could not parse any valid lines.');
    }
  };

  const handleReferenceChange = (e) => {
    const val = e.target.value;
    setReferenceId(val);
    if (!val || val.trim().length < 3) {
      setLookupStatus('');
    }
  };

  const performUniwareLookup = async (codeToLookup) => {
    const targetCode = (codeToLookup || referenceId).trim();
    if (!targetCode) return;
    setLookupLoading(true);
    setLookupStatus('');
    try {
      const res = await api.lookupUniwareOrder({ code: targetCode, party });
      if (res && res.data && res.data.matched) {
        if (res.data.displayOrderId) {
          setDisplayOrderId(res.data.displayOrderId);
        }
        if (res.data.sku) {
          setSku(res.data.sku);
        }
        setLookupStatus(`Uniware Matched: Order ${res.data.displayOrderId || targetCode}${res.data.sku ? ` | SKU: ${res.data.sku}` : ''}`);
      } else {
        setLookupStatus(`No Uniware match found for "${targetCode}"`);
      }
    } catch (err) {
      console.warn('Uniware lookup error:', err.message);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleAddToStack = (e) => {
    e.preventDefault();
    if (!sku) {
      setError('Product SKU is required.');
      return;
    }
    
    const finalCondition = returnType === 'RTO' ? 'INTACT' : condition;
    if (returnType === 'CUSTOMER_RETURN' && (finalCondition === 'WRONG_ITEM' || finalCondition === 'DAMAGED') && !notes) {
      setError('Notes are required for Damaged or Wrong Item returns.');
      return;
    }

    setStack([...stack, { 
      sku, 
      displayOrderId: displayOrderId || referenceId,
      referenceId,
      quantity: parseInt(quantity, 10), 
      condition: finalCondition, 
      notes 
    }]);
    setSku('');
    setQuantity(1);
    setNotes('');
    setError('');
  };

  const handleRemoveFromStack = (index) => {
    setStack(stack.filter((_, i) => i !== index));
  };

  const handleProcessBatch = async () => {
    if (stack.length === 0) return;
    setError('');
    setSuccess('');

    try {
      setLoading(true);
      let count = 0;
      for (const item of stack) {
        await api.processReturn({
          party,
          returnType,
          referenceId: item.referenceId || referenceId,
          displayOrderId: item.displayOrderId || displayOrderId || referenceId,
          sku: item.sku,
          quantity: item.quantity,
          condition: item.condition,
          notes: returnType === 'RTO' ? '' : item.notes
        });
        count++;
      }

      setSuccess(`Successfully processed ${count} items for ${party}`);
      setStack([]);
      setReferenceId('');
      setDisplayOrderId('');
      setSku('');
      setQuantity(1);
      setNotes('');
      setLookupStatus('');
      if (inputRef.current) {
        inputRef.current.focus();
      }

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to process some items');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRefinished = async (id) => {
    try {
      setLoading(true);
      await api.markRefinished(id);
      setSuccess('Item successfully repacked and stocked in!');
      setTimeout(() => setSuccess(''), 2000);
      fetchRefinishQueue();
    } catch (err) {
      setError('Failed to stock in item');
    } finally {
      setLoading(false);
    }
  };

  const renderProcessForm = () => (
    <div className="glass-panel" style={{ padding: '2rem', maxWidth: '850px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(225, 29, 72, 0.1)', borderRadius: 'var(--radius-md)' }}>
            <Zap size={28} color="#e11d48" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)' }}>Rapid Returns & Inward Processing</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Select party/vendor, scan AWB/barcode to auto-fetch Display Order ID & SKU from Uniware.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowBulkPasteModal(true)}
          style={{ padding: '0.6rem 1.1rem', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa', borderRadius: 'var(--radius-sm)', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
        >
          📋 Paste Multi-Inward
        </button>
      </div>

      {showBulkPasteModal && (
        <div style={{ marginBottom: '1.5rem', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid var(--primary)', padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
          <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: 'bold' }}>⚡ Paste Multiple Inward Items at Once</h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Paste multi-line text (e.g. <code>AWB/OrderCode, SKU, Qty</code> or 1 AWB per line):
          </p>
          <textarea
            value={bulkPasteText}
            onChange={e => setBulkPasteText(e.target.value)}
            rows={5}
            placeholder="AWB12345, SKU-BLUE-M, 2&#10;AWB67890, SKU-RED-L, 1"
            style={{ width: '100%', fontFamily: 'monospace', padding: '0.75rem', fontSize: '0.85rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-light)', borderRadius: '4px', color: '#fff' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setShowBulkPasteModal(false)} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Cancel</button>
            <button type="button" onClick={handleBulkPasteToStack} className="btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', fontWeight: 'bold' }}>+ Batch Add to Stack</button>
          </div>
        </div>
      )}

      <form onSubmit={handleAddToStack} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Core Selectors */}
        <div style={{ display: 'flex', gap: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label style={styles.label}>Party / Vendor</label>
            <input
              list="party-vendor-list"
              style={styles.input}
              value={party}
              onChange={e => handlePartySelect(e.target.value)}
              placeholder="Select or type Party/Vendor..."
            />
            <datalist id="party-vendor-list">
              <option value="Myntra">Myntra</option>
              <option value="Flipkart">Flipkart</option>
              <option value="Amazon">Amazon</option>
              <option value="Wholesale">Offline Wholesale</option>
              {partiesList.map(p => (
                <option key={p.id || p._id} value={p.name}>{p.name}</option>
              ))}
              {vendorsList.map(v => (
                <option key={v.id || v._id} value={v.businessName || v.name}>
                  {v.businessName ? `${v.businessName} (Contact: ${v.name})` : v.name}
                </option>
              ))}
            </datalist>
          </div>
          
          <div className="form-group" style={{ flex: 1 }}>
            <label style={styles.label}>Return Type</label>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="returnType" 
                  checked={returnType === 'RTO'} 
                  onChange={() => { setReturnType('RTO'); setCondition('INTACT'); }} 
                />
                RTO (Undelivered)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="returnType" 
                  checked={returnType === 'CUSTOMER_RETURN'} 
                  onChange={() => setReturnType('CUSTOMER_RETURN')} 
                />
                Customer Return
              </label>
            </div>
          </div>
        </div>

        {/* Customer Return Specific Options */}
        {returnType === 'CUSTOMER_RETURN' && (
          <div style={{ padding: '1rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
            <label style={styles.label}>Item Condition</label>
            <select style={styles.input} value={condition} onChange={e => setCondition(e.target.value)}>
              <option value="INTACT">Intact (Direct to Stock)</option>
              <option value="NEEDS_REFINISHING">Good - Needs Ironing/Repacking (Refinish Queue)</option>
              <option value="WRONG_ITEM">Wrong Item / Fraud (Disputed - Do Not Stock)</option>
              <option value="DAMAGED">Damaged / Dirty (Disputed - Do Not Stock)</option>
            </select>

            {(condition === 'WRONG_ITEM' || condition === 'DAMAGED') && (
              <div style={{ marginTop: '1rem' }}>
                <label style={styles.label}>Notes (Required for claims)</label>
                <textarea 
                  style={{ ...styles.input, minHeight: '80px' }} 
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Describe the fraud or damage..."
                  required
                />
              </div>
            )}
          </div>
        )}

        {/* Scanning & Order Information Area */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 2, minWidth: '200px' }}>
            <label style={styles.label}>AWB / Tracking Barcode</label>
            <div style={{ position: 'relative' }}>
              <input 
                ref={inputRef}
                style={styles.input} 
                value={referenceId} 
                onChange={handleReferenceChange} 
                onBlur={() => performUniwareLookup(referenceId)}
                placeholder="Scan AWB or enter tracking ID..." 
                required 
              />
              {lookupLoading && (
                <RefreshCw size={14} className="spin-loader" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }} />
              )}
            </div>
          </div>

          <div className="form-group" style={{ flex: 2, minWidth: '200px' }}>
            <label style={styles.label}>Display Order ID (Uniware)</label>
            <input 
              style={{ ...styles.input, fontWeight: 700, color: 'var(--primary)' }} 
              value={displayOrderId} 
              onChange={e => setDisplayOrderId(e.target.value)} 
              placeholder="Display Order ID..." 
            />
          </div>

          <div className="form-group" style={{ flex: 2, minWidth: '180px' }}>
            <label style={styles.label}>Product SKU</label>
            <input 
              list="inventory-skus"
              style={styles.input} 
              value={sku} 
              onChange={e => setSku(e.target.value)} 
              placeholder="Type or select SKU..." 
              required 
            />
            <datalist id="inventory-skus">
              {inventorySkus.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          <div className="form-group" style={{ flex: 1, minWidth: '80px' }}>
            <label style={styles.label}>Qty</label>
            <input 
              type="number" 
              style={styles.input} 
              value={quantity} 
              onChange={e => setQuantity(e.target.value)} 
              min="1" 
              required 
            />
          </div>
        </div>

        {lookupStatus && (
          <div style={{ fontSize: '0.8rem', background: 'rgba(59,130,246,0.1)', color: '#60a5fa', padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.2)' }}>
            ✓ {lookupStatus}
          </div>
        )}

        <button 
          type="submit" 
          className="btn-secondary" 
          disabled={loading}
          style={{ width: '100%', padding: '1rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px dashed rgba(255,255,255,0.2)', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 'bold' }}
        >
          + Add Item to Stack
        </button>

      </form>

      {/* Render Stack Area */}
      {stack.length > 0 && (
        <div style={{ marginTop: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
          <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Batch Items to Process ({stack.length})</h4>
          <table style={{ width: '100%', marginBottom: '1rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '0.5rem' }}>AWB / Ref</th>
                <th style={{ padding: '0.5rem' }}>Display Order ID</th>
                <th style={{ padding: '0.5rem' }}>SKU</th>
                <th style={{ padding: '0.5rem' }}>Qty</th>
                <th style={{ padding: '0.5rem' }}>Condition</th>
                <th style={{ padding: '0.5rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {stack.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{item.referenceId}</td>
                  <td style={{ padding: '0.5rem', color: 'var(--primary)', fontWeight: 'bold' }}>{item.displayOrderId || '-'}</td>
                  <td style={{ padding: '0.5rem' }}>{item.sku}</td>
                  <td style={{ padding: '0.5rem' }}>{item.quantity}</td>
                  <td style={{ padding: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.condition}</span>
                    {item.notes && <div style={{ fontSize: '0.75rem', color: '#fca5a5' }}>Note: {item.notes}</div>}
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <button onClick={() => handleRemoveFromStack(idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button 
            onClick={handleProcessBatch}
            className="btn-primary" 
            disabled={loading}
            style={{ width: '100%', padding: '1rem', background: '#e11d48', border: 'none', color: '#fff', fontSize: '1rem', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
          >
            {loading ? <RefreshCw className="spin-loader" /> : <PackageMinus />}
            <span>Process Entire Stack ({stack.length} items)</span>
          </button>
        </div>
      )}
    </div>
  );

  const renderRefinishing = () => (
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)' }}>Refinishing Queue</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Items returned by customers that need repacking/ironing before being added to live stock.</p>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference (AWB)</th>
              <th>Display Order ID</th>
              <th>SKU</th>
              <th>Qty</th>
              <th>Party</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {refinishQueue.length === 0 ? (
              <tr><td colSpan="7" className="text-center" style={{ padding: '2rem', color: 'var(--text-muted)' }}>No items in the refinishing queue!</td></tr>
            ) : (
              refinishQueue.map(item => (
                <tr key={item._id}>
                  <td>{formatDateDDMMYYYY(item.createdAt)}</td>
                  <td style={{ fontWeight: 'bold' }}>{item.referenceId}</td>
                  <td style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{item.displayOrderId || '-'}</td>
                  <td>{item.sku}</td>
                  <td>{item.quantity}</td>
                  <td>{item.party}</td>
                  <td className="text-center">
                    <button 
                      className="btn-primary" 
                      onClick={() => handleMarkRefinished(item._id)}
                      style={{ padding: '0.4rem 1rem', background: '#10b981', border: 'none', color: 'var(--text-primary)' }}
                    >
                      <CheckCircle2 size={14} style={{ marginRight: '0.3rem' }} /> Repacked & Stock In
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)' }}>Returns History & Claims</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Master ledger of all returns. Use this to file SPF claims for Disputed items.</p>
        </div>
        {selectedHistoryIds.length > 0 && (
          <button
            onClick={handleExportSelectedHistory}
            className="btn-primary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Download size={14} /> Export Selected ({selectedHistoryIds.length})
          </button>
        )}
      </div>

      {/* ── Standard ERP Unified Filter Toolbar ── */}
      <ErpUnifiedFilterBar
        searchQuery={historySearch}
        onSearchChange={setHistorySearch}
        searchPlaceholder="Search AWB, Order ID, SKU, Notes..."
        
        datePreset={historyDatePreset}
        onDateChange={({ preset: p, dateStart: ds, dateEnd: de }) => {
          setHistoryDatePreset(p);
          setHistoryDateStart(ds || '');
          setHistoryDateEnd(de || '');
        }}
        customDateStart={historyCustomStart}
        customDateEnd={historyCustomEnd}
        onCustomDateChange={(s, e) => {
          setHistoryCustomStart(s);
          setHistoryCustomEnd(e);
          setHistoryDateStart(s);
          setHistoryDateEnd(e);
        }}

        categories={returnsFilterCategories}
        activeFilters={historyFilters}
        onFilterChange={setHistoryFilters}
        filterPlaceholder="Type / Condition / Status"
        showChips={true}
        onReset={() => {
          setHistorySearch('');
          setHistoryDatePreset('all');
          setHistoryDateStart('');
          setHistoryDateEnd('');
          setHistoryCustomStart('');
          setHistoryCustomEnd('');
          setHistoryFilters({});
        }}
        rightContent={
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.78)' }}>
            Showing <strong>{filteredHistory.length}</strong> of {history.length}
          </span>
        }
      />

      <div className="table-responsive-wrapper" style={{ marginTop: '0.75rem', background: 'rgba(15, 23, 42, 0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.14)', overflow: 'hidden' }}>
        <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="glass-table" style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.14)' }}>
                <th style={{ width: '38px', textAlign: 'center', padding: '10px 8px' }}>
                  <input
                    type="checkbox"
                    checked={filteredHistory.length > 0 && selectedHistoryIds.length === filteredHistory.length}
                    onChange={() => {
                      if (selectedHistoryIds.length === filteredHistory.length) {
                        setSelectedHistoryIds([]);
                      } else {
                        setSelectedHistoryIds(filteredHistory.map(item => item._id));
                      }
                    }}
                    style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#38bdf8' }}
                  />
                </th>
                <th style={{ padding: '10px 12px', fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.78)' }}>Date</th>
                <th style={{ padding: '10px 12px', fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.78)' }}>AWB / Reference</th>
                <th style={{ padding: '10px 12px', fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.78)' }}>Display Order ID</th>
                <th style={{ padding: '10px 12px', fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.78)' }}>SKU</th>
                <th style={{ padding: '10px 12px', fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.78)' }}>Type</th>
                <th style={{ padding: '10px 12px', fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.78)' }}>Condition</th>
                <th style={{ padding: '10px 12px', fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.78)' }}>Status</th>
                <th style={{ padding: '10px 12px', fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.78)' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '3rem 1rem', textAlign: 'center', color: 'rgba(255,255,255,0.65)', fontSize: '0.85rem' }}>
                    No returns matching your search criteria or date filters.
                  </td>
                </tr>
              ) : (
                filteredHistory.map(item => {
                  const isSelected = selectedHistoryIds.includes(item._id);
                  const isRTO = item.returnType === 'RTO';
                  const isStockedIn = item.status === 'STOCKED_IN';
                  const isDisputed = item.status === 'DISPUTED';

                  return (
                    <tr 
                      key={item._id} 
                      style={{ 
                        background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                        borderBottom: '1px solid rgba(255,255,255,0.08)'
                      }}
                    >
                      <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectHistory(item._id)}
                          style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#38bdf8' }}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: '0.82rem' }}>
                        {formatDateTimeDDMMYYYY(item.createdAt)}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#ffffff', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                        {item.referenceId}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#38bdf8', fontWeight: 700, fontSize: '0.82rem' }}>
                        {item.displayOrderId || '-'}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#ffffff', fontWeight: 600, fontSize: '0.82rem' }}>
                        {item.sku}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ 
                          fontSize: '0.72rem', 
                          fontWeight: 700,
                          padding: '3px 8px', 
                          borderRadius: '6px', 
                          background: isRTO ? 'rgba(56, 189, 248, 0.16)' : 'rgba(245, 158, 11, 0.16)', 
                          color: isRTO ? '#38bdf8' : '#fbbf24',
                          border: `1px solid ${isRTO ? 'rgba(56, 189, 248, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`
                        }}>
                          {item.returnType}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.8)', fontSize: '0.82rem', fontWeight: 500 }}>
                        {item.condition}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ 
                          fontSize: '0.72rem', 
                          fontWeight: 800, 
                          padding: '3px 8px', 
                          borderRadius: '6px', 
                          background: isStockedIn ? 'rgba(16, 185, 129, 0.16)' : isDisputed ? 'rgba(239, 68, 68, 0.16)' : 'rgba(192, 132, 252, 0.16)', 
                          color: isStockedIn ? '#34d399' : isDisputed ? '#f87171' : '#c084fc',
                          border: `1px solid ${isStockedIn ? 'rgba(16, 185, 129, 0.35)' : isDisputed ? 'rgba(239, 68, 68, 0.35)' : 'rgba(192, 132, 252, 0.35)'}`
                        }}>
                          {(item.status || '').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'rgba(255,255,255,0.65)', fontSize: '0.8rem' }}>
                        {item.notes || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', width: '100%' }}>
      {/* TIER 1: GLASS SCREEN HEADER */}
      <div className="glass-screen-header">
        <div className="glass-title-capsule">
          <span className="glass-title-icon">↩️</span>
          <h1>Returns & RTO Manager</h1>
          <EntityBrandBadge entityCode="EE" size="sm" />
        </div>
        <div className="glass-header-actions">
          <QuickActionMenu
            actions={[
              { label: 'Process Returns', icon: '⚡', onClick: () => setActiveTab('process') },
              { label: 'Refinishing Queue', icon: '🛠️', onClick: () => setActiveTab('refinish') },
              { label: 'Returns History', icon: '📜', onClick: () => setActiveTab('history') },
            ]}
          />
        </div>
      </div>

      {/* TIER 2: SUB-SCREEN BUTTONS */}
      <div className="glass-subtabs-bar" data-screen-subtabs="primary" role="tablist">
        <button
          type="button"
          onClick={() => setActiveTab('process')}
          className={`glass-subtab-btn ${activeTab === 'process' ? 'active' : ''}`}
        >
          Process Returns
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('refinish')}
          className={`glass-subtab-btn ${activeTab === 'refinish' ? 'active' : ''}`}
        >
          Refinishing Queue ({refinishQueue.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`glass-subtab-btn ${activeTab === 'history' ? 'active' : ''}`}
        >
          Returns History ({history.length})
        </button>
      </div>

      {/* TIER 3: SIDE-SCROLLING CALCULATION CARDS */}
      <div className="glass-scroll-track">
        <div className="glass-calc-card" onClick={() => setActiveTab('process')} style={{ cursor: 'pointer' }}>
          <span className="glass-calc-title">PENDING BATCH STACK</span>
          <span className="glass-calc-value" style={{ color: '#38bdf8' }}>{stack.length}</span>
          <span className="glass-calc-sub">Items staged for inward</span>
        </div>
        <div className="glass-calc-card" onClick={() => setActiveTab('refinish')} style={{ cursor: 'pointer' }}>
          <span className="glass-calc-title">REFINISHING QUEUE</span>
          <span className="glass-calc-value" style={{ color: '#fbbf24' }}>{refinishQueue.length}</span>
          <span className="glass-calc-sub">Awaiting QC & repack</span>
        </div>
        <div className="glass-calc-card" onClick={() => setActiveTab('history')} style={{ cursor: 'pointer' }}>
          <span className="glass-calc-title">TOTAL RETURNS LOGGED</span>
          <span className="glass-calc-value" style={{ color: '#34d399' }}>{history.length}</span>
          <span className="glass-calc-sub">Processed RTO & Customer Returns</span>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.16)', border: '1px solid rgba(239, 68, 68, 0.35)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} /> <span>{error}</span>
        </div>
      )}
      
      {success && (
        <div style={{ background: 'rgba(16, 185, 129, 0.16)', border: '1px solid rgba(16, 185, 129, 0.35)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={16} /> <span>{success}</span>
        </div>
      )}

      <div style={{ minHeight: '400px' }}>
        {activeTab === 'process' && renderProcessForm()}
        {activeTab === 'refinish' && renderRefinishing()}
        {activeTab === 'history' && renderHistory()}
      </div>

    </div>
  );
}

const styles = {
  tab: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    padding: '0.6rem 1.1rem',
    fontSize: '0.85rem',
    fontWeight: '500',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    cursor: 'pointer',
  },
  tabActive: {
    background: 'rgba(225, 29, 72, 0.1)',
    border: '1px solid rgba(225, 29, 72, 0.2)',
    color: '#e11d48',
    padding: '0.6rem 1.1rem',
    fontSize: '0.85rem',
    fontWeight: '600',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    cursor: 'pointer',
  },
  label: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    marginBottom: '0.5rem',
    display: 'block',
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem',
    fontSize: '0.9rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-light)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'var(--text-primary)',
  }
};
