import React, { useState, useEffect, useRef } from 'react';
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
  Key
} from 'lucide-react';
import DesignImage from './DesignImage';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

export default function ClientPortal({ client, onLogout }) {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'designs' | 'profile'
  const [clientData, setClientData] = useState(client || api.getClientData() || {});
  const [orders, setOrders] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingDesigns, setLoadingDesigns] = useState(false);
  const [searchOrder, setSearchOrder] = useState('');
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

  const partyCode = clientData.companyCode || clientData.companyName || '';

  // Load Client Orders
  const fetchOrders = async () => {
    if (!partyCode) return;
    setLoadingOrders(true);
    try {
      // Search by partyCode or companyName
      const res = await api.getJobCards({
        party: partyCode,
        limit: 100
      });
      const list = res?.data || (Array.isArray(res) ? res : []);
      setOrders(list);
    } catch (err) {
      console.warn('Failed to fetch client orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Load Client Designs
  const fetchDesigns = async () => {
    if (!partyCode) return;
    setLoadingDesigns(true);
    try {
      const res = await api.getDesigns({
        party: partyCode,
        limit: 100
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
    fetchOrders();
    fetchDesigns();
  }, [partyCode]);

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

  const filteredOrders = orders.filter(o => {
    const term = searchOrder.toLowerCase().trim();
    if (!term) return true;
    return (
      (o.orderNo && o.orderNo.toLowerCase().includes(term)) ||
      (o.designName && o.designName.toLowerCase().includes(term)) ||
      (o.fabric && o.fabric.toLowerCase().includes(term)) ||
      (o.status && o.status.toLowerCase().includes(term))
    );
  });

  const filteredDesigns = designs.filter(d => {
    const term = searchDesign.toLowerCase().trim();
    if (!term) return true;
    return (
      (d.designName && d.designName.toLowerCase().includes(term)) ||
      (d.category && d.category.toLowerCase().includes(term)) ||
      (d.colors && d.colors.toLowerCase().includes(term)) ||
      (d.fabricName && d.fabricName.toLowerCase().includes(term))
    );
  });

  return (
    <div style={styles.container}>
      <style>{`
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
          max-width: 1200px;
          width: 100%;
          margin: 0 auto;
          box-sizing: border-box;
        }
        .client-welcome-card {
          background: linear-gradient(135deg, #ffffff 0%, #eff6ff 100%);
          border: 1px solid #bfdbfe;
          border-radius: 16px;
          padding: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1.25rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.08);
        }
        .client-tabs-bar {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 0.5rem;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          -webkit-overflow-scrolling: touch;
        }
        .client-tabs-bar::-webkit-scrollbar {
          display: none;
        }
        .client-orders-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1rem;
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
        }
        @media (max-width: 768px) {
          .client-portal-header {
            padding: 0.65rem 0.85rem !important;
          }
          .client-portal-main {
            padding: 1rem 0.75rem !important;
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
                alt={clientData.companyName}
                style={styles.avatarImg}
              />
            ) : (
              <div style={styles.avatarFallback}>
                <User size={16} color="#2563eb" />
              </div>
            )}
            <div style={styles.clientMeta}>
              <span className="client-name-truncate" style={styles.clientName}>{clientData.companyName || clientData.username}</span>
              <span style={styles.clientCode}>Party: {partyCode}</span>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={styles.welcomeAvatarWrap}>
              {clientData.image ? (
                <img src={clientData.image} alt="Logo" style={styles.welcomeAvatar} />
              ) : (
                <Building2 size={32} color="#2563eb" />
              )}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={styles.welcomeHeading}>{clientData.companyName || clientData.username}</h2>
                <span style={styles.activePill}>Active Partner</span>
              </div>
              <div style={styles.welcomeDetailsRow}>
                <span>📱 {clientData.mobile}</span>
                <span>•</span>
                <span>🏢 Party Code: <strong>{partyCode}</strong></span>
                {clientData.username && (
                  <>
                    <span>•</span>
                    <span>👤 User: @{clientData.username}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="client-welcome-stats" style={styles.quickStatsRow}>
            <div style={styles.statBox}>
              <span style={styles.statNumber}>{orders.length}</span>
              <span style={styles.statLabel}>Total Orders</span>
            </div>
            <div style={styles.statBox}>
              <span style={styles.statNumber}>{designs.length}</span>
              <span style={styles.statLabel}>Assigned Designs</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="client-tabs-bar" style={styles.tabsContainer}>
          <button
            style={activeTab === 'orders' ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab('orders')}
          >
            <Package size={16} />
            <span>My Orders ({orders.length})</span>
          </button>

          <button
            style={activeTab === 'designs' ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab('designs')}
          >
            <Palette size={16} />
            <span>Design Catalogue ({designs.length})</span>
          </button>

          <button
            style={activeTab === 'profile' ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab('profile')}
          >
            <User size={16} />
            <span>Company Profile & Settings</span>
          </button>
        </div>

        {/* ── TAB 1: Live Orders & Job Cards ── */}
        {activeTab === 'orders' && (
          <div style={styles.tabContent}>
            <div style={styles.toolbarRow}>
              <div style={styles.searchBox}>
                <Search size={15} color="#64748b" style={styles.searchIcon} />
                <input
                  type="text"
                  value={searchOrder}
                  onChange={(e) => setSearchOrder(e.target.value)}
                  placeholder="Search order number, design, fabric..."
                  className="client-search-input"
                  style={styles.searchInput}
                />
              </div>

              <button
                onClick={fetchOrders}
                disabled={loadingOrders}
                style={styles.refreshBtn}
                title="Refresh Orders"
              >
                <RefreshCw size={14} className={loadingOrders ? 'spin' : ''} />
                <span>Refresh</span>
              </button>
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
              <div className="client-orders-grid" style={styles.ordersGrid}>
                {filteredOrders.map((ord) => {
                  const statusColor = getStatusColor(ord.status);
                  return (
                    <div key={ord._id || ord.id} style={styles.orderCard}>
                      <div style={styles.orderCardHeader}>
                        <div>
                          <span style={styles.orderNo}>{ord.orderNo || 'Job Card'}</span>
                          <span style={styles.orderDate}>{formatDateDDMMYYYY(ord.created_date_time || ord.createdAt)}</span>
                        </div>
                        <span style={{
                          ...styles.statusBadge,
                          background: statusColor.bg,
                          color: statusColor.text,
                          border: `1px solid ${statusColor.border}`
                        }}>
                          {ord.status || 'In Process'}
                        </span>
                      </div>

                      <div style={styles.orderBody}>
                        {ord.designName && (
                          <div style={styles.orderField}>
                            <span style={styles.fieldLabel}>Design Name</span>
                            <span style={styles.fieldValue}>{ord.designName}</span>
                          </div>
                        )}
                        {ord.fabric && (
                          <div style={styles.orderField}>
                            <span style={styles.fieldLabel}>Fabric</span>
                            <span style={styles.fieldValue}>{ord.fabric}</span>
                          </div>
                        )}
                        {ord.totalMtr ? (
                          <div style={styles.orderField}>
                            <span style={styles.fieldLabel}>Quantity</span>
                            <span style={{ ...styles.fieldValue, color: '#1d4ed8', fontWeight: 800 }}>
                              {ord.totalMtr} Mtrs
                            </span>
                          </div>
                        ) : ord.pcs ? (
                          <div style={styles.orderField}>
                            <span style={styles.fieldLabel}>Quantity</span>
                            <span style={{ ...styles.fieldValue, color: '#1d4ed8', fontWeight: 800 }}>
                              {ord.pcs} Pcs
                            </span>
                          </div>
                        ) : null}
                      </div>

                      {ord.notes && (
                        <div style={styles.orderNotes}>
                          <span>Notes:</span> {ord.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
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
                {filteredDesigns.map((d) => (
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={styles.designTitle}>{d.designName}</span>
                        {d.category && (
                          <span style={styles.designCat}>{d.category}</span>
                        )}
                      </div>

                      <div style={styles.designMetaGrid}>
                        {d.fabricName && (
                          <div>
                            <span style={styles.metaLabel}>Fabric</span>
                            <span style={styles.metaVal}>{d.fabricName}</span>
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
                        {d.partySkuId && (
                          <div>
                            <span style={styles.metaLabel}>Party SKU</span>
                            <span style={{ ...styles.metaVal, color: '#60a5fa' }}>{d.partySkuId}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1rem' }}>Company Logo / Avatar</h4>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>
                    Upload your official company logo. Stored securely on Cloudflare R2.
                  </p>

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
                  <div style={styles.detailVal}>{clientData.companyName || '—'}</div>
                </div>

                <div style={styles.detailItem}>
                  <label style={styles.detailLabel}>Assigned Party Code</label>
                  <div style={{ ...styles.detailVal, color: '#1d4ed8', fontWeight: 800 }}>{partyCode || '—'}</div>
                </div>

                <div style={styles.detailItem}>
                  <label style={styles.detailLabel}>Registered Mobile</label>
                  <div style={styles.detailVal}>{clientData.mobile || '—'}</div>
                </div>

                <div style={styles.detailItem}>
                  <label style={styles.detailLabel}>Username</label>
                  <div style={styles.detailVal}>@{clientData.username || '—'}</div>
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

// Helpers
function getStatusColor(status = '') {
  const s = String(status).toLowerCase();
  if (s.includes('complete') || s.includes('dispatch') || s.includes('deliver')) {
    return { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' };
  }
  if (s.includes('print') || s.includes('stitch') || s.includes('process')) {
    return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' };
  }
  if (s.includes('pend') || s.includes('hold')) {
    return { bg: '#fffbeb', text: '#b45309', border: '#fde68a' };
  }
  return { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' };
}

const styles = {
  container: {
    minHeight: '100vh',
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
    background: 'linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)',
    border: '1px solid #bfdbfe',
    borderRadius: '16px',
    padding: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1.25rem',
    marginBottom: '1.5rem',
    boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.08)'
  },
  welcomeAvatarWrap: {
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    background: '#dbeafe',
    border: '1.5px solid #93c5fd',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  welcomeAvatar: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  welcomeHeading: {
    fontSize: '1.35rem',
    fontWeight: 800,
    color: '#0f172a',
    margin: 0
  },
  activePill: {
    fontSize: '0.68rem',
    fontWeight: 700,
    background: '#eff6ff',
    color: '#1d4ed8',
    padding: '2px 8px',
    borderRadius: '12px',
    border: '1px solid #bfdbfe'
  },
  welcomeDetailsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.82rem',
    color: '#64748b',
    marginTop: '0.35rem',
    flexWrap: 'wrap'
  },
  quickStatsRow: {
    display: 'flex',
    gap: '0.85rem'
  },
  statBox: {
    background: '#ffffff',
    border: '1px solid #dbeafe',
    borderRadius: '12px',
    padding: '0.75rem 1.25rem',
    textAlign: 'center',
    minWidth: '85px',
    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.05)'
  },
  statNumber: {
    display: 'block',
    fontSize: '1.45rem',
    fontWeight: 800,
    color: '#1d4ed8'
  },
  statLabel: {
    fontSize: '0.7rem',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  tabsContainer: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1.25rem',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '0.5rem',
    overflowX: 'auto'
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.65rem 1.15rem',
    borderRadius: '10px',
    background: 'transparent',
    border: '1px solid transparent',
    color: '#64748b',
    fontSize: '0.88rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap'
  },
  tabActive: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.65rem 1.15rem',
    borderRadius: '10px',
    background: '#eff6ff',
    border: '1px solid #93c5fd',
    color: '#1d4ed8',
    fontSize: '0.88rem',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
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
    flex: '1 1 250px'
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none'
  },
  searchInput: {
    width: '100%',
    padding: '0.6rem 0.85rem 0.6rem 2.3rem',
    borderRadius: '10px',
    background: '#ffffff',
    border: '1.5px solid #cbd5e1',
    color: '#0f172a',
    fontSize: '0.88rem',
    boxSizing: 'border-box',
    outline: 'none',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.6rem 0.95rem',
    borderRadius: '10px',
    background: '#ffffff',
    border: '1.5px solid #cbd5e1',
    color: '#1e293b',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
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
    padding: '0.7rem 0.9rem',
    borderRadius: '10px',
    background: '#ffffff',
    border: '1.5px solid #cbd5e1',
    color: '#0f172a',
    fontSize: '0.88rem',
    outline: 'none'
  },
  savePasswordBtn: {
    marginTop: '0.5rem',
    padding: '0.7rem 1.15rem',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: '#fff',
    border: 'none',
    fontWeight: 700,
    fontSize: '0.88rem',
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
