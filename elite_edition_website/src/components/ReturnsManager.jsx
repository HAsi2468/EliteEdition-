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
  const [stack, setStack] = useState([]);

  // Auto-fetch party based on selected SKU
  useEffect(() => {
    if (sku) {
      api.getPartyBySku(sku)
        .then(data => {
          if (data && data.party) {
            setParty(data.party);
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
    const fetchParties = async () => {
      try {
        const data = await api.getParties();
        setPartiesList(data || []);
        if (data && data.length > 0) {
          setParty(data[0].name);
        }
      } catch (err) {
        console.error('Failed to fetch parties', err);
      }
    };
    fetchInventory();
    fetchParties();
  }, []);

  const handleAddToStack = (e) => {
    e.preventDefault();
    if (!sku) return;
    
    const finalCondition = returnType === 'RTO' ? 'INTACT' : condition;
    if (returnType === 'CUSTOMER_RETURN' && (finalCondition === 'WRONG_ITEM' || finalCondition === 'DAMAGED') && !notes) {
      setError('Notes are required for Damaged or Wrong Item returns.');
      return;
    }

    setStack([...stack, { sku, quantity: parseInt(quantity, 10), condition: finalCondition, notes }]);
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
          referenceId,
          sku: item.sku,
          quantity: item.quantity,
          condition: item.condition,
          notes: returnType === 'RTO' ? '' : item.notes
        });
        count++;
      }

      setSuccess(`Successfully processed ${count} items for ${referenceId}`);
      setStack([]);
      setReferenceId('');
      setSku('');
      setQuantity(1);
      setNotes('');
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
    <div className="glass-panel" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1rem', background: 'rgba(225, 29, 72, 0.1)', borderRadius: 'var(--radius-md)' }}>
          <Zap size={28} color="#e11d48" />
        </div>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)' }}>Rapid Returns Processing</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Select the mode and scan barcodes to instantly log returns.</p>
        </div>
      </div>

      <form onSubmit={handleAddToStack} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Core Selectors */}
        <div style={{ display: 'flex', gap: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label style={styles.label}>Party / Channel</label>
            <select style={styles.input} value={party} onChange={e => setParty(e.target.value)}>
              {partiesList.length > 0 ? (
                partiesList.map(p => (
                  <option key={p.id || p._id} value={p.name}>{p.name}</option>
                ))
              ) : (
                <>
                  <option value="Myntra">Myntra</option>
                  <option value="Flipkart">Flipkart</option>
                  <option value="Amazon">Amazon</option>
                  <option value="Wholesale">Offline Wholesale</option>
                </>
              )}
            </select>
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

        {/* Scanning Area */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="form-group" style={{ flex: 2 }}>
            <label style={styles.label}>AWB / Order ID (Reference)</label>
            <input 
              ref={inputRef}
              style={styles.input} 
              value={referenceId} 
              onChange={e => setReferenceId(e.target.value)} 
              placeholder="Scan tracking barcode..." 
              required 
            />
          </div>
          <div className="form-group" style={{ flex: 2 }}>
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
          <div className="form-group" style={{ flex: 1 }}>
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
                <th style={{ padding: '0.5rem' }}>SKU</th>
                <th style={{ padding: '0.5rem' }}>Qty</th>
                <th style={{ padding: '0.5rem' }}>Condition</th>
                <th style={{ padding: '0.5rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {stack.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
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
        <button className="btn-secondary" onClick={fetchRefinishQueue}>
          <RefreshCw size={16} className={loading ? 'spin-loader' : ''} /> Refresh
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference (AWB)</th>
              <th>SKU</th>
              <th>Qty</th>
              <th>Party</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {refinishQueue.length === 0 ? (
              <tr><td colSpan="6" className="text-center" style={{ padding: '2rem', color: 'var(--text-muted)' }}>No items in the refinishing queue!</td></tr>
            ) : (
              refinishQueue.map(item => (
                <tr key={item._id}>
                  <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                  <td style={{ fontWeight: 'bold' }}>{item.referenceId}</td>
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
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)' }}>Returns History & Claims</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Master ledger of all returns. Use this to file SPF claims for Disputed items.</p>
        </div>
        <button className="btn-secondary" onClick={fetchHistory}>
          <RefreshCw size={16} className={loading ? 'spin-loader' : ''} /> Refresh
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>AWB / Order ID</th>
              <th>SKU</th>
              <th>Type</th>
              <th>Condition</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td colSpan="7" className="text-center" style={{ padding: '2rem', color: 'var(--text-muted)' }}>No returns history found.</td></tr>
            ) : (
              history.map(item => (
                <tr key={item._id}>
                  <td>{new Date(item.createdAt).toLocaleString()}</td>
                  <td style={{ fontWeight: 'bold' }}>{item.referenceId}</td>
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
              ))
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
