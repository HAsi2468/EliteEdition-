import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  ShoppingBag, 
  Settings, 
  RefreshCw, 
  AlertCircle,
  CheckCircle2,
  Package,
  Layers,
  Search,
  UploadCloud,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

export default function MyntraHub() {
  const [activeTab, setActiveTab] = useState('config');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Config State
  const [merchantId, setMerchantId] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [isConfigSet, setIsConfigSet] = useState(false);

  // Discounts State
  const [discountSku, setDiscountSku] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountStart, setDiscountStart] = useState('');
  const [discountEnd, setDiscountEnd] = useState('');

  // Orders State
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const fetchData = () => {
      if (activeTab === 'orders') fetchOrders();
      if (activeTab === 'config') fetchConfig();
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await api.getMyntraConfig();
      if (res.isSet) {
        setMerchantId(res.merchantId);
        setSecretKey(res.secretKey);
        setIsConfigSet(true);
      }
    } catch (err) {
      setError('Failed to fetch Myntra configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.saveMyntraConfig(merchantId, secretKey);
      setSuccess('Myntra credentials saved securely.');
      setIsConfigSet(true);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to save Myntra configuration');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const data = await api.getMyntraOrders();
      setOrders(data);
      setSuccess('Orders synced successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to sync orders from Myntra');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncInventory = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await api.syncMyntraInventory();
      setSuccess(res.message || 'Inventory sync triggered');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to trigger inventory sync');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyDiscount = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      // Format datetime-local (YYYY-MM-DDTHH:mm) to expected DD-MM-YYYY HH:mm:ss
      const dStart = new Date(discountStart);
      const formattedStart = `${String(dStart.getDate()).padStart(2, '0')}-${String(dStart.getMonth() + 1).padStart(2, '0')}-${dStart.getFullYear()} ${String(dStart.getHours()).padStart(2, '0')}:${String(dStart.getMinutes()).padStart(2, '0')}:00`;
      
      const dEnd = new Date(discountEnd);
      const formattedEnd = `${String(dEnd.getDate()).padStart(2, '0')}-${String(dEnd.getMonth() + 1).padStart(2, '0')}-${dEnd.getFullYear()} ${String(dEnd.getHours()).padStart(2, '0')}:${String(dEnd.getMinutes()).padStart(2, '0')}:00`;

      const res = await api.applyMyntraDiscount({
        sku: discountSku,
        discountPercentage: discountPercent,
        startDate: formattedStart,
        endDate: formattedEnd
      });
      setSuccess(res.message || 'Discount pushed successfully');
      setTimeout(() => setSuccess(''), 3000);
      setDiscountSku('');
      setDiscountPercent('');
      setDiscountStart('');
      setDiscountEnd('');
    } catch (err) {
      setError(err.message || 'Failed to apply discount');
    } finally {
      setLoading(false);
    }
  };

  const handleDispatchOrder = async (orderId) => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await api.dispatchMyntraOrder(orderId);
      setSuccess(res.message || `Order ${orderId} dispatched`);
      setTimeout(() => setSuccess(''), 3000);
      fetchOrders(); // Refresh table (even though mocked currently)
    } catch (err) {
      setError(err.message || 'Failed to dispatch order');
    } finally {
      setLoading(false);
    }
  };

  const renderConfig = () => (
    <div className="glass-panel" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <ShoppingBag size={48} color="#e11d48" style={{ marginBottom: '1rem' }} />
        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)' }}>Myntra PPMP API Setup</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
          Enter your Myntra Partner Portal credentials to connect your catalog and manage PPMP orders directly from Elite Edition.
        </p>
      </div>

      <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="form-group">
          <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>Merchant ID</label>
          <input
            type="text"
            required
            value={merchantId}
            onChange={(e) => setMerchantId(e.target.value)}
            placeholder="e.g. SFJCKISZ"
            style={styles.input}
          />
        </div>
        <div className="form-group">
          <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>Secret Key</label>
          <input
            type={isConfigSet ? "password" : "text"}
            required
            value={secretKey}
            onChange={(e) => {
              setSecretKey(e.target.value);
              setIsConfigSet(false); // If they type a new one, don't mask it until saved
            }}
            placeholder="Enter your Secret Key"
            style={styles.input}
          />
        </div>
        
        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
          style={{ width: '100%', padding: '0.75rem', marginTop: '1rem', background: '#e11d48', color: 'var(--text-primary)', border: 'none' }}
        >
          {loading ? <RefreshCw className="spin-loader" size={16} /> : <CheckCircle2 size={16} />}
          <span>{isConfigSet ? 'Update Credentials' : 'Save Credentials'}</span>
        </button>
      </form>
    </div>
  );

  const renderOrders = () => (
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)' }}>Live Orders (Mocked)</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Pending and packed orders fetched from Myntra PPMP API.</p>
        </div>
        <button className="btn-secondary" onClick={fetchOrders} disabled={loading} style={{ background: '#e11d48', color: 'var(--text-primary)', border: 'none' }}>
          <RefreshCw size={14} className={loading ? 'spin-loader' : ''} />
          <span>Sync Orders</span>
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Date</th>
              <th>SKU</th>
              <th>Status</th>
              <th className="text-right">Total (₹)</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center" style={{ padding: '2rem', color: 'var(--text-muted)' }}>
                  No orders fetched. Click "Sync Orders" to pull latest.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.orderId}>
                  <td style={{ fontWeight: '600', color: 'var(--primary)' }}>{o.orderId}</td>
                  <td>{new Date(o.date).toLocaleString()}</td>
                  <td>{o.sku}</td>
                  <td>
                    <span style={{
                      padding: '0.2rem 0.6rem',
                      borderRadius: '12px',
                      fontSize: '0.7rem',
                      fontWeight: '600',
                      background: o.status === 'NEW' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                      color: o.status === 'NEW' ? '#60a5fa' : '#34d399'
                    }}>
                      {o.status}
                    </span>
                  </td>
                  <td className="text-right" style={{ fontWeight: 'bold' }}>{o.total}</td>
                  <td className="text-center">
                    <button 
                      className="btn-secondary" 
                      onClick={() => handleDispatchOrder(o.orderId)}
                      disabled={loading || o.status !== 'NEW'}
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', opacity: o.status !== 'NEW' ? 0.5 : 1 }}
                    >
                      <Package size={12} /> Pack & Dispatch
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

  const renderInventory = () => (
    <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
      <Layers size={48} color="#e11d48" style={{ margin: '0 auto 1rem' }} />
      <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Push Local Inventory to Myntra</h3>
      <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto 2rem', fontSize: '0.9rem' }}>
        This action will read the current stock levels from the database and push the available quantity for mapped SKUs to the Myntra Partner Portal via API.
      </p>
      <button className="btn-primary" onClick={handleSyncInventory} disabled={loading} style={{ background: '#e11d48', border: 'none', padding: '0.75rem 1.5rem' }}>
        <UploadCloud size={16} className={loading ? 'spin-loader' : ''} />
        <span>Push Inventory Now</span>
      </button>
    </div>
  );

  const renderDiscounts = () => (
    <div className="glass-panel" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <TrendingUp size={48} color="#e11d48" style={{ marginBottom: '1rem' }} />
        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)' }}>Centralized Promo Manager</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
          Schedule Flat/Percentage discounts for specific SKUs directly from the ERP without using the Myntra DIY portal.
        </p>
      </div>

      <form onSubmit={handleApplyDiscount} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="form-group">
          <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>SKU Code</label>
          <input
            type="text"
            required
            value={discountSku}
            onChange={(e) => setDiscountSku(e.target.value)}
            placeholder="e.g. M-SHIRT-01"
            style={styles.input}
          />
        </div>
        <div className="form-group">
          <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>Discount Percentage (%)</label>
          <input
            type="number"
            min="1"
            max="100"
            required
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
            placeholder="e.g. 20"
            style={styles.input}
          />
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>Start Date/Time</label>
            <input
              type="datetime-local"
              required
              value={discountStart}
              onChange={(e) => setDiscountStart(e.target.value)}
              style={styles.input}
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>End Date/Time</label>
            <input
              type="datetime-local"
              required
              value={discountEnd}
              onChange={(e) => setDiscountEnd(e.target.value)}
              style={styles.input}
            />
          </div>
        </div>
        
        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
          style={{ width: '100%', padding: '0.75rem', marginTop: '1rem', background: '#e11d48', color: 'var(--text-primary)', border: 'none' }}
        >
          {loading ? <RefreshCw className="spin-loader" size={16} /> : <TrendingUp size={16} />}
          <span>Push Discount to Myntra</span>
        </button>
      </form>
    </div>
  );

  return (
    <div style={styles.container}>
      <div className="glass-panel" style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <ShoppingBag size={24} color="#e11d48" />
          <div>
            <h2 style={styles.pageTitle}>Myntra Integration</h2>
            <p style={styles.pageSubtitle}>Manage your Myntra PPMP orders, sync inventory, and dispatch seamlessly.</p>
          </div>
        </div>
      </div>

      {error && (
        <div style={styles.alertError}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={styles.alertSuccess}>
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      <div style={styles.tabsContainer}>
        <button
          onClick={() => setActiveTab('config')}
          style={activeTab === 'config' ? styles.tabActive : styles.tab}
        >
          <Settings size={14} />
          <span>Configuration</span>
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          style={activeTab === 'orders' ? styles.tabActive : styles.tab}
        >
          <Package size={14} />
          <span>Live Orders</span>
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          style={activeTab === 'inventory' ? styles.tabActive : styles.tab}
        >
          <Layers size={14} />
          <span>Inventory Push</span>
        </button>
        <button
          onClick={() => setActiveTab('discounts')}
          style={activeTab === 'discounts' ? styles.tabActive : styles.tab}
        >
          <TrendingUp size={14} />
          <span>Discounts</span>
        </button>
      </div>

      <div style={styles.contentArea}>
        {activeTab === 'config' && renderConfig()}
        {activeTab === 'orders' && renderOrders()}
        {activeTab === 'inventory' && renderInventory()}
        {activeTab === 'discounts' && renderDiscounts()}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    width: '100%',
  },
  topBar: {
    padding: '1.25rem 1.5rem',
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  pageTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    lineHeight: '1.2',
  },
  pageSubtitle: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  tabsContainer: {
    display: 'flex',
    gap: '0.5rem',
    borderBottom: '1px solid var(--border-light)',
    paddingBottom: '0.5rem',
    overflowX: 'auto',
  },
  tab: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    padding: '0.6rem 1.1rem',
    fontSize: '0.85rem',
    fontWeight: '500',
    borderRadius: 'var(--radius-sm)',
    transition: 'all var(--transition-fast)',
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
  contentArea: {
    minHeight: '400px',
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem',
    fontSize: '0.9rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-light)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'var(--text-primary)',
  },
  alertError: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.75rem 1rem',
    color: '#fca5a5',
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  alertSuccess: {
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.75rem 1rem',
    color: '#34d399',
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
};
