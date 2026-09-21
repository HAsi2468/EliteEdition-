import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../services/api';
import {
  Building2,
  Phone,
  User,
  LogOut,
  Package,
  Layers,
  Sparkles,
  Camera,
  Upload,
  Check,
  AlertCircle,
  Clock,
  CheckCircle2,
  Search,
  ExternalLink,
  Shield,
  Palette,
  RefreshCw,
  Eye,
  Key,
  PlusCircle,
  Plus,
  Trash2,
  X
} from 'lucide-react';
import DesignImage from './DesignImage';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

export default function ClientPortal({ client, onLogout }) {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'designs' | 'profile'
  
  // Resolve client data reliably from props, localStorage, or current user
  const getInitialClient = () => {
    if (client && (client._id || client.companyName || client.companyCode || client.username)) return client;
    const fromStorage = api.getClientData();
    if (fromStorage && (fromStorage._id || fromStorage.companyName || fromStorage.companyCode || fromStorage.username)) return fromStorage;
    const fromUser = api.getCurrentUser();
    if (fromUser && (fromUser._id || fromUser.companyName || fromUser.companyCode || fromUser.username)) return fromUser;
    return client || {};
  };

  const [clientData, setClientData] = useState(getInitialClient);
  const [orders, setOrders] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingDesigns, setLoadingDesigns] = useState(false);
  const [searchOrder, setSearchOrder] = useState('');
  const [orderStageFilter, setOrderStageFilter] = useState('all');
  const [searchDesign, setSearchDesign] = useState('');

  // Profile update state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Zoom image
  const [zoomImg, setZoomImg] = useState(null);

  const fileInputRef = useRef(null);

  // Place Order Modal State
  const [showPlaceOrderModal, setShowPlaceOrderModal] = useState(false);
  const [orderRows, setOrderRows] = useState([
    {
      id: 1,
      date: new Date().toISOString().split('T')[0],
      designName: '',
      pcs: '',
      note: ''
    }
  ]);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderModalError, setOrderModalError] = useState('');
  const [orderModalSuccess, setOrderModalSuccess] = useState('');

  // Extract resolved client fields with flexible fallbacks
  const companyName = clientData.companyName || clientData.company_name || clientData.name || '';
  const partyCode = clientData.companyCode || clientData.company_code || clientData.partyCode || clientData.party || companyName || '';
  const mobile = clientData.mobile || clientData.phone || '';
  const username = clientData.username || clientData.user_name || '';

  // Synchronize if client prop updates
  useEffect(() => {
    if (client && (client._id || client.companyName || client.companyCode || client.username)) {
      setClientData(prev => ({ ...prev, ...client }));
    }
  }, [client]);

  // Fetch fresh client profile from server on mount
  useEffect(() => {
    const refreshProfile = async () => {
      const activeMobile = clientData.mobile || mobile;
      const activeUsername = clientData.username || username;
      const activeId = clientData._id || clientData.id;

      // 1. Prioritize lookup by mobile number to get the real, fresh DB record
      if (activeMobile) {
        try {
          const cRes = await api.getClients({ search: activeMobile });
          const list = cRes?.data || [];
          const matched = list.find((c) => c.mobile === activeMobile) || list[0];
          if (matched) {
            setClientData((prev) => ({ ...prev, ...matched }));
            localStorage.setItem('elite_client_data', JSON.stringify(matched));
            localStorage.setItem('elite_user', JSON.stringify({ ...api.getCurrentUser(), ...matched, id: matched._id, role: 'Client', isClient: true }));
            return;
          }
        } catch (e) {}
      }

      // 2. If username exists, query by username
      if (activeUsername) {
        try {
          const cRes = await api.getClients({ search: activeUsername });
          const list = cRes?.data || [];
          const matched = list.find((c) => c.username === activeUsername) || list[0];
          if (matched) {
            setClientData((prev) => ({ ...prev, ...matched }));
            localStorage.setItem('elite_client_data', JSON.stringify(matched));
            localStorage.setItem('elite_user', JSON.stringify({ ...api.getCurrentUser(), ...matched, id: matched._id, role: 'Client', isClient: true }));
            return;
          }
        } catch (e) {}
      }

      // 3. Fallback to activeId if mobile and username didn't match
      if (activeId) {
        try {
          const res = await api.getClientById(activeId).catch(() => null);
          if (res && res.data) {
            setClientData((prev) => ({ ...prev, ...res.data }));
            localStorage.setItem('elite_client_data', JSON.stringify(res.data));
            localStorage.setItem('elite_user', JSON.stringify({ ...api.getCurrentUser(), ...res.data, id: res.data._id, role: 'Client', isClient: true }));
            return;
          }
        } catch (err) {}
      }
    };

    refreshProfile();
  }, []);

  // Ensure body and html can scroll on PC and mobile
  useEffect(() => {
    document.body.classList.add('client-portal-active');
    document.documentElement.classList.add('client-portal-active');
    return () => {
      document.body.classList.remove('client-portal-active');
      document.documentElement.classList.remove('client-portal-active');
    };
  }, []);

  // Load Client Orders strictly by assigned party code (Company code in jobcard's party)
  const fetchOrders = async () => {
    const code = clientData.companyCode || partyCode;
    if (!code) {
      setOrders([]);
      return;
    }
    setLoadingOrders(true);
    try {
      const partyQuery = [clientData.companyCode, partyCode, clientData.companyName].filter(Boolean);
      const uniqueParties = [...new Set(partyQuery)].join(',');
      const res = await api.getJobCards({
        party: uniqueParties || code,
        limit: 1000
      });
      const list = res?.data || (Array.isArray(res) ? res : []);
      setOrders(list);
    } catch (err) {
      console.warn('Failed to fetch client orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Load Client Designs strictly by assigned party code
  const fetchDesigns = async () => {
    const code = clientData.companyCode || partyCode;
    if (!code) {
      setDesigns([]);
      return;
    }
    setLoadingDesigns(true);
    try {
      const partyQuery = [clientData.companyCode, partyCode, clientData.companyName].filter(Boolean);
      const uniqueParties = [...new Set(partyQuery)].join(',');
      const res = await api.getDesigns({
        party: uniqueParties || code,
        limit: 500
      });
      const list = res?.data || (Array.isArray(res) ? res : []);
      setDesigns(list);
    } catch (err) {
      console.warn('Failed to fetch client designs:', err);
    } finally {
      setLoadingDesigns(false);
    }
  };

  useEffect(() => {
    if (partyCode || clientData.companyCode) {
      fetchOrders();
      fetchDesigns();
    }
  }, [partyCode, clientData.companyCode]);

  // Handle client avatar upload to Cloudflare R2
  const handleAvatarSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setProfileMessage('');
    setProfileError('');

    try {
      const res = await api.uploadClientImage(file);
      const imageUrl = res.url || res.fileUrl;
      if (!imageUrl) throw new Error('Failed to get uploaded image URL');

      // Update client profile in backend
      const clientId = clientData._id || clientData.id;
      const updateRes = await api.updateClientProfile(clientId, { image: imageUrl });

      const updated = updateRes.data || { ...clientData, image: imageUrl };
      setClientData(updated);
      setProfileMessage('✅ Profile photo updated successfully and saved in Cloudflare R2!');
      setTimeout(() => setProfileMessage(''), 4000);
    } catch (err) {
      setProfileError('Failed to upload image: ' + err.message);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Password Update
  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileMessage('');

    if (!newPassword.trim()) {
      setProfileError('Please enter a new password');
      return;
    }
    if (newPassword.length < 4) {
      setProfileError('Password must be at least 4 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setProfileError('Passwords do not match');
      return;
    }

    setSavingProfile(true);
    try {
      const clientId = clientData._id || clientData.id;
      await api.updateClientProfile(clientId, { password: newPassword.trim() });
      setProfileMessage('✅ Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setProfileMessage(''), 4000);
    } catch (err) {
      setProfileError(err.message || 'Failed to update password');
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Place Order Action Handlers ──
  const handleOpenPlaceOrder = () => {
    setOrderModalError('');
    setOrderModalSuccess('');
    const defaultDesign = designs.length > 0 ? designs[0].designName : '';
    setOrderRows([
      {
        id: 1,
        date: new Date().toISOString().split('T')[0],
        designName: defaultDesign,
        pcs: '',
        note: ''
      }
    ]);
    setShowPlaceOrderModal(true);
  };

  const handleAddOrderRow = () => {
    setOrderRows(prev => [
      ...prev,
      {
        id: prev.length > 0 ? Math.max(...prev.map(r => r.id)) + 1 : 1,
        date: new Date().toISOString().split('T')[0],
        designName: designs.length > 0 ? designs[0].designName : '',
        pcs: '',
        note: ''
      }
    ]);
  };

  const handleRemoveOrderRow = (id) => {
    if (orderRows.length <= 1) return;
    setOrderRows(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateOrderRow = (id, field, val) => {
    setOrderRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  const handleSubmitOrder = async (e) => {
    e?.preventDefault?.();
    setOrderModalError('');
    setOrderModalSuccess('');

    // Validation
    for (let i = 0; i < orderRows.length; i++) {
      const row = orderRows[i];
      if (!row.designName) {
        setOrderModalError(`Row #${i + 1}: Please select a design.`);
        return;
      }
      if (!row.pcs || Number(row.pcs) <= 0) {
        setOrderModalError(`Row #${i + 1}: Please enter a valid quantity in pieces.`);
        return;
      }
    }

    setSubmittingOrder(true);
    try {
      const res = await api.placeClientBulkOrder({
        items: orderRows,
        clientInfo: {
          companyCode: partyCode,
          companyName,
          username,
          mobile
        }
      });

      const cards = res.jobCards || [];
      const jobNos = cards.map(c => c.jobNo).join(', ');
      setOrderModalSuccess(`🎉 Order placed successfully! Generated Job Card(s): ${jobNos || 'Created'}`);

      // Refresh orders immediately
      await fetchOrders();

      // Close modal after delay
      setTimeout(() => {
        setShowPlaceOrderModal(false);
        setOrderModalSuccess('');
      }, 2200);
    } catch (err) {
      setOrderModalError(err.message || 'Failed to submit order. Please try again.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Calculate order counts per workflow stage
  const orderCounts = useMemo(() => {
    const counts = { all: orders.length, 'print-pending': 0, 'fusing-pending': 0, 'delivery-pending': 0, 'delivered': 0 };
    orders.forEach(o => {
      const info = getOrderStatusInfo(o);
      if (info.key && counts[info.key] !== undefined) {
        counts[info.key]++;
      }
    });
    return counts;
  }, [orders]);

  const filteredOrders = orders.filter(o => {
    const sInfo = getOrderStatusInfo(o);
    if (orderStageFilter !== 'all' && sInfo.key !== orderStageFilter) {
      return false;
    }
    const term = searchOrder.toLowerCase().trim();
    if (!term) return true;
    return (
      (o.jobNo && o.jobNo.toLowerCase().includes(term)) ||
      (o.orderNo && o.orderNo.toLowerCase().includes(term)) ||
      (o.jobCardNo && o.jobCardNo.toLowerCase().includes(term)) ||
      (o.designName && o.designName.toLowerCase().includes(term)) ||
      (o.designNo && o.designNo.toLowerCase().includes(term)) ||
      (o.fabric && o.fabric.toLowerCase().includes(term)) ||
      (o.pcs && String(o.pcs).toLowerCase().includes(term)) ||
      (sInfo.label && sInfo.label.toLowerCase().includes(term)) ||
      (sInfo.sublabel && sInfo.sublabel.toLowerCase().includes(term)) ||
      (o.notes && o.notes.toLowerCase().includes(term))
    );
  });

  const filteredDesigns = designs.filter(d => {
    const term = searchDesign.toLowerCase().trim();
    if (!term) return true;
    return (
      (d.designName && d.designName.toLowerCase().includes(term)) ||
      (d.category && d.category.toLowerCase().includes(term)) ||
      (d.colors && d.colors.toLowerCase().includes(term)) ||
      (d.fabricName && d.fabricName.toLowerCase().includes(term)) ||
      (d.partySkuId && d.partySkuId.toLowerCase().includes(term))
    );
  });

  return (
    <div className="client-portal-container" style={styles.container}>
      <style>{`
        .client-portal-container {
          min-height: 100vh !important;
          min-height: 100dvh !important;
          height: auto !important;
          overflow-x: hidden !important;
          -webkit-overflow-scrolling: touch !important;
        }
        .client-portal-header {
          padding: 0.85rem 1.75rem;
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(30, 58, 138, 0.04);
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .client-portal-main {
          flex: 1;
          padding: 1.5rem;
          padding-bottom: 8rem !important;
          max-width: 1200px;
          width: 100%;
          margin: 0 auto;
          box-sizing: border-box;
        }
        .client-welcome-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1.15rem 1.35rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.25rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
        }
        .client-tabs-bar {
          display: inline-flex;
          background: #f1f5f9;
          padding: 3px;
          border-radius: 9px;
          gap: 3px;
          margin-bottom: 1.25rem;
          overflow-x: auto;
          border: 1px solid #e2e8f0;
          scrollbar-width: none;
          -ms-overflow-style: none;
          -webkit-overflow-scrolling: touch;
        }
        .client-tabs-bar::-webkit-scrollbar {
          display: none;
        }
        .client-table-responsive {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
        }
        .client-orders-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          min-width: 680px;
        }
        .client-orders-table th {
          background: #f8fafc;
          padding: 0.85rem 1rem;
          color: #475569;
          font-weight: 700;
          font-size: 0.74rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-bottom: 1.5px solid #e2e8f0;
          white-space: nowrap;
        }
        .client-orders-table td {
          padding: 0.8rem 1rem;
          border-bottom: 1px solid #f1f5f9;
          font-size: 0.85rem;
          color: #0f172a;
        }
        .client-table-row {
          transition: background-color 0.15s ease;
        }
        .client-table-row:hover {
          background-color: #f8fafc !important;
        }
        .client-designs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 1rem;
        }
        .client-details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 1.25rem;
          border-radius: 12px;
        }
        .client-search-input {
          font-size: 16px !important; /* Prevents auto-zoom on iOS */
          transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
        }
        .client-search-input:focus {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12) !important;
        }
        .client-search-input::placeholder {
          color: #94a3b8 !important;
          font-size: 0.84rem !important;
        }
        @media (max-width: 768px) {
          .client-portal-header {
            padding: 0.65rem 0.85rem !important;
          }
          .client-portal-main {
            padding: 0.85rem 0.75rem calc(14rem + env(safe-area-inset-bottom, 24px)) 0.75rem !important;
          }
          .client-welcome-card {
            padding: 1.15rem 1rem !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 1rem !important;
          }
          .client-welcome-stats {
            width: 100% !important;
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 0.65rem !important;
          }
          .client-orders-grid {
            grid-template-columns: 1fr !important;
          }
          .client-designs-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 0.65rem !important;
          }
          .client-design-img-box {
            height: 155px !important;
          }
          .client-design-info {
            padding: 0.65rem !important;
            gap: 0.35rem !important;
          }
          .client-details-grid {
            grid-template-columns: 1fr 1fr !important;
            padding: 0.85rem !important;
            gap: 0.65rem !important;
          }
          .hide-mobile {
            display: none !important;
          }
          .client-name-truncate {
            max-width: 110px !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            display: inline-block !important;
          }
          .client-avatar-section {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 1rem !important;
          }
        }
        @media (max-width: 420px) {
          .client-details-grid {
            grid-template-columns: 1fr !important;
          }
          .client-name-truncate {
            max-width: 80px !important;
          }
        }
      `}</style>

      {/* ── Top Navigation Bar ── */}
      <header className="client-portal-header" style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoBadge}>
            <Building2 size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={styles.brandTitle}>Elite Edition</h1>
              <span style={styles.clientTag}>CLIENT PORTAL</span>
            </div>
            <p style={styles.brandSubtitle}>Dedicated Partner Dashboard</p>
          </div>
        </div>

        <div style={styles.headerRight}>
          {/* Client Profile Pill */}
          <div style={styles.clientPill}>
            {clientData.image ? (
              <img
                src={clientData.image}
                alt={companyName || 'Client'}
                style={styles.avatarImg}
              />
            ) : (
              <div style={styles.avatarFallback}>
                <User size={16} color="#2563eb" />
              </div>
            )}
            <div style={styles.clientMeta}>
              <span className="client-name-truncate" style={styles.clientName}>{companyName || username || 'Client Partner'}</span>
              <span style={styles.clientCode}>Party: {partyCode || '—'}</span>
            </div>
          </div>

          {/* Logout button */}
          <button
            onClick={onLogout}
            style={styles.logoutBtn}
            title="Sign out from Client Portal"
          >
            <LogOut size={16} />
            <span className="hide-mobile">Sign Out</span>
          </button>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="client-portal-main" style={styles.main}>
        {/* Welcome Banner */}
        <div className="client-welcome-card" style={styles.welcomeCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            <div style={styles.welcomeAvatarWrap}>
              {clientData.image ? (
                <img src={clientData.image} alt="Logo" style={styles.welcomeAvatar} />
              ) : (
                <Building2 size={24} color="#2563eb" />
              )}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={styles.welcomeHeading}>{companyName || username || 'Valued Partner'}</h2>
                <span style={styles.activePill}>Active Partner</span>
              </div>
              <div style={styles.welcomeDetailsRow}>
                {partyCode && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Shield size={12} color="#2563eb" />
                    <span>Party: <strong style={{ color: '#1d4ed8' }}>{partyCode}</strong></span>
                  </span>
                )}
                {mobile && (
                  <>
                    <span style={{ color: '#cbd5e1' }}>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Phone size={12} color="#64748b" />
                      <span>{mobile}</span>
                    </span>
                  </>
                )}
                {username && (
                  <>
                    <span style={{ color: '#cbd5e1' }}>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <User size={12} color="#64748b" />
                      <span>@{username}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="client-welcome-stats" style={styles.quickStatsRow}>
            <div style={styles.statBox}>
              <span style={styles.statNumber}>{orders.length}</span>
              <span style={styles.statLabel}>Orders</span>
            </div>
            <div style={styles.statBox}>
              <span style={{ ...styles.statNumber, color: '#475569' }}>{designs.length}</span>
              <span style={styles.statLabel}>Designs</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="client-tabs-bar" style={styles.tabsContainer}>
          <button
            style={activeTab === 'orders' ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab('orders')}
          >
            <Package size={15} />
            <span>Orders ({orders.length})</span>
          </button>

          <button
            style={activeTab === 'designs' ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab('designs')}
          >
            <Palette size={15} />
            <span>Designs ({designs.length})</span>
          </button>

          <button
            style={activeTab === 'profile' ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab('profile')}
          >
            <User size={15} />
            <span>Company Profile</span>
          </button>
        </div>

        {/* ── TAB 1: Live Orders & Job Cards ── */}
        {activeTab === 'orders' && (
          <div style={styles.tabContent}>
            {/* Minimal Toolbar */}
            <div style={styles.toolbarRow}>
              <div style={styles.searchBox}>
                <Search size={15} color="#94a3b8" style={styles.searchIcon} />
                <input
                  type="text"
                  value={searchOrder}
                  onChange={(e) => setSearchOrder(e.target.value)}
                  placeholder="Search job no, design, fabric, quantity..."
                  className="client-search-input"
                  style={styles.searchInput}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleOpenPlaceOrder}
                  style={styles.placeOrderBtn}
                  title="Place a new order with auto-generated Job Cards"
                >
                  <PlusCircle size={15} />
                  <span>Place Order</span>
                </button>

                <button
                  onClick={fetchOrders}
                  disabled={loadingOrders}
                  style={styles.refreshBtn}
                  title="Refresh Orders"
                >
                  <RefreshCw size={13} className={loadingOrders ? 'spin' : ''} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Stage Filter Pills */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { id: 'all', label: 'All Orders', count: orderCounts.all, dot: '#2563eb' },
                { id: 'print-pending', label: 'Print Pending', count: orderCounts['print-pending'], dot: '#d97706' },
                { id: 'fusing-pending', label: 'Fusing Pending', count: orderCounts['fusing-pending'], dot: '#7c3aed' },
                { id: 'delivery-pending', label: 'Delivery Pending', count: orderCounts['delivery-pending'], dot: '#0284c7' },
                { id: 'delivered', label: 'Delivered', count: orderCounts['delivered'], dot: '#16a34a' }
              ].map((pill) => {
                const isSelected = orderStageFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setOrderStageFilter(pill.id)}
                    style={{
                      border: isSelected ? '1px solid #2563eb' : '1px solid #e2e8f0',
                      background: isSelected ? '#2563eb' : '#ffffff',
                      color: isSelected ? '#ffffff' : '#475569',
                      padding: '0.32rem 0.72rem',
                      borderRadius: '20px',
                      fontSize: '0.78rem',
                      fontWeight: isSelected ? 600 : 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 1px 3px rgba(37,99,235,0.25)' : 'none'
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: isSelected ? '#ffffff' : pill.dot,
                        display: 'inline-block'
                      }}
                    />
                    <span>{pill.label}</span>
                    <span
                      style={{
                        background: isSelected ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                        color: isSelected ? '#ffffff' : '#64748b',
                        fontSize: '0.68rem',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontWeight: 700
                      }}
                    >
                      {pill.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {loadingOrders ? (
              <div style={styles.emptyState}>
                <div className="spinner" style={{ margin: '0 auto 1rem auto' }} />
                <p>Loading your orders...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div style={styles.emptyState}>
                <Package size={42} color="#94a3b8" style={{ opacity: 0.7, marginBottom: '0.8rem' }} />
                <h4 style={{ margin: '0 0 0.3rem 0', color: '#0f172a' }}>No Orders Found</h4>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
                  {searchOrder ? 'No orders match your search term.' : `No orders currently assigned to "${partyCode}".`}
                </p>
              </div>
            ) : (
              <div className="client-table-responsive">
                <table className="client-orders-table">
                  <thead>
                    <tr>
                      <th>Order / Job No</th>
                      <th>Date</th>
                      <th>Design Name</th>
                      <th>Fabric</th>
                      <th>Quantity (Pcs)</th>
                      <th>Status</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((ord, idx) => {
                      const statusInfo = getOrderStatusInfo(ord);
                      const pcsVal = (ord.pcs !== undefined && ord.pcs !== null && String(ord.pcs).trim() !== '')
                        ? String(ord.pcs).trim()
                        : ((ord.pieces !== undefined && ord.pieces !== null && String(ord.pieces).trim() !== '') ? String(ord.pieces).trim() : '');
                      const qtyStr = pcsVal ? `${pcsVal} Pcs` : (ord.totalMtr ? `${ord.totalMtr} Mtrs` : '—');
                      const displayJobNo = ord.jobNo || ord.orderNo || ord.jobCardNo || `JC-${idx + 1}`;
                      const displayDesign = ord.designName || ord.designNo || '—';
                      return (
                        <tr key={ord._id || ord.id || idx} className="client-table-row">
                          <td style={{ fontWeight: 800 }}>
                            <span style={{ color: '#1d4ed8', letterSpacing: '0.02em' }}>{displayJobNo}</span>
                          </td>
                          <td style={{ color: '#64748b', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {formatDateDDMMYYYY(ord.created_date_time || ord.createdAt || ord.date)}
                          </td>
                          <td style={{ fontWeight: 700, color: '#0f172a' }}>
                            {displayDesign}
                          </td>
                          <td style={{ color: '#475569' }}>
                            {ord.fabric || '—'}
                          </td>
                          <td style={{ fontWeight: 800, color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                            {qtyStr}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                              <span style={{
                                ...styles.statusBadge,
                                background: statusInfo.badgeBg,
                                color: statusInfo.text,
                                border: `1px solid ${statusInfo.border}`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontWeight: 700,
                                fontSize: '0.78rem'
                              }}>
                                <span style={{
                                  width: '7px',
                                  height: '7px',
                                  borderRadius: '50%',
                                  backgroundColor: statusInfo.dotColor,
                                  display: 'inline-block'
                                }}></span>
                                {statusInfo.label}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>
                                {statusInfo.sublabel}
                              </span>
                            </div>
                          </td>
                          <td style={{ color: '#64748b', fontSize: '0.8rem', maxWidth: '240px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                            <div>{ord.notes || ord.note1 || ord.emergencyNotes || '—'}</div>
                            {String(ord.createdBy || ord.createdByName || '').toLowerCase().includes('client') && (
                              <div style={{ marginTop: '4px' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '0.68rem',
                                  fontWeight: 600,
                                  color: '#0369a1',
                                  background: '#e0f2fe',
                                  border: '1px solid #bae6fd',
                                  padding: '1px 6px',
                                  borderRadius: '6px'
                                }}>
                                  📱 {ord.createdByName || ord.createdBy}
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: Design Catalogue ── */}
        {activeTab === 'designs' && (
          <div style={styles.tabContent}>
            <div style={styles.toolbarRow}>
              <div style={styles.searchBox}>
                <Search size={15} color="#64748b" style={styles.searchIcon} />
                <input
                  type="text"
                  value={searchDesign}
                  onChange={(e) => setSearchDesign(e.target.value)}
                  placeholder="Search design name, color, fabric, category..."
                  className="client-search-input"
                  style={styles.searchInput}
                />
              </div>

              <button
                onClick={fetchDesigns}
                disabled={loadingDesigns}
                style={styles.refreshBtn}
                title="Refresh Designs"
              >
                <RefreshCw size={14} className={loadingDesigns ? 'spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingDesigns ? (
              <div style={styles.emptyState}>
                <div className="spinner" style={{ margin: '0 auto 1rem auto' }} />
                <p>Loading your assigned designs...</p>
              </div>
            ) : filteredDesigns.length === 0 ? (
              <div style={styles.emptyState}>
                <Palette size={42} color="#94a3b8" style={{ opacity: 0.7, marginBottom: '0.8rem' }} />
                <h4 style={{ margin: '0 0 0.3rem 0', color: '#0f172a' }}>No Catalogue Designs Found</h4>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
                  {searchDesign ? 'No designs match your search term.' : `No catalogue designs tagged for party "${partyCode}".`}
                </p>
              </div>
            ) : (
              <div className="client-designs-grid" style={styles.designsGrid}>
                {filteredDesigns.map((d) => {
                  const dName = String(d.designName || '').trim().toLowerCase();
                  const matchingOrders = orders.filter(o => {
                    const oName = String(o.designName || o.designNo || '').trim().toLowerCase();
                    return oName && (oName === dName || oName.includes(dName) || dName.includes(oName));
                  });
                  const totalPcs = matchingOrders.reduce((sum, o) => {
                    const pcs = Number(o.pcs) || Number(o.pieces) || 0;
                    return sum + pcs;
                  }, 0);
                  const fabricDisplay = d.fabricName || matchingOrders[0]?.fabric || '';
                  return (
                    <div key={d._id || d.id} style={styles.designCard}>
                      {/* Design Image */}
                      <div
                        className="client-design-img-box"
                        style={styles.designImgBox}
                        onClick={() => d.imageUrl && setZoomImg(d.imageUrl)}
                      >
                        <DesignImage
                          rawUrl={d.imageUrl}
                          designName={d.designName}
                          category={d.category}
                          onZoom={(src) => setZoomImg(src)}
                          style={{ width: '100%', height: '100%' }}
                        />
                      </div>

                      <div className="client-design-info" style={styles.designInfo}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                          <span style={styles.designTitle}>{d.designName}</span>
                          {d.category && (
                            <span style={styles.designCat}>{d.category}</span>
                          )}
                        </div>

                        <div style={styles.designMetaGrid}>
                          {fabricDisplay && (
                            <div>
                              <span style={styles.metaLabel}>Fabric</span>
                              <span style={styles.metaVal}>{fabricDisplay}</span>
                            </div>
                          )}
                          {d.colors && (
                            <div>
                              <span style={styles.metaLabel}>Colors</span>
                              <span style={styles.metaVal}>{d.colors}</span>
                            </div>
                          )}
                          {d.panna && (
                            <div>
                              <span style={styles.metaLabel}>Width</span>
                              <span style={styles.metaVal}>{d.panna}"</span>
                            </div>
                          )}
                          {matchingOrders.length > 0 && (
                            <div>
                              <span style={styles.metaLabel}>Orders</span>
                              <span style={{ ...styles.metaVal, color: '#1d4ed8' }}>
                                {matchingOrders.length} {matchingOrders.length === 1 ? 'Order' : 'Orders'} {totalPcs > 0 ? `(${totalPcs} pcs)` : ''}
                              </span>
                            </div>
                          )}
                          {d.partySkuId && (
                            <div>
                              <span style={styles.metaLabel}>Party SKU</span>
                              <span style={{ ...styles.metaVal, color: '#2563eb' }}>{d.partySkuId}</span>
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px dashed #e2e8f0' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '6px' }}>
                            Party: {partyCode || 'VG'}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 500 }}>
                            {matchingOrders.length > 0 ? `${matchingOrders.length} active orders` : (d.department ? d.department.replace('_', ' ') : 'Catalog Design')}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: Company Profile & Settings ── */}
        {activeTab === 'profile' && (
          <div style={styles.tabContent}>
            <div style={styles.profileCard}>
              <h3 style={styles.profileSectionHeading}>
                <Building2 size={18} color="#2563eb" />
                <span>Company Profile & Logo</span>
              </h3>

              {profileMessage && (
                <div style={styles.alertSuccess}>
                  <CheckCircle2 size={16} color="#2563eb" />
                  <span>{profileMessage}</span>
                </div>
              )}

              {profileError && (
                <div style={styles.alertDanger}>
                  <AlertCircle size={16} color="#dc2626" />
                  <span>{profileError}</span>
                </div>
              )}

              {/* Logo / Avatar Upload */}
              <div className="client-avatar-section" style={styles.avatarSection}>
                <div style={styles.avatarLargeWrap}>
                  {clientData.image ? (
                    <img src={clientData.image} alt="Logo" style={styles.avatarLarge} />
                  ) : (
                    <Building2 size={48} color="#94a3b8" />
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1rem' }}>Company Logo / Avatar</h4>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleAvatarSelect}
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    style={styles.uploadBtn}
                  >
                    <Camera size={15} />
                    <span>{uploadingAvatar ? 'Uploading to R2...' : 'Change Profile Picture'}</span>
                  </button>
                </div>
              </div>

              {/* Company Details Read-Only Grid */}
              <div className="client-details-grid" style={styles.detailsGrid}>
                <div style={styles.detailItem}>
                  <label style={styles.detailLabel}>Company Name</label>
                  <div style={styles.detailVal}>{companyName || '—'}</div>
                </div>

                <div style={styles.detailItem}>
                  <label style={styles.detailLabel}>Assigned Party Code</label>
                  <div style={{ ...styles.detailVal, color: '#1d4ed8', fontWeight: 800 }}>{partyCode || '—'}</div>
                </div>

                <div style={styles.detailItem}>
                  <label style={styles.detailLabel}>Registered Mobile</label>
                  <div style={styles.detailVal}>{mobile || '—'}</div>
                </div>

                <div style={styles.detailItem}>
                  <label style={styles.detailLabel}>Username</label>
                  <div style={styles.detailVal}>{username ? `@${username}` : '—'}</div>
                </div>
              </div>

              {/* Change Password Form */}
              <div style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Key size={16} color="#2563eb" />
                  <span>Update Account Password</span>
                </h4>

                <form onSubmit={handlePasswordUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={styles.formLabel}>New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="client-search-input"
                      style={styles.formInput}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={styles.formLabel}>Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="client-search-input"
                      style={styles.formInput}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingProfile}
                    style={styles.savePasswordBtn}
                  >
                    {savingProfile ? 'Saving...' : 'Update Password'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Place Order Multi-Entry Modal ── */}
      {showPlaceOrderModal && (
        <div style={styles.modalOverlay} onClick={() => !submittingOrder && setShowPlaceOrderModal(false)}>
          <div style={styles.orderModalContainer} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={styles.orderModalHeader}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={styles.orderModalTitle}>Place New Order</h3>
                  <span style={styles.partyBadgePill}>Party: {partyCode || 'VG'}</span>
                </div>
                <p style={styles.orderModalSubtitle}>
                  Enter order details below. Auto-generated Job Cards will be created for each design.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !submittingOrder && setShowPlaceOrderModal(false)}
                style={styles.modalCloseBtn}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error & Success alerts */}
            {orderModalError && (
              <div style={styles.alertDanger}>
                <AlertCircle size={16} />
                <span>{orderModalError}</span>
              </div>
            )}
            {orderModalSuccess && (
              <div style={styles.alertSuccess}>
                <CheckCircle2 size={16} />
                <span>{orderModalSuccess}</span>
              </div>
            )}

            {/* Multi-Entry Form */}
            <form onSubmit={handleSubmitOrder}>
              <div style={styles.orderEntriesTableWrapper}>
                <table style={styles.orderEntriesTable}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                      <th style={{ width: '45px', textAlign: 'center', padding: '0.65rem 0.5rem', fontSize: '0.72rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>ID</th>
                      <th style={{ width: '135px', padding: '0.65rem 0.5rem', fontSize: '0.72rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>Date</th>
                      <th style={{ minWidth: '220px', padding: '0.65rem 0.5rem', fontSize: '0.72rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>Design No. (Assigned)</th>
                      <th style={{ width: '120px', padding: '0.65rem 0.5rem', fontSize: '0.72rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>Quantity (Pcs)</th>
                      <th style={{ padding: '0.65rem 0.5rem', fontSize: '0.72rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>Note</th>
                      <th style={{ width: '45px', textAlign: 'center', padding: '0.65rem 0.5rem' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderRows.map((row, idx) => {
                      const selectedDesignDoc = designs.find(d => d.designName === row.designName);
                      return (
                        <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          {/* Auto ID */}
                          <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748b', fontSize: '0.8rem', padding: '0.5rem' }}>
                            #{idx + 1}
                          </td>

                          {/* Date (default today) */}
                          <td style={{ padding: '0.5rem' }}>
                            <input
                              type="date"
                              value={row.date}
                              onChange={(e) => handleUpdateOrderRow(row.id, 'date', e.target.value)}
                              style={styles.modalInput}
                              required
                            />
                          </td>

                          {/* Design No. (Assigned to them) */}
                          <td style={{ padding: '0.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <select
                                value={row.designName}
                                onChange={(e) => handleUpdateOrderRow(row.id, 'designName', e.target.value)}
                                style={styles.modalSelect}
                                required
                              >
                                <option value="">-- Choose Assigned Design --</option>
                                {designs.map((d) => (
                                  <option key={d._id || d.id || d.designName} value={d.designName}>
                                    {d.designName} {d.category ? `[${d.category}]` : ''} {d.fabricName ? `- ${d.fabricName}` : ''}
                                  </option>
                                ))}
                              </select>

                              {selectedDesignDoc && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#64748b' }}>
                                  {selectedDesignDoc.category && (
                                    <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                      {selectedDesignDoc.category}
                                    </span>
                                  )}
                                  {selectedDesignDoc.fabricName && <span>Fabric: {selectedDesignDoc.fabricName}</span>}
                                  {selectedDesignDoc.colors && <span>• Color: {selectedDesignDoc.colors}</span>}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Pcs */}
                          <td style={{ padding: '0.5rem' }}>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              placeholder="e.g. 50"
                              value={row.pcs}
                              onChange={(e) => handleUpdateOrderRow(row.id, 'pcs', e.target.value)}
                              style={styles.modalInput}
                              required
                            />
                          </td>

                          {/* Note */}
                          <td style={{ padding: '0.5rem' }}>
                            <input
                              type="text"
                              placeholder="Notes (optional)"
                              value={row.note}
                              onChange={(e) => handleUpdateOrderRow(row.id, 'note', e.target.value)}
                              style={styles.modalInput}
                            />
                          </td>

                          {/* Remove Action */}
                          <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveOrderRow(row.id)}
                              disabled={orderRows.length <= 1}
                              style={{
                                ...styles.rowDeleteBtn,
                                opacity: orderRows.length <= 1 ? 0.3 : 1,
                                cursor: orderRows.length <= 1 ? 'not-allowed' : 'pointer'
                              }}
                              title="Delete row"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add Row Button */}
              <div style={{ marginTop: '0.85rem' }}>
                <button
                  type="button"
                  onClick={handleAddOrderRow}
                  style={styles.addOrderRowBtn}
                >
                  <Plus size={14} />
                  <span>Add Another Design</span>
                </button>
              </div>

              {/* Modal Footer */}
              <div style={styles.orderModalFooter}>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  <span>Total Items: <strong style={{ color: '#0f172a' }}>{orderRows.length}</strong></span>
                  <span style={{ margin: '0 8px' }}>•</span>
                  <span>Total Pieces: <strong style={{ color: '#1d4ed8' }}>
                    {orderRows.reduce((sum, r) => sum + (Number(r.pcs) || 0), 0)} Pcs
                  </strong></span>
                </div>

                <div style={{ display: 'flex', gap: '0.65rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowPlaceOrderModal(false)}
                    disabled={submittingOrder}
                    style={styles.cancelBtn}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submittingOrder}
                    style={styles.submitOrderBtn}
                  >
                    {submittingOrder ? (
                      <>
                        <RefreshCw size={14} className="spin" />
                        <span>Creating Job Cards...</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>Submit Order ({orderRows.length} {orderRows.length === 1 ? 'item' : 'items'})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomImg && (
        <div style={styles.zoomOverlay} onClick={() => setZoomImg(null)}>
          <div style={styles.zoomContent} onClick={(e) => e.stopPropagation()}>
            <img src={zoomImg} alt="Zoomed view" style={styles.zoomedImg} />
            <button style={styles.closeZoomBtn} onClick={() => setZoomImg(null)}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Helpers: Determine exact factory workflow stage for client order
export function getOrderStatusInfo(ord = {}) {
  const pStatus = String(ord.printStatus || '').toLowerCase().trim();
  const fStatus = String(ord.fusingStatus || '').toLowerCase().trim();
  const dStatus = String(ord.deliveryStatus || '').toLowerCase().trim();
  const genStatus = String(ord.status || '').toLowerCase().trim();

  // 1. Delivered / Delivery Done (Must explicitly have 'done' and NOT 'pending')
  const isDeliveryDone = 
    dStatus === 'delivery done' || 
    dStatus === 'delivered' || 
    (dStatus.includes('done') && !dStatus.includes('pending')) || 
    (genStatus === 'done' && !dStatus.includes('pending') && !fStatus.includes('pending'));

  if (isDeliveryDone) {
    return {
      key: 'delivered',
      label: 'Delivered',
      sublabel: 'Delivery Done',
      badgeBg: '#dcfce7',
      text: '#15803d',
      border: '#86efac',
      dotColor: '#16a34a'
    };
  }

  // 2. Fusing Done -> Waiting for delivery (Delivery Pending)
  const isFusingDone = fStatus === 'fusing done' || (fStatus.includes('done') && !fStatus.includes('pending'));
  if (isFusingDone) {
    return {
      key: 'delivery-pending',
      label: 'Delivery Pending',
      sublabel: 'Fusing Done • Ready for Delivery',
      badgeBg: '#eff6ff',
      text: '#1d4ed8',
      border: '#bfdbfe',
      dotColor: '#2563eb'
    };
  }

  // 3. Printing Done -> In fusing queue (Fusing Pending)
  const isPrintDone = pStatus === 'printing done' || (pStatus.includes('done') && !pStatus.includes('pending'));
  if (isPrintDone) {
    return {
      key: 'fusing-pending',
      label: 'Fusing Pending',
      sublabel: 'Print Done • In Fusing Queue',
      badgeBg: '#f5f3ff',
      text: '#6d28d9',
      border: '#ddd6fe',
      dotColor: '#7c3aed'
    };
  }

  // 4. Default: Printing not yet done (Print Pending)
  return {
    key: 'print-pending',
    label: 'Print Pending',
    sublabel: 'In Printing Queue',
    badgeBg: '#fffbeb',
    text: '#b45309',
    border: '#fde68a',
    dotColor: '#d97706'
  };
}

const styles = {
  container: {
    height: 'auto',
    minHeight: '100dvh',
    overflowX: 'hidden',
    background: '#f8fafc',
    color: '#0f172a',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    padding: '0.9rem 1.75rem',
    background: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    boxShadow: '0 2px 8px rgba(30, 58, 138, 0.04)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 100
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.9rem'
  },
  logoBadge: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
  },
  brandTitle: {
    margin: 0,
    fontSize: '1.15rem',
    fontWeight: 800,
    color: '#0f172a'
  },
  clientTag: {
    fontSize: '0.62rem',
    fontWeight: 800,
    padding: '2px 7px',
    borderRadius: '6px',
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    letterSpacing: '0.04em'
  },
  brandSubtitle: {
    margin: 0,
    fontSize: '0.72rem',
    color: '#64748b'
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem'
  },
  clientPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    background: '#f8fafc',
    padding: '0.35rem 0.75rem',
    borderRadius: '30px',
    border: '1px solid #e2e8f0'
  },
  avatarImg: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '1.5px solid #bfdbfe'
  },
  avatarFallback: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    background: '#dbeafe',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  clientMeta: {
    display: 'flex',
    flexDirection: 'column'
  },
  clientName: {
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#0f172a',
    lineHeight: 1.1
  },
  clientCode: {
    fontSize: '0.68rem',
    color: '#64748b'
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.45rem 0.85rem',
    borderRadius: '8px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    transition: 'all 0.15s ease'
  },
  main: {
    flex: 1,
    padding: '1.5rem',
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box'
  },
  welcomeCard: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '1.15rem 1.35rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1rem',
    marginBottom: '1.25rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
  },
  welcomeAvatarWrap: {
    width: '46px',
    height: '46px',
    borderRadius: '10px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0
  },
  welcomeAvatar: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  welcomeHeading: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0
  },
  activePill: {
    fontSize: '0.68rem',
    fontWeight: 600,
    background: '#f0fdf4',
    color: '#16a34a',
    padding: '2px 8px',
    borderRadius: '10px',
    border: '1px solid #bbf7d0'
  },
  welcomeDetailsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    fontSize: '0.8rem',
    color: '#64748b',
    marginTop: '0.35rem',
    flexWrap: 'wrap'
  },
  quickStatsRow: {
    display: 'flex',
    gap: '0.75rem'
  },
  statBox: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '0.5rem 1rem',
    textAlign: 'center',
    minWidth: '80px'
  },
  statNumber: {
    display: 'block',
    fontSize: '1.3rem',
    fontWeight: 700,
    color: '#1d4ed8',
    lineHeight: 1.1
  },
  statLabel: {
    fontSize: '0.66rem',
    color: '#64748b',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginTop: '2px'
  },
  tabsContainer: {
    display: 'inline-flex',
    background: '#f1f5f9',
    padding: '3px',
    borderRadius: '9px',
    gap: '3px',
    marginBottom: '1.25rem',
    overflowX: 'auto',
    border: '1px solid #e2e8f0'
  },
  tab: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.45rem 1rem',
    borderRadius: '7px',
    background: 'transparent',
    border: 'none',
    color: '#64748b',
    fontSize: '0.84rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap'
  },
  tabActive: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.45rem 1rem',
    borderRadius: '7px',
    background: '#ffffff',
    border: 'none',
    color: '#1d4ed8',
    fontSize: '0.84rem',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
    whiteSpace: 'nowrap'
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem'
  },
  toolbarRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap'
  },
  searchBox: {
    position: 'relative',
    width: '100%',
    maxWidth: '380px'
  },
  searchIcon: {
    position: 'absolute',
    left: '11px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none'
  },
  searchInput: {
    width: '100%',
    height: '38px',
    padding: '0 12px 0 34px',
    borderRadius: '8px',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    color: '#0f172a',
    fontSize: '0.85rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
  },
  refreshBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    height: '38px',
    padding: '0 14px',
    borderRadius: '8px',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    color: '#334155',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  placeOrderBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    height: '38px',
    padding: '0 15px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: '#ffffff',
    border: 'none',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    padding: '1rem',
    overflowY: 'auto'
  },
  orderModalContainer: {
    background: '#ffffff',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '880px',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '1.5rem',
    boxShadow: '0 20px 60px rgba(15, 23, 42, 0.25)',
    border: '1px solid #e2e8f0'
  },
  orderModalHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '1rem',
    borderBottom: '1px solid #f1f5f9',
    paddingBottom: '0.85rem'
  },
  orderModalTitle: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#0f172a'
  },
  orderModalSubtitle: {
    margin: '4px 0 0 0',
    fontSize: '0.8rem',
    color: '#64748b'
  },
  partyBadgePill: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#1d4ed8',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    padding: '2px 8px',
    borderRadius: '6px'
  },
  modalCloseBtn: {
    background: '#f1f5f9',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  orderEntriesTableWrapper: {
    overflowX: 'auto',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    background: '#ffffff'
  },
  orderEntriesTable: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    minWidth: '650px'
  },
  modalInput: {
    width: '100%',
    padding: '0.45rem 0.65rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '0.82rem',
    color: '#0f172a',
    outline: 'none',
    boxSizing: 'border-box'
  },
  modalSelect: {
    width: '100%',
    padding: '0.45rem 0.65rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '0.82rem',
    color: '#0f172a',
    outline: 'none',
    background: '#ffffff',
    boxSizing: 'border-box'
  },
  rowDeleteBtn: {
    background: '#fee2e2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    borderRadius: '6px',
    padding: '5px 8px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  addOrderRowBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '0.45rem 0.85rem',
    borderRadius: '8px',
    background: '#f8fafc',
    border: '1.5px dashed #cbd5e1',
    color: '#2563eb',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer'
  },
  orderModalFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '1.5rem',
    borderTop: '1px solid #f1f5f9',
    paddingTop: '1rem',
    flexWrap: 'wrap',
    gap: '1rem'
  },
  cancelBtn: {
    padding: '0.55rem 1.1rem',
    borderRadius: '8px',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    color: '#475569',
    fontSize: '0.84rem',
    fontWeight: 600,
    cursor: 'pointer'
  },
  submitOrderBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '0.55rem 1.25rem',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    border: 'none',
    color: '#ffffff',
    fontSize: '0.84rem',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
  },
  emptyState: {
    padding: '3rem 1.5rem',
    textAlign: 'center',
    background: '#ffffff',
    border: '1.5px dashed #cbd5e1',
    borderRadius: '16px'
  },
  ordersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '1rem'
  },
  orderCard: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '1.1rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    boxShadow: '0 4px 14px rgba(30, 58, 138, 0.05)'
  },
  orderCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  orderNo: {
    display: 'block',
    fontSize: '0.98rem',
    fontWeight: 800,
    color: '#0f172a'
  },
  orderDate: {
    fontSize: '0.72rem',
    color: '#64748b'
  },
  statusBadge: {
    fontSize: '0.7rem',
    fontWeight: 800,
    padding: '3px 8px',
    borderRadius: '6px'
  },
  orderBody: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem',
    background: '#f8fafc',
    border: '1px solid #f1f5f9',
    padding: '0.65rem 0.85rem',
    borderRadius: '10px'
  },
  orderField: {
    display: 'flex',
    flexDirection: 'column'
  },
  fieldLabel: {
    fontSize: '0.65rem',
    color: '#64748b',
    textTransform: 'uppercase'
  },
  fieldValue: {
    fontSize: '0.84rem',
    fontWeight: 600,
    color: '#0f172a'
  },
  orderNotes: {
    fontSize: '0.75rem',
    color: '#475569',
    fontStyle: 'italic',
    borderTop: '1px dashed #e2e8f0',
    paddingTop: '0.4rem'
  },
  designsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '1rem'
  },
  designCard: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 14px rgba(30, 58, 138, 0.05)'
  },
  designImgBox: {
    height: '180px',
    background: '#f1f5f9',
    cursor: 'pointer',
    position: 'relative'
  },
  designInfo: {
    padding: '0.9rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  designTitle: {
    fontSize: '0.95rem',
    fontWeight: 800,
    color: '#1d4ed8'
  },
  designCat: {
    fontSize: '0.65rem',
    fontWeight: 700,
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    padding: '2px 7px',
    borderRadius: '6px'
  },
  designMetaGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.35rem',
    fontSize: '0.75rem'
  },
  metaLabel: {
    display: 'block',
    fontSize: '0.62rem',
    color: '#64748b',
    textTransform: 'uppercase'
  },
  metaVal: {
    fontWeight: 600,
    color: '#0f172a'
  },
  profileCard: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '1.75rem',
    boxShadow: '0 4px 16px rgba(30, 58, 138, 0.05)'
  },
  profileSectionHeading: {
    margin: '0 0 1.25rem 0',
    fontSize: '1.1rem',
    fontWeight: 800,
    color: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  alertSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    color: '#047857',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    fontSize: '0.85rem',
    marginBottom: '1rem'
  },
  alertDanger: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    fontSize: '0.85rem',
    marginBottom: '1rem'
  },
  avatarSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
    marginBottom: '1.5rem'
  },
  avatarLargeWrap: {
    width: '90px',
    height: '90px',
    borderRadius: '20px',
    background: '#eff6ff',
    border: '2px solid #bfdbfe',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  avatarLarge: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  uploadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.55rem 1rem',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: '#fff',
    border: 'none',
    fontSize: '0.82rem',
    fontWeight: 700,
    cursor: 'pointer',
    width: 'fit-content',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    padding: '1.25rem',
    borderRadius: '12px'
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem'
  },
  detailLabel: {
    fontSize: '0.7rem',
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: 700
  },
  detailVal: {
    fontSize: '0.92rem',
    color: '#0f172a',
    fontWeight: 600
  },
  formLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#1e293b'
  },
  formInput: {
    padding: '0.75rem 0.9rem',
    borderRadius: '10px',
    background: '#ffffff',
    border: '1.5px solid #cbd5e1',
    color: '#0f172a',
    fontSize: '16px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box'
  },
  savePasswordBtn: {
    marginTop: '0.65rem',
    padding: '0.8rem 1.25rem',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: '#fff',
    border: 'none',
    fontWeight: 700,
    fontSize: '0.92rem',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)'
  },
  zoomOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.8)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    padding: '1rem'
  },
  zoomContent: {
    position: 'relative',
    maxWidth: '90vw',
    maxHeight: '90vh'
  },
  zoomedImg: {
    maxWidth: '100%',
    maxHeight: '90vh',
    objectFit: 'contain',
    borderRadius: '12px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.4)'
  },
  closeZoomBtn: {
    position: 'absolute',
    top: '-14px',
    right: '-14px',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#ffffff',
    color: '#0f172a',
    border: '1px solid #e2e8f0',
    fontWeight: 800,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
  }
};
