import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, 
  PackageCheck, 
  Layers, 
  Truck, 
  RotateCcw, 
  Terminal, 
  Settings2, 
  Search, 
  Barcode, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Download, 
  FileText, 
  ChevronRight, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  Plus, 
  Sliders, 
  ArrowRight,
  ShieldCheck,
  Zap,
  Clock,
  Sparkles,
  Printer,
  Package,
  X
} from 'lucide-react';
import { api } from '../services/api';
import '../styles/myntraIntegration.css';

export default function MyntraIntegration() {
  const [activeTab, setActiveTab] = useState('fulfillment');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ type: '', message: '' });

  // Tab 1: Fulfillment State
  const [stageFilter, setStageFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [scanBarcode, setScanBarcode] = useState('');
  const [orders, setOrders] = useState([]);
  const [rtdModalOrder, setRtdModalOrder] = useState(null);
  const [invoiceTypeSelection, setInvoiceTypeSelection] = useState('MYNTRA');

  // Tab 2: Catalog State
  const [catalog, setCatalog] = useState([]);
  const [addSkuModal, setAddSkuModal] = useState(false);
  const [mapWhModal, setMapWhModal] = useState(false);
  const [discountModalItem, setDiscountModalItem] = useState(null);
  const [newSkuForm, setNewSkuForm] = useState({ skuCode: '', internalItem: '', barcode: '', price: 1999 });
  const [mapWhForm, setMapWhForm] = useState({ warehouseName: 'WH1', skuCodes: [] });
  const [discountForm, setDiscountForm] = useState({ discountPercent: 10, newPrice: 1799 });

  // Tab 3: Dispatch State
  const [shipments, setShipments] = useState([]);

  // Tab 4: Returns State
  const [returnTypeFilter, setReturnTypeFilter] = useState('COURIER_RTO');
  const [returnsList, setReturnsList] = useState([]);
  const [scannedReturnAwb, setScannedReturnAwb] = useState('');
  const [activeReturnDetail, setActiveReturnDetail] = useState(null);
  const [qcResultSelection, setQcResultSelection] = useState('RESTOCK');

  // Tab 5: Mockify Simulator State
  const [mockOrderSku, setMockOrderSku] = useState('ANOUK-AA22216_XXL');
  const [mockOrderWh, setMockOrderWh] = useState('WH1 - Central Hub');
  const [mockOrderQty, setMockOrderQty] = useState(1);
  const [cancelOrderId, setCancelOrderId] = useState('');
  const [holdOrderId, setHoldOrderId] = useState('');
  const [webhookEvents, setWebhookEvents] = useState([]);

  // Tab 6: Settings State
  const [envMode, setEnvMode] = useState('sandbox');
  const [merchantId, setMerchantId] = useState('ASAAESFA');
  const [secretKey, setSecretKey] = useState('');
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [partnerName, setPartnerName] = useState('elite_edition_retail');
  const [defaultWh, setDefaultWh] = useState('WH1');
  const [tokenHealth, setTokenHealth] = useState({ status: 'Active', hoursRemaining: '23h 48m', expiresAt: '' });
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Auto clear alert toasts
  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert({ type: '', message: '' }), 4000);
  };

  // Initial Data Fetch
  useEffect(() => {
    loadAllData();
  }, [activeTab]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [ordRes, cfgRes, catRes, shipRes, retRes, whEvents] = await Promise.allSettled([
        api.getMyntraOrders(),
        api.getMyntraConfig(),
        api.getMyntraCatalog(),
        api.getMyntraShipments(),
        api.getMyntraReturns(),
        api.getMyntraWebhookEvents()
      ]);

      if (ordRes.status === 'fulfilled' && ordRes.value) {
        setOrders(ordRes.value.orders || []);
      }
      if (cfgRes.status === 'fulfilled' && cfgRes.value) {
        const c = cfgRes.value;
        if (c.merchantId) setMerchantId(c.merchantId);
        if (c.rawSecretKey) setSecretKey(c.rawSecretKey);
        if (c.environment) setEnvMode(c.environment);
        if (c.partnerName) setPartnerName(c.partnerName);
        if (c.defaultWarehouse) setDefaultWh(c.defaultWarehouse);
        if (c.tokenHealth) setTokenHealth(c.tokenHealth);
      }
      if (catRes.status === 'fulfilled' && catRes.value) {
        setCatalog(catRes.value || []);
      }
      if (shipRes.status === 'fulfilled' && shipRes.value) {
        setShipments(shipRes.value || []);
      }
      if (retRes.status === 'fulfilled' && retRes.value) {
        setReturnsList(retRes.value || []);
      }
      if (whEvents.status === 'fulfilled' && whEvents.value) {
        setWebhookEvents(whEvents.value || []);
      }
    } catch (err) {
      console.error('Error loading Myntra data:', err);
    } finally {
      setLoading(false);
    }
  };

  // ==================== TAB 1 ACTIONS: ORDER FULFILLMENT ====================

  const pipelineCounts = useMemo(() => {
    return {
      unacknowledged: orders.filter(o => o.stage === 'UNACKNOWLEDGED').length,
      accepted: orders.filter(o => o.stage === 'ACCEPTED').length,
      rtd: orders.filter(o => o.stage === 'RTD').length,
      rts: orders.filter(o => o.stage === 'RTS').length,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchStage = stageFilter === 'ALL' || o.stage === stageFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || 
        o.orderId.toLowerCase().includes(q) ||
        o.packetId.toLowerCase().includes(q) ||
        o.sku.toLowerCase().includes(q) ||
        (o.pincode && o.pincode.includes(q)) ||
        (o.itemName && o.itemName.toLowerCase().includes(q));
      return matchStage && matchQuery;
    });
  }, [orders, stageFilter, searchQuery]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedOrders(filteredOrders.map(o => o.orderId));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleSelectRow = (orderId) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const handleAcceptSingle = async (orderId) => {
    try {
      setLoading(true);
      await api.acceptMyntraOrder(orderId);
      triggerAlert('success', `Order ${orderId} accepted successfully.`);
      loadAllData();
    } catch (err) {
      triggerAlert('error', err.message || 'Failed to accept order');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAccept = async () => {
    if (!selectedOrders.length) return;
    try {
      setLoading(true);
      await api.bulkAcceptMyntraOrders(selectedOrders);
      triggerAlert('success', `Accepted ${selectedOrders.length} orders in bulk.`);
      setSelectedOrders([]);
      loadAllData();
    } catch (err) {
      triggerAlert('error', err.message || 'Failed to bulk accept orders');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteRtd = async () => {
    if (!rtdModalOrder) return;
    try {
      setLoading(true);
      await api.readyToDispatchMyntra({
        orderId: rtdModalOrder.orderId,
        packetId: rtdModalOrder.packetId,
        invoiceType: invoiceTypeSelection
      });
      triggerAlert('success', `Packet ${rtdModalOrder.packetId} marked Ready To Dispatch (RTD)!`);
      setRtdModalOrder(null);
      loadAllData();
    } catch (err) {
      triggerAlert('error', err.message || 'Failed to mark RTD');
    } finally {
      setLoading(false);
    }
  };

  const handleScanRts = async (e) => {
    if (e) e.preventDefault();
    if (!scanBarcode.trim()) return;
    try {
      setLoading(true);
      const res = await api.readyToShipMyntra(scanBarcode.trim());
      triggerAlert('success', res.message || `Packet ${scanBarcode} verified and marked Ready To Ship (RTS)!`);
      setScanBarcode('');
      loadAllData();
    } catch (err) {
      triggerAlert('error', err.message || `No active packet found for barcode: ${scanBarcode}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadLabel = (packetId) => {
    const url = api.getMyntraShippingLabelUrl(packetId);
    window.open(url, '_blank', 'width=540,height=680');
  };

  const handleDownloadInvoice = (packetId) => {
    const url = api.getMyntraInvoiceUrl(packetId);
    window.open(url, '_blank', 'width=720,height=800');
  };

  // ==================== TAB 2 ACTIONS: CATALOG & INVENTORY ====================

  const handleAddSkuSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.addMyntraSku(newSkuForm);
      triggerAlert('success', `SKU ${newSkuForm.skuCode} added and published to Myntra catalog.`);
      setAddSkuModal(false);
      setNewSkuForm({ skuCode: '', internalItem: '', barcode: '', price: 1999 });
      loadAllData();
    } catch (err) {
      triggerAlert('error', err.message || 'Failed to add SKU');
    } finally {
      setLoading(false);
    }
  };

  const handleMapWhSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.mapMyntraWarehouse(mapWhForm);
      triggerAlert('success', `Warehouse ${mapWhForm.warehouseName} mapped successfully.`);
      setMapWhModal(false);
      loadAllData();
    } catch (err) {
      triggerAlert('error', err.message || 'Failed to map warehouse');
    } finally {
      setLoading(false);
    }
  };

  const handlePushStock = async () => {
    try {
      setLoading(true);
      const res = await api.syncMyntraInventory();
      triggerAlert('success', res.message || 'Inventory stocks pushed to Myntra PPMP API.');
      loadAllData();
    } catch (err) {
      triggerAlert('error', err.message || 'Failed to sync inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscountOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!discountModalItem) return;
    try {
      setLoading(true);
      await api.applyMyntraDiscount({
        skuCode: discountModalItem.skuCode,
        discountPercent: discountForm.discountPercent,
        newPrice: discountForm.newPrice
      });
      triggerAlert('success', `Price and discount updated for ${discountModalItem.skuCode}.`);
      setDiscountModalItem(null);
      loadAllData();
    } catch (err) {
      triggerAlert('error', err.message || 'Failed to override discount');
    } finally {
      setLoading(false);
    }
  };

  // ==================== TAB 3 ACTIONS: DISPATCH & TRACKING ====================

  const handleMarkShipped = async (packetId) => {
    try {
      setLoading(true);
      await api.markShipped(packetId);
      triggerAlert('success', `Packet ${packetId} marked In-Transit.`);
      loadAllData();
    } catch (err) {
      triggerAlert('error', err.message || 'Failed to mark shipped');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDelivered = async (packetId) => {
    try {
      setLoading(true);
      await api.markDelivered(packetId);
      triggerAlert('success', `Packet ${packetId} marked Delivered.`);
      loadAllData();
    } catch (err) {
      triggerAlert('error', err.message || 'Failed to mark delivered');
    } finally {
      setLoading(false);
    }
  };

  // ==================== TAB 4 ACTIONS: RETURNS & RTO ====================

  const filteredReturns = useMemo(() => {
    return returnsList.filter(r => r.type === returnTypeFilter);
  }, [returnsList, returnTypeFilter]);

  const handleReturnScanLookup = async (e) => {
    if (e) e.preventDefault();
    if (!scannedReturnAwb.trim()) return;
    try {
      setLoading(true);
      const res = await api.lookupMyntraReturn(scannedReturnAwb.trim());
      setActiveReturnDetail(res);
      triggerAlert('success', `Found return docket for Packet/AWB: ${scannedReturnAwb}`);
    } catch (err) {
      triggerAlert('error', 'Return docket not found');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteReturnQc = async () => {
    if (!activeReturnDetail) return;
    try {
      setLoading(true);
      await api.updateMyntraReturn(activeReturnDetail.returnId, {
        qcResult: qcResultSelection
      });
      triggerAlert('success', `Return QC completed: ${qcResultSelection === 'RESTOCK' ? 'Restocked to ERP inventory' : 'Marked as B-grade/Damaged'}.`);
      setActiveReturnDetail(null);
      setScannedReturnAwb('');
      loadAllData();
    } catch (err) {
      triggerAlert('error', err.message || 'Failed to complete return QC');
    } finally {
      setLoading(false);
    }
  };

  // ==================== TAB 5 ACTIONS: MOCKIFY TEST SIMULATOR ====================

  const handleInjectOrder = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await api.injectMockMyntraOrder({
        sku: mockOrderSku,
        warehouse: mockOrderWh,
        quantity: mockOrderQty
      });
      triggerAlert('success', res.message || 'Mock order generated and injected into pipeline!');
      loadAllData();
    } catch (err) {
      triggerAlert('error', err.message || 'Failed to inject mock order');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateCancel = async (e) => {
    e.preventDefault();
    if (!cancelOrderId) return;
    try {
      setLoading(true);
      await api.simulateMyntraCancellation(cancelOrderId);
      triggerAlert('success', `Simulated customer cancellation for ${cancelOrderId}`);
      setCancelOrderId('');
      loadAllData();
    } catch (err) {
      triggerAlert('error', err.message || 'Failed to simulate cancellation');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateHold = async (e) => {
    e.preventDefault();
    if (!holdOrderId) return;
    try {
      setLoading(true);
      await api.simulateMyntraHold(holdOrderId);
      triggerAlert('success', `Simulated Hold on order ${holdOrderId}`);
      loadAllData();
    } catch (err) {
      triggerAlert('error', err.message || 'Failed to hold order');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateUnhold = async () => {
    if (!holdOrderId) return;
    try {
      setLoading(true);
      await api.simulateMyntraUnhold(holdOrderId);
      triggerAlert('success', `Released Hold on order ${holdOrderId}`);
      setHoldOrderId('');
      loadAllData();
    } catch (err) {
      triggerAlert('error', err.message || 'Failed to release hold');
    } finally {
      setLoading(false);
    }
  };

  const handleClearWebhookLogs = async () => {
    try {
      await api.clearMyntraWebhookEvents();
      setWebhookEvents([]);
      triggerAlert('success', 'Webhook logs cleared.');
    } catch (err) {
      console.error(err);
    }
  };

  // ==================== TAB 6 ACTIONS: API & WEBHOOK SETTINGS ====================

  const webhookReceiverUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/v1/myntra/webhook`
    : 'https://erp.eliteedition.in/api/v1/myntra/webhook';

  const handleCopyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookReceiverUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
    triggerAlert('success', 'Webhook Receiver URL copied to clipboard!');
  };

  const handleRefreshToken = async () => {
    try {
      setLoading(true);
      const res = await api.refreshMyntraToken();
      triggerAlert('success', res.message || 'Access token renewed with Myntra OAuth service.');
      setTokenHealth({
        status: 'Active',
        hoursRemaining: '24h 00m',
        expiresAt: res.expiresAt
      });
    } catch (err) {
      triggerAlert('error', err.message || 'Failed to refresh token');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.saveMyntraConfig({
        merchantId,
        secretKey,
        environment: envMode,
        partnerName,
        defaultWarehouse: defaultWh
      });
      triggerAlert('success', 'Myntra credentials and PPMP settings saved successfully.');
      loadAllData();
    } catch (err) {
      triggerAlert('error', err.message || 'Failed to save Myntra configuration');
    } finally {
      setLoading(false);
    }
  };

  // ==================== RENDER VIEWS ====================

  return (
    <div className="myntra-root">
      {/* Alert Toasts */}
      {alert.message && (
        <div 
          style={{
            position: 'fixed',
            top: '1.5rem',
            right: '1.5rem',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.85rem 1.25rem',
            borderRadius: '0.75rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
            background: alert.type === 'error' ? '#fef2f2' : '#ecfdf5',
            color: alert.type === 'error' ? '#991b1b' : '#065f46',
            border: `1px solid ${alert.type === 'error' ? '#fecaca' : '#a7f3d0'}`,
            fontSize: '0.875rem',
            fontWeight: 500,
            animation: 'myntraFadeIn 0.2s ease-out'
          }}
        >
          {alert.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{alert.message}</span>
        </div>
      )}

      {/* Main Container Card: bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 myntra-card-container">
        
        {/* Page Header */}
        <div className="myntra-header">
          <div className="myntra-header-left">
            <div className="myntra-badge-icon">
              <ShoppingBag size={24} />
            </div>
            <div>
              <h1 className="myntra-title">Myntra Integration</h1>
              <p className="myntra-subtitle">
                Manage your Myntra PPMP orders, sync inventory, and dispatch seamlessly.
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Mode: <strong style={{ color: envMode === 'sandbox' ? '#e11d48' : '#16a34a' }}>
                {envMode === 'sandbox' ? 'Neo-Mockify Sandbox' : 'Live Production'}
              </strong>
            </span>
            <button 
              className="myntra-btn myntra-btn-outline" 
              onClick={loadAllData} 
              disabled={loading}
              title="Refresh Data"
            >
              <RefreshCw size={14} className={loading ? 'spin-loader' : ''} />
              <span>Sync All</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Bar (Pixel-Perfect Match with 6 Tabs) */}
        <div className="myntra-nav-tabs">
          <button
            onClick={() => setActiveTab('fulfillment')}
            className={`myntra-tab-btn ${activeTab === 'fulfillment' ? 'active' : 'inactive'}`}
          >
            <PackageCheck size={16} />
            <span>Order Fulfillment</span>
          </button>

          <button
            onClick={() => setActiveTab('catalog')}
            className={`myntra-tab-btn ${activeTab === 'catalog' ? 'active' : 'inactive'}`}
          >
            <Layers size={16} />
            <span>Catalog & Inventory</span>
          </button>

          <button
            onClick={() => setActiveTab('dispatch')}
            className={`myntra-tab-btn ${activeTab === 'dispatch' ? 'active' : 'inactive'}`}
          >
            <Truck size={16} />
            <span>Dispatch & Tracking</span>
          </button>

          <button
            onClick={() => setActiveTab('returns')}
            className={`myntra-tab-btn ${activeTab === 'returns' ? 'active' : 'inactive'}`}
          >
            <RotateCcw size={16} />
            <span>Returns & RTO</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`myntra-tab-btn ${activeTab === 'simulator' ? 'active' : 'inactive'}`}
          >
            <Terminal size={16} />
            <span>Mockify Simulator</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`myntra-tab-btn ${activeTab === 'settings' ? 'active' : 'inactive'}`}
          >
            <Settings2 size={16} />
            <span>API & Webhooks</span>
          </button>
        </div>

        {/* =========================================================================
            TAB 1: ORDER FULFILLMENT (PPMP & Omni Lifecycle)
           ========================================================================= */}
        {activeTab === 'fulfillment' && (
          <div>
            {/* Pipeline Stage Bar at Top */}
            <div className="myntra-pipeline-bar">
              <div 
                className={`myntra-stage-item ${stageFilter === 'ALL' ? 'selected' : ''}`}
                onClick={() => setStageFilter('ALL')}
              >
                <span>All Orders</span>
                <span className="myntra-stage-count">{orders.length}</span>
              </div>

              <div className="myntra-stage-arrow"><ChevronRight size={14} /></div>

              <div 
                className={`myntra-stage-item ${stageFilter === 'UNACKNOWLEDGED' ? 'selected' : ''}`}
                onClick={() => setStageFilter('UNACKNOWLEDGED')}
              >
                <span>Unacknowledged</span>
                <span className="myntra-stage-count">{pipelineCounts.unacknowledged}</span>
              </div>

              <div className="myntra-stage-arrow"><ChevronRight size={14} /></div>

              <div 
                className={`myntra-stage-item ${stageFilter === 'ACCEPTED' ? 'selected' : ''}`}
                onClick={() => setStageFilter('ACCEPTED')}
              >
                <span>Accepted</span>
                <span className="myntra-stage-count">{pipelineCounts.accepted}</span>
              </div>

              <div className="myntra-stage-arrow"><ChevronRight size={14} /></div>

              <div 
                className={`myntra-stage-item ${stageFilter === 'RTD' ? 'selected' : ''}`}
                onClick={() => setStageFilter('RTD')}
              >
                <span>Ready To Dispatch (RTD)</span>
                <span className="myntra-stage-count">{pipelineCounts.rtd}</span>
              </div>

              <div className="myntra-stage-arrow"><ChevronRight size={14} /></div>

              <div 
                className={`myntra-stage-item ${stageFilter === 'RTS' ? 'selected' : ''}`}
                onClick={() => setStageFilter('RTS')}
              >
                <span>Ready To Ship (RTS)</span>
                <span className="myntra-stage-count">{pipelineCounts.rts}</span>
              </div>
            </div>

            {/* Filter & Fast Search Bar */}
            <div className="myntra-action-bar">
              <div className="myntra-search-wrapper">
                <Search size={16} className="myntra-search-icon" />
                <input
                  type="text"
                  className="myntra-search-input"
                  placeholder="Search by Order ID, Packet ID, SKU, or Customer Pincode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Scan Packet to RTS Barcode Box */}
              <form onSubmit={handleScanRts} className="myntra-scan-box">
                <Barcode size={18} color="#e11d48" />
                <input
                  type="text"
                  className="myntra-scan-input"
                  placeholder="Scan Packet to RTS..."
                  value={scanBarcode}
                  onChange={(e) => setScanBarcode(e.target.value)}
                />
                <button type="submit" className="myntra-btn myntra-btn-rose" style={{ padding: '0.35rem 0.65rem' }}>
                  Verify & RTS
                </button>
              </form>

              {/* Bulk Action Button */}
              {selectedOrders.length > 0 && (
                <button 
                  className="myntra-btn myntra-btn-primary" 
                  onClick={handleBulkAccept}
                  disabled={loading}
                >
                  <CheckCircle2 size={14} />
                  <span>Accept Selected ({selectedOrders.length})</span>
                </button>
              )}
            </div>

            {/* High-Density Data Table */}
            <div className="myntra-table-container">
              <table className="myntra-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        onChange={handleSelectAll} 
                        checked={filteredOrders.length > 0 && selectedOrders.length === filteredOrders.length}
                      />
                    </th>
                    <th>Order ID</th>
                    <th>Packet ID</th>
                    <th>SKU & Item Name</th>
                    <th>Qty</th>
                    <th>Warehouse</th>
                    <th>SLA / Order Time</th>
                    <th>Stage Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                        No orders matching current filter or search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((o) => (
                      <tr key={o.orderId}>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedOrders.includes(o.orderId)}
                            onChange={() => handleSelectRow(o.orderId)}
                          />
                        </td>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{o.orderId}</td>
                        <td style={{ fontFamily: 'monospace', color: '#475569' }}>{o.packetId}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{o.sku}</div>
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{o.itemName}</div>
                        </td>
                        <td style={{ fontWeight: 600 }}>{o.qty}</td>
                        <td>
                          <span style={{ fontSize: '0.75rem', color: '#475569' }}>{o.warehouse}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: o.sla.includes('Expired') ? '#dc2626' : '#2563eb' }}>
                            <Clock size={12} />
                            <span style={{ fontWeight: 600 }}>{o.sla}</span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            {new Date(o.orderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td>
                          {o.stage === 'UNACKNOWLEDGED' && (
                            <span className="myntra-badge myntra-badge-amber">Unacknowledged</span>
                          )}
                          {o.stage === 'ACCEPTED' && (
                            <span className="myntra-badge myntra-badge-blue">Accepted</span>
                          )}
                          {o.stage === 'RTD' && (
                            <span className="myntra-badge myntra-badge-purple">Ready To Dispatch</span>
                          )}
                          {o.stage === 'RTS' && (
                            <span className="myntra-badge myntra-badge-emerald">Ready To Ship</span>
                          )}
                          {o.stage === 'CANCELLED' && (
                            <span className="myntra-badge myntra-badge-rose">Cancelled</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                            {o.stage === 'UNACKNOWLEDGED' && (
                              <button
                                className="myntra-btn myntra-btn-primary"
                                style={{ padding: '0.35rem 0.65rem' }}
                                onClick={() => handleAcceptSingle(o.orderId)}
                                disabled={loading}
                              >
                                Accept Order
                              </button>
                            )}

                            {o.stage === 'ACCEPTED' && (
                              <button
                                className="myntra-btn myntra-btn-rose"
                                style={{ padding: '0.35rem 0.65rem' }}
                                onClick={() => {
                                  setRtdModalOrder(o);
                                  setInvoiceTypeSelection('MYNTRA');
                                }}
                              >
                                RTD Pack
                              </button>
                            )}

                            {(o.stage === 'RTD' || o.stage === 'RTS') && (
                              <>
                                <button
                                  className="myntra-btn myntra-btn-outline"
                                  style={{ padding: '0.35rem 0.65rem' }}
                                  title="Download Shipping Label"
                                  onClick={() => handleDownloadLabel(o.packetId)}
                                >
                                  <Printer size={13} />
                                  <span>Label</span>
                                </button>
                                <button
                                  className="myntra-btn myntra-btn-outline"
                                  style={{ padding: '0.35rem 0.65rem' }}
                                  title="Download Invoice"
                                  onClick={() => handleDownloadInvoice(o.packetId)}
                                >
                                  <FileText size={13} />
                                  <span>Invoice</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: CATALOG & INVENTORY SYNC
           ========================================================================= */}
        {activeTab === 'catalog' && (
          <div>
            <div className="myntra-action-bar">
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>
                  SKU Mapping & Stock Sync
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                  Keep Myntra PPMP available stock aligned with Elite Edition physical warehouse bins.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button className="myntra-btn myntra-btn-outline" onClick={() => setAddSkuModal(true)}>
                  <Plus size={14} />
                  <span>+ Add SKU</span>
                </button>
                <button className="myntra-btn myntra-btn-outline" onClick={() => setMapWhModal(true)}>
                  <Layers size={14} />
                  <span>+ Map Warehouse</span>
                </button>
                <button className="myntra-btn myntra-btn-rose" onClick={handlePushStock} disabled={loading}>
                  <Zap size={14} />
                  <span>Push Stock Now</span>
                </button>
              </div>
            </div>

            <div className="myntra-table-container">
              <table className="myntra-table">
                <thead>
                  <tr>
                    <th>SKU Code</th>
                    <th>ERP Internal Item</th>
                    <th>Barcode</th>
                    <th>Warehouse</th>
                    <th>ERP Physical Stock</th>
                    <th>Myntra Active Stock</th>
                    <th>Buffer Reserve</th>
                    <th>Sync Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                        Loading catalog mappings...
                      </td>
                    </tr>
                  ) : (
                    catalog.map((c) => (
                      <tr key={c.skuCode}>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{c.skuCode}</td>
                        <td>{c.internalItem}</td>
                        <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{c.barcode}</td>
                        <td><span className="myntra-badge myntra-badge-slate">{c.warehouse}</span></td>
                        <td style={{ fontWeight: 600 }}>{c.erpStock}</td>
                        <td style={{ fontWeight: 600, color: '#059669' }}>{c.myntraActiveStock}</td>
                        <td style={{ color: '#d97706' }}>{c.bufferReserve}</td>
                        <td>
                          {c.syncStatus === 'SYNCED' ? (
                            <span className="myntra-badge myntra-badge-emerald">Synced</span>
                          ) : (
                            <span className="myntra-badge myntra-badge-amber">Drift Detected</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="myntra-btn myntra-btn-outline"
                            style={{ padding: '0.35rem 0.65rem' }}
                            onClick={() => {
                              setDiscountModalItem(c);
                              setDiscountForm({
                                discountPercent: c.discountPercent || 10,
                                newPrice: c.price || 1799
                              });
                            }}
                          >
                            <Sliders size={13} />
                            <span>Override Price</span>
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

        {/* =========================================================================
            TAB 3: DISPATCH & TRACKING (Post-Pack Lifecycle)
           ========================================================================= */}
        {activeTab === 'dispatch' && (
          <div>
            <div className="myntra-action-bar">
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>
                  Real-time Shipment Handover List
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                  Track post-pack courier handovers, in-transit manifests, and last-mile deliveries.
                </p>
              </div>
            </div>

            <div className="myntra-table-container">
              <table className="myntra-table">
                <thead>
                  <tr>
                    <th>Packet ID</th>
                    <th>Tracking No / AWB</th>
                    <th>Courier Partner</th>
                    <th>Destination</th>
                    <th>Dispatched At</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Quick Testing Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                        No dispatched shipments found.
                      </td>
                    </tr>
                  ) : (
                    shipments.map((s) => (
                      <tr key={s.packetId}>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{s.packetId}</td>
                        <td style={{ fontFamily: 'monospace', color: '#2563eb' }}>{s.trackingNo}</td>
                        <td>{s.courier}</td>
                        <td style={{ fontSize: '0.78rem', color: '#475569' }}>{s.destination}</td>
                        <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          {new Date(s.dispatchedAt).toLocaleString()}
                        </td>
                        <td>
                          {s.status === 'In-Transit' ? (
                            <span className="myntra-badge myntra-badge-sky">In-Transit</span>
                          ) : (
                            <span className="myntra-badge myntra-badge-emerald">Delivered</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                            <button
                              className="myntra-btn myntra-btn-outline"
                              style={{ padding: '0.35rem 0.65rem' }}
                              onClick={() => handleMarkShipped(s.packetId)}
                              disabled={loading}
                            >
                              Mark Shipped
                            </button>
                            <button
                              className="myntra-btn myntra-btn-outline"
                              style={{ padding: '0.35rem 0.65rem' }}
                              onClick={() => handleMarkDelivered(s.packetId)}
                              disabled={loading}
                            >
                              Mark Delivered
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: RETURNS & RTO (Courier & Customer Returns)
           ========================================================================= */}
        {activeTab === 'returns' && (
          <div>
            {/* Split Tab Segmented Control */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <button
                className={`myntra-btn ${returnTypeFilter === 'COURIER_RTO' ? 'myntra-btn-rose' : 'myntra-btn-outline'}`}
                onClick={() => setReturnTypeFilter('COURIER_RTO')}
              >
                Courier Return / RTO (Closed Box)
              </button>
              <button
                className={`myntra-btn ${returnTypeFilter === 'CUSTOMER_RTV' ? 'myntra-btn-rose' : 'myntra-btn-outline'}`}
                onClick={() => setReturnTypeFilter('CUSTOMER_RTV')}
              >
                Customer Return / RTV
              </button>
            </div>

            {/* Inward Scanner Desk */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.875rem', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#0f172a' }}>
                Barcode Scanner Inward Desk
              </h4>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: '#64748b' }}>
                Scan incoming return AWB / Packet ID to fetch return docket and initiate QC inspection.
              </p>

              <form onSubmit={handleReturnScanLookup} style={{ display: 'flex', gap: '0.75rem', maxWidth: '520px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Barcode size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    type="text"
                    className="myntra-form-input"
                    style={{ paddingLeft: '2.4rem' }}
                    placeholder="Scan Return AWB / Packet ID..."
                    value={scannedReturnAwb}
                    onChange={(e) => setScannedReturnAwb(e.target.value)}
                  />
                </div>
                <button type="submit" className="myntra-btn myntra-btn-rose">
                  Fetch Docket
                </button>
              </form>

              {/* Active Return QC Card */}
              {activeReturnDetail && (
                <div style={{ marginTop: '1.25rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '0.75rem', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>
                      Docket #{activeReturnDetail.returnId} &bull; Order: {activeReturnDetail.orderId}
                    </div>
                    <span className="myntra-badge myntra-badge-rose">{activeReturnDetail.type}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
                    <div><strong>SKU:</strong> {activeReturnDetail.sku}</div>
                    <div><strong>Item:</strong> {activeReturnDetail.itemName}</div>
                    <div><strong>AWB:</strong> {activeReturnDetail.awb}</div>
                    <div><strong>Reason:</strong> {activeReturnDetail.reason}</div>
                  </div>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="qcResult"
                          value="RESTOCK"
                          checked={qcResultSelection === 'RESTOCK'}
                          onChange={() => setQcResultSelection('RESTOCK')}
                        />
                        <span style={{ fontWeight: 600, color: '#059669' }}>Restock to Inventory</span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="qcResult"
                          value="DAMAGED"
                          checked={qcResultSelection === 'DAMAGED'}
                          onChange={() => setQcResultSelection('DAMAGED')}
                        />
                        <span style={{ fontWeight: 600, color: '#dc2626' }}>Damaged / B-Grade</span>
                      </label>
                    </div>

                    <button className="myntra-btn myntra-btn-primary" onClick={handleCompleteReturnQc} disabled={loading}>
                      <CheckCircle2 size={14} />
                      <span>Acknowledge & Complete QC</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Returns Table */}
            <div className="myntra-table-container">
              <table className="myntra-table">
                <thead>
                  <tr>
                    <th>Return ID</th>
                    <th>Packet ID</th>
                    <th>Order ID</th>
                    <th>SKU & Item</th>
                    <th>Reason</th>
                    <th>Initiated At</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReturns.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                        No return records found for this segment.
                      </td>
                    </tr>
                  ) : (
                    filteredReturns.map((r) => (
                      <tr key={r.returnId}>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{r.returnId}</td>
                        <td style={{ fontFamily: 'monospace' }}>{r.packetId}</td>
                        <td>{r.orderId}</td>
                        <td>{r.sku}</td>
                        <td style={{ color: '#64748b', fontSize: '0.78rem' }}>{r.reason}</td>
                        <td style={{ fontSize: '0.78rem' }}>{new Date(r.initiatedAt).toLocaleString()}</td>
                        <td>
                          {r.status === 'RESTOCKED_TO_INVENTORY' ? (
                            <span className="myntra-badge myntra-badge-emerald">Restocked</span>
                          ) : r.status === 'SCRAP_DAMAGED' ? (
                            <span className="myntra-badge myntra-badge-rose">Damaged / Scrap</span>
                          ) : (
                            <span className="myntra-badge myntra-badge-amber">Inward Pending</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 5: MOCKIFY TEST SIMULATOR (Sandbox Engine)
           ========================================================================= */}
        {activeTab === 'simulator' && (
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>
                Mockify Sandbox Engine
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                Simulate Myntra Pretr Neo storefront scenarios (http://pretrtest-neo.myntapi.com) and verify live webhook receipts.
              </p>
            </div>

            <div className="myntra-sim-grid">
              {/* Scenario 1: Inject Mock Order */}
              <div className="myntra-sim-card">
                <div className="myntra-sim-card-header">
                  <Package size={18} color="#e11d48" />
                  <span>Inject Mock Order</span>
                </div>
                <form onSubmit={handleInjectOrder} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div className="myntra-form-group">
                    <label className="myntra-form-label">SKU</label>
                    <select
                      className="myntra-form-select"
                      value={mockOrderSku}
                      onChange={(e) => setMockOrderSku(e.target.value)}
                    >
                      <option value="ANOUK-AA22216_XXL">ANOUK-AA22216_XXL (Sea Green Kurta)</option>
                      <option value="ANOUK-AC21184_M">ANOUK-AC21184_M (Yellow Floral)</option>
                      <option value="ANOUK-AC22114_XL">ANOUK-AC22114_XL (Pure Silk)</option>
                      <option value="ANOUK-AC20505_M">ANOUK-AC20505_M (Anarkali Set)</option>
                    </select>
                  </div>
                  <div className="myntra-form-group">
                    <label className="myntra-form-label">Warehouse</label>
                    <input
                      type="text"
                      className="myntra-form-input"
                      value={mockOrderWh}
                      onChange={(e) => setMockOrderWh(e.target.value)}
                    />
                  </div>
                  <div className="myntra-form-group">
                    <label className="myntra-form-label">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      className="myntra-form-input"
                      value={mockOrderQty}
                      onChange={(e) => setMockOrderQty(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="myntra-btn myntra-btn-rose" disabled={loading}>
                    <Zap size={14} />
                    <span>Trigger /storefront/v4/mock/order</span>
                  </button>
                </form>
              </div>

              {/* Scenario 2: Simulate Customer Cancellation */}
              <div className="myntra-sim-card">
                <div className="myntra-sim-card-header">
                  <RotateCcw size={18} color="#dc2626" />
                  <span>Simulate Customer Cancellation</span>
                </div>
                <form onSubmit={handleSimulateCancel} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div className="myntra-form-group">
                    <label className="myntra-form-label">Active Order ID</label>
                    <select
                      className="myntra-form-select"
                      value={cancelOrderId}
                      onChange={(e) => setCancelOrderId(e.target.value)}
                    >
                      <option value="">-- Select Order --</option>
                      {orders.filter(o => o.stage !== 'CANCELLED').map(o => (
                        <option key={o.orderId} value={o.orderId}>
                          {o.orderId} ({o.sku})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="myntra-btn myntra-btn-danger" disabled={loading || !cancelOrderId}>
                    Simulate /mock/order/:id/itemCancellation
                  </button>
                </form>

                {/* Scenario 3: Hold / Unhold */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
                    Simulate Hold / UnHold
                  </span>
                  <div className="myntra-form-group">
                    <select
                      className="myntra-form-select"
                      value={holdOrderId}
                      onChange={(e) => setHoldOrderId(e.target.value)}
                    >
                      <option value="">-- Select Order to Toggle Hold --</option>
                      {orders.map(o => (
                        <option key={o.orderId} value={o.orderId}>
                          {o.orderId} {o.isOnHold ? '[ON HOLD]' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="myntra-btn myntra-btn-outline"
                      style={{ flex: 1 }}
                      onClick={handleSimulateHold}
                      disabled={loading || !holdOrderId}
                    >
                      Put On Hold
                    </button>
                    <button
                      type="button"
                      className="myntra-btn myntra-btn-outline"
                      style={{ flex: 1 }}
                      onClick={handleSimulateUnhold}
                      disabled={loading || !holdOrderId}
                    >
                      Release UnHold
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* In-app Live Webhook Event Log Card */}
            <div className="myntra-webhook-card">
              <div className="myntra-webhook-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Terminal size={18} color="#38bdf8" />
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Live Webhook Event Listener</span>
                  <span className="myntra-pulse-dot" />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="myntra-btn myntra-btn-subtle"
                    style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155' }}
                    onClick={loadAllData}
                  >
                    <RefreshCw size={12} />
                    <span>Poll Feed</span>
                  </button>
                  <button
                    className="myntra-btn myntra-btn-subtle"
                    style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155' }}
                    onClick={handleClearWebhookLogs}
                  >
                    Clear Logs
                  </button>
                </div>
              </div>

              <div className="myntra-webhook-body">
                {webhookEvents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    Listening for incoming Myntra PPMP webhooks...
                  </div>
                ) : (
                  webhookEvents.map((evt) => (
                    <div key={evt.id} className="myntra-webhook-item">
                      <div className="myntra-webhook-meta">
                        <span>EVENT: {evt.event}</span>
                        <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <pre className="myntra-webhook-json">
                        {JSON.stringify(evt.payload, null, 2)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 6: API & WEBHOOK SETTINGS (Replaces Basic Configuration Screen)
           ========================================================================= */}
        {activeTab === 'settings' && (
          <div>
            <div className="myntra-settings-grid">
              {/* Credentials & Settings Form */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.875rem', padding: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', fontWeight: 600, color: '#0f172a' }}>
                  API Credentials & Environment
                </h3>
                <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Configure your Myntra Partner Gateway credentials, secrets, and warehouse routing.
                </p>

                <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                  {/* Environment Mode Toggle */}
                  <div className="myntra-form-group">
                    <label className="myntra-form-label">Environment Mode</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className={`myntra-btn ${envMode === 'sandbox' ? 'myntra-btn-rose' : 'myntra-btn-outline'}`}
                        style={{ flex: 1 }}
                        onClick={() => setEnvMode('sandbox')}
                      >
                        Neo-Mockify Sandbox
                      </button>
                      <button
                        type="button"
                        className={`myntra-btn ${envMode === 'production' ? 'myntra-btn-primary' : 'myntra-btn-outline'}`}
                        style={{ flex: 1 }}
                        onClick={() => setEnvMode('production')}
                      >
                        Live Production
                      </button>
                    </div>
                  </div>

                  {/* Merchant ID */}
                  <div className="myntra-form-group">
                    <label className="myntra-form-label">Merchant ID</label>
                    <input
                      type="text"
                      required
                      className="myntra-form-input"
                      value={merchantId}
                      onChange={(e) => setMerchantId(e.target.value)}
                      placeholder="e.g. ASAAESFA"
                    />
                  </div>

                  {/* Secret Key */}
                  <div className="myntra-form-group">
                    <label className="myntra-form-label">Secret Key</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showSecretKey ? 'text' : 'password'}
                        required
                        className="myntra-form-input"
                        value={secretKey}
                        onChange={(e) => setSecretKey(e.target.value)}
                        placeholder="Enter Secret Key"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecretKey(!showSecretKey)}
                        style={{
                          position: 'absolute',
                          right: '0.75rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer'
                        }}
                      >
                        {showSecretKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Mocking Partner Name */}
                  <div className="myntra-form-group">
                    <label className="myntra-form-label">Mocking Partner Name (Header: mocking-partner-name)</label>
                    <input
                      type="text"
                      className="myntra-form-input"
                      value={partnerName}
                      onChange={(e) => setPartnerName(e.target.value)}
                      placeholder="e.g. elite_edition_retail"
                    />
                  </div>

                  {/* Default Warehouse Code */}
                  <div className="myntra-form-group">
                    <label className="myntra-form-label">Default Warehouse Code</label>
                    <input
                      type="text"
                      className="myntra-form-input"
                      value={defaultWh}
                      onChange={(e) => setDefaultWh(e.target.value)}
                      placeholder="WH1"
                    />
                  </div>

                  {/* Webhook Receiver URL with Copy */}
                  <div className="myntra-form-group">
                    <label className="myntra-form-label">ERP Webhook Receiver URL</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        readOnly
                        className="myntra-form-input"
                        value={webhookReceiverUrl}
                        style={{ background: '#f8fafc', color: '#475569' }}
                      />
                      <button
                        type="button"
                        className="myntra-btn myntra-btn-outline"
                        onClick={handleCopyWebhookUrl}
                      >
                        {copiedUrl ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                        <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="myntra-btn myntra-btn-primary"
                    disabled={loading}
                    style={{ marginTop: '0.5rem', padding: '0.75rem' }}
                  >
                    {loading ? <RefreshCw className="spin-loader" size={16} /> : <CheckCircle2 size={16} />}
                    <span>Save Myntra Configuration</span>
                  </button>
                </form>
              </div>

              {/* Token Health Card */}
              <div className="myntra-token-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <ShieldCheck size={22} color="#2563eb" />
                    <span style={{ fontWeight: 600, fontSize: '1rem', color: '#0f172a' }}>
                      Token Health Monitor
                    </span>
                  </div>
                  <span className="myntra-badge myntra-badge-emerald">
                    <span className="myntra-pulse-dot" style={{ width: '6px', height: '6px' }} />
                    <span>{tokenHealth.status}</span>
                  </span>
                </div>

                <div style={{ background: '#ffffff', borderRadius: '0.625rem', padding: '1rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>JWT Expiry Window</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
                    {tokenHealth.hoursRemaining}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    Auto-refreshed before TTL expiration
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', lineHeight: 1.5 }}>
                  The Elite Edition backend schedules continuous background renewals with Myntra OAuth endpoint (`/authorization/refresh_token`) to guarantee zero order sync interruptions.
                </p>

                <button
                  type="button"
                  className="myntra-btn myntra-btn-outline"
                  onClick={handleRefreshToken}
                  disabled={loading}
                  style={{ alignSelf: 'flex-start' }}
                >
                  <RefreshCw size={14} className={loading ? 'spin-loader' : ''} />
                  <span>Force Refresh Token</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* =========================================================================
          MODALS
         ========================================================================= */}

      {/* RTD Pack Modal */}
      {rtdModalOrder && (
        <div className="myntra-modal-backdrop" onClick={() => setRtdModalOrder(null)}>
          <div className="myntra-modal" onClick={(e) => e.stopPropagation()}>
            <div className="myntra-modal-header">
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>
                Ready To Dispatch (RTD) - {rtdModalOrder.orderId}
              </h3>
              <button 
                onClick={() => setRtdModalOrder(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="myntra-modal-body">
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                Select invoice source for packet <strong>{rtdModalOrder.packetId}</strong> before packing and generating tax documents.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.75rem', 
                    padding: '0.85rem', 
                    border: '1px solid',
                    borderColor: invoiceTypeSelection === 'MYNTRA' ? '#f43f5e' : '#e2e8f0',
                    background: invoiceTypeSelection === 'MYNTRA' ? '#fff1f2' : '#ffffff',
                    borderRadius: '0.625rem',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="radio"
                    name="invType"
                    checked={invoiceTypeSelection === 'MYNTRA'}
                    onChange={() => setInvoiceTypeSelection('MYNTRA')}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>
                      Myntra-Generated Invoice
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Myntra PPMP API issues standard GST tax invoice PDF.
                    </div>
                  </div>
                </label>

                <label 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.75rem', 
                    padding: '0.85rem', 
                    border: '1px solid',
                    borderColor: invoiceTypeSelection === 'SELLER' ? '#f43f5e' : '#e2e8f0',
                    background: invoiceTypeSelection === 'SELLER' ? '#fff1f2' : '#ffffff',
                    borderRadius: '0.625rem',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="radio"
                    name="invType"
                    checked={invoiceTypeSelection === 'SELLER'}
                    onChange={() => setInvoiceTypeSelection('SELLER')}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>
                      Seller-Generated Invoice
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Elite Edition Enterprise ERP generates self-billed invoice.
                    </div>
                  </div>
                </label>
              </div>
            </div>
            <div className="myntra-modal-footer">
              <button className="myntra-btn myntra-btn-outline" onClick={() => setRtdModalOrder(null)}>
                Cancel
              </button>
              <button className="myntra-btn myntra-btn-rose" onClick={handleExecuteRtd} disabled={loading}>
                Confirm & Mark RTD
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add SKU Modal */}
      {addSkuModal && (
        <div className="myntra-modal-backdrop" onClick={() => setAddSkuModal(false)}>
          <div className="myntra-modal" onClick={(e) => e.stopPropagation()}>
            <div className="myntra-modal-header">
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>
                Add New Myntra SKU
              </h3>
              <button onClick={() => setAddSkuModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddSkuSubmit}>
              <div className="myntra-modal-body">
                <div className="myntra-form-group">
                  <label className="myntra-form-label">SKU Code</label>
                  <input
                    type="text"
                    required
                    className="myntra-form-input"
                    placeholder="e.g. ANOUK-AC21184_M"
                    value={newSkuForm.skuCode}
                    onChange={(e) => setNewSkuForm({ ...newSkuForm, skuCode: e.target.value })}
                  />
                </div>
                <div className="myntra-form-group">
                  <label className="myntra-form-label">Internal Item Name</label>
                  <input
                    type="text"
                    className="myntra-form-input"
                    placeholder="e.g. Yellow Floral Kurta Set"
                    value={newSkuForm.internalItem}
                    onChange={(e) => setNewSkuForm({ ...newSkuForm, internalItem: e.target.value })}
                  />
                </div>
                <div className="myntra-form-group">
                  <label className="myntra-form-label">Barcode / EAN</label>
                  <input
                    type="text"
                    className="myntra-form-input"
                    placeholder="8907812990130"
                    value={newSkuForm.barcode}
                    onChange={(e) => setNewSkuForm({ ...newSkuForm, barcode: e.target.value })}
                  />
                </div>
                <div className="myntra-form-group">
                  <label className="myntra-form-label">MRP / Base Price (₹)</label>
                  <input
                    type="number"
                    required
                    className="myntra-form-input"
                    placeholder="1999"
                    value={newSkuForm.price}
                    onChange={(e) => setNewSkuForm({ ...newSkuForm, price: e.target.value })}
                  />
                </div>
              </div>
              <div className="myntra-modal-footer">
                <button type="button" className="myntra-btn myntra-btn-outline" onClick={() => setAddSkuModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="myntra-btn myntra-btn-rose" disabled={loading}>
                  Save SKU (PUT /sku)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Map Warehouse Modal */}
      {mapWhModal && (
        <div className="myntra-modal-backdrop" onClick={() => setMapWhModal(false)}>
          <div className="myntra-modal" onClick={(e) => e.stopPropagation()}>
            <div className="myntra-modal-header">
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>
                Map Warehouse Routing
              </h3>
              <button onClick={() => setMapWhModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleMapWhSubmit}>
              <div className="myntra-modal-body">
                <div className="myntra-form-group">
                  <label className="myntra-form-label">Warehouse Code</label>
                  <input
                    type="text"
                    required
                    className="myntra-form-input"
                    value={mapWhForm.warehouseName}
                    onChange={(e) => setMapWhForm({ ...mapWhForm, warehouseName: e.target.value })}
                  />
                </div>
                <div className="myntra-form-group">
                  <label className="myntra-form-label">Select SKUs to Associate</label>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.5rem' }}>
                    {catalog.map(c => (
                      <label key={c.skuCode} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0', fontSize: '0.82rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={mapWhForm.skuCodes.includes(c.skuCode)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setMapWhForm({ ...mapWhForm, skuCodes: [...mapWhForm.skuCodes, c.skuCode] });
                            } else {
                              setMapWhForm({ ...mapWhForm, skuCodes: mapWhForm.skuCodes.filter(s => s !== c.skuCode) });
                            }
                          }}
                        />
                        <span>{c.skuCode} - {c.internalItem}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="myntra-modal-footer">
                <button type="button" className="myntra-btn myntra-btn-outline" onClick={() => setMapWhModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="myntra-btn myntra-btn-rose" disabled={loading}>
                  Map Warehouse (PUT /warehouse)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Override Price / Discount Modal */}
      {discountModalItem && (
        <div className="myntra-modal-backdrop" onClick={() => setDiscountModalItem(null)}>
          <div className="myntra-modal" onClick={(e) => e.stopPropagation()}>
            <div className="myntra-modal-header">
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>
                Price & Discount Override - {discountModalItem.skuCode}
              </h3>
              <button onClick={() => setDiscountModalItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleDiscountOverrideSubmit}>
              <div className="myntra-modal-body">
                <div className="myntra-form-group">
                  <label className="myntra-form-label">Discount Percentage (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="myntra-form-input"
                    value={discountForm.discountPercent}
                    onChange={(e) => setDiscountForm({ ...discountForm, discountPercent: e.target.value })}
                  />
                </div>
                <div className="myntra-form-group">
                  <label className="myntra-form-label">Effective Selling Price (₹)</label>
                  <input
                    type="number"
                    className="myntra-form-input"
                    value={discountForm.newPrice}
                    onChange={(e) => setDiscountForm({ ...discountForm, newPrice: e.target.value })}
                  />
                </div>
              </div>
              <div className="myntra-modal-footer">
                <button type="button" className="myntra-btn myntra-btn-outline" onClick={() => setDiscountModalItem(null)}>
                  Cancel
                </button>
                <button type="submit" className="myntra-btn myntra-btn-rose" disabled={loading}>
                  Override (PUT /partner/v4/discount/override)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
