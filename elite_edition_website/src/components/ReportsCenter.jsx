import React, { useState, useEffect } from 'react';
import { api, getBaseUrl } from '../services/api';
import { 
  BarChart2, 
  FileText, 
  Download, 
  RefreshCw, 
  Calendar, 
  Search, 
  ArrowUpRight, 
  TrendingUp, 
  Layers, 
  Activity,
  AlertCircle,
  Clock,
  Briefcase,
  Layers3,
  IndianRupee,
  Send,
  X
} from 'lucide-react';

export default function ReportsCenter({ department }) {
  const [activeDepartment, setActiveDepartment] = useState(() => {
    if (department === 'elite-online') return 'sales';
    return department || 'elite-print';
  });
  const [activeReportTab, setActiveReportTab] = useState(() => {
    if (department === 'elite-online') return 'sales';
    return 'smart-dashboard';
  }); 
  const [dateStart, setDateStart] = useState(() => new Date().toISOString().split('T')[0]);
  const [dateEnd, setDateEnd] = useState(() => new Date().toISOString().split('T')[0]);
  const [timeStart, setTimeStart] = useState('00:00');
  const [timeEnd, setTimeEnd] = useState('23:59');
  const [searchCode, setSearchCode] = useState('');
  
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [expandedHour, setExpandedHour] = useState(null);
  const [returnsSubTab, setReturnsSubTab] = useState('pickup');

  // Sharing states
  const [showShareModal, setShowShareModal] = useState(false);
  const [chatRooms, setChatRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [sharingReport, setSharingReport] = useState(false);
  const [shareSearch, setShareSearch] = useState('');

  // Fetch rooms list for sharing
  useEffect(() => {
    if (showShareModal) {
      const loadRooms = async () => {
        try {
          const currentUser = api.getCurrentUser();
          const userId = currentUser ? (currentUser._id || currentUser.id) : '';
          const res = await api.getRooms(userId);
          if (res.data) setChatRooms(res.data);
        } catch (err) {
          console.error('Failed to load chat rooms for sharing', err);
        }
      };
      loadRooms();
    }
  }, [showShareModal]);

  // Fetch report data on tab, department, or date/time changes
  useEffect(() => {
    fetchReportData();
  }, [activeReportTab, activeDepartment, dateStart, dateEnd, timeStart, timeEnd]);

  // When department changes, set the first sub-tab as active
  useEffect(() => {
    if (activeDepartment === 'elite-print') setActiveReportTab('smart-dashboard');
    else if (activeDepartment === 'sales') setActiveReportTab('sales');
    else if (activeDepartment === 'inventory') setActiveReportTab('stock-value');
    else if (activeDepartment === 'returns') setActiveReportTab('returns-analysis');
    else if (activeDepartment === 'integrations') setActiveReportTab('api-health');
  }, [activeDepartment]);

  const fetchReportData = async () => {
    setLoading(true);
    setError('');
    try {
      let data = null;
      const combinedStart = `${dateStart}T${timeStart}:00`;
      const combinedEnd = `${dateEnd}T${timeEnd}:59`;

      if (activeDepartment === 'elite-print') {
        const res = await api.getElitePrintReports(combinedStart, combinedEnd);
        data = res.data;
      } else if (activeReportTab === 'stock-value') {
        data = await api.getStockValueReportData();
      } else if (activeReportTab === 'stock-inward') {
        data = await api.getStockInwardReportData(combinedStart, combinedEnd);
      } else if (activeReportTab === 'stock-outward') {
        data = await api.getStockOutwardReportData(combinedStart, combinedEnd);
      } else if (activeReportTab === 'sales') {
        data = await api.getSalesReportData(combinedStart, combinedEnd, searchCode);
      } else if (activeReportTab === 'brand') {
        data = await api.getBrandReportData(combinedStart, combinedEnd, searchCode);
      } else if (activeReportTab === 'brand-hourly') {
        data = await api.getBrandReportHourWiseData(combinedStart, combinedEnd, searchCode);
      } else if (activeReportTab === 'returns-analysis') {
        const res = await api.getReturnsBrandReport({ dateStart: combinedStart, dateEnd: combinedEnd });
        data = res;
      }
      setReportData(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch report data.');
    } finally {
      setLoading(false);
    }
  };

  const handleShareReport = async (e) => {
    e.preventDefault();
    if (!selectedRoomId || !reportData) return;
    
    setSharingReport(true);
    try {
      const currentUser = api.getCurrentUser();
      const senderId = currentUser ? (currentUser._id || currentUser.id) : '';
      if (!senderId) {
        alert('You must be signed in to share reports.');
        return;
      }
      
      const combinedStart = `${dateStart}T${timeStart}:00`;
      const combinedEnd = `${dateEnd}T${timeEnd}:59`;
      const dateText = `${combinedStart} to ${combinedEnd}`;
      const reportTitle = getReportTitle();
      const apiBase = getBaseUrl();
      const fullBase = apiBase.startsWith('http') ? apiBase : `${window.location.origin}${apiBase}`;
      
      let downloadLink = '';
      if (activeReportTab === 'brand-hourly') {
        downloadLink = `${fullBase}/salesList/report/pdf?type=brand-hourly&dateStart=${combinedStart}&dateEnd=${combinedEnd}`;
      } else if (activeReportTab === 'brand') {
        downloadLink = `${fullBase}/salesList/report/pdf?type=brand&dateStart=${combinedStart}&dateEnd=${combinedEnd}`;
      } else if (activeReportTab === 'returns-analysis') {
        downloadLink = `${fullBase}/salesList/report/pdf?type=returns-analysis&dateStart=${combinedStart}&dateEnd=${combinedEnd}`;
      } else {
        downloadLink = `${fullBase}/salesList/report/pdf?dateStart=${combinedStart}&dateEnd=${combinedEnd}`;
      }

      let content = `📊 *SHARED REPORT: ${reportTitle.toUpperCase()}*\n📅 Period: ${dateText}\n\n`;
      
      if (activeReportTab === 'brand-hourly') {
        const peak = [...(reportData.hourlyTotals || [])].sort((a,b) => b.quantity - a.quantity)[0];
        content += `📦 *Total Qty:* ${(reportData.totalOrderQuantity || 0).toLocaleString('en-IN')} pcs\n`;
        content += `💰 *Total Revenue:* ${formatPrice(reportData.totalSellableAmount || 0)}\n`;
        if (peak && peak.quantity > 0) {
          content += `🏆 *Peak Hour:* ${peak.hourLabel} (${peak.quantity} pcs · ${formatPrice(peak.sellableAmount)})\n`;
        }
      } else if (activeReportTab === 'sales') {
        content += `📦 *Total Orders:* ${(reportData.totalOrders || 0).toLocaleString('en-IN')}\n`;
        content += `💰 *Total Revenue:* ${formatPrice(reportData.totalSellableAmount || 0)}\n`;
      } else if (activeReportTab === 'brand') {
        content += `📦 *Total Qty:* ${(reportData.totalOrderQuantity || 0).toLocaleString('en-IN')} pcs\n`;
        content += `💰 *Total Revenue:* ${formatPrice(reportData.totalSellableAmount || 0)}\n`;
      } else if (activeReportTab === 'stock-value') {
        content += `📦 *Total Qty:* ${(reportData.totalQuantity || 0).toLocaleString('en-IN')} pcs\n`;
        content += `💰 *Total Estimated Value:* ${formatPrice(reportData.totalValue || 0)}\n`;
        content += `🔢 *Unique SKUs:* ${(reportData.uniqueSkus || 0).toLocaleString('en-IN')}\n`;
      } else if (activeReportTab === 'returns-analysis') {
        content += `📦 *Returned Brands:* ${Array.isArray(reportData) ? reportData.length : 0}\n`;
        content += `🔄 *Total Return Orders:* ${(Array.isArray(reportData) ? reportData.reduce((s, r) => s + (r.returnsCount || 0), 0) : 0).toLocaleString('en-IN')}\n`;
        if (Array.isArray(reportData) && reportData[0]) {
          content += `🏆 *Top Return Brand:* ${reportData[0].brand} (${reportData[0].returnsCount} returns)\n`;
        }
      } else {
        content += `📦 *Orders/Items Count:* ${(reportData.count || reportData.total || 0).toLocaleString('en-IN')}\n`;
      }
      
      content += `\n🔗 *Download PDF Report:* ${downloadLink}`;

      await api.sendRoomMessage(selectedRoomId, { senderId, content });
      alert('Report shared successfully to the chat room!');
      setShowShareModal(false);
      setSelectedRoomId('');
      setShareSearch('');
    } catch (err) {
      console.error('Failed to share report', err);
      alert('Failed to share report.');
    } finally {
      setSharingReport(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    setError('');
    try {
      const combinedStart = `${dateStart}T${timeStart}:00`;
      const combinedEnd = `${dateEnd}T${timeEnd}:59`;
      
      const formattedDateStart = combinedStart.replace(/:/g, '-');
      const formattedDateEnd = combinedEnd.replace(/:/g, '-');
      
      if (activeReportTab === 'stock-value') {
        await api.downloadInventoryReport('stock-value', combinedStart, combinedEnd, `Stock_Value_Report_${formattedDateStart}.pdf`);
      } else if (activeReportTab === 'stock-inward') {
        await api.downloadInventoryReport('stock-inward', combinedStart, combinedEnd, `Stock_Inward_Report_${formattedDateStart}_to_${formattedDateEnd}.pdf`);
      } else if (activeReportTab === 'stock-outward') {
        await api.downloadInventoryReport('stock-outward', combinedStart, combinedEnd, `Stock_Outward_Report_${formattedDateStart}_to_${formattedDateEnd}.pdf`);
      } else if (activeReportTab === 'sales') {
        await api.downloadSalesReport(combinedStart, combinedEnd, searchCode, `Sales_Report_${formattedDateStart}_to_${formattedDateEnd}.pdf`);
      } else if (activeReportTab === 'brand') {
        await api.downloadBrandReport(combinedStart, combinedEnd, searchCode, `Brand_Report_${formattedDateStart}_to_${formattedDateEnd}.pdf`);
      } else if (activeReportTab === 'brand-hourly') {
        await api.downloadBrandReportHourWise(combinedStart, combinedEnd, searchCode, `Brand_Hourly_Report_${formattedDateStart}_to_${formattedDateEnd}.pdf`);
      } else if (activeReportTab === 'returns-analysis') {
        await api.downloadReturnsBrandReport(combinedStart, combinedEnd, returnsSubTab, `Returns_Brand_Report_${formattedDateStart}_to_${formattedDateEnd}.pdf`);
      }
    } catch (err) {
      setError(err.message || 'Failed to generate and download PDF report.');
    } finally {
      setDownloading(false);
    }
  };

  const formatPrice = (p) => {
    return `₹${Number(p || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getReportTitle = () => {
    switch (activeReportTab) {
      case 'smart-dashboard': return 'Smart AI Analytics Dashboard';
      case 'stock-value': return 'Stock Value Report';
      case 'stock-inward': return 'Inward Report';
      case 'stock-outward': return 'Outward Report';
      case 'sales': return 'Sales Summary Report';
      case 'brand': return 'Brand Performance Report';
      case 'brand-hourly': return 'Hourly Brand Analysis Report';
      case 'returns-analysis': return 'Returns Brand Report';
      default: return 'Reports';
    }
  };

  const getReportDescription = () => {
    if (activeDepartment === 'elite-print') {
      switch (activeReportTab) {
        case 'smart-dashboard': return 'Displays real-time low stock warnings, production stage bottlenecks, top designs, and fabric demand forecasting.';
        case 'creative-output': return 'Tracks the number of unique designs a designer completes over time to identify high-output creators.';
        case 'color-matching': return 'Measures how quickly designers spin up color variants for single prints.';
        case 'machine-speed': return 'Evaluates machine meterage output grouped by machine name, speed, and passes.';
        case 'fusing-throughput': return 'Monitors daily completed fusing meters processed by the factory floor.';
        case 'fabric-variance': return 'Compares theoretical fabric consumption against actual printed meters to highlight wastage.';
        case 'deadline-adherence': return 'Tracks time variance between expected job delivery times and actual delivery dates.';
      }
    }
    switch (activeReportTab) {
      case 'stock-value': return 'Displays the current active stock levels, purchase prices, sales prices, and total valuation calculations.';
      case 'stock-inward': return 'Summarizes all items stocked in, including purchase prices, supplier details, and in-flow quantities.';
      case 'stock-outward': return 'Summarizes all items scanned out of stock, including customer details, out-flow quantities, and profit calculations.';
      case 'sales': return 'Shows sales performance details aggregated by product SKU code, including total orders and revenue.';
      case 'brand': return 'Renders sales performance details grouped by brand, showcasing size distributions, base SKU totals, and brand-level revenue metrics.';
      case 'returns-analysis': return 'Analyzes returned orders grouped by brand, based on reverse pickup created dates in Unicommerce.';
      default: return '';
    }
  };

  return (
    <div style={styles.container}>
      {/* Top Banner Status */}
      <div className="glass-panel" style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <BarChart2 size={22} color="var(--primary)" />
          <div>
            <h2 style={styles.pageTitle}>
              {department === 'elite-print' ? "Elite Digital Print Reports" : 
               department === 'elite-online' ? "Elite Edition Online Dashboard" : 
               "Reports & Analytics Center"}
            </h2>
            <p style={styles.pageSubtitle}>
              {department === 'elite-print' ? "Analyze performance, output, speeds, and variance metrics for the printing department." : 
               department === 'elite-online' ? "E-commerce sales overview, inventory value, return rates, and integration health." : 
               "View database-wide operations report, analyze performance, and download professional PDF archives."}
            </p>
          </div>
        </div>
      </div>

      {/* Departments Header */}
      {(!department || department === 'elite-online') && (
        <div style={styles.tabsContainer}>
          {department !== 'elite-online' && (
            <button
              onClick={() => setActiveDepartment('elite-print')}
              style={activeDepartment === 'elite-print' ? styles.tabActive : styles.tab}
            >
              <Layers size={14} />
              <span>Elite Digital Print</span>
            </button>
          )}
          <button
            onClick={() => setActiveDepartment('sales')}
            style={activeDepartment === 'sales' ? styles.tabActive : styles.tab}
          >
            <TrendingUp size={14} />
            <span>Sales & Orders</span>
          </button>
          <button
            onClick={() => setActiveDepartment('inventory')}
            style={activeDepartment === 'inventory' ? styles.tabActive : styles.tab}
          >
            <Briefcase size={14} />
            <span>Inventory</span>
          </button>
          {department !== 'elite-online' && (
            <button
              onClick={() => setActiveDepartment('returns')}
              style={activeDepartment === 'returns' ? styles.tabActive : styles.tab}
            >
              <Activity size={14} />
              <span>Returns & QC</span>
            </button>
          )}
          {department !== 'elite-online' && (
            <button
              onClick={() => setActiveDepartment('integrations')}
              style={activeDepartment === 'integrations' ? styles.tabActive : styles.tab}
            >
              <FileText size={14} />
              <span>Integrations</span>
            </button>
          )}
        </div>
      )}

      {/* Sub Tabs Header */}
      <div style={{ ...styles.tabsContainer, marginTop: '0.5rem', background: 'transparent', padding: 0 }}>
        {activeDepartment === 'elite-print' && (
          <>
            <button onClick={() => setActiveReportTab('smart-dashboard')} style={activeReportTab === 'smart-dashboard' ? styles.subTabActive : styles.subTab}>Smart Dashboard</button>
            <button onClick={() => setActiveReportTab('creative-output')} style={activeReportTab === 'creative-output' ? styles.subTabActive : styles.subTab}>Creative Output</button>
            <button onClick={() => setActiveReportTab('color-matching')} style={activeReportTab === 'color-matching' ? styles.subTabActive : styles.subTab}>Color Matching</button>
            <button onClick={() => setActiveReportTab('machine-speed')} style={activeReportTab === 'machine-speed' ? styles.subTabActive : styles.subTab}>Machine Speed</button>
            <button onClick={() => setActiveReportTab('fusing-throughput')} style={activeReportTab === 'fusing-throughput' ? styles.subTabActive : styles.subTab}>Fusing Throughput</button>
            <button onClick={() => setActiveReportTab('fabric-variance')} style={activeReportTab === 'fabric-variance' ? styles.subTabActive : styles.subTab}>Fabric Variance</button>
            <button onClick={() => setActiveReportTab('deadline-adherence')} style={activeReportTab === 'deadline-adherence' ? styles.subTabActive : styles.subTab}>Deadline Adherence</button>
          </>
        )}
        {activeDepartment === 'sales' && (
          <>
            <button onClick={() => setActiveReportTab('sales')} style={activeReportTab === 'sales' ? styles.subTabActive : styles.subTab}>Sales Summary</button>
            <button onClick={() => setActiveReportTab('brand')} style={activeReportTab === 'brand' ? styles.subTabActive : styles.subTab}>Brand Analytics</button>
            <button onClick={() => setActiveReportTab('brand-hourly')} style={activeReportTab === 'brand-hourly' ? styles.subTabActive : styles.subTab}>Hourly Brand Analysis</button>
            <button onClick={() => setActiveReportTab('returns-analysis')} style={activeReportTab === 'returns-analysis' ? styles.subTabActive : styles.subTab}>Returns Brand Analysis</button>
          </>
        )}
        {activeDepartment === 'inventory' && (
          <>
            <button onClick={() => setActiveReportTab('stock-value')} style={activeReportTab === 'stock-value' ? styles.subTabActive : styles.subTab}>Stock Value</button>
            <button onClick={() => setActiveReportTab('stock-inward')} style={activeReportTab === 'stock-inward' ? styles.subTabActive : styles.subTab}>Inward</button>
            <button onClick={() => setActiveReportTab('stock-outward')} style={activeReportTab === 'stock-outward' ? styles.subTabActive : styles.subTab}>Outward</button>
          </>
        )}
        {activeDepartment === 'returns' && (
          <button onClick={() => setActiveReportTab('returns-analysis')} style={activeReportTab === 'returns-analysis' ? styles.subTabActive : styles.subTab}>Returns Analysis</button>
        )}
        {activeDepartment === 'integrations' && (
          <button onClick={() => setActiveReportTab('api-health')} style={activeReportTab === 'api-health' ? styles.subTabActive : styles.subTab}>API Health & Logs</button>
        )}
      </div>

      {/* Filters Card */}
      <div className="glass-panel" style={styles.filterCard}>
        <div style={styles.filterRow}>
          {activeReportTab !== 'stock-value' && (
            <>
              <div style={styles.filterItem}>
                <label style={styles.label}><Calendar size={13} /> Start Date</label>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <input 
                    type="date" 
                    value={dateStart} 
                    onChange={(e) => setDateStart(e.target.value)} 
                    style={styles.input} 
                  />
                  <input 
                    type="time" 
                    value={timeStart} 
                    onChange={(e) => setTimeStart(e.target.value)} 
                    style={{ ...styles.input, width: '90px' }} 
                  />
                </div>
              </div>
              <div style={styles.filterItem}>
                <label style={styles.label}><Calendar size={13} /> End Date</label>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <input 
                    type="date" 
                    value={dateEnd} 
                    onChange={(e) => setDateEnd(e.target.value)} 
                    style={styles.input} 
                  />
                  <input 
                    type="time" 
                    value={timeEnd} 
                    onChange={(e) => setTimeEnd(e.target.value)} 
                    style={{ ...styles.input, width: '90px' }} 
                  />
                </div>
              </div>
            </>
          )}

          {(activeReportTab === 'sales' || activeReportTab === 'brand' || activeReportTab === 'brand-hourly') && (
            <div style={styles.filterItem}>
              <label style={styles.label}><Search size={13} /> SKU Code Search</label>
              <input 
                type="text" 
                value={searchCode} 
                onChange={(e) => setSearchCode(e.target.value)} 
                placeholder="Search base SKU..."
                style={styles.input} 
              />
            </div>
          )}

          <div style={styles.actionsGroup}>
            <button 
              onClick={fetchReportData} 
              disabled={loading || downloading} 
              className="btn-secondary" 
              style={styles.actionBtn}
            >
              <RefreshCw size={14} className={loading ? 'spin-loader' : ''} />
              <span>Fetch Data</span>
            </button>
            <button 
              onClick={handleDownloadPdf} 
              disabled={loading || downloading || !reportData} 
              className="btn-primary" 
              style={{ ...styles.actionBtn, background: 'var(--primary)', color: '#000' }}
            >
              <Download size={14} className={downloading ? 'spin-loader' : ''} />
              <span>{downloading ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>
            <button 
              onClick={() => setShowShareModal(true)} 
              disabled={loading || downloading || !reportData} 
              className="btn-secondary" 
              style={{ ...styles.actionBtn, background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', borderColor: 'rgba(59, 130, 246, 0.3)', marginLeft: '10px' }}
            >
              <Send size={14} />
              <span>Share to Chat</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={styles.errorContainer}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Cards */}
      {reportData && (
        <div style={styles.summaryGrid}>
          {activeDepartment === 'elite-print' && (
            <>
              {activeReportTab === 'smart-dashboard' && (
                <>
                  <div className="glass-panel" style={styles.summaryCard}>
                    <Clock size={20} color="var(--primary)" />
                    <div>
                      <div style={styles.summaryValue}>{reportData.avgPrintToDelivery || 0} Days</div>
                      <div style={styles.summaryLabel}>Avg Print-to-Delivery Time</div>
                    </div>
                  </div>
                  <div className="glass-panel" style={styles.summaryCard}>
                    <AlertCircle size={20} color={reportData.lowStockAlerts?.length > 0 ? '#ef4444' : 'var(--success)'} />
                    <div>
                      <div style={styles.summaryValue}>{reportData.lowStockAlerts?.length || 0} Items</div>
                      <div style={styles.summaryLabel}>Low Stock Alerts</div>
                    </div>
                  </div>
                  <div className="glass-panel" style={styles.summaryCard}>
                    <Activity size={20} color={reportData.delayedCards?.length > 0 ? '#fbbf24' : 'var(--success)'} />
                    <div>
                      <div style={styles.summaryValue}>{reportData.delayedCards?.length || 0} Cards</div>
                      <div style={styles.summaryLabel}>Delayed Job Cards (&gt;7 Days)</div>
                    </div>
                  </div>
                </>
              )}
              {activeReportTab === 'creative-output' && (
                <div className="glass-panel" style={styles.summaryCard}>
                  <Layers3 size={20} color="var(--primary)" />
                  <div>
                    <div style={styles.summaryValue}>{reportData.designerCreativeOutput?.length || 0}</div>
                    <div style={styles.summaryLabel}>Total Designers Contributing</div>
                  </div>
                </div>
              )}
              {activeReportTab === 'machine-speed' && (
                <div className="glass-panel" style={styles.summaryCard}>
                  <Activity size={20} color="var(--success)" />
                  <div>
                    <div style={styles.summaryValue}>{reportData.machineMeterage?.length || 0}</div>
                    <div style={styles.summaryLabel}>Total Unique Print Configurations</div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeReportTab === 'stock-value' && (
            <>
              <div className="glass-panel" style={styles.summaryCard}>
                <Layers3 size={20} color="var(--primary)" />
                <div>
                  <div style={styles.summaryValue}>{reportData.items?.length || 0}</div>
                  <div style={styles.summaryLabel}>Total Active SKUs</div>
                </div>
              </div>
              <div className="glass-panel" style={styles.summaryCard}>
                <Activity size={20} color="var(--success)" />
                <div>
                  <div style={styles.summaryValue}>{reportData.totalQty || 0}</div>
                  <div style={styles.summaryLabel}>Total Stock Quantity</div>
                </div>
              </div>
              <div className="glass-panel" style={styles.summaryCard}>
                <IndianRupee size={20} color="var(--primary)" />
                <div>
                  <div style={styles.summaryValue}>{formatPrice(reportData.totalSell)}</div>
                  <div style={styles.summaryLabel}>Inventory Valuation</div>
                </div>
              </div>
            </>
          )}

          {activeReportTab === 'stock-inward' && (
            <>
              <div className="glass-panel" style={styles.summaryCard}>
                <Layers3 size={20} color="var(--primary)" />
                <div>
                  <div style={styles.summaryValue}>{reportData.items?.length || 0}</div>
                  <div style={styles.summaryLabel}>SKUs Received</div>
                </div>
              </div>
              <div className="glass-panel" style={styles.summaryCard}>
                <ArrowUpRight size={20} color="var(--success)" />
                <div>
                  <div style={styles.summaryValue}>{reportData.totalQty || 0}</div>
                  <div style={styles.summaryLabel}>Units Received</div>
                </div>
              </div>
              <div className="glass-panel" style={styles.summaryCard}>
                <IndianRupee size={20} color="var(--warning)" />
                <div>
                  <div style={styles.summaryValue}>{formatPrice(reportData.totalPurchase)}</div>
                  <div style={styles.summaryLabel}>Purchase Cost</div>
                </div>
              </div>
            </>
          )}

          {activeReportTab === 'stock-outward' && (
            <>
              <div className="glass-panel" style={styles.summaryCard}>
                <Layers3 size={20} color="var(--primary)" />
                <div>
                  <div style={styles.summaryValue}>{reportData.items?.length || 0}</div>
                  <div style={styles.summaryLabel}>SKUs Dispatched</div>
                </div>
              </div>
              <div className="glass-panel" style={styles.summaryCard}>
                <TrendingUp size={20} color="var(--success)" />
                <div>
                  <div style={styles.summaryValue}>{reportData.totalQty || 0}</div>
                  <div style={styles.summaryLabel}>Units Out</div>
                </div>
              </div>
              <div className="glass-panel" style={styles.summaryCard}>
                <IndianRupee size={20} color="var(--primary)" />
                <div>
                  <div style={styles.summaryValue}>{formatPrice(reportData.totalSell)}</div>
                  <div style={styles.summaryLabel}>Total Revenue</div>
                </div>
              </div>
              <div className="glass-panel" style={styles.summaryCard}>
                <Activity size={20} color={reportData.totalProfit >= 0 ? 'var(--success)' : 'var(--danger)'} />
                <div>
                  <div style={{ ...styles.summaryValue, color: reportData.totalProfit >= 0 ? '#34d399' : '#f87171' }}>
                    {formatPrice(reportData.totalProfit)}
                  </div>
                  <div style={styles.summaryLabel}>Estimated Profit</div>
                </div>
              </div>
            </>
          )}

          {activeReportTab === 'sales' && (
            <>
              <div className="glass-panel" style={styles.summaryCard}>
                <Layers3 size={20} color="var(--primary)" />
                <div>
                  <div style={styles.summaryValue}>{Array.isArray(reportData) ? reportData.length : 0}</div>
                  <div style={styles.summaryLabel}>Total Active SKUs</div>
                </div>
              </div>
              <div className="glass-panel" style={styles.summaryCard}>
                <TrendingUp size={20} color="var(--success)" />
                <div>
                  <div style={styles.summaryValue}>
                    {Array.isArray(reportData) ? reportData.reduce((s, r) => s + (r.salesCount || 0), 0) : 0}
                  </div>
                  <div style={styles.summaryLabel}>Total Orders Count</div>
                </div>
              </div>
              <div className="glass-panel" style={styles.summaryCard}>
                <IndianRupee size={20} color="var(--primary)" />
                <div>
                  <div style={styles.summaryValue}>
                    {formatPrice(Array.isArray(reportData) ? reportData.reduce((s, r) => s + (r.sellableAmount || 0), 0) : 0)}
                  </div>
                  <div style={styles.summaryLabel}>Sales Revenue</div>
                </div>
              </div>
            </>
          )}

          {activeReportTab === 'brand' && (
            <>
              <div className="glass-panel" style={styles.summaryCard}>
                <Layers3 size={20} color="var(--primary)" />
                <div>
                  <div style={styles.summaryValue}>{reportData.brands?.length || 0}</div>
                  <div style={styles.summaryLabel}>Total Brands</div>
                </div>
              </div>
              <div className="glass-panel" style={styles.summaryCard}>
                <TrendingUp size={20} color="var(--success)" />
                <div>
                  <div style={styles.summaryValue}>{reportData.totalOrderQuantity || 0}</div>
                  <div style={styles.summaryLabel}>Total Units Sold</div>
                </div>
              </div>
              <div className="glass-panel" style={styles.summaryCard}>
                <IndianRupee size={20} color="var(--primary)" />
                <div>
                  <div style={styles.summaryValue}>{formatPrice(reportData.totalSellableAmount)}</div>
                  <div style={styles.summaryLabel}>Total Sales Revenue</div>
                </div>
              </div>
            </>
          )}

          {activeReportTab === 'returns-analysis' && reportData && (() => {
            const data = returnsSubTab === 'physical' ? reportData.physicalReport : reportData.pickupReport;
            if (!data) return null;
            return (
              <>
                <div className="glass-panel" style={styles.summaryCard}>
                  <Layers3 size={20} color="var(--primary)" />
                  <div>
                    <div style={styles.summaryValue}>{data.brands?.length || 0}</div>
                    <div style={styles.summaryLabel}>Returned Brands</div>
                  </div>
                </div>
                <div className="glass-panel" style={styles.summaryCard}>
                  <RefreshCw size={20} color="#fca5a5" className={loading ? 'spin-loader' : ''} />
                  <div>
                    <div style={styles.summaryValue}>
                      {data.totalOrderQuantity || 0}
                    </div>
                    <div style={styles.summaryLabel}>Total Return Orders</div>
                  </div>
                </div>
                <div className="glass-panel" style={styles.summaryCard}>
                  <AlertCircle size={20} color="var(--warning)" />
                  <div>
                    <div style={styles.summaryValue}>
                      {data.brands?.[0]?.brand || 'N/A'}
                    </div>
                    <div style={styles.summaryLabel}>Top Return Brand</div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Report Data display */}
      <div className="glass-panel" style={styles.tableCard}>
        <div style={styles.tableCardHeader}>
          <div>
            <h3 style={styles.reportTitle}>{getReportTitle()}</h3>
            <p style={styles.reportSubtitle}>{getReportDescription()}</p>
          </div>
        </div>

        {loading ? (
          <div style={styles.loadingContainer}>
            <RefreshCw size={30} className="spin-loader" color="var(--primary)" />
            <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Generating report data...</p>
          </div>
        ) : !reportData ? (
          <div style={styles.emptyContainer}>
            <FileText size={40} color="var(--text-muted)" />
            <h4 style={{ marginTop: '1rem', color: 'var(--text-primary)' }}>No Report Data Fetched</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Click 'Fetch Data' above to render reports from the database.</p>
          </div>
        ) : (
          <div style={{ width: '100%' }}>
            {activeReportTab === 'smart-dashboard' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', padding: '0.5rem 0' }}>
                {/* 1. Low Stock Warning Box */}
                {reportData.lowStockAlerts && reportData.lowStockAlerts.length > 0 && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fca5a5', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>
                      <AlertCircle size={18} /> Critical Low Stock Warnings
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.1rem' }}>
                      {reportData.lowStockAlerts.map((item, idx) => (
                        <div key={idx} style={{
                          background: 'rgba(239,68,68,0.15)',
                          color: '#fca5a5',
                          border: '1px solid rgba(239,68,68,0.25)',
                          padding: '0.35rem 0.8rem',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}>
                          <strong>{item.type}:</strong> {item.item} ({item.qty} {item.unit} left)
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Timeline Flow & Urgent Delayed Cards Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                  {/* Timeline Flow */}
                  <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Clock size={16} color="var(--primary)" /> Production Stage Timeline (Avg Duration)
                    </h4>
                    {(() => {
                      const bottleneck = reportData.bottleneck || {};
                      const stages = [
                        { label: 'Printing Phase', hrs: bottleneck.avgPrintHrs || 0, color: '#38bdf8' },
                        { label: 'Fusing Phase', hrs: bottleneck.avgFusingHrs || 0, color: '#a78bfa' },
                        { label: 'Delivery Phase', hrs: bottleneck.avgDeliveryHrs || 0, color: '#34d399' }
                      ];
                      const longest = [...stages].sort((a,b) => b.hrs - a.hrs)[0] || {};
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {stages.map((stg, i) => (
                              <div key={i} style={{ flex: 1, minWidth: '90px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '0.6rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{stg.label}</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: stg.color, marginTop: '0.2rem' }}>{stg.hrs} <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>Hrs</span></div>
                              </div>
                            ))}
                          </div>
                          {longest.hrs > 0 && (
                            <div style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', fontSize: '0.75rem', color: '#fba524', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span>⚡ <strong>Bottleneck:</strong> Production spends the longest in <strong>{longest.label}</strong> (avg {longest.hrs} hours).</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Urgent Delayed Cards */}
                  <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AlertCircle size={16} color="#fca5a5" /> Urgent Bottlenecks (Stuck &gt; 7 Days)
                    </h4>
                    <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {(!reportData.delayedCards || reportData.delayedCards.length === 0) ? (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem 0' }}>
                          ✓ No delayed job cards currently. All operations running smoothly!
                        </div>
                      ) : (
                        reportData.delayedCards.map((c, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '0.45rem 0.6rem', fontSize: '0.75rem' }}>
                            <div>
                              <strong style={{ color: 'var(--text-primary)' }}>{c.jobNo}</strong>
                              <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{c.party} ({c.designName})</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Created: {c.date}</span>
                              <span style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 }}>
                                {c.status}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Analytics Charts Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                  {/* Top Designs Chart */}
                  <div className="glass-panel" style={{ padding: '1.25rem' }}>
                    <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>🏆 Top 5 Printed Designs</h4>
                    {(!reportData.topDesigns || reportData.topDesigns.length === 0) ? (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No print data logged.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {reportData.topDesigns.map((d, idx) => {
                          const maxVal = reportData.topDesigns[0]?.totalMtr || 1;
                          const widthPct = Math.max(10, Math.round((d.totalMtr / maxVal) * 100));
                          return (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 600 }}>
                                <span style={{ color: 'var(--text-primary)' }}>{d._id}</span>
                                <span style={{ color: 'var(--primary)' }}>{d.totalMtr.toFixed(1)} mtr ({d.count} jobs)</span>
                              </div>
                              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${widthPct}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8, #8b5cf6)', borderRadius: '4px' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Busiest Parties Chart */}
                  <div className="glass-panel" style={{ padding: '1.25rem' }}>
                    <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>🏢 Busiest Parties</h4>
                    {(!reportData.busiestParties || reportData.busiestParties.length === 0) ? (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No party data logged.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {reportData.busiestParties.map((p, idx) => {
                          const maxVal = reportData.busiestParties[0]?.totalMtr || 1;
                          const widthPct = Math.max(10, Math.round((p.totalMtr / maxVal) * 100));
                          return (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 600 }}>
                                <span style={{ color: 'var(--text-primary)' }}>{p._id}</span>
                                <span style={{ color: 'var(--success)' }}>{p.totalMtr.toFixed(1)} mtr ({p.count} jobs)</span>
                              </div>
                              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${widthPct}%`, height: '100%', background: 'linear-gradient(90deg, #34d399, #059669)', borderRadius: '4px' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Fabric Trends Chart */}
                  <div className="glass-panel" style={{ padding: '1.25rem' }}>
                    <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>👗 Fabric Meterage breakdown</h4>
                    {(!reportData.fabricTrends || reportData.fabricTrends.length === 0) ? (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No fabric data logged.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {reportData.fabricTrends.slice(0, 5).map((f, idx) => {
                          const maxVal = reportData.fabricTrends[0]?.totalMtr || 1;
                          const widthPct = Math.max(10, Math.round((f.totalMtr / maxVal) * 100));
                          return (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 600 }}>
                                <span style={{ color: 'var(--text-primary)' }}>{f._id}</span>
                                <span style={{ color: 'var(--warning)' }}>{f.totalMtr.toFixed(1)} mtr</span>
                              </div>
                              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${widthPct}%`, height: '100%', background: 'linear-gradient(90deg, #f59e0b, #d97706)', borderRadius: '4px' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Fabric Demand Forecasting Table */}
                <div className="glass-panel" style={{ padding: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <TrendingUp size={16} color="var(--primary)" /> Fabric Demand Forecasting (Next 7 & 30 Days)
                  </h4>
                  <div className="table-container" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                          <th style={{ padding: '0.6rem 0.5rem', color: 'var(--text-muted)', fontWeight: 700 }}>Fabric Quality</th>
                          <th style={{ padding: '0.6rem 0.5rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>Current Stock</th>
                          <th style={{ padding: '0.6rem 0.5rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>7-Day Forecasted Demand</th>
                          <th style={{ padding: '0.6rem 0.5rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>30-Day Forecasted Demand</th>
                          <th style={{ padding: '0.6rem 0.5rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center' }}>Safety Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!reportData.fabricForecasts || reportData.fabricForecasts.length === 0) ? (
                          <tr>
                            <td colSpan="5" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              No fabric forecasting data available.
                            </td>
                          </tr>
                        ) : (
                          reportData.fabricForecasts.map((forecast, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                              <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>{forecast.fabricQuality}</td>
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 700 }}>{forecast.currentStock} mtr</td>
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: 'var(--primary)' }}>{forecast.demand7Days} mtr</td>
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: 'var(--text-light)' }}>{forecast.demand30Days} mtr</td>
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                                <span style={{
                                  background: forecast.status === 'Safe' ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)',
                                  color: forecast.status === 'Safe' ? '#34d399' : '#f87171',
                                  padding: '0.15rem 0.55rem',
                                  borderRadius: '999px',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase'
                                }}>
                                  {forecast.status}
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

            {activeReportTab !== 'smart-dashboard' && (
              <div className="table-container" style={styles.tableWrap}>
                {activeReportTab === 'creative-output' && (
              <table>
                <thead>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Designer Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Total Designs Produced</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.designerCreativeOutput?.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '0.75rem' }}>{item._id || 'Unknown Designer'}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            
            {activeReportTab === 'color-matching' && (
              <table>
                <thead>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Designer Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Total Color Variations</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.colorMatchingEfficiency?.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '0.75rem' }}>{item._id || 'Unknown Designer'}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeReportTab === 'machine-speed' && (
              <table>
                <thead>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Machine Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Speed Profile</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Passes</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Total Meters Printed</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.machineMeterage?.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '0.75rem' }}>{item._id?.machineName || 'N/A'}</td>
                      <td style={{ padding: '0.75rem' }}>{item._id?.speed || 'N/A'}</td>
                      <td style={{ padding: '0.75rem' }}>{item._id?.pass || 'N/A'}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>{item.totalMtr?.toFixed(2)} Mtr</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeReportTab === 'fabric-variance' && (
              <table>
                <thead>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Job Number</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Theoretical Consumption</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Actual Printed Meters</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Variance (Meters)</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.fabricConsumptionVariance?.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{item.jobNo}</td>
                      <td style={{ padding: '0.75rem' }}>{item.theoreticalMtr?.toFixed(2)} Mtr</td>
                      <td style={{ padding: '0.75rem' }}>{item.actualMtr?.toFixed(2)} Mtr</td>
                      <td style={{ padding: '0.75rem', color: item.variance > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                        {item.variance > 0 ? `+${item.variance.toFixed(2)} (Waste)` : `${item.variance.toFixed(2)} (Saved)`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeReportTab === 'fusing-throughput' && (
              <table>
                <thead>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Fusing Date</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Completed Jobs</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Total Fusing Meters</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.fusingThroughput?.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '0.75rem' }}>{item._id}</td>
                      <td style={{ padding: '0.75rem' }}>{item.completedCount}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>{item.totalFusingMtr?.toFixed(2)} Mtr</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeReportTab === 'deadline-adherence' && (
              <table>
                <thead>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Job Status</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Total Jobs</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Avg Expected Delivery Time (Hours)</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.deadlineAdherence?.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '0.75rem' }}>{item._id}</td>
                      <td style={{ padding: '0.75rem' }}>{item.totalJobs}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>{item.avgExpectedTime?.toFixed(1)} hrs</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeReportTab === 'stock-value' && (
              <table>
                <thead>
                  <tr>
                    <th>Photo</th>
                    <th>SKU Code</th>
                    <th>Product Name</th>
                    <th>Vendor</th>
                    <th className="text-center">Sizes & Quantities</th>
                    <th className="text-center">Total Stock</th>
                    <th className="text-right">Purchase Price (Unit)</th>
                    <th className="text-right">Purchase Value (Total)</th>
                    <th className="text-right">Sale Price (Unit)</th>
                    <th className="text-right">Sale Value (Total)</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.items?.map((item, idx) => (
                    <tr key={item.sku || idx}>
                      <td>
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.sku} style={styles.productImg} onError={(e) => { e.target.style.display = 'none'; }} />
                        ) : (
                          <div style={styles.noPhoto}>N/A</div>
                        )}
                      </td>
                      <td style={styles.skuCode}>{item.sku}</td>
                      <td>{item.itemName}</td>
                      <td>{item.party}</td>
                      <td className="text-center">
                        <div style={styles.sizesGrid}>
                          {item.sizes?.map(s => (
                            <span key={s.size} style={styles.sizeTag}>{s.size}: {s.qty}</span>
                          ))}
                        </div>
                      </td>
                      <td className="text-center" style={{ fontWeight: 'bold' }}>{item.total}</td>
                      <td className="text-right">{formatPrice(item.purchasePrice)}</td>
                      <td className="text-right" style={{ color: 'var(--text-muted)' }}>{formatPrice(item.totalPurchaseAmount)}</td>
                      <td className="text-right" style={{ color: 'var(--primary)', fontWeight: '500' }}>{formatPrice(item.salePrice)}</td>
                      <td className="text-right" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{formatPrice(item.totalSellableAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeReportTab === 'stock-inward' && (
              <table>
                <thead>
                  <tr>
                    <th>Photo</th>
                    <th>SKU Code</th>
                    <th>Product Name</th>
                    <th>Vendor</th>
                    <th className="text-center">Sizes & Quantities</th>
                    <th className="text-center">Total Qty</th>
                    <th className="text-right">Purchase Price (Unit)</th>
                    <th className="text-right">Purchase Value (Total)</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.items?.map((item, idx) => (
                    <tr key={item.sku || idx}>
                      <td>
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.sku} style={styles.productImg} onError={(e) => { e.target.style.display = 'none'; }} />
                        ) : (
                          <div style={styles.noPhoto}>N/A</div>
                        )}
                      </td>
                      <td style={styles.skuCode}>{item.sku}</td>
                      <td>{item.itemName}</td>
                      <td>{item.party}</td>
                      <td className="text-center">
                        <div style={styles.sizesGrid}>
                          {item.sizes?.map(s => (
                            <span key={s.size} style={styles.sizeTag}>{s.size}: {s.qty}</span>
                          ))}
                        </div>
                      </td>
                      <td className="text-center" style={{ fontWeight: 'bold' }}>{item.total}</td>
                      <td className="text-right">{formatPrice(item.purchasePrice)}</td>
                      <td className="text-right" style={{ color: 'var(--warning)', fontWeight: 'bold' }}>{formatPrice(item.totalPurchaseAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeReportTab === 'stock-outward' && (
              <table>
                <thead>
                  <tr>
                    <th>Photo</th>
                    <th>SKU Code</th>
                    <th>Product Name</th>
                    <th>Vendor</th>
                    <th className="text-center">Sizes & Quantities</th>
                    <th className="text-center">Total Qty</th>
                    <th className="text-right">Purchase Price (Unit)</th>
                    <th className="text-right">Purchase Value (Total)</th>
                    <th className="text-right">Sale Price (Unit)</th>
                    <th className="text-right">Sale Value (Total)</th>
                    <th className="text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.items?.map((item, idx) => {
                    const profit = item.totalSellableAmount - item.totalPurchaseAmount;
                    return (
                      <tr key={item.sku || idx}>
                        <td>
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.sku} style={styles.productImg} onError={(e) => { e.target.style.display = 'none'; }} />
                          ) : (
                            <div style={styles.noPhoto}>N/A</div>
                          )}
                        </td>
                        <td style={styles.skuCode}>{item.sku}</td>
                        <td>{item.itemName}</td>
                        <td>{item.party}</td>
                        <td className="text-center">
                          <div style={styles.sizesGrid}>
                            {item.sizes?.map(s => (
                              <span key={s.size} style={styles.sizeTag}>{s.size}: {s.qty}</span>
                            ))}
                          </div>
                        </td>
                        <td className="text-center" style={{ fontWeight: 'bold' }}>{item.total}</td>
                        <td className="text-right">{formatPrice(item.purchasePrice)}</td>
                        <td className="text-right" style={{ color: 'var(--text-muted)' }}>{formatPrice(item.totalPurchaseAmount)}</td>
                        <td className="text-right" style={{ color: 'var(--primary)' }}>{formatPrice(item.salePrice)}</td>
                        <td className="text-right" style={{ color: 'var(--primary)' }}>{formatPrice(item.totalSellableAmount)}</td>
                        <td className="text-right" style={{ color: profit >= 0 ? '#34d399' : '#f87171', fontWeight: 'bold' }}>
                          {formatPrice(profit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {activeReportTab === 'sales' && (
              <table>
                <thead>
                  <tr>
                    <th>Photo</th>
                    <th>SKU Code</th>
                    <th>Product Name</th>
                    <th>Brand</th>
                    <th className="text-center">Total Orders</th>
                    <th className="text-right">Avg Order Price</th>
                    <th className="text-right">Total Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(reportData) && reportData.map((row, idx) => (
                    <tr key={row.itemSKUCode || idx}>
                      <td>
                        {row.productImage ? (
                          <img src={row.productImage} alt={row.itemSKUCode} style={styles.productImg} onError={(e) => { e.target.style.display = 'none'; }} />
                        ) : (
                          <div style={styles.noPhoto}>N/A</div>
                        )}
                      </td>
                      <td style={styles.skuCode}>{row.itemSKUCode || row.skuName}</td>
                      <td>{row.skuName || '-'}</td>
                      <td>{row.itemTypeBrand || '-'}</td>
                      <td className="text-center" style={{ fontWeight: 'bold' }}>{row.salesCount}</td>
                      <td className="text-right">
                        {formatPrice(row.salesCount > 0 ? (row.sellableAmount / row.salesCount) : 0)}
                      </td>
                      <td className="text-right" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                        {formatPrice(row.sellableAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeReportTab === 'brand' && (
              <div style={styles.brandContainer}>
                {reportData.brands?.map((brand) => (
                  <div key={brand.brand} style={styles.brandSection}>
                    <div style={styles.brandHeader}>
                      <div style={styles.brandTitleText}>{brand.brand || 'Unknown Brand'}</div>
                      <div style={styles.brandMeta}>
                        <span>Orders: <strong>{brand.totalOrderQuantity}</strong></span>
                        <span style={styles.metaDivider}>|</span>
                        <span>Revenue: <strong>{formatPrice(brand.totalSellableAmount)}</strong></span>
                      </div>
                    </div>
                    
                    <table style={styles.nestedTable}>
                      <thead>
                        <tr>
                          <th>Photo</th>
                          <th>SKU Code</th>
                          <th>Sizes Sold (Qty)</th>
                          <th className="text-center">Total Qty</th>
                          <th className="text-right">Avg Price</th>
                          <th className="text-right">Total Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {brand.products?.map((prod, idx) => (
                          <tr key={prod.sku || idx}>
                            <td>
                              {prod.imageUrl ? (
                                <img src={prod.imageUrl} alt={prod.sku} style={styles.productImg} onError={(e) => { e.target.style.display = 'none'; }} />
                              ) : (
                                <div style={styles.noPhoto}>N/A</div>
                              )}
                            </td>
                            <td style={styles.skuCode}>{prod.sku}</td>
                            <td>
                              <div style={styles.sizesGrid}>
                                {prod.variations?.map(v => (
                                  <span key={v.size} style={styles.sizeTag}>{v.size}: {v.quantity}</span>
                                ))}
                              </div>
                            </td>
                            <td className="text-center" style={{ fontWeight: 'bold' }}>{prod.total}</td>
                            <td className="text-right">
                              {formatPrice(prod.total > 0 ? (prod.sellableAmount / prod.total) : 0)}
                            </td>
                            <td className="text-right" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                              {formatPrice(prod.sellableAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}

            {activeReportTab === 'returns-analysis' && reportData && (() => {
              const activeData = returnsSubTab === 'physical' ? reportData.physicalReport : reportData.pickupReport;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
                  
                  {/* Returns Type Sub-Selector Toggle */}
                  <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.02)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-light)', width: 'fit-content' }}>
                    <button 
                      onClick={() => setReturnsSubTab('pickup')} 
                      style={{
                        padding: '0.5rem 1rem', 
                        borderRadius: '6px', 
                        border: 'none', 
                        fontSize: '0.8rem', 
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: returnsSubTab === 'pickup' ? 'var(--primary)' : 'transparent',
                        color: returnsSubTab === 'pickup' ? '#000' : 'var(--text-muted)',
                        transition: 'all 0.2s'
                      }}
                    >
                      Reverse Pickup Date
                    </button>
                    <button 
                      onClick={() => setReturnsSubTab('physical')} 
                      style={{
                        padding: '0.5rem 1rem', 
                        borderRadius: '6px', 
                        border: 'none', 
                        fontSize: '0.8rem', 
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: returnsSubTab === 'physical' ? 'var(--primary)' : 'transparent',
                        color: returnsSubTab === 'physical' ? '#000' : 'var(--text-muted)',
                        transition: 'all 0.2s'
                      }}
                    >
                      Physical Return Date
                    </button>
                  </div>

                  <div style={styles.brandContainer}>
                    {activeData?.brands?.map((brand) => (
                      <div key={brand.brand} style={styles.brandSection}>
                        <div style={styles.brandHeader}>
                          <div style={styles.brandTitleText}>{brand.brand || 'Unknown Brand'}</div>
                          <div style={styles.brandMeta}>
                            <span>Returned Qty: <strong>{brand.totalOrderQuantity}</strong></span>
                            <span style={styles.metaDivider}>|</span>
                            <span>Return Valuation: <strong>{formatPrice(brand.totalSellableAmount)}</strong></span>
                          </div>
                        </div>
                        
                        <table style={styles.nestedTable}>
                          <thead>
                            <tr>
                              <th>Photo</th>
                              <th>SKU Code</th>
                              <th>Sizes Returned (Qty)</th>
                              <th className="text-center">Total Qty</th>
                              <th className="text-right">Avg Price</th>
                              <th className="text-right">Total Valuation</th>
                            </tr>
                          </thead>
                          <tbody>
                            {brand.products?.map((prod, idx) => (
                              <tr key={prod.sku || idx}>
                                <td>
                                  {prod.imageUrl ? (
                                    <img src={prod.imageUrl} alt={prod.sku} style={styles.productImg} onError={(e) => { e.target.style.display = 'none'; }} />
                                  ) : (
                                    <div style={styles.noPhoto}>N/A</div>
                                  )}
                                </td>
                                <td style={styles.skuCode}>{prod.sku}</td>
                                <td>
                                  <div style={styles.sizesGrid}>
                                    {prod.variations?.map(v => (
                                      <span key={v.size} style={styles.sizeTag}>{v.size}: {v.quantity}</span>
                                    ))}
                                  </div>
                                </td>
                                <td className="text-center" style={{ fontWeight: 'bold' }}>{prod.total}</td>
                                <td className="text-right">
                                  {formatPrice(prod.total > 0 ? (prod.sellableAmount / prod.total) : 0)}
                                </td>
                                <td className="text-right" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                                  {formatPrice(prod.sellableAmount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {activeReportTab === 'brand-hourly' && reportData && (() => {
              const hourlyDetails = reportData.hourlyDetails || [];
              const maxQty = Math.max(...(reportData.hourlyTotals?.map(h => h.quantity) || [1]), 1);

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
                  
                  {/* CSS injection for mobile devices */}
                  <style dangerouslySetInnerHTML={{ __html: `
                    @media (max-width: 680px) {
                      .mobile-hide-density {
                        display: none !important;
                      }
                      .mobile-peak-banner {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                        gap: 1.2rem !important;
                        padding: 1rem !important;
                      }
                      .mobile-peak-info {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                        gap: 0.8rem !important;
                        width: 100% !important;
                      }
                      .mobile-peak-divider {
                        display: none !important;
                      }
                      .mobile-table-wrap {
                        overflow-x: auto !important;
                        display: block !important;
                        width: 100% !important;
                        -webkit-overflow-scrolling: touch;
                      }
                      .mobile-accordion-row {
                        padding: 0.6rem 0.75rem !important;
                        gap: 0.5rem !important;
                      }
                      .mobile-accordion-row span {
                        font-size: 0.72rem !important;
                      }
                      .mobile-accordion-row .qty-col {
                        min-width: 45px !important;
                      }
                      .mobile-accordion-row .rev-col {
                        min-width: 85px !important;
                      }
                      .mobile-grid-summary {
                        grid-template-columns: 1fr 1fr !important;
                        gap: 0.75rem !important;
                      }
                      .mobile-summary-card {
                        padding: 0.85rem 1rem !important;
                      }
                      .mobile-summary-card span {
                        font-size: 0.68rem !important;
                      }
                      .mobile-summary-card strong {
                        font-size: 1.05rem !important;
                      }
                    }
                  ` }} />

                  {/* ── Peak Activity Banner (prominent top highlight) ── */}
                  {(() => {
                    const peak = [...(reportData.hourlyTotals || [])].sort((a,b) => b.quantity - a.quantity)[0];
                    if (!peak || peak.quantity === 0) return null;

                    // Find top brand in this peak hour from hourlyDetails
                    const peakHourDetail = (reportData.hourlyDetails || []).find(h => h.hour === peak.hour);
                    const topBrand = peakHourDetail
                      ? [...(peakHourDetail.brands || [])].sort((a,b) => b.totalQuantity - a.totalQuantity)[0]
                      : null;

                    // Second busiest hour
                    const sorted = [...(reportData.hourlyTotals || [])].filter(h => h.quantity > 0).sort((a,b) => b.quantity - a.quantity);
                    const secondPeak = sorted[1];

                    return (
                      <div style={{
                        background: 'linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(16,185,129,0.14) 100%)',
                        border: '1px solid rgba(59,130,246,0.35)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1.4rem 1.6rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.9rem'
                      }}>

                        {/* Header row */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'rgba(59,130,246,0.15)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                              🏆 Peak Activity Window
                            </span>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Based on {reportData.reportDate}
                          </span>
                        </div>

                        {/* Main peak info */}
                        <div className="mobile-peak-info" style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5rem', flexWrap: 'wrap' }}>
                          {/* Time period — big */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>TIME PERIOD</span>
                            <span style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.02em' }}>{peak.hourLabel}</span>
                          </div>

                          {/* Divider */}
                          <div className="mobile-peak-divider" style={{ width: '1px', height: '48px', background: 'rgba(255,255,255,0.1)' }} />

                          {/* Orders */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>ORDERS</span>
                            <span style={{ fontSize: '2rem', fontWeight: 900, color: '#34d399', lineHeight: 1 }}>{peak.quantity.toLocaleString('en-IN')}<span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '0.3rem' }}>pcs</span></span>
                          </div>

                          {/* Revenue */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>REVENUE</span>
                            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>{formatPrice(peak.sellableAmount)}</span>
                          </div>

                          {/* Top brand in that hour */}
                          {topBrand && (
                            <>
                              <div className="mobile-peak-divider" style={{ width: '1px', height: '48px', background: 'rgba(255,255,255,0.1)' }} />
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOP BRAND</span>
                                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fbbf24', lineHeight: 1 }}>{topBrand.brand}</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{topBrand.totalQuantity} pcs · {formatPrice(topBrand.totalSellableAmount)}</span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Mini hourly sparkline */}
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '28px', marginTop: '0.2rem' }}>
                          {(reportData.hourlyTotals || []).map(h => {
                            const ht = Math.max(...(reportData.hourlyTotals.map(x => x.quantity)), 1);
                            const barH = Math.max(2, Math.round((h.quantity / ht) * 28));
                            const isPeak = h.hour === peak.hour;
                            return (
                              <div key={h.hour} title={`${h.hourLabel}: ${h.quantity} pcs`} style={{ flex: 1, height: `${barH}px`, background: isPeak ? '#34d399' : h.quantity > 0 ? 'rgba(99,179,237,0.45)' : 'rgba(255,255,255,0.05)', borderRadius: '2px 2px 0 0', transition: 'height 0.3s ease', minWidth: '4px' }} />
                            );
                          })}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                          <span>00:00</span>
                          <span style={{ color: '#34d399', fontWeight: 700 }}>▲ {peak.hourLabel.split(' - ')[0]} peak</span>
                          {secondPeak && <span>2nd: {secondPeak.hourLabel.split(' - ')[0]} ({secondPeak.quantity} pcs)</span>}
                          <span>23:00</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Summary Banner ────────────────────────────────── */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    {[
                      { label: 'Total Order Qty', value: (reportData.totalOrderQuantity || 0).toLocaleString('en-IN'), color: 'var(--text-primary)' },
                      { label: 'Total Revenue',   value: formatPrice(reportData.totalSellableAmount || 0),              color: 'var(--primary)' },
                      {
                        label: 'Peak Hour', color: '#34d399',
                        value: (() => {
                          const peak = [...(reportData.hourlyTotals || [])].sort((a,b) => b.quantity - a.quantity)[0];
                          return peak && peak.quantity > 0 ? `${peak.hourLabel.split(' - ')[0]}  (${peak.quantity} pcs)` : '—';
                        })()
                      },
                      {
                        label: 'Quiet Hour', color: '#fbbf24',
                        value: (() => {
                          const nz = (reportData.hourlyTotals || []).filter(h => h.quantity > 0);
                          if (!nz.length) return '—';
                          const low = [...nz].sort((a,b) => a.quantity - b.quantity)[0];
                          return `${low.hourLabel.split(' - ')[0]}  (${low.quantity} pcs)`;
                        })()
                      },
                    ].map(card => (
                      <div key={card.label} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</span>
                        <span style={{ fontSize: '1.3rem', fontWeight: 800, color: card.color }}>{card.value}</span>
                      </div>
                    ))}
                  </div>


                  {/* ── Hour Accordion List ───────────────────────────── */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {hourlyDetails.map((hourSlot) => {
                      const pct = maxQty > 0 ? (hourSlot.totalQuantity / maxQty) * 100 : 0;
                      const isOpen = expandedHour === hourSlot.hour;
                      const hasData = hourSlot.brands && hourSlot.brands.length > 0;

                      return (
                        <div key={hourSlot.hour} style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: isOpen ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)' }}>

                          {/* Hour header row — clickable */}
                          <div
                            onClick={() => hasData && setExpandedHour(isOpen ? null : hourSlot.hour)}
                            className="mobile-accordion-row"
                            style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1.1rem', cursor: hasData ? 'pointer' : 'default', userSelect: 'none' }}
                          >
                            {/* Hour label */}
                            <span style={{ minWidth: '115px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{hourSlot.hourLabel}</span>

                            {/* Density bar */}
                            <div className="mobile-hide-density" style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: pct > 70 ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : pct > 35 ? 'linear-gradient(90deg,var(--primary),#10b981)' : 'linear-gradient(90deg,#64748b,#94a3b8)', borderRadius: '4px', transition: 'width 0.35s ease' }} />
                            </div>

                            {/* Qty */}
                            <span className="qty-col" style={{ minWidth: '60px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: hourSlot.totalQuantity > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{hourSlot.totalQuantity > 0 ? `${hourSlot.totalQuantity} pcs` : '—'}</span>

                            {/* Revenue */}
                            <span className="rev-col" style={{ minWidth: '100px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: hourSlot.totalSellableAmount > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>{hourSlot.totalSellableAmount > 0 ? formatPrice(hourSlot.totalSellableAmount) : '—'}</span>

                            {/* Expand icon */}
                            {hasData && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>▼</span>
                            )}
                          </div>

                          {/* Expanded brand→product table */}
                          {isOpen && hasData && (
                            <div style={{ borderTop: '1px solid var(--border-light)', padding: '1rem' }}>
                              {hourSlot.brands.map((brand) => (
                                <div key={brand.brand} style={{ marginBottom: '1.2rem' }}>

                                  {/* Brand sub-header */}
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#93c5fd' }}>{brand.brand || 'Unknown'}</span>
                                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                      <span>Orders: <strong style={{ color: 'var(--text-primary)' }}>{brand.totalQuantity}</strong></span>
                                      <span>Revenue: <strong style={{ color: 'var(--primary)' }}>{formatPrice(brand.totalSellableAmount)}</strong></span>
                                    </div>
                                  </div>

                                  {/* Product table */}
                                  <div className="mobile-table-wrap">
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', minWidth: '540px' }}>
                                      <thead>
                                        <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                                          <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left',   color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-light)', width: '48px' }}>Photo</th>
                                          <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left',   color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-light)' }}>SKU</th>
                                          <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left',   color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-light)' }}>Sizes & Qty</th>
                                          <th style={{ padding: '0.45rem 0.6rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-light)' }}>Total Orders</th>
                                          <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right',  color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-light)' }}>Avg Price</th>
                                          <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right',  color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-light)' }}>Revenue</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(brand.products || []).map((prod, pi) => (
                                          <tr key={prod.sku || pi} style={{ background: pi % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>

                                            {/* Photo */}
                                            <td style={{ padding: '0.5rem 0.6rem' }}>
                                              {prod.imageUrl ? (
                                                <img src={prod.imageUrl.startsWith('http') ? prod.imageUrl : `http://3.7.174.180:3001${prod.imageUrl}`}
                                                     alt={prod.sku}
                                                     style={{ width: 38, height: 38, objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-light)' }}
                                                     onError={e => { e.target.style.display='none'; }} />
                                              ) : (
                                                <div style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.04)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', color: 'var(--text-muted)' }}>N/A</div>
                                              )}
                                            </td>

                                            {/* SKU */}
                                            <td style={{ padding: '0.5rem 0.6rem', fontWeight: 700, color: '#93c5fd' }}>{prod.sku || '—'}</td>

                                            {/* Sizes */}
                                            <td style={{ padding: '0.5rem 0.6rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                              {(prod.variations || []).map(v => (
                                                <span key={v.size} style={{ display: 'inline-block', marginRight: '0.35rem', padding: '0.1rem 0.4rem', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', fontSize: '0.72rem' }}>
                                                  {v.size}: <strong style={{ color: 'var(--text-primary)' }}>{v.quantity}</strong>
                                                </span>
                                              ))}
                                            </td>

                                            {/* Total Orders */}
                                            <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center', fontWeight: 800, color: 'var(--text-primary)' }}>{prod.total}</td>

                                            {/* Avg Price */}
                                            <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', color: 'var(--text-muted)' }}>{formatPrice(prod.averagePrice || 0)}</td>

                                            {/* Revenue */}
                                            <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{formatPrice(prod.sellableAmount)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                </div>
              );
            })()}
              </div>
            )}
          </div>
        )}
      {/* Share Report Modal */}
      {showShareModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--bg-panel, #111827)',
            border: '1px solid var(--border-light, rgba(255,255,255,0.08))',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '480px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
            color: 'var(--text-primary, #f3f4f6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>Share Report to Chat</h3>
              <button 
                onClick={() => { setShowShareModal(false); setSelectedRoomId(''); setShareSearch(''); }} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #9ca3af)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleShareReport}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary, #d1d5db)' }}>Search Channel or Member</label>
                <input 
                  type="text" 
                  value={shareSearch} 
                  onChange={e => setShareSearch(e.target.value)} 
                  placeholder="Type name to search..." 
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light, rgba(255,255,255,0.08))',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary, #d1d5db)' }}>Select Chat Destination</label>
                <div style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-light, rgba(255,255,255,0.08))',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: 'rgba(255,255,255,0.01)'
                }}>
                  {chatRooms
                    .filter(r => {
                      if (!shareSearch) return true;
                      const roomName = r.type === 'direct' 
                        ? (r.members?.find(m => (m._id || m) !== api.getCurrentUser()?._id)?.name || r.name || '')
                        : (r.name || '');
                      return roomName.toLowerCase().includes(shareSearch.toLowerCase());
                    })
                    .map(r => {
                      const isDirect = r.type === 'direct';
                      const displayName = isDirect 
                        ? (r.members?.find(m => (m._id || m) !== api.getCurrentUser()?._id)?.name || r.name || 'Direct Message')
                        : `# ${r.name}`;
                      const isSelected = selectedRoomId === r._id;
                      
                      return (
                        <div 
                          key={r._id} 
                          onClick={() => setSelectedRoomId(r._id)}
                          style={{
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            transition: 'background-color 0.2s',
                          }}
                        >
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: isDirect ? 'var(--success, #10b981)' : 'var(--primary, #3b82f6)'
                          }} />
                          <span style={{ fontSize: '0.9rem', fontWeight: isSelected ? '600' : 'normal', color: isSelected ? 'var(--primary)' : 'var(--text-primary)' }}>{displayName}</span>
                        </div>
                      );
                    })}
                  {chatRooms.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No active channels or messages found.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => { setShowShareModal(false); setSelectedRoomId(''); setShareSearch(''); }} 
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light, rgba(255,255,255,0.08))',
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={sharingReport || !selectedRoomId}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: selectedRoomId ? 'var(--primary, #3b82f6)' : 'var(--border-light, #374151)',
                    color: '#000',
                    cursor: selectedRoomId ? 'pointer' : 'not-allowed',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {sharingReport ? 'Sharing...' : 'Confirm Share'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
  },
  tabActive: {
    background: 'rgba(6, 182, 212, 0.1)',
    border: '1px solid rgba(6, 182, 212, 0.2)',
    color: 'var(--text-primary)',
    padding: '0.6rem 1.1rem',
    fontSize: '0.85rem',
    fontWeight: '600',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  subTab: {
    background: 'none',
    color: 'var(--text-muted)',
    padding: '0.4rem 0.8rem',
    fontSize: '0.8rem',
    fontWeight: '500',
    borderRadius: '16px',
    transition: 'all var(--transition-fast)',
    border: '1px solid transparent',
  },
  subTabActive: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)',
    padding: '0.4rem 0.8rem',
    fontSize: '0.8rem',
    fontWeight: '600',
    borderRadius: '16px',
  },
  filterCard: {
    padding: '1.25rem',
  },
  filterRow: {
    display: 'flex',
    gap: '1.2rem',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  filterItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    flex: '1 1 180px',
    maxWidth: '260px',
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    textTransform: 'uppercase',
  },
  input: {
    width: '100%',
    padding: '0.5rem 0.75rem',
    fontSize: '0.85rem',
  },
  actionsGroup: {
    display: 'flex',
    gap: '0.6rem',
    marginLeft: 'auto',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  actionBtn: {
    padding: '0.5rem 1rem',
    fontSize: '0.8rem',
  },
  errorContainer: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.75rem 1rem',
    color: '#fca5a5',
    fontSize: '0.8rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
  },
  summaryCard: {
    padding: '1rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  summaryValue: {
    fontSize: '1.2rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  summaryLabel: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  tableCard: {
    padding: '1.5rem',
  },
  tableCardHeader: {
    marginBottom: '1.25rem',
    borderBottom: '1px solid var(--border-light)',
    paddingBottom: '0.75rem',
  },
  reportTitle: {
    fontSize: '1.05rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  reportSubtitle: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
    lineHeight: '1.4',
  },
  tableWrap: {
    width: '100%',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 1rem',
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 1rem',
    textAlign: 'center',
  },
  productImg: {
    width: '32px',
    height: '32px',
    borderRadius: '4px',
    objectFit: 'cover',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-light)',
  },
  noPhoto: {
    width: '32px',
    height: '32px',
    borderRadius: '4px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-muted)',
    fontSize: '0.65rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skuCode: {
    fontFamily: 'monospace',
    fontWeight: '600',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
  },
  sizesGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.3rem',
    justifyContent: 'center',
  },
  sizeTag: {
    fontSize: '0.7rem',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-light)',
    padding: '0.1rem 0.35rem',
    borderRadius: '4px',
    color: '#d1d5db',
    whiteSpace: 'nowrap',
  },
  brandContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
    width: '100%',
  },
  brandSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    background: 'rgba(255, 255, 255, 0.01)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-md)',
    padding: '1.25rem',
  },
  brandHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-light)',
    paddingBottom: '0.5rem',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  brandTitleText: {
    fontSize: '1.05rem',
    fontWeight: '700',
    color: 'var(--primary)',
  },
  brandMeta: {
    display: 'flex',
    gap: '0.75rem',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    alignItems: 'center',
  },
  metaDivider: {
    color: 'rgba(255, 255, 255, 0.15)',
  },
  nestedTable: {
    width: '100%',
    borderCollapse: 'collapse',
  }
};
