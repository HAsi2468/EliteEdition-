import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { uniwareApi } from '../services/uniware';
import VariantAnalytics from './VariantAnalytics';
import DemographicsAnalytics from './DemographicsAnalytics';
import GrowthMetrics from './GrowthMetrics';
import {
  RefreshCw,
  Activity,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Cpu,
  Database,
  AlertTriangle,
  Truck,
  ArrowLeftRight,
  TrendingUp,
  Filter,
  Package,
  Calendar,
  Check,
  AlertCircle as AlertIcon,
  Grid3X3,
  Globe2,
  BarChart2,
} from 'lucide-react';

export default function UnicommerceHub() {
  const [activeSubTab, setActiveSubTab] = useState('sync'); // 'sync', 'reconciliation', 'returns', 'dispatch', 'variant', 'demographics', 'growth'
  
  // Terminal logs state
  const [logs, setLogs] = useState([
    { time: new Date().toLocaleTimeString(), type: 'system', message: 'Uniware Integration Hub loaded.' },
    { time: new Date().toLocaleTimeString(), type: 'system', message: 'API endpoints mapped successfully.' }
  ]);
  const consoleEndRef = useRef(null);
  
  // Sync states
  const [runningTask, setRunningTask] = useState('');
  
  // Reconciliation states
  const [recoData, setRecoData] = useState([]);
  const [recoLoading, setRecoLoading] = useState(false);
  const [recoFilter, setRecoFilter] = useState('all'); // 'all', 'discrepancies', 'matched'
  const [syncLoading, setSyncLoading] = useState(false);
  
  // Returns states
  const [returnsData, setReturnsData] = useState([]);
  const [returnsStats, setReturnsStats] = useState(null);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnTypeFilter, setReturnTypeFilter] = useState('ALL');
  
  // Dispatch queue states
  const [ordersData, setOrdersData] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [syncingOrderId, setSyncingOrderId] = useState('');

  // Auto-scroll logs
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Load initial data based on active tab
  useEffect(() => {
    const fetchData = () => {
      if (activeSubTab === 'reconciliation') fetchReconciliation();
      if (activeSubTab === 'returns') fetchReturns();
      if (activeSubTab === 'dispatch') fetchOrders();
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [activeSubTab, returnTypeFilter]);

  const addLog = (type, message) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { time, type, message }]);
  };

  const clearLogs = () => {
    setLogs([{ time: new Date().toLocaleTimeString(), type: 'system', message: 'Console cleared.' }]);
  };

  // Sync operations
  const handleFullSync = async () => {
    if (runningTask) return;
    setRunningTask('sales');
    addLog('system', 'Starting full Unicommerce sales order sync...');
    addLog('api', 'Generating export job request on Unicommerce rest/v1 service...');
    try {
      const startTime = Date.now();
      const res = await uniwareApi.runFullUnicommerceSync();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      if (res && res.message) {
        addLog('success', `${res.message}`);
      } else {
        addLog('success', `Sales sync triggered successfully in ${elapsed}s.`);
      }
    } catch (err) {
      addLog('error', `Sales sync error: ${err.message}`);
    } finally {
      setRunningTask('');
    }
  };

  const handleVariationSync = async () => {
    if (runningTask) return;
    setRunningTask('variations');
    addLog('system', 'Starting database variation mapping...');
    try {
      const res = await uniwareApi.runVariationSync();
      if (res && res.message) {
        addLog('success', `Sync finished: ${res.message}`);
      } else {
        addLog('success', 'Variation mapping sync completed.');
      }
    } catch (err) {
      addLog('error', `Variation sync error: ${err.message}`);
    } finally {
      setRunningTask('');
    }
  };

  const handleMissingProductSync = async () => {
    if (runningTask) return;
    setRunningTask('missing');
    addLog('system', 'Scanning catalog for incomplete product descriptions...');
    try {
      const res = await uniwareApi.syncMissingProducts();
      if (res && res.message) {
        addLog('success', `Sync triggered: ${res.message}`);
      } else {
        addLog('success', 'Enrich missing products task spawned.');
      }
    } catch (err) {
      addLog('error', `Catalog enrichment error: ${err.message}`);
    } finally {
      setRunningTask('');
    }
  };

  // Reconciliation Actions
  const handleSyncToDB = async () => {
    setSyncLoading(true);
    addLog('system', 'Starting local database stock reconciliation with Uniware counts...');
    try {
      const res = await uniwareApi.syncInventorySnapshot();
      if (res && res.success) {
        addLog('success', res.message || 'Database stock synchronized successfully.');
        fetchReconciliation();
      } else {
        addLog('error', 'Reconciliation sync failed.');
      }
    } catch (err) {
      addLog('error', `Reconciliation sync error: ${err.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const fetchReconciliation = async () => {
    setRecoLoading(true);
    addLog('system', 'Loading stock reconciliation snapshot comparison...');
    try {
      const res = await uniwareApi.getInventorySnapshot();
      if (res && res.success && res.data) {
        setRecoData(res.data);
        addLog('success', `Loaded ${res.data.length} reconciliation records (Source: ${res.source}).`);
      } else {
        addLog('error', 'Reconciliation data format is invalid.');
      }
    } catch (err) {
      addLog('error', `Reconciliation error: ${err.message}`);
    } finally {
      setRecoLoading(false);
    }
  };

  // Returns Actions
  const fetchReturns = async () => {
    setReturnsLoading(true);
    addLog('system', `Searching Uniware returns database (Filter: ${returnTypeFilter})...`);
    try {
      const filters = returnTypeFilter === 'ALL' ? {} : { returnType: returnTypeFilter };
      const res = await uniwareApi.getReturns(filters);
      if (res && res.success && res.returns) {
        setReturnsData(res.returns);
        setReturnsStats(res.stats);
        addLog('success', `Found ${res.returns.length} return logs (Source: ${res.source}).`);
      } else {
        addLog('error', 'Returns response format is invalid.');
      }
    } catch (err) {
      addLog('error', `Returns loading error: ${err.message}`);
    } finally {
      setReturnsLoading(false);
    }
  };

  // Orders Actions
  const fetchOrders = async () => {
    setOrdersLoading(true);
    addLog('system', 'Fetching dispatch queue orders from database...');
    try {
      const res = await api.getSales({ limit: 50 });
      if (res && res.results) {
        setOrdersData(res.results);
        addLog('success', `Loaded ${res.results.length} orders into the dispatch queue.`);
      } else if (Array.isArray(res)) {
        setOrdersData(res);
        addLog('success', `Loaded ${res.length} orders into the dispatch queue.`);
      } else {
        setOrdersData([]);
      }
    } catch (err) {
      addLog('error', `Failed to load orders: ${err.message}`);
    } finally {
      setOrdersLoading(false);
    }
  };

  const syncLiveOrderStatus = async (code) => {
    setSyncingOrderId(code);
    addLog('system', `Contacting Uniware /oms/saleorder/get for code: ${code}...`);
    try {
      const res = await uniwareApi.getLiveOrderStatus(code);
      if (res && res.success && res.order) {
        addLog('success', `Live sync success! Order '${code}' status: ${res.order.status}`);
        
        // Update local state
        setOrdersData(prev => prev.map(o => {
          const orderId = o.saleOrderItemCode || o.saleOrderCode || o.displayorderCode || o.displayOrderCode;
          if (orderId === code) {
            return { ...o, saleOrderStatus: res.order.status };
          }
          return o;
        }));
      } else {
        addLog('error', `Failed to update status for order: ${code}`);
      }
    } catch (err) {
      addLog('error', `Live sync error for order ${code}: ${err.message}`);
    } finally {
      setSyncingOrderId('');
    }
  };

  // Reco statistics
  const recoAudited = recoData.length;
  const recoMatched = recoData.filter(r => r.status === 'MATCHED').length;
  const recoDiscrepancies = recoData.filter(r => r.status !== 'MATCHED').length;

  const filteredRecoData = recoData.filter(r => {
    if (recoFilter === 'discrepancies') return r.status !== 'MATCHED';
    if (recoFilter === 'matched') return r.status === 'MATCHED';
    return true;
  });

  // Helper to get status colors
  const getStatusStyle = (status) => {
    const s = String(status).toUpperCase();
    if (s === 'MATCHED' || s === 'DELIVERED' || s === 'RETURN_RECEIVED' || s === 'COMPLETE') {
      return { border: '1px solid rgba(16, 185, 129, 0.2)', color: '#86efac', background: 'rgba(16, 185, 129, 0.05)' };
    }
    if (s === 'DB_EXTRA' || s === 'PACKED' || s === 'RETURN_EXPECTED') {
      return { border: '1px solid rgba(6, 182, 212, 0.2)', color: '#67e8f9', background: 'rgba(6, 182, 212, 0.05)' };
    }
    if (s === 'UNIWARE_EXTRA' || s === 'SHIPPED') {
      return { border: '1px solid rgba(245, 158, 11, 0.2)', color: '#fcd34d', background: 'rgba(245, 158, 11, 0.05)' };
    }
    if (s === 'CANCELLED' || s === 'RETURN_REJECTED' || s === 'FAILED') {
      return { border: '1px solid rgba(239, 68, 68, 0.2)', color: '#fca5a5', background: 'rgba(239, 68, 68, 0.05)' };
    }
    return { border: '1px solid rgba(139, 92, 246, 0.2)', color: '#c4b5fd', background: 'rgba(139, 92, 246, 0.05)' };
  };

  return (
    <div style={styles.container}>
      {/* Top Banner Status */}
      <div className="glass-panel" style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <Activity size={20} color="var(--primary)" />
          <div>
            <h2 style={styles.pageTitle}>Uniware Integrations</h2>
            <p style={styles.pageSubtitle}>Monitor sync execution, audit inventory discrepancies, search returns, and trace live dispatch feeds.</p>
          </div>
        </div>
        <div style={styles.connectionBadge}>
          <span style={styles.statusDot}></span>
          <span>Connected to eliteedition.unicommerce.com</span>
        </div>
      </div>

      {/* Tabs Header */}
      <div style={styles.tabsContainer}>
        <button
          onClick={() => setActiveSubTab('sync')}
          style={activeSubTab === 'sync' ? styles.tabActive : styles.tab}
        >
          <RefreshCw size={14} />
          <span>Sync Operations</span>
        </button>
        <button
          onClick={() => setActiveSubTab('reconciliation')}
          style={activeSubTab === 'reconciliation' ? styles.tabActive : styles.tab}
        >
          <Database size={14} />
          <span>Stock Reconciliation</span>
        </button>
        <button
          onClick={() => setActiveSubTab('returns')}
          style={activeSubTab === 'returns' ? styles.tabActive : styles.tab}
        >
          <AlertCircle size={14} />
          <span>Returns Logs & Stats</span>
        </button>
        <button
          onClick={() => setActiveSubTab('dispatch')}
          style={activeSubTab === 'dispatch' ? styles.tabActive : styles.tab}
        >
          <Truck size={14} />
          <span>Dispatch Queue Feed</span>
        </button>
        <div style={{ width: '1px', background: 'var(--border-light)', alignSelf: 'stretch', margin: '4px 0' }} />
        <button
          onClick={() => setActiveSubTab('variant')}
          style={activeSubTab === 'variant' ? styles.tabActive : styles.tab}
        >
          <Grid3X3 size={14} />
          <span>Product Variants</span>
        </button>
        <button
          onClick={() => setActiveSubTab('demographics')}
          style={activeSubTab === 'demographics' ? styles.tabActive : styles.tab}
        >
          <Globe2 size={14} />
          <span>Demographics & Trends</span>
        </button>
        <button
          onClick={() => setActiveSubTab('growth')}
          style={activeSubTab === 'growth' ? styles.tabActive : styles.tab}
        >
          <BarChart2 size={14} />
          <span>Growth Metrics</span>
        </button>
      </div>

      {/* Sub-tab content */}

      {/* TAB 1: SYNC OPERATIONS */}
      {activeSubTab === 'sync' && (
        <div style={styles.dashboardGrid}>
          {/* Left Controls Card */}
          <div className="glass-panel" style={styles.controlsCard}>
            <h3 style={styles.sectionHeader}>Synchronization Tasks</h3>

            {/* Task 1 */}
            <div style={styles.taskItem}>
              <div style={styles.taskDetails}>
                <div style={styles.taskTitle}>Full Sales Order Sync</div>
                <div style={styles.taskDesc}>Calls Unicommerce, triggers export task generation, downloads order sheets CSV, and imports them directly into local database records.</div>
              </div>
              <button
                onClick={handleFullSync}
                disabled={!!runningTask}
                className="btn-primary"
                style={{ ...styles.actionBtn, minWidth: '150px' }}
              >
                <RefreshCw size={14} className={runningTask === 'sales' ? 'spin-loader' : ''} />
                <span>{runningTask === 'sales' ? 'Syncing...' : 'Sync Sales & Orders'}</span>
              </button>
            </div>

            {/* Task 2 */}
            <div style={styles.taskItem}>
              <div style={styles.taskDetails}>
                <div style={styles.taskTitle}>Variations Mapping Sync</div>
                <div style={styles.taskDesc}>Scans local sales records to extract size options and SKU details, mapping them to catalog products and variations.</div>
              </div>
              <button
                onClick={handleVariationSync}
                disabled={!!runningTask}
                className="btn-success"
                style={{ ...styles.actionBtn, minWidth: '150px' }}
              >
                <Database size={14} className={runningTask === 'variations' ? 'spin-loader' : ''} />
                <span>{runningTask === 'variations' ? 'Mapping...' : 'Sync Variations'}</span>
              </button>
            </div>

            {/* Task 3 */}
            <div style={styles.taskItem}>
              <div style={styles.taskDetails}>
                <div style={styles.taskTitle}>Enrich Missing Products</div>
                <div style={styles.taskDesc}>Scans for product SKUs that don't have descriptions, sizes, or image URLs, and fetches details from Unicommerce catalog.</div>
              </div>
              <button
                onClick={handleMissingProductSync}
                disabled={!!runningTask}
                className="btn-primary"
                style={{ ...styles.actionBtn, minWidth: '150px', background: '#ec4899', borderColor: '#db2777' }}
              >
                <Cpu size={14} className={runningTask === 'missing' ? 'spin-loader' : ''} />
                <span>{runningTask === 'missing' ? 'Enriching...' : 'Enrich Products'}</span>
              </button>
            </div>
          </div>

          {/* Right Console Card */}
          <div className="glass-panel" style={styles.consoleCard}>
            <div style={styles.consoleHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Terminal size={16} color="var(--primary)" />
                <span style={styles.consoleTitle}>Execution Terminal Logs</span>
              </div>
              <button onClick={clearLogs} className="btn-icon" style={styles.clearBtn} title="Clear Terminal Log">
                <Trash2 size={14} />
              </button>
            </div>

            <div style={styles.consoleTerminal}>
              {logs.map((log, index) => {
                let color = '#d1d5db'; // default
                if (log.type === 'error') color = '#fca5a5';
                else if (log.type === 'success') color = '#a7f3d0';
                else if (log.type === 'db') color = '#93c5fd';
                else if (log.type === 'api') color = '#fde047';

                return (
                  <div key={index} style={{ ...styles.logRow, color }}>
                    <span style={styles.logTime}>[{log.time}]</span>
                    <span style={styles.logTag}>[{log.type.toUpperCase()}]</span>
                    <span style={styles.logMessage}>{log.message}</span>
                  </div>
                );
              })}
              <div ref={consoleEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STOCK RECONCILIATION */}
      {activeSubTab === 'reconciliation' && (
        <div style={styles.subContainer}>
          {/* Header Stats bar */}
          <div style={styles.statsBar}>
            <div className="glass-panel" style={styles.statCard}>
              <div style={styles.statIcon}><Package size={16} color="#38bdf8" /></div>
              <div>
                <div style={styles.statVal}>{recoAudited}</div>
                <div style={styles.statLabel}>SKUs Audited</div>
              </div>
            </div>
            <div className="glass-panel" style={styles.statCard}>
              <div style={styles.statIcon}><CheckCircle2 size={16} color="#34d399" /></div>
              <div>
                <div style={{ ...styles.statVal, color: '#34d399' }}>{recoMatched}</div>
                <div style={styles.statLabel}>Matched SKUs</div>
              </div>
            </div>
            <div className="glass-panel" style={styles.statCard}>
              <div style={styles.statIcon}><AlertTriangle size={16} color="#fbbf24" /></div>
              <div>
                <div style={{ ...styles.statVal, color: '#fbbf24' }}>{recoDiscrepancies}</div>
                <div style={styles.statLabel}>Discrepant SKUs</div>
              </div>
            </div>
          </div>

          {/* Control Bar */}
          <div className="glass-panel" style={styles.tableFilterBar}>
            <div style={styles.filterLeft}>
              <Filter size={14} color="var(--primary)" />
              <button
                onClick={() => setRecoFilter('all')}
                style={recoFilter === 'all' ? styles.filterBtnActive : styles.filterBtn}
              >
                All SKUs ({recoAudited})
              </button>
              <button
                onClick={() => setRecoFilter('discrepancies')}
                style={recoFilter === 'discrepancies' ? styles.filterBtnActive : styles.filterBtn}
              >
                Discrepancies ({recoDiscrepancies})
              </button>
              <button
                onClick={() => setRecoFilter('matched')}
                style={recoFilter === 'matched' ? styles.filterBtnActive : styles.filterBtn}
              >
                Matched ({recoMatched})
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={fetchReconciliation}
                disabled={recoLoading || syncLoading}
                className="btn-secondary"
                style={styles.refreshBtn}
              >
                <RefreshCw size={12} className={recoLoading ? 'spin-loader' : ''} />
                <span>Run Audit Comparison</span>
              </button>
              <button
                onClick={handleSyncToDB}
                disabled={recoLoading || syncLoading}
                className="btn-primary"
                style={{ ...styles.refreshBtn, background: 'var(--primary)', borderColor: 'rgba(6, 182, 212, 0.4)', color: '#000' }}
              >
                <Check size={12} className={syncLoading ? 'spin-loader' : ''} />
                <span>{syncLoading ? 'Synchronizing...' : 'Sync Uniware to DB'}</span>
              </button>
            </div>
          </div>

          {/* Reconciliation Table */}
          <div className="glass-panel" style={styles.tableCard}>
            <div className="table-container" style={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>SKU Code</th>
                    <th>Product details</th>
                    <th className="text-center">Local Database Stock</th>
                    <th className="text-center">Uniware Channel Stock</th>
                    <th className="text-center">Discrepancy</th>
                    <th>Audit Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recoLoading ? (
                    <tr>
                      <td colSpan="6" className="text-center" style={{ padding: '3rem' }}>
                        <RefreshCw size={24} className="spin-loader" color="var(--primary)" />
                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Auditing catalogs...</div>
                      </td>
                    </tr>
                  ) : filteredRecoData.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center" style={{ color: 'var(--text-muted)', padding: '2rem' }}>
                        No records match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRecoData.map((row) => (
                      <tr key={row.skuCode}>
                        <td>
                          <span style={styles.skuBadge}>{row.skuCode}</span>
                        </td>
                        <td>
                          <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{row.itemName}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Size: {row.size}</div>
                        </td>
                        <td className="text-center" style={{ color: '#67e8f9', fontWeight: 'bold' }}>
                          {row.dbStock}
                        </td>
                        <td className="text-center" style={{ color: '#fcd34d', fontWeight: 'bold' }}>
                          {row.uniwareStock}
                        </td>
                        <td className="text-center" style={{ fontWeight: 'bold', color: row.discrepancy === 0 ? '#34d399' : row.discrepancy > 0 ? '#67e8f9' : '#fcd34d' }}>
                          {row.discrepancy > 0 ? `+${row.discrepancy}` : row.discrepancy}
                        </td>
                        <td>
                          <span style={{ ...styles.badge, ...getStatusStyle(row.status) }}>
                            {row.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RETURNS LOGS & STATS */}
      {activeSubTab === 'returns' && (
        <div style={styles.subContainer}>
          {/* Stats widgets */}
          {returnsStats && (
            <div style={styles.statsBar}>
              <div className="glass-panel" style={styles.statCard}>
                <div style={styles.statIcon}><ArrowLeftRight size={16} color="#fbbf24" /></div>
                <div>
                  <div style={styles.statVal}>{returnsStats.totalReturns}</div>
                  <div style={styles.statLabel}>Total Return Logs</div>
                </div>
              </div>
              <div className="glass-panel" style={styles.statCard}>
                <div style={styles.statIcon}><TrendingUp size={16} color="#f87171" /></div>
                <div>
                  <div style={{ ...styles.statVal, color: '#f87171' }}>
                    {returnsStats.totalReturns > 0 ? `${Math.round((returnsStats.rtoCount / returnsStats.totalReturns) * 100)}%` : '0%'}
                  </div>
                  <div style={styles.statLabel}>RTO Ratio ({returnsStats.rtoCount} items)</div>
                </div>
              </div>
              <div className="glass-panel" style={styles.statCard}>
                <div style={styles.statIcon}><Truck size={16} color="#60a5fa" /></div>
                <div>
                  <div style={{ ...styles.statVal, color: '#60a5fa' }}>{returnsStats.customerReturnCount}</div>
                  <div style={styles.statLabel}>Customer Returns</div>
                </div>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="glass-panel" style={styles.tableFilterBar}>
            <div style={styles.filterLeft}>
              <Filter size={14} color="var(--primary)" />
              <button
                onClick={() => setReturnTypeFilter('ALL')}
                style={returnTypeFilter === 'ALL' ? styles.filterBtnActive : styles.filterBtn}
              >
                All Packages
              </button>
              <button
                onClick={() => setReturnTypeFilter('RTO')}
                style={returnTypeFilter === 'RTO' ? styles.filterBtnActive : styles.filterBtn}
              >
                RTO Logs Only
              </button>
              <button
                onClick={() => setReturnTypeFilter('CUSTOMER_RETURN')}
                style={returnTypeFilter === 'CUSTOMER_RETURN' ? styles.filterBtnActive : styles.filterBtn}
              >
                Customer Returns Only
              </button>
            </div>
            <button
              onClick={fetchReturns}
              disabled={returnsLoading}
              className="btn-secondary"
              style={styles.refreshBtn}
            >
              <RefreshCw size={12} className={returnsLoading ? 'spin-loader' : ''} />
              <span>Query Return Logs</span>
            </button>
          </div>

          {/* Return items table */}
          <div className="glass-panel" style={styles.tableCard}>
            <div className="table-container" style={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Return Code</th>
                    <th>Type</th>
                    <th>Order Code</th>
                    <th>Created On</th>
                    <th>SKU Details</th>
                    <th>Reason</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {returnsLoading ? (
                    <tr>
                      <td colSpan="7" className="text-center" style={{ padding: '3rem' }}>
                        <RefreshCw size={24} className="spin-loader" color="var(--primary)" />
                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Searching returns...</div>
                      </td>
                    </tr>
                  ) : returnsData.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center" style={{ color: 'var(--text-muted)', padding: '2rem' }}>
                        No return logs found.
                      </td>
                    </tr>
                  ) : (
                    returnsData.map((item) => (
                      <tr key={item.code}>
                        <td style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.85rem' }}>{item.code}</td>
                        <td style={{ fontWeight: '500', color: item.returnType === 'RTO' ? '#fca5a5' : '#93c5fd' }}>
                          {item.returnType === 'RTO' ? 'RTO' : 'Customer Return'}
                        </td>
                        <td style={{ color: '#e5e7eb', fontSize: '0.8rem' }}>{item.referenceCode}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {new Date(item.created).toLocaleDateString('en-IN')}
                        </td>
                        <td>
                          {item.returnItems && item.returnItems.map((ri, i) => (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={styles.skuBadge}>{ri.skuCode}</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Qty: {ri.quantity}</span>
                            </div>
                          ))}
                        </td>
                        <td style={{ color: '#d1d5db', fontSize: '0.8rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.returnItems?.[0]?.reason}>
                          {item.returnItems?.[0]?.reason || 'Not Specified'}
                        </td>
                        <td>
                          <span style={{ ...styles.badge, ...getStatusStyle(item.status) }}>
                            {item.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DISPATCH QUEUE FEED */}
      {activeSubTab === 'dispatch' && (
        <div style={styles.subContainer}>
          <div className="glass-panel" style={styles.tableFilterBar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: '600' }}>
              <Truck size={16} color="var(--primary)" />
              <span>Live Order Dispatch Feed Queue</span>
            </div>
            <button
              onClick={fetchOrders}
              disabled={ordersLoading}
              className="btn-secondary"
              style={styles.refreshBtn}
            >
              <RefreshCw size={12} className={ordersLoading ? 'spin-loader' : ''} />
              <span>Refresh Queue</span>
            </button>
          </div>

          <div className="glass-panel" style={styles.tableCard}>
            <div className="table-container" style={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Order Date</th>
                    <th>Order Item Code</th>
                    <th>Display Order Code</th>
                    <th>Product Info</th>
                    <th>Price</th>
                    <th>Current Status</th>
                    <th className="text-center">Live Operations</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersLoading ? (
                    <tr>
                      <td colSpan="7" className="text-center" style={{ padding: '3rem' }}>
                        <RefreshCw size={24} className="spin-loader" color="var(--primary)" />
                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading dispatch items...</div>
                      </td>
                    </tr>
                  ) : ordersData.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center" style={{ color: 'var(--text-muted)', padding: '2rem' }}>
                        No orders currently in local database cache. Run Sales Sync to import.
                      </td>
                    </tr>
                  ) : (
                    ordersData.map((order) => {
                      const orderId = order.saleOrderItemCode || order.saleOrderCode || order.displayorderCode || order.displayOrderCode;
                      const isSyncing = syncingOrderId === orderId;

                      return (
                        <tr key={order._id || orderId}>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {order.orderDate ? new Date(order.orderDate).toLocaleDateString('en-IN') : 'N/A'}
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            {order.saleOrderItemCode || 'N/A'}
                          </td>
                          <td style={{ color: '#d1d5db', fontSize: '0.8rem' }}>
                            {order.displayOrderCode || order.displayorderCode || 'N/A'}
                          </td>
                          <td>
                            <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: '500' }}>
                              {order.skuName || order.itemName || 'Product'}
                            </div>
                            <div style={{ display: 'flex', gap: '0.3rem', marginTop: '3px' }}>
                              <span style={styles.skuBadge}>{order.itemSKUCode || order.skuCode}</span>
                              {order.itemTypeSize && <span style={styles.sizeTag}>{order.itemTypeSize}</span>}
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                            Rs. {order.totalPrice || order.sellingPrice || 0}
                          </td>
                          <td>
                            <span style={{ ...styles.badge, ...getStatusStyle(order.saleOrderStatus) }}>
                              {order.saleOrderStatus || 'PENDING'}
                            </span>
                          </td>
                          <td className="text-center">
                            <button
                              onClick={() => syncLiveOrderStatus(orderId)}
                              disabled={!!syncingOrderId}
                              className="btn-secondary"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                              <RefreshCw size={11} className={isSyncing ? 'spin-loader' : ''} />
                              <span>{isSyncing ? 'Syncing...' : 'Sync Status'}</span>
                            </button>
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
      )}

      {/* TAB 5: PRODUCT VARIANT ANALYTICS */}
      {activeSubTab === 'variant' && <VariantAnalytics />}

      {/* TAB 6: DEMOGRAPHICS & TRENDS */}
      {activeSubTab === 'demographics' && <DemographicsAnalytics />}

      {/* TAB 7: GROWTH METRICS */}
      {activeSubTab === 'growth' && <GrowthMetrics />}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  subContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  topBar: {
    padding: '1.25rem 1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  pageTitle: {
    fontSize: '1.15rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  pageSubtitle: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  connectionBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.15)',
    padding: '0.4rem 0.8rem',
    borderRadius: '20px',
    fontSize: '0.75rem',
    color: '#86efac',
    fontWeight: '500',
  },
  statusDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#10b981',
    boxShadow: '0 0 8px #10b981',
  },
  tabsContainer: {
    display: 'flex',
    gap: '0.5rem',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-light)',
    padding: '4px',
    borderRadius: '8px',
    flexWrap: 'wrap',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    padding: '0.55rem 1rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  tabActive: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'rgba(6, 182, 212, 0.08)',
    border: '1px solid rgba(6, 182, 212, 0.25)',
    color: 'var(--primary)',
    padding: '0.55rem 1rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'default',
  },
  dashboardGrid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: '1.5rem',
  },
  controlsCard: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.2rem',
  },
  sectionHeader: {
    fontSize: '1rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    margin: 0,
  },
  taskItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1.5rem',
    paddingBottom: '1.2rem',
    borderBottom: '1px solid var(--border-light)',
  },
  taskDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    flex: 1,
  },
  taskTitle: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  taskDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    lineHeight: '1.35',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    padding: '0.55rem 1rem',
    fontSize: '0.8rem',
  },
  consoleCard: {
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    height: '350px',
  },
  consoleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  consoleTitle: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
  },
  clearBtn: {
    padding: '0.35rem',
  },
  consoleTerminal: {
    background: '#030712',
    border: '1px solid var(--border-light)',
    borderRadius: '6px',
    padding: '0.75rem',
    flex: 1,
    overflowY: 'auto',
    fontFamily: 'Consolas, Monaco, "Courier New", Courier, monospace',
    fontSize: '0.75rem',
    lineHeight: '1.4',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
  },
  logRow: {
    display: 'flex',
    gap: '0.4rem',
    wordBreak: 'break-all',
  },
  logTime: {
    color: '#6b7280',
    flexShrink: 0,
  },
  logTag: {
    fontWeight: 'bold',
    flexShrink: 0,
  },
  logMessage: {
    flex: 1,
  },
  statsBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1.25rem',
  },
  statCard: {
    padding: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  statIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statVal: {
    fontSize: '1.35rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    lineHeight: '1',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '4px',
  },
  tableFilterBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1.25rem',
    flexWrap: 'wrap',
    gap: '0.75rem',
  },
  filterLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  filterBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    padding: '0.35rem 0.75rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  filterBtnActive: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)',
    padding: '0.35rem 0.75rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '600',
    cursor: 'default',
  },
  tableCard: {
    padding: '1.25rem',
  },
  tableWrap: {
    maxHeight: '400px',
    overflowY: 'auto',
  },
  skuBadge: {
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    color: 'var(--primary)',
    background: 'rgba(6, 182, 212, 0.05)',
    padding: '0.15rem 0.4rem',
    borderRadius: '4px',
    border: '1px solid rgba(6, 182, 212, 0.1)',
  },
  sizeTag: {
    fontSize: '0.7rem',
    color: '#d1d5db',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border-light)',
    padding: '0.05rem 0.25rem',
    borderRadius: '3px',
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.4rem 0.8rem',
    fontSize: '0.75rem',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.2rem 0.5rem',
    borderRadius: '12px',
    fontSize: '0.7rem',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
};
