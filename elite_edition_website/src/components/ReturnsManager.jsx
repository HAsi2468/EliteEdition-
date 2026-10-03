import React, { useState, useEffect, useRef } from 'react';
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
  History
} from 'lucide-react';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../utils/dateUtils';

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
      if (res && res.data) {
        if (res.data.displayOrderId) {
          setDisplayOrderId(res.data.displayOrderId);
        }
        if (res.data.sku) {
          setSku(res.data.sku);
        }
        if (res.data.displayOrderId || res.data.sku) {
          setLookupStatus(`Uniware Matched: Order ${res.data.displayOrderId || targetCode}${res.data.sku ? ` | SKU: ${res.data.sku}` : ''}`);
        }
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
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)' }}>Returns History & Claims</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Master ledger of all returns. Use this to file SPF claims for Disputed items.</p>
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

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '38px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={history.length > 0 && selectedHistoryIds.length === history.length}
                  onChange={handleSelectAllHistory}
                  style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: 'var(--primary)' }}
                />
              </th>
              <th>Date</th>
              <th>AWB / Reference</th>
              <th>Display Order ID</th>
              <th>SKU</th>
              <th>Type</th>
              <th>Condition</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td colSpan="9" className="text-center" style={{ padding: '2rem', color: 'var(--text-muted)' }}>No returns history found.</td></tr>
            ) : (
              history.map(item => {
                const isSelected = selectedHistoryIds.includes(item._id);
                return (
                  <tr key={item._id} style={{ background: isSelected ? 'rgba(56,189,248,0.08)' : 'transparent' }}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectHistory(item._id)}
                        style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: 'var(--primary)' }}
                      />
                    </td>
                    <td>{formatDateTimeDDMMYYYY(item.createdAt)}</td>
                  <td style={{ fontWeight: 'bold' }}>{item.referenceId}</td>
                  <td style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{item.displayOrderId || '-'}</td>
                  <td>{item.sku}</td>
                  <td>
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: item.returnType === 'RTO' ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)', color: item.returnType === 'RTO' ? '#60a5fa' : '#fcd34d' }}>
                      {item.returnType}
                    </span>
                  </td>
                  <td>{item.condition}</td>
                  <td>
                    <span style={{ 
                      fontSize: '0.75rem', fontWeight: 'bold', padding: '0.2rem 0.5rem', borderRadius: '4px', 
                      background: item.status === 'STOCKED_IN' ? 'rgba(16,185,129,0.1)' : item.status === 'DISPUTED' ? 'rgba(239,68,68,0.1)' : 'rgba(139,92,246,0.1)', 
                      color: item.status === 'STOCKED_IN' ? '#34d399' : item.status === 'DISPUTED' ? '#ef4444' : '#a78bfa' 
                    }}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
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
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <RotateCcw size={24} color="#e11d48" />
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>Returns & RTO Manager</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Process incoming returns, manage the refinishing queue, and track disputed claims.</p>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} /> <span>{error}</span>
        </div>
      )}
      
      {success && (
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={16} /> <span>{success}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
        <button onClick={() => setActiveTab('process')} style={activeTab === 'process' ? styles.tabActive : styles.tab}>
          <Zap size={14} /> <span>Process Returns</span>
        </button>
        <button onClick={() => setActiveTab('refinish')} style={activeTab === 'refinish' ? styles.tabActive : styles.tab}>
          <ListTodo size={14} /> <span>Refinishing Queue</span>
        </button>
        <button onClick={() => setActiveTab('history')} style={activeTab === 'history' ? styles.tabActive : styles.tab}>
          <History size={14} /> <span>Returns History</span>
        </button>
      </div>

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
